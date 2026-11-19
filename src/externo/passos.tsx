// As análises da aba Mercado externo, como os Cenários estratégicos do painel-comandante: cada uma é uma sequência de
// passadas, e cada passada leva a câmera a um lugar, desenha o que interessa ali e escreve à esquerda só um número
// e uma linha. Exportações e Importações têm cada uma a sua lista, dividida em Oferta e Demanda.
// Os números vêm do Comex Stat (externo.json), do UN Comtrade (couro-mundo.json), do IBGE (abate) e das tabelas do
// relatório de comércio exterior (tabelas.ts); as fontes ficam no botão "Fontes e definições".
import type { ReactNode } from 'react'
import { curtoEstagio, destinos, exportou, GOLFO, importouAno, nf, pct, precoDe, totalAno, ultimo, variacao, type DadosExterno, type Estagio } from './dados'
import { ondeFica, type Cena, type Enquadre, type Fluxo, type Marca, type Peca, type Rotulo, type RotaCarga, type Tom, type Trelica } from './Mapa'
import type { FolhaPasso, Info, Numero } from './Folha'
import { Corrente, FiguraProcesso, type Estacao } from './Figuras'
import { BAIN, MAISONS, NAO_OBVIOS, NEVP, NEVP_ANOS, POLOS_AUTO } from './tabelas'
import { GARGALOS, gargalosDe, PORTO, rota, type Ancora, type LonLat } from './rotas'

export type Sentido = 'exp' | 'imp'
export type Lado = 'oferta' | 'demanda'
/** O que uma passada lê: os dados, o produto escolhido na caixa e o ano em que o vídeo está (índice em `anos`). */
export type Ctx = { d: DadosExterno; produto: string; i: number }
export type CenaPasso = Cena & { densidade?: boolean; apagar?: boolean }
export type Passo = {
  chave: string
  nome: string
  /** o produto da caixa vale para esta passada */
  produto: boolean
  /** quanto a passada dura quando a sequência toca sozinha, ms */
  ms: number
  /** os anos correm sozinhos, como num vídeo: do primeiro ao último índice */
  video?: (c: Omit<Ctx, 'i'>) => [number, number]
  /** o nome do ano do vídeo (por padrão, o ano de `anos`) */
  ano?: (i: number) => string
  folha: (c: Ctx) => FolhaPasso
  cena: (c: Ctx) => CenaPasso
  /** o infográfico, acima da faixa */
  info?: (c: Ctx) => Info | null
  /** uma figura no lugar do infográfico (a corrente de um choque) */
  lado?: (c: Ctx) => ReactNode
  /** uma figura grande sobre o mapa apagado */
  figura?: (c: Ctx) => ReactNode
}
export type Analise = { chave: string; nome: string; lado: Lado; passos: Passo[] }

export const PRODUTO_INICIAL: Record<Sentido, string> = { exp: 'acab', imp: 'cromo' }

/* ---------- ajudas ---------- */

const BR: Ancora = { porto: 'SANTOS' }
const anc = (d: DadosExterno, iso: string): Ancora => (PORTO[iso] ? { porto: PORTO[iso] } : { lonlat: ondeFica(d, iso) ?? [0, 0] })
const nomeDe = (d: DadosExterno, iso: string) => d.porIso.get(iso)?.nome ?? iso
const larg = (v: number, max: number) => 0.8 + 6.5 * Math.sqrt(Math.max(v, 0) / (max || 1))
const MUNDO: Enquadre = { pontos: [[-118, 62], [148, 62], [-78, -44], [146, -44]], dir: [0, 0.9, 0.5], margem: 1.0 }
/** Um retângulo em volta de um ponto, para enquadrar um país. */
const perto = ([lo, la]: LonLat, r: number): LonLat[] => [
  [lo - r, la - r * 0.6],
  [lo + r, la - r * 0.6],
  [lo - r, la + r * 0.6],
  [lo + r, la + r * 0.6],
]
const vistaDe = (d: DadosExterno, isos: string[], margem = 1.2, alto?: number): Enquadre => ({
  pontos: isos.map((iso) => ondeFica(d, iso)).filter(Boolean) as LonLat[],
  margem,
  alto,
  dir: [0, 0.88, 0.55],
})
/** US$ mil → número da folha, em mi ou bi. */
const usd = (vMil: number): Numero =>
  vMil >= 1e6 ? { v: vMil / 1e6, casas: 2, prefixo: 'US$ ', sufixo: ' bi' } : { v: vMil / 1e3, casas: vMil < 1e4 ? 1 : 0, prefixo: 'US$ ', sufixo: ' mi' }
const usdTxt = (vMil: number) => (vMil >= 1e6 ? `US$ ${nf(vMil / 1e6, 2)} bi` : `US$ ${nf(vMil / 1e3, vMil < 1e4 ? 1 : 0)} mi`)
const curto = (d: DadosExterno, iso: string) => nomeDe(d, iso).replace('Emirados Árabes Unidos', 'Emirados').replace('Estados Unidos', 'EUA').replace('Arábia Saudita', 'Arábia S.')

/** Artigo de cada país, para as frases ("para a Itália", "do México", "de Hong Kong"). */
const ARTIGO: Record<string, string> = {
  ITA: 'a', FRA: 'a', CHN: 'a', DEU: 'a', ESP: 'a', IND: 'a', THA: 'a', IDN: 'a', HUN: 'a', POL: 'a', ROU: 'a', SRB: 'a', SVK: 'a', SVN: 'a',
  TUN: 'a', NOR: 'a', NGA: 'a', TUR: 'a', RUS: 'a', ARG: 'a', BEL: 'a', KOR: 'a', BIH: 'a', HRV: 'a', AUT: 'a', AUS: 'a', SAU: 'a', ZAF: 'a',
  COL: 'a', FIN: 'a', SWE: 'a', GRC: 'a', BGR: 'a', UKR: 'a', ARE: 'os', USA: 'os', NLD: 'os', PHL: 'as', MEX: 'o', VNM: 'o', URY: 'o', PRY: 'o',
  JPN: 'o', CAN: 'o', CHL: 'o', PER: 'o', EGY: 'o', MAR: 'o', QAT: 'o', IRN: 'o', IRQ: 'o', KWT: 'o', KHM: 'o', BGD: 'o', GBR: 'o', BRA: 'o',
  PAK: 'o', LKA: 'o', DOM: 'a', GHA: 'o', TGO: 'o', TWN: '', HKG: '', PRT: '', ISR: '', SGP: '', OMN: '', CZE: 'a', DNK: 'a', IRL: 'a',
}
const CONTRAI: Record<string, Record<string, string>> = {
  de: { a: 'da', o: 'do', os: 'dos', as: 'das', '': 'de' },
  para: { a: 'para a', o: 'para o', os: 'para os', as: 'para as', '': 'para' },
}
const com = (prep: 'de' | 'para', d: DadosExterno, iso: string) => `${CONTRAI[prep][ARTIGO[iso] ?? '']} ${nomeDe(d, iso)}`

/** "do sulfato", "dos taninos", "da ureia", "das máquinas": o artigo de cada insumo. */
const ART_INS: Record<string, string> = {
  cromo: 'do', formico: 'do', sulfeto: 'do', taninos: 'dos', recurtentes: 'dos', engraxe: 'dos', corantes: 'dos', acabamento: 'dos',
  maquinas: 'das', couros: 'dos', ureia: 'da', kcl: 'do', map_dap: 'do', sulfato_amonio: 'do', enxofre: 'do',
}

/** O último ano em que a maior parte dos grandes exportadores do Comtrade já declarou. */
function ultimoAnoMundo(d: DadosExterno, produto: string) {
  const cm = d.couroMundo?.produtos[produto as Estagio]
  if (!cm) return 10
  const topo = cm.exportadores.slice(0, 8)
  for (let k = d.anos.length - 1; k > 0; k--) if (topo.filter(([, s]) => s[k] !== null).length >= 6) return k
  return 0
}

