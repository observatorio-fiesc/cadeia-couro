// Boi e vaca desenhados por código.
// A pele é uma grade que segue a anatomia: u corre da cauda ao pescoço (comprimento do lombo),
// v dá a volta no corpo (fração do perímetro, do meio da barriga ao lombo e de volta à barriga).
// Cada célula da grade é um bloco clicável. A mesma grade, desenrolada a partir da costura da
// barriga, vira a pele aberta na mesa: v * meio-perímetro dá a largura, u dá o comprimento.
import * as THREE from 'three'

export type Sexo = 'boi' | 'vaca'
export type RegiaoId = 'pescoco' | 'paleta' | 'grupao' | 'barrigas' | 'garras'

export const SUB = 3 // subdivisões de cada bloco (curvatura)
export const TRI_BLOCO = 2 * SUB * SUB
export const VERT_BLOCO = TRI_BLOCO * 3
export const Y_MESA = 1.12 // altura da pele aberta

export const NU = 26 // blocos ao longo do corpo
export const NV = 24 // blocos ao redor (par: o lombo cai numa divisa)
const NLS = 4 // blocos ao longo da garra
const NLF = 8 // blocos ao redor da garra

type V = THREE.Vector3
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)

export type Bloco = {
  id: number
  regiao: RegiaoId
  col: number // coluna ao longo do corpo (0 = cauda); garras: -1
  lin: number // linha ao redor
  perna: number // -1 no corpo; 0 a 3 nas garras
  viz: [number, number, number, number]
  c3: V // centro no animal
  cp: V // centro na pele aberta
}

// segmentos de reta: 6 números por segmento (início e fim), no animal (p3) e na pele aberta (pp);
// atraso de 0 a 1 por vértice: o lombo abre primeiro, a barriga e as garras por último
export type Linhas = { p3: Float32Array; pp: Float32Array; atraso: Float32Array }

export type Partes = { tri: Float32Array; nrm: Float32Array; fina: Float32Array; media: Float32Array; forte: Float32Array }

// peça de pele de uma região, com espessura (do corpo até a casca) e borda arredondada
export type Peca = {
  pos: Float32Array // triângulos
  nrm: Float32Array
  uvm: Float32Array // coordenadas na superfície, em metros
  lado: Float32Array // 0 = face de cima, 1 = face de baixo, 0.5 = borda
  dir: Float32Array // direção em que a ilha da peça se afasta do corpo
  borda: Float32Array // contorno de fora (segmentos)
  dirBorda: Float32Array // direção por vértice do contorno
  centro: V
  normal: V
}

export const REGIAO_IDX: Record<RegiaoId, number> = { pescoco: 0, paleta: 1, grupao: 2, barrigas: 3, garras: 4 }
export const CASCA_CORPO = 0.03 // distância da linha de fora (a pele) ao corpo
export const CASCA_PERNA = 0.02

export type Modelo = {
  sexo: Sexo
  pele: { p3: Float32Array; pp: Float32Array; n3: Float32Array; atraso: Float32Array; reg: Float32Array; casca: Float32Array }
  blocos: Bloco[]
  nCorpo: number // blocos do corpo (os demais são garras)
  fina: Linhas
  borda: Linhas
  media: Linhas
  contorno: Record<RegiaoId, Linhas>
  partes: Partes
  pecas: Record<RegiaoId, Peca>
  ancoras: Record<RegiaoId, { c3: V[]; cp: V[] }>
  cabeca: V
  boca: V
  escala: number
}

// ---------------------------------------------------------------- perfis
// [x, topo, base, meia-largura, expoente da superelipse, pera (alarga embaixo)]
type Chave = [number, number, number, number, number, number]

const CHAVES: Record<Sexo, Chave[]> = {
  boi: [
    [-0.985, 1.33, 0.9, 0.015, 2.0, 0],
    [-0.95, 1.36, 0.8, 0.13, 2.3, 0],
    [-0.88, 1.39, 0.73, 0.21, 2.6, 0.04],
    [-0.76, 1.41, 0.69, 0.25, 2.8, 0.05],
    [-0.6, 1.415, 0.66, 0.27, 2.9, 0.06],
    [-0.4, 1.4, 0.62, 0.285, 2.8, 0.12],
    [-0.15, 1.385, 0.6, 0.3, 2.7, 0.15],
    [0.1, 1.385, 0.605, 0.3, 2.6, 0.13],
    [0.3, 1.4, 0.63, 0.28, 2.5, 0.08],
    [0.48, 1.43, 0.66, 0.245, 2.4, 0.02],
    [0.62, 1.4, 0.7, 0.215, 2.3, 0],
    [0.76, 1.38, 0.79, 0.19, 2.2, 0],
    [0.9, 1.37, 0.92, 0.16, 2.1, 0],
    [1.02, 1.37, 1.05, 0.135, 2.0, 0],
  ],
  vaca: [
    [-0.985, 1.32, 0.9, 0.015, 2.0, 0],
    [-0.95, 1.35, 0.79, 0.135, 2.3, 0],
    [-0.88, 1.38, 0.72, 0.22, 2.6, 0.04],
    [-0.76, 1.4, 0.67, 0.265, 2.8, 0.05],
    [-0.6, 1.405, 0.63, 0.28, 2.9, 0.08],
    [-0.4, 1.39, 0.58, 0.295, 2.8, 0.15],
    [-0.15, 1.375, 0.56, 0.31, 2.7, 0.18],
    [0.1, 1.375, 0.575, 0.305, 2.6, 0.15],
    [0.3, 1.385, 0.61, 0.275, 2.5, 0.08],
    [0.48, 1.4, 0.65, 0.235, 2.4, 0.02],
    [0.62, 1.38, 0.7, 0.2, 2.3, 0],
    [0.76, 1.35, 0.8, 0.165, 2.2, 0],
    [0.9, 1.34, 0.93, 0.14, 2.1, 0],
    [1.02, 1.35, 1.06, 0.12, 2.0, 0],
  ],
}

const FORMA: Record<Sexo, { corcova: number; barbela: number; escala: number; chifre: boolean; ubere: boolean; cab: number; perna: number }> = {
  boi: { corcova: 0.16, barbela: 0.19, escala: 1, chifre: true, ubere: false, cab: 1, perna: 1 },
  vaca: { corcova: 0.05, barbela: 0.09, escala: 0.94, chifre: false, ubere: true, cab: 0.9, perna: 0.94 },
}

// limites das regiões na grade do corpo (x do corpo e fração do perímetro a partir do lombo)
const X_PESCOCO = 0.66
const X_PALETA = 0.27
const V_BARRIGA = 0.56

