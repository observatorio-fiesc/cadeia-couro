// Dados da aba Modelo 3D: paleta do painel Floresta e pecuária, química de cada região da pele,
// camadas do couro e o que cada uma pode virar, o que mantém o animal e a dependência externa dos insumos.
// Dosagens: faixas do BREF europeu de curtumes (2013). O valor usado no desenho é um ponto dentro da faixa,
// ilustrativo: a receita da Viposa não é pública.
import type { RegiaoId } from './forma'

// paleta do painel Floresta e pecuária (painel_rascunho.html)
export const PALETA = {
  fundo: '#14110d',
  painel: '#1c1712',
  painel2: '#251f18',
  linha: '#362d23',
  linha2: '#4a3e31',
  tinta: '#f2e9da',
  tinta2: '#d9ccb6',
  apagado: '#a8987f',
  fraco: '#7a6c58',
  mata: '#5fa874',
  capim: '#a7bd6b',
  rio: '#5daed2',
  couro: '#cf8a52',
  madeira: '#dcb064',
  argila: '#cf6a4a',
  palha: '#efd28c',
}
export const RAMPAS = {
  mata: ['#241e17', '#2f4a33', '#3f7a4e', '#5fa874', '#9fd49a'],
  couro: ['#241e17', '#5a3a24', '#8f5a35', '#cf8a52', '#f0c08f'],
  capim: ['#241e17', '#46502c', '#6f843f', '#a7bd6b', '#d6e3a4'],
}

// ---------------------------------------------------------------- dependência externa (lente)
// sim: o Brasil depende de importação; nao: o Brasil produz; sd: falta dado de produção nacional
export type Dep = 'sim' | 'nao' | 'sd'
export const COR_DEP: Record<Dep, string> = { sim: PALETA.argila, nao: PALETA.mata, sd: PALETA.fraco }
export const NOME_DEP: Record<Dep, string> = { sim: 'depende de importação', nao: 'o Brasil produz', sd: 'sem dado de produção nacional' }

export type Quimico = {
  id: string
  nome: string
  detalhe: string
  cor: string
  faixa: string
  valor: number // % usado no desenho (dentro da faixa)
  dep: Dep
  depNota: string
}

// ribeira e curtimento (Várzea Grande, MT)
export const QUIMICOS_MT: Quimico[] = [
  { id: 'cal', nome: 'Cal hidratada', detalhe: 'incha a pele e solta o pelo', cor: PALETA.palha, faixa: '3–6%', valor: 4.5, dep: 'nao', depNota: 'calcário e cal nacionais; a importação de cal foi de 60 mil t em 2025' },
  { id: 'sulfeto', nome: 'Sulfeto de sódio', detalhe: 'dissolve o pelo', cor: RAMPAS.couro[2], faixa: '1–5%', valor: 3, dep: 'sd', depNota: '20 mil t importadas em 2025, sem exportação; falta dado de produção nacional' },
  { id: 'aux', nome: 'Tensoativos, enzimas e biocidas', detalhe: 'limpam, soltam e conservam', cor: PALETA.apagado, faixa: 'menos de 1% cada', valor: 1.65, dep: 'sd', depNota: 'o Brasil importa e exporta tensoativos e enzimas' },
  { id: 'amonio', nome: 'Sais de amônio', detalhe: 'tiram a cal da pele', cor: PALETA.capim, faixa: '2–3%', valor: 2.5, dep: 'sim', depNota: 'sulfato de amônio: 7,8 milhões de t importadas em 2025, quase nada exportado' },
  { id: 'sal', nome: 'Sal', detalhe: 'prepara a pele para o cromo', cor: PALETA.tinta2, faixa: '6%', valor: 6, dep: 'nao', depNota: 'o Brasil produziu 7 milhões de t de sal em 2022 (ANM) e importou 1,5 milhão em 2025' },
  { id: 'acidos', nome: 'Ácidos sulfúrico e fórmico', detalhe: 'baixam o pH', cor: PALETA.argila, faixa: '0,5–3%, mais 0,5–1% no curtimento', valor: 2.5, dep: 'sim', depNota: 'o enxofre do ácido sulfúrico vem de fora (2,3 milhões de t em 2025); o ácido fórmico também entra por importação' },
  { id: 'cromo', nome: 'Sulfato básico de cromo', detalhe: 'curte: a pele vira wet blue', cor: PALETA.rio, faixa: '8–12% (5–6% com alto esgotamento)', valor: 8, dep: 'sim', depNota: '44 mil t importadas em 2025, sem exportação; cota de importação aberta pelo Gecex em agosto de 2025' },
  { id: 'bicarb', nome: 'Bicarbonato de sódio', detalhe: 'fixa o cromo na fibra', cor: RAMPAS.mata[2], faixa: 'cerca de 1%', valor: 1, dep: 'sim', depNota: 'sem fábrica de barrilha no Brasil (nota do MDIC/Gecex, 2026); 1,4 milhão de t de barrilha importadas em 2025' },
]

