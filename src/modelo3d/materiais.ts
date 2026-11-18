// Materiais da aba Modelo 3D.
// Contorno: a linha aparece onde a superfície vira de lado para a câmera, com largura constante em pixels
// (derivada de tela), como um desenho a traço. O corpo é transparente: um passe só de profundidade esconde
// as dobras internas, e o contorno é pintado só na superfície da frente.
// Mistura: manchas orgânicas (Voronoi com o domínio torcido por ruído, em duas escalas) sorteadas na
// proporção das doses; cada mancha leva a cor de um químico.
import * as THREE from 'three'

export const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255]
const v3 = (hex: string) => new THREE.Vector3(...rgb(hex))

// ---------------------------------------------------------------- passe de profundidade
// transparente de propósito: entra na fila dos transparentes e respeita a ordem de desenho (renderOrder)
export function matPreparo(marcaStencil: boolean) {
  const m = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
  if (marcaStencil) {
    m.stencilWrite = true
    m.stencilRef = 1
    m.stencilFunc = THREE.AlwaysStencilFunc
    m.stencilZPass = THREE.ReplaceStencilOp
  }
  return m
}

// ---------------------------------------------------------------- contorno
const VERT_CONTORNO = /* glsl */ `
  attribute float reg;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vP;
  varying float vReg;
  void main() {
    vReg = reg;
    vP = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }`
const FRAG_CONTORNO = /* glsl */ `
  uniform vec3 cor;
  uniform float opac;
  uniform float largura;
  uniform float preench;
  uniform vec3 corPreench;
  uniform float tracejado;
  uniform float realce;
  uniform vec3 corRealce;
  uniform float alfaRealce;
  uniform float realce2;
  uniform float alfaRealce2;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vP;
  varying float vReg;
  void main() {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(vV);
    float f = dot(n, v);
    float w = max(fwidth(f), 1e-5);
    float d = abs(f) / w;
    float lin = 1.0 - smoothstep(largura * 0.5, largura * 0.5 + 1.0, d);
    if (tracejado > 0.0) {
      float t = fract(dot(vP, vec3(1.7, 2.3, 1.9)) * tracejado);
      lin *= step(0.42, t);
    }
    vec3 c = corPreench;
    float a = preench;
    if (realce >= 0.0 && abs(vReg - realce) < 0.5) { c = corRealce; a = alfaRealce; }
    if (realce2 >= 0.0 && abs(vReg - realce2) < 0.5) { c = corRealce; a = alfaRealce2; }
    c = mix(c, cor, lin);
    a = mix(a, 1.0, lin);
    if (a * opac < 0.004) discard;
    gl_FragColor = vec4(c, a * opac);
  }`

export type OpContorno = { cor?: string; opac?: number; largura?: number; preench?: number; corPreench?: string; tracejado?: number; foraDoCorpo?: boolean; frente?: boolean }
export function matContorno(o: OpContorno = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      cor: { value: v3(o.cor ?? '#f6f1e7') },
      opac: { value: o.opac ?? 1 },
      largura: { value: o.largura ?? 1.6 },
      preench: { value: o.preench ?? 0 },
      corPreench: { value: v3(o.corPreench ?? '#f6f1e7') },
      tracejado: { value: o.tracejado ?? 0 },
      realce: { value: -1 },
      corRealce: { value: v3('#cf8a52') },
      alfaRealce: { value: 0.3 },
      realce2: { value: -1 },
      alfaRealce2: { value: 0.12 },
    },
    vertexShader: VERT_CONTORNO,
    fragmentShader: FRAG_CONTORNO,
    transparent: true,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    side: o.frente ? THREE.FrontSide : THREE.DoubleSide,
  })
  if (o.foraDoCorpo) {
    // só onde o corpo não está: a faixa entre o corpo e a linha de fora
    m.stencilWrite = true
    m.stencilWriteMask = 0
    m.stencilRef = 1
    m.stencilFunc = THREE.NotEqualStencilFunc
    m.stencilFail = THREE.KeepStencilOp
    m.stencilZFail = THREE.KeepStencilOp
    m.stencilZPass = THREE.KeepStencilOp
  }
  return m
}

