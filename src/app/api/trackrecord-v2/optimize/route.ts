// ─── Backfill Optimizer ──────────────────────────────────────
// Tests multiple parameter combinations to find the highest
// win rate. Does NOT insert records — just calculates stats.
//
// GET /api/trackrecord-v2/optimize
// Returns a ranked list of configurations with their win rates.
// ────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PAIR_SYMBOLS: Record<string, string> = {
  'EUR/USD': 'EURUSD=X', 'GBP/USD': 'GBPUSD=X', 'USD/JPY': 'USDJPY=X',
  'AUD/USD': 'AUDUSD=X', 'NZD/USD': 'NZDUSD=X', 'USD/CAD': 'USDCAD=X',
  'USD/CHF': 'USDCHF=X', 'EUR/GBP': 'EURGBP=X', 'EUR/JPY': 'EURJPY=X',
  'GBP/JPY': 'GBPJPY=X', 'AUD/JPY': 'AUDJPY=X', 'NZD/JPY': 'NZDJPY=X',
  'CAD/JPY': 'CADJPY=X', 'EUR/AUD': 'EURAUD=X', 'GBP/AUD': 'GBPAUD=X',
  'AUD/NZD': 'AUDNZD=X', 'EUR/CHF': 'EURCHF=X', 'GBP/CHF': 'GBPCHF=X',
  'EUR/CAD': 'EURCAD=X', 'GBP/NZD': 'GBPNZD=X', 'AUD/CAD': 'AUDCAD=X',
}

const INTERMARKET_SYMBOLS: Record<string, string> = {
  sp500: '%5EGSPC', vix: '%5EVIX', gold: 'GC%3DF', us10y: '%5ETNX', dxy: 'DX-Y.NYB',
}

const PAIRS = Object.keys(PAIR_SYMBOLS)
const MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF']

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
  if (rate == null || target == null) return 0
  const diff = rate - target
  if (diff > 1) return 1
  if (diff > 0) return 0.5
  if (diff < -1) return -1
  if (diff < 0) return -0.5
  return 0
}

function isAlignedWithRegime(base: string, quote: string, isBullish: boolean, regime: string): boolean {
  const safeHavens = ['JPY', 'CHF']
  const highYield = ['AUD', 'NZD', 'CAD']
  if (regime === 'Risk-Off') {
    if (isBullish && safeHavens.includes(base)) return true
    if (!isBullish && safeHavens.includes(quote)) return true
    if (!isBullish && highYield.includes(base)) return true
    if (isBullish && highYield.includes(quote)) return true
  }
  if (regime === 'Risk-On') {
    if (isBullish && highYield.includes(base)) return true
    if (!isBullish && highYield.includes(quote)) return true
    if (!isBullish && safeHavens.includes(base)) return true
    if (isBullish && safeHavens.includes(quote)) return true
  }
  if (regime === 'USD Dominant') {
    if (isBullish && base === 'USD') return true
    if (!isBullish && quote === 'USD') return true
  }
  if (regime === 'USD Zwak') {
    if (!isBullish && base === 'USD') return true
    if (isBullish && quote === 'USD') return true
  }
  if (regime === 'Gemengd') return true
  return false
}

function determineRegime(scores: Record<string, number>): string {
  const usd = scores['USD'] || 0
  const jpy = scores['JPY'] || 0
  const highYieldAvg = (['AUD', 'NZD', 'CAD'] as const)
    .reduce((sum, c) => sum + (scores[c] || 0), 0) / 3
  if (jpy > 1 && highYieldAvg < 0) return 'Risk-Off'
  if (highYieldAvg > 1 && jpy < 0) return 'Risk-On'
  if (usd > 2) return 'USD Dominant'
  if (usd < -2) return 'USD Zwak'
  return 'Gemengd'
}

