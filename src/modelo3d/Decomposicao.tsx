// Quadro de decomposição, no desenho do visualizador do submarino (painel-comandante): um painel de filete
// fino à esquerda, uma árvore de linhas compactas, e uma aba na borda da tela quando recolhido ([ alterna).
// No boi e na vaca, tudo sai dos animais: o que os mantém, a pele por região, as camadas da pele.
// No sapato, as peças da bota.
import { useEffect, useState } from 'react'
import type { Sexo } from './forma'
import { CAMADAS, ETAPAS, INSUMOS_ANIMAL, PARTES_BOTA, REGIOES, type Modo, type Sistema } from './receitas'
import type { Hover } from './estado'

/** O item escolhido em cada etapa (pelo id da etapa) e a peça escolhida da bota. */
export type Selecao = Record<'interior' | 'regiao' | 'pele' | 'bota', string | null>

type Props = {
  sistema: Sistema
  modo: Modo
  sexo: Sexo
  selecao: Selecao
  hover: Hover
  onRaiz: () => void
  onSexo: (s: Sexo) => void
  onEtapa: (m: Modo) => void
  onFilho: (etapa: string, id: string) => void
  onHover: (h: Hover) => void
}

// os itens de cada etapa e o tipo de ponteiro que eles acendem na cena
const FILHOS: Record<string, { lista: { id: string; nome: string }[]; hover: (id: string) => Hover }> = {
  interior: { lista: INSUMOS_ANIMAL, hover: (id) => ({ tipo: 'insumo', id }) },
  regiao: { lista: REGIOES, hover: (id) => ({ tipo: 'regiao', regiao: id as (typeof REGIOES)[number]['id'], sexo: null }) },
  pele: { lista: CAMADAS, hover: (id) => ({ tipo: 'camada', id }) },
}
const idDoHover = (h: Hover): string | null => (!h ? null : h.tipo === 'regiao' ? h.regiao : 'id' in h ? h.id : null)

// recuo de cada nível da árvore, como no visualizador do submarino
const recuo = (nivel: number) => ({ paddingLeft: 10 + nivel * 14 })

/** Uma linha de item (filho de uma etapa ou peça da bota). */
function Item({ n, nome, ativo, quente, nivel, onClick, onEnter, onLeave }: { n: number; nome: string; ativo: boolean; quente: boolean; nivel: number; onClick: () => void; onEnter: () => void; onLeave: () => void }) {
  return (
    <li>
      <button className={`decomp-linha decomp-alvo${ativo ? ' selecionada' : ''}${quente ? ' hover' : ''}`} style={recuo(nivel)} aria-current={ativo ? 'true' : undefined} onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick}>
        <span className="decomp-idx">{n}</span>
        <span className="decomp-nome">{nome}</span>
      </button>
    </li>
  )
}

