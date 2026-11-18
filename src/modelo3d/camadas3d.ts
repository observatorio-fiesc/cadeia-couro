// Camadas do couro desenhadas como na pilha da Maya Craft: duas folhas finas e onduladas em cima
// (flor integral e flor lixada) e dois blocos grossos embaixo (raspa e sobras). Contorno de couro:
// cantos arredondados, borda levemente irregular.
import * as THREE from 'three'

type V = THREE.Vector3
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)

export type CamadaGeo = { pos: Float32Array; nrm: Float32Array; lado: Float32Array; linhas: Float32Array; finas: Float32Array }

function rng(semente: number) {
  let s = semente >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// contorno: superelipse com a borda um pouco irregular, como uma peça de couro recortada
function contorno(semente: number, meio: number, p: number) {
  const r = rng(semente)
  const fases = [r() * 6.28, r() * 6.28, r() * 6.28]
  return (psi: number) => {
    const c = Math.cos(psi)
    const s = Math.sin(psi)
    const e = 2 / p
    const irreg = 1 + 0.025 * Math.sin(3 * psi + fases[0]) + 0.018 * Math.sin(7 * psi + fases[1]) + 0.01 * Math.sin(13 * psi + fases[2])
    return [meio * Math.sign(c) * Math.pow(Math.abs(c), e) * irreg, meio * Math.sign(s) * Math.pow(Math.abs(s), e) * irreg]
  }
}

class Ac {
  pos: number[] = []
  nrm: number[] = []
  lado: number[] = []
  linhas: number[] = []
  finas: number[] = []
  tri(a: V, b: V, c: V, na: V, nb: V, nc: V, l: number) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    this.nrm.push(na.x, na.y, na.z, nb.x, nb.y, nb.z, nc.x, nc.y, nc.z)
    this.lado.push(l, l, l)
  }
  seg(alvo: number[], a: V, b: V) {
    alvo.push(a.x, a.y, a.z, b.x, b.y, b.z)
  }
  fim(): CamadaGeo {
    const f = (a: number[]) => new Float32Array(a)
    return { pos: f(this.pos), nrm: f(this.nrm), lado: f(this.lado), linhas: f(this.linhas), finas: f(this.finas) }
  }
}

const NR = 14
const NA = 96

// folha fina e ondulada: as pontas sobem e descem como num couro solto
export function folha(semente: number, meio: number, esp: number, curva: { a: number; fase: number; ponta: number; dirPonta: number }): CamadaGeo {
  const ac = new Ac()
  const borda = contorno(semente, meio, 5)
  const r = rng(semente + 7)
  const f1 = r() * 6.28
  const f2 = r() * 6.28
  const altura = (x: number, z: number) => {
    const u = x / meio
    const w = z / meio
    let y = curva.a * (Math.sin(1.7 * u + f1) * 0.5 + Math.sin(2.3 * w + f2) * 0.5) * 0.5
    // uma ponta levantada e a oposta caída
    const dp = Math.cos(curva.dirPonta) * u + Math.sin(curva.dirPonta) * w
    y += curva.ponta * Math.max(0, dp - 0.25) ** 2 * 1.3 - curva.ponta * 0.5 * Math.max(0, -dp - 0.4) ** 2
    return y
  }
  const ponto = (rho: number, psi: number) => {
    const [bx, bz] = borda(psi)
    const x = bx * rho
    const z = bz * rho
    return v3(x, altura(x, z), z)
  }
  const normal = (p: V) => {
    const h = 0.004
    const dx = (altura(p.x + h, p.z) - altura(p.x - h, p.z)) / (2 * h)
    const dz = (altura(p.x, p.z + h) - altura(p.x, p.z - h)) / (2 * h)
    return v3(-dx, 1, -dz).normalize()
  }
  const G: V[][] = []
  const N: V[][] = []
  for (let i = 0; i <= NR; i++) {
    const rho = Math.pow(i / NR, 0.8)
    const a: V[] = []
    const n: V[] = []
    for (let j = 0; j < NA; j++) {
      const p = ponto(rho, (2 * Math.PI * j) / NA)
      a.push(p)
      n.push(normal(p))
    }
    G.push(a)
    N.push(n)
  }
  const meiaEsp = esp / 2
  const cima = (i: number, j: number) => G[i][j].clone().addScaledVector(N[i][j], meiaEsp)
  const baixo = (i: number, j: number) => G[i][j].clone().addScaledVector(N[i][j], -meiaEsp)
  for (let i = 0; i < NR; i++)
    for (let j = 0; j < NA; j++) {
      const j1 = (j + 1) % NA
      ac.tri(cima(i, j), cima(i + 1, j), cima(i + 1, j1), N[i][j], N[i + 1][j], N[i + 1][j1], 0)
      ac.tri(cima(i, j), cima(i + 1, j1), cima(i, j1), N[i][j], N[i + 1][j1], N[i][j1], 0)
      const m = (v: V) => v.clone().negate()
      ac.tri(baixo(i, j), baixo(i + 1, j1), baixo(i + 1, j), m(N[i][j]), m(N[i + 1][j1]), m(N[i + 1][j]), 1)
      ac.tri(baixo(i, j), baixo(i, j1), baixo(i + 1, j1), m(N[i][j]), m(N[i][j1]), m(N[i + 1][j1]), 1)
    }
  // borda arredondada
  const KR = 5
  const aro: { p: V; n: V }[][] = []
  for (let j = 0; j < NA; j++) {
    const p = G[NR][j]
    const n = N[NR][j]
    const fora = p.clone().sub(G[NR - 1][j])
    fora.addScaledVector(n, -fora.dot(n)).normalize()
    const col: { p: V; n: V }[] = []
    for (let k = 0; k <= KR; k++) {
      const f = Math.PI / 2 - (Math.PI * k) / KR
      col.push({ p: p.clone().addScaledVector(n, meiaEsp * Math.sin(f)).addScaledVector(fora, meiaEsp * 1.2 * Math.cos(f)), n: n.clone().multiplyScalar(Math.sin(f)).addScaledVector(fora, Math.cos(f)).normalize() })
    }
    aro.push(col)
  }
  for (let j = 0; j < NA; j++) {
    const j1 = (j + 1) % NA
    for (let k = 0; k < KR; k++) {
      const a = aro[j][k]
      const b = aro[j][k + 1]
      const c = aro[j1][k + 1]
      const d = aro[j1][k]
      ac.tri(a.p, b.p, c.p, a.n, b.n, c.n, 0.5)
      ac.tri(a.p, c.p, d.p, a.n, c.n, d.n, 0.5)
    }
    ac.seg(ac.linhas, aro[j][0].p, aro[j1][0].p)
    ac.seg(ac.finas, aro[j][KR].p, aro[j1][KR].p)
  }
  return ac.fim()
}