// ---------------------------------------------------------------- ruído comum (hash inteiro: igual em qualquer placa)
const RUIDO = /* glsl */ `
  uint hu(uvec2 v) {
    v = v * 1664525u + 1013904223u;
    v.x += v.y * 1664525u; v.y += v.x * 1664525u;
    v = v ^ (v >> 16u);
    v.x += v.y * 1664525u; v.y += v.x * 1664525u;
    v = v ^ (v >> 16u);
    return v.x ^ v.y;
  }
  float h1(vec2 c) { return float(hu(uvec2(ivec2(floor(c)) + 32768))) / 4294967295.0; }
  vec2 h2(vec2 c) { return vec2(h1(c), h1(c + vec2(57.0, 113.0))); }
  float vruido(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), u.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * vruido(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
    return s;
  }
  // célula de Voronoi: id da mais próxima, distância à mais próxima (f1) e à segunda (f2)
  void voronoi(vec2 q, out vec2 id, out float f1, out float f2) {
    vec2 ip = floor(q); vec2 fp = fract(q);
    f1 = 8.0; f2 = 8.0; id = ip;
    for (int j = -1; j <= 1; j++)
      for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j));
        vec2 r = o + 0.12 + 0.76 * h2(ip + o) - fp;
        float d = dot(r, r);
        if (d < f1) { f2 = f1; f1 = d; id = ip + o; } else if (d < f2) { f2 = d; }
      }
    f1 = sqrt(f1); f2 = sqrt(f2);
  }
`

