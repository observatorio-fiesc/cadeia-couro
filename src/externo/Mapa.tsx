// O palco da aba Mercado externo: o mapa-múndi do Centro de comando do painel-comandante (chão curvo como um globo
// visto do alto, costas, fronteiras, o mar mais claro junto à costa e, a pedido, a densidade do tráfego de navios),
// sem ZEE, pré-sal, cabos, forças, plataformas nem cobertura, na paleta do couro. Cada passada de uma análise pede
// ao palco um enquadramento (a câmera vai até ele, como nos Cenários estratégicos) e o que desenhar: países pintados,
// rotas pelo mar com um pulso, peças de luz em pé sobre os países (como no Tabuleiro), carga correndo pelas rotas
// e parando num gargalo fechado, a treliça dos preços no tempo (como em Custos) e, de perto, o detalhe 1:10m do lugar.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, Html, Line } from '@react-three/drei'
import type { Line2 } from 'three-stdlib'
import * as THREE from 'three'
import { chao, curvarLinha, curvarPonto, DEF_CURVA, doChao, dentroDoAnel, GLSL_CURVA, htmlCurvo, malhaMundo, MAP_Y, noChao, ponto, triangulosFinos } from './geo'
import { rota, type Ancora, type LonLat } from './rotas'
import { carregarDetalhes, type DadosExterno, type Janela, type Pais } from './dados'

/* ---------- o que uma passada pede ao palco ---------- */

export type Tom = 'couro' | 'ganho' | 'perda' | 'golfo' | 'tinta' | 'ambar'
/** Um país pintado: `v` de 0 a 1 é a força da cor. */
export type Pintura = { iso: string; v: number; tom: Tom }
export type Fluxo = {
  id: string
  de: Ancora
  para: Ancora
  /** largura em pixels */
  largura: number
  tom: 'palido' | 'couro' | 'vermelho' | 'ganho'
  /** quando começa a se desenhar, em segundos depois da troca de passada */
  atraso?: number
}
export type Rotulo = { id: string; em: LonLat; texto: string; forte?: boolean; tom?: Tom; lado?: 'dir' | 'esq' | 'cima' | 'baixo'; classe?: string }
export type Marca = { id: string; em: LonLat; raio: number; tom: Tom; pulsa?: boolean }
/** Uma peça de luz em pé sobre um lugar: `v` de 0 a 1 é a altura; `fantasma`, a altura de referência (um anel). */
export type Peca = { id: string; em: LonLat; v: number; tom: Tom; fantasma?: number; nome?: string; valor?: string; lado?: 'cima' | 'dir' | 'esq'; raio?: number }
export type Gargalo = { id: string; nome: string; em: LonLat; texto?: string; fechado?: boolean; raio?: number }
/** Uma rota de carga: pontos que correm por ela; `corte`, onde ela é cortada quando o gargalo fecha. */
export type RotaCarga = { id: string; pts: LonLat[]; peso: number; tom?: 'tinta' | 'couro' | 'perda'; corte?: LonLat }
export type Carga = {
  rotas: RotaCarga[]
  gargalos: Gargalo[]
  /** segundos depois da troca de passada em que os cortes fecham; sem ele, tudo corre */
  fechaEm?: number
  /** a linha de corte de cada gargalo fechado, de margem a margem */
  linhasDeCorte?: [LonLat, LonLat][]
  velocidade?: number
  tamanho?: number
}
/** A treliça dos preços no tempo, flutuando sobre um lugar (como a de Custos): cada série uma fila de pontos. */
export type Trelica = {
  em: LonLat
  altura: number
  largura: number
  alto: number
  fundo: number
  anos: string[]
  series: { id: string; nome: string; v: (number | null)[]; tom: Tom; forte?: boolean; rotulo?: string }[]
  /** índice do último dado (a linha fixa) e o seu nome */
  ultimo: number
  marca: string
  /** rótulos sob o eixo: [índice, texto] */
  eixo: [number, string][]
}
export type Enquadre = {
  pontos: LonLat[]
  /** de onde a câmera olha, como direção do alvo ao olho (x leste, y para cima, z sul) */
  dir?: [number, number, number]
  margem?: number
  /** também enquadra o que fica em pé até essa altura (peças, treliça) */
  alto?: number
  /** a altura dos pontos de baixo, quando o que se enquadra flutua (a treliça) */
  base?: number
  /** a câmera olha esse tanto abaixo do centro: o que flutua sobe na tela e o mapa aparece embaixo */
  olharAbaixo?: number
}
export type Cena = {
  pinturas: Pintura[]
  fluxos: Fluxo[]
  rotulos: Rotulo[]
  marcas?: Marca[]
  camera: Enquadre
  /** janelas do detalhe 1:10m (geo/detalhes.json) que aparecem de perto */
  detalhe?: string[]
  portos?: boolean
  pecas?: Peca[]
  /** altura de uma peça cheia, em unidades do chão */
  alturaPeca?: number
  carga?: Carga
  trelica?: Trelica
  /** o que o ponteiro diz de um país, em linhas */
  dica?: (iso: string) => string[] | null
}

export const COR: Record<Tom | Fluxo['tom'], string> = {
  couro: '#cf8a52',
  ganho: '#79b487',
  perda: '#e5553f',
  golfo: '#e5553f',
  tinta: '#eadfcb',
  ambar: '#e9b24a',
  palido: '#eadfcb',
  vermelho: '#e5553f',
}
const TINTA = '#eadfcb'

/** Onde o país se ancora no mapa: o ponto do rótulo do Natural Earth. */
export const ondeFica = (d: DadosExterno, iso: string): LonLat | null => d.porIso.get(iso)?.rot ?? null

/** O relógio da passada: quando ela começou (performance.now). */
const relogio = { desde: performance.now() }
const tempo = () => (performance.now() - relogio.desde) / 1000

/* ---------- o mapa ---------- */

/** Quanto a interface cobre de cada lado, em pixels: o enquadramento centra o mapa no que sobra. */
export type Margens = { esq: number; dir: number; topo: number; base: number }

