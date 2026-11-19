// A folha de cada passada, escrita direto sobre o mapa, como nos Cenários estratégicos do painel-comandante: só um
// número grande que conta até o valor e uma linha em caixa alta. Quando a passada pede, um infográfico quase
// transparente fica acima da faixa de controles. Sem legenda nem fonte: as fontes ficam no botão "Fontes e definições".
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { nf } from './dados'
import type { Tom } from './Mapa'

/* ---------- o número ---------- */

export type Numero = { v: number; casas?: number; prefixo?: string; sufixo?: string; sinal?: boolean }

/** Um número que conta até o valor, a partir de onde estava (nos anos que correm, ele acompanha). */
export function Conta({ n, atraso = 0 }: { n: Numero; atraso?: number }) {
  const [v, setV] = useState(0)
  const em = useRef(0)
  const casas = n.casas ?? 0
  useEffect(() => {
    let raf = 0
    const inicio = performance.now() + atraso
    const de = em.current
    const passo = (agora: number) => {
      const p = Math.min(1, Math.max(0, (agora - inicio) / 900))
      const f = 10 ** casas
      const x = Math.round((de + (n.v - de) * (1 - (1 - p) ** 3)) * f) / f
      em.current = x
      setV(x)
      if (p < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [n.v, casas, atraso])
  return (
    <>
      {n.sinal && v > 0 ? '+' : v < 0 ? '−' : ''}
      {n.prefixo}
      {nf(Math.abs(v), casas)}
      {n.sufixo && <small>{n.sufixo}</small>}
    </>
  )
}

/* ---------- a folha ---------- */

export type FolhaPasso = { numero: Numero; palavra: string }

export function Folha({ f, chave, proximo, onProximo }: { f: FolhaPasso; chave: string; proximo?: string; onProximo?: () => void }) {
  return (
    <aside className="ext-folha" aria-live="polite">
      <div className="ext-cabeca" key={chave}>
        <b className="ext-num">
          <Conta n={f.numero} atraso={350} />
        </b>
        <span className="ext-palavra">{f.palavra}</span>
      </div>
      {proximo && onProximo && (
        <nav className="ext-proximo" key={`p${chave}`}>
          <button onClick={onProximo}>
            <span aria-hidden>→</span>
            {proximo}
          </button>
        </nav>
      )}
    </aside>
  )
}

/* ---------- o infográfico, acima da faixa de controles ---------- */

export type Info = {
  titulo: string
  /** `v` de −1 a 1, parte da maior; negativo desce da linha do zero */
  colunas: { nome: string; v: number; rotulo: string; sub?: string; tom?: Tom }[]
  /** réguas em parte da maior, com o texto de cada uma */
  reguas?: [number, string][]
}

export function Infografico({ info, chave }: { info: Info; chave: string }) {
  const [sobe, setSobe] = useState(false)
  useEffect(() => {
    setSobe(false)
    const t = window.setTimeout(() => setSobe(true), 650)
    return () => window.clearTimeout(t)
  }, [chave])
  const negativos = info.colunas.some((c) => c.v < 0)
  const meio = negativos ? 50 : 0
  return (
    <figure className={`ext-info${negativos ? ' com-zero' : ''}`} key={chave}>
      <figcaption>{info.titulo}</figcaption>
      <div className="ext-info-plot">
        {info.reguas?.map(([r, t]) => (
          <i key={t} className="ext-info-regua" style={{ bottom: `${meio + r * (100 - meio)}%` }}>
            <span>{t}</span>
          </i>
        ))}
        {negativos && <i className="ext-info-zero" style={{ bottom: '50%' }} />}
        {info.colunas.map((c, i) => {
          const alto = Math.abs(c.v) * (100 - meio)
          return (
            <div key={c.nome} className="ext-info-col">
              <div
                className={`ext-info-barra tom-${c.tom ?? 'couro'}${c.v < 0 ? ' desce' : ''}`}
                style={{ height: sobe ? `${alto}%` : 0, bottom: c.v < 0 ? `${meio - alto}%` : `${meio}%`, transitionDelay: `${i * 90}ms` }}
              >
                <b>{c.rotulo}</b>
              </div>
            </div>
          )
        })}
      </div>
      <div className="ext-info-nomes">
        {info.colunas.map((c) => (
          <span key={c.nome}>
            {c.nome}
            {c.sub && <i>{c.sub}</i>}
          </span>
        ))}
      </div>
    </figure>
  )
}

/** Uma figura sobre o mapa apagado (como "Enxofre e ácido"): o desenho ocupa o meio e a direita da tela. */
export function Figura({ children, chave }: { children: ReactNode; chave: string }) {
  return (
    <div className="ext-figura" key={chave}>
      {children}
    </div>
  )
}
