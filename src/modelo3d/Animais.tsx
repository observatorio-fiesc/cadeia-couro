// Os animais na cena e tudo o que sai deles: o chão, o boi e a vaca em traço, o rúmen com o que entra
// nele, a região da pele escolhida, no próprio lugar, em curvas de nível, e a pilha de camadas da pele,
// ao lado do animal.
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { REGIAO_IDX, type Modelo, type RegiaoId, type Sexo } from './forma'
import type { Interior } from './interior'
import { matContorno, matGrade, matPreparo, matTopo } from './materiais'
import { CAMADAS, COR_DEP, INSUMOS_ANIMAL, ORGAOS, PALETA, regiaoPorId, type Modo } from './receitas'
import { bloco, folha, type CamadaGeo } from './camadas3d'
import { BRANCO, LARG, RECUO_ITEM, TAXA_FADE, TAXA_LINHAS, TAXA_LINHAS_SAI, clamp01, expo, flui, focoDe, traco, useFocos, useResolucao, v3 } from './cena'
import { CASA, GIRO_VISTA, MEIO_CAMADA, lugarPilha } from './lugares'
import type { Anim, Hover, Lente } from './estado'

const SEXOS: Sexo[] = ['boi', 'vaca']

// grade em toda a tela e, sob cada animal, uma sombra quadriculada menor que ele
export function Chao({ anim }: { anim: MutableRefObject<Anim> }) {
  const obj = useMemo(() => {
    const gm = matGrade({ menor: 0.25, maior: 1.25, alfaMenor: 0.07, alfaMaior: 0.17, raio: 26, cor: PALETA.tinta })
    const plano = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), gm)
    plano.rotation.x = -Math.PI / 2
    plano.renderOrder = 0
    const sombras = SEXOS.map((s) => {
      const m = matGrade({ menor: 0.0625, maior: 0.25, alfaMenor: 0.1, alfaMaior: 0.2, raio: 40, cor: PALETA.tinta, preench: 0.035, borda: 0.55 })
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.62), m)
      p.rotation.x = -Math.PI / 2
      p.position.set(CASA[s].x - 0.08 * (s === 'vaca' ? 0.94 : 1), 0.004, CASA[s].z)
      p.renderOrder = 0
      return { p, m }
    })
    return { plano, sombras }
  }, [])
  useFrame(() => {
    // as sombras somem com os animais (no sapato, os animais saem de vista)
    const v = anim.current.vis
    for (const s of obj.sombras) {
      s.m.uniforms.opac.value = (0.6 + 0.4 * Math.min(v.boi, v.vaca)) * Math.min(1, Math.max(v.boi, v.vaca) * 4)
      s.p.visible = s.m.uniforms.opac.value > 0.002
    }
  })
  return (
    <group>
      <primitive object={obj.plano} />
      {obj.sombras.map((s, i) => (
        <primitive key={i} object={s.p} />
      ))}
    </group>
  )
}