/** Onde fica o detalhe 1:10m de cada país, e o retângulo que a câmera enquadra. */
const JANELA: Record<string, string> = {
  ITA: 'italia', FRA: 'franca', CHN: 'china', HKG: 'china', VNM: 'vietna', MEX: 'mexico', BRA: 'brasil', DEU: 'europa_centro', AUT: 'europa_centro',
  CZE: 'europa_centro', SVK: 'europa_centro', HUN: 'europa_centro', POL: 'europa_centro', ROU: 'europa_centro', SRB: 'europa_centro',
  SVN: 'europa_centro', HRV: 'europa_centro', BIH: 'europa_centro', KHM: 'vietna',
}
const BORDAS: Record<string, [LonLat, LonLat]> = {
  italia: [[6.5, 36.6], [18.6, 47.1]],
  franca: [[-4.5, 42.4], [8.2, 51.1]],
  china: [[106, 21.5], [122.5, 40.5]],
  vietna: [[102.5, 8.6], [109.6, 23.2]],
  mexico: [[-105.5, 17.5], [-96.5, 23.6]],
  brasil: [[-60, -32], [-40, -12]],
  europa_centro: [[11, 43.5], [29, 54.5]],
}
const enquadreDe = (d: DadosExterno, iso: string): { camera: Enquadre; detalhe?: string[] } => {
  const j = JANELA[iso]
  if (j) {
    const [[a, b], [c, e]] = BORDAS[j]
    return { camera: { pontos: [[a, b], [c, b], [a, e], [c, e]], dir: [0.04, 0.85, 0.62], margem: 1.0 }, detalhe: [j] }
  }
  return { camera: { pontos: perto(ondeFica(d, iso) ?? [0, 0], 17), dir: [0.04, 0.85, 0.62], margem: 1.1 } }
}

/** Polos do couro e do calçado em cada país, para o zoom (lugares conhecidos do setor). */
const POLOS: Record<string, [string, LonLat][]> = {
  ITA: [['Arzignano', [11.334, 45.521]], ['Santa Croce sull’Arno', [10.779, 43.712]], ['Solofra', [14.848, 40.83]]],
  FRA: [['Annonay', [4.67, 45.24]], ['Le Puy-en-Velay', [3.885, 45.043]]],
  CHN: [['Haining', [120.68, 30.536]], ['Xinji', [115.218, 37.943]], ['Dongguan', [113.752, 23.021]]],
  HKG: [['Dongguan', [113.752, 23.021]]],
  VNM: [['Bình Dương', [106.652, 10.98]], ['Đồng Nai', [106.824, 10.945]]],
  MEX: [['León', [-101.686, 21.122]]],
  HUN: [['Szolnok', [20.183, 47.175]]],
  IND: [['Kanpur', [80.33, 26.45]], ['Ambur', [78.716, 12.792]]],
  PRT: [['São João da Madeira', [-8.49, 40.9]]],
  ESP: [['Igualada', [1.617, 41.578]]],
}
const marcasPolos = (iso: string): { marcas: Marca[]; rotulos: Rotulo[] } => {
  const ps = POLOS[iso] ?? []
  return {
    marcas: ps.map(([n, em]) => ({ id: `polo-${n}`, em, raio: 0.022, tom: 'couro' as Tom, pulsa: true })),
    rotulos: ps.map(([n, em]) => ({ id: `polo-${n}`, em, texto: n, forte: true, lado: 'dir' as const })),
  }
}

