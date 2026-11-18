// Faixa de controles, no canto inferior esquerdo, como a do visualizador do submarino (painel-comandante):
// uma linha só, com menus que abrem para cima e botões de ícone. Cada vista põe ali os próprios controles
// (por portal, em `Doca.faixa`) e a sua legenda acima da faixa (`Doca.legenda`).
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type Doca = { faixa: HTMLElement | null; legenda: HTMLElement | null; cabeca: HTMLElement | null }
export const DocaContext = createContext<Doca>({ faixa: null, legenda: null, cabeca: null })

/** Põe os controles de uma vista na faixa, depois dos controles gerais. */
export function NaFaixa({ children }: { children: ReactNode }) {
  const { faixa } = useContext(DocaContext)
  return faixa ? createPortal(children, faixa) : null
}

/** Põe no título, no alto à esquerda, o seletor de sistema de uma vista (no lugar do título fixo). */
export function NaCabeca({ children }: { children: ReactNode }) {
  const { cabeca } = useContext(DocaContext)
  return cabeca ? createPortal(children, cabeca) : null
}

/** Põe a legenda de uma vista acima da faixa. */
export function NaLegenda({ children }: { children: ReactNode }) {
  const { legenda } = useContext(DocaContext)
  return legenda ? createPortal(children, legenda) : null
}

export type Opcao<K> = {
  chave: K
  rotulo: string
  /** cor da bolinha da opção; sem ela, a opção é só texto */
  cor?: string
  dica?: string
  /** número da tecla que leva à opção */
  tecla?: number
}

/** Menu da faixa: mostra a opção escolhida e abre a lista para cima. Esc, um toque fora ou a escolha fecham. */
export function Menu<K extends string>({ valor, opcoes, onEscolher, rotulo }: { valor: K; opcoes: Opcao<K>[]; onEscolher: (k: K) => void; rotulo: string }) {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: Event) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false)
    }
    // pega o Esc antes das vistas: fechar o menu é o primeiro passo de volta
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
  const atual = opcoes.find((o) => o.chave === valor)
  const cor = (o?: Opcao<K>) => ({ '--cor': o?.cor ?? 'transparent' }) as CSSProperties
  return (
    <div className={`menu${aberto ? ' aberto' : ''}`} ref={raiz}>
      <button className="menu-atual" aria-haspopup="listbox" aria-expanded={aberto} aria-label={rotulo} title={rotulo} onClick={() => setAberto((a) => !a)}>
        {atual?.tecla != null && <span className="tecla">{atual.tecla}</span>}
        {atual?.cor && <span className="menu-ponto ligado" style={cor(atual)} />}
        <span>{atual?.rotulo}</span>
        <span className="menu-seta" aria-hidden />
      </button>
      {aberto && (
        <ul className="menu-lista" role="listbox" aria-label={rotulo}>
          {opcoes.map((o) => (
            <li key={o.chave}>
              <button
                role="option"
                aria-selected={o.chave === valor}
                className={o.chave === valor ? 'ativo' : ''}
                title={o.dica}
                onClick={() => {
                  onEscolher(o.chave)
                  setAberto(false)
                }}
              >
                {o.tecla != null && <span className="tecla">{o.tecla}</span>}
                {o.cor && <span className={`menu-ponto${o.chave === valor ? ' ligado' : ''}`} style={cor(o)} />}
                {o.rotulo}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Botão de ícone da faixa. */
export function BotaoFaixa({ rotulo, ligado, onClick, children }: { rotulo: string; ligado?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className={`faixa-botao${ligado ? ' ligado' : ''}`} onClick={onClick} title={rotulo} aria-label={rotulo} aria-pressed={ligado}>
      <svg className="faixa-icone" viewBox="0 0 16 16" aria-hidden>
        {children}
      </svg>
    </button>
  )
}
