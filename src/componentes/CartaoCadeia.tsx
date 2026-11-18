// Cartão da cadeia de um item da aba Modelo 3D (um químico, um insumo do animal, um defeito, uma camada
// de acabamento, uma peça da bota): os nós da cadeia que ele representa e, de cada um, de onde vem, até
// três níveis acima, com a importação de 2025 e a confiança. Como a "cadeia de um item" do visualizador do submarino.
import type { Cadeia, Indice, No } from '../dados/cadeia'
import { musd } from '../lib/formato'

type Linha = { no: No; nivel: number; indicio: boolean }

function montante(c: Cadeia, ix: Indice, id: string, max = 3): Linha[] {
  const out: Linha[] = []
  const vistos = new Set<string>([id])
  const andar = (alvo: string, nivel: number) => {
    if (nivel > max) return
    for (const i of ix.insumosDe.get(alvo) ?? []) {
      const a = c.arestas[i]
      if (a.tipo === 'visual' || vistos.has(a.de)) continue
      const no = ix.porId.get(a.de)
      if (!no || no.lado !== 'oferta') continue
      vistos.add(a.de)
      out.push({ no, nivel, indicio: a.confianca === 'indício' })
      andar(a.de, nivel + 1)
    }
  }
  andar(id, 1)
  return out
}

const valor = (n: No) => (n.comercio ? `importação ${musd(n.comercio.musd_2025)}` : null)

export function CartaoCadeia({ cadeia, ix, titulo, nota, ids, onFechar }: { cadeia: Cadeia; ix: Indice; titulo: string; nota?: string; ids: string[]; onFechar: () => void }) {
  const nos = ids.map((id) => ix.porId.get(id)).filter((n): n is No => !!n)
  return (
    <aside className="painel cartao-cadeia" aria-label={`Cadeia de ${titulo}`}>
      <header className="painel-cabeca">
        <span>De onde vem</span>
        <button className="painel-recolher" onClick={onFechar} aria-label="Fechar" title="Fechar (Esc)">
          ×
        </button>
      </header>
      <div className="cartao-corpo">
        <h3>{titulo}</h3>
        {nota && <p className="cartao-nota">{nota}</p>}
        {nos.map((n) => {
          const linhas = montante(cadeia, ix, n.id)
          return (
            <section key={n.id}>
              <div className="cartao-no">
                <b>{n.nome}</b>
                <em>
                  {[cadeia.meta.camadas[n.lado]?.[String(n.camada)], valor(n), n.confianca].filter(Boolean).join(' · ')}
                </em>
                {n.descricao && <small>{n.descricao}</small>}
              </div>
              {linhas.length > 0 ? (
                <ul className="cartao-arvore">
                  {linhas.map((l) => (
                    <li key={l.no.id} style={{ paddingLeft: 4 + (l.nivel - 1) * 14 }} className={l.indicio ? 'indicio' : ''}>
                      <span className="cartao-ramo" aria-hidden>
                        └
                      </span>
                      <span className="cartao-nome">{l.no.nome}</span>
                      {valor(l.no) && <span className="cartao-valor">{musd(l.no.comercio!.musd_2025)}</span>}
                      {l.indicio && <span className="cartao-valor">indício</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cartao-nota">Sem insumos mapeados acima deste elo.</p>
              )}
            </section>
          )
        })}
        <p className="cartao-rodape">Valores: importações do Brasil em 2025, Comex Stat. Fontes de cada elo em "Fontes e definições".</p>
      </div>
    </aside>
  )
}