// ---------------------------------------------------------------- mistura de químicos na peça de pele
const MAXC = 10
export function matMistura() {
  const cores = Array.from({ length: MAXC }, () => new THREE.Vector3(1, 1, 1))
  const acum = Array.from({ length: MAXC }, () => 1)
  return new THREE.ShaderMaterial({
    uniforms: {
      cores: { value: cores },
      acum: { value: acum },
      n: { value: 1 },
      celula: { value: 0.06 },
      mistura: { value: 0.38 },
      torcao: { value: 0.55 },
      rugas: { value: 0 },
      bolinhas: { value: 0 },
      foco: { value: -1 },
      opac: { value: 1 },
      textura: { value: 1 },
      fundo: { value: v3('#14110d') },
      branco: { value: v3('#f6f1e7') },
      semente: { value: 0 },
      luz: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
    },
    vertexShader: /* glsl */ `
      attribute vec2 uvm;
      attribute float lado;
      varying vec2 vUv;
      varying float vLado;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vNw;
      void main() {
        vUv = uvm;
        vLado = lado;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vNw = normalize(mat3(modelMatrix) * normal);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      precision highp int;
      uniform vec3 cores[${MAXC}];
      uniform float acum[${MAXC}];
      uniform int n;
      uniform float celula;
      uniform float mistura;
      uniform float torcao;
      uniform float rugas;
      uniform float bolinhas;
      uniform float foco;
      uniform float opac;
      uniform float textura;
      uniform vec3 fundo;
      uniform vec3 branco;
      uniform float semente;
      uniform vec3 luz;
      varying vec2 vUv;
      varying float vLado;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vNw;
      ${RUIDO}
      int categoria(float h) {
        for (int i = 0; i < ${MAXC}; i++) {
          if (i >= n) break;
          if (h < acum[i]) return i;
        }
        return n - 1;
      }
      void main() {
        vec2 p = vUv / celula;
        vec2 w = vec2(fbm(p * 0.55 + semente), fbm(p * 0.55 + 7.3 + semente)) - 0.5;
        vec2 id1; float a1; float b1;
        voronoi(p + w * torcao * 2.2, id1, a1, b1);
        vec2 id2; float a2; float b2;
        voronoi(p * 2.7 + w * torcao * 3.0 + 11.0, id2, a2, b2);
        bool miuda = h1(id2 + 31.0) < mistura;
        vec2 idc = miuda ? id2 + 400.0 : id1;
        int c = categoria(h1(idc + semente));
        vec3 col = cores[c];
        // nuance dentro da mancha: tom e veio suaves
        col *= 0.86 + 0.2 * h1(idc + 17.0) + 0.12 * (fbm(p * 3.1 + idc) - 0.5);
        // perto da divisa, a cor puxa um pouco a da mancha vizinha: transição orgânica
        int cv = categoria(h1((miuda ? id1 : id2 + 400.0) + semente));
        col = mix(col, cores[cv] * 0.95, 0.22 * (1.0 - smoothstep(0.0, 0.22, miuda ? b2 - a2 : b1 - a1)));
        // divisas finas e claras (1 pixel), como os limites do mapa do painel florestal
        float e1 = (b1 - a1) / max(fwidth(b1 - a1), 1e-5);
        float e2 = (b2 - a2) / max(fwidth(b2 - a2), 1e-5);
        float d1 = 1.0 - smoothstep(0.6, 1.5, e1);
        float d2 = miuda ? 1.0 - smoothstep(0.5, 1.2, e2) : 0.0;
        col = mix(col, branco, 0.34 * max(d1, d2 * 0.65));
        // foco num químico: os outros recuam
        if (foco >= 0.0 && abs(float(c) - foco) > 0.5) col = mix(fundo, col, 0.16);
        // rugas: linhas que cruzam a peça, quebradas pelo ruído
        if (rugas > 0.0) {
          float r = abs(sin(vUv.x * 46.0 + fbm(vUv * 5.0) * 5.0));
          float corte = smoothstep(0.42, 0.58, fbm(vUv * 7.0 + 3.0));
          float lr = (1.0 - smoothstep(0.0, 0.07, r)) * corte * rugas;
          col = mix(col, branco, lr * 0.55);
        }
        // bolinhas: o enchimento do recurtimento nas partes frouxas
        if (bolinhas > 0.0) {
          vec2 g = vUv / 0.085;
          vec2 gi = floor(g);
          float tem = step(h1(gi + 71.0), bolinhas);
          vec2 cc = gi + 0.25 + 0.5 * h2(gi + 5.0);
          float rr = 0.09 + 0.15 * h1(gi + 9.0);
          float dd = length(g - cc);
          float aw = fwidth(dd);
          float anel = (1.0 - smoothstep(rr - aw * 1.2, rr, dd)) - (1.0 - smoothstep(rr - aw * 2.6, rr - aw * 1.4, dd));
          float dentro = 1.0 - smoothstep(rr - aw, rr, dd);
          col = mix(col, branco, tem * (anel * 0.95 + dentro * 0.16));
        }
        // volume: luz simples e borda mais escura
        float lam = 0.68 + 0.42 * max(dot(normalize(vNw), luz), 0.0);
        col *= lam;
        if (vLado > 0.75) col *= 0.42;
        else if (vLado > 0.25) col *= 0.7;
        // contorno de tela
        vec3 nn = normalize(vN);
        if (!gl_FrontFacing) nn = -nn;
        float f = dot(nn, normalize(vV));
        float lin = 1.0 - smoothstep(0.8, 1.8, abs(f) / max(fwidth(f), 1e-5));
        col = mix(col, branco, lin * 0.9);
        // em trânsito, só o traço e um véu claro; a textura entra quando a peça chega
        gl_FragColor = vec4(mix(branco, col, textura), opac * mix(max(lin, 0.06), 1.0, textura));
      }`,
    side: THREE.DoubleSide,
    transparent: true,
  })
}
export function definirMistura(m: THREE.ShaderMaterial, cores: string[], valores: number[]) {
  const total = valores.reduce((a, b) => a + b, 0) || 1
  let s = 0
  const u = m.uniforms
  for (let i = 0; i < MAXC; i++) {
    if (i < cores.length) {
      s += valores[i] / total
      ;(u.cores.value as THREE.Vector3[])[i].set(...rgb(cores[i]))
      ;(u.acum.value as number[])[i] = i === cores.length - 1 ? 1.01 : s
    } else (u.acum.value as number[])[i] = 2
  }
  u.n.value = cores.length
}

