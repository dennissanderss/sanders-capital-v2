import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { runLivePipeline } from '@/lib/fx-engine'
import type { EngineInput, CBRate as EngineCBRate } from '@/lib/fx-engine'

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

interface NewsArticle {
  id: string
  title: string
  title_nl: string | null
  summary: string
  summary_nl: string | null
  source: string
  category: string
  published_at: string
  relevance_score: number
  relevance_tags: string[]
  affected_currencies: string[]
  relevance_context: string
  url: string
}

// ─── Constants ──────────────────────────────────────────────
const MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']

const PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD',
  'USD/CAD', 'USD/CHF', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
  'AUD/JPY', 'NZD/JPY', 'CAD/JPY', 'EUR/AUD', 'GBP/AUD',
  'AUD/NZD', 'EUR/CHF', 'GBP/CHF', 'EUR/CAD', 'GBP/NZD',
  'AUD/CAD',
]

const PAIR_SYMBOLS_V3: Record<string, string> = {
  'EUR/USD': 'EURUSD=X', 'GBP/USD': 'GBPUSD=X', 'USD/JPY': 'USDJPY=X',
  'AUD/USD': 'AUDUSD=X', 'NZD/USD': 'NZDUSD=X', 'USD/CAD': 'USDCAD=X',
  'USD/CHF': 'USDCHF=X', 'EUR/GBP': 'EURGBP=X', 'EUR/JPY': 'EURJPY=X',
  'GBP/JPY': 'GBPJPY=X', 'AUD/JPY': 'AUDJPY=X', 'NZD/JPY': 'NZDJPY=X',
  'CAD/JPY': 'CADJPY=X', 'EUR/AUD': 'EURAUD=X', 'GBP/AUD': 'GBPAUD=X',
  'AUD/NZD': 'AUDNZD=X', 'EUR/CHF': 'EURCHF=X', 'GBP/CHF': 'GBPCHF=X',
  'EUR/CAD': 'EURCAD=X', 'GBP/NZD': 'GBPNZD=X', 'AUD/CAD': 'AUDCAD=X',
}

const IMPACT_MAP: Record<string, string> = {
  High: 'hoog', Medium: 'medium', Low: 'laag', Holiday: 'feestdag',
}

const COUNTRY_MAP: Record<string, string> = {
  USD: 'VS', EUR: 'EU', GBP: 'VK', JPY: 'JP',
  AUD: 'AU', CAD: 'CA', CHF: 'CH', NZD: 'NZ',
}

// ─── Scoring Functions ──────────────────────────────────────
function biasScore(bias: string): number {
  const b = (bias || '').toLowerCase()
  if (b.includes('verkrappend') || b.includes('hawkish')) return 2
  if (b.includes('voorzichtig verkrappend')) return 1.5
  if (b.includes('afwachtend')) return 0
  if (b.includes('voorzichtig verruimend')) return -1
  if (b.includes('verruimend') || b.includes('dovish')) return -2
  return 0
}

function rateTargetScore(rate: number | null, target: number | null): number {
  if (rate === null || target === null) return 0
  const diff = rate - target
  if (diff > 0.5) return 1
  if (diff > 0) return 0.5
  if (diff < -0.5) return -1
  if (diff < 0) return -0.5
  return 0
}

