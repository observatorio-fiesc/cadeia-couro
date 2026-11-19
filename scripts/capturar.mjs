// Capturas automáticas do painel com o Chrome instalado (playwright-core, sem baixar navegador).
// Uso: node scripts/capturar.mjs <pasta-saida> [larguraxaltura] [base]
// Ex.: node scripts/capturar.mjs capturas 1920x1080 http://127.0.0.1:5180/
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [saida = 'capturas', tamanho = '1920x1080', base = 'http://127.0.0.1:5180/', soLista] = process.argv.slice(2)
const [largura, altura] = tamanho.split('x').map(Number)
const todas = [
  ['modelo3d', '?vista=bois'],
  ['modelo3d-hover', '?vista=bois&hover=grupao'],
  ['modelo3d-pele', '?vista=bois&hover=pele'],
  ['modelo3d-interior', '?vista=bois&modo=interior'],
  ['modelo3d-regiao', '?vista=bois&modo=regiao&regiao=barrigas&sexo=vaca'],
  ['modelo3d-dependencia', '?vista=bois&modo=regiao&regiao=grupao&lente=dependencia'],
  ['modelo3d-camadas', '?vista=bois&modo=pele'],
  ['modelo3d-transforma', '?vista=bois&modo=pele&camada=raspa'],
  ['cone', '?vista=cone'],
  ['cone-importado', '?vista=cone&lente=importado'],
  ['cone-ormuz', '?vista=cone&lente=ormuz'],
  ['cone-ambiente', '?vista=cone&lente=ambiente'],
  ['cone-enxofre', '?vista=cone&elo=rec.enxofre'],
  ['cadeia', '?vista=cadeia'],
  ['externo', '?vista=externo&sentido=exp&analise=ofertantes&passo=0&produto=acab'],
  ['externo-preco', '?vista=externo&sentido=exp&analise=precificacao&passo=0&produto=acab'],
  ['externo-potenciais', '?vista=externo&sentido=exp&analise=potenciais&passo=0'],
  ['externo-potenciais-europa', '?vista=externo&sentido=exp&analise=potenciais&passo=0&escolha=europa'],
  ['externo-origens', '?vista=externo&sentido=imp&analise=origens&passo=0&produto=cromo'],
  ['externo-preco-imp', '?vista=externo&sentido=imp&analise=precificacao&passo=0&produto=cromo'],
]
// quinto argumento opcional: nomes separados por vírgula (ex.: estrutura,ormuz)
const vistas = soLista ? todas.filter(([n]) => soLista.split(',').includes(n)) : todas

mkdirSync(saida, { recursive: true })
const navegador = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const pagina = await navegador.newPage({ viewport: { width: largura, height: altura } })
const erros = []
pagina.on('pageerror', (e) => erros.push(String(e)))
pagina.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') erros.push(m.type() + ': ' + m.text().slice(0, 400)) })
for (const [nome, query] of vistas) {
  await pagina.goto(base + query, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(nome.startsWith('modelo3d') ? 12000 : 3500)
  const arq = join(saida, `${nome}_${largura}x${altura}.png`)
  await pagina.screenshot({ path: arq })
  console.log('ok', arq)
}
if (erros.length) console.log('ERROS NA PÁGINA:\n' + erros.join('\n'))
await navegador.close()