// recurtimento, tingimento e engraxe (Nova Andradina, MS)
export const QUIMICOS_MS: Quimico[] = [
  { id: 'neutral', nome: 'Neutralizantes', detalhe: 'formiato, bicarbonato e sintanos', cor: RAMPAS.mata[4], faixa: 'até 4%', valor: 2, dep: 'sim', depNota: 'formiato e bicarbonato saem do ácido fórmico e da barrilha, importados' },
  { id: 'recurt', nome: 'Recurtentes', detalhe: 'sintanos, resinas e taninos vegetais', cor: PALETA.couro, faixa: '3–15%', valor: 9, dep: 'sd', depNota: 'taninos vegetais são nacionais (exportamos 4 vezes o que importamos); sintanos e resinas, em parte importados' },
  { id: 'corantes', nome: 'Corantes', detalhe: 'dão a cor', cor: PALETA.argila, faixa: '0,05–10%', valor: 2, dep: 'sd', depNota: 'importação 6 vezes maior que a exportação em 2025; falta dado de produção nacional' },
  { id: 'engraxe', nome: 'Óleos de engraxe', detalhe: 'lubrificam as fibras e dão maciez', cor: PALETA.madeira, faixa: '3–15%', valor: 9, dep: 'sd', depNota: 'óleos vegetais e de peixe nacionais; parte das preparações é importada' },
]
export const CROMO_SOBRAS: Quimico = { ...QUIMICOS_MT[6], id: 'cromo-sobras', nome: 'Cromo do curtimento', detalhe: 'a serragem sai do wet blue', valor: 1 }

export const FONTE_BREF =
  'Faixas: Comissão Europeia/JRC, BREF Tanning of Hides and Skins (2013), seções 3.3, 3.4 e 3.9. O desenho usa um valor dentro de cada faixa; a receita da Viposa não é pública.'
export const FONTE_DEP =
  'Dependência externa: Comex Stat 2025 (importação e exportação por NCM), ANM (sal), nota técnica MDIC/Gecex 2026 (barrilha), Gecex agosto de 2025 (cota do sulfato de cromo), Decreto 10.991/2022 (Plano Nacional de Fertilizantes: o Brasil importa cerca de 85% dos fertilizantes).'

// ---------------------------------------------------------------- regiões da pele
// a química da ribeira entra na pele inteira, no mesmo fulão; o que muda de uma parte para outra é a
// estrutura (espessura, fibra, rugas), o enchimento no recurtimento e o recorte das patas
export type Regiao = {
  id: RegiaoId
  n: number
  nome: string
  nota: string
  notaVaca?: string
  quimicos: string[] // químicos que chegam à parte (ids de QUIMICOS_MT)
  celula: number // tamanho das manchas da mistura (m): fibra fechada = manchas miúdas
  rugas: number
  bolinhas: number // enchimento do recurtimento nas partes frouxas
  fonte: string
}
const TODOS_MT = QUIMICOS_MT.map((q) => q.id)
export const REGIOES: Regiao[] = [
  { id: 'pescoco', n: 1, nome: 'Pescoço', nota: 'pele grossa, com rugas de crescimento', quimicos: TODOS_MT, celula: 0.075, rugas: 1, bolinhas: 0, fonte: 'Horween; Leather Dictionary' },
  { id: 'paleta', n: 2, nome: 'Paleta', nota: 'ombros firmes, com rugas', quimicos: TODOS_MT, celula: 0.06, rugas: 0.55, bolinhas: 0, fonte: 'Horween' },
  { id: 'grupao', n: 3, nome: 'Grupão', nota: 'lombo e garupa: a parte mais grossa, de fibra mais fechada', quimicos: TODOS_MT, celula: 0.045, rugas: 0, bolinhas: 0, fonte: 'Leather Naturally' },
  {
    id: 'barrigas',
    n: 4,
    nome: 'Barrigas',
    nota: 'mais finas e frouxas: o recurtimento enche essas partes',
    notaVaca: 'na vaca que já pariu, a barriga é ainda mais frouxa',
    quimicos: TODOS_MT,
    celula: 0.085,
    rugas: 0,
    bolinhas: 0.45,
    fonte: 'Leather Naturally; BREF 2013, seção 2.4.3; Horween',
  },
  { id: 'garras', n: 5, nome: 'Garras', nota: 'patas: saem no recorte e viram aparas (cola e gelatina)', quimicos: ['aux', 'cal', 'sulfeto'], celula: 0.05, rugas: 0, bolinhas: 0, fonte: 'BREF 2013, seções 2.1.2 e 3.5.2' },
]
export const regiaoPorId = (id: RegiaoId) => REGIOES.find((r) => r.id === id)!
export const COR_REGIAO = PALETA.couro