// bloco grosso com cantos arredondados; a face de cima levemente irregular
export function bloco(semente: number, meio: number, esp: number): CamadaGeo {
  const ac = new Ac()
  const borda = contorno(semente, meio, 7)
  const r = rng(semente + 3)
  const f = r() * 6.28
  const sup = (x: number, z: number) => 0.004 * Math.sin(x * 9 + f) * Math.cos(z * 7 - f)
  const topo: V[][] = []
  const fundo: V[][] = []
  for (let i = 0; i <= NR; i++) {
    const rho = Math.pow(i / NR, 0.8)
    const a: V[] = []
    const b: V[] = []
    for (let j = 0; j < NA; j++) {
      const [bx, bz] = borda((2 * Math.PI * j) / NA)
      const x = bx * rho
      const z = bz * rho
      a.push(v3(x, esp / 2 + sup(x, z), z))
      b.push(v3(x, -esp / 2, z))
    }
    topo.push(a)
    fundo.push(b)
  }
  const cimaN = v3(0, 1, 0)
  const baixoN = v3(0, -1, 0)
  for (let i = 0; i < NR; i++)
    for (let j = 0; j < NA; j++) {
      const j1 = (j + 1) % NA
      ac.tri(topo[i][j], topo[i + 1][j], topo[i + 1][j1], cimaN, cimaN, cimaN, 0)
      ac.tri(topo[i][j], topo[i + 1][j1], topo[i][j1], cimaN, cimaN, cimaN, 0)
      ac.tri(fundo[i][j], fundo[i + 1][j1], fundo[i + 1][j], baixoN, baixoN, baixoN, 1)
      ac.tri(fundo[i][j], fundo[i][j1], fundo[i + 1][j1], baixoN, baixoN, baixoN, 1)
    }
  // lados: parede com quina arredondada em cima
  const KR = 4
  const raio = Math.min(0.025, esp * 0.3)
  for (let j = 0; j < NA; j++) {
    const j1 = (j + 1) % NA
    const col = (jj: number) => {
      const p = topo[NR][jj]
      const fora = v3(p.x, 0, p.z).normalize()
      const pts: { p: V; n: V }[] = []
      // arco da quina de cima
      for (let k = 0; k <= KR; k++) {
        const a = (Math.PI / 2) * (1 - k / KR)
        pts.push({ p: p.clone().addScaledVector(fora, -raio + raio * Math.cos(a)).add(v3(0, -raio + raio * Math.sin(a), 0)), n: fora.clone().multiplyScalar(Math.cos(a)).add(v3(0, Math.sin(a), 0)).normalize() })
      }
      const b = fundo[NR][jj]
      pts.push({ p: b.clone(), n: fora.clone() })
      return pts
    }
    const A = col(j)
    const B = col(j1)
    for (let k = 0; k < A.length - 1; k++) {
      ac.tri(A[k].p, A[k + 1].p, B[k + 1].p, A[k].n, A[k + 1].n, B[k + 1].n, k < KR ? 0.5 : 0.6)
      ac.tri(A[k].p, B[k + 1].p, B[k].p, A[k].n, B[k + 1].n, B[k].n, k < KR ? 0.5 : 0.6)
    }
    ac.seg(ac.linhas, A[Math.floor(KR / 2)].p, B[Math.floor(KR / 2)].p)
    ac.seg(ac.finas, A[A.length - 1].p, B[B.length - 1].p)
    if (j % (NA / 8) === 0) ac.seg(ac.finas, A[KR].p, A[A.length - 1].p)
  }
  return ac.fim()
}
