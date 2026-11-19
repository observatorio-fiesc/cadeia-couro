// Mapa do processo (public/data/processo.json): cada etapa da cadeia dividida nas suas operações, na ordem em
// que acontecem. Cada operação diz o que entra, com o papel de cada entrada (fica no produto, sai no banho,
// máquina, apoio, pessoas e certificações), em que estado o material sai, e o que sobra (coprodutos, resíduos,
// efluentes) ou é vendido.
//
// É a fonte das arestas de insumo para etapa da cadeia: aplicarProcesso deriva essas arestas das operações,
// mantém a confiança das que já estavam em cadeia.json e anota o que diverge (pendências), para ninguém ter
// de manter a mesma informação em dois lugares.

import type { Aresta, Cadeia } from './cadeia'

export type Papel = 'incorporado' | 'auxiliar' | 'maquina' | 'apoio' | 'saber'
export type TipoSaida = 'artigo' | 'coproduto' | 'residuo' | 'efluente'
export const PAPEIS: Papel[] = ['incorporado', 'auxiliar', 'maquina', 'apoio', 'saber']
export const TIPOS_SAIDA: TipoSaida[] = ['artigo', 'coproduto', 'residuo', 'efluente']

export type Entrada = { no: string; papel: Papel; confianca?: string; essencial?: boolean; nota?: string }
export type Operacao = {
  id: string
  etapa: string
  nome: string
  descricao: string
  produz?: string // estado em que o material sai
  entradas: Entrada[]
  saidas?: string[] // ids de Saida
  banho?: boolean // a operação é feita em banho: usa água e calor do apoio
  fontes: string[]
  confianca: string
  leva?: string // transporte: o estado levado
  depois?: string // transporte: a etapa depois da qual ele acontece
  recebe?: string[] // tratamento de efluente: os efluentes que chegam
}
export type Estado = { id: string; nome: string; descricao: string; artigo?: string }
export type Saida = { id: string; nome: string; tipo: TipoSaida; destino: string; descricao: string; fontes: string[]; confianca: string; artigo?: string; para?: string }
export type EtapaProcesso = { id: string; tipo: 'producao' | 'apoio'; lugar: string }

export type Processo = {
  versao: number
  nota: string
  papeis: Record<Papel, { nome: string; descricao: string }>
  tipos_saida: Record<TipoSaida, { nome: string; descricao: string }>
  etapas: EtapaProcesso[]
  estados: Estado[]
  saidas: Saida[]
  operacoes: Operacao[]
}

/** Índices do processo, montados uma vez. */
export type IndiceProcesso = {
  operacoesDe: Map<string, Operacao[]> // etapa -> operações, na ordem
  operacao: Map<string, Operacao>
  estado: Map<string, Estado>
  saida: Map<string, Saida>
  /** em que operações cada nó da cadeia entra, e com que papel */
  usos: Map<string, { op: Operacao; entrada: Entrada }[]>
  /** de que operação sai cada saída */
  origem: Map<string, Operacao[]>
  /** pendências encontradas ao aplicar o processo à cadeia */
  pendencias: string[]
}

export async function carregarProcesso(): Promise<Processo | null> {
  return fetch('./data/processo.json').then((r) => (r.ok ? (r.json() as Promise<Processo>) : null), () => null)
}

/**
 * Confere o processo contra a cadeia e deriva dele as arestas de insumo para etapa. Uma aresta que já existia
 * mantém a confiança e a essencialidade de cadeia.json, a menos que a entrada diga outra coisa; uma aresta de
 * insumo para etapa de cadeia.json que nenhuma operação usa sai da cadeia e vira pendência.
 */
