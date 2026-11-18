// Uma captura, com espera ajustável: node scripts/capturar-uma.mjs <url> <arquivo.png> [larguraxaltura] [espera-ms]
import { chromium } from 'playwright-core'

const [url, arq, tam = '1600x900', espera = '6000'] = process.argv.slice(2)
const [w, h] = tam.split('x').map(Number)
const nav = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const p = await nav.newPage({ viewport: { width: w, height: h } })
const erros = []
p.on('pageerror', (e) => erros.push(String(e)))
p.on('console', (m) => {
  if (m.type() === 'error') erros.push(m.text().slice(0, 300))
})
await p.goto(url, { waitUntil: 'networkidle' })
await p.waitForTimeout(Number(espera))
await p.screenshot({ path: arq })
console.log('ok', arq, erros.length ? '\nERROS: ' + erros.join('\n') : '')
await nav.close()
