// Aba Mercado externo, no desenho dos Cenários estratégicos do painel-comandante:
// - na faixa, depois de "5 Mercado externo", Oferta ou Demanda e, ao lado, só as análises desse lado, como o bloco
//   das passadas ao lado de "Cenários estratégicos";
// - no alto, a linha do tempo: as análises do lado escolhido com as suas passadas, a atual nomeada, e o ▶;
// - à esquerda, a folha da passada (um número e uma linha); acima da faixa, quando há, um infográfico sutil;
// - embaixo, no meio, Exportações ou Importações: um toque abre a outra;
// - no canto inferior direito, o quadro dos produtos (os estágios do couro; os insumos importados).
// O mapa (src/externo/Mapa.tsx) leva a câmera a cada passada. Cada passada mostra um ano só: o último.
import { useEffect, useMemo, useRef, useState } from 'react'
import { carregarExterno, ESTAGIOS, GRUPOS_INSUMO, type DadosExterno } from '../externo/dados'
import { MapaExterno, type Margens } from '../externo/Mapa'
import { ANALISES, NOME_LADO, NOME_SENTIDO, PRODUTO_INICIAL, type Analise, type Lado, type Sentido } from '../externo/passos'
import { Figura, Folha, Infografico } from '../externo/Folha'
import { BotaoFaixa, Menu, NaFaixa } from '../componentes/Faixa'
import '../externo/externo.css'

export function VistaExterno() {
  const [d, setD] = useState<DadosExterno | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    carregarExterno().then(setD).catch((e) => setErro(String(e)))
  }, [])
  if (erro) return <div className="aviso-tela">{erro}</div>
  if (!d) return <div className="aviso-tela">carregando o mapa-múndi…</div>
  return <Externo d={d} />
}

function useTela() {
  const [t, setT] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const r = () => setT({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])
  return t
}

