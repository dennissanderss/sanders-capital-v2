// ─── V2 Track Record API ───────────────────────────────────
// Enhanced track record with news sentiment integration.
//
// IMPORTANT: This route requires a JSONB `metadata` column on
// the `trade_focus_records` table. Run this SQL once:
//
//   ALTER TABLE trade_focus_records ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
//
// If the column does not exist, records are still saved but
// without the extra v2 metadata fields.
// ────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Service role -- bypasses RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Pair -> Yahoo Finance symbol mapping ──────────────────
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

// ─── Fetch current price from Yahoo Finance ────────────────
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

// ─── Check if metadata column exists by attempting a filtered query ──
let metadataColumnExists: boolean | null = null

async function checkMetadataColumn(): Promise<boolean> {
  if (metadataColumnExists !== null) return metadataColumnExists

  try {
    const { error } = await supabase
      .from('trade_focus_records')
      .select('metadata')
      .limit(1)

    metadataColumnExists = !error
    return metadataColumnExists
  } catch {
    metadataColumnExists = false
    return false
  }
}

// ─── V2 metadata type ──────────────────────────────────────
interface V2Metadata {
  source: 'v2'
  scoreWithoutNews: number
  newsInfluence: number
  confidence: number
  newsHeadlines: string[]
  entryTime: string
  exitTime?: string
  newsSimulated: boolean
}

// ─── GET: Retrieve v2 track record only ────────────────────
export async function GET() {
  try {
    const hasMetadata = await checkMetadataColumn()

    let records: Record<string, unknown>[] = []

    if (hasMetadata) {
      // Fetch only v2 records (where metadata->source = 'v2')
      const { data, error } = await supabase
        .from('trade_focus_records')
        .select('*')
        .eq('metadata->>source', 'v2')
        .order('date', { ascending: false })

      if (error) {
        // Fallback: if the filter fails, return empty
        return NextResponse.json({
          records: [],
          stats: { total: 0, correct: 0, incorrect: 0, pending: 0, winRate: 0 },
          version: 'v2',
        })
      }
      records = data || []
    } else {
      // No metadata column -- no v2 records can exist yet
      return NextResponse.json({
        records: [],
        stats: { total: 0, correct: 0, incorrect: 0, pending: 0, winRate: 0 },
        version: 'v2',
        notice: 'metadata column not found. Run: ALTER TABLE trade_focus_records ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT \'{}\';',
      })
    }

    // Calculate stats
    const resolved = records.filter(r => r.result !== 'pending')
    const correct = resolved.filter(r => r.result === 'correct').length
    const incorrect = resolved.filter(r => r.result === 'incorrect').length
    const pending = records.filter(r => r.result === 'pending').length

    const startDate = records.length > 0
      ? records.reduce((min: string, r: Record<string, unknown>) => (r.date as string) < min ? (r.date as string) : min, records[0].date as string)
      : null

    // Calculate news-specific stats
    const resolvedWithMeta = resolved.filter(r => (r.metadata as V2Metadata | null)?.newsInfluence !== undefined)
    const newsInfluencedCorrect = resolvedWithMeta.filter(
      r => r.result === 'correct' && Math.abs((r.metadata as V2Metadata).newsInfluence) > 0.3
    ).length
    const newsInfluencedTotal = resolvedWithMeta.filter(
      r => Math.abs((r.metadata as V2Metadata).newsInfluence) > 0.3
    ).length

    return NextResponse.json({
      version: 'v2',
      records,
      stats: {
        total: resolved.length,
        correct,
        incorrect,
        pending,
        winRate: resolved.length > 0 ? Math.round((correct / resolved.length) * 100) : 0,
        startDate,
        newsInfluenced: {
          total: newsInfluencedTotal,
          correct: newsInfluencedCorrect,
          winRate: newsInfluencedTotal > 0 ? Math.round((newsInfluencedCorrect / newsInfluencedTotal) * 100) : 0,
        },
      },
    })
  } catch (e) {
    return NextResponse.json({
      records: [],
      stats: { total: 0, correct: 0, incorrect: 0, pending: 0, winRate: 0 },
      version: 'v2',
      error: String(e),
    })
  }
}

