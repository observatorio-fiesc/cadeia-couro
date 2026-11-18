import { useEffect, useMemo, useRef, useState } from 'react'
import { carregarTudo, type Contexto } from './dados/contexto'
import { caminho } from './dados/cadeia'
import { calcularCone } from './lib/layout'
import { LENTES, parteGolfo, type Lente } from './lib/lentes'
import { Ficha } from './componentes/Ficha'
import { PainelChina, PainelOrmuz } from './componentes/PainelLente'
import { Cone } from './vistas/Cone'
import { Arvore } from './vistas/Arvore'
import { VistaBrasil } from './vistas/Brasil'
import { VistaMundo } from './vistas/Mundo'
import { VistaOrmuz } from './vistas/Ormuz'
import { CASOS, VistaMercados, type Caso } from './vistas/Mercados'
import { VistaModelo3D } from './vistas/Modelo3D'
import { FONTE_CAMADAS, FONTE_DEP } from './modelo3d/receitas'

type Vista = 'bois' | 'cone' | 'cadeia' | 'brasil' | 'mundo' | 'ormuz' | 'mercados'
const VISTAS: { chave: Vista; rotulo: string }[] = [
  { chave: 'bois', rotulo: 'Modelo 3D' },
  { chave: 'cone', rotulo: 'Cone 3D' },
  { chave: 'cadeia', rotulo: 'Cadeia' },
  { chave: 'brasil', rotulo: 'Logística no Brasil' },
  { chave: 'mundo', rotulo: 'Insumos no mundo' },
  { chave: 'ormuz', rotulo: 'Ormuz 2026' },
  { chave: 'mercados', rotulo: 'Mercados e casos' },
]
const NOME_ANEL: Record<string, string> = { c0: 'Planta', c1: 'Etapas', c2: 'Insumos e capacitações', c3: 'Materiais', c4: 'Matérias-primas' }

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

// a vista vai no endereço como #nome (#cone, #cadeia, #brasil, #mundo, #ormuz, #mercados): é o único formato que
// passa pelo link do site; os parâmetros ?lente=, ?elo=, ?insumo= e ?caso= continuam valendo no servidor local
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
  const [hover, setHover] = useState<string | null>(null)
  const [insumo, setInsumo] = useState<string>(params.get('insumo') ?? 'ins.sulfato_cromo')
  const [caso, setCaso] = useState<Caso>((CASOS.find((c) => c.chave === params.get('caso'))?.chave ?? 'eua') as Caso)
  const [arvore, setArvore] = useState<string[]>(['nucleo.viposa', 'sis.curtimento', 'ins.sulfato_cromo'])
  const [fontes, setFontes] = useState(false)
  const aneisRef = useRef<Record<string, HTMLDivElement | null>>({})
  const nucleoRef = useRef<HTMLDivElement | null>(null)

  const cone = useMemo(() => calcularCone(cadeia), [cadeia])
  const destaque = useMemo(() => (sel ? caminho(cadeia, ix, sel) : null), [cadeia, ix, sel])
  const rotulosFixos = useMemo(() => rotulosDaLente(ctx, lente), [ctx, lente])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSel(null)
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
  const irParaMapa = (id: string) => {
    setInsumo(id)
    setVista('mundo')
    setSel(null)
  }
  const abrirArvore = (coluna: number, id: string) => {
    setArvore((c) => (c[coluna] === id && coluna > 0 ? c.slice(0, coluna) : [...c.slice(0, coluna), id]))
    setSel(id === 'nucleo.viposa' ? null : id)
  }
  const fichaAberta = noSel && (vista === 'cone' || vista === 'cadeia')

  return (
    <div className={`tela vista-${vista}`}>
      {vista === 'cone' && (
        <>
          <Cone
            cadeia={cadeia}
            pos={cone.pos}
            aneis={cone.aneis}
            nos={cone.nos}
            arestasIdx={cone.arestasIdx}
            lente={lente}
            selecionado={sel}
            destaqueNos={destaque?.nos ?? null}
            destaqueArestas={destaque?.arestas ?? null}
            hover={hover}
            rotulosFixos={rotulosFixos}
            onHover={setHover}
            onSelecionar={setSel}
            aneisRef={aneisRef}
            nucleoRef={nucleoRef}
          />
          <div className="aneis">
            {cone.aneis.map((a) => (
              <div key={a.chave} ref={(el) => { aneisRef.current[a.chave] = el }} className={`anel${a.camada === 0 ? ' anel-nucleo' : ''}`}>
                <span>{NOME_ANEL[a.chave]}</span>
                {a.camada > 0 && <em>{a.n}</em>}
              </div>
            ))}
          </div>
          <div ref={nucleoRef} className="rotulo-topo">
            Couro Viposa
            <em>Várzea Grande · Nova Andradina · Caçador</em>
          </div>
        </>
      )}
      {vista === 'bois' && <VistaModelo3D ctx={ctx} />}
      {vista === 'cadeia' && <Arvore cadeia={cadeia} ix={ix} caminho={arvore} onAbrir={abrirArvore} selecionado={sel} />}
      {vista === 'brasil' && <VistaBrasil ctx={ctx} />}
      {vista === 'mundo' && <VistaMundo ctx={ctx} insumo={insumo} onInsumo={setInsumo} />}
      {vista === 'ormuz' && <VistaOrmuz ctx={ctx} onSelecionar={(id) => irParaMapa(id)} />}
      {vista === 'mercados' && <VistaMercados ctx={ctx} caso={caso} onCaso={setCaso} />}

      {fichaAberta && <Ficha cadeia={cadeia} ix={ix} no={noSel!} onSelecionar={setSel} onVerNoMapa={noSel!.comercio ? () => irParaMapa(noSel!.id) : undefined} />}
      {!fichaAberta && vista === 'cone' && lente === 'ormuz' && <PainelOrmuz cadeia={cadeia} onSelecionar={setSel} />}
      {!fichaAberta && vista === 'cone' && lente === 'china' && <PainelChina cadeia={cadeia} onSelecionar={setSel} />}

      <nav className="controles">
        {vista === 'cone' && (
          <div className="lentes">
            {LENTES.map((l) => (
              <button key={l.chave} className={l.chave === lente ? 'ativo' : ''} onClick={() => setLente(l.chave)}>
                {l.rotulo}
              </button>
            ))}
          </div>
        )}
        <div className="vistas">
          {VISTAS.map((v) => (
            <button key={v.chave} className={v.chave === vista ? 'ativo' : ''} onClick={() => { setVista(v.chave); setHover(null) }}>
              {v.rotulo}
            </button>
          ))}
        </div>
      </nav>
      <button className="botao-fontes" onClick={() => setFontes(!fontes)}>
        Fontes e definições
      </button>
      {fontes && <Fontes ctx={ctx} onFechar={() => setFontes(false)} />}
    </div>
  )
}

