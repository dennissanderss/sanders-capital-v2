// ─────────────────────────────────────────────────────────────
// Sanders Capital — Aandelen Analyzer: Yahoo Finance-databron
//
// Vier endpoints:
//   • chart (v8)                 — dag-candles, geen sleutel nodig
//   • fundamentals-timeseries    — jaarrekening per boekjaar, geen sleutel nodig
//   • quoteSummary (v10)         — profiel + kerncijfers, vereist cookie + crumb
//   • search (v1)                — ticker zoeken + recent nieuws
//
// Koersen: indicatoren draaien op VOLTOOIDE dag-candles (zelfde regel als
// de Fundamental Briefing). De vormende candle van de lopende sessie wordt
// gedropt, zodat een oordeel binnen de handelsdag niet verspringt.
// ─────────────────────────────────────────────────────────────

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const HOSTS = ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']

// Yahoo geeft getallen als kaal getal óf als { raw, fmt }.
export function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (v && typeof v === 'object' && 'raw' in v) {
    const r = (v as { raw: unknown }).raw
    return typeof r === 'number' && Number.isFinite(r) ? r : null
  }
  return null
}

// ─── Sessie (cookie + crumb) voor quoteSummary ───────────────
let sessie: { cookie: string; crumb: string; at: number } | null = null

let sessieBezig: Promise<{ cookie: string; crumb: string } | null> | null = null
// Gelijktijdige aanvragen op een koude server delen één cookie/crumb-ronde.
function getSessie(forceer = false): Promise<{ cookie: string; crumb: string } | null> {
  if (!forceer && sessie && Date.now() - sessie.at < 30 * 60 * 1000) return Promise.resolve(sessie)
  if (!sessieBezig) sessieBezig = nieuweSessie().finally(() => { sessieBezig = null })
  return sessieBezig
}
async function nieuweSessie(): Promise<{ cookie: string; crumb: string } | null> {
  try {
    const r = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': UA }, redirect: 'manual', cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
    if (!cookie) return null
    const c = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, Cookie: cookie }, cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!c.ok) return null
    const crumb = (await c.text()).trim()
    if (!crumb || crumb.length > 40 || crumb.includes('<') || crumb.includes('{')) return null
    sessie = { cookie, crumb, at: Date.now() }
    return sessie
  } catch {
    return null
  }
}

const MODULES = [
  'assetProfile', 'price', 'summaryDetail', 'defaultKeyStatistics',
  'financialData', 'recommendationTrend', 'calendarEvents',
].join(',')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type YahooSummary = Record<string, any>

// Profiel + kerncijfers. Geeft null terug als Yahoo de crumb weigert — de
// analyse valt dan terug op jaarrekening + koersen (die geen sleutel vragen).
export function fetchSummary(symbol: string): Promise<YahooSummary | null> {
  // Eén totaalbudget: de rest van de analyse (koersen, jaarrekening) mag niet
  // op een trage crumb-ronde wachten tot de functie-timeout.
  return Promise.race([
    haalSummary(symbol),
    new Promise<null>((r) => setTimeout(() => r(null), 18000)),
  ])
}

async function haalSummary(symbol: string): Promise<YahooSummary | null> {
  let ververs = false
  for (let poging = 0; poging < 2; poging++) {
    const s = await getSessie(ververs)
    if (!s) { ververs = true; continue }
    try {
      const res = await fetch(
        `https://${HOSTS[poging]}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${MODULES}&crumb=${encodeURIComponent(s.crumb)}`,
        { headers: { 'User-Agent': UA, Cookie: s.cookie }, cache: 'no-store', signal: AbortSignal.timeout(8000) },
      )
      if (res.status === 401 || res.status === 403) { ververs = true; continue } // crumb verlopen → ververs
      if (res.status === 429 || res.status >= 500) continue // tijdelijke storing → andere host
      if (!res.ok) return null
      const json = await res.json()
      return json?.quoteSummary?.result?.[0] ?? null
    } catch { /* volgende poging */ }
  }
  return null
}

