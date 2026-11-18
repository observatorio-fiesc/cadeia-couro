// Quadro de decomposição, no desenho do visualizador do submarino (painel-comandante): um painel de filete
// fino à esquerda, uma árvore de linhas compactas, e uma aba na borda da tela quando recolhido ([ alterna).
// Só é clicável o que muda a vista ou aproxima a câmera.
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

// recuo de cada nível da árvore, como no visualizador do submarino
const recuo = (nivel: number) => ({ paddingLeft: 10 + nivel * 14 })

export function Decomposicao(p: Props) {
  const estreita = typeof window !== 'undefined' && window.innerWidth < 900
  const [aberto, setAberto] = useState(!estreita)
  const [abertas, setAbertas] = useState<Set<string>>(new Set(['regiao']))
  useEffect(() => {
    if (p.modo !== 'animal') setAbertas(new Set([p.modo]))
  }, [p.modo])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === '[' && !(e.target instanceof HTMLInputElement)) setAberto((a) => !a)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])
  const alternar = (id: string) =>
    setAbertas((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const hv = p.hover
  const titulo = `${aberto ? 'Recolher' : 'Mostrar'} a decomposição ([)`

  return (
    <>
      <aside className={`painel decomp-painel${aberto ? '' : ' recolhido'}`} aria-hidden={!aberto}>
        <header className="painel-cabeca">
          <span>Decomposição</span>
          <button className="painel-recolher" onClick={() => setAberto(false)} title={titulo} aria-label={titulo}>
            ‹
          </button>
        </header>
        <ul className="decomp-lista">
          <li>
            <div className={`decomp-linha raiz${p.modo === 'animal' ? ' selecionada' : ' caminho'}`} style={recuo(0)}>
              <button className="decomp-alvo" onClick={p.onRaiz} aria-current={p.modo === 'animal' ? 'step' : undefined}>
                <span className="decomp-idx raiz-idx">◆</span>
                <span className="decomp-nome">Boi e vaca</span>
              </button>
              <span className="sexos" role="group" aria-label="Animal">
                {(['boi', 'vaca'] as Sexo[]).map((s) => (
                  <button key={s} className={s === p.sexo ? 'ativo' : ''} aria-pressed={s === p.sexo} onClick={() => p.onSexo(s)}>
                    {s === 'boi' ? 'Boi' : 'Vaca'}
                  </button>
                ))}
              </span>
            </div>
            <ul>
              {ETAPAS.map((e) => {
                const ativa = !!e.modo && p.modo === e.modo
                const filhos =
                  e.id === 'interior'
                    ? ORGAOS.map((o) => ({ id: o.id, n: o.n, nome: o.nome, ativo: p.orgao === o.id, hover: hv?.tipo === 'orgao' && hv.id === o.id, ir: () => p.onOrgao(o.id), tipo: 'orgao' as const }))
                    : e.id === 'regiao'
                      ? REGIOES.map((r) => ({ id: r.id, n: r.n, nome: r.nome, ativo: p.modo === 'regiao' && p.regiao === r.id, hover: hv?.tipo === 'regiao' && hv.regiao === r.id, ir: () => p.onRegiao(r.id), tipo: 'regiao' as const }))
                      : e.id === 'pele'
                        ? CAMADAS.map((c, i) => ({ id: c.id, n: i + 1, nome: c.nome, ativo: p.camada === c.id, hover: hv?.tipo === 'camada' && hv.id === c.id, ir: () => p.onCamada(c.id), tipo: 'camada' as const }))
                        : []
                const aberta = abertas.has(e.id) && filhos.length > 0
                const algumFilho = filhos.some((f) => f.ativo)
                const classe = ['decomp-linha', ativa && !algumFilho && 'selecionada', ativa && algumFilho && 'caminho', e.proxima && 'proxima'].filter(Boolean).join(' ')
                return (
                  <li key={e.id}>
                    <div className={classe} style={recuo(1)}>
                      <button
                        className="decomp-alvo"
                        disabled={!e.modo}
                        aria-current={ativa ? 'step' : undefined}
                        onClick={e.modo ? () => p.onEtapa(e.modo!) : undefined}
                        title={e.proxima ? 'Próxima etapa: ainda sem vista' : undefined}
                      >
                        <span className="decomp-idx">{e.n}</span>
                        <span className="decomp-nome">
                          {e.nome}
                          <em>{e.local}</em>
                        </span>
                      </button>
                      {filhos.length > 0 && (
                        <button className="decomp-mais" onClick={() => alternar(e.id)} aria-expanded={aberta} aria-label={aberta ? 'Fechar' : 'Abrir'}>
                          {aberta ? '−' : '+'}
                        </button>
                      )}
                    </div>
                    {aberta && (
                      <ul>
                        {filhos.map((f) => (
                          <li key={f.id}>
                            <button
                              className={`decomp-linha decomp-alvo${f.ativo ? ' selecionada' : ''}${f.hover ? ' hover' : ''}`}
                              style={recuo(2)}
                              aria-current={f.ativo ? 'true' : undefined}
                              onMouseEnter={() => p.onHover(f.tipo, f.id)}
                              onMouseLeave={() => p.onHover(null)}
                              onClick={f.ir}
                            >
                              <span className="decomp-idx">{f.n}</span>
                              <span className="decomp-nome">{f.nome}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </li>
        </ul>
      </aside>
      {!aberto && (
        <button className="painel-aba esquerda" onClick={() => setAberto(true)} title={titulo} aria-label={titulo}>
          <span className="painel-aba-seta">›</span>
          <span className="painel-aba-nome">Decomposição</span>
        </button>
      )}
    </>
  )
}
