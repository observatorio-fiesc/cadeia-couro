// Amostras desenhadas de cada tipo de couro (sem foto, sem retângulo de fundo): uma peça de contorno
// irregular, com a textura do acabamento. Desenhadas uma vez em canvas e guardadas como imagem.
import type { Transformacao } from './receitas'

function rng(semente: number) {
  let s = semente >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
const sem = (txt: string) => {
  let h = 2166136261
  for (let i = 0; i < txt.length; i++) h = Math.imul(h ^ txt.charCodeAt(i), 16777619)
  return h >>> 0
}
const hexRgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
const tom = (hex: string, f: number, a = 1) => {
  const [r, g, b] = hexRgb(hex).map((c) => Math.max(0, Math.min(255, Math.round(f >= 1 ? c + (255 - c) * (f - 1) : c * f))))
  return `rgba(${r},${g},${b},${a})`
}

const cache = new Map<string, string>()

export function amostra(t: Transformacao, largura = 150, altura = 104): string {
  const chave = `${t.id}-${largura}x${altura}`
  const pronto = cache.get(chave)
  if (pronto) return pronto
  const esc = 2
  const W = largura * esc
  const H = altura * esc
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')!
  const r = rng(sem(t.id))
  // contorno de peça de couro: superelipse com a borda ondulada
  const cx = W / 2
  const cy = H / 2
  const rx = W * 0.46
  const ry = H * 0.42
  const fases = [r() * 6.28, r() * 6.28, r() * 6.28]
  const caminho = () => {
    g.beginPath()
    const n = 120
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2
      const c = Math.cos(a)
      const s = Math.sin(a)
      const e = 2 / 4.2
      const irr = 1 + 0.035 * Math.sin(3 * a + fases[0]) + 0.025 * Math.sin(5 * a + fases[1]) + 0.012 * Math.sin(11 * a + fases[2])
      const x = cx + rx * Math.sign(c) * Math.pow(Math.abs(c), e) * irr
      const y = cy + ry * Math.sign(s) * Math.pow(Math.abs(s), e) * irr
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.closePath()
  }
  g.save()
  caminho()
  g.clip()
  // base com volume: luz de cima à esquerda
  const grad = g.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, tom(t.cor, 1.16))
  grad.addColorStop(0.55, tom(t.cor, 1))
  grad.addColorStop(1, tom(t.cor, 0.72))
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  // manchas suaves (todo couro tem variação de tom)
  for (let i = 0; i < 26; i++) {
    const x = r() * W
    const y = r() * H
    const rr = 18 + r() * 60
    const rg = g.createRadialGradient(x, y, 0, x, y, rr)
    const claro = r() > 0.5
    rg.addColorStop(0, claro ? tom(t.cor, 1.12, 0.22) : tom(t.cor, 0.82, 0.22))
    rg.addColorStop(1, tom(t.cor, 1, 0))
    g.fillStyle = rg
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2)
  }
  const pontos = (n: number, r0: number, r1: number, cor: () => string) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = cor()
      g.beginPath()
      g.arc(r() * W, r() * H, r0 + r() * (r1 - r0), 0, Math.PI * 2)
      g.fill()
    }
  }
  const tracos = (n: number, l0: number, l1: number, larg: number, cor: () => string, curva = 0.6) => {
    g.lineCap = 'round'
    for (let i = 0; i < n; i++) {
      const x = r() * W
      const y = r() * H
      const a = r() * Math.PI * 2
      const l = l0 + r() * (l1 - l0)
      g.strokeStyle = cor()
      g.lineWidth = larg
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x + Math.cos(a + curva) * l * 0.6, y + Math.sin(a + curva) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l)
      g.stroke()
    }
  }
  switch (t.textura) {
    case 'poros': {
      // poros em trincas, a assinatura da flor bovina
      for (let i = 0; i < 260; i++) {
        const x = r() * W
        const y = r() * H
        for (let k = 0; k < 3; k++) {
          g.fillStyle = tom(t.cor, 0.55, 0.55)
          g.beginPath()
          g.arc(x + (r() - 0.5) * 7, y + (r() - 0.5) * 7, 0.9 + r() * 0.8, 0, Math.PI * 2)
          g.fill()
        }
      }
      tracos(70, 20, 60, 0.8, () => tom(t.cor, 0.8, 0.25), 0.3)
      break
    }
    case 'liso': {
      for (let i = 0; i < 5; i++) {
        const y = r() * H
        const lg = g.createLinearGradient(0, y - 30, 0, y + 30)
        lg.addColorStop(0, tom(t.cor, 1, 0))
        lg.addColorStop(0.5, tom(t.cor, 1.25, 0.28))
        lg.addColorStop(1, tom(t.cor, 1, 0))
        g.fillStyle = lg
        g.fillRect(0, y - 30, W, 60)
      }
      pontos(160, 0.6, 1.1, () => tom(t.cor, 0.7, 0.3))
      break
    }
    case 'veludo': {
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = r() > 0.5 ? tom(t.cor, 1.15, 0.18) : tom(t.cor, 0.85, 0.18)
        g.fillRect(r() * W, r() * H, 1.4, 1.4)
      }
      break
    }
    case 'pigmento': {
      for (let i = 0; i < 5000; i++) {
        g.fillStyle = tom(t.cor, r() > 0.5 ? 1.25 : 0.8, 0.22)
        g.fillRect(r() * W, r() * H, 1.2, 1.2)
      }
      const lg = g.createLinearGradient(0, 0, W, H * 0.6)
      lg.addColorStop(0.2, 'rgba(255,255,255,0)')
      lg.addColorStop(0.45, 'rgba(255,255,255,0.13)')
      lg.addColorStop(0.7, 'rgba(255,255,255,0)')
      g.fillStyle = lg
      g.fillRect(0, 0, W, H)
      break
    }
    case 'gravado': {
      // desenho impresso: grãos arredondados com luz e sombra
      for (let y = 6; y < H; y += 13) {
        for (let x = 6 + ((y / 13) % 2) * 6; x < W; x += 13) {
          const rr = 4 + r() * 2.5
          const xx = x + (r() - 0.5) * 4
          const yy = y + (r() - 0.5) * 4
          const rg = g.createRadialGradient(xx - 1.5, yy - 1.5, 0.5, xx, yy, rr)
          rg.addColorStop(0, tom(t.cor, 1.35, 0.9))
          rg.addColorStop(1, tom(t.cor, 0.65, 0.9))
          g.fillStyle = rg
          g.beginPath()
          g.arc(xx, yy, rr, 0, Math.PI * 2)
          g.fill()
        }
      }
      break
    }
    case 'camurca': {
      for (let i = 0; i < 7000; i++) {
        g.fillStyle = r() > 0.5 ? tom(t.cor, 1.12, 0.22) : tom(t.cor, 0.86, 0.22)
        g.fillRect(r() * W, r() * H, 1.6, 1.6)
      }
      tracos(900, 3, 7, 0.9, () => tom(t.cor, r() > 0.5 ? 1.2 : 0.8, 0.35), 0.9)
      break
    }
    case 'rustico': {
      for (let i = 0; i < 6000; i++) {
        g.fillStyle = tom(t.cor, r() > 0.5 ? 1.35 : 0.7, 0.3)
        g.fillRect(r() * W, r() * H, 2, 2)
      }
      tracos(40, 12, 40, 1.1, () => tom(t.cor, 0.5, 0.6), 1.2)
      break
    }
    case 'fibras': {
      tracos(1400, 4, 11, 1.1, () => tom(t.cor, r() > 0.5 ? 1.3 : 0.7, 0.55), 1.4)
      break
    }
    case 'grumos': {
      pontos(700, 1.2, 4.2, () => tom(t.cor, 0.6 + r() * 0.9, 0.75))
      break
    }
  }
  // sombra na borda: a peça tem espessura
  g.restore()
  g.save()
  caminho()
  g.clip()
  g.lineWidth = 14
  g.strokeStyle = 'rgba(0,0,0,0.28)'
  caminho()
  g.stroke()
  g.restore()
  // traço claro do contorno, como no resto do painel
  g.lineWidth = 2
  g.strokeStyle = 'rgba(246,241,231,0.72)'
  caminho()
  g.stroke()
  const url = cv.toDataURL('image/png')
  cache.set(chave, url)
  return url
}
