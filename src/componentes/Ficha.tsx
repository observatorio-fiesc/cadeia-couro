// Ficha do elo escolhido: o que é, de quem depende, o que alimenta, comércio e fontes.

import type { Cadeia, Indice, No } from '../dados/cadeia'
import { inteiro, musd, pct, variacao } from '../lib/formato'

type Props = { cadeia: Cadeia; ix: Indice; no: No; onSelecionar: (id: string | null) => void; onVerNoMapa?: () => void }

export function Ficha({ cadeia, ix, no, onSelecionar, onVerNoMapa }: Props) {
  const meta = cadeia.meta
  const camada = meta.camadas[no.lado]?.[String(no.camada)] ?? ''
  const tronco = meta.troncos[no.tronco] ?? no.tronco
  const entram = (ix.insumosDe.get(no.id) ?? []).map((i) => cadeia.arestas[i]).filter((a) => a.tipo !== 'visual')
  const saem = (ix.dependentesDe.get(no.id) ?? []).map((i) => cadeia.arestas[i]).filter((a) => a.tipo !== 'visual')
  const c = no.comercio
  const doDestino = no.tipo === 'mercado' ? entram.filter((a) => a.valor_usd).sort((a, b) => (b.valor_usd ?? 0) - (a.valor_usd ?? 0)) : []

  return (
    <aside className="ficha">
      <button className="fechar" onClick={() => onSelecionar(null)} aria-label="Fechar">×</button>
      <div className="sobretitulo">{camada === tronco ? camada : `${camada} · ${tronco}`}</div>
      <h2>{no.nome}</h2>
      {no.planta && <div className="planta">{no.planta}</div>}
      {no.descricao && <p>{no.descricao}</p>}
      {no.gargalo && <p className="gargalo">{no.gargalo}</p>}

      {no.lado === 'oferta' && no.alcance_cadeia != null && (
        <section>
          <h3>Alcance na cadeia</h3>
          <div className="linha-numero">
            <span className="numero-medio">{pct(no.alcance_cadeia)}</span>
            <span className="nota">
              {no.jusante} de {meta.base_alcance_cadeia} etapas, insumos, materiais e artigos dependem deste elo
            </span>
          </div>
          <Linha rotulo="Artigos afetados" valor={pct(no.alcance_artigos)} />
          <Linha rotulo="Valor exportado afetado (2025)" valor={pct(no.alcance_exportacao)} />
        </section>
      )}

      {c && (
        <section>
          <h3>Importação do Brasil · {c.janela}</h3>
          <Linha rotulo="2025" valor={`${musd(c.musd_2025)} · ${inteiro(c.kt_2025 * 1000)} t`} />
          <Linha rotulo="2026" valor={`${musd(c.musd_2026)} · ${inteiro(c.kt_2026 * 1000)} t`} />
          <Linha rotulo="Volume 2026 × 2025" valor={variacao(c.var_kg_total)} />
          <Linha rotulo="Preço (US$/kg) 2026 × 2025" valor={variacao(c.var_preco)} />
          <Linha rotulo="Golfo, dentro do estreito" valor={`${pct(c.ormuz_2025)} → ${pct(c.ormuz_2026)}`} alerta={(c.ormuz_2025 ?? 0) >= 0.05} />
          <Linha rotulo="Omã, fora do estreito" valor={`${pct(c.oma_2025)} → ${pct(c.oma_2026)}`} />
          <Linha rotulo="China" valor={`${pct(c.china_2025)} → ${pct(c.china_2026)}`} />
          <div className="origens">
            <Origens titulo="Origens 2025" lista={c.origens_2025} />
            <Origens titulo="Origens 2026" lista={c.origens_2026} />
          </div>
          <p className="nota">Códigos: {c.codigos.join(', ')}. Valores FOB nominais; meses de 2026 sujeitos a revisão do MDIC.</p>
          {onVerNoMapa && (
            <button className="chip chip-ativo" onClick={onVerNoMapa}>
              Ver origens e portos no mapa →
            </button>
          )}
        </section>
      )}

      {no.exportacao_musd && (
        <section>
          <h3>Exportação registrada nos municípios das plantas</h3>
          <Linha rotulo="2024" valor={musd(no.exportacao_musd['2024'])} />
          <Linha rotulo="2025" valor={musd(no.exportacao_musd['2025'])} />
          <Linha rotulo="2026 (jan–out)" valor={musd(no.exportacao_musd['2026'])} />
          <p className="nota">Município do domicílio fiscal do exportador, não do local de produção.</p>
        </section>
      )}

      {doDestino.length > 0 && (
        <section>
          <h3>O que chega · {meta.ano_destinos}</h3>
          {doDestino.map((a) => (
            <Linha key={a.de} rotulo={ix.porId.get(a.de)?.nome ?? a.de} valor={musd((a.valor_usd ?? 0) / 1e6) + (a.confianca === 'indício' ? ' · indício' : '')} />
          ))}
          <p className="nota">Exportações registradas em Caçador, Nova Andradina e Várzea Grande (domicílio fiscal do exportador).</p>
        </section>
      )}

      {entram.length > 0 && (
        <section>
          <h3>{no.lado === 'demanda' ? 'Vem de' : 'Depende de'}</h3>
          <Chips ids={entram.map((a) => a.de)} ix={ix} onSelecionar={onSelecionar} marcados={new Set(entram.filter((a) => !a.essencial || a.confianca === 'indício').map((a) => a.de))} />
        </section>
      )}
      {saem.length > 0 && (
        <section>
          <h3>Alimenta</h3>
          <Chips ids={saem.map((a) => a.para)} ix={ix} onSelecionar={onSelecionar} marcados={new Set()} />
        </section>
      )}

      <section className="fontes">
        <h3>Confiança: {no.confianca}</h3>
        <ul>
          {no.fontes.map((f) => (
            <li key={f}>{meta.fontes[f] ?? f}</li>
          ))}
        </ul>
      </section>
    </aside>
  )
}

function Linha({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className={`linha${alerta ? ' alerta' : ''}`}>
      <span>{rotulo}</span>
      <b>{valor}</b>
    </div>
  )
}

function Origens({ titulo, lista }: { titulo: string; lista: [string, number][] }) {
  return (
    <div>
      <div className="mini">{titulo}</div>
      {lista.map(([p, s]) => (
        <div key={p} className="origem">
          <span>{p}</span>
          <i style={{ width: `${Math.max(2, s * 100)}%` }} />
          <b>{pct(s)}</b>
        </div>
      ))}
    </div>
  )
}

function Chips({ ids, ix, onSelecionar, marcados }: { ids: string[]; ix: Indice; onSelecionar: (id: string) => void; marcados: Set<string> }) {
  return (
    <div className="chips">
      {ids.map((id) => (
        <button key={id} className={marcados.has(id) ? 'chip chip-fraco' : 'chip'} onClick={() => onSelecionar(id)}>
          {ix.porId.get(id)?.nome ?? id}
        </button>
      ))}
    </div>
  )
}
