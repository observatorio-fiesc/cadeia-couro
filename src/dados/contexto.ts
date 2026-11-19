// Todos os arquivos que o painel lê (painel/public/data), carregados uma vez.

import { geoArea, type GeoPermissibleObjects } from 'd3-geo'
import { carregarCadeia, indexar, recalcularAlcances, type Cadeia, type Indice } from './cadeia'
import { aplicarProcesso, carregarProcesso, type IndiceProcesso, type Processo } from './processo'

// As malhas seguem a RFC 7946 (anel externo anti-horário); o d3-geo trabalha na esfera e lê esse sentido como
// "tudo menos o polígono". Polígono com área maior que meia esfera tem os anéis invertidos aqui.
function corrigirSentido(fc: GeoFC): GeoFC {
  type Anel = [number, number][]
  for (const f of fc.features) {
    const g = f.geometry as { type: string; coordinates: Anel[] | Anel[][] } | null
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue
    if (g.type === 'Polygon') {
      if (geoArea(f as unknown as GeoPermissibleObjects) > 2 * Math.PI) g.coordinates = (g.coordinates as Anel[]).map((r) => r.slice().reverse())
    } else {
      g.coordinates = (g.coordinates as Anel[][]).map((partes) => {
        const pol = { type: 'Polygon', coordinates: partes } as unknown as GeoPermissibleObjects
        return geoArea(pol) > 2 * Math.PI ? partes.map((r) => r.slice().reverse()) : partes
      })
    }
  }
  return fc
}

export type Planta = { id: string; nome: string; uf: string; lat: number; lon: number; etapas: string[] }
export type Porto = { id: string; nome: string; uf: string; lat: number; lon: number }
export type Rota = { id: string; de: string; para: string; tipo: string; km: number; horas: number; coords: [number, number][] }
export type Logistica = { fonte_rotas: string; plantas: Planta[]; portos: Porto[]; rotas: Rota[] }
export type Paises = { paises: Record<string, { nome: string; lon: number; lat: number }>; nome_iso: Record<string, string> }
export type PortoEntrada = { urf: string; nome: string; via: string; parte: number; lat: number | null; lon: number | null }
export type Entrada = { codigos: string[]; kt: number; portos: PortoEntrada[]; ufs: [string, number][]; vias: [string, number][]; plantas: string[] }
export type Entradas = { fonte: string; nota: string; insumos: Record<string, Entrada> }
export type Abate = { fonte: string; series: Record<string, Record<string, Record<string, number | null>>> }
export type Evento = { data: string; setores: string; tipo: string; titulo: string; descricao: string; status: string; fonte: string; url: string }
export type Comparacao = { '2025': number; '2026': number; var: number | null }
export type Mercados = {
  fonte: string
  ressalva: string
  ultimo_periodo: string
  artigos: Record<string, string>
  destinos_2025: { municipio: string; artigo: string; iso3: string; pais: string; fob: number }[]
  serie_eua: Record<string, number | string>[]
  comparacoes: Record<string, Comparacao> & { meses: string }
  anual_pais: Record<string, Record<string, number>>
  china_2025: Record<string, number | null>
  eventos: Evento[]
}
export type GeoFeature = { type: 'Feature'; properties: Record<string, string>; geometry: unknown }
export type GeoFC = { type: 'FeatureCollection'; features: GeoFeature[] }

export type Contexto = {
  cadeia: Cadeia
  ix: Indice
  /** o mapa do processo: as operações de cada etapa (null se processo.json faltar) */
  processo: Processo | null
  ixp: IndiceProcesso | null
  log: Logistica
  paises: Paises
  entradas: Entradas
  abate: Abate
  mercados: Mercados
  geo: { uf: GeoFC; rodovias: GeoFC; mundo: GeoFC }
}

async function json<T>(arq: string): Promise<T> {
  const r = await fetch(`./data/${arq}`)
  if (!r.ok) throw new Error(`${arq} não encontrado`)
  return r.json()
}

export async function carregarTudo(): Promise<Contexto> {
  const [cadeia, processo, log, paises, entradas, abate, mercados, uf, rodovias, mundo] = await Promise.all([
    carregarCadeia(),
    carregarProcesso(),
    json<Logistica>('logistica.json'),
    json<Paises>('paises.json'),
    json<Entradas>('entradas.json'),
    json<Abate>('abate.json'),
    json<Mercados>('mercados.json'),
    json<GeoFC>('geo/br_uf.json'),
    json<GeoFC>('geo/rodovias.json'),
    json<GeoFC>('geo/mundo.json'),
  ])
  // o processo é a fonte das arestas de insumo para etapa; os alcances são refeitos depois dele
  const ixp = processo ? aplicarProcesso(cadeia, processo) : null
  if (ixp?.pendencias.length) console.warn(`Mapa do processo: ${ixp.pendencias.length} pendências`, ixp.pendencias)
  recalcularAlcances(cadeia)
  return { cadeia, ix: indexar(cadeia), processo, ixp, log, paises, entradas, abate, mercados, geo: { uf: corrigirSentido(uf), rodovias, mundo: corrigirSentido(mundo) } }
}

// Grupo geográfico da origem, para a cor dos fluxos
const ORMUZ = new Set(['SAU', 'BHR', 'QAT', 'KWT', 'ARE', 'IRN', 'IRQ'])
export function grupoOrigem(iso: string | undefined): 'ormuz' | 'oma' | 'china' | 'outros' {
  if (!iso) return 'outros'
  if (ORMUZ.has(iso)) return 'ormuz'
  if (iso === 'OMN') return 'oma'
  if (iso === 'CHN' || iso === 'HKG') return 'china'
  return 'outros'
}
