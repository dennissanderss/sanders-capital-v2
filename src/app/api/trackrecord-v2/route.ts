// ─── V2 Track Record API — Unified System ─────────────────
// Live daily signal generation — same criteria as briefing advice:
//   - Model B scoring: CB_bias × 2 + rate_gap × 1.5 + news_bonus
//   - Contrarian + Intermarket confirmation (IM alignment > 50%)
//   - 21 pairs, score threshold ≥ 2.0
//   - 5-day lookback for contrarian detection
//   - Hold: 1 trading day
//
// GET:  Retrieve all v2 track records + stats
// POST: Generate today's signals & resolve yesterday's pending
// ────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const PAIR_SYMBOLS: Record<string, string> = {
  'EUR/USD': 'EURUSD=X',
  'GBP/USD': 'GBPUSD=X',
  'USD/JPY': 'USDJPY=X',
  'AUD/USD': 'AUDUSD=X',
  'NZD/USD': 'NZDUSD=X',
  'USD/CAD': 'USDCAD=X',
  'USD/CHF': 'USDCHF=X',
  'EUR/GBP': 'EURGBP=X',
  'EUR/JPY': 'EURJPY=X',
  'GBP/JPY': 'GBPJPY=X',
  'AUD/JPY': 'AUDJPY=X',
  'NZD/JPY': 'NZDJPY=X',
  'CAD/JPY': 'CADJPY=X',
  'EUR/AUD': 'EURAUD=X',
  'GBP/AUD': 'GBPAUD=X',
  'AUD/NZD': 'AUDNZD=X',
  'EUR/CHF': 'EURCHF=X',
  'GBP/CHF': 'GBPCHF=X',
  'EUR/CAD': 'EURCAD=X',
  'GBP/NZD': 'GBPNZD=X',
  'AUD/CAD': 'AUDCAD=X',
}

const INTERMARKET_SYMBOLS: Record<string, string> = {
  SP500: '%5EGSPC',
  VIX: '%5EVIX',
  GOLD: 'GC%3DF',
  US10Y: '%5ETNX',
  OIL: 'CL%3DF',
  DXY: 'DX-Y.NYB',
}

const PAIRS = Object.keys(PAIR_SYMBOLS)
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']
const SAFE_HAVENS = ['JPY', 'CHF']
const HIGH_YIELD = ['AUD', 'NZD', 'CAD']

const LOOKBACK_DAYS = 5
const SCORE_THRESHOLD = 2.0

// ─── Optimizer Scoring (identical to backfill) ──────────────

const BIAS_SCORES: Record<string, number> = {
  'hawkish': 2, 'verkrappend': 2,
  'voorzichtig verkrappend': 1.5,
  'afwachtend': 0, 'neutraal': 0, 'neutral': 0,
  'voorzichtig verruimend': -1,
  'dovish': -2, 'verruimend': -2,
}

function calcCBScore(bias: string): number {
  return BIAS_SCORES[(bias || '').toLowerCase()] ?? 0
}

function calcRateScore(rate: number | null, target: number | null): number {
  if (rate == null || target == null) return 0
  const diff = rate - target
  if (diff > 0.5) return 1
  if (diff > 0) return 0.5
  if (diff > -0.5) return -0.5
  return -1
}

function calcNewsBonus(
  articles: { title?: string; summary?: string; affected_currencies?: string[]; published_at?: string; relevance_score?: number }[],
  currency: string,
  signalDate: string,
): number {
  if (!articles || articles.length === 0) return 0

  const bullishPhrases = ['rate hike', 'rate increase', 'higher than expected', 'beat expectations', 'hawkish surprise', 'tightening cycle']
  const bearishPhrases = ['rate cut', 'rate decrease', 'lower than expected', 'missed expectations', 'dovish pivot', 'easing cycle']
  const negations = ['no ', 'not ', 'without ', 'failed to ', 'unlikely ', 'ruled out ']

  let totalSentiment = 0
  const relevant = articles.filter(a =>
    a.affected_currencies?.includes(currency) &&
    a.published_at &&
    new Date(a.published_at) <= new Date(signalDate + 'T23:59:59Z')
  )

  for (const article of relevant.slice(0, 10)) {
    const text = ((article.title || '') + ' ' + (article.summary || '')).toLowerCase()
    const pubDate = new Date(article.published_at!)
    const signalDateTime = new Date(signalDate + 'T16:00:00Z')
    const hoursAgo = (signalDateTime.getTime() - pubDate.getTime()) / 3600000

    if (hoursAgo < 0 || hoursAgo > 72) continue

    const recency = hoursAgo < 12 ? 1.5 : hoursAgo < 24 ? 1.2 : hoursAgo < 48 ? 1.0 : 0.7
    let sentiment = 0

    for (const phrase of bullishPhrases) {
      if (text.includes(phrase)) {
        const hasNeg = negations.some(n => text.includes(n + phrase))
        sentiment += hasNeg ? -1.5 : 1.5
      }
    }
    for (const phrase of bearishPhrases) {
      if (text.includes(phrase)) {
        const hasNeg = negations.some(n => text.includes(n + phrase))
        sentiment += hasNeg ? 1.5 : -1.5
      }
    }

    const relScore = Math.min((article.relevance_score || 3) / 5, 1) * 1.5
    totalSentiment += sentiment * 0.25 * recency * relScore
  }

  return Math.max(-1.5, Math.min(1.5, totalSentiment))
}

