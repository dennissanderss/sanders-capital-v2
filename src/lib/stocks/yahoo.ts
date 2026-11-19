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

async function getSessie(forceer = false): Promise<{ cookie: string; crumb: string } | null> {
  if (!forceer && sessie && Date.now() - sessie.at < 30 * 60 * 1000) return sessie
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
export async function fetchSummary(symbol: string): Promise<YahooSummary | null> {
  for (let poging = 0; poging < 2; poging++) {
    const s = await getSessie(poging > 0)
    if (!s) continue
    try {
      const res = await fetch(
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${MODULES}&crumb=${encodeURIComponent(s.crumb)}`,
        { headers: { 'User-Agent': UA, Cookie: s.cookie }, cache: 'no-store', signal: AbortSignal.timeout(12000) },
      )
      if (res.status === 401 || res.status === 403) continue // crumb verlopen → ververs
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

      const perDatum = new Map<string, DagCandle>()
      ts.forEach((t, i) => {
        const close = q.close?.[i], high = q.high?.[i], low = q.low?.[i], open = q.open?.[i]
        if (close == null || high == null || low == null) return
        // Vormende candle: hoort bij de lopende sessie en de beurs is nog niet dicht.
        if (sessieNu && t >= sessieNu.start && nu < sessieNu.end) return
        // Datum in beurs-tijdzone (opening Sydney valt in UTC op de vorige dag).
        const date = new Date((t + offset) * 1000).toISOString().split('T')[0]
        perDatum.set(date, {
          date, open: open ?? close, high, low, close,
          adj: adj[i] ?? close, volume: q.volume?.[i] ?? 0,
        })
      })
      const candles = [...perDatum.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
      if (candles.length === 0) continue
      return {
        candles,
        meta: {
          valuta: m.currency ?? null,
          beurs: m.fullExchangeName ?? m.exchangeName ?? null,
          naam: m.longName ?? m.shortName ?? null,
          type: m.instrumentType ?? null,
          livePrijs: num(m.regularMarketPrice),
          liveTijd: num(m.regularMarketTime),
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
      const p = num(json?.chart?.result?.[0]?.meta?.regularMarketPrice)
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
  annualInvestedCapital: 'geinvesteerdKapitaal',
}

function legeRij(datum: string): JaarRij {
  return {
    datum, omzet: null, brutowinst: null, bedrijfsresultaat: null, nettowinst: null, wpa: null,
    operationeleKasstroom: null, capex: null, vrijeKasstroom: null, dividend: null, inkoop: null,
    totaleActiva: null, vlottendeActiva: null, kortlopendeSchulden: null, cash: null, schuld: null,
    langlopendeSchuld: null, eigenVermogen: null, aandelen: null, ebit: null, geinvesteerdKapitaal: null,
  }
}

export async function fetchJaarrekening(symbol: string): Promise<{ jaren: JaarRij[]; valuta: string | null }> {
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
      const jaren = [...perDatum.values()]
        .filter((j) => j.omzet != null || j.nettowinst != null) // losse restpunten negeren
        .sort((a, b) => (a.datum < b.datum ? -1 : 1))
      return { jaren, valuta }
    } catch { /* volgende host */ }
  }
  return { jaren: [], valuta: null }
}

// ─── Zoeken + nieuws ─────────────────────────────────────────
export interface ZoekResultaat { symbol: string; naam: string; beurs: string; sector: string | null }
export interface NieuwsItem { titel: string; bron: string; link: string; datum: string }

export async function zoek(q: string, nieuws = 0): Promise<{ resultaten: ZoekResultaat[]; nieuws: NieuwsItem[] }> {
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
        .filter((n: any) => n?.title && n?.link)
        .map((n: any) => ({
          titel: n.title, bron: n.publisher || '', link: n.link,
          datum: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString().split('T')[0] : '',
        }))
      return { resultaten, nieuws: nieuwsItems }
    } catch { /* volgende host */ }
  }
  return { resultaten: [], nieuws: [] }
}
