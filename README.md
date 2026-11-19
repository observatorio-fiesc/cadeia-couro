# Cadeia produtiva do couro · Viposa

Painel interativo da cadeia do couro da Viposa, do boi ao calçado de segurança. Acompanha as plantas de Várzea Grande (MT), Nova Andradina (MS) e Caçador (SC). Feito em React, TypeScript e three.js, com Vite.

A versão publicada é uma página privada no claude.ai: <https://claude.ai/artifact/KLHESPPKaT9Kp2qozpTzpS>. Só a dona da página e quem recebeu acesso conseguem abrir.

Painel de análise feito com dados e documentos públicos; não é publicação da Viposa.

## Abas

| Aba | Endereço | O que mostra |
|---|---|---|
| Modelo 3D | `#bois` | Dois sistemas, escolhidos no título. **Boi e vaca**: tudo sai dos animais: o que os mantém, num cone pequeno sob o animal (adubos e calcário no solo; pasto, ração, ureia e sal no anel do meio; o rúmen no alto; ligações da cadeia, `src/modelo3d/Mistura.tsx`), com "Ver no cone" levando ao boi ou à vaca no Cone 3D; a pele por região, no próprio corpo, com a química da ribeira (MT) ao lado; as camadas do couro ao lado do animal (um toque no vão da pele) e o que cada uma pode virar (MS). **Sapato de segurança**: a bota, peça a peça (SC). Tudo em traço e curvas de nível, sem pintura; só o gráfico de composição tem cor. Com um item escolhido, "Ver na cadeia →", no próprio rótulo dele, abre o Cone 3D com o elo dele escolhido: a câmera virada para ele, o que depende dele em vermelho até os produtos e o que está acima dele aceso. A câmera não se move pelo mouse: anda só quando algo é escolhido, sempre do mesmo lado da cena (`naVista`, em `src/modelo3d/lugares.ts`). Inclui uma lente de dependência externa |
| Cone 3D | `#cone` | A rede da cadeia em cone, no padrão da rede da criticidade do painel de referência. Recursos naturais no chão; materiais e insumos em faixas acima, cada elo no setor das etapas que alimenta; no alto, o anel das nove etapas na ordem do processo, com o caminho do couro em conhaque; acima, os seis produtos vendidos e a Viposa no vértice. Tamanho da marca pelo alcance. Lentes como capítulos no alto (Estrutura, Importado, Ormuz 2026, China, Ambiente), com o texto de cada uma à esquerda. Na lente Ambiente, os elos em quatro grupos (origem do gado, água e efluente, cromo, floresta e energia), as licenças e o selo LWG em branco, o que cada etapa solta (coprodutos, resíduos e efluentes) fora do anel das etapas, ligado ao destino, e os pontos de atenção pulsando; na coluna da esquerda, botões para destacar só um ou alguns grupos (origem do gado, água e efluente, cromo, floresta e energia, licenças) e tipos de saída (coprodutos, resíduos, efluentes); os pontos de atenção pulsam (`src/dados/ambiente.ts`, só com fatos da base e as suas fontes). O cone ocupa a tela toda, sem cartões à direita. Um clique num elo deixa vermelho, elo a elo, tudo o que depende dele, até os produtos que deixariam de sair; "ver na cadeia", no rótulo dele, abre o elo na cadeia (`src/vistas/ConeElo.tsx`, como a "cadeia de um item" da referência): de que é feito à esquerda, o que o usa à direita (vermelho: não sai sem ele; azul: tem alternativa), no alto as etapas do processo que param e os produtos que deixariam de sair. Cada nome abre aquele elo; Esc volta ao cone |
| Cadeia | `#cadeia` | A cadeia de produção, como uma árvore. Começa nos produtos vendidos (calçado de segurança, cabedal, couro acabado, crust, wet blue). Cada produto abre em como é feito: as operações, na ordem, com a planta; o que entra, a começar pelo produto anterior, que abre do mesmo jeito (wet blue → pele piquelada → pele em tripa → pele verde → o boi); e o que sobra (coprodutos, resíduos, efluentes), com o destino. Um material abre no que ele é feito. Cor e forma pelo papel de cada entrada e pelo tipo de cada sobra. Uma operação abre o cartão dela; um material, a ficha do elo |
| Mercado externo | `#externo` | O mapa-múndi do Centro de comando do painel-comandante, na paleta do couro (chão curvo, costas, fronteiras e, a pedido, a densidade do tráfego de navios), com a gramática dos Cenários estratégicos. Na faixa, depois da aba, **Oferta** ou **Demanda** e, ao lado, só as análises desse lado; no alto, a linha do tempo com as passadas e o ▶; à esquerda, só um número e uma linha; acima da faixa, quando a passada tem, um infográfico; embaixo, no meio, **Exportações** ou **Importações** (um toque abre a outra); no canto inferior direito, o quadro dos produtos. Cada passada leva a câmera a um lugar; de perto, o detalhe 1:10m (portos, ferrovias, estradas). Ver abaixo |