/** Preço médio de um ano numa série mensal. */
const mediaAno = (meses: string[], s: (number | null)[], ano: number) => {
  const v = s.filter((x, k) => x !== null && meses[k]?.startsWith(String(ano))) as number[]
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** A treliça flutua acima do mapa: a câmera olha de lado, quase na horizontal, e o chão fica embaixo dela. */
const ALTURA_TRELICA = 2.6
const ALTO_TRELICA = 2.0
const cameraTrelica = (em: LonLat): Enquadre => ({
  pontos: [
    [em[0] - 31, em[1]],
    [em[0] + 40, em[1]],
  ],
  base: ALTURA_TRELICA - 0.3,
  alto: ALTO_TRELICA + 0.5,
  dir: [0, 0.08, 1],
  margem: 1.36,
  olharAbaixo: 1.7,
})

/** Gargalos e a parte do valor que passa por cada um. */
function partesNosGargalos(valores: [string, number][]) {
  const total = valores.reduce((s, [, v]) => s + v, 0) || 1
  const soma = new Map<string, number>()
  for (const [iso, v] of valores) for (const g of gargalosDe(iso)) soma.set(g, (soma.get(g) ?? 0) + v)
  return GARGALOS.map((g) => ({ ...g, parte: (soma.get(g.id) ?? 0) / total })).filter((g) => g.parte >= 0.005).sort((a, b) => b.parte - a.parte)
}
const PELO: Record<string, string> = {
  ormuz: 'pelo estreito de Ormuz',
  bab: 'por Bab el-Mandeb',
  suez: 'pelo canal de Suez',
  malaca: 'pelo estreito de Malaca',
  gibraltar: 'pelo estreito de Gibraltar',
  cabo: 'pelo cabo da Boa Esperança',
  panama: 'pelo canal do Panamá',
  bosforo: 'pelo Bósforo',
}
const CURTO_G: Record<string, string> = {
  ormuz: 'Ormuz',
  bab: 'Bab el-Mandeb',
  suez: 'Suez',
  malaca: 'Malaca',
  gibraltar: 'Gibraltar',
  cabo: 'Boa Esperança',
  panama: 'Panamá',
  bosforo: 'Bósforo',
}

/* ---------- Exportações · Oferta ---------- */

const ofertantes: Analise = {
  chave: 'ofertantes',
  nome: 'Ofertantes',
  lado: 'oferta',
  passos: [
    {
      chave: 'mundo',
      nome: 'Quem vende',
      produto: true,
      ms: 16000,
      video: ({ d, produto }) => [0, ultimoAnoMundo(d, produto)],
      folha: ({ d, produto, i }) => {
        const cm = d.couroMundo?.produtos[produto as Estagio]
        const brasil = cm?.exportadores.find(([iso]) => iso === 'BRA')?.[1][i] ?? null
        const total = cm?.total[i] ?? null
        if (!cm || brasil === null || !total) return { numero: usd(totalAno(d, produto as Estagio)[i]), palavra: `de ${curtoEstagio(produto)} vendidos pelo Brasil em ${d.anos[i]}` }
        const p = brasil / total
        return { numero: { v: p * 100, casas: p < 0.1 ? 1 : 0, sufixo: '%' }, palavra: `do ${curtoEstagio(produto)} exportado no mundo saiu do Brasil em ${d.anos[i]}` }
      },
      cena: ({ d, produto, i }) => {
        const cm = d.couroMundo?.produtos[produto as Estagio]
        if (!cm) {
          const ds = destinos(d, [produto as Estagio], i).slice(0, 12)
          const max = ds[0]?.[1] ?? 1
          return {
            pinturas: [{ iso: 'BRA', v: 0.7, tom: 'couro' }],
            fluxos: ds.map(([iso, v]) => ({ id: iso, de: BR, para: anc(d, iso), largura: larg(v, max), tom: 'couro' })),
            rotulos: [],
            camera: MUNDO,
          }
        }
        const ano = cm.exportadores.filter(([, s]) => s[i] !== null).sort((a, b) => b[1][i]! - a[1][i]!)
        const topo = ano.slice(0, 10)
        if (!topo.some(([iso]) => iso === 'BRA')) {
          const br = ano.find(([iso]) => iso === 'BRA')
          if (br) topo.push(br)
        }
        const maxV = Math.max(...cm.exportadores.flatMap(([, s]) => s.map((x) => x ?? 0)))
        const total = cm.total[i] || 1
        const fl = cm.fluxos.filter(([, , s]) => (s[i] ?? 0) > 0).sort((a, b) => b[2][i]! - a[2][i]!).slice(0, 26)
        const maxF = Math.max(...cm.fluxos.flatMap(([, , s]) => s.map((x) => x ?? 0)), 1e-6)
        return {
          pinturas: topo.map(([iso, s]) => ({ iso, v: iso === 'BRA' ? 0.8 : 0.25 + 0.5 * (s[i]! / maxV), tom: iso === 'BRA' ? 'couro' : 'tinta' })),
          fluxos: fl.map(([de, para, s]) => ({ id: `${de}>${para}`, de: anc(d, de), para: anc(d, para), largura: larg(s[i]!, maxF) * 0.9, tom: de === 'BRA' ? 'couro' : 'palido', atraso: 0.3 })),
          rotulos: [],
          pecas: topo
            .filter(([iso]) => ondeFica(d, iso))
            .map(([iso, s], k): Peca => {
              const nomeia = k < 6 || iso === 'BRA'
              return { id: iso, em: ondeFica(d, iso)!, v: s[i]! / maxV, tom: iso === 'BRA' ? 'couro' : 'tinta', nome: nomeia ? curto(d, iso) : undefined, valor: nomeia ? pct(s[i]! / total, s[i]! / total < 0.1 ? 1 : 0) : undefined, raio: 0.32 }
            }),
          alturaPeca: 4.6,
          camera: { ...MUNDO, alto: 1.6 },
          dica: (iso) => {
            const s = cm.exportadores.find(([x]) => x === iso)?.[1]
            return s && s[i] !== null ? [nomeDe(d, iso), `${d.anos[i]}: US$ ${nf(s[i]!, 1)} mi exportados`, `${pct(s[i]! / total, 1)} do mundo`] : [nomeDe(d, iso)]
          },
        }
      },
    },
    {
      chave: 'brasil',
      nome: 'De onde sai',
      produto: true,
      ms: 12000,
      folha: ({ d, produto }) => ({ numero: usd(totalAno(d, produto as Estagio)[10]), palavra: `de ${curtoEstagio(produto)} exportados pelo Brasil em 2025` }),
      cena: ({ d }) => {
        const rotas: RotaCarga[] = d.log.rotas.map((r) => ({ id: r.id, pts: r.coords.map(([lo, la]) => [lo, la] as LonLat), peso: 0.25, tom: 'couro' }))
        return {
          pinturas: [{ iso: 'BRA', v: 0.02, tom: 'couro' }],
          fluxos: [],
          rotulos: [
            ...d.log.plantas.map((p) => ({ id: p.id, em: [p.lon, p.lat] as LonLat, texto: `${p.nome} · ${p.uf}`, forte: true, lado: 'dir' as const })),
            ...d.log.portos.filter((p) => ['SSZ', 'PNG', 'ITJ'].includes(p.id)).map((p) => ({ id: p.id, em: [p.lon, p.lat] as LonLat, texto: p.nome, lado: 'dir' as const })),
          ],
          marcas: [
            ...d.log.plantas.map((p) => ({ id: p.id, em: [p.lon, p.lat] as LonLat, raio: 0.04, tom: 'couro' as Tom, pulsa: true })),
            ...d.log.portos.map((p) => ({ id: p.id, em: [p.lon, p.lat] as LonLat, raio: 0.022, tom: 'tinta' as Tom })),
          ],
          carga: { rotas, gargalos: [], velocidade: 0.12, tamanho: 3.4 },
          detalhe: ['brasil'],
          camera: { pontos: [[-57.5, -14], [-45, -14], [-57.5, -28.2], [-45, -28.2]], dir: [0.05, 0.86, 0.6], margem: 1.05 },
        }
      },
    },
  ],
}

const precificacao: Analise = {
  chave: 'precificacao',
  nome: 'Precificação',
  lado: 'oferta',
  passos: [
    {
      chave: 'quilo',
      nome: 'Preço por quilo',
      produto: true,
      ms: 14000,
      folha: ({ d, produto }) => {
        const p = d.preco[produto as Estagio]
        const p15 = p[0] ?? 0
        const p25 = p[10] ?? 0
        return { numero: { v: p25, casas: 2, prefixo: 'US$ ', sufixo: '/kg' }, palavra: `${variacao(p25 / p15 - 1)} sobre 2015 (US$ ${nf(p15, 2)})` }
      },
      cena: ({ d, produto }) => {
        const e = produto as Estagio
        const media = d.preco[e]
        const m25 = media[10] ?? 1
        const peso = Object.keys(d.t)
          .map((iso) => [iso, d.t[iso][e]?.[10] ?? 0] as [string, number])
          .filter(([iso, t]) => t >= 20 && iso !== 'ZZZ')
          .sort((a, b) => b[1] - a[1])
          .slice(0, 9)
        const series: Trelica['series'] = peso.map(([iso], k) => {
          const v = d.anos.map((_, j) => precoDe(d, iso, e, j))
          const u = v[10] ?? ultimo(v)?.v ?? m25
          const tom: Tom = u > m25 * 1.08 ? 'ganho' : u < m25 * 0.92 ? 'perda' : 'tinta'
          return { id: iso, nome: nomeDe(d, iso), v, tom, rotulo: k < 3 ? `${curto(d, iso)} US$ ${nf(u, 2)}` : undefined }
        })
        series.splice(Math.floor(series.length / 2), 0, { id: 'media', nome: 'Média', v: media, tom: 'couro', forte: true, rotulo: `Média US$ ${nf(m25, 2)}` })
        const em: LonLat = [-21, -6]
        const tr: Trelica = { em, altura: ALTURA_TRELICA, largura: 6.4, alto: ALTO_TRELICA, fundo: 1.4, anos: d.anos.map(String), series, ultimo: 10, marca: '2025 · último ano completo', eixo: [[0, '2015'], [5, '2020'], [10, '2025']] }
        return {
          pinturas: [],
          fluxos: [],
          rotulos: [],
          trelica: tr,
          camera: cameraTrelica(em),
          dica: (iso) => {
            const u = precoDe(d, iso, e, 10)
            return u ? [nomeDe(d, iso), `2025: US$ ${nf(u, 2)}/kg`, `${variacao(u / m25 - 1)} da média`] : [nomeDe(d, iso)]
          },
        }
      },
    },
    passoPreco('mais', 'Quem paga mais', 1),
    passoPreco('menos', 'Quem paga menos', -1),
  ],
}

/** O destino que paga mais (ou menos) pelo quilo, entre os que compram ao menos 3% do volume. */
function destinoDePreco(d: DadosExterno, e: Estagio, sinal: 1 | -1) {
  const tot = Object.values(d.t).reduce((s, p) => s + (p[e]?.[10] ?? 0), 0)
  const cands = Object.keys(d.t)
    .filter((iso) => iso !== 'ZZZ' && (d.t[iso][e]?.[10] ?? 0) >= Math.max(20, tot * 0.03))
    .map((iso) => [iso, precoDe(d, iso, e, 10)] as [string, number | null])
    .filter((x): x is [string, number] => x[1] !== null)
    .sort((a, b) => sinal * (b[1] - a[1]))
  return cands[0] ?? null
}

function passoPreco(chave: string, nome: string, sinal: 1 | -1): Passo {
  return {
    chave,
    nome,
    produto: true,
    ms: 11000,
    folha: ({ d, produto }) => {
      const e = produto as Estagio
      const alvo = destinoDePreco(d, e, sinal)
      const m25 = d.preco[e][10] ?? 1
      if (!alvo) return { numero: { v: m25, casas: 2, prefixo: 'US$ ', sufixo: '/kg' }, palavra: `o quilo de ${curtoEstagio(e)} em 2025` }
      const [iso, p] = alvo
      return { numero: { v: p, casas: 2, prefixo: 'US$ ', sufixo: '/kg' }, palavra: `o quilo de ${curtoEstagio(e)} ${com('para', d, iso)} em 2025, ${variacao(p / m25 - 1)} da média` }
    },
    cena: ({ d, produto }) => {
      const e = produto as Estagio
      const alvo = destinoDePreco(d, e, sinal)
      if (!alvo) return { pinturas: [], fluxos: [], rotulos: [], camera: MUNDO }
      const [iso, p] = alvo
      const { camera, detalhe } = enquadreDe(d, iso)
      const pol = marcasPolos(iso)
      return {
        pinturas: [{ iso, v: 0.03, tom: sinal > 0 ? 'ganho' : 'perda' }],
        fluxos: [{ id: `BRA>${iso}`, de: BR, para: anc(d, iso), largura: 3.2, tom: 'couro' }],
        rotulos: [...pol.rotulos, { id: iso, em: ondeFica(d, iso)!, texto: `${nomeDe(d, iso)} · US$ ${nf(p, 2)}/kg`, forte: true, lado: 'cima', tom: sinal > 0 ? 'ganho' : 'perda' }],
        marcas: pol.marcas,
        camera,
        detalhe,
      }
    },
  }
}

const criticidadeExp: Analise = {
  chave: 'criticidade',
  nome: 'Criticidade logística',
  lado: 'oferta',
  passos: [
    {
      chave: 'passagens',
      nome: 'Pontos de passagem',
      produto: false,
      ms: 13000,
      folha: ({ d }) => {
        const g = partesNosGargalos(valoresExp(d))[0]
        return g ? { numero: { v: g.parte * 100, sufixo: '%' }, palavra: `do que o Brasil vende da cadeia do couro passa ${PELO[g.id]}` } : { numero: { v: 0, sufixo: '%' }, palavra: 'sem gargalo nas rotas' }
      },
      cena: ({ d }) => cenaGargalos(d, valoresExp(d), 'couro'),
      info: ({ d }) => infoGargalos(partesNosGargalos(valoresExp(d)), 'do que o Brasil vende da cadeia do couro'),
    },
    {
      chave: 'peste',
      nome: 'Peste suína na China',
      produto: false,
      ms: 15000,
      video: () => [2, 6],
      folha: ({ d }) => {
        const a = d.abate
        return {
          numero: { v: Math.round((a[5] / a[3] - 1) * 100), sufixo: '%' },
          palavra: `nas peles do Brasil de 2018 a 2020, enquanto a China comprava ${nf(d.carne.CHN.mil_t[5] / d.carne.CHN.mil_t[3], 1)} vezes mais carne bovina: a pele acompanha o abate`,
        }
      },
      cena: ({ d, i }) => {
        const t = d.carne.CHN.mil_t
        const maxT = Math.max(...t)
        const a = d.abate
        const maxA = Math.max(...a)
        return {
          pinturas: [
            { iso: 'CHN', v: 0.35, tom: 'perda' },
            { iso: 'BRA', v: 0.4, tom: 'couro' },
          ],
          fluxos: [{ id: 'carne', de: BR, para: { porto: 'SHANGHAI' }, largura: larg(t[i], maxT) * 1.2, tom: 'vermelho', atraso: 0.2 }],
          rotulos: [{ id: 'carne', em: [70, -32], texto: `carne bovina para a China · ${nf(t[i])} mil t`, forte: true, lado: 'cima', tom: 'perda' }],
          pecas: [
            { id: 'suinos', em: [104, 33], v: 42.55 / 54.04, fantasma: 1, tom: 'perda', nome: 'Carne suína na China', valor: i >= 4 ? '−21% em 2019' : '2018: 54 mi t', raio: 0.2 },
            { id: 'abate', em: [-50, -15], v: a[i] / maxA, fantasma: a[3] / maxA, tom: 'couro', nome: 'Abate no Brasil', valor: `${nf(a[i], 1)} mi de cabeças`, raio: 0.2 },
          ],
          alturaPeca: 1.6,
          camera: { pontos: [[-64, -34], [-38, -2], [178, 46], [100, 16], [30, -36]], dir: [0, 0.86, 0.6], margem: 1.0, alto: 1.6 },
        }
      },
      lado: ({ d }) => {
        const t = d.carne.CHN.mil_t
        const couro = (k: number) => (['wb', 'crust', 'acab'] as Estagio[]).reduce((s, e) => s + totalAno(d, e)[k], 0)
        return (
          <Corrente
            elos={[
              { valor: '−21%', nome: 'carne suína na China', sub: '2019, peste suína africana', tom: 'perda' },
              { valor: variacao(t[5] / t[3] - 1), nome: 'carne bovina do Brasil para a China', sub: 'toneladas, 2018–2020', tom: 'ambar' },
              { valor: variacao(d.abate[5] / d.abate[3] - 1), nome: 'bois abatidos no Brasil', sub: 'e peles, 2018–2020', tom: 'couro' },
              { valor: variacao(couro(5) / couro(3) - 1), nome: 'couro exportado pelo Brasil', sub: 'US$, 2018–2020', tom: 'perda' },
            ]}
          />
        )
      },
    },
  ],
}

/** O valor exportado em 2025 por destino, somando a cadeia do couro inteira. */
const valoresExp = (d: DadosExterno): [string, number][] =>
  Object.keys(d.exp)
    .filter((iso) => iso !== 'ZZZ')
    .map((iso) => [iso, (['cru', 'wb', 'crust', 'acab', 'outros', 'cab', 'calc', 'art'] as Estagio[]).reduce((s, e) => s + (d.exp[iso][e]?.[10] ?? 0), 0)] as [string, number])
    .filter(([, v]) => v > 0)

/** O valor importado em 2025 por origem, somando os insumos. */
const valoresImp = (d: DadosExterno): [string, number][] => {
  const m = new Map<string, number>()
  for (const ins of Object.values(d.imp)) for (const [iso, v] of ins.origens) m.set(iso, (m.get(iso) ?? 0) + v / 1000)
  return [...m]
}

function cenaGargalos(d: DadosExterno, valores: [string, number][], tom: 'couro' | 'tinta'): CenaPasso {
  const gs = partesNosGargalos(valores)
  const topo = [...valores].sort((a, b) => b[1] - a[1]).slice(0, 30)
  const max = topo[0]?.[1] ?? 1
  return {
    pinturas: topo.slice(0, 12).map(([iso, v]) => ({ iso, v: 0.06 + 0.3 * Math.sqrt(v / max), tom })),
    fluxos: [],
    rotulos: [],
    carga: {
      rotas: topo.filter(([iso]) => PORTO[iso]).map(([iso, v]) => ({ id: iso, pts: rota(BR, anc(d, iso)), peso: v / max, tom })),
      gargalos: gs.map((g) => ({ id: g.id, nome: g.nome, em: g.em, texto: pct(g.parte) })),
      velocidade: 1.6,
    },
    camera: MUNDO,
    densidade: true,
  }
}

const infoGargalos = (gs: ReturnType<typeof partesNosGargalos>, titulo: string): Info => {
  const max = gs[0]?.parte ?? 1
  return { titulo: `parte ${titulo} que passa por cada ponto, 2025`, colunas: gs.slice(0, 6).map((g) => ({ nome: CURTO_G[g.id] ?? g.nome, v: g.parte / max, rotulo: pct(g.parte), tom: 'couro' })) }
}

/* ---------- Exportações · Demanda ---------- */

const compradores: Analise = {
  chave: 'compradores',
  nome: 'Compradores',
  lado: 'demanda',
  passos: [
    {
      chave: 'para-onde',
      nome: 'Para onde vai',
      produto: true,
      ms: 16000,
      video: () => [0, 10],
      folha: ({ d, produto, i }) => ({ numero: usd(totalAno(d, produto as Estagio)[i]), palavra: `de ${curtoEstagio(produto)} vendidos pelo Brasil em ${d.anos[i]}` }),
      cena: ({ d, produto, i }) => {
        const e = produto as Estagio
        const ds = destinos(d, [e], i).slice(0, 14)
        const max = Math.max(...d.anos.map((_, k) => destinos(d, [e], k)[0]?.[1] ?? 0))
        return {
          pinturas: ds.map(([iso, v]) => ({ iso, v: 0.08 + 0.55 * Math.sqrt(v / max), tom: 'couro' })),
          fluxos: ds.map(([iso, v]) => ({ id: iso, de: BR, para: anc(d, iso), largura: larg(v, max), tom: 'couro', atraso: 0.2 })),
          rotulos: ds.slice(0, 6).map(([iso, v], k) => ({ id: iso, em: ondeFica(d, iso)!, texto: `${curto(d, iso)} ${nf(v / 1000, v < 1e4 ? 1 : 0)}`, forte: k < 3 })),
          camera: MUNDO,
          dica: (iso) => {
            const v = exportou(d, iso, [e], i)
            const v0 = exportou(d, iso, [e], 0)
            return v || v0 ? [nomeDe(d, iso), `${d.anos[i]}: ${usdTxt(v)}`, `2015: ${usdTxt(v0)}`] : [nomeDe(d, iso)]
          },
        }
      },
    },
    {
      chave: 'deslocamento',
      nome: 'Para onde foi',
      produto: true,
      ms: 12000,
      folha: ({ d, produto }) => {
        const { ganhos, perdas } = deslocamento(d, produto as Estagio)
        const g = ganhos[0]
        const p = perdas[0]
        if (!g) return { numero: { v: 0, sufixo: ' p.p.' }, palavra: 'sem mudança de 2015 a 2025' }
        return {
          numero: { v: g[1] * 100, casas: 1, sinal: true, sufixo: ' p.p.' },
          palavra: `na parte ${com('de', d, g[0])} nas vendas de ${curtoEstagio(produto)} do Brasil, de 2015 a 2025${p ? `; ${nomeDe(d, p[0])}, ${p[1] > 0 ? '+' : '−'}${nf(Math.abs(p[1]) * 100, 1)} p.p.` : ''}`,
        }
      },
      cena: ({ d, produto }) => {
        const e = produto as Estagio
        const { ganhos, perdas } = deslocamento(d, e)
        const todos = [...ganhos, ...perdas]
        const tot = totalAno(d, e)
        const parte = (iso: string, k: number) => exportou(d, iso, [e], k) / (tot[k] || 1)
        const maxV = Math.max(...todos.flatMap(([iso]) => [parte(iso, 0), parte(iso, 10)]), 1e-6)
        const maxG = Math.max(...ganhos.map(([, v]) => v), 1e-6)
        const de = perdas[0]?.[0]
        return {
          pinturas: todos.map(([iso, dv]) => ({ iso, v: 0.12, tom: dv > 0 ? 'ganho' : 'perda' })),
          fluxos: de ? ganhos.map(([iso, dv]) => ({ id: `${de}>${iso}`, de: anc(d, de), para: anc(d, iso), largura: larg(dv, maxG), tom: 'ganho', atraso: 1.2 })) : [],
          rotulos: [],
          pecas: todos
            .filter(([iso]) => ondeFica(d, iso))
            .map(([iso, dv]) => ({
              id: iso,
              em: ondeFica(d, iso)!,
              v: parte(iso, 10) / maxV,
              fantasma: parte(iso, 0) / maxV,
              tom: dv > 0 ? 'ganho' : 'perda',
              nome: curto(d, iso),
              valor: `${dv > 0 ? '+' : '−'}${nf(Math.abs(dv) * 100, 1)} p.p.`,
              raio: 0.3,
            })),
          alturaPeca: 3.2,
          camera: vistaDe(d, todos.map(([iso]) => iso), 1.2, 1.4),
        }
      },
    },
  ],
}

/** Quem mais ganhou e quem mais perdeu participação nas vendas do produto, de 2015 a 2025 (fração). */
function deslocamento(d: DadosExterno, e: Estagio) {
  const tot = totalAno(d, e)
  const dif = Object.keys(d.exp)
    .filter((iso) => iso !== 'ZZZ')
    .map((iso) => [iso, exportou(d, iso, [e], 10) / (tot[10] || 1) - exportou(d, iso, [e], 0) / (tot[0] || 1)] as [string, number])
  return {
    ganhos: dif.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4),
    perdas: dif.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 2),
  }
}

