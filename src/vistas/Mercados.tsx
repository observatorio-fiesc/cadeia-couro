// Mercados e casos: para onde foi o couro registrado nos municípios das plantas em 2025 (mapa) e os três casos,
// com a China como fio condutor: tarifas dos EUA, ciclo do boi e luxo europeu.

import { useMemo } from 'react'
import type { Contexto, Evento } from '../dados/contexto'
import { areaLivre, caminhoGeo, curva, projecaoMundo, useTela, xy } from '../lib/mapa'
import { BarrasHorizontais, ColunasEmpilhadas } from '../componentes/graficos'
import { inteiro, musd, pct, variacao } from '../lib/formato'

export type Caso = 'eua' | 'boi' | 'luxo' | 'china'
export const CASOS: { chave: Caso; rotulo: string }[] = [
  { chave: 'eua', rotulo: 'Tarifas dos EUA' },
  { chave: 'boi', rotulo: 'Ciclo do boi' },
  { chave: 'luxo', rotulo: 'Luxo europeu' },
  { chave: 'china', rotulo: 'China' },
]
const COR_ART: Record<string, string> = {
  'art.acabado': 'var(--conhaque)',
  'art.crust': 'var(--ambar)',
  'art.wet_blue': 'var(--traco-2)',
  'art.cabedais': 'var(--traco-2)',
  'art.bota': 'var(--traco-2)',
}
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function VistaMercados({ ctx, caso, onCaso }: { ctx: Contexto; caso: Caso; onCaso: (c: Caso) => void }) {
  const { w, h } = useTela()
  const { mercados, paises, geo, log } = ctx
  const proj = useMemo(() => projecaoMundo(areaLivre(w, h)), [w, h])
  const cam = caminhoGeo(proj)
  const plantaPorNome = new Map(log.plantas.map((p) => [p.nome, p]))
  const fluxos = mercados.destinos_2025.filter((d) => paises.paises[d.iso3] && plantaPorNome.has(d.municipio))
  const max = Math.max(1, ...fluxos.map((f) => f.fob))
  const totalPais = new Map<string, number>()
  for (const f of fluxos) totalPais.set(f.iso3, (totalPais.get(f.iso3) ?? 0) + f.fob)
  const maxPais = Math.max(1, ...totalPais.values())

  return (
    <>
      <svg className="mapa" width={w} height={h}>
        <path d={cam({ type: 'Sphere' })} className="esfera" />
        <g className="paises">
          {geo.mundo.features.map((f) => (
            <path key={f.properties.iso3 + f.properties.nome} d={cam(f)} className={totalPais.has(f.properties.iso3) ? 'pais-destino' : f.properties.iso3 === 'BRA' ? 'pais-brasil' : ''} />
          ))}
        </g>
        <g className="arcos">
          {fluxos
            .sort((a, b) => a.fob - b.fob)
            .map((f, i) => {
              const o = plantaPorNome.get(f.municipio)!
              const d = paises.paises[f.iso3]
              return (
                <path
                  key={i}
                  d={curva(proj, [o.lon, o.lat], [d.lon, d.lat], 0.18)}
                  className="arco"
                  style={{ stroke: COR_ART[f.artigo] ?? 'var(--traco-2)', strokeWidth: 0.6 + 6 * Math.sqrt(f.fob / max), opacity: 0.75 }}
                />
              )
            })}
        </g>
        <g className="destinos">
          {[...totalPais.entries()].map(([iso, v]) => {
            const p = paises.paises[iso]
            const [x, y] = xy(proj, p.lon, p.lat)
            const r = 2 + 12 * Math.sqrt(v / maxPais)
            return (
              <g key={iso}>
                <circle cx={x} cy={y} r={r} />
                {v >= 3e6 && (
                  <text x={x + r + 4} y={y + 4} className="rotulo-mapa">
                    {paises.paises[iso].nome} {musd(v / 1e6)}
                  </text>
                )}
              </g>
            )
          })}
        </g>
        <g className="plantas-mundo">
          {log.plantas.map((p) => {
            const [x, y] = xy(proj, p.lon, p.lat)
            return <circle key={p.id} cx={x} cy={y} r={3.5} />
          })}
        </g>
      </svg>

      <aside className="ficha painel-lente">
        <div className="abas">
          {CASOS.map((c) => (
            <button key={c.chave} className={c.chave === caso ? 'ativo' : ''} onClick={() => onCaso(c.chave)}>
              {c.rotulo}
            </button>
          ))}
        </div>
        {caso === 'eua' && <CasoEua ctx={ctx} />}
        {caso === 'boi' && <CasoBoi ctx={ctx} />}
        {caso === 'luxo' && <CasoLuxo ctx={ctx} />}
        {caso === 'china' && <CasoChina ctx={ctx} />}
        <p className="nota" style={{ marginTop: 18 }}>
          Linhas do mapa: {Object.entries({ 'art.acabado': 'couro acabado', 'art.crust': 'crust e semiacabado', 'art.wet_blue': 'wet blue e cabedais' }).map(([, v]) => v).join(' · ')}. {mercados.ressalva}
        </p>
      </aside>
    </>
  )
}