// ---------------------------------------------------------------- texturas das camadas do couro
// poros: a flor, com os furos dos pelos em grupos; lixa: riscos finos de lixa; fibras: o lado do carnal,
// com fibras curtas e soltas; emaranhado: serragem e aparas, fibras curtas emboladas e pontos de cromo
const TEXTURAS = { poros: 0, lixa: 1, fibras: 2, emaranhado: 3 } as const
export function matCamada(textura: keyof typeof TEXTURAS, cor: string, corLado: string) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tipo: { value: TEXTURAS[textura] },
      cor: { value: v3(cor) },
      corLado: { value: v3(corLado) },
      branco: { value: v3('#f6f1e7') },
      cromo: { value: v3('#5daed2') },
      opac: { value: 1 },
      textura: { value: 1 },
      realce: { value: 0 },
      luz: { value: new THREE.Vector3(0.35, 0.85, 0.4).normalize() },
      tempo: { value: 0 },
      onda: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float lado;
      uniform float tempo;
      uniform float onda;
      varying vec3 vL;
      varying float vLado;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vNw;
      void main() {
        vL = position;
        vLado = lado;
        vec3 p = position;
        // folhas finas: um respiro lento nas pontas, sem espetáculo
        float r = length(p.xz);
        p.y += onda * 0.012 * r * r * sin(tempo * 0.7 + p.x * 3.0 + p.z * 2.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal);
        vNw = normalize(mat3(modelMatrix) * normal);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform int tipo;
      uniform vec3 cor;
      uniform vec3 corLado;
      uniform vec3 branco;
      uniform vec3 cromo;
      uniform float opac;
      uniform float textura;
      uniform float realce;
      uniform vec3 luz;
      varying vec3 vL;
      varying float vLado;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vNw;
      ${RUIDO}
      // distância de p a um traço curto com centro c, direção a e meio-comprimento l
      float traco(vec2 p, vec2 c, float a, float l) {
        vec2 d = vec2(cos(a), sin(a));
        vec2 q = p - c;
        float t = clamp(dot(q, d), -l, l);
        return length(q - d * t);
      }
      void main() {
        bool topo = vLado < 0.25;
        vec2 uv = topo ? vL.xz : vec2(vL.x + vL.z, vL.y);
        vec3 col = topo ? cor : corLado;
        col *= 0.9 + 0.2 * (fbm(uv * 6.0) - 0.5);
        if (topo) {
          if (tipo == 0) {
            // poros em trincas, como na flor do couro bovino
            vec2 g = uv / 0.034;
            vec2 gi = floor(g);
            float m = 0.0;
            for (int k = 0; k < 3; k++) {
              vec2 c = gi + 0.25 + 0.5 * h2(gi + float(k) * 13.0);
              float d = length(g - c);
              m = max(m, 1.0 - smoothstep(0.07, 0.13, d));
            }
            col = mix(col, col * 0.45, m);
            float ru = abs(sin(uv.x * 38.0 + fbm(uv * 9.0) * 6.0) * sin(uv.y * 31.0 + fbm(uv * 8.0 + 4.0) * 6.0));
            col = mix(col, col * 0.78, (1.0 - smoothstep(0.0, 0.05, ru)) * 0.6);
          } else if (tipo == 1) {
            // riscos de lixa, todos na mesma direção
            float s = fract(uv.x * 70.0 + fbm(uv * vec2(3.0, 40.0)) * 1.6);
            float risco = 1.0 - smoothstep(0.0, 0.12, abs(s - 0.5));
            col = mix(col, col * 1.18, risco * 0.35);
            col = mix(col, col * 0.85, (1.0 - smoothstep(0.0, 0.05, abs(fract(uv.x * 23.0 + fbm(uv * 4.0)) - 0.5))) * 0.3);
          } else {
            // fibras curtas: soltas na raspa, emboladas nas sobras
            float cel = tipo == 2 ? 0.024 : 0.02;
            vec2 g = uv / cel;
            vec2 gi = floor(g);
            float m = 0.0;
            for (int j = -1; j <= 1; j++)
              for (int i = -1; i <= 1; i++) {
                vec2 o = gi + vec2(float(i), float(j));
                for (int k = 0; k < 2; k++) {
                  vec2 c = o + h2(o + float(k) * 7.0);
                  float a = 6.2832 * h1(o + float(k) * 3.0 + 1.0);
                  float l = tipo == 2 ? 0.55 + 0.35 * h1(o + 5.0) : 0.35 + 0.3 * h1(o + 5.0);
                  float d = traco(g, c, a, l);
                  float esp = tipo == 2 ? 0.06 : 0.075;
                  m = max(m, 1.0 - smoothstep(esp, esp * 2.2, d));
                }
              }
            vec3 fio = tipo == 2 ? col * 1.32 : col * 1.45;
            col = mix(col * 0.82, fio, m * 0.85);
            if (tipo == 3) {
              float pt = step(0.86, h1(floor(uv / 0.016) + 3.0)) * (1.0 - smoothstep(0.18, 0.32, length(fract(uv / 0.016) - 0.5)));
              col = mix(col, cromo, pt * 0.8);
            }
          }
        } else {
          // corte: o feixe de fibras visto de lado
          float ondas = abs(sin(uv.y * 160.0 + fbm(uv * vec2(9.0, 2.0)) * 7.0));
          float lf = 1.0 - smoothstep(0.0, 0.18, ondas);
          col = mix(col, col * (tipo >= 2 ? 1.25 : 1.12), lf * 0.6);
        }
        float lam = 0.62 + 0.48 * max(dot(normalize(vNw), luz), 0.0);
        col *= lam;
        col = mix(col, col * 1.25 + 0.04, realce * 0.5);
        vec3 nn = normalize(vN);
        if (!gl_FrontFacing) nn = -nn;
        float f = dot(nn, normalize(vV));
        float lin = 1.0 - smoothstep(0.7, 1.7, abs(f) / max(fwidth(f), 1e-5));
        col = mix(col, branco, lin * (0.75 + 0.25 * realce));
        // em trânsito, só o traço e um véu claro; a textura entra quando a camada chega
        gl_FragColor = vec4(mix(branco, col, textura), opac * mix(max(lin, 0.06), 1.0, textura));
      }`,
    side: THREE.DoubleSide,
    transparent: true,
  })
}

// ---------------------------------------------------------------- grade do chão (tela inteira) e sombra quadriculada
export function matGrade(o: { menor: number; maior: number; alfaMenor: number; alfaMaior: number; raio: number; cor: string; preench?: number; borda?: number }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      menor: { value: o.menor },
      maior: { value: o.maior },
      alfaMenor: { value: o.alfaMenor },
      alfaMaior: { value: o.alfaMaior },
      raio: { value: o.raio },
      cor: { value: v3(o.cor) },
      preench: { value: o.preench ?? 0 },
      borda: { value: o.borda ?? 0 },
      opac: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float menor;
      uniform float maior;
      uniform float alfaMenor;
      uniform float alfaMaior;
      uniform float raio;
      uniform vec3 cor;
      uniform float preench;
      uniform float borda;
      uniform float opac;
      varying vec3 vW;
      varying vec2 vUv;
      float grade(vec2 c, float esp) {
        vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
        return 1.0 - min(min(g.x, g.y) / esp, 1.0);
      }
      void main() {
        float a = grade(vW.xz / menor, 1.0) * alfaMenor;
        a = max(a, grade(vW.xz / maior, 1.4) * alfaMaior);
        if (borda > 0.0) {
          vec2 e = min(vUv, 1.0 - vUv) / fwidth(vUv);
          a = max(a, (1.0 - min(min(e.x, e.y) / 1.3, 1.0)) * borda);
        }
        a = max(a, preench);
        float fade = 1.0 - smoothstep(raio * 0.45, raio, length(vW.xz));
        a *= fade * opac;
        if (a < 0.003) discard;
        gl_FragColor = vec4(cor, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}
