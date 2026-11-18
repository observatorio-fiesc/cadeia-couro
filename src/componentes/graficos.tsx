// Gráficos pequenos em SVG, no padrão da nota técnica: colunas por período (o valor está na altura),
// sem legenda solta (a chave fica no título), marcos verticais para eventos.

export type Serie = { chave: string; cor: string; rotulo: string }
export type Marco = { indice: number; rotulo: string; cor?: string }

type PropsColunas = {
  dados: Record<string, number | string | null>[]
  chaveX: string
  series: Serie[]
  largura: number
  altura: number
  marcos?: Marco[]
  formatoY?: (v: number) => string
  rotuloX?: (v: string, i: number) => string | null
  linha?: { valores: (number | null)[]; cor: string; formato: (v: number) => string; max?: number }
}

export function ColunasEmpilhadas({ dados, chaveX, series, largura, altura, marcos = [], formatoY, rotuloX, linha }: PropsColunas) {
  const margem = { t: 14, r: linha ? 34 : 6, b: 22, l: 40 }
  const w = largura - margem.l - margem.r
  const h = altura - margem.t - margem.b
  const totais = dados.map((d) => series.reduce((s, sr) => s + (Number(d[sr.chave]) || 0), 0))
  const max = Math.max(1, ...totais)
  const bw = w / dados.length
  const fy = formatoY ?? ((v: number) => String(Math.round(v)))
  const ticks = [0, 0.5, 1].map((t) => t * max)
  const lmax = linha ? linha.max ?? Math.max(1e-9, ...linha.valores.filter((v): v is number => v != null)) : 1
  return (
    <svg width={largura} height={altura} className="grafico">
      <g transform={`translate(${margem.l},${margem.t})`}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={0} x2={w} y1={h - (t / max) * h} y2={h - (t / max) * h} className="grade" />
            <text x={-6} y={h - (t / max) * h} className="eixo" textAnchor="end" dominantBaseline="middle">
              {fy(t)}
            </text>
          </g>
        ))}
        {dados.map((d, i) => {
          let acum = 0
          return (
            <g key={i} transform={`translate(${i * bw},0)`}>
              {series.map((sr) => {
                const v = Number(d[sr.chave]) || 0
                const y0 = h - ((acum + v) / max) * h
                const hh = (v / max) * h
                acum += v
                return <rect key={sr.chave} x={bw * 0.12} y={y0} width={bw * 0.76} height={Math.max(0, hh)} fill={sr.cor} opacity={0.85} />
              })}
              {rotuloX && rotuloX(String(d[chaveX]), i) && (
                <text x={bw / 2} y={h + 13} className="eixo" textAnchor="middle">
                  {rotuloX(String(d[chaveX]), i)}
                </text>
              )}
            </g>
          )
        })}
        {linha && (
          <>
            <polyline
              className="linha-serie"
              stroke={linha.cor}
              points={linha.valores
                .map((v, i) => (v == null ? null : `${i * bw + bw / 2},${h - (v / lmax) * h}`))
                .filter(Boolean)
                .join(' ')}
            />
            <text x={w + 4} y={h - ((linha.valores.at(-1) ?? 0) / lmax) * h} className="eixo" fill={linha.cor} dominantBaseline="middle">
              {linha.formato(linha.valores.at(-1) ?? 0)}
            </text>
          </>
        )}
        {marcos.map((m, i) => {
          const fim = m.indice * bw > w * 0.7
          return (
            <g key={i} transform={`translate(${m.indice * bw},0)`}>
              <line y1={-6} y2={h} className="marco" stroke={m.cor ?? 'var(--vermelho)'} />
              <text y={-4 + (i % 2) * 9} x={fim ? -3 : 3} textAnchor={fim ? 'end' : 'start'} className="eixo marco-texto" fill={m.cor ?? 'var(--vermelho)'}>
                {m.rotulo}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

export function BarrasHorizontais({ itens, largura, cor, formato }: { itens: { rotulo: string; valor: number; extra?: string }[]; largura: number; cor: string; formato: (v: number) => string }) {
  const max = Math.max(1e-9, ...itens.map((i) => i.valor))
  return (
    <div className="barras-h" style={{ width: largura }}>
      {itens.map((i) => (
        <div key={i.rotulo} className="barra-h">
          <span>{i.rotulo}</span>
          <i style={{ width: `${(i.valor / max) * 100}%`, background: cor }} />
          <b>
            {formato(i.valor)}
            {i.extra ? ` ${i.extra}` : ''}
          </b>
        </div>
      ))}
    </div>
  )
}
