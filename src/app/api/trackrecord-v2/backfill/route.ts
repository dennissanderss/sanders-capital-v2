// ─── Track Record Backfill — Unified System ─────────────────
// Model B scoring: CB_bias × 2 + rate_gap × 1.5 + news_bonus
// Contrarian + Intermarket confirmation (IM alignment > 50%)
// 21 pairs, score threshold ≥ 2.0, 5-day lookback, 1-day hold
// Historical CB rate snapshots for period-correct rates
//
// DELETE: Clears all v2 backfill records
// POST:   Backfills with optimizer formula
// ────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// All 21 pairs — unified with briefing system
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

const HOLD_DAYS = 1
const LOOKBACK_DAYS = 5
const SCORE_THRESHOLD = 2.0

// ─── Optimizer Scoring Functions ─────────────────────────────

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

// Model B: CB_bias × 2 + rate_gap × 1.5 + news_bonus
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

function determineRegime(scores: Record<string, number>): string {
  const jpyScore = scores['JPY'] || 0
  const hyAvg = HIGH_YIELD.reduce((s, c) => s + (scores[c] || 0), 0) / HIGH_YIELD.length
  if (jpyScore > 1 && hyAvg < 0) return 'Risk-Off'
  if (hyAvg > 1 && jpyScore < 0) return 'Risk-On'
  if ((scores['USD'] || 0) > 2) return 'USD Dominant'
  if ((scores['USD'] || 0) < -2) return 'USD Zwak'
  return 'Gemengd'
}

function getIntermarketAlignment(
  imHistory: Record<string, { date: string; close: number }[]>,
  date: string,
  regime: string,
): number {
  const getDayChange = (key: string): number | null => {
    const hist = imHistory[key] || []
    const idx = hist.findIndex(p => p.date === date)
    if (idx <= 0) return null
    const prev = hist[idx - 1].close
    return prev !== 0 ? ((hist[idx].close - prev) / prev) * 100 : null
  }

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
  }
  // Gemengd regime: geen IM check, default 50%
  return total > 0 ? (aligned / total) * 100 : 50
}

// ─── Fetch historical daily closes ────────────────────────
async function fetchHistoricalPrices(symbol: string, days: number): Promise<{ date: string; close: number }[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days <= 95 ? `${days + 5}d` : days <= 365 ? '1y' : '2y'}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        next: { revalidate: 0 }
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

