// ─── FX Edge Extraction Engine v3 — Multi-Factor Scoring ─
// Scores each currency on 7 factors with context-dependent
// weights that shift based on the current sub-regime.
// ──────────────────────────────────────────────────────────

import type {
  CBRate, NewsArticle, CalendarEvent, MarketDataPoint,
  PriceHistory, CurrencyFactors, CurrencyScore, SubRegime,
} from './types'
import {
  MAJORS, BIAS_SCORES, COMMODITY_SENSITIVITY, HAVEN_SENSITIVITY,
  REGIME_WEIGHTS, PAIR_SYMBOLS,
} from './constants'

// ─── Factor 1: Central Bank (CB) ─────────────────────────
function scoreCB(rate: CBRate | undefined): number {
  if (!rate) return 0
  const bias = (rate.bias || '').toLowerCase()

  // Match longest phrase first
  let bs = 0
  if (bias.includes('voorzichtig verkrappend')) bs = 1.5
  else if (bias.includes('verkrappend') || bias.includes('hawkish')) bs = 2
  else if (bias.includes('voorzichtig verruimend')) bs = -1
  else if (bias.includes('verruimend') || bias.includes('dovish')) bs = -2
  else if (bias.includes('afwachtend') || bias.includes('neutraal')) bs = 0

  // Rate vs target
  let rts = 0
  if (rate.rate != null && rate.target != null) {
    const diff = rate.rate - rate.target
    if (diff > 0.5) rts = 1
    else if (diff > 0) rts = 0.5
    else if (diff < -0.5) rts = -1
    else if (diff < 0) rts = -0.5
  }

  return bs * 2 + rts  // Max ~5, min ~-5
}

// ─── Factor 2: Inflation ─────────────────────────────────
// Derived from calendar events (CPI, PPI)
function scoreInflation(events: CalendarEvent[], currency: string): number {
  const cpiEvents = events.filter(e =>
    e.country?.toUpperCase() === currency &&
    (e.impact === 'High' || e.impact === 'Medium') &&
    (e.title.toLowerCase().includes('cpi') || e.title.toLowerCase().includes('inflation') || e.title.toLowerCase().includes('price'))
  )
  if (cpiEvents.length === 0) return 0

  let score = 0
  for (const ev of cpiEvents) {
    if (ev.forecast && ev.previous) {
      const f = parseFloat(ev.forecast.replace('%', ''))
      const p = parseFloat(ev.previous.replace('%', ''))
      if (!isNaN(f) && !isNaN(p)) {
        if (f > p) score += 1   // Rising inflation = hawkish pressure
        else if (f < p) score -= 1
      }
    }
  }
  return Math.max(-2, Math.min(2, score))
}

// ─── Factor 3: Growth ────────────────────────────────────
// Derived from calendar events (GDP, PMI, employment)
function scoreGrowth(events: CalendarEvent[], currency: string): number {
  const growthKeywords = ['gdp', 'pmi', 'employment', 'payroll', 'job', 'labor', 'retail', 'manufacturing']
  const growthEvents = events.filter(e =>
    e.country?.toUpperCase() === currency &&
    (e.impact === 'High' || e.impact === 'Medium') &&
    growthKeywords.some(kw => e.title.toLowerCase().includes(kw))
  )
  if (growthEvents.length === 0) return 0

  let score = 0
  for (const ev of growthEvents) {
    if (ev.forecast && ev.previous) {
      const f = parseFloat(ev.forecast.replace(/[%kK]/g, ''))
      const p = parseFloat(ev.previous.replace(/[%kK]/g, ''))
      if (!isNaN(f) && !isNaN(p)) {
        if (f > p) score += 0.8  // Better than last = positive
        else if (f < p) score -= 0.8
      }
    }
  }
  return Math.max(-2, Math.min(2, score))
}

