// ─── V2 Track Record Backfill API ──────────────────────────
// Backfills up to 30 days of historical v2 records using
// CB rates + simulated news bonus (since historical news
// sentiment cannot be retroactively fetched).
//
// IMPORTANT: Requires a JSONB `metadata` column. Run this SQL:
//
//   ALTER TABLE trade_focus_records ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
//
// Records created by backfill have metadata.newsSimulated = true
// to distinguish them from live v2 records.
// ────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
}

const PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD',
  'USD/CAD', 'USD/CHF', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
]

const MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF']

// ─── Scoring Functions (same as v1 backfill) ───────────────
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

// ─── Fetch historical daily closes from Yahoo Finance ──────
async function fetchHistoricalPrices(symbol: string, days: number): Promise<{ date: string; close: number }[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days + 5}d`,
      { next: { revalidate: 0 } }
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

// ─── Simulated news bonus ──────────────────────────────────
// Since we cannot get historical news sentiment, we apply a
// small deterministic pseudo-random bonus based on the date
// and currency. This keeps backfilled scores slightly different
// from v1 (as v2 would be in production) while being honest
// about the simulation via newsSimulated = true.
function simulatedNewsBonus(date: string, currency: string): number {
  // Simple hash from date + currency to get a stable pseudo-random value
  let hash = 0
  const str = `${date}-${currency}`
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0 // Convert to 32-bit int
  }
  // Map to range [-0.8, +0.8] -- smaller than live news cap of +-1.5
  // to reflect that simulated data should be more conservative
  return Math.round(((hash % 100) / 100) * 1.6 * 10 - 8) / 10
}

// ─── Check if metadata column exists ───────────────────────
async function checkMetadataColumn(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('trade_focus_records')
      .select('metadata')
      .limit(1)
    return !error
  } catch {
    return false
  }
}

// ─── POST: Backfill v2 track record ────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const days = Math.min(body.days || 14, 30) // max 30 days for v2
    const hasMetadata = await checkMetadataColumn()

    if (!hasMetadata) {
      return NextResponse.json({
        error: 'metadata column not found on trade_focus_records table. Run: ALTER TABLE trade_focus_records ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT \'{}\';',
        version: 'v2',
      }, { status: 400 })
    }

    // 1. Fetch CB rates from database (relatively stable over backfill period)
    const { data: cbRates } = await supabase
      .from('central_bank_rates')
      .select('currency, bank, rate, target, bias')

    const ratesMap: Record<string, { bank: string; rate: number; target: number | null; bias: string }> = {}
    for (const r of cbRates || []) {
      ratesMap[r.currency] = { bank: r.bank, rate: r.rate, target: r.target, bias: r.bias }
    }

    // 2. Calculate base currency scores (CB-based, stable over short period)
    const baseCurrencyScores: Record<string, number> = {}
    for (const ccy of MAJORS) {
      const rate = ratesMap[ccy]
      let score = 0
      if (rate) {
        score += biasScore(rate.bias) * 2
        score += rateTargetScore(rate.rate, rate.target)
      }
      baseCurrencyScores[ccy] = score
    }

    // 3. For each backfill date, calculate pair biases WITH simulated news
    const today = new Date().toISOString().split('T')[0]
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    // 4. Check which dates already have v2 records
    const { data: existingRecords } = await supabase
      .from('trade_focus_records')
      .select('date, pair')
      .eq('metadata->>source', 'v2')
      .gte('date', startDateStr)

    const existingKeys = new Set(
      (existingRecords || []).map(r => `${r.date}-${r.pair}`)
    )

    // 5. Fetch historical prices for all pairs
    const historicalData: Record<string, { date: string; close: number }[]> = {}
    for (const pair of PAIRS) {
      const symbol = PAIR_SYMBOLS[pair]
      if (symbol) {
        historicalData[pair] = await fetchHistoricalPrices(symbol, days)
      }
    }

    // 6. Build records for each past day
    const allRecords: Record<string, unknown>[] = []

    // Generate dates array for the backfill period
    const dates: string[] = []
    for (let d = new Date(startDate); d.toISOString().split('T')[0] < today; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }

    for (const date of dates) {
      // Calculate v2 currency scores for this date (base + simulated news)
      const currencyScores: Record<string, { total: number; base: number; newsBonus: number }> = {}
      for (const ccy of MAJORS) {
        const base = baseCurrencyScores[ccy]
        const newsBonus = simulatedNewsBonus(date, ccy)
        currencyScores[ccy] = {
          total: base + newsBonus,
          base,
          newsBonus,
        }
      }

      // Calculate pair biases for this date
      const pairBiases = PAIRS.map(pair => {
        const [baseCcy, quoteCcy] = pair.split('/')
        const baseTotal = currencyScores[baseCcy]?.total || 0
        const quoteTotal = currencyScores[quoteCcy]?.total || 0
        const diff = baseTotal - quoteTotal

        const baseOnly = (currencyScores[baseCcy]?.base || 0) - (currencyScores[quoteCcy]?.base || 0)
        const newsInfluence = Math.round((diff - baseOnly) * 10) / 10

        let direction: string
        let conviction: string
        if (diff >= 3.5) { direction = 'bullish'; conviction = 'sterk' }
        else if (diff >= 2) { direction = 'bullish'; conviction = 'matig' }
        else if (diff > 0.5) { direction = 'licht bullish'; conviction = 'laag' }
        else if (diff <= -3.5) { direction = 'bearish'; conviction = 'sterk' }
        else if (diff <= -2) { direction = 'bearish'; conviction = 'matig' }
        else if (diff < -0.5) { direction = 'licht bearish'; conviction = 'laag' }
        else { direction = 'neutraal'; conviction = 'geen' }

        return {
          pair, direction, conviction,
          score: +diff.toFixed(2),
          scoreWithoutNews: +baseOnly.toFixed(2),
          newsInfluence,
        }
      }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score))

      // Pick top "sterk" pairs for this date
      const topPairs = pairBiases
        .filter(p => p.conviction === 'sterk')
        .slice(0, 3)

      if (topPairs.length === 0) continue

      // Simulated confidence based on how many strong pairs we have
      const simulatedConfidence = Math.min(80, 40 + topPairs.length * 15)

      for (const p of topPairs) {
        const prices = historicalData[p.pair] || []
        // Find the entry price (close of this date) and exit price (close of next trading day)
        const entryIdx = prices.findIndex(px => px.date === date)
        if (entryIdx < 0 || entryIdx >= prices.length - 1) continue

        const entryPrice = prices[entryIdx].close
        const exitPrice = prices[entryIdx + 1].close
        const exitDate = prices[entryIdx + 1].date

        const key = `${date}-${p.pair}`
        if (existingKeys.has(key)) continue

        const priceDiff = exitPrice - entryPrice
        const isJpy = p.pair.includes('JPY')
        const pips = Math.round(Math.abs(priceDiff) * (isJpy ? 100 : 10000))

        let result: 'correct' | 'incorrect' = 'incorrect'
        if (p.direction.includes('bullish') && priceDiff > 0) result = 'correct'
        if (p.direction.includes('bearish') && priceDiff < 0) result = 'correct'

        const metadata = {
          source: 'v2' as const,
          scoreWithoutNews: p.scoreWithoutNews,
          newsInfluence: p.newsInfluence,
          confidence: simulatedConfidence,
          newsHeadlines: [] as string[], // No historical headlines available
          entryTime: `${date}T16:00:00.000Z`, // Simulated: 4pm UTC entry
          exitTime: `${exitDate}T16:00:00.000Z`, // Simulated: 4pm UTC exit
          newsSimulated: true,
        }

        allRecords.push({
          date,
          pair: p.pair,
          direction: p.direction,
          conviction: p.conviction,
          score: p.score,
          entry_price: entryPrice,
          exit_price: exitPrice,
          pips_moved: pips * (result === 'correct' ? 1 : -1),
          regime: 'Backfill V2',
          result,
          resolved_at: new Date().toISOString(),
          metadata,
        })
      }
    }

    // 7. Deduplicate (same date + pair)
    const insertKeys = new Set<string>()
    const deduped = allRecords.filter(r => {
      const key = `${r.date}-${r.pair}`
      if (insertKeys.has(key)) return false
      insertKeys.add(key)
      return true
    })

    if (deduped.length > 0) {
      const { error } = await supabase
        .from('trade_focus_records')
        .insert(deduped)

      if (error) {
        return NextResponse.json({ error: error.message, version: 'v2' }, { status: 500 })
      }
    }

    // 8. Calculate quick stats on what was backfilled
    const correctCount = deduped.filter(r => r.result === 'correct').length
    const totalCount = deduped.length

    return NextResponse.json({
      version: 'v2',
      message: `Backfilled ${deduped.length} v2 records over ${days} days`,
      records: deduped.length,
      skippedExisting: existingKeys.size,
      stats: {
        total: totalCount,
        correct: correctCount,
        incorrect: totalCount - correctCount,
        winRate: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
      },
      note: 'All backfilled records have metadata.newsSimulated = true since historical news sentiment is not available.',
    })
  } catch (e) {
    return NextResponse.json({ error: String(e), version: 'v2' }, { status: 500 })
  }
}
