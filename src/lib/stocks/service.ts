// ─────────────────────────────────────────────────────────────
// Sanders Capital — Aandelen Analyzer: service (entry point)
//
// Haalt profiel, jaarrekening en koersen op en zet ze om in één
// antwoord met twee gescheiden oordelen: lange termijn (het bedrijf)
// en korte termijn (de koers). Zie analysis.ts voor de regels.
// ─────────────────────────────────────────────────────────────
import {
  fetchSummary, fetchJaarrekening, fetchCandles, fetchWisselkoers, zoek, num,
  type JaarRij, type NieuwsItem,
} from './yahoo'
import {
  analyseLangeTermijn, analyseKorteTermijn, toetsTrendfilter, grafiekReeks,
  type Kern, type LangeTermijn, type KorteTermijn, type Toets, type GrafiekPunt,
} from './analysis'
import { maakVerhaal, type Verhaal } from './narrative'

// Beurzen die in centen/pence noteren: koers ÷ 100 = hoofdeenheid.
const KLEINE_EENHEID: Record<string, string> = { GBp: 'GBP', GBX: 'GBP', ZAc: 'ZAR', ILA: 'ILS' }

// Yahoo levert sector en land in het Engels; de pagina is Nederlands.
const SECTOR_NL: Record<string, string> = {
  Technology: 'Technologie', 'Financial Services': 'Financiële dienstverlening', Healthcare: 'Gezondheidszorg',
  'Consumer Cyclical': 'Consumptiegoederen (cyclisch)', 'Consumer Defensive': 'Consumptiegoederen (dagelijks)',
  'Communication Services': 'Communicatie en media', Industrials: 'Industrie', Energy: 'Energie',
  'Basic Materials': 'Grondstoffen en chemie', 'Real Estate': 'Vastgoed', Utilities: 'Nutsbedrijven',
}
const LAND_NL: Record<string, string> = {
  Netherlands: 'Nederland', 'United States': 'Verenigde Staten', 'United Kingdom': 'Verenigd Koninkrijk',
  Germany: 'Duitsland', France: 'Frankrijk', Belgium: 'België', Switzerland: 'Zwitserland', Ireland: 'Ierland',
  Spain: 'Spanje', Italy: 'Italië', Denmark: 'Denemarken', Sweden: 'Zweden', Norway: 'Noorwegen',
  Finland: 'Finland', Luxembourg: 'Luxemburg', Austria: 'Oostenrijk', Japan: 'Japan', China: 'China',
  Taiwan: 'Taiwan', 'South Korea': 'Zuid-Korea', Canada: 'Canada', Australia: 'Australië', India: 'India',
  Brazil: 'Brazilië', Israel: 'Israël', 'Hong Kong': 'Hongkong', Singapore: 'Singapore', 'South Africa': 'Zuid-Afrika',
}

export interface AandeelAnalyse {
  symbol: string
  naam: string
  beurs: string | null
  type: string | null
  valuta: string // valuta van de koers
  jaarrekeningValuta: string | null
  sector: string | null // Engelse Yahoo-naam (voor de regels)
  sectorNl: string | null
  industrie: string | null
  land: string | null
  landNl: string | null
  stad: string | null
  website: string | null
  werknemers: number | null
  bestuur: { naam: string; titel: string }[]
  profiel: string | null // origineel (Engels) profiel
  verhaal: Verhaal | null // Nederlandse uitleg (AI)
  koers: {
    slot: number
    slotDatum: string
    vorigSlot: number | null
    vorigSlotDatum: string | null
    live: number | null
    liveTijd: string | null
    sessieOpen: boolean // beurs is nu open: live is dan een tussenstand
    marktkap: number | null
    marktkapValuta: string
    hoofdValuta: string // GBP bij een notering in pence
    factor: number // koers × factor = bedrag in hoofdValuta
  }
  kern: Kern
  cijfersDatum: string | null // eerstvolgende kwartaalcijfers
  jaren: JaarRij[]
  langeTermijn: LangeTermijn
  korteTermijn: KorteTermijn
  toets: Toets | null
  grafiek: GrafiekPunt[]
  analisten: {
    aantal: number | null // aantal koersdoelen
    koersdoel: number | null
    laag: number | null
    hoog: number | null
    kopen: number | null
    houden: number | null
    verkopen: number | null
  } | null
  nieuws: NieuwsItem[]
  waarschuwingen: string[]
  onvolledig: boolean // er ontbrak iets door een storing bij de databron
  gemaaktOp: string
}

