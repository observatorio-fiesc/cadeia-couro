// O que mantém o animal: um mapa leve dos órgãos (estômagos, esôfago, intestino grosso, coração). O que o
// gado come e os adubos ficam no cone pequeno sob o animal (Mistura.tsx). As posições seguem a anatomia
// de longe, sem pretensão de exatidão: o desenho mostra o que pesa, não o detalhe.
import * as THREE from 'three'
import { AcPartes, tubo, type Sexo } from './forma'

type V = THREE.Vector3
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)

export type OrgaoGeo = { id: string; tri: Float32Array; nrm: Float32Array; centro: V; raio: number }
export type Interior = { orgaos: OrgaoGeo[]; rumen: { c: V; r: V } }

// bolha: elipsoide com lóbulos (protuberâncias suaves em direções dadas)
function bolha(c: V, r: V, lobos: { d: V; a: number; s: number }[], nI = 22, nK = 30) {
  const P: V[][] = []
  for (let i = 0; i <= nI; i++) {
    const th = 0.0001 + ((Math.PI - 0.0002) * i) / nI
    const anel: V[] = []
    for (let k = 0; k <= nK; k++) {
      const ph = (2 * Math.PI * k) / nK
      const d = v3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph))
      let f = 1
      for (const l of lobos) {
        const dd = d.distanceToSquared(l.d)
        f += l.a * Math.exp(-dd / (2 * l.s * l.s))
      }
      anel.push(v3(c.x + r.x * d.x * f, c.y + r.y * d.y * f, c.z + r.z * d.z * f))
    }
    P.push(anel)
  }
  return P
}

export function gerarInterior(sexo: Sexo, escala: number): Interior {
  const orgaos: OrgaoGeo[] = []
  const add = (id: string, malhas: V[][][], centro: V, raio: number) => {
    const ac = new AcPartes()
    for (const P of malhas) ac.grade(P)
    const f = ac.fim()
    orgaos.push({ id, tri: f.tri, nrm: f.nrm, centro, raio })
  }
  const vaca = sexo === 'vaca'
  const dy = vaca ? -0.02 : 0
  // rúmen: o maior, do lado esquerdo do abdome, com saco dorsal e ventral
  const rc = v3(-0.12, 0.97 + dy, 0.05)
  const rr = v3(0.37, 0.25, 0.2)
  add(
    'rumen',
    [bolha(rc, rr, [
      { d: v3(-0.6, 0.75, 0).normalize(), a: 0.1, s: 0.45 },
      { d: v3(-0.7, -0.65, 0).normalize(), a: 0.12, s: 0.45 },
      { d: v3(1, 0, 0), a: -0.08, s: 0.35 },
    ])],
    rc,
    0.38,
  )
  const ret = v3(0.27, 0.86 + dy, 0.03)
  add('reticulo', [bolha(ret, v3(0.1, 0.1, 0.11), [])], ret, 0.12)
  const oma = v3(0.17, 0.93 + dy, -0.09)
  add('omaso', [bolha(oma, v3(0.078, 0.078, 0.078), [], 16, 22)], oma, 0.09)
  const ab = [v3(0.25, 0.79 + dy, -0.07), v3(0.13, 0.73 + dy, -0.13), v3(-0.04, 0.71 + dy, -0.15), v3(-0.22, 0.75 + dy, -0.13)]
  add('abomaso', [tubo(ab, (u) => 0.055 - 0.02 * u, (u) => 0.05 - 0.018 * u, Array.from({ length: 19 }, (_, i) => i / 18), 16)], ab[2], 0.12)
  const es = [v3(1.27, 0.95, 0), v3(1.12, 1.04, 0), v3(0.9, 1.1, 0), v3(0.66, 1.07, 0), v3(0.46, 1.0 + dy, 0.01), v3(0.3, 0.95 + dy, 0.03)]
  add('esofago', [tubo(es, () => 0.021, () => 0.021, Array.from({ length: 31 }, (_, i) => i / 30), 10)], es[3], 0.1)
  const ig = [v3(-0.22, 0.76 + dy, -0.13), v3(-0.38, 0.84 + dy, -0.17), v3(-0.5, 0.98 + dy, -0.14), v3(-0.63, 1.1, -0.08), v3(-0.8, 1.19, -0.03), v3(-0.95, 1.2, 0)]
  add('intestino', [tubo(ig, () => 0.036, () => 0.033, Array.from({ length: 33 }, (_, i) => i / 32), 12)], ig[2], 0.12)
  const co = v3(0.53, 0.87 + dy, 0)
  const ao = [v3(0.53, 0.97 + dy, 0), v3(0.51, 1.12, 0), v3(0.43, 1.22, 0), v3(0.2, 1.25, 0), v3(-0.2, 1.24, 0), v3(-0.6, 1.2, 0)]
  add(
    'coracao',
    [
      bolha(co, v3(0.085, 0.115, 0.08), [{ d: v3(0.4, -0.9, 0).normalize(), a: 0.22, s: 0.4 }], 18, 24),
      tubo(ao, () => 0.016, () => 0.016, Array.from({ length: 31 }, (_, i) => i / 30), 8),
    ],
    co,
    0.11,
  )

  // escala do animal
  const e = escala
  const esc = (a: Float32Array) => {
    if (e !== 1) for (let i = 0; i < a.length; i++) a[i] *= e
    return a
  }
  for (const o of orgaos) {
    esc(o.tri)
    o.centro.multiplyScalar(e)
    o.raio *= e
  }
  return { orgaos, rumen: { c: rc.clone().multiplyScalar(e), r: rr.clone().multiplyScalar(e) } }
}
