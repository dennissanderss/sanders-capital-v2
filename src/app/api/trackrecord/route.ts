import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Service role — bypasses RLS (lazy init for Vercel build)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Pair → Yahoo Finance symbol mapping ────────────────────
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

// Fetch current price from Yahoo Finance
async function fetchPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      { next: { revalidate: 0 } }
    )
    if (!res.ok) return null
    const json = await res.json()
    const meta = json.chart?.result?.[0]?.meta
    return meta?.regularMarketPrice ?? null
  } catch {
    return null
  }
}

// ─── GET: Retrieve trackrecord ──────────────────────────────
export async function GET() {
  try {
    // Get ALL records (no date limit — build up trackrecord over months/years)
    const { data: records, error } = await getSupabase()
      .from('trade_focus_records')
      .select('*')
      .order('date', { ascending: false })

    if (error) {
      // Table might not exist yet — return empty
      return NextResponse.json({ records: [], stats: { total: 0, correct: 0, incorrect: 0, pending: 0, winRate: 0 } })
    }

    // Calculate stats
    const allRecords = records || []
    const resolved = allRecords.filter(r => r.result !== 'pending')
    const correct = resolved.filter(r => r.result === 'correct').length
    const incorrect = resolved.filter(r => r.result === 'incorrect').length
    const pending = allRecords.filter(r => r.result === 'pending').length

    // Find earliest record date
    const startDate = allRecords.length > 0
      ? allRecords.reduce((min, r) => r.date < min ? r.date : min, allRecords[0].date)
      : null

    return NextResponse.json({
      records: allRecords,
      stats: {
        total: resolved.length,
        correct,
        incorrect,
        pending,
        winRate: resolved.length > 0 ? Math.round((correct / resolved.length) * 100) : 0,
        startDate,
      },
    })
  } catch (e) {
    return NextResponse.json({ records: [], stats: { total: 0, correct: 0, incorrect: 0, pending: 0, winRate: 0 }, error: String(e) })
  }
}

// ─── POST: Save today's trade focus & resolve yesterday's ───
export async function POST() {
  try {
    const today = new Date().toISOString().split('T')[0]

    // 1. First, try to resolve pending records by checking price movement
    const { data: pendingRecords } = await getSupabase()
      .from('trade_focus_records')
      .select('*')
      .eq('result', 'pending')
      .lt('date', today)

    if (pendingRecords && pendingRecords.length > 0) {
      for (const record of pendingRecords) {
        const symbol = PAIR_SYMBOLS[record.pair]
        if (!symbol) continue

        const currentPrice = await fetchPrice(symbol)
        if (currentPrice === null || record.entry_price === null) continue

        const priceDiff = currentPrice - record.entry_price
        const direction = record.direction // 'bullish' or 'bearish'

        let result: 'correct' | 'incorrect' = 'incorrect'
        if (direction.includes('bullish') && priceDiff > 0) result = 'correct'
        if (direction.includes('bearish') && priceDiff < 0) result = 'correct'

        // Calculate pip movement (approximate)
        const isJpy = record.pair.includes('JPY')
        const pips = Math.round(Math.abs(priceDiff) * (isJpy ? 100 : 10000))

        await getSupabase()
          .from('trade_focus_records')
          .update({
            result,
            exit_price: currentPrice,
            pips_moved: pips * (result === 'correct' ? 1 : -1),
            resolved_at: new Date().toISOString(),
          })
          .eq('id', record.id)
      }
    }

    // 2. Now save today's trade focus (fetch from briefing API)
    // Check if today already has records
    const { data: existing } = await getSupabase()
      .from('trade_focus_records')
      .select('id')
      .eq('date', today)

    if (existing && existing.length > 0) {
      return NextResponse.json({ message: 'Today already recorded', resolved: pendingRecords?.length || 0 })
    }

    // Fetch today's briefing to get trade focus
    const briefingUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL || 'sanderscapital.nl'}/api/briefing`
      : 'http://localhost:3000/api/briefing'

    const briefRes = await fetch(briefingUrl)
    if (!briefRes.ok) {
      return NextResponse.json({ error: 'Could not fetch briefing' }, { status: 500 })
    }
    const briefing = await briefRes.json()

    // Get top pairs — only "sterk" conviction for higher accuracy
    const strong = (briefing.pairBiases || []).filter(
      (p: { conviction: string }) => p.conviction === 'sterk'
    )
    const top = strong.slice(0, 3)

    // Fetch entry prices for each pair
    const records = []
    for (const pair of top) {
      const symbol = PAIR_SYMBOLS[pair.pair]
      if (!symbol) continue

      const entryPrice = await fetchPrice(symbol)

      records.push({
        date: today,
        pair: pair.pair,
        direction: pair.direction,
        conviction: pair.conviction,
        score: pair.score,
        entry_price: entryPrice,
        regime: briefing.regime,
        result: 'pending',
      })
    }

    if (records.length > 0) {
      const { error } = await getSupabase()
        .from('trade_focus_records')
        .insert(records)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      message: `Saved ${records.length} trade focus records for ${today}`,
      resolved: pendingRecords?.length || 0,
      records,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