type PropsAnimal = {
  m: Modelo
  sexo: Sexo
  anim: MutableRefObject<Anim>
  modo: Modo
  realce: { reg: RegiaoId | null; forte: boolean }
  peleHover: boolean
  onRegiao: (r: RegiaoId) => void
  onPele: (p: THREE.Vector3) => void
  onParte: () => void
  onSai: () => void
  onCliqueRegiao: (r: RegiaoId) => void
  onCliquePele: () => void
}
const REG_IDS: RegiaoId[] = ['pescoco', 'paleta', 'grupao', 'barrigas', 'garras']
export function AnimalCena(p: PropsAnimal) {
  const { m, sexo, anim } = p
  const obj = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(m.pele.p3, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(m.pele.n3, 3))
    geo.setAttribute('reg', new THREE.BufferAttribute(m.pele.reg, 1))
    geo.computeBoundingSphere()
    const pg = new THREE.BufferGeometry()
    pg.setAttribute('position', new THREE.BufferAttribute(m.partes.tri, 3))
    pg.setAttribute('normal', new THREE.BufferAttribute(m.partes.nrm, 3))
    pg.setAttribute('reg', new THREE.BufferAttribute(new Float32Array(m.partes.tri.length / 3).fill(-1), 1))
    pg.computeBoundingSphere()
    const cg = new THREE.BufferGeometry()
    cg.setAttribute('position', new THREE.BufferAttribute(m.pele.casca, 3))
    cg.setAttribute('normal', new THREE.BufferAttribute(m.pele.n3, 3))
    cg.setAttribute('reg', new THREE.BufferAttribute(m.pele.reg, 1))
    cg.computeBoundingSphere()
    // corpo: profundidade (marca o stencil) e traço
    const prepCorpo = new THREE.Mesh(geo, matPreparo(true))
    prepCorpo.renderOrder = 4
    const prepPartes = new THREE.Mesh(pg, matPreparo(true))
    prepPartes.renderOrder = 4
    const matCorpo = matContorno({ largura: LARG.contorno, preench: 0.03, corPreench: BRANCO })
    const corpo = new THREE.Mesh(geo, matCorpo)
    corpo.renderOrder = 5
    const matPartes = matContorno({ largura: LARG.contorno, preench: 0.03, corPreench: BRANCO })
    const partes = new THREE.Mesh(pg, matPartes)
    partes.renderOrder = 5
    // linhas das regiões da carne: na frente, cheias; atrás, tracejadas
    const bordaV = traco(m.borda.p3, LARG.media, BRANCO, 0.6, 6)
    const bordaE = traco(m.borda.p3, 1, BRANCO, 0.2, 6, { escondido: true })
    const lombo = traco(m.media.p3, 1, BRANCO, 0.3, 6)
    const pm = traco(m.partes.media, 1.2, BRANCO, 0.55, 6)
    const pF = traco(m.partes.forte, LARG.forte, BRANCO, 0.9, 6)
    // casca: a linha de fora, que é a pele
    const prepCasca = new THREE.Mesh(cg, matPreparo(false))
    prepCasca.renderOrder = 8
    const matCasca = matContorno({ largura: 1.7, opac: 0.85, corPreench: PALETA.couro, foraDoCorpo: true })
    const casca = new THREE.Mesh(cg, matCasca)
    casca.renderOrder = 9
    return { geo, pg, cg, prepCorpo, prepPartes, corpo, matCorpo, partes, matPartes, bordaV, bordaE, lombo, pm, pF, prepCasca, casca, matCasca }
  }, [m])
  const realce = useMemo(() => (p.realce.reg ? traco(m.contorno[p.realce.reg].p3, LARG.forte, PALETA.couro, 0.95, 7, { semProfundidade: true }) : null), [m, p.realce.reg])
  useEffect(() => () => realce?.obj.geometry.dispose(), [realce])
  useResolucao(useMemo(() => [obj.bordaV, obj.bordaE, obj.lombo, obj.pm, obj.pF, ...(realce ? [realce] : [])].map((t) => t.mat), [obj, realce]))

  useFrame(() => {
    const a = anim.current
    const vis = a.vis[sexo]
    const corpo = a.corpo[sexo]
    const o = vis * corpo
    obj.matCorpo.uniforms.opac.value = o
    obj.matPartes.uniforms.opac.value = o
    obj.bordaV.mat.opacity = obj.bordaV.base * o
    obj.bordaE.mat.opacity = obj.bordaE.base * o
    obj.lombo.mat.opacity = obj.lombo.base * o
    obj.pm.mat.opacity = obj.pm.base * o
    obj.pF.mat.opacity = obj.pF.base * o
    obj.matCasca.uniforms.opac.value = 0.85 * vis * (0.55 + 0.45 * corpo)
    obj.matCasca.uniforms.preench.value = p.peleHover ? 0.34 : 0
    // animal recuado não tapa nada: sem passe de profundidade
    const solido = vis > 0.6
    obj.prepCorpo.visible = obj.prepPartes.visible = obj.prepCasca.visible = solido
    const r = p.realce.reg ? REGIAO_IDX[p.realce.reg] : -1
    obj.matCorpo.uniforms.realce.value = r
    obj.matCorpo.uniforms.alfaRealce.value = p.realce.forte ? 0.3 : 0.1
    if (realce) realce.mat.opacity = (p.realce.forte ? 0.95 : 0.4) * vis
  })

  const ehModoClicavel = p.modo !== 'interior'
  const regDoEvento = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const f = e.face
    if (!f) return null
    const idx = (obj.geo.attributes.reg as THREE.BufferAttribute).getX(f.a)
    return REG_IDS[Math.round(idx)] ?? null
  }
  // o vão: o raio passa pela casca sem tocar o corpo
  const noVao = (e: ThreeEvent<PointerEvent | MouseEvent>) => !e.intersections.some((i) => i.object === obj.corpo || i.object === obj.partes)
  return (
    <group>
      <primitive object={obj.prepCorpo} />
      <primitive object={obj.prepPartes} />
      <primitive
        object={obj.corpo}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (!ehModoClicavel) return
          e.stopPropagation()
          const r = regDoEvento(e)
          if (r) p.onRegiao(r)
        }}
        onPointerOut={() => p.onSai()}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (!ehModoClicavel || e.delta > 6) return
          e.stopPropagation()
          const r = regDoEvento(e)
          if (r) p.onCliqueRegiao(r)
        }}
      />
      <primitive
        object={obj.partes}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (!ehModoClicavel) return
          e.stopPropagation()
          p.onParte()
        }}
        onPointerOut={() => p.onSai()}
      />
      <primitive object={obj.bordaV.obj} />
      <primitive object={obj.bordaE.obj} />
      <primitive object={obj.lombo.obj} />
      <primitive object={obj.pm.obj} />
      <primitive object={obj.pF.obj} />
      {realce && <primitive object={realce.obj} />}
      <primitive object={obj.prepCasca} />
      <primitive
        object={obj.casca}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (!ehModoClicavel || !noVao(e)) return
          e.stopPropagation()
          p.onPele(e.point.clone())
        }}
        onPointerOut={() => p.onSai()}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (!ehModoClicavel || e.delta > 6 || !noVao(e)) return
          e.stopPropagation()
          p.onCliquePele()
        }}
      />
    </group>
  )
}

