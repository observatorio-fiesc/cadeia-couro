// O título que escolhe o sistema, como no visualizador do submarino (SystemSelect): o nome da cadeia e,
// depois dele, o sistema em vista; um toque abre a lista. Esc ou um toque fora fecham.
import { useEffect, useRef, useState } from 'react'

export type OpcaoSistema<K> = { id: K; codigo: string; nome: string; sobre: string }

export function SeletorSistema<K extends string>({ titulo, valor, opcoes, onEscolher }: { titulo: string; valor: K; opcoes: OpcaoSistema<K>[]; onEscolher: (k: K) => void }) {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: Event) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false)
    }
    // pega o Esc antes da vista: fechar a lista é o primeiro passo de volta
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
  const atual = opcoes.find((o) => o.id === valor)
  return (
    <div className="sistema" ref={raiz}>
      <button className="sistema-atual" aria-haspopup="listbox" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        <h1>
          {titulo}
          {atual && <span className="sistema-nome"> · {atual.nome}</span>}
        </h1>
        <span className="sistema-seta">{aberto ? '▴' : '▾'}</span>
      </button>
      {aberto && (
        <ul className="sistema-lista" role="listbox" aria-label="Sistema">
          {opcoes.map((o) => (
            <li key={o.id}>
              <button
                role="option"
                aria-selected={o.id === valor}
                className={o.id === valor ? 'ativo' : ''}
                onClick={() => {
                  if (o.id !== valor) onEscolher(o.id)
                  setAberto(false)
                }}
              >
                <span className="sistema-codigo">{o.codigo}</span>
                <span className="sistema-op-nome">{o.nome}</span>
                <span className="sistema-sobre">{o.sobre}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
