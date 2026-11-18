// Base dos mapas em SVG (d3-geo): tamanho da tela, área livre entre as colunas de texto e projeções.

import { useEffect, useState } from 'react'
import { geoMercator, geoNaturalEarth1, geoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo'

export function useTela() {
  const [t, setT] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const f = () => setT({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  return t
}

// área livre do mapa: entre a coluna do cabeçalho (esquerda) e o painel lateral (direita)
export function areaLivre(w: number, h: number, comPainel = true): [[number, number], [number, number]] {
  // tela estreita (celular): o mapa ocupa a faixa entre o cabeçalho e o painel, que vira folha embaixo
  if (w < 900) return [[16, 150], [w - 16, Math.max(280, h * 0.56)]]
  return [
    [360, 70],
    [w - (comPainel ? 450 : 60), h - 90],
  ]
}

export function projecaoBrasil(area: [[number, number], [number, number]], pontos: [number, number][]): GeoProjection {
  return geoMercator().fitExtent(area, { type: 'MultiPoint', coordinates: pontos } as GeoPermissibleObjects)
}

export function projecaoMundo(area: [[number, number], [number, number]]): GeoProjection {
  return geoNaturalEarth1().rotate([-15, 0]).fitExtent(area, { type: 'Sphere' } as GeoPermissibleObjects)
}

export function caminhoGeo(p: GeoProjection) {
  const g = geoPath(p)
  return (obj: unknown) => g(obj as GeoPermissibleObjects) ?? ''
}

// linha de A até B (grande círculo, desenhada pela projeção)
export const linha = (a: [number, number], b: [number, number]) => ({ type: 'LineString', coordinates: [a, b] })

export const xy = (p: GeoProjection, lon: number, lat: number) => p([lon, lat]) ?? [-999, -999]

// Fluxo como curva plana entre dois pontos projetados (não cruza a borda do mapa, ao contrário do grande círculo).
// A curvatura fica sempre do mesmo lado (para cima), como num mapa de fluxos.
export function curva(p: GeoProjection, a: [number, number], b: [number, number], k = 0.22) {
  const [x1, y1] = xy(p, a[0], a[1])
  const [x2, y2] = xy(p, b[0], b[1])
  const dx = x2 - x1
  const dy = y2 - y1
  const d = Math.hypot(dx, dy) || 1
  let nx = -dy / d
  let ny = dx / d
  if (ny > 0) {
    nx = -nx
    ny = -ny
  }
  const cx = (x1 + x2) / 2 + nx * d * k
  const cy = (y1 + y2) / 2 + ny * d * k
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`
}