function Comparacao({ rotulo, c }: { rotulo: string; c: { '2025': number; '2026': number; var: number | null } }) {
  return (
    <div className={`linha${(c.var ?? 0) < -0.1 ? ' alerta' : ''}`}>
      <span>{rotulo}</span>
      <b>
        {musd(c['2025'] / 1e6)} → {musd(c['2026'] / 1e6)} · {variacao(c.var)}
      </b>
    </div>
  )
}

function Eventos({ eventos }: { eventos: Evento[] }) {
  return (
    <div className="eventos">
      {eventos.map((e) => (
        <div key={e.data + e.titulo} className="evento">
          <span className="data">{e.data.split('-').reverse().join('/')}</span>
          <span className="titulo">
            {e.titulo}
            {e.status !== 'confirmado' && <em className="selo selo-confirmar">a confirmar</em>}
          </span>
        </div>
      ))}
    </div>
  )
}

function CasoEua({ ctx }: { ctx: Contexto }) {
  const m = ctx.mercados
  const dados = useMemo(() => {
    const porPer = new Map(m.serie_eua.map((s) => [String(s.periodo), s]))
    const out: Record<string, number | string>[] = []
    for (const ano of [2024, 2025, 2026]) {
      for (let mes = 1; mes <= 12; mes++) {
        const per = `${ano}-${String(mes).padStart(2, '0')}`
        if (per > m.ultimo_periodo) break
        const s = porPer.get(per) ?? {}
        const acabado = Number(s['art.acabado'] ?? 0) / 1e6
        const crust = Number(s['art.crust'] ?? 0) / 1e6
        const total = Object.entries(s).filter(([k]) => k.startsWith('art.')).reduce((t, [, v]) => t + Number(v) / 1e6, 0)
        out.push({ periodo: per, acabado, crust, outros: Math.max(0, total - acabado - crust) })
      }
    }
    return out
  }, [m])
  const idx = (per: string) => dados.findIndex((d) => d.periodo === per)
  const c = m.comparacoes
  return (
    <section>
      <h2>EUA: {variacao(c.eua.var)}</h2>
      <p className="nota">Exportações para os EUA registradas nos municípios das plantas, {c.meses}/2026 contra {c.meses}/2025.</p>
      <ColunasEmpilhadas
        dados={dados}
        chaveX="periodo"
        largura={372}
        altura={190}
        series={[
          { chave: 'acabado', cor: 'var(--conhaque)', rotulo: 'acabado' },
          { chave: 'crust', cor: 'var(--ambar)', rotulo: 'crust' },
          { chave: 'outros', cor: 'var(--traco-3)', rotulo: 'outros' },
        ]}
        formatoY={(v) => `${v.toFixed(1).replace('.', ',')}`}
        rotuloX={(p) => (p.endsWith('-01') ? p.slice(0, 4) : null)}
        marcos={[
          { indice: idx('2025-08'), rotulo: '50%' },
          { indice: idx('2026-02'), rotulo: 'IEEPA cai', cor: 'var(--traco-2)' },
          { indice: idx('2026-07'), rotulo: 'Seção 301' },
        ].filter((x) => x.indice >= 0)}
      />
      <p className="nota">US$ milhões por mês · conhaque: couro acabado · âmbar: crust e semiacabado.</p>
      <Comparacao rotulo="Couro acabado para os EUA" c={c.eua_acabado} />
      <Comparacao rotulo="Todos os destinos" c={c.total} />
      <div className="mini" style={{ marginTop: 12 }}>
        Regras
      </div>
      <Eventos eventos={m.eventos.filter((e) => e.tipo === 'tarifa')} />
    </section>
  )
}

