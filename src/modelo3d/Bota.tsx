// O sapato de segurança, a ponta da cadeia, numa vista à parte: a bota montada, com as peças um pouco
// afastadas (vista explodida fixa, sem movimento), em traço e curvas de nível. A peça escolhida vai para a
// frente do desenho; as outras recuam, como no visualizador do submarino.
import { useMemo, type MutableRefObject } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { matTopo } from './materiais'
import { PALETA, PARTES_BOTA } from './receitas'
import { BRANCO, LARG, expo, focoDe, superficie, traco, useFocos, useResolucao, type Traco } from './cena'
import { BOTA, GIRO_VISTA } from './lugares'
import { bota } from './geometria'
import type { Anim } from './estado'

type Ancoras = MutableRefObject<Map<string, THREE.Object3D>>
const COR_REALCE = new THREE.Color(PALETA.couro)
const COR_TINTA = new THREE.Color(BRANCO)

/** Registra um ponto da cena para os rótulos (a vista lê a posição no mundo a cada quadro). */
function Ancora({ id, ancoras, pos }: { id: string; ancoras: Ancoras; pos: THREE.Vector3 }) {
  return (
    <group
      position={pos}
      ref={(el) => {
        if (el) ancoras.current.set(id, el)
        else ancoras.current.delete(id)
      }}
    />
  )
}

type PropsItens = { anim: MutableRefObject<Anim>; ancoras: Ancoras; sel: string | null; hover: string | null; onHover: (id: string | null) => void; onClique: (id: string) => void }
function Clicavel({ obj, id, p, ativo }: { obj: THREE.Object3D; id: string; p: PropsItens; ativo: () => boolean }) {
  return (
    <primitive
      object={obj}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        if (!ativo()) return
        e.stopPropagation()
        p.onHover(id)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        p.onHover(null)
        document.body.style.cursor = ''
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!ativo() || e.delta > 6) return
        e.stopPropagation()
        p.onClique(id)
      }}
    />
  )
}
// Montada, com as peças um pouco afastadas (vista explodida fixa, sem movimento), para que as de dentro
// apareçam. A escolhida vai para a frente do desenho.
// três quartos, como antes, mas em relação à vista: a ponta para a direita, o lado de fora para a câmera
export const GIRO_BOTA = -0.5 + GIRO_VISTA
export function BotaCena(p: PropsItens) {
  const obj = useMemo(() => {
    const geo = bota()
    return PARTES_BOTA.map((pt) => {
      const pg = geo[pt.id]
      const s = pg.sup ? superficie(pg.sup, matTopo({ campo: 0, passo: 0.011, linha: LARG.curva, contorno: LARG.contorno, alfaLinha: 0.55, preench: 0.04, semente: pt.n * 1.7 }), 7) : null
      const linhas: Traco | null = pg.linhas.length ? traco(pg.linhas, pt.id === 'forro' ? 1.2 : 1.6, BRANCO, 0.85, 8, pt.id === 'forro' ? { tracejado: [0.008, 0.006] } : {}) : null
      return { id: pt.id, s, linhas, desloc: pg.desloc, ancora: pg.ancora }
    })
  }, [])
  useResolucao(useMemo(() => obj.flatMap((o) => (o.linhas ? [o.linhas.mat] : [])), [obj]))
  const focos = useFocos(useMemo(() => PARTES_BOTA.map((pt) => pt.id), []))
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05)
    const e = p.anim.current.est.bota
    for (const o of obj) {
      const f = focoDe(focos, o.id, p.sel, p.hover, d)
      const quente = p.sel === o.id || p.hover === o.id
      // a peça escolhida passa à frente de tudo: sem o passe de profundidade, depois da limpeza
      const frente = p.sel === o.id
      if (o.s) {
        o.s.mat.uniforms.opac.value = e * f
        o.s.mat.uniforms.realce.value = expo(o.s.mat.uniforms.realce.value, quente ? 1 : 0, d, 10)
        o.s.mesh.renderOrder = frente ? 12 : 7
        o.s.prep.visible = !frente && e > 0.5
        o.s.mesh.visible = e > 0.003
      }
      if (o.linhas) {
        o.linhas.mat.opacity = o.linhas.base * e * f
        o.linhas.mat.color.lerp(quente ? COR_REALCE : COR_TINTA, 1 - Math.exp(-10 * d))
        o.linhas.obj.renderOrder = frente ? 13 : 8
        o.linhas.obj.visible = e > 0.003
      }
    }
  })
  const ativo = () => p.anim.current.est.bota > 0.9
  return (
    <group position={BOTA} rotation={[0, GIRO_BOTA, 0]}>
      {obj.map((o) => (
        <group key={o.id} position={o.desloc}>
          {o.s && <primitive object={o.s.prep} />}
          {o.s && <Clicavel obj={o.s.mesh} id={o.id} p={p} ativo={ativo} />}
          {o.linhas && <primitive object={o.linhas.obj} />}
          <Ancora id={`parte-${o.id}`} ancoras={p.ancoras} pos={o.ancora} />
        </group>
      ))}
    </group>
  )
}