function Externo({ d }: { d: DadosExterno }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const [sentido, setSentido] = useState<Sentido>(params.get('sentido') === 'imp' ? 'imp' : 'exp')
  const lista = ANALISES[sentido]
  const [ia, setIa] = useState(() => Math.max(0, lista.findIndex((a) => a.chave === params.get('analise'))))
  const [ip, setIp] = useState(() => Math.max(0, Number(params.get('passo') ?? 0) || 0))
  const [produto, setProduto] = useState(() => params.get('produto') ?? PRODUTO_INICIAL[sentido])
  // o item escolhido na lista própria da passada (Mercados potenciais: a região); null mostra todos
  const [escolha, setEscolha] = useState<string | null>(() => params.get('escolha'))
  const [tocando, setTocando] = useState(false)
  const [densidade, setDensidade] = useState(false)
  const [caixa, setCaixa] = useState(true)
  const tela = useTela()

  const analise = lista[Math.min(ia, lista.length - 1)]
  const passo = analise.passos[Math.min(ip, analise.passos.length - 1)]
  const lugar = `${sentido}|${analise.chave}|${passo.chave}`
  // outra passada: a lista própria volta a mostrar todos
  const lugarAntes = useRef(lugar)
  useEffect(() => {
    if (lugarAntes.current !== lugar) setEscolha(null)
    lugarAntes.current = lugar
  }, [lugar])
  const escolhida = passo.escolhas?.itens.some((x) => x.chave === escolha) ? escolha : null
  const chave = `${lugar}|${passo.produto ? produto : ''}|${escolhida ?? ''}`

  // a sequência inteira, para o "→ próxima" e para tocar sozinha
  const seq = useMemo(() => lista.flatMap((a, ai) => a.passos.map((p, pi) => ({ ai, pi, nome: p.nome, analise: a.nome }))), [lista])
  const pos = seq.findIndex((s) => s.ai === ia && s.pi === ip)
  const ir = (ai: number, pi: number) => {
    setIa(ai)
    setIp(pi)
  }
  const proxima = seq[pos + 1]
  // as análises do lado escolhido (Oferta ou Demanda), com o índice de cada uma na lista inteira
  const doLado = lista.map((a, ai) => ({ a, ai })).filter((x) => x.a.lado === analise.lado)

  // só o último ano: 2025 (índice 10), ou o que a passada disser (o último declarado no Comtrade, por exemplo)
  const i = passo.ano?.({ d, produto }) ?? 10

  // tocar: uma passada depois da outra, até o fim da lista, e recomeça
  useEffect(() => {
    if (!tocando) return
    const t = window.setTimeout(() => {
      const s = seq[(pos + 1) % seq.length]
      ir(s.ai, s.pi)
    }, passo.ms)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tocando, chave])

  // teclado: setas passam de passada, espaço toca, "]" mostra ou esconde o quadro dos produtos
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight' && seq[pos + 1]) (ir(seq[pos + 1].ai, seq[pos + 1].pi), setTocando(false))
      else if (e.key === 'ArrowLeft' && seq[pos - 1]) (ir(seq[pos - 1].ai, seq[pos - 1].pi), setTocando(false))
      else if (e.key === ' ') {
        e.preventDefault()
        setTocando((t) => !t)
      } else if (e.key === ']') setCaixa((c) => !c)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [seq, pos])

  // o endereço guarda o estado, para abrir uma passada pronta
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search)
      q.set('vista', 'externo')
      q.set('sentido', sentido)
      q.set('analise', analise.chave)
      q.set('passo', String(Math.min(ip, analise.passos.length - 1)))
      q.set('produto', produto)
      if (escolhida) q.set('escolha', escolhida)
      else q.delete('escolha')
      history.replaceState(null, '', `?${q.toString()}${window.location.hash}`)
    } catch {
      /* o quadro do site pode recusar; o estado continua valendo na página */
    }
  }, [sentido, analise, ip, produto, escolhida])

  const trocarSentido = (s: Sentido) => {
    if (s === sentido) return
    setSentido(s)
    setIa(0)
    setIp(0)
    setProduto(PRODUTO_INICIAL[s])
  }

  const ctx = { d, produto, i, escolha: escolhida }
  const cena = passo.cena(ctx)
  const folha = passo.folha(ctx)
  const info = passo.info?.(ctx) ?? null
  const aoLado = passo.lado?.(ctx) ?? null
  const figura = passo.figura?.(ctx) ?? null
  const estreita = tela.w < 900
  const margens: Margens = estreita
    ? { esq: 0, dir: 0, topo: 230, base: 130 }
    : { esq: Math.min(300, tela.w * 0.19), dir: caixa ? 110 : 40, topo: 92, base: 86 }

  return (
    <div className={`externo${cena.apagar ? ' apagado' : ''}`}>
      <MapaExterno dados={d} cena={cena} densidade={cena.densidade ?? densidade} margens={margens} chave={chave} />
      <div className="ext-veu" aria-hidden />

      <LinhaDoTempo analises={doLado} ia={ia} ip={ip} pos={pos} seq={seq} ir={(ai, pi) => (ir(ai, pi), setTocando(false))} tocando={tocando} onTocar={() => setTocando((t) => !t)} />

      <Folha f={folha} chave={chave} proximo={proxima?.nome} onProximo={proxima ? () => (ir(proxima.ai, proxima.pi), setTocando(false)) : undefined} />

      {info && !aoLado && <Infografico info={info} chave={chave} />}
      {aoLado && (
        <div className="ext-lado" key={chave}>
          {aoLado}
        </div>
      )}
      {figura && <Figura chave={chave}>{figura}</Figura>}

      <SeletorSentido sentido={sentido} onTrocar={trocarSentido} />

      <section className={`painel ext-quadro${caixa ? '' : ' recolhido'}${passo.produto || passo.escolhas ? '' : ' inativo'}`} aria-hidden={!caixa} aria-label={passo.escolhas?.titulo ?? 'Produto'}>
        <header className="painel-cabeca">
          <span>{passo.escolhas?.titulo ?? 'Produto'}</span>
          <button className="painel-recolher" onClick={() => setCaixa(false)} title="Recolher (])" aria-label="Recolher o quadro dos produtos">
            ›
          </button>
        </header>
        {passo.produto && (
        <ul className="ext-produtos">
          {sentido === 'exp'
            ? ESTAGIOS.map((e) => (
                <li key={e.chave}>
                  <button className={produto === e.chave ? 'ativo' : ''} aria-pressed={produto === e.chave} onClick={() => setProduto(e.chave)}>
                    {e.nome}
                  </button>
                </li>
              ))
            : GRUPOS_INSUMO.map((g) => [
                <li key={`g-${g.nome}`} className="ext-produtos-grupo">
                  {g.nome}
                </li>,
                ...g.chaves
                  .filter((k) => d.imp[k])
                  .map((k) => (
                    <li key={k}>
                      <button className={produto === k ? 'ativo' : ''} aria-pressed={produto === k} onClick={() => setProduto(k)}>
                        {d.imp[k].nome}
                      </button>
                    </li>
                  )),
              ])}
        </ul>
        )}
        {passo.escolhas && (
          <ul className="ext-produtos ext-escolhas">
            <li>
              <button className={escolhida === null ? 'ativo' : ''} aria-pressed={escolhida === null} onClick={() => setEscolha(null)}>
                {passo.escolhas.todos}
              </button>
            </li>
            {passo.escolhas.itens.map((x) => (
              <li key={x.chave}>
                <button className={escolhida === x.chave ? 'ativo' : ''} aria-pressed={escolhida === x.chave} onClick={() => setEscolha((v) => (v === x.chave ? null : x.chave))}>
                  {x.nome}
                </button>
                {escolhida === x.chave && x.nota && <p className="ext-escolha-nota">{x.nota}</p>}
              </li>
            ))}
          </ul>
        )}
        {!passo.produto && !passo.escolhas && <p className="ext-produtos-nota">esta passada olha a cadeia inteira</p>}
      </section>
      {!caixa && (
        <button className="painel-aba direita" onClick={() => setCaixa(true)} title="Mostrar os produtos (])" aria-label="Mostrar os produtos">
          <span className="painel-aba-seta">‹</span>
          <span className="painel-aba-nome">{passo.escolhas?.titulo ?? 'Produto'}</span>
        </button>
      )}

      <NaFaixa>
        <Menu<Lado>
          rotulo="Oferta ou demanda"
          valor={analise.lado}
          opcoes={(['oferta', 'demanda'] as Lado[]).map((l) => ({ chave: l, rotulo: NOME_LADO[l] }))}
          onEscolher={(l) => {
            const k = lista.findIndex((a) => a.lado === l)
            if (k >= 0 && l !== analise.lado) ir(k, 0)
            setTocando(false)
          }}
        />
        <Menu<string>
          rotulo="Análise"
          valor={analise.chave}
          opcoes={doLado.map(({ a }, k) => ({ chave: a.chave, rotulo: a.nome, tecla: k + 1 }))}
          onEscolher={(k) => {
            ir(lista.findIndex((a) => a.chave === k), 0)
            setTocando(false)
          }}
        />
        <BotaoFaixa rotulo="Densidade: tráfego de navios (Global Fishing Watch, 30 dias)" ligado={cena.densidade ?? densidade} onClick={() => setDensidade((x) => !x)}>
          <path d="M2 6c1.6-1.3 3.2-1.3 4.8 0s3.2 1.3 4.8 0 1.6-.6 2.4-.6M2 10c1.6-1.3 3.2-1.3 4.8 0s3.2 1.3 4.8 0 1.6-.6 2.4-.6" />
        </BotaoFaixa>
      </NaFaixa>
    </div>
  )
}

