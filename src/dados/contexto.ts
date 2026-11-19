// Todos os arquivos que o painel lê (painel/public/data), carregados uma vez.

import { carregarCadeia, indexar, recalcularAlcances, type Cadeia, type Indice } from './cadeia'
import { aplicarProcesso, carregarProcesso, type IndiceProcesso, type Processo } from './processo'

export type Planta = { id: string; nome: string; uf: string; lat: number; lon: number; etapas: string[] }
export type Porto = { id: string; nome: string; uf: string; lat: number; lon: number }
export type Rota = { id: string; de: string; para: string; tipo: string; km: number; horas: number; coords: [number, number][] }
export type Logistica = { fonte_rotas: string; plantas: Planta[]; portos: Porto[]; rotas: Rota[] }
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

export type Contexto = {
  cadeia: Cadeia
  ix: Indice
  /** o mapa do processo: as operações de cada etapa (null se processo.json faltar) */
  processo: Processo | null
  ixp: IndiceProcesso | null
  log: Logistica
  abate: Abate
  mercados: Mercados
}

async function json<T>(arq: string): Promise<T> {
  const r = await fetch(`./data/${arq}`)
  if (!r.ok) throw new Error(`${arq} não encontrado`)
  return r.json()
}

export async function carregarTudo(): Promise<Contexto> {
  const [cadeia, processo, log, abate, mercados] = await Promise.all([
    carregarCadeia(),
    carregarProcesso(),
    json<Logistica>('logistica.json'),
    json<Abate>('abate.json'),
    json<Mercados>('mercados.json'),
  ])
  // o processo é a fonte das arestas de insumo para etapa; os alcances são refeitos depois dele
  const ixp = processo ? aplicarProcesso(cadeia, processo) : null
  if (ixp?.pendencias.length) console.warn(`Mapa do processo: ${ixp.pendencias.length} pendências`, ixp.pendencias)
  recalcularAlcances(cadeia)
  return { cadeia, ix: indexar(cadeia), processo, ixp, log, abate, mercados }
}
