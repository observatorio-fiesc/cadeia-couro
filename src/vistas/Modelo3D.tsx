// Aba Modelo 3D, em dois sistemas escolhidos no título, como no visualizador do submarino.
// Boi e vaca: tudo sai dos animais. Dentro deles, o rúmen e o que entra nele (pasto, ração, adubos); a pele
// é a linha dupla em volta do corpo, e uma região escolhida acende no próprio lugar, com o relevo da pele
// aberta e a química ao lado; um toque no vão da pele abre as camadas, ao lado do animal.
// Sapato: a bota de segurança, peça a peça. Escolher é levar a câmera até lá; nada se solta nem é pintado:
// só o gráfico de composição, ao lado, tem cor. Cada item abre de onde vem na cadeia.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import type { Contexto } from '../dados/contexto'
import { gerarModelo, type RegiaoId, type Sexo } from '../modelo3d/forma'
import { gerarInterior } from '../modelo3d/interior'
import { amostra } from '../modelo3d/amostras'
import {
  CAMADAS,
  COR_DEP,
  CROMO_SOBRAS,
  INSUMOS_ANIMAL,
  NOME_DEP,
  NOS_DO_INSUMO,
  NOS_DO_QUIMICO,
  ORGAOS,
  PALETA,
  PARTES_BOTA,
  QUIMICOS_MS,
  QUIMICOS_MT,
  REGIOES,
  SISTEMAS,
  regiaoPorId,
  type Dep,
  type Modo,
  type Sistema,
} from '../modelo3d/receitas'
import { Decomposicao, type Selecao } from '../modelo3d/Decomposicao'
import { Menu, NaCabeca, NaFaixa, NaLegenda } from '../componentes/Faixa'
import { SeletorSistema } from '../componentes/SeletorSistema'
import { CartaoCadeia } from '../componentes/CartaoCadeia'
import { RECUO_ANIMAL, RECUO_CORPO, RECUO_INTERIOR, v3 } from '../modelo3d/cena'
import {
  BOTA,
  CAM_GERAL,
  CASA,
  ESTACOES,
  lugarPilha,
  FOV,
  GRAF_ALTURA,
  MEIO_CAMADA,
  MEIO_PILHA,
  baseGrafPilha,
  baseGrafRegiao,
  enquadrarPilha,
  enquadrarRegiao,
  olhar,
  quadroPeca,
  type Enquadramento,
  type Estacao,
} from '../modelo3d/lugares'
import { mesmoHover, novaAnim, type Alvo, type Anim, type Hover, type Item, type Lente, type Rotulo } from '../modelo3d/estado'
import { AnimalCena, CamadasCena, Chao, InteriorCena, PecaCena } from '../modelo3d/Animais'
import { BotaCena, GIRO_BOTA } from '../modelo3d/Bota'
import { AlcaDev, Animador, Deslocamento, Diretor, Grafico3D, PlanoDaFrente, Projetor, montarLadrilhos } from '../modelo3d/Palco'
import { bota } from '../modelo3d/geometria'
import '../modelo3d/modelo3d.css'

const SEXOS: Sexo[] = ['boi', 'vaca']
const MODOS: Modo[] = ['animal', 'interior', 'regiao', 'pele', 'bota']
// o que cada modo mostra: os animais (e tudo o que sai deles) ou a bota; o outro sistema sai de vista
const ESTACAO_DO_MODO: Record<Modo, Estacao> = { animal: 'fazenda', interior: 'fazenda', regiao: 'fazenda', pele: 'fazenda', bota: 'bota' }
const EIXO_Y = new THREE.Vector3(0, 1, 0)
/** Os 8 cantos de uma caixa. */
const cantos = (a: THREE.Vector3, b: THREE.Vector3) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => v3(i & 1 ? b.x : a.x, i & 2 ? b.y : a.y, i & 4 ? b.z : a.z))

/** O cartão de cadeia aberto: o item escolhido e os nós da cadeia que ele representa. */
type Cartao = { titulo: string; nota?: string; ids: string[] }