// ─── DELETE: Clear all v2 backfill records ─────────────────
export async function DELETE() {
  try {
    const { data: records, error: fetchError } = await getSupabase()
      .from('trade_focus_records')
      .select('id, metadata')
      .eq('metadata->>source', 'v2')

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const backfillIds = (records || [])
      .filter(r => {
        const meta = r.metadata as { newsSimulated?: boolean } | null
        return meta?.newsSimulated === true
      })
      .map(r => r.id)

    if (backfillIds.length === 0) {
      return NextResponse.json({ message: 'No backfill records found', deleted: 0 })
    }

    let deleted = 0
    for (let i = 0; i < backfillIds.length; i += 50) {
      const batch = backfillIds.slice(i, i + 50)
      const { error } = await getSupabase().from('trade_focus_records').delete().in('id', batch)
      if (!error) deleted += batch.length
    }

    return NextResponse.json({ message: `Deleted ${deleted} backfill records`, deleted })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ─── POST: Backfill with optimizer-proven formula ──────────
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const days = Math.min(body.days || 365, 365)

    // Check metadata column
    const { error: metaErr } = await getSupabase().from('trade_focus_records').select('metadata').limit(1)
    if (metaErr) {
      return NextResponse.json({ error: 'metadata column not found' }, { status: 400 })
    }

    // 1. Fetch CB rate snapshots
    const { data: snapshots } = await getSupabase()
      .from('cb_rate_snapshots')
      .select('snapshot_date, currency, rate, target, bias, bank')
      .order('snapshot_date', { ascending: true })

    const snapshotsByDate: Record<string, Record<string, { bank: string; rate: number; target: number | null; bias: string }>> = {}
    for (const s of snapshots || []) {
      if (!snapshotsByDate[s.snapshot_date]) snapshotsByDate[s.snapshot_date] = {}
      snapshotsByDate[s.snapshot_date][s.currency] = { bank: s.bank, rate: s.rate, target: s.target, bias: s.bias }
    }
    const snapshotDates = Object.keys(snapshotsByDate).sort()

    // Current rates fallback
    const { data: cbRatesData } = await getSupabase()
      .from('central_bank_rates')
      .select('currency, bank, rate, target, bias')

    const currentRatesMap: Record<string, { bank: string; rate: number; target: number | null; bias: string }> = {}
    for (const r of cbRatesData || []) {
      currentRatesMap[r.currency] = { bank: r.bank, rate: r.rate, target: r.target, bias: r.bias }
    }

    function getRatesForDate(dateStr: string) {
      let ratesMap = currentRatesMap
      let bestDate = ''
      for (const sd of snapshotDates) {
        if (sd <= dateStr) bestDate = sd; else break
      }
      if (bestDate && snapshotsByDate[bestDate]) ratesMap = snapshotsByDate[bestDate]
      else if (snapshotDates.length > 0) ratesMap = snapshotsByDate[snapshotDates[0]]

      return Object.entries(ratesMap).map(([currency, data]) => ({
        currency, rate: data.rate, target: data.target, bias: data.bias,
      }))
    }

    // 2. Fetch news articles
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const { data: newsArticles } = await getSupabase()
      .from('news_articles')
      .select('title, summary, affected_currencies, published_at, relevance_score')
      .gte('published_at', startDate.toISOString())
      .order('published_at', { ascending: false })
      .limit(2000)

    // 3. Date range
    const today = new Date().toISOString().split('T')[0]
    const startDateStr = startDate.toISOString().split('T')[0]

    // 4. Existing records
    const { data: existingRecords } = await getSupabase()
      .from('trade_focus_records')
      .select('date, pair')
      .eq('metadata->>source', 'v2')
      .gte('date', startDateStr)
    const existingKeys = new Set((existingRecords || []).map(r => `${r.date}-${r.pair}`))

    // 5. Fetch price data
    const priceHistory: Record<string, { date: string; close: number }[]> = {}
    for (const [pair, symbol] of Object.entries(PAIR_SYMBOLS)) {
      priceHistory[pair] = await fetchHistoricalPrices(symbol, days + 10)
      await new Promise(r => setTimeout(r, 1500))
    }

    // 6. Fetch intermarket data
    const intermarketHistory: Record<string, { date: string; close: number }[]> = {}
    for (const [key, symbol] of Object.entries(INTERMARKET_SYMBOLS)) {
      intermarketHistory[key] = await fetchHistoricalPrices(symbol, days + 10)
      await new Promise(r => setTimeout(r, 1500))
    }

    // 7. Build records using optimizer formula
    const allRecords: Record<string, unknown>[] = []
    const dates: string[] = []
    for (let d = new Date(startDate); d.toISOString().split('T')[0] < today; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }

    for (const date of dates) {
      const cbRates = getRatesForDate(date)
      const scores = calcCurrencyScores(cbRates, newsArticles || [], date)
      const regime = determineRegime(scores)
      const imAlignment = getIntermarketAlignment(intermarketHistory, date, regime)

      // Contrarian + IM filter: skip if IM doesn't confirm
      if (imAlignment <= 50) continue

      for (const pair of PAIRS) {
        const [base, quote] = pair.split('/')
        const diff = (scores[base] || 0) - (scores[quote] || 0)
        const absDiff = Math.abs(diff)

        if (absDiff < SCORE_THRESHOLD) continue

        const isBullish = diff > 0
        const direction = isBullish ? 'bullish' : 'bearish'

        // 5d contrarian check
        const prices = priceHistory[pair] || []
        const entryIdx = prices.findIndex(px => px.date === date)
        if (entryIdx < LOOKBACK_DAYS || entryIdx >= prices.length - HOLD_DAYS) continue

        const entryPrice = prices[entryIdx].close
        const lookbackPrice = prices[entryIdx - LOOKBACK_DAYS].close
        const momentum5d = entryPrice - lookbackPrice

        const isContrarian = (isBullish && momentum5d < 0) || (!isBullish && momentum5d > 0)
        if (!isContrarian) continue

        // Evaluate trade (1d hold)
        const exitIdx = entryIdx + HOLD_DAYS
        const exitPrice = prices[exitIdx].close
        const exitDate = prices[exitIdx].date

        const key = `${date}-${pair}`
        if (existingKeys.has(key)) continue

        const priceDiff = exitPrice - entryPrice
        const isJpy = pair.includes('JPY')
        const pips = Math.round(Math.abs(priceDiff) * (isJpy ? 100 : 10000))

        let result: 'correct' | 'incorrect' = 'incorrect'
        if (isBullish && priceDiff > 0) result = 'correct'
        if (!isBullish && priceDiff < 0) result = 'correct'

        const conviction = absDiff >= 3.5 ? 'sterk' : 'matig'

        allRecords.push({
          date,
          pair,
          direction,
          conviction,
          score: Math.round(diff * 100) / 100,
          entry_price: entryPrice,
          exit_price: exitPrice,
          pips_moved: pips * (result === 'correct' ? 1 : -1),
          regime,
          result,
          resolved_at: new Date().toISOString(),
          metadata: {
            source: 'v2' as const,
            version: 'v3.1-optimizer',
            signal: isBullish ? 'bullish_mean_reversion' : 'bearish_mean_reversion',
            imAlignment: Math.round(imAlignment),
            momentum5d: Math.round(momentum5d * (isJpy ? 100 : 10000)),
            callTime: `${date}T07:00:00.000Z`,
            entryTime: `${date}T16:00:00.000Z`,
            exitTime: `${exitDate}T16:00:00.000Z`,
            newsSimulated: true,
            holdingPeriod: HOLD_DAYS,
            lookbackDays: LOOKBACK_DAYS,
            meanReversion: true,
          },
        })
      }
    }

    // 8. Deduplicate
    const insertKeys = new Set<string>()
    const deduped = allRecords.filter(r => {
      const key = `${r.date}-${r.pair}`
      if (insertKeys.has(key)) return false
      insertKeys.add(key)
      return true
    })

    if (deduped.length > 0) {
      const { error } = await getSupabase().from('trade_focus_records').insert(deduped)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    // 9. Stats
    function calcStats(records: Record<string, unknown>[]) {
      const correct = records.filter(r => r.result === 'correct').length
      const total = records.length
      const pips = records.reduce((sum, r) => sum + ((r.pips_moved as number) || 0), 0)
      const wins = records.filter(r => r.result === 'correct')
      const losses = records.filter(r => r.result === 'incorrect')
      const avgWin = wins.length > 0 ? Math.round(wins.reduce((s, r) => s + ((r.pips_moved as number) || 0), 0) / wins.length) : 0
      const avgLoss = losses.length > 0 ? Math.round(losses.reduce((s, r) => s + Math.abs((r.pips_moved as number) || 0), 0) / losses.length) : 0
      return {
        total, correct, incorrect: total - correct,
        winRate: total > 0 ? Math.round((correct / total) * 100) : 0,
        totalPips: pips, avgWinPips: avgWin, avgLossPips: avgLoss,
        profitFactor: avgLoss > 0 ? +(avgWin / avgLoss).toFixed(2) : 0,
      }
    }

    const sterkRecords = deduped.filter(r => r.conviction === 'sterk')
    const matigRecords = deduped.filter(r => r.conviction === 'matig')

    return NextResponse.json({
      version: 'v3.1-optimizer',
      formula: 'Model B (CB×2 + rate_gap×1.5 + news) + Contrarian 5d + IM>50% + 1d hold',
      message: `Backfilled ${deduped.length} records over ${days} days`,
      records: deduped.length,
      skippedExisting: existingKeys.size,
      hasHistoricalSnapshots: snapshotDates.length > 0,
      snapshotPeriods: snapshotDates.length,
      stats: calcStats(deduped),
      tiers: {
        sterk: calcStats(sterkRecords),
        matig: calcStats(matigRecords),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
