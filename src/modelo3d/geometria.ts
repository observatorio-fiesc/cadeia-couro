// A bota de segurança, desenhada por código, como o boi e a vaca: superfícies (para as curvas de nível e o
// contorno) e segmentos de reta (para o traço), em coordenadas locais.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const TAU = Math.PI * 2

/** Segmentos de reta acumulados: 6 números por segmento. */
export class Segs {
  a: number[] = []
  seg(p: THREE.Vector3, q: THREE.Vector3) {
    this.a.push(p.x, p.y, p.z, q.x, q.y, q.z)
  }
  linha(pts: THREE.Vector3[], fechada = false) {
    for (let i = 0; i < pts.length - 1; i++) this.seg(pts[i], pts[i + 1])
    if (fechada && pts.length > 2) this.seg(pts[pts.length - 1], pts[0])
  }
  /** Círculo no plano perpendicular ao eixo (x, y ou z), com centro c. */
  circulo(c: THREE.Vector3, r: number, eixo: 'x' | 'y' | 'z', n = 48) {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU
      const a = Math.cos(t) * r
      const b = Math.sin(t) * r
      pts.push(eixo === 'x' ? v3(c.x, c.y + a, c.z + b) : eixo === 'y' ? v3(c.x + a, c.y, c.z + b) : v3(c.x + a, c.y + b, c.z))
    }
    this.linha(pts, true)
  }
  /** As 12 arestas de uma caixa. */
  caixa(c: THREE.Vector3, sx: number, sy: number, sz: number) {
    const h = [sx / 2, sy / 2, sz / 2]
    const p = (i: number, j: number, k: number) => v3(c.x + (i ? h[0] : -h[0]), c.y + (j ? h[1] : -h[1]), c.z + (k ? h[2] : -h[2]))
    for (const [i, j] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) this.seg(p(i, j, 0), p(i, j, 1))
    for (const k of [0, 1] as const) this.linha([p(0, 0, k), p(1, 0, k), p(1, 1, k), p(0, 1, k)], true)
  }
  fim() {
    return new Float32Array(this.a)
  }
}

/** Uma superfície pronta para o material topográfico: posições, normais e o atributo lado (0 = cima). */
function comLado(g: THREE.BufferGeometry, lado = 0) {
  const n = g.attributes.position.count
  g.setAttribute('lado', new THREE.BufferAttribute(new Float32Array(n).fill(lado), 1))
  return g
}