## A aba Mercado externo

Segue os Cenários estratégicos do painel-comandante (a vista Ormuz do visualizador do submarino): cada análise é uma sequência de passadas, e cada passada leva a câmera a um lugar, mostra o que importa ali e escreve à esquerda só um número e uma linha. As setas do teclado passam de passada, o espaço toca a sequência, "]" mostra ou esconde o quadro dos produtos e Esc devolve a câmera ao enquadramento da passada. Cada passada mostra um ano só, o último: 2025 no Comex Stat e, no UN Comtrade, o último ano já declarado pela maior parte dos grandes exportadores.

| Sentido | Lado | Análise | Passadas |
|---|---|---|---|
| Exportações | Oferta | Ofertantes | Quem vende (os maiores exportadores do mundo como peças de luz, com os seus destinos); De onde sai (zoom nas plantas, nas estradas e nos portos) |
| | | Precificação | Preço por quilo (o quilo em cada grande destino, no mapa e em colunas contra a média); Quem paga mais e Quem paga menos (zoom no destino, com os polos do couro) |
| | | Criticidade logística | Pontos de passagem (carga correndo pelas rotas e a parte do valor que passa por cada gargalo) |
| | Demanda | Compradores | Para onde vai |
| | | Mercados potenciais | Uma passada só, com as regiões numa lista no quadro da direita (periferia europeia, Sudeste Asiático, Uruguai, Noruega, África Ocidental). Sem escolha, todas no mapa-múndi; um clique leva a câmera à região e mostra por que ela conta. Em cada país, no último ano que ele declarou: quanto compra de couro curtido e a parte do Brasil |
| | | Mercado de luxo | O berço (Itália e França, os distritos e os curtumes das maisons); O que muda (os fluxos de Itália e França e o mercado de luxo por região) |
| | | Automotivo | Polos dos bancos; Elétricos (2025, estimativa da EIU) |
| Importações | Oferta | Origens | De onde vem; Quem domina (zoom na maior origem) |
| | | Precificação | Preço por quilo (as origens do insumo no mapa e o quilo dos insumos do mesmo grupo em colunas) |
| | Demanda | O curtume, O boi | Figuras: a linha do processo, com o que entra de fora em cada etapa (valor e maior origem) |

O endereço guarda a passada: `?vista=externo&sentido=imp&analise=precificacao&produto=cromo#externo` abre o preço do quilo do sulfato de cromo.

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
- `?vista=cadeia&abrir=est.wet_blue,est.wet_blue/est.piquelada`

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
- `node scripts/capturar-externo.mjs <pasta> [espera-ms] [1600x900] [sentido:analise:passo[:produto] ...]`: as passadas da aba Mercado externo (sem argumento, todas), com os erros do console agrupados;
- `node scripts/capturar-estados.mjs <pasta> <espera-ms> nome=consulta ...`: vários estados da aba Modelo 3D num só navegador;
- `node scripts/testar-forma.ts`: confere a geometria do boi e da vaca (o Node 24 roda TypeScript direto);
- `node scripts/conferir-processo.ts`: confere o mapa do processo contra a cadeia (operações por etapa, arestas novas e retiradas, pendências, insumos soltos); sai com erro se houver pendência.

## Estrutura

