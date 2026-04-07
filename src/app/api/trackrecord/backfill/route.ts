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
}

const PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD',
  'USD/CAD', 'USD/CHF', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
]

const MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF']

// Fetch historical daily closes from Yahoo Finance (up to 10 days)
async function fetchHistoricalPrices(symbol: string, days: number): Promise<{ date: string; close: number }[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days + 3}d`,
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

function biasScore(bias: string): number {
  if (!bias) return 0
  const b = bias.toLowerCase()
  if (b.includes('verkrappend') || b.includes('hawkish')) return 2
  if (b.includes('afwachtend')) return 0
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

// POST: Backfill trackrecord for past N days
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const days = Math.min(body.days || 7, 14) // max 14 days

    // 1. Fetch CB rates from database (relatively stable over a week)
    const { data: cbRates } = await getSupabase()
      .from('central_bank_rates')
      .select('currency, bank, rate, target, bias')

    const ratesMap: Record<string, { bank: string; rate: number; target: number | null; bias: string }> = {}
    for (const r of cbRates || []) {
      ratesMap[r.currency] = { bank: r.bank, rate: r.rate, target: r.target, bias: r.bias }
    }

    // 2. Calculate currency scores (CB-based, stable over short period)
    const currencyScores: Record<string, number> = {}
    for (const ccy of MAJORS) {
      const rate = ratesMap[ccy]
      let score = 0
      if (rate) {
        score += biasScore(rate.bias) * 2
        score += rateTargetScore(rate.rate, rate.target)
      }
      currencyScores[ccy] = score
    }

    // 3. Calculate pair biases and get top 3
    const pairBiases = PAIRS.map(pair => {
      const [base, quote] = pair.split('/')
      const diff = (currencyScores[base] || 0) - (currencyScores[quote] || 0)

      let direction: string
      let conviction: string
      if (diff >= 3.5) { direction = 'bullish'; conviction = 'sterk' }
      else if (diff >= 2) { direction = 'bullish'; conviction = 'matig' }
      else if (diff > 0.5) { direction = 'licht bullish'; conviction = 'laag' }
      else if (diff <= -3.5) { direction = 'bearish'; conviction = 'sterk' }
      else if (diff <= -2) { direction = 'bearish'; conviction = 'matig' }
      else if (diff < -0.5) { direction = 'licht bearish'; conviction = 'laag' }
      else { direction = 'neutraal'; conviction = 'geen' }

      return { pair, direction, conviction, score: +diff.toFixed(2) }
    }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score))

    const topPairs = pairBiases
      .filter(p => p.conviction === 'sterk')
      .slice(0, 3)

    if (topPairs.length === 0) {
      return NextResponse.json({ error: 'No strong/moderate pairs found', pairBiases })
    }

    // 4. Fetch historical prices for top pairs
    const historicalData: Record<string, { date: string; close: number }[]> = {}
    for (const p of topPairs) {
      const symbol = PAIR_SYMBOLS[p.pair]
      if (symbol) {
        historicalData[p.pair] = await fetchHistoricalPrices(symbol, days)
      }
    }

    // 5. Check which dates already have records
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const { data: existingRecords } = await getSupabase()
      .from('trade_focus_records')
      .select('date')
      .gte('date', startDate.toISOString().split('T')[0])

    const existingDates = new Set((existingRecords || []).map(r => r.date))

    // 6. Build records for each past day
    const allRecords = []
    const today = new Date().toISOString().split('T')[0]

    for (const p of topPairs) {
      const prices = historicalData[p.pair] || []
      if (prices.length < 2) continue

      for (let i = 0; i < prices.length - 1; i++) {
        const dayData = prices[i]
        const nextDayData = prices[i + 1]

        // Skip today (handled by normal POST), skip existing dates
        if (dayData.date === today) continue
        if (dayData.date < startDate.toISOString().split('T')[0]) continue
        if (existingDates.has(dayData.date)) continue

        const entryPrice = dayData.close
        const exitPrice = nextDayData.close
        const priceDiff = exitPrice - entryPrice
        const isJpy = p.pair.includes('JPY')
        const pips = Math.round(Math.abs(priceDiff) * (isJpy ? 100 : 10000))

        let result: 'correct' | 'incorrect' = 'incorrect'
        if (p.direction.includes('bullish') && priceDiff > 0) result = 'correct'
        if (p.direction.includes('bearish') && priceDiff < 0) result = 'correct'

        allRecords.push({
          date: dayData.date,
          pair: p.pair,
          direction: p.direction,
          conviction: p.conviction,
          score: p.score,
          entry_price: entryPrice,
          exit_price: exitPrice,
          pips_moved: pips * (result === 'correct' ? 1 : -1),
          regime: 'Backfill',
          result,
          resolved_at: new Date().toISOString(),
        })
      }
    }

    // Mark dates we're adding so we don't double-insert for the same date
    const insertDates = new Set<string>()
    const deduped = allRecords.filter(r => {
      const key = `${r.date}-${r.pair}`
      if (insertDates.has(key)) return false
      insertDates.add(key)
      return true
    })

    if (deduped.length > 0) {
      const { error } = await getSupabase()
        .from('trade_focus_records')
        .insert(deduped)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      message: `Backfilled ${deduped.length} records over ${days} days`,
      pairs: topPairs.map(p => `${p.pair} (${p.direction})`),
      records: deduped.length,
      skippedExisting: existingDates.size,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
