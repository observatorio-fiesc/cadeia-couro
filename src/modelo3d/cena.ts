// Peças comuns da cena da aba Modelo 3D: traço de largura em pixels, amortecimento e ritmo das transições.
import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { matPreparo } from './materiais'

export const BRANCO = '#f6f1e7'
export const MENOS_MOVIMENTO = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
// aceleração e frenagem suaves, como as transformações do painel da Marinha
export const flui = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
export const linear = (x: number, alvo: number, passo: number) => (Math.abs(alvo - x) <= passo ? alvo : x + Math.sign(alvo - x) * passo)
export const expo = (x: number, alvo: number, dt: number, taxa: number) => {
  const r = x + (alvo - x) * (1 - Math.exp(-dt * taxa))
  return Math.abs(alvo - r) < 0.002 ? alvo : r
}

// ritmo das transições, na gramática do visualizador do submarino (painel-comandante)
export const TAXA_FADE = 5 // o que entra ou sai de foco
export const TAXA_LINHAS = 4 // as curvas de nível entram depois que a câmera começa a chegar
export const TAXA_LINHAS_SAI = 9
export const SUAVE_CAMERA = MENOS_MOVIMENTO ? 0.1 : 0.6 // smoothTime do camera-controls
// o que não está escolhido recua para perto deste traço (o visualizador usa 0,11 contra 0,95)
export const RECUO_ANIMAL = 0.18
export const RECUO_CORPO = 0.32
export const RECUO_INTERIOR = 0.45
export const RECUO_ITEM = 0.25

// larguras do traço (px): o contorno principal mais firme, o detalhe fino
export const LARG = { contorno: 2.3, forte: 2.6, media: 1.4, fina: 1, curva: 1.15 }

// ---------------------------------------------------------------- traço grosso (linhas de largura em pixels)
export type Traco = { obj: LineSegments2; arr: Float32Array; mat: LineMaterial; base: number }
export function traco(pos: Float32Array, largura: number, cor: string, opacidade: number, ordem: number, o: { escondido?: boolean; semProfundidade?: boolean; tracejado?: [number, number] } = {}): Traco {
  const arr = new Float32Array(pos)
  const g = new LineSegmentsGeometry()
  g.setPositions(arr)
  const mat = new LineMaterial({ color: new THREE.Color(cor).getHex(), linewidth: largura, transparent: true, opacity: opacidade, depthWrite: false })
  if (o.escondido) {
    // a parte de trás do corpo: tracejada, como linha oculta em desenho técnico
    mat.depthFunc = THREE.GreaterDepth
    mat.dashed = true
    mat.dashSize = 0.022
    mat.gapSize = 0.018
  }
  if (o.tracejado) {
    mat.dashed = true
    mat.dashSize = o.tracejado[0]
    mat.gapSize = o.tracejado[1]
  }
  if (o.semProfundidade) mat.depthTest = false
  const obj = new LineSegments2(g, mat)
  if (o.escondido || o.tracejado) obj.computeLineDistances()
  obj.frustumCulled = false
  obj.renderOrder = ordem
  return { obj, arr, mat, base: opacidade }
}
export function useResolucao(materiais: LineMaterial[]) {
  const size = useThree((s) => s.size)
  useEffect(() => {
    for (const m of materiais) m.resolution.set(size.width, size.height)
  }, [size, materiais])
}

/** Superfície em curvas de nível com um passe de profundidade: só a face da frente aparece. */
export function superficie(g: THREE.BufferGeometry, mat: THREE.ShaderMaterial, ordem: number) {
  const prep = new THREE.Mesh(g, matPreparo(false))
  prep.renderOrder = ordem - 0.5
  const mesh = new THREE.Mesh(g, mat)
  mesh.renderOrder = ordem
  return { prep, mesh, mat }
}

/** Nível de foco amortecido de cada item de uma estação: 1 em repouso, recua quando outro é o escolhido. */
export function useFocos(ids: string[]) {
  return useMemo(() => new Map(ids.map((id) => [id, 1])), [ids])
}
export function focoDe(mapa: Map<string, number>, id: string, sel: string | null, hover: string | null, d: number) {
  const alvo = sel ? (id === sel ? 1 : RECUO_ITEM) : hover && hover !== id ? 0.55 : 1
  const v = expo(mapa.get(id) ?? alvo, alvo, d, TAXA_FADE * 1.6)
  mapa.set(id, v)
  return v
}