/** As importações de couro curtido por país (Comtrade), quando o arquivo já tem os importadores. */
const temImportadores = (d: DadosExterno) => {
  const imp = d.couroMundo?.importadores
  return imp && Object.values(imp).some((x) => x.mundo.some((v) => v)) ? imp : null
}
type Importadores = NonNullable<ReturnType<typeof temImportadores>>
/** O último ano que cada país declarou: o valor do mundo e o do Brasil nesse ano. */
const ultimoDoPais = (imp: Importadores, iso: string) => {
  const u = ultimo(imp[iso]?.mundo ?? [])
  return u ? { i: u.i, mundo: u.v, brasil: imp[iso]?.brasil[u.i] ?? 0 } : null
}

const PELA: Record<string, string> = {
  europa: 'pela periferia europeia',
  asia: 'pelo Sudeste Asiático',
  uruguai: 'pelo Uruguai',
  noruega: 'pela Noruega',
  africa: 'pela África Ocidental',
}
const JANELA_GRUPO: Record<string, string[]> = { europa: ['europa_centro'], asia: ['vietna'] }
const COURO_CURTIDO: Estagio[] = ['wb', 'crust', 'acab']

const potenciais: Analise = {
  chave: 'potenciais',
  nome: 'Mercados potenciais',
  lado: 'demanda',
  passos: NAO_OBVIOS.map(
    (g): Passo => ({
      chave: g.chave,
      nome: g.nome,
      produto: false,
      ms: 11000,
      folha: ({ d }) => {
        const imp = temImportadores(d)
        if (!imp) {
          const s = g.paises.reduce((a, iso) => a + exportou(d, iso, COURO_CURTIDO, 10), 0)
          return { numero: usd(s), palavra: `de couro do Brasil comprados ${PELA[g.chave]} em 2025` }
        }
        const us = g.paises.map((iso) => ultimoDoPais(imp, iso)).filter((x): x is NonNullable<typeof x> => x !== null)
        const m = us.reduce((a, x) => a + x.mundo, 0)
        const b = us.reduce((a, x) => a + x.brasil, 0)
        const anos = [...new Set(us.map((x) => d.anos[x.i]))].sort()
        const quando = anos.length === 1 ? `em ${anos[0]}` : 'no último ano de cada país'
        return {
          numero: { v: m, casas: m < 10 ? 1 : 0, prefixo: 'US$ ', sufixo: ' mi' },
          palavra: `de couro curtido comprados ${PELA[g.chave]} ${quando}; do Brasil, ${pct(b / (m || 1), b / (m || 1) < 0.1 ? 1 : 0)}`,
        }
      },
      cena: ({ d }) => {
        const imp = temImportadores(d)
        const mundo = (iso: string) => (imp ? ultimoDoPais(imp, iso)?.mundo ?? 0 : exportou(d, iso, COURO_CURTIDO, 10) / 1000)
        const brasil = (iso: string) => (imp ? ultimoDoPais(imp, iso)?.brasil ?? 0 : exportou(d, iso, COURO_CURTIDO, 10) / 1000)
        const anoMais = imp ? Math.max(...g.paises.map((iso) => ultimoDoPais(imp, iso)?.i ?? 0)) : 10
        const anoDe = (iso: string) => {
          const u = imp ? ultimoDoPais(imp, iso) : null
          return u && u.i < anoMais ? ` (${d.anos[u.i]})` : ''
        }
        const max = Math.max(...g.paises.map(mundo), 1e-6)
        const maxB = Math.max(...g.paises.map((iso) => exportou(d, iso, COURO_CURTIDO, 10)), 1)
        const um = g.paises.length === 1
        const alto = um ? 0.5 : 0.9
        const pecas: Peca[] = g.paises
          .filter((iso) => ondeFica(d, iso))
          .flatMap((iso): Peca[] => [
            {
              id: `${iso}-m`,
              em: ondeFica(d, iso)!,
              v: mundo(iso) / max,
              tom: 'tinta',
              nome: curto(d, iso),
              valor: imp ? `US$ ${nf(mundo(iso), mundo(iso) < 10 ? 1 : 0)} mi · Brasil ${pct(brasil(iso) / (mundo(iso) || 1))}${anoDe(iso)}` : `US$ ${nf(mundo(iso), mundo(iso) < 10 ? 1 : 0)} mi do Brasil`,
              raio: um ? 0.09 : 0.11,
            },
            ...(imp ? [{ id: `${iso}-b`, em: ondeFica(d, iso)!, v: brasil(iso) / max, tom: 'couro' as Tom, raio: um ? 0.045 : 0.055 }] : []),
          ])
        return {
          pinturas: g.paises.map((iso) => ({ iso, v: 0.08, tom: 'couro' })),
          fluxos: g.paises
            .filter((iso) => exportou(d, iso, COURO_CURTIDO, 10) > 0)
            .map((iso) => ({ id: iso, de: BR, para: anc(d, iso), largura: larg(exportou(d, iso, COURO_CURTIDO, 10), maxB) * 0.8, tom: 'couro', atraso: 0.6 })),
          rotulos: [],
          pecas,
          alturaPeca: alto,
          camera: um ? { pontos: perto(ondeFica(d, g.paises[0])!, 8), dir: [0.04, 0.84, 0.62], margem: 1.1, alto } : vistaDe(d, g.paises, 1.3, alto),
          detalhe: JANELA_GRUPO[g.chave],
          portos: false,
        }
      },
    }),
  ),
}

