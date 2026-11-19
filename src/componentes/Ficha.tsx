// Ficha do elo escolhido: o que é, de quem depende, o que alimenta, comércio e fontes.

import type { Cadeia, Indice, No } from '../dados/cadeia'
import type { IndiceProcesso, Processo } from '../dados/processo'
import { inteiro, musd, pct, variacao } from '../lib/formato'

type Props = { cadeia: Cadeia; ix: Indice; no: No; onSelecionar: (id: string | null) => void; onVerNoMapa?: () => void; processo?: Processo | null; ixp?: IndiceProcesso | null; /** no Cone 3D: só o nome, o que é, o alcance e a importação */ compacta?: boolean }

/**
 * Em que operações do processo um elo entra: direto, se ele é entrada de alguma operação; senão, descendo
 * pela cadeia (material, insumo) até as entradas, com o insumo por onde ele chega.
 */
function noProcesso(cadeia: Cadeia, ix: Indice, ixp: IndiceProcesso, id: string) {
  const out: { etapa: string; op: string; papel: string; via?: string }[] = []
  const vistos = new Set<string>([id])
  const fila: { id: string; via?: string }[] = [{ id }]
  while (fila.length) {
    const { id: x, via } = fila.shift()!
    for (const u of ixp.usos.get(x) ?? []) out.push({ etapa: u.op.etapa, op: u.op.nome, papel: u.entrada.papel, via: x === id ? undefined : ix.porId.get(x)?.nome })
    if (ixp.usos.has(x) && x !== id) continue
    for (const i of ix.dependentesDe.get(x) ?? []) {
      const a = cadeia.arestas[i]
      const d = ix.porId.get(a.para)
      if (a.tipo === 'visual' || !d || d.lado !== 'oferta' || d.camada < 2 || vistos.has(a.para)) continue
      vistos.add(a.para)
      fila.push({ id: a.para, via })
    }
  }
  return out
}

export function Ficha({ cadeia, ix, no, onSelecionar, onVerNoMapa, processo, ixp, compacta }: Props) {
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
      {!compacta && <div className="sobretitulo">{camada === tronco ? camada : `${camada} · ${tronco}`}</div>}
      <h2>{no.nome}</h2>
      {!compacta && no.planta && <div className="planta">{no.planta}</div>}
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
          {!compacta && (
            <>
              <Linha rotulo="Artigos afetados" valor={pct(no.alcance_artigos)} />
              <Linha rotulo="Valor exportado afetado (2025)" valor={pct(no.alcance_exportacao)} />
            </>
          )}
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

      {!compacta && entram.length > 0 && (
        <section>
          <h3>{no.lado === 'demanda' ? 'Vem de' : 'Depende de'}</h3>
          <Chips ids={entram.map((a) => a.de)} ix={ix} onSelecionar={onSelecionar} marcados={new Set(entram.filter((a) => !a.essencial || a.confianca === 'indício').map((a) => a.de))} />
        </section>
      )}
      {!compacta && processo && ixp && no.lado === 'oferta' && no.camada >= 2 && (() => {
        const usos = noProcesso(cadeia, ix, ixp, no.id)
        if (!usos.length) return null
        // por etapa, na ordem do processo; cada operação uma vez, na cor do papel (o primeiro, se tem vários)
        const grupos = processo.etapas
          .map((e) => {
            const us = usos.filter((u) => u.etapa === e.id)
            const ops = new Map<string, string>()
            for (const u of us) if (!ops.has(u.op)) ops.set(u.op, u.papel)
            const vias = [...new Set(us.map((u) => u.via).filter(Boolean))]
            return { id: e.id, ops: [...ops], vias }
          })
          .filter((g) => g.ops.length)
        const nOps = grupos.reduce((s, g) => s + g.ops.length, 0)
        const papeis = (Object.keys(processo.papeis) as (keyof typeof processo.papeis)[]).filter((pp) => usos.some((u) => u.papel === pp))
        return (
          <section>
            <h3>
              No processo · {nOps} {nOps === 1 ? 'operação' : 'operações'}
              {grupos.length > 1 ? ` em ${grupos.length} etapas` : ''}
            </h3>
            {grupos.map((g) => (
              <div key={g.id} className="processo-grupo">
                <div className="processo-grupo-etapa">{ix.porId.get(g.id)?.nome ?? g.id}</div>
                <p>
                  {g.ops.map(([op, papel], i) => (
                    <span key={op}>
                      {i > 0 && <span className="nota-inline"> · </span>}
                      <span className={`papel-${papel}`}>{op}</span>
                    </span>
                  ))}
                  {g.vias.length > 0 && (
                    <em className="nota-inline">
                      {' '}
                      — via {g.vias.slice(0, 3).join(', ')}
                      {g.vias.length > 3 ? ` e mais ${g.vias.length - 3}` : ''}
                    </em>
                  )}
                </p>
              </div>
            ))}
            <p className="nota chaves-papel">
              {papeis.map((pp) => (
                <span key={pp} className={`papel-${pp}`}>
                  ● <span className="nota-inline">{processo.papeis[pp].nome}</span>
                </span>
              ))}
            </p>
          </section>
        )
      })()}
      {!compacta && saem.length > 0 && (
        <section>
          <h3>Alimenta</h3>
          <Chips ids={saem.map((a) => a.para)} ix={ix} onSelecionar={onSelecionar} marcados={new Set()} />
        </section>
      )}

      {!compacta && <section className="fontes">
        <h3>Confiança: {no.confianca}</h3>
        <ul>
          {no.fontes.map((f) => (
            <li key={f}>{meta.fontes[f] ?? f}</li>
          ))}
        </ul>
      </section>}
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
