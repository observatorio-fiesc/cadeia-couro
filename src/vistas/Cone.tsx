// Cone 3D da cadeia, no padrão da rede da criticidade do painel de referência (submarino/src/scene/CriticalView.tsx):
// recursos naturais no chão, a Viposa no vértice. Cada elo na altura da sua profundidade na cadeia, numa casca que
// estreita para cima; em volta do eixo, no setor das etapas que ele alimenta, para o suprimento de cada etapa subir
// como uma nervura. No alto, o anel das nove etapas na ordem do processo, com o caminho do couro de uma etapa à
// seguinte; acima dele, os seis produtos vendidos e a Viposa.
// Marcas em tamanho de tela (anel fino e disco, do tamanho do alcance), ligações em curva que esmaecem com a
// profundidade, rótulos que não se cobrem. Um elo clicado: o que depende dele fica vermelho, elo a elo, até os
// produtos que deixariam de sair.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { CameraControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Contexto } from '../dados/contexto'
import type { No } from '../dados/cadeia'
import { COR, LENTES, aparencia, parteGolfo, type Lente } from '../lib/lentes'
import { musd, pct } from '../lib/formato'
import { CAIXA_ELO, Diagrama } from './ConeElo'
import { GRUPOS_AMBIENTE, LICENCAS, VALOR_AMBIENTE, pontosDeAtencao } from '../dados/ambiente'

// ---------------------------------------------------------------- geometria do cone

/** Altura e raio da base do cone, em unidades da cena (os mesmos da referência). */
const H = 3.6
const R = 2.7
/** Onde o cone fica: centrado na origem, para a câmera mirar o meio dele. */
const EM = new THREE.Vector3(0, -(H + 0.5) / 2, 0)
// mais aberto no alto que o da referência: o anel das etapas é o caminho do couro e precisa de lugar
const raioEm = (y: number) => R * (1 - 0.62 * (Math.min(y, H) / H))
/** Segundos por elo quando o que depende de um elo fica vermelho. */
const PASSO = 0.2
/** Segmentos de cada ligação em curva. */
const SEG = 10

const ORDEM_ETAPAS = ['sis.pele', 'sis.ribeira', 'sis.curtimento', 'sis.classificacao', 'sis.recurtimento', 'sis.acabamento', 'sis.manufatura', 'sis.transporte', 'sis.utilidades']
const VIPOSA = 'viposa'

/** Setores do destaque da lente Estrutura: por tronco, no máximo quatro matizes da paleta do painel. */
const SETORES: { chave: string; nome: string; cor: string; troncos: string[] }[] = [
  { chave: 'quimica', nome: 'química e petroquímica', cor: '#5daed2', troncos: ['quimica', 'petroquimica'] },
  { chave: 'minerais', nome: 'minerais', cor: '#eadfcb', troncos: ['minerais'] },
  { chave: 'energia', nome: 'energia e água', cor: '#e9b24a', troncos: ['energia', 'agua'] },
  { chave: 'agro', nome: 'agro, adubos e floresta', cor: '#5fa874', troncos: ['agro', 'pecuaria', 'fertilizantes', 'floresta'] },
]
const setorDe = (n: No) => SETORES.find((s) => s.troncos.includes(n.tronco))
const grupoAmbiente = (id: string) => GRUPOS_AMBIENTE.find((g) => g.ids.includes(id))
/** O que se pode destacar na lente Ambiente: os grupos da cadeia, as licenças e cada tipo de saída. */
const FILTROS_AMBIENTE: { chave: string; nome: string; cor: string; forma: 'ponto' | 'quadrado' | 'tracejado'; parte: 'cadeia' | 'sai' }[] = [
  ...GRUPOS_AMBIENTE.map((g) => ({ chave: g.chave, nome: g.nome, cor: g.cor, forma: 'ponto' as const, parte: 'cadeia' as const })),
  { chave: 'licencas', nome: 'licenças e LWG', cor: '#f6eee0', forma: 'ponto', parte: 'cadeia' },
  { chave: 'coproduto', nome: 'coprodutos', cor: '#5fa874', forma: 'quadrado', parte: 'sai' },
  { chave: 'residuo', nome: 'resíduos', cor: '#cf6a4a', forma: 'quadrado', parte: 'sai' },
  { chave: 'efluente', nome: 'efluentes', cor: '#5daed2', forma: 'tracejado', parte: 'sai' },
]
/** O filtro de um elo na lente Ambiente: o grupo, as licenças ou o tipo da saída. */
const chaveAmbiente = (id: string, saidas: Map<string, { tipo: string }>) => (saidas.has(id) ? saidas.get(id)!.tipo : id === LICENCAS ? 'licencas' : grupoAmbiente(id)?.chave ?? null)

/** Cor de cada tipo de saída (a mesma da aba Cadeia). */
const COR_SAIDA: Record<string, string> = { coproduto: '#5fa874', residuo: '#cf6a4a', efluente: '#5daed2' }
/** Alcance a partir do qual um elo entra no destaque da lente Estrutura. */
const DESTAQUE = 0.2

function hash(s: string, sal = 0): number {
  let h = 2166136261 ^ sal
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 100000) / 100000
}

/** O que sai de uma etapa (coproduto, resíduo ou efluente), desenhado só na lente Ambiente. */
type SaidaCone = { id: string; nome: string; tipo: string; destino: string; etapa: string }

type Rede = {
  ids: string[]
  viposa: string
  saidas: Map<string, SaidaCone>
  /** etapa → saída, e efluente → tratamento: fora da queda, só desenhadas */
  ligacoesAmb: [string, string][]
  indice: Map<string, number>
  pos: Map<string, THREE.Vector3>
  ligacoes: [string, string][]
  usuarios: Map<string, string[]>
  etapas: string[]
  artigos: string[]
  bandas: [string, number][]
}

/**
 * A rede no cone. Cada elo de oferta na altura da sua profundidade a partir dos recursos naturais; em volta do
 * eixo, no ângulo médio das etapas que ele alimenta (direto ou por outros insumos); os que alimentam muitas etapas,
 * em qualquer lugar da casca. As etapas no anel do alto, na ordem do processo; os produtos vendidos sobre a etapa
 * que os faz; a Viposa no vértice.
 */