const luxo: Analise = {
  chave: 'luxo',
  nome: 'Mercado de luxo',
  lado: 'demanda',
  passos: [
    {
      chave: 'berco',
      nome: 'O berço',
      produto: false,
      ms: 13000,
      folha: ({ d }) => {
        const s = (k: number) => exportou(d, 'ITA', COURO_CURTIDO, k) + exportou(d, 'FRA', COURO_CURTIDO, k)
        return { numero: usd(s(10)), palavra: `de couro do Brasil para Itália e França em 2025, ${variacao(s(10) / s(0) - 1)} desde 2015` }
      },
      cena: ({ d }) => {
        const pol = [marcasPolos('ITA'), marcasPolos('FRA')]
        const n = (iso: string) => MAISONS.find((m) => m.iso === iso)?.curtumes.length ?? 0
        const max = Math.max(exportou(d, 'ITA', COURO_CURTIDO, 10), exportou(d, 'FRA', COURO_CURTIDO, 10), 1)
        return {
          pinturas: [
            { iso: 'ITA', v: 0.04, tom: 'couro' },
            { iso: 'FRA', v: 0.03, tom: 'couro' },
          ],
          fluxos: ['ITA', 'FRA'].map((iso) => ({ id: iso, de: BR, para: anc(d, iso), largura: larg(exportou(d, iso, COURO_CURTIDO, 10), max) * 0.7, tom: 'couro' as const })),
          rotulos: pol.flatMap((p) => p.rotulos),
          marcas: pol.flatMap((p) => p.marcas),
          pecas: [
            { id: 'ITA', em: [12.6, 42.6], v: n('ITA') / 7, tom: 'couro', nome: `${n('ITA')} curtumes`, valor: 'das maisons', raio: 0.06, lado: 'dir' },
            { id: 'FRA', em: [2.2, 46.8], v: n('FRA') / 7, tom: 'couro', nome: `${n('FRA')} curtumes`, valor: 'das maisons', raio: 0.06, lado: 'dir' },
          ],
          alturaPeca: 0.42,
          detalhe: ['italia', 'franca'],
          portos: false,
          camera: { pontos: [[-2.5, 50.8], [18.6, 50.8], [-2.5, 36.8], [18.6, 36.8]], dir: [0.05, 0.84, 0.62], margem: 1.0, alto: 0.42 },
        }
      },
    },
    {
      chave: 'muda',
      nome: 'O que muda',
      produto: false,
      ms: 16000,
      video: ({ d }) => [0, Math.min(ultimoAnoMundo(d, 'acab'), ultimoAnoMundo(d, 'art'))],
      folha: () => ({ numero: { v: BAIN.variacao2025 * 100, sufixo: '%' }, palavra: `no mercado de bens pessoais de luxo em 2025 (€ ${BAIN.mercado2025} bi); artigos de couro, ${BAIN.couroVar}` }),
      cena: ({ d, i }) => {
        const cm = d.couroMundo
        if (!cm) return { pinturas: [], fluxos: [], rotulos: [], camera: MUNDO }
        const pares = new Map<string, (number | null)[]>()
        for (const k of ['acab', 'art'] as Estagio[])
          for (const [de, para, s] of cm.produtos[k].fluxos) {
            if (de !== 'ITA' && de !== 'FRA') continue
            const id = `${de}>${para}`
            const a = pares.get(id) ?? s.map(() => null)
            pares.set(id, a.map((x, j) => (x === null && s[j] === null ? null : (x ?? 0) + (s[j] ?? 0))))
          }
        const maxF = Math.max(...[...pares.values()].flatMap((s) => s.map((x) => x ?? 0)), 1)
        const exp = (iso: string, k: number) => (['acab', 'art'] as Estagio[]).reduce((s, e) => s + (cm.produtos[e].exportadores.find(([x]) => x === iso)?.[1][k] ?? 0), 0)
        const maxE = Math.max(...d.anos.flatMap((_, k) => [exp('ITA', k), exp('FRA', k)]), 1)
        return {
          pinturas: [
            { iso: 'ITA', v: 0.45, tom: 'couro' },
            { iso: 'FRA', v: 0.4, tom: 'ambar' },
          ],
          fluxos: [...pares]
            .filter(([, s]) => (s[i] ?? 0) > 0)
            .map(([id, s]) => {
              const [de, para] = id.split('>')
              return { id, de: anc(d, de), para: anc(d, para), largura: larg(s[i]!, maxF), tom: (de === 'ITA' ? 'couro' : 'palido') as Fluxo['tom'], atraso: 0.2 }
            }),
          rotulos: [],
          pecas: ['ITA', 'FRA'].map((iso) => ({
            id: iso,
            em: ondeFica(d, iso)!,
            v: exp(iso, i) / maxE,
            fantasma: exp(iso, 0) / maxE,
            tom: (iso === 'ITA' ? 'couro' : 'ambar') as Tom,
            nome: nomeDe(d, iso),
            valor: `US$ ${nf(exp(iso, i) / 1000, 1)} bi`,
            raio: 0.12,
            lado: (iso === 'ITA' ? 'dir' : 'esq') as Peca['lado'],
          })),
          alturaPeca: 1.3,
          camera: { pontos: [[-100, 50], [138, 50], [-75, -20], [125, -5]], dir: [0, 0.88, 0.52], margem: 1.0, alto: 1.3 },
        }
      },
      info: () => ({
        titulo: 'bens pessoais de luxo em 2025, variação por região',
        colunas: BAIN.regioes.map(([r, t]) => {
          const n = (t.match(/[+−-]?\d+/g) ?? ['0']).map((x) => Number(x.replace('−', '-')))
          const m = n.length > 1 ? (n[0] + n[1]) / 2 : t.startsWith('estável') ? n[0] / 2 : n[0]
          return { nome: r.replace('Resto do mundo, com o Golfo', 'Resto do mundo').replace('China continental', 'China'), v: m / 7, rotulo: t.replace(' a ', '…').replace('estável…', '0…'), tom: (m < 0 ? 'perda' : 'ganho') as Tom }
        }),
      }),
    },
  ],
}

