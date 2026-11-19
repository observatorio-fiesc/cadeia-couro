// Os arquivos da aba Mercado externo, carregados uma vez, quando a aba abre:
// - externo.json: o comércio do Brasil por país, produto e ano (scripts/preparar_externo.py, Comex Stat);
// - couro-mundo.json: quem exporta cada produto no mundo e para onde (scripts/baixar_comtrade.py, UN Comtrade);
// - geo/mundo50.json: o mapa-múndi 1:50m (scripts/preparar_mundo50.py);
// - abate.json e logistica.json: o abate do IBGE e as plantas, os portos e as rotas da Viposa.
// O detalhe 1:10m dos zooms (geo/detalhes.json) só é lido quando um zoom pede.

export type Estagio = 'cru' | 'wb' | 'crust' | 'acab' | 'outros' | 'cab' | 'calc' | 'art'
export type Insumo = {
  nome: string
  codigos: string[]
  uso: 'curtume' | 'boi'
  usd: number
  kg: number
  /** parcela da União Europeia no valor */
  ue: number
  /** [ISO3, US$ FOB, kg], do maior para o menor */
  origens: [string, number, number][]
}
export type ItemOrmuz = {
  id: string
  nome: string
  /** insumo-base que o fornecedor compra no Golfo: enxofre, metanol; nenhum para o que se compra direto */
  base: string | null
  musd: number
  dentro: number
  oma: number
  direta: number
  indireta: number
  /** [ISO3, parcela no Brasil, parcela do Golfo nas compras do insumo-base do fornecedor] */
  fornecedores: [string, number, number | null][]
}
type Serie = (number | null)[]
export type Externo = {
  fonte: string
  anos: number[]
  /** exportações em US$ mil FOB, por país, estágio e ano */
  exp: Record<string, Partial<Record<Estagio, number[]>>>
  /** exportações em toneladas, por país, estágio e ano */
  t: Record<string, Partial<Record<Estagio, number[]>>>
  /** preço médio de exportação de cada estágio, US$/kg, por ano */
  preco: Record<Estagio, Serie>
  kg25: Record<string, Partial<Record<Estagio, number>>>
  /** os meses das séries mensais, 'AAAA-MM', de jan/2015 ao último publicado */
  meses: string[]
  precoMes: Record<Estagio, Serie>
  precoImpMes: Record<string, Serie>
  imp: Record<string, Insumo>
  /** importações em US$ mil, por insumo, origem e ano */
  impAno: Record<string, Record<string, number[]>>
  /** carne bovina exportada (0201 e 0202), US$ mi e mil t por ano */
  carne: Record<'CHN' | 'HKG' | 'mundo', { musd: number[]; mil_t: number[] }>
  ormuz: { nota: string; itens: ItemOrmuz[] }
}
export type ProdutoMundo = {
  hs: string[]
  total: Serie
  /** [ISO3, US$ mi por ano], os maiores exportadores e o Brasil */
  exportadores: [string, Serie][]
  /** [de, para, US$ mi por ano] */
  fluxos: [string, string, Serie][]
}
export type CouroMundo = {
  fonte: string
  consultado: string
  anos: number[]
  produtos: Record<Estagio, ProdutoMundo>
  importadores: Record<string, { mundo: Serie; brasil: Serie }>
}
export type Pais = { iso3: string; nome: string; rot: [number, number]; poligonos: number[][][] }
export type Mundo = { fonte: string; paises: Pais[]; costas: number[][]; fronteiras: number[][] }
export type Logistica = {
  plantas: { id: string; nome: string; uf: string; lat: number; lon: number; etapas: string[] }[]
  portos: { id: string; nome: string; uf: string; lat: number; lon: number }[]
  rotas: { id: string; de: string; para: string; tipo: string; km: number; horas: number; coords: [number, number][] }[]
}
export type Janela = {
  lon: [number, number]
  lat: [number, number]
  costas: number[][]
  fronteiras: number[][]
  ferrovias: number[][]
  estradas: number[][]
  /** [nome, lon, lat, escala do Natural Earth] */
  portos: [string, number, number, number][]
  /** [nome, lon, lat, população] */
  cidades: [string, number, number, number][]
}
export type Detalhes = { fonte: string; janelas: Record<string, Janela> }

export type DadosExterno = Externo & {
  mundo: Mundo
  porIso: Map<string, Pais>
  /** abate de bovinos no Brasil, milhões de cabeças por ano (IBGE, tabela 1092), alinhado a `anos` */
  abate: number[]
  log: Logistica
  /** null enquanto o arquivo do Comtrade não existe */
  couroMundo: CouroMundo | null
}

type Abate = { series: Record<string, Record<string, Record<string, number | null>>> }

let pendente: Promise<DadosExterno> | null = null
export function carregarExterno(): Promise<DadosExterno> {
  pendente ??= Promise.all([
    fetch('./data/externo.json').then((r) => r.json() as Promise<Externo>),
    fetch('./data/geo/mundo50.json').then((r) => r.json() as Promise<Mundo>),
    fetch('./data/abate.json').then((r) => r.json() as Promise<Abate>),
    fetch('./data/logistica.json').then((r) => r.json() as Promise<Logistica>),
    fetch('./data/couro-mundo.json')
      .then((r) => (r.ok ? (r.json() as Promise<CouroMundo>) : null))
      .catch(() => null),
  ]).then(([e, mundo, ab, log, couroMundo]) => {
    const br = ab.series.Brasil
    const abate = e.anos.map((a) => Object.keys(br).filter((k) => k.startsWith(String(a))).reduce((s, k) => s + (br[k].Total ?? 0), 0) / 1e6)
    return { ...e, mundo, porIso: new Map(mundo.paises.map((p) => [p.iso3, p])), abate, log, couroMundo }
  })
  return pendente
}