// ================================================================ bota de segurança (SC)
// Comprimento ao longo de x (bico em +x), altura em y, largura em z, em escala de desenho (cerca de 3 vezes
// o tamanho real). O pé é um loft de seções em arco; o cano, um tubo elíptico sobre o calcanhar.
export const BOTA_L = 0.95
const SOLA = 0.07 // espessura do solado
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
/** Meia largura da forma em x (0 = calcanhar, BOTA_L = bico). */
function meiaLargura(x: number) {
  const u = x / BOTA_L
  const base = u < 0.4 ? lerp(0.105, 0.088, u / 0.4) : u < 0.72 ? lerp(0.088, 0.13, (u - 0.4) / 0.32) : lerp(0.13, 0.1, (u - 0.72) / 0.28)
  // pontas arredondadas: o calcanhar e o bico fecham em arco
  const cal = Math.sqrt(Math.max(0, 1 - ((0.1 - Math.min(u, 0.1)) / 0.1) ** 2))
  const bico = Math.sqrt(Math.max(0, 1 - ((Math.max(u, 0.86) - 0.86) / 0.14) ** 2))
  return base * Math.min(cal, bico)
}
/** Altura do cabedal sobre a sola: o bico baixo, o peito do pé subindo até o tornozelo. */
function alturaPe(x: number) {
  const u = x / BOTA_L
  return lerp(0.25, 0.1, sstep(0.3, 0.86, u)) * (u > 0.93 ? Math.sqrt(Math.max(0, 1 - ((u - 0.93) / 0.07) ** 2)) * 0.6 + 0.4 : 1)
}
/** Contorno da planta do pé (fechado, sentido anti-horário visto de cima), ampliado por k. */
export function planta(k = 1, n = 96) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * BOTA_L
    pts.push(v3(x * k + (1 - k) * BOTA_L * 0.5, 0, meiaLargura(x) * k))
  }
  for (let i = n; i >= 0; i--) {
    const x = (i / n) * BOTA_L
    pts.push(v3(x * k + (1 - k) * BOTA_L * 0.5, 0, -meiaLargura(x) * k))
  }
  return pts
}
/** Placa com a forma da planta, de espessura e. */
function placa(k: number, e: number) {
  const contorno = planta(k).map((p) => new THREE.Vector2(p.x, p.z))
  const forma = new THREE.Shape(contorno)
  const g = new THREE.ExtrudeGeometry(forma, { depth: e, bevelEnabled: false, curveSegments: 4 })
  g.rotateX(Math.PI / 2) // a forma está em xz; a espessura desce em y
  g.translate(0, e, 0)
  g.computeVertexNormals()
  return comLado(g)
}
/** Loft do pé: seções em arco ao longo de x, com a escala k (forro por dentro, biqueira e contraforte por fora). */
function loftPe(k: number, x0: number, x1: number, hMax = Infinity) {
  const NX = 64
  const NA = 28
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= NX; i++) {
    const x = lerp(x0, x1, i / NX)
    const w = meiaLargura(x) * k
    const h = Math.min(alturaPe(x) * k, hMax)
    for (let j = 0; j <= NA; j++) {
      const t = (j / NA) * Math.PI // de um lado (z+) ao outro (z−), passando por cima
      // superelipse: lados quase retos, peito arredondado
      const c = Math.cos(t)
      const sn = Math.sin(t)
      const z = w * Math.sign(c) * Math.pow(Math.abs(c), 0.7)
      const y = SOLA + h * Math.pow(sn, 0.55)
      pos.push(x, y, z)
    }
  }
  for (let i = 0; i < NX; i++)
    for (let j = 0; j < NA; j++) {
      const a = i * (NA + 1) + j
      const b = a + NA + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return comLado(g.toNonIndexed())
}
/** Cano: tubo elíptico do peito do pé até a boca, sobre o calcanhar. */
function cano(k: number) {
  const NY = 18
  const NA = 56
  const pos: number[] = []
  const idx: number[] = []
  const cx = BOTA_L * 0.22
  const y0 = SOLA + 0.12
  const y1 = SOLA + 0.47
  for (let i = 0; i <= NY; i++) {
    const y = lerp(y0, y1, i / NY)
    const ax = BOTA_L * 0.17 * k * (1 + 0.06 * (i / NY))
    const az = 0.098 * k * (1 + 0.04 * (i / NY))
    // a boca do cano desce para a frente: um corte levemente inclinado
    for (let j = 0; j <= NA; j++) {
      const t = (j / NA) * TAU
      pos.push(cx + Math.cos(t) * ax, y + (i === NY ? -Math.cos(t) * 0.02 : 0), Math.sin(t) * az)
    }
  }
  for (let i = 0; i < NY; i++)
    for (let j = 0; j < NA; j++) {
      const a = i * (NA + 1) + j
      const b = a + NA + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return comLado(g.toNonIndexed())
}
/** Ponto na superfície do peito do pé, em x, no lado s (+1 ou −1), a uma fração f da altura do arco. */
function noPeito(x: number, s: number, f: number) {
  const w = meiaLargura(x)
  const h = alturaPe(x)
  const t = s > 0 ? f * (Math.PI / 2) : Math.PI - f * (Math.PI / 2)
  const c = Math.cos(t)
  return v3(x, SOLA + h * Math.pow(Math.sin(t), 0.55) + 0.006, w * Math.sign(c) * Math.pow(Math.abs(c), 0.7))
}

export type ParteGeo = { sup: THREE.BufferGeometry | null; linhas: Float32Array; desloc: THREE.Vector3; ancora: THREE.Vector3 }

export function bota(): Record<string, ParteGeo> {
  const vazio = new Float32Array(0)
  // solado: a placa e, embaixo, os cravos
  const sol = new Segs()
  const pl = planta(1.04)
  for (const p of pl) p.y = 0
  sol.linha(pl)
  for (let i = 1; i < 18; i++) {
    const x = (i / 18) * BOTA_L
    const w = meiaLargura(x) * 0.95
    sol.linha([v3(x - 0.012, 0.001, -w), v3(x + 0.012, 0.001, -w * 0.33), v3(x - 0.012, 0.001, w * 0.33), v3(x + 0.012, 0.001, w)])
  }
  // costura do cabedal junto ao solado e em volta da biqueira
  const cost = new Segs()
  const anel = planta(1.0).map((p) => v3(p.x, SOLA + 0.018, p.z))
  cost.linha(anel)
  for (let i = 0; i <= 20; i++) {
    const x = lerp(BOTA_L * 0.74, BOTA_L * 0.985, i / 20)
    if (i < 20) {
      const x2 = lerp(BOTA_L * 0.74, BOTA_L * 0.985, (i + 1) / 20)
      cost.seg(noPeito(x, 1, 0.62), noPeito(x2, 1, 0.62))
      cost.seg(noPeito(x, -1, 0.62), noPeito(x2, -1, 0.62))
    }
  }
  // ilhoses: duas fileiras no peito do pé; o cadarço em zigue-zague entre elas
  const ilh = new Segs()
  const fileira: [THREE.Vector3, THREE.Vector3][] = []
  for (let i = 0; i < 6; i++) {
    const x = lerp(BOTA_L * 0.36, BOTA_L * 0.64, i / 5)
    const a = noPeito(x, 1, 0.86)
    const b = noPeito(x, -1, 0.86)
    fileira.push([a, b])
    for (const p of [a, b]) {
      const r = 0.011
      const c: THREE.Vector3[] = []
      for (let k = 0; k < 16; k++) c.push(v3(p.x + Math.cos((k / 16) * TAU) * r, p.y + 0.002, p.z + Math.sin((k / 16) * TAU) * r))
      ilh.linha(c, true)
    }
  }
  for (let i = 0; i < fileira.length - 1; i++) {
    ilh.seg(fileira[i][0], fileira[i + 1][1])
    ilh.seg(fileira[i][1], fileira[i + 1][0])
  }
  // ganchos no cano, presos à frente dele, dos dois lados (a mesma elipse do cano)
  for (let i = 0; i < 3; i++) {
    const y = SOLA + 0.24 + i * 0.07
    const ax = BOTA_L * 0.17 * (1 + 0.06 * ((y - SOLA - 0.12) / 0.35))
    const az = 0.098 * (1 + 0.04 * ((y - SOLA - 0.12) / 0.35))
    for (const s of [1, -1]) {
      const t = s * 0.75
      const p = v3(BOTA_L * 0.22 + Math.cos(t) * ax, y, Math.sin(t) * az)
      const fora = v3(Math.cos(t), 0, Math.sin(t)).multiplyScalar(0.016)
      ilh.linha([p, p.clone().add(fora).add(v3(0, 0.012, 0)), p.clone().add(fora.clone().multiplyScalar(1.6)).add(v3(0.012, 0, 0))])
    }
  }
  const pe = loftPe(1, 0, BOTA_L)
  const canoG = cano(1)
  const cabedal = mergeGeometries([pe, canoG])!
  const forro = mergeGeometries([loftPe(0.93, BOTA_L * 0.02, BOTA_L * 0.97), cano(0.92)])!
  const biqueira = loftPe(1.06, BOTA_L * 0.72, BOTA_L, 0.11)
  const contraforte = loftPe(1.05, 0, BOTA_L * 0.24, 0.16)
  return {
    solado: { sup: placa(1.04, SOLA), linhas: sol.fim(), desloc: v3(0, -0.2, 0), ancora: v3(BOTA_L * 0.86, SOLA * 0.5, 0.13) },
    antiperfuracao: { sup: placa(0.93, 0.008), linhas: vazio, desloc: v3(0, -0.1, 0), ancora: v3(BOTA_L * 0.5, SOLA + 0.01, 0.09) },
    palmilha: { sup: placa(0.95, 0.012), linhas: vazio, desloc: v3(0, -0.04, 0), ancora: v3(BOTA_L * 0.3, SOLA + 0.012, 0.09) },
    cabedal: { sup: cabedal, linhas: vazio, desloc: v3(0, 0, 0), ancora: v3(BOTA_L * 0.22, SOLA + 0.45, 0.1) },
    forro: { sup: forro, linhas: cost.fim(), desloc: v3(0, 0, 0), ancora: noPeito(BOTA_L * 0.8, 1, 0.62) },
    biqueira: { sup: biqueira, linhas: vazio, desloc: v3(0.07, 0.02, 0), ancora: v3(BOTA_L * 0.95, SOLA + 0.08, 0.06) },
    contraforte: { sup: contraforte, linhas: vazio, desloc: v3(-0.07, 0.01, 0), ancora: v3(-0.01, SOLA + 0.1, 0.06) },
    ilhoses: { sup: null, linhas: ilh.fim(), desloc: v3(0, 0.03, 0), ancora: noPeito(BOTA_L * 0.5, 1, 0.86) },
  }
}
