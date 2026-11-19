// O chão do mapa-múndi da aba Mercado externo, como o Centro de comando do painel-comandante (atlas):
// projeção equirretangular centrada no Brasil, deitada no chão (+X a leste, −Z ao norte), e um chão que
// se curva com a distância à câmera, como a Terra vista do alto (atlas/src/brasil/scene/bend.ts).
import * as THREE from 'three'

export const MAP_Y = 0
const K = 0.11 // unidades por grau
const LAT0 = -14.2
const LON0 = -53.1
const COS0 = Math.cos((LAT0 * Math.PI) / 180)

/** Do lon, lat ao chão (x, z). */
export const chao = (lon: number, lat: number): [number, number] => [(lon - LON0) * COS0 * K, -(lat - LAT0) * K]
/** Do chão (x, z) ao lon, lat. */
export const doChao = (x: number, z: number): [number, number] => [x / (COS0 * K) + LON0, -z / K + LAT0]
export const ponto = (lon: number, lat: number, h = 0) => {
  const [x, z] = chao(lon, lat)
  return new THREE.Vector3(x, MAP_Y + h, z)
}

/* ---------- a curva do chão ---------- */

/** Quanto o chão desce com o quadrado da distância à câmera, no plano. */
export const CURVA = 0.004

/**
 * Os materiais do three que levam `defines: DEF_CURVA` passam a projeção pela curva; os outros (o boi, o cone)
 * não mudam. Uma vez só, antes de qualquer compilação.
 */
export const DEF_CURVA = { CURVA: CURVA.toFixed(6) }
const MARCA = '/* curva do chão */'
if (!THREE.ShaderChunk.project_vertex.includes(MARCA)) {
  THREE.ShaderChunk.project_vertex = THREE.ShaderChunk.project_vertex.replace(
    'mvPosition = modelViewMatrix * mvPosition;',
    `${MARCA}
#ifdef CURVA
  mvPosition = modelMatrix * mvPosition;
  { vec2 dCurva = mvPosition.xz - cameraPosition.xz; mvPosition.y -= CURVA * dot(dCurva, dCurva); }
  mvPosition = viewMatrix * mvPosition;
#else
  mvPosition = modelViewMatrix * mvPosition;
#endif`,
  )
}

/** A função da curva, para os shaders próprios (com `defines: DEF_CURVA`). */
export const GLSL_CURVA = /* glsl */ `
vec4 curvar(vec4 w) {
  vec2 d = w.xz - cameraPosition.xz;
  w.y -= CURVA * dot(d, d);
  return w;
}
`

/** Os traços do drei (`Line`, LineMaterial da three-stdlib): os dois extremos de cada segmento passam pela curva. */
export function curvarLinha(m: THREE.Material) {
  const mat = m as THREE.ShaderMaterial
  if (mat.userData.curvado) return
  mat.userData.curvado = true
  mat.defines = { ...(mat.defines ?? {}), ...DEF_CURVA }
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader =
      GLSL_CURVA +
      sh.vertexShader
        .replace('modelViewMatrix * vec4( instanceStart, 1.0 )', 'viewMatrix * curvar( modelMatrix * vec4( instanceStart, 1.0 ) )')
        .replace('modelViewMatrix * vec4( instanceEnd, 1.0 )', 'viewMatrix * curvar( modelMatrix * vec4( instanceEnd, 1.0 ) )')
  }
  mat.customProgramCacheKey = () => 'curva-linha'
  mat.needsUpdate = true
}

/** Um ponto onde a curva o põe, visto de `olho` (no lugar). */
export function curvarPonto(p: THREE.Vector3, olho: THREE.Vector3) {
  const dx = p.x - olho.x
  const dz = p.z - olho.z
  p.y -= CURVA * (dx * dx + dz * dz)
  return p
}

/**
 * Onde um raio do olho encontra o chão curvo na altura `y` (em `out`, plano: o ponto do chão que ele mostra).
 * Pelo raio, o chão curvo fica em y − CURVA·t²·(dx² + dz²): a raiz menor de uma equação do segundo grau.
 */
export function noChao(raio: THREE.Ray, y: number, out: THREE.Vector3) {
  const { origin: o, direction: d } = raio
  const a = CURVA * (d.x * d.x + d.z * d.z)
  const b = d.y
  const c = o.y - y
  let t: number
  if (a < 1e-12) t = -c / b
  else {
    const disc = b * b - 4 * a * c
    if (disc < 0) return false
    t = (-b - Math.sqrt(disc)) / (2 * a)
    if (t < 0) t = (-b + Math.sqrt(disc)) / (2 * a)
  }
  if (!(t > 0)) return false
  out.set(o.x + d.x * t, y, o.z + d.z * t)
  return true
}

const aqui = new THREE.Vector3()
/** Para o `Html` do drei: o rótulo onde a curva põe a âncora, em pixels da tela. */
export const htmlCurvo = (el: THREE.Object3D, camera: THREE.Camera, size: { width: number; height: number }) => {
  aqui.setFromMatrixPosition(el.matrixWorld)
  curvarPonto(aqui, camera.position).project(camera)
  return [((aqui.x + 1) / 2) * size.width, ((1 - aqui.y) / 2) * size.height]
}

/**
 * Triângulos (x, y, z planos, três pontos cada) divididos até nenhuma aresta passar de `aresta`: um preenchimento
 * grande acompanha a curva em vez de ficar como uma corda plana sobre ela.
 */
export function triangulosFinos(pos: number[], aresta = 0.5): number[] {
  const out: number[] = []
  const max2 = aresta * aresta
  const dividir = (a: number[], b: number[], c: number[], prof: number) => {
    const d2 = (p: number[], q: number[]) => (p[0] - q[0]) ** 2 + (p[2] - q[2]) ** 2
    if (prof > 7 || Math.max(d2(a, b), d2(b, c), d2(c, a)) <= max2) return void out.push(...a, ...b, ...c)
    const meio = (p: number[], q: number[]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]
    const [ab, bc, ca] = [meio(a, b), meio(b, c), meio(c, a)]
    dividir(a, ab, ca, prof + 1)
    dividir(ab, b, bc, prof + 1)
    dividir(ca, bc, c, prof + 1)
    dividir(ab, bc, ca, prof + 1)
  }
  for (let i = 0; i + 8 < pos.length; i += 9) dividir(pos.slice(i, i + 3), pos.slice(i + 3, i + 6), pos.slice(i + 6, i + 9), 0)
  return out
}

/** O mundo inteiro no chão, numa malha de 1° (acompanha a curva), com uv a partir do canto noroeste. */
export function malhaMundo(y: number, passo = 1) {
  const nx = 360 / passo
  const ny = 180 / passo
  const pos: number[] = []
  const uv: number[] = []
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const [x, z] = chao(-180 + i * passo, 90 - j * passo)
      pos.push(x, y, z)
      uv.push(i / nx, j / ny)
    }
  const idx: number[] = []
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i
      idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

/** Ponto dentro de um anel [lon, lat, lon, lat, …] (regra par-ímpar). */
export function dentroDoAnel(lon: number, lat: number, anel: number[]) {
  let dentro = false
  for (let i = 0, j = anel.length - 2; i < anel.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [anel[i], anel[i + 1], anel[j], anel[j + 1]]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}