```
cadeia-couro-viposa/
├── index.html              página de entrada do Vite
├── package.json            dependências e scripts
├── tsconfig.json           TypeScript estrito
├── vite.config.ts          base relativa e porta 5180
├── public/
│   └── data/               dados prontos que o painel lê em tempo de execução (JSON)
│       └── geo/            malhas do mapa-múndi da aba Mercado externo (Natural Earth)
├── scripts/                capturas, teste de interação, conferência do processo e montagem do site
└── src/
    ├── main.tsx            ponto de entrada (sem StrictMode: ver o comentário no arquivo)
    ├── App.tsx             abas, controles e painel de fontes
    ├── componentes/        ficha do elo, painéis das lentes e gráficos em SVG
    ├── dados/              carga e índice dos JSON (cadeia, mapa do processo, abate, logística, mercados)
    ├── lib/                formatação de números, tamanho da tela e lentes
    ├── estilos/            CSS global e tokens de cor
    ├── modelo3d/           aba Modelo 3D (ver abaixo)
    ├── externo/            aba Mercado externo: chão curvo e projeção (geo.ts), rotas e gargalos do mar (rotas.ts),
    │                       carga dos dados (dados.ts), o palco do mapa (Mapa.tsx), as análises e passadas (passos.tsx),
    │                       a folha e o infográfico (Folha.tsx), as figuras (Figuras.tsx) e as tabelas do relatório (tabelas.ts)
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
| `Mistura.tsx` | O que mantém o animal: o cone pequeno sob ele, do solo ao rúmen, com as ligações de `ALIMENTA` (`receitas.ts`) |
| `Bota.tsx` | O sapato de segurança: as peças, a escolhida à frente |
| `Palco.tsx` | Relógio das transições, câmera (camera-controls), plano da frente, gráfico de composição e rótulos, que nunca cobrem o que está em foco |
| `Decomposicao.tsx` | Quadro de decomposição |

## Dados

Os arquivos de `public/data/` são gerados pelos scripts em Python de `../Painel Viposa/scripts/`, a partir das fontes guardadas em `../Painel Viposa/dados/`.

| Arquivo | Conteúdo | Fonte |
|---|---|---|
| `cadeia.json` | Grafo da cadeia (nós e arestas) e comércio exterior dos insumos | Documentos públicos listados em `meta.fontes`; Comex Stat |
| `cadeia-extra.json` | Acréscimos à cadeia ainda fora do gerador: nós novos (neutralizantes, magnesita, máquinas da ribeira, do acabamento e do calçado, componentes da bota, celulose, bactericidas, adesivos), nomes corrigidos (`alterar`) e arestas retiradas (`remover_arestas`). Juntado na carga (`src/dados/cadeia.ts`). Ao gerar a cadeia de novo, levar estes acréscimos para o gerador e apagar o arquivo | Literatura técnica de curtimento e de calçado; ABNT NBR ISO 20345; NR-6 |
| `processo.json` | O mapa do processo: cada etapa dividida em operações, na ordem; em cada operação, o que entra e com que papel, o estado em que o material sai e as saídas (produto vendido, coproduto, resíduo, efluente) com o destino. É a fonte das arestas de insumo para etapa: a carga (`src/dados/processo.ts`) as deriva das operações, mantém a confiança das que já estavam em `cadeia.json`, anota as divergências como pendências e só então refaz os alcances como o gerador (conferido: os 101 nós originais batem). Para pôr um insumo numa etapa, ele entra numa operação aqui | Literatura técnica de curtimento (CETESB, BREF 2013) e de calçado; NR-6; Leather Working Group; levantamento da Viposa |
| `abate.json` | Abate por categoria, por UF e trimestre | IBGE, tabela 1092 |
| `logistica.json` | Plantas, portos e rotas | OSRM sobre o OpenStreetMap |
| `mercados.json` | Exportações por destino e casos | Comex Stat, por domicílio fiscal |
| `externo.json` | Aba Mercado externo: exportações por país, estágio e ano em US$ e em toneladas (2015–2025), preço por quilo por ano e por mês (até o último mês de 2026), importações por insumo, origem e ano, carne bovina para a China, exposição a Ormuz direta e de segunda ordem. Gerado por `preparar_externo.py`; as tabelas do relatório (Bain, EIU, maisons, polos) ficam em `src/externo/tabelas.ts` | Comex Stat (arquivos completos); UN Comtrade 2024 |
| `couro-mundo.json` | Quem exporta cada produto da cadeia no mundo, ano a ano (2015–2025), os destinos dos maiores exportadores e o couro curtido comprado por país, do mundo e do Brasil. Gerado por `baixar_comtrade.py` (API pública do Comtrade, com cota por hora: o script guarda cada resposta e espera a cota voltar). Sem ele, a aba usa só o Comex | UN Comtrade, declarado por cada país |
| `geo/detalhes.json` | O detalhe dos zooms: costa, fronteiras, portos, ferrovias, estradas principais e cidades em 13 janelas (Golfo, Itália, França, China, Vietnã, Brasil, Malaca, Suez, Gibraltar, Panamá, Cabo, México, Europa central). Gerado por `preparar_detalhes.py` | Natural Earth 1:10m |
| `geo/mundo50.json` | Países (para pintar e apontar), linhas de costa e fronteiras terrestres, nomes em português do Brasil. Gerado por `preparar_mundo50.py` | Natural Earth 1:50m |
| `mundo/agua.png`, `mundo/grade-presenca.*` | Máscara do mar e grade de tráfego de navios (0,1°), copiadas do atlas do painel-comandante | Natural Earth; Global Fishing Watch, 30 dias até 18/10/2026, CC BY-NC 4.0 |

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
