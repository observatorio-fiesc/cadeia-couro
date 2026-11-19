// Rotas marítimas: um grafo pequeno dos pontos por onde os navios passam (estreitos, canais, cabos e as curvas
// em mar aberto entre eles) e o caminho mais curto por ele, pela distância do grande círculo. Vem do visualizador
// do submarino do painel-comandante (submarino/src/lib/sealanes.ts), com os portos que a cadeia do couro usa.
// Esquemático na escala do mapa-múndi, mas sobre a água: do Brasil à China, contorna o Cabo, não cruza a África.

export type LonLat = [number, number]

const P: Record<string, LonLat> = {
  // Brasil
  SANTOS: [-46.3, -24.0],
  BR_S: [-44.0, -25.6],
  BR_SE: [-38.0, -19.5],
  BR_NE: [-33.6, -8.0],
  // Atlântico
  ATL_EQ: [-28.0, 1.0],
  ATL_CV: [-23.5, 14.5],
  CANARY: [-18.5, 28.0],
  MOR_OFF: [-10.5, 33.2],
  JORF: [-8.6, 33.15],
  GIB_W: [-7.5, 35.9],
  HUELVA: [-7.0, 37.1],
  PORT_OFF: [-10.6, 39.5],
  LISBOA: [-9.4, 38.6],
  FINISTERRE: [-10.5, 43.6],
  BRITTANY: [-6.5, 48.3],
  CHANNEL: [-1.6, 50.0],
  LE_HAVRE: [0.1, 49.5],
  DOVER: [1.6, 51.0],
  FELIXSTOWE: [1.4, 51.9],
  ANTWERP: [4.3, 51.4],
  ROTTERDAM: [4.0, 52.0],
  NORTH_SEA: [4.6, 54.0],
  HAMBURG: [8.6, 54.0],
  SKAGEN: [10.8, 57.9],
  OSLO: [10.6, 59.0],
  KATTEGAT: [11.8, 56.8],
  GOTHENBURG: [11.7, 57.6],
  ORESUND: [12.7, 55.7],
  BALTIC_S: [15.5, 55.3],
  GDANSK: [18.7, 54.6],
  GOTLAND: [19.4, 57.2],
  ST_PETERSBURG: [29.6, 59.9],
  BOTHNIA: [20.2, 60.5],
  FIN_PORT: [21.4, 61.5],
  S_ATL: [0.0, -31.0],
  S_ATL_W: [-25.0, -28.5],
  AZORES: [-28.0, 37.5],
  US_E: [-73.8, 39.6],
  HALIFAX: [-63.5, 44.5],
  DAKAR: [-17.5, 14.6],
  ABIDJAN: [-4.0, 5.2],
  GG: [1.5, 3.0],
  TEMA: [0.0, 5.5],
  LOME: [1.3, 6.0],
  LAGOS: [3.4, 6.3],
  WALVIS: [14.2, -22.95],
  // Mediterrâneo e mar Negro
  GIB: [-5.6, 35.95],
  W_MED: [2.0, 37.6],
  BARCELONA: [2.3, 41.2],
  ALGIERS: [3.1, 36.9],
  SARD_S: [9.0, 37.8],
  TYRRH: [11.2, 40.2],
  LIVORNO: [10.2, 43.4],
  TUNIS: [10.4, 37.1],
  SICILY_CH: [12.0, 37.0],
  MALTA: [15.0, 35.7],
  ION: [20.0, 35.5],
  ADRIA_S: [18.9, 40.0],
  ADRIA_MID: [15.5, 42.6],
  SPLIT: [16.3, 43.4],
  KOPER: [13.6, 45.5],
  CRETE_S: [25.0, 34.3],
  AEGEAN_S: [24.5, 36.4],
  PIRAEUS: [23.6, 37.9],
  AEGEAN_N: [25.0, 39.5],
  DARDANELLES: [26.3, 40.1],
  MARMARA: [28.8, 40.8],
  BOSPHORUS: [29.05, 41.2],
  BLACK_W: [29.6, 42.4],
  VARNA: [28.0, 43.2],
  CONSTANTA: [28.8, 44.1],
  ODESA: [30.8, 46.3],
  E_MED: [30.0, 33.4],
  PORT_SAID: [32.3, 31.4],
  ASHDOD: [34.55, 31.85],
  // Suez, mar Vermelho, mar Arábico, o Golfo
  SUEZ: [32.55, 29.9],
  RED_N: [34.4, 27.0],
  RED_MID: [38.5, 21.0],
  JEDDAH: [39.1, 21.5],
  RED_S: [41.6, 15.4],
  BAB: [43.4, 12.6],
  ADEN: [47.5, 12.2],
  SOCOTRA_N: [54.0, 13.6],
  ARAB_SEA: [60.0, 17.0],
  KARACHI: [66.9, 24.7],
  GULF_OMAN: [58.8, 24.3],
  SOHAR: [56.9, 24.45],
  HORMUZ: [56.4, 26.5],
  BANDAR_ABBAS: [56.2, 27.1],
  JEBEL_ALI: [55.0, 25.1],
  GULF_MID: [52.5, 26.9],
  RAS_LAFFAN: [51.75, 26.0],
  RAS_TANURA: [50.3, 26.7],
  RAS_ALKHAIR: [49.3, 27.4],
  KUWAIT: [48.1, 29.3],
  UMM_QASR: [47.9, 29.9],
  // oceano Índico, o Cabo
  SOMALIA_E: [56.0, 4.0],
  IO_W: [56.0, -10.0],
  IO_MID: [70.0, -5.0],
  IO_SUL: [80.0, -38.0],
  MADAG_E: [53.0, -22.0],
  MADAG_S: [46.0, -28.6],
  AGULHAS: [25.0, -36.6],
  CAPE: [18.0, -35.3],
  DURBAN: [31.1, -29.9],
  MOZ_S: [35.8, -27.0],
  MOZ_CH: [41.6, -16.5],
  DAR: [39.6, -6.9],
  MOMBASA: [39.7, -4.1],
  INDIA_W: [72.6, 18.9],
  ARAB_S2: [68.0, 10.0],
  SRI_S: [81.0, 5.4],
  CHENNAI: [80.4, 13.1],
  BAY_BENGAL: [88.5, 15.0],
  CHITTAGONG: [91.7, 22.2],
  // Ásia do Leste e do Sudeste
  MALACCA_N: [96.0, 6.5],
  MALACCA: [100.0, 3.2],
  KLANG: [101.2, 2.9],
  SINGAPORE: [104.0, 1.2],
  GULF_THAI: [102.0, 9.8],
  LAEM_CHABANG: [100.9, 13.0],
  SIHANOUKVILLE: [103.4, 10.5],
  SCS: [110.0, 8.0],
  VUNG_TAU: [107.2, 10.2],
  SCS_N: [115.0, 16.0],
  HONG_KONG: [114.2, 22.1],
  MANILA: [120.7, 14.5],
  GULF_TONKIN: [108.5, 18.0],
  HAIPHONG: [107.0, 20.6],
  TAIWAN_STR: [119.8, 24.5],
  SHANGHAI: [122.5, 30.8],
  YELLOW_SEA: [123.0, 35.5],
  BOHAI: [121.0, 38.6],
  TIANJIN: [118.0, 38.9],
  KYUSHU: [130.2, 30.6],
  BUSAN: [129.0, 35.0],
  TOKYO: [139.9, 34.9],
  JAVA_SEA: [108.5, -4.6],
  JAKARTA: [106.9, -5.9],
  AUS_W: [113.0, -33.0],
  AUS_S: [129.0, -37.5],
  MELBOURNE: [144.9, -38.5],
  // Golfo do México, Caribe, Panamá e o Pacífico das Américas
  US_GULF: [-94.6, 28.9],
  GULF_MEX: [-88.0, 25.6],
  FLORIDA: [-81.2, 24.2],
  ATL_W: [-62.0, 28.0],
  YUCATAN: [-85.9, 21.9],
  COATZA: [-94.4, 18.4],
  CARIB: [-78.5, 15.0],
  CARTAGENA: [-75.6, 10.5],
  LA_GUAIRA: [-67.0, 10.7],
  PANAMA_A: [-79.9, 9.7],
  PANAMA_P: [-79.4, 8.0],
  GUAYAQUIL: [-80.0, -2.3],
  CALLAO: [-77.3, -12.1],
  PAC_E: [-95.0, 6.0],
  PAC_SE: [-90.0, -20.0],
  MEJILLONES: [-70.8, -23.1],
  VALPARAISO: [-71.7, -33.0],
  CHILE_S: [-76.0, -50.0],
  CAPE_HORN: [-66.0, -56.3],
  PATAGONIA: [-61.5, -46.0],
  URU_OFF: [-52.0, -35.6],
  MONTEVIDEO: [-56.2, -35.0],
  BUENOS_AIRES: [-57.6, -34.8],
  PAC_NE: [-140.0, 30.0],
  VANCOUVER: [-124.8, 48.4],
}

