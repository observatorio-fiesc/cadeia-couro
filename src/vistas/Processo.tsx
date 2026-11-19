// Aba Cadeia: a cadeia de produção, como uma árvore.
//   Cada produto abre em como é feito: as operações (na ordem, com a planta), o que entra e o que sobra.
//   O que entra pode ser o produto anterior, que abre do mesmo jeito (o wet blue abre na pele piquelada, que abre
//   na pele em tripa, até o boi), ou um material, que abre no que ele é feito (o sulfato de cromo abre no
//   dicromato de sódio e no ácido sulfúrico). Um clique abre; outro fecha.
//   Um clique numa operação abre o cartão dela; numa sobra, o cartão da sobra; num material, a ficha do elo.

import { useMemo, useState } from 'react'
import type { Contexto } from '../dados/contexto'
import type { No } from '../dados/cadeia'
import { PAPEIS, TIPOS_SAIDA, type Estado, type Operacao, type Papel, type Saida, type TipoSaida } from '../dados/processo'
import { useTela } from '../lib/mapa'
import { NaLegenda } from '../componentes/Faixa'

const ALTURA = 26 // altura de uma linha da árvore
const RECUO = 26 // recuo de cada nível
const CARTAO = 440 // a ficha ou o cartão, à direita

// cor de cada papel de entrada e de cada tipo de saída (variáveis em global.css)
export const COR_PAPEL: Record<Papel, string> = {
  incorporado: 'var(--papel-incorporado)',
  auxiliar: 'var(--papel-auxiliar)',
  maquina: 'var(--papel-maquina)',
  apoio: 'var(--papel-apoio)',
  saber: 'var(--papel-saber)',
}
export const COR_SAIDA: Record<TipoSaida, string> = {
  artigo: 'var(--saida-artigo)',
  coproduto: 'var(--saida-coproduto)',
  residuo: 'var(--saida-residuo)',
  efluente: 'var(--saida-efluente)',
}

/** Como um produto é feito: do produto anterior, pelas operações, com o que entra e o que sobra. */
export type Receita = { ops: Operacao[]; anterior?: Estado; entradas: { no: string; papel: Papel; nota?: string; indicio: boolean }[]; sobras: Saida[]; lugar: string }

type Linha = { chave: string; prof: number; pai: number } & (
  | { tipo: 'produto'; est: Estado; aberto: boolean }
  | { tipo: 'cab'; texto: string; nota?: string }
  | { tipo: 'op'; op: Operacao; n: number }
  | { tipo: 'insumo'; no: No; papel?: Papel; nota?: string; indicio?: boolean; aberto: boolean; abre: boolean }
  | { tipo: 'saida'; s: Saida }
)

type Cartao = { tipo: 'op'; id: string } | { tipo: 'saida'; id: string } | { tipo: 'produto'; id: string } | null

