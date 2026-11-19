// Onde cada coisa fica na cena e como a câmera a enquadra. No sistema do boi e da vaca, tudo sai dos
// animais e fica perto deles: a região escolhida no corpo, o gráfico ao lado, a pilha de camadas à frente
// do animal. O sapato é outro sistema: a bota aparece no meio da cena, com os animais fora de vista.
// Escolher é levar a câmera até lá; nada sai do lugar.
//
// Uma vista só: a câmera olha a cena sempre do mesmo lado, um pouco de cima e de viés (a vista geral,
// com a vaca à esquerda e o boi à direita). Todo enquadramento e todo deslocamento ("à direita de",
// "à frente de") são escritos na base dessa vista (naVista), então nenhuma transição dá a volta na cena.
// O usuário não move a câmera: ela só anda quando algo é escolhido.
import * as THREE from 'three'
import type { Modelo, RegiaoId, Sexo } from './forma'
import { v3 } from './cena'

// ---------------------------------------------------------------- a vista
/** A vista geral: de trás e do lado da cabeça dos animais, um pouco de cima. */
export const CAM_GERAL = { pos: v3(2.675, 2.441, -4.6), alvo: v3(0, 1.05, 0) }
/** O giro da vista em volta do eixo vertical: leva a frente de um desenho (+z) para o lado da câmera. */
export const GIRO_VISTA = Math.atan2(0.5, -0.86)
const EIXO_Y = new THREE.Vector3(0, 1, 0)
/**
 * A vista geral numa tela de qualquer proporção: foi acertada numa tela de 1843 × 847; numa tela mais
 * estreita, a câmera recua na mesma direção, para a vaca não entrar sob o quadro de decomposição.
 */
export function vistaGeral(W: number, H: number) {
  const dir = CAM_GERAL.pos.clone().sub(CAM_GERAL.alvo)
  const recua = Math.max(1, 1843 / 847 / (W / H))
  return { alvo: CAM_GERAL.alvo.clone(), pos: CAM_GERAL.alvo.clone().addScaledVector(dir, recua) }
}
/** Um vetor escrito na base da vista: x para a direita da tela, y para cima, z para a câmera. */
export const naVista = (x: number, y: number, z: number) => v3(x, y, z).applyAxisAngle(EIXO_Y, GIRO_VISTA)
/** A direita da tela, no chão. */
export const DIREITA = naVista(1, 0, 0)

export const FLUTUA = 0.42 // os animais flutuam sobre a grade
export const CASA: Record<Sexo, THREE.Vector3> = { boi: v3(-1.08, FLUTUA, -0.62), vaca: v3(1.02, FLUTUA, 0.6) }

export const BOTA = v3(-0.45, 0.62, 0.35) // planta do pé da bota, no meio da cena (os animais saem de vista)
/** A pilha de camadas, ao lado do animal: entre ele e a câmera, na altura do lombo. */
export const lugarPilha = (s: Sexo) => CASA[s].clone().add(naVista(-0.05, 1.02, 1.32))

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

/** Um enquadramento a partir do alvo, de uma direção e de uma distância. */
export const olhar = (alvo: THREE.Vector3, dir: THREE.Vector3, d: number): Enquadramento => ({ alvo, pos: alvo.clone().addScaledVector(dir.clone().normalize(), d) })

// ---------------------------------------------------------------- região da pele, no lugar
/** centro da região; quanto ela se estende para a direita da tela; raio. */
export type Quadro = { centro: THREE.Vector3; direita: number; raio: number }
export function quadroPeca(m: Modelo, s: Sexo, r: RegiaoId): Quadro {
  const pc = m.pecas[r]
  let direita = 0
  let raio = 0
  const d = v3()
  for (let i = 0; i < pc.pos.length; i += 3) {
    d.set(pc.pos[i] - pc.centro.x, pc.pos[i + 1] - pc.centro.y, pc.pos[i + 2] - pc.centro.z)
    direita = Math.max(direita, d.dot(DIREITA))
    raio = Math.max(raio, d.length())
  }
  return { centro: CASA[s].clone().add(pc.centro), direita, raio }
}
/** O gráfico da química ao lado da região: à direita dela na tela e à frente do corpo. */
export const baseGrafRegiao = (q: Quadro) => q.centro.clone().add(naVista(q.direita + 0.4, 0.05, 0.55))

// de onde se vê cada região: de frente e um pouco de cima; a barriga e as patas, mais de lado
const DIR_REGIAO: Record<RegiaoId, THREE.Vector3> = {
  pescoco: naVista(0.2, 0.32, 1),
  paleta: naVista(0.12, 0.32, 1),
  grupao: naVista(0.05, 0.45, 1),
  barrigas: naVista(0.12, 0.02, 1),
  garras: naVista(0.12, 0.12, 1),
}

/**
 * Um conjunto e o gráfico ao lado cabem na área livre da tela, como o enquadramento do visualizador do
 * submarino: à esquerda fica o quadro de decomposição, à direita os nomes do gráfico, em cima o título,
 * embaixo a faixa de controles. O conjunto vai de u0 a u1 ao longo da direita da tela, a partir de base,
 * com meia altura.
 */
export function enquadrarFaixa(base: THREE.Vector3, u0: number, u1: number, meiaAltura: number, dir: THREE.Vector3, W: number, H: number, nomesADireita = true): Enquadramento {
  const tg = Math.tan(THREE.MathUtils.degToRad(FOV) / 2)
  const L = largo(W)
  const esq = L ? 370 : 20
  const dirPx = L && nomesADireita ? 330 : 40
  const topo = 90
  const baixo = 90
  const dLargura = ((u1 - u0) * 1.08 * H) / ((W - esq - dirPx) * 2 * tg)
  const dAltura = (2 * meiaAltura * 1.12 * H) / ((H - topo - baixo) * 2 * tg)
  const d = Math.max(dLargura, dAltura, 1.6)
  const porPx = (2 * d * tg) / H
  // o alvo cai em W/2 + DESLOC_PX na tela; o meio da área livre fica em (esq + W − dirPx) / 2
  const ondeCai = W / 2 + (L ? DESLOC_PX : 0)
  const meioLivre = (esq + W - dirPx) / 2
  return olhar(base.clone().addScaledVector(DIREITA, (u0 + u1) / 2 + (ondeCai - meioLivre) * porPx), dir, d)
}

export function enquadrarRegiao(q: Quadro, r: RegiaoId, W: number, H: number) {
  const g = baseGrafRegiao(q)
  const uGraf = g.clone().sub(q.centro).dot(DIREITA)
  return enquadrarFaixa(q.centro.clone().add(naVista(0, 0, 0.3)), -q.raio, uGraf + 0.1, Math.max(q.raio, GRAF_ALTURA / 2 + 0.08), DIR_REGIAO[r], W, H)
}

export const baseGrafPilha = (s: Sexo) => lugarPilha(s).addScaledVector(DIREITA, MEIO_PILHA + 0.42)
export function enquadrarPilha(s: Sexo, W: number, H: number) {
  // à esquerda, o lugar dos nomes das camadas
  return enquadrarFaixa(lugarPilha(s), -MEIO_PILHA - 0.7, MEIO_PILHA + 0.52, 0.8, naVista(0.1, 0.3, 1), W, H)
}
