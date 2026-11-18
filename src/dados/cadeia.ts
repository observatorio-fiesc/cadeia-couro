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

export async function carregarCadeia(): Promise<Cadeia> {
  const r = await fetch('./data/cadeia.json')
  if (!r.ok) throw new Error('cadeia.json não encontrado')
  return r.json()
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