// interpolação cúbica (Catmull-Rom com espaçamento desigual)
function hermite(xs: number[], ys: number[], x: number) {
  const n = xs.length
  if (x <= xs[0]) return ys[0]
  if (x >= xs[n - 1]) return ys[n - 1]
  let i = 0
  while (x > xs[i + 1]) i++
  const h = xs[i + 1] - xs[i]
  const t = (x - xs[i]) / h
  const m = (k: number) =>
    k <= 0 ? (ys[1] - ys[0]) / (xs[1] - xs[0]) : k >= n - 1 ? (ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2]) : (ys[k + 1] - ys[k - 1]) / (xs[k + 1] - xs[k - 1])
  const m0 = m(i) * h
  const m1 = m(i + 1) * h
  const t2 = t * t
  const t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * m1
}

function superficieCorpo(sexo: Sexo) {
  const ch = CHAVES[sexo]
  const f = FORMA[sexo]
  const xs = ch.map((c) => c[0])
  const campo = (k: number) => {
    const ys = ch.map((c) => c[k])
    return (x: number) => hermite(xs, ys, x)
  }
  const topo = campo(1)
  const base = campo(2)
  const meia = campo(3)
  const nn = campo(4)
  const pera = campo(5)
  const corcova = (x: number) => {
    const d = x - 0.5
    const s = d < 0 ? 0.16 : 0.09
    return f.corcova * Math.exp(-(d * d) / (2 * s * s))
  }
  const barbela = (x: number) => (x <= 0.45 || x >= 1.02 ? 0 : f.barbela * Math.pow(Math.sin((Math.PI * (x - 0.45)) / 0.57), 1.2))
  const ponto = (x: number, th: number, o: V) => {
    const tp = topo(x)
    const bs = base(x)
    const yc = (tp + bs) / 2
    const ht = tp - yc
    const hb = yc - bs
    const s = Math.sin(th)
    const c = Math.cos(th)
    const e = 2 / nn(x)
    let z = meia(x) * Math.sign(s) * Math.pow(Math.abs(s), e)
    let y = (c >= 0 ? ht : hb) * Math.sign(c) * Math.pow(Math.abs(c), e)
    z *= 1 - pera(x) * c
    y += corcova(x) * Math.exp(-(th * th) / (2 * 0.72 * 0.72))
    const dw = barbela(x)
    if (dw > 0) {
      const d = Math.PI - Math.abs(th)
      const g = Math.exp(-(d * d) / (2 * 0.36 * 0.36))
      y -= dw * g
      z *= 1 - 0.8 * g
    }
    return o.set(x, yc + y, z)
  }
  return { ponto, x0: xs[0], x1: xs[xs.length - 1], yc: (x: number) => (topo(x) + base(x)) / 2 }
}

// ---------------------------------------------------------------- acumuladores
class AcLinhas {
  p3: number[] = []
  pp: number[] = []
  at: number[] = []
  seg(a3: V, b3: V, ap: V, bp: V, da: number, db: number) {
    this.p3.push(a3.x, a3.y, a3.z, b3.x, b3.y, b3.z)
    this.pp.push(ap.x, ap.y, ap.z, bp.x, bp.y, bp.z)
    this.at.push(da, db)
  }
  fim(): Linhas {
    return { p3: new Float32Array(this.p3), pp: new Float32Array(this.pp), atraso: new Float32Array(this.at) }
  }
}

export class AcPartes {
  tri: number[] = []
  nrm: number[] = []
  fina: number[] = []
  media: number[] = []
  forte: number[] = []
  linha(alvo: number[], a: V, b: V) {
    alvo.push(a.x, a.y, a.z, b.x, b.y, b.z)
  }
  // grade de anéis: P[i][k], i ao longo, k ao redor (k = K repete k = 0 quando fechada)
  grade(P: V[][], fechada = true) {
    const nI = P.length
    const nK = P[0].length
    const N: V[][] = P.map((anel, i) =>
      anel.map((_, k) => {
        const a = P[Math.min(i + 1, nI - 1)][k].clone().sub(P[Math.max(i - 1, 0)][k])
        const kk1 = k + 1 < nK ? k + 1 : fechada ? 1 : nK - 1
        const kk0 = k - 1 >= 0 ? k - 1 : fechada ? nK - 2 : 0
        const b = P[i][kk1].clone().sub(P[i][kk0])
        const n = a.cross(b)
        if (n.lengthSq() < 1e-12) n.set(0, 1, 0)
        n.normalize()
        const c = v3()
        for (let q = 0; q < nK - (fechada ? 1 : 0); q++) c.add(P[i][q])
        c.multiplyScalar(1 / (nK - (fechada ? 1 : 0)))
        if (n.dot(P[i][k].clone().sub(c)) < 0) n.negate()
        return n
      }),
    )
    for (let i = 0; i < nI - 1; i++)
      for (let k = 0; k < nK - 1; k++) {
        const q = [
          [i, k],
          [i + 1, k],
          [i + 1, k + 1],
          [i, k],
          [i + 1, k + 1],
          [i, k + 1],
        ]
        for (const [a, b] of q) {
          this.tri.push(P[a][b].x, P[a][b].y, P[a][b].z)
          this.nrm.push(N[a][b].x, N[a][b].y, N[a][b].z)
        }
      }
  }
  aneis(alvo: number[], P: V[][], quais: number[]) {
    for (const i of quais) for (let k = 0; k < P[i].length - 1; k++) this.linha(alvo, P[i][k], P[i][k + 1])
  }
  longas(alvo: number[], P: V[][], quais: number[]) {
    for (const k of quais) for (let i = 0; i < P.length - 1; i++) this.linha(alvo, P[i][k], P[i + 1][k])
  }
  fim(): Partes {
    const f = (a: number[]) => new Float32Array(a)
    return { tri: f(this.tri), nrm: f(this.nrm), fina: f(this.fina), media: f(this.media), forte: f(this.forte) }
  }
}

// curva Catmull-Rom uniforme por pontos de controle
export function cr(pts: V[], u: number, o: V) {
  const n = pts.length
  const t = Math.min(Math.max(u, 0), 1) * (n - 1)
  const i = Math.min(Math.floor(t), n - 2)
  const l = t - i
  const p0 = pts[Math.max(i - 1, 0)]
  const p1 = pts[i]
  const p2 = pts[i + 1]
  const p3 = pts[Math.min(i + 2, n - 1)]
  const l2 = l * l
  const l3 = l2 * l
  const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * l + (2 * a - 5 * b + 4 * c - d) * l2 + (-a + 3 * b - 3 * c + d) * l3)
  return o.set(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z))
}
const interpIdx = (vals: number[], u: number) => {
  const n = vals.length
  const t = Math.min(Math.max(u, 0), 1) * (n - 1)
  const i = Math.min(Math.floor(t), n - 2)
  const l = t - i
  const s = l * l * (3 - 2 * l)
  return vals[i] + (vals[i + 1] - vals[i]) * s
}