function calcCurrencyScores(
  cbRates: { currency: string; rate: number; target: number | null; bias: string }[],
  newsArticles: { title?: string; summary?: string; affected_currencies?: string[]; published_at?: string; relevance_score?: number }[],
  signalDate: string,
) {
  const scores: Record<string, number> = {}
  for (const cur of CURRENCIES) {
    const rate = cbRates.find(r => r.currency === cur)
    if (!rate) { scores[cur] = 0; continue }
    const cbScore = calcCBScore(rate.bias)
    const rateScore = calcRateScore(rate.rate, rate.target)
    const newsBonus = calcNewsBonus(newsArticles, cur, signalDate)
    scores[cur] = cbScore * 2 + rateScore * 1.5 + newsBonus
  }
  return scores
}

function determineRegime(scores: Record<string, number>): string {
  const jpyScore = scores['JPY'] || 0
  const hyAvg = HIGH_YIELD.reduce((s, c) => s + (scores[c] || 0), 0) / HIGH_YIELD.length
  if (jpyScore > 1 && hyAvg < 0) return 'Risk-Off'
  if (hyAvg > 1 && jpyScore < 0) return 'Risk-On'
  if ((scores['USD'] || 0) > 2) return 'USD Dominant'
  if ((scores['USD'] || 0) < -2) return 'USD Zwak'
  return 'Gemengd'
}

// ─── Yahoo Finance helpers ──────────────────────────────────

async function fetchPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        next: { revalidate: 300 },
      }
    )
    if (!res.ok) return null
    const json = await res.json()
    return json.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
  } catch {
    return null
  }
}

async function fetchRecentPrices(symbol: string, days: number): Promise<{ date: string; close: number }[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days + 5}d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        next: { revalidate: 300 },
      }
    )
    if (!res.ok) return []
    const json = await res.json()
    const result = json.chart?.result?.[0]
    if (!result) return []
    const timestamps = result.timestamp || []
    const closes = result.indicators?.quote?.[0]?.close || []
    return timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      close: closes[i],
    })).filter((d: { close: number | null }) => d.close != null)
  } catch {
    return []
  }
}

function getIntermarketAlignment(
  imData: Record<string, { date: string; close: number }[]>,
  date: string,
  regime: string,
): number {
  // Use the latest available data point instead of exact date match,
  // because Yahoo Finance timestamps may not align with today's date
  // (e.g. at 21:00 UTC the candle may still be labeled as previous day)
  const getDayChange = (key: string): number | null => {
    const hist = imData[key] || []
    if (hist.length < 2) return null
    // Try exact date match first, then fall back to most recent data
    let idx = hist.findIndex(p => p.date === date)
    if (idx <= 0) {
      // Use the most recent available data point
      idx = hist.length - 1
      if (idx <= 0) return null
    }
    const prev = hist[idx - 1].close
    return prev !== 0 ? ((hist[idx].close - prev) / prev) * 100 : null
  }

  // Match optimizer: total always increments per indicator
  let aligned = 0, total = 0
  if (regime === 'Risk-Off') {
    const vix = getDayChange('VIX')
    const gold = getDayChange('GOLD')
    const sp = getDayChange('SP500')
    const yields = getDayChange('US10Y')
    if (vix !== null) { total++; if (vix > 0) aligned++ }
    if (gold !== null) { total++; if (gold > 0) aligned++ }
    if (sp !== null) { total++; if (sp < 0) aligned++ }
    if (yields !== null) { total++; if (yields < 0) aligned++ }
  } else if (regime === 'Risk-On') {
    const vix = getDayChange('VIX')
    const sp = getDayChange('SP500')
    const yields = getDayChange('US10Y')
    const oil = getDayChange('OIL')
    if (vix !== null) { total++; if (vix < 0) aligned++ }
    if (sp !== null) { total++; if (sp > 0) aligned++ }
    if (yields !== null) { total++; if (yields > 0) aligned++ }
    if (oil !== null) { total++; if (oil > 0) aligned++ }
  } else if (regime === 'USD Dominant' || regime === 'USD Zwak') {
    const usdUp = regime === 'USD Dominant'
    const dxy = getDayChange('DXY')
    const gold = getDayChange('GOLD')
    if (dxy !== null) { total++; if ((dxy > 0) === usdUp) aligned++ }
    if (gold !== null) { total++; if ((gold < 0) === usdUp) aligned++ }
  } else {
    // "Gemengd" (mixed) regime: use broad market indicators
    // Check VIX stability, DXY trend, and general equity direction
    const vix = getDayChange('VIX')
    const dxy = getDayChange('DXY')
    const sp = getDayChange('SP500')
    const gold = getDayChange('GOLD')
    // In mixed regime, alignment = market is not chaotic
    // Low VIX change + any clear direction in other indicators = aligned
    if (vix !== null) { total++; if (Math.abs(vix) < 5) aligned++ }   // VIX stable
    if (dxy !== null) { total++; if (Math.abs(dxy) < 1) aligned++ }   // DXY not extreme
    if (sp !== null) { total++; if (Math.abs(sp) < 2) aligned++ }     // Equities not crashing/surging
    if (gold !== null) { total++; if (Math.abs(gold) < 2) aligned++ } // Gold not extreme
  }
  return total > 0 ? (aligned / total) * 100 : 50
}

