// Um elo na cadeia, aberto a partir do cone (como a "cadeia de um item" da rede da criticidade do painel de
// referência, submarino/src/scene/CriticalItem.tsx): à esquerda, de que ele é feito, em correntes que entram; à
// direita, o que o usa, em vermelho onde o uso não sai sem ele e em azul onde há alternativa; no alto, a linha do
// processo, as etapas que param acesas em vermelho, com uma corrente subindo do elo até as primeiras. Cada nome leva
// àquele elo, para andar pela cadeia acima e abaixo.

import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import type { Line2 } from 'three-stdlib'
import type { Contexto } from '../dados/contexto'
import type { Aresta } from '../dados/cadeia'
import { COR } from '../lib/lentes'
import { musd, pct } from '../lib/formato'

/** As colunas e a linha do processo, em unidades da cena (as da referência). */
export const ELO = { LX: -3.3, RX: 3.3, ROW: 2.75 }
/** A caixa que a câmera enquadra: o diagrama, os nomes dos dois lados e a linha do alto. */
export const CAIXA_ELO = { x0: ELO.LX - 2.7, x1: ELO.RX + 3.1, y0: -2.5, y1: ELO.ROW + 0.75 }
/** Nomes curtos das etapas, para caberem na linha do processo e nas colunas. */
const CURTO: Record<string, string> = {
  'sis.classificacao': 'Classificação',
  'sis.recurtimento': 'Recurtimento',
  'sis.manufatura': 'Cabedais e calçados',
  'sis.utilidades': 'Água e efluente',
  'sis.transporte': 'Transporte',
}
const ANEL = 0.21
const DISCO = 0.125
/** Linhas por coluna antes de juntar o resto. */
const MAX = 7

const C = {
  tinta: new THREE.Color(COR.cru),
  vermelho: new THREE.Color(COR.vermelho),
  azul: new THREE.Color('#5daed2'),
  conhaque: new THREE.Color(COR.conhaque),
}

/** Uma curva em S entre dois pontos, saindo e chegando na horizontal. */
function curvaS(a: [number, number], b: [number, number], n = 40): [number, number][] {
  const dx = (b[0] - a[0]) / 2
  const c = new THREE.CubicBezierCurve(new THREE.Vector2(...a), new THREE.Vector2(a[0] + dx, a[1]), new THREE.Vector2(b[0] - dx, b[1]), new THREE.Vector2(...b))
  return c.getPoints(n).map((p) => [p.x, p.y])
}
/** Uma subida: sai do elo para cima e chega na etapa por baixo. */
function subida(a: [number, number], b: [number, number], n = 30): [number, number][] {
  const dy = (b[1] - a[1]) / 2
  const c = new THREE.CubicBezierCurve(new THREE.Vector2(...a), new THREE.Vector2(a[0], a[1] + dy), new THREE.Vector2(b[0], b[1] - dy), new THREE.Vector2(...b))
  return c.getPoints(n).map((p) => [p.x, p.y])
}
/** As alturas de uma coluna, centradas no elo, no máximo 0,58 entre si. */
function coluna(n: number, vao = 3.8): number[] {
  const g = n > 1 ? Math.min(0.58, vao / (n - 1)) : 0
  return Array.from({ length: n }, (_, i) => ((n - 1) / 2) * g - i * g)
}

type Relogio = { current: number }
const agora = () => performance.now() / 1000

/** Uma corrente que se desenha do começo ao fim, numa janela do relógio. */
function Corrente({ pts, cor, largura, nivel, desde, em, dur = 0.7, opacidade = 1, tracejada = false }: { pts: [number, number][]; cor: THREE.Color; largura: number; nivel: Relogio; desde: number; em: number; dur?: number; opacidade?: number; tracejada?: boolean }) {
  const linha = useRef<Line2 | null>(null)
  const vecs = useMemo(() => pts.map(([x, y]) => new THREE.Vector3(x, y, 0.01)), [pts])
  useFrame(() => {
    const l = linha.current
    if (!l) return
    const f = THREE.MathUtils.clamp((agora() - desde - em) / dur, 0, 1)
    l.geometry.instanceCount = Math.max(1, Math.round((vecs.length - 1) * f))
    l.material.opacity = opacidade * nivel.current * (f > 0 ? 1 : 0)
  })
  return <Line ref={(l) => void (linha.current = l as unknown as Line2 | null)} points={vecs} color={cor} lineWidth={largura} transparent opacity={0} depthWrite={false} dashed={tracejada} dashSize={0.05} gapSize={0.04} />
}

