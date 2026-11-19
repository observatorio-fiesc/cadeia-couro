// Figuras que não são mapa, como "Enxofre e ácido" nos Cenários estratégicos:
// - a linha de um processo (o curtume, o boi), com o que entra de fora em cada etapa: o nome, uma barra do tamanho
//   do valor, o valor e a maior origem; uma pele corre pela linha, de etapa em etapa;
// - a corrente de um choque, elo por elo.
import type { Tom } from './Mapa'

export type Estacao = {
  nome: string
  /** o que entra de fora nesta etapa; `v` em US$, só para o tamanho da barra */
  insumos: { nome: string; v: number; valor: string; origem?: string; golfo?: boolean }[]
  /** uma linha curta sob a etapa, quando nada entra nela */
  nota?: string
}

/** Uma linha de processo, da esquerda para a direita, com os insumos pendurados em cada etapa. */
export function FiguraProcesso({ estacoes, faixa, faixaNome }: { estacoes: Estacao[]; faixa?: Estacao['insumos'][number]; faixaNome?: string }) {
  const W = 940
  const n = estacoes.length
  const x0 = 70
  const passo = (W - 2 * x0) / Math.max(1, n - 1)
  const X = (k: number) => x0 + k * passo
  const col = Math.min(passo - 22, 200)
  const LINHA = 58
  const TOPO = 104
  const ITEM = 48
  const vmax = Math.max(...estacoes.flatMap((e) => e.insumos.map((i) => i.v)), faixa?.v ?? 0, 1)
  const maisItens = Math.max(0, ...estacoes.map((e) => e.insumos.length))
  const yFaixa = TOPO + maisItens * ITEM + 22
  const H = faixa ? yFaixa + 46 : TOPO + Math.max(1, maisItens) * ITEM
  return (
    <svg className="ext-fig-processo" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
      <line className="trilho" x1={X(0)} x2={X(n - 1)} y1={LINHA} y2={LINHA} />
      {estacoes.slice(0, -1).map((_, k) => (
        <path key={k} className="seta" d={`M${X(k) + passo / 2 - 4},${LINHA - 4} l5,4 l-5,4`} />
      ))}
      <circle className="pele" r={4.5} cy={LINHA}>
        <animate attributeName="cx" values={`${X(0)};${X(n - 1)}`} dur={`${1.6 * n}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.92;1" dur={`${1.6 * n}s`} repeatCount="indefinite" />
      </circle>
      {estacoes.map((e, k) => (
        <g key={e.nome} className="estacao" style={{ animationDelay: `${300 + k * 260}ms` }}>
          <text className="nome" x={X(k)} y={LINHA - 20} textAnchor="middle">
            {e.nome}
          </text>
          <circle className={`no${e.insumos.length ? ' entra' : ''}`} cx={X(k)} cy={LINHA} r={5} />
          {e.insumos.length > 0 && <line className="desce" x1={X(k)} x2={X(k)} y1={LINHA + 7} y2={TOPO - 16} />}
          {e.nota && (
            <text className="nota" x={X(k)} y={LINHA + 26} textAnchor="middle">
              {e.nota}
            </text>
          )}
          {e.insumos.map((i, j) => {
            const y = TOPO + j * ITEM
            const esq = X(k) - col / 2
            return (
              <g key={i.nome} className="insumo" style={{ animationDelay: `${700 + k * 260 + j * 120}ms` }}>
                <text className="insumo-nome" x={esq} y={y}>
                  {i.nome}
                </text>
                <rect className={`barra${i.golfo ? ' golfo' : ''}`} x={esq} y={y + 6} width={Math.max(3, (col * i.v) / vmax)} height={4} />
                <text className="insumo-valor" x={esq} y={y + 22}>
                  {i.valor}
                  {i.origem ? ` · ${i.origem}` : ''}
                </text>
              </g>
            )
          })}
        </g>
      ))}
      {faixa && (
        <g className="faixa" style={{ animationDelay: `${900 + n * 260}ms` }}>
          <path d={`M${X(0)},${yFaixa - 6} V${yFaixa} H${X(n - 1)} V${yFaixa - 6}`} />
          <text className="insumo-nome" x={(X(0) + X(n - 1)) / 2} y={yFaixa + 18} textAnchor="middle">
            {faixa.nome}
            {faixaNome ? `, ${faixaNome}` : ''}
          </text>
          <text className="insumo-valor" x={(X(0) + X(n - 1)) / 2} y={yFaixa + 33} textAnchor="middle">
            {faixa.valor}
            {faixa.origem ? ` · ${faixa.origem}` : ''}
          </text>
        </g>
      )}
    </svg>
  )
}

export type Elo = { valor: string; nome: string; sub?: string; tom: Tom }

/** A corrente de um choque, de cima para baixo: cada elo com o seu número. */
export function Corrente({ elos }: { elos: Elo[] }) {
  return (
    <ol className="ext-corrente">
      {elos.map((e, i) => (
        <li key={e.nome} className={`tom-${e.tom}`} style={{ animationDelay: `${700 + i * 650}ms` }}>
          <b>{e.valor}</b>
          <span>{e.nome}</span>
          {e.sub && <i>{e.sub}</i>}
        </li>
      ))}
    </ol>
  )
}
