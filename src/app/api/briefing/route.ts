import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// ─── Types ──────────────────────────────────────────────────
interface CBRate {
  currency: string
  country: string
  bank: string
  rate: number | null
  target: number | null
  bias: string
  last_move: string
  next_meeting: string
  flag: string
}

interface CalendarEvent {
  title: string
  country: string
  date: string
  impact: string
  forecast: string
  previous: string
}

// ─── Constants ──────────────────────────────────────────────
const MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']

const PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD',
  'USD/CAD', 'USD/CHF', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
]

const IMPACT_MAP: Record<string, string> = {
  High: 'hoog', Medium: 'medium', Low: 'laag', Holiday: 'feestdag',
}

const COUNTRY_MAP: Record<string, string> = {
  USD: 'VS', EUR: 'EU', GBP: 'VK', JPY: 'JP',
  AUD: 'AU', CAD: 'CA', CHF: 'CH', NZD: 'NZ',
}

// ─── Bias scoring ───────────────────────────────────────────
// Higher = more hawkish = stronger currency
function biasScore(bias: string): number {
  const b = (bias || '').toLowerCase()
  if (b.includes('verkrappend') || b.includes('hawkish')) return 2
  if (b.includes('voorzichtig verkrappend')) return 1.5
  if (b.includes('afwachtend')) return 0
  if (b.includes('voorzichtig verruimend')) return -1
  if (b.includes('verruimend') || b.includes('dovish')) return -2
  return 0
}

// Rate vs target: above target = hawkish signal, below = dovish
function rateTargetScore(rate: number | null, target: number | null): number {
  if (rate === null || target === null) return 0
  const diff = rate - target
  if (diff > 0.5) return 1
  if (diff > 0) return 0.5
  if (diff < -0.5) return -1
  if (diff < 0) return -0.5
  return 0
}

// ─── Calendar context generation ────────────────────────────
function eventContext(event: CalendarEvent, currency: string): string {
  const title = event.title.toLowerCase()
  const forecast = event.forecast
  const previous = event.previous

  // CPI / Inflation
  if (title.includes('cpi') || title.includes('inflation') || title.includes('price')) {
    if (forecast && previous) {
      const f = parseFloat(forecast.replace('%', ''))
      const p = parseFloat(previous.replace('%', ''))
      if (!isNaN(f) && !isNaN(p)) {
        if (f > p) return `Inflatie wordt hoger verwacht (${forecast} vs ${previous}) → hawkish voor ${currency}, rente langer hoog.`
        if (f < p) return `Inflatie daalt naar verwachting (${forecast} vs ${previous}) → dovish voor ${currency}, ruimte voor knip.`
        return `Inflatie stabiel verwacht (${forecast}) → neutraal, kijk naar de verrassing.`
      }
    }
    return `Inflatiedata voor ${currency}. Hoger = hawkish (sterker), lager = dovish (zwakker). De verrassing bepaalt de reactie.`
  }

  // Employment / Jobs
  if (title.includes('employment') || title.includes('payroll') || title.includes('job') || title.includes('labor') || title.includes('claims')) {
    return `Arbeidsmarktdata voor ${currency}. Sterke arbeidsmarkt = hawkish (rente hoog houden). Zwak = dovish (knipverwachting).`
  }

  // GDP
  if (title.includes('gdp') || title.includes('gross domestic')) {
    return `Groeicijfer voor ${currency}. Sterkere groei = hawkish. Zwakkere groei = dovish, mogelijk eerdere renteverlaging.`
  }

  // PMI
  if (title.includes('pmi') || title.includes('purchasing manager')) {
    return `Bedrijfsvertrouwen voor ${currency}. Boven 50 = groei, onder 50 = krimp. Verrassing t.o.v. verwachting drijft de reactie.`
  }

  // Rate decisions
  if (title.includes('rate') || title.includes('interest') || title.includes('monetary policy')) {
    return `Rentebeslissing! Dit is het belangrijkste event. Let op de toon van het statement en de dot-plot/projecties.`
  }

  // Retail sales
  if (title.includes('retail') || title.includes('sales') || title.includes('consumer')) {
    return `Consumentendata voor ${currency}. Sterke consumptie = sterke economie = hawkish. Zwak = dovish.`
  }

  // Speaks
  if (title.includes('speak') || title.includes('press conference') || title.includes('testimony')) {
    return `Toespraak. Let op hints over toekomstig rentebeleid. Hawkish toon = sterker, dovish toon = zwakker.`
  }

  return `Belangrijk event voor ${currency}. Hoger dan verwacht = hawkish (sterker), lager = dovish (zwakker).`
}

