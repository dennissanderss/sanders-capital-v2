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

export interface AandeelAnalyse {
  symbol: string
  naam: string
  beurs: string | null
  type: string | null
  valuta: string // valuta van de koers
  jaarrekeningValuta: string | null
  sector: string | null
  industrie: string | null
  land: string | null
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
    marktkap: number | null
    marktkapValuta: string
  }
  kern: Kern
  cijfersDatum: string | null // eerstvolgende kwartaalcijfers
  jaren: JaarRij[]
  langeTermijn: LangeTermijn
  korteTermijn: KorteTermijn
  toets: Toets | null
  grafiek: GrafiekPunt[]
  analisten: {
    aantal: number | null
    koersdoel: number | null
    laag: number | null
    hoog: number | null
    kopen: number | null
    houden: number | null
    verkopen: number | null
  } | null
  nieuws: NieuwsItem[]
  waarschuwingen: string[]
  gemaaktOp: string
}

export async function analyseerAandeel(symbol: string): Promise<AandeelAnalyse | null> {
  const [qs, jr, chart, zoekres] = await Promise.all([
    fetchSummary(symbol), fetchJaarrekening(symbol), fetchCandles(symbol, 10), zoek(symbol, 6),
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

  const aandelen = num(dks.sharesOutstanding) ?? t?.aandelen ?? null
  const marktkap = num(prijs.marketCap) ?? num(sd.marketCap) ?? (aandelen ? aandelen * laatste.close * factor : null)

  // K/W: Yahoo's waarde, anders zelf uit koers en winst per aandeel.
  let koersWinst = num(sd.trailingPE)
  if (koersWinst == null && t?.wpa != null && t.wpa > 0 && wisselkoers) {
    koersWinst = (laatste.close * factor) / (t.wpa * wisselkoers)
  }

  const kern: Kern = {
    koers: laatste.close,
    marktkap,
    wisselkoers,
    koersWinst,
    koersWinstVerwacht: num(sd.forwardPE) ?? num(dks.forwardPE),
    koersBoek: num(dks.priceToBook),
    ebitda: num(fd.ebitda),
    schuld: num(fd.totalDebt),
    cash: num(fd.totalCash),
    vrijeKasstroom: num(fd.freeCashflow),
    dividendRendement: num(sd.dividendYield),
    uitkeringsratio: num(sd.payoutRatio),
    beta: num(sd.beta) ?? num(dks.beta),
  }

  // Eerstvolgende kwartaalcijfers (alleen als die nog moeten komen).
  let cijfersDatum: string | null = null
  const cijfersRuw = num(qs?.calendarEvents?.earnings?.earningsDate?.[0])
  if (cijfersRuw && cijfersRuw * 1000 > Date.now() - 86400000) {
    cijfersDatum = new Date(cijfersRuw * 1000).toISOString().split('T')[0]
  }

  const sector: string | null = profiel.sector || treffer?.sector || null
  const naam: string = prijs.longName || prijs.shortName || meta.naam || treffer?.naam || symbol
  const type: string | null = prijs.quoteType || meta.type || null

  const langeTermijn = analyseLangeTermijn(jaren, kern, sector)
  const korteTermijn = analyseKorteTermijn(candles, valuta, cijfersDatum)

  const verhaal = profiel.longBusinessSummary
    ? await maakVerhaal({
        naam, symbol, sector, industrie: profiel.industry || null,
        land: profiel.country || null, stad: profiel.city || null,
        werknemers: num(profiel.fullTimeEmployees), profiel: profiel.longBusinessSummary,
      })
    : null

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

  const waarschuwingen: string[] = []
  if (!qs) waarschuwingen.push('Bedrijfsprofiel en een deel van de kerncijfers zijn tijdelijk niet beschikbaar bij de databron. De analyse draait nu op jaarrekening en koersen; probeer het later opnieuw voor het volledige beeld.')
  if (type && type !== 'EQUITY') waarschuwingen.push('Dit is geen gewoon aandeel (bijv. een ETF of fonds). De bedrijfsanalyse voor de lange termijn is daarop niet van toepassing; alleen het koersdeel is bruikbaar.')
  if (jaren.length === 0) waarschuwingen.push('Geen jaarrekening beschikbaar voor dit aandeel.')
  if (finValuta && finValuta !== hoofdValuta) waarschuwingen.push(`De jaarrekening is in ${finValuta}, de koers in ${valuta}. Verhoudingen zijn omgerekend tegen de actuele wisselkoers.`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bestuur = (profiel.companyOfficers || []).slice(0, 3).map((o: any) => ({
    naam: String(o?.name || '').replace(/\s+/g, ' ').trim(), titel: String(o?.title || ''),
  })).filter((o: { naam: string }) => o.naam)
    // Hoogste baas eerst.
    .sort((a: { titel: string }, b: { titel: string }) => Number(/CEO|Chief Executive/i.test(b.titel)) - Number(/CEO|Chief Executive/i.test(a.titel)))

  return {
    symbol, naam, beurs: prijs.exchangeName || meta.beurs, type, valuta,
    jaarrekeningValuta: finValuta,
    sector, industrie: profiel.industry || null,
    land: profiel.country || null, stad: profiel.city || null,
    website: profiel.website || null, werknemers: num(profiel.fullTimeEmployees),
    bestuur, profiel: profiel.longBusinessSummary || null, verhaal,
    koers: {
      slot: laatste.close, slotDatum: laatste.date,
      vorigSlot: vorige?.close ?? null, vorigSlotDatum: vorige?.date ?? null,
      live: meta.livePrijs, liveTijd: meta.liveTijd ? new Date(meta.liveTijd * 1000).toISOString() : null,
      marktkap, marktkapValuta: hoofdValuta,
    },
    kern, cijfersDatum, jaren, langeTermijn, korteTermijn,
    toets: toetsTrendfilter(candles), grafiek: grafiekReeks(candles),
    analisten, nieuws: zoekres.nieuws.slice(0, 6), waarschuwingen,
    gemaaktOp: new Date().toISOString(),
  }
}
