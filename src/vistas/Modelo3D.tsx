// Aba Modelo 3D: boi e vaca transparentes, flutuando sobre a grade.
// Por dentro, um mapa leve do que mantém o animal (órgãos, o que ele come e os adubos por trás).
// Por fora, uma linha dupla: o vão entre o corpo e a linha de fora é a pele que vai ao curtume.
// Clicar numa região destaca só aquela peça de pele, com a mistura da química da ribeira (MT).
// Clicar no vão abre as camadas da pele (MS); cada camada abre o que ela pode virar.
import { useEffect, useMemo, useRef, useState, type ComponentRef, type MutableRefObject, type ReactNode } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
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
import { Menu, NaFaixa, NaLegenda } from '../componentes/Faixa'
import '../modelo3d/modelo3d.css'

const BRANCO = '#f6f1e7'
const FLUTUA = 0.42 // os animais flutuam sobre a grade
const SEXOS: Sexo[] = ['boi', 'vaca']
const MENOS_MOVIMENTO = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const CASA: Record<Sexo, THREE.Vector3> = { boi: new THREE.Vector3(-1.08, FLUTUA, -0.62), vaca: new THREE.Vector3(1.02, FLUTUA, 0.6) }
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
// aceleração e frenagem suaves, como as transformações do painel da Marinha
const flui = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

// ritmo das transições, na gramática do visualizador do submarino (painel-comandante)
const DUR_SAIDA = MENOS_MOVIMENTO ? 0.2 : 1.3 // segundos para a peça ou as camadas saírem do corpo
const DUR_VOLTA = MENOS_MOVIMENTO ? 0.2 : 0.9 // e para voltarem
const TAXA_FADE = 5 // o que entra ou sai de foco
const TAXA_TEXTURA = 4 // a textura entra depois que a peça chega
const TAXA_TEXTURA_SAI = 9 // e sai antes de a peça voltar
const SUAVE_CAMERA = MENOS_MOVIMENTO ? 0.1 : 0.6 // smoothTime do camera-controls
// o que não está escolhido recua para perto deste traço (o visualizador usa 0,11 contra 0,95)
const RECUO_ANIMAL = 0.18
const RECUO_CORPO = 0.32
const RECUO_INTERIOR = 0.45
const RECUO_ITEM = 0.25

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
  if (modo === 'regiao' && quadro) return enquadrarPeca(quadro, window.innerWidth, window.innerHeight)
  if (modo === 'pele') {
    const alvo = lugarPilha(s).add(v3(0.45, -0.02, 0))
    return { pos: alvo.clone().add(v3(0.3, 0.95, 3.25)), alvo }
  }
  return { pos: CAM_GERAL.pos.clone(), alvo: CAM_GERAL.alvo.clone() }
}
const CAM_GERAL = { pos: v3(1.15, 2.75, 6.6), alvo: v3(0.0, 1.1, 0) }
const FOV = 36
// o quadro de decomposição ocupa a esquerda (Deslocamento leva o centro da cena para a direita)
const DESLOC_PX = 175
const largo = (w: number) => w >= 900

/**
 * A peça e o gráfico ao lado cabem na área livre da tela, como o enquadramento do visualizador do
 * submarino: à esquerda fica o quadro de decomposição, à direita os nomes do gráfico, em cima o título,
 * embaixo a faixa de controles. A direção da câmera é sempre a mesma, de frente e um pouco de cima.
 */
function enquadrarPeca(q: Quadro, W: number, H: number) {
  const dir = v3(0.12, 0.32, 1).normalize()
  const tg = Math.tan(THREE.MathUtils.degToRad(FOV) / 2)
  const L = largo(W)
  const esq = L ? 370 : 20
  const dirPx = L ? 330 : 20 // os nomes do gráfico, à direita das barras
  const topo = 90
  const base = 90
  // da borda esquerda da peça à barra do gráfico (baseGraf: direita + 0,45; barra de 0,13)
  const x0 = q.centro.x - q.raio
  const x1 = q.centro.x + q.direita + 0.45 + 0.1
  const meiaAltura = Math.max(q.raio, GRAF_ALTURA / 2 + 0.08)
  // unidades de mundo por pixel, a uma distância d: 2·d·tg / H
  const dLargura = ((x1 - x0) * 1.08 * H) / ((W - esq - dirPx) * 2 * tg)
  const dAltura = (2 * meiaAltura * 1.12 * H) / ((H - topo - base) * 2 * tg)
  const d = Math.max(dLargura, dAltura, 1.6)
  const porPx = (2 * d * tg) / H
  // o alvo cai em W/2 + DESLOC_PX na tela; o meio da área livre fica em (esq + W − dirPx) / 2
  const ondeCai = W / 2 + (L ? DESLOC_PX : 0)
  const meioLivre = (esq + W - dirPx) / 2
  const alvo = v3((x0 + x1) / 2 + (ondeCai - meioLivre) * porPx, q.centro.y, q.centro.z)
  return { pos: alvo.clone().addScaledVector(dir, d), alvo }
}

