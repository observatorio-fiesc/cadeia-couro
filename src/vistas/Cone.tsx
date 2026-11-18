// Cone 3D da oferta: Viposa no topo, matérias-primas na base. Ligações tracejadas (pesponto), lentes de cor,
// caminho aceso ao escolher um elo, rótulos que aparecem quando o elo gira para a frente.

import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Billboard, Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Cadeia, No } from '../dados/cadeia'
import type { Anel, Ponto } from '../lib/layout'
import { yCamada } from '../lib/layout'
import { COR, aparencia, tamanho, type Lente } from '../lib/lentes'
import { musd, pct } from '../lib/formato'

export type PropsCone = {
  cadeia: Cadeia
  pos: Map<string, Ponto>
  aneis: Anel[]
  nos: No[]
  arestasIdx: number[]
  lente: Lente
  selecionado: string | null
  destaqueNos: Set<string> | null
  destaqueArestas: Set<number> | null
  hover: string | null
  rotulosFixos: Set<string>
  onHover: (id: string | null) => void
  onSelecionar: (id: string | null) => void
  aneisRef: React.RefObject<Record<string, HTMLDivElement | null>>
  nucleoRef: React.RefObject<HTMLDivElement | null>
}

const ALVO = new THREE.Vector3(0, -0.9, 0)
// preferência do sistema por menos movimento: o cone não gira sozinho
const MENOS_MOVIMENTO = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function Cone(p: PropsCone) {
  return (
    <Canvas
      className="cena"
      camera={{ position: [0, 7.2, 27], fov: 34 }}
      dpr={[1, 2]}
      resize={{ scroll: false, debounce: 0 }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => p.onSelecionar(null)}
    >
      <Cena {...p} />
      <OrbitControls
        makeDefault
        target={ALVO}
        enablePan
        enableDamping
        dampingFactor={0.08}
        autoRotate={!p.selecionado && !MENOS_MOVIMENTO}
        autoRotateSpeed={0.32}
        minDistance={10}
        maxDistance={42}
      />
    </Canvas>
  )
}

function Cena(p: PropsCone) {
  const { cadeia, pos } = p
  const destaqueIdx = useMemo(() => (p.destaqueArestas ? p.arestasIdx.filter((i) => p.destaqueArestas!.has(i)) : []), [p.destaqueArestas, p.arestasIdx])
  const vizinhosSel = useMemo(() => {
    const s = new Set<string>()
    if (!p.selecionado) return s
    for (const i of p.arestasIdx) {
      const a = cadeia.arestas[i]
      if (a.tipo === 'visual') continue
      if (a.de === p.selecionado) s.add(a.para)
      if (a.para === p.selecionado) s.add(a.de)
    }
    return s
  }, [cadeia, p.selecionado, p.arestasIdx])

  return (
    <group>
      <Guias aneis={p.aneis} />
      <Ligacoes cadeia={cadeia} pos={pos} indices={p.arestasIdx} cor={COR.cru} opacidade={p.selecionado ? 0.05 : 0.15} />
      {destaqueIdx.length > 0 && <Ligacoes cadeia={cadeia} pos={pos} indices={destaqueIdx} cor={COR.conhaque} opacidade={0.9} />}
      {p.nos.map((n) => {
        const pt = pos.get(n.id)
        if (!pt) return null
        const ap = aparencia(n, p.lente)
        const noCaminho = !p.destaqueNos || p.destaqueNos.has(n.id) || n.lado === 'nucleo'
        const sel = p.selecionado === n.id
        const op = sel ? 1 : noCaminho ? ap.opacidade : ap.opacidade * 0.2
        const r = tamanho(n, 1, 0) * (sel || p.hover === n.id ? 1.35 : 1)
        const ativo = sel || p.hover === n.id || vizinhosSel.has(n.id)
        const mostrarRotulo = n.lado !== 'nucleo' && (ativo || (!p.selecionado && p.rotulosFixos.has(n.id)))
        return (
          <Marca key={n.id} no={n} pt={pt} cor={sel ? COR.conhaque : ap.cor} raio={r} opacidade={op} cheio={ap.cheio || sel}
            onHover={p.onHover} onSelecionar={p.onSelecionar}>
            {mostrarRotulo && <Rotulo no={n} destaque={sel} fixo={!ativo && p.lente === 'estrutura'} lente={p.lente} />}
          </Marca>
        )
      })}
      <Projecoes aneis={p.aneis} aneisRef={p.aneisRef} nucleoRef={p.nucleoRef} />
    </group>
  )
}

function Guias({ aneis }: { aneis: Anel[] }) {
  const objetos = useMemo(() => {
    const lista: THREE.Line[] = []
    const mat = new THREE.LineDashedMaterial({ color: COR.cru, transparent: true, opacity: 0.16, dashSize: 0.18, gapSize: 0.14, depthWrite: false })
    for (const a of aneis) {
      if (a.raio === 0) continue
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 160; i++) {
        const t = (i / 160) * Math.PI * 2
        pts.push(new THREE.Vector3(a.raio * Math.cos(t), a.y, a.raio * Math.sin(t)))
      }
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat)
      l.computeLineDistances()
      lista.push(l)
    }
    const topo = yCamada(0)
    const eixo = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, topo + 0.6, 0), new THREE.Vector3(0, yCamada(4) - 0.6, 0)]),
      new THREE.LineDashedMaterial({ color: COR.cru, transparent: true, opacity: 0.22, dashSize: 0.1, gapSize: 0.1 }),
    )
    eixo.computeLineDistances()
    lista.push(eixo)
    return lista
  }, [aneis])
  return (
    <group>
      {objetos.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </group>
  )
}