const automotivo: Analise = {
  chave: 'automotivo',
  nome: 'Automotivo',
  lado: 'demanda',
  passos: [
    {
      chave: 'polos',
      nome: 'Polos dos bancos',
      produto: false,
      ms: 12000,
      folha: ({ d }) => ({
        numero: usd(POLOS_AUTO.servidos.reduce((a, iso) => a + exportou(d, iso, ['acab'], 10), 0)),
        palavra: 'de couro acabado para os polos que cortam e costuram bancos de carro, 2025',
      }),
      cena: ({ d }) => {
        const v = (iso: string) => exportou(d, iso, ['acab'], 10)
        const max = Math.max(...POLOS_AUTO.servidos.map(v), 1)
        const lugares: [string, LonLat, string][] = [
          ['MEX', [-101.686, 21.122], 'León'],
          ['HUN', [20.183, 47.175], 'Szolnok'],
        ]
        return {
          pinturas: [...POLOS_AUTO.servidos.map((iso) => ({ iso, v: 0.3, tom: 'couro' as Tom })), ...POLOS_AUTO.semBrasil.map((iso) => ({ iso, v: 0.3, tom: 'perda' as Tom }))],
          fluxos: POLOS_AUTO.servidos.map((iso) => ({ id: iso, de: BR, para: anc(d, iso), largura: larg(v(iso), max), tom: 'couro' as const, atraso: 0.3 })),
          rotulos: lugares.map(([iso, em, n]) => ({ id: `l-${iso}`, em, texto: n, lado: 'dir' as const })),
          marcas: lugares.map(([iso, em]) => ({ id: `l-${iso}`, em, raio: 0.06, tom: 'couro' as Tom, pulsa: true })),
          pecas: [
            ...POLOS_AUTO.servidos.map((iso) => ({ id: iso, em: ondeFica(d, iso)!, v: v(iso) / max, tom: 'couro' as Tom, nome: curto(d, iso), valor: usdTxt(v(iso)), raio: 0.09 })),
            ...POLOS_AUTO.semBrasil.map((iso) => ({ id: iso, em: ondeFica(d, iso)!, v: 0.06, tom: 'perda' as Tom, nome: curto(d, iso), valor: 'sem o Brasil', raio: 0.09 })),
          ],
          alturaPeca: 1.0,
          camera: { pontos: [[-108, 30], [32, 54], [-98, 14], [11, 32]], dir: [0, 0.86, 0.56], margem: 1.05, alto: 1.0 },
        }
      },
    },
    {
      chave: 'eletricos',
      nome: 'Elétricos',
      produto: false,
      ms: 12000,
      video: () => [0, NEVP_ANOS.length - 1],
      ano: (i) => String(NEVP_ANOS[i]),
      folha: ({ i }) => {
        const [v, tipo] = NEVP.find((n) => n.iso === 'CHN')!.v[i]
        return {
          numero: { v, casas: v < 10 ? 1 : 0, sufixo: '%' },
          palavra: `dos carros novos da China são elétricos em ${NEVP_ANOS[i]}${tipo === 'P' ? ', na projeção da EIU' : tipo === 'E' ? ', na estimativa da EIU' : ''}`,
        }
      },
      cena: ({ d, i }) => ({
        pinturas: NEVP.map((n) => ({ iso: n.iso, v: 0.2 + n.v[i][0] / 120, tom: n.iso === 'BRA' ? 'couro' : 'ambar' })),
        fluxos: [],
        rotulos: [],
        pecas: NEVP.map((n) => ({ id: n.iso, em: ondeFica(d, n.iso)!, v: n.v[i][0] / 100, tom: (n.iso === 'BRA' ? 'couro' : 'ambar') as Tom, nome: n.nome, valor: `${nf(n.v[i][0], n.v[i][0] < 10 ? 1 : 0)}%${n.v[i][1] === 'P' ? ' proj.' : ''}`, raio: 0.14 })),
        alturaPeca: 2.0,
        camera: { ...MUNDO, alto: 2.0 },
      }),
    },
  ],
}

