// Tabelas do relatório "Comércio exterior do couro: bases para reformular a análise do mercado externo"
// (Painel Viposa/Viposa_Comercio_Exterior_do_Couro.docx, 18/11/2026), cada uma com a sua fonte.
// O que é estimativa de modelo (ITC) ou projeção (EIU) fica marcado assim.

/** UN Comtrade 2024: maiores exportadores e importadores, parcela do valor mundial (declarante: o exportador ou o importador). */
export const MUNDO_2024: Record<string, { nome: string; mercado: string; brasil: string; exportadores: [string, number][]; importadores: [string, number][] }> = {
  cru: {
    nome: 'Couro cru (4101)',
    mercado: 'US$ 2,45 bi',
    brasil: '19º (1%)',
    exportadores: [['USA', 0.26], ['NLD', 0.08], ['FRA', 0.07], ['AUS', 0.07], ['BRA', 0.01]],
    importadores: [],
  },
  wb: {
    nome: 'Wet blue e crust (4104)',
    mercado: 'US$ 2,69 bi',
    brasil: '1º (24%)',
    exportadores: [['BRA', 0.24], ['USA', 0.17], ['ITA', 0.1], ['ARG', 0.06], ['CHN', 0.06]],
    importadores: [['CHN', 0.33], ['ITA', 0.17], ['THA', 0.1], ['IND', 0.05], ['IDN', 0.03], ['MEX', 0.03], ['ESP', 0.03], ['KHM', 0.03]],
  },
  acab: {
    nome: 'Couro acabado (4107)',
    mercado: 'US$ 7,03 bi',
    brasil: '3º (8%)',
    exportadores: [['ITA', 0.31], ['CHN', 0.1], ['BRA', 0.08], ['THA', 0.07], ['IND', 0.04]],
    importadores: [['CHN', 0.09], ['IDN', 0.08], ['USA', 0.06], ['FRA', 0.05], ['ITA', 0.05], ['HKG', 0.05], ['MEX', 0.05], ['DEU', 0.04], ['ROU', 0.03], ['IND', 0.03], ['SRB', 0.03]],
  },
  bolsas: {
    nome: 'Bolsas de couro (4202.21)',
    mercado: 'US$ 17,9 bi',
    brasil: '47º (0,03%)',
    exportadores: [['FRA', 0.35], ['ITA', 0.3], ['HKG', 0.06], ['CHN', 0.04]],
    importadores: [['CHN', 0.13], ['USA', 0.12], ['HKG', 0.09], ['FRA', 0.08], ['KOR', 0.06], ['MAC', 0.05]],
  },
}
export const FONTE_COMTRADE = 'UN Comtrade, 2024 (último ano completo), valores declarados pelos exportadores e pelos importadores'

/** ITC, Export Potential Indicator (painel Potencial de Exportações do Observatório FIESC): estimativa, US$ milhões por ano. */
export const ITC: { chave: string; nome: string; potencial: number; realizado: number; mercados: [string, number][] }[] = [
  { chave: 'wb', nome: 'Wet blue (4104.11)', potencial: 384, realizado: 330, mercados: [['VNM', 19.7], ['MEX', 11.7], ['ITA', 9.7], ['THA', 9.2], ['POL', 7.4], ['PRY', 6.5], ['DOM', 5.3], ['ESP', 4.5], ['IND', 4.4], ['TUR', 3.7]] },
  { chave: 'crust', nome: 'Crust (4104.41)', potencial: 222, realizado: 188, mercados: [['URY', 46.8], ['THA', 8.1], ['IND', 7.3], ['ARG', 6.5], ['MEX', 6.1], ['PRT', 3.4], ['ESP', 2.6], ['POL', 2.5]] },
  { chave: 'acab', nome: 'Couro acabado (4107.12)', potencial: 341, realizado: 395, mercados: [['USA', 18.7], ['HKG', 12.0], ['VNM', 9.7], ['PRT', 9.2], ['ESP', 7.9], ['SVN', 7.7], ['FRA', 6.7], ['IND', 6.6], ['GBR', 6.1], ['TUN', 5.0], ['ROU', 4.8], ['BIH', 4.5], ['SRB', 4.2]] },
  { chave: 'partes', nome: 'Couro acabado em partes (4107.92)', potencial: 116, realizado: 114, mercados: [['CHN', 7.7], ['BGD', 3.7], ['HKG', 3.3], ['IDN', 3.1], ['UKR', 3.0], ['PRT', 2.7], ['ESP', 2.6], ['PHL', 2.5], ['KHM', 2.3]] },
  { chave: 'cab', nome: 'Cabedais (6406.10)', potencial: 64, realizado: 81, mercados: [['ITA', 11.8], ['VNM', 6.1], ['USA', 3.1], ['PRT', 2.4], ['KOR', 2.3], ['CHN', 2.1], ['IDN', 1.8], ['TUN', 1.5]] },
  { chave: 'calc', nome: 'Calçados de couro (6403.99)', potencial: 262, realizado: 287, mercados: [['CHN', 17.6], ['DEU', 12.6], ['NLD', 9.4], ['ITA', 6.9], ['ESP', 6.9], ['KOR', 4.6], ['BEL', 4.2], ['JPN', 4.0]] },
]
export const FONTE_ITC = 'Painel Potencial de Exportações (Observatório FIESC), metodologia EPI do International Trade Centre: estimativa do modelo, não comércio observado'

