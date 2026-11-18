// Ormuz 2026: o Golfo, o estreito e Omã do lado de fora; à direita, a parcela do Golfo nas compras do Brasil
// dos insumos da cadeia, antes e depois do fechamento (mar–set/2025 contra mar–set/2026).

import { useMemo } from 'react'
import { geoMercator, type GeoPermissibleObjects } from 'd3-geo'
import type { Contexto } from '../dados/contexto'
import { grupoOrigem } from '../dados/contexto'
import { areaLivre, caminhoGeo, useTela, xy } from '../lib/mapa'
import { PainelOrmuz } from '../componentes/PainelLente'

const ROTULOS: [string, number, number][] = [
  ['Golfo Pérsico', 51.2, 27.6],
  ['Golfo de Omã', 58.6, 24.4],
  ['Mar Arábico', 60.5, 21.2],
]

export function VistaOrmuz({ ctx, onSelecionar }: { ctx: Contexto; onSelecionar: (id: string) => void }) {
  const { w, h } = useTela()
  const proj = useMemo(
    () => geoMercator().fitExtent(areaLivre(w, h), { type: 'MultiPoint', coordinates: [[45, 31.2], [61.5, 21]] } as GeoPermissibleObjects),
    [w, h],
  )
  const cam = caminhoGeo(proj)
  const { paises, geo } = ctx
  const golfo = ['SAU', 'BHR', 'QAT', 'KWT', 'ARE', 'IRN', 'IRQ', 'OMN']
  const [ex, ey] = xy(proj, 56.45, 26.55)
  return (
    <>
      <svg className="mapa" width={w} height={h}>
        <g className="paises">
          {geo.mundo.features.map((f) => {
            const g = grupoOrigem(f.properties.iso3)
            const cls = g === 'ormuz' ? 'pais-origem pais-ormuz' : g === 'oma' ? 'pais-oma' : ''
            return <path key={f.properties.iso3 + f.properties.nome} d={cam(f)} className={cls} style={g === 'ormuz' ? { fillOpacity: 0.1 } : undefined} />
          })}
        </g>
        <g className="rotulos-pais">
          {golfo.map((iso) => {
            const p = paises.paises[iso]
            if (!p) return null
            const [x, y] = xy(proj, p.lon, p.lat)
            return (
              <text key={iso} x={x} y={y} textAnchor="middle" className={`rotulo-mapa${iso === 'OMN' ? '' : ' rotulo-ormuz'}`}>
                {p.nome}
              </text>
            )
          })}
          {ROTULOS.map(([t, lon, lat]) => {
            const [x, y] = xy(proj, lon, lat)
            return (
              <text key={t} x={x} y={y} textAnchor="middle" className="rotulo-mar">
                {t}
              </text>
            )
          })}
        </g>
        <g className="estreito" transform={`translate(${ex},${ey})`}>
          <circle r={18} />
          <text x={24} y={-14}>
            Estreito de Ormuz
          </text>
          <text x={24} y={2} className="estreito-sub">
            fechado em mar/2026
          </text>
        </g>
      </svg>
      <PainelOrmuz cadeia={ctx.cadeia} onSelecionar={onSelecionar} />
    </>
  )
}