export function MapaExterno({ dados, cena, densidade, margens, chave }: { dados: DadosExterno; cena: Cena; densidade: boolean; margens: Margens; chave: string }) {
  const [dica, setDica] = useState<{ x: number; y: number; linhas: string[] } | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  useLayoutEffect(() => {
    relogio.desde = performance.now()
  }, [chave])
  return (
    <div className="ext-mapa" onPointerLeave={() => (setDica(null), setHover(null))}>
      <Canvas className="cena" camera={{ fov: 28, near: 0.02, far: 400, position: [6, 30, 30] }} dpr={[1, 2]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} resize={{ scroll: false, debounce: 0 }}>
        <Camera enquadre={cena.camera} margens={margens} chave={chave} />
        <Mar />
        <Densidade ligada={densidade} />
        <Paises mundo={dados.mundo} pinturas={cena.pinturas} hover={hover} />
        <Linhas mundo={dados.mundo} nivel={cena.detalhe?.length ? 0.35 : 1} />
        {cena.detalhe?.map((j) => <Detalhe key={j} id={j} portos={cena.portos ?? true} />)}
        <Fluxos fluxos={cena.fluxos} chave={chave} />
        {cena.marcas?.map((m) => <Anel key={`${chave}|${m.id}`} m={m} />)}
        <Pecas pecas={cena.pecas ?? []} alto={cena.alturaPeca ?? 1.2} />
        {cena.carga && <CargaCena key={chave} carga={cena.carga} />}
        {cena.trelica && <TrelicaCena key={`${chave}|${cena.trelica.series.length}`} tr={cena.trelica} />}
        <Rotulos rotulos={cena.rotulos} chave={chave} />
        <Ponteiro
          mundo={dados.mundo}
          onPais={(iso, x, y) => {
            setHover(iso)
            const linhas = iso ? cena.dica?.(iso) ?? [dados.porIso.get(iso)?.nome ?? iso] : null
            setDica(linhas ? { x, y, linhas } : null)
          }}
        />
      </Canvas>
      {dica && (
        <div className="ext-dica" style={{ left: dica.x + 16, top: dica.y + 14 }}>
          {dica.linhas.map((l, i) => (
            <div key={i} className={i === 0 ? 'ext-dica-nome' : ''}>
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- a câmera, como diretor: um enquadramento por passada ---------- */

/** Olho e alvo que põem os pontos inteiros na área livre, olhando na direção pedida. */
function enquadrar(e: Enquadre, cam: THREE.PerspectiveCamera, size: { width: number; height: number }, m: Margens) {
  const dir = new THREE.Vector3(...(e.dir ?? [0, 0.88, 0.48])).normalize()
  const b = e.base ?? 0
  const pts = e.pontos.map(([lo, la]) => ponto(lo, la, b))
  if (e.alto) pts.push(...e.pontos.map(([lo, la]) => ponto(lo, la, b + e.alto!)))
  const c = new THREE.Box3().setFromPoints(pts).getCenter(new THREE.Vector3())
  const f = dir.clone().negate()
  const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize()
  const u = new THREE.Vector3().crossVectors(r, f).normalize()
  const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
  const th = tv * (size.width / size.height)
  const fw = Math.max(200, size.width - m.esq - m.dir) / size.width
  const fh = Math.max(200, size.height - m.topo - m.base) / size.height
  let d = 0.4
  const q = new THREE.Vector3()
  for (const p of pts) {
    q.copy(p).sub(c)
    const prof = q.dot(f)
    d = Math.max(d, Math.abs(q.dot(r)) / (th * fw) - prof, Math.abs(q.dot(u)) / (tv * fh) - prof)
  }
  d *= e.margem ?? 1.1
  const olho = c.clone().addScaledVector(dir, d)
  return [olho.x, olho.y, olho.z, c.x, c.y - (e.olharAbaixo ?? 0), c.z] as const
}

function Camera({ enquadre, margens, chave }: { enquadre: Enquadre; margens: Margens; chave: string }) {
  const cc = useRef<CameraControls>(null)
  const { camera, size } = useThree()
  const persp = camera as THREE.PerspectiveCamera
  const atual = useRef(enquadre)
  atual.current = enquadre
  // o centro óptico vai para o meio da área livre (o que a interface não cobre)
  useLayoutEffect(() => {
    persp.setViewOffset(size.width, size.height, (margens.dir - margens.esq) / 2, (margens.base - margens.topo) / 2, size.width, size.height)
    persp.updateProjectionMatrix()
  }, [persp, size.width, size.height, margens])
  const ir = (suave: boolean) => cc.current?.setLookAt(...enquadrar(atual.current, persp, size, margens), suave)
  // a cada passada, a câmera vai ao enquadramento dela; os anos que correm dentro da passada não mexem nela
  useEffect(() => {
    ir(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, size.width, size.height, margens.esq, margens.dir, margens.topo, margens.base])
  // Esc devolve a vista ao enquadramento da passada
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && ir(true)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  })
  useLayoutEffect(() => {
    const c = cc.current
    if (!c) return
    // valores de camera-controls ACTION: ROTATE 1, SCREEN_PAN 4, DOLLY 16, TOUCH_SCREEN_PAN 256, TOUCH_DOLLY_TRUCK 4096
    c.mouseButtons.left = 4 // arrastar desloca o mapa, como no Centro de comando
    c.mouseButtons.right = 1 // girar e inclinar
    c.mouseButtons.wheel = 16 // aproximar, na direção do ponteiro
    c.touches.one = 256
    c.touches.two = 4096
    c.dollyToCursor = true
    c.minDistance = 0.25
    c.maxDistance = 80
    c.minPolarAngle = 0.05
    c.maxPolarAngle = 1.52
    // como nos Cenários estratégicos: a câmera viaja devagar de um enquadramento ao outro
    c.smoothTime = 1.05
    ir(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <CameraControls ref={cc} makeDefault />
}

/* ---------- o mundo: costas, fronteiras, meridianos e paralelos ---------- */

function segmentos(linhas: number[][], y: number) {
  const pts: number[] = []
  for (const l of linhas)
    for (let i = 0; i + 3 < l.length; i += 2) {
      if (Math.abs(l[i] - l[i + 2]) > 180) continue
      const [ax, az] = chao(l[i], l[i + 1])
      const [bx, bz] = chao(l[i + 2], l[i + 3])
      pts.push(ax, y, az, bx, y, bz)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return g
}

function Linhas({ mundo, nivel }: { mundo: DadosExterno['mundo']; nivel: number }) {
  const geo = useMemo(() => {
    const grade: number[][] = []
    for (let lon = -180; lon <= 180; lon += 10) {
      const l: number[] = []
      for (let lat = -60; lat <= 80; lat += 2) l.push(lon, lat)
      grade.push(l)
    }
    for (let lat = -60; lat <= 80; lat += 10) {
      const l: number[] = []
      for (let lon = -180; lon <= 180; lon += 2) l.push(lon, lat)
      grade.push(l)
    }
    return { costas: segmentos(mundo.costas, MAP_Y + 0.001), fronteiras: segmentos(mundo.fronteiras, MAP_Y + 0.001), grade: segmentos(grade, MAP_Y - 0.002) }
  }, [mundo])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  const costa = useRef<THREE.LineBasicMaterial>(null)
  const fronteira = useRef<THREE.LineBasicMaterial>(null)
  const k = useRef(nivel)
  useFrame((_, dt) => {
    k.current = THREE.MathUtils.damp(k.current, nivel, 2.5, Math.min(dt, 0.05))
    if (costa.current) costa.current.opacity = 0.5 * k.current
    if (fronteira.current) fronteira.current.opacity = 0.2 * k.current
  })
  return (
    <>
      <lineSegments geometry={geo.grade} frustumCulled={false} renderOrder={1}>
        <lineBasicMaterial color={TINTA} transparent opacity={0.06} depthWrite={false} defines={DEF_CURVA} />
      </lineSegments>
      <lineSegments geometry={geo.fronteiras} frustumCulled={false} renderOrder={4}>
        <lineBasicMaterial ref={fronteira} color={TINTA} transparent opacity={0.2} depthWrite={false} defines={DEF_CURVA} />
      </lineSegments>
      <lineSegments geometry={geo.costas} frustumCulled={false} renderOrder={4}>
        <lineBasicMaterial ref={costa} color={TINTA} transparent opacity={0.5} depthWrite={false} defines={DEF_CURVA} />
      </lineSegments>
    </>
  )
}

/* ---------- o mar: mais claro junto à costa (máscara de água do atlas) ---------- */

const VS_MUNDO = /* glsl */ `
${GLSL_CURVA}
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * curvar(modelMatrix * vec4(position, 1.0));
}`

function textura(url: string, nearest = false) {
  const t = new THREE.TextureLoader().load(url)
  t.flipY = false
  t.colorSpace = THREE.NoColorSpace
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter
  t.generateMipmaps = true
  t.anisotropy = 8
  return t
}

function Mar() {
  const geo = useMemo(() => malhaMundo(MAP_Y - 0.004), [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        defines: DEF_CURVA,
        vertexShader: VS_MUNDO,
        fragmentShader: /* glsl */ `
          uniform sampler2D uAgua;
          uniform vec3 uCor;
          varying vec2 vUv;
          void main() {
            vec2 w = texture2D(uAgua, vUv).rg;
            float a = w.r * (0.035 + 0.1 * w.g * w.g);
            if (a < 0.002) discard;
            gl_FragColor = vec4(uCor, a);
          }`,
        uniforms: { uAgua: { value: textura('./data/mundo/agua.png') }, uCor: { value: new THREE.Color(TINTA) } },
        transparent: true,
        depthWrite: false,
      }),
    [],
  )
  useEffect(
    () => () => {
      geo.dispose()
      ;(mat.uniforms.uAgua.value as THREE.Texture).dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={0} />
}

/* ---------- densidade: o tráfego de navios do Global Fishing Watch (30 dias), uma célula de 0,1° por pixel ---------- */

// O shader do atlas (SeaGrid.tsx, WORLD_FS): de longe, as mipmaps dão a densidade sem cintilar e o valor é erguido
// para uma rota ler tão clara de longe quanto de perto; de perto, cada pixel vira uma célula nítida, com um fio
// fino entre as células, em vez de um borrão de imagem ampliada.
function Densidade({ ligada }: { ligada: boolean }) {
  const geo = useMemo(() => malhaMundo(MAP_Y - 0.003), [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        defines: DEF_CURVA,
        vertexShader: VS_MUNDO,
        fragmentShader: /* glsl */ `
          uniform sampler2D uGrade;
          uniform vec2 uRes;
          uniform vec3 uCor;
          uniform float uAlfa;
          varying vec2 vUv;
          void main() {
            float t = texture2D(uGrade, vUv).r;
            if (t < 0.5 / 255.0) discard;
            vec2 c = vUv * uRes;
            float muitos = max(fwidth(c).x, fwidth(c).y);
            t = mix(t, pow(t, 0.55), smoothstep(0.6, 3.0, muitos));
            vec2 f = fract(c);
            float largo = 1.0 - smoothstep(0.12, 0.3, muitos);
            float borda = 0.06;
            float vao = step(borda, f.x) * step(f.x, 1.0 - borda) * step(borda, f.y) * step(f.y, 1.0 - borda);
            float a = (0.03 + 0.92 * pow(t, 1.9)) * mix(1.0, vao, largo) * uAlfa;
            if (a < 0.003) discard;
            gl_FragColor = vec4(mix(uCor, vec3(0.98, 0.94, 0.86), 0.6 * pow(t, 3.0)), a);
          }`,
        uniforms: { uGrade: { value: textura('./data/mundo/grade-presenca.png', true) }, uRes: { value: new THREE.Vector2(3600, 1800) }, uCor: { value: new THREE.Color(COR.couro) }, uAlfa: { value: 0 } },
        transparent: true,
        depthWrite: false,
      }),
    [],
  )
  const malha = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    mat.uniforms.uAlfa.value = THREE.MathUtils.damp(mat.uniforms.uAlfa.value, ligada ? 0.78 : 0, 3, Math.min(dt, 0.05))
    if (malha.current) malha.current.visible = mat.uniforms.uAlfa.value > 0.004
  })
  useEffect(
    () => () => {
      geo.dispose()
      ;(mat.uniforms.uGrade.value as THREE.Texture).dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  return <mesh ref={malha} geometry={geo} material={mat} frustumCulled={false} renderOrder={2} />
}

/* ---------- países pintados: uma malha só, a cor de cada país numa textura (muda sem refazer a malha) ---------- */

const N_CORES = 256

function Paises({ mundo, pinturas, hover }: { mundo: DadosExterno['mundo']; pinturas: Pintura[]; hover: string | null }) {
  const indice = useMemo(() => new Map(mundo.paises.map((p, i) => [p.iso3, i])), [mundo])
  const geo = useMemo(() => {
    const pos: number[] = []
    const qual: number[] = []
    mundo.paises.forEach((p, i) => {
      for (const poli of p.poligonos) {
        const anel = (a: number[]) => {
          const v: THREE.Vector2[] = []
          for (let k = 0; k + 1 < a.length; k += 2) {
            const [x, z] = chao(a[k], a[k + 1])
            v.push(new THREE.Vector2(x, z))
          }
          if (v.length > 2 && v[0].equals(v[v.length - 1])) v.pop()
          return v
        }
        const fora = anel(poli[0])
        const buracos = poli.slice(1).map(anel).filter((h) => h.length > 2)
        if (fora.length < 3) continue
        const tris = THREE.ShapeUtils.triangulateShape(fora, buracos)
        const todos = [...fora, ...buracos.flat()]
        const plano: number[] = []
        for (const [a, b, c] of tris) for (const k of [a, b, c]) plano.push(todos[k].x, MAP_Y - 0.001, todos[k].y)
        const finos = triangulosFinos(plano, 0.6)
        for (let k = 0; k < finos.length; k += 3) {
          pos.push(finos[k], finos[k + 1], finos[k + 2])
          qual.push(i)
        }
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('aPais', new THREE.Float32BufferAttribute(qual, 1))
    return g
  }, [mundo])
  const cores = useMemo(() => {
    const t = new THREE.DataTexture(new Float32Array(N_CORES * 4), N_CORES, 1, THREE.RGBAFormat, THREE.FloatType)
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.NearestFilter
    t.needsUpdate = true
    return t
  }, [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        defines: DEF_CURVA,
        vertexShader: /* glsl */ `
          ${GLSL_CURVA}
          attribute float aPais;
          uniform sampler2D uCores;
          varying vec4 vCor;
          void main() {
            vCor = texture2D(uCores, vec2((aPais + 0.5) / ${N_CORES}.0, 0.5));
            gl_Position = projectionMatrix * viewMatrix * curvar(modelMatrix * vec4(position, 1.0));
          }`,
        fragmentShader: /* glsl */ `
          varying vec4 vCor;
          void main() {
            if (vCor.a < 0.003) discard;
            gl_FragColor = vCor;
          }`,
        uniforms: { uCores: { value: cores } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [cores],
  )
  // a cor de cada país segue a da passada, sem saltos
  const alvo = useMemo(() => new Float32Array(N_CORES * 4), [])
  useEffect(() => {
    alvo.fill(0)
    const c = new THREE.Color()
    for (const p of pinturas) {
      const i = indice.get(p.iso)
      if (i === undefined || i >= N_CORES) continue
      c.set(COR[p.tom])
      alvo.set([c.r, c.g, c.b, p.v > 0 ? 0.06 + 0.5 * Math.min(1, p.v) : 0], i * 4)
    }
    if (hover) {
      const i = indice.get(hover)
      if (i !== undefined && i < N_CORES) {
        if (alvo[i * 4 + 3] === 0) alvo.set([0.92, 0.87, 0.8, 0], i * 4)
        alvo[i * 4 + 3] += 0.1
      }
    }
  }, [pinturas, hover, indice, alvo])
  useFrame((_, dt) => {
    const a = cores.image.data as Float32Array
    const k = 1 - Math.exp(-4 * Math.min(dt, 0.05))
    let mudou = false
    for (let i = 0; i < a.length; i++) {
      const d = alvo[i] - a[i]
      if (Math.abs(d) > 1e-4) {
        a[i] += d * k
        mudou = true
      }
    }
    if (mudou) cores.needsUpdate = true
  })
  useEffect(
    () => () => {
      geo.dispose()
      cores.dispose()
      mat.dispose()
    },
    [geo, cores, mat],
  )
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={3} />
}

/* ---------- o detalhe de perto: costa, fronteiras, ferrovias, estradas e portos 1:10m do lugar ---------- */

const NOME_PT: Record<string, string> = {
  Rome: 'Roma', Milan: 'Milão', Naples: 'Nápoles', Turin: 'Turim', Florence: 'Florença', Venice: 'Veneza', Genoa: 'Gênova', Bologna: 'Bolonha',
  Paris: 'Paris', Marseille: 'Marselha', Lyon: 'Lyon', Munich: 'Munique', Vienna: 'Viena', Prague: 'Praga', Warsaw: 'Varsóvia', Bucharest: 'Bucareste',
  Belgrade: 'Belgrado', Budapest: 'Budapeste', Bratislava: 'Bratislava', Cairo: 'Cairo', Riyadh: 'Riad', Tehran: 'Teerã', Kuwait: 'Kuwait',
  Doha: 'Doha', Dubai: 'Dubai', 'Abu Dhabi': 'Abu Dhabi', Muscat: 'Mascate', Beijing: 'Pequim', Shanghai: 'Xangai', Guangzhou: 'Cantão',
  'Hong Kong': 'Hong Kong', Hanoi: 'Hanói', 'Ho Chi Minh City': 'Cidade de Ho Chi Minh', Singapore: 'Singapura', 'Kuala Lumpur': 'Kuala Lumpur',
  'Mexico City': 'Cidade do México', 'Cape Town': 'Cidade do Cabo', 'São Paulo': 'São Paulo', 'Rio de Janeiro': 'Rio de Janeiro', Curitiba: 'Curitiba',
  'Porto Alegre': 'Porto Alegre', 'Kuwait City': 'Cidade do Kuwait', Tunis: 'Túnis', Algiers: 'Argel', Lisbon: 'Lisboa', Seville: 'Sevilha', Panama: 'Panamá', 'Panama City': 'Cidade do Panamá',
}
export const nomePt = (n: string) => NOME_PT[n] ?? n

/** Linhas do detalhe que somem perto da borda da janela: o recorte não aparece como um retângulo. */
function matDetalhe(cor: string, j: Janela) {
  const [xo, zn] = chao(j.lon[0], j.lat[1])
  const [xl, zs] = chao(j.lon[1], j.lat[0])
  const faixa = Math.min(xl - xo, zs - zn) * 0.16
  return new THREE.ShaderMaterial({
    defines: DEF_CURVA,
    vertexShader: /* glsl */ `
      ${GLSL_CURVA}
      varying vec2 vXZ;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vXZ = w.xz;
        gl_Position = projectionMatrix * viewMatrix * curvar(w);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCor;
      uniform float uAlfa;
      uniform vec4 uBorda;
      uniform float uFaixa;
      varying vec2 vXZ;
      void main() {
        float e = min(min(vXZ.x - uBorda.x, uBorda.y - vXZ.x), min(vXZ.y - uBorda.z, uBorda.w - vXZ.y));
        float a = uAlfa * smoothstep(0.0, uFaixa, e);
        if (a < 0.003) discard;
        gl_FragColor = vec4(uCor, a);
      }`,
    uniforms: { uCor: { value: new THREE.Color(cor) }, uAlfa: { value: 0 }, uBorda: { value: new THREE.Vector4(xo, xl, zn, zs) }, uFaixa: { value: faixa } },
    transparent: true,
    depthWrite: false,
  })
}

function Detalhe({ id, portos }: { id: string; portos: boolean }) {
  const [j, setJ] = useState<Janela | null>(null)
  useEffect(() => {
    let vivo = true
    carregarDetalhes().then((d) => vivo && setJ(d.janelas[id] ?? null))
    return () => {
      vivo = false
    }
  }, [id])
  return j ? <DetalheJanela key={id} j={j} portos={portos} /> : null
}

function DetalheJanela({ j, portos }: { j: Janela; portos: boolean }) {
  const geo = useMemo(
    () => ({
      costas: segmentos(j.costas, MAP_Y + 0.0015),
      fronteiras: segmentos(j.fronteiras, MAP_Y + 0.0015),
      ferrovias: segmentos(j.ferrovias, MAP_Y + 0.001),
      estradas: segmentos(j.estradas, MAP_Y + 0.001),
    }),
    [j],
  )
  const pontos = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(j.portos.flatMap(([, lo, la]) => ponto(lo, la, 0.003).toArray()), 3))
    return g
  }, [j])
  const linhas = useMemo(() => [matDetalhe(TINTA, j), matDetalhe(TINTA, j), matDetalhe(COR.ambar, j), matDetalhe(TINTA, j)], [j])
  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      pontos.dispose()
      linhas.forEach((m) => m.dispose())
    },
    [geo, pontos, linhas],
  )
  const mats = useRef<(THREE.PointsMaterial | null)[]>([])
  const base = [0.8, 0.36, 0.3, 0.11]
  const k = useRef(0)
  useFrame((_, dt) => {
    // entra quando a câmera já chegou perto
    k.current = THREE.MathUtils.damp(k.current, tempo() > 0.7 ? 1 : 0, 2.2, Math.min(dt, 0.05))
    linhas.forEach((m, i) => (m.uniforms.uAlfa.value = base[i] * k.current))
    if (mats.current[0]) mats.current[0].opacity = 0.9 * k.current
  })
  const [nomes, setNomes] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setNomes(true), 1500)
    return () => window.clearTimeout(t)
  }, [])
  const grandes = j.cidades.filter(([, , , pop]) => pop >= 1_500_000).slice(0, 8)
  return (
    <group>
      <lineSegments geometry={geo.costas} material={linhas[0]} frustumCulled={false} renderOrder={5} />
      <lineSegments geometry={geo.fronteiras} material={linhas[1]} frustumCulled={false} renderOrder={5} />
      <lineSegments geometry={geo.ferrovias} material={linhas[2]} frustumCulled={false} renderOrder={5} />
      <lineSegments geometry={geo.estradas} material={linhas[3]} frustumCulled={false} renderOrder={5} />
      {portos && (
        <points geometry={pontos} frustumCulled={false} renderOrder={8}>
          <pointsMaterial ref={(m) => void (mats.current[0] = m)} color={COR.couro} size={4} sizeAttenuation={false} transparent opacity={0} depthWrite={false} defines={DEF_CURVA} />
        </points>
      )}
      {nomes &&
        grandes.map(([n, lo, la]) => (
          <Html key={n} position={ponto(lo, la, 0.003)} calculatePosition={htmlCurvo} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <span className="ext-cidade">{nomePt(n)}</span>
          </Html>
        ))}
    </group>
  )
}

/* ---------- rotas: cada fluxo pelo mar, desenhado da origem ao destino, com um pulso que corre nele ---------- */

type Vivo = { f: Fluxo; saindo: boolean; desde: number }

function Fluxos({ fluxos, chave }: { fluxos: Fluxo[]; chave: string }) {
  const [vivos, setVivos] = useState<Vivo[]>([])
  const inicio = useRef(performance.now())
  useEffect(() => {
    inicio.current = performance.now()
  }, [chave])
  useEffect(() => {
    const agora = performance.now()
    setVivos((antes) => {
      const ids = new Set(fluxos.map((f) => f.id))
      const ficam = antes.filter((v) => !ids.has(v.f.id) && (!v.saindo || agora - v.desde < 700)).map((v) => (v.saindo ? v : { ...v, saindo: true, desde: agora }))
      return [...fluxos.map((f) => ({ f, saindo: false, desde: antes.find((v) => v.f.id === f.id && !v.saindo)?.desde ?? agora })), ...ficam]
    })
    const t = window.setTimeout(() => setVivos((vs) => vs.filter((v) => !v.saindo || performance.now() - v.desde < 700)), 800)
    return () => window.clearTimeout(t)
  }, [fluxos])
  return (
    <>
      {vivos.map((v) => (
        <Rota key={v.f.id} vivo={v} inicio={inicio} />
      ))}
    </>
  )
}

const VELOCIDADE = 9 // unidades do chão por segundo: rotas longas levam mais tempo, como uma viagem

function Rota({ vivo, inicio }: { vivo: Vivo; inicio: { current: number } }) {
  const { f } = vivo
  const linha = useRef<Line2>(null)
  const pulso = useRef<Line2>(null)
  const pts = useMemo(() => rota(f.de, f.para).map(([lo, la]) => ponto(lo, la, 0.006)), [f.de, f.para])
  const comp = useMemo(() => pts.reduce((s, p, i) => (i ? s + p.distanceTo(pts[i - 1]) : 0), 0), [pts])
  const largura = useRef(f.largura)
  const alfa = useRef(0)
  const alvo = useRef(f.largura)
  alvo.current = f.largura
  useLayoutEffect(() => {
    if (linha.current) curvarLinha(linha.current.material)
    if (pulso.current) curvarLinha(pulso.current.material)
  }, [])
  useFrame((_, dt) => {
    const l = linha.current
    const p = pulso.current
    if (!l || !p) return
    const t = Math.max((performance.now() - Math.max(inicio.current, vivo.desde)) / 1000 - (f.atraso ?? 0), 0)
    const desenhado = Math.min(t * VELOCIDADE, comp)
    const ddt = Math.min(dt, 0.05)
    largura.current = THREE.MathUtils.damp(largura.current, alvo.current, 3, ddt)
    alfa.current = THREE.MathUtils.damp(alfa.current, vivo.saindo ? 0 : 1, vivo.saindo ? 8 : 4, ddt)
    l.material.linewidth = Math.max(0.5, largura.current)
    l.material.dashOffset = comp - desenhado
    l.material.opacity = (t > 0 ? 0.85 : 0) * alfa.current
    const s = ((t - comp / VELOCIDADE) * 1.4) % (comp + 0.8)
    p.material.linewidth = Math.max(0.5, largura.current) + 0.6
    p.material.dashOffset = -s
    p.material.opacity = desenhado >= comp && !vivo.saindo ? 0.75 * alfa.current : 0
  })
  return (
    <>
      <Line ref={linha} points={pts} color={COR[f.tom]} lineWidth={f.largura} dashed dashSize={comp} gapSize={comp * 2} transparent opacity={0} depthWrite={false} renderOrder={6} />
      <Line ref={pulso} points={pts} color="#fff6e8" lineWidth={f.largura + 0.6} dashed dashSize={0.12} gapSize={comp + 0.8} transparent opacity={0} depthWrite={false} renderOrder={7} />
    </>
  )
}

/* ---------- peças de luz em pé sobre os lugares, como no Tabuleiro dos Cenários estratégicos ---------- */

const RISCOS = 30
const MAX_PECAS = 48
const ANEL_SEG = 40

type EstadoPeca = { p: Peca; h: number; f: number; vivo: boolean }

function Pecas({ pecas, alto }: { pecas: Peca[]; alto: number }) {
  const estado = useRef(new Map<string, EstadoPeca>())
  // as que saem descem antes de sumir
  for (const e of estado.current.values()) e.vivo = false
  for (const p of pecas) {
    const e = estado.current.get(p.id)
    if (e) Object.assign(e, { p, vivo: true })
    else estado.current.set(p.id, { p, h: 0, f: 0, vivo: true })
  }
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MAX_PECAS * RISCOS * 6), 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(MAX_PECAS * RISCOS * 6), 3))
    return g
  }, [])
  const aneis = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MAX_PECAS * ANEL_SEG * 6), 3))
    return g
  }, [])
  useEffect(
    () => () => {
      geo.dispose()
      aneis.dispose()
    },
    [geo, aneis],
  )
  const grupos = useRef(new Map<string, THREE.Group>())
  const cor = useMemo(() => new THREE.Color(), [])
  const desloc = useRef(new Map<string, number>())
  const { camera, size } = useThree()
  const tela = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    const ddt = Math.min(dt, 0.05)
    const pa = geo.getAttribute('position') as THREE.BufferAttribute
    const ca = geo.getAttribute('color') as THREE.BufferAttribute
    const ra = aneis.getAttribute('position') as THREE.BufferAttribute
    let n = 0
    let na = 0
    let k = 0
    for (const [id, e] of estado.current) {
      e.h = THREE.MathUtils.damp(e.h, e.vivo ? e.p.v * alto : 0, 2.6, ddt)
      e.f = THREE.MathUtils.damp(e.f, e.vivo ? (e.p.fantasma ?? 0) * alto : 0, 2.6, ddt)
      if (!e.vivo && e.h < 0.002) {
        estado.current.delete(id)
        continue
      }
      if (k >= MAX_PECAS) continue
      k++
      const c = ponto(e.p.em[0], e.p.em[1], 0.004)
      const r = e.p.raio ?? 0.085
      cor.set(COR[e.p.tom])
      for (let j = 0; j < RISCOS; j++) {
        const a = (j / RISCOS) * Math.PI * 2
        const x = c.x + Math.cos(a) * r
        const z = c.z + Math.sin(a) * r * 0.85
        const h = e.h * (0.94 + 0.06 * (((j * 7919) % 97) / 97))
        pa.setXYZ(n, x, c.y, z)
        pa.setXYZ(n + 1, x, c.y + h, z)
        ca.setXYZ(n, cor.r * 0.07, cor.g * 0.07, cor.b * 0.07)
        ca.setXYZ(n + 1, cor.r * 0.95, cor.g * 0.95, cor.b * 0.95)
        n += 2
      }
      if (e.f > 0.004) {
        for (let j = 0; j < ANEL_SEG; j++) {
          const a0 = (j / ANEL_SEG) * Math.PI * 2
          const a1 = ((j + 1) / ANEL_SEG) * Math.PI * 2
          ra.setXYZ(na++, c.x + Math.cos(a0) * r * 1.25, c.y + e.f, c.z + Math.sin(a0) * r * 1.06)
          ra.setXYZ(na++, c.x + Math.cos(a1) * r * 1.25, c.y + e.f, c.z + Math.sin(a1) * r * 1.06)
        }
      }
      const g = grupos.current.get(id)
      if (g) g.position.set(c.x, c.y + e.h, c.z)
    }
    geo.setDrawRange(0, n)
    aneis.setDrawRange(0, na)
    pa.needsUpdate = true
    ca.needsUpdate = true
    ra.needsUpdate = true
    // os nomes que se cobrem na tela sobem, um acima do outro, como as chamadas do visualizador do submarino
    const caixas = pecas
      .filter((p) => (p.nome || p.valor) && grupos.current.get(p.id))
      .map((p) => {
        tela.copy(grupos.current.get(p.id)!.position)
        curvarPonto(tela, camera.position).project(camera)
        const x = ((tela.x + 1) / 2) * size.width
        const y = ((1 - tela.y) / 2) * size.height
        const w = Math.max((p.nome ?? '').length * 7.6, (p.valor ?? '').length * 7.4) + 8
        const lado = p.lado ?? 'cima'
        const x0 = lado === 'cima' ? x - w / 2 : lado === 'dir' ? x + 12 : x - 12 - w
        return { id: p.id, x0, x1: x0 + w, y0: y - 36, y1: y - 4 }
      })
      .sort((a, b) => b.y0 - a.y0)
    const postas: { x0: number; x1: number; y0: number; y1: number }[] = []
    for (const c of caixas) {
      let dy = 0
      for (let t = 0; t < 8; t++) {
        dy = -t * 17
        const y0 = c.y0 + dy
        const y1 = c.y1 + dy
        if (!postas.some((b) => c.x0 < b.x1 + 4 && b.x0 < c.x1 + 4 && y0 < b.y1 && b.y0 < y1)) break
      }
      postas.push({ ...c, y0: c.y0 + dy, y1: c.y1 + dy })
      const atual = desloc.current.get(c.id)
      desloc.current.set(c.id, atual === undefined ? dy : THREE.MathUtils.damp(atual, dy, 8, ddt))
    }
  })
  const [pronto, setPronto] = useState(false)
  useFrame(() => !pronto && setPronto(true))
  return (
    <>
      <lineSegments geometry={geo} frustumCulled={false} renderOrder={9}>
        <lineBasicMaterial vertexColors transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} defines={DEF_CURVA} />
      </lineSegments>
      <lineSegments geometry={aneis} frustumCulled={false} renderOrder={9}>
        <lineBasicMaterial color={TINTA} transparent opacity={0.55} depthWrite={false} defines={DEF_CURVA} />
      </lineSegments>
      {pronto &&
        pecas
          .filter((p) => p.nome || p.valor)
          .map((p) => (
            <group key={p.id} ref={(g) => void (g ? grupos.current.set(p.id, g) : grupos.current.delete(p.id))}>
              <Html
                calculatePosition={(el, cam, sz) => {
                  const [x, y] = htmlCurvo(el, cam, sz)
                  return [x, y + (desloc.current.get(p.id) ?? 0)]
                }}
                zIndexRange={[7, 0]}
                style={{ pointerEvents: 'none' }}
              >
                <span className={`ext-peca lado-${p.lado ?? 'cima'} tom-${p.tom}`}>
                  {p.nome && <em>{p.nome}</em>}
                  {p.valor && <b>{p.valor}</b>}
                </span>
              </Html>
            </group>
          ))}
    </>
  )
}

