// Aba Modelo 3D: boi e vaca transparentes, flutuando sobre a grade.
// Por dentro, um mapa leve do que mantém o animal (órgãos, o que ele come e os adubos por trás).
// Por fora, uma linha dupla: o vão entre o corpo e a linha de fora é a pele que vai ao curtume.
// Clicar numa região destaca só aquela peça de pele, com a mistura da química da ribeira (MT).
// Clicar no vão abre as camadas da pele (MS); cada camada abre o que ela pode virar.
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import type { Contexto } from '../dados/contexto'
import { gerarModelo, REGIAO_IDX, type Modelo, type RegiaoId, type Sexo } from '../modelo3d/forma'
import { gerarInterior, type Interior } from '../modelo3d/interior'
import { bloco, folha, type CamadaGeo } from '../modelo3d/camadas3d'
import { amostra } from '../modelo3d/amostras'
import { definirMistura, matCamada, matContorno, matGrade, matMistura, matPreparo } from '../modelo3d/materiais'
import { CAMADAS, COR_DEP, CROMO_SOBRAS, INSUMOS_ANIMAL, NOME_DEP, ORGAOS, PALETA, QUIMICOS_MS, QUIMICOS_MT, REGIOES, regiaoPorId, type Dep, type Modo } from '../modelo3d/receitas'
import { Decomposicao } from '../modelo3d/Decomposicao'
import '../modelo3d/modelo3d.css'

const BRANCO = '#f6f1e7'
const FLUTUA = 0.42 // os animais flutuam sobre a grade
const SEXOS: Sexo[] = ['boi', 'vaca']
const MENOS_MOVIMENTO = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const CASA: Record<Sexo, THREE.Vector3> = { boi: new THREE.Vector3(-1.08, FLUTUA, -0.62), vaca: new THREE.Vector3(1.02, FLUTUA, 0.6) }
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const suave = (t: number) => t * t * (3 - 2 * t)

// a peça escolhida sai um pouco do corpo, sem girar: continua reconhecível no lugar dela
const DESLOC: Record<RegiaoId, THREE.Vector3> = {
  pescoco: v3(0.3, 0.14, 0.46),
  paleta: v3(0.02, 0.26, 0.52),
  grupao: v3(-0.06, 0.26, 0.52),
  barrigas: v3(0, -0.1, 0.62),
  garras: v3(0, -0.04, 0.6),
}
const escalaPeca = (r: RegiaoId) => (r === 'garras' ? 1 : 1.1)
type Quadro = { centro: THREE.Vector3; direita: number; raio: number }
function quadroPeca(m: Modelo, s: Sexo, r: RegiaoId): Quadro {
  const pc = m.pecas[r]
  let direita = 0
  let raio = 0
  for (let i = 0; i < pc.pos.length; i += 3) {
    const dx = pc.pos[i] - pc.centro.x
    const dy = pc.pos[i + 1] - pc.centro.y
    const dz = pc.pos[i + 2] - pc.centro.z
    if (dx > direita) direita = dx
    const d = Math.hypot(dx, dy, dz)
    if (d > raio) raio = d
  }
  const e = escalaPeca(r)
  return { centro: CASA[s].clone().add(pc.centro).add(DESLOC[r]), direita: direita * e, raio: raio * e }
}
const lugarPilha = (s: Sexo) => CASA[s].clone().add(v3(-0.05, 1.02, 1.32))
const GRAF_ALTURA = 1.05
const MEIO_PILHA = 0.37 * Math.SQRT2 // a pilha gira 45 graus: meia largura na tela

type Lente = 'insumos' | 'dependencia'
type Item = { id: string; nome: string; cor: string; valor: number; dep: Dep; detalhe: string; faixa?: string; depNota: string }

function cameraDe(modo: Modo, s: Sexo, quadro: Quadro | null, orgaoCentro: THREE.Vector3 | null) {
  if (modo === 'interior') {
    const alvo = orgaoCentro ? orgaoCentro.clone() : CASA[s].clone().add(v3(0.08, 0.98, 0))
    const d = orgaoCentro ? 1.8 : 3.15
    return { pos: alvo.clone().add(v3(0.55, 0.42, 1).normalize().multiplyScalar(d)), alvo }
  }
  if (modo === 'regiao' && quadro) {
    const alvo = quadro.centro.clone().add(v3((quadro.direita + 0.5) / 2, 0, 0))
    const d = 2.3 + 1.7 * quadro.raio
    return { pos: alvo.clone().add(v3(0.12, 0.32, 1).normalize().multiplyScalar(d)), alvo }
  }
  if (modo === 'pele') {
    const alvo = lugarPilha(s).add(v3(0.45, -0.02, 0))
    return { pos: alvo.clone().add(v3(0.3, 0.95, 3.25)), alvo }
  }
  return { pos: CAM_GERAL.pos.clone(), alvo: CAM_GERAL.alvo.clone() }
}
const CAM_GERAL = { pos: v3(1.15, 2.75, 6.6), alvo: v3(0.0, 1.1, 0) }

// ---------------------------------------------------------------- estado animado (fora do React)
type PorSexo<T> = Record<Sexo, T>
type Anim = {
  vis: PorSexo<number> // presença do animal
  visA: PorSexo<number>
  corpo: PorSexo<number> // força do traço do corpo (recua quando uma peça ou as camadas estão à frente)
  corpoA: PorSexo<number>
  int: PorSexo<number> // força do interior
  intA: PorSexo<number>
  peca: number // a peça sai do corpo
  pecaA: number
  pele: number // as camadas saem da pele
  peleA: number
  graf: number // gráfico ao lado
  grafA: number
  voo: { pos: THREE.Vector3; alvo: THREE.Vector3 } | null
  t: number
}
const novaAnim = (): Anim => ({
  vis: { boi: 1, vaca: 1 },
  visA: { boi: 1, vaca: 1 },
  corpo: { boi: 1, vaca: 1 },
  corpoA: { boi: 1, vaca: 1 },
  int: { boi: 0.28, vaca: 0.28 },
  intA: { boi: 0.28, vaca: 0.28 },
  peca: 0,
  pecaA: 0,
  pele: 0,
  peleA: 0,
  graf: 0,
  grafA: 0,
  voo: null,
  t: 0,
})
const linear = (x: number, alvo: number, passo: number) => (Math.abs(alvo - x) <= passo ? alvo : x + Math.sign(alvo - x) * passo)
const expo = (x: number, alvo: number, dt: number, taxa: number) => {
  const r = x + (alvo - x) * (1 - Math.exp(-dt * taxa))
  return Math.abs(alvo - r) < 0.002 ? alvo : r
}

