// Logística no Brasil: as três plantas, os portos, as rotas rodoviárias (OSRM sobre o OpenStreetMap) e, por insumo,
// os portos por onde ele entrou no país em 2025 (Comex). Dois relógios: o biológico (pele verde, horas) e o
// econômico (couro curtido, dias e quilômetros).

import { useMemo, useState } from 'react'
import { geoCentroid, type GeoPermissibleObjects } from 'd3-geo'
import type { Contexto, Rota } from '../dados/contexto'
import { areaLivre, caminhoGeo, projecaoBrasil, useTela, xy } from '../lib/mapa'
import { inteiro, pct } from '../lib/formato'

const SIGLA: Record<string, string> = { '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF' }
const INSUMOS_MAPA = ['ins.sulfato_cromo', 'ins.sulfeto_sodio', 'ins.sulfato_amonio', 'ins.acido_formico', 'ins.recurtentes_sinteticos', 'ins.corantes', 'ins.oleos_engraxe', 'ins.auxiliares_acabamento', 'ins.dispersoes_pu', 'ins.diesel']
const NOME_PLANTA: Record<string, string> = { VG: 'Várzea Grande', NA: 'Nova Andradina', CAC: 'Caçador' }

const fmtH = (h: number) => `${inteiro(Math.floor(h))} h${Math.round((h % 1) * 60) ? ` ${String(Math.round((h % 1) * 60)).padStart(2, '0')}` : ''}`

