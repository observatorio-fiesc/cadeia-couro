// O palco da aba Modelo 3D: o relógio das transições, a câmera, o plano da frente, o gráfico de
// composição ao lado do que está em foco e os rótulos em HTML presos a pontos da cena.
import { useEffect, useMemo, useRef, type ComponentRef, type MutableRefObject } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import { BRANCO, SUAVE_CAMERA, TAXA_FADE, TAXA_LINHAS_SAI, expo, linear, MENOS_MOVIMENTO } from './cena'
import { DESLOC_PX, ESTACOES, GIRO_VISTA, GRAF_ALTURA, largo, type Enquadramento } from './lugares'
import type { Alvo, Anim, Item, ModoRotulo } from './estado'

/**
 * O que está em foco (a peça, o gráfico, as camadas: renderOrder 10 em diante) é desenhado por cima do
 * contexto, como a seleção no visualizador do submarino: a profundidade é limpa antes deles. Assim um animal
 * recuado, ou um órgão dele, nunca recorta a peça escolhida. Entre si, eles continuam se escondendo.
 */
export function PlanoDaFrente() {
  const obj = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3))
    const m = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, transparent: true })
    const mesh = new THREE.Mesh(g, m)
    mesh.renderOrder = 9.9
    mesh.frustumCulled = false
    mesh.onBeforeRender = (r) => r.clearDepth()
    return mesh
  }, [])
  return <primitive object={obj} />
}

// em desenvolvimento, a cena na janela, para medir e depurar (como no visualizador do submarino)
export function AlcaDev() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) (window as unknown as { __three: unknown }).__three = { gl, scene, camera }
  }, [gl, scene, camera])
  return null
}

// o relógio de tudo o que não é a região: presença dos animais, interior, da bota, camadas e gráfico
const SEXOS = ['boi', 'vaca'] as const
const DUR_CAMADAS = MENOS_MOVIMENTO ? 0.2 : 1.1 // segundos para as camadas aparecerem na pilha
export function Animador({ anim }: { anim: MutableRefObject<Anim> }) {
  useFrame((_, dt) => {
    const a = anim.current
    // uma aba que volta do segundo plano não salta
    const d = Math.min(dt, 0.05)
    a.t += d
    for (const s of SEXOS) {
      a.vis[s] = expo(a.vis[s], a.visA[s], d, TAXA_FADE)
      a.corpo[s] = expo(a.corpo[s], a.corpoA[s], d, TAXA_FADE)
      a.int[s] = expo(a.int[s], a.intA[s], d, TAXA_FADE)
    }
    for (const e of ESTACOES) a.est[e] = expo(a.est[e], a.estA[e], d, TAXA_FADE)
    // camadas: aparecem no lugar, uma depois da outra; somem juntas
    a.pele = linear(a.pele, a.peleA, d / (a.peleA > a.pele ? DUR_CAMADAS : DUR_CAMADAS * 0.6))
    // o gráfico ao lado entra depois do que ele descreve e sai antes
    const pronto = a.grafDe === 'pele' ? a.pele : a.peca
    const quer = a.grafA > 0 && pronto > 0.85 ? 1 : 0
    a.graf = expo(a.graf, quer, d, quer ? 3 : TAXA_LINHAS_SAI)
  })
  return null
}

/**
 * A câmera, como no visualizador do submarino: camera-controls amortece alvo, distância e ângulos juntos
 * (smoothTime), girando em volta do alvo e nunca pelo caminho longo. Sem giro automático e sem controle
 * do usuário (enabled = false desliga só o mouse e o toque; os voos programados continuam): a câmera só
 * anda quando algo é escolhido, e todos os enquadramentos são do mesmo lado da cena (lugares.ts).
 */