// por dentro: órgãos tracejados, o que o animal come (no rúmen) e os adubos por trás
export function InteriorCena(p: { it: Interior; sexo: Sexo; anim: MutableRefObject<Anim>; lente: Lente; ativo: boolean; orgao: string | null; hover: Hover; onHover: (h: Hover) => void; onOrgao: (id: string) => void }) {
  const { it, sexo, anim } = p
  const obj = useMemo(() => {
    const orgaos = it.orgaos.filter((o) => ORGAOS.some((x) => x.id === o.id)).map((o) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(o.tri, 3))
      g.setAttribute('normal', new THREE.BufferAttribute(o.nrm, 3))
      g.setAttribute('reg', new THREE.BufferAttribute(new Float32Array(o.tri.length / 3).fill(-1), 1))
      g.computeBoundingSphere()
      const prep = new THREE.Mesh(g, matPreparo(false))
      prep.renderOrder = 2
      const mat = matContorno({ largura: 2.4, tracejado: 26, preench: 0.03, corPreench: BRANCO, opac: 0.8 })
      const mesh = new THREE.Mesh(g, mat)
      mesh.renderOrder = 3
      return { id: o.id, g, prep, mat, mesh }
    })
    const capim = traco(it.capim, 1.3, PALETA.capim, 0.85, 1, { semProfundidade: true })
    const esfera = new THREE.SphereGeometry(1, 10, 8)
    const nuvens = [...it.graos, ...it.adubos].map((g) => {
      const n = g.tam.length
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false })
      const inst = new THREE.InstancedMesh(esfera, mat, n)
      const mx = new THREE.Matrix4()
      for (let i = 0; i < n; i++) {
        const t = g.tam[i]
        mx.makeScale(t, t, t).setPosition(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2])
        inst.setMatrixAt(i, mx)
      }
      inst.renderOrder = 1
      inst.frustumCulled = false
      return { id: g.id, inst, mat }
    })
    return { orgaos, capim, nuvens }
  }, [it])
  useResolucao(useMemo(() => [obj.capim.mat], [obj]))
  // cores: natural ou dependência externa
  useEffect(() => {
    for (const n of obj.nuvens) {
      const ins = INSUMOS_ANIMAL.find((x) => x.id === n.id)!
      n.mat.color.set(p.lente === 'dependencia' ? COR_DEP[ins.dep] : ins.cor)
    }
    const pasto = INSUMOS_ANIMAL.find((x) => x.id === 'pasto')!
    obj.capim.mat.color.set(p.lente === 'dependencia' ? COR_DEP[pasto.dep] : pasto.cor)
  }, [obj, p.lente])
  // níveis de cada órgão e de cada insumo, amortecidos: o escolhido acende, os outros recuam devagar
  const nivel = useMemo(() => new Map<string, number>(), [])
  const amortece = (id: string, alvo: number, d: number) => {
    const v = expo(nivel.get(id) ?? alvo, alvo, d, TAXA_FADE * 1.6)
    nivel.set(id, v)
    return v
  }
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05)
    const a = anim.current
    const f = a.int[sexo] * a.vis[sexo]
    const hv = p.hover
    for (const o of obj.orgaos) {
      const sel = p.orgao === o.id || (hv?.tipo === 'orgao' && hv.id === o.id)
      const outro = (p.orgao || hv?.tipo === 'orgao') && !sel
      const n = amortece(o.id, sel ? 1 : outro ? RECUO_ITEM : 0.75, d)
      o.mat.uniforms.opac.value = f * n
      o.mat.uniforms.preench.value = 0.025 + 0.075 * clamp01((n - 0.75) / 0.25)
      o.mat.uniforms.largura.value = 2.3 + 0.7 * clamp01((n - 0.75) / 0.25)
      o.mesh.visible = f > 0.01
      // o passe de profundidade esconde as dobras do próprio órgão; num animal recuado, ou com o interior
      // só sugerido, ele não pode tapar o que está à frente (a peça, o gráfico)
      o.prep.visible = f > 0.2 && a.vis[sexo] > 0.6
    }
    const insHover = hv?.tipo === 'insumo' ? hv.id : null
    for (const n of obj.nuvens) {
      const ins = INSUMOS_ANIMAL.find((x) => x.id === n.id)!
      const base = ins.grupo === 'adubo' ? (p.lente === 'dependencia' ? 0.9 : 0.45) : 0.85
      n.mat.opacity = f * amortece(`i-${n.id}`, insHover ? (insHover === n.id ? 1 : 0.2) : base, d)
      n.inst.visible = f > 0.01
    }
    obj.capim.mat.opacity = f * amortece('i-pasto', insHover ? (insHover === 'pasto' ? 1 : 0.2) : 0.8, d)
    obj.capim.obj.visible = f > 0.01
  })
  return (
    <group>
      {obj.orgaos.map((o) => (
        <group key={o.id}>
          <primitive object={o.prep} />
          <primitive
            object={o.mesh}
            onPointerMove={
              p.ativo
                ? (e: ThreeEvent<PointerEvent>) => {
                    e.stopPropagation()
                    p.onHover({ tipo: 'orgao', id: o.id })
                    document.body.style.cursor = 'pointer'
                  }
                : undefined
            }
            onPointerOut={
              p.ativo
                ? () => {
                    p.onHover(null)
                    document.body.style.cursor = ''
                  }
                : undefined
            }
            onClick={
              p.ativo
                ? (e: ThreeEvent<MouseEvent>) => {
                    if (e.delta > 6) return
                    e.stopPropagation()
                    p.onOrgao(o.id)
                  }
                : undefined
            }
          />
        </group>
      ))}
      <primitive object={obj.capim.obj} />
      {obj.nuvens.map((n) => (
        <primitive key={n.id} object={n.inst} />
      ))}
    </group>
  )
}