export function VistaBrasil({ ctx }: { ctx: Contexto }) {
  const { w, h } = useTela()
  const { log, geo, entradas, cadeia } = ctx
  const [rotaSel, setRotaSel] = useState<string | null>(null)
  const [insumo, setInsumo] = useState<string>('ins.sulfato_cromo')
  const proj = useMemo(() => {
    const pts: [number, number][] = [...log.plantas, ...log.portos].map((p) => [p.lon, p.lat])
    pts.push([-58.6, -13.6], [-45.2, -29.2])
    return projecaoBrasil(areaLivre(w, h), pts)
  }, [log, w, h])
  const cam = caminhoGeo(proj)
  const ent = entradas.insumos[insumo]
  const noInsumo = cadeia.nos.find((n) => n.id === insumo)
  const rotaEntre = (a: string, b: string): Rota | undefined => log.rotas.find((r) => (r.de === a && r.para === b) || (r.de === b && r.para === a))
  const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  const portoPorNome = (nome: string) => log.portos.find((p) => semAcento(nome).includes(semAcento(p.nome.split('/')[0]).slice(0, 6)))

  const abate = useMemo(() => {
    const s = ctx.abate.series
    const soma = (geo: string, cats: string[]) => cats.reduce((t, c) => t + ['202501', '202502', '202503', '202504'].reduce((x, p) => x + (s[geo]?.[p]?.[c] ?? 0), 0), 0)
    return ['Mato Grosso', 'Mato Grosso do Sul'].map((g) => ({ g, total: soma(g, ['Total']), femeas: soma(g, ['Vacas', 'Novilhas']) }))
  }, [ctx.abate])

  const entrePlantas = log.rotas.filter((r) => r.tipo === 'entre plantas')
  const aosPortos = log.rotas.filter((r) => r.tipo === 'planta-porto')

  return (
    <>
      <svg className="mapa" width={w} height={h}>
        <g className="ufs">
          {geo.uf.features.map((f) => (
            <path key={f.properties.codarea} d={cam(f)} />
          ))}
        </g>
        <g className="ufs-rotulo">
          {geo.uf.features.map((f) => {
            const [x, y] = proj(geoCentroid(f as unknown as GeoPermissibleObjects)) ?? [-99, -99]
            return (
              <text key={f.properties.codarea} x={x} y={y}>
                {SIGLA[f.properties.codarea]}
              </text>
            )
          })}
        </g>
        <g className="rodovias">
          {geo.rodovias.features.map((f, i) => (
            <path key={i} d={cam(f)} />
          ))}
        </g>
        <g className="rotas">
          {[...aosPortos, ...entrePlantas].map((r) => (
            <path
              key={r.id}
              d={cam({ type: 'LineString', coordinates: r.coords })}
              className={`rota rota-${r.tipo === 'entre plantas' ? 'plantas' : 'porto'}${rotaSel === r.id ? ' ativa' : ''}`}
              onMouseEnter={() => setRotaSel(r.id)}
              onMouseLeave={() => setRotaSel(null)}
            />
          ))}
        </g>
        {ent && (
          <g className="entradas">
            {ent.portos.filter((p) => p.lat != null && p.parte >= 0.03).map((p) => {
              const [x, y] = xy(proj, p.lon!, p.lat!)
              const porto = portoPorNome(p.nome)
              return (
                <g key={p.urf}>
                  {porto &&
                    ent.plantas.map((pl) => {
                      const r = rotaEntre(porto.id, pl)
                      return r ? <path key={pl} d={cam({ type: 'LineString', coordinates: r.coords })} className="rota-entrada" /> : null
                    })}
                  <circle cx={x} cy={y} r={4 + 22 * Math.sqrt(p.parte)} className="porto-entrada" />
                  {!porto && (
                    <text x={x + 8 + 22 * Math.sqrt(p.parte)} y={y + 4} className="rotulo-mapa rotulo-entrada">
                      {p.nome} {pct(p.parte)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        )}
        <g className="portos">
          {log.portos.map((p) => {
            const [x, y] = xy(proj, p.lon, p.lat)
            const parte = ent?.portos.find((e) => portoPorNome(e.nome)?.id === p.id)?.parte
            const dy = { SFS: -2, ITP: -16, PNG: -8, ITJ: 14, SSZ: 4 }[p.id] ?? 4
            return (
              <g key={p.id}>
                <rect x={x - 3.5} y={y - 3.5} width={7} height={7} />
                <text x={x + 12} y={y + dy} className="rotulo-mapa">
                  {p.nome}
                  {parte != null && parte >= 0.01 && <tspan className="rotulo-entrada"> · {pct(parte)}</tspan>}
                </text>
              </g>
            )
          })}
        </g>
        <g className="rotulos-rota">
          {entrePlantas.map((r) => {
            const m = r.coords[Math.floor(r.coords.length / 2)]
            const [x, y] = xy(proj, m[0], m[1])
            return (
              <text key={r.id} x={x + 8} y={y} className="rotulo-rota">
                {inteiro(r.km)} km · {fmtH(r.horas)}
              </text>
            )
          })}
          {rotaSel && (() => {
            const r = log.rotas.find((x) => x.id === rotaSel)!
            const m = r.coords[Math.floor(r.coords.length / 2)]
            const [x, y] = xy(proj, m[0], m[1])
            return (
              <text x={x + 8} y={y - 14} className="rotulo-rota ativo">
                {inteiro(r.km)} km · {fmtH(r.horas)}
              </text>
            )
          })()}
        </g>
        <g className="plantas">
          {log.plantas.map((p) => {
            const [x, y] = xy(proj, p.lon, p.lat)
            return (
              <g key={p.id} transform={`translate(${x},${y})`}>
                <circle r={9} className="planta-anel" />
                <circle r={3.5} className="planta-centro" />
                <text x={-14} y={-6} textAnchor="end" className="rotulo-planta">
                  {p.nome} ({p.uf})
                </text>
                <text x={-14} y={9} textAnchor="end" className="rotulo-planta-etapas">
                  {p.etapas.join(' · ')}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      <aside className="ficha painel-lente">
        <div className="sobretitulo">Rotas rodoviárias · OSRM / OpenStreetMap</div>
        <h2>Dois relógios</h2>
        <section>
          <h3>Relógio biológico: horas</h3>
          <p>
            A pele verde sai do frigorífico sem sal e precisa entrar na ribeira em poucas horas. Por isso a ribeira fica em Várzea Grande, perto do abate.
          </p>
          {abate.map((a) => (
            <div key={a.g} className="linha">
              <span>Bovinos abatidos em 2025 · {a.g}</span>
              <b>
                {(a.total / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi · fêmeas {pct(a.femeas / a.total)}
              </b>
            </div>
          ))}
          <p className="nota">IBGE, Pesquisa Trimestral do Abate, tabela 1092 (todas as inspeções).</p>
        </section>
        <section>
          <h3>Relógio econômico: dias e quilômetros</h3>
          {entrePlantas.map((r) => (
            <div key={r.id} className={`linha${rotaSel === r.id ? ' alerta' : ''}`} onMouseEnter={() => setRotaSel(r.id)} onMouseLeave={() => setRotaSel(null)}>
              <span>
                {NOME_PLANTA[r.de]} → {NOME_PLANTA[r.para]}
              </span>
              <b>
                {inteiro(r.km)} km · {fmtH(r.horas)}
              </b>
            </div>
          ))}
          <div className="mini" style={{ marginTop: 10 }}>
            Das plantas aos portos
          </div>
          {aosPortos.map((r) => (
            <div key={r.id} className={`linha${rotaSel === r.id ? ' alerta' : ''}`} onMouseEnter={() => setRotaSel(r.id)} onMouseLeave={() => setRotaSel(null)}>
              <span>
                {NOME_PLANTA[r.de]} → {log.portos.find((p) => p.id === r.para)?.nome}
              </span>
              <b>
                {inteiro(r.km)} km · {fmtH(r.horas)}
              </b>
            </div>
          ))}
          <p className="nota">Tempo de direção contínua, sem as paradas obrigatórias do motorista de caminhão.</p>
        </section>
        <section>
          <h3>Por onde entram os insumos · 2025</h3>
          <div className="chips">
            {INSUMOS_MAPA.filter((id) => entradas.insumos[id]).map((id) => (
              <button key={id} className={id === insumo ? 'chip chip-ativo' : 'chip'} onClick={() => setInsumo(id)}>
                {cadeia.nos.find((n) => n.id === id)?.nome}
              </button>
            ))}
          </div>
          {ent && noInsumo && (
            <>
              <p className="nota" style={{ marginTop: 10 }}>
                {noInsumo.nome}: {inteiro(ent.kt * 1000)} t importadas pelo Brasil em 2025. Usado em: {ent.plantas.map((p) => NOME_PLANTA[p]).join(', ') || '–'}.
              </p>
              {ent.portos.slice(0, 5).map((p) => (
                <div key={p.urf} className="linha">
                  <span>{p.nome}</span>
                  <b>{pct(p.parte)}</b>
                </div>
              ))}
              <div className="mini" style={{ marginTop: 8 }}>
                UF do importador
              </div>
              <p className="nota">{ent.ufs.slice(0, 6).map(([u, s]) => `${u} ${pct(s)}`).join(' · ')}</p>
              <p className="nota">{entradas.nota}. Comex Stat, peso líquido.</p>
            </>
          )}
        </section>
      </aside>
    </>
  )
}