/* ---------- carga: pontos que correm pelas rotas; num gargalo fechado, os de antes param em fila ---------- */

function trilho(pts: LonLat[], h: number) {
  const p = pts.map(([lo, la]) => ponto(lo, la, h))
  const cum = [0]
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + p[i].distanceTo(p[i - 1]))
  const total = cum[cum.length - 1]
  const em = (s: number, out: THREE.Vector3) => {
    const t = THREE.MathUtils.clamp(s, 0, total)
    let i = 1
    while (i < cum.length - 1 && cum[i] < t) i++
    const f = (t - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
    return out.lerpVectors(p[i - 1], p[i], f)
  }
  const perto = (alvo: THREE.Vector3) => {
    let melhor = Infinity
    let s0 = 0
    const v = new THREE.Vector3()
    for (let s = 0; s <= total; s += total / 400) {
      const d = em(s, v).distanceTo(alvo)
      if (d < melhor) ((melhor = d), (s0 = s))
    }
    return s0
  }
  return { total, em, perto }
}

const VS_PONTOS = /* glsl */ `
${GLSL_CURVA}
attribute vec4 aCor;
uniform float uTam;
uniform float uDpr;
varying vec4 vCor;
void main() {
  vCor = aCor;
  gl_PointSize = uTam * uDpr;
  gl_Position = projectionMatrix * viewMatrix * curvar(modelMatrix * vec4(position, 1.0));
}`
const FS_PONTOS = /* glsl */ `
varying vec4 vCor;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q);
  if (r > 0.5) discard;
  gl_FragColor = vec4(vCor.rgb, vCor.a * smoothstep(0.5, 0.32, r));
}`