const ARESTAS: [string, string][] = [
  ['SANTOS', 'BR_S'], ['BR_S', 'BR_SE'], ['BR_SE', 'BR_NE'], ['BR_NE', 'ATL_EQ'], ['ATL_EQ', 'ATL_CV'], ['ATL_CV', 'CANARY'],
  ['ATL_CV', 'DAKAR'], ['CANARY', 'MOR_OFF'], ['MOR_OFF', 'JORF'], ['MOR_OFF', 'GIB_W'], ['GIB_W', 'GIB'], ['GIB_W', 'HUELVA'],
  ['GIB_W', 'PORT_OFF'], ['PORT_OFF', 'LISBOA'], ['PORT_OFF', 'FINISTERRE'], ['FINISTERRE', 'BRITTANY'], ['BRITTANY', 'CHANNEL'],
  ['CHANNEL', 'LE_HAVRE'], ['CHANNEL', 'DOVER'], ['DOVER', 'FELIXSTOWE'], ['DOVER', 'ANTWERP'], ['DOVER', 'ROTTERDAM'],
  ['DOVER', 'NORTH_SEA'], ['NORTH_SEA', 'ROTTERDAM'], ['NORTH_SEA', 'HAMBURG'], ['NORTH_SEA', 'SKAGEN'], ['SKAGEN', 'OSLO'],
  ['SKAGEN', 'KATTEGAT'], ['KATTEGAT', 'GOTHENBURG'], ['KATTEGAT', 'ORESUND'], ['ORESUND', 'BALTIC_S'], ['BALTIC_S', 'GDANSK'],
  ['BALTIC_S', 'GOTLAND'], ['GOTLAND', 'ST_PETERSBURG'], ['GOTLAND', 'BOTHNIA'], ['BOTHNIA', 'FIN_PORT'],
  ['GIB', 'W_MED'], ['W_MED', 'BARCELONA'], ['W_MED', 'ALGIERS'], ['W_MED', 'SARD_S'], ['SARD_S', 'TYRRH'], ['TYRRH', 'LIVORNO'],
  ['SARD_S', 'TUNIS'], ['SARD_S', 'SICILY_CH'], ['SICILY_CH', 'TUNIS'], ['SICILY_CH', 'MALTA'], ['MALTA', 'ION'],
  ['ION', 'ADRIA_S'], ['ADRIA_S', 'ADRIA_MID'], ['ADRIA_MID', 'SPLIT'], ['ADRIA_MID', 'KOPER'],
  ['ION', 'CRETE_S'], ['ION', 'AEGEAN_S'], ['AEGEAN_S', 'PIRAEUS'], ['AEGEAN_S', 'AEGEAN_N'], ['AEGEAN_N', 'DARDANELLES'],
  ['DARDANELLES', 'MARMARA'], ['MARMARA', 'BOSPHORUS'], ['BOSPHORUS', 'BLACK_W'], ['BLACK_W', 'VARNA'], ['VARNA', 'CONSTANTA'],
  ['BLACK_W', 'ODESA'], ['CRETE_S', 'E_MED'], ['E_MED', 'PORT_SAID'], ['E_MED', 'ASHDOD'],
  ['PORT_SAID', 'SUEZ'], ['SUEZ', 'RED_N'], ['RED_N', 'RED_MID'], ['RED_MID', 'JEDDAH'], ['RED_MID', 'RED_S'], ['RED_S', 'BAB'],
  ['BAB', 'ADEN'], ['ADEN', 'SOCOTRA_N'], ['SOCOTRA_N', 'ARAB_SEA'], ['SOCOTRA_N', 'SOMALIA_E'], ['ARAB_SEA', 'KARACHI'],
  ['ARAB_SEA', 'GULF_OMAN'], ['GULF_OMAN', 'SOHAR'], ['GULF_OMAN', 'HORMUZ'], ['HORMUZ', 'BANDAR_ABBAS'], ['HORMUZ', 'JEBEL_ALI'],
  ['HORMUZ', 'GULF_MID'], ['GULF_MID', 'RAS_LAFFAN'], ['GULF_MID', 'RAS_TANURA'], ['GULF_MID', 'RAS_ALKHAIR'],
  ['RAS_ALKHAIR', 'KUWAIT'], ['KUWAIT', 'UMM_QASR'], ['ARAB_SEA', 'SOMALIA_E'],
  ['SOMALIA_E', 'IO_W'], ['IO_W', 'MADAG_E'], ['MADAG_E', 'MADAG_S'], ['MADAG_S', 'AGULHAS'], ['AGULHAS', 'CAPE'], ['AGULHAS', 'DURBAN'],
  ['CAPE', 'S_ATL'], ['S_ATL', 'S_ATL_W'], ['S_ATL_W', 'BR_S'], ['S_ATL', 'WALVIS'], ['CAPE', 'WALVIS'], ['AGULHAS', 'MOZ_S'],
  ['MOZ_S', 'MOZ_CH'], ['MOZ_CH', 'DAR'], ['DAR', 'MOMBASA'], ['MOMBASA', 'SOMALIA_E'], ['AGULHAS', 'IO_SUL'],
  ['INDIA_W', 'ARAB_S2'], ['ARAB_S2', 'IO_W'], ['ARAB_S2', 'ARAB_SEA'], ['SRI_S', 'ARAB_S2'], ['SRI_S', 'IO_MID'], ['IO_MID', 'IO_W'],
  ['SRI_S', 'CHENNAI'], ['SRI_S', 'BAY_BENGAL'], ['BAY_BENGAL', 'CHITTAGONG'], ['BAY_BENGAL', 'MALACCA_N'], ['SRI_S', 'MALACCA_N'],
  ['MALACCA_N', 'MALACCA'], ['MALACCA', 'KLANG'], ['MALACCA', 'SINGAPORE'], ['SINGAPORE', 'GULF_THAI'], ['GULF_THAI', 'LAEM_CHABANG'],
  ['GULF_THAI', 'SIHANOUKVILLE'], ['SINGAPORE', 'SCS'], ['SCS', 'VUNG_TAU'], ['SCS', 'SCS_N'], ['SCS_N', 'HONG_KONG'], ['SCS_N', 'MANILA'],
  ['SCS_N', 'GULF_TONKIN'], ['GULF_TONKIN', 'HAIPHONG'], ['SCS_N', 'TAIWAN_STR'], ['TAIWAN_STR', 'SHANGHAI'], ['SHANGHAI', 'YELLOW_SEA'],
  ['YELLOW_SEA', 'BOHAI'], ['BOHAI', 'TIANJIN'], ['SHANGHAI', 'KYUSHU'], ['TAIWAN_STR', 'KYUSHU'], ['KYUSHU', 'BUSAN'], ['KYUSHU', 'TOKYO'],
  ['SINGAPORE', 'JAVA_SEA'], ['JAVA_SEA', 'JAKARTA'], ['IO_SUL', 'AUS_W'], ['AUS_W', 'AUS_S'], ['AUS_S', 'MELBOURNE'],
  ['ATL_EQ', 'GG'], ['ABIDJAN', 'GG'], ['ATL_EQ', 'ABIDJAN'], ['GG', 'TEMA'], ['GG', 'LOME'], ['GG', 'LAGOS'],
  ['GIB_W', 'AZORES'], ['AZORES', 'US_E'], ['US_E', 'HALIFAX'],
  ['US_GULF', 'GULF_MEX'], ['GULF_MEX', 'COATZA'], ['GULF_MEX', 'FLORIDA'], ['GULF_MEX', 'YUCATAN'], ['YUCATAN', 'CARIB'],
  ['CARIB', 'CARTAGENA'], ['CARIB', 'LA_GUAIRA'], ['CARIB', 'PANAMA_A'], ['PANAMA_A', 'PANAMA_P'], ['FLORIDA', 'ATL_W'], ['FLORIDA', 'US_E'],
  ['ATL_W', 'AZORES'], ['ATL_W', 'ATL_CV'], ['CARIB', 'BR_NE'], ['PANAMA_P', 'GUAYAQUIL'], ['GUAYAQUIL', 'CALLAO'], ['CALLAO', 'MEJILLONES'],
  ['PANAMA_P', 'PAC_E'], ['PAC_E', 'PAC_SE'], ['PAC_SE', 'MEJILLONES'], ['MEJILLONES', 'VALPARAISO'], ['VALPARAISO', 'CHILE_S'],
  ['CHILE_S', 'CAPE_HORN'], ['CAPE_HORN', 'PATAGONIA'], ['PATAGONIA', 'URU_OFF'], ['BR_S', 'URU_OFF'], ['URU_OFF', 'MONTEVIDEO'],
  ['URU_OFF', 'BUENOS_AIRES'], ['PAC_E', 'PAC_NE'], ['PAC_NE', 'VANCOUVER'],
]