// ─── Dag-candles ─────────────────────────────────────────────
export interface DagCandle {
  date: string
  open: number
  high: number
  low: number
  close: number
  adj: number // gecorrigeerd voor dividend + splitsingen (voor rendementen)
  volume: number
}
export interface ChartMeta {
  valuta: string | null
  beurs: string | null
  naam: string | null
  type: string | null
  livePrijs: number | null
  liveTijd: number | null // epoch seconden
  sessieOpen: boolean // beurs is nu open of de slotprint is nog niet binnen
}

export async function fetchCandles(symbol: string, jaren = 10): Promise<{ candles: DagCandle[]; meta: ChartMeta } | null> {
  const nu = Math.floor(Date.now() / 1000)
  const p1 = nu - Math.round(jaren * 365.25 * 86400)
  for (const host of HOSTS) {
    try {
      const res = await fetch(
        `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${p1}&period2=${nu}&events=div%2Csplit`,
        { headers: { 'User-Agent': UA }, cache: 'no-store', signal: AbortSignal.timeout(12000) },
      )
      if (!res.ok) continue
      const json = await res.json()
      const r = json?.chart?.result?.[0]
      if (!r) continue
      const m = r.meta || {}
      const ts: number[] = r.timestamp || []
      const q = r.indicators?.quote?.[0] || {}
      const adj: (number | null)[] = r.indicators?.adjclose?.[0]?.adjclose || []
      const offset: number = typeof m.gmtoffset === 'number' ? m.gmtoffset : 0
      const sessieNu = m.currentTradingPeriod?.regular

      const live = num(m.regularMarketPrice)
      const liveTijd = num(m.regularMarketTime)
      // Datum in beurs-tijdzone (opening Sydney valt in UTC op de vorige dag).
      const datumVan = (t: number) => new Date((t + offset) * 1000).toISOString().split('T')[0]
      // De sessie is pas "af" als de beurs dicht is ÉN de slotprint binnen is.
      // Euronext en Londen sluiten met een veiling ná de officiële eindtijd;
      // tot die print er is (of een uur later, voor illiquide aandelen) telt
      // de dag nog als vormend.
      // Yahoo schuift de "huidige" sessie soms al door naar de volgende
      // handelsdag; dan is de vorige (waar de laatste koers bij hoort) af.
      const doorgerold = !!sessieNu && liveTijd != null && nu < sessieNu.start && liveTijd < sessieNu.start
      const sessieKlaar = doorgerold || (!!sessieNu && nu >= sessieNu.end
        && ((liveTijd != null && liveTijd >= sessieNu.end) || nu >= sessieNu.end + 3600))
      const vormend = !!sessieNu && nu >= sessieNu.start && !sessieKlaar
      const liveDatum = liveTijd != null ? datumVan(liveTijd) : null

      const perDatum = new Map<string, DagCandle>()
      ts.forEach((t, i) => {
        const date = datumVan(t)
        // Vormende candle van de lopende sessie: nooit meetellen.
        if (vormend && sessieNu && t >= sessieNu.start) return
        const ruwSlot: number | null | undefined = q.close?.[i]
        let close = ruwSlot
        let high: number | null | undefined = q.high?.[i], low: number | null | undefined = q.low?.[i]
        const open: number | null | undefined = q.open?.[i]
        // Yahoo levert na het slot (vooral Euronext) de dagbar soms urenlang met
        // close=null terwijl de officiële slotprijs al in de meta staat. De
        // sessie is voorbij, dus dit is geen look-ahead.
        if (close == null && sessieKlaar && live != null && date === liveDatum) {
          close = live
          high = Math.max(high ?? num(m.regularMarketDayHigh) ?? live, live)
          low = Math.min(low ?? num(m.regularMarketDayLow) ?? live, live)
        }
        if (close == null || high == null || low == null) return
        perDatum.set(date, {
          date, open: open ?? close, high, low, close,
          adj: (ruwSlot == null ? null : adj[i]) ?? close,
          volume: q.volume?.[i] ?? num(m.regularMarketVolume) ?? 0,
        })
      })
      // Ontbreekt de rij van de afgesloten dag helemaal, voeg hem dan toe.
      if (sessieKlaar && live != null && liveDatum && !perDatum.has(liveDatum)) {
        const laatsteDatum = [...perDatum.keys()].sort().pop()
        if (!laatsteDatum || liveDatum > laatsteDatum) {
          perDatum.set(liveDatum, {
            date: liveDatum, open: num(m.regularMarketOpen) ?? live,
            high: Math.max(num(m.regularMarketDayHigh) ?? live, live),
            low: Math.min(num(m.regularMarketDayLow) ?? live, live),
            close: live, adj: live, volume: num(m.regularMarketVolume) ?? 0,
          })
        }
      }
      const candles = [...perDatum.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
      if (candles.length === 0) continue
      return {
        candles,
        meta: {
          valuta: m.currency ?? null,
          beurs: m.fullExchangeName ?? m.exchangeName ?? null,
          naam: m.longName ?? m.shortName ?? null,
          type: m.instrumentType ?? null,
          livePrijs: live,
          liveTijd,
          sessieOpen: vormend,
        },
      }
    } catch { /* volgende host */ }
  }
  return null
}

// Wisselkoers om jaarrekening-valuta naar koers-valuta om te rekenen
// (bijv. ASML op Nasdaq: koers in USD, jaarrekening in EUR).
export async function fetchWisselkoers(van: string, naar: string): Promise<number | null> {
  if (van === naar) return 1
  for (const host of HOSTS) {
    try {
      const res = await fetch(
        `https://${host}/v8/finance/chart/${van}${naar}=X?interval=1d&range=5d`,
        { headers: { 'User-Agent': UA }, cache: 'no-store', signal: AbortSignal.timeout(8000) },
      )
      if (!res.ok) continue
      const json = await res.json()
      // meta.regularMarketPrice is afgerond op 4 decimalen (IDR/USD werd 0,0001
      // i.p.v. 0,000055). De slotreeks heeft de volle precisie.
      const r = json?.chart?.result?.[0]
      const reeks: (number | null)[] = r?.indicators?.quote?.[0]?.close || []
      const p = [...reeks].reverse().find((x) => typeof x === 'number' && x > 0) ?? num(r?.meta?.regularMarketPrice)
      if (p && p > 0) return p
    } catch { /* volgende host */ }
  }
  return null
}

// ─── Jaarrekening per boekjaar ───────────────────────────────
export interface JaarRij {
  datum: string // einddatum boekjaar
  omzet: number | null
  brutowinst: number | null
  bedrijfsresultaat: number | null
  nettowinst: number | null
  wpa: number | null // winst per aandeel (verwaterd)
  operationeleKasstroom: number | null
  capex: number | null // investeringen (negatief getal)
  vrijeKasstroom: number | null
  dividend: number | null // uitgekeerd dividend (negatief getal)
  inkoop: number | null // inkoop eigen aandelen (negatief getal)
  totaleActiva: number | null
  vlottendeActiva: number | null
  kortlopendeSchulden: number | null
  cash: number | null
  schuld: number | null
  langlopendeSchuld: number | null
  eigenVermogen: number | null
  aandelen: number | null
  ebit: number | null
  ebitda: number | null
  cashEnBeleggingen: number | null // cash + kortlopende beleggingen
  geinvesteerdKapitaal: number | null
}

const TS_VELDEN: Record<string, keyof Omit<JaarRij, 'datum'>> = {
  annualTotalRevenue: 'omzet',
  annualGrossProfit: 'brutowinst',
  annualOperatingIncome: 'bedrijfsresultaat',
  annualNetIncome: 'nettowinst',
  annualDilutedEPS: 'wpa',
  annualOperatingCashFlow: 'operationeleKasstroom',
  annualCapitalExpenditure: 'capex',
  annualFreeCashFlow: 'vrijeKasstroom',
  annualCashDividendsPaid: 'dividend',
  annualRepurchaseOfCapitalStock: 'inkoop',
  annualTotalAssets: 'totaleActiva',
  annualCurrentAssets: 'vlottendeActiva',
  annualCurrentLiabilities: 'kortlopendeSchulden',
  annualCashAndCashEquivalents: 'cash',
  annualTotalDebt: 'schuld',
  annualLongTermDebt: 'langlopendeSchuld',
  annualStockholdersEquity: 'eigenVermogen',
  annualDilutedAverageShares: 'aandelen',
  annualEBIT: 'ebit',
  annualEBITDA: 'ebitda',
  annualCashCashEquivalentsAndShortTermInvestments: 'cashEnBeleggingen',
  annualInvestedCapital: 'geinvesteerdKapitaal',
}

function legeRij(datum: string): JaarRij {
  return {
    datum, omzet: null, brutowinst: null, bedrijfsresultaat: null, nettowinst: null, wpa: null,
    operationeleKasstroom: null, capex: null, vrijeKasstroom: null, dividend: null, inkoop: null,
    totaleActiva: null, vlottendeActiva: null, kortlopendeSchulden: null, cash: null, schuld: null,
    langlopendeSchuld: null, eigenVermogen: null, aandelen: null, ebit: null, ebitda: null, cashEnBeleggingen: null, geinvesteerdKapitaal: null,
  }
}

export async function fetchJaarrekening(symbol: string): Promise<{ jaren: JaarRij[]; valuta: string | null; ok: boolean }> {
  const types = Object.keys(TS_VELDEN).join(',')
  const nu = Math.floor(Date.now() / 1000)
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const res = await fetch(
        `https://${host}/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?type=${types}&period1=1262304000&period2=${nu}`,
        { headers: { 'User-Agent': UA }, cache: 'no-store', signal: AbortSignal.timeout(12000) },
      )
      if (!res.ok) continue
      const json = await res.json()
      const result = json?.timeseries?.result
      if (!Array.isArray(result)) continue
      const perDatum = new Map<string, JaarRij>()
      let valuta: string | null = null
      for (const reeks of result) {
        const type: string | undefined = reeks?.meta?.type?.[0]
        const veld = type ? TS_VELDEN[type] : undefined
        if (!type || !veld) continue
        for (const punt of reeks[type] || []) {
          const datum: string | undefined = punt?.asOfDate
          const waarde = num(punt?.reportedValue)
          if (!datum || waarde == null) continue
          if (!valuta && punt.currencyCode) valuta = punt.currencyCode
          if (!perDatum.has(datum)) perDatum.set(datum, legeRij(datum))
          perDatum.get(datum)![veld] = waarde
        }
      }
      for (const j of perDatum.values()) {
        // Yahoo levert de operationele kasstroom niet altijd (ASML kwam leeg
        // terug). Vrije kasstroom = operationeel + investeringen (capex is negatief).
        if (j.operationeleKasstroom == null && j.vrijeKasstroom != null && j.capex != null) {
          j.operationeleKasstroom = j.vrijeKasstroom - j.capex
        }
      }
      const jaren = [...perDatum.values()]
        .filter((j) => j.omzet != null || j.nettowinst != null) // losse restpunten negeren
        .sort((a, b) => (a.datum < b.datum ? -1 : 1))
      return { jaren, valuta, ok: true }
    } catch { /* volgende host */ }
  }
  return { jaren: [], valuta: null, ok: false }
}