function CargaCena({ carga }: { carga: Carga }) {
  const { gl } = useThree()
  const rotas = useMemo(
    () =>
      carga.rotas.map((r) => {
        const tr = trilho(r.pts, 0.007)
        const n = Math.round(THREE.MathUtils.clamp(5 + 30 * Math.sqrt(r.peso), 4, 40))
        const sCorte = r.corte ? tr.perto(ponto(r.corte[0], r.corte[1], 0.007)) : null
        return { r, tr, n, sCorte }
      }),
    [carga],
  )
  const total = rotas.reduce((s, r) => s + r.n, 0)
  const estado = useMemo(() => rotas.flatMap((r) => Array.from({ length: r.n }, (_, j) => ({ r, s: (j / r.n) * r.tr.total, fila: (j * 37) % r.n, vivo: true }))), [rotas])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(total * 3), 3))
    g.setAttribute('aCor', new THREE.Float32BufferAttribute(new Float32Array(total * 4), 4))
    return g
  }, [total])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        defines: DEF_CURVA,
        vertexShader: VS_PONTOS,
        fragmentShader: FS_PONTOS,
        uniforms: { uTam: { value: carga.tamanho ?? 4.2 }, uDpr: { value: 1 } },
        transparent: true,
        depthWrite: false,
      }),
    [carga.tamanho],
  )
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  const p = useMemo(() => new THREE.Vector3(), [])
  const c = useMemo(() => new THREE.Color(), [])
  const tinta = useMemo(() => new THREE.Color(TINTA), [])
  const vermelho = useMemo(() => new THREE.Color(COR.perda), [])
  const couro = useMemo(() => new THREE.Color(COR.couro), [])
  useFrame((_, dt) => {
    mat.uniforms.uDpr.value = gl.getPixelRatio()
    const t = tempo()
    const passo = Math.min(dt, 0.05)
    const fechado = carga.fechaEm !== undefined && t > carga.fechaEm ? t - carga.fechaEm : null
    const v0 = carga.velocidade ?? 0.9
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const cor = geo.getAttribute('aCor') as THREE.BufferAttribute
    const entra = Math.min(1, t / 0.8)
    estado.forEach((q, i) => {
      const { r, tr, sCorte } = q.r
      const v = v0 * (0.8 + 0.4 * (((i * 7919) % 13) / 13))
      const antes = sCorte !== null && q.s < sCorte
      if (fechado === null || sCorte === null) {
        q.vivo = true
        q.s += v * passo
        if (q.s > tr.total) q.s -= tr.total
      } else if (antes) {
        const para = sCorte - 0.012 - q.fila * 0.012
        q.s = Math.min(q.s + v * passo * 0.8, Math.max(para, q.s))
      } else if (q.vivo) {
        q.s += v * passo
        if (q.s >= tr.total) q.vivo = false
      }
      tr.em(q.s, p)
      pos.setXYZ(i, p.x, p.y, p.z)
      const verm = fechado !== null && antes ? Math.min(1, fechado / 1.2) : 0
      c.copy(r.tom === 'couro' ? couro : r.tom === 'perda' ? vermelho : tinta).lerp(vermelho, verm)
      const borda = Math.min(1, q.s / 0.12, (tr.total - q.s) / 0.2)
      const saiu = fechado !== null && sCorte !== null && !antes ? Math.max(0, 1 - fechado / 2.5) : 1
      cor.setXYZW(i, c.r, c.g, c.b, (q.vivo ? 0.85 : 0) * borda * saiu * entra)
    })
    pos.needsUpdate = true
    cor.needsUpdate = true
  })
  return (
    <>
      <points geometry={geo} material={mat} frustumCulled={false} renderOrder={10} />
      {carga.gargalos.map((g) => (
        <GargaloMarca key={g.id} g={g} fechaEm={carga.fechaEm} />
      ))}
      {carga.linhasDeCorte?.map((l, i) => (
        <Corte key={i} de={l[0]} ate={l[1]} fechaEm={carga.fechaEm ?? 0} />
      ))}
    </>
  )
}