function CasoBoi({ ctx }: { ctx: Contexto }) {
  const s = ctx.abate.series
  const dados = useMemo(() => {
    const pers = Object.keys(s['Mato Grosso'] ?? {}).sort()
    return pers.map((p) => {
      const v = (cat: string) => (s['Mato Grosso']?.[p]?.[cat] ?? 0) + (s['Mato Grosso do Sul']?.[p]?.[cat] ?? 0)
      const machos = (v('Bois') + v('Novilhos')) / 1e3
      const femeas = (v('Vacas') + v('Novilhas')) / 1e3
      const total = v('Total') / 1e3
      return { periodo: p, machos, femeas, parte: total ? femeas / total : null }
    })
  }, [s])
  const ano = (a: string) => dados.filter((d) => String(d.periodo).startsWith(a))
  const parteAno = (a: string) => {
    const l = ano(a)
    const f = l.reduce((t, d) => t + d.femeas, 0)
    const m = l.reduce((t, d) => t + d.machos, 0)
    return f / (f + m)
  }
  const ult = dados.at(-1)!
  const mesmo = dados.find((d) => d.periodo === `${Number(ult.periodo.slice(0, 4)) - 1}${ult.periodo.slice(4)}`)
  const varF = mesmo ? ult.femeas / mesmo.femeas - 1 : null
  return (
    <section>
      <h2>Fêmeas no abate: {pct(parteAno('2025'))} em 2025</h2>
      <p className="nota">Mato Grosso e Mato Grosso do Sul, onde ficam a ribeira e o recurtimento. Mais fêmeas no abate quer dizer liquidação do rebanho; menos, retenção de matrizes e menos peles depois.</p>
      <ColunasEmpilhadas
        dados={dados}
        chaveX="periodo"
        largura={372}
        altura={190}
        series={[
          { chave: 'machos', cor: 'var(--traco-3)', rotulo: 'machos' },
          { chave: 'femeas', cor: 'var(--conhaque)', rotulo: 'fêmeas' },
        ]}
        formatoY={(v) => `${inteiro(v)} mil`}
        rotuloX={(p) => (p.endsWith('01') && Number(p.slice(0, 4)) % 2 === 1 ? p.slice(2, 4) : null)}
        linha={{ valores: dados.map((d) => d.parte), cor: 'var(--ambar)', formato: (v) => pct(v), max: 0.7 }}
      />
      <p className="nota">Mil cabeças por trimestre · conhaque: vacas e novilhas · âmbar: parcela de fêmeas.</p>
      <div className="linha">
        <span>Parcela de fêmeas, 2024 → 2025</span>
        <b>
          {pct(parteAno('2024'))} → {pct(parteAno('2025'))}
        </b>
      </div>
      <div className={`linha${(varF ?? 0) < 0 ? ' alerta' : ''}`}>
        <span>
          Fêmeas abatidas, {ult.periodo.slice(5)}º tri/{ult.periodo.slice(0, 4)} × mesmo tri de {Number(ult.periodo.slice(0, 4)) - 1}
        </span>
        <b>{variacao(varF)}</b>
      </div>
      <p className="nota">{ctx.abate.fonte}. Último trimestre disponível: {ult.periodo.slice(5)}º/{ult.periodo.slice(0, 4)}.</p>
    </section>
  )
}

function CasoLuxo({ ctx }: { ctx: Contexto }) {
  const m = ctx.mercados
  const c = m.comparacoes
  const a = m.anual_pais
  const itens = [
    { rotulo: 'França 2024', valor: (a.FRA?.['2024'] ?? 0) / 1e6 },
    { rotulo: 'França 2025', valor: (a.FRA?.['2025'] ?? 0) / 1e6 },
    { rotulo: `França ${c.meses}/26`, valor: (a.FRA?.['2026'] ?? 0) / 1e6 },
    { rotulo: 'Itália 2024', valor: (a.ITA?.['2024'] ?? 0) / 1e6 },
    { rotulo: 'Itália 2025', valor: (a.ITA?.['2025'] ?? 0) / 1e6 },
    { rotulo: `Itália ${c.meses}/26`, valor: (a.ITA?.['2026'] ?? 0) / 1e6 },
  ]
  return (
    <section>
      <h2>França e Itália</h2>
      <p className="nota">Para a França vai couro acabado (código 4107); para a Itália, sobretudo couro curtido e semiacabado (código 4104). Entre os clientes declarados está uma maison francesa de bolsas e malas.</p>
      <BarrasHorizontais itens={itens} largura={372} cor="var(--conhaque)" formato={(v) => musd(v)} />
      <Comparacao rotulo={`França, ${c.meses}`} c={c.franca} />
      <Comparacao rotulo={`Itália, ${c.meses}`} c={c.italia} />
      <div className="mini" style={{ marginTop: 12 }}>
        Regras da União Europeia
      </div>
      <Eventos eventos={m.eventos.filter((e) => e.tipo === 'regulacao' || e.tipo === 'mercado')} />
    </section>
  )
}

function CasoChina({ ctx }: { ctx: Contexto }) {
  const m = ctx.mercados
  const nomes = m.artigos
  const itens = Object.entries(m.china_2025)
    .filter(([, v]) => v != null && v > 0)
    .map(([k, v]) => ({ rotulo: nomes[k] ?? k, valor: v as number }))
  const primeiros = ctx.cadeia.nos.filter((n) => n.comercio?.origens_2025[0]?.[0] === 'China')
  return (
    <section>
      <h2>China nos dois lados</h2>
      <p className="nota">Parcela da China, de Hong Kong e de Macau no valor exportado em 2025, por artigo:</p>
      <BarrasHorizontais itens={itens} largura={372} cor="var(--ambar)" formato={(v) => pct(v)} />
      <Comparacao rotulo={`China, ${m.comparacoes.meses}`} c={m.comparacoes.china} />
      <div className="mini" style={{ marginTop: 12 }}>
        Do outro lado: insumos com a China como 1ª origem ({primeiros.length})
      </div>
      <p className="nota">{primeiros.map((n) => `${n.nome} ${pct(n.comercio?.china_2025)}`).join(' · ')}</p>
      <p className="nota">A China define o preço do wet blue, compra couro acabado para carros elétricos e vende a química da ribeira e do PU.</p>
    </section>
  )
}

export const nomeMes = (p: string) => `${MESES[Number(p.slice(5, 7)) - 1]}/${p.slice(2, 4)}`