/* ---------- Importações · Oferta ---------- */

const origens: Analise = {
  chave: 'origens',
  nome: 'Origens',
  lado: 'oferta',
  passos: [
    {
      chave: 'de-onde',
      nome: 'De onde vem',
      produto: true,
      ms: 16000,
      video: () => [0, 10],
      folha: ({ d, produto, i }) => ({ numero: usd(importouAno(d, produto)[i]), palavra: `de importações de ${d.imp[produto].nome.toLowerCase()} em ${d.anos[i]}` }),
      cena: ({ d, produto, i }) => {
        const s = d.impAno[produto] ?? {}
        const ano = Object.entries(s)
          .filter(([, v]) => v[i] > 0)
          .sort((a, b) => b[1][i] - a[1][i])
          .slice(0, 12)
        const max = Math.max(...Object.values(s).flatMap((v) => v), 1)
        return {
          pinturas: ano.map(([iso, v]) => ({ iso, v: 0.08 + 0.55 * Math.sqrt(v[i] / max), tom: GOLFO.has(iso) ? 'perda' : 'couro' })),
          fluxos: ano.map(([iso, v]) => ({ id: iso, de: anc(d, iso), para: BR, largura: larg(v[i], max), tom: GOLFO.has(iso) ? 'vermelho' : 'palido', atraso: 0.2 })),
          rotulos: ano.slice(0, 6).map(([iso, v], k) => ({ id: iso, em: ondeFica(d, iso)!, texto: `${curto(d, iso)} ${nf(v[i] / 1000, v[i] < 1e4 ? 1 : 0)}`, forte: k < 3 })),
          camera: MUNDO,
          dica: (iso) => (s[iso] ? [nomeDe(d, iso), `${d.anos[i]}: ${usdTxt(s[iso][i])}`, `2015: ${usdTxt(s[iso][0])}`] : [nomeDe(d, iso)]),
        }
      },
    },
    {
      chave: 'domina',
      nome: 'Quem domina',
      produto: true,
      ms: 11000,
      folha: ({ d, produto }) => {
        const { iso, parte } = dominante(d, produto)
        if (!iso) return { numero: { v: 0 }, palavra: 'sem importação em 2025' }
        const art = ART_INS[produto] ?? 'do'
        return {
          numero: { v: parte[10] * 100, sufixo: '%' },
          palavra: `${art} ${d.imp[produto].nome.toLowerCase()} que o Brasil importa ${art.endsWith('s') ? 'vêm' : 'vem'} ${com('de', d, iso)} (2025); em 2015, ${pct(parte[0])}`,
        }
      },
      cena: ({ d, produto }) => {
        const { iso, topo } = dominante(d, produto)
        if (!iso) return { pinturas: [], fluxos: [], rotulos: [], camera: MUNDO }
        const s = d.impAno[produto]
        const tot = importouAno(d, produto)
        const { camera, detalhe } = enquadreDe(d, iso)
        const pol = marcasPolos(iso)
        const outros = topo.filter((x) => x !== iso && ondeFica(d, x)).slice(0, 4)
        return {
          pinturas: [{ iso, v: 0.08, tom: GOLFO.has(iso) ? 'perda' : 'couro' }, ...outros.map((x) => ({ iso: x, v: 0.04, tom: 'tinta' as Tom }))],
          fluxos: [{ id: iso, de: anc(d, iso), para: BR, largura: 3.5, tom: 'couro' }],
          rotulos: [...pol.rotulos, { id: iso, em: ondeFica(d, iso)!, texto: `${nomeDe(d, iso)} · ${pct(s[iso][10] / (tot[10] || 1))}`, forte: true, lado: 'cima' }],
          marcas: pol.marcas,
          camera,
          detalhe,
        }
      },
    },
  ],
}

function dominante(d: DadosExterno, produto: string) {
  const s = d.impAno[produto] ?? {}
  const tot = importouAno(d, produto)
  const topo = Object.entries(s)
    .sort((a, b) => b[1][10] - a[1][10])
    .map(([iso]) => iso)
  const iso = topo[0]
  return { iso, topo, parte: iso ? d.anos.map((_, k) => (tot[k] ? s[iso][k] / tot[k] : 0)) : [] }
}

const precificacaoImp: Analise = {
  chave: 'precificacao',
  nome: 'Precificação',
  lado: 'oferta',
  passos: [
    {
      chave: 'quilo',
      nome: 'Preço por quilo',
      produto: true,
      ms: 14000,
      folha: ({ d, produto }) => {
        const ins = d.imp[produto]
        const s = d.precoImpMes[produto]
        if (!s) return { numero: usd(ins.usd / 1000), palavra: `de importações de ${ins.nome.toLowerCase()} em 2025` }
        const p25 = ins.kg ? ins.usd / ins.kg : (mediaAno(d.meses, s, 2025) ?? 0)
        const p15 = mediaAno(d.meses, s, 2015) ?? p25
        const casas = p25 < 1 ? 3 : 2
        return { numero: { v: p25, casas, prefixo: 'US$ ', sufixo: '/kg' }, palavra: `${variacao(p25 / p15 - 1)} sobre 2015 (US$ ${nf(p15, casas)})` }
      },
      cena: ({ d, produto }) => {
        const chaves = Object.keys(d.precoImpMes)
        const anual = (k: string) => d.anos.map((a) => mediaAno(d.meses, d.precoImpMes[k], a))
        const muda = (k: string) => {
          const v = anual(k)
          return v[0] && v[10] ? v[10] / v[0] - 1 : 0
        }
        const subida = [...chaves].sort((a, b) => muda(b) - muda(a))
        const nomeados = new Set([produto, ...subida.slice(0, 3)])
        const series: Trelica['series'] = chaves.map((k) => ({
          id: k,
          nome: d.imp[k]?.nome ?? k,
          v: anual(k),
          tom: k === produto ? 'couro' : muda(k) > 0.1 ? 'perda' : muda(k) < -0.1 ? 'ganho' : 'tinta',
          forte: k === produto,
          rotulo: nomeados.has(k) ? `${d.imp[k]?.nome ?? k} ${variacao(muda(k))}` : undefined,
        }))
        const em: LonLat = [-21, -6]
        const tr: Trelica = { em, altura: ALTURA_TRELICA, largura: 6.4, alto: ALTO_TRELICA, fundo: 1.5, anos: d.anos.map(String), series, ultimo: 10, marca: '2025 · último ano completo', eixo: [[0, '2015'], [5, '2020'], [10, '2025']] }
        return { pinturas: [], fluxos: [], rotulos: [], trelica: tr, camera: cameraTrelica(em) }
      },
    },
  ],
}

/* As rotas dos petroleiros no Golfo, dos terminais ao estreito e ao mar Arábico (como no painel-comandante). */
const ESTREITO: LonLat = [56.36, 26.6]
const TRONCO: LonLat[] = [[48.95, 29.55], [49.9, 28.75], [50.9, 27.85], [52.2, 27.0], [53.6, 26.4], [54.9, 26.2], [55.8, 26.35], ESTREITO, [56.75, 26.1], [57.15, 25.4], [57.9, 24.9], [59.0, 24.35], [60.4, 23.6], [62.4, 22.6]]
const RAMAIS: { de: LonLat[]; junta: number; nome: string }[] = [
  { de: [[50.3, 29.2], [50.55, 28.6]], junta: 2, nome: 'Kharg' },
  { de: [[50.2, 26.7], [50.9, 27.3]], junta: 3, nome: 'Ras Tanura' },
  { de: [[51.6, 25.95], [52.5, 26.45]], junta: 4, nome: 'Ras Laffan' },
  { de: [[52.65, 24.25], [53.4, 25.2], [54.1, 25.95]], junta: 5, nome: 'Ruwais' },
  { de: [[55.0, 25.05], [55.35, 25.8]], junta: 6, nome: 'Jebel Ali' },
  { de: [[56.25, 27.1]], junta: 7, nome: 'Bandar Abbas' },
]
const CORTE: [LonLat, LonLat] = [
  [56.3, 26.36],
  [56.44, 26.9],
]

