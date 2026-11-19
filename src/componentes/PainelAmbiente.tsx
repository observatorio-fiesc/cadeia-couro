// Painel da lente Ambiente do cone, à direita: os números, os pontos de atenção (cada um acende o seu elo no
// cone), o que sai das plantas e as regras que tocam a cadeia. Tudo da base, com as fontes no fim.

import type { Contexto } from '../dados/contexto'
import { LWG, diasAte, pontosDeAtencao } from '../dados/ambiente'
import { TIPOS_SAIDA } from '../dados/processo'
import { pct } from '../lib/formato'

const UE = new Set('AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE'.split(' '))
const COR_TIPO: Record<string, string> = { coproduto: 'var(--saida-coproduto)', residuo: 'var(--saida-residuo)', efluente: 'var(--saida-efluente)' }
const dataBR = (iso: string) => iso.split('-').reverse().join('/')

export function PainelAmbiente({ ctx, onSelecionar }: { ctx: Contexto; onSelecionar: (id: string) => void }) {
  const { cadeia, processo, mercados } = ctx
  const pontos = pontosDeAtencao()
  const dias = diasAte(LWG[0].ate)
  // parcela da UE nas exportações dos municípios das plantas (domicílio fiscal do exportador)
  const parteUE = (ano: string) => {
    const paises = Object.entries(mercados.anual_pais)
    const total = paises.reduce((s, [, v]) => s + (v[ano] ?? 0), 0)
    const ue = paises.filter(([k]) => UE.has(k)).reduce((s, [, v]) => s + (v[ano] ?? 0), 0)
    return total ? ue / total : null
  }
  const regras = mercados.eventos.filter((e) => e.tipo === 'regulacao' && /couro|pecuaria/.test(e.setores))
  const sobras = (processo?.saidas ?? []).filter((s) => s.tipo !== 'artigo')
  const fontes = [...new Set([...pontos.flatMap((p) => p.fontes), 'rbv', 'comex-mun'])]
  return (
    <aside className="ficha painel-lente painel-ambiente">
      <div className="sobretitulo">Ambiente na cadeia</div>
      <h2>Onde a cadeia depende do ambiente</h2>
      <div className="numeros-ambiente">
        <div>
          <b>11,9%</b>
          <span>da matéria-prima rastreada até a fazenda de nascimento</span>
        </div>
        <div>
          <b>651 mil m³</b>
          <span>de água captados por ano; 444 mil m³ de efluente tratado</span>
        </div>
        <div>
          <b>74,11%</b>
          <span>dos resíduos com uso agrícola; 9,02% viram fertilizante</span>
        </div>
        <div className={dias <= 60 ? 'alerta' : ''}>
          <b>{dias >= 0 ? `${dias} dias` : 'vencido'}</b>
          <span>até o fim do LWG Gold de Várzea Grande ({dataBR(LWG[0].ate)})</span>
        </div>
      </div>

      <section>
        <h3>Pontos de atenção</h3>
        {pontos.map((p, i) => (
          <button key={p.id} className="atencao" onClick={() => onSelecionar(p.id)}>
            <em>{i + 1}</em>
            <span>
              <strong>{p.titulo}</strong>
              {p.texto}
            </span>
          </button>
        ))}
        <p className="nota">Um clique mostra no cone o que depende do elo.</p>
      </section>

      <section>
        <h3>O que sai das plantas</h3>
        {TIPOS_SAIDA.filter((t) => t !== 'artigo').map((t) =>
          sobras
            .filter((s) => s.tipo === t)
            .map((s) => (
              <div key={s.id} className="linha">
                <span style={{ color: COR_TIPO[t] }}>{s.nome}</span>
                <b>{s.destino}</b>
              </div>
            )),
        )}
      </section>

      <section>
        <h3>Regras que tocam a cadeia</h3>
        {regras.map((e) => (
          <div key={e.titulo} className="regra">
            <div className="linha">
              <span>{e.titulo}</span>
              <b>{dataBR(e.data)}</b>
            </div>
            <p className="nota">
              {e.descricao} {e.status !== 'confirmado' && <em className="selo selo-confirmar">a confirmar</em>} <span className="nota-inline">· {e.fonte}</span>
            </p>
          </div>
        ))}
        <div className="linha">
          <span>Parte da UE nas exportações dos municípios das plantas</span>
          <b>
            {pct(parteUE('2025'))} em 2025 · {pct(parteUE('2026'))} em 2026
          </b>
        </div>
        <p className="nota">{mercados.ressalva} 2026 até {mercados.ultimo_periodo.split('-').reverse().join('/')}.</p>
      </section>

      <section className="fontes">
        <h3>Fontes</h3>
        <ul>
          {fontes.map((f) => (
            <li key={f}>{cadeia.meta.fontes[f] ?? f}</li>
          ))}
        </ul>
      </section>
    </aside>
  )
}