function montarRede(ctx: Contexto): Rede {
  const { cadeia, ix } = ctx
  const no = (id: string) => ix.porId.get(id)
  const artigos = cadeia.meta.artigos.filter((a) => no(a))
  const viposa = cadeia.nos.find((n) => n.lado === 'nucleo')?.id ?? VIPOSA
  const etapas = cadeia.nos.filter((n) => n.lado === 'oferta' && n.camada === 1).map((n) => n.id).sort((a, b) => ORDEM_ETAPAS.indexOf(a) - ORDEM_ETAPAS.indexOf(b))
  const itens = cadeia.nos.filter((n) => n.lado === 'oferta' && n.camada >= 2).map((n) => n.id)
  // o que cada etapa solta: as saídas do processo que não são venda
  const saidas = new Map<string, SaidaCone>()
  const { processo, ixp } = ctx
  for (const s of processo?.saidas ?? []) {
    if (s.tipo === 'artigo') continue
    const etapa = ixp?.origem.get(s.id)?.[0]?.etapa
    if (etapa && etapas.includes(etapa)) saidas.set(s.id, { id: s.id, nome: s.nome, tipo: s.tipo, destino: s.destino, etapa })
  }
  const ids = [...itens, ...etapas, ...artigos, viposa, ...saidas.keys()]
  const dentro = new Set(ids)
  const ligacoes: [string, string][] = cadeia.arestas.filter((a) => a.tipo !== 'visual' && dentro.has(a.de) && dentro.has(a.para)).map((a) => [a.de, a.para])
  // a Viposa vende os produtos: a ligação que fecha o cone
  for (const a of artigos) ligacoes.push([a, viposa])
  const usuarios = new Map<string, string[]>()
  for (const [u, w] of ligacoes) (usuarios.get(u) ?? usuarios.set(u, []).get(u)!).push(w)
  const ehEtapa = new Set(etapas)

  // profundidade: recursos naturais em 0; cada elo, um acima do mais alto do que ele precisa
  const precisa = new Map<string, string[]>()
  for (const [u, w] of ligacoes) (precisa.get(w) ?? precisa.set(w, []).get(w)!).push(u)
  const nivel = new Map<string, number>()
  const visitando = new Set<string>()
  const nv = (id: string): number => {
    if (nivel.has(id)) return nivel.get(id)!
    if (visitando.has(id)) return 0
    visitando.add(id)
    const v = Math.max(-1, ...(precisa.get(id) ?? []).filter((u) => !ehEtapa.has(u)).map(nv)) + 1
    visitando.delete(id)
    nivel.set(id, v)
    return v
  }
  itens.forEach(nv)
  // cada camada da cadeia numa faixa de altura; dentro dela, pela profundidade
  const FAIXAS: Record<number, [number, number]> = { 4: [0, 0.06], 3: [0.2, 0.44], 2: [0.54, 0.8] }
  const extremos = new Map<number, [number, number]>()
  for (const id of itens) {
    const cam = no(id)!.camada
    const e = extremos.get(cam) ?? [Infinity, -Infinity]
    extremos.set(cam, [Math.min(e[0], nivel.get(id)!), Math.max(e[1], nivel.get(id)!)])
  }
  const alturaDe = (id: string) => {
    const cam = no(id)!.camada
    const [f0, f1] = FAIXAS[cam] ?? [0.5, 0.8]
    const [n0, n1] = extremos.get(cam)!
    return (f0 + (f1 - f0) * (n1 > n0 ? (nivel.get(id)! - n0) / (n1 - n0) : 0.5)) * H
  }

  // as etapas que cada elo alimenta: subindo pelos insumos até a primeira etapa
  const anguloEtapa = (k: number) => (k / etapas.length) * Math.PI * 2 + Math.PI * 0.62
  const alimenta = (id: string) => {
    const ks = new Set<number>()
    const vistos = new Set<string>([id])
    const pilha = [id]
    while (pilha.length)
      for (const w of usuarios.get(pilha.pop()!) ?? []) {
        if (vistos.has(w)) continue
        vistos.add(w)
        if (ehEtapa.has(w)) ks.add(etapas.indexOf(w))
        else if (!artigos.includes(w) && w !== viposa) pilha.push(w)
      }
    return [...ks]
  }

  const pos = new Map<string, THREE.Vector3>()
  for (const id of itens) {
    const ks = alimenta(id)
    let sx = 0
    let sz = 0
    for (const k of ks) (sx += Math.cos(anguloEtapa(k))), (sz += Math.sin(anguloEtapa(k)))
    const coerencia = Math.hypot(sx, sz) / Math.max(ks.length, 1)
    const a = (coerencia > 0.05 ? Math.atan2(sz, sx) : hash(id, 5) * Math.PI * 2) + (hash(id) - 0.5) * (0.35 + (1 - coerencia) * 5.2)
    const y = alturaDe(id) + (hash(id, 3) - 0.5) * 0.08
    const r = raioEm(y) * (0.8 + 0.2 * hash(id, 7))
    pos.set(id, new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r))
  }
  const yEtapas = H * 0.9
  etapas.forEach((id, k) => {
    const a = anguloEtapa(k)
    pos.set(id, new THREE.Vector3(Math.cos(a) * raioEm(yEtapas), yEtapas, Math.sin(a) * raioEm(yEtapas)))
  })
  const yArtigos = H * 1.04
  for (const id of artigos) {
    const de = (precisa.get(id) ?? []).filter((u) => ehEtapa.has(u)).map((u) => etapas.indexOf(u))
    const a = de.length ? anguloEtapa(Math.max(...de)) + (hash(id) - 0.5) * 0.3 : hash(id) * Math.PI * 2
    const r = raioEm(H) * 0.95
    pos.set(id, new THREE.Vector3(Math.cos(a) * r, yArtigos, Math.sin(a) * r))
  }
  pos.set(viposa, new THREE.Vector3(0, H + 0.5, 0))
  // as saídas, para fora do anel das etapas e um pouco abaixo, empilhadas sob a etapa de onde saem
  const ligacoesAmb: [string, string][] = []
  for (const e of etapas) {
    const daqui = [...saidas.values()].filter((x) => x.etapa === e)
    const a0 = anguloEtapa(etapas.indexOf(e))
    daqui.forEach((x, k) => {
      const a = a0 + (k - (daqui.length - 1) / 2) * 0.16
      const r = raioEm(yEtapas) + 0.7
      pos.set(x.id, new THREE.Vector3(Math.cos(a) * r, yEtapas - 0.35 - k * 0.12, Math.sin(a) * r))
      ligacoesAmb.push([e, x.id])
      // o efluente vai ao tratamento, no apoio
      if (x.tipo === 'efluente' && e !== 'sis.utilidades' && dentro.has('sis.utilidades')) ligacoesAmb.push([x.id, 'sis.utilidades'])
    })
  }

  const media = (f: (n: No) => boolean) => {
    const ys = itens.filter((id) => f(no(id)!)).map((id) => pos.get(id)!.y)
    return ys.reduce((s, y) => s + y, 0) / Math.max(ys.length, 1)
  }
  const bandas: [string, number][] = [
    ['recursos naturais', 0.04],
    ['materiais', media((n) => n.camada === 3)],
    ['insumos e capacitações', media((n) => n.camada === 2)],
    ['etapas', yEtapas],
    ['produtos vendidos', yArtigos],
  ]
  return { ids, viposa, saidas, ligacoesAmb, indice: new Map(ids.map((id, i) => [id, i])), pos, ligacoes, usuarios, etapas, artigos, bandas }
}

// ---------------------------------------------------------------- materiais (os da referência)