/** Acordo Mercosul–UE (aplicação provisória desde 01/05/2026): tarifa-base e ano em que zera. */
export type LinhaTarifa = { produto: string; base: number; zera: number | null; nota: string }
export const UE_VENDA: LinhaTarifa[] = [
  { produto: 'Couro cru e wet blue', base: 0, zera: 2025, nota: 'já entrava sem tarifa' },
  { produto: 'Cabedais de couro', base: 3, zera: 2026, nota: 'zero de imediato; 99% dos cabedais vão à UE' },
  { produto: 'Bolsas e carteiras de couro', base: 3, zera: 2026, nota: 'zero de imediato' },
  { produto: 'Crust', base: 6.5, zera: 2030, nota: 'categoria 4' },
  { produto: 'Couro acabado', base: 6.5, zera: 2030, nota: 'categoria 4' },
  { produto: 'Calçados de couro', base: 8, zera: 2033, nota: 'categoria 7, inclusive os de segurança' },
]
export const UE_COMPRA: (LinhaTarifa & { insumo?: string })[] = [
  { produto: 'Máquinas para couro e calçado', base: 14, zera: 2036, nota: 'categoria 10', insumo: 'maquinas' },
  { produto: 'Preparações para tratar couro', base: 14, zera: 2036, nota: 'categoria 10', insumo: 'engraxe' },
  { produto: 'Agentes de acabamento', base: 14, zera: 2036, nota: 'categoria 10', insumo: 'acabamento' },
  { produto: 'Corantes', base: 13, zera: 2036, nota: '12% a 14%; pigmentos excluídos', insumo: 'corantes' },
  { produto: 'Recurtentes sintéticos', base: 10, zera: 2036, nota: 'categoria 10', insumo: 'recurtentes' },
  { produto: 'Sulfato de cromo', base: 10, zera: null, nota: 'excluído do acordo', insumo: 'cromo' },
]
export const FONTE_UE = 'Acordo Mercosul–UE, Apêndices 2-A-1 e 2-A-2 (Siscomex); bases a confirmar no TARIC. Desgravação em parcelas anuais iguais, a partir de 2026'

/** A tarifa que resta num ano, com a desgravação em parcelas iguais de 2026 até o ano em que zera. */
export function tarifaNoAno(l: LinhaTarifa, ano: number) {
  if (l.zera === null) return l.base
  if (ano >= l.zera) return 0
  const passos = l.zera - 2025
  return (l.base * (l.zera - ano)) / passos
}

/** Bain & Company: bens pessoais de luxo. */
export const BAIN = {
  mercado2025: 358, // € bi
  variacao2025: -0.02,
  couro2025: 74,
  couroVar: '−5% a −7%',
  calcados2025: 24,
  cenario2026: '+2% a +4%',
  regioes: [
    ['China continental', '−6% a −8%'],
    ['Japão', '−6% a −8%'],
    ['Europa', '−1% a −3%'],
    ['Américas', 'estável a +2%'],
    ['Resto do mundo, com o Golfo', '+4% a +6%'],
  ] as [string, string][],
  fonte: 'Bain & Company, 18/12/2025 e 25/06/2026 (câmbio corrente; 2026 a câmbio constante)',
}

