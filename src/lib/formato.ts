// Números no padrão brasileiro, como rótulo e valor

const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export const pct = (x: number | null | undefined) => (x == null ? '–' : `${nf0.format(x * 100)}%`)

export const variacao = (x: number | null | undefined) =>
  x == null ? '–' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${nf0.format(Math.abs(x) * 100)}%`

export const musd = (x: number | null | undefined) => (x == null ? '–' : `US$ ${nf1.format(x)} mi`)

export const inteiro = (x: number) => nf0.format(x)