let detalhes: Promise<Detalhes> | null = null
export const carregarDetalhes = () => (detalhes ??= fetch('./data/geo/detalhes.json').then((r) => r.json() as Promise<Detalhes>))

/* ---------- os produtos de cada sentido ---------- */

export const ESTAGIOS: { chave: Estagio; nome: string; curto: string }[] = [
  { chave: 'cru', nome: 'Couro cru', curto: 'couro cru' },
  { chave: 'wb', nome: 'Wet blue', curto: 'wet blue' },
  { chave: 'crust', nome: 'Crust', curto: 'crust' },
  { chave: 'acab', nome: 'Couro acabado', curto: 'couro acabado' },
  { chave: 'outros', nome: 'Outros couros', curto: 'outros couros' },
  { chave: 'cab', nome: 'Cabedais', curto: 'cabedais' },
  { chave: 'calc', nome: 'Calçados de couro', curto: 'calçados de couro' },
  { chave: 'art', nome: 'Artigos de couro', curto: 'artigos de couro' },
]
export const nomeEstagio = (k: string) => ESTAGIOS.find((e) => e.chave === k)?.nome ?? k
export const curtoEstagio = (k: string) => ESTAGIOS.find((e) => e.chave === k)?.curto ?? k

/** Os insumos importados, na ordem da caixa: os do curtume, os couros e os que chegam ao boi. */
export const GRUPOS_INSUMO: { nome: string; chaves: string[] }[] = [
  { nome: 'Curtume', chaves: ['cromo', 'formico', 'sulfeto', 'taninos', 'recurtentes', 'engraxe', 'corantes', 'acabamento', 'maquinas'] },
  { nome: 'Couros', chaves: ['couros'] },
  { nome: 'Boi', chaves: ['ureia', 'kcl', 'map_dap', 'sulfato_amonio', 'enxofre'] },
]

/* ---------- contas ---------- */

/** Exportação de um país num ano (índice em `anos`), somando estágios; US$ mil. */
export function exportou(d: Externo, iso: string, estagios: Estagio[], i: number) {
  const p = d.exp[iso]
  if (!p) return 0
  let s = 0
  for (const e of estagios) s += p[e]?.[i] ?? 0
  return s
}

/** Todos os destinos num ano, do maior para o menor. */
export function destinos(d: Externo, estagios: Estagio[], i: number): [string, number][] {
  return Object.keys(d.exp)
    .map((iso) => [iso, exportou(d, iso, estagios, i)] as [string, number])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
}

/** Total exportado de um estágio por ano, US$ mil. */
export const totalAno = (d: Externo, e: Estagio) => d.anos.map((_, i) => Object.values(d.exp).reduce((s, p) => s + (p[e]?.[i] ?? 0), 0))

/** Importações de um insumo por ano, US$ mil, e a origem de cada ano. */
export const importouAno = (d: Externo, ins: string) => d.anos.map((_, i) => Object.values(d.impAno[ins] ?? {}).reduce((s, v) => s + (v[i] ?? 0), 0))

/** Preço de um destino num ano, US$/kg (exportações). */
export function precoDe(d: Externo, iso: string, e: Estagio, i: number): number | null {
  const v = d.exp[iso]?.[e]?.[i] ?? 0
  const t = d.t[iso]?.[e]?.[i] ?? 0
  return t >= 20 && v > 0 ? v / t : null
}

/** Último valor não nulo de uma série. */
export const ultimo = (s: (number | null)[]) => {
  for (let i = s.length - 1; i >= 0; i--) if (s[i] !== null) return { v: s[i] as number, i }
  return null
}

export const UE27 = new Set(['AUT', 'BEL', 'BGR', 'CYP', 'CZE', 'DEU', 'DNK', 'ESP', 'EST', 'FIN', 'FRA', 'GRC', 'HRV', 'HUN', 'IRL', 'ITA', 'LTU', 'LUX', 'LVA', 'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'SWE'])
export const GOLFO = new Set(['SAU', 'BHR', 'QAT', 'ARE', 'IRN', 'IRQ', 'KWT', 'OMN'])

/* ---------- números como o painel escreve ---------- */

export const nf = (v: number, casas = 0) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas })
/** US$ mil → "US$ 131 mi" ou "US$ 1,05 bi". */
export function usdMil(v: number) {
  if (v >= 1e6) return `US$ ${nf(v / 1e6, 2)} bi`
  if (v >= 1e3) return `US$ ${nf(v / 1e3, v >= 1e4 ? 0 : 1)} mi`
  return `US$ ${nf(v)} mil`
}
/** Só o número em milhões, para rótulos curtos. */
export const mi = (vMil: number) => nf(vMil / 1e3, vMil >= 1e4 ? 0 : 1)
export const pct = (r: number, casas = 0) => `${nf(r * 100, casas)}%`
export const variacao = (r: number, casas = 0) => `${r > 0 ? '+' : r < 0 ? '−' : ''}${nf(Math.abs(r) * 100, casas)}%`