// ---------------------------------------------------------------- estado animado (fora do React)
type PorSexo<T> = Record<Sexo, T>
type Anim = {
  vis: PorSexo<number> // presença do animal
  visA: PorSexo<number>
  corpo: PorSexo<number> // força do traço do corpo (recua quando uma peça ou as camadas estão à frente)
  corpoA: PorSexo<number>
  int: PorSexo<number> // força do interior
  intA: PorSexo<number>
  peca: number // a peça escolhida sai do corpo (escrito pela peça ativa)
  texPeca: number // e só depois ganha a textura
  pecaA: number
  pele: number // as camadas saem da pele
  texPele: number
  peleA: number
  graf: number // gráfico ao lado: entra quando a textura já está lá
  grafA: number
  grafDe: 'peca' | 'pele'
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
  texPeca: 0,
  pecaA: 0,
  pele: 0,
  texPele: 0,
  peleA: 0,
  graf: 0,
  grafA: 0,
  grafDe: 'peca',
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

  // alvos da animação a cada mudança de estado: o escolhido fica pleno, o resto recua (como no visualizador do submarino)
  useEffect(() => {
    const a = anim.current
    const foco = modo !== 'animal' || focoAnimal
    for (const s of SEXOS) {
      const sel = s === sexo
      a.visA[s] = !foco || sel ? 1 : RECUO_ANIMAL
      // com uma peça, as camadas ou o interior à frente, o corpo vira contexto
      a.corpoA[s] = modo === 'regiao' || modo === 'pele' ? RECUO_CORPO : modo === 'interior' && sel ? RECUO_INTERIOR : 1
      a.intA[s] = modo === 'interior' ? (sel ? 1 : 0.12) : modo === 'animal' ? 0.28 : 0.1
    }
    a.pecaA = modo === 'regiao' ? 1 : 0
    a.peleA = modo === 'pele' ? 1 : 0
    a.grafA = modo === 'regiao' || (modo === 'pele' && !camada) ? 1 : 0
    a.grafDe = modo === 'pele' ? 'pele' : 'peca'
  }, [modo, sexo, camada, focoAnimal])
  // outro gráfico (outra região, outra camada): some e volta a entrar depois da textura
  useEffect(() => {
    anim.current.graf = 0
  }, [regiao, sexo, camada, modo])
  // outra peça: o progresso é o dela, a partir do corpo (ela mesma escreve a cada quadro)
  useEffect(() => {
    anim.current.peca = 0
    anim.current.texPeca = 0
  }, [regiao, sexo])

  // enquadramento da câmera: muda só quando muda o que está em foco
  const enquadramento = useMemo(() => {
    const dep = ini.cam.length === 6 && modo === ini.modo ? ini.cam : null
    if (dep) return { pos: v3(dep[0], dep[1], dep[2]), alvo: v3(dep[3], dep[4], dep[5]) }
    if (modo === 'animal' && focoAnimal) {
      const alvo = CASA[sexo].clone().add(v3(0.05, 0.95, 0))
      return { pos: alvo.clone().add(v3(0.7, 0.55, 3.2)), alvo }
    }
    return cameraDe(modo, sexo, quadro, orgaoCentro)
  }, [modo, sexo, quadro, orgaoCentro, ini, focoAnimal])

  // peças de pele na cena: a escolhida e as que ainda voltam ao corpo
  const chavePeca = regiao ? `${sexo}-${regiao}` : null
  const [pecas, setPecas] = useState<{ chave: string; sexo: Sexo; regiao: RegiaoId }[]>([])
  useEffect(() => {
    if (!regiao || !chavePeca) return
    setPecas((l) => (l.some((x) => x.chave === chavePeca) ? l : [...l, { chave: chavePeca, sexo, regiao }]))
  }, [chavePeca, sexo, regiao])
  const chaveAtual = useRef(chavePeca)
  chaveAtual.current = chavePeca
  // a peça que já voltou ao corpo sai da cena, a menos que tenha sido escolhida de novo no caminho
  const pecaVoltou = (chave: string) => setPecas((l) => (chave === chaveAtual.current ? l : l.filter((x) => x.chave !== chave)))

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
        if (!g || anim.current.texPeca < 0.5) return []
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
          if (!g || anim.current.texPele < 0.4) return []
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
          if (!g || anim.current.texPele < 0.4) return []
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
        camera={{ position: [1.15, 2.75, 6.6], fov: FOV, near: 0.05, far: 120 }}
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
        {pecas.map((pc) => {
          const ativa = pc.chave === chavePeca
          return (
            <PecaCena
              key={pc.chave}
              m={modelos[pc.sexo]}
              sexo={pc.sexo}
              regiao={pc.regiao}
              anim={anim}
              ativa={ativa}
              itens={ativa ? itensPeca : null}
              foco={ativa && hover?.tipo === 'quimico' ? hover.id : null}
              grupo={pecaGrupo}
              onVoltou={() => pecaVoltou(pc.chave)}
            />
          )
        })}
        <Grafico3D key={`g-${modo}-${itensGraf.map((q) => q.id + q.cor).join('')}`} itens={itensGraf} ladrilhos={ladrilhos} base={baseGraf} anim={anim} foco={hover?.tipo === 'quimico' ? hover.id : null} onHover={(id) => setHover(id ? { tipo: 'quimico', id } : null)} />
        <CamadasCena sexo={sexo} anim={anim} grupos={pilhaGrupos} sel={camada} hover={hover?.tipo === 'camada' ? hover.id : null} onHover={(id) => setHover(id ? { tipo: 'camada', id } : null)} onClique={irCamada} />
        <Deslocamento />
        <Projetor alvos={alvos} elementos={elementos} caminhos={caminhos} />
        <Diretor enquadramento={enquadramento} />
        <PlanoDaFrente />
        <AlcaDev />
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
      <NaFaixa>
        <Menu<Lente>
          rotulo="Lente"
          valor={lente}
          opcoes={[
            { chave: 'insumos', rotulo: 'Insumos' },
            { chave: 'dependencia', rotulo: 'Dependência externa', cor: COR_DEP.sim },
          ]}
          onEscolher={setLente}
        />
      </NaFaixa>
      {lente === 'dependencia' && (
        <NaLegenda>
          <div className="legenda-faixa">
            <div className="legenda-titulo">Dependência externa</div>
            <ul className="legenda-chaves">
              {(['sim', 'nao', 'sd'] as Dep[]).map((d) => (
                <li key={d}>
                  <i style={{ background: COR_DEP[d] }} />
                  {NOME_DEP[d]}
                </li>
              ))}
            </ul>
          </div>
        </NaLegenda>
      )}
    </div>
  )
}