function Ligacoes({ cadeia, pos, indices, cor, opacidade }: { cadeia: Cadeia; pos: Map<string, Ponto>; indices: number[]; cor: string; opacidade: number }) {
  const ref = useRef<THREE.LineSegments>(null)
  const geom = useMemo(() => {
    const pts: number[] = []
    for (const i of indices) {
      const a = cadeia.arestas[i]
      const p1 = pos.get(a.de)
      const p2 = pos.get(a.para)
      if (!p1 || !p2) continue
      pts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [cadeia, pos, indices])
  useLayoutEffect(() => {
    ref.current?.computeLineDistances()
  }, [geom])
  return (
    <lineSegments ref={ref} geometry={geom}>
      <lineDashedMaterial color={cor} transparent opacity={opacidade} dashSize={0.12} gapSize={0.08} depthWrite={false} />
    </lineSegments>
  )
}

type PropsMarca = {
  no: No
  pt: Ponto
  cor: string
  raio: number
  opacidade: number
  cheio: boolean
  onHover: (id: string | null) => void
  onSelecionar: (id: string | null) => void
  children?: React.ReactNode
}

function Marca({ no, pt, cor, raio, opacidade, cheio, onHover, onSelecionar, children }: PropsMarca) {
  return (
    <Billboard position={[pt.x, pt.y, pt.z]}>
      <mesh>
        <ringGeometry args={[raio * 0.66, raio, 40]} />
        <meshBasicMaterial color={cor} transparent opacity={opacidade} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {cheio && (
        <mesh>
          <circleGeometry args={[raio * 0.42, 32]} />
          <meshBasicMaterial color={cor} transparent opacity={opacidade * 0.9} depthWrite={false} />
        </mesh>
      )}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(no.id)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          onHover(null)
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          e.stopPropagation()
          onSelecionar(no.id)
        }}
      >
        <circleGeometry args={[Math.max(raio * 1.5, 0.22), 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      {children}
    </Billboard>
  )
}

const ROTULO_CURTO: Record<string, string> = {
  'sis.recurtimento': 'Recurtimento (crust)',
  'sis.manufatura': 'Cabedais e calçados',
  'sis.utilidades': 'Água e efluente',
  'sis.transporte': 'Transporte',
  'sis.classificacao': 'Classificação',
}
const siglas = (planta?: string) => [...new Set((planta ?? '').match(/\b(MT|MS|SC|PR|SP|RS)\b/g) ?? [])].join('·')

function Rotulo({ no, destaque, fixo, lente }: { no: No; destaque: boolean; fixo: boolean; lente: Lente }) {
  const grupo = useRef<THREE.Group>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const { camera } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!grupo.current || !caixa.current) return
    grupo.current.getWorldPosition(v)
    const atras = fixo && v.x * camera.position.x + v.z * camera.position.z < -0.15
    if (atras !== caixa.current.classList.contains('rotulo-fundo')) caixa.current.classList.toggle('rotulo-fundo', atras)
    v.project(camera)
    const esq = v.x < -0.01
    if (esq !== caixa.current.classList.contains('rotulo-esq')) caixa.current.classList.toggle('rotulo-esq', esq)
  })
  let extra = ''
  if (lente === 'ormuz' && no.comercio) extra = `Golfo ${pct((no.comercio.ormuz_2025 ?? 0) + (no.comercio.oma_2025 ?? 0))}`
  else if (lente === 'china' && no.comercio) extra = `China ${pct(no.comercio.china_2025)}`
  else if (lente === 'importado' && no.comercio) extra = musd(no.comercio.musd_2025)
  else if (no.camada >= 2) extra = pct(no.alcance_cadeia)
  else if (no.camada === 1) extra = siglas(no.planta)
  const classe = ['rotulo', destaque && 'rotulo-destaque', no.camada === 1 && 'rotulo-forte'].filter(Boolean).join(' ')
  return (
    <group ref={grupo}>
      <Html position={[0, 0, 0]} zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={caixa} className={classe}>
          <span>{ROTULO_CURTO[no.id] ?? no.nome}</span>
          {extra && <em>{extra}</em>}
        </div>
      </Html>
    </group>
  )
}

// Nomes dos anéis numa coluna fixa à esquerda e o rótulo da Viposa ao lado do topo do cone: as posições
// acompanham a projeção a cada quadro (o primeiro <Html> do drei não monta; por isso o rótulo do topo é DOM comum)
function Projecoes({ aneis, aneisRef, nucleoRef }: { aneis: Anel[]; aneisRef: React.RefObject<Record<string, HTMLDivElement | null>>; nucleoRef: React.RefObject<HTMLDivElement | null> }) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const refs = aneisRef.current
    if (refs) {
      // ponto do anel mais à esquerda na tela: direção perpendicular à visada da câmera, no plano do chão
      const n = Math.hypot(camera.position.x, camera.position.z) || 1
      const ex = -camera.position.z / n
      const ez = camera.position.x / n
      for (const a of aneis) {
        const el = refs[a.chave]
        if (!el) continue
        v.set(a.raio * ex, a.y, a.raio * ez).project(camera)
        const x = (v.x * 0.5 + 0.5) * size.width - 22
        v.set(0, a.y, 0).project(camera)
        const y = (-v.y * 0.5 + 0.5) * size.height
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-100%, -50%)`
      }
    }
    const n = nucleoRef.current
    if (n) {
      v.set(0, yCamada(0), 0).project(camera)
      n.style.transform = `translate(${((v.x * 0.5 + 0.5) * size.width + 30).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * size.height).toFixed(1)}px) translateY(-50%)`
    }
  })
  return null
}