// ---------------------------------------------------------------- camadas do couro
export type Transformacao = { id: string; nome: string; nota: string; cor: string; textura: 'poros' | 'liso' | 'veludo' | 'pigmento' | 'gravado' | 'camurca' | 'rustico' | 'fibras' | 'grumos' }
export type Camada = { id: string; nome: string; forma: 'folha' | 'bloco'; esp: number; cor: string; corLado: string; textura: 'poros' | 'lixa' | 'fibras' | 'emaranhado'; quimicos: string[]; transforma: Transformacao[] }
// da mais fina à mais grossa, como na pilha da Maya Craft (forma e aparência; cores e textos nossos)
export const CAMADAS: Camada[] = [
  {
    id: 'integral',
    nome: 'Flor integral',
    forma: 'folha',
    esp: 0.026,
    cor: RAMPAS.couro[2],
    corLado: RAMPAS.couro[1],
    textura: 'poros',
    quimicos: ['neutral', 'recurt', 'corantes', 'engraxe'],
    transforma: [
      { id: 'anilina', nome: 'Anilina', nota: 'só tingida, quase sem acabamento: pede pele sem defeito', cor: '#6b3a22', textura: 'poros' },
      { id: 'semianilina', nome: 'Semianilina', nota: 'flor à mostra sob uma cobertura leve', cor: '#8a4e2c', textura: 'liso' },
      { id: 'polido', nome: 'Couro polido', nota: 'o polimento dá brilho à flor', cor: '#c98a4b', textura: 'liso' },
    ],
  },
  {
    id: 'lixada',
    nome: 'Flor lixada',
    forma: 'folha',
    esp: 0.03,
    cor: '#b06c3e',
    corLado: RAMPAS.couro[2],
    textura: 'lixa',
    quimicos: ['neutral', 'recurt', 'corantes', 'engraxe'],
    transforma: [
      { id: 'nobuck', nome: 'Nobuck', nota: 'flor lixada até ficar aveludada', cor: '#b48a5e', textura: 'veludo' },
      { id: 'corrigida', nome: 'Flor corrigida', nota: 'lixada e coberta de pigmento: até 400 g/m² de acabamento', cor: '#2e2724', textura: 'pigmento' },
      { id: 'gravado', nome: 'Couro gravado', nota: 'calor e pressão imprimem um desenho na flor', cor: '#5a3a24', textura: 'gravado' },
    ],
  },
  {
    id: 'raspa',
    nome: 'Raspa',
    forma: 'bloco',
    esp: 0.13,
    cor: '#d9b48a',
    corLado: '#b8956c',
    textura: 'fibras',
    quimicos: ['neutral', 'recurt', 'corantes', 'engraxe'],
    transforma: [
      { id: 'camurca', nome: 'Camurça', nota: 'raspa lixada do lado do carnal', cor: '#c9a27a', textura: 'camurca' },
      { id: 'raspa-pig', nome: 'Raspa pigmentada', nota: 'raspa coberta de acabamento: até 400 g/m²', cor: '#3a3532', textura: 'rustico' },
    ],
  },
  {
    id: 'sobras',
    nome: 'Sobras',
    forma: 'bloco',
    esp: 0.19,
    cor: '#6f5a46',
    corLado: '#55463a',
    textura: 'emaranhado',
    quimicos: ['cromo-sobras'],
    transforma: [
      { id: 'reconstituido', nome: 'Couro reconstituído', nota: 'serragem e aparas curtidas viram placas de fibra', cor: '#9a8670', textura: 'fibras' },
      { id: 'composto', nome: 'Adubo', nota: '74% dos resíduos da Viposa têm uso agrícola', cor: '#3f3226', textura: 'grumos' },
      { id: 'hidrolisado', nome: 'Hidrolisado', nota: 'depois de tirar o cromo, a serragem vira proteína', cor: '#d6c4a2', textura: 'grumos' },
    ],
  },
]
export const FONTE_CAMADAS =
  'Camadas e transformações: BREF 2013 (divisão, seção 2.2.5; serragem de 2% a 20% do peso do couro, vendida para placas, adubo e hidrolisado, seção 3.9.4.5; acabamento de 0,2 a 400 g/m², seção 3.9.6.2; anilina, camurça, nobuck, flor corrigida e gravação, glossário); acabamento da Viposa (pintura, gravação e polimento): site, Exame e LWG; resíduos da Viposa: Exame (2026) e Portal RBV.'

