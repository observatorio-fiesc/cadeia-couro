// O ambiente na cadeia (lente Ambiente do cone): onde a cadeia depende do ambiente e onde ele pesa sobre ela.
// Só fatos já na base, cada um com a fonte da base (meta.fontes de cadeia.json, saídas de processo.json e
// eventos de mercados.json). Os números vêm das descrições dos nós; ao mudar a base, conferir aqui.

/** Os grupos da lente, cada um com uma matiz da paleta do painel. */
export const GRUPOS_AMBIENTE: { chave: string; nome: string; cor: string; ids: string[] }[] = [
  {
    chave: 'origem',
    nome: 'origem do gado',
    cor: '#5fa874',
    ids: ['sis.pele', 'ins.bovinos_machos', 'ins.bovinos_femeas', 'ins.abate', 'ins.transporte_gado', 'cap.rastreabilidade', 'mat.pastagem', 'mat.racao', 'mat.sal_mineral', 'mat.sanidade', 'mat.cercas', 'mat.graos'],
  },
  {
    chave: 'agua',
    nome: 'água e efluente',
    cor: '#5daed2',
    ids: ['rec.agua', 'sis.utilidades', 'ins.tratamento_efluente', 'mat.coagulantes', 'rec.bauxita', 'ins.cal'],
  },
  {
    chave: 'cromo',
    nome: 'cromo',
    cor: '#cf6a4a',
    ids: ['sis.curtimento', 'ins.sulfato_cromo', 'ins.basificantes', 'mat.dicromato', 'rec.cromita'],
  },
  {
    chave: 'floresta',
    nome: 'floresta e energia',
    cor: '#e9b24a',
    ids: ['rec.eucalipto', 'mat.lenha', 'ins.energia_termica', 'ins.eletricidade', 'ins.diesel', 'rec.pinus', 'mat.madeira_pinus', 'ins.embalagem', 'rec.acacia_negra', 'rec.quebracho', 'ins.taninos_vegetais', 'mat.celulose', 'ins.caixas'],
  },
]
/** A condição para operar: licenças e selo. Em branco no cone. */
export const LICENCAS = 'cap.licencas_lwg'

/** O que cada elo mostra ao lado do nome na lente (números das descrições dos nós). */
export const VALOR_AMBIENTE: Record<string, string> = {
  'cap.rastreabilidade': '11,9% rastreada',
  'cap.licencas_lwg': 'LWG Gold',
  'rec.agua': '651.687 m³/ano',
  'sis.utilidades': '444.116 m³ de efluente',
  'rec.eucalipto': '155 ha em MS',
  'mat.lenha': 'indício',
  'ins.eletricidade': 'solar própria',
}

/** Vencimento do selo LWG Gold de cada planta, pelos registros de auditoria (fonte lwg). */
export const LWG = [
  { planta: 'Várzea Grande (MT)', ate: '2026-12-12' },
  { planta: 'Caçador (SC)', ate: '2027-04-14' },
]
/** Dias de calendário de hoje até uma data (AAAA-MM-DD). */
export const diasAte = (iso: string, hoje = new Date()) => {
  const [a, m, d] = iso.split('-').map(Number)
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 86400000)
}

export type Atencao = { id: string; titulo: string; texto: string; fontes: string[] }

/** Os pontos de atenção, na ordem em que aparecem. Cada um aponta para um elo do cone. */
export function pontosDeAtencao(hoje = new Date()): Atencao[] {
  const vg = LWG[0]
  const dias = diasAte(vg.ate, hoje)
  return [
    {
      id: 'cap.licencas_lwg',
      titulo: dias >= 0 ? `Selo LWG de Várzea Grande vence em ${dias} dias` : 'Selo LWG de Várzea Grande vencido',
      texto: `LWG Gold em Várzea Grande até 12/12/2026 e em Caçador até 14/04/2027. Licenças ambientais no SEMA-MT, no IMASUL e no IMA-SC.`,
      fontes: ['lwg', 'levantamento-1611'],
    },
    {
      id: 'cap.rastreabilidade',
      titulo: '88,1% da matéria-prima sem rastreio até a fazenda de nascimento',
      texto: 'Georreferenciamento desde 2019 e 4.591 análises de desmatamento zero; 11,9% da matéria-prima rastreada até a fazenda de nascimento (VipLeatherGPS).',
      fontes: ['exame-2026', 'site-viposa'],
    },
    {
      id: 'ins.sulfato_cromo',
      titulo: 'O cromo sai no banho e na serragem',
      texto: 'O curtimento ao cromo gera o banho residual de cromo, que vai ao tratamento de efluente, e a serragem cromada, que vai a placas de fibra, adubo e hidrolisado. A empresa declara também produzir wet white, sem metal.',
      fontes: ['tec-curtume', 'lwg'],
    },
    {
      id: 'rec.agua',
      titulo: '651.687 m³ de água por ano',
      texto: 'Captação anual das plantas; 444.116 m³ de efluente tratado descartados. Caçador fica às margens do Rio do Peixe.',
      fontes: ['levantamento-1611'],
    },
    {
      id: 'mat.lenha',
      titulo: 'Caldeiras a lenha: indício',
      texto: 'Plantio próprio de eucalipto (168 mil mudas em 155 ha em Nova Andradina e cerca de 29 mil em Várzea Grande); o uso da madeira nas caldeiras ainda é indício.',
      fontes: ['levantamento-1611'],
    },
  ]
}
