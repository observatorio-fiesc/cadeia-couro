// Posições do cone da oferta: a Viposa no topo; etapas, insumos, materiais e matérias-primas em anéis cada vez
// mais largos para baixo (mesma lógica do cone do painel de defesa). Dentro de cada anel, cada elo vai para perto
// do ângulo médio dos elos que dependem dele (heurística baricêntrica), o que agrupa famílias e reduz cruzamentos.

import type { Cadeia, No } from '../dados/cadeia'

export type Ponto = { x: number; y: number; z: number; ang: number; raio: number }
export type Anel = { chave: string; camada: number; y: number; raio: number; n: number }

export const DY = 1.9
const TAU = Math.PI * 2
const ORDEM_ETAPAS = [
  'sis.pele', 'sis.ribeira', 'sis.curtimento', 'sis.classificacao', 'sis.recurtimento',
  'sis.acabamento', 'sis.manufatura', 'sis.utilidades', 'sis.transporte',
]
const normaliza = (a: number) => ((a % TAU) + TAU) % TAU
export const yCamada = (c: number) => (2 - c) * DY

function raioAnel(camada: number, n: number) {
  if (camada === 0) return 0
  return Math.max(1.2 + camada * 1.25, (n * 0.6) / TAU)
}

function mediaCircular(angs: number[]) {
  let sx = 0
  let sy = 0
  for (const a of angs) {
    sx += Math.cos(a)
    sy += Math.sin(a)
  }
  return sx === 0 && sy === 0 ? NaN : Math.atan2(sy, sx)
}

export function calcularCone(c: Cadeia) {
  const nos = c.nos.filter((n) => n.lado !== 'demanda')
  const ids = new Set(nos.map((n) => n.id))
  const arestasIdx: number[] = []
  const dependentes = new Map<string, string[]>()
  c.arestas.forEach((a, i) => {
    if (!ids.has(a.de) || !ids.has(a.para)) return
    arestasIdx.push(i)
    if (a.tipo === 'visual') return
    if (!dependentes.has(a.de)) dependentes.set(a.de, [])
    dependentes.get(a.de)!.push(a.para)
  })
  const pos = new Map<string, Ponto>()
  const aneis: Anel[] = []
  const colocar = (anel: No[], pref: (n: No) => number) => {
    if (!anel.length) return
    const camada = anel[0].camada
    const y = yCamada(camada)
    const raio = raioAnel(camada, anel.length)
    const lista = anel.map((n) => ({ n, p: pref(n) }))
    lista.sort((a, b) => (isNaN(a.p) ? 99 : normaliza(a.p)) - (isNaN(b.p) ? 99 : normaliza(b.p)) || a.n.tronco.localeCompare(b.n.tronco))
    const passo = TAU / lista.length
    let sx = 0
    let sy = 0
    lista.forEach((e, i) => {
      if (!isNaN(e.p)) {
        sx += Math.cos(e.p - i * passo)
        sy += Math.sin(e.p - i * passo)
      }
    })
    const desloc = sx || sy ? Math.atan2(sy, sx) : 0
    lista.forEach((e, i) => {
      const ang = desloc + i * passo
      pos.set(e.n.id, { x: raio * Math.cos(ang), y, z: raio * Math.sin(ang), ang, raio })
    })
    aneis.push({ chave: `c${camada}`, camada, y, raio, n: anel.length })
  }
  const doAnel = (camada: number) => nos.filter((n) => (camada === 0 ? n.lado === 'nucleo' : n.lado === 'oferta' && n.camada === camada))
  colocar(doAnel(0), () => 0)
  const etapas = doAnel(1)
  colocar(etapas, (n) => {
    const i = ORDEM_ETAPAS.indexOf(n.id)
    return ((i < 0 ? 99 : i) / etapas.length) * TAU
  })
  for (const camada of [2, 3, 4]) {
    colocar(doAnel(camada), (n) => mediaCircular((dependentes.get(n.id) ?? []).filter((d) => pos.has(d)).map((d) => pos.get(d)!.ang)))
  }
  return { pos, aneis, nos, arestasIdx }
}