// Korte geheugen-cache per serverinstantie. De route zelf wordt niet meer
// publiek gecachet (hij vraagt login), dus dit voorkomt dat herhaald openen
// van hetzelfde aandeel Yahoo en Groq telkens opnieuw belast.
const cache = new Map<string, { at: number; ttl: number; data: AandeelAnalyse }>()
const CACHE_VOLLEDIG = 10 * 60 * 1000
const CACHE_ONVOLLEDIG = 45 * 1000

export async function analyseerAandeel(symbol: string): Promise<AandeelAnalyse | null> {
  const hit = cache.get(symbol)
  if (hit && Date.now() - hit.at < hit.ttl) return hit.data
  const data = await bouwAnalyse(symbol)
  if (data) {
    if (cache.size > 300) cache.clear()
    cache.set(symbol, { at: Date.now(), ttl: data.onvolledig ? CACHE_ONVOLLEDIG : CACHE_VOLLEDIG, data })
  }
  return data
}

async function bouwAnalyse(symbol: string): Promise<AandeelAnalyse | null> {
  const [qs, jr, chart, zoekres] = await Promise.all([
    fetchSummary(symbol), fetchJaarrekening(symbol), fetchCandles(symbol, 10), zoek(symbol),
  ])
  if (!chart || chart.candles.length === 0) return null

  const { candles, meta } = chart
  const profiel = qs?.assetProfile || {}
  const prijs = qs?.price || {}
  const sd = qs?.summaryDetail || {}
  const dks = qs?.defaultKeyStatistics || {}
  const fd = qs?.financialData || {}
  const treffer = zoekres.resultaten.find((r) => r.symbol.toUpperCase() === symbol)

  const valuta: string = prijs.currency || meta.valuta || 'USD'
  const hoofdValuta = KLEINE_EENHEID[valuta] || valuta
  const factor = KLEINE_EENHEID[valuta] ? 0.01 : 1
  const finValuta: string | null = fd.financialCurrency || jr.valuta || null
  const wisselkoers = !finValuta || finValuta === hoofdValuta ? 1 : await fetchWisselkoers(finValuta, hoofdValuta)

  const laatste = candles[candles.length - 1]
  const vorige = candles[candles.length - 2]
  const jaren = jr.jaren
  const t = jaren[jaren.length - 1]

  // Yahoo rekent beurswaarde, K/W en dividendrendement op de LOPENDE koers.
  // Wij tonen en beoordelen op het voltooide slot, dus schalen we die cijfers
  // naar dat slot. Zo verspringt het oordeel niet binnen de handelsdag en zijn
  // de verhoudingen na te rekenen met de getoonde slotkoers.
  const yahooKoers = num(prijs.regularMarketPrice) ?? meta.livePrijs
  const ruweSchaal = yahooKoers && yahooKoers > 0 ? laatste.close / yahooKoers : 1
  const schaal = ruweSchaal > 0.5 && ruweSchaal < 2 ? ruweSchaal : 1

  const aandelen = num(dks.sharesOutstanding) ?? t?.aandelen ?? null
  const yahooKap = num(prijs.marketCap) ?? num(sd.marketCap)
  const marktkap = yahooKap != null ? yahooKap * schaal : aandelen ? aandelen * laatste.close * factor : null

  // K/W op de winst van de afgelopen 12 maanden; anders zelf uit het laatste boekjaar.
  const yahooKw = num(sd.trailingPE)
  let koersWinst = yahooKw != null ? yahooKw * schaal : null
  const wpaTtm = num(dks.trailingEps)
  if (koersWinst == null && wpaTtm != null && wpaTtm < 0) koersWinst = -1 // maakt verlies
  if (koersWinst == null && t?.wpa != null && t.wpa > 0 && wisselkoers) {
    koersWinst = (laatste.close * factor) / (t.wpa * wisselkoers)
  }
  const yahooKwVerwacht = num(sd.forwardPE) ?? num(dks.forwardPE)
  const yahooDividend = num(sd.dividendYield)

  const kern: Kern = {
    koers: laatste.close,
    marktkap,
    wisselkoers,
    koersWinst,
    koersWinstVerwacht: yahooKwVerwacht != null ? yahooKwVerwacht * schaal : null,
    ebitda: num(fd.ebitda),
    schuld: num(fd.totalDebt),
    cash: num(fd.totalCash),
    dividendRendement: yahooDividend != null ? yahooDividend / schaal : null,
    uitkeringsratio: num(sd.payoutRatio),
    beta: num(sd.beta) ?? num(dks.beta),
  }

  // Eerstvolgende kwartaalcijfers (alleen als die nog moeten komen).
  let cijfersDatum: string | null = null
  const cijfersRuw = num(qs?.calendarEvents?.earnings?.earningsDate?.[0])
  if (cijfersRuw) {
    const d = new Date(cijfersRuw * 1000).toISOString().split('T')[0]
    if (d >= new Date().toISOString().split('T')[0]) cijfersDatum = d
  }

  const sector: string | null = profiel.sector || treffer?.sector || null
  const industrie: string | null = profiel.industry || null
  const naam: string = prijs.longName || prijs.shortName || meta.naam || treffer?.naam || symbol
  const type: string | null = prijs.quoteType || meta.type || null
  const isAandeel = !type || type === 'EQUITY'

  const toets = toetsTrendfilter(candles)
  const korteTermijn = analyseKorteTermijn(candles, valuta, cijfersDatum, toets)
  const ind = korteTermijn.indicatoren
  const vanTop = ind?.hoog52 ? laatste.close / ind.hoog52 - 1 : null
  let langeTermijn = analyseLangeTermijn(jaren, kern, sector, industrie, vanTop)
  if (!isAandeel) {
    langeTermijn = {
      ...langeTermijn, oordeel: 'onbekend', score: null,
      samenvatting: ['Dit is geen los bedrijf maar een fonds of ETF: een mandje van veel aandelen. Een bedrijfsanalyse is daarop niet van toepassing. Voor een beginner is een breed gespreid indexfonds overigens vaak de basis van een langetermijnportefeuille.'],
    }
  }

  // Nieuws zoeken op bedrijfsnaam: op een ticker met beurssuffix (ASML.AS)
  // geeft Yahoo niets terug.
  const zoeknaam = naam
    .replace(/\b(N\.?V\.?|Inc\.?|Corp(oration)?\.?|plc|PLC|S\.?A\.?|AG|SE|Ltd\.?|Holdings?|Group|Company|Co\.?)(?=\s|,|$)/g, '')
    .replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim()
  const [verhaal, nieuwsRes] = await Promise.all([
    profiel.longBusinessSummary && isAandeel
      ? maakVerhaal({
          naam, symbol, sector, industrie,
          land: profiel.country || null, stad: profiel.city || null,
          werknemers: num(profiel.fullTimeEmployees), profiel: profiel.longBusinessSummary,
        })
      : Promise.resolve(null),
    isAandeel && zoeknaam.length >= 2 ? zoek(zoeknaam, 6) : Promise.resolve({ resultaten: [], nieuws: [] as NieuwsItem[], ok: true }),
  ])

  const trend = qs?.recommendationTrend?.trend?.[0]
  const analisten = num(fd.numberOfAnalystOpinions)
    ? {
        aantal: num(fd.numberOfAnalystOpinions),
        koersdoel: num(fd.targetMeanPrice), laag: num(fd.targetLowPrice), hoog: num(fd.targetHighPrice),
        kopen: trend ? (trend.strongBuy || 0) + (trend.buy || 0) : null,
        houden: trend ? trend.hold || 0 : null,
        verkopen: trend ? (trend.sell || 0) + (trend.strongSell || 0) : null,
      }
    : null

  const wisselkoersMist = !!finValuta && finValuta !== hoofdValuta && !wisselkoers
  const waarschuwingen: string[] = []
  if (!qs) waarschuwingen.push('Bedrijfsprofiel en een deel van de kerncijfers zijn tijdelijk niet beschikbaar bij de databron. De analyse draait nu op jaarrekening en koersen; probeer het later opnieuw voor het volledige beeld.')
  if (!isAandeel) waarschuwingen.push('Dit is geen gewoon aandeel maar een ETF of fonds. Alleen het koersdeel (korte termijn) is bruikbaar.')
  else if (!jr.ok) waarschuwingen.push('De jaarrekening kon nu niet worden opgehaald bij de databron. Probeer het later opnieuw.')
  else if (jaren.length === 0) waarschuwingen.push('Geen jaarrekening beschikbaar voor dit aandeel.')
  if (KLEINE_EENHEID[valuta]) {
    const inHoofd = (laatste.close * factor).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const eenheid = valuta === 'GBp' || valuta === 'GBX' ? 'pence (honderdsten van een pond)' : 'centen'
    waarschuwingen.push(`Deze beurs noteert in ${eenheid}: de slotkoers van ${valuta} ${laatste.close.toLocaleString('nl-NL', { maximumFractionDigits: 2 })} is ${hoofdValuta} ${inHoofd}. De beurswaarde staat in ${hoofdValuta}.`)
  }
  if (wisselkoersMist) waarschuwingen.push(`De jaarrekening is in ${finValuta} en de wisselkoers naar ${hoofdValuta} was niet op te halen. Het vrije-kasstroomrendement ontbreekt daardoor.`)
  else if (finValuta && finValuta !== hoofdValuta) waarschuwingen.push(`De jaarrekening is in ${finValuta}, de koers in ${valuta}. Verhoudingen tussen die twee zijn omgerekend tegen de actuele wisselkoers; de bedragen in het tabblad Jaarcijfers staan in ${finValuta}.`)
  if (meta.sessieOpen && meta.livePrijs != null && Math.abs(meta.livePrijs / laatste.close - 1) > 0.02) {
    waarschuwingen.push('De koers beweegt vandaag meer dan 2% ten opzichte van het laatste slot. De oordelen rekenen bewust alleen met afgeronde handelsdagen en worden na het slot van vandaag bijgewerkt.')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bestuur = (profiel.companyOfficers || []).slice(0, 3).map((o: any) => ({
    naam: String(o?.name || '').replace(/^(Mr|Mrs|Ms|Dr|Sir|Dame|Prof)\.?\s+/i, '').replace(/\s+/g, ' ').trim(),
    titel: String(o?.title || ''),
  })).filter((o: { naam: string }) => o.naam)
    // Hoogste baas eerst.
    .sort((a: { titel: string }, b: { titel: string }) => Number(/CEO|Chief Executive/i.test(b.titel)) - Number(/CEO|Chief Executive/i.test(a.titel)))

  const website: string | null = typeof profiel.website === 'string' && /^https?:\/\//i.test(profiel.website) ? profiel.website : null
  const land: string | null = profiel.country || null
  // Onvolledig = iets ontbrak door een storing; zo'n antwoord bewaren we maar kort.
  const onvolledig = !qs || !jr.ok || wisselkoersMist || (!!profiel.longBusinessSummary && isAandeel && !verhaal)

  return {
    symbol, naam, beurs: prijs.exchangeName || meta.beurs, type, valuta,
    jaarrekeningValuta: finValuta,
    sector, sectorNl: sector ? SECTOR_NL[sector] || sector : null, industrie,
    land, landNl: land ? LAND_NL[land] || land : null, stad: profiel.city || null,
    website, werknemers: num(profiel.fullTimeEmployees),
    bestuur, profiel: profiel.longBusinessSummary || null, verhaal,
    koers: {
      slot: laatste.close, slotDatum: laatste.date,
      vorigSlot: vorige?.close ?? null, vorigSlotDatum: vorige?.date ?? null,
      live: meta.livePrijs, liveTijd: meta.liveTijd ? new Date(meta.liveTijd * 1000).toISOString() : null,
      sessieOpen: meta.sessieOpen,
      marktkap, marktkapValuta: hoofdValuta, hoofdValuta, factor,
    },
    kern, cijfersDatum, jaren, langeTermijn, korteTermijn,
    toets, grafiek: grafiekReeks(candles),
    analisten, nieuws: nieuwsRes.nieuws.slice(0, 6), waarschuwingen,
    onvolledig,
    gemaaktOp: new Date().toISOString(),
  }
}