export function VistaProcesso({ ctx, selecionado, onSelecionar }: { ctx: Contexto; selecionado: string | null; onSelecionar: (id: string | null) => void }) {
  const { cadeia, ix, processo: p, ixp } = ctx
  const { w, h } = useTela()
  // o que começa aberto (?abrir=est.wet_blue,est.wet_blue/est.piquelada, para as capturas)
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set((new URLSearchParams(window.location.search).get('abrir') ?? 'est.wet_blue').split(',')))
  const [cartao, setCartao] = useState<Cartao>(null)
  const no = (id: string) => ix.porId.get(id)

  // as operações na ordem do material: as etapas de produção, com o transporte depois da etapa de onde sai
  const receitas = useMemo(() => {
    const m = new Map<string, Receita>()
    if (!p || !ixp) return m
    const seq: Operacao[] = []
    for (const e of p.etapas.filter((x) => x.tipo === 'producao')) {
      seq.push(...(ixp.operacoesDe.get(e.id) ?? []))
      seq.push(...(ixp.operacoesDe.get('sis.transporte') ?? []).filter((o) => o.depois === e.id))
    }
    let ini = 0
    let anterior: Estado | undefined
    seq.forEach((o, i) => {
      if (!o.produz) return
      const est = ixp.estado.get(o.produz)!
      const ops = seq.slice(ini, i + 1)
      const entradas: Receita['entradas'] = []
      for (const pp of PAPEIS)
        for (const op of ops)
          for (const en of op.entradas)
            if (en.papel === pp && !entradas.some((x) => x.no === en.no)) entradas.push({ no: en.no, papel: pp, nota: en.nota, indicio: en.confianca === 'indício' })
      // o que sobra; a venda do próprio produto não é sobra (está no cartão dele)
      const ordem: TipoSaida[] = ['artigo', 'coproduto', 'residuo', 'efluente']
      const sobras = [...new Set(ops.flatMap((op) => op.saidas ?? []))]
        .map((id) => ixp.saida.get(id)!)
        .filter((s) => !(s.tipo === 'artigo' && s.artigo === est.artigo))
        .sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo))
      const lugares = [...new Set(ops.filter((op) => op.etapa !== 'sis.transporte').map((op) => p.etapas.find((e) => e.id === op.etapa)?.lugar ?? ''))]
      m.set(est.id, { ops, anterior, entradas, sobras, lugar: lugares.join(' → ') })
      anterior = est
      ini = i + 1
    })
    return m
  }, [p, ixp])

  // de que um material é feito: os elos de oferta que entram nele
  const acima = (id: string) =>
    (ix.insumosDe.get(id) ?? [])
      .map((i) => cadeia.arestas[i])
      .filter((a) => a.tipo !== 'visual' && no(a.de)?.lado === 'oferta' && (no(a.de)?.camada ?? 0) >= 2)
      .map((a) => ({ n: no(a.de)!, indicio: a.confianca === 'indício' }))

  // a árvore, aberta onde o usuário abriu, em linhas
  const linhas = useMemo(() => {
    const out: Linha[] = []
    if (!p || !ixp) return out
    const produto = (est: Estado, prof: number, chave: string, pai: number, vistos: Set<string>) => {
      const aberto = abertos.has(chave)
      const eu = out.push({ chave, prof, pai, tipo: 'produto', est, aberto }) - 1
      const r = receitas.get(est.id)
      if (!aberto || !r) return
      const cabOps = out.push({ chave: chave + '#como', prof: prof + 1, pai: eu, tipo: 'cab', texto: 'Como é feito', nota: r.lugar }) - 1
      r.ops.forEach((op, i) => out.push({ chave: chave + '#' + op.id, prof: prof + 2, pai: cabOps, tipo: 'op', op, n: i + 1 }))
      const cabEntra = out.push({ chave: chave + '#entra', prof: prof + 1, pai: eu, tipo: 'cab', texto: 'Entra' }) - 1
      if (r.anterior) produto(r.anterior, prof + 2, chave + '/' + r.anterior.id, cabEntra, vistos)
      for (const en of r.entradas) {
        const n = no(en.no)
        if (n) material(n, prof + 2, chave + '/' + en.no, cabEntra, new Set([...vistos, en.no]), en.papel, en.nota, en.indicio)
      }
      if (r.sobras.length) {
        const cabSobra = out.push({ chave: chave + '#sobra', prof: prof + 1, pai: eu, tipo: 'cab', texto: 'Sobra' }) - 1
        for (const s of r.sobras) out.push({ chave: chave + '#' + s.id, prof: prof + 2, pai: cabSobra, tipo: 'saida', s })
      }
    }
    const material = (n: No, prof: number, chave: string, pai: number, vistos: Set<string>, papel?: Papel, nota?: string, indicio?: boolean) => {
      const filhos = acima(n.id).filter((x) => !vistos.has(x.n.id))
      const aberto = abertos.has(chave) && filhos.length > 0
      const eu = out.push({ chave, prof, pai, tipo: 'insumo', no: n, papel, nota, indicio, aberto, abre: filhos.length > 0 }) - 1
      if (aberto) for (const f of filhos) material(f.n, prof + 1, chave + '/' + f.n.id, eu, new Set([...vistos, f.n.id]), undefined, undefined, f.indicio)
    }
    // as raízes: os produtos vendidos, do mais acabado ao menos
    const raizes = [...p.estados].reverse().filter((e) => e.artigo)
    for (const est of raizes) produto(est, 0, est.id, -1, new Set())
    return out
  }, [p, ixp, receitas, abertos])

  if (!p || !ixp) return <div className="aviso-tela">O mapa do processo (processo.json) não foi encontrado.</div>

  const alternar = (chave: string) =>
    setAbertos((a) => {
      const b = new Set(a)
      if (b.has(chave)) for (const k of [...b]) (k === chave || k.startsWith(chave + '/')) && b.delete(k)
      else b.add(chave)
      return b
    })
  const comCartao = !!(selecionado || cartao)
  const largura = w - (comCartao ? CARTAO : 40) - 48
  const xDe = (prof: number) => 10 + prof * RECUO
  const yDe = (i: number) => i * ALTURA + ALTURA / 2

  return (
    <div className="processo">
      <div className="arvore-cadeia" style={{ width: largura, height: h - 290 }}>
        <div className="arvore-titulo">Produtos vendidos · clique para ver como cada um é feito</div>
        <div className="arvore-corpo" style={{ height: linhas.length * ALTURA + 8 }}>
          <svg className="arvore-linhas" width={largura} height={linhas.length * ALTURA + 8}>
            {linhas.map((l, i) => {
              if (l.pai < 0) return null
              const xp = xDe(linhas[l.pai].prof)
              const yp = yDe(l.pai) + 7
              const aceso = l.tipo === 'produto'
              return <path key={l.chave} d={`M${xp} ${yp} V${yDe(i)} H${xDe(l.prof) - 8}`} className={aceso ? 'ramo-arvore produto' : 'ramo-arvore'} />
            })}
          </svg>
          {linhas.map((l, i) => (
            <LinhaArvore
              key={l.chave}
              l={l}
              ctx={ctx}
              x={xDe(l.prof)}
              y={yDe(i)}
              selecionado={selecionado}
              cartao={cartao}
              onAlternar={() => alternar(l.chave)}
              onCartao={(c) => {
                setCartao(c)
                onSelecionar(null)
              }}
              onSelecionar={(id) => {
                setCartao(null)
                onSelecionar(id)
              }}
            />
          ))}
        </div>
      </div>

      {!selecionado && cartao?.tipo === 'op' && ixp.operacao.get(cartao.id) && (
        <CartaoOperacao ctx={ctx} op={ixp.operacao.get(cartao.id)!} onFechar={() => setCartao(null)} onSelecionar={onSelecionar} onSaida={(id) => setCartao({ tipo: 'saida', id })} />
      )}
      {!selecionado && cartao?.tipo === 'produto' && ixp.estado.get(cartao.id) && receitas.get(cartao.id) && (
        <CartaoProduto ctx={ctx} est={ixp.estado.get(cartao.id)!} r={receitas.get(cartao.id)!} onFechar={() => setCartao(null)} onSelecionar={onSelecionar} />
      )}
      {!selecionado && cartao?.tipo === 'saida' && ixp.saida.get(cartao.id) && (
        <CartaoSaida ctx={ctx} s={ixp.saida.get(cartao.id)!} onFechar={() => setCartao(null)} onSelecionar={onSelecionar} onOperacao={(id) => setCartao({ tipo: 'op', id })} />
      )}
      <NaLegenda>
        <div className="legenda-faixa legenda-processo">
          <div className="legenda-titulo">Entra</div>
          <ul className="legenda-chaves">
            <li title="Um produto da cadeia: abre em como ele é feito">
              <i className="chave-losango" />
              Produto
            </li>
            {PAPEIS.map((pp) => (
              <li key={pp} title={p.papeis[pp].descricao}>
                <i className={`chave-${pp === 'maquina' ? 'quadrado' : pp === 'apoio' ? 'tracejado' : 'ponto'}`} style={{ ['--cor' as string]: COR_PAPEL[pp] }} />
                {p.papeis[pp].nome}
              </li>
            ))}
          </ul>
          <div className="legenda-titulo">Sobra</div>
          <ul className="legenda-chaves">
            {TIPOS_SAIDA.map((t) => (
              <li key={t} title={p.tipos_saida[t].descricao}>
                <i className={`chave-${t === 'efluente' ? 'tracejado' : 'quadrado'}`} style={{ ['--cor' as string]: COR_SAIDA[t] }} />
                {p.tipos_saida[t].nome}
              </li>
            ))}
          </ul>
          <p className="legenda-texto">Um clique abre, outro fecha. Um produto abre em como é feito, a partir do produto anterior; um material, no que ele é feito.</p>
          {ixp.pendencias.length > 0 && <p className="legenda-texto">{ixp.pendencias.length} pendências no mapa do processo (ver console)</p>}
        </div>
      </NaLegenda>
    </div>
  )
}

