// Confere o mapa do processo contra a cadeia, como o painel faz na carga: junta cadeia-extra.json, aplica
// processo.json e lista as pendências e as arestas de insumo para etapa que mudaram em relação a cadeia.json.
// Uso: node scripts/conferir-processo.ts (o Node 24 roda TypeScript direto)
import { readFileSync } from 'node:fs'
import { juntar, recalcularAlcances, type Cadeia } from '../src/dados/cadeia.ts'
import { aplicarProcesso, type Processo } from '../src/dados/processo.ts'

const ler = (arq: string) => JSON.parse(readFileSync(new URL(`../public/data/${arq}`, import.meta.url), 'utf8'))
const original: Cadeia = ler('cadeia.json')
const c: Cadeia = ler('cadeia.json')
juntar(c, ler('cadeia-extra.json'))
const p: Processo = ler('processo.json')
const ixp = aplicarProcesso(c, p)
recalcularAlcances(c)

const nome = (id: string) => c.nos.find((n) => n.id === id)?.nome ?? id
const chave = (a: { de: string; para: string }) => `${a.de}>${a.para}`
const etapas = new Set(p.etapas.map((e) => e.id))
const deEtapa = (x: Cadeia) => new Set(x.arestas.filter((a) => etapas.has(a.para) && a.tipo !== 'visual' && !a.de.startsWith('sis.')).map(chave))
const antes = deEtapa(original)
const depois = deEtapa(c)
const novas = [...depois].filter((k) => !antes.has(k))
const saem = [...antes].filter((k) => !depois.has(k))

console.log(`Processo: ${p.etapas.length} etapas, ${p.operacoes.length} operações, ${p.estados.length} estados, ${p.saidas.length} saídas`)
for (const e of p.etapas) {
  const ops = ixp.operacoesDe.get(e.id) ?? []
  console.log(`  ${nome(e.id)} (${e.lugar}): ${ops.map((o) => o.nome + (o.produz ? ` → ${ixp.estado.get(o.produz)?.nome}` : '')).join(' · ')}`)
}
console.log(`\nArestas de insumo para etapa: ${antes.size} em cadeia.json, ${depois.size} derivadas do processo`)
console.log(`  novas (${novas.length}): ${novas.map((k) => k.split('>').map(nome).join(' → ')).join('; ')}`)
console.log(`  retiradas (${saem.length}): ${saem.map((k) => k.split('>').map(nome).join(' → ')).join('; ') || 'nenhuma'}`)
console.log(`\nPendências: ${ixp.pendencias.length}`)
for (const x of ixp.pendencias) console.log('  - ' + x)
// todo insumo de camada 2 da oferta deve entrar em alguma operação ou em algum nó da cadeia
const soltos = c.nos.filter((n) => n.lado === 'oferta' && n.camada === 2 && !c.arestas.some((a) => a.de === n.id))
console.log(`\nInsumos que não entram em nada: ${soltos.length ? soltos.map((n) => n.nome).join('; ') : 'nenhum'}`)
process.exitCode = ixp.pendencias.length || soltos.length ? 1 : 0
