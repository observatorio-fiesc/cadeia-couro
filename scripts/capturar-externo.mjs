// Capturas das passadas da aba Mercado externo, num só navegador, com o servidor de desenvolvimento rodando:
// node scripts/capturar-externo.mjs <pasta> [espera-ms] [larguraxaltura] [sentido:analise:passo[:produto] ...]
// Sem passadas, captura todas. Os erros do console saem agrupados (texto e número de vezes).
import { chromium } from 'playwright-core'

const TODAS = [
  'exp:ofertantes:0', 'exp:ofertantes:1', 'exp:precificacao:0', 'exp:precificacao:1', 'exp:precificacao:2', 'exp:criticidade:0', 'exp:criticidade:1',
  'exp:compradores:0', 'exp:compradores:1', 'exp:potenciais:0', 'exp:potenciais:1', 'exp:potenciais:2', 'exp:potenciais:3', 'exp:potenciais:4',
  'exp:luxo:0', 'exp:luxo:1', 'exp:automotivo:0', 'exp:automotivo:1',
  'imp:origens:0', 'imp:origens:1', 'imp:precificacao:0', 'imp:criticidade:0', 'imp:criticidade:1', 'imp:curtume:0', 'imp:boi:0',
]
const [pasta = 'capturas', espera = '9000', tam = '1600x900', ...pedidas] = process.argv.slice(2)
const [w, h] = tam.split('x').map(Number)
const base = process.env.BASE ?? 'http://127.0.0.1:5180/'
const nav = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
for (const pedido of pedidas.length ? pedidas : TODAS) {
  const [sentido, analise, passo = '0', produto] = pedido.split(':')
  const p = await nav.newPage({ viewport: { width: w, height: h } })
  const erros = new Map()
  const anotar = (t) => erros.set(t, (erros.get(t) ?? 0) + 1)
  p.on('pageerror', (x) => anotar(String(x).slice(0, 220)))
  p.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') anotar(m.text().slice(0, 220))
  })
  const q = new URLSearchParams({ vista: 'externo', sentido, analise, passo })
  if (produto) q.set('produto', produto)
  await p.goto(`${base}?${q}#externo`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(Number(espera))
  const nome = `ext-${sentido}-${analise}-${passo}${produto ? '-' + produto : ''}`
  await p.screenshot({ path: `${pasta}/${nome}.png` })
  console.log(nome, erros.size ? '' : 'ok')
  for (const [t, n] of erros) console.log(`  ${n}× ${t}`)
  await p.close()
}
await nav.close()