/** Uma linha da árvore: produto, cabeçalho, operação, material ou sobra. */
function LinhaArvore({ l, ctx, x, y, selecionado, cartao, onAlternar, onCartao, onSelecionar }: { l: Linha; ctx: Contexto; x: number; y: number; selecionado: string | null; cartao: Cartao; onAlternar: () => void; onCartao: (c: Cartao) => void; onSelecionar: (id: string) => void }) {
  const p = ctx.processo!
  const pos = { left: x, top: y }
  if (l.tipo === 'cab')
    return (
      <div className="arvore-cab" style={pos}>
        {l.texto}
        {l.nota && <span className="arvore-nota"> · {l.nota}</span>}
      </div>
    )
  if (l.tipo === 'produto')
    return (
      <button
        className={`arvore-linha arvore-produto${l.aberto ? ' aberto' : ''}${cartao?.tipo === 'produto' && cartao.id === l.est.id ? ' marcado' : ''}`}
        style={pos}
        onClick={() => {
          onAlternar()
          onCartao({ tipo: 'produto', id: l.est.id })
        }}
        title={l.est.descricao}
      >
        <i className="arvore-marca losango" aria-hidden />
        <span className="arvore-nome">{l.est.nome}</span>
        <span className={`arvore-seta${l.aberto ? ' aberta' : ''}`} aria-hidden />
        <span className="arvore-nota">{l.est.descricao}</span>
      </button>
    )
  if (l.tipo === 'op') {
    const transporte = l.op.etapa === 'sis.transporte'
    return (
      <button className={`arvore-linha arvore-op${cartao?.tipo === 'op' && cartao.id === l.op.id ? ' marcado' : ''}`} style={pos} onClick={() => onCartao({ tipo: 'op', id: l.op.id })} title={l.op.descricao}>
        <i className="arvore-marca numero" aria-hidden>
          {l.n}
        </i>
        <span className="arvore-nome">{transporte ? `Caminhão: ${l.op.nome.split(':').slice(1).join(':').trim() || l.op.nome}` : l.op.nome}</span>
        <span className="arvore-nota">{l.op.descricao}</span>
      </button>
    )
  }
  if (l.tipo === 'saida')
    return (
      <button className={`arvore-linha arvore-saida${cartao?.tipo === 'saida' && cartao.id === l.s.id ? ' marcado' : ''}`} style={{ ...pos, ['--cor' as string]: COR_SAIDA[l.s.tipo] }} onClick={() => onCartao({ tipo: 'saida', id: l.s.id })} title={l.s.descricao}>
        <i className={`arvore-marca ${l.s.tipo === 'efluente' ? 'tracejado' : 'quadrado'}`} aria-hidden />
        <span className="arvore-nome" style={{ color: COR_SAIDA[l.s.tipo] }}>
          {l.s.nome}
        </span>
        <span className="arvore-nota">
          {p.tipos_saida[l.s.tipo].nome.toLowerCase()} → {l.s.destino}
        </span>
      </button>
    )
  // material
  const cor = l.papel ? COR_PAPEL[l.papel] : 'var(--traco-2)'
  const forma = l.papel === 'maquina' ? 'quadrado' : l.papel === 'apoio' ? 'tracejado' : 'ponto'
  return (
    <button
      className={`arvore-linha arvore-insumo${l.aberto ? ' aberto' : ''}${selecionado === l.no.id ? ' marcado' : ''}`}
      style={{ ...pos, ['--cor' as string]: cor }}
      onClick={() => {
        if (l.abre) onAlternar()
        onSelecionar(l.no.id)
      }}
      title={l.no.descricao}
    >
      <i className={`arvore-marca ${forma}`} aria-hidden />
      <span className="arvore-nome">{l.no.nome}</span>
      {l.abre && (
        <span className={`arvore-seta${l.aberto ? ' aberta' : ''}`} aria-hidden />
      )}
      <span className="arvore-nota">
        {l.papel ? p.papeis[l.papel].nome.toLowerCase() : ''}
        {l.nota ? ` · ${l.nota}` : ''}
        {l.indicio ? ' · indício' : ''}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------- cartões de operação e de saída
function Fontes({ ctx, ids }: { ctx: Contexto; ids: string[] }) {
  return (
    <section>
      <h3>Fontes</h3>
      <ul className="fontes-lista">
        {ids.map((f) => (
          <li key={f}>{ctx.cadeia.meta.fontes[f] ?? f}</li>
        ))}
      </ul>
    </section>
  )
}

function CartaoOperacao({ ctx, op, onFechar, onSelecionar, onSaida }: { ctx: Contexto; op: Operacao; onFechar: () => void; onSelecionar: (id: string | null) => void; onSaida: (id: string) => void }) {
  const p = ctx.processo!
  const ixp = ctx.ixp!
  const etapa = ctx.ix.porId.get(op.etapa)
  const lugar = p.etapas.find((e) => e.id === op.etapa)?.lugar
  const est = op.produz ? ixp.estado.get(op.produz) : undefined
  return (
    <aside className="ficha cartao-processo">
      <button className="fechar" onClick={onFechar} aria-label="Fechar">
        ×
      </button>
      <div className="sobretitulo">Operação · {etapa?.nome}</div>
      <h2>{op.nome}</h2>
      {lugar && <div className="planta">{lugar}</div>}
      <p>{op.descricao}</p>
      {op.banho && <p className="nota">Feita em banho: usa a água e o vapor do apoio, e o banho usado vai para o tratamento de efluente.</p>}
      {PAPEIS.filter((pp) => op.entradas.some((e) => e.papel === pp)).map((pp) => (
        <section key={pp}>
          <h3 style={{ color: COR_PAPEL[pp] }}>{p.papeis[pp].nome}</h3>
          {op.entradas
            .filter((e) => e.papel === pp)
            .map((e) => (
              <button key={e.no} className="linha linha-botao" onClick={() => onSelecionar(e.no)}>
                <span>
                  {ctx.ix.porId.get(e.no)?.nome ?? e.no}
                  {e.nota && <em className="nota-inline"> · {e.nota}</em>}
                </span>
                <b>{e.confianca === 'indício' ? 'indício' : e.essencial === false ? 'opcional' : ''}</b>
              </button>
            ))}
        </section>
      ))}
      {(est || op.saidas?.length) && (
        <section>
          <h3>Sai</h3>
          {est && (
            <div className="linha">
              <span>◆ {est.nome}</span>
              <b>{est.artigo ? 'também vendido' : ''}</b>
            </div>
          )}
          {(op.saidas ?? []).map((id) => {
            const s = ixp.saida.get(id)!
            return (
              <button key={id} className="linha linha-botao" onClick={() => onSaida(id)}>
                <span style={{ color: COR_SAIDA[s.tipo] }}>{s.nome}</span>
                <b>{s.destino}</b>
              </button>
            )
          })}
        </section>
      )}
      <Fontes ctx={ctx} ids={op.fontes} />
      <p className="nota">Confiança: {op.confianca}. As operações seguem a literatura técnica de curtimento; a receita da Viposa não é pública.</p>
    </aside>
  )
}

function CartaoProduto({ ctx, est, r, onFechar, onSelecionar }: { ctx: Contexto; est: Estado; r: Receita; onFechar: () => void; onSelecionar: (id: string | null) => void }) {
  const nome = (id: string) => ctx.ix.porId.get(id)?.nome ?? id
  return (
    <aside className="ficha cartao-processo">
      <button className="fechar" onClick={onFechar} aria-label="Fechar">
        ×
      </button>
      <div className="sobretitulo">Produto</div>
      <h2>{est.nome}</h2>
      {r.lugar && <div className="planta">{r.lugar}</div>}
      <p>{est.descricao}</p>
      <section>
        <h3>Como é feito</h3>
        {r.anterior && (
          <div className="linha">
            <span>A partir de</span>
            <b>◆ {r.anterior.nome}</b>
          </div>
        )}
        <div className="linha">
          <span>Operações</span>
          <b>{r.ops.length}</b>
        </div>
        <div className="linha">
          <span>Materiais, máquinas e apoio que entram</span>
          <b>{r.entradas.length}</b>
        </div>
        <div className="linha">
          <span>Sobras</span>
          <b>{r.sobras.length}</b>
        </div>
        <p className="nota">A árvore, à esquerda, abre cada um.</p>
      </section>
      {est.artigo && (
        <section>
          <h3>Também vendido assim</h3>
          <button className="linha linha-botao" onClick={() => onSelecionar(est.artigo!)}>
            <span>{nome(est.artigo)}</span>
            <b>ficha</b>
          </button>
        </section>
      )}
      <Fontes ctx={ctx} ids={[...new Set(r.ops.flatMap((o) => o.fontes))]} />
    </aside>
  )
}

function CartaoSaida({ ctx, s, onFechar, onSelecionar, onOperacao }: { ctx: Contexto; s: Saida; onFechar: () => void; onSelecionar: (id: string | null) => void; onOperacao: (id: string) => void }) {
  const p = ctx.processo!
  const ixp = ctx.ixp!
  const origens = ixp.origem.get(s.id) ?? []
  const artigo: No | undefined = s.artigo ? ctx.ix.porId.get(s.artigo) : undefined
  return (
    <aside className="ficha cartao-processo">
      <button className="fechar" onClick={onFechar} aria-label="Fechar">
        ×
      </button>
      <div className="sobretitulo" style={{ color: COR_SAIDA[s.tipo] }}>
        {p.tipos_saida[s.tipo].nome}
      </div>
      <h2>{s.nome}</h2>
      <p>{s.descricao}</p>
      <section>
        <h3>De onde sai</h3>
        {origens.map((o) => (
          <button key={o.id} className="linha linha-botao" onClick={() => onOperacao(o.id)}>
            <span>{o.nome}</span>
            <b>{ctx.ix.porId.get(o.etapa)?.nome}</b>
          </button>
        ))}
      </section>
      <section>
        <h3>Para onde vai</h3>
        {s.para ? (
          <button className="linha linha-botao" onClick={() => onOperacao(s.para!)}>
            <span>{s.destino}</span>
            <b>ver a operação</b>
          </button>
        ) : (
          <div className="linha">
            <span>{s.destino}</span>
          </div>
        )}
        {artigo && (
          <button className="linha linha-botao" onClick={() => onSelecionar(artigo.id)}>
            <span>Artigo na cadeia: {artigo.nome}</span>
            <b>ficha</b>
          </button>
        )}
      </section>
      <Fontes ctx={ctx} ids={s.fontes} />
      <p className="nota">Confiança: {s.confianca}.</p>
    </aside>
  )
}
