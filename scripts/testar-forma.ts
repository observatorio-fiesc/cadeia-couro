import { gerarModelo, VERT_BLOCO } from '../src/modelo3d/forma.ts'
const m = gerarModelo('boi')
const pp = m.pele.pp
const faixa = (ids: number[]) => {
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]
  for (const id of ids) for (let v = id * VERT_BLOCO; v < (id + 1) * VERT_BLOCO; v++) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], pp[v * 3 + c]); mx[c] = Math.max(mx[c], pp[v * 3 + c]) }
  return { mn: mn.map((x) => +x.toFixed(3)), mx: mx.map((x) => +x.toFixed(3)) }
}
console.log('corpo', faixa(m.blocos.filter((b) => b.perna < 0).map((b) => b.id)))
for (let p = 0; p < 4; p++) console.log('perna', p, faixa(m.blocos.filter((b) => b.perna === p).map((b) => b.id)))
console.log('nCorpo', m.nCorpo, 'blocos', m.blocos.length, 'verts', pp.length / 3)
const y = new Set<number>(); for (let i = 1; i < pp.length; i += 3) y.add(+pp[i].toFixed(3)); console.log('valores de y na pele aberta', [...y].slice(0, 10))