// ---------------------------------------------------------------- o que mantém o animal
export type Orgao = { id: string; n: number; nome: string; nota: string }
export const ORGAOS: Orgao[] = [
  { id: 'rumen', n: 1, nome: 'Rúmen', nota: 'fermenta o capim e a ração' },
  { id: 'reticulo', n: 2, nome: 'Retículo', nota: 'devolve o bolo à boca para ruminar' },
  { id: 'omaso', n: 3, nome: 'Omaso', nota: 'absorve água' },
  { id: 'abomaso', n: 4, nome: 'Abomaso', nota: 'o estômago químico, com ácido' },
  { id: 'esofago', n: 5, nome: 'Esôfago', nota: 'da boca ao rúmen' },
  { id: 'intestino', n: 6, nome: 'Intestino grosso', nota: 'absorve água e forma as fezes' },
  { id: 'coracao', n: 7, nome: 'Coração', nota: 'leva os nutrientes ao corpo' },
]

export type Insumo = { id: string; nome: string; grupo: 'alimento' | 'adubo'; cor: string; dep: Dep; depNota: string; nota: string }
export const INSUMOS_ANIMAL: Insumo[] = [
  { id: 'pasto', nome: 'Pasto (capim)', grupo: 'alimento', cor: PALETA.capim, dep: 'nao', depNota: 'capim plantado na fazenda', nota: 'base da dieta do gado a pasto' },
  { id: 'racao', nome: 'Ração: milho e soja', grupo: 'alimento', cor: PALETA.palha, dep: 'nao', depNota: 'o Brasil exportou 41 milhões de t de milho e 108 milhões de t de soja em 2025', nota: 'confinamento e suplemento' },
  { id: 'sal_mineral', nome: 'Sal mineral', grupo: 'alimento', cor: PALETA.tinta, dep: 'sd', depNota: 'sal nacional; o fosfato bicálcico é em parte importado (104 mil t em 2025)', nota: 'fósforo e sódio' },
  { id: 'ureia', nome: 'Ureia', grupo: 'alimento', cor: RAMPAS.couro[4], dep: 'sim', depNota: '7,7 milhões de t importadas em 2025, quase nada exportado', nota: 'nitrogênio para os micróbios do rúmen' },
  { id: 'adubo_n', nome: 'Adubo nitrogenado: ureia e sulfato de amônio', grupo: 'adubo', cor: PALETA.apagado, dep: 'sim', depNota: 'ureia e sulfato de amônio: 15,5 milhões de t importadas em 2025', nota: 'aduba o pasto e o milho' },
  { id: 'adubo_p', nome: 'Adubo fosfatado: MAP e DAP', grupo: 'adubo', cor: PALETA.apagado, dep: 'sim', depNota: 'MAP e DAP: 3,3 milhões de t importadas em 2025', nota: 'aduba o pasto e a soja' },
  { id: 'adubo_k', nome: 'Adubo potássico: cloreto de potássio', grupo: 'adubo', cor: PALETA.apagado, dep: 'sim', depNota: '13,7 milhões de t importadas em 2025', nota: 'aduba o pasto, o milho e a soja' },
  { id: 'calcario', nome: 'Calcário: corrige o solo', grupo: 'adubo', cor: PALETA.apagado, dep: 'nao', depNota: 'calcário de jazidas nacionais', nota: 'corrige a acidez do solo do pasto' },
]

// ---------------------------------------------------------------- etapas (quadro de decomposição)
export type Modo = 'animal' | 'interior' | 'regiao' | 'pele'
export type Etapa = { id: string; n: number; nome: string; local: string; modo?: Modo; proxima?: boolean }
export const ETAPAS: Etapa[] = [
  { id: 'interior', n: 1, nome: 'O que mantém o animal', local: 'pasto, ração e adubo', modo: 'interior' },
  { id: 'regiao', n: 2, nome: 'Pele por região: ribeira e curtimento', local: 'Várzea Grande (MT)', modo: 'regiao' },
  { id: 'pele', n: 3, nome: 'Camadas: divisão e recurtimento', local: 'Nova Andradina (MS)', modo: 'pele' },
  { id: 'sc', n: 4, nome: 'Acabamento, cabedais e calçados de segurança', local: 'Caçador (SC)', proxima: true },
]

// distribui n blocos entre categorias na proporção dos valores (maiores restos)
export function waffle(n: number, valores: number[]): number[] {
  const total = valores.reduce((a, b) => a + b, 0)
  const exatos = valores.map((v) => (v / total) * n)
  const cont = exatos.map(Math.floor)
  const falta = n - cont.reduce((a, b) => a + b, 0)
  const ordem = exatos.map((e, i) => [e - Math.floor(e), i]).sort((a, b) => b[0] - a[0])
  for (let k = 0; k < falta; k++) cont[ordem[k][1]]++
  const out: number[] = []
  cont.forEach((c, i) => {
    for (let k = 0; k < c; k++) out.push(i)
  })
  return out
}

export const pctTexto = (v: number) => `${Math.round(v)}%`