export function VistaModelo3D({ ctx }: { ctx: Contexto }) {
  const modelos = useMemo(() => ({ boi: gerarModelo('boi'), vaca: gerarModelo('vaca') }), [])
  const interiores = useMemo(() => ({ boi: gerarInterior('boi', modelos.boi.escala), vaca: gerarInterior('vaca', modelos.vaca.escala) }), [modelos])
  // estado inicial pela URL (?modo=regiao&regiao=barrigas&sexo=vaca&camada=raspa&lente=dependencia): serve às capturas no servidor local
  const ini = useMemo(() => {
    const q = new URLSearchParams(window.location.search)
    const modo = (MODOS.find((m) => m === q.get('modo')) ?? 'animal') as Modo
    const um = <T extends { id: string }>(lista: T[], chave: string) => lista.find((x) => x.id === q.get(chave))?.id ?? null
    return {
      modo,
      sexo: (q.get('sexo') === 'vaca' ? 'vaca' : 'boi') as Sexo,
      regiao: (REGIOES.find((x) => x.id === q.get('regiao'))?.id ?? (modo === 'regiao' ? 'grupao' : null)) as RegiaoId | null,
      camada: um(CAMADAS, 'camada'),
      parte: um(PARTES_BOTA, 'parte'),
      insumo: um(INSUMOS_ANIMAL, 'insumo'),
      lente: (q.get('lente') === 'dependencia' ? 'dependencia' : 'insumos') as Lente,
      cam: (q.get('cam') ?? '').split(',').map(Number).filter((n) => !Number.isNaN(n)),
    }
  }, [])
  const [modo, setModo] = useState<Modo>(ini.modo)
  const [sexo, setSexo] = useState<Sexo>(ini.sexo)
  const [regiao, setRegiao] = useState<RegiaoId | null>(ini.regiao)
  const [camada, setCamada] = useState<string | null>(ini.camada)
  const [parte, setParte] = useState<string | null>(ini.parte)
  const [insumo, setInsumo] = useState<string | null>(ini.insumo)
  const [quimico, setQuimico] = useState<string | null>(null) // químico do gráfico com o cartão de cadeia aberto
  const [focoAnimal, setFocoAnimal] = useState(false) // na visão geral, Boi ou Vaca no quadro aproxima a câmera
  const [lente, setLente] = useState<Lente>(ini.lente)
  const [hover, setHoverBruto] = useState<Hover>(null)
  const setHover = (h: Hover) => setHoverBruto((v) => (mesmoHover(v, h) ? v : h))
  const anim = useRef<Anim>(novaAnim())
  const alvos = useRef<Alvo[]>([])
  const elementos = useRef(new Map<string, HTMLElement>())
  const caminhos = useRef(new Map<string, SVGPathElement>())
  const ancoras = useRef(new Map<string, THREE.Object3D>())
  const pontoPele = useRef(new THREE.Vector3())
  const pilhaGrupos = useRef<(THREE.Group | null)[]>([])
  const [tela, setTela] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setTela({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

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
  const comLente = (q: { id: string; nome: string; cor: string; valor: number; dep: Dep; detalhe: string; faixa?: string; depNota: string }): Item => ({ ...q, cor: corDe(q.cor, q.dep) })

  // química de cada gráfico: a da região escolhida (ribeira e curtimento) e a do recurtimento das camadas
  const itensPeca: Item[] = useMemo(() => {
    const r = regiaoPorId(regiao ?? 'grupao')
    return QUIMICOS_MT.filter((q) => r.quimicos.includes(q.id)).map(comLente)
  }, [regiao, lente])
  const itensCamadas: Item[] = useMemo(() => {
    const c = CAMADAS.find((x) => x.id === camada)
    return (c && c.id === 'sobras' ? [CROMO_SOBRAS] : QUIMICOS_MS).map(comLente)
  }, [camada, lente])

  const quadro = useMemo(() => (regiao ? quadroPeca(modelos[sexo], sexo, regiao) : null), [modelos, sexo, regiao])
  const rumen = useMemo(() => interiores[sexo].orgaos.find((o) => o.id === 'rumen')!.centro.clone().add(CASA[sexo]), [interiores, sexo])
  const pecasBota = useMemo(() => bota(), [])
  // caixas do que está em foco, para os rótulos não cobrirem: a região escolhida e cada peça da bota
  const caixaRegiao = useMemo(() => {
    if (!regiao) return null
    const b = new THREE.Box3().setFromArray(modelos[sexo].pecas[regiao].pos)
    return b.translate(CASA[sexo])
  }, [modelos, sexo, regiao])
  const caixaBota = useMemo(() => {
    const out: Record<string, THREE.Vector3[]> = {}
    for (const [id, g] of Object.entries(pecasBota)) {
      const b = g.sup ? (g.sup.computeBoundingBox(), g.sup.boundingBox!.clone()) : new THREE.Box3().setFromArray(g.linhas)
      out[id] = cantos(b.min, b.max).map((p) => p.add(g.desloc).applyAxisAngle(EIXO_Y, GIRO_BOTA).add(BOTA))
    }
    return out
  }, [pecasBota])
  const obstaculos = useRef<() => THREE.Vector3[][]>(() => [])

  // alvos da animação a cada mudança de estado: o escolhido fica pleno, o resto recua (como no visualizador do submarino)
  useEffect(() => {
    const a = anim.current
    const naFazenda = ESTACAO_DO_MODO[modo] === 'fazenda'
    const foco = modo !== 'animal' || focoAnimal
    for (const s of SEXOS) {
      const sel = s === sexo
      a.visA[s] = !naFazenda ? 0 : !foco || sel ? 1 : RECUO_ANIMAL
      // com uma região, as camadas ou o rúmen em foco, o corpo vira contexto
      a.corpoA[s] = modo === 'regiao' || modo === 'pele' ? RECUO_CORPO : modo === 'interior' && sel ? RECUO_INTERIOR : 1
      a.intA[s] = modo === 'interior' ? (sel ? 1 : 0.12) : modo === 'animal' ? 0.28 : 0.1
    }
    // um sistema de cada vez: os animais ou a bota
    for (const e of ESTACOES) a.estA[e] = e === ESTACAO_DO_MODO[modo] ? 1 : 0
    a.pecaA = modo === 'regiao' ? 1 : 0
    a.peleA = modo === 'pele' ? 1 : 0
    a.grafA = modo === 'regiao' || (modo === 'pele' && !camada) ? 1 : 0
    a.grafDe = modo === 'pele' ? 'pele' : 'peca'
  }, [modo, sexo, camada, focoAnimal])
  // outro gráfico (outra região, outra camada): some e volta a entrar depois do desenho
  useEffect(() => {
    anim.current.graf = 0
  }, [regiao, sexo, camada, modo])
  useEffect(() => {
    anim.current.peca = 0
  }, [regiao, sexo])

  // ---------------------------------------------------------------- pontos de cada estação, no mundo
  const noMundoBota = (id: string) => {
    const g = pecasBota[id]
    return g.ancora.clone().add(g.desloc).applyAxisAngle(EIXO_Y, GIRO_BOTA).add(BOTA)
  }

  // enquadramento da câmera: muda só quando muda o que está em foco
  const enquadramento: Enquadramento = useMemo(() => {
    const dep = ini.cam.length === 6 && modo === ini.modo ? ini.cam : null
    if (dep) return { pos: v3(dep[0], dep[1], dep[2]), alvo: v3(dep[3], dep[4], dep[5]) }
    const { w, h } = tela
    switch (modo) {
      case 'animal':
        return focoAnimal ? olhar(CASA[sexo].clone().add(v3(0.05, 0.95, 0)), v3(0.7, 0.55, 3.2), 3.3) : CAM_GERAL
      case 'interior':
        return olhar(rumen.clone().add(v3(0.1, 0.05, 0)), v3(0.55, 0.42, 1), 2.7)
      case 'regiao':
        return quadro && regiao ? enquadrarRegiao(quadro, regiao, w, h) : CAM_GERAL
      case 'pele':
        return enquadrarPilha(sexo, w, h)
      case 'bota':
        return parte ? olhar(noMundoBota(parte), v3(0.35, 0.45, 1), 1.55) : olhar(BOTA.clone().add(v3(0.4, 0.12, -0.18)), v3(0.35, 0.45, 1), 2.85)
    }
  }, [modo, sexo, quadro, regiao, rumen, parte, ini, focoAnimal, tela])

  // regiões na cena: a escolhida e as que ainda se apagam
  const chavePeca = modo === 'regiao' && regiao ? `${sexo}-${regiao}` : null
  const [pecas, setPecas] = useState<{ chave: string; sexo: Sexo; regiao: RegiaoId }[]>([])
  useEffect(() => {
    if (!regiao || !chavePeca) return
    setPecas((l) => (l.some((x) => x.chave === chavePeca) ? l : [...l, { chave: chavePeca, sexo, regiao }]))
  }, [chavePeca, sexo, regiao])
  const chaveAtual = useRef(chavePeca)
  chaveAtual.current = chavePeca
  const pecaApagou = (chave: string) => setPecas((l) => (chave === chaveAtual.current ? l : l.filter((x) => x.chave !== chave)))

  // ---------------------------------------------------------------- navegação
  const limpar = () => {
    setCamada(null)
    setParte(null)
    setInsumo(null)
    setQuimico(null)
    setHover(null)
  }
  function irRaiz() {
    setFocoAnimal(false)
    setModo('animal')
    limpar()
  }
  function voltar() {
    if (quimico) return setQuimico(null)
    if (camada) return setCamada(null)
    if (parte) return setParte(null)
    if (insumo) return setInsumo(null)
    irRaiz()
  }
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') voltar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })
  function irEtapa(m: Modo) {
    limpar()
    setModo(m)
    if (m === 'regiao' && !regiao) setRegiao('grupao')
  }
  // o título escolhe o sistema: os animais (na visão geral) ou o sapato
  function irSistema(s: Sistema) {
    if (s === 'sapato') irEtapa('bota')
    else irRaiz()
  }
  function irRegiao(s: Sexo, r: RegiaoId) {
    limpar()
    setSexo(s)
    setRegiao(r)
    setModo('regiao')
  }
  // o vão da pele, no animal: abre as camadas da pele dele, ao lado
  function irPele(s: Sexo) {
    limpar()
    setSexo(s)
    setModo('pele')
  }
  const alterna = (set: (f: (v: string | null) => string | null) => void, id: string) => set((v) => (v === id ? null : id))
  function irFilho(etapa: string, id: string) {
    if (etapa === 'regiao') return irRegiao(sexo, id as RegiaoId)
    // a etapa do item: 'bota' é o sistema do sapato; as outras, as etapas do boi e da vaca
    const destino: Modo = etapa === 'bota' ? 'bota' : (etapa as Modo)
    if (modo !== destino) {
      limpar()
      setModo(destino)
    }
    setQuimico(null)
    if (etapa === 'interior') alterna(setInsumo, id)
    else if (etapa === 'pele') alterna(setCamada, id)
    else if (etapa === 'bota') alterna(setParte, id)
  }

  // ---------------------------------------------------------------- cartão de cadeia do que está escolhido
  const cartao: Cartao | null = useMemo(() => {
    const todos = [...QUIMICOS_MT, ...QUIMICOS_MS, CROMO_SOBRAS]
    if (quimico) {
      const q = todos.find((x) => x.id === quimico)
      if (q) return { titulo: q.nome, nota: q.detalhe, ids: NOS_DO_QUIMICO[q.id] ?? [] }
    }
    if (modo === 'interior' && insumo) {
      const i = INSUMOS_ANIMAL.find((x) => x.id === insumo)!
      return { titulo: i.nome, nota: i.nota, ids: NOS_DO_INSUMO[i.id] ?? [] }
    }
    if (modo === 'bota' && parte) {
      const p = PARTES_BOTA.find((x) => x.id === parte)!
      return { titulo: p.nome, nota: p.nota, ids: p.nos }
    }
    return null
  }, [quimico, modo, insumo, parte])
  const fecharCartao = () => {
    if (quimico) setQuimico(null)
    else if (modo === 'interior') setInsumo(null)
    else if (modo === 'bota') setParte(null)
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
  // um ponto registrado por uma estação, enquanto ela está presente
  const ponto = (id: string, est: Estacao, min = 0.85) => () => {
    const o = ancoras.current.get(id)
    return o && anim.current.est[est] > min ? [o.getWorldPosition(new THREE.Vector3())] : []
  }
  const pct = (x: number | null) => (x == null ? '–' : `${Math.round(x * 100)}%`)
  const pctItem = (lista: Item[], i: number) => Math.round((lista[i].valor / lista.reduce((s, q) => s + q.valor, 0)) * 100)
  const depTag = (dep: Dep) => (
    <span className="dep">
      <i style={{ background: COR_DEP[dep] }} />
      {NOME_DEP[dep]}
    </span>
  )
  const pilula = (n: number | null, nome: string, nota?: ReactNode) => (
    <>
      {n != null && <span className="n">{n}</span>}
      <b>{nome}</b>
      {nota && <small>{nota}</small>}
    </>
  )

  const rotulos: Rotulo[] = []
  // --- fazenda: o que está sob o ponteiro
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
      conteudo: pilula(r.n, r.nome, `${r.nota}${s === 'vaca' && r.notaVaca ? `; ${r.notaVaca}` : ''}`),
    })
  }
  if (hover?.tipo === 'pele' && (modo === 'animal' || modo === 'regiao')) {
    rotulos.push({ id: 'pele', modo: 'perto', dx: 50, dy: -60, pontos: () => [pontoPele.current.clone()], classe: 'pilula', conteudo: pilula(null, 'Pele', 'o vão entre o corpo e a linha de fora: clique para ver as camadas') })
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
        s === 'boi'
          ? pilula(null, 'Boi', 'pele mais pesada que a das fêmeas da mesma idade')
          : pilula(null, 'Vaca', `pele mais leve, com mais gordura a tirar no descarne · fêmeas: ${pct(femeas.mt)} do abate em MT e ${pct(femeas.ms)} em MS em 2025 (IBGE)`),
    })
  }
  // --- o rúmen e o que entra nele
  if (modo === 'interior') {
    const it = interiores[sexo]
    ORGAOS.forEach((o) => {
      const g = it.orgaos.find((x) => x.id === o.id)!
      rotulos.push({
        id: `org-${o.id}`,
        modo: 'dir',
        pontos: () => (anim.current.int[sexo] > 0.6 ? [g.centro.clone().add(CASA[sexo])] : []),
        classe: 'pilula orgao selecionada',
        conteudo: pilula(null, o.nome, o.nota),
      })
    })
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
      const ativo = (hover?.tipo === 'insumo' && hover.id === ins.id) || insumo === ins.id
      rotulos.push({
        id: `ins-${ins.id}`,
        modo: 'esq',
        pontos: () => (anim.current.int[sexo] > 0.6 ? [c.clone().add(CASA[sexo])] : []),
        classe: `insumo${ativo ? ' hover' : ''}${ins.grupo === 'adubo' ? ' adubo' : ''}${insumo && insumo !== ins.id ? ' apagado' : ''}`,
        conteudo: (
          <span onMouseEnter={() => setHover({ tipo: 'insumo', id: ins.id })} onMouseLeave={() => setHover(null)} onClick={() => irFilho('interior', ins.id)}>
            <i style={ins.grupo === 'adubo' ? { borderColor: lente === 'dependencia' ? COR_DEP[ins.dep] : PALETA.tinta2 } : { background: corDe(ins.cor, ins.dep) }} />
            <b>{ins.nome}</b>
            {lente === 'dependencia' && !ativo && <small>{NOME_DEP[ins.dep]}</small>}
            {ativo && <small>{lente === 'dependencia' ? ins.depNota : ins.nota}</small>}
          </span>
        ),
      })
    })
  }
  // --- a região escolhida, no lugar
  if (modo === 'regiao' && regiao) {
    const r = regiaoPorId(regiao)
    rotulos.push({
      id: `peca-${r.id}`,
      modo: 'perto',
      dx: -60,
      dy: -80,
      pontos: (cam) => (anim.current.peca > 0.6 ? ancoraRegiao(sexo, r.id, cam) : []),
      classe: 'pilula selecionada',
      conteudo: pilula(r.n, r.nome, `${r.nota}${sexo === 'vaca' && r.notaVaca ? `; ${r.notaVaca}` : ''}`),
    })
  }
  // --- gráfico ao lado (porcentagem de cada químico): clique abre de onde ele vem
  const itensGraf = modo === 'regiao' ? itensPeca : itensCamadas
  const baseGraf = modo === 'regiao' && quadro ? baseGrafRegiao(quadro) : baseGrafPilha(sexo)
  const ladrilhos = useMemo(() => montarLadrilhos(itensGraf), [itensGraf])
  if (modo === 'regiao' || (modo === 'pele' && !camada)) {
    itensGraf.forEach((q, i) => {
      const l = ladrilhos[i]
      const ativo = (hover?.tipo === 'quimico' && hover.id === q.id) || quimico === q.id
      const apagado = (hover?.tipo === 'quimico' || quimico) && !ativo
      rotulos.push({
        id: `leg-${q.id}`,
        modo: 'legenda',
        dx: 24,
        pontos: () => (anim.current.graf > 0.6 ? [baseGraf.clone().add(v3(0.09, l.y, 0))] : []),
        classe: `legenda-q${apagado ? ' apagado' : ''}${ativo ? ' hover' : ''}`,
        conteudo: (
          <span onMouseEnter={() => setHover({ tipo: 'quimico', id: q.id })} onMouseLeave={() => setHover(null)} onClick={() => setQuimico((v) => (v === q.id ? null : q.id))}>
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
  // --- camadas, na pilha ao lado do animal
  if (modo === 'pele') {
    const bordaCamada = (i: number) => () => {
      const g = pilhaGrupos.current[i]
      if (!g || anim.current.pele < 0.8) return []
      const ps: THREE.Vector3[] = []
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        ps.push(g.localToWorld(v3(Math.cos(a) * MEIO_CAMADA, 0, Math.sin(a) * MEIO_CAMADA)))
      }
      return ps
    }
    CAMADAS.forEach((c, i) => {
      const sel = camada === c.id
      rotulos.push({
        id: `cam-${c.id}`,
        modo: 'esq',
        pontos: bordaCamada(i),
        classe: `camada-nome${camada && !sel ? ' apagado' : ''}${sel ? ' sel' : ''}`,
        conteudo: (
          <span onMouseEnter={() => setHover({ tipo: 'camada', id: c.id })} onMouseLeave={() => setHover(null)} onClick={() => irFilho('pele', c.id)}>
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
        pontos: bordaCamada(i),
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
  // --- a bota: cada peça com o seu nome
  if (modo === 'bota') {
    const aEsquerda = new Set(['cabedal', 'contraforte', 'palmilha', 'antiperfuracao'])
    PARTES_BOTA.forEach((pt) => {
      if (parte && parte !== pt.id) return
      const sel = parte === pt.id
      const quente = sel || (hover?.tipo === 'parte' && hover.id === pt.id)
      rotulos.push({
        id: `parte-${pt.id}`,
        modo: sel ? 'perto' : aEsquerda.has(pt.id) ? 'esq' : 'dir',
        dx: -40,
        dy: -70,
        pontos: ponto(`parte-${pt.id}`, 'bota'),
        classe: `pilula parte${sel ? ' selecionada' : ''}${parte && !sel ? ' apagado' : ''}`,
        conteudo: (
          <span onMouseEnter={() => setHover({ tipo: 'parte', id: pt.id })} onMouseLeave={() => setHover(null)} onClick={() => irFilho('bota', pt.id)}>
            {pilula(pt.n, pt.nome, quente ? pt.nota : undefined)}
          </span>
        ),
      })
    })
  }
  alvos.current = rotulos

  // o que está em foco, que nenhum rótulo pode cobrir (lido pelo Projetor a cada quadro)
  const graficoVisivel = modo === 'regiao' || (modo === 'pele' && !camada)
  obstaculos.current = () => {
    const out: THREE.Vector3[][] = []
    const it = interiores[sexo]
    switch (modo) {
      case 'interior':
        out.push(cantos(it.rumen.c.clone().sub(it.rumen.r).add(CASA[sexo]), it.rumen.c.clone().add(it.rumen.r).add(CASA[sexo])))
        break
      case 'regiao':
        if (caixaRegiao) out.push(cantos(caixaRegiao.min, caixaRegiao.max))
        break
      case 'pele': {
        const p = lugarPilha(sexo)
        out.push(cantos(v3(p.x - MEIO_PILHA, p.y - 0.42, p.z - MEIO_PILHA), v3(p.x + MEIO_PILHA, p.y + 0.42, p.z + MEIO_PILHA)))
        break
      }
      case 'bota':
        out.push(parte ? caixaBota[parte] : Object.values(caixaBota).flat())
        break
    }
    if (graficoVisivel && anim.current.graf > 0.3) out.push(cantos(baseGraf.clone().add(v3(-0.08, -GRAF_ALTURA / 2, -0.08)), baseGraf.clone().add(v3(0.08, GRAF_ALTURA / 2, 0.08))))
    return out
  }

  const cursorMao = (sim: boolean) => {
    document.body.style.cursor = sim ? 'pointer' : ''
  }
  useEffect(() => () => cursorMao(false), [])

  const realceDe = (s: Sexo): { reg: RegiaoId | null; forte: boolean } => {
    if (hover?.tipo === 'regiao' && (hover.sexo === null || hover.sexo === s) && (modo === 'animal' || modo === 'regiao')) return { reg: hover.regiao, forte: true }
    if (modo === 'regiao' && s === sexo && regiao) return { reg: regiao, forte: false }
    return { reg: null, forte: false }
  }
  const hoverId = (tipo: 'parte' | 'camada') => (hover?.tipo === tipo ? hover.id : null)
  const selecao: Selecao = { interior: insumo, regiao: modo === 'regiao' ? regiao : null, pele: camada, bota: parte }
  const sistema: Sistema = modo === 'bota' ? 'sapato' : 'animais'

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
            <InteriorCena
              it={interiores[s]}
              sexo={s}
              anim={anim}
              lente={lente}
              ativo={modo === 'interior' && s === sexo}
              orgao={null}
              hover={insumo && !hover ? { tipo: 'insumo', id: insumo } : hover}
              onHover={setHover}
              onOrgao={() => undefined}
            />
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
        {pecas.map((pc) => (
          <PecaCena key={pc.chave} m={modelos[pc.sexo]} sexo={pc.sexo} regiao={pc.regiao} anim={anim} ativa={pc.chave === chavePeca} onApagou={() => pecaApagou(pc.chave)} />
        ))}
        <CamadasCena sexo={sexo} anim={anim} grupos={pilhaGrupos} sel={camada} hover={hoverId('camada')} onHover={(id) => setHover(id ? { tipo: 'camada', id } : null)} onClique={(id) => irFilho('pele', id)} />
        <BotaCena anim={anim} ancoras={ancoras} sel={parte} hover={hoverId('parte')} onHover={(id) => setHover(id ? { tipo: 'parte', id } : null)} onClique={(id) => irFilho('bota', id)} />
        <Grafico3D
          key={`g-${modo}-${itensGraf.map((q) => q.id + q.cor).join('')}`}
          itens={itensGraf}
          ladrilhos={ladrilhos}
          base={baseGraf}
          anim={anim}
          foco={hover?.tipo === 'quimico' ? hover.id : quimico}
          onHover={(id) => setHover(id ? { tipo: 'quimico', id } : null)}
          onClique={(id) => setQuimico((v) => (v === id ? null : id))}
        />
        <Deslocamento cartao={!!cartao} />
        <Projetor alvos={alvos} elementos={elementos} caminhos={caminhos} obstaculos={obstaculos} />
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
        sistema={sistema}
        modo={modo}
        sexo={sexo}
        selecao={selecao}
        hover={hover}
        onRaiz={irRaiz}
        onSexo={(s) => {
          setSexo(s)
          if (modo === 'animal') setFocoAnimal(true)
        }}
        onEtapa={irEtapa}
        onFilho={irFilho}
        onHover={setHover}
      />
      <NaCabeca>
        <SeletorSistema titulo="Cadeia produtiva do couro" valor={sistema} opcoes={SISTEMAS.map((x) => ({ id: x.id, codigo: x.codigo, nome: x.nome, sobre: x.sobre }))} onEscolher={irSistema} />
      </NaCabeca>
      {cartao && <CartaoCadeia cadeia={ctx.cadeia} ix={ctx.ix} titulo={cartao.titulo} nota={cartao.nota} ids={cartao.ids} onFechar={fecharCartao} />}
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