/** Um gargalo: um anel no lugar e o nome; fechado, o nome fica vermelho. */
function GargaloMarca({ g, fechaEm }: { g: Gargalo; fechaEm?: number }) {
  const [fechou, setFechou] = useState(false)
  const [pronto, setPronto] = useState(false)
  useFrame(() => {
    if (!pronto) setPronto(true)
    const f = !!g.fechado && fechaEm !== undefined && tempo() > fechaEm + 0.3
    if (f !== fechou) setFechou(f)
  })
  return (
    <>
      <Anel m={{ id: g.id, em: g.em, raio: g.raio ?? 0.3, tom: fechou ? 'perda' : 'tinta', pulsa: true }} />
      {pronto && (
      <Html position={ponto(g.em[0], g.em[1], 0.004)} calculatePosition={htmlCurvo} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
        <span className={`ext-gargalo${fechou ? ' fechado' : ''}`}>
          <em>{fechou ? `${g.nome} · fechado` : g.nome}</em>
          {g.texto && <b>{g.texto}</b>}
        </span>
      </Html>
      )}
    </>
  )
}

/** O corte no estreito: uma linha vermelha de seção, que se abre do meio do canal para as margens. */
function Corte({ de, ate, fechaEm }: { de: LonLat; ate: LonLat; fechaEm: number }) {
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints(Array.from({ length: 8 }, () => new THREE.Vector3())), [])
  const mat = useRef<THREE.LineBasicMaterial>(null)
  useEffect(() => () => geo.dispose(), [geo])
  useFrame(() => {
    const p = THREE.MathUtils.clamp((tempo() - fechaEm) / 0.5, 0, 1)
    const a = ponto(de[0], de[1], 0.009)
    const b = ponto(ate[0], ate[1], 0.009)
    const meio = a.clone().add(b).multiplyScalar(0.5)
    const ao = b.clone().sub(a).normalize()
    const x = new THREE.Vector3(-ao.z, 0, ao.x).multiplyScalar(0.012)
    const ea = meio.clone().lerp(a, p)
    const eb = meio.clone().lerp(b, p)
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    ;[meio, ea, meio, eb, a.clone().add(x), a.clone().sub(x), b.clone().add(x), b.clone().sub(x)].forEach((v, i) => pos.setXYZ(i, v.x, v.y, v.z))
    pos.needsUpdate = true
    geo.setDrawRange(0, p >= 1 ? 8 : 4)
    if (mat.current) mat.current.opacity = p > 0 ? 1 : 0
  })
  return (
    <lineSegments geometry={geo} frustumCulled={false} renderOrder={11}>
      <lineBasicMaterial ref={mat} color={COR.perda} transparent opacity={0} depthWrite={false} defines={DEF_CURVA} />
    </lineSegments>
  )
}