/**
 * A região escolhida, no próprio lugar: a peça de pele (do corpo até a linha de fora) desenhada em
 * curvas de nível, sem pintura, com o relevo da pele aberta. Quanto mais fechada a fibra, mais miúdo o relevo.
 * O corpo do próprio animal entra só como profundidade, para esconder o lado de lá da região.
 * Cada região tem o próprio relógio: trocar de região apaga a anterior enquanto a nova acende.
 */
export function PecaCena(p: { m: Modelo; sexo: Sexo; regiao: RegiaoId; anim: MutableRefObject<Anim>; ativa: boolean; onApagou: () => void }) {
  const { m, sexo, regiao, anim } = p
  const pc = m.pecas[regiao]
  const obj = useMemo(() => {
    const r = regiaoPorId(regiao)
    const g = new THREE.BufferGeometry()
    // cópias: o array é do modelo, compartilhado
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pc.pos), 3))
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pc.nrm), 3))
    g.setAttribute('lado', new THREE.BufferAttribute(pc.lado, 1))
    g.setAttribute('uvm', new THREE.BufferAttribute(pc.uvm, 2))
    g.computeBoundingSphere()
    // o desenho da pele aberta (o mesmo relevo da mesa de classificação), sobre a superfície da região;
    // a fibra mais fechada da região dá um relevo mais miúdo
    const mat = matTopo({ campo: 3, escala: 0.2 * (r.celula / 0.06), passo: 0.06, linha: LARG.curva, contorno: LARG.contorno, alfaLinha: 0.7, preench: 0.05, soCima: true, semente: REGIAO_IDX[regiao] * 3.1 })
    const mesh = new THREE.Mesh(g, mat)
    mesh.renderOrder = 11
    const corpoG = new THREE.BufferGeometry()
    corpoG.setAttribute('position', new THREE.BufferAttribute(m.pele.p3, 3))
    corpoG.computeBoundingSphere()
    const prep = new THREE.Mesh(corpoG, matPreparo(false))
    prep.renderOrder = 10.5
    const borda = traco(pc.borda, LARG.contorno, BRANCO, 0.95, 12)
    return { g, mat, mesh, corpoG, prep, borda }
  }, [m, pc, regiao])
  useResolucao(useMemo(() => [obj.borda.mat], [obj]))
  useEffect(
    () => () => {
      obj.g.dispose()
      obj.mat.dispose()
      obj.corpoG.dispose()
      obj.borda.obj.geometry.dispose()
    },
    [obj],
  )
  const grupo = useRef<THREE.Group>(null)
  const rel = useRef({ k: 0, apagou: false })
  useFrame((_, dt) => {
    const g = grupo.current
    if (!g) return
    const d = Math.min(dt, 0.05)
    const a = anim.current
    const r = rel.current
    const acende = p.ativa && a.pecaA > 0
    r.k = expo(r.k, acende ? 1 : 0, d, acende ? TAXA_LINHAS : TAXA_LINHAS_SAI)
    if (acende) r.apagou = false
    if (p.ativa) a.peca = r.k
    if (!p.ativa && r.k === 0 && !r.apagou) {
      r.apagou = true
      p.onApagou()
    }
    g.visible = r.k > 0.002
    obj.mat.uniforms.opac.value = r.k
    obj.borda.mat.opacity = obj.borda.base * r.k
  })
  return (
    <group ref={grupo} position={CASA[sexo]} visible={false}>
      <primitive object={obj.prep} />
      <primitive object={obj.mesh} />
      <primitive object={obj.borda.obj} />
    </group>
  )
}

