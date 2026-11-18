// Monta a pasta publicada como site (Artifact do claude.ai) a partir do build (dist/).
// O site embrulha a página num esqueleto <!doctype html><head>…<body>: por isso index.html sai sem essas tags,
// com o <title> e o CSS embutido no topo. O código vai num arquivo de nome fixo (assets/painel.js), para cada nova
// publicação substituir o anterior no mesmo endereço; o ?v= evita cache velho.
// Uso: npm run build && node scripts/montar-site.mjs <pasta-saida>
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const saida = process.argv[2]
if (!saida) throw new Error('informe a pasta de saída')
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const assets = readdirSync(join(dist, 'assets'))
const js = assets.find((a) => a.endsWith('.js'))
const css = assets.find((a) => a.endsWith('.css'))
const versao = js.replace(/^index-|\.js$/g, '')

rmSync(saida, { recursive: true, force: true })
mkdirSync(join(saida, 'assets'), { recursive: true })
cpSync(join(dist, 'assets', js), join(saida, 'assets', 'painel.js'))
cpSync(join(dist, 'data'), join(saida, 'data'), { recursive: true })

const pagina = `<title>Cadeia do couro Viposa</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans+Condensed:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
${readFileSync(join(dist, 'assets', css), 'utf8')}
</style>
<div id="root"></div>
<script type="module" src="./assets/painel.js?v=${versao}"></script>
`
writeFileSync(join(saida, 'index.html'), pagina, 'utf8')

const listar = (d, base = '') =>
  readdirSync(join(d, base), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listar(d, join(base, e.name)) : [join(base, e.name).replaceAll('\\', '/')]))
console.log(JSON.stringify({ pagina: 'index.html', arquivos: listar(saida).filter((a) => a !== 'index.html'), versao }, null, 1))
