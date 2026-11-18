// Quadro de decomposição, como o do painel de defesa: só é clicável o que muda a vista ou aproxima a câmera.
import { useEffect, useState } from 'react'
import type { RegiaoId, Sexo } from './forma'
import { CAMADAS, ETAPAS, ORGAOS, REGIOES, type Modo } from './receitas'

type Props = {
  modo: Modo
  sexo: Sexo
  regiao: RegiaoId | null
  camada: string | null
  orgao: string | null
  hover: { tipo: string; id?: string; regiao?: RegiaoId } | null
  onRaiz: () => void
  onSexo: (s: Sexo) => void
  onEtapa: (m: Modo) => void
  onRegiao: (r: RegiaoId) => void
  onCamada: (id: string) => void
  onOrgao: (id: string) => void
  onHover: (tipo: 'regiao' | 'camada' | 'orgao' | null, id?: string) => void
}

export function Decomposicao(p: Props) {
  const estreita = typeof window !== 'undefined' && window.innerWidth < 900
  const [aberto, setAberto] = useState(!estreita)
  const [abertas, setAbertas] = useState<Set<string>>(new Set(['raiz', 'regiao']))
  useEffect(() => {
    if (p.modo === 'animal') setAbertas((s) => new Set([...s, 'raiz']))
    else setAbertas(new Set(['raiz', p.modo]))
  }, [p.modo])
  const alternar = (id: string) =>
    setAbertas((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const mais = (id: string) => (
    <button
      className="mais"
      onClick={(e) => {
        e.stopPropagation()
        alternar(id)
      }}
      aria-label="Abrir ou fechar"
    >
      {abertas.has(id) ? '−' : '+'}
    </button>
  )
  const hv = p.hover

  return (
    <div className="decomp-col">
      <h1 className="decomp-titulo">Cadeia produtiva do couro</h1>
      <aside className={`decomp${aberto ? '' : ' fechada'}`}>
        <header>
          <span>Decomposição</span>
          <button onClick={() => setAberto(!aberto)} aria-label={aberto ? 'Recolher o quadro' : 'Abrir o quadro'}>
            {aberto ? '‹' : '›'}
          </button>
        </header>
        {aberto && (
          <ol>
            <li className={`raiz${p.modo === 'animal' ? ' ativa' : ''}`}>
              <div className="linha clicavel" onClick={p.onRaiz}>
                <span className="losango">◆</span>
                <span className="nome">Boi e vaca</span>
                {mais('raiz')}
              </div>
              {abertas.has('raiz') && (
                <ul className="subs">
                  <li className="sexos">
                    {(['boi', 'vaca'] as Sexo[]).map((s) => (
                      <button key={s} className={s === p.sexo ? 'ativo' : ''} onClick={() => p.onSexo(s)}>
                        {s === 'boi' ? 'Boi' : 'Vaca'}
                      </button>
                    ))}
                  </li>
                </ul>
              )}
            </li>
            {ETAPAS.map((e) => {
              const ativa = e.modo && p.modo === e.modo
              const filhos =
                e.id === 'interior'
                  ? ORGAOS.map((o) => ({ id: o.id, n: o.n, nome: o.nome, ativo: p.orgao === o.id, hover: hv?.tipo === 'orgao' && hv.id === o.id, ir: () => p.onOrgao(o.id), tipo: 'orgao' as const }))
                  : e.id === 'regiao'
                    ? REGIOES.map((r) => ({ id: r.id, n: r.n, nome: r.nome, ativo: p.modo === 'regiao' && p.regiao === r.id, hover: hv?.tipo === 'regiao' && hv.regiao === r.id, ir: () => p.onRegiao(r.id), tipo: 'regiao' as const }))
                    : e.id === 'pele'
                      ? CAMADAS.map((c, i) => ({ id: c.id, n: i + 1, nome: c.nome, ativo: p.camada === c.id, hover: hv?.tipo === 'camada' && hv.id === c.id, ir: () => p.onCamada(c.id), tipo: 'camada' as const }))
                      : []
              return (
                <li key={e.id} className={`${ativa ? 'ativa' : ''}${e.proxima ? ' proxima' : ''}`}>
                  <div className={`linha${e.modo ? ' clicavel' : ''}`} onClick={e.modo ? () => p.onEtapa(e.modo!) : undefined}>
                    <span className="num">{e.n}</span>
                    <span className="nome">
                      {e.nome}
                      <em>{e.local}</em>
                    </span>
                    {filhos.length > 0 && mais(e.id)}
                  </div>
                  {abertas.has(e.id) && filhos.length > 0 && (
                    <ul className="subs">
                      {filhos.map((f) => (
                        <li
                          key={f.id}
                          className={`item${f.ativo ? ' ativo' : ''}${f.hover ? ' hover' : ''}`}
                          onMouseEnter={() => p.onHover(f.tipo, f.id)}
                          onMouseLeave={() => p.onHover(null)}
                          onClick={f.ir}
                        >
                          <span className="num-p">{f.n}</span>
                          <span className="nome-sub">{f.nome}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </aside>
    </div>
  )
}