const criticidadeImp: Analise = {
  chave: 'criticidade',
  nome: 'Criticidade logística',
  lado: 'oferta',
  passos: [
    {
      chave: 'passagens',
      nome: 'Pontos de passagem',
      produto: false,
      ms: 13000,
      folha: ({ d }) => {
        const g = partesNosGargalos(valoresImp(d))[0]
        return g ? { numero: { v: g.parte * 100, sufixo: '%' }, palavra: `do que o Brasil compra para o couro e o boi passa ${PELO[g.id]}` } : { numero: { v: 0 }, palavra: 'sem gargalo nas rotas' }
      },
      cena: ({ d }) => cenaGargalos(d, valoresImp(d), 'tinta'),
      info: ({ d }) => infoGargalos(partesNosGargalos(valoresImp(d)), 'do que o Brasil compra para o couro e o boi'),
    },
    {
      chave: 'ormuz',
      nome: 'Ormuz',
      produto: false,
      ms: 12000,
      folha: ({ d }) => {
        const it = [...d.ormuz.itens].sort((a, b) => b.dentro - a.dentro)[0]
        return { numero: { v: it.dentro * 100, sufixo: '%' }, palavra: `do ${it.nome.toLowerCase()} comprado pelo Brasil sai de dentro do Golfo; o estreito fechou em março de 2026` }
      },
      cena: () => {
        const rotas: RotaCarga[] = [
          { id: 'tronco', pts: TRONCO, peso: 0.55, corte: ESTREITO },
          ...RAMAIS.map((r) => ({ id: r.nome, pts: [...r.de, ...TRONCO.slice(r.junta)], peso: 0.3, corte: ESTREITO })),
        ]
        return {
          pinturas: [],
          fluxos: [],
          rotulos: [
            { id: 'golfo', em: [51.4, 27.6], texto: 'Golfo Pérsico', classe: 'agua', lado: 'cima' },
            { id: 'oma', em: [58.9, 24.9], texto: 'Golfo de Omã', classe: 'agua', lado: 'cima' },
            ...RAMAIS.map((r) => ({ id: r.nome, em: r.de[0], texto: r.nome, lado: 'esq' as const })),
          ],
          carga: {
            rotas,
            gargalos: [{ id: 'ormuz', nome: 'Estreito de Ormuz', em: [56.45, 26.55], fechado: true, raio: 0.035 }],
            fechaEm: 2.4,
            linhasDeCorte: [CORTE],
            velocidade: 0.11,
            tamanho: 4.4,
          },
          detalhe: ['golfo'],
          portos: false,
          camera: { pontos: [[48.5, 30], [60.5, 22.5], [56.4, 26.6]], dir: [0.15, 0.9, 0.62], margem: 0.92 },
        }
      },
      info: ({ d }) => {
        const its = [...d.ormuz.itens].filter((x) => x.dentro >= 0.01).sort((a, b) => b.dentro - a.dentro).slice(0, 5)
        return { titulo: 'parte comprada de dentro do Golfo, 2025', reguas: [[0.5, '25%'], [1, '50%']], colunas: its.map((x) => ({ nome: x.nome, v: x.dentro / 0.5, rotulo: pct(x.dentro), tom: 'perda' as Tom })) }
      },
    },
  ],
}

/* ---------- Importações · Demanda ---------- */

/** Um insumo como a figura o mostra: o nome, o valor de 2025 e a maior origem. */
function insumoNaFigura(d: DadosExterno, g: string): Estacao['insumos'][number] | null {
  const ins = d.imp[g]
  if (!ins || !ins.usd) return null
  const [iso, v] = ins.origens[0] ?? ['', 0]
  return { nome: ins.nome, v: ins.usd, valor: usdTxt(ins.usd / 1000), origem: iso ? `${curto(d, iso)} ${pct(v / ins.usd)}` : undefined, golfo: GOLFO.has(iso) }
}
const somaUsd = (d: DadosExterno, chaves: string[]) => chaves.reduce((a, g) => a + (d.imp[g]?.usd ?? 0), 0)

const CURTUME: { nome: string; chaves: string[] }[] = [
  { nome: 'Couro', chaves: ['couros'] },
  { nome: 'Ribeira', chaves: ['sulfeto'] },
  { nome: 'Curtimento', chaves: ['cromo', 'formico'] },
  { nome: 'Recurtimento', chaves: ['recurtentes', 'engraxe', 'taninos'] },
  { nome: 'Acabamento', chaves: ['acabamento'] },
]
const ADUBOS = ['kcl', 'ureia', 'map_dap', 'sulfato_amonio', 'enxofre']

const curtume: Analise = {
  chave: 'curtume',
  nome: 'O curtume',
  lado: 'demanda',
  passos: [
    {
      chave: 'curtume',
      nome: 'O curtume',
      produto: false,
      ms: 13000,
      folha: ({ d }) => ({
        numero: usd(somaUsd(d, [...CURTUME.flatMap((e) => e.chaves), 'maquinas']) / 1000),
        palavra: 'de insumos importados que entram no curtume em 2025, sem os corantes, que a indústria têxtil também compra',
      }),
      cena: ({ d }) => cenaOrigens(d, [...CURTUME.flatMap((e) => e.chaves), 'maquinas']),
      figura: ({ d }) => (
        <FiguraProcesso
          estacoes={CURTUME.map((e) => ({ nome: e.nome, insumos: e.chaves.map((g) => insumoNaFigura(d, g)).filter((x): x is NonNullable<typeof x> => x !== null) }))}
          faixa={insumoNaFigura(d, 'maquinas') ?? undefined}
          faixaNome="em todas as etapas"
        />
      ),
    },
  ],
}

const boi: Analise = {
  chave: 'boi',
  nome: 'O boi',
  lado: 'demanda',
  passos: [
    {
      chave: 'boi',
      nome: 'O boi',
      produto: false,
      ms: 13000,
      folha: ({ d }) => ({ numero: usd(somaUsd(d, ADUBOS) / 1000), palavra: 'de adubos importados em 2025, para lavouras e pastos: é por eles que o boi depende de fora' }),
      cena: ({ d }) => cenaOrigens(d, ADUBOS),
      figura: ({ d }) => (
        <FiguraProcesso
          estacoes={[
            { nome: 'Adubo', insumos: ADUBOS.map((g) => insumoNaFigura(d, g)).filter((x): x is NonNullable<typeof x> => x !== null) },
            { nome: 'Pasto e milho', insumos: [] },
            { nome: 'Boi', insumos: [] },
            { nome: 'Abate', insumos: [], nota: `${nf(d.abate[10], 1)} mi de cabeças em 2025` },
            { nome: 'Pele', insumos: [], nota: 'uma por boi abatido' },
          ]}
        />
      ),
    },
  ],
}

function cenaOrigens(d: DadosExterno, chaves: string[]): CenaPasso {
  const m = new Map<string, number>()
  for (const g of chaves) for (const [iso, v] of d.imp[g]?.origens ?? []) m.set(iso, (m.get(iso) ?? 0) + v)
  const max = Math.max(...m.values(), 1)
  return { pinturas: [...m].map(([iso, v]) => ({ iso, v: 0.15 + 0.9 * Math.sqrt(v / max), tom: 'couro' as Tom })), fluxos: [], rotulos: [], camera: MUNDO, apagar: true }
}

/* ---------- as listas ---------- */

export const ANALISES: Record<Sentido, Analise[]> = {
  exp: [ofertantes, precificacao, criticidadeExp, compradores, potenciais, luxo, automotivo],
  imp: [origens, precificacaoImp, criticidadeImp, curtume, boi],
}
export const NOME_SENTIDO: Record<Sentido, string> = { exp: 'Exportações', imp: 'Importações' }
export const NOME_LADO: Record<Lado, string> = { oferta: 'Oferta', demanda: 'Demanda' }