function getIntermarketAlignment(
  date: string, regime: string,
  intermarketHistory: Record<string, { date: string; close: number }[]>
): number {
  const getStrength = (key: string) => {
    const prices = intermarketHistory[key] || []
    const idx = prices.findIndex(p => p.date === date)
    if (idx <= 0) return { dir: 'flat' as const, strength: 0 }
    const today = prices[idx].close
    const yesterday = prices[idx - 1].close
    if (yesterday === 0) return { dir: 'flat' as const, strength: 0 }
    const changePct = Math.abs((today - yesterday) / yesterday * 100)
    const dir = today > yesterday * 1.001 ? 'up' as const : today < yesterday * 0.999 ? 'down' as const : 'flat' as const
    const s = changePct > 1.0 ? 1.0 : changePct > 0.5 ? 0.75 : changePct > 0.2 ? 0.5 : 0.25
    return { dir, strength: dir === 'flat' ? 0 : s }
  }
  const sp = getStrength('sp500')
  const vix = getStrength('vix')
  const gold = getStrength('gold')
  const yields = getStrength('us10y')
  let score = 0, maxScore = 0
  if (regime === 'Risk-Off') {
    maxScore = 4
    if (sp.dir === 'down') score += sp.strength
    if (vix.dir === 'up') score += vix.strength
    if (gold.dir === 'up') score += gold.strength
    if (yields.dir === 'up') score += yields.strength
  } else if (regime === 'Risk-On') {
    maxScore = 3
    if (sp.dir === 'up') score += sp.strength
    if (vix.dir === 'down') score += vix.strength
    if (gold.dir === 'down') score += gold.strength
  } else if (regime === 'USD Dominant') {
    maxScore = 2.5
    if (yields.dir === 'up') score += yields.strength
    if (sp.dir !== 'up') score += 0.5
  } else if (regime === 'USD Zwak') {
    maxScore = 2.5
    if (yields.dir === 'down') score += yields.strength
    if (sp.dir === 'up') score += 0.5
  } else return 50
  if (maxScore === 0) return 50
  return Math.round((score / maxScore) * 100)
}

async function fetchHistoricalPrices(symbol: string, days: number) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days <= 95 ? `${days + 5}d` : '1y'}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, next: { revalidate: 0 } }
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
  } catch { return [] }
}

interface Config {
  name: string
  scoreThreshold: number
  requireRegimeAligned: boolean
  minIntermarketAlignment: number
  onlySterk: boolean
  holdDays: number
  meanReversion: boolean
  maxPerDay: number
}

const CONFIGS: Config[] = [
  // Basis variaties
  { name: 'Base: score≥3.0, MR, 2d', scoreThreshold: 3.0, requireRegimeAligned: false, minIntermarketAlignment: 0, onlySterk: false, holdDays: 2, meanReversion: true, maxPerDay: 5 },
  { name: 'Score≥3.5, MR, 2d', scoreThreshold: 3.5, requireRegimeAligned: false, minIntermarketAlignment: 0, onlySterk: false, holdDays: 2, meanReversion: true, maxPerDay: 5 },
  { name: 'Score≥4.0, MR, 2d', scoreThreshold: 4.0, requireRegimeAligned: false, minIntermarketAlignment: 0, onlySterk: false, holdDays: 2, meanReversion: true, maxPerDay: 5 },
  // Regime aligned
  { name: 'Score≥3.0, regime, MR, 2d', scoreThreshold: 3.0, requireRegimeAligned: true, minIntermarketAlignment: 0, onlySterk: false, holdDays: 2, meanReversion: true, maxPerDay: 5 },
  { name: 'Score≥3.5, regime, MR, 2d', scoreThreshold: 3.5, requireRegimeAligned: true, minIntermarketAlignment: 0, onlySterk: false, holdDays: 2, meanReversion: true, maxPerDay: 5 },
  // Intermarket bevestiging
  { name: 'Score≥3.0, IM≥50, MR, 2d', scoreThreshold: 3.0, requireRegimeAligned: false, minIntermarketAlignment: 50, onlySterk: false, holdDays: 2, meanReversion: true, maxPerDay: 5 },
  { name: 'Score≥3.0, IM≥65, MR, 2d', scoreThreshold: 3.0, requireRegimeAligned: false, minIntermarketAlignment: 65, onlySterk: false, holdDays: 2, meanReversion: true, maxPerDay: 5 },
  // Alles samen
  { name: 'Score≥3.0, regime+IM≥50, MR, 2d', scoreThreshold: 3.0, requireRegimeAligned: true, minIntermarketAlignment: 50, onlySterk: false, holdDays: 2, meanReversion: true, maxPerDay: 5 },
  { name: 'Score≥3.5, regime+IM≥50, MR, 2d', scoreThreshold: 3.5, requireRegimeAligned: true, minIntermarketAlignment: 50, onlySterk: false, holdDays: 2, meanReversion: true, maxPerDay: 5 },
  { name: 'Score≥3.0, regime+IM≥65, MR, 2d', scoreThreshold: 3.0, requireRegimeAligned: true, minIntermarketAlignment: 65, onlySterk: false, holdDays: 2, meanReversion: true, maxPerDay: 5 },
  // Alleen sterk
  { name: 'Sterk only, MR, 2d', scoreThreshold: 3.5, requireRegimeAligned: false, minIntermarketAlignment: 0, onlySterk: true, holdDays: 2, meanReversion: true, maxPerDay: 5 },
  { name: 'Sterk only, regime, MR, 2d', scoreThreshold: 3.5, requireRegimeAligned: true, minIntermarketAlignment: 0, onlySterk: true, holdDays: 2, meanReversion: true, maxPerDay: 5 },
  { name: 'Sterk, regime+IM≥50, MR, 2d', scoreThreshold: 3.5, requireRegimeAligned: true, minIntermarketAlignment: 50, onlySterk: true, holdDays: 2, meanReversion: true, maxPerDay: 5 },
  // Zonder MR
  { name: 'Score≥3.0, no MR, 2d', scoreThreshold: 3.0, requireRegimeAligned: false, minIntermarketAlignment: 0, onlySterk: false, holdDays: 2, meanReversion: false, maxPerDay: 5 },
  { name: 'Score≥3.5, regime+IM≥50, no MR, 2d', scoreThreshold: 3.5, requireRegimeAligned: true, minIntermarketAlignment: 50, onlySterk: false, holdDays: 2, meanReversion: false, maxPerDay: 5 },
  // 1-dag hold
  { name: 'Score≥3.0, MR, 1d', scoreThreshold: 3.0, requireRegimeAligned: false, minIntermarketAlignment: 0, onlySterk: false, holdDays: 1, meanReversion: true, maxPerDay: 5 },
  { name: 'Score≥3.0, regime+IM≥50, MR, 1d', scoreThreshold: 3.0, requireRegimeAligned: true, minIntermarketAlignment: 50, onlySterk: false, holdDays: 1, meanReversion: true, maxPerDay: 5 },
  { name: 'Score≥3.5, regime+IM≥65, MR, 1d', scoreThreshold: 3.5, requireRegimeAligned: true, minIntermarketAlignment: 65, onlySterk: false, holdDays: 1, meanReversion: true, maxPerDay: 5 },
  // 3-dag hold
  { name: 'Score≥3.0, regime+IM≥50, MR, 3d', scoreThreshold: 3.0, requireRegimeAligned: true, minIntermarketAlignment: 50, onlySterk: false, holdDays: 3, meanReversion: true, maxPerDay: 5 },
]