/** O porto por onde passa a carga de cada país (ISO3). Vizinhos por terra ficam fora: a ligação é um arco simples. */
export const PORTO: Record<string, string> = {
  BRA: 'SANTOS', USA: 'US_E', CAN: 'HALIFAX', MEX: 'COATZA', ARG: 'BUENOS_AIRES', URY: 'MONTEVIDEO', CHL: 'VALPARAISO', PER: 'CALLAO',
  COL: 'CARTAGENA', VEN: 'LA_GUAIRA', ECU: 'GUAYAQUIL', DOM: 'CARIB', PAN: 'PANAMA_A', GTM: 'YUCATAN', CRI: 'PANAMA_A', CUB: 'FLORIDA',
  GBR: 'FELIXSTOWE', IRL: 'BRITTANY', FRA: 'LE_HAVRE', DEU: 'HAMBURG', NLD: 'ROTTERDAM', BEL: 'ANTWERP', LUX: 'ANTWERP', CHE: 'ANTWERP',
  ESP: 'BARCELONA', PRT: 'LISBOA', ITA: 'LIVORNO', GRC: 'PIRAEUS', TUR: 'MARMARA', POL: 'GDANSK', SWE: 'GOTHENBURG', NOR: 'OSLO',
  DNK: 'SKAGEN', FIN: 'FIN_PORT', RUS: 'ST_PETERSBURG', EST: 'GOTLAND', LVA: 'GOTLAND', LTU: 'GDANSK', ROU: 'CONSTANTA', BGR: 'VARNA',
  UKR: 'ODESA', HUN: 'KOPER', SVK: 'KOPER', AUT: 'KOPER', CZE: 'HAMBURG', SVN: 'KOPER', HRV: 'SPLIT', BIH: 'SPLIT', SRB: 'KOPER',
  MNE: 'SPLIT', ALB: 'ADRIA_S', MKD: 'PIRAEUS', MLT: 'MALTA', CYP: 'E_MED',
  MAR: 'JORF', DZA: 'ALGIERS', TUN: 'TUNIS', LBY: 'MALTA', EGY: 'PORT_SAID', ISR: 'ASHDOD', LBN: 'ASHDOD', JOR: 'RED_N',
  NGA: 'LAGOS', TGO: 'LOME', GHA: 'TEMA', BEN: 'LOME', CIV: 'ABIDJAN', SEN: 'DAKAR', CMR: 'GG', ZAF: 'CAPE', NAM: 'WALVIS',
  TZA: 'DAR', KEN: 'MOMBASA', MOZ: 'MOZ_CH', ETH: 'BAB', DJI: 'BAB',
  SAU: 'RAS_ALKHAIR', ARE: 'JEBEL_ALI', QAT: 'RAS_LAFFAN', OMN: 'SOHAR', KWT: 'KUWAIT', IRN: 'BANDAR_ABBAS', IRQ: 'UMM_QASR', BHR: 'GULF_MID',
  PAK: 'KARACHI', IND: 'INDIA_W', LKA: 'SRI_S', BGD: 'CHITTAGONG',
  CHN: 'SHANGHAI', HKG: 'HONG_KONG', MAC: 'HONG_KONG', TWN: 'TAIWAN_STR', KOR: 'BUSAN', JPN: 'TOKYO', VNM: 'VUNG_TAU', KHM: 'SIHANOUKVILLE',
  THA: 'LAEM_CHABANG', MYS: 'KLANG', SGP: 'SINGAPORE', IDN: 'JAKARTA', PHL: 'MANILA', AUS: 'MELBOURNE',
}