export function Decomposicao(p: Props) {
  const estreita = typeof window !== 'undefined' && window.innerWidth < 900
  const [aberto, setAberto] = useState(!estreita)
  const etapaAtual = ETAPAS.find((e) => e.modo === p.modo)?.id ?? null
  const [abertas, setAbertas] = useState<Set<string>>(new Set(etapaAtual ? [etapaAtual] : ['regiao']))
  // a etapa em que se está fica aberta; as outras fecham
  useEffect(() => {
    if (etapaAtual) setAbertas(new Set([etapaAtual]))
  }, [etapaAtual])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === '[' && !(e.target instanceof HTMLInputElement)) setAberto((a) => !a)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])
  const alternar = (id: string) =>
    setAbertas((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const titulo = `${aberto ? 'Recolher' : 'Mostrar'} a decomposição ([)`
  const hv = idDoHover(p.hover)

  const arvoreAnimais = (
    <li>
      <div className={`decomp-linha raiz${p.modo === 'animal' ? ' selecionada' : ' caminho'}`} style={recuo(0)}>
        <button className="decomp-alvo" onClick={p.onRaiz} aria-current={p.modo === 'animal' ? 'step' : undefined}>
          <span className="decomp-idx raiz-idx">◆</span>
          <span className="decomp-nome">Boi e vaca</span>
        </button>
        <span className="sexos" role="group" aria-label="Animal">
          {(['boi', 'vaca'] as Sexo[]).map((s) => (
            <button key={s} className={s === p.sexo ? 'ativo' : ''} aria-pressed={s === p.sexo} onClick={() => p.onSexo(s)}>
              {s === 'boi' ? 'Boi' : 'Vaca'}
            </button>
          ))}
        </span>
      </div>
      <ul>
        {ETAPAS.map((e) => {
          const ativa = e.modo === p.modo
          const sel = p.selecao[e.id as keyof Selecao]
          const filhos = FILHOS[e.id]
          const aberta = abertas.has(e.id)
          const classe = ['decomp-linha', ativa && !sel && 'selecionada', ativa && sel && 'caminho'].filter(Boolean).join(' ')
          return (
            <li key={e.id}>
              <div className={classe} style={recuo(1)}>
                <button className="decomp-alvo" aria-current={ativa ? 'step' : undefined} onClick={() => p.onEtapa(e.modo)}>
                  <span className="decomp-idx">{e.n}</span>
                  <span className="decomp-nome">
                    {e.nome}
                    <em>{e.local}</em>
                  </span>
                </button>
                <button className="decomp-mais" onClick={() => alternar(e.id)} aria-expanded={aberta} aria-label={aberta ? 'Fechar' : 'Abrir'}>
                  {aberta ? '−' : '+'}
                </button>
              </div>
              {aberta && (
                <ul>
                  {filhos.lista.map((f, i) => (
                    <Item
                      key={f.id}
                      n={i + 1}
                      nome={f.nome}
                      nivel={2}
                      ativo={ativa && sel === f.id}
                      quente={ativa && hv === f.id}
                      onEnter={() => p.onHover(filhos.hover(f.id))}
                      onLeave={() => p.onHover(null)}
                      onClick={() => p.onFilho(e.id, f.id)}
                    />
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </li>
  )

  const arvoreSapato = (
    <li>
      <div className={`decomp-linha raiz${p.selecao.bota ? ' caminho' : ' selecionada'}`} style={recuo(0)}>
        <button className="decomp-alvo" onClick={p.onRaiz} aria-current={p.selecao.bota ? undefined : 'step'}>
          <span className="decomp-idx raiz-idx">◆</span>
          <span className="decomp-nome">
            Calçado de segurança
            <em>Caçador (SC)</em>
          </span>
        </button>
      </div>
      <ul>
        {PARTES_BOTA.map((pt) => (
          <Item
            key={pt.id}
            n={pt.n}
            nome={pt.nome}
            nivel={1}
            ativo={p.selecao.bota === pt.id}
            quente={hv === pt.id}
            onEnter={() => p.onHover({ tipo: 'parte', id: pt.id })}
            onLeave={() => p.onHover(null)}
            onClick={() => p.onFilho('bota', pt.id)}
          />
        ))}
      </ul>
    </li>
  )

  return (
    <>
      <aside className={`painel decomp-painel${aberto ? '' : ' recolhido'}`} aria-hidden={!aberto}>
        <header className="painel-cabeca">
          <span>Decomposição</span>
          <button className="painel-recolher" onClick={() => setAberto(false)} title={titulo} aria-label={titulo}>
            ‹
          </button>
        </header>
        <ul className="decomp-lista">{p.sistema === 'sapato' ? arvoreSapato : arvoreAnimais}</ul>
      </aside>
      {!aberto && (
        <button className="painel-aba esquerda" onClick={() => setAberto(true)} title={titulo} aria-label={titulo}>
          <span className="painel-aba-seta">›</span>
          <span className="painel-aba-nome">Decomposição</span>
        </button>
      )}
    </>
  )
}