// ---------------------------------------------------------------- traço grosso (linhas de largura em pixels)
type Traco = { obj: LineSegments2; arr: Float32Array; mat: LineMaterial; base: number }
function traco(pos: Float32Array, largura: number, cor: string, opacidade: number, ordem: number, o: { escondido?: boolean; semProfundidade?: boolean } = {}): Traco {
  const arr = new Float32Array(pos)
  const g = new LineSegmentsGeometry()
  g.setPositions(arr)
  const mat = new LineMaterial({ color: new THREE.Color(cor).getHex(), linewidth: largura, transparent: true, opacity: opacidade, depthWrite: false })
  if (o.escondido) {
    // a parte de trás do corpo: tracejada, como linha oculta em desenho técnico
    mat.depthFunc = THREE.GreaterDepth
    mat.dashed = true
    mat.dashSize = 0.022
    mat.gapSize = 0.018
  }
  if (o.semProfundidade) mat.depthTest = false
  const obj = new LineSegments2(g, mat)
  if (o.escondido) obj.computeLineDistances()
  obj.frustumCulled = false
  obj.renderOrder = ordem
  return { obj, arr, mat, base: opacidade }
}
const avisarTraco = (t: Traco) => {
  const a = t.obj.geometry.attributes.instanceStart as THREE.InterleavedBufferAttribute
  a.data.needsUpdate = true
}
function useResolucao(materiais: LineMaterial[]) {
  const size = useThree((s) => s.size)
  useEffect(() => {
    for (const m of materiais) m.resolution.set(size.width, size.height)
  }, [size, materiais])
}

// ---------------------------------------------------------------- tipos da vista
type Hover =
  | { tipo: 'regiao'; regiao: RegiaoId; sexo: Sexo | null }
  | { tipo: 'pele'; sexo: Sexo }
  | { tipo: 'animal'; sexo: Sexo }
  | { tipo: 'quimico'; id: string }
  | { tipo: 'orgao'; id: string }
  | { tipo: 'insumo'; id: string }
  | { tipo: 'camada'; id: string }
  | null
const mesmoHover = (a: Hover, b: Hover) => JSON.stringify(a) === JSON.stringify(b)

type ModoRotulo = 'perto' | 'esq' | 'dir' | 'legenda' | 'baixo' | 'painel'
type Alvo = { id: string; modo: ModoRotulo; pontos: (cam: THREE.Camera) => THREE.Vector3[]; dx?: number; dy?: number }
type Rotulo = Alvo & { conteudo: ReactNode; classe?: string }

// posição das camadas na pilha (de cima para baixo), com folga entre elas
const Y_CAMADA = (() => {
  const ys: number[] = []
  let y = 0.42
  CAMADAS.forEach((c, i) => {
    ys.push(y - c.esp / 2)
    y -= c.esp + (i < 2 ? 0.13 : 0.1)
  })
  const meio = (ys[0] + ys[ys.length - 1]) / 2
  return ys.map((v) => v - meio)
})()
const MEIO_CAMADA = 0.37