function rotulosDaLente(ctx: Contexto, lente: Lente): Set<string> {
  const c = ctx.cadeia
  const s = new Set<string>()
  const ofertas = c.nos.filter((n) => n.lado === 'oferta' && n.camada >= 2)
  if (lente === 'estrutura') {
    c.nos.filter((n) => n.lado === 'oferta' && n.camada === 1).forEach((n) => s.add(n.id))
    ;[...ofertas].sort((a, b) => (b.alcance_cadeia ?? 0) - (a.alcance_cadeia ?? 0)).slice(0, 8).forEach((n) => s.add(n.id))
  } else if (lente === 'importado') {
    ;[...ofertas].filter((n) => n.comercio).sort((a, b) => (b.comercio!.musd_2025 ?? 0) - (a.comercio!.musd_2025 ?? 0)).slice(0, 10).forEach((n) => s.add(n.id))
  } else if (lente === 'ormuz') {
    c.nos.filter((n) => (parteGolfo(n) ?? 0) >= 0.05).forEach((n) => s.add(n.id))
  } else if (lente === 'china') {
    c.nos.filter((n) => (n.comercio?.china_2025 ?? 0) >= 0.3).forEach((n) => s.add(n.id))
  } else if (lente === 'confianca') {
    c.nos.filter((n) => n.confianca === 'indício').forEach((n) => s.add(n.id))
  }
  return s
}

function Fontes({ ctx, onFechar }: { ctx: Contexto; onFechar: () => void }) {
  return (
    <div className="painel-fontes">
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
        <li>Malhas: IBGE (UFs), DNIT (rodovias federais), Natural Earth (países)</li>
        <li>Química por etapa (aba Modelo 3D): Comissão Europeia/JRC, BREF Tanning of Hides and Skins (2013), seções 3.3, 3.4 e 3.9; o desenho usa um valor dentro de cada faixa, não a receita da Viposa</li>
        <li>Regiões da pele (aba Modelo 3D): Leather Naturally (grupão grosso e de fibra densa; barriga mais fina e frouxa); Horween Leather (paleta enrugada; barriga da vaca parida mais frouxa); BREF 2013, seções 2.1.2, 2.4.3 e 3.5.2 (recorte das patas, enchimento das partes frouxas, destino das aparas)</li>
        <li>{FONTE_CAMADAS}</li>
        <li>{FONTE_DEP}</li>
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
