// Insumos no mundo: para o insumo escolhido, de quais países o Brasil comprou (mar–set/2025 e 2026),
// por qual porto entrou (2025) e qual planta da Viposa o usa. As cores seguem a origem: Golfo dentro do
// estreito (vermelho), China (âmbar), demais países (conhaque); Omã aparece tracejado.

import { useMemo } from 'react'
import type { Contexto } from '../dados/contexto'
import { grupoOrigem } from '../dados/contexto'
import type { No } from '../dados/cadeia'
import { areaLivre, caminhoGeo, curva, projecaoMundo, useTela, xy } from '../lib/mapa'
import { inteiro, musd, pct, variacao } from '../lib/formato'

const COR_GRUPO = { ormuz: 'var(--vermelho)', oma: 'var(--traco-2)', china: 'var(--ambar)', outros: 'var(--conhaque)' }
const GRUPOS_LISTA: [string, string][] = [
  ['quimica', 'Química do curtume'],
  ['fertilizantes', 'Fertilizantes e enxofre'],
  ['petroquimica', 'Petroquímica'],
  ['energia', 'Energia e frete'],
  ['floresta', 'Floresta'],
  ['minerais', 'Minerais'],
]
const NOME_PLANTA: Record<string, string> = { VG: 'Várzea Grande', NA: 'Nova Andradina', CAC: 'Caçador' }

