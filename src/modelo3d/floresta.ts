// Tabuleiro de floresta sob os animais: no lugar da grade do submarino, um chão com mata nas bordas.
// Só traço branco e preenchimento escuro, com árvores baixas para não roubar a cena.
import * as THREE from 'three'

export const TABULEIRO = { x0: -2.9, x1: 2.9, z0: -2.25, z1: 2.25, esp: 0.14 }

export type Floresta = {
  tri: Float32Array
  nrm: Float32Array
  arvores: Float32Array // linhas das árvores
  bordas: Float32Array // contorno do tabuleiro
  solo: Float32Array // camadas do solo nos lados
  grade: Float32Array // grade fina do chão
}

function sorteio(semente: number) {
  let s = semente >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function gerarFloresta(): Floresta {
  const { x0, x1, z0, z1, esp } = TABULEIRO
  const tri: number[] = []
  const nrm: number[] = []
  const arv: number[] = []
  const bordas: number[] = []
  const solo: number[] = []
  const grade: number[] = []
  const seg = (alvo: number[], a: number[], b: number[]) => alvo.push(a[0], a[1], a[2], b[0], b[1], b[2])
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[]) => {
    for (const p of [a, b, c, a, c, d]) {
      tri.push(p[0], p[1], p[2])
      nrm.push(n[0], n[1], n[2])
    }
  }

  // tabuleiro
  quad([x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], [0, 1, 0])
  quad([x0, -esp, z1], [x1, -esp, z1], [x1, 0, z1], [x0, 0, z1], [0, 0, 1])
  quad([x0, -esp, z0], [x0, -esp, z1], [x0, 0, z1], [x0, 0, z0], [-1, 0, 0])
  quad([x1, -esp, z1], [x1, -esp, z0], [x1, 0, z0], [x1, 0, z1], [1, 0, 0])
  quad([x1, -esp, z0], [x0, -esp, z0], [x0, 0, z0], [x1, 0, z0], [0, 0, -1])
  const cantos = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]
  for (let i = 0; i < 4; i++) {
    const [ax, az] = cantos[i]
    const [bx, bz] = cantos[(i + 1) % 4]
    seg(bordas, [ax, 0, az], [bx, 0, bz])
    seg(solo, [ax, -esp, az], [bx, -esp, bz])
    seg(solo, [ax, -esp * 0.45, az], [bx, -esp * 0.45, bz])
    seg(bordas, [ax, 0, az], [ax, -esp, az])
  }
  for (let x = x0 + 0.3; x < x1 - 0.01; x += 0.3) seg(grade, [x, 0.001, z0], [x, 0.001, z1])
  for (let z = z0 + 0.3; z < z1 - 0.01; z += 0.3) seg(grade, [x0, 0.001, z], [x1, 0.001, z])

  // árvores: só na faixa das bordas, fora da clareira dos animais
  const r = sorteio(20261119)
  const passo = 0.2
  for (let x = x0 + 0.14; x < x1; x += passo)
    for (let z = z0 + 0.14; z < z1; z += passo) {
      const px = x + (r() - 0.5) * 0.16
      const pz = z + (r() - 0.5) * 0.16
      const borda = Math.min(px - x0, x1 - px, pz - z0, z1 - pz)
      if (borda < 0.08) continue
      const clareira = ((px - 0.05) / 2.2) ** 2 + (pz / 1.7) ** 2
      if (clareira < 1) continue
      if (borda > 0.42 + r() * 0.22) continue
      if (r() < 0.3) continue
      const pinheiro = r() < 0.62
      const h = pinheiro ? 0.24 + r() * 0.22 : 0.3 + r() * 0.26
      if (pinheiro) pinheiroEm(px, pz, h, arv, tri, nrm)
      else eucaliptoEm(px, pz, h, arv, tri, nrm)
    }

  const f = (a: number[]) => new Float32Array(a)
  return { tri: f(tri), nrm: f(nrm), arvores: f(arv), bordas: f(bordas), solo: f(solo), grade: f(grade) }
}

function pinheiroEm(x: number, z: number, h: number, linhas: number[], tri: number[], nrm: number[]) {
  linhas.push(x, 0, z, x, h * 0.16, z)
  const K = 7
  for (let i = 0; i < 3; i++) {
    const yb = h * (0.14 + 0.2 * i)
    const ya = yb + h * (0.42 - 0.05 * i)
    const raio = h * (0.23 - 0.05 * i)
    const ap = new THREE.Vector3(x, ya, z)
    const anel = Array.from({ length: K + 1 }, (_, k) => {
      const a = (2 * Math.PI * k) / K + i * 0.4
      return new THREE.Vector3(x + raio * Math.cos(a), yb, z + raio * Math.sin(a))
    })
    for (let k = 0; k < K; k++) {
      linhas.push(anel[k].x, anel[k].y, anel[k].z, anel[k + 1].x, anel[k + 1].y, anel[k + 1].z)
      if (k % 2 === 0) linhas.push(anel[k].x, anel[k].y, anel[k].z, ap.x, ap.y, ap.z)
      const n = anel[k].clone().add(anel[k + 1]).multiplyScalar(0.5).sub(new THREE.Vector3(x, yb, z)).setY(raio * 0.6).normalize()
      for (const p of [anel[k], anel[k + 1], ap]) {
        tri.push(p.x, p.y, p.z)
        nrm.push(n.x, n.y, n.z)
      }
    }
  }
}

function eucaliptoEm(x: number, z: number, h: number, linhas: number[], tri: number[], nrm: number[]) {
  linhas.push(x, 0, z, x, h * 0.5, z)
  const cy = h * 0.7
  const rx = h * 0.17
  const ry = h * 0.27
  const NA = 6
  const K = 8
  const P: THREE.Vector3[][] = []
  for (let i = 0; i <= NA; i++) {
    const a = (Math.PI * i) / NA
    P.push(Array.from({ length: K + 1 }, (_, k) => {
      const b = (2 * Math.PI * k) / K
      return new THREE.Vector3(x + rx * Math.sin(a) * Math.cos(b), cy + ry * Math.cos(a), z + rx * Math.sin(a) * Math.sin(b))
    }))
  }
  for (const i of [2, 4]) for (let k = 0; k < K; k++) linhas.push(P[i][k].x, P[i][k].y, P[i][k].z, P[i][k + 1].x, P[i][k + 1].y, P[i][k + 1].z)
  for (const k of [0, 2, 4, 6]) for (let i = 0; i < NA; i++) linhas.push(P[i][k].x, P[i][k].y, P[i][k].z, P[i + 1][k].x, P[i + 1][k].y, P[i + 1][k].z)
  const c = new THREE.Vector3(x, cy, z)
  for (let i = 0; i < NA; i++)
    for (let k = 0; k < K; k++)
      for (const p of [P[i][k], P[i + 1][k], P[i + 1][k + 1], P[i][k], P[i + 1][k + 1], P[i][k + 1]]) {
        const n = p.clone().sub(c).normalize()
        tri.push(p.x, p.y, p.z)
        nrm.push(n.x, n.y, n.z)
      }
}