// ================================================================ camadas do couro, na pilha ao lado do animal escolhido
// posição das camadas na pilha (de cima para baixo), com folga entre elas
export const Y_CAMADA = (() => {
  const ys: number[] = []
  let y = 0.42
  CAMADAS.forEach((c, i) => {
    ys.push(y - c.esp / 2)
    y -= c.esp + (i < 2 ? 0.13 : 0.1)
  })
  const meio = (ys[0] + ys[ys.length - 1]) / 2
  return ys.map((v) => v - meio)
})()
// a fibra de cada camada: a flor, fechada e fina; a raspa, mais aberta; as sobras, emboladas
const RELEVO: Record<string, { escala: number; passo: number }> = {
  integral: { escala: 0.05, passo: 0.05 },
  lixada: { escala: 0.07, passo: 0.06 },
  raspa: { escala: 0.12, passo: 0.07 },
  sobras: { escala: 0.04, passo: 0.08 },
}
type PropsCamadas = { sexo: Sexo; anim: MutableRefObject<Anim>; grupos: MutableRefObject<(THREE.Group | null)[]>; sel: string | null; hover: string | null; onHover: (id: string | null) => void; onClique: (id: string) => void }
export function CamadasCena(p: PropsCamadas) {
  const obj = useMemo(
    () =>
      CAMADAS.map((c, i) => {
        const geo: CamadaGeo =
          c.forma === 'folha'
            ? folha(11 + i * 7, MEIO_CAMADA, c.esp, i === 0 ? { a: 0.034, fase: 0, ponta: 0.075, dirPonta: 2.4 } : { a: 0.028, fase: 1, ponta: 0.06, dirPonta: -0.6 })
            : bloco(31 + i * 5, MEIO_CAMADA * (i === 2 ? 0.94 : 1), c.esp)
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(geo.pos, 3))
        g.setAttribute('normal', new THREE.BufferAttribute(geo.nrm, 3))
        g.setAttribute('lado', new THREE.BufferAttribute(geo.lado, 1))
        g.computeBoundingSphere()
        const rel = RELEVO[c.id]
        const mat = matTopo({ campo: 1, escala: rel.escala, passo: rel.passo, linha: LARG.curva, contorno: LARG.contorno, alfaLinha: 0.62, preench: 0.05, semente: i * 5.7 })
        const mesh = new THREE.Mesh(g, mat)
        mesh.renderOrder = 10
        const linhas = traco(geo.linhas, 1.8, BRANCO, 0.85, 11)
        const finas = traco(geo.finas, 1, BRANCO, 0.35, 11)
        return { c, g, mat, mesh, linhas, finas }
      }),
    [],
  )
  useResolucao(useMemo(() => obj.flatMap((o) => [o.linhas.mat, o.finas.mat]), [obj]))
  // a pilha gira 45 graus em relação à vista: a mesma quina de frente para a câmera
  const giro = useMemo(() => new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), Math.PI / 4 + GIRO_VISTA), [])
  const focos = useFocos(useMemo(() => CAMADAS.map((c) => c.id), []))
  // onde a pilha está: segue o animal escolhido, amortecida, então trocar Boi e Vaca a faz deslizar
  const lugar = useMemo(() => ({ pos: v3(), posta: false }), [])
  useFrame((_, dt) => {
    const a = p.anim.current
    const d = Math.min(dt, 0.05)
    const alvo = lugarPilha(p.sexo)
    if (!lugar.posta || a.pele < 0.002) lugar.pos.copy(alvo)
    else lugar.pos.lerp(alvo, 1 - Math.exp(-6 * d))
    lugar.posta = true
    obj.forEach((o, i) => {
      const g = p.grupos.current[i]
      if (!g) return
      // as camadas aparecem no lugar, uma depois da outra, de cima para baixo, com uma leve subida
      const k = flui(clamp01((a.pele - i * 0.1) / 0.7))
      g.visible = k > 0.002
      g.position.set(lugar.pos.x, lugar.pos.y + Y_CAMADA[i] - 0.04 * (1 - k), lugar.pos.z)
      g.quaternion.copy(giro)
      const f = focoDe(focos, o.c.id, p.sel, p.hover, d)
      const quente = p.sel === o.c.id || p.hover === o.c.id
      const op = k * f
      o.mat.uniforms.opac.value = op
      o.mat.uniforms.realce.value = expo(o.mat.uniforms.realce.value, quente ? 1 : 0, d, 10)
      o.linhas.mat.opacity = o.linhas.base * op
      o.finas.mat.opacity = o.finas.base * op
    })
  })
  return (
    <group>
      {obj.map((o, i) => (
        <group
          key={o.c.id}
          ref={(el) => {
            p.grupos.current[i] = el
          }}
          visible={false}
        >
          <primitive
            object={o.mesh}
            onPointerMove={(e: ThreeEvent<PointerEvent>) => {
              if (p.anim.current.pele < 1) return
              e.stopPropagation()
              p.onHover(o.c.id)
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              p.onHover(null)
              document.body.style.cursor = ''
            }}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              if (p.anim.current.pele < 1 || e.delta > 6) return
              e.stopPropagation()
              p.onClique(o.c.id)
            }}
          />
          <primitive object={o.linhas.obj} />
          <primitive object={o.finas.obj} />
        </group>
      ))}
    </group>
  )
}