const rad = (d: number) => (d * Math.PI) / 180
function gc([lo1, la1]: LonLat, [lo2, la2]: LonLat): number {
  const a = Math.sin(rad(la2 - la1) / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(rad(lo2 - lo1) / 2) ** 2
  return 2 * Math.asin(Math.sqrt(a))
}

const vizinhos = new Map<string, string[]>()
for (const [a, b] of ARESTAS) {
  vizinhos.set(a, [...(vizinhos.get(a) ?? []), b])
  vizinhos.set(b, [...(vizinhos.get(b) ?? []), a])
}

/** Os nós do caminho mais curto entre dois pontos (Dijkstra; o grafo é pequeno). */
function nos(de: string, para: string): string[] {
  const dist = new Map<string, number>([[de, 0]])
  const ant = new Map<string, string>()
  const abertos = new Set([de])
  while (abertos.size) {
    let u = ''
    for (const n of abertos) if (!u || dist.get(n)! < dist.get(u)!) u = n
    abertos.delete(u)
    if (u === para) break
    for (const w of vizinhos.get(u) ?? []) {
      const d = dist.get(u)! + gc(P[u], P[w])
      if (d < (dist.get(w) ?? Infinity)) {
        dist.set(w, d)
        ant.set(w, u)
        abertos.add(w)
      }
    }
  }
  const caminho = [para]
  while (caminho[0] !== de) {
    const a = ant.get(caminho[0])
    if (!a) return [de, para]
    caminho.unshift(a)
  }
  return caminho
}

/** Cantos cortados (Chaikin, duas vezes) e trechos longos adensados, para a rota curvar com o chão. */
function suavizar(bruto: LonLat[], passes = 2): LonLat[] {
  let pts = bruto
  for (let k = 0; k < passes; k++) {
    const out: LonLat[] = [pts[0]]
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]]
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    out.push(pts[pts.length - 1])
    pts = out
  }
  const denso: LonLat[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]]
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5))
    for (let j = 0; j < n; j++) denso.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n])
  }
  denso.push(pts[pts.length - 1])
  return denso
}

