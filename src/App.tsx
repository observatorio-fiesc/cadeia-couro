import { useEffect, useMemo, useState } from 'react'
import { carregarTudo, type Contexto } from './dados/contexto'
import { COR, LENTES, type Lente } from './lib/lentes'
import { Ficha } from './componentes/Ficha'
import { PainelChina, PainelOrmuz } from './componentes/PainelLente'
import { PainelAmbiente } from './componentes/PainelAmbiente'
import { Moldura } from './componentes/Moldura'
import { BotaoFaixa, DocaContext, Menu } from './componentes/Faixa'
import { Cone } from './vistas/Cone'
import { VistaProcesso } from './vistas/Processo'
import { VistaModelo3D } from './vistas/Modelo3D'
import { VistaExterno } from './vistas/Externo'
import { FONTE_BOTA, FONTE_CAMADAS, FONTE_DEP } from './modelo3d/receitas'

type Vista = 'bois' | 'cone' | 'cadeia' | 'externo'
const VISTAS: { chave: Vista; rotulo: string }[] = [
  { chave: 'bois', rotulo: 'Modelo 3D' },
  { chave: 'cone', rotulo: 'Cone 3D' },
  { chave: 'cadeia', rotulo: 'Cadeia' },
  { chave: 'externo', rotulo: 'Mercado externo' },
]
// o elo da cadeia com comércio exterior → o insumo da aba Mercado externo (Importações, Origens)
const INSUMO_DO_ELO: Record<string, string> = {
  'ins.sulfeto_sodio': 'sulfeto', 'ins.sulfato_amonio': 'sulfato_amonio', 'ins.acido_formico': 'formico', 'ins.sulfato_cromo': 'cromo',
  'ins.recurtentes_sinteticos': 'recurtentes', 'ins.taninos_vegetais': 'taninos', 'ins.corantes': 'corantes', 'ins.oleos_engraxe': 'engraxe',
  'ins.auxiliares_acabamento': 'acabamento', 'mat.ureia': 'ureia', 'mat.map': 'map_dap', 'mat.dap': 'map_dap', 'mat.kcl': 'kcl', 'rec.enxofre': 'enxofre',
}
// cor da bolinha de cada lente no menu da faixa: a mesma matiz que a lente usa no cone
const COR_LENTE: Partial<Record<Lente, string>> = { importado: COR.conhaque, ormuz: COR.vermelho, china: COR.ambar, confianca: COR.cru, ambiente: '#5fa874' }

export function App() {
  const [ctx, setCtx] = useState<Contexto | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    carregarTudo().then(setCtx).catch((e) => setErro(String(e)))
  }, [])
  if (erro) return <div className="aviso-tela">{erro}</div>
  if (!ctx) return <div className="aviso-tela">carregando o painel…</div>
  return <Painel ctx={ctx} />
}

// a vista vai no endereço como #nome (#bois, #cone, #cadeia, #externo): é o único formato que passa pelo link do
// site; os parâmetros ?lente= e ?elo= continuam valendo no servidor local
const vistaDoHash = (): Vista | null => {
  const h = window.location.hash.replace('#', '')
  return VISTAS.some((v) => v.chave === h) ? (h as Vista) : null
}