/** Curtumes comprados pelas maisons desde 2010 (imprensa setorial e comunicado da Prada), por país do curtume. */
export const MAISONS: { iso: string; curtumes: string[] }[] = [
  { iso: 'FRA', curtumes: ['Tanneries Roux (LVMH)', 'France Croco (Kering)', "Tannerie d'Annonay (Hermès)", 'Tanneries du Puy (Hermès)', 'Bodin-Joyeux (Chanel)', 'Tannerie Limoges (Prada, até 2025)'] },
  { iso: 'ITA', curtumes: ['Masoni (LVMH, minoritária)', 'Grupo Colonna (Kering)', 'Samanta (Chanel)', 'Gaiera Giovanni (Chanel)', 'Nuova Impala (Chanel, 20%)', 'Conceria Superior (Prada, até 2025)', 'Rino Mastrotto (Prada, 10%)'] },
  { iso: 'ESP', curtumes: ['Verdeveleno (LVMH)', 'Colomer (Chanel)'] },
  { iso: 'SGP', curtumes: ['Heng Long (LVMH, 51%)'] },
]

/** Onde se corta e costura o banco de couro (imprensa setorial). */
export const POLOS_AUTO = {
  servidos: ['MEX', 'DEU', 'SVK', 'HUN', 'TUN', 'POL'],
  semBrasil: ['ROU', 'SRB'],
  plantas: [
    { iso: 'HUN', texto: 'Lear/Eagle Ottawa: corte em Szolnok (2016)' },
    { iso: 'MEX', texto: 'Bader em León; Pasubio no México' },
  ],
  fonte: 'Comex Stat 2025 (couro curtido por destino); UN Comtrade 2024; just-auto (21/04/2016); LeatherBiz',
}

/** EIU, série NEVP: elétricos em % dos carros de passeio novos. R realizado, E estimativa, P projeção. */
export const NEVP: { iso: string; nome: string; v: [number, string][] }[] = [
  { iso: 'CHN', nome: 'China', v: [[25.0, 'R'], [41.0, 'R'], [52.5, 'E'], [53.1, 'P'], [76.0, 'P']] },
  { iso: 'FRA', nome: 'França', v: [[21.5, 'R'], [25.4, 'R'], [26.7, 'R'], [46.2, 'E'], [88.8, 'P']] },
  { iso: 'MEX', nome: 'México', v: [[1.7, 'E'], [4.3, 'E'], [14.5, 'E'], [18.8, 'P'], [45.3, 'P']] },
  { iso: 'BRA', nome: 'Brasil', v: [[1.2, 'R'], [6.4, 'R'], [7.6, 'R'], [8.2, 'P'], [12.8, 'P']] },
]
export const NEVP_ANOS = [2022, 2024, 2025, 2026, 2030]

/** Mercados não óbvios (seção 7.3 do relatório). */
export const NAO_OBVIOS: { chave: string; nome: string; paises: string[]; texto: string }[] = [
  {
    chave: 'europa',
    nome: 'Periferia europeia',
    paises: ['PRT', 'ESP', 'SVN', 'ROU', 'SRB', 'BIH', 'POL', 'SVK', 'TUN'],
    texto: 'Polos de corte e costura de calçados, estofados e interiores de veículos que abastecem a UE. Concentram potencial não realizado de couro acabado e de crust.',
  },
  {
    chave: 'asia',
    nome: 'Sudeste Asiático',
    paises: ['VNM', 'KHM', 'IDN', 'BGD', 'PHL'],
    texto: 'Compram wet blue, crust e acabado para calçados e artigos.',
  },
  {
    chave: 'uruguai',
    nome: 'Uruguai',
    paises: ['URY'],
    texto: 'O maior potencial não realizado de crust: o país termina e reexporta couro.',
  },
  {
    chave: 'noruega',
    nome: 'Noruega',
    paises: ['NOR'],
    texto: 'Comprou US$ 12 milhões de couro acabado em 2025. Provavelmente estofados (a confirmar).',
  },
  {
    chave: 'africa',
    nome: 'África Ocidental',
    paises: ['NGA', 'TGO', 'GHA'],
    texto: 'A Nigéria consome mais de 700 mil t por ano de ponmo, pele bovina processada para alimentação (adido agrícola do MAPA em Abuja, 14/07/2025). A ligação com o couro cru brasileiro é hipótese a confirmar.',
  },
]