/* ---------- a treliça dos preços: os anos ao longo, um anel que varre o tempo e acende o que passa ---------- */

const VARRE = 6.5
const PAUSA = 3.5

function TrelicaCena({ tr }: { tr: Trelica }) {
  const { gl } = useThree()
  const base = useMemo(() => ponto(tr.em[0], tr.em[1], tr.altura), [tr])
  const n = tr.anos.length
  const todos = tr.series.flatMap((s) => s.v.filter((v): v is number => v !== null && v > 0))
  const lo = Math.log(Math.min(...todos))
  const hi = Math.log(Math.max(...todos))
  const X = (i: number) => -tr.largura / 2 + (i / (n - 1)) * tr.largura
  const Y = (v: number) => ((Math.log(v) - lo) / (hi - lo || 1)) * tr.alto
  const Z = (k: number) => (tr.series.length < 2 ? 0 : -tr.fundo / 2 + (k / (tr.series.length - 1)) * tr.fundo)
  const pts = useMemo(
    () =>
      tr.series.flatMap((s, k) =>
        s.v.map((v, i) => (v !== null && v > 0 ? { k, i, p: new THREE.Vector3(X(i), Y(v), Z(k)), s, v } : null)).filter((x): x is NonNullable<typeof x> => x !== null),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tr],
  )
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((q) => q.p.toArray()), 3))
    g.setAttribute('aCor', new THREE.Float32BufferAttribute(new Float32Array(pts.length * 4), 4))
    return g
  }, [pts])
  const [linhas, forte] = useMemo(() => {
    const seg: number[] = []
    const segF: number[] = []
    tr.series.forEach((s, k) => {
      const alvo = s.forte ? segF : seg
      let ant: THREE.Vector3 | null = null
      s.v.forEach((v, i) => {
        if (v === null || v <= 0) return
        const p = new THREE.Vector3(X(i), Y(v), Z(k))
        if (ant) alvo.push(...ant.toArray(), ...p.toArray())
        ant = p
      })
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3))
    const f = new THREE.BufferGeometry()
    f.setAttribute('position', new THREE.Float32BufferAttribute(segF, 3))
    return [g, f]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr])
  const eixo = useMemo(() => {
    const y = -0.06
    const seg: number[] = [X(0), y, tr.fundo / 2 + 0.05, X(n - 1), y, tr.fundo / 2 + 0.05]
    for (const [i] of tr.eixo) seg.push(X(i), y, tr.fundo / 2 + 0.05, X(i), y - 0.05, tr.fundo / 2 + 0.05)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3))
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr])
  const elipse = useMemo(() => {
    const seg: number[] = []
    const N = 72
    for (let j = 0; j < N; j += 2) {
      const a0 = (j / N) * Math.PI * 2
      const a1 = ((j + 1) / N) * Math.PI * 2
      seg.push(0, tr.alto / 2 + Math.sin(a0) * (tr.alto * 0.62), Math.cos(a0) * (tr.fundo * 0.62 + 0.05), 0, tr.alto / 2 + Math.sin(a1) * (tr.alto * 0.62), Math.cos(a1) * (tr.fundo * 0.62 + 0.05))
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3))
    return g
  }, [tr])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        defines: DEF_CURVA,
        vertexShader: VS_PONTOS,
        fragmentShader: FS_PONTOS,
        uniforms: { uTam: { value: 7 }, uDpr: { value: 1 } },
        transparent: true,
        depthWrite: false,
      }),
    [],
  )
  useEffect(
    () => () => {
      geo.dispose()
      linhas.dispose()
      forte.dispose()
      eixo.dispose()
      elipse.dispose()
      mat.dispose()
    },
    [geo, linhas, forte, eixo, elipse, mat],
  )
  const anel = useRef<THREE.LineSegments>(null)
  const c = useMemo(() => new THREE.Color(), [])
  const [rotulos, setRotulos] = useState(false)
  useFrame(() => {
    mat.uniforms.uDpr.value = gl.getPixelRatio()
    const t = tempo()
    const ciclo = (t - 0.8) % (VARRE + PAUSA)
    const f = t < 0.8 ? 0 : Math.min(1, ciclo / VARRE)
    const xs = X(0) + f * (X(n - 1) - X(0))
    if (anel.current) {
      anel.current.position.x = xs
      anel.current.visible = t > 0.8 && ciclo < VARRE
    }
    const cor = geo.getAttribute('aCor') as THREE.BufferAttribute
    pts.forEach((q, j) => {
      const aceso = t > 0.8 && q.p.x <= xs + 0.001
      c.set(COR[q.s.tom])
      const forte = q.s.forte ? 1 : 0.55
      cor.setXYZW(j, c.r, c.g, c.b, (aceso ? 0.95 : 0.12) * forte)
    })
    cor.needsUpdate = true
    if (!rotulos && t > 1.6) setRotulos(true)
  })
  return (
    <group position={base}>
      <lineSegments geometry={linhas} frustumCulled={false} renderOrder={9}>
        <lineBasicMaterial color={TINTA} transparent opacity={0.06} depthWrite={false} defines={DEF_CURVA} />
      </lineSegments>
      <lineSegments geometry={forte} frustumCulled={false} renderOrder={9}>
        <lineBasicMaterial color={COR.couro} transparent opacity={0.7} depthWrite={false} defines={DEF_CURVA} />
      </lineSegments>
      <points geometry={geo} material={mat} frustumCulled={false} renderOrder={10} />
      <lineSegments geometry={eixo} frustumCulled={false} renderOrder={9}>
        <lineBasicMaterial color={TINTA} transparent opacity={0.55} depthWrite={false} defines={DEF_CURVA} />
      </lineSegments>
      <lineSegments geometry={elipse} position={[X(tr.ultimo), 0, 0]} frustumCulled={false} renderOrder={9}>
        <lineBasicMaterial color={TINTA} transparent opacity={0.5} depthWrite={false} defines={DEF_CURVA} />
      </lineSegments>
      <lineSegments ref={anel} geometry={elipse} frustumCulled={false} renderOrder={9}>
        <lineBasicMaterial color={COR.couro} transparent opacity={0.65} depthWrite={false} defines={DEF_CURVA} />
      </lineSegments>
      {rotulos && (
        <>
          <Html position={[X(tr.ultimo), tr.alto / 2 + tr.alto * 0.62 + 0.05, 0]} center calculatePosition={htmlCurvo} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
            <span className="ext-trelica-marca">{tr.marca}</span>
          </Html>
          {tr.eixo.map(([i, txt]) => (
            <Html key={i} position={[X(i), -0.16, tr.fundo / 2 + 0.05]} center calculatePosition={htmlCurvo} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
              <span className="ext-trelica-ano">{txt}</span>
            </Html>
          ))}
          {rotulosTrelica(tr, X, Y).map(({ s, pos }) => (
            <Html key={s.id} position={pos} calculatePosition={htmlCurvo} zIndexRange={[7, 0]} style={{ pointerEvents: 'none' }}>
              <span className={`ext-trelica-nome tom-${s.tom}`}>{s.rotulo}</span>
            </Html>
          ))}
        </>
      )}
    </group>
  )
}