export async function GET() {
  try {
    const days = 250 // ~1 year of trading days

    // 1. Fetch CB rate snapshots
    const { data: snapshots } = await supabase
      .from('cb_rate_snapshots')
      .select('snapshot_date, currency, rate, target, bias, bank')
      .order('snapshot_date', { ascending: true })

    const snapshotsByDate: Record<string, Record<string, { rate: number; target: number | null; bias: string }>> = {}
    for (const s of snapshots || []) {
      if (!snapshotsByDate[s.snapshot_date]) snapshotsByDate[s.snapshot_date] = {}
      snapshotsByDate[s.snapshot_date][s.currency] = { rate: s.rate, target: s.target, bias: s.bias }
    }
    const snapshotDates = Object.keys(snapshotsByDate).sort()

    const { data: cbRates } = await supabase.from('central_bank_rates').select('currency, rate, target, bias')
    const currentRatesMap: Record<string, { rate: number; target: number | null; bias: string }> = {}
    for (const r of cbRates || []) currentRatesMap[r.currency] = { rate: r.rate, target: r.target, bias: r.bias }

    function getRatesForDate(dateStr: string) {
      let best = ''
      for (const sd of snapshotDates) { if (sd <= dateStr) best = sd; else break }
      return (best && snapshotsByDate[best]) ? snapshotsByDate[best] : currentRatesMap
    }

    // 2. Fetch historical prices
    const historicalData: Record<string, { date: string; close: number }[]> = {}
    for (const pair of PAIRS) {
      const symbol = PAIR_SYMBOLS[pair]
      historicalData[pair] = await fetchHistoricalPrices(symbol, days)
      await new Promise(r => setTimeout(r, 1500))
    }

    const intermarketHistory: Record<string, { date: string; close: number }[]> = {}
    for (const [key, symbol] of Object.entries(INTERMARKET_SYMBOLS)) {
      intermarketHistory[key] = await fetchHistoricalPrices(symbol, days)
      await new Promise(r => setTimeout(r, 1500))
    }

    // 3. Build dates
    const today = new Date().toISOString().split('T')[0]
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const dates: string[] = []
    for (let d = new Date(startDate); d.toISOString().split('T')[0] < today; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }

    // 4. Pre-calculate daily data (shared across configs)
    const dailyData: {
      date: string
      regime: string
      intermarketAlignment: number
      pairBiases: { pair: string; baseCcy: string; quoteCcy: string; direction: string; conviction: string; score: number }[]
    }[] = []

    for (const date of dates) {
      const rates = getRatesForDate(date)
      const scores: Record<string, number> = {}
      for (const ccy of MAJORS) {
        const r = rates[ccy]
        scores[ccy] = r ? biasScore(r.bias) * 2 + rateTargetScore(r.rate, r.target) : 0
      }

      const regime = determineRegime(scores)
      const intermarketAlignment = getIntermarketAlignment(date, regime, intermarketHistory)

      const pairBiases = PAIRS.map(pair => {
        const [baseCcy, quoteCcy] = pair.split('/')
        const diff = (scores[baseCcy] || 0) - (scores[quoteCcy] || 0)
        let direction: string, conviction: string
        if (diff >= 3.5) { direction = 'bullish'; conviction = 'sterk' }
        else if (diff >= 2) { direction = 'bullish'; conviction = 'matig' }
        else if (diff > 0.5) { direction = 'licht bullish'; conviction = 'laag' }
        else if (diff <= -3.5) { direction = 'bearish'; conviction = 'sterk' }
        else if (diff <= -2) { direction = 'bearish'; conviction = 'matig' }
        else if (diff < -0.5) { direction = 'licht bearish'; conviction = 'laag' }
        else { direction = 'neutraal'; conviction = 'geen' }
        return { pair, baseCcy, quoteCcy, direction, conviction, score: +diff.toFixed(2) }
      }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score))

      dailyData.push({ date, regime, intermarketAlignment, pairBiases })
    }

    // 5. Test each config
    const results = CONFIGS.map(cfg => {
      let correct = 0, incorrect = 0, totalPips = 0

      for (const day of dailyData) {
        if (cfg.minIntermarketAlignment > 0 && day.intermarketAlignment < cfg.minIntermarketAlignment) continue

        let candidates = day.pairBiases.filter(p => Math.abs(p.score) >= cfg.scoreThreshold && p.direction !== 'neutraal')
        if (cfg.onlySterk) candidates = candidates.filter(p => p.conviction === 'sterk')
        if (cfg.requireRegimeAligned) {
          candidates = candidates.filter(p => {
            const isBull = p.direction.includes('bullish')
            return isAlignedWithRegime(p.baseCcy, p.quoteCcy, isBull, day.regime)
          })
        }

        const selected = candidates.slice(0, cfg.maxPerDay)

        for (const p of selected) {
          const prices = historicalData[p.pair] || []
          const entryIdx = prices.findIndex(px => px.date === day.date)
          if (entryIdx < 2 || entryIdx >= prices.length - cfg.holdDays) continue

          if (cfg.meanReversion) {
            const momentum = prices[entryIdx].close - prices[entryIdx - 2].close
            const isBull = p.direction.includes('bullish')
            const isBear = p.direction.includes('bearish')
            const isMR = (isBull && momentum < 0) || (isBear && momentum > 0)
            if (!isMR) continue
          }

          const entryPrice = prices[entryIdx].close
          const exitPrice = prices[entryIdx + cfg.holdDays].close
          const priceDiff = exitPrice - entryPrice
          const isJpy = p.pair.includes('JPY')
          const pips = Math.round(Math.abs(priceDiff) * (isJpy ? 100 : 10000))

          let isCorrect = false
          if (p.direction.includes('bullish') && priceDiff > 0) isCorrect = true
          if (p.direction.includes('bearish') && priceDiff < 0) isCorrect = true

          if (isCorrect) { correct++; totalPips += pips }
          else { incorrect++; totalPips -= pips }
        }
      }

      const total = correct + incorrect
      return {
        config: cfg.name,
        trades: total,
        correct,
        incorrect,
        winRate: total > 0 ? Math.round((correct / total) * 100) : 0,
        totalPips,
        avgPipsPerTrade: total > 0 ? +(totalPips / total).toFixed(1) : 0,
      }
    })

    // Sort by win rate desc, then by trades desc
    results.sort((a, b) => b.winRate - a.winRate || b.trades - a.trades)

    return NextResponse.json({
      message: `Tested ${CONFIGS.length} configurations over ${days} days`,
      days,
      snapshotPeriods: snapshotDates.length,
      results,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