// ─── News Sentiment Analysis ────────────────────────────────
// Analyze recent news articles for sentiment impact per currency
// V2.1: Improved keyword matching with negation detection + phrase priority
function analyzeNewsSentiment(articles: NewsArticle[]): Record<string, { score: number; headlines: string[]; sentiment: string }> {
  const sentiments: Record<string, { score: number; headlines: string[]; bullishCount: number; bearishCount: number }> = {}

  for (const ccy of MAJORS) {
    sentiments[ccy] = { score: 0, headlines: [], bullishCount: 0, bearishCount: 0 }
  }

  // Negation phrases that INVERT the signal (e.g. "no rate hike" = bearish)
  const negationPrefixes = ['no ', 'not ', 'without ', 'failed to ', 'unlikely ', 'ruled out ', 'avoided ']

  // Bullish PHRASES first (multi-word = higher confidence), then single words
  const bullishPhrases = [
    'rate hike', 'rate increase', 'higher than expected', 'beat expectations',
    'exceeded expectations', 'stronger than expected', 'record high', 'hawkish surprise',
    'hawkish hold', 'tightening cycle', 'above consensus',
  ]
  const bullishWords = [
    'hawkish', 'tightening', 'restrictive', 'robust', 'surge', 'rally',
    'booming', 'upbeat', 'outperform', 'accelerat', 'strong', 'growth',
    'gain', 'rise', 'climb', 'recover', 'optimis', 'positive', 'boost',
  ]

  // Bearish PHRASES first, then single words
  const bearishPhrases = [
    'rate cut', 'rate decrease', 'lower than expected', 'missed expectations',
    'below expected', 'weaker than expected', 'dovish surprise', 'dovish pivot',
    'easing cycle', 'below consensus', 'hard landing', 'debt crisis',
    'oil prices fall', 'oil price drop', 'crude oil decline', 'under pressure',
    'higher prices for', 'supply chain', 'iran deal',
  ]
  const bearishWords = [
    'dovish', 'easing', 'accommodative', 'recession', 'slowdown',
    'contraction', 'crisis', 'warning', 'downgrade', 'stagflation',
    'deteriorat', 'plunge', 'crash', 'tariff', 'trade war', 'sanction',
    'tension', 'conflict', 'geopolit', 'uncertainty', 'risk',
    'pressure', 'decline', 'fall', 'drop', 'slide', 'tumble', 'weak',
  ]

  for (const article of articles) {
    const text = `${article.title} ${article.summary}`.toLowerCase()
    const currencies = article.affected_currencies || []

    if (currencies.length === 0) continue

    let isBullish = 0
    let isBearish = 0

    // Check phrases first (higher weight: 1.5x per match)
    for (const phrase of bullishPhrases) {
      if (text.includes(phrase)) {
        // Check for negation
        const negated = negationPrefixes.some(neg => text.includes(neg + phrase))
        if (negated) isBearish += 1.5
        else isBullish += 1.5
      }
    }
    for (const phrase of bearishPhrases) {
      if (text.includes(phrase)) {
        const negated = negationPrefixes.some(neg => text.includes(neg + phrase))
        if (negated) isBullish += 1.5
        else isBearish += 1.5
      }
    }

    // Single keywords (lower weight: 0.5x to reduce noise)
    for (const kw of bullishWords) {
      if (text.includes(kw)) isBullish += 0.5
    }
    for (const kw of bearishWords) {
      if (text.includes(kw)) isBearish += 0.5
    }

    // Skip articles with no clear signal (noise filter)
    // Lowered threshold: single keyword matches (0.5) now count
    if (isBullish === 0 && isBearish === 0) continue

    // Weight by relevance score
    const weight = Math.min(article.relevance_score / 5, 1.5)
    // Recency weight: articles from last 12h count more
    const hoursAgo = (Date.now() - new Date(article.published_at).getTime()) / 3600000
    const recencyWeight = hoursAgo < 12 ? 1.5 : hoursAgo < 24 ? 1.2 : hoursAgo < 48 ? 1.0 : 0.7

    const netSentiment = (isBullish - isBearish) * weight * recencyWeight * 0.25

    for (const ccy of currencies) {
      if (sentiments[ccy]) {
        sentiments[ccy].score += netSentiment
        sentiments[ccy].bullishCount += isBullish
        sentiments[ccy].bearishCount += isBearish
        if (sentiments[ccy].headlines.length < 3) {
          sentiments[ccy].headlines.push(article.title_nl || article.title)
        }
      }
    }
  }

  // Normalize and determine sentiment labels
  const result: Record<string, { score: number; headlines: string[]; sentiment: string }> = {}
  for (const ccy of MAJORS) {
    const s = sentiments[ccy]
    const score = Math.round(s.score * 10) / 10
    let sentiment = 'neutraal'
    // FIX: Check "sterk" FIRST (was unreachable before)
    if (score > 1.5) sentiment = 'sterk positief'
    else if (score > 0.5) sentiment = 'positief'
    else if (score < -1.5) sentiment = 'sterk negatief'
    else if (score < -0.5) sentiment = 'negatief'

    result[ccy] = { score, headlines: s.headlines, sentiment }
  }

  return result
}

// ─── Calendar Context ───────────────────────────────────────
function eventContext(event: CalendarEvent, currency: string): string {
  const title = event.title.toLowerCase()
  const forecast = event.forecast
  const previous = event.previous

  if (title.includes('cpi') || title.includes('inflation') || title.includes('price')) {
    if (forecast && previous) {
      const f = parseFloat(forecast.replace('%', ''))
      const p = parseFloat(previous.replace('%', ''))
      if (!isNaN(f) && !isNaN(p)) {
        if (f > p) return `Inflatie wordt hoger verwacht (${forecast} vs ${previous}) → hawkish voor ${currency}.`
        if (f < p) return `Inflatie daalt naar verwachting (${forecast} vs ${previous}) → dovish voor ${currency}.`
        return `Inflatie stabiel verwacht (${forecast}) → neutraal.`
      }
    }
    return `Inflatiedata voor ${currency}. Hoger = hawkish, lager = dovish.`
  }

  if (title.includes('employment') || title.includes('payroll') || title.includes('job') || title.includes('labor') || title.includes('claims')) {
    return `Arbeidsmarktdata voor ${currency}. Sterk = hawkish, zwak = dovish.`
  }

  if (title.includes('gdp') || title.includes('gross domestic')) {
    return `Groeicijfer voor ${currency}. Sterker = hawkish, zwakker = dovish.`
  }

  if (title.includes('pmi') || title.includes('purchasing manager')) {
    return `Bedrijfsvertrouwen voor ${currency}. Boven 50 = groei, onder 50 = krimp.`
  }

  if (title.includes('rate') || title.includes('interest') || title.includes('monetary policy')) {
    return `Rentebeslissing! Het belangrijkste event. Let op toon en projecties.`
  }

  if (title.includes('retail') || title.includes('sales') || title.includes('consumer')) {
    return `Consumentendata voor ${currency}. Sterk = hawkish, zwak = dovish.`
  }

  if (title.includes('speak') || title.includes('press conference') || title.includes('testimony')) {
    return `Toespraak. Let op hints over toekomstig rentebeleid.`
  }

  return `Belangrijk event voor ${currency}. Hoger dan verwacht = hawkish, lager = dovish.`
}

