// Cadeia em árvore (como a árvore do painel de defesa): a Viposa à esquerda, as etapas na coluna seguinte e,
// a cada clique, os insumos, materiais e matérias-primas do elo aberto. O caminho aberto fica em conhaque.
// Rótulos sempre à direita do círculo; cada coluna começa depois do rótulo mais largo da anterior, e a linha do
// elo aberto sai do fim do seu rótulo. O código NCM/SH aparece na última coluna aberta.

import { useMemo } from 'react'
import type { Cadeia, Indice, No } from '../dados/cadeia'
import { useTela } from '../lib/mapa'
import { parteGolfo } from '../lib/lentes'

const ORDEM_ETAPAS = ['sis.pele', 'sis.ribeira', 'sis.curtimento', 'sis.classificacao', 'sis.recurtimento', 'sis.acabamento', 'sis.manufatura', 'sis.utilidades', 'sis.transporte']
const LINHA = 26
const CHAR = 7.25 // largura média de um caractere de 12 px em IBM Plex Mono
const CHAR_P = 6.35 // idem, 10,5 px

type Props = {
  cadeia: Cadeia
  ix: Indice
  caminho: string[]
  onAbrir: (coluna: number, id: string) => void
  selecionado: string | null
}

function filhos(cadeia: Cadeia, ix: Indice, id: string): No[] {
  const lista = (ix.insumosDe.get(id) ?? [])
    .map((i) => cadeia.arestas[i])
    .filter((a) => ix.porId.get(a.de)?.lado === 'oferta')
    .map((a) => ix.porId.get(a.de)!)
  if (id === 'nucleo.viposa') lista.sort((a, b) => ORDEM_ETAPAS.indexOf(a.id) - ORDEM_ETAPAS.indexOf(b.id))
  else lista.sort((a, b) => a.camada - b.camada || (b.alcance_cadeia ?? 0) - (a.alcance_cadeia ?? 0))
  // uma etapa pode depender de outra (ex.: a ribeira depende da pele): a etapa anterior fica fora da coluna
  return lista.filter((n) => !(n.camada === 1 && id !== 'nucleo.viposa'))
}

const codigo = (n: No) => {
  if (n.ncm?.length) return `NCM ${n.ncm[0].slice(0, 4)}.${n.ncm[0].slice(4, 6)}.${n.ncm[0].slice(6)}`
  if (n.sh6?.length) return `SH ${n.sh6[0].slice(0, 4)}.${n.sh6[0].slice(4)}${n.sh6.length > 1 ? ' +' : ''}`
  return ''
}
const siglas = (planta?: string) => [...new Set((planta ?? '').match(/\b(MT|MS|SC|PR|SP|RS)\b/g) ?? [])].join('·')

type Item = { no: No; y: number; largura: number; nFilhos: number; golfo: boolean; china: boolean; cod: string }

