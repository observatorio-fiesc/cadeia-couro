# Cadeia produtiva do couro · Viposa

Painel interativo da cadeia do couro da Viposa, do boi ao calçado de segurança. Acompanha as plantas de Várzea Grande (MT), Nova Andradina (MS) e Caçador (SC). Feito em React, TypeScript e three.js, com Vite.

A versão publicada é uma página privada no claude.ai: <https://claude.ai/artifact/KLHESPPKaT9Kp2qozpTzpS>. Só a dona da página e quem recebeu acesso conseguem abrir.

Painel de análise feito com dados e documentos públicos; não é publicação da Viposa.

## Abas

| Aba | Endereço | O que mostra |
|---|---|---|
| Modelo 3D | `#bois` | Dois sistemas, escolhidos no título. **Boi e vaca**: tudo sai dos animais: o rúmen e o que entra nele (pasto, ração, adubos); a pele por região, no próprio corpo, com a química da ribeira (MT) ao lado; as camadas do couro ao lado do animal (um toque no vão da pele) e o que cada uma pode virar (MS). **Sapato de segurança**: a bota, peça a peça (SC). Tudo em traço e curvas de nível, sem pintura; só o gráfico de composição tem cor. Cada item abre de onde vem na cadeia. Inclui uma lente de dependência externa |
| Cone 3D | `#cone` | A cadeia de oferta em cone, com lentes: importado, Ormuz, China e confiança |
| Cadeia | `#cadeia` | Árvore de dependências de cada elo |
| Logística no Brasil | `#brasil` | Rotas das plantas até os portos |
| Insumos no mundo | `#mundo` | Origem das importações de cada insumo |
| Ormuz 2026 | `#ormuz` | O fechamento do estreito e os insumos expostos |
| Mercados e casos | `#mercados` | Tarifas dos EUA, produção de bovinos e luxo europeu |

## Requisitos

- Node.js 20 ou mais novo (testado com o 24; ver `.nvmrc`) e npm.
- Google Chrome instalado, só para os scripts de captura e de teste: eles usam o Chrome da máquina com `playwright-core`, sem baixar navegador.

## Como rodar

```bash
npm install
npm run dev
```

O painel abre em <http://127.0.0.1:5180/>.

No servidor local, a URL também aceita parâmetros que abrem um estado pronto. Exemplos:

- `?vista=bois&modo=regiao&regiao=barrigas&sexo=vaca`
- `?vista=bois&modo=pele&camada=raspa&lente=dependencia`
- `?vista=cone&lente=ormuz`

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento na porta 5180 |
| `npm run build` | Checa os tipos e gera o build em `dist/` |
| `npm run preview` | Serve o `dist/` |
| `npm run typecheck` | Só a checagem de tipos |
| `npm run site` | Build e montagem da pasta `site/`, que é publicada no claude.ai (ver abaixo) |
| `npm run capturas` | Capturas de tela de todas as abas em `capturas/`, com o servidor de desenvolvimento rodando |
| `npm run teste` | Teste de interação da aba Modelo 3D (mouse, cliques, quadro, lente e Esc), com o servidor rodando |

Outros scripts em `scripts/`:

- `node scripts/capturar-uma.mjs <url> <arquivo.png> [1600x900] [espera-ms]`: uma captura;
- `node scripts/capturar-estados.mjs <pasta> <espera-ms> nome=consulta ...`: vários estados da aba Modelo 3D num só navegador;
- `node scripts/testar-forma.ts`: confere a geometria do boi e da vaca (o Node 24 roda TypeScript direto).

## Estrutura

```
cadeia-couro-viposa/
├── index.html              página de entrada do Vite
├── package.json            dependências e scripts
├── tsconfig.json           TypeScript estrito
├── vite.config.ts          base relativa e porta 5180
├── public/
│   └── data/               dados prontos que o painel lê em tempo de execução (JSON)
│       └── geo/            malhas: UFs (IBGE), rodovias federais (DNIT), países (Natural Earth)
├── scripts/                capturas, teste de interação e montagem do site
└── src/
    ├── main.tsx            ponto de entrada (sem StrictMode: ver o comentário no arquivo)
    ├── App.tsx             abas, controles e painel de fontes
    ├── componentes/        ficha do elo, painéis das lentes e gráficos em SVG
    ├── dados/              carga e índice dos JSON (cadeia, abate, logística, mercados)
    ├── lib/                formatação de números, projeções de mapa, layout do cone e lentes
    ├── estilos/            CSS global e tokens de cor
    ├── modelo3d/           aba Modelo 3D (ver abaixo)
    └── vistas/             uma vista por aba
```

