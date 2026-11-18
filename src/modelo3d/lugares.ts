// Onde cada coisa fica na cena e como a câmera a enquadra. No sistema do boi e da vaca, tudo sai dos
// animais e fica perto deles: a região escolhida no corpo, o gráfico ao lado, a pilha de camadas à frente
// do animal. O sapato é outro sistema: a bota aparece no meio da cena, com os animais fora de vista.
// Escolher é levar a câmera até lá; nada sai do lugar.
import * as THREE from 'three'
import type { Modelo, RegiaoId, Sexo } from './forma'
import { v3 } from './cena'

export const FLUTUA = 0.42 // os animais flutuam sobre a grade
export const CASA: Record<Sexo, THREE.Vector3> = { boi: v3(-1.08, FLUTUA, -0.62), vaca: v3(1.02, FLUTUA, 0.6) }

export const BOTA = v3(-0.45, 0.62, 0.35) // planta do pé da bota, no meio da cena (os animais saem de vista)
/** A pilha de camadas, ao lado do animal: à frente dele, na altura do lombo. */
export const lugarPilha = (s: Sexo) => CASA[s].clone().add(v3(-0.05, 1.02, 1.32))

export type Estacao = 'fazenda' | 'bota'
export const ESTACOES: Estacao[] = ['fazenda', 'bota']

export const FOV = 36
// o quadro de decomposição ocupa a esquerda (Deslocamento leva o centro da cena para a direita)
export const DESLOC_PX = 175
export const largo = (w: number) => w >= 900
export const GRAF_ALTURA = 1.05

// camadas do couro na pilha (de cima para baixo), com folga entre elas
export const MEIO_CAMADA = 0.37
export const MEIO_PILHA = MEIO_CAMADA * Math.SQRT2 // a pilha gira 45 graus: meia largura na tela

export type Enquadramento = { pos: THREE.Vector3; alvo: THREE.Vector3 }
export const CAM_GERAL: Enquadramento = { pos: v3(1.15, 2.75, 6.6), alvo: v3(0.0, 1.1, 0) }

/** Um enquadramento a partir do alvo, de uma direção e de uma distância. */
export const olhar = (alvo: THREE.Vector3, dir: THREE.Vector3, d: number): Enquadramento => ({ alvo, pos: alvo.clone().addScaledVector(dir.clone().normalize(), d) })

// ---------------------------------------------------------------- região da pele, no lugar
export type Quadro = { centro: THREE.Vector3; direita: number; raio: number }
export function quadroPeca(m: Modelo, s: Sexo, r: RegiaoId): Quadro {
  const pc = m.pecas[r]
  let direita = 0
  let raio = 0
  for (let i = 0; i < pc.pos.length; i += 3) {
    const dx = pc.pos[i] - pc.centro.x
    const dy = pc.pos[i + 1] - pc.centro.y
    const dz = pc.pos[i + 2] - pc.centro.z
    if (dx > direita) direita = dx
    const d = Math.hypot(dx, dy, dz)
    if (d > raio) raio = d
  }
  return { centro: CASA[s].clone().add(pc.centro), direita, raio }
}
/** O gráfico da química ao lado da região: à direita dela e à frente do corpo. */
export const baseGrafRegiao = (q: Quadro) => q.centro.clone().add(v3(q.direita + 0.4, 0.05, 0.55))

// de onde se vê cada região: de frente e um pouco de cima; a barriga e as patas, mais de lado
const DIR_REGIAO: Record<RegiaoId, THREE.Vector3> = {
  pescoco: v3(0.2, 0.32, 1),
  paleta: v3(0.12, 0.32, 1),
  grupao: v3(0.05, 0.45, 1),
  barrigas: v3(0.12, 0.02, 1),
  garras: v3(0.12, 0.12, 1),
}

/**
 * Um conjunto (de x0 a x1 no mundo, com meia altura) e o gráfico ao lado cabem na área livre da tela,
 * como o enquadramento do visualizador do submarino: à esquerda fica o quadro de decomposição, à direita
 * os nomes do gráfico, em cima o título, embaixo a faixa de controles.
 */
export function enquadrarFaixa(x0: number, x1: number, meiaAltura: number, y: number, z: number, dir: THREE.Vector3, W: number, H: number, nomesADireita = true): Enquadramento {
  const tg = Math.tan(THREE.MathUtils.degToRad(FOV) / 2)
  const L = largo(W)
  const esq = L ? 370 : 20
  const dirPx = L && nomesADireita ? 330 : 40
  const topo = 90
  const base = 90
  const dLargura = ((x1 - x0) * 1.08 * H) / ((W - esq - dirPx) * 2 * tg)
  const dAltura = (2 * meiaAltura * 1.12 * H) / ((H - topo - base) * 2 * tg)
  const d = Math.max(dLargura, dAltura, 1.6)
  const porPx = (2 * d * tg) / H
  // o alvo cai em W/2 + DESLOC_PX na tela; o meio da área livre fica em (esq + W − dirPx) / 2
  const ondeCai = W / 2 + (L ? DESLOC_PX : 0)
  const meioLivre = (esq + W - dirPx) / 2
  return olhar(v3((x0 + x1) / 2 + (ondeCai - meioLivre) * porPx, y, z), dir, d)
}

export function enquadrarRegiao(q: Quadro, r: RegiaoId, W: number, H: number) {
  const g = baseGrafRegiao(q)
  return enquadrarFaixa(q.centro.x - q.raio, g.x + 0.1, Math.max(q.raio, GRAF_ALTURA / 2 + 0.08), q.centro.y, q.centro.z + 0.3, DIR_REGIAO[r], W, H)
}

export const baseGrafPilha = (s: Sexo) => lugarPilha(s).add(v3(MEIO_PILHA + 0.42, 0, 0))
export function enquadrarPilha(s: Sexo, W: number, H: number) {
  const p = lugarPilha(s)
  const g = baseGrafPilha(s)
  // à esquerda, o lugar dos nomes das camadas
  return enquadrarFaixa(p.x - MEIO_PILHA - 0.7, g.x + 0.1, 0.8, p.y, p.z, v3(0.1, 0.3, 1), W, H)
}