/** A linha do tempo, no alto: o ▶, e as análises do lado escolhido com os tiques das suas passadas; a atual leva o nome em cima. */
function LinhaDoTempo({
  analises,
  ia,
  ip,
  pos,
  seq,
  ir,
  tocando,
  onTocar,
}: {
  analises: { a: Analise; ai: number }[]
  ia: number
  ip: number
  pos: number
  seq: { ai: number; pi: number }[]
  ir: (ai: number, pi: number) => void
  tocando: boolean
  onTocar: () => void
}) {
  return (
    <nav className="ext-tempo" aria-label="Análises e passadas">
      <button className={`ext-tocar${tocando ? ' ligado' : ''}`} onClick={onTocar} title={tocando ? 'Pausar (espaço)' : 'Tocar a sequência (espaço)'} aria-label={tocando ? 'Pausar' : 'Tocar'}>
        {tocando ? (
          <svg viewBox="0 0 10 10" width={9} height={9} aria-hidden>
            <rect x={1.5} y={1} width={2.2} height={8} />
            <rect x={6.3} y={1} width={2.2} height={8} />
          </svg>
        ) : (
          <svg viewBox="0 0 10 10" width={9} height={9} aria-hidden>
            <path d="M2 1 L9 5 L2 9 Z" />
          </svg>
        )}
      </button>
      {analises.map(({ a, ai }) => (
        <div key={a.chave} className={`ext-tempo-grupo${ai === ia ? ' ativo' : ''}`}>
          <div className="ext-tempo-ticks">
            {a.passos.map((p, pi) => {
              const k = seq.findIndex((s) => s.ai === ai && s.pi === pi)
              const atual = ai === ia && pi === ip
              return (
                <button key={p.chave} className={`ext-tick${atual ? ' ativo' : k < pos ? ' passado' : ''}`} title={`${a.nome} · ${p.nome}`} aria-label={`${a.nome}: ${p.nome}`} aria-current={atual} onClick={() => ir(ai, pi)}>
                  <i />
                  {atual && <span className="ext-tick-nome">{p.nome}</span>}
                </button>
              )
            })}
          </div>
          <span className="ext-tempo-nome">{a.nome}</span>
        </div>
      ))}
    </nav>
  )
}

/** Exportações ou Importações, embaixo no meio: mostra a escolhida; um toque abre a outra. */
function SeletorSentido({ sentido, onTrocar }: { sentido: Sentido; onTrocar: (s: Sentido) => void }) {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: Event) => !raiz.current?.contains(e.target as Node) && setAberto(false)
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      setAberto(false)
    }
    window.addEventListener('pointerdown', fora)
    window.addEventListener('keydown', esc, true)
    return () => {
      window.removeEventListener('pointerdown', fora)
      window.removeEventListener('keydown', esc, true)
    }
  }, [aberto])
  return (
    <div className={`ext-sentido-sel${aberto ? ' aberto' : ''}`} ref={raiz}>
      {aberto && (
        <ul className="ext-sentido-lista" role="listbox" aria-label="Sentido do comércio">
          {(['exp', 'imp'] as Sentido[]).map((s) => (
            <li key={s}>
              <button
                role="option"
                aria-selected={s === sentido}
                className={s === sentido ? 'ativo' : ''}
                onClick={() => {
                  onTrocar(s)
                  setAberto(false)
                }}
              >
                {NOME_SENTIDO[s]}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="ext-sentido" aria-haspopup="listbox" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        {NOME_SENTIDO[sentido]}
        <span className="ext-sentido-seta" aria-hidden>
          →
        </span>
      </button>
    </div>
  )
}
