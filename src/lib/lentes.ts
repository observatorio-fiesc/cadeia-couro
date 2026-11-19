// Lentes do cone e da árvore: como cada elo é colorido e dimensionado.
// Regra da nota técnica: no máximo três matizes por vez; cada matiz com um papel.

import type { No } from '../dados/cadeia'

export type Lente = 'estrutura' | 'importado' | 'ormuz' | 'china' | 'confianca' | 'ambiente'

export const LENTES: { chave: Lente; rotulo: string }[] = [
  { chave: 'estrutura', rotulo: 'Estrutura' },
  { chave: 'importado', rotulo: 'Importado' },
  { chave: 'ormuz', rotulo: 'Ormuz 2026' },
  { chave: 'china', rotulo: 'China' },
  { chave: 'confianca', rotulo: 'Confiança' },
  { chave: 'ambiente', rotulo: 'Ambiente' },
]

export const COR = {
  cru: '#eadfcb',
  cruClaro: '#f6eee0',
  apagado: '#7c6f63',
  conhaque: '#d0843f',
  vermelho: '#e5553f',
  ambar: '#e9b24a',
  tecnico: '#b4a690',
}

export const parteGolfo = (n: No) => {
  const c = n.comercio
  if (!c) return null
  return (c.ormuz_2025 ?? 0) + (c.oma_2025 ?? 0)
}

export function aparencia(n: No, lente: Lente): { cor: string; opacidade: number; cheio: boolean } {
  if (n.lado === 'nucleo') return { cor: COR.conhaque, opacidade: 1, cheio: true }
  switch (lente) {
    case 'importado': {
      const v = n.comercio?.musd_2025
      if (v == null) return { cor: COR.cru, opacidade: 0.3, cheio: false }
      // intensidade pela ordem de grandeza do valor importado pelo Brasil (US$ 1 mi a US$ 5 bi)
      const t = Math.min(1, Math.max(0, Math.log10(Math.max(v, 0.5)) / 3.7))
      return { cor: COR.conhaque, opacidade: 0.45 + 0.55 * t, cheio: true }
    }
    case 'ormuz': {
      const g = parteGolfo(n)
      if (g == null) return { cor: COR.apagado, opacidade: 0.28, cheio: false }
      if (g < 0.01) return { cor: COR.cru, opacidade: 0.55, cheio: false }
      return { cor: COR.vermelho, opacidade: 0.45 + 0.55 * Math.min(1, g / 0.35), cheio: true }
    }
    case 'china': {
      const c = n.comercio?.china_2025
      if (c == null) return { cor: COR.apagado, opacidade: 0.28, cheio: false }
      if (c < 0.05) return { cor: COR.cru, opacidade: 0.55, cheio: false }
      return { cor: COR.ambar, opacidade: 0.45 + 0.55 * Math.min(1, c / 0.7), cheio: true }
    }
    case 'confianca':
      if (n.confianca === 'indício') return { cor: COR.vermelho, opacidade: 0.95, cheio: true }
      if (n.confianca === 'fato técnico') return { cor: COR.tecnico, opacidade: 0.7, cheio: false }
      return { cor: COR.cruClaro, opacidade: 0.95, cheio: true }
    default:
      return { cor: COR.cru, opacidade: 0.85, cheio: n.camada === 1 }
  }
}

export function tamanho(n: No, _valorMax: number, _valor: number) {
  if (n.lado === 'nucleo') return 0.42
  if (n.camada === 1) return 0.22
  if (n.lado === 'oferta') return 0.09 + 0.22 * (n.alcance_cadeia ?? 0)
  return 0.13
}