export function Arvore({ cadeia, ix, caminho, onAbrir, selecionado }: Props) {
  const { w, h } = useTela()
  const topo = 230
  const base = h - 110

  const { colunas, xs } = useMemo(() => {
    const cols: { itens: No[]; yPai: number }[] = []
    let yPai = (topo + base) / 2
    cols.push({ itens: [ix.porId.get('nucleo.viposa')!], yPai })
    for (let k = 0; k < caminho.length && k < 4; k++) {
      const itens = filhos(cadeia, ix, caminho[k])
      if (!itens.length) break
      // a coluna nova se centra na linha do elo aberto da coluna anterior
      const anterior = cols[cols.length - 1]
      const iAberto = anterior.itens.findIndex((n) => n.id === caminho[k])
      yPai = posicoesY(anterior.itens.length, anterior.yPai, topo, base)[Math.max(0, iAberto)]
      cols.push({ itens, yPai })
    }
    const ultima = cols.length - 1
    const comItens = cols.map((col, k) => {
      const ys = posicoesY(col.itens.length, col.yPai, topo, base)
      return col.itens.map((no, i): Item => {
        const nFilhos = filhos(cadeia, ix, no.id).length
        const golfo = (parteGolfo(no) ?? 0) >= 0.05
        const china = (no.comercio?.china_2025 ?? 0) >= 0.3
        const cod = k === ultima ? codigo(no) : ''
        const uf = no.camada === 1 ? siglas(no.planta) : ''
        const largura =
          24 + no.nome.length * CHAR + (uf ? 8 + uf.length * CHAR_P : 0) + (cod ? 8 + cod.length * CHAR_P : 0) +
          (golfo ? 50 : 0) + (china ? 50 : 0) + (nFilhos && caminho[k] !== no.id ? 8 + 3 * CHAR_P : 0) + (no.camada >= 2 ? 8 + 4 * CHAR_P : 0)
        return { no, y: ys[i], largura, nFilhos, golfo, china, cod }
      })
    })
    // colunas: cada uma começa depois do rótulo mais largo da anterior; se passar da área útil, a árvore desliza para a esquerda
    const x: number[] = [60]
    for (let k = 1; k < comItens.length; k++) x.push(x[k - 1] + Math.max(...comItens[k - 1].map((it) => it.largura)) + 56)
    const fim = x[x.length - 1] + Math.max(...comItens[comItens.length - 1].map((it) => it.largura))
    const util = w - (selecionado ? 470 : 60)
    const desloc = Math.max(0, fim - util)
    return { colunas: comItens, xs: x.map((v) => v - desloc) }
  }, [cadeia, ix, caminho, topo, base, w, selecionado])

  return (
    <div className="arvore">
      <svg className="arvore-linhas" width={w} height={h}>
        {colunas.map((col, k) => {
          if (k === 0) return null
          const pai = colunas[k - 1].find((it) => it.no.id === caminho[k - 1])
          if (!pai) return null
          const xIni = xs[k - 1] + pai.largura + 4
          const tronco = xs[k] - 24
          const ys = col.map((it) => it.y)
          return (
            <g key={k}>
              <line x1={xIni} y1={pai.y} x2={tronco} y2={pai.y} className="ramo ramo-aberto" />
              <line x1={tronco} y1={Math.min(...ys, pai.y)} x2={tronco} y2={Math.max(...ys, pai.y)} className="ramo" />
              {col.map((it) => (
                <line key={it.no.id} x1={tronco} y1={it.y} x2={xs[k] - 9} y2={it.y} className={caminho[k] === it.no.id ? 'ramo ramo-aberto' : 'ramo'} />
              ))}
            </g>
          )
        })}
      </svg>
      {colunas.map((col, k) =>
        col.map((it, i) => {
          const n = it.no
          const aberto = caminho[k] === n.id
          const cls = ['no-arvore', aberto && 'aberto', selecionado === n.id && 'selecionado'].filter(Boolean).join(' ')
          return (
            <button key={`${k}-${n.id}`} className={cls} style={{ left: xs[k], top: it.y }} onClick={() => onAbrir(k, n.id)} title={n.descricao}>
              <i className="circulo">{k === 0 ? '◆' : i + 1}</i>
              <span className="nome">
                {n.nome}
                {n.camada === 1 && <em className="uf">{siglas(n.planta)}</em>}
              </span>
              {it.cod && <em className="codigo">{it.cod}</em>}
              {it.golfo && <em className="selo selo-golfo">Golfo</em>}
              {it.china && <em className="selo selo-china">China</em>}
              {it.nFilhos > 0 && !aberto && <em className="mais">+{it.nFilhos}</em>}
              {n.lado === 'oferta' && n.camada >= 2 && <em className="alcance">{Math.round((n.alcance_cadeia ?? 0) * 100)}%</em>}
            </button>
          )
        }),
      )}
    </div>
  )
}

// posições verticais de n itens centrados na linha do pai, sem sair da faixa útil
function posicoesY(n: number, yPai: number, topo: number, base: number) {
  const altura = (n - 1) * LINHA
  let y0 = yPai - altura / 2
  if (y0 < topo) y0 = topo
  if (y0 + altura > base) y0 = Math.max(topo, base - altura)
  return Array.from({ length: n }, (_, i) => y0 + i * LINHA)
}
