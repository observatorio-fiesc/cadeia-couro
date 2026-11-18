// Estado animado da aba Modelo 3D (fora do React: lido e escrito a cada quadro) e os tipos da vista.
import type { ReactNode } from 'react'
import type * as THREE from 'three'
import type { RegiaoId, Sexo } from './forma'
import type { Dep } from './receitas'
import type { Estacao } from './lugares'

export type PorSexo<T> = Record<Sexo, T>
export type Anim = {
  vis: PorSexo<number> // presença do animal
  visA: PorSexo<number>
  corpo: PorSexo<number> // força do traço do corpo (recua quando uma região está em foco)
  corpoA: PorSexo<number>
  int: PorSexo<number> // força do interior (o rúmen e o que entra nele)
  intA: PorSexo<number>
  est: Record<Estacao, number> // presença de cada sistema: a fazenda (os animais) e a bota
  estA: Record<Estacao, number>
  peca: number // as curvas de nível da região escolhida (escrito pela região ativa)
  pecaA: number
  pele: number // as camadas aparecem na pilha
  peleA: number
  graf: number // gráfico ao lado: entra quando o que ele descreve já está desenhado
  grafA: number
  grafDe: 'peca' | 'pele'
  t: number
}
export const novaAnim = (): Anim => ({
  vis: { boi: 1, vaca: 1 },
  visA: { boi: 1, vaca: 1 },
  corpo: { boi: 1, vaca: 1 },
  corpoA: { boi: 1, vaca: 1 },
  int: { boi: 0.28, vaca: 0.28 },
  intA: { boi: 0.28, vaca: 0.28 },
  est: { fazenda: 1, bota: 0 },
  estA: { fazenda: 1, bota: 0 },
  peca: 0,
  pecaA: 0,
  pele: 0,
  peleA: 0,
  graf: 0,
  grafA: 0,
  grafDe: 'peca',
  t: 0,
})

export type Lente = 'insumos' | 'dependencia'
export type Item = { id: string; nome: string; cor: string; valor: number; dep: Dep; detalhe: string; faixa?: string; depNota: string }

export type Hover =
  | { tipo: 'regiao'; regiao: RegiaoId; sexo: Sexo | null }
  | { tipo: 'pele'; sexo: Sexo }
  | { tipo: 'animal'; sexo: Sexo }
  | { tipo: 'quimico'; id: string }
  | { tipo: 'orgao'; id: string }
  | { tipo: 'insumo'; id: string }
  | { tipo: 'camada'; id: string }
  | { tipo: 'parte'; id: string }
  | null
export const mesmoHover = (a: Hover, b: Hover) => JSON.stringify(a) === JSON.stringify(b)

export type ModoRotulo = 'perto' | 'esq' | 'dir' | 'legenda' | 'baixo' | 'painel'
export type Alvo = { id: string; modo: ModoRotulo; pontos: (cam: THREE.Camera) => THREE.Vector3[]; dx?: number; dy?: number }
export type Rotulo = Alvo & { conteudo: ReactNode; classe?: string }