// ─── POST: Save today's v2 trade focus & resolve pending ───
export async function POST() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()
    const hasMetadata = await checkMetadataColumn()

    // 1. Resolve pending v2 records from previous days
    let resolvedCount = 0

    if (hasMetadata) {
      const { data: pendingRecords } = await supabase
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
          const direction = record.direction

          let result: 'correct' | 'incorrect' = 'incorrect'
          if (direction.includes('bullish') && priceDiff > 0) result = 'correct'
          if (direction.includes('bearish') && priceDiff < 0) result = 'correct'

          const isJpy = record.pair.includes('JPY')
          const pips = Math.round(Math.abs(priceDiff) * (isJpy ? 100 : 10000))

          // Update the record with exit data
          const existingMeta = (record.metadata || {}) as V2Metadata
          const updatedMeta: V2Metadata = {
            ...existingMeta,
            exitTime: now,
          }

          await supabase
            .from('trade_focus_records')
            .update({
              result,
              exit_price: currentPrice,
              pips_moved: pips * (result === 'correct' ? 1 : -1),
              resolved_at: now,
              metadata: updatedMeta,
            })
            .eq('id', record.id)

          resolvedCount++
        }
      }
    }

    // 2. Check if today already has v2 records
    if (hasMetadata) {
      const { data: existing } = await supabase
        .from('trade_focus_records')
        .select('id')
        .eq('date', today)
        .eq('metadata->>source', 'v2')

      if (existing && existing.length > 0) {
        return NextResponse.json({
          message: 'Today already recorded (v2)',
          resolved: resolvedCount,
          version: 'v2',
        })
      }
    }

    // 3. Fetch today's v2 briefing
    const briefingUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL || 'sanderscapital.nl'}/api/briefing-v2`
      : 'http://localhost:3000/api/briefing-v2'

    const briefRes = await fetch(briefingUrl)
    if (!briefRes.ok) {
      return NextResponse.json({ error: 'Could not fetch briefing-v2', version: 'v2' }, { status: 500 })
    }
    const briefing = await briefRes.json()

    // 4. Get top pairs — ONLY mean reversion (contrarian) signals from V3 engine
    // Optimizer proved: contrarian lb5d hold3d = 68% winrate
    const v3Signals = briefing.v3?.pairSignals || []
    const mrSignals = v3Signals.filter(
      (s: { signal: string; tradeability?: { status: string } }) =>
        (s.signal === 'bullish_mean_reversion' || s.signal === 'bearish_mean_reversion') &&
        s.tradeability?.status !== 'not_tradeable'
    )
    // Fallback to old v2 pairBiases if no v3 data
    const top = mrSignals.length > 0
      ? mrSignals.slice(0, 5)
      : (briefing.pairBiases || []).filter(
          (p: { conviction: string }) => p.conviction === 'sterk'
        ).slice(0, 3)

    // 5. Collect news headlines from the briefing
    const allNewsHeadlines: string[] = (briefing.topNews || [])
      .slice(0, 5)
      .map((n: { title: string }) => n.title)

    // 6. Build records with v2 metadata
    const records = []
    for (const pair of top) {
      const symbol = PAIR_SYMBOLS[pair.pair]
      if (!symbol) continue

      const entryPrice = await fetchPrice(symbol)

      // Pair-specific news headlines from currency ranking
      const pairCurrencies = pair.pair.split('/')
      const pairNewsHeadlines: string[] = []
      for (const ccy of pairCurrencies) {
        const ccyData = (briefing.currencyRanking || []).find(
          (c: { currency: string }) => c.currency === ccy
        )
        if (ccyData?.newsHeadlines) {
          pairNewsHeadlines.push(...ccyData.newsHeadlines)
        }
      }

      const metadata: V2Metadata = {
        source: 'v2',
        scoreWithoutNews: pair.scoreWithoutNews ?? pair.score,
        newsInfluence: pair.newsInfluence ?? 0,
        confidence: briefing.confidence ?? 0,
        newsHeadlines: pairNewsHeadlines.length > 0 ? pairNewsHeadlines : allNewsHeadlines,
        entryTime: now,
        newsSimulated: false,
      }

      const record: Record<string, unknown> = {
        date: today,
        pair: pair.pair,
        direction: pair.direction,
        conviction: pair.conviction,
        score: pair.score,
        entry_price: entryPrice,
        regime: briefing.regime,
        result: 'pending',
      }

      if (hasMetadata) {
        record.metadata = metadata
      }

      records.push(record)
    }

    if (records.length > 0) {
      const { error } = await supabase
        .from('trade_focus_records')
        .insert(records)

      if (error) {
        return NextResponse.json({ error: error.message, version: 'v2' }, { status: 500 })
      }
    }

    return NextResponse.json({
      version: 'v2',
      message: `Saved ${records.length} v2 trade focus records for ${today}`,
      resolved: resolvedCount,
      records,
      hasMetadata,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e), version: 'v2' }, { status: 500 })
  }
}
