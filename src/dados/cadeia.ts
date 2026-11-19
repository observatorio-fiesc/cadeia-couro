// Tipos e leitura de painel/public/data/cadeia.json (gerado por scripts/montar_cadeia.py)

export type Comercio = {
  codigos: string[]
  janela: string
  musd_2025: number
  musd_2026: number
  kt_2025: number
  kt_2026: number
  ormuz_2025: number | null
  oma_2025: number | null
  ormuz_2026: number | null
  oma_2026: number | null
  china_2025: number | null
  china_2026: number | null
  var_kg_total: number | null
  var_kg_ormuz: number | null
  var_preco: number | null
  origens_2025: [string, number][]
  origens_2026: [string, number][]
}

export type Lado = 'oferta' | 'nucleo' | 'demanda'

export type No = {
  id: string
  nome: string
  lado: Lado
  camada: number
  tipo: string
  tronco: string
  planta?: string
  sh6?: string[]
  ncm?: string[]
  sh4?: string[]
  descricao?: string
  gargalo?: string
  confianca: string
  fontes: string[]
  insumos: string[]
  alcance_cadeia?: number
  alcance_artigos?: number
  alcance_exportacao?: number
  jusante?: number
  comercio?: Comercio
  exportacao_musd?: Record<string, number>
  iso3?: string
}

export type Aresta = {
  de: string
  para: string
  tipo: string
  essencial: boolean
  confianca: string
  valor_usd: number | null
}

export type Meta = {
  titulo: string
  camadas: Record<string, Record<string, string>>
  troncos: Record<string, string>
  fontes: Record<string, string>
  artigos: string[]
  ano_destinos: string
  base_alcance_cadeia: number
  ressalvas_exportacao: string[]
}

export type Cadeia = { meta: Meta; nos: No[]; arestas: Aresta[] }

export type Indice = {
  porId: Map<string, No>
  insumosDe: Map<string, number[]> // id -> índices das arestas que chegam ao nó
  dependentesDe: Map<string, number[]> // id -> índices das arestas que saem do nó
}

export type Extra = {
  fontes: Record<string, string>
  nos: (No & { insumos_indicio?: string[] })[]
  arestas: Aresta[]
  /** nós de cadeia.json com outro nome ou descrição (um nó dividido em dois fica com o nome da sua parte) */
  alterar?: { id: string; nome?: string; descricao?: string }[]
  /** arestas de cadeia.json que deixam de valer */
  remover_arestas?: { de: string; para: string; motivo?: string }[]
}

export async function carregarCadeia(): Promise<Cadeia> {
  const r = await fetch('./data/cadeia.json')
  if (!r.ok) throw new Error('cadeia.json não encontrado')
  const c: Cadeia = await r.json()
  // acréscimos que ainda não estão no gerador (public/data/cadeia-extra.json); sem o arquivo, a cadeia fica como veio
  const e = await fetch('./data/cadeia-extra.json').then((x) => (x.ok ? (x.json() as Promise<Extra>) : null), () => null)
  if (e) juntar(c, e)
  return c
}

/**
 * Junta os acréscimos e as correções à cadeia: nós novos, nós renomeados, arestas novas e arestas que deixam
 * de valer. Os alcances são refeitos depois, quando o mapa do processo já foi aplicado (contexto.ts).
 */
export function juntar(c: Cadeia, e: Extra) {
  Object.assign(c.meta.fontes, e.fontes)
  const ids = new Set(c.nos.map((n) => n.id))
  for (const n of e.nos) if (!ids.has(n.id)) c.nos.push(n)
  const porId = new Map(c.nos.map((n) => [n.id, n as No & { insumos_indicio?: string[] }]))
  for (const m of e.alterar ?? []) {
    const n = porId.get(m.id)
    if (!n) continue
    if (m.nome) n.nome = m.nome
    if (m.descricao) n.descricao = m.descricao
  }
  for (const r of e.remover_arestas ?? []) {
    c.arestas = c.arestas.filter((a) => !(a.de === r.de && a.para === r.para))
    const alvo = porId.get(r.para)
    if (alvo) alvo.insumos = alvo.insumos.filter((x) => x !== r.de)
  }
  for (const a of e.arestas) {
    if (!porId.has(a.de) || !porId.has(a.para)) continue
    if (c.arestas.some((x) => x.de === a.de && x.para === a.para)) continue
    c.arestas.push(a)
    // o nó de destino lista o que consome, como no gerador: os indícios à parte
    const alvo = porId.get(a.para)!
    const lista = a.confianca === 'indício' ? (alvo.insumos_indicio ??= []) : alvo.insumos
    if (!lista.includes(a.de)) lista.push(a.de)
  }
}