// ================================================================ vista
export function VistaModelo3D({ ctx }: { ctx: Contexto }) {
  const modelos = useMemo(() => ({ boi: gerarModelo('boi'), vaca: gerarModelo('vaca') }), [])
  const interiores = useMemo(() => ({ boi: gerarInterior('boi', modelos.boi.escala), vaca: gerarInterior('vaca', modelos.vaca.escala) }), [modelos])
  // estado inicial pela URL (?modo=regiao&regiao=barrigas&sexo=vaca&camada=raspa&lente=dependencia): serve às capturas no servidor local
  const ini = useMemo(() => {
    const q = new URLSearchParams(window.location.search)
    const modos: Modo[] = ['animal', 'interior', 'regiao', 'pele']
    const modo = (modos.find((m) => m === q.get('modo')) ?? 'animal') as Modo
    return {
      modo,
      sexo: (q.get('sexo') === 'vaca' ? 'vaca' : 'boi') as Sexo,
      regiao: REGIOES.find((x) => x.id === q.get('regiao'))?.id ?? (modo === 'regiao' ? 'grupao' : null),
      camada: CAMADAS.find((c) => c.id === q.get('camada'))?.id ?? null,
      orgao: ORGAOS.find((o) => o.id === q.get('orgao'))?.id ?? null,
      lente: (q.get('lente') === 'dependencia' ? 'dependencia' : 'insumos') as Lente,
      hover: REGIOES.find((x) => x.id === q.get('hover'))?.id ?? null,
      pele: q.get('hover') === 'pele',
      cam: (q.get('cam') ?? '').split(',').map(Number).filter((n) => !Number.isNaN(n)),
    }
  }, [])
  const [modo, setModo] = useState<Modo>(ini.modo)
  const [sexo, setSexo] = useState<Sexo>(ini.sexo)
  const [regiao, setRegiao] = useState<RegiaoId | null>(ini.regiao)
  const [camada, setCamada] = useState<string | null>(ini.camada)
  const [orgao, setOrgao] = useState<string | null>(ini.orgao)
  const [focoAnimal, setFocoAnimal] = useState(false) // na visão geral, Boi ou Vaca no quadro aproxima a câmera
  const [lente, setLente] = useState<Lente>(ini.lente)
  const [hover, setHoverBruto] = useState<Hover>(ini.hover ? { tipo: 'regiao', regiao: ini.hover, sexo: null } : ini.pele ? { tipo: 'pele', sexo: ini.sexo } : null)
  const setHover = (h: Hover) => setHoverBruto((v) => (mesmoHover(v, h) ? v : h))
  const anim = useRef<Anim>(novaAnim())
  const alvos = useRef<Alvo[]>([])
  const elementos = useRef(new Map<string, HTMLElement>())
  const caminhos = useRef(new Map<string, SVGPathElement>())
  const pontoPele = useRef(new THREE.Vector3())
  const pecaGrupo = useRef<THREE.Group | null>(null)
  const pilhaGrupos = useRef<(THREE.Group | null)[]>([])

  // fêmeas no abate de 2025 (IBGE, tabela 1092)
  const femeas = useMemo(() => {
    const parte = (uf: string) => {
      const s = ctx.abate.series[uf]
      if (!s) return null
      let f = 0
      let t = 0
      for (const q of ['202501', '202502', '202503', '202504']) {
        const r = s[q]
        if (!r) return null
        f += (r['Vacas'] ?? 0) + (r['Novilhas'] ?? 0)
        t += r['Total'] ?? 0
      }
      return t ? f / t : null
    }
    return { mt: parte('Mato Grosso'), ms: parte('Mato Grosso do Sul') }
  }, [ctx])

  const corDe = (cor: string, dep: Dep) => (lente === 'dependencia' ? COR_DEP[dep] : cor)

  // química da peça escolhida (ribeira e curtimento) e das camadas (recurtimento)
  const itensPeca: Item[] = useMemo(() => {
    const r = regiaoPorId(regiao ?? 'grupao')
    return QUIMICOS_MT.filter((q) => r.quimicos.includes(q.id)).map((q) => ({ id: q.id, nome: q.nome, cor: lente === 'dependencia' ? COR_DEP[q.dep] : q.cor, valor: q.valor, dep: q.dep, detalhe: q.detalhe, faixa: q.faixa, depNota: q.depNota }))
  }, [regiao, lente])
  const itensCamadas: Item[] = useMemo(() => {
    const c = CAMADAS.find((x) => x.id === camada)
    const lista = c && c.id === 'sobras' ? [CROMO_SOBRAS] : QUIMICOS_MS
    return lista.map((q) => ({ id: q.id, nome: q.nome, cor: lente === 'dependencia' ? COR_DEP[q.dep] : q.cor, valor: q.valor, dep: q.dep, detalhe: q.detalhe, faixa: q.faixa, depNota: q.depNota }))
  }, [camada, lente])

  const orgaoCentro = useMemo(() => {
    if (!orgao) return null
    const o = interiores[sexo].orgaos.find((x) => x.id === orgao)
    return o ? o.centro.clone().add(CASA[sexo]) : null
  }, [orgao, sexo, interiores])
  const quadro = useMemo(() => (regiao ? quadroPeca(modelos[sexo], sexo, regiao) : null), [modelos, sexo, regiao])

  // alvos da animação a cada mudança de estado
  useEffect(() => {
    const a = anim.current
    for (const s of SEXOS) {
      const sel = s === sexo
      a.visA[s] = modo === 'animal' || sel ? 1 : 0.22
      a.corpoA[s] = modo === 'regiao' || modo === 'pele' ? (sel ? 0.5 : 0.3) : 1
      a.intA[s] = modo === 'interior' ? (sel ? 1 : 0.12) : modo === 'animal' ? 0.28 : 0.1
    }
    a.pecaA = modo === 'regiao' ? 1 : 0
    a.peleA = modo === 'pele' ? 1 : 0
    a.grafA = modo === 'regiao' || (modo === 'pele' && !camada) ? 1 : 0
    let c = cameraDe(modo, sexo, quadro, orgaoCentro)
    if (modo === 'animal' && focoAnimal) {
      const alvo = CASA[sexo].clone().add(v3(0.05, 0.95, 0))
      c = { pos: alvo.clone().add(v3(0.7, 0.55, 3.2)), alvo }
    }
    const dep = ini.cam.length === 6 && modo === ini.modo ? ini.cam : null
    a.voo = dep ? { pos: v3(dep[0], dep[1], dep[2]), alvo: v3(dep[3], dep[4], dep[5]) } : c
  }, [modo, sexo, quadro, camada, orgaoCentro, ini, focoAnimal])

  // ---------------------------------------------------------------- navegação
  function irRaiz() {
    setFocoAnimal(false)
    setModo('animal')
    setCamada(null)
    setOrgao(null)
    setHover(null)
  }
  function voltar() {
    if (modo === 'pele' && camada) setCamada(null)
    else if (modo === 'interior' && orgao) setOrgao(null)
    else irRaiz()
  }
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') voltar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })
  function irEtapa(m: Modo) {
    setModo(m)
    setHover(null)
    if (m === 'regiao' && !regiao) setRegiao('grupao')
    if (m !== 'pele') setCamada(null)
    if (m !== 'interior') setOrgao(null)
  }
  function irRegiao(s: Sexo, r: RegiaoId) {
    setSexo(s)
    setRegiao(r)
    setModo('regiao')
    setCamada(null)
    setHover(null)
  }
  function irPele(s: Sexo) {
    setSexo(s)
    setModo('pele')
    setCamada(null)
    setHover(null)
  }
  function irCamada(id: string) {
    if (modo !== 'pele') setModo('pele')
    setCamada((c) => (c === id ? null : id))
  }
  function irOrgao(id: string) {
    setModo('interior')
    setOrgao((o) => (o === id ? null : id))
  }

  // ---------------------------------------------------------------- rótulos
  const ancoraRegiao = (s: Sexo, r: RegiaoId, cam: THREE.Camera): THREE.Vector3[] => {
    const a = anim.current
    if (a.vis[s] < 0.5) return []
    const an = modelos[s].ancoras[r]
    let melhor = an.c3[0]
    let dist = Infinity
    for (const c of an.c3) {
      const d = c.clone().add(CASA[s]).distanceToSquared(cam.position)
      if (d < dist) {
        dist = d
        melhor = c
      }
    }
    return [melhor.clone().add(CASA[s])]
  }
  const pct = (x: number | null) => (x == null ? '–' : `${Math.round(x * 100)}%`)
  const pctItem = (lista: Item[], i: number) => {
    const t = lista.reduce((s, q) => s + q.valor, 0)
    return Math.round((lista[i].valor / t) * 100)
  }
  const depTag = (dep: Dep) => (
    <span className="dep">
      <i style={{ background: COR_DEP[dep] }} />
      {NOME_DEP[dep]}
    </span>
  )

  const rotulos: Rotulo[] = []
  // --- visão geral
  if ((modo === 'animal' || modo === 'regiao') && hover?.tipo === 'regiao') {
    const r = regiaoPorId(hover.regiao)
    const s = hover.sexo
    rotulos.push({
      id: `reg-${r.id}`,
      modo: 'perto',
      dx: 70,
      dy: -70,
      pontos: (cam) => (s ? [s] : SEXOS).flatMap((x) => ancoraRegiao(x, r.id, cam)),
      classe: 'pilula',
      conteudo: (
        <>
          <span className="n">{r.n}</span>
          <b>{r.nome}</b>
          <small>
            {r.nota}
            {s === 'vaca' && r.notaVaca ? `; ${r.notaVaca}` : ''}
          </small>
        </>
      ),
    })
  }
  if (hover?.tipo === 'pele' && modo !== 'pele') {
    rotulos.push({
      id: 'pele',
      modo: 'perto',
      dx: 50,
      dy: -60,
      pontos: () => [pontoPele.current.clone()],
      classe: 'pilula',
      conteudo: (
        <>
          <b>Pele</b>
          <small>o vão entre o corpo e a linha de fora: clique para ver as camadas</small>
        </>
      ),
    })
  }
  if (modo === 'animal' && hover?.tipo === 'animal') {
    const s = hover.sexo
    rotulos.push({
      id: `animal-${s}`,
      modo: 'perto',
      dx: 40,
      dy: -60,
      pontos: () => [modelos[s].cabeca.clone().add(CASA[s])],
      classe: 'pilula',
      conteudo:
        s === 'boi' ? (
          <>
            <b>Boi</b>
            <small>pele mais pesada que a das fêmeas da mesma idade</small>
          </>
        ) : (
          <>
            <b>Vaca</b>
            <small>
              pele mais leve, com mais gordura a tirar no descarne · fêmeas: {pct(femeas.mt)} do abate em MT e {pct(femeas.ms)} em MS em 2025 (IBGE)
            </small>
          </>
        ),
    })
  }
  // --- interior
  if (modo === 'interior') {
    const it = interiores[sexo]
    ORGAOS.forEach((o) => {
      const g = it.orgaos.find((x) => x.id === o.id)!
      const ativo = orgao === o.id || (hover?.tipo === 'orgao' && hover.id === o.id)
      rotulos.push({
        id: `org-${o.id}`,
        modo: 'dir',
        pontos: () => (anim.current.int[sexo] > 0.6 ? [g.centro.clone().add(CASA[sexo])] : []),
        classe: `pilula orgao${ativo ? ' selecionada' : ''}`,
        conteudo: (
          <span onMouseEnter={() => setHover({ tipo: 'orgao', id: o.id })} onMouseLeave={() => setHover(null)} onClick={() => irOrgao(o.id)}>
            <span className="n">{o.n}</span>
            <b>{o.nome}</b>
            {ativo && <small>{o.nota}</small>}
          </span>
        ),
      })
    })
    // o que entra: alimento dentro do rúmen, adubos por trás
    const centroDe = (id: string) => {
      if (id === 'pasto') return it.rumen.c.clone().add(v3(-0.12, 0.08, 0.08))
      const g = [...it.graos, ...it.adubos].find((x) => x.id === id)
      if (!g) return it.rumen.c.clone()
      const c = v3()
      for (let i = 0; i < g.pos.length; i += 3) c.add(v3(g.pos[i], g.pos[i + 1], g.pos[i + 2]))
      return c.multiplyScalar(3 / g.pos.length)
    }
    INSUMOS_ANIMAL.forEach((ins) => {
      const c = centroDe(ins.id)
      const ativo = hover?.tipo === 'insumo' && hover.id === ins.id
      rotulos.push({
        id: `ins-${ins.id}`,
        modo: 'esq',
        pontos: () => (anim.current.int[sexo] > 0.6 ? [c.clone().add(CASA[sexo])] : []),
        classe: `insumo${ativo ? ' hover' : ''}${ins.grupo === 'adubo' ? ' adubo' : ''}`,
        conteudo: (
          <span onMouseEnter={() => setHover({ tipo: 'insumo', id: ins.id })} onMouseLeave={() => setHover(null)}>
            <i style={ins.grupo === 'adubo' ? { borderColor: lente === 'dependencia' ? COR_DEP[ins.dep] : PALETA.tinta2 } : { background: corDe(ins.cor, ins.dep) }} />
            <b>{ins.nome}</b>
            {lente === 'dependencia' && !ativo && <small>{NOME_DEP[ins.dep]}</small>}
            {ativo && <small>{lente === 'dependencia' ? ins.depNota : ins.nota}</small>}
          </span>
        ),
      })
    })
  }
  // --- peça da região
  if (modo === 'regiao' && regiao) {
    const r = regiaoPorId(regiao)
    rotulos.push({
      id: `peca-${r.id}`,
      modo: 'perto',
      dx: -80,
      dy: -70,
      pontos: () => {
        const g = pecaGrupo.current
        if (!g || anim.current.peca < 0.85) return []
        return [g.localToWorld(v3(0, 0.08, 0))]
      },
      classe: 'pilula selecionada',
      conteudo: (
        <>
          <span className="n">{r.n}</span>
          <b>{r.nome}</b>
          <small>
            {r.nota}
            {sexo === 'vaca' && r.notaVaca ? `; ${r.notaVaca}` : ''}
          </small>
        </>
      ),
    })
  }
  // --- gráfico ao lado (porcentagem de cada cor)
  const itensGraf = modo === 'regiao' ? itensPeca : itensCamadas
  const baseGraf = modo === 'regiao' && quadro ? quadro.centro.clone().add(v3(quadro.direita + 0.45, 0, 0)) : lugarPilha(sexo).add(v3(MEIO_PILHA + 0.42, 0, 0))
  const ladrilhos = useMemo(() => montarLadrilhos(itensGraf), [itensGraf])
  if (modo === 'regiao' || (modo === 'pele' && !camada)) {
    itensGraf.forEach((q, i) => {
      const l = ladrilhos[i]
      const ativo = hover?.tipo === 'quimico' && hover.id === q.id
      const apagado = hover?.tipo === 'quimico' && !ativo
      rotulos.push({
        id: `leg-${q.id}`,
        modo: 'legenda',
        dx: 24,
        pontos: () => (anim.current.graf > 0.6 ? [baseGraf.clone().add(v3(0.09, l.y, 0))] : []),
        classe: `legenda-q${apagado ? ' apagado' : ''}${ativo ? ' hover' : ''}`,
        conteudo: (
          <span onMouseEnter={() => setHover({ tipo: 'quimico', id: q.id })} onMouseLeave={() => setHover(null)}>
            <i style={{ background: q.cor }} />
            <b>{q.nome}</b>
            <em>{pctItem(itensGraf, i)}%</em>
            {lente === 'dependencia' && !ativo && <small>{depTag(q.dep)}</small>}
            {ativo && <small>{lente === 'dependencia' ? <>{depTag(q.dep)} {q.depNota}</> : `${q.detalhe} · ${q.faixa}`}</small>}
          </span>
        ),
      })
    })
    if (modo === 'regiao' && regiaoPorId(regiao ?? 'grupao').bolinhas > 0) {
      rotulos.push({
        id: 'leg-enchimento',
        modo: 'legenda',
        dx: 24,
        pontos: () => (anim.current.graf > 0.6 ? [baseGraf.clone().add(v3(0.09, -GRAF_ALTURA / 2 - 0.12, 0))] : []),
        classe: 'nota-enchimento',
        conteudo: (
          <p>
            <b>○ Enchimento</b> no recurtimento (MS): as partes frouxas recebem mais recurtente
          </p>
        ),
      })
    }
  }
  // --- camadas
  if (modo === 'pele') {
    CAMADAS.forEach((c, i) => {
      const sel = camada === c.id
      const apagada = camada && !sel
      rotulos.push({
        id: `cam-${c.id}`,
        modo: 'esq',
        pontos: () => {
          const g = pilhaGrupos.current[i]
          if (!g || anim.current.pele < 0.8) return []
          const ps: THREE.Vector3[] = []
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2
            ps.push(g.localToWorld(v3(Math.cos(a) * MEIO_CAMADA, 0, Math.sin(a) * MEIO_CAMADA)))
          }
          return ps
        },
        classe: `camada-nome${apagada ? ' apagado' : ''}${sel ? ' sel' : ''}`,
        conteudo: (
          <span onMouseEnter={() => setHover({ tipo: 'camada', id: c.id })} onMouseLeave={() => setHover(null)} onClick={() => irCamada(c.id)}>
            <i className="ponto" />
            <b>{c.nome}</b>
          </span>
        ),
      })
    })
    if (camada) {
      const i = CAMADAS.findIndex((c) => c.id === camada)
      const c = CAMADAS[i]
      rotulos.push({
        id: `transf-${c.id}`,
        modo: 'painel',
        pontos: () => {
          const g = pilhaGrupos.current[i]
          if (!g || anim.current.pele < 0.8) return []
          const ps: THREE.Vector3[] = []
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2
            ps.push(g.localToWorld(v3(Math.cos(a) * MEIO_CAMADA, 0, Math.sin(a) * MEIO_CAMADA)))
          }
          return ps
        },
        classe: 'transforma',
        conteudo: (
          <div>
            <p className="transf-tit">Com diferentes tratamentos, esta camada pode se transformar em:</p>
            <div className="transf-lista">
              {c.transforma.map((t) => (
                <figure key={t.id}>
                  <img src={amostra(t)} alt="" width={150} height={104} />
                  <figcaption>
                    <b>{t.nome}</b>
                    <small>{t.nota}</small>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ),
      })
    }
  }
  alvos.current = rotulos

  const cursorMao = (sim: boolean) => {
    document.body.style.cursor = sim ? 'pointer' : ''
  }
  useEffect(() => () => cursorMao(false), [])

  const realceDe = (s: Sexo): { reg: RegiaoId | null; forte: boolean } => {
    if (hover?.tipo === 'regiao' && (hover.sexo === null || hover.sexo === s) && (modo === 'animal' || modo === 'regiao')) return { reg: hover.regiao, forte: true }
    if (modo === 'regiao' && s === sexo && regiao) return { reg: regiao, forte: false }
    return { reg: null, forte: false }
  }

  return (
    <div className="bois">
      <Canvas
        className="cena"
        camera={{ position: [1.15, 2.75, 6.6], fov: 36, near: 0.05, far: 120 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, stencil: true }}
        resize={{ scroll: false, debounce: 0 }}
      >
        <Animador anim={anim} />
        <Chao anim={anim} />
        {SEXOS.map((s) => (
          <group key={s} position={CASA[s]}>
            <InteriorCena it={interiores[s]} sexo={s} anim={anim} lente={lente} ativo={modo === 'interior' && s === sexo} orgao={s === sexo ? orgao : null} hover={hover} onHover={setHover} onOrgao={irOrgao} />
            <AnimalCena
              m={modelos[s]}
              sexo={s}
              anim={anim}
              modo={modo}
              realce={realceDe(s)}
              peleHover={hover?.tipo === 'pele' && hover.sexo === s}
              onRegiao={(r) => {
                setHover({ tipo: 'regiao', regiao: r, sexo: s })
                cursorMao(true)
              }}
              onPele={(p) => {
                pontoPele.current.copy(p)
                setHover({ tipo: 'pele', sexo: s })
                cursorMao(true)
              }}
              onParte={() => {
                if (modo === 'animal') setHover({ tipo: 'animal', sexo: s })
              }}
              onSai={() => {
                setHover(null)
                cursorMao(false)
              }}
              onCliqueRegiao={(r) => irRegiao(s, r)}
              onCliquePele={() => irPele(s)}
            />
          </group>
        ))}
        {regiao && quadro && <PecaCena key={`${sexo}-${regiao}`} m={modelos[sexo]} sexo={sexo} regiao={regiao} anim={anim} itens={itensPeca} foco={hover?.tipo === 'quimico' ? hover.id : null} grupo={pecaGrupo} fim={quadro.centro} />}
        <Grafico3D key={`g-${modo}-${itensGraf.map((q) => q.id + q.cor).join('')}`} itens={itensGraf} ladrilhos={ladrilhos} base={baseGraf} anim={anim} foco={hover?.tipo === 'quimico' ? hover.id : null} onHover={(id) => setHover(id ? { tipo: 'quimico', id } : null)} />
        <CamadasCena sexo={sexo} anim={anim} grupos={pilhaGrupos} sel={camada} hover={hover?.tipo === 'camada' ? hover.id : null} onHover={(id) => setHover(id ? { tipo: 'camada', id } : null)} onClique={irCamada} />
        <Deslocamento />
        <Projetor alvos={alvos} elementos={elementos} caminhos={caminhos} />
        <Controles anim={anim} girar={modo === 'animal' && !hover && !MENOS_MOVIMENTO} />
      </Canvas>
      <div className="bois-rotulos" aria-hidden={rotulos.length === 0}>
        <svg className="bois-ligacoes">
          {rotulos.map((r) => (
            <path
              key={r.id}
              className={`lig lig-${r.modo}`}
              ref={(el) => {
                if (el) caminhos.current.set(r.id, el)
                else caminhos.current.delete(r.id)
              }}
            />
          ))}
        </svg>
        {rotulos.map((r) => (
          <div
            key={r.id}
            className={`rot rot-${r.modo} ${r.classe ?? ''}`}
            ref={(el) => {
              if (el) elementos.current.set(r.id, el)
              else elementos.current.delete(r.id)
            }}
          >
            {r.conteudo}
          </div>
        ))}
      </div>
      <Decomposicao
        modo={modo}
        sexo={sexo}
        regiao={regiao}
        camada={camada}
        orgao={orgao}
        hover={hover as { tipo: string; id?: string; regiao?: RegiaoId } | null}
        onRaiz={irRaiz}
        onSexo={(s) => {
          setSexo(s)
          if (modo === 'animal') setFocoAnimal(true)
        }}
        onEtapa={irEtapa}
        onRegiao={(r) => irRegiao(sexo, r)}
        onCamada={irCamada}
        onOrgao={irOrgao}
        onHover={(tipo, id) => {
          if (!tipo || !id) setHover(null)
          else if (tipo === 'regiao') setHover({ tipo: 'regiao', regiao: id as RegiaoId, sexo: modo === 'animal' ? null : sexo })
          else if (tipo === 'camada') setHover({ tipo: 'camada', id })
          else setHover({ tipo: 'orgao', id })
        }}
      />
      <div className="lente-modelo">
        <div className="botoes">
          <button className={lente === 'insumos' ? 'ativo' : ''} onClick={() => setLente('insumos')}>
            Insumos
          </button>
          <button className={lente === 'dependencia' ? 'ativo' : ''} onClick={() => setLente('dependencia')}>
            Dependência externa
          </button>
        </div>
        {lente === 'dependencia' && (
          <div className="chave">
            {(['sim', 'nao', 'sd'] as Dep[]).map((d) => (
              <span key={d}>
                <i style={{ background: COR_DEP[d] }} />
                {NOME_DEP[d]}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ================================================================ componentes da cena
function Animador({ anim }: { anim: MutableRefObject<Anim> }) {
  const controles = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null
  useFrame((st, dt) => {
    const a = anim.current
    const d = Math.min(dt, 0.12)
    a.t += d
    for (const s of SEXOS) {
      a.vis[s] = expo(a.vis[s], a.visA[s], d, 3.2)
      a.corpo[s] = expo(a.corpo[s], a.corpoA[s], d, 3.2)
      a.int[s] = expo(a.int[s], a.intA[s], d, 3.2)
    }
    a.peca = linear(a.peca, a.pecaA, d * 0.85)
    a.pele = linear(a.pele, a.peleA, d * 0.8)
    a.graf = expo(a.graf, a.grafA, d, a.grafA > a.graf ? 1.6 : 4)
    if (a.voo && controles) {
      const f = 1 - Math.exp(-d * 2.0)
      st.camera.position.lerp(a.voo.pos, f)
      controles.target.lerp(a.voo.alvo, f)
      if (st.camera.position.distanceTo(a.voo.pos) < 0.01 && controles.target.distanceTo(a.voo.alvo) < 0.01) a.voo = null
    }
  })
  return null
}

function Controles({ anim, girar }: { anim: MutableRefObject<Anim>; girar: boolean }) {
  const ref = useRef<unknown>(null)
  useEffect(() => {
    const c = ref.current as THREE.EventDispatcher<{ start: object }> | null
    if (!c) return
    const parar = () => {
      anim.current.voo = null
    }
    c.addEventListener('start', parar)
    return () => c.removeEventListener('start', parar)
  }, [anim])
  return (
    <OrbitControls
      ref={ref as never}
      makeDefault
      target={[0, 1.1, 0]}
      enableDamping
      dampingFactor={0.08}
      enablePan
      screenSpacePanning
      minDistance={0.9}
      maxDistance={24}
      autoRotate={girar}
      autoRotateSpeed={0.45}
    />
  )
}

// grade em toda a tela e, sob cada animal, uma sombra quadriculada menor que ele
function Chao({ anim }: { anim: MutableRefObject<Anim> }) {
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
    for (const s of obj.sombras) s.m.uniforms.opac.value = 0.6 + 0.4 * Math.min(anim.current.vis.boi, anim.current.vis.vaca)
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
function AnimalCena(p: PropsAnimal) {
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
    const matCorpo = matContorno({ largura: 1.8, preench: 0.03, corPreench: BRANCO })
    const corpo = new THREE.Mesh(geo, matCorpo)
    corpo.renderOrder = 5
    const matPartes = matContorno({ largura: 1.8, preench: 0.03, corPreench: BRANCO })
    const partes = new THREE.Mesh(pg, matPartes)
    partes.renderOrder = 5
    // linhas das regiões da carne: na frente, cheias; atrás, tracejadas
    const bordaV = traco(m.borda.p3, 1.25, BRANCO, 0.6, 6)
    const bordaE = traco(m.borda.p3, 1, BRANCO, 0.2, 6, { escondido: true })
    const lombo = traco(m.media.p3, 1, BRANCO, 0.3, 6)
    const pm = traco(m.partes.media, 1.2, BRANCO, 0.55, 6)
    const pF = traco(m.partes.forte, 2.2, BRANCO, 0.9, 6)
    // casca: a linha de fora, que é a pele
    const prepCasca = new THREE.Mesh(cg, matPreparo(false))
    prepCasca.renderOrder = 8
    const matCasca = matContorno({ largura: 1.3, opac: 0.85, corPreench: PALETA.couro, foraDoCorpo: true })
    const casca = new THREE.Mesh(cg, matCasca)
    casca.renderOrder = 9
    return { geo, pg, cg, prepCorpo, prepPartes, corpo, matCorpo, partes, matPartes, bordaV, bordaE, lombo, pm, pF, prepCasca, casca, matCasca }
  }, [m])
  const realce = useMemo(() => (p.realce.reg ? traco(m.contorno[p.realce.reg].p3, 2.4, PALETA.couro, 0.95, 7, { semProfundidade: true }) : null), [m, p.realce.reg])
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
function InteriorCena(p: { it: Interior; sexo: Sexo; anim: MutableRefObject<Anim>; lente: Lente; ativo: boolean; orgao: string | null; hover: Hover; onHover: (h: Hover) => void; onOrgao: (id: string) => void }) {
  const { it, sexo, anim } = p
  const obj = useMemo(() => {
    const orgaos = it.orgaos.map((o) => {
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
  useFrame(() => {
    const a = anim.current
    const f = a.int[sexo] * a.vis[sexo]
    const hv = p.hover
    for (const o of obj.orgaos) {
      const sel = p.orgao === o.id || (hv?.tipo === 'orgao' && hv.id === o.id)
      const outro = (p.orgao || hv?.tipo === 'orgao') && !sel
      o.mat.uniforms.opac.value = f * (sel ? 1 : outro ? 0.35 : 0.75)
      o.mat.uniforms.preench.value = sel ? 0.1 : 0.025
      o.mat.uniforms.largura.value = sel ? 3 : 2.3
      o.mesh.visible = o.prep.visible = f > 0.01
    }
    const insHover = hv?.tipo === 'insumo' ? hv.id : null
    for (const n of obj.nuvens) {
      const ins = INSUMOS_ANIMAL.find((x) => x.id === n.id)!
      const base = ins.grupo === 'adubo' ? (p.lente === 'dependencia' ? 0.9 : 0.45) : 0.85
      n.mat.opacity = f * (insHover ? (insHover === n.id ? 1 : 0.2) : base)
      n.inst.visible = f > 0.01
    }
    obj.capim.mat.opacity = f * (insHover ? (insHover === 'pasto' ? 1 : 0.2) : 0.8)
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

// a peça de pele escolhida sai um pouco do corpo e mostra a mistura da química
function PecaCena(p: { m: Modelo; sexo: Sexo; regiao: RegiaoId; anim: MutableRefObject<Anim>; itens: Item[]; foco: string | null; grupo: MutableRefObject<THREE.Group | null>; fim: THREE.Vector3 }) {
  const { m, sexo, regiao, anim } = p
  const pc = m.pecas[regiao]
  const r = regiaoPorId(regiao)
  const obj = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pc.pos, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(pc.nrm, 3))
    g.setAttribute('uvm', new THREE.BufferAttribute(pc.uvm, 2))
    g.setAttribute('lado', new THREE.BufferAttribute(pc.lado, 1))
    g.translate(-pc.centro.x, -pc.centro.y, -pc.centro.z)
    g.computeBoundingSphere()
    const mat = matMistura()
    mat.uniforms.celula.value = r.celula
    mat.uniforms.rugas.value = r.rugas
    mat.uniforms.bolinhas.value = r.bolinhas
    mat.uniforms.semente.value = REGIAO_IDX[regiao] * 13.7 + (sexo === 'vaca' ? 5.3 : 0)
    const mesh = new THREE.Mesh(g, mat)
    mesh.renderOrder = 10
    const b = new Float32Array(pc.borda)
    for (let i = 0; i < b.length; i += 3) {
      b[i] -= pc.centro.x
      b[i + 1] -= pc.centro.y
      b[i + 2] -= pc.centro.z
    }
    const borda = traco(b, 2, BRANCO, 0.95, 11)
    return { g, mat, mesh, borda, escala: escalaPeca(regiao) }
  }, [pc, r, regiao, sexo])
  useResolucao(useMemo(() => [obj.borda.mat], [obj]))
  useEffect(() => () => {
    obj.g.dispose()
    obj.mat.dispose()
    obj.borda.obj.geometry.dispose()
  }, [obj])
  useEffect(() => {
    definirMistura(
      obj.mat,
      p.itens.map((q) => q.cor),
      p.itens.map((q) => q.valor),
    )
  }, [obj, p.itens])
  useEffect(() => {
    const i = p.foco ? p.itens.findIndex((q) => q.id === p.foco) : -1
    obj.mat.uniforms.foco.value = i
  }, [obj, p.foco, p.itens])
  const ini = useMemo(() => pc.centro.clone().add(CASA[sexo]), [pc, sexo])
  const fim = p.fim
  useFrame(() => {
    const g = p.grupo.current
    if (!g) return
    const k = suave(anim.current.peca)
    g.visible = anim.current.peca > 0.001
    g.position.lerpVectors(ini, fim, k)
    g.scale.setScalar(1 + (obj.escala - 1) * k)
    obj.mat.uniforms.opac.value = clamp01(anim.current.peca * 3)
    obj.borda.mat.opacity = obj.borda.base * clamp01(anim.current.peca * 3)
  })
  return (
    <group
      ref={(el) => {
        p.grupo.current = el
      }}
      visible={false}
    >
      <primitive object={obj.mesh} />
      <primitive object={obj.borda.obj} />
    </group>
  )
}

// gráfico ao lado: um ladrilho por químico, na proporção da dose
type Ladrilho = { y: number; h: number }
function montarLadrilhos(itens: { valor: number }[]): Ladrilho[] {
  const total = itens.reduce((t, q) => t + q.valor, 0) || 1
  const gap = 0.02
  const util = GRAF_ALTURA - gap * (itens.length - 1)
  let y = GRAF_ALTURA / 2
  return itens.map((q) => {
    const h = (q.valor / total) * util
    const c = y - h / 2
    y -= h + gap
    return { y: c, h }
  })
}
function Grafico3D(p: { itens: Item[]; ladrilhos: Ladrilho[]; base: THREE.Vector3; anim: MutableRefObject<Anim>; foco: string | null; onHover: (id: string | null) => void }) {
  const grupo = useRef<THREE.Group>(null)
  const lado = 0.13
  const ladr = useMemo(
    () =>
      p.itens.map((q, i) => {
        const l = p.ladrilhos[i]
        const geo = new THREE.BoxGeometry(lado, l.h, lado)
        const mat = new THREE.MeshBasicMaterial({ color: q.cor, transparent: true, opacity: 0.95 })
        const malha = new THREE.Mesh(geo, mat)
        malha.position.set(0, l.y, 0)
        malha.renderOrder = 10
        const arestas = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: BRANCO, transparent: true, opacity: 0.5 }))
        arestas.position.copy(malha.position)
        arestas.renderOrder = 11
        return { id: q.id, malha, mat, arestas, geo }
      }),
    [p.itens, p.ladrilhos],
  )
  useEffect(() => () => ladr.forEach((l) => l.geo.dispose()), [ladr])
  useFrame(() => {
    const g = grupo.current
    if (!g) return
    const v = p.anim.current.graf
    g.visible = v > 0.01
    g.position.copy(p.base)
    ladr.forEach((l) => {
      const apagado = p.foco && p.foco !== l.id
      l.mat.opacity = v * (apagado ? 0.18 : 0.95)
      ;(l.arestas.material as THREE.LineBasicMaterial).opacity = v * (p.foco === l.id ? 1 : 0.45)
    })
  })
  return (
    <group ref={grupo} visible={false}>
      {ladr.map((l) => (
        <group key={l.id}>
          <primitive
            object={l.malha}
            onPointerMove={(e: ThreeEvent<PointerEvent>) => {
              if (p.anim.current.graf < 0.5) return
              e.stopPropagation()
              p.onHover(l.id)
            }}
            onPointerOut={() => p.onHover(null)}
          />
          <primitive object={l.arestas} />
        </group>
      ))}
    </group>
  )
}

// camadas da pele, como na pilha da Maya Craft
function CamadasCena(p: { sexo: Sexo; anim: MutableRefObject<Anim>; grupos: MutableRefObject<(THREE.Group | null)[]>; sel: string | null; hover: string | null; onHover: (id: string | null) => void; onClique: (id: string) => void }) {
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
        const mat = matCamada(c.textura, c.cor, c.corLado)
        mat.uniforms.onda.value = c.forma === 'folha' ? 1 : 0
        const mesh = new THREE.Mesh(g, mat)
        mesh.renderOrder = 10
        const linhas = traco(geo.linhas, 1.6, BRANCO, 0.85, 11)
        const finas = traco(geo.finas, 1, BRANCO, 0.4, 11)
        return { c, g, mat, mesh, linhas, finas }
      }),
    [],
  )
  useResolucao(useMemo(() => obj.flatMap((o) => [o.linhas.mat, o.finas.mat]), [obj]))
  const fim = useMemo(() => lugarPilha(p.sexo), [p.sexo])
  const ini = useMemo(() => CASA[p.sexo].clone().add(v3(0.05, 1.0, 0.1)), [p.sexo])
  const giro = useMemo(() => new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), Math.PI / 4), [])
  useFrame(() => {
    const a = p.anim.current
    obj.forEach((o, i) => {
      const g = p.grupos.current[i]
      if (!g) return
      const k = suave(clamp01((a.pele - i * 0.08) / 0.7))
      g.visible = a.pele > 0.001
      g.position.lerpVectors(ini, fim, k)
      g.position.y += Y_CAMADA[i] * k
      g.quaternion.copy(giro)
      g.scale.setScalar(0.15 + 0.85 * k)
      const sel = p.sel === o.c.id
      const hov = p.hover === o.c.id
      const recua = p.sel && !sel
      const op = clamp01(a.pele * 2.5) * (recua ? 0.35 : 1)
      o.mat.uniforms.opac.value = op
      o.mat.uniforms.realce.value = sel || hov ? 1 : 0
      o.mat.uniforms.tempo.value = a.t
      o.linhas.mat.opacity = o.linhas.base * op * (sel || hov ? 1.15 : 1)
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
              if (p.anim.current.pele < 0.8) return
              e.stopPropagation()
              p.onHover(o.c.id)
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              p.onHover(null)
              document.body.style.cursor = ''
            }}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              if (p.anim.current.pele < 0.8 || e.delta > 6) return
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

// o quadro de decomposição ocupa a esquerda: o centro da cena anda para a direita
function Deslocamento() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  useEffect(() => {
    const px = size.width >= 900 ? 175 : 0
    if (px) camera.setViewOffset(size.width, size.height, -px, 0, size.width, size.height)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

// rótulos em HTML presos a pontos da cena, com linha de ligação
function Projetor({ alvos, elementos, caminhos }: { alvos: MutableRefObject<Alvo[]>; elementos: MutableRefObject<Map<string, HTMLElement>>; caminhos: MutableRefObject<Map<string, SVGPathElement>> }) {
  const v = useMemo(() => new THREE.Vector3(), [])
  const alturas = useMemo(() => new WeakMap<HTMLElement, number>(), [])
  useFrame(({ camera, size }) => {
    type R = { al: Alvo; el: HTMLElement; ax: number; ay: number; lx: number; ly: number; pts: { x: number; y: number }[]; h: number }
    const rs: R[] = []
    for (const al of alvos.current) {
      const el = elementos.current.get(al.id)
      const pth = caminhos.current.get(al.id)
      if (!el) continue
      const pts: { x: number; y: number }[] = []
      for (const pt of al.pontos(camera)) {
        v.copy(pt).project(camera)
        if (v.z > 1 || v.z < -1) continue
        pts.push({ x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height })
      }
      if (!pts.length) {
        el.style.opacity = '0'
        el.style.pointerEvents = 'none'
        pth?.setAttribute('d', '')
        continue
      }
      // a altura muda quando o rótulo ganha uma linha (passar o mouse, lente): mede sempre
      const h = el.offsetHeight || alturas.get(el) || 16
      alturas.set(el, h)
      let ax = pts[0].x
      let ay = pts[0].y
      let lx = ax
      let ly = ay
      if (al.modo === 'esq' || al.modo === 'dir' || al.modo === 'painel') {
        let ext = pts[0]
        for (const q of pts) if (al.modo === 'esq' ? q.x < ext.x : q.x > ext.x) ext = q
        ax = ext.x
        ay = ext.y
        lx = ax + (al.modo === 'esq' ? -46 : 46)
        ly = ay
      } else if (al.modo === 'legenda') {
        lx = ax + (al.dx ?? 26)
      } else if (al.modo === 'baixo') {
        lx = ax + (al.dx ?? 0)
        ly = ay + (al.dy ?? 30)
      } else {
        lx = ax + (al.dx ?? 60)
        ly = ay + (al.dy ?? -70)
      }
      rs.push({ al, el, ax, ay, lx, ly, pts, h })
    }
    // colunas: os rótulos da esquerda e da direita se alinham, como as chamadas de um desenho técnico
    for (const modo of ['esq', 'dir'] as const) {
      const g = rs.filter((r) => r.al.modo === modo)
      if (g.length < 2) continue
      const col = modo === 'esq' ? Math.min(...g.map((r) => r.ax)) - 46 : Math.max(...g.map((r) => r.ax)) + 46
      for (const r of g) r.lx = col
    }
    for (const modo of ['esq', 'dir', 'legenda', 'perto'] as const) {
      const g = rs.filter((r) => r.al.modo === modo).sort((a, b) => a.ly - b.ly)
      for (let i = 1; i < g.length; i++) {
        const meio = modo === 'perto' ? g[i - 1].h + 6 : (g[i - 1].h + g[i].h) / 2 + 6
        const min = g[i - 1].ly + meio
        if (modo === 'perto' && Math.abs(g[i].lx - g[i - 1].lx) > 260) continue
        if (g[i].ly < min) g[i].ly = min
      }
    }
    for (const r of rs) {
      const { al, el } = r
      const tx = al.modo === 'esq' ? '-100%' : al.modo === 'baixo' ? '-50%' : '0px'
      const ty = al.modo === 'perto' ? '-100%' : al.modo === 'baixo' ? '0px' : '-50%'
      el.style.opacity = '1'
      el.style.pointerEvents = ''
      el.style.transform = `translate(${r.lx.toFixed(1)}px, ${r.ly.toFixed(1)}px) translate(${tx}, ${ty})`
      const pth = caminhos.current.get(al.id)
      if (!pth) continue
      const f = (n: number) => n.toFixed(1)
      let d = ''
      if (al.modo === 'perto') for (const q of r.pts) d += `M${f(q.x)} ${f(q.y)} L${f(r.lx)} ${f(r.ly)} `
      else if (al.modo === 'esq') d = `M${f(r.ax)} ${f(r.ay)} L${f(r.lx + 14)} ${f(r.ly)} L${f(r.lx + 3)} ${f(r.ly)}`
      else if (al.modo === 'dir' || al.modo === 'legenda' || al.modo === 'painel') d = `M${f(r.ax)} ${f(r.ay)} L${f(r.lx - 14)} ${f(r.ly)} L${f(r.lx - 3)} ${f(r.ly)}`
      else if (al.modo === 'baixo') d = `M${f(r.ax)} ${f(r.ay)} L${f(r.lx)} ${f(r.ly - 2)}`
      pth.setAttribute('d', d)
    }
  })
  return null
}