function Painel({ ctx }: { ctx: Contexto }) {
  const { cadeia, ix } = ctx
  const params = new URLSearchParams(window.location.search)
  const [vista, setVista] = useState<Vista>(vistaDoHash() ?? ((VISTAS.find((v) => v.chave === params.get('vista'))?.chave ?? 'bois') as Vista))
  const [lente, setLente] = useState<Lente>((LENTES.find((l) => l.chave === params.get('lente'))?.chave ?? 'estrutura') as Lente)
  const [sel, setSel] = useState<string | null>(params.get('elo') && ix.porId.has(params.get('elo')!) ? params.get('elo') : null)
  const [fontes, setFontes] = useState(false)
  // onde cada vista põe os próprios controles: na faixa e, acima dela, a legenda
  const [docaFaixa, setDocaFaixa] = useState<HTMLDivElement | null>(null)
  const [docaLegenda, setDocaLegenda] = useState<HTMLDivElement | null>(null)
  const [docaCabeca, setDocaCabeca] = useState<HTMLDivElement | null>(null)
  const doca = useMemo(() => ({ faixa: docaFaixa, legenda: docaLegenda, cabeca: docaCabeca }), [docaFaixa, docaLegenda, docaCabeca])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSel(null)
      // as teclas 1 a 4 levam às vistas, na ordem do menu
      if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return
      const v = VISTAS[Number(e.key) - 1]
      if (/^[1-9]$/.test(e.key) && v) {
        setVista(v.chave)
      }
    }
    const hash = () => {
      const v = vistaDoHash()
      if (v) setVista(v)
    }
    window.addEventListener('keydown', tecla)
    window.addEventListener('hashchange', hash)
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 300)
    return () => {
      window.removeEventListener('keydown', tecla)
      window.removeEventListener('hashchange', hash)
      window.clearTimeout(t)
    }
  }, [])
  useEffect(() => {
    if (window.location.hash !== `#${vista}`) {
      try {
        history.replaceState(null, '', `#${vista}`)
      } catch {
        /* o quadro do site pode recusar; a vista continua valendo na página */
      }
    }
  }, [vista])

  const noSel = sel ? ix.porId.get(sel) ?? null : null
  // "ver no mapa": a aba Mercado externo, em Importações, nas origens do insumo
  const irParaMapa = (id: string) => {
    try {
      const q = new URLSearchParams(window.location.search)
      q.set('sentido', 'imp')
      q.set('analise', 'origens')
      q.set('passo', '0')
      q.set('produto', INSUMO_DO_ELO[id] ?? 'cromo')
      history.replaceState(null, '', `?${q.toString()}#externo`)
    } catch {
      /* o quadro do site pode recusar; a aba abre no começo */
    }
    setVista('externo')
    setSel(null)
  }
  const fichaAberta = noSel && (vista === 'cone' || vista === 'cadeia')

  return (
    <DocaContext.Provider value={doca}>
    <div className={`tela vista-${vista}`}>
      <Moldura />
      <header className="cabeca">
        {/* uma vista pode pôr aqui o seu seletor de sistema, que passa a ser o título (Modelo 3D) */}
        <div className="cabeca-sistema" ref={setDocaCabeca} />
        <h1>Cadeia produtiva do couro</h1>
      </header>
      {vista === 'cone' && <Cone ctx={ctx} lente={lente} onLente={setLente} selecionado={sel} onSelecionar={setSel} cartaoAberto={!!noSel || lente === 'ormuz' || lente === 'china' || lente === 'ambiente'} />}
      {vista === 'bois' && (
        <VistaModelo3D
          ctx={ctx}
          onVerNoCone={(id) => {
            setSel(id)
            setVista('cone')
          }}
        />
      )}
      {vista === 'cadeia' && <VistaProcesso ctx={ctx} selecionado={sel} onSelecionar={setSel} />}
      {vista === 'externo' && <VistaExterno />}

      {fichaAberta && <Ficha cadeia={cadeia} ix={ix} no={noSel!} onSelecionar={setSel} onVerNoMapa={noSel!.comercio && INSUMO_DO_ELO[noSel!.id] ? () => irParaMapa(noSel!.id) : undefined} processo={ctx.processo} ixp={ctx.ixp} compacta={vista === 'cone'} />}
      {!fichaAberta && vista === 'cone' && lente === 'ormuz' && <PainelOrmuz cadeia={cadeia} onSelecionar={setSel} />}
      {!fichaAberta && vista === 'cone' && lente === 'china' && <PainelChina cadeia={cadeia} onSelecionar={setSel} />}
      {!fichaAberta && vista === 'cone' && lente === 'ambiente' && <PainelAmbiente ctx={ctx} onSelecionar={setSel} />}

      <nav className="controles" aria-label="Controles">
        <div className="controles-legenda" ref={setDocaLegenda} />
        <div className="faixa">
          <Menu<Vista>
            rotulo="Vista"
            valor={vista}
            opcoes={VISTAS.map((v, i) => ({ chave: v.chave, rotulo: v.rotulo, tecla: i + 1 }))}
            onEscolher={setVista}
          />
          {vista === 'cone' && (
            <Menu<Lente> rotulo="Lente" valor={lente} opcoes={LENTES.map((l) => ({ chave: l.chave, rotulo: l.rotulo, cor: COR_LENTE[l.chave] }))} onEscolher={setLente} />
          )}
          <div className="faixa-vista" ref={setDocaFaixa} />
          <BotaoFaixa rotulo="Fontes e definições" ligado={fontes} onClick={() => setFontes(!fontes)}>
            <circle cx="8" cy="8" r="6" />
            <path d="M8 7.2v4M8 4.6v.9" />
          </BotaoFaixa>
        </div>
      </nav>
      {fontes && <Fontes ctx={ctx} onFechar={() => setFontes(false)} />}
    </div>
    </DocaContext.Provider>
  )
}