// ================================================================ componentes da cena
/**
 * O que está em foco (a peça, o gráfico, as camadas: renderOrder 10 em diante) é desenhado por cima do
 * contexto, como a seleção no visualizador do submarino: a profundidade é limpa antes deles. Assim um animal
 * recuado, ou um órgão dele, nunca recorta a peça escolhida. Entre si, eles continuam se escondendo.
 */
function PlanoDaFrente() {
  const obj = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3))
    const m = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, transparent: true })
    const mesh = new THREE.Mesh(g, m)
    mesh.renderOrder = 9.9
    mesh.frustumCulled = false
    mesh.onBeforeRender = (r) => r.clearDepth()
    return mesh
  }, [])
  return <primitive object={obj} />
}

// em desenvolvimento, a cena na janela, para medir e depurar (como no visualizador do submarino)
function AlcaDev() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) (window as unknown as { __three: unknown }).__three = { gl, scene, camera }
  }, [gl, scene, camera])
  return null
}

// o relógio de tudo o que não é a peça: presença dos animais, interior, camadas e gráfico
function Animador({ anim }: { anim: MutableRefObject<Anim> }) {
  useFrame((_, dt) => {
    const a = anim.current
    // uma aba que volta do segundo plano não salta
    const d = Math.min(dt, 0.05)
    a.t += d
    for (const s of SEXOS) {
      a.vis[s] = expo(a.vis[s], a.visA[s], d, TAXA_FADE)
      a.corpo[s] = expo(a.corpo[s], a.corpoA[s], d, TAXA_FADE)
      a.int[s] = expo(a.int[s], a.intA[s], d, TAXA_FADE)
    }
    // camadas: saem da pele, chegam, e só então ganham textura; na volta, a textura sai primeiro
    if (a.peleA > 0) {
      a.pele = linear(a.pele, 1, d / DUR_SAIDA)
      a.texPele = expo(a.texPele, a.pele >= 1 ? 1 : 0, d, TAXA_TEXTURA)
    } else {
      a.texPele = expo(a.texPele, 0, d, TAXA_TEXTURA_SAI)
      if (a.texPele < 0.08) a.pele = linear(a.pele, 0, d / DUR_VOLTA)
    }
    // o gráfico ao lado entra depois da textura e sai junto com ela
    const pronto = a.grafDe === 'pele' ? a.texPele : a.texPeca
    const quer = a.grafA > 0 && pronto > 0.8 ? 1 : 0
    a.graf = expo(a.graf, quer, d, quer ? 3 : TAXA_TEXTURA_SAI)
  })
  return null
}