// ─── GET: Retrieve v2 track record ─────────────────────────
export async function GET() {
  try {
    const { data: records, error } = await getSupabase()
      .from('trade_focus_records')
      .select('*')
      .eq('metadata->>source', 'v2')
      .order('date', { ascending: false })

    if (error) {
      return NextResponse.json({
        records: [], stats: { total: 0, correct: 0, incorrect: 0, pending: 0, winRate: 0 },
        version: 'v3.1-optimizer',
      })
    }

    const resolved = (records || []).filter(r => r.result !== 'pending')
    const correct = resolved.filter(r => r.result === 'correct').length
    const pending = (records || []).filter(r => r.result === 'pending').length

    const wins = resolved.filter(r => r.result === 'correct')
    const losses = resolved.filter(r => r.result === 'incorrect')
    const totalPips = resolved.reduce((s, r) => s + (r.pips_moved || 0), 0)
    const avgWin = wins.length > 0 ? Math.round(wins.reduce((s, r) => s + (r.pips_moved || 0), 0) / wins.length) : 0
    const avgLoss = losses.length > 0 ? Math.round(losses.reduce((s, r) => s + Math.abs(r.pips_moved || 0), 0) / losses.length) : 0

    return NextResponse.json({
      version: 'v3.1-optimizer',
      records: records || [],
      stats: {
        total: resolved.length,
        correct,
        incorrect: resolved.length - correct,
        pending,
        winRate: resolved.length > 0 ? Math.round((correct / resolved.length) * 100) : 0,
        totalPips,
        avgWinPips: avgWin,
        avgLossPips: avgLoss,
        profitFactor: avgLoss > 0 ? +(avgWin / avgLoss).toFixed(2) : 0,
      },
    })
  } catch (e) {
    return NextResponse.json({
      records: [], stats: { total: 0, correct: 0, incorrect: 0, pending: 0, winRate: 0 },
      version: 'v3.1-optimizer', error: String(e),
    })
  }
}

