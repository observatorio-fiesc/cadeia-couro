// Testa a aba Modelo 3D com mouse e cliques: região, quadro de decomposição, camadas, transformações,
// interior e lente. Uso: node scripts/testar-interacao.mjs <pasta-saida> [base]
import { chromium } from 'playwright-core'

const [saida, base = 'http://127.0.0.1:5180/'] = process.argv.slice(2)
const nav = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const p = await nav.newPage({ viewport: { width: 1600, height: 900 } })
const erros = []
p.on('pageerror', (e) => erros.push(String(e)))
p.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) erros.push(m.text().slice(0, 200))
})
await p.goto(base + '?vista=bois', { waitUntil: 'networkidle' })
await p.waitForTimeout(4000)
// para o giro automático: o mouse fica parado sobre a cena
let achou = null
for (const [x, y] of [
  [1150, 420],
  [1100, 400],
  [1200, 450],
  [800, 380],
  [760, 400],
  [1250, 380],
  [700, 420],
]) {
  await p.mouse.move(x, y)
  await p.waitForTimeout(900)
  const n = await p.locator('.rot.pilula').count()
  if (n) {
    achou = [x, y, (await p.locator('.rot.pilula').first().innerText()).replace(/\s+/g, ' ')]
    break
  }
}
console.log('hover numa região:', achou)
if (achou) {
  await p.mouse.click(achou[0], achou[1])
  await p.waitForTimeout(9000)
  console.log('depois do clique, etapa ativa:', (await p.locator('.decomp-painel [aria-current="step"] .decomp-nome').first().innerText().catch(() => '-')).replace(/\s+/g, ' '))
  console.log('rótulos do gráfico:', await p.locator('.rot.legenda-q').count())
  await p.screenshot({ path: saida + '/int_regiao.png' })
}
// camadas pelo quadro
await p.locator('.decomp-painel .decomp-alvo', { hasText: 'Camadas' }).click()
await p.waitForTimeout(9000)
console.log('nomes de camada:', await p.locator('.rot.camada-nome').count())
// clica no nome da raspa: abre as transformações
await p.locator('.rot.camada-nome', { hasText: 'Raspa' }).click()
await p.waitForTimeout(5000)
console.log('amostras de transformação:', await p.locator('.rot.transforma figure').count())
await p.screenshot({ path: saida + '/int_camada.png' })
// interior
await p.locator('.decomp-painel .decomp-alvo', { hasText: 'O que mantém o animal' }).click()
await p.waitForTimeout(9000)
console.log('órgãos rotulados:', await p.locator('.rot.pilula.orgao').count(), '· insumos:', await p.locator('.rot.insumo').count())
// lente
// a lente é um menu da faixa de controles, depois do menu da vista
await p.locator('.faixa .menu-atual', { hasText: 'Insumos' }).click()
await p.locator('.menu-lista button', { hasText: 'Dependência externa' }).click()
await p.waitForTimeout(3000)
console.log('chave da lente:', (await p.locator('.controles-legenda .legenda-chaves').innerText().catch(() => '-')).replace(/\s+/g, ' '))
await p.screenshot({ path: saida + '/int_interior_lente.png' })
// volta
await p.keyboard.press('Escape')
await p.waitForTimeout(7000)
console.log('depois do Esc, etapa ativa:', (await p.locator('.decomp-painel [aria-current="step"] .decomp-nome').first().innerText().catch(() => '-')).replace(/\s+/g, ' '))
await p.screenshot({ path: saida + '/int_volta.png' })
console.log(erros.length ? 'ERROS: ' + erros.join('\n') : 'sem erros de página')
await nav.close()