// ─── Main Handler ───────────────────────────────────────────
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Parallel fetch: rates + calendar + intermarket + news
    const [ratesResult, thisWeekRes, nextWeekRes, marketData, recentNews] = await Promise.all([
      fetchRates(),
      fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { next: { revalidate: 1800 } }),
      fetch('https://nfs.faireconomy.media/ff_calendar_nextweek.json', { next: { revalidate: 1800 } }),
      fetchMarketData(),
      fetchRecentNews(supabaseUrl, supabaseKey),
    ])

    const thisWeek: CalendarEvent[] = thisWeekRes.ok ? await thisWeekRes.json() : []
    const nextWeek: CalendarEvent[] = nextWeekRes.ok ? await nextWeekRes.json() : []
    const allEvents = [...thisWeek, ...nextWeek]

    // ── Currency Momentum (depends on marketData, fetched separately with caching) ──
    const currencyMomentum = await fetchCurrencyMomentum(marketData)

    // ── News Sentiment ──
    const newsSentiment = analyzeNewsSentiment(recentNews)

    // ── 1. Currency Scorecard (enhanced with news) ──
    const ratesMap: Record<string, CBRate> = {}
    for (const r of ratesResult) ratesMap[r.currency] = r

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

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

    // Currency scores with news integration
    const currencyScores: Record<string, { score: number; baseScore: number; newsBonus: number; reasons: string[]; newsHeadlines: string[]; scoreBreakdown: { biasLabel: string; biasRaw: number; biasMultiplied: number; rateScore: number; rate: number | null; target: number | null; newsRaw: number; newsCapped: number; total: number } }> = {}
    for (const ccy of MAJORS) {
      const rate = ratesMap[ccy]
      const reasons: string[] = []
      let baseScore = 0
      let bs = 0
      let rts = 0

      if (rate) {
        bs = biasScore(rate.bias)
        baseScore += bs * 2
        if (bs > 0) reasons.push(`${rate.bank}: ${rate.bias} (hawkish)`)
        else if (bs < 0) reasons.push(`${rate.bank}: ${rate.bias} (dovish)`)
        else if (rate.bias) reasons.push(`${rate.bank}: ${rate.bias}`)

        rts = rateTargetScore(rate.rate, rate.target)
        baseScore += rts
        if (rts > 0) reasons.push(`Rente (${rate.rate}%) boven target (${rate.target}%) → restrictief`)
        else if (rts < 0) reasons.push(`Rente (${rate.rate}%) onder target (${rate.target}%) → accommoderend`)
      }

      const ccyEvents = todayEvents.filter(e => e.currency === ccy)
      if (ccyEvents.length > 0) {
        reasons.push(`${ccyEvents.length} high-impact event(s) vandaag`)
      }

      // News sentiment bonus (capped at +-1.5 to not overpower fundamentals)
      const newsData = newsSentiment[ccy]
      const newsBonus = Math.max(-2.0, Math.min(2.0, newsData?.score || 0))
      if (newsBonus > 0.3) {
        reasons.push(`Nieuws sentiment positief (${newsData.sentiment})`)
      } else if (newsBonus < -0.3) {
        reasons.push(`Nieuws sentiment negatief (${newsData.sentiment})`)
      }

      currencyScores[ccy] = {
        score: baseScore + newsBonus,
        baseScore,
        newsBonus: Math.round(newsBonus * 10) / 10,
        reasons,
        newsHeadlines: newsData?.headlines || [],
        scoreBreakdown: {
          biasLabel: rate?.bias || 'onbekend',
          biasRaw: bs,
          biasMultiplied: bs * 2,
          rateScore: rts,
          rate: rate?.rate ?? null,
          target: rate?.target ?? null,
          newsRaw: newsData?.score || 0,
          newsCapped: newsBonus,
          total: baseScore + newsBonus,
        },
      }
    }

    // ── 2. Pair Biases ──
    const pairBiases = PAIRS.map(pair => {
      const [base, quote] = pair.split('/')
      const baseScore = currencyScores[base]?.score || 0
      const quoteScore = currencyScores[quote]?.score || 0
      const diff = baseScore - quoteScore

      // Also calculate base-only score (without news) for comparison
      const baseOnlyDiff = (currencyScores[base]?.baseScore || 0) - (currencyScores[quote]?.baseScore || 0)
      const newsInfluence = Math.round((diff - baseOnlyDiff) * 10) / 10

      let direction: string
      let conviction: string
      if (diff >= 3.5) { direction = 'bullish'; conviction = 'sterk' }
      else if (diff >= 2) { direction = 'bullish'; conviction = 'matig' }
      else if (diff > 0.5) { direction = 'licht bullish'; conviction = 'laag' }
      else if (diff <= -3.5) { direction = 'bearish'; conviction = 'sterk' }
      else if (diff <= -2) { direction = 'bearish'; conviction = 'matig' }
      else if (diff < -0.5) { direction = 'licht bearish'; conviction = 'laag' }
      else { direction = 'neutraal'; conviction = 'geen' }

      const baseReasons = currencyScores[base]?.reasons || []
      const quoteReasons = currencyScores[quote]?.reasons || []
      const reason = [
        baseReasons.length > 0 ? `${base}: ${baseReasons[0]}` : null,
        quoteReasons.length > 0 ? `${quote}: ${quoteReasons[0]}` : null,
      ].filter(Boolean).join(' | ')

      const baseRate = ratesMap[base]?.rate
      const quoteRate = ratesMap[quote]?.rate
      const rateDiff = (baseRate != null && quoteRate != null) ? +(baseRate - quoteRate).toFixed(2) : null

      return {
        pair, base, quote, direction, conviction,
        score: +diff.toFixed(2),
        scoreWithoutNews: +baseOnlyDiff.toFixed(2),
        newsInfluence,
        reason, rateDiff,
        baseBias: ratesMap[base]?.bias || '',
        quoteBias: ratesMap[quote]?.bias || '',
      }
    }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score))

    // ── 3. Currency scores for regime (calculated here, regime determined after intermarket data) ──
    const usdScore = currencyScores['USD']?.score || 0
    const jpyScore = currencyScores['JPY']?.score || 0
    const chfScore = currencyScores['CHF']?.score || 0
    const safeHavenAvg = (jpyScore + chfScore) / 2
    const highYieldAvg = (['AUD', 'NZD', 'CAD'] as const)
      .reduce((sum, c) => sum + (currencyScores[c]?.score || 0), 0) / 3

    // ── 4. Currency Ranking ──
    const currencyRanking = MAJORS
      .map(ccy => ({
        currency: ccy,
        score: currencyScores[ccy]?.score || 0,
        baseScore: currencyScores[ccy]?.baseScore || 0,
        newsBonus: currencyScores[ccy]?.newsBonus || 0,
        reasons: currencyScores[ccy]?.reasons || [],
        newsHeadlines: currencyScores[ccy]?.newsHeadlines || [],
        scoreBreakdown: currencyScores[ccy]?.scoreBreakdown || null,
        rate: ratesMap[ccy]?.rate ?? null,
        bias: ratesMap[ccy]?.bias || '',
        flag: ratesMap[ccy]?.flag || '',
        bank: ratesMap[ccy]?.bank || '',
      }))
      .sort((a, b) => b.score - a.score)

    // ── 5. Intermarket Signals ──
    const intermarketDefs = [
      {
        key: 'us10y', name: 'US 10Y Yields', unit: '%',
        context: 'Stijgende yields = USD sterker, risk-off druk op aandelen en high-yield valuta\'s.',
        regimeImpact: 'Stijgende yields + dalende aandelen = Risk-Off. Dalende yields + stijgende aandelen = Risk-On.',
      },
      {
        key: 'sp500', name: 'S&P 500', unit: '',
        context: 'Stijgende markt = risk-on (AUD, NZD, CAD). Dalend = risk-off (JPY, CHF, USD).',
        regimeImpact: 'S&P 500 bepaalt het risicosentiment.',
      },
      {
        key: 'vix', name: 'VIX', unit: '',
        context: 'VIX boven 20 = verhoogde angst. Boven 30 = paniek.',
        regimeImpact: 'Hoge VIX = Risk-Off, lage VIX = Risk-On.',
      },
      {
        key: 'gold', name: 'Goud', unit: '$',
        context: 'Goud stijgt bij onzekerheid en dalende reele rente.',
        regimeImpact: 'Stijgend goud + dalende aandelen = Risk-Off.',
      },
      {
        key: 'oil', name: 'Olie (WTI)', unit: '$',
        context: 'Stijgende olie = bullish CAD, bearish JPY.',
        regimeImpact: 'Olie beinvloedt specifieke valuta\'s meer dan het regime.',
      },
      {
        key: 'dxy', name: 'DXY (Dollar Index)', unit: '',
        context: 'DXY stijgt = USD sterker t.o.v. mandje. DXY daalt = USD zwakker.',
        regimeImpact: 'DXY bevestigt USD regime-richting.',
      },
    ]

    const intermarketSignals = intermarketDefs.map(def => ({
      ...def,
      current: marketData[def.key]?.current ?? null,
      previousClose: marketData[def.key]?.previousClose ?? null,
      change: marketData[def.key]?.change ?? null,
      changePct: marketData[def.key]?.changePct ?? null,
      direction: marketData[def.key]?.direction ?? 'flat',
    }))

    // ── 6. Macro Regime (PURE fundamentals: CB policy + rate differentials) ──
    // Regime is determined ONLY by central bank bias scores — no intermarket here.
    // Intermarket signals are used later (Step 3) as confirmation/contradiction.
    let regime: string
    let regimeExplain: string
    let regimeColor: string
    const regimeSource = 'centraal bank beleid'

    if (jpyScore > 1 && highYieldAvg < 0) {
      regime = 'Risk-Off'
      regimeExplain = `JPY is fundamenteel sterk (score ${jpyScore > 0 ? '+' : ''}${jpyScore.toFixed(1)}) en high-yield valuta's zwak (gem. ${highYieldAvg > 0 ? '+' : ''}${highYieldAvg.toFixed(1)}). Centrale banken in JP zijn hawkish terwijl AUD/NZD/CAD dovish neigen. Dit creëert een risk-off omgeving.`
      regimeColor = 'red'
    } else if (highYieldAvg > 1 && jpyScore < 0) {
      regime = 'Risk-On'
      regimeExplain = `High-yield valuta's zijn sterk (gem. ${highYieldAvg > 0 ? '+' : ''}${highYieldAvg.toFixed(1)}) en JPY zwak (${jpyScore > 0 ? '+' : ''}${jpyScore.toFixed(1)}). Hawkish beleid bij RBA/RBNZ/BoC vs dovish BoJ creëert een risk-on omgeving.`
      regimeColor = 'green'
    } else if (usdScore > 2) {
      regime = 'USD Dominant'
      regimeExplain = `USD scoort ${usdScore > 0 ? '+' : ''}${usdScore.toFixed(1)} — ver boven andere valuta's. Hawkish Fed en/of hoge rente trekt kapitaal naar de dollar.`
      regimeColor = 'blue'
    } else if (usdScore < -2) {
      regime = 'USD Zwak'
      regimeExplain = `USD scoort ${usdScore > 0 ? '+' : ''}${usdScore.toFixed(1)} — dovish signalen vanuit de Fed. Dit creëert kansen in sterke valuta's tegen de dollar.`
      regimeColor = 'amber'
    } else {
      regime = 'Gemengd'
      regimeExplain = `Geen duidelijk macro-thema domineert (USD: ${usdScore > 0 ? '+' : ''}${usdScore.toFixed(1)}, JPY: ${jpyScore > 0 ? '+' : ''}${jpyScore.toFixed(1)}, HY gem: ${highYieldAvg > 0 ? '+' : ''}${highYieldAvg.toFixed(1)}). Focus op individuele paar-divergenties.`
      regimeColor = 'gray'
    }

    // ── 7. News Headlines (top important) ──
    const topNews = recentNews
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 8)
      .map(a => ({
        id: a.id,
        title: a.title_nl || a.title,
        titleEn: a.title,
        source: a.source,
        category: a.category,
        publishedAt: a.published_at,
        relevanceScore: a.relevance_score,
        affectedCurrencies: a.affected_currencies || [],
        relevanceContext: a.relevance_context || '',
        url: a.url,
      }))

    // ── 8. Regime Methodology ──
    const regimeMethodology = `Het macro regime wordt bepaald door centraal bank beleid: de bias (hawkish/dovish) en de rente t.o.v. het doel. Elke valuta krijgt een score op basis van deze fundamenten + een nieuws bonus (max ±2.0). Het regime volgt uit de verhoudingen tussen veilige havens (JPY, CHF), high-yield (AUD, NZD, CAD) en USD. Intermarket signalen (Stap 3) bevestigen of weerspreken het regime, maar veranderen het niet.`

    // ── 9. Confidence Score ──
    // Confidence = how clear is the fundamental picture?
    // Based on: spread between strongest/weakest currency, regime clarity, news alignment
    const intermarketAlignment = calculateIntermarketAlignment(intermarketSignals, regime)
    const newsAlignment = calculateNewsAlignment(newsSentiment, regime)

    // Fundamental clarity: larger spread = clearer picture
    const sortedScores = MAJORS.map(c => currencyScores[c]?.score || 0).sort((a, b) => b - a)
    const fundamentalSpread = sortedScores[0] - sortedScores[sortedScores.length - 1]
    // Spread of 6+ = very clear (100%), 4 = decent (75%), 2 = unclear (40%), 0 = no signal (20%)
    const fundamentalClarity = Math.min(100, Math.round(20 + (fundamentalSpread / 8) * 80))
    // Regime specificity bonus: non-Gemengd = clearer
    const regimeBonus = regime !== 'Gemengd' ? 10 : 0
    // Confidence = fundamental clarity (70%) + news alignment (30%) + regime bonus
    const overallConfidence = Math.min(95, Math.round(fundamentalClarity * 0.7 + newsAlignment * 0.3 + regimeBonus))

    // ── 9a. Divergence Detection ──
    // Compute divergences: price direction vs fundamental direction
    const divergences: Record<string, { hasDivergence: boolean; priceDirection: string; fundamentalDirection: string; pricePct: number; message: string }> = {}
    for (const ccy of MAJORS) {
      const score = currencyScores[ccy]?.score || 0
      const momentum = currencyMomentum[ccy]
      if (!momentum) continue

      const fundDir = score > 1 ? 'bullish' : score < -1 ? 'bearish' : 'neutral'
      const priceDir = momentum.direction

      const hasDivergence =
        (fundDir === 'bullish' && priceDir === 'down') ||
        (fundDir === 'bearish' && priceDir === 'up')

      if (hasDivergence) {
        const dirLabel = priceDir === 'up' ? 'stijgt' : 'daalt'
        const fundLabel = fundDir === 'bullish' ? 'bullish' : 'bearish'
        divergences[ccy] = {
          hasDivergence: true,
          priceDirection: priceDir,
          fundamentalDirection: fundDir,
          pricePct: momentum.changePct,
          message: `${ccy} is fundamenteel ${fundLabel} (${score > 0 ? '+' : ''}${score.toFixed(1)}) maar de koers ${dirLabel} ${Math.abs(momentum.changePct).toFixed(1)}% in 3 dagen → mean reversion kans`
        }
      }
    }

    // ── 9b. V2.1 ENHANCEMENT: Intermarket Regime Filter ──────────
    // If intermarket signals CONTRADICT the regime, downgrade "sterk" to "matig"
    // If they CONFIRM, upgrade "matig" to "sterk" (only for pairs aligned with regime)
    // This is the key improvement: intermarket signals now influence trade selection
    const regimeConfirmed = intermarketAlignment >= 65
    const regimeContradicted = intermarketAlignment <= 35

    // Also check for high-impact events today that add uncertainty
    const highImpactToday = todayEvents.length >= 2

    for (const pair of pairBiases) {
      // Check if pair direction aligns with regime
      const pairAligned = isAlignedWithRegime(pair, regime)
      ;(pair as any).regimeAligned = pairAligned

      if (regimeContradicted && pair.conviction === 'sterk') {
        // Intermarket contradicts regime → downgrade strong to moderate
        pair.conviction = 'matig'
      } else if (regimeConfirmed && pair.conviction === 'matig' && pairAligned) {
        // Intermarket confirms regime AND pair aligns → upgrade to strong
        pair.conviction = 'sterk'
      }

      // High-impact events add uncertainty → never allow "sterk" on those days
      // unless confidence is very high (>75%)
      if (highImpactToday && pair.conviction === 'sterk' && overallConfidence < 75) {
        pair.conviction = 'matig'
      }

      // V2.1: Non-aligned pairs should NEVER be "sterk" — they go against the macro
      if (!pairAligned && regime !== 'Gemengd' && pair.conviction === 'sterk') {
        pair.conviction = 'matig'
      }
    }

    // V2.1: Cross-pair contradiction filter
    // If pair A says USD strong and pair B says USD weak, downgrade both
    const sterkPairs = pairBiases.filter(p => p.conviction === 'sterk')
    for (const pair of sterkPairs) {
      const currencies = pair.pair.split('/')
      const pairImpliesStrong = pair.direction.includes('bullish') ? currencies[0] : currencies[1]

      // Check if any other sterk pair implies opposite for same currency
      const contradicts = sterkPairs.some(other => {
        if (other.pair === pair.pair) return false
        const otherCurrencies = other.pair.split('/')
        const otherImpliesWeak = other.direction.includes('bullish') ? otherCurrencies[1] : otherCurrencies[0]
        return pairImpliesStrong === otherImpliesWeak
      })

      if (contradicts) {
        pair.conviction = 'matig'
      }
    }

    // ── Trade Focus Tier ──
    for (const pair of pairBiases) {
      const absScore = Math.abs(pair.score)
      if (pair.conviction === 'sterk' || pair.conviction === 'matig') {
        (pair as any).tradeFocusTier = absScore >= 3.0 ? 'primary' : 'secondary'
      } else if (absScore >= 2.0) {
        (pair as any).tradeFocusTier = 'watchlist'
      } else {
        (pair as any).tradeFocusTier = 'none'
      }

      // ── Confluence Data ──
      const regimeAligned = (pair as any).regimeAligned ?? false
      const confluenceFactors = {
        fundamenteel: Math.abs(pair.score) >= 3.0,
        regime: regimeAligned,
        intermarket: intermarketAlignment >= 50,
        news: (pair.direction.includes('bullish') && pair.newsInfluence > 0) ||
              (pair.direction.includes('bearish') && pair.newsInfluence < 0) ||
              pair.newsInfluence === 0, // neutral news doesn't hurt
      }
      const confluenceScore = Object.values(confluenceFactors).filter(Boolean).length
      ;(pair as any).confluence = { factors: confluenceFactors, score: confluenceScore, total: 4 }
    }

    // ── V3 Engine: Run the Edge Extraction Engine ──
    // Provides sub-regime classification, multi-factor scoring,
    // pair-specific intermarket, tradeability, and 5-category signals.
    let v3Engine = null
    try {
      const engineInput: EngineInput = {
        cbRates: ratesResult as EngineCBRate[],
        marketData: marketData as Record<string, import('@/lib/fx-engine').MarketDataPoint>,
        priceHistory: {},  // Populated below
        news: recentNews,
        calendar: allEvents,
      }

      // Fetch 25-day price history for all pairs (for ATR + momentum)
      const pairEntries = Object.entries(PAIR_SYMBOLS_V3)
      const priceResponses = await Promise.allSettled(
        pairEntries.map(([, symbol]) =>
          fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            next: { revalidate: 300 },
          })
        )
      )

      for (let i = 0; i < pairEntries.length; i++) {
        const [, symbol] = pairEntries[i]
        const resp = priceResponses[i]
        if (resp.status !== 'fulfilled' || !resp.value.ok) continue
        try {
          const json = await resp.value.json()
          const result = json?.chart?.result?.[0]
          if (!result) continue
          const timestamps = result.timestamp || []
          const closes = result.indicators?.quote?.[0]?.close || []
          engineInput.priceHistory[symbol] = timestamps
            .map((ts: number, idx: number) => ({
              date: new Date(ts * 1000).toISOString().split('T')[0],
              close: closes[idx],
            }))
            .filter((d: { close: number | null }) => d.close != null)
        } catch { /* skip */ }
      }

      v3Engine = runLivePipeline(engineInput)
    } catch (engineErr) {
      console.error('V3 Engine error (non-fatal):', engineErr)
    }

    const response = NextResponse.json({
      version: 'v3.0',
      regime,
      regimeExplain,
      regimeColor,
      regimeSource,
      regimeMethodology,
      confidence: overallConfidence,
      regimeConfidence: fundamentalClarity,
      confidenceBreakdown: {
        fundamentalClarity,
        fundamentalSpread: +fundamentalSpread.toFixed(1),
        newsAlignment,
        intermarketAlignment,
        regimeBonus,
        regimeConfidence: fundamentalClarity,
        formula: 'fundamentalClarity × 70% + newsAlignment × 30% + regimeBonus',
      },
      intermarketAlignment,
      intermarketSignals,
      currencyRanking,
      pairBiases,
      currencyMomentum,
      divergences,
      todayEvents,
      weekEvents,
      topNews,
      newsSentiment,
      newsLastUpdated: recentNews.length > 0
        ? recentNews.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())[0].published_at
        : null,
      newsCount: recentNews.length,
      generatedAt: new Date().toISOString(),
      date: todayStr,
      // ── V3 Engine Output ──
      v3: v3Engine ? {
        regime: v3Engine.regime,
        currencyScores: v3Engine.currencyScores.map(cs => ({
          currency: cs.currency,
          factors: cs.factors,
          weightedTotal: cs.weightedTotal,
          rawTotal: cs.rawTotal,
          rank: cs.rank,
          reasons: cs.reasons,
        })),
        pairSignals: v3Engine.pairSignals.map(ps => ({
          pair: ps.pair,
          signal: ps.signal,
          conviction: ps.conviction,
          score: ps.score,
          tradeability: ps.tradeability,
          intermarket: {
            pair: ps.intermarket.pair,
            alignment: ps.intermarket.alignment,
            signals: ps.intermarket.signals,
          },
          reasons: ps.reasons,
          priceMomentum: ps.priceMomentum,
        })),
        tradeFocus: v3Engine.tradeFocus.map(tf => ({
          pair: tf.pair,
          signal: tf.signal,
          conviction: tf.conviction,
          score: tf.score,
          tradeability: tf.tradeability.status,
          reasons: tf.reasons,
        })),
        metadata: v3Engine.metadata,
      } : null,
    })
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return response
  } catch (e) {
    console.error('Briefing V2 API error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ─── Regime-Pair Alignment Check ────────────────────────────
// Does this pair's direction make sense given the macro regime?
function isAlignedWithRegime(pair: { pair: string; direction: string; base: string; quote: string }, regime: string): boolean {
  const safeHavens = ['JPY', 'CHF']
  const highYield = ['AUD', 'NZD', 'CAD']
  const isBullish = pair.direction.includes('bullish')

  if (regime === 'Risk-Off') {
    // In risk-off: safe-havens should be strong (base=safe bullish, or quote=safe bearish)
    if (isBullish && safeHavens.includes(pair.base)) return true
    if (!isBullish && safeHavens.includes(pair.quote)) return true
    if (!isBullish && highYield.includes(pair.base)) return true
    if (isBullish && highYield.includes(pair.quote)) return true
  }
  if (regime === 'Risk-On') {
    // In risk-on: high-yield should be strong
    if (isBullish && highYield.includes(pair.base)) return true
    if (!isBullish && highYield.includes(pair.quote)) return true
    if (!isBullish && safeHavens.includes(pair.base)) return true
    if (isBullish && safeHavens.includes(pair.quote)) return true
  }
  if (regime === 'USD Dominant') {
    // USD should be strong
    if (isBullish && pair.base === 'USD') return true
    if (!isBullish && pair.quote === 'USD') return true
  }
  if (regime === 'USD Zwak') {
    if (!isBullish && pair.base === 'USD') return true
    if (isBullish && pair.quote === 'USD') return true
  }
  // Gemengd: any direction is fine
  if (regime === 'Gemengd') return true
  return false
}

// ─── Confidence Calculations ────────────────────────────────
function calculateIntermarketAlignment(
  signals: { key: string; direction: string; current: number | null; changePct: number | null }[],
  regime: string
): number {
  const get = (key: string) => signals.find(s => s.key === key)
  let score = 0
  let maxScore = 0

  const sp = get('sp500')
  const vix = get('vix')
  const gold = get('gold')
  const yields = get('us10y')
  const dxy = get('dxy')

  // Helper: direction strength (0-1 based on magnitude)
  const strength = (signal: typeof sp) => {
    if (!signal || signal.direction === 'flat') return 0
    const pct = Math.abs(signal.changePct ?? 0)
    if (pct > 1.0) return 1.0   // strong move
    if (pct > 0.5) return 0.75
    if (pct > 0.2) return 0.5
    return 0.25  // tiny move
  }

  if (regime === 'Risk-Off') {
    maxScore = 5
    if (sp?.direction === 'down') score += strength(sp)
    if (vix?.direction === 'up') score += strength(vix)
    if (gold?.direction === 'up') score += strength(gold)
    if (yields?.direction === 'up') score += strength(yields)
    if (dxy?.direction === 'up') score += strength(dxy) // USD safe haven
  } else if (regime === 'Risk-On') {
    maxScore = 4
    if (sp?.direction === 'up') score += strength(sp)
    if (vix?.direction === 'down') score += strength(vix)
    if (gold?.direction === 'down') score += strength(gold)
    if (dxy?.direction === 'down') score += strength(dxy)
  } else if (regime === 'USD Dominant') {
    maxScore = 3
    if (dxy?.direction === 'up') score += strength(dxy)
    if (yields?.direction === 'up') score += strength(yields)
    if (sp?.direction !== 'up') score += 0.5
  } else if (regime === 'USD Zwak') {
    maxScore = 3
    if (dxy?.direction === 'down') score += strength(dxy)
    if (yields?.direction === 'down') score += strength(yields)
    if (sp?.direction === 'up') score += 0.5
  } else {
    return 50 // Gemengd
  }

  if (maxScore === 0) return 50
  return Math.round((score / maxScore) * 100)
}

function calculateNewsAlignment(
  sentiment: Record<string, { score: number; headlines: string[]; sentiment: string }>,
  regime: string
): number {
  const usd = sentiment['USD']?.score || 0
  const jpy = sentiment['JPY']?.score || 0
  const aud = sentiment['AUD']?.score || 0

  if (regime === 'Risk-Off') {
    if (jpy > 0 && aud < 0) return 80
    if (jpy > 0 || aud < 0) return 60
    return 40
  }
  if (regime === 'Risk-On') {
    if (aud > 0 && jpy < 0) return 80
    if (aud > 0 || jpy < 0) return 60
    return 40
  }
  if (regime === 'USD Dominant') {
    if (usd > 0) return 75
    return 40
  }
  if (regime === 'USD Zwak') {
    if (usd < 0) return 75
    return 40
  }
  return 50
}

// ─── Data Fetchers ──────────────────────────────────────────
async function fetchRates(): Promise<CBRate[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (url && key) {
      const supabase = createClient(url, key)
      const { data, error } = await supabase.from('central_bank_rates').select('*').order('currency')
      if (!error && data && data.length > 0) return data
    }
  } catch { /* fall through */ }

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

async function fetchRecentNews(supabaseUrl?: string, supabaseKey?: string): Promise<NewsArticle[]> {
  try {
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const since = new Date(Date.now() - 3 * 86400000).toISOString() // Last 3 days
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .gte('published_at', since)
        .gte('relevance_score', 2) // Only important news
        .order('published_at', { ascending: false })
        .limit(50)

      if (!error && data) return data
    }
  } catch { /* fall through */ }
  return []
}

async function fetchCurrencyMomentum(marketData: Record<string, MarketQuote>): Promise<Record<string, { direction: 'up' | 'down' | 'flat'; changePct: number }>> {
  const result: Record<string, { direction: 'up' | 'down' | 'flat'; changePct: number }> = {}

  // Use DXY for USD
  if (marketData['dxy']) {
    const d = marketData['dxy']
    result['USD'] = { direction: d.direction, changePct: d.changePct }
  }

  // For other currencies, derive from their USD pair moves
  // If EUR/USD goes up, EUR is strengthening
  const proxyPairs: Record<string, { symbol: string; invert: boolean }> = {
    'EUR': { symbol: 'EURUSD%3DX', invert: false },
    'GBP': { symbol: 'GBPUSD%3DX', invert: false },
    'JPY': { symbol: 'USDJPY%3DX', invert: true },  // USD/JPY up = JPY weakening
    'AUD': { symbol: 'AUDUSD%3DX', invert: false },
  }

  const entries = Object.entries(proxyPairs)
  const responses = await Promise.allSettled(
    entries.map(([, { symbol }]) =>
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 300 },
      })
    )
  )

  for (let i = 0; i < entries.length; i++) {
    const [ccy, { invert }] = entries[i]
    const response = responses[i]
    if (response.status !== 'fulfilled' || !response.value.ok) continue
    try {
      const json = await response.value.json()
      const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close
      if (closes && closes.length >= 3) {
        const current = closes[closes.length - 1]
        const prev3 = closes[closes.length - 3] // 3 days ago
        if (current && prev3 && prev3 !== 0) {
          let changePct = +((current - prev3) / prev3 * 100).toFixed(2)
          if (invert) changePct = -changePct // Invert for JPY
          const dir = changePct > 0.1 ? 'up' : changePct < -0.1 ? 'down' : 'flat'
          result[ccy] = { direction: dir as 'up' | 'down' | 'flat', changePct }
        }
      }
    } catch { /* skip */ }
  }

  return result
}

interface MarketQuote {
  current: number
  previousClose: number
  change: number
  changePct: number
  direction: 'up' | 'down' | 'flat'
}

const YAHOO_SYMBOLS: Record<string, string> = {
  us10y: '%5ETNX',
  sp500: '%5EGSPC',
  vix: '%5EVIX',
  gold: 'GC%3DF',
  oil: 'CL%3DF',
  dxy: 'DX-Y.NYB',
}

async function fetchMarketData(): Promise<Record<string, MarketQuote>> {
  const result: Record<string, MarketQuote> = {}

  try {
    const entries = Object.entries(YAHOO_SYMBOLS)
    const responses = await Promise.allSettled(
      entries.map(([, symbol]) =>
        fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 300 },
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
            const displayCurrent = key === 'us10y' ? +(current).toFixed(3) : +(current).toFixed(2)

            result[key] = {
              current: displayCurrent,
              previousClose: key === 'us10y' ? +(previous).toFixed(3) : +(previous).toFixed(2),
              change,
              changePct,
              direction: change > 0.01 ? 'up' : change < -0.01 ? 'down' : 'flat',
            }
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* return empty */ }

  return result
}