// ─── Main handler ───────────────────────────────────────────
export async function GET() {
  try {
    // Parallel fetch: rates + calendar + intermarket data
    const [ratesResult, thisWeekRes, nextWeekRes, marketData] = await Promise.all([
      fetchRates(),
      fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { next: { revalidate: 1800 } }),
      fetch('https://nfs.faireconomy.media/ff_calendar_nextweek.json', { next: { revalidate: 1800 } }),
      fetchMarketData(),
    ])

    const thisWeek: CalendarEvent[] = thisWeekRes.ok ? await thisWeekRes.json() : []
    const nextWeek: CalendarEvent[] = nextWeekRes.ok ? await nextWeekRes.json() : []
    const allEvents = [...thisWeek, ...nextWeek]

    // ── 1. Currency Scorecard ──
    const ratesMap: Record<string, CBRate> = {}
    for (const r of ratesResult) {
      ratesMap[r.currency] = r
    }

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    // Today's events (high impact only)
    const todayEvents = allEvents
      .filter(e => {
        const d = e.date?.split('T')[0] || ''
        return (d === todayStr || d === tomorrowStr) && e.impact === 'High'
      })
      .map(e => ({
        title: e.title,
        currency: e.country?.toUpperCase() || '',
        date: e.date,
        impact: IMPACT_MAP[e.impact] || e.impact,
        forecast: e.forecast || '',
        previous: e.previous || '',
        flag: e.country?.toUpperCase() || '',
        countryName: COUNTRY_MAP[e.country?.toUpperCase()] || e.country || '',
        context: eventContext(e, e.country?.toUpperCase() || ''),
        time: (() => {
          try { return new Date(e.date).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) }
          catch { return '' }
        })(),
        dateFormatted: (() => {
          try { return new Date(e.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }) }
          catch { return '' }
        })(),
      }))

    // Week's high-impact events grouped by day
    const weekEvents = allEvents
      .filter(e => e.impact === 'High' || e.impact === 'Medium')
      .map(e => ({
        title: e.title,
        currency: e.country?.toUpperCase() || '',
        date: e.date,
        impact: IMPACT_MAP[e.impact] || e.impact,
        forecast: e.forecast || '',
        previous: e.previous || '',
      }))

    // Currency scores
    const currencyScores: Record<string, { score: number; reasons: string[] }> = {}
    for (const ccy of MAJORS) {
      const rate = ratesMap[ccy]
      const reasons: string[] = []
      let score = 0

      if (rate) {
        // CB bias score
        const bs = biasScore(rate.bias)
        score += bs * 2 // Weight bias heavily
        if (bs > 0) reasons.push(`${rate.bank}: ${rate.bias} (hawkish)`)
        else if (bs < 0) reasons.push(`${rate.bank}: ${rate.bias} (dovish)`)
        else if (rate.bias) reasons.push(`${rate.bank}: ${rate.bias}`)

        // Rate vs target
        const rts = rateTargetScore(rate.rate, rate.target)
        score += rts
        if (rts > 0) reasons.push(`Rente (${rate.rate}%) boven target (${rate.target}%) → restrictief`)
        else if (rts < 0) reasons.push(`Rente (${rate.rate}%) onder target (${rate.target}%) → accommoderend`)
      }

      // Count upcoming high-impact events (risk factor)
      const ccyEvents = todayEvents.filter(e => e.currency === ccy)
      if (ccyEvents.length > 0) {
        reasons.push(`${ccyEvents.length} high-impact event(s) vandaag → volatiliteit verwacht`)
      }

      currencyScores[ccy] = { score, reasons }
    }

    // ── 2. Pair Bias Table ──
    const pairBiases = PAIRS.map(pair => {
      const [base, quote] = pair.split('/')
      const baseScore = currencyScores[base]?.score || 0
      const quoteScore = currencyScores[quote]?.score || 0
      const diff = baseScore - quoteScore

      let direction: string
      let conviction: string
      if (diff >= 3) { direction = 'bullish'; conviction = 'sterk' }
      else if (diff >= 1.5) { direction = 'bullish'; conviction = 'matig' }
      else if (diff > 0.5) { direction = 'licht bullish'; conviction = 'laag' }
      else if (diff <= -3) { direction = 'bearish'; conviction = 'sterk' }
      else if (diff <= -1.5) { direction = 'bearish'; conviction = 'matig' }
      else if (diff < -0.5) { direction = 'licht bearish'; conviction = 'laag' }
      else { direction = 'neutraal'; conviction = 'geen' }

      // Build reason
      const baseReasons = currencyScores[base]?.reasons || []
      const quoteReasons = currencyScores[quote]?.reasons || []
      const reason = [
        baseReasons.length > 0 ? `${base}: ${baseReasons[0]}` : null,
        quoteReasons.length > 0 ? `${quote}: ${quoteReasons[0]}` : null,
      ].filter(Boolean).join(' | ')

      // Rate differential
      const baseRate = ratesMap[base]?.rate
      const quoteRate = ratesMap[quote]?.rate
      const rateDiff = (baseRate != null && quoteRate != null) ? +(baseRate - quoteRate).toFixed(2) : null

      return {
        pair,
        base,
        quote,
        direction,
        conviction,
        score: +diff.toFixed(2),
        reason,
        rateDiff,
        baseBias: ratesMap[base]?.bias || '',
        quoteBias: ratesMap[quote]?.bias || '',
      }
    }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score))

    // ── 3. Macro Regime ──
    // Determine overall regime from currency scores
    const usdScore = currencyScores['USD']?.score || 0
    const jpyScore = currencyScores['JPY']?.score || 0
    const highYieldAvg = (['AUD', 'NZD', 'CAD'] as const)
      .reduce((sum, c) => sum + (currencyScores[c]?.score || 0), 0) / 3

    let regime: string
    let regimeExplain: string
    if (jpyScore > 1 && highYieldAvg < 0) {
      regime = 'Risk-Off'
      regimeExplain = 'JPY is sterk (veilige haven) en high-yield valuta\'s zijn zwak. Markt zoekt veiligheid. Voorzichtig met long risk-posities.'
    } else if (highYieldAvg > 1 && jpyScore < 0) {
      regime = 'Risk-On'
      regimeExplain = 'High-yield valuta\'s (AUD, NZD, CAD) zijn sterk en JPY is zwak. Markt is in risk-on modus. Kijk naar long AUD, NZD en short JPY setups.'
    } else if (usdScore > 2) {
      regime = 'USD Dominant'
      regimeExplain = 'De dollar domineert door hawkish Fed en/of risk-off flows. Focus op USD-paren met de richting van de dollar.'
    } else if (usdScore < -2) {
      regime = 'USD Zwak'
      regimeExplain = 'De dollar is zwak door dovish verwachtingen. Kijk naar long posities in sterke valuta\'s tegen USD.'
    } else {
      regime = 'Gemengd'
      regimeExplain = 'Geen duidelijk macro-thema domineert. Focus op individuele paar-divergenties en aankomende events.'
    }

    // ── 4. Currency ranking ──
    const currencyRanking = MAJORS
      .map(ccy => ({
        currency: ccy,
        score: currencyScores[ccy]?.score || 0,
        reasons: currencyScores[ccy]?.reasons || [],
        rate: ratesMap[ccy]?.rate ?? null,
        bias: ratesMap[ccy]?.bias || '',
        flag: ratesMap[ccy]?.flag || '',
        bank: ratesMap[ccy]?.bank || '',
      }))
      .sort((a, b) => b.score - a.score)

    // ── 5. Intermarket signals with live data ──
    const intermarketDefs = [
      {
        key: 'us10y',
        name: 'US 10Y Yields',
        unit: '%',
        context: 'Stijgende yields = USD sterker, risk-off druk op aandelen en high-yield valuta\'s. Dalende yields = USD zwakker, risk-on.',
        howToRead: 'Yields stijgen → beleggers eisen meer rente → geld stroomt naar USD. Yields dalen → verwachting van renteverlaging → USD zwakker.',
        regimeImpact: 'Stijgende yields + dalende aandelen = Risk-Off. Dalende yields + stijgende aandelen = Risk-On.',
      },
      {
        key: 'sp500',
        name: 'S&P 500',
        unit: '',
        context: 'Stijgende aandelenmarkt = risk-on (goed voor AUD, NZD, CAD). Dalende markt = risk-off (goed voor JPY, CHF, USD).',
        howToRead: 'Aandelen omhoog → beleggers nemen risico → high-yield valuta\'s profiteren. Aandelen omlaag → vlucht naar veiligheid.',
        regimeImpact: 'S&P 500 bepaalt het risicosentiment. Sterke daling = Risk-Off signaal.',
      },
      {
        key: 'vix',
        name: 'VIX (Angstindex)',
        unit: '',
        context: 'VIX boven 20 = verhoogde angst (risk-off). VIX onder 15 = lage angst (risk-on). VIX boven 30 = paniek.',
        howToRead: 'Stijgende VIX → meer onzekerheid → JPY en CHF worden sterker. Dalende VIX → meer vertrouwen → AUD, NZD sterker.',
        regimeImpact: 'VIX is de thermometer van angst. Hoge VIX = Risk-Off, lage VIX = Risk-On.',
      },
      {
        key: 'gold',
        name: 'Goud (XAU/USD)',
        unit: '$',
        context: 'Goud stijgt bij onzekerheid en dalende reële rente. Goud daalt bij stijgende yields en sterke USD.',
        howToRead: 'Goud omhoog → markt zoekt veiligheid → bevestigt risk-off. Goud omlaag + USD omhoog → sterke USD-rally.',
        regimeImpact: 'Goud bevestigt het regime: stijgend goud + dalende aandelen = duidelijk Risk-Off.',
      },
      {
        key: 'oil',
        name: 'Olie (WTI)',
        unit: '$',
        context: 'Stijgende olie = bullish voor CAD en NOK (olie-exporteurs). Bearish voor JPY (olie-importeur). Kan inflatie aanwakkeren.',
        howToRead: 'Olie omhoog → CAD sterker, JPY zwakker. Olie omlaag → CAD zwakker. Extreme stijging → inflatierisico → hawkish CB\'s.',
        regimeImpact: 'Olie beïnvloedt specifieke valuta\'s meer dan het algemene regime.',
      },
    ]

    const intermarketSignals = intermarketDefs.map(def => ({
      ...def,
      current: marketData[def.key]?.current ?? null,
      change: marketData[def.key]?.change ?? null,
      changePct: marketData[def.key]?.changePct ?? null,
      direction: marketData[def.key]?.direction ?? 'flat',
    }))

    // ── 6. Regime explanation with methodology ──
    const regimeMethodology = `Het macro regime wordt bepaald door centrale bank beleid: als veilige-haven valuta's (JPY, CHF) fundamenteel sterk zijn en high-yield valuta's (AUD, NZD, CAD) zwak, is de markt in Risk-Off modus. Andersom is Risk-On. Dit is geen voorspelling maar een weergave van de huidige fundamentele stand — je bent niet "te laat" omdat het regime dagen tot weken kan aanhouden. Het helpt je om met de stroom mee te traden in plaats van ertegen.`

    return NextResponse.json({
      regime,
      regimeExplain,
      regimeMethodology,
      intermarketSignals,
      currencyRanking,
      pairBiases,
      todayEvents,
      weekEvents,
      generatedAt: new Date().toISOString(),
      date: todayStr,
    })
  } catch (e) {
    console.error('Briefing API error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ─── Helpers ────────────────────────────────────────────────
async function fetchRates(): Promise<CBRate[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (url && key) {
      const supabase = createClient(url, key)
      const { data, error } = await supabase
        .from('central_bank_rates')
        .select('*')
        .order('currency')

      if (!error && data && data.length > 0) return data
    }
  } catch { /* fall through */ }

  // Minimal fallback
  return [
    { currency: 'USD', country: 'VS', bank: 'Federal Reserve', rate: 3.75, target: 3.50, bias: 'afwachtend', last_move: '', next_meeting: '', flag: 'US' },
    { currency: 'EUR', country: 'EU', bank: 'ECB', rate: 1.90, target: 1.75, bias: 'afwachtend', last_move: '', next_meeting: '', flag: 'EU' },
    { currency: 'GBP', country: 'VK', bank: 'BoE', rate: 3.75, target: 3.50, bias: 'voorzichtig verruimend', last_move: '', next_meeting: '', flag: 'GB' },
    { currency: 'JPY', country: 'JP', bank: 'BoJ', rate: 1.00, target: 1.25, bias: 'voorzichtig verkrappend', last_move: '', next_meeting: '', flag: 'JP' },
    { currency: 'CHF', country: 'CH', bank: 'SNB', rate: 0.00, target: 0.00, bias: 'afwachtend', last_move: '', next_meeting: '', flag: 'CH' },
    { currency: 'AUD', country: 'AU', bank: 'RBA', rate: 3.35, target: 3.10, bias: 'voorzichtig verruimend', last_move: '', next_meeting: '', flag: 'AU' },
    { currency: 'CAD', country: 'CA', bank: 'BoC', rate: 2.25, target: 2.00, bias: 'afwachtend', last_move: '', next_meeting: '', flag: 'CA' },
    { currency: 'NZD', country: 'NZ', bank: 'RBNZ', rate: 2.75, target: 2.50, bias: 'afwachtend', last_move: '', next_meeting: '', flag: 'NZ' },
  ]
}

interface MarketQuote {
  current: number
  change: number
  changePct: number
  direction: 'up' | 'down' | 'flat'
}

const YAHOO_SYMBOLS: Record<string, string> = {
  us10y: '%5ETNX',    // 10-year treasury yield
  sp500: '%5EGSPC',   // S&P 500
  vix: '%5EVIX',      // VIX
  gold: 'GC%3DF',     // Gold futures
  oil: 'CL%3DF',      // WTI Crude Oil futures
}

async function fetchMarketData(): Promise<Record<string, MarketQuote>> {
  const result: Record<string, MarketQuote> = {}

  try {
    // Fetch all symbols in parallel
    const entries = Object.entries(YAHOO_SYMBOLS)
    const responses = await Promise.allSettled(
      entries.map(([, symbol]) =>
        fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 300 }, // Cache 5 min
        })
      )
    )

    for (let i = 0; i < entries.length; i++) {
      const [key] = entries[i]
      const response = responses[i]

      if (response.status !== 'fulfilled' || !response.value.ok) continue

      try {
        const json = await response.value.json()
        const meta = json?.chart?.result?.[0]?.meta
        const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close

        if (meta && closes && closes.length >= 2) {
          const current = meta.regularMarketPrice ?? closes[closes.length - 1]
          const previous = closes[closes.length - 2] ?? closes[0]

          if (current != null && previous != null && previous !== 0) {
            const change = +(current - previous).toFixed(2)
            const changePct = +((change / previous) * 100).toFixed(2)
            // For yields, the value from Yahoo is already in percentage (e.g., 4.25)
            const displayCurrent = key === 'us10y' ? +(current).toFixed(3) : +(current).toFixed(2)

            result[key] = {
              current: displayCurrent,
              change,
              changePct,
              direction: change > 0.01 ? 'up' : change < -0.01 ? 'down' : 'flat',
            }
          }
        }
      } catch { /* skip individual parse errors */ }
    }
  } catch { /* return empty if all fails */ }

  return result
}