// ─── Factor 4: Sentiment ─────────────────────────────────
// News sentiment analysis (improved from v2)
function scoreSentiment(articles: NewsArticle[], currency: string): number {
  const negations = ['no ', 'not ', 'without ', 'failed to ', 'unlikely ', 'ruled out ']

  const bullishPhrases = [
    'rate hike', 'rate increase', 'higher than expected', 'beat expectations',
    'exceeded expectations', 'stronger than expected', 'hawkish surprise',
    'hawkish hold', 'tightening cycle', 'above consensus',
  ]
  const bearishPhrases = [
    'rate cut', 'rate decrease', 'lower than expected', 'missed expectations',
    'weaker than expected', 'dovish surprise', 'dovish pivot',
    'easing cycle', 'below consensus', 'hard landing',
  ]
  const bullishWords = ['hawkish', 'tightening', 'robust', 'surge', 'rally', 'booming', 'outperform', 'strong', 'growth']
  const bearishWords = ['dovish', 'easing', 'recession', 'slowdown', 'crisis', 'plunge', 'crash', 'tariff', 'weak']

  let totalScore = 0
  let count = 0

  for (const article of articles) {
    if (!(article.affected_currencies || []).includes(currency)) continue
    const text = `${article.title} ${article.summary}`.toLowerCase()
    let bull = 0, bear = 0

    for (const phrase of bullishPhrases) {
      if (text.includes(phrase)) {
        const negated = negations.some(n => text.includes(n + phrase))
        if (negated) bear += 1.5; else bull += 1.5
      }
    }
    for (const phrase of bearishPhrases) {
      if (text.includes(phrase)) {
        const negated = negations.some(n => text.includes(n + phrase))
        if (negated) bull += 1.5; else bear += 1.5
      }
    }
    for (const w of bullishWords) { if (text.includes(w)) bull += 0.5 }
    for (const w of bearishWords) { if (text.includes(w)) bear += 0.5 }

    if (bull === 0 && bear === 0) continue

    const weight = Math.min(article.relevance_score / 5, 1.5)
    const hoursAgo = (Date.now() - new Date(article.published_at).getTime()) / 3600000
    const recency = hoursAgo < 12 ? 1.5 : hoursAgo < 24 ? 1.2 : hoursAgo < 48 ? 1.0 : 0.7

    totalScore += (bull - bear) * weight * recency * 0.25
    count++
  }

  return Math.max(-2, Math.min(2, Math.round(totalScore * 10) / 10))
}

// ─── Factor 5: Commodity ─────────────────────────────────
function scoreCommodity(marketData: Record<string, MarketDataPoint>, currency: string): number {
  const sensitivity = COMMODITY_SENSITIVITY[currency as keyof typeof COMMODITY_SENSITIVITY] ?? 0
  if (Math.abs(sensitivity) < 0.1) return 0

  const oil = marketData.oil?.changePct ?? 0
  const gold = marketData.gold?.changePct ?? 0

  // Weighted average of commodity moves
  const commodityMove = (oil * 0.6 + gold * 0.4)
  return Math.max(-2, Math.min(2, Math.round(commodityMove * sensitivity * 10) / 10))
}

// ─── Factor 6: Haven ─────────────────────────────────────
function scoreHaven(marketData: Record<string, MarketDataPoint>, currency: string): number {
  const sensitivity = HAVEN_SENSITIVITY[currency as keyof typeof HAVEN_SENSITIVITY] ?? 0
  if (Math.abs(sensitivity) < 0.1) return 0

  const vix = marketData.vix?.current ?? 18
  const spPct = marketData.sp500?.changePct ?? 0

  // Risk-off signal strength
  let riskOffSignal = 0
  if (vix > 25) riskOffSignal += 1.0
  else if (vix > 20) riskOffSignal += 0.5
  if (spPct < -1) riskOffSignal += 1.0
  else if (spPct < -0.3) riskOffSignal += 0.5

  // Negative signal = risk-on
  if (vix < 15) riskOffSignal -= 0.5
  if (spPct > 1) riskOffSignal -= 1.0
  else if (spPct > 0.3) riskOffSignal -= 0.5

  return Math.max(-2, Math.min(2, Math.round(riskOffSignal * sensitivity * 10) / 10))
}

// ─── Factor 7: Price Momentum ────────────────────────────
// How the currency index has been moving (approximated from USD pairs)
function scoreMomentum(
  priceHistory: Record<string, PriceHistory[]>,
  currency: string
): number {
  // Use the main USD pair as proxy for currency strength
  const usdPair = currency === 'USD' ? null :
    PAIR_SYMBOLS[`${currency}/USD`] || PAIR_SYMBOLS[`USD/${currency}`]

  if (!usdPair) {
    // For USD, check DXY direction
    const dxyHistory = priceHistory['DX-Y.NYB'] || []
    if (dxyHistory.length < 3) return 0
    const recent = dxyHistory.slice(-3)
    const pctChange = (recent[recent.length - 1].close - recent[0].close) / recent[0].close * 100
    return Math.max(-2, Math.min(2, Math.round(pctChange * 5) / 10))
  }

  const history = priceHistory[usdPair] || []
  if (history.length < 3) return 0

  const recent = history.slice(-3)
  const pctChange = (recent[recent.length - 1].close - recent[0].close) / recent[0].close * 100

  // If pair is CCY/USD, positive move = CCY strength
  // If pair is USD/CCY, positive move = CCY weakness
  const isBaseUSD = usdPair.startsWith('USD')
  const momentum = isBaseUSD ? -pctChange : pctChange

  return Math.max(-2, Math.min(2, Math.round(momentum * 5) / 10))
}