// ─── Zoeken + nieuws ─────────────────────────────────────────
export interface ZoekResultaat { symbol: string; naam: string; beurs: string; sector: string | null }
export interface NieuwsItem { titel: string; bron: string; link: string; datum: string }

export async function zoek(q: string, nieuws = 0): Promise<{ resultaten: ZoekResultaat[]; nieuws: NieuwsItem[]; ok: boolean }> {
  for (const host of HOSTS) {
    try {
      const res = await fetch(
        `https://${host}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=${nieuws}`,
        { headers: { 'User-Agent': UA }, cache: 'no-store', signal: AbortSignal.timeout(8000) },
      )
      if (!res.ok) continue
      const json = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resultaten: ZoekResultaat[] = (json?.quotes || [])
        .filter((x: any) => x?.quoteType === 'EQUITY' && x?.symbol)
        .map((x: any) => ({
          symbol: x.symbol, naam: x.longname || x.shortname || x.symbol,
          beurs: x.exchDisp || x.exchange || '', sector: x.sectorDisp || x.sector || null,
        }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nieuwsItems: NieuwsItem[] = (json?.news || [])
        .filter((n: any) => n?.title && typeof n?.link === 'string' && /^https?:\/\//.test(n.link))
        .map((n: any) => ({
          titel: n.title, bron: n.publisher || '', link: n.link,
          datum: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString().split('T')[0] : '',
        }))
      return { resultaten, nieuws: nieuwsItems, ok: true }
    } catch { /* volgende host */ }
  }
  return { resultaten: [], nieuws: [], ok: false }
}
