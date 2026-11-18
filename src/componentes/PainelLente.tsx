// Painéis laterais das lentes Ormuz e China: a lista que explica a cor da ampulheta.

import type { Cadeia, No } from '../dados/cadeia'
import { pct, variacao } from '../lib/formato'

const golfo25 = (n: No) => (n.comercio?.ormuz_2025 ?? 0) + (n.comercio?.oma_2025 ?? 0)

export function PainelOrmuz({ cadeia, onSelecionar }: { cadeia: Cadeia; onSelecionar: (id: string) => void }) {
  const itens = cadeia.nos.filter((n) => n.comercio && golfo25(n) >= 0.01).sort((a, b) => golfo25(b) - golfo25(a))
  const semGolfo = cadeia.nos.filter((n) => n.comercio && golfo25(n) < 0.01 && n.camada === 2 && n.lado === 'oferta')
  return (
    <aside className="ficha painel-lente">
      <div className="sobretitulo">Parcela do Golfo nas compras do Brasil · mar–set</div>
      <h2>2025 contra 2026</h2>
      <div className="legenda-barras">
        <span><i className="b25" /> 2025</span>
        <span><i className="b26" /> 2026</span>
        <span className="oma">Omã, fora do estreito</span>
      </div>
      {itens.map((n) => {
        const c = n.comercio!
        return (
          <button key={n.id} className="barra-item" onClick={() => onSelecionar(n.id)}>
            <div className="barra-titulo">
              <span>{n.nome}</span>
              <em>preço {variacao(c.var_preco)}</em>
            </div>
            <div className="barra-trilho">
              <i className="b25" style={{ width: `${golfo25(n) * 100}%` }} />
              <i className="b25-oma" style={{ width: `${(c.oma_2025 ?? 0) * 100}%` }} />
            </div>
            <div className="barra-trilho">
              <i className="b26" style={{ width: `${((c.ormuz_2026 ?? 0) + (c.oma_2026 ?? 0)) * 100}%` }} />
              <i className="b26-oma" style={{ width: `${(c.oma_2026 ?? 0) * 100}%` }} />
            </div>
            <div className="barra-valores">
              {pct(golfo25(n))} → {pct((c.ormuz_2026 ?? 0) + (c.oma_2026 ?? 0))}
            </div>
          </button>
        )
      })}
      <p className="nota">
        Sem compra no Golfo: {semGolfo.map((n) => n.nome.toLowerCase()).join(', ')}.
      </p>
      <p className="nota">Dentro do estreito: Arábia Saudita, Barein, Catar, Emirados Árabes Unidos, Irã, Iraque e Kuwait. Comex Stat, US$ FOB.</p>
    </aside>
  )
}

export function PainelChina({ cadeia, onSelecionar }: { cadeia: Cadeia; onSelecionar: (id: string) => void }) {
  const itens = cadeia.nos
    .filter((n) => n.comercio && (n.comercio.china_2025 ?? 0) >= 0.05)
    .sort((a, b) => (b.comercio!.china_2025 ?? 0) - (a.comercio!.china_2025 ?? 0))
  return (
    <aside className="ficha painel-lente">
      <div className="sobretitulo">Parcela da China nas compras do Brasil · mar–set</div>
      <h2>2025 contra 2026</h2>
      <div className="legenda-barras">
        <span><i className="b25 ambar" /> 2025</span>
        <span><i className="b26 ambar" /> 2026</span>
      </div>
      {itens.map((n) => {
        const c = n.comercio!
        const primeira = c.origens_2025[0]?.[0] === 'China'
        return (
          <button key={n.id} className="barra-item" onClick={() => onSelecionar(n.id)}>
            <div className="barra-titulo">
              <span>{n.nome}</span>
              <em>{primeira ? '1ª origem' : `1ª origem: ${c.origens_2025[0]?.[0] ?? '–'}`}</em>
            </div>
            <div className="barra-trilho">
              <i className="b25 ambar" style={{ width: `${(c.china_2025 ?? 0) * 100}%` }} />
            </div>
            <div className="barra-trilho">
              <i className="b26 ambar" style={{ width: `${(c.china_2026 ?? 0) * 100}%` }} />
            </div>
            <div className="barra-valores">
              {pct(c.china_2025)} → {pct(c.china_2026)}
            </div>
          </button>
        )
      })}
      <p className="nota">Comex Stat, US$ FOB. A parcela é do valor importado pelo Brasil, não só pelos curtumes.</p>
    </aside>
  )
}