// tubo ao longo de uma curva: devolve anéis P[i][k] e uma função de quadro
export function tubo(pts: V[], raioF: (u: number) => number, raioL: (u: number) => number, us: number[], K: number, fase = 0) {
  const P: V[][] = []
  const c = v3()
  const a = v3()
  const b = v3()
  for (const u of us) {
    cr(pts, u, c)
    cr(pts, Math.min(u + 0.004, 1), a)
    cr(pts, Math.max(u - 0.004, 0), b)
    const T = a.sub(b).normalize()
    let F = v3(0, 0, 1).cross(T)
    if (F.lengthSq() < 1e-6) F = v3(1, 0, 0)
    F.normalize()
    const L = T.clone().cross(F).normalize()
    const rf = raioF(u)
    const rl = raioL(u)
    const anel: V[] = []
    for (let k = 0; k <= K; k++) {
      const ph = fase + (2 * Math.PI * k) / K
      anel.push(c.clone().addScaledVector(F, rf * Math.cos(ph)).addScaledVector(L, rl * Math.sin(ph)))
    }
    P.push(anel)
  }
  return P
}

// ---------------------------------------------------------------- pernas
type Perna = { pts: [number, number][]; rf: number[]; rl: number[]; joelho: number; frente: boolean; z: number }
const PERNAS: Perna[] = [
  { pts: [[0.47, 0.98], [0.455, 0.7], [0.47, 0.42], [0.48, 0.14], [0.5, 0.05]], rf: [0.13, 0.105, 0.068, 0.052, 0.055], rl: [0.095, 0.085, 0.058, 0.046, 0.05], joelho: 2, frente: true, z: 0.15 },
  { pts: [[-0.66, 1.05], [-0.555, 0.72], [-0.75, 0.46], [-0.71, 0.14], [-0.69, 0.05]], rf: [0.16, 0.125, 0.07, 0.052, 0.055], rl: [0.1, 0.095, 0.058, 0.046, 0.05], joelho: 2, frente: false, z: 0.155 },
]