// ─── Main Scoring Function ───────────────────────────────
export function scoreCurrencies(
  cbRates: CBRate[],
  news: NewsArticle[],
  calendar: CalendarEvent[],
  marketData: Record<string, MarketDataPoint>,
  priceHistory: Record<string, PriceHistory[]>,
  subRegime: SubRegime
): CurrencyScore[] {
  const ratesMap: Record<string, CBRate> = {}
  for (const r of cbRates) ratesMap[r.currency] = r

  const weights = REGIME_WEIGHTS[subRegime]
  const scores: CurrencyScore[] = []

  for (const ccy of MAJORS) {
    const factors: CurrencyFactors = {
      cb: scoreCB(ratesMap[ccy]),
      inflation: scoreInflation(calendar, ccy),
      growth: scoreGrowth(calendar, ccy),
      sentiment: scoreSentiment(news, ccy),
      commodity: scoreCommodity(marketData, ccy),
      haven: scoreHaven(marketData, ccy),
      momentum: scoreMomentum(priceHistory, ccy),
    }

    const rawTotal = Object.values(factors).reduce((s, v) => s + v, 0)
    const weightedTotal = (
      factors.cb * weights.cb +
      factors.inflation * weights.inflation +
      factors.growth * weights.growth +
      factors.sentiment * weights.sentiment +
      factors.commodity * weights.commodity +
      factors.haven * weights.haven +
      factors.momentum * weights.momentum
    )

    const reasons: string[] = []
    if (Math.abs(factors.cb) >= 2) reasons.push(`CB beleid ${factors.cb > 0 ? 'hawkish' : 'dovish'} (${factors.cb.toFixed(1)})`)
    if (Math.abs(factors.sentiment) >= 1) reasons.push(`Sentiment ${factors.sentiment > 0 ? 'positief' : 'negatief'}`)
    if (Math.abs(factors.haven) >= 1) reasons.push(`Haven flow ${factors.haven > 0 ? 'actief' : 'afwezig'}`)
    if (Math.abs(factors.commodity) >= 1) reasons.push(`Commodity ${factors.commodity > 0 ? 'steun' : 'druk'}`)
    if (Math.abs(factors.momentum) >= 1) reasons.push(`Momentum ${factors.momentum > 0 ? 'positief' : 'negatief'}`)

    scores.push({
      currency: ccy,
      factors,
      weights,
      weightedTotal: Math.round(weightedTotal * 100) / 100,
      rawTotal: Math.round(rawTotal * 100) / 100,
      rank: 0,
      reasons,
    })
  }

  // Assign ranks
  scores.sort((a, b) => b.weightedTotal - a.weightedTotal)
  scores.forEach((s, i) => { s.rank = i + 1 })

  return scores
}

// Simplified scoring for backfill (CB rates only, no news/calendar)
export function scoreCurrenciesFromRates(
  cbRates: CBRate[],
  subRegime: SubRegime
): CurrencyScore[] {
  const ratesMap: Record<string, CBRate> = {}
  for (const r of cbRates) ratesMap[r.currency] = r

  const weights = REGIME_WEIGHTS[subRegime]
  const scores: CurrencyScore[] = []

  for (const ccy of MAJORS) {
    const cbScore = scoreCB(ratesMap[ccy])
    const factors: CurrencyFactors = {
      cb: cbScore,
      inflation: 0,
      growth: 0,
      sentiment: 0,
      commodity: 0,
      haven: 0,
      momentum: 0,
    }

    const weightedTotal = cbScore * weights.cb

    scores.push({
      currency: ccy,
      factors,
      weights,
      weightedTotal: Math.round(weightedTotal * 100) / 100,
      rawTotal: cbScore,
      rank: 0,
      reasons: cbScore !== 0 ? [`CB: ${cbScore > 0 ? 'hawkish' : 'dovish'} (${cbScore.toFixed(1)})`] : [],
    })
  }

  scores.sort((a, b) => b.weightedTotal - a.weightedTotal)
  scores.forEach((s, i) => { s.rank = i + 1 })
  return scores
}
