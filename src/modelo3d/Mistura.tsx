// O que mantém o animal, como um cone pequeno sob ele: no chão, o que vai ao solo (adubos e calcário); no anel
// do meio, o que o gado come (pasto, ração, ureia, sal mineral); no alto, o rúmen. As ligações são as da
// cadeia (ALIMENTA). É o mesmo desenho do Cone 3D, em miniatura: dali se passa à rede inteira.
import { useMemo, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Sexo } from './forma'
import type { Interior } from './interior'
import { ALIMENTA, INSUMOS_ANIMAL, PALETA } from './receitas'
import { TAXA_FADE, clamp01, expo, traco, useResolucao, v3 } from './cena'
import { naVista } from './lugares'
import type { Anim } from './estado'

type V = THREE.Vector3
export type Nivel = 'solo' | 'cocho'
export type MarcaMistura = { id: string; p: V; nivel: Nivel; lado: 'esq' | 'dir' }
export type Mistura = { marcas: MarcaMistura[]; rumen: V; aneis: Record<Nivel, { c: V; r: number }> }

// o ângulo de cada item no seu anel, em graus, contado do lado da câmera (positivo: para a esquerda da tela).
// Os itens ficam na metade da frente; as pontas do anel, à esquerda e à direita, ficam livres para o nome do nível.
const FRENTE = THREE.MathUtils.radToDeg(Math.atan2(1, 0.55)) // a câmera do rúmen olha de naVista(0.55, 0.42, 1)
const ANGULO: Record<string, number> = {
  calcario: 62,
  adubo_n: 22,
  adubo_p: -22,
  adubo_k: -62,
  pasto: 60,
  racao: 20,
  ureia: -20,
  sal_mineral: -60,
}
/** O nome curto, no anel; o nome inteiro aparece ao passar o mouse. */
export const CURTO: Record<string, string> = {
  pasto: 'Pasto',
  racao: 'Ração',
  sal_mineral: 'Sal mineral',
  ureia: 'Ureia',
  adubo_n: 'Adubo nitrogenado',
  adubo_p: 'Adubo fosfatado',
  adubo_k: 'Adubo potássico',
  calcario: 'Calcário',
}

/** Os lugares do cone pequeno, no espaço do animal (o mesmo do interior). */
export function montarMistura(it: Interior): Mistura {
  const rc = it.rumen.c
  const h = rc.y
  const aneis: Mistura['aneis'] = {
    solo: { c: v3(rc.x, 0.004, rc.z), r: 0.6 * h },
    cocho: { c: v3(rc.x, 0.42 * h, rc.z), r: 0.36 * h },
  }
  const marcas = INSUMOS_ANIMAL.map((ins) => {
    const nivel: Nivel = ins.grupo === 'adubo' ? 'solo' : 'cocho'
    const a = THREE.MathUtils.degToRad(FRENTE + ANGULO[ins.id])
    const { c, r } = aneis[nivel]
    const p = c.clone().add(naVista(Math.cos(a), 0, Math.sin(a)).multiplyScalar(r))
    return { id: ins.id, p, nivel, lado: ANGULO[ins.id] > 0 ? ('esq' as const) : ('dir' as const) }
  })
  // as ligações chegam ao fundo do rúmen
  return { marcas, rumen: rc.clone().add(v3(0, -it.rumen.r.y * 0.9, 0)), aneis }
}

/** Um ponto do anel, para o nome do nível ficar na borda esquerda. */
export function pontosDoAnel(m: Mistura, nivel: Nivel, n = 24): V[] {
  const { c, r } = m.aneis[nivel]
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2
    return c.clone().add(v3(Math.cos(a) * r, 0, Math.sin(a) * r))
  })
}

// curva de uma ligação: arqueada para fora do eixo, como no Cone 3D
function curva(a: V, b: V, eixo: V, out: number[], seg = 16) {
  const meio = a.clone().add(b).multiplyScalar(0.5)
  const fora = v3(meio.x - eixo.x, 0, meio.z - eixo.z)
  const d = a.distanceTo(b)
  if (fora.lengthSq() > 1e-6) meio.add(fora.normalize().multiplyScalar(d * 0.16))
  let ant = a
  for (let k = 1; k <= seg; k++) {
    const f = k / seg
    const w = 1 - f
    const q = v3(w * w * a.x + 2 * w * f * meio.x + f * f * b.x, w * w * a.y + 2 * w * f * meio.y + f * f * b.y, w * w * a.z + 2 * w * f * meio.z + f * f * b.z)
    out.push(ant.x, ant.y, ant.z, q.x, q.y, q.z)
    ant = q
  }
}