/**
 * A câmera, como no visualizador do submarino: camera-controls amortece alvo, distância e ângulos juntos
 * (smoothTime), girando em volta do alvo e nunca pelo caminho longo. Sem giro automático. O arraste
 * do usuário interrompe o voo; um novo enquadramento só vem de uma nova escolha.
 */
function Diretor({ enquadramento }: { enquadramento: { pos: THREE.Vector3; alvo: THREE.Vector3 } }) {
  const ref = useRef<ComponentRef<typeof CameraControls>>(null)
  const primeiro = useRef(true)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const { pos, alvo } = enquadramento
    c.setLookAt(pos.x, pos.y, pos.z, alvo.x, alvo.y, alvo.z, !primeiro.current)
    // o ângulo acumulado por voltas do usuário não vira giro: o voo vai pelo lado mais curto
    c.normalizeRotations()
    primeiro.current = false
  }, [enquadramento])
  return <CameraControls ref={ref} makeDefault smoothTime={SUAVE_CAMERA} minDistance={0.9} maxDistance={24} maxPolarAngle={1.45} dollyToCursor />
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

// a peça de pele escolhida sai um pouco do corpo, em traço; ao chegar, mostra a mistura da química.
// Cada peça tem o próprio relógio: trocar de região manda a anterior de volta ao corpo enquanto a nova sai.
type PropsPeca = {
  m: Modelo
  sexo: Sexo
  regiao: RegiaoId
  anim: MutableRefObject<Anim>
  ativa: boolean
  itens: Item[] | null
  foco: string | null
  grupo: MutableRefObject<THREE.Group | null>
  onVoltou: () => void
}
function PecaCena(p: PropsPeca) {
  const { m, sexo, regiao, anim } = p
  const pc = m.pecas[regiao]
  const r = regiaoPorId(regiao)
  const obj = useMemo(() => {
    const g = new THREE.BufferGeometry()
    // cópias: translate() mexe no array, e o array é do modelo, compartilhado.
    // Sem a cópia, cada nova montagem da mesma peça (voltar a Barrigas, trocar Boi e Vaca) a deslocava de novo.
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pc.pos), 3))
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pc.nrm), 3))
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
  // a peça que volta ao corpo guarda a mistura que tinha
  useEffect(() => {
    if (!p.itens) return
    definirMistura(
      obj.mat,
      p.itens.map((q) => q.cor),
      p.itens.map((q) => q.valor),
    )
  }, [obj, p.itens])
  useEffect(() => {
    if (!p.itens) return
    const i = p.foco ? p.itens.findIndex((q) => q.id === p.foco) : -1
    obj.mat.uniforms.foco.value = i
  }, [obj, p.foco, p.itens])
  const ini = useMemo(() => pc.centro.clone().add(CASA[sexo]), [pc, sexo])
  const fim = useMemo(() => quadroPeca(m, sexo, regiao).centro, [m, sexo, regiao])
  const grupo = useRef<THREE.Group>(null)
  const rel = useRef({ k: 0, tex: 0, voltou: false })
  useFrame((_, dt) => {
    const g = grupo.current
    if (!g) return
    const d = Math.min(dt, 0.05)
    const a = anim.current
    const r = rel.current
    if (p.ativa && a.pecaA > 0) {
      // sai do corpo; a textura só entra quando a peça para no lugar
      r.voltou = false
      r.k = linear(r.k, 1, d / DUR_SAIDA)
      r.tex = expo(r.tex, r.k >= 1 ? 1 : 0, d, TAXA_TEXTURA)
    } else {
      // volta: primeiro a textura sai, depois a peça desce ao corpo
      r.tex = expo(r.tex, 0, d, TAXA_TEXTURA_SAI)
      if (r.tex < 0.08) r.k = linear(r.k, 0, d / DUR_VOLTA)
      if (!p.ativa && r.k === 0 && !r.voltou) {
        r.voltou = true
        p.onVoltou()
      }
    }
    if (p.ativa) {
      a.peca = r.k
      a.texPeca = r.tex
      p.grupo.current = g
    }
    const e = flui(r.k)
    g.visible = r.k > 0.001
    g.position.lerpVectors(ini, fim, e)
    // um leve arco para cima no meio do trajeto: a peça descola antes de vir para a frente
    g.position.y += Math.sin(Math.PI * e) * 0.06
    g.scale.setScalar(1 + (obj.escala - 1) * e)
    // o contorno acende no corpo antes de a peça sair
    const traco = clamp01(r.k * 5)
    obj.mat.uniforms.opac.value = traco
    obj.mat.uniforms.textura.value = r.tex
    obj.borda.mat.opacity = obj.borda.base * traco
  })
  return (
    <group ref={grupo} visible={false}>
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
  // foco de cada ladrilho, amortecido
  const foco = useMemo(() => ladr.map(() => 1), [ladr])
  useFrame((_, dt) => {
    const g = grupo.current
    if (!g) return
    const d = Math.min(dt, 0.05)
    const v = p.anim.current.graf
    g.visible = v > 0.01
    g.position.copy(p.base)
    ladr.forEach((l, i) => {
      const apagado = !!p.foco && p.foco !== l.id
      foco[i] = expo(foco[i], apagado ? 0.19 : 1, d, TAXA_FADE * 1.6)
      l.mat.opacity = v * 0.95 * foco[i]
      ;(l.arestas.material as THREE.LineBasicMaterial).opacity = v * (p.foco === l.id ? 1 : 0.45 * foco[i])
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
  // onde cada camada está: segue o alvo amortecida, então trocar de animal faz a pilha deslizar, sem salto
  const lugar = useMemo(() => CAMADAS.map(() => ({ pos: new THREE.Vector3(), escala: 0.15, posta: false })), [])
  const alvo = useMemo(() => new THREE.Vector3(), [])
  // realce de cada camada, amortecido como a opacidade das peças do visualizador
  const foco = useMemo(() => CAMADAS.map(() => 1), [])
  useFrame((_, dt) => {
    const a = p.anim.current
    const d = Math.min(dt, 0.05)
    obj.forEach((o, i) => {
      const g = p.grupos.current[i]
      if (!g) return
      // as camadas saem uma depois da outra, de cima para baixo
      const k = flui(clamp01((a.pele - i * 0.08) / 0.7))
      g.visible = a.pele > 0.001
      alvo.lerpVectors(ini, fim, k)
      alvo.y += Y_CAMADA[i] * k
      const escala = 0.15 + 0.85 * k
      const l = lugar[i]
      if (!l.posta || a.pele < 0.001) {
        l.pos.copy(alvo)
        l.escala = escala
        l.posta = true
      } else {
        const f = 1 - Math.exp(-8 * d)
        l.pos.lerp(alvo, f)
        l.escala += (escala - l.escala) * f
      }
      g.position.copy(l.pos)
      g.quaternion.copy(giro)
      g.scale.setScalar(l.escala)
      const sel = p.sel === o.c.id
      const hov = p.hover === o.c.id
      const recua = !!p.sel && !sel
      foco[i] = expo(foco[i], recua ? RECUO_ITEM : 1, d, TAXA_FADE)
      const op = clamp01(a.pele * 2.5) * foco[i]
      o.mat.uniforms.opac.value = op
      o.mat.uniforms.textura.value = a.texPele
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

// o quadro de decomposição ocupa a esquerda: o centro da cena anda para a direita
function Deslocamento() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  useEffect(() => {
    const px = largo(size.width) ? DESLOC_PX : 0
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