/** Os nomes da treliça, cada um no último ponto da sua série, afastados na altura quando ficam perto demais. */
function rotulosTrelica(tr: Trelica, X: (i: number) => number, Y: (v: number) => number) {
  const lista = tr.series
    .map((s, k) => ({ s, k, u: s.v.map((v, i) => (v !== null && v > 0 ? i : -1)).filter((i) => i >= 0).pop() }))
    .filter((x): x is { s: Trelica['series'][number]; k: number; u: number } => !!x.s.rotulo && x.u !== undefined)
    .map((x) => ({ ...x, y: Y(x.s.v[x.u]!) }))
    .sort((a, b) => a.y - b.y)
  // os nomes ficam na frente da treliça, numa coluna depois do último ano, um abaixo do outro
  const vao = tr.alto * 0.13
  for (let i = 1; i < lista.length; i++) if (lista[i].y - lista[i - 1].y < vao) lista[i].y = lista[i - 1].y + vao
  return lista.map((x) => ({ s: x.s, pos: [X(tr.anos.length - 1) + 0.12, x.y, tr.fundo / 2 + 0.05] as [number, number, number] }))
}

/* ---------- rótulos: escritos sobre o mapa e afastados uns dos outros na tela ---------- */

const PX_LETRA = 8.4 // largura média de uma letra do rótulo (condensada, caixa alta, espaçada), em pixels
const ALTURA = 15

