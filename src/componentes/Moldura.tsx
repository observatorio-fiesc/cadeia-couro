// Moldura de prancha técnica em volta da tela, como a do visualizador do submarino (painel-comandante):
// filete duplo, colunas numeradas em cima e embaixo, linhas com letras dos lados.
const COLUNAS = ['1', '2', '3', '4', '5', '6', '7', '8']
const LINHAS = ['A', 'B', 'C', 'D', 'E', 'F']

export function Moldura() {
  return (
    <div className="moldura" aria-hidden>
      <div className="moldura-colunas topo">
        {COLUNAS.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="moldura-colunas base">
        {COLUNAS.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="moldura-linhas esquerda">
        {LINHAS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="moldura-linhas direita">
        {LINHAS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  )
}