// ---------------------------------------------------------------- modelo
export function gerarModelo(sexo: Sexo): Modelo {
  const F = FORMA[sexo]
  const { ponto, x0, x1, yc } = superficieCorpo(sexo)

  // linha do lombo: comprimento acumulado
  const NT = 900
  const LT = new Float64Array(NT + 1)
  const XT = new Float64Array(NT + 1)
  {
    const a = v3()
    const b = v3()
    ponto(x0, 0, a)
    XT[0] = x0
    for (let i = 1; i <= NT; i++) {
      XT[i] = x0 + ((x1 - x0) * i) / NT
      ponto(XT[i], 0, b)
      LT[i] = LT[i - 1] + a.distanceTo(b)
      a.copy(b)
    }
  }
  const Ltot = LT[NT]
  const xDeL = (L: number) => {
    let lo = 0
    let hi = NT
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1
      if (LT[m] < L) lo = m
      else hi = m
    }
    const t = LT[hi] > LT[lo] ? (L - LT[lo]) / (LT[hi] - LT[lo]) : 0
    return XT[lo] + (XT[hi] - XT[lo]) * t
  }
  const LdeX = (x: number) => {
    const t = ((x - x0) / (x1 - x0)) * NT
    const i = Math.min(Math.max(Math.floor(t), 0), NT - 1)
    return LT[i] + (LT[i + 1] - LT[i]) * (t - i)
  }

  // perímetro da seção: comprimento acumulado do lombo (th = 0) à barriga (th = pi)
  const M = 160
  const tabela = (x: number) => {
    const S = new Float64Array(M + 1)
    const a = v3()
    const b = v3()
    ponto(x, 0, a)
    for (let k = 1; k <= M; k++) {
      ponto(x, (Math.PI * k) / M, b)
      S[k] = S[k - 1] + a.distanceTo(b)
      a.copy(b)
    }
    return S
  }
  const thDe = (S: Float64Array, frac: number) => {
    const alvo = frac * S[M]
    let lo = 0
    let hi = M
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1
      if (S[m] < alvo) lo = m
      else hi = m
    }
    const t = S[hi] > S[lo] ? (alvo - S[lo]) / (S[hi] - S[lo]) : 0
    return (Math.PI * (lo + t)) / M
  }

  // contorno da pele aberta: meia largura ao longo do comprimento (0 = cauda, 1 = pescoço), com o
  // desenho de uma pele estendida na mesa: larga na garupa, um pouco recolhida no vazio, estreita no pescoço
  const PERFIL_U = [0, 0.05, 0.14, 0.3, 0.45, 0.6, 0.7, 0.8, 0.9, 1]
  const PERFIL_W = [0.6, 0.88, 1.0, 0.95, 0.93, 0.99, 0.95, 0.82, 0.68, 0.52]
  const LARG = 1.1
  const meiaLargura = (u: number) => LARG * hermite(PERFIL_U, PERFIL_W, u)

  // grade do corpo
  const A = NU * SUB
  const B = NV * SUB
  const G3: V[][] = []
  const GP: V[][] = []
  const GV: number[] = []
  const xA: number[] = []
  for (let a = 0; a <= A; a++) {
    const L = (Ltot * a) / A
    const x = xDeL(L)
    xA.push(x)
    const S = tabela(x)
    const meio = meiaLargura(L / Ltot)
    const l3: V[] = []
    const lp: V[] = []
    for (let b = 0; b <= B; b++) {
      const v = -1 + (2 * b) / B
      if (a === 0) GV.push(v)
      const th = Math.sign(v) * thDe(S, Math.abs(v))
      l3.push(ponto(x, th, v3()))
      lp.push(v3(L - Ltot / 2, Y_MESA, v * meio))
    }
    G3.push(l3)
    GP.push(lp)
  }
  const GN: V[][] = G3.map((linha, a) =>
    linha.map((p, b) => {
      const da = G3[Math.min(a + 1, A)][b].clone().sub(G3[Math.max(a - 1, 0)][b])
      const db = G3[a][Math.min(b + 1, B)].clone().sub(G3[a][Math.max(b - 1, 0)])
      const n = da.cross(db)
      if (n.lengthSq() < 1e-12) n.set(0, 1, 0)
      n.normalize()
      const c = v3(xA[a], yc(xA[a]), 0)
      if (n.dot(p.clone().sub(c)) < 0) n.negate()
      return n
    }),
  )

  const p3: number[] = []
  const pp: number[] = []
  const n3: number[] = []
  const at: number[] = []
  const rg: number[] = [] // região de cada vértice
  const dc: number[] = [] // distância da casca em cada vértice
  const blocos: Bloco[] = []
  const fina = new AcLinhas()
  const borda = new AcLinhas()
  const media = new AcLinhas()
  const contorno: Record<RegiaoId, AcLinhas> = { pescoco: new AcLinhas(), paleta: new AcLinhas(), grupao: new AcLinhas(), barrigas: new AcLinhas(), garras: new AcLinhas() }

  const regiaoCorpo = (xc: number, vc: number): RegiaoId => (xc > X_PESCOCO ? 'pescoco' : Math.abs(vc) > V_BARRIGA ? 'barrigas' : xc > X_PALETA ? 'paleta' : 'grupao')
  const idCorpo = (i: number, j: number) => (i < 0 || i >= NU || j < 0 || j >= NV ? -1 : i * NV + j)

  for (let i = 0; i < NU; i++)
    for (let j = 0; j < NV; j++) {
      const a0 = i * SUB
      const b0 = j * SUB
      const xc = (xA[a0] + xA[a0 + SUB]) / 2
      const vc = (GV[b0] + GV[b0 + SUB]) / 2
      const c3 = v3()
      const cp = v3()
      for (const [da, db] of [
        [0, 0],
        [SUB, 0],
        [SUB, SUB],
        [0, SUB],
      ]) {
        c3.add(G3[a0 + da][b0 + db])
        cp.add(GP[a0 + da][b0 + db])
      }
      c3.multiplyScalar(0.25)
      cp.multiplyScalar(0.25)
      const regB = regiaoCorpo(xc, vc)
      blocos.push({ id: blocos.length, regiao: regB, col: i, lin: j, perna: -1, viz: [idCorpo(i - 1, j), idCorpo(i + 1, j), idCorpo(i, j - 1), idCorpo(i, j + 1)], c3, cp })
      for (let q = 0; q < VERT_BLOCO; q++) {
        rg.push(REGIAO_IDX[regB])
        dc.push(CASCA_CORPO)
      }
      for (let sa = 0; sa < SUB; sa++)
        for (let sb = 0; sb < SUB; sb++) {
          const a = a0 + sa
          const b = b0 + sb
          for (const [qa, qb] of [
            [a, b],
            [a + 1, b],
            [a + 1, b + 1],
            [a, b],
            [a + 1, b + 1],
            [a, b + 1],
          ]) {
            const P = G3[qa][qb]
            const Q = GP[qa][qb]
            const N = GN[qa][qb]
            p3.push(P.x, P.y, P.z)
            pp.push(Q.x, Q.y, Q.z)
            n3.push(N.x, N.y, N.z)
            at.push(Math.abs(GV[qb]))
          }
        }
    }
  const nCorpo = blocos.length

  // linhas do corpo
  const segA = (alvo: AcLinhas, a: number, b0: number, b1: number) => {
    for (let b = b0; b < b1; b++) alvo.seg(G3[a][b], G3[a][b + 1], GP[a][b], GP[a][b + 1], Math.abs(GV[b]), Math.abs(GV[b + 1]))
  }
  const segB = (alvo: AcLinhas, b: number, a0: number, a1: number) => {
    for (let a = a0; a < a1; a++) alvo.seg(G3[a][b], G3[a + 1][b], GP[a][b], GP[a + 1][b], Math.abs(GV[b]), Math.abs(GV[b]))
  }
  for (let i = 0; i <= NU; i++) segA(fina, i * SUB, 0, B)
  for (let j = 0; j <= NV; j++) segB(fina, j * SUB, 0, A)
  segB(media, B / 2, 0, A) // lombo: a linha que separa os dois meios
  segA(borda, 0, 0, B)
  segA(borda, A, 0, B)
  segB(borda, 0, 0, A) // costura da barriga
  segB(borda, B, 0, A)
  for (const bl of blocos) {
    const a0 = bl.col * SUB
    const b0 = bl.lin * SUB
    const r = bl.regiao
    const outra = (id: number) => (id < 0 ? null : blocos[id].regiao)
    // [aresta, vizinho]: 0 = a0 (cauda), 1 = a0+SUB, 2 = b0, 3 = b0+SUB
    const arestas: [number, () => void, (alvo: AcLinhas) => void][] = [
      [bl.viz[0], () => {}, (al) => segA(al, a0, b0, b0 + SUB)],
      [bl.viz[1], () => {}, (al) => segA(al, a0 + SUB, b0, b0 + SUB)],
      [bl.viz[2], () => {}, (al) => segB(al, b0, a0, a0 + SUB)],
      [bl.viz[3], () => {}, (al) => segB(al, b0 + SUB, a0, a0 + SUB)],
    ]
    for (const [viz, , desenha] of arestas) {
      if (outra(viz) !== r) {
        desenha(contorno[r])
        if (viz >= 0 && viz > bl.id) desenha(borda)
      }
    }
  }

  // garras (pernas): parte de pele até o joelho, o resto é canela e casco
  const partes = new AcPartes()
  const pernasDef = PERNAS.flatMap((p) => [
    { ...p, z: p.z },
    { ...p, z: -p.z },
  ])
  const ancGarras3: V[] = []
  const ancGarrasP: V[] = []
  type InfoPerna = { pts: V[]; rf: (u: number) => number; rl: (u: number) => number; uDeS: (s: number) => number; sJ: number; fase: number; lado: number; frente: boolean }
  const pernasInfo: InfoPerna[] = []
  pernasDef.forEach((pd, iPerna) => {
    const lado = Math.sign(pd.z)
    const pts = pd.pts.map(([x, y]) => v3(x, y, pd.z))
    const rf = (u: number) => interpIdx(pd.rf, u) * F.perna
    const rl = (u: number) => interpIdx(pd.rl, u) * F.perna
    // comprimento ao longo da perna
    const NS = 240
    const LS = new Float64Array(NS + 1)
    {
      const a = v3()
      const b = v3()
      cr(pts, 0, a)
      for (let k = 1; k <= NS; k++) {
        cr(pts, k / NS, b)
        LS[k] = LS[k - 1] + a.distanceTo(b)
        a.copy(b)
      }
    }
    const uDeS = (s: number) => {
      let lo = 0
      let hi = NS
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1
        if (LS[m] < s) lo = m
        else hi = m
      }
      const t = LS[hi] > LS[lo] ? (s - LS[lo]) / (LS[hi] - LS[lo]) : 0
      return (lo + t) / NS
    }
    const uJ = pd.joelho / (pd.pts.length - 1)
    const sJ = LS[Math.round(uJ * NS)]
    const K = NLF * SUB
    const fase = lado > 0 ? -Math.PI / 2 : Math.PI / 2 // corte no lado de dentro da perna
    pernasInfo.push({ pts, rf, rl, uDeS, sJ, fase, lado, frente: pd.frente })
    const nAneis = NLS * SUB
    const usPele = Array.from({ length: nAneis + 1 }, (_, i) => uDeS((sJ * i) / nAneis))
    const P = tubo(pts, rf, rl, usPele, K, fase)
    // pele aberta: a garra sai da borda da barriga, em leque
    const xTopo = pd.pts[0][0]
    const Xa = LdeX(xTopo) - Ltot / 2
    const meioTopo = meiaLargura(LdeX(xTopo) / Ltot)
    const dir = pd.frente ? 1 : -1
    const PPl: V[][] = P.map((anel, i) => {
      const s = (sJ * i) / nAneis
      const u = usPele[i]
      const circ = Math.PI * (rf(u) + rl(u))
      return anel.map((_, k) => v3(Xa + (k / K - 0.5) * circ * 0.7 + dir * s * 0.32, Y_MESA, lado * (meioTopo + s * 0.62)))
    })
    const NP: V[][] = P.map((anel) => {
      const c = v3()
      for (let k = 0; k < K; k++) c.add(anel[k])
      c.multiplyScalar(1 / K)
      return anel.map((p) => p.clone().sub(c).normalize())
    })
    const atrasoAnel = (i: number) => 0.82 + (0.18 * i) / nAneis
    const base = blocos.length
    const idG = (is: number, jf: number) => (is < 0 || is >= NLS || jf < 0 || jf >= NLF ? -1 : base + is * NLF + jf)
    for (let is = 0; is < NLS; is++)
      for (let jf = 0; jf < NLF; jf++) {
        const a0 = is * SUB
        const b0 = jf * SUB
        const c3 = v3()
        const cp = v3()
        for (const [da, db] of [
          [0, 0],
          [SUB, 0],
          [SUB, SUB],
          [0, SUB],
        ]) {
          c3.add(P[a0 + da][b0 + db])
          cp.add(PPl[a0 + da][b0 + db])
        }
        c3.multiplyScalar(0.25)
        cp.multiplyScalar(0.25)
        blocos.push({ id: blocos.length, regiao: 'garras', col: -1, lin: jf, perna: iPerna, viz: [idG(is - 1, jf), idG(is + 1, jf), idG(is, jf - 1), idG(is, jf + 1)], c3, cp })
        for (let q = 0; q < VERT_BLOCO; q++) {
          rg.push(REGIAO_IDX.garras)
          dc.push(CASCA_PERNA)
        }
        for (let sa = 0; sa < SUB; sa++)
          for (let sb = 0; sb < SUB; sb++) {
            const a = a0 + sa
            const b = b0 + sb
            for (const [qa, qb] of [
              [a, b],
              [a + 1, b],
              [a + 1, b + 1],
              [a, b],
              [a + 1, b + 1],
              [a, b + 1],
            ]) {
              const Pq = P[qa][qb]
              const Qq = PPl[qa][qb]
              const Nq = NP[qa][qb]
              p3.push(Pq.x, Pq.y, Pq.z)
              pp.push(Qq.x, Qq.y, Qq.z)
              n3.push(Nq.x, Nq.y, Nq.z)
              at.push(atrasoAnel(qa))
            }
          }
      }
    const anel = (alvo: AcLinhas, i: number) => {
      for (let k = 0; k < K; k++) alvo.seg(P[i][k], P[i][k + 1], PPl[i][k], PPl[i][k + 1], atrasoAnel(i), atrasoAnel(i))
    }
    const longa = (alvo: AcLinhas, k: number) => {
      for (let i = 0; i < nAneis; i++) alvo.seg(P[i][k], P[i + 1][k], PPl[i][k], PPl[i + 1][k], atrasoAnel(i), atrasoAnel(i + 1))
    }
    for (let is = 0; is <= NLS; is++) anel(fina, is * SUB)
    for (let jf = 0; jf <= NLF; jf++) longa(fina, jf * SUB)
    anel(borda, nAneis) // joelho: fim da pele
    anel(contorno.garras, 0)
    anel(contorno.garras, nAneis)
    longa(contorno.garras, 0)
    longa(contorno.garras, K)
    longa(borda, 0)
    longa(borda, K)
    // âncora da garra: face de fora, no meio
    ancGarras3.push(P[Math.round(nAneis * 0.6)][Math.round(K / 2)].clone())
    ancGarrasP.push(PPl[Math.round(nAneis * 0.6)][Math.round(K / 2)].clone())

    // canela e casco (não é pele)
    const sFim = LS[NS]
    const nCanela = 10
    const Kc = 16
    const usCanela = Array.from({ length: nCanela + 1 }, (_, i) => uDeS(sJ + ((sFim - sJ) * i) / nCanela))
    const C = tubo(pts, rf, rl, usCanela, Kc, 0)
    partes.grade(C)
    partes.aneis(partes.fina, C, [2, 4, 6, 8])
    partes.longas(partes.fina, C, [0, 4, 8, 12])
    // casco
    const fim = pts[pts.length - 1]
    const r0 = rf(1)
    const anelCasco = (y: number, dx: number, rx: number, rz: number) =>
      Array.from({ length: Kc + 1 }, (_, k) => {
        const ph = (2 * Math.PI * k) / Kc
        return v3(fim.x + dx + rx * Math.cos(ph), y, fim.z + rz * Math.sin(ph))
      })
    const H = [anelCasco(fim.y + 0.035, 0, r0 * 1.0, r0 * 0.92), anelCasco(0.045, 0.008, r0 * 1.12, r0 * 1.0), anelCasco(0, 0.018, r0 * 1.26, r0 * 1.08)]
    partes.grade(H)
    partes.aneis(partes.media, H, [0, 2])
    partes.linha(partes.media, H[2][0], H[0][0]) // fenda do casco, na frente
  })

  // ---------------------------------------------------------------- cabeça
  const cab = { a: v3(0.97, 1.25, 0), b: v3(1.34, 0.92, 0) }
  const eixo = cab.b.clone().sub(cab.a)
  const comp = eixo.length()
  eixo.normalize()
  const U = v3(-eixo.y, eixo.x, 0) // "para cima" na seção da cabeça
  const Z = v3(0, 0, 1)
  const chCab: [number, number, number, number][] = [
    [0, 0.125, 0.15, 0.175],
    [0.22, 0.132, 0.13, 0.15],
    [0.45, 0.1, 0.098, 0.1],
    [0.7, 0.085, 0.085, 0.085],
    [0.88, 0.096, 0.086, 0.09],
    [0.96, 0.09, 0.078, 0.082],
    [1.0, 0.07, 0.058, 0.062],
  ]
  const ts = chCab.map((c) => c[0])
  const hw = (t: number) => hermite(ts, chCab.map((c) => c[1]), t) * F.cab
  const htp = (t: number) => hermite(ts, chCab.map((c) => c[2]), t)
  const hbt = (t: number) => hermite(ts, chCab.map((c) => c[3]), t)
  const pontoCab = (t: number, th: number) => {
    const s = Math.sin(th)
    const c = Math.cos(th)
    const e = 2 / 2.5
    const z = hw(t) * Math.sign(s) * Math.pow(Math.abs(s), e)
    const u = (c >= 0 ? htp(t) : hbt(t)) * Math.sign(c) * Math.pow(Math.abs(c), e)
    return cab.a.clone().addScaledVector(eixo, comp * t).addScaledVector(U, u).addScaledVector(Z, z)
  }
  const KH = 24
  const NH = 16
  const PC: V[][] = []
  for (let i = 0; i <= NH; i++) {
    const t = i / NH
    PC.push(Array.from({ length: KH + 1 }, (_, k) => pontoCab(t, -Math.PI + (2 * Math.PI * k) / KH)))
  }
  partes.grade(PC)
  partes.aneis(partes.fina, PC, [2, 4, 6, 8, 10, 12, 14])
  partes.longas(partes.fina, PC, [3, 6, 9, 15, 18, 21])
  partes.longas(partes.media, PC, [0, 12]) // perfil: chanfro e queixo
  // sem olhos nem narinas: só a forma da cabeça, as orelhas e os chifres
  for (const lado of [1, -1]) {
    // orelha: folha voltada para fora, um pouco caída e para trás
    const base = pontoCab(0.13, lado * 1.12)
    const e = v3(0, 0, lado).addScaledVector(eixo, -0.38).add(v3(0, -0.28, 0)).normalize()
    const w = eixo.clone().sub(e.clone().multiplyScalar(eixo.dot(e))).normalize()
    const nE = e.clone().cross(w).normalize()
    const NL = 8
    const NQ = 4
    const O: V[][] = []
    for (let i = 0; i <= NL; i++) {
      const l = i / NL
      const larg = 0.05 * Math.max(0, Math.sin(Math.PI * Math.min(1, 0.16 + l * 0.86))) * (1 - 0.25 * l)
      const linha: V[] = []
      for (let q = 0; q <= NQ; q++) {
        const qq = -1 + (2 * q) / NQ
        linha.push(
          base
            .clone()
            .addScaledVector(e, 0.21 * l)
            .addScaledVector(w, larg * qq)
            .addScaledVector(nE, lado * 0.014 * Math.sin(Math.PI * l) * (1 - qq * qq)),
        )
      }
      O.push(linha)
    }
    partes.grade(O, false)
    partes.longas(partes.media, O, [0, NQ])
    partes.longas(partes.fina, O, [NQ / 2])
    partes.aneis(partes.media, O, [0])
    // chifre (só no boi)
    if (F.chifre) {
      const bc = pontoCab(0.05, lado * 0.55)
      const pts = [bc, bc.clone().add(v3(-0.01, 0.07, lado * 0.05)), bc.clone().add(v3(-0.05, 0.15, lado * 0.08)), bc.clone().add(v3(-0.1, 0.205, lado * 0.065))]
      const us = Array.from({ length: 9 }, (_, i) => i / 8)
      const raio = (u: number) => 0.036 * (1 - u) + 0.004 * u
      const Ch = tubo(pts, raio, raio, us, 10, 0)
      partes.grade(Ch)
      partes.aneis(partes.forte, Ch, [0])
      partes.aneis(partes.media, Ch, [3, 6])
      partes.longas(partes.forte, Ch, [0, 5])
      partes.longas(partes.media, Ch, [2, 7])
    }
  }

  // ---------------------------------------------------------------- cauda
  {
    const pts = [v3(-0.965, 1.33, 0), v3(-1.005, 1.22, 0), v3(-1.02, 0.98, 0), v3(-1.012, 0.74, 0), v3(-1.0, 0.57, 0)]
    const us = Array.from({ length: 13 }, (_, i) => i / 12)
    const raio = (u: number) => 0.03 * (1 - u) + 0.017 * u
    const T = tubo(pts, raio, raio, us, 8, 0)
    partes.grade(T)
    partes.aneis(partes.fina, T, [2, 4, 6, 8, 10])
    partes.longas(partes.fina, T, [0, 4])
    partes.longas(partes.media, T, [2, 6])
    const vs = [v3(-1.0, 0.6, 0), v3(-0.998, 0.48, 0), v3(-0.992, 0.36, 0)]
    const us2 = Array.from({ length: 9 }, (_, i) => i / 8)
    const rv = (u: number) => 0.012 + 0.045 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.04)), 0.7)
    const Vs = tubo(vs, rv, rv, us2, 10, 0)
    partes.grade(Vs)
    partes.aneis(partes.media, Vs, [2, 4, 6])
    partes.longas(partes.fina, Vs, [0, 3, 5, 8])
  }

  // ---------------------------------------------------------------- úbere e tetas (vaca)
  if (F.ubere) {
    const c = v3(-0.5, 0.585, 0)
    const rx = 0.165
    const ry = 0.125
    const rz = 0.14
    const NA = 8
    const KB = 16
    const a0 = 0.95
    const Ub: V[][] = []
    for (let i = 0; i <= NA; i++) {
      const al = a0 + ((Math.PI - a0) * i) / NA
      Ub.push(Array.from({ length: KB + 1 }, (_, k) => {
        const be = (2 * Math.PI * k) / KB
        return v3(c.x + rx * Math.sin(al) * Math.cos(be), c.y + ry * Math.cos(al), c.z + rz * Math.sin(al) * Math.sin(be))
      }))
    }
    partes.grade(Ub)
    partes.aneis(partes.fina, Ub, [3, 5])
    partes.aneis(partes.media, Ub, [0])
    partes.longas(partes.media, Ub, [0, 4, 8, 12]) // os quatro quartos
    partes.longas(partes.fina, Ub, [2, 6, 10, 14])
    for (const be of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      const al = 2.42
      const b = v3(c.x + rx * Math.sin(al) * Math.cos(be), c.y + ry * Math.cos(al), c.z + rz * Math.sin(al) * Math.sin(be))
      const fora = v3(Math.cos(be), 0, Math.sin(be)).multiplyScalar(0.018)
      const pts = [b.clone().add(v3(0, 0.012, 0)), b.clone().add(v3(0, -0.04, 0)).add(fora), b.clone().add(v3(0, -0.092, 0)).addScaledVector(fora, 1.4)]
      const us = Array.from({ length: 7 }, (_, i) => i / 6)
      const raio = (u: number) => (u > 0.86 ? 0.017 * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.86) / 0.14, 2))) + 0.002 : 0.02 - 0.004 * u)
      const Te = tubo(pts, raio, raio, us, 10, 0)
      partes.grade(Te)
      partes.longas(partes.forte, Te, [0, 3, 5, 8])
      partes.aneis(partes.forte, Te, [5])
      partes.aneis(partes.media, Te, [1])
    }
  }

  // ---------------------------------------------------------------- peças de pele por região
  // Cada região vira uma peça com espessura: a face de baixo encosta no corpo, a de cima na casca
  // (a linha de fora, que é a pele). O contorno é uma superelipse no plano dos parâmetros da
  // superfície: cantos arredondados, sem degraus de bloco.
  type Amostra = { p: V; n: V; s: number; t: number }
  const cacheS = new Map<number, Float64Array>()
  const tabelaC = (x: number) => {
    const k = Math.round(x * 4000)
    let S = cacheS.get(k)
    if (!S) {
      S = tabela(k / 4000)
      cacheS.set(k, S)
    }
    return S
  }
  const thDeV = (x: number, v: number) => Math.sign(v) * thDe(tabelaC(x), Math.min(1, Math.abs(v)))
  const amostraCorpo = (x: number, vv: number): Amostra => {
    const v = vv > 1 ? vv - 2 : vv
    const th = thDeV(x, v) || 0
    const p = ponto(x, th, v3())
    const dx = 0.004
    const dt = 0.012
    const a = ponto(Math.min(x + dx, x1), th, v3()).sub(ponto(Math.max(x - dx, x0), th, v3()))
    const b = ponto(x, th + dt, v3()).sub(ponto(x, th - dt, v3()))
    const n = a.cross(b)
    if (n.lengthSq() < 1e-12) n.set(0, 1, 0)
    n.normalize()
    if (n.dot(p.clone().sub(v3(x, yc(x), 0))) < 0) n.negate()
    const S = tabelaC(x)
    return { p, n, s: LdeX(x), t: vv * S[M] }
  }
  const amostraPerna = (pi: InfoPerna, a: number, b: number): Amostra => {
    const s = pi.sJ * (0.03 + 0.97 * a)
    const u = pi.uDeS(s)
    const ph = pi.fase + 2 * Math.PI * (0.035 + 0.93 * b)
    const c = cr(pi.pts, u, v3())
    const T = cr(pi.pts, Math.min(u + 0.004, 1), v3()).sub(cr(pi.pts, Math.max(u - 0.004, 0), v3())).normalize()
    let Fv = v3(0, 0, 1).cross(T)
    if (Fv.lengthSq() < 1e-6) Fv = v3(1, 0, 0)
    Fv.normalize()
    const Lv = T.clone().cross(Fv).normalize()
    const rf = pi.rf(u)
    const rl = pi.rl(u)
    const p = c.clone().addScaledVector(Fv, rf * Math.cos(ph)).addScaledVector(Lv, rl * Math.sin(ph))
    const n = Fv.clone().multiplyScalar(Math.cos(ph) / rf).addScaledVector(Lv, Math.sin(ph) / rl).normalize()
    return { p, n, s, t: (ph - pi.fase) * (rf + rl) * 0.5 }
  }

  const P_SE = 4.2 // expoente da superelipse: 2 = elipse, maior = mais quadrado
  const NR = 16
  const NA = 88
  const KR = 7 // passos do meio-círculo da borda
  const montarPeca = (ilhas: { amostra: (a: number, b: number) => Amostra; esp: number }[]): Peca => {
    const pos: number[] = []
    const nrm: number[] = []
    const uvm: number[] = []
    const lado: number[] = []
    const borda: number[] = []
    const c = v3()
    const nMed = v3()
    let nC = 0
    const tri = (a: [V, V, number, number, number], b: [V, V, number, number, number], d: [V, V, number, number, number]) => {
      for (const [p, n, s, t, l] of [a, b, d]) {
        pos.push(p.x, p.y, p.z)
        nrm.push(n.x, n.y, n.z)
        uvm.push(s, t)
        lado.push(l)
      }
    }
    for (const ilha of ilhas) {
      const G: Amostra[][] = []
      for (let i = 0; i <= NR; i++) {
        const rho = Math.pow(i / NR, 0.72)
        const anel: Amostra[] = []
        for (let j = 0; j < NA; j++) {
          const psi = (2 * Math.PI * j) / NA
          const cc = Math.cos(psi)
          const ss = Math.sin(psi)
          const e = 2 / P_SE
          const a = 0.5 + 0.5 * rho * Math.sign(cc) * Math.pow(Math.abs(cc), e)
          const b = 0.5 + 0.5 * rho * Math.sign(ss) * Math.pow(Math.abs(ss), e)
          anel.push(ilha.amostra(a, b))
        }
        G.push(anel)
      }
      const baixo = 0.004
      const cima = ilha.esp
      type Q = [V, V, number, number, number]
      const em = (A: Amostra, d: number, l: number, fora: boolean): Q => [A.p.clone().addScaledVector(A.n, d), fora ? A.n : A.n.clone().negate(), A.s, A.t, l]
      for (let i = 0; i < NR; i++)
        for (let j = 0; j < NA; j++) {
          const j1 = (j + 1) % NA
          const A = G[i][j]
          const B = G[i + 1][j]
          const C = G[i + 1][j1]
          const D = G[i][j1]
          tri(em(A, cima, 0, true), em(B, cima, 0, true), em(C, cima, 0, true))
          tri(em(A, cima, 0, true), em(C, cima, 0, true), em(D, cima, 0, true))
          tri(em(A, baixo, 1, false), em(C, baixo, 1, false), em(B, baixo, 1, false))
          tri(em(A, baixo, 1, false), em(D, baixo, 1, false), em(C, baixo, 1, false))
        }
      // borda: meio-círculo da face de cima à de baixo, para fora
      const r = (cima - baixo) / 2
      const aro: Q[][] = []
      for (let j = 0; j < NA; j++) {
        const A = G[NR][j]
        const fora = A.p.clone().sub(G[NR - 1][j].p)
        fora.addScaledVector(A.n, -fora.dot(A.n))
        if (fora.lengthSq() < 1e-12) fora.set(1, 0, 0)
        fora.normalize()
        const centro = A.p.clone().addScaledVector(A.n, baixo + r)
        const col: Q[] = []
        for (let k = 0; k <= KR; k++) {
          const f = Math.PI / 2 - (Math.PI * k) / KR
          const nn = A.n.clone().multiplyScalar(Math.sin(f)).addScaledVector(fora, Math.cos(f)).normalize()
          const p = centro.clone().addScaledVector(A.n, r * Math.sin(f)).addScaledVector(fora, r * 1.15 * Math.cos(f))
          col.push([p, nn, A.s, A.t, 0.5])
        }
        aro.push(col)
        const meio = centro.clone().addScaledVector(fora, r * 1.15)
        const prox = G[NR][(j + 1) % NA]
        const foraP = prox.p.clone().sub(G[NR - 1][(j + 1) % NA].p)
        foraP.addScaledVector(prox.n, -foraP.dot(prox.n))
        if (foraP.lengthSq() < 1e-12) foraP.set(1, 0, 0)
        foraP.normalize()
        const meioP = prox.p.clone().addScaledVector(prox.n, baixo + r).addScaledVector(foraP, r * 1.15)
        borda.push(meio.x, meio.y, meio.z, meioP.x, meioP.y, meioP.z)
      }
      for (let j = 0; j < NA; j++) {
        const j1 = (j + 1) % NA
        for (let k = 0; k < KR; k++) {
          tri(aro[j][k], aro[j][k + 1], aro[j1][k + 1])
          tri(aro[j][k], aro[j1][k + 1], aro[j1][k])
        }
      }
      for (const anel of G)
        for (const A of anel) {
          c.add(A.p)
          nMed.add(A.n)
          nC++
        }
    }
    c.multiplyScalar(1 / Math.max(1, nC))
    if (nMed.lengthSq() < 1e-6) nMed.set(0, 1, 0)
    nMed.normalize()
    const f = (a: number[]) => new Float32Array(a)
    return { pos: f(pos), nrm: f(nrm), uvm: f(uvm), lado: f(lado), dir: new Float32Array(0), borda: f(borda), dirBorda: new Float32Array(0), centro: c, normal: nMed }
  }
  const faixa = (xa: number, xb: number, va: number, vb: number) => (a: number, b: number) => amostraCorpo(xa + (xb - xa) * a, va + (vb - va) * b)
  const pecas: Record<RegiaoId, Peca> = {
    pescoco: montarPeca([{ amostra: faixa(X_PESCOCO + 0.012, x1 - 0.006, -0.985, 0.985), esp: CASCA_CORPO }]),
    paleta: montarPeca([{ amostra: faixa(X_PALETA + 0.012, X_PESCOCO - 0.012, -V_BARRIGA + 0.02, V_BARRIGA - 0.02), esp: CASCA_CORPO }]),
    grupao: montarPeca([{ amostra: faixa(x0 + 0.05, X_PALETA - 0.012, -V_BARRIGA + 0.02, V_BARRIGA - 0.02), esp: CASCA_CORPO }]),
    barrigas: montarPeca([{ amostra: faixa(x0 + 0.1, X_PESCOCO - 0.012, V_BARRIGA + 0.02, 2 - V_BARRIGA - 0.02), esp: CASCA_CORPO }]),
    garras: montarPeca(pernasInfo.map((pi) => ({ amostra: (a: number, b: number) => amostraPerna(pi, a, b), esp: CASCA_PERNA }))),
  }

  // boca: onde começa o esôfago
  const boca = pontoCab(0.97, Math.PI)

  // ---------------------------------------------------------------- âncoras dos rótulos
  const ancoras = {} as Record<RegiaoId, { c3: V[]; cp: V[] }>
  for (const r of ['pescoco', 'paleta', 'grupao', 'barrigas'] as RegiaoId[]) {
    const bs = blocos.filter((b) => b.regiao === r)
    const cand: V[] = []
    for (const lado of [1, -1]) {
      const deLado = bs.filter((b) => Math.sign(b.c3.z) === lado || (r === 'pescoco' && Math.abs(b.c3.z) < 1e-6))
      if (!deLado.length) continue
      const m = v3()
      deLado.forEach((b) => m.add(b.c3))
      m.multiplyScalar(1 / deLado.length)
      // o bloco mais perto da média fica na superfície
      let melhor = deLado[0]
      for (const b of deLado) if (b.c3.distanceToSquared(m) < melhor.c3.distanceToSquared(m)) melhor = b
      cand.push(melhor.c3.clone())
    }
    const mp = v3()
    bs.forEach((b) => mp.add(b.cp))
    mp.multiplyScalar(1 / Math.max(1, bs.length))
    ancoras[r] = { c3: cand, cp: [mp] }
  }
  ancoras.garras = { c3: ancGarras3, cp: ancGarrasP }

  // ---------------------------------------------------------------- escala (a vaca é menor)
  const e = F.escala
  const escala3 = (a: Float32Array) => {
    if (e !== 1) for (let i = 0; i < a.length; i++) a[i] *= e
    return a
  }
  const escalaP = (a: Float32Array) => {
    if (e !== 1)
      for (let i = 0; i < a.length; i += 3) {
        a[i] *= e
        a[i + 2] *= e
      }
    return a
  }
  const fim = (l: AcLinhas): Linhas => {
    const r = l.fim()
    escala3(r.p3)
    escalaP(r.pp)
    return r
  }
  const P = partes.fim()
  escala3(P.tri)
  escala3(P.fina)
  escala3(P.media)
  escala3(P.forte)
  for (const b of blocos) {
    b.c3.multiplyScalar(e)
    b.cp.x *= e
    b.cp.z *= e
  }
  for (const r of Object.values(ancoras)) {
    r.c3.forEach((p) => p.multiplyScalar(e))
    r.cp.forEach((p) => {
      p.x *= e
      p.z *= e
    })
  }
  for (const pc of Object.values(pecas)) {
    escala3(pc.pos)
    escala3(pc.borda)
    escala3(pc.uvm)
    pc.centro.multiplyScalar(e)
  }
  // casca: a linha de fora, que marca a pele que vai ao curtume (corpo e garras; a cabeça e as canelas ficam fora)
  const casca = new Float32Array(p3.length)
  for (let i = 0; i < p3.length; i += 3) {
    const d = dc[i / 3]
    casca[i] = (p3[i] + n3[i] * d) * e
    casca[i + 1] = (p3[i + 1] + n3[i + 1] * d) * e
    casca[i + 2] = (p3[i + 2] + n3[i + 2] * d) * e
  }

  return {
    sexo,
    escala: e,
    boca: boca.multiplyScalar(e),
    pecas,
    pele: { p3: escala3(new Float32Array(p3)), pp: escalaP(new Float32Array(pp)), n3: new Float32Array(n3), atraso: new Float32Array(at), reg: new Float32Array(rg), casca },
    blocos,
    nCorpo,
    fina: fim(fina),
    borda: fim(borda),
    media: fim(media),
    contorno: {
      pescoco: fim(contorno.pescoco),
      paleta: fim(contorno.paleta),
      grupao: fim(contorno.grupao),
      barrigas: fim(contorno.barrigas),
      garras: fim(contorno.garras),
    },
    partes: P,
    ancoras,
    cabeca: pontoCab(0.32, 0).multiplyScalar(e),
  }
}