/**
 * Os rótulos só entram depois do primeiro quadro, com a tela já no lugar (o `Html` do drei, montado antes,
 * refaz a sua raiz). A cada quadro, os que se cobrem na tela descem ou sobem até se afastarem, e o deslocamento
 * segue suave, como as chamadas do visualizador do submarino (labelLayout.ts).
 */
function Rotulos({ rotulos, chave }: { rotulos: Rotulo[]; chave: string }) {
  const [pronto, setPronto] = useState(false)
  const desloc = useRef(new Map<string, number>())
  const { camera, size } = useThree()
  const p = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    if (!pronto) setPronto(true)
    const caixas = rotulos
      .map((r) => {
        p.copy(ponto(...r.em, 0.004))
        curvarPonto(p, camera.position).project(camera)
        const x = ((p.x + 1) / 2) * size.width
        const y = ((1 - p.y) / 2) * size.height
        const w = r.texto.length * PX_LETRA + 6
        const lado = r.lado ?? 'dir'
        const x0 = lado === 'dir' ? x + 10 : lado === 'esq' ? x - 10 - w : x - w / 2
        const y0 = lado === 'cima' ? y - 8 - ALTURA : lado === 'baixo' ? y + 8 : y - ALTURA / 2
        return { id: r.id, x0, x1: x0 + w, y0 }
      })
      .sort((a, b) => a.y0 - b.y0)
    const postos: { x0: number; x1: number; y0: number }[] = []
    const cobre = (a: { x0: number; x1: number; y0: number }) => postos.some((b) => a.x0 < b.x1 + 4 && b.x0 < a.x1 + 4 && a.y0 < b.y0 + ALTURA && b.y0 < a.y0 + ALTURA)
    for (const c of caixas) {
      let dy = 0
      for (const t of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
        dy = t * ALTURA
        if (!cobre({ ...c, y0: c.y0 + dy })) break
      }
      postos.push({ ...c, y0: c.y0 + dy })
      const atual = desloc.current.get(c.id)
      desloc.current.set(c.id, atual === undefined ? dy : THREE.MathUtils.damp(atual, dy, 10, Math.min(dt, 0.05)))
    }
  })
  if (!pronto) return null
  return (
    <>
      {rotulos.map((r) => (
        <Html
          key={`${chave}|${r.id}`}
          position={ponto(...r.em, 0.004)}
          calculatePosition={(el, cam, sz) => {
            const [x, y] = htmlCurvo(el, cam, sz)
            return [x, y + (desloc.current.get(r.id) ?? 0)]
          }}
          zIndexRange={[6, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span className={`ext-rotulo lado-${r.lado ?? 'dir'}${r.forte ? ' forte' : ''}${r.tom ? ` tom-${r.tom}` : ''}${r.classe ? ` ${r.classe}` : ''}`}>{r.texto}</span>
        </Html>
      ))}
    </>
  )
}

/* ---------- anéis: um lugar marcado ---------- */

const CIRCULO = (() => {
  const pts: THREE.Vector3[] = []
  const n = 64
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a0), 0, Math.sin(a0)), new THREE.Vector3(Math.cos(a1), 0, Math.sin(a1)))
  }
  return new THREE.BufferGeometry().setFromPoints(pts)
})()

function Anel({ m }: { m: Marca }) {
  const ref = useRef<THREE.LineSegments>(null)
  const mat = useRef<THREE.LineBasicMaterial>(null)
  const pos = useMemo(() => ponto(...m.em, 0.008), [m.em])
  const abre = useRef(0)
  useFrame(({ clock }, dt) => {
    const r = ref.current
    if (!r) return
    abre.current = Math.min(1, abre.current + Math.min(dt, 0.05) / 0.7)
    r.geometry.setDrawRange(0, Math.floor((CIRCULO.getAttribute('position').count * abre.current) / 2) * 2)
    r.scale.setScalar(m.raio * (m.pulsa ? 1 + 0.12 * Math.sin(clock.elapsedTime * 2) : 1))
    mat.current?.color.set(COR[m.tom])
  })
  const geo = useMemo(() => CIRCULO.clone(), [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <lineSegments ref={ref} position={pos} geometry={geo} frustumCulled={false} renderOrder={8}>
      <lineBasicMaterial ref={mat} color={COR[m.tom]} transparent opacity={0.9} depthWrite={false} defines={DEF_CURVA} />
    </lineSegments>
  )
}

/* ---------- o ponteiro: que país está sob ele, no chão curvo ---------- */

function Ponteiro({ mundo, onPais }: { mundo: DadosExterno['mundo']; onPais: (iso: string | null, x: number, y: number) => void }) {
  const { gl, camera } = useThree()
  const caixas = useMemo(
    () =>
      mundo.paises.map((p: Pais) => {
        let [a, b, c, d] = [Infinity, Infinity, -Infinity, -Infinity]
        for (const poli of p.poligonos)
          for (let k = 0; k + 1 < poli[0].length; k += 2) {
            a = Math.min(a, poli[0][k])
            c = Math.max(c, poli[0][k])
            b = Math.min(b, poli[0][k + 1])
            d = Math.max(d, poli[0][k + 1])
          }
        return { p, caixa: [a, b, c, d] }
      }),
    [mundo],
  )
  const avisar = useRef(onPais)
  avisar.current = onPais
  useEffect(() => {
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const v = new THREE.Vector2()
    const hit = new THREE.Vector3()
    const mover = (e: PointerEvent) => {
      if (e.buttons) return
      const r = el.getBoundingClientRect()
      v.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(v, camera)
      let iso: string | null = null
      if (noChao(ray.ray, MAP_Y, hit)) {
        const [lon, lat] = doChao(hit.x, hit.z)
        for (const { p, caixa } of caixas) {
          if (lon < caixa[0] || lon > caixa[2] || lat < caixa[1] || lat > caixa[3]) continue
          if (p.poligonos.some((poli) => dentroDoAnel(lon, lat, poli[0]) && !poli.slice(1).some((h) => dentroDoAnel(lon, lat, h)))) {
            iso = p.iso3
            break
          }
        }
      }
      avisar.current(iso, e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('pointermove', mover)
    return () => el.removeEventListener('pointermove', mover)
  }, [gl, camera, caixas])
  return null
}