function Fontes({ ctx, onFechar }: { ctx: Contexto; onFechar: () => void }) {
  // Esc fecha as fontes antes de qualquer passo de volta da vista
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onFechar()
    }
    window.addEventListener('keydown', esc, true)
    return () => window.removeEventListener('keydown', esc, true)
  }, [onFechar])
  return (
    <div className="painel painel-fontes" role="dialog" aria-label="Fontes e definições">
      <button className="fechar" onClick={onFechar} aria-label="Fechar">
        ×
      </button>
      <h3>Fontes</h3>
      <ul>
        {Object.entries(ctx.cadeia.meta.fontes).map(([k, v]) => (
          <li key={k}>{v}</li>
        ))}
        <li>{ctx.log.fonte_rotas}</li>
        <li>{ctx.abate.fonte}</li>
        <li>Química por etapa (aba Modelo 3D): Comissão Europeia/JRC, BREF Tanning of Hides and Skins (2013), seções 3.3, 3.4 e 3.9; o desenho usa um valor dentro de cada faixa, não a receita da Viposa</li>
        <li>Regiões da pele (aba Modelo 3D): Leather Naturally (grupão grosso e de fibra densa; barriga mais fina e frouxa); Horween Leather (paleta enrugada; barriga da vaca parida mais frouxa); BREF 2013, seções 2.1.2, 2.4.3 e 3.5.2 (recorte das patas, enchimento das partes frouxas, destino das aparas)</li>
        <li>{FONTE_CAMADAS}</li>
        <li>{FONTE_DEP}</li>
        <li>{FONTE_BOTA}</li>
        <li>Mercado externo: Comex Stat (MDIC/Secex), exportações e importações por país e produto, 2015 a 2025, e preço por quilo por mês até o último mês publicado de 2026; UN Comtrade (API pública), exportações por exportador e destino e importações de couro curtido, 2015 a 2025, declaradas por cada país; IBGE, Pesquisa Trimestral do Abate de Animais (tabela 1092); Escritório Nacional de Estatística da China (produção de carne suína, 2019: 42,55 milhões de t, −21,3%); Bain & Company (mercado de luxo, 2025); EIU (série NEVP); curtumes das maisons: imprensa setorial e comunicado da Prada; polos do couro: lugares conhecidos do setor. Ver o relatório de comércio exterior do couro (18/11/2026)</li>
        <li>Mercado externo, gargalos: a parte que passa por cada ponto soma o valor de 2025 dos países cuja rota esquemática até Santos passa por ele; rotas do Golfo e corte do estreito como no painel-comandante (estreito fechado em março de 2026)</li>
        <li>Mapa-múndi: Natural Earth 1:50m e, nos zooms, 1:10m (costa, fronteiras, portos, ferrovias e estradas; domínio público); máscara de água e grade de tráfego de navios do atlas do painel-comandante; tráfego: Global Fishing Watch, presença de navios por AIS, 30 dias (18/09–18/10/2026), CC BY-NC 4.0</li>
        <li>Rotas marítimas: grafo esquemático de pontos de passagem do visualizador do submarino do painel-comandante, com os portos da cadeia do couro; não são as rotas dos navios</li>
      </ul>
      <h3>Definições</h3>
      <ul>
        <li>Alcance na cadeia: parte das etapas, insumos, materiais e artigos que dependem do elo, direta ou indiretamente (base: {ctx.cadeia.meta.base_alcance_cadeia} elos).</li>
        <li>Golfo dentro do estreito: Arábia Saudita, Barein, Catar, Emirados Árabes Unidos, Irã, Iraque e Kuwait. Omã fica fora do estreito e aparece à parte.</li>
        <li>Importação por UF: domicílio fiscal do importador, não o local de uso. Exportação por município: domicílio fiscal do exportador, não o local de produção.</li>
        <li>Confiança: fato (documento ou dado), fato técnico (literatura), indício (fora da narrativa).</li>
      </ul>
      <p className="nota">Painel de análise feito com dados e documentos públicos; não é publicação da Viposa.</p>
    </div>
  )
}