export function Diretor({ enquadramento }: { enquadramento: Enquadramento }) {
  const ref = useRef<ComponentRef<typeof CameraControls>>(null)
  const primeiro = useRef(true)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const { pos, alvo } = enquadramento
    c.setLookAt(pos.x, pos.y, pos.z, alvo.x, alvo.y, alvo.z, !primeiro.current)
    // o ângulo acumulado por voltas do usuário não vira giro: o voo vai pelo lado mais curto
    c.normalizeRotations()
    primeiro.current = false
  }, [enquadramento])
  return <CameraControls ref={ref} makeDefault enabled={false} smoothTime={SUAVE_CAMERA} />
}

// gráfico ao lado: um ladrilho por químico, na proporção da dose
export type Ladrilho = { y: number; h: number }
export function montarLadrilhos(itens: { valor: number }[]): Ladrilho[] {
  const total = itens.reduce((t, q) => t + q.valor, 0) || 1
  const gap = 0.02
  const util = GRAF_ALTURA - gap * (itens.length - 1)
  let y = GRAF_ALTURA / 2
  return itens.map((q) => {
    const h = (q.valor / total) * util
    const c = y - h / 2
    y -= h + gap
    return { y: c, h }
  })
}
export function Grafico3D(p: { itens: Item[]; ladrilhos: Ladrilho[]; base: THREE.Vector3; anim: MutableRefObject<Anim>; foco: string | null; onHover: (id: string | null) => void; onClique: (id: string) => void }) {
  const grupo = useRef<THREE.Group>(null)
  const lado = 0.13
  const ladr = useMemo(
    () =>
      p.itens.map((q, i) => {
        const l = p.ladrilhos[i]
        const geo = new THREE.BoxGeometry(lado, l.h, lado)
        const mat = new THREE.MeshBasicMaterial({ color: q.cor, transparent: true, opacity: 0.95 })
        const malha = new THREE.Mesh(geo, mat)
        malha.position.set(0, l.y, 0)
        malha.renderOrder = 10
        const arestas = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: BRANCO, transparent: true, opacity: 0.5 }))
        arestas.position.copy(malha.position)
        arestas.renderOrder = 11
        return { id: q.id, malha, mat, arestas, geo }
      }),
    [p.itens, p.ladrilhos],
  )
  useEffect(() => () => ladr.forEach((l) => l.geo.dispose()), [ladr])
  // foco de cada ladrilho, amortecido
  const foco = useMemo(() => ladr.map(() => 1), [ladr])
  useFrame((_, dt) => {
    const g = grupo.current
    if (!g) return
    const d = Math.min(dt, 0.05)
    const v = p.anim.current.graf
    g.visible = v > 0.01
    g.position.copy(p.base)
    // o gráfico de frente para a câmera, como na vista de antes
    g.rotation.y = GIRO_VISTA
    ladr.forEach((l, i) => {
      const apagado = !!p.foco && p.foco !== l.id
      foco[i] = expo(foco[i], apagado ? 0.19 : 1, d, TAXA_FADE * 1.6)
      l.mat.opacity = v * 0.95 * foco[i]
      ;(l.arestas.material as THREE.LineBasicMaterial).opacity = v * (p.foco === l.id ? 1 : 0.45 * foco[i])
    })
  })
  return (
    <group ref={grupo} visible={false}>
      {ladr.map((l) => (
        <group key={l.id}>
          <primitive
            object={l.malha}
            onPointerMove={(e: ThreeEvent<PointerEvent>) => {
              if (p.anim.current.graf < 0.5) return
              e.stopPropagation()
              p.onHover(l.id)
            }}
            onPointerOut={() => p.onHover(null)}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              if (p.anim.current.graf < 0.5 || e.delta > 6) return
              e.stopPropagation()
              p.onClique(l.id)
            }}
          />
          <primitive object={l.arestas} />
        </group>
      ))}
    </group>
  )
}