// ─── POST: Generate today's signals & resolve pending ───────
export async function POST() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    // 1. Resolve pending records (1d hold = resolve next trading day)
    let resolvedCount = 0
    const { data: pendingRecords } = await getSupabase()
      .from('trade_focus_records')
      .select('id, date, pair, direction, entry_price, metadata')
      .eq('result', 'pending')
      .eq('metadata->>source', 'v2')
      .lt('date', today)
      .limit(50)

    if (pendingRecords && pendingRecords.length > 0) {
      for (const record of pendingRecords) {
        const symbol = PAIR_SYMBOLS[record.pair]
        if (!symbol) continue

        const currentPrice = await fetchPrice(symbol)
        if (currentPrice === null || record.entry_price === null) continue

        const priceDiff = currentPrice - record.entry_price
        const isBullish = (record.direction || '').includes('bullish')
        let result: 'correct' | 'incorrect' = 'incorrect'
        if (isBullish && priceDiff > 0) result = 'correct'
        if (!isBullish && priceDiff < 0) result = 'correct'

        const isJpy = record.pair.includes('JPY')
        const pips = Math.round(Math.abs(priceDiff) * (isJpy ? 100 : 10000))

        await getSupabase()
          .from('trade_focus_records')
          .update({
            result,
            exit_price: currentPrice,
            pips_moved: pips * (result === 'correct' ? 1 : -1),
            resolved_at: now,
            metadata: { ...(record.metadata || {}), exitTime: now },
          })
          .eq('id', record.id)

        resolvedCount++
      }
    }

    // 2. Check if today already has records
    const { data: existing } = await getSupabase()
      .from('trade_focus_records')
      .select('id')
      .eq('date', today)
      .eq('metadata->>source', 'v2')

    if (existing && existing.length > 0) {
      return NextResponse.json({
        version: 'v3.1-optimizer',
        message: 'Today already recorded',
        resolved: resolvedCount,
      })
    }

    // 3. Fetch CB rates
    const { data: cbRatesData } = await getSupabase()
      .from('central_bank_rates')
      .select('currency, bank, rate, target, bias')

    const cbRates = (cbRatesData || []).map(r => ({
      currency: r.currency, rate: r.rate, target: r.target, bias: r.bias,
    }))

    // 4. Fetch recent news (72h window)
    const newsStart = new Date()
    newsStart.setDate(newsStart.getDate() - 3)
    const { data: newsArticles } = await getSupabase()
      .from('news_articles')
      .select('title, summary, affected_currencies, published_at, relevance_score')
      .gte('published_at', newsStart.toISOString())
      .order('published_at', { ascending: false })
      .limit(200)

    // 5. Calculate currency scores & regime
    const scores = calcCurrencyScores(cbRates, newsArticles || [], today)
    const regime = determineRegime(scores)

    // 6. Fetch intermarket data for IM alignment
    const imHistory: Record<string, { date: string; close: number }[]> = {}
    for (const [key, symbol] of Object.entries(INTERMARKET_SYMBOLS)) {
      imHistory[key] = await fetchRecentPrices(symbol, 5)
    }
    const imAlignment = getIntermarketAlignment(imHistory, today, regime)

    // 7. If IM doesn't confirm, no trades today
    if (imAlignment < 50) {
      return NextResponse.json({
        version: 'v3.1-optimizer',
        message: `No trades today: IM alignment ${Math.round(imAlignment)}% (need >=50%)`,
        regime,
        imAlignment: Math.round(imAlignment),
        resolved: resolvedCount,
        records: [],
      })
    }

    // 8. Fetch 10-day price history for contrarian check
    const priceHistory: Record<string, { date: string; close: number }[]> = {}
    for (const [pair, symbol] of Object.entries(PAIR_SYMBOLS)) {
      priceHistory[pair] = await fetchRecentPrices(symbol, LOOKBACK_DAYS + 3)
    }

    // 9. Score pairs & apply contrarian filter
    const newRecords: Record<string, unknown>[] = []
    for (const pair of PAIRS) {
      const [base, quote] = pair.split('/')
      const diff = (scores[base] || 0) - (scores[quote] || 0)
      const absDiff = Math.abs(diff)

      if (absDiff < SCORE_THRESHOLD) continue

      const isBullish = diff > 0
      const direction = isBullish ? 'bullish_mean_reversion' : 'bearish_mean_reversion'

      // 5d contrarian check
      const prices = priceHistory[pair] || []
      if (prices.length < LOOKBACK_DAYS + 1) continue

      const lastIdx = prices.length - 1
      const lookbackIdx = lastIdx - LOOKBACK_DAYS
      if (lookbackIdx < 0) continue

      const momentum5d = prices[lastIdx].close - prices[lookbackIdx].close
      const isContrarian = (isBullish && momentum5d < 0) || (!isBullish && momentum5d > 0)
      if (!isContrarian) continue

      // Get entry price
      const entryPrice = await fetchPrice(PAIR_SYMBOLS[pair])
      if (!entryPrice) continue

      const conviction = absDiff >= 3.5 ? 'sterk' : 'matig'
      const isJpy = pair.includes('JPY')

      newRecords.push({
        date: today,
        pair,
        direction,
        conviction,
        score: Math.round(diff * 100) / 100,
        entry_price: entryPrice,
        regime,
        result: 'pending',
        metadata: {
          source: 'v2',
          version: 'v3.1-optimizer',
          signal: direction,
          imAlignment: Math.round(imAlignment),
          momentum5d: Math.round(momentum5d * (isJpy ? 100 : 10000)),
          callTime: now,
          entryTime: now,
          newsSimulated: false,
          holdingPeriod: 1,
          lookbackDays: LOOKBACK_DAYS,
          meanReversion: true,
        },
      })
    }

    if (newRecords.length > 0) {
      const { error } = await getSupabase().from('trade_focus_records').insert(newRecords)
      if (error) {
        return NextResponse.json({ error: error.message, version: 'v3.1-optimizer' }, { status: 500 })
      }
    }

    return NextResponse.json({
      version: 'v3.1-optimizer',
      formula: 'Model B (CB×2 + rate_gap×1.5 + news) + Contrarian 5d + IM>50% + 1d hold',
      message: `${newRecords.length} signals for ${today}`,
      regime,
      imAlignment: Math.round(imAlignment),
      resolved: resolvedCount,
      records: newRecords,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e), version: 'v3.1-optimizer' }, { status: 500 })
  }
}