/**
 * Refaz os alcances como o gerador os calcula (conferido contra os valores dele: os 101 nós de oferta batem).
 * O universo são as etapas, insumos e materiais (camadas 1 a 3 da oferta) e os artigos; a base do alcance é
 * esse universo menos o próprio elo.
 */
export function recalcularAlcances(c: Cadeia) {
  const porId = new Map(c.nos.map((n) => [n.id, n]))
  const conta = (n: No) => (n.lado === 'oferta' ? n.camada >= 1 && n.camada <= 3 : n.lado === 'demanda' && n.camada === 1)
  const base = c.nos.filter(conta).length - 1
  const dep = new Map<string, string[]>()
  for (const a of c.arestas) if (a.tipo !== 'visual') (dep.get(a.de) ?? dep.set(a.de, []).get(a.de)!).push(a.para)
  const ano = '2025'
  const exp = (id: string) => porId.get(id)?.exportacao_musd?.[ano] ?? 0
  const totalExp = c.meta.artigos.reduce((t, a) => t + exp(a), 0) || 1
  for (const n of c.nos) {
    if (n.lado !== 'oferta') continue
    const vistos = new Set<string>()
    const fila = [n.id]
    while (fila.length) {
      for (const w of dep.get(fila.shift()!) ?? []) {
        if (vistos.has(w)) continue
        vistos.add(w)
        fila.push(w)
      }
    }
    const artigos = c.meta.artigos.filter((a) => vistos.has(a))
    n.jusante = [...vistos].filter((x) => porId.has(x) && conta(porId.get(x)!)).length
    n.alcance_cadeia = n.jusante / base
    n.alcance_artigos = artigos.length / c.meta.artigos.length
    n.alcance_exportacao = artigos.reduce((t, a) => t + exp(a), 0) / totalExp
  }
  c.meta.base_alcance_cadeia = base
}

export function indexar(c: Cadeia): Indice {
  const porId = new Map(c.nos.map((n) => [n.id, n]))
  const insumosDe = new Map<string, number[]>()
  const dependentesDe = new Map<string, number[]>()
  c.arestas.forEach((a, i) => {
    if (!insumosDe.has(a.para)) insumosDe.set(a.para, [])
    insumosDe.get(a.para)!.push(i)
    if (!dependentesDe.has(a.de)) dependentesDe.set(a.de, [])
    dependentesDe.get(a.de)!.push(i)
  })
  return { porId, insumosDe, dependentesDe }
}

// Caminho completo de um nó: tudo de que ele depende (montante) e tudo o que depende dele (jusante).
// As arestas "visual" (etapas -> núcleo) entram só no desenho, não na propagação.
export function caminho(c: Cadeia, ix: Indice, id: string) {
  const nos = new Set<string>([id])
  const arestas = new Set<number>()
  const andar = (inicio: string, mapa: Map<string, number[]>, lado: 'de' | 'para') => {
    const fila = [inicio]
    const vistos = new Set<string>([inicio])
    while (fila.length) {
      const v = fila.shift()!
      for (const i of mapa.get(v) ?? []) {
        const a = c.arestas[i]
        if (a.tipo === 'visual') continue
        arestas.add(i)
        const w = a[lado]
        nos.add(w)
        if (!vistos.has(w)) {
          vistos.add(w)
          fila.push(w)
        }
      }
    }
  }
  andar(id, ix.insumosDe, 'de')
  andar(id, ix.dependentesDe, 'para')
  return { nos, arestas }
}