const MARCA_VS = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
attribute float aFill;
attribute float aGlow;
uniform float uScale;
uniform float uRef;
uniform vec2 uDepth;
varying vec4 vColor;
varying float vFill;
varying float vGlow;
varying float vSize;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float fade = clamp((-mv.z - uDepth.x) / max(uDepth.y - uDepth.x, 0.001), 0.0, 1.0);
  vColor = vec4(aColor.rgb, aColor.a * mix(1.0, 0.4, fade));
  vFill = aFill;
  vGlow = aGlow;
  gl_PointSize = aSize * uScale * clamp(uRef / -mv.z, 0.6, 1.7);
  vSize = gl_PointSize;
  gl_Position = projectionMatrix * mv;
}`
const MARCA_FS = /* glsl */ `
varying vec4 vColor;
varying float vFill;
varying float vGlow;
varying float vSize;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float px = 2.0 / max(vSize, 1.0);
  // anel fino, disco dentro dele e, fora, quando escolhido, um brilho
  float ring = 1.0 - smoothstep(0.6 * px, 1.8 * px, abs(d - 0.8));
  float disc = (1.0 - smoothstep(0.58 - px, 0.58 + px, d)) * vFill;
  float glow = vGlow * exp(-pow((d - 0.8) / 0.16, 2.0)) * step(0.8, d) * 0.55;
  float a = max(max(ring, disc * 0.92), glow);
  // marcas pequenas são pontos: o anel e o disco se fundem
  if (vSize < 9.0) a = max(a, (1.0 - smoothstep(0.7, 0.95, d)) * (0.45 + 0.55 * vFill));
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}`
const LINHA_VS = /* glsl */ `
attribute vec4 aColor;
uniform vec2 uDepth;
varying vec4 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float fade = clamp((-mv.z - uDepth.x) / max(uDepth.y - uDepth.x, 0.001), 0.0, 1.0);
  vColor = vec4(aColor.rgb, aColor.a * mix(1.0, 0.3, fade));
  gl_Position = projectionMatrix * mv;
}`
const LINHA_FS = /* glsl */ `
varying vec4 vColor;
void main() { gl_FragColor = vColor; }`

const matMarca = () =>
  new THREE.ShaderMaterial({ vertexShader: MARCA_VS, fragmentShader: MARCA_FS, uniforms: { uScale: { value: 1 }, uRef: { value: 8 }, uDepth: { value: new THREE.Vector2(0, 100) } }, transparent: true, depthWrite: false })
const matLinha = () => new THREE.ShaderMaterial({ vertexShader: LINHA_VS, fragmentShader: LINHA_FS, uniforms: { uDepth: { value: new THREE.Vector2(0, 100) } }, transparent: true, depthWrite: false })

const C = {
  tinta: new THREE.Color(COR.cru),
  branco: new THREE.Color('#fff8ec'),
  vermelho: new THREE.Color(COR.vermelho),
  conhaque: new THREE.Color(COR.conhaque),
  ouro: new THREE.Color('#ffd27a'),
}

// ---------------------------------------------------------------- o cone

export type PropsCone = { ctx: Contexto; lente: Lente; onLente: (l: Lente) => void; selecionado: string | null; onSelecionar: (id: string | null) => void; cartaoAberto: boolean }

export function Cone(p: PropsCone) {
  const rede = useMemo(() => montarRede(p.ctx), [p.ctx])
  // um elo escolhido ao abrir o cone (vindo do Modelo 3D): a câmera chega virada para ele
  const [chegada] = useState(() => (p.selecionado ? rede.pos.get(p.selecionado)?.clone().add(EM) ?? null : null))
  const destaques = useMemo(() => p.ctx.cadeia.nos.filter((n) => n.lado === 'oferta' && n.camada >= 2 && (n.alcance_cadeia ?? 0) >= DESTAQUE && setorDe(n)).length, [p.ctx])
  // "ver na cadeia": o elo aberto no seu diagrama; o cone sai de cena enquanto isso
  const [aberto, setAberto] = useState<string | null>(null)
  // o que está destacado na lente Ambiente (vazio: tudo)
  const [filtroAmb, setFiltroAmb] = useState<Set<string>>(() => new Set())
  const alternarFiltro = (chave: string | null) =>
    setFiltroAmb((f) => {
      if (chave === null) return new Set()
      const g = new Set(f)
      if (g.has(chave)) g.delete(chave)
      else g.add(chave)
      return g
    })
  const vis = useRef({ cone: 1, elo: 0 })
  const abrir = (id: string) => {
    setAberto(id)
    if (id !== p.selecionado) p.onSelecionar(id)
  }
  useEffect(() => {
    if (!p.selecionado) setAberto(null)
  }, [p.selecionado])
  useEffect(() => {
    if (!aberto) return
    // Esc fecha o diagrama antes de desfazer a escolha
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      setAberto(null)
    }
    window.addEventListener('keydown', esc, true)
    return () => window.removeEventListener('keydown', esc, true)
  }, [aberto])
  const producao = useMemo(() => rede.etapas.filter((e) => e !== 'sis.transporte' && e !== 'sis.utilidades'), [rede])
  const conjunto = useMemo(() => (aberto && rede.indice.has(aberto) ? queda(rede, aberto).conjunto : new Set<string>()), [rede, aberto])
  return (
    <>
      <Canvas
        className="cena"
        camera={{ fov: 28, near: 0.01, far: 200, position: [0, 3, 16] }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        raycaster={{ params: { Points: { threshold: 0.14 } } as unknown as THREE.Raycaster['params'] }}
        onPointerMissed={() => !aberto && p.onSelecionar(null)}
      >
        <Niveis aberto={!!aberto} vis={vis} />
        <CameraControls makeDefault smoothTime={1.2} minDistance={6} maxDistance={30} />
        <group position={EM}>
          <Chao vis={vis} />
          <Rede {...p} rede={rede} vis={vis} aberto={!!aberto} onAbrir={abrir} filtroAmb={filtroAmb} />
          {!aberto && <Bandas rede={rede} />}
        </group>
        {aberto && (
          <Diagrama
            key={aberto}
            ctx={p.ctx}
            id={aberto}
            etapas={producao}
            artigos={rede.artigos}
            conjunto={conjunto}
            nivel={{ get current() { return vis.current.elo } }}
            onAbrir={abrir}
            onFechar={() => setAberto(null)}
          />
        )}
        <Diretor lente={p.lente} selecionado={p.selecionado} cartaoAberto={p.cartaoAberto} chegada={chegada} aberto={aberto} />
      </Canvas>
      <nav className="capitulos" aria-label="Lentes do cone">
        {LENTES.map((l, i) => (
          <button key={l.chave} className={l.chave === p.lente ? 'ativo' : ''} onClick={() => p.onLente(l.chave)}>
            <em>{i + 1}</em>
            {l.rotulo}
          </button>
        ))}
      </nav>
      <Historia lente={p.lente} destaques={destaques} etapas={rede.etapas.length} artigos={rede.artigos.length} aberto={!!aberto} filtroAmb={filtroAmb} onFiltroAmb={alternarFiltro} />
    </>
  )
}

/** O texto da lente, na coluna da esquerda, sem caixa: o que se vê e o código de cor. */
function Historia({ lente, destaques, etapas, artigos, aberto, filtroAmb, onFiltroAmb }: { lente: Lente; destaques: number; etapas: number; artigos: number; aberto: boolean; filtroAmb: Set<string>; onFiltroAmb: (chave: string | null) => void }) {
  const rot = LENTES.find((l) => l.chave === lente)!.rotulo
  const cor = (c: string, t: string) => <b style={{ color: c }}>{t}</b>
  if (aberto)
    return (
      <aside className="historia" key="elo">
        <h2>O elo na cadeia</h2>
        <p>À esquerda, de que ele é feito: cada corrente é um insumo (tracejada, quando é opcional). À direita, o que o usa: em {cor(COR.vermelho, 'vermelho')}, o que não sai sem ele; em {cor('#5daed2', 'azul')}, o que tem alternativa.</p>
        <p>No alto, as etapas do processo, na ordem: em {cor(COR.vermelho, 'vermelho')}, as que param sem ele, com a corrente subindo até a primeira; ao lado, os produtos vendidos que deixariam de sair.</p>
        <p className="historia-dica">Cada nome abre aquele elo: anda-se pela cadeia acima e abaixo. Esc volta ao cone.</p>
      </aside>
    )
  return (
    <aside className="historia" key={lente}>
      <h2>{rot}</h2>
      {lente === 'estrutura' && (
        <>
          <p>
            Cada ponto é um elo da cadeia da Viposa: na base, os recursos naturais; no alto, as {etapas} etapas na ordem do processo, os {artigos} produtos vendidos e a Viposa. Cada elo se liga aos que dependem dele. A porcentagem e o tamanho do ponto medem o alcance: a parte da cadeia que depende do elo.
          </p>
          <p>
            Em destaque, os {destaques} elos com alcance de {pct(DESTAQUE)} ou mais, por setor:{' '}
            {SETORES.map((s, i) => (
              <span key={s.chave}>
                {cor(s.cor, s.nome)}
                {i < SETORES.length - 2 ? ', ' : i === SETORES.length - 2 ? ' e ' : '.'}
              </span>
            ))}
          </p>
          <p>O anel do alto, em {cor(COR.conhaque, 'conhaque')}, é o caminho do couro, de etapa em etapa, da pele verde ao calçado.</p>
        </>
      )}
      {lente === 'importado' && (
        <p>
          Elos que o Brasil importa, em {cor(COR.conhaque, 'conhaque')}: o tom acompanha a ordem de grandeza do valor importado em 2025, de US$ 1 milhão a US$ 5 bilhões (Comex Stat). Em tinta apagada, o que não tem importação registrada.
        </p>
      )}
      {lente === 'ormuz' && (
        <p>
          Parcela do Golfo, dentro do estreito e em Omã, nas compras do Brasil de março a setembro de 2025. Em {cor(COR.vermelho, 'vermelho')}, quanto mais forte, maior a parcela; em anel claro, comprado fora do Golfo. A lista ao lado compara 2025 e 2026.
        </p>
      )}
      {lente === 'china' && (
        <p>
          Parcela da China nas compras do Brasil de março a setembro de 2025. Em {cor(COR.ambar, 'âmbar')}, quanto mais forte, maior a parcela; em anel claro, abaixo de 5%. A lista ao lado compara 2025 e 2026.
        </p>
      )}
      {lente === 'ambiente' && (
        <>
          <p>
            Onde o ambiente entra na cadeia: na {cor(GRUPOS_AMBIENTE[0].cor, GRUPOS_AMBIENTE[0].nome)}, na {cor(GRUPOS_AMBIENTE[1].cor, GRUPOS_AMBIENTE[1].nome)}, no {cor(GRUPOS_AMBIENTE[2].cor, GRUPOS_AMBIENTE[2].nome)} e na {cor(GRUPOS_AMBIENTE[3].cor, GRUPOS_AMBIENTE[3].nome)}. As {cor(COR.cruClaro, 'licenças e o selo LWG')} são a condição para cada planta operar.
          </p>
          <p>
            Para fora do anel das etapas, o que cada uma solta: {cor('#5fa874', 'coprodutos')}, {cor('#cf6a4a', 'resíduos')} e {cor('#5daed2', 'efluentes')}, ligados ao destino. Os efluentes vão ao tratamento, no apoio.
          </p>
          <p>Pulsando, os pontos de atenção, explicados ao lado.</p>
          <div className="filtros-ambiente">
            {(['cadeia', 'sai'] as const).map((parte) => (
              <div key={parte} className="filtros-linha">
                <span className="filtros-titulo">{parte === 'cadeia' ? 'Na cadeia' : 'O que sai'}</span>
                {FILTROS_AMBIENTE.filter((f) => f.parte === parte).map((f) => {
                  const ligado = filtroAmb.has(f.chave)
                  const apagado = filtroAmb.size > 0 && !ligado
                  return (
                    <button key={f.chave} className={`filtro${ligado ? ' ligado' : ''}${apagado ? ' apagado' : ''}`} style={{ ['--cor' as string]: f.cor }} onClick={() => onFiltroAmb(f.chave)} aria-pressed={ligado}>
                      <i className={`filtro-${f.forma}`} aria-hidden />
                      {f.nome}
                    </button>
                  )
                })}
              </div>
            ))}
            {filtroAmb.size > 0 && (
              <button className="filtro-tudo" onClick={() => onFiltroAmb(null)}>
                mostrar tudo
              </button>
            )}
          </div>
        </>
      )}
      {lente === 'confianca' && (
        <p>
          Como cada elo está sustentado: {cor(COR.cruClaro, 'fato')} (documento ou dado), {cor(COR.tecnico, 'fato técnico')} (literatura) e {cor(COR.vermelho, 'indício')} (fora da narrativa, a confirmar).
        </p>
      )}
      <p className="historia-dica">Clique num ponto: o que depende dele fica {cor(COR.vermelho, 'vermelho')}, elo a elo, até os produtos.</p>
    </aside>
  )
}

/** Os níveis do cone e do diagrama do elo, amortecidos: um sai enquanto o outro entra. */
function Niveis({ aberto, vis }: { aberto: boolean; vis: React.RefObject<{ cone: number; elo: number }> }) {
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-3.2 * Math.min(dt, 0.05))
    vis.current.cone += ((aberto ? 0 : 1) - vis.current.cone) * k
    vis.current.elo += ((aberto ? 1 : 0) - vis.current.elo) * k
  })
  return null
}

/** O desenho do cone: anéis no chão com marcas de graduação, o eixo e seções tracejadas na altura. */
function Chao({ vis }: { vis: React.RefObject<{ cone: number; elo: number }> }) {
  const geo = useMemo(() => {
    const anel = (r: number, y: number, tracejado: boolean) => {
      const pts: THREE.Vector3[] = []
      const n = 120
      for (let k = 0; k < n; k += tracejado ? 2 : 1) {
        const a0 = (k / n) * Math.PI * 2
        const a1 = ((k + 1) / n) * Math.PI * 2
        pts.push(new THREE.Vector3(Math.cos(a0) * r, y, Math.sin(a0) * r), new THREE.Vector3(Math.cos(a1) * r, y, Math.sin(a1) * r))
      }
      return pts
    }
    const chao = [...anel(R * 1.08, -0.02, false), ...anel(R * 1.22, -0.02, true), ...anel(R * 0.55, -0.02, true)]
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2
      const r0 = R * 1.08
      const r1 = r0 + (k % 9 === 0 ? 0.14 : 0.06)
      chao.push(new THREE.Vector3(Math.cos(a) * r0, -0.02, Math.sin(a) * r0), new THREE.Vector3(Math.cos(a) * r1, -0.02, Math.sin(a) * r1))
    }
    const secoes = [0.25, 0.5, 0.75].flatMap((f) => anel(raioEm(f * H) * 1.08, f * H, true))
    const eixo = [new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0, H + 0.5, 0)]
    const g = (pts: THREE.Vector3[]) => new THREE.BufferGeometry().setFromPoints(pts)
    return { chao: g(chao), secoes: g(secoes), eixo: g(eixo) }
  }, [])
  const m = [useRef<THREE.LineBasicMaterial>(null!), useRef<THREE.LineBasicMaterial>(null!), useRef<THREE.LineBasicMaterial>(null!)]
  const t0 = useRef(performance.now())
  useFrame(() => {
    // o desenho entra primeiro, em 1 s
    const k = Math.min(1, (performance.now() - t0.current) / 1000) * vis.current.cone
    m[0].current.opacity = 0.3 * k
    m[1].current.opacity = 0.1 * k
    m[2].current.opacity = 0.14 * k
  })
  return (
    <>
      <lineSegments geometry={geo.chao} frustumCulled={false}>
        <lineBasicMaterial ref={m[0]} color={COR.cru} transparent opacity={0} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={geo.secoes} frustumCulled={false}>
        <lineBasicMaterial ref={m[1]} color={COR.cru} transparent opacity={0} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={geo.eixo} frustumCulled={false}>
        <lineBasicMaterial ref={m[2]} color={COR.cru} transparent opacity={0} depthWrite={false} />
      </lineSegments>
    </>
  )
}

/** O nome de cada altura, junto à silhueta esquerda do cone, enquanto a câmera gira. */
function Bandas({ rede }: { rede: Rede }) {
  const { camera } = useThree()
  const refs = useRef<(THREE.Group | null)[]>([])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const [ligado, setLigado] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setLigado(true), 1200)
    return () => window.clearTimeout(t)
  }, [])
  useFrame(() => {
    dir.setFromMatrixColumn(camera.matrixWorld, 0)
    dir.y = 0
    dir.normalize()
    rede.bandas.forEach(([, y], i) => {
      const r = raioEm(y) + 0.4
      refs.current[i]?.position.set(-dir.x * r, y, -dir.z * r)
    })
  })
  return (
    <>
      {rede.bandas.map(([nome], i) => (
        <group key={nome} ref={(g) => void (refs.current[i] = g)}>
          {ligado && (
            <Html zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
              <span className="cone-nivel">{nome}</span>
            </Html>
          )}
        </group>
      ))}
    </>
  )
}

/** O que depende de um elo escolhido (quais, e a quantos elos de distância) e de que ele é feito. */
type Queda = { de: string; conjunto: Set<string>; distancia: Map<string, number>; desde: number; acima: string[] }

function queda(rede: Rede, id: string): Queda {
  const distancia = new Map<string, number>([[id, 0]])
  let frente = [id]
  for (let k = 1; frente.length; k++) {
    const prox: string[] = []
    for (const x of frente) for (const u of rede.usuarios.get(x) ?? []) if (!distancia.has(u)) distancia.set(u, k), prox.push(u)
    frente = prox
  }
  // de que ele é feito: subindo pelas ligações até os recursos naturais, os mais próximos primeiro
  const precisa = new Map<string, string[]>()
  for (const [u, w] of rede.ligacoes) (precisa.get(w) ?? precisa.set(w, []).get(w)!).push(u)
  const acima: string[] = []
  const vistos = new Set<string>([id])
  for (let fila = [id]; fila.length; ) {
    const prox: string[] = []
    for (const x of fila) for (const u of precisa.get(x) ?? []) if (!vistos.has(u)) vistos.add(u), acima.push(u), prox.push(u)
    fila = prox
  }
  return { de: id, conjunto: new Set(distancia.keys()), distancia, desde: performance.now() / 1000, acima }
}

/** A curva de uma ligação: o ponto de controle, para fora do eixo do cone. */
function curva(a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3) {
  out.addVectors(a, b).multiplyScalar(0.5)
  const r = Math.hypot(out.x, out.z) || 1
  const k = 0.06 * a.distanceTo(b)
  out.x += (out.x / r) * k
  out.z += (out.z / r) * k
  return out
}

function Rede({ ctx, rede, lente, selecionado, onSelecionar, cartaoAberto, vis, aberto, onAbrir, filtroAmb }: PropsCone & { rede: Rede; vis: React.RefObject<{ cone: number; elo: number }>; aberto: boolean; onAbrir: (id: string) => void; filtroAmb: Set<string> }) {
  // na lente Ambiente, o elo está entre os destacados (nada destacado: todos estão)
  const valeAmb = (id: string) => {
    if (filtroAmb.size === 0) return true
    const k = chaveAmbiente(id, rede.saidas)
    return k !== null && filtroAmb.has(k)
  }
  const { ix } = ctx
  const no = (id: string) => ix.porId.get(id)
  const grupo = useRef<THREE.Group>(null!)
  const { ids, pos, ligacoes, indice } = rede
  const ehEtapa = useMemo(() => new Set(rede.etapas), [rede])
  const ehArtigo = useMemo(() => new Set(rede.artigos), [rede])
  const viposa = rede.viposa
  const ehSaida = (id: string) => rede.saidas.has(id)
  const atencao = useMemo(() => new Set(pontosDeAtencao().map((x) => x.id)), [])
  const alcance = useMemo(() => ids.map((id) => (id === viposa ? 1 : no(id)?.alcance_cadeia ?? 0)), [ids]) // eslint-disable-line react-hooks/exhaustive-deps
  const tamanhoDe = (i: number) => (ids[i] === viposa ? 22 : ehEtapa.has(ids[i]) ? 12 : ehArtigo.has(ids[i]) ? 10 : ehSaida(ids[i]) ? 8 : 4.5 + 46 * Math.sqrt(alcance[i]))
  // a queda começa quando o cone já está montado (ao chegar de outra aba com um elo escolhido)
  const montado = useRef(performance.now() / 1000)
  const acimaSel = useMemo(() => new Set(selecionado && indice.has(selecionado) ? queda(rede, selecionado).acima : []), [rede, selecionado, indice])
  const q = useMemo(() => {
    if (!selecionado || !indice.has(selecionado)) return null
    const x = queda(rede, selecionado)
    x.desde = Math.max(x.desde, montado.current + 1.4)
    return x
  }, [rede, selecionado, indice])

  const geoMarcas = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(ids.flatMap((id) => pos.get(id)!.toArray()), 3))
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(new Float32Array(ids.length * 4), 4))
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(new Float32Array(ids.length), 1))
    g.setAttribute('aFill', new THREE.Float32BufferAttribute(new Float32Array(ids.length), 1))
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(new Float32Array(ids.length), 1))
    g.computeBoundingSphere()
    return g
  }, [ids, pos])
  const geoLigacoes = useMemo(() => {
    const pts: number[] = []
    const meio = new THREE.Vector3()
    for (const [u, w] of [...ligacoes, ...rede.ligacoesAmb]) {
      const a = pos.get(u)!
      const b = pos.get(w)!
      curva(a, b, meio)
      for (let k = 0; k < SEG; k++)
        for (const f of [k / SEG, (k + 1) / SEG]) {
          const w0 = 1 - f
          pts.push(w0 * w0 * a.x + 2 * w0 * f * meio.x + f * f * b.x, w0 * w0 * a.y + 2 * w0 * f * meio.y + f * f * b.y, w0 * w0 * a.z + 2 * w0 * f * meio.z + f * f * b.z)
        }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(new Float32Array((pts.length / 3) * 4), 4))
    return g
  }, [ligacoes, pos, rede])
  const mMarca = useMemo(matMarca, [])
  const mLinha = useMemo(matLinha, [])
  const { gl, camera } = useThree()
  const c = useMemo(() => new THREE.Color(), [])
  const centro = useMemo(() => new THREE.Vector3(0, (H + 0.5) / 2, 0).add(EM), [])
  const t0 = useRef(performance.now() / 1000)
  const [ponteiro, setPonteiro] = useState<number | null>(null)
  // o que cada elo mostra agora, amortecido: cor, alfa, tamanho, disco, brilho
  const atual = useRef<Float32Array | null>(null)
  // a lente Ambiente entra e sai devagar (as saídas e as suas ligações)
  const amb = useRef(0)

  // a cor de cada elo na lente
  const naLente = useMemo(
    () =>
      ids.map((id) => {
        const n = no(id)
        const etapa = ehEtapa.has(id)
        if (ehSaida(id)) return { cor: new THREE.Color(COR_SAIDA[rede.saidas.get(id)!.tipo]), alfa: lente === 'ambiente' && valeAmb(id) ? 0.95 : 0, disco: rede.saidas.get(id)!.tipo === 'efluente' ? 0 : 0.9 }
        if (id === viposa) return { cor: C.conhaque, alfa: 1, disco: 1 }
        if (lente === 'ambiente') {
          const destacado = filtroAmb.size > 0 && valeAmb(id)
          if (filtroAmb.size > 0 && !destacado) return { cor: C.tinta, alfa: etapa ? 0.25 : 0.07, disco: 0.2 }
          if (id === LICENCAS) return { cor: C.branco, alfa: 1, disco: 1 }
          const g = grupoAmbiente(id)
          if (g) return { cor: new THREE.Color(g.cor), alfa: 1, disco: 0.75 }
          if (etapa) return { cor: C.tinta, alfa: 0.5, disco: 0.2 }
          return { cor: C.tinta, alfa: 0.12, disco: 0.3 }
        }
        if (lente === 'estrutura') {
          if (etapa) return { cor: C.conhaque, alfa: 0.95, disco: 0.35 }
          if (ehArtigo.has(id)) return { cor: C.tinta, alfa: 0.85, disco: 1 }
          const s = n && setorDe(n)
          const a = alcance[indice.get(id)!]
          if (s && a >= DESTAQUE) return { cor: new THREE.Color(s.cor), alfa: 1, disco: 0.75 }
          return { cor: C.tinta, alfa: (0.28 + 0.6 * Math.sqrt(a)) * 0.5, disco: Math.min(1, a * 3) }
        }
        if (etapa || ehArtigo.has(id)) return { cor: C.tinta, alfa: 0.6, disco: 0.2 }
        const ap = aparencia(n!, lente)
        return { cor: new THREE.Color(ap.cor), alfa: ap.opacidade, disco: ap.cheio ? 0.85 : 0 }
      }),
    [ids, lente, alcance, filtroAmb], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useFrame((_, dt) => {
    const agora = performance.now() / 1000
    mMarca.uniforms.uScale.value = gl.getPixelRatio()
    const dist = camera.position.distanceTo(centro)
    mMarca.uniforms.uRef.value = dist
    mMarca.uniforms.uDepth.value.set(dist - 3, dist + 3.5)
    mLinha.uniforms.uDepth.value.set(dist - 3, dist + 3.5)
    // o cone se monta ao abrir: as marcas sobem para o lugar, o chão primeiro
    const sobe = THREE.MathUtils.clamp((agora - t0.current) / 1.6, 0, 1)
    const k = 1 - Math.exp(-8 * Math.min(dt, 0.05))
    amb.current += ((lente === 'ambiente' ? 1 : 0) - amb.current) * (1 - Math.exp(-3 * Math.min(dt, 0.05)))
    if (!atual.current) atual.current = new Float32Array(ids.length * 7)
    const at = atual.current
    const ca = geoMarcas.getAttribute('aColor') as THREE.BufferAttribute
    const cs = geoMarcas.getAttribute('aSize') as THREE.BufferAttribute
    const cf = geoMarcas.getAttribute('aFill') as THREE.BufferAttribute
    const cg = geoMarcas.getAttribute('aGlow') as THREE.BufferAttribute
    const aceso = new Float32Array(ids.length).fill(-1)
    const apontado = ponteiro !== null ? ids[ponteiro] : null
    ids.forEach((id, i) => {
      const base = naLente[i]
      c.copy(base.cor)
      let alfa = base.alfa
      let tam = tamanhoDe(i)
      let disco = base.disco
      let brilho = 0
      // o que depende do escolhido: vermelho quando a frente chega; o escolhido em branco
      if (q?.conjunto.has(id)) {
        const quando = q.desde + (q.distancia.get(id) ?? 0) * PASSO
        if (agora >= quando) {
          aceso[i] = quando
          const flash = Math.exp(-(agora - quando) / 0.3)
          if (id === q.de) {
            c.copy(C.branco)
            disco = 1
            brilho = 0.9
            tam = Math.max(tam, 14) * 1.2
          } else {
            c.copy(C.vermelho).lerp(C.branco, flash * 0.5)
            disco = Math.max(disco, 0.85)
            brilho = 0.6 * flash
            tam *= 1 + 0.4 * flash
          }
          alfa = 1
        }
      } else if (q && acimaSel.has(id)) {
        // de que o escolhido é feito: aceso em tinta, sem a cor da lente
        c.copy(C.tinta)
        alfa = Math.max(alfa, 0.85)
        disco = Math.max(disco, 0.5)
      } else if (q) alfa *= 0.35
      // os pontos de atenção da lente Ambiente pulsam
      if (lente === 'ambiente' && !q && atencao.has(id) && valeAmb(id)) (brilho = 0.45 + 0.3 * Math.sin(agora * 2.2 + i)), (tam = Math.max(tam, 10) * 1.2), (alfa = 1)
      if (id === apontado) (brilho = 1), (tam = Math.max(tam, 12) * 1.25), (alfa = 1)
      const p = pos.get(id)!
      const r = THREE.MathUtils.clamp(sobe * 1.4 - (p.y / (H + 0.5)) * 0.4, 0, 1)
      // amortecido: troca de lente sem salto
      const o = i * 7
      at[o] += (c.r - at[o]) * k
      at[o + 1] += (c.g - at[o + 1]) * k
      at[o + 2] += (c.b - at[o + 2]) * k
      at[o + 3] += (alfa * r - at[o + 3]) * k
      at[o + 4] += (tam * (0.4 + 0.6 * r) - at[o + 4]) * k
      at[o + 5] += (disco - at[o + 5]) * k
      at[o + 6] += (brilho - at[o + 6]) * k
      ca.setXYZW(i, at[o], at[o + 1], at[o + 2], at[o + 3] * vis.current.cone)
      cs.setX(i, at[o + 4])
      cf.setX(i, at[o + 5])
      cg.setX(i, at[o + 6])
    })
    ca.needsUpdate = cs.needsUpdate = cf.needsUpdate = cg.needsUpdate = true

    // ligações: apagadas; o caminho do couro, entre as etapas, em conhaque; vermelhas atrás da frente da queda
    const la = geoLigacoes.getAttribute('aColor') as THREE.BufferAttribute
    ligacoes.forEach(([u, w], e) => {
      const iu = indice.get(u)!
      const iw = indice.get(w)!
      const tu = aceso[iu]
      const tw = aceso[iw]
      const vivo = tu >= 0 && tw >= 0
      const f0 = vivo ? (agora - tu) / Math.max(PASSO, tw - tu) : -1
      const couro = ehEtapa.has(u) && ehEtapa.has(w)
      let base = couro ? 0.6 - 0.35 * amb.current : 0.045
      let cor = couro ? C.conhaque : C.tinta
      if (u === apontado || w === apontado) (base = 0.55), (cor = C.ouro)
      if (q && !couro) base *= 0.6
      // as ligações de que o escolhido é feito, em tinta
      const subida = q && (acimaSel.has(u) || u === q.de) && (acimaSel.has(w) || w === q.de)
      if (subida) (base = 0.4), (cor = C.tinta)
      for (let s = 0; s < SEG; s++) {
        const f = (s + 0.5) / SEG
        let a = base
        c.copy(cor)
        if (vivo && f0 >= f) {
          c.copy(C.vermelho)
          a = 0.35 + (f0 < f + 0.4 ? 0.45 : 0)
        }
        la.setXYZW(e * SEG * 2 + s * 2, c.r, c.g, c.b, a * sobe * vis.current.cone)
        la.setXYZW(e * SEG * 2 + s * 2 + 1, c.r, c.g, c.b, a * sobe * vis.current.cone)
      }
    })
    // as ligações das saídas: na cor da saída, só na lente Ambiente
    rede.ligacoesAmb.forEach(([u, w], j) => {
      const e = ligacoes.length + j
      const sd = rede.saidas.get(ehSaida(w) ? w : u)!
      c.set(COR_SAIDA[sd.tipo])
      const a = (u === apontado || w === apontado ? 0.8 : 0.4) * amb.current * sobe * (q ? 0.4 : 1) * (valeAmb(sd.id) ? 1 : 0)
      for (let s = 0; s < SEG * 2; s++) la.setXYZW(e * SEG * 2 + s, c.r, c.g, c.b, a * vis.current.cone)
    })
    la.needsUpdate = true
  })

  const maisPerto = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (aberto) return null
    let melhor: number | null = null
    let d0 = Infinity
    for (const h of e.intersections) {
      if (h.object !== e.object || h.index === undefined) continue
      // as saídas só existem na lente Ambiente
      if ((lente !== 'ambiente' || !valeAmb(ids[h.index])) && ehSaida(ids[h.index])) continue
      const alc = 0.04 + 0.0022 * tamanhoDe(h.index)
      const d = (h.distanceToRay ?? 1) / alc
      if (d < 1 && d < d0) (d0 = d), (melhor = h.index)
    }
    return melhor
  }

  return (
    <group ref={grupo}>
      <lineSegments geometry={geoLigacoes} material={mLinha} frustumCulled={false} />
      <points
        geometry={geoMarcas}
        material={mMarca}
        frustumCulled={false}
        onPointerMove={(e) => {
          e.stopPropagation()
          const i = maisPerto(e)
          setPonteiro(i)
          document.body.style.cursor = i !== null ? 'pointer' : ''
        }}
        onPointerOut={() => {
          setPonteiro(null)
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          if (e.delta > 4) return
          const i = maisPerto(e)
          if (i === null) return
          e.stopPropagation()
          // uma saída não tem ficha: o rótulo dela basta
          if (ehSaida(ids[i])) return
          onSelecionar(ids[i] === selecionado || ids[i] === viposa ? null : ids[i])
        }}
      />
      {!aberto && <Rotulos ctx={ctx} rede={rede} lente={lente} q={q} apontado={ponteiro !== null ? ids[ponteiro] : null} selecionado={selecionado} onSelecionar={onSelecionar} cartaoAberto={cartaoAberto} onAbrir={onAbrir} filtroAmb={filtroAmb} />}
    </group>
  )
}

// ---------------------------------------------------------------- rótulos

const CURTO: Record<string, string> = {
  'sis.recurtimento': 'Recurtimento',
  'sis.manufatura': 'Cabedais e calçados',
  'sis.utilidades': 'Água e efluente',
  'sis.transporte': 'Transporte',
  'sis.classificacao': 'Classificação',
}
const ufs = (planta?: string) => [...new Set((planta ?? '').match(/\b(MT|MS|SC|PR|SP|RS)\b/g) ?? [])].join('·')

/**
 * Nomes na rede, nos termos da lente. O elo escolhido ganha o rótulo grande (alcance, o que depende dele, os
 * produtos que deixariam de sair); os mais importantes do que depende dele recebem nome. O elo sob o ponteiro tem
 * sempre nome. Nomes que se cobririam ficam de fora.
 */
function Rotulos({ ctx, rede, lente, q, apontado, selecionado, onSelecionar, cartaoAberto, onAbrir, filtroAmb }: { ctx: Contexto; rede: Rede; lente: Lente; q: Queda | null; apontado: string | null; selecionado: string | null; onSelecionar: (id: string | null) => void; cartaoAberto: boolean; onAbrir: (id: string) => void; filtroAmb: Set<string> }) {
  const { ix } = ctx
  const no = (id: string) => ix.porId.get(id)
  const { camera, size } = useThree()
  const grupo = useRef<THREE.Group>(null!)
  const [mostra, setMostra] = useState<string[]>([])
  const virados = useRef(new Set<string>())
  const ultimo = useRef(0)
  const t0 = useRef(performance.now())
  const p = useMemo(() => new THREE.Vector3(), [])
  const viposa = rede.viposa
  const ehEtapa = useMemo(() => new Set(rede.etapas), [rede])
  const ehArtigo = useMemo(() => new Set(rede.artigos), [rede])
  const porAlcance = useMemo(() => rede.ids.filter((id) => !ehEtapa.has(id) && !ehArtigo.has(id) && id !== viposa && !rede.saidas.has(id)).sort((a, b) => (no(b)?.alcance_cadeia ?? 0) - (no(a)?.alcance_cadeia ?? 0)), [rede]) // eslint-disable-line react-hooks/exhaustive-deps
  const daLente = useMemo(() => {
    const ofertas = porAlcance.map((id) => no(id)!)
    if (lente === 'estrutura') return [...rede.etapas, ...ofertas.filter((n) => (n.alcance_cadeia ?? 0) >= DESTAQUE && setorDe(n)).map((n) => n.id)]
    if (lente === 'importado') return ofertas.filter((n) => n.comercio).sort((a, b) => (b.comercio!.musd_2025 ?? 0) - (a.comercio!.musd_2025 ?? 0)).slice(0, 12).map((n) => n.id)
    if (lente === 'ormuz') return ofertas.filter((n) => (parteGolfo(n) ?? 0) >= 0.05).sort((a, b) => (parteGolfo(b) ?? 0) - (parteGolfo(a) ?? 0)).map((n) => n.id)
    if (lente === 'ambiente') {
      // nada destacado: os pontos de atenção e as saídas principais; com destaque, tudo o que está destacado
      if (filtroAmb.size === 0) return [...pontosDeAtencao().map((x) => x.id), 'rec.eucalipto', 'sis.utilidades', 'efl.cromo', 'res.serragem', 'res.lodo', 'res.carnaca', 'efl.tratado'].filter((id) => rede.pos.has(id))
      const atencao = new Set(pontosDeAtencao().map((x) => x.id))
      return rede.ids
        .filter((id) => {
          const k = chaveAmbiente(id, rede.saidas)
          return k !== null && filtroAmb.has(k)
        })
        .sort((a, b) => Number(atencao.has(b)) - Number(atencao.has(a)) || (no(b)?.alcance_cadeia ?? 0) - (no(a)?.alcance_cadeia ?? 0))
    }
    if (lente === 'china') return ofertas.filter((n) => (n.comercio?.china_2025 ?? 0) >= 0.3).map((n) => n.id)
    return ofertas.filter((n) => n.confianca === 'indício').map((n) => n.id)
  }, [lente, porAlcance, rede, filtroAmb]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const agora = performance.now()
    if (agora - ultimo.current < 160) return
    ultimo.current = agora
    let quer: string[]
    if (q) {
      const chegou = (id: string) => agora / 1000 >= q.desde + (q.distancia.get(id) ?? 0) * PASSO
      const produtos = rede.artigos.filter((id) => q.conjunto.has(id) && chegou(id))
      const outros = porAlcance.filter((id) => q.conjunto.has(id) && id !== q.de && chegou(id)).slice(0, 7)
      quer = [q.de, viposa, ...produtos, ...q.acima.slice(0, 3), ...outros]
    } else quer = [viposa, ...daLente]
    if (apontado) quer = [apontado, ...quer]
    if (agora - t0.current < 1400) quer = apontado ? [apontado] : []
    // o que não pode ser coberto: a coluna da lente à esquerda, a ficha à direita
    const caixas: [number, number, number, number][] = [
      [0, 0, 380, size.height],
      [size.width - (cartaoAberto ? 460 : 40), 0, size.width, size.height],
      [0, 0, size.width, 70],
    ]
    const fica: string[] = []
    for (const id of quer.filter((x, i, todos) => todos.indexOf(x) === i)) {
      p.copy(rede.pos.get(id)!).applyMatrix4(grupo.current.matrixWorld).project(camera)
      if (p.z > 1) continue
      const x = ((p.x + 1) / 2) * size.width + 12
      const y = ((1 - p.y) / 2) * size.height
      const grande = id === q?.de
      const nome = rotuloDe(id)
      // nome a 9,5 px e valor ao lado (o destino de uma saída é longo)
      const w = grande ? Math.max(nome.length * 10, 320) : nome.length * 6.2 + (valorDe(id)?.length ?? 0) * 6.4 + 34
      const virar = x + w > size.width - (cartaoAberto ? 460 : 30)
      const x0 = virar ? x - w - 24 : x
      // o rótulo grande tem nome, número e até duas linhas de nota de 300 px
      const b: [number, number, number, number] = [x0, y - (grande ? 34 : 9), x0 + w, y + (grande ? 100 : 9)]
      if (id !== apontado && caixas.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue
      caixas.push(b)
      fica.push(id)
      if (virar) virados.current.add(id)
      else virados.current.delete(id)
    }
    if (fica.join() !== mostra.join()) setMostra(fica)
  })

  const rotuloDe = (id: string) => {
    if (id === viposa) return 'Couro Viposa'
    if (rede.saidas.has(id)) return rede.saidas.get(id)!.nome
    const n = no(id)
    if (!n) return id
    if (ehEtapa.has(id)) return `${CURTO[id] ?? n.nome} ${ufs(n.planta)}`.trim()
    return n.nome
  }
  const valorDe = (id: string): string | null => {
    const n = no(id)
    if (id === viposa) {
      if (!q) return null
      const k = rede.artigos.filter((a) => q.conjunto.has(a)).length
      return `${k} de ${rede.artigos.length} produtos`
    }
    if (rede.saidas.has(id)) return `→ ${rede.saidas.get(id)!.destino}`
    if (!n || ehArtigo.has(id)) return null
    if (q) return pct(n.alcance_cadeia)
    if (lente === 'ambiente') return VALOR_AMBIENTE[id] ?? (ehEtapa.has(id) ? null : pct(n.alcance_cadeia))
    if (lente === 'importado' && n.comercio) return musd(n.comercio.musd_2025)
    if (lente === 'ormuz' && n.comercio) return `Golfo ${pct(parteGolfo(n))}`
    if (lente === 'china' && n.comercio) return `China ${pct(n.comercio.china_2025)}`
    if (lente === 'confianca') return n.confianca
    if (ehEtapa.has(id)) return null
    return pct(n.alcance_cadeia)
  }

  return (
    <group ref={grupo}>
      {mostra.map((id) => {
        const grande = id === q?.de
        const valor = valorDe(id)
        const dependentes = q && grande ? [...q.conjunto].filter((x) => x !== id && x !== viposa).length : 0
        const produtos = q && grande ? rede.artigos.filter((a) => q.conjunto.has(a)).map((a) => no(a)?.nome ?? a) : []
        const cls = ['cone-rotulo', virados.current.has(id) && 'virado', grande && 'grande', id === viposa && 'raiz', ehEtapa.has(id) && lente !== 'ambiente' && 'etapa', rede.saidas.has(id) && 'saida', q?.conjunto.has(id) && !grande && 'depende', id === apontado && 'apontado'].filter(Boolean).join(' ')
        return (
          <Html key={id} position={rede.pos.get(id)} zIndexRange={[8, 0]}>
            <span className={cls} onClick={() => id !== viposa && !rede.saidas.has(id) && onSelecionar(id === selecionado ? null : id)}>
              {rotuloDe(id)}
              {valor && <b>{valor}</b>}
              {grande && (
                <em>
                  {dependentes} elos dependem dele · {produtos.length} de {rede.artigos.length} produtos vendidos
                </em>
              )}
              {grande && produtos.length > 0 && <em>{produtos.join(', ')}</em>}
              {grande && q && q.acima.length > 0 && (
                <em className="vem-de">
                  vem de {q.acima.slice(0, 4).map((a) => no(a)?.nome ?? a).join(', ')}
                  {q.acima.length > 4 ? ` e mais ${q.acima.length - 4}` : ''}
                </em>
              )}
              {grande && (
                <button
                  className="cone-abrir"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAbrir(id)
                  }}
                >
                  ver na cadeia <span aria-hidden>→</span>
                </button>
              )}
            </span>
          </Html>
        )
      })}
    </group>
  )
}

// ---------------------------------------------------------------- câmera

/**
 * A câmera: um enquadramento por lente, o cone girando devagar depois de assentar. O centro óptico fica no meio da
 * área livre (entre a coluna da lente e a ficha). Pegar os controles para o giro até a próxima lente.
 */
function Diretor({ lente, selecionado, cartaoAberto, chegada, aberto }: { lente: Lente; selecionado: string | null; cartaoAberto: boolean; chegada: THREE.Vector3 | null; aberto: string | null }) {
  const controls = useThree((s) => s.controls) as unknown as CameraControls | null
  const { camera, size } = useThree()
  const pego = useRef(false)
  const batida = useRef('')
  const desde = useRef(performance.now())
  useEffect(() => {
    if (!controls) return
    const pegar = () => (pego.current = true)
    controls.addEventListener('controlstart', pegar)
    return () => controls.removeEventListener('controlstart', pegar)
  }, [controls])
  useFrame((_, dt) => {
    if (!controls) return
    const cam = camera as THREE.PerspectiveCamera
    // a área livre: a coluna da lente à esquerda, a ficha (ou a lista da lente) à direita
    const esq = 380
    const dir = cartaoAberto ? 460 : 40
    const topo = 70
    const base = 70
    cam.setViewOffset(size.width, size.height, (dir - esq) / 2, (base - topo) / 2, size.width, size.height)
    const proxima = `${lente}|${cartaoAberto}|${size.width}x${size.height}|${aberto ? 'elo' : 'cone'}`
    if (proxima !== batida.current) {
      batida.current = proxima
      pego.current = false
      desde.current = performance.now()
      const meiaV0 = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)
      const livreW0 = (size.width - esq - dir) / size.width
      const livreH0 = (size.height - topo - base) / size.height
      if (aberto) {
        // o diagrama, de frente, inteiro na área livre
        const { x0, x1, y0, y1 } = CAIXA_ELO
        const cx = (x0 + x1) / 2
        const cy = (y0 + y1) / 2
        const dist = Math.max((x1 - x0) / 2 / (meiaV0 * (size.width / size.height) * livreW0), (y1 - y0) / 2 / (meiaV0 * livreH0)) * 1.04
        void controls.setLookAt(cx, cy, dist, cx, cy, 0, true)
        return
      }
      // de um pouco acima, de frente para o anel das etapas
      const d = lente === 'estrutura' ? new THREE.Vector3(0.1, 0.3, 1) : new THREE.Vector3(-0.2, 0.36, 1)
      // chegando com um elo escolhido, a câmera fica do lado dele, para ele estar à frente do cone
      if (chegada && Math.hypot(chegada.x, chegada.z) > 0.05) {
        const h = Math.hypot(d.x, d.z)
        const az = Math.atan2(chegada.x, chegada.z)
        d.set(Math.sin(az) * h, d.y, Math.cos(az) * h)
      }
      d.normalize()
      const raio = Math.hypot(R * 1.22, (H + 0.6) / 2)
      const meiaV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)
      const livreW = (size.width - esq - dir) / size.width
      const livreH = (size.height - topo - base) / size.height
      const meia = Math.min(meiaV * livreH, meiaV * (size.width / size.height) * livreW)
      const dist = (raio / meia) * 0.8
      void controls.setLookAt(d.x * dist, d.y * dist, d.z * dist, 0, 0, 0, true)
    }
    // o cone gira devagar depois de assentar, se ninguém pegou os controles e nada está escolhido
    if (!aberto && !pego.current && !selecionado && performance.now() - desde.current > 2500) void controls.rotate(dt * 0.03, 0, false)
  })
  return null
}