/** Do item em foco: as ligações que o trazem e o caminho dele até o rúmen. */
function acesas(foco: string | null): Set<number> {
  const out = new Set<number>()
  if (!foco) return out
  ALIMENTA.forEach(([, para], i) => para === foco && out.add(i))
  let frente = [foco]
  while (frente.length) {
    const prox: string[] = []
    ALIMENTA.forEach(([de, para], i) => {
      if (frente.includes(de) && !out.has(i)) {
        out.add(i)
        prox.push(para)
      }
    })
    frente = prox
  }
  return out
}

export function MisturaCena({ it, sexo, anim, foco }: { it: Interior; sexo: Sexo; anim: MutableRefObject<Anim>; foco: string | null }) {
  const m = useMemo(() => montarMistura(it), [it])
  const obj = useMemo(() => {
    const anel = (nivel: Nivel, tracejado: boolean) => {
      const pts = pontosDoAnel(m, nivel, 96)
      const seg: number[] = []
      pts.forEach((p, k) => {
        const q = pts[(k + 1) % pts.length]
        seg.push(p.x, p.y, p.z, q.x, q.y, q.z)
      })
      return traco(new Float32Array(seg), 1, PALETA.tinta, 0.5, 4, { semProfundidade: true, ...(tracejado ? { tracejado: [0.03, 0.022] as [number, number] } : {}) })
    }
    const eixo = m.aneis.solo.c
    const pos = (id: string) => (id === 'rumen' ? m.rumen : m.marcas.find((x) => x.id === id)!.p)
    const ligacoes = ALIMENTA.map(([de, para]) => {
      const seg: number[] = []
      curva(pos(de), pos(para), eixo, seg)
      return traco(new Float32Array(seg), 1.2, PALETA.tinta, 0.45, 4, { semProfundidade: true })
    })
    // o eixo, tracejado, do chão ao rúmen
    const ax = traco(new Float32Array([eixo.x, eixo.y, eixo.z, m.rumen.x, m.rumen.y, m.rumen.z]), 1, PALETA.tinta, 0.3, 4, { semProfundidade: true, tracejado: [0.02, 0.025] })
    return { solo: anel('solo', true), cocho: anel('cocho', false), ligacoes, ax }
  }, [m])
  useResolucao(useMemo(() => [obj.solo.mat, obj.cocho.mat, obj.ax.mat, ...obj.ligacoes.map((l) => l.mat)], [obj]))
  const luz = useMemo(() => acesas(foco), [foco])
  const nivel = useMemo(() => new Map<number, number>(), [])
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05)
    const a = anim.current
    // só no rúmen em foco: no resto do Modelo 3D o interior fica sugerido, e o cone pequeno não aparece
    const k = clamp01((a.int[sexo] * a.vis[sexo] - 0.5) / 0.5)
    const vis = k > 0.01
    obj.solo.mat.opacity = 0.55 * k
    obj.cocho.mat.opacity = 0.5 * k
    obj.ax.mat.opacity = 0.3 * k
    // as ligações entram depois dos anéis
    const kl = clamp01(k * 1.8 - 0.8)
    obj.ligacoes.forEach((l, i) => {
      const alvo = foco ? (luz.has(i) ? 1 : 0.1) : 0.5
      const v = expo(nivel.get(i) ?? alvo, alvo, d, TAXA_FADE * 1.6)
      nivel.set(i, v)
      l.mat.opacity = v * kl
      l.obj.visible = vis
    })
    for (const o of [obj.solo, obj.cocho, obj.ax]) o.obj.visible = vis
  })
  return (
    <group>
      <primitive object={obj.solo.obj} />
      <primitive object={obj.cocho.obj} />
      <primitive object={obj.ax.obj} />
      {obj.ligacoes.map((l, i) => (
        <primitive key={i} object={l.obj} />
      ))}
    </group>
  )
}