export function VistaMundo({ ctx, insumo, onInsumo }: { ctx: Contexto; insumo: string; onInsumo: (id: string) => void }) {
  const { w, h } = useTela()
  const { cadeia, paises, geo, entradas, log } = ctx
  const proj = useMemo(() => projecaoMundo(areaLivre(w, h)), [w, h])
  const cam = caminhoGeo(proj)
  const lista = useMemo(() => cadeia.nos.filter((n) => n.comercio && n.lado === 'oferta'), [cadeia])
  const no = lista.find((n) => n.id === insumo) ?? lista[0]
  const c = no.comercio!
  const ent = entradas.insumos[no.id]
  const portoPrincipal = ent?.portos.find((p) => p.lat != null)
  const destino: [number, number] = portoPrincipal ? [portoPrincipal.lon!, portoPrincipal.lat!] : [-48.5, -25.5]
  const origens = c.origens_2025
    .map(([nome, parte]) => ({ nome, parte, iso: paises.nome_iso[nome] }))
    .filter((o) => o.iso && paises.paises[o.iso] && o.parte >= 0.02)
  const partePorIso = new Map(origens.map((o) => [o.iso, o.parte]))
  const temOrmuz = origens.some((o) => grupoOrigem(o.iso) === 'ormuz')

  return (
    <>
      <svg className="mapa" width={w} height={h}>
        <path d={cam({ type: 'Sphere' })} className="esfera" />
        <g className="paises">
          {geo.mundo.features.map((f) => {
            const iso = f.properties.iso3
            const parte = partePorIso.get(iso)
            const g = grupoOrigem(iso)
            return (
              <path
                key={iso + f.properties.nome}
                d={cam(f)}
                className={parte ? `pais-origem pais-${g}` : iso === 'BRA' ? 'pais-brasil' : ''}
                style={parte ? { fillOpacity: 0.12 + 0.6 * parte } : undefined}
              />
            )
          })}
        </g>
        <g className="arcos">
          {origens.map((o) => {
            const p = paises.paises[o.iso]
            const g = grupoOrigem(o.iso)
            return (
              <path
                key={o.iso}
                d={curva(proj, [p.lon, p.lat], destino)}
                className={`arco${g === 'oma' ? ' arco-tracejado' : ''}`}
                style={{ stroke: COR_GRUPO[g], strokeWidth: 1 + 7 * o.parte }}
              />
            )
          })}
        </g>
        {temOrmuz && (() => {
          const [x, y] = xy(proj, 56.4, 26.6)
          return (
            <g className="marca-ormuz" transform={`translate(${x},${y})`}>
              <path d="M-5,-5L5,5M5,-5L-5,5" />
              <text x={8} y={-6}>
                Ormuz
              </text>
            </g>
          )
        })()}
        <g className="rotulos-pais">
          {origens.map((o) => {
            const p = paises.paises[o.iso]
            const [x, y] = xy(proj, p.lon, p.lat)
            return (
              <text key={o.iso} x={x} y={y - 6} textAnchor="middle" className="rotulo-mapa rotulo-origem">
                {o.nome} {pct(o.parte)}
              </text>
            )
          })}
        </g>
        {portoPrincipal && (() => {
          const [x, y] = xy(proj, destino[0], destino[1])
          return (
            <g transform={`translate(${x},${y})`}>
              <rect x={-4} y={-4} width={8} height={8} className="porto-destino" />
              <text x={10} y={14} className="rotulo-mapa">
                {portoPrincipal.nome} {pct(portoPrincipal.parte)}
              </text>
            </g>
          )
        })()}
        <g className="plantas-mundo">
          {log.plantas.filter((p) => ent?.plantas.includes(p.id)).map((p) => {
            const [x, y] = xy(proj, p.lon, p.lat)
            return <circle key={p.id} cx={x} cy={y} r={4} />
          })}
        </g>
      </svg>

      <aside className="ficha painel-lente">
        <div className="sobretitulo">Insumos importados da cadeia · escolha um</div>
        <div className="lista-insumos">
          {GRUPOS_LISTA.map(([tronco, rotulo]) => {
            const itens = lista.filter((n) => n.tronco === tronco)
            if (!itens.length) return null
            return (
              <div key={tronco} className="grupo-insumos">
                <div className="mini">{rotulo}</div>
                <div className="chips">
                  {itens.map((n) => (
                    <button key={n.id} className={n.id === no.id ? 'chip chip-ativo' : 'chip'} onClick={() => onInsumo(n.id)}>
                      {n.nome}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <Detalhe no={no} ctx={ctx} />
      </aside>
    </>
  )
}

function Detalhe({ no, ctx }: { no: No; ctx: Contexto }) {
  const c = no.comercio!
  const ent = ctx.entradas.insumos[no.id]
  return (
    <section>
      <h2>{no.nome}</h2>
      <p className="nota">{no.descricao}</p>
      <div className="linha">
        <span>Compras do Brasil, mar–set/2025</span>
        <b>{musd(c.musd_2025)}</b>
      </div>
      <div className="linha">
        <span>Volume e preço em 2026</span>
        <b>
          {variacao(c.var_kg_total)} · preço {variacao(c.var_preco)}
        </b>
      </div>
      <div className={`linha${(c.ormuz_2025 ?? 0) >= 0.05 ? ' alerta' : ''}`}>
        <span>Golfo, dentro do estreito</span>
        <b>
          {pct(c.ormuz_2025)} → {pct(c.ormuz_2026)}
        </b>
      </div>
      <div className="linha">
        <span>China</span>
        <b>
          {pct(c.china_2025)} → {pct(c.china_2026)}
        </b>
      </div>
      <div className="origens">
        <div>
          <div className="mini">Origens 2025</div>
          {c.origens_2025.map(([p, s]) => (
            <div key={p} className="origem">
              <span>{p}</span>
              <i style={{ width: `${Math.max(2, s * 100)}%`, background: COR_GRUPO[grupoOrigem(ctx.paises.nome_iso[p])] }} />
              <b>{pct(s)}</b>
            </div>
          ))}
        </div>
        <div>
          <div className="mini">Origens 2026</div>
          {c.origens_2026.map(([p, s]) => (
            <div key={p} className="origem">
              <span>{p}</span>
              <i style={{ width: `${Math.max(2, s * 100)}%`, background: COR_GRUPO[grupoOrigem(ctx.paises.nome_iso[p])] }} />
              <b>{pct(s)}</b>
            </div>
          ))}
        </div>
      </div>
      {ent && (
        <>
          <div className="mini" style={{ marginTop: 12 }}>
            Portos de entrada, 2025 ({inteiro(ent.kt * 1000)} t)
          </div>
          <p className="nota">{ent.portos.slice(0, 5).map((p) => `${p.nome} ${pct(p.parte)}`).join(' · ')}</p>
          <div className="mini">UF do importador</div>
          <p className="nota">{ent.ufs.slice(0, 6).map(([u, s]) => `${u} ${pct(s)}`).join(' · ')}</p>
          {ent.plantas.length > 0 && <p className="nota">Usado em: {ent.plantas.map((p) => NOME_PLANTA[p]).join(', ')}.</p>}
        </>
      )}
      <p className="nota">Comex Stat, US$ FOB; parcela do valor comprado pelo Brasil, não só pelos curtumes. Mar–set de cada ano.</p>
    </section>
  )
}