/** Ponto de um país: o porto, se tem; se não, o ponto do rótulo (chegada por terra). */
export type Ancora = { porto: string } | { lonlat: LonLat }

/**
 * A rota entre dois lugares, como uma polilinha [lon, lat]. Dois portos: pelo mar. Se um lado não tem porto
 * (vizinho por terra), um arco suave direto, levemente curvo para o norte.
 */
export function rota(de: Ancora, para: Ancora): LonLat[] {
  if ('porto' in de && 'porto' in para) return suavizar(nos(de.porto, para.porto).map((n) => P[n]))
  const a = 'porto' in de ? P[de.porto] : de.lonlat
  const b = 'porto' in para ? P[para.porto] : para.lonlat
  const meio: LonLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.18]
  return suavizar([a, meio, b], 3)
}

/** As coordenadas de um ponto do grafo. */
export const lugar = (n: string): LonLat => P[n]

/** Os nós do grafo por onde passa a rota entre dois portos. */
export const nosDaRota = (de: string, para: string) => nos(de, para)

/** Os gargalos do mar: um ponto onde muitas rotas se juntam e que, fechado, trava o movimento. */
export const GARGALOS: { id: string; nome: string; em: LonLat; nos: string[] }[] = [
  { id: 'ormuz', nome: 'Estreito de Ormuz', em: [56.4, 26.5], nos: ['HORMUZ'] },
  { id: 'bab', nome: 'Bab el-Mandeb', em: [43.4, 12.6], nos: ['BAB'] },
  { id: 'suez', nome: 'Canal de Suez', em: [32.55, 30.4], nos: ['SUEZ'] },
  { id: 'malaca', nome: 'Estreito de Malaca', em: [100.5, 3.0], nos: ['MALACCA', 'SINGAPORE'] },
  { id: 'gibraltar', nome: 'Estreito de Gibraltar', em: [-5.6, 35.95], nos: ['GIB'] },
  { id: 'cabo', nome: 'Cabo da Boa Esperança', em: [18.5, -34.6], nos: ['CAPE', 'AGULHAS'] },
  { id: 'panama', nome: 'Canal do Panamá', em: [-79.7, 9.0], nos: ['PANAMA_A', 'PANAMA_P'] },
  { id: 'bosforo', nome: 'Bósforo', em: [29.05, 41.2], nos: ['BOSPHORUS'] },
]

/** Os gargalos por onde passa a rota de um país ao Brasil (ou do Brasil ao país), pelo porto de cada um. */
export function gargalosDe(iso: string): string[] {
  const p = PORTO[iso]
  if (!p) return []
  const n = new Set(nos(PORTO.BRA, p))
  return GARGALOS.filter((g) => g.nos.some((x) => n.has(x))).map((g) => g.id)
}