/** Um ponto redondo no plano do diagrama, que aparece numa janela do relógio. */
function Ponto({ x, y, r, cor, nivel, desde, em, cheio = true }: { x: number; y: number; r: number; cor: THREE.Color; nivel: Relogio; desde: number; em: number; cheio?: boolean }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null!)
  useFrame(() => {
    mat.current.opacity = nivel.current * THREE.MathUtils.smoothstep(agora() - desde - em, 0, 0.4)
  })
  return (
    <mesh position={[x, y, 0.02]}>
      {cheio ? <circleGeometry args={[r, 32]} /> : <ringGeometry args={[r * 0.72, r, 32]} />}
      <meshBasicMaterial ref={mat} color={cor} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

type Linha = { id: string; essencial: boolean; resto?: number }

/** Uma coluna: as primeiras linhas, e o resto junto numa só. */
function juntar(lista: Linha[]): Linha[] {
  if (lista.length <= MAX) return lista
  const resto = lista.slice(MAX - 1)
  return [...lista.slice(0, MAX - 1), { id: '', essencial: resto.some((x) => x.essencial), resto: resto.length }]
}

export function Diagrama({
  ctx,
  id,
  etapas,
  artigos,
  conjunto,
  nivel,
  onAbrir,
  onFechar,
}: {
  ctx: Contexto
  id: string
  /** as etapas de produção, na ordem do processo */
  etapas: string[]
  artigos: string[]
  /** o que depende do elo (ele incluído) */
  conjunto: Set<string>
  nivel: Relogio
  onAbrir: (id: string) => void
  onFechar: () => void
}) {
  const { cadeia, ix } = ctx
  const no = (x: string) => ix.porId.get(x)
  const nome = (x: string) => CURTO[x] ?? no(x)?.nome ?? x
  const desde = useMemo(() => agora(), [])
  const { LX, RX, ROW } = ELO
  const alcanceDe = (x: string) => no(x)?.alcance_cadeia ?? 0

  // de que é feito (sem as capacitações, que vão à parte) e o que o usa
  const entram: Aresta[] = useMemo(() => (ix.insumosDe.get(id) ?? []).map((i) => cadeia.arestas[i]).filter((a) => a.tipo !== 'visual' && no(a.de)), [id]) // eslint-disable-line react-hooks/exhaustive-deps
  const ins = useMemo(
    () =>
      juntar(
        entram
          .filter((a) => a.tipo !== 'capacitação')
          .sort((a, b) => alcanceDe(b.de) - alcanceDe(a.de))
          .map((a) => ({ id: a.de, essencial: a.essencial !== false })),
      ),
    [entram], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const capacitacoes = entram.filter((a) => a.tipo === 'capacitação').map((a) => a.de)
  const outs = useMemo(
    () =>
      juntar(
        (ix.dependentesDe.get(id) ?? [])
          .map((i) => cadeia.arestas[i])
          .filter((a) => a.tipo !== 'visual' && no(a.para))
          .sort((a, b) => Number(b.essencial !== false) - Number(a.essencial !== false) || alcanceDe(b.para) - alcanceDe(a.para))
          .map((a) => ({ id: a.para, essencial: a.essencial !== false })),
      ),
    [id], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const inY = useMemo(() => coluna(ins.length), [ins])
  const outY = useMemo(() => coluna(outs.length), [outs])
  const caminhosIn = useMemo(() => ins.map((_, i) => curvaS([LX + 0.1, inY[i]], [-ANEL, 0])), [ins, inY, LX])
  const caminhosOut = useMemo(() => outs.map((_, i) => curvaS([ANEL, 0], [RX - 0.1, outY[i]])), [outs, outY, RX])

  // a linha do processo, no alto: as etapas na ordem; as que param, em vermelho; uma subida até as primeiras
  const xs = useMemo(() => etapas.map((_, k) => -3.9 + (7.8 * k) / Math.max(1, etapas.length - 1)), [etapas])
  const param = etapas.map((e) => conjunto.has(e))
  const primeiras = useMemo(() => {
    // as etapas que param sem que a anterior pare: é ali que o elo entra no processo
    return etapas.map((e, k) => conjunto.has(e) && e !== id && (k === 0 || !conjunto.has(etapas[k - 1]))).map((v, k) => (v ? k : -1)).filter((k) => k >= 0)
  }, [etapas, conjunto, id])
  const subidas = useMemo(() => primeiras.map((k) => subida([0, ANEL], [xs[k], ROW - 0.09])), [primeiras, xs, ROW])
  const produtos = artigos.filter((a) => conjunto.has(a))
  const linhaProcesso = useMemo(() => xs.slice(1).map((x, k) => [[xs[k] + 0.09, ROW], [x - 0.09, ROW]] as [number, number][]), [xs, ROW])

  // os nomes entram depois das correntes
  const [tarde, setTarde] = useState(0)
  useFrame(() => {
    const t = agora() - desde
    const prox = t > 1.9 ? 3 : t > 1.2 ? 2 : t > 0.45 ? 1 : 0
    if (prox !== tarde) setTarde(prox)
  })
  const n = no(id)
  // a mesma conta da ficha: etapas, insumos, materiais e artigos que dependem do elo
  const dependem = no(id)?.jusante ?? [...conjunto].filter((x) => x !== id && no(x)?.lado !== 'nucleo').length
  const ehEtapa = etapas.includes(id)

  return (
    <group>
      {/* a linha do processo */}
      {linhaProcesso.map((pts, k) => (
        <Corrente key={`l${k}`} pts={pts} cor={param[k] && param[k + 1] ? C.vermelho : C.tinta} largura={param[k] && param[k + 1] ? 2 : 1.2} nivel={nivel} desde={desde} em={0.1 + k * 0.05} dur={0.3} opacidade={param[k] && param[k + 1] ? 0.85 : 0.35} />
      ))}
      {etapas.map((e, k) => (
        <Ponto key={e} x={xs[k]} y={ROW} r={0.07} cor={e === id ? C.conhaque : param[k] ? C.vermelho : C.tinta} nivel={nivel} desde={desde} em={0.1 + k * 0.05} cheio={param[k] || e === id} />
      ))}
      {subidas.map((pts, i) => (
        <Corrente key={`s${i}`} pts={pts} cor={C.vermelho} largura={1.6} nivel={nivel} desde={desde} em={1.6 + i * 0.08} opacidade={0.6} />
      ))}
      {/* o que entra e o que sai */}
      {caminhosIn.map((pts, i) => (
        <Corrente key={`i${i}`} pts={pts} cor={C.tinta} largura={ins[i].essencial ? 1.8 : 1.1} nivel={nivel} desde={desde} em={0.3 + i * 0.08} opacidade={0.75} tracejada={!ins[i].essencial} />
      ))}
      {caminhosOut.map((pts, i) => (
        <Corrente key={`o${i}`} pts={pts} cor={outs[i].essencial ? C.vermelho : C.azul} largura={2.2} nivel={nivel} desde={desde} em={1.1 + i * 0.08} />
      ))}
      {ins.map((_, i) => (
        <Ponto key={`pi${i}`} x={LX} y={inY[i]} r={0.045} cor={C.tinta} nivel={nivel} desde={desde} em={0.3 + i * 0.06} />
      ))}
      {outs.map((x, i) => (
        <Ponto key={`po${i}`} x={RX} y={outY[i]} r={0.05} cor={x.essencial ? C.vermelho : C.azul} nivel={nivel} desde={desde} em={1.5 + i * 0.06} />
      ))}
      {/* o elo: anel e disco */}
      <Ponto x={0} y={0} r={ANEL} cor={C.conhaque} nivel={nivel} desde={desde} em={0} cheio={false} />
      <Ponto x={0} y={0} r={DISCO} cor={C.conhaque} nivel={nivel} desde={desde} em={0.9} />

      {/* nomes */}
      {tarde >= 1 && (
        <Html position={[0, -ANEL - 0.08, 0]} zIndexRange={[6, 0]}>
          <span className="elo-centro">
            <b>{n?.nome ?? id}</b>
            <em>
              {n?.lado === 'oferta' ? `alcance ${pct(n.alcance_cadeia)} · ` : ''}
              {dependem} elos dependem dele · {produtos.length} de {artigos.length} produtos vendidos
            </em>
            <button className="elo-voltar" onClick={onFechar}>
              <span aria-hidden>←</span> voltar ao cone
            </button>
          </span>
        </Html>
      )}
      {tarde >= 1 &&
        ins.map((x, i) => (
          <Html key={`ni${x.id || 'resto'}`} position={[LX - 0.1, inY[i], 0]} zIndexRange={[7, 0]}>
            <button className={`elo-link elo-in${x.essencial ? '' : ' opcional'}`} disabled={!x.id} onClick={() => x.id && onAbrir(x.id)}>
              {x.id && no(x.id)?.comercio && <b>{musd(no(x.id)!.comercio!.musd_2025)}</b>}
              {x.id ? nome(x.id) : `outros ${x.resto} insumos`}
              {x.id && !x.essencial && <i>opcional</i>}
            </button>
          </Html>
        ))}
      {tarde >= 1 && ins.length === 0 && (
        <Html position={[LX - 0.1, 0, 0]} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
          <span className="elo-vazio">recurso natural: nada acima dele na cadeia</span>
        </Html>
      )}
      {tarde >= 1 && capacitacoes.length > 0 && (
        <Html position={[LX - 0.1, Math.min(...inY, 0) - 0.6, 0]} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
          <span className="elo-capacitacoes">
            <i>também precisa de</i>
            {capacitacoes.slice(0, 4).map((x) => no(x)?.nome).join(' · ')}
            {capacitacoes.length > 4 ? ` · e mais ${capacitacoes.length - 4}` : ''}
          </span>
        </Html>
      )}
      {tarde >= 2 &&
        outs.map((x, i) => (
          <Html key={`no${x.id || 'resto'}`} position={[RX + 0.1, outY[i], 0]} zIndexRange={[7, 0]}>
            <button className={`elo-link elo-out${x.essencial ? ' para' : ''}`} disabled={!x.id || !no(x.id) || no(x.id)!.lado === 'nucleo'} onClick={() => x.id && onAbrir(x.id)}>
              {x.id && no(x.id)?.lado === 'oferta' && <b>{pct(no(x.id)!.alcance_cadeia)}</b>}
              {x.id ? nome(x.id) : `outros ${x.resto} usos`}
              {x.id && !x.essencial && <i>tem alternativa</i>}
            </button>
          </Html>
        ))}
      {tarde >= 3 &&
        etapas.map((e, k) => (
          <Html key={`ne${e}`} position={[xs[k], ROW + 0.12, 0]} zIndexRange={[6, 0]}>
            <button className={`elo-etapa${param[k] ? ' para' : ''}${e === id ? ' ele' : ''}`} onClick={() => e !== id && onAbrir(e)}>
              {nome(e)}
            </button>
          </Html>
        ))}
      {tarde >= 3 && (
        <Html position={[0, ROW + 0.78, 0]} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
          <span className="elo-processo">
            {ehEtapa ? 'Etapa do processo' : 'O processo'}
            {produtos.length > 0 ? (
              <>
                {' '}
                · sem ele param: <b>{produtos.map((a) => no(a)?.nome ?? a).join(', ')}</b>
              </>
            ) : (
              ' · nenhum produto vendido para sem ele'
            )}
          </span>
        </Html>
      )}
    </group>
  )
}
