// Várias capturas num só navegador: node scripts/capturar-estados.mjs <pasta> <espera-ms> nome=consulta [nome=consulta ...]
// a consulta vai depois de ?vista=bois& (ex.: modo=regiao&regiao=barrigas)
import { chromium } from 'playwright-core'

const [pasta, espera = '9000', ...estados] = process.argv.slice(2)
const base = process.env.BASE ?? 'http://127.0.0.1:5180/'
const nav = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
for (const e of estados) {
  const [nome, consulta = ''] = e.split('=').length > 1 ? [e.slice(0, e.indexOf('=')), e.slice(e.indexOf('=') + 1)] : [e, '']
  const p = await nav.newPage({ viewport: { width: 1600, height: 900 } })
  const erros = []
  p.on('pageerror', (x) => erros.push(String(x)))
  p.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('404')) erros.push(m.text().slice(0, 300))
  })
  await p.goto(`${base}?vista=bois&${consulta}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(Number(espera))
  await p.screenshot({ path: `${pasta}/${nome}.png` })
  console.log(nome, erros.length ? 'ERROS: ' + erros.join(' | ') : 'ok')
  await p.close()
}
await nav.close()