### `src/modelo3d/`

| Arquivo | Papel |
|---|---|
| `forma.ts` | Boi e vaca desenhados por código: superfície do corpo, pernas, cabeça, regiões da pele, casca (a linha de fora), peças de cada região e a pele aberta (as mesmas posições, desenroladas) |
| `interior.ts` | Órgãos e o alimento no rúmen e os adubos por trás; o desenho mostra só o rúmen |
| `geometria.ts` | A bota de segurança desenhada por código: solado, palmilhas, cabedal com cano, forro, biqueira, contraforte, ilhoses e cadarço |
| `materiais.ts` | Shaders: contorno de largura constante na tela, curvas de nível (`matTopo`: altura, relevo de mapa, anéis ou relevo sobre a superfície, com peso crescente dentro de cada grupo de curvas) e grade do chão |
| `camadas3d.ts` | Folhas onduladas e blocos da pilha de camadas |
| `amostras.ts` | Amostras de couro desenhadas em canvas (o que cada camada pode virar) |
| `receitas.ts` | Paleta, química por etapa, regiões, camadas, peças da bota, sistemas e etapas, e o elo de cada item com os nós da cadeia, com as fontes |
| `lugares.ts` | Onde fica cada coisa na cena e como a câmera enquadra cada etapa na área livre da tela |
| `cena.ts`, `estado.ts` | Traço de largura em pixels, ritmo das transições e níveis de recuo; o estado animado e os tipos da vista |
| `Animais.tsx` | Chão, boi e vaca, rúmen, a região escolhida no lugar e a pilha de camadas ao lado do animal |
| `Bota.tsx` | O sapato de segurança: as peças, a escolhida à frente |
| `Palco.tsx` | Relógio das transições, câmera (camera-controls), plano da frente, gráfico de composição e rótulos, que nunca cobrem o que está em foco |
| `Decomposicao.tsx` | Quadro de decomposição |

## Dados

Os arquivos de `public/data/` são gerados pelos scripts em Python de `../Painel Viposa/scripts/`, a partir das fontes guardadas em `../Painel Viposa/dados/`.

| Arquivo | Conteúdo | Fonte |
|---|---|---|
| `cadeia.json` | Grafo da cadeia (nós e arestas) e comércio exterior dos insumos | Documentos públicos listados em `meta.fontes`; Comex Stat |
| `cadeia-extra.json` | Acréscimos à cadeia ainda fora do gerador: neutralizantes, magnesita, máquinas do acabamento e do calçado, componentes da bota, celulose. Juntado na carga (`src/dados/cadeia.ts`), que refaz os alcances como o gerador (conferido: os 101 nós originais batem). Ao gerar a cadeia de novo, levar estes nós para o gerador e apagar o arquivo | Literatura técnica de curtimento e de calçado; ABNT NBR ISO 20345; NR-6 |
| `abate.json` | Abate por categoria, por UF e trimestre | IBGE, tabela 1092 |
| `entradas.json` | Portos e URFs de entrada dos insumos importados | Comex Stat 2025 |
| `logistica.json` | Plantas, portos e rotas | OSRM sobre o OpenStreetMap |
| `mercados.json` | Exportações por destino e casos | Comex Stat, por domicílio fiscal |
| `paises.json` | Nome e ponto de rótulo de cada país; nome do Comex para código ISO | Natural Earth; tabela de países do Comex |

A química do Modelo 3D usa as faixas do BREF europeu de curtumes (2013) com um valor ilustrativo dentro de cada faixa: a receita da Viposa não é pública. As fontes completas ficam no botão "Fontes e definições" do painel.

## Publicar no site

```bash
npm run site
```

O comando gera `site/` com três partes:

- `index.html` sem `<!doctype>`, `<head>` e `<body>`, porque o claude.ai embrulha a página num esqueleto próprio;
- o código num arquivo de nome fixo, `assets/painel.js`, com `?v=` para evitar cache velho;
- `data/`.

A publicação no mesmo endereço é feita pelo Claude Code, com a ferramenta Artifact:

- `file_path` em `site/index.html`;
- `root` em `site`;
- a lista de arquivos de `assets/` e `data/`;
- `url` do artifact acima.

## Convenções

- Código, comentários e textos em português.
- Cores só da paleta do painel Floresta e pecuária (`PALETA` e `RAMPAS` em `src/modelo3d/receitas.ts`). Tipografia IBM Plex Mono e IBM Plex Sans Condensed.
- Nos textos do painel entram só fatos confirmados, cada um com fonte.
- Chaves e senhas ficam num `.env`, fora do controle de versão (`.gitignore`), nunca no código.