// O quadro de decomposição ocupa a esquerda: o centro da cena anda para a direita. Com o cartão de cadeia
// aberto à direita, a cena volta para o meio entre os dois. O deslocamento anda amortecido, sem salto.
const LARGURA_CARTAO = 340
export function Deslocamento({ cartao }: { cartao: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const px = useRef<number | null>(null)
  useFrame((_, dt) => {
    const alvo = largo(size.width) ? DESLOC_PX - (cartao ? LARGURA_CARTAO / 2 : 0) : 0
    px.current = px.current == null ? alvo : expo(px.current, alvo, Math.min(dt, 0.05), TAXA_FADE)
    camera.setViewOffset(size.width, size.height, -px.current, 0, size.width, size.height)
    camera.updateProjectionMatrix()
  })
  return null
}

/** Retângulo na tela, em pixels. */
type Ret = { x0: number; y0: number; x1: number; y1: number }
const cruza = (a: Ret, b: Ret) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

/**
 * Rótulos em HTML presos a pontos da cena, com linha de ligação. Nenhum rótulo cobre o que está sendo
 * mostrado: a vista diz, a cada quadro, o que está em foco (obstaculos: conjuntos de pontos no mundo);
 * cada conjunto vira um retângulo na tela, com folga, e os rótulos saem dele: as colunas da esquerda e
 * da direita andam juntas para o lado livre; os rótulos soltos vão para o lado livre mais próximo.
 */
export function Projetor({
  alvos,
  elementos,
  caminhos,
  obstaculos,
}: {
  alvos: MutableRefObject<Alvo[]>
  elementos: MutableRefObject<Map<string, HTMLElement>>
  caminhos: MutableRefObject<Map<string, SVGPathElement>>
  obstaculos: MutableRefObject<() => THREE.Vector3[][]>
}) {
  const v = useMemo(() => new THREE.Vector3(), [])
  const alturas = useMemo(() => new WeakMap<HTMLElement, number>(), [])
  const larguras = useMemo(() => new WeakMap<HTMLElement, number>(), [])
  useFrame(({ camera, size, gl }) => {
    // o que está em foco, na tela
    const FOLGA = 12
    const rets: Ret[] = []
    for (const conj of obstaculos.current()) {
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      for (const p of conj) {
        v.copy(p).project(camera)
        if (v.z > 1 || v.z < -1) continue
        const x = (v.x * 0.5 + 0.5) * size.width
        const y = (-v.y * 0.5 + 0.5) * size.height
        x0 = Math.min(x0, x)
        x1 = Math.max(x1, x)
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y)
      }
      if (x1 > x0) rets.push({ x0: x0 - FOLGA, y0: y0 - FOLGA, x1: x1 + FOLGA, y1: y1 + FOLGA })
    }
    // painéis de HTML sobre a cena que um rótulo também não pode cobrir: o cartão de cadeia, a faixa de
    // controles com a legenda acima dela
    const telas: Ret[] = []
    const base = gl.domElement.getBoundingClientRect()
    document.querySelectorAll<HTMLElement>('.ver-cadeia, .controles').forEach((el) => {
      const b = el.getBoundingClientRect()
      telas.push({ x0: b.left - base.left - 8, y0: b.top - base.top - 8, x1: b.right - base.left + 8, y1: b.bottom - base.top + 8 })
    })
    // a área onde um rótulo pode ficar: fora do quadro de decomposição, dentro da tela
    const xMin = largo(size.width) ? 370 : 12
    const xMax = size.width - 12
    const yMin = 60
    const yMax = size.height - 70
    type R = { al: Alvo; m: ModoRotulo; el: HTMLElement; ax: number; ay: number; lx: number; ly: number; pts: { x: number; y: number }[]; h: number; w: number }
    const rs: R[] = []
    for (const al of alvos.current) {
      const el = elementos.current.get(al.id)
      const pth = caminhos.current.get(al.id)
      if (!el) continue
      const pts: { x: number; y: number }[] = []
      for (const pt of al.pontos(camera)) {
        v.copy(pt).project(camera)
        if (v.z > 1 || v.z < -1) continue
        pts.push({ x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height })
      }
      if (!pts.length) {
        el.style.opacity = '0'
        el.style.pointerEvents = 'none'
        pth?.setAttribute('d', '')
        continue
      }
      // a altura muda quando o rótulo ganha uma linha (passar o mouse, lente): mede sempre
      const h = el.offsetHeight || alturas.get(el) || 16
      alturas.set(el, h)
      const w = el.offsetWidth || larguras.get(el) || 120
      larguras.set(el, w)
      let ax = pts[0].x
      let ay = pts[0].y
      let lx = ax
      let ly = ay
      if (al.modo === 'esq' || al.modo === 'dir' || al.modo === 'painel') {
        let ext = pts[0]
        for (const q of pts) if (al.modo === 'esq' ? q.x < ext.x : q.x > ext.x) ext = q
        ax = ext.x
        ay = ext.y
        lx = ax + (al.modo === 'esq' ? -46 : 46)
        ly = ay
      } else if (al.modo === 'legenda') {
        lx = ax + (al.dx ?? 26)
      } else if (al.modo === 'baixo') {
        lx = ax + (al.dx ?? 0)
        ly = ay + (al.dy ?? 30)
      } else {
        lx = ax + (al.dx ?? 60)
        ly = ay + (al.dy ?? -70)
      }
      rs.push({ al, m: al.modo, el, ax, ay, lx, ly, pts, h, w })
    }
    // a caixa de cada rótulo na tela, conforme o lado para onde ele cresce
    const caixa = (r: R): Ret => {
      const m = r.m
      if (m === 'esq') return { x0: r.lx - r.w, x1: r.lx, y0: r.ly - r.h / 2, y1: r.ly + r.h / 2 }
      if (m === 'perto') return { x0: r.lx, x1: r.lx + r.w, y0: r.ly - r.h, y1: r.ly }
      if (m === 'baixo') return { x0: r.lx - r.w / 2, x1: r.lx + r.w / 2, y0: r.ly, y1: r.ly + r.h }
      return { x0: r.lx, x1: r.lx + r.w, y0: r.ly - r.h / 2, y1: r.ly + r.h / 2 }
    }
    // colunas: os rótulos da esquerda e da direita se alinham, como as chamadas de um desenho técnico,
    // e a coluna inteira passa para fora do que está em foco
    const lateral = (g: R[], lado: 'esq' | 'dir', fixa?: number) => {
      for (const r of g) {
        r.m = lado
        let ext = r.pts[0]
        for (const q of r.pts) if (lado === 'esq' ? q.x < ext.x : q.x > ext.x) ext = q
        r.ax = ext.x
        r.ay = ext.y
      }
      let col = fixa ?? (lado === 'esq' ? Math.min(...g.map((r) => r.ax)) - 46 : Math.max(...g.map((r) => r.ax)) + 46)
      for (let passo = 0; passo < 3; passo++)
        for (const ret of rets)
          for (const r of g) {
            r.lx = col
            if (cruza(caixa(r), ret)) col = lado === 'esq' ? Math.min(col, ret.x0) : Math.max(col, ret.x1)
          }
      for (const r of g) r.lx = col
    }
    // uma coluna que cairia sob um painel da tela (o cartão de cadeia), sob o quadro de decomposição ou
    // fora da tela passa para o outro lado do que está em foco
    const ruim = (g: R[]) =>
      g.some((r) => {
        const c = caixa(r)
        return telas.some((t) => cruza(c, t)) || c.x0 < xMin || c.x1 > xMax
      })
    for (const modo of ['esq', 'dir'] as const) {
      const g = rs.filter((r) => r.al.modo === modo)
      if (!g.length) continue
      lateral(g, modo)
      if (!ruim(g)) continue
      const outro = modo === 'esq' ? 'dir' : 'esq'
      lateral(g, outro)
      if (!ruim(g)) continue
      lateral(g, modo)
      // nenhum lado serve à coluna inteira: só os rótulos que esbarram mudam de lado, um a um
      for (const r of g) if (ruim([r])) lateral([r], outro)
    }
    const painel = rs.filter((r) => r.al.modo === 'painel')
    if (painel.length) {
      for (let passo = 0; passo < 3; passo++) for (const ret of rets) for (const r of painel) if (cruza(caixa(r), ret)) r.lx = Math.max(r.lx, ret.x1)
    }
    // um rótulo solto vai para o lado livre mais próximo: em cima, embaixo, à esquerda ou à direita
    const afastar = (r: R) => {
      const todos = [...rets, ...telas]
      for (let passo = 0; passo < 3; passo++) {
        const ret = todos.find((x) => cruza(caixa(r), x))
        if (!ret) return
        if (r.m === 'baixo') {
          r.ly = ret.y1
          continue
        }
        const op = [
          { lx: r.lx, ly: ret.y0 }, // em cima: a base do rótulo encosta no topo
          { lx: r.lx, ly: ret.y1 + r.h }, // embaixo
          { lx: ret.x0 - r.w, ly: r.ly }, // à esquerda
          { lx: ret.x1, ly: r.ly }, // à direita
        ].filter((o) => o.lx >= xMin && o.lx + r.w <= xMax && o.ly - r.h >= yMin && o.ly <= yMax)
        if (!op.length) return
        op.sort((a, b) => Math.hypot(a.lx - r.lx, a.ly - r.ly) - Math.hypot(b.lx - r.lx, b.ly - r.ly))
        r.lx = op[0].lx
        r.ly = op[0].ly
      }
    }
    for (const r of rs) if (r.m === 'perto' || r.m === 'baixo') afastar(r)
    for (const modo of ['esq', 'dir', 'legenda', 'perto'] as const) {
      const g = rs.filter((r) => r.m === modo).sort((a, b) => a.ly - b.ly)
      for (let i = 1; i < g.length; i++) {
        const meio = modo === 'perto' ? g[i - 1].h + 6 : (g[i - 1].h + g[i].h) / 2 + 6
        const min = g[i - 1].ly + meio
        if (modo === 'perto' && Math.abs(g[i].lx - g[i - 1].lx) > 260) continue
        if (g[i].ly < min) g[i].ly = min
      }
    }
    // o espaçamento pode ter empurrado um rótulo solto de volta: mais uma passada
    for (const r of rs) if (r.m === 'perto') afastar(r)
    for (const r of rs) {
      const { al, el } = r
      const md = r.m
      const tx = md === 'esq' ? '-100%' : md === 'baixo' ? '-50%' : '0px'
      const ty = md === 'perto' ? '-100%' : md === 'baixo' ? '0px' : '-50%'
      el.style.opacity = '1'
      el.style.pointerEvents = ''
      el.style.transform = `translate(${r.lx.toFixed(1)}px, ${r.ly.toFixed(1)}px) translate(${tx}, ${ty})`
      const pth = caminhos.current.get(al.id)
      if (!pth) continue
      const f = (n: number) => n.toFixed(1)
      let d = ''
      if (md === 'perto') for (const q of r.pts) d += `M${f(q.x)} ${f(q.y)} L${f(r.lx)} ${f(r.ly)} `
      else if (md === 'esq') d = `M${f(r.ax)} ${f(r.ay)} L${f(r.lx + 14)} ${f(r.ly)} L${f(r.lx + 3)} ${f(r.ly)}`
      else if (md === 'dir' || md === 'legenda' || md === 'painel') d = `M${f(r.ax)} ${f(r.ay)} L${f(r.lx - 14)} ${f(r.ly)} L${f(r.lx - 3)} ${f(r.ly)}`
      else if (md === 'baixo') d = `M${f(r.ax)} ${f(r.ay)} L${f(r.lx)} ${f(r.ly - 2)}`
      pth.setAttribute('d', d)
    }
  })
  return null
}