export function aplicarProcesso(c: Cadeia, p: Processo): IndiceProcesso {
  const pend: string[] = []
  const porId = new Map(c.nos.map((n) => [n.id, n]))
  const estado = new Map(p.estados.map((e) => [e.id, e]))
  const saida = new Map(p.saidas.map((s) => [s.id, s]))
  const operacao = new Map(p.operacoes.map((o) => [o.id, o]))
  const operacoesDe = new Map<string, Operacao[]>()
  const usos = new Map<string, { op: Operacao; entrada: Entrada }[]>()
  const origem = new Map<string, Operacao[]>()

  for (const e of p.etapas) if (!porId.has(e.id)) pend.push(`Etapa ${e.id} não existe na cadeia.`)
  for (const o of p.operacoes) {
    if (!p.etapas.some((e) => e.id === o.etapa)) pend.push(`${o.nome}: etapa ${o.etapa} fora do processo.`)
    ;(operacoesDe.get(o.etapa) ?? operacoesDe.set(o.etapa, []).get(o.etapa)!).push(o)
    if (o.produz && !estado.has(o.produz)) pend.push(`${o.nome}: estado ${o.produz} não definido.`)
    if (o.leva && !estado.has(o.leva)) pend.push(`${o.nome}: estado levado ${o.leva} não definido.`)
    for (const en of o.entradas) {
      if (!porId.has(en.no)) pend.push(`${o.nome}: entrada ${en.no} não existe na cadeia.`)
      ;(usos.get(en.no) ?? usos.set(en.no, []).get(en.no)!).push({ op: o, entrada: en })
    }
    for (const s of [...(o.saidas ?? []), ...(o.recebe ?? [])]) if (!saida.has(s)) pend.push(`${o.nome}: saída ${s} não definida.`)
    for (const s of o.saidas ?? []) (origem.get(s) ?? origem.set(s, []).get(s)!).push(o)
  }
  for (const s of p.saidas) {
    if (s.artigo && !porId.has(s.artigo)) pend.push(`${s.nome}: artigo ${s.artigo} não existe na cadeia.`)
    if (s.para && !operacao.has(s.para)) pend.push(`${s.nome}: vai para ${s.para}, operação que não existe.`)
    if (!origem.has(s.id) && !p.operacoes.some((o) => o.recebe?.includes(s.id))) pend.push(`${s.nome}: nenhuma operação a produz.`)
  }
  for (const e of p.estados) if (e.artigo && !porId.has(e.artigo)) pend.push(`Estado ${e.nome}: artigo ${e.artigo} não existe na cadeia.`)
  // cada etapa de produção termina num estado
  for (const e of p.etapas.filter((x) => x.tipo === 'producao')) {
    const ops = operacoesDe.get(e.id) ?? []
    if (!ops.length) pend.push(`Etapa ${porId.get(e.id)?.nome ?? e.id} sem operações.`)
    else if (!ops.some((o) => o.produz)) pend.push(`Etapa ${porId.get(e.id)?.nome ?? e.id}: nenhuma operação diz em que estado o material sai.`)
  }

  // arestas de insumo para etapa: derivadas das operações
  const etapas = new Set(p.etapas.map((e) => e.id))
  const ehInsumoDeEtapa = (a: Aresta) => etapas.has(a.para) && a.tipo !== 'visual' && porId.get(a.de)?.lado === 'oferta' && porId.get(a.de)!.camada >= 2
  const antigas = new Map(c.arestas.filter(ehInsumoDeEtapa).map((a) => [`${a.de}>${a.para}`, a]))
  const novas = new Map<string, Aresta>()
  for (const o of p.operacoes)
    for (const en of o.entradas) {
      if (!porId.has(en.no)) continue
      const k = `${en.no}>${o.etapa}`
      const velha = antigas.get(k)
      const ja = novas.get(k)
      // a mesma entrada em várias operações: essencial se for essencial em alguma; a confiança mais forte
      const essencial = (en.essencial ?? velha?.essencial ?? true) || !!ja?.essencial
      const confianca = en.confianca ?? velha?.confianca ?? o.confianca
      novas.set(k, {
        de: en.no,
        para: o.etapa,
        tipo: en.papel === 'saber' ? 'capacitação' : 'insumo',
        essencial,
        confianca: ja && ja.confianca !== 'indício' ? ja.confianca : confianca,
        valor_usd: velha?.valor_usd ?? null,
      })
    }
  for (const [k, a] of antigas)
    if (!novas.has(k)) pend.push(`${porId.get(a.de)?.nome ?? a.de} entrava em ${porId.get(a.para)?.nome ?? a.para} na cadeia, mas nenhuma operação o usa: aresta retirada.`)
  c.arestas = [...c.arestas.filter((a) => !ehInsumoDeEtapa(a)), ...novas.values()]
  // a lista de insumos de cada etapa acompanha as arestas, como no gerador
  for (const e of etapas) {
    const no = porId.get(e)
    if (!no) continue
    const chegam = c.arestas.filter((a) => a.para === e && a.tipo !== 'visual')
    no.insumos = chegam.filter((a) => a.confianca !== 'indício').map((a) => a.de)
    ;(no as typeof no & { insumos_indicio?: string[] }).insumos_indicio = chegam.filter((a) => a.confianca === 'indício').map((a) => a.de)
  }
  return { operacoesDe, operacao, estado, saida, usos, origem, pendencias: pend }
}
