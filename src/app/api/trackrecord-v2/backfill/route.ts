// ─── V3.0 Track Record Backfill API ─────────────────────────
// Backfills up to 365 days using the FX Edge Extraction Engine:
//   - Historical CB rate snapshots for period-correct rates
//   - Sub-regime classification (6 types)
//   - Multi-factor context-weighted scoring
//   - Pair-specific intermarket weights
//   - 5-category signal output (trend, mean-reversion, no-trade)
//   - Tradeability filter (extension, event risk, IM conflict)
//   - 1-day holding period
//
// DELETE: Clears all v2/v3 backfill records
// POST:   Backfills with v3 engine
// ────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { runBackfillPipeline, extractTradeFocus } from '@/lib/fx-engine'
import type { CBRate } from '@/lib/fx-engine'

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
  sp500: '%5EGSPC',
  vix: '%5EVIX',
  gold: 'GC%3DF',
  us10y: '%5ETNX',
  dxy: 'DX-Y.NYB',
}

const PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD',
  'USD/CAD', 'USD/CHF', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
  'AUD/JPY', 'NZD/JPY', 'CAD/JPY', 'EUR/AUD', 'GBP/AUD',
  'AUD/NZD', 'EUR/CHF', 'GBP/CHF', 'EUR/CAD', 'GBP/NZD',
  'AUD/CAD',
]

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

// ─── Check metadata column ────────────────────────────────
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

// ─── DELETE: Clear all v2 backfill records ─────────────────
export async function DELETE() {
  try {
    // Delete all records where metadata.newsSimulated = true (backfill records)
    const { data: records, error: fetchError } = await supabase
      .from('trade_focus_records')
      .select('id, metadata')
      .eq('metadata->>source', 'v2')

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Filter to only simulated (backfill) records
    const backfillIds = (records || [])
      .filter(r => {
        const meta = r.metadata as { newsSimulated?: boolean } | null
        return meta?.newsSimulated === true
      })
      .map(r => r.id)

    if (backfillIds.length === 0) {
      return NextResponse.json({
        message: 'No backfill records found to delete',
        deleted: 0,
      })
    }

    // Delete in batches
    let deleted = 0
    for (let i = 0; i < backfillIds.length; i += 50) {
      const batch = backfillIds.slice(i, i + 50)
      const { error } = await supabase
        .from('trade_focus_records')
        .delete()
        .in('id', batch)
      if (!error) deleted += batch.length
    }

    return NextResponse.json({
      message: `Deleted ${deleted} v2 backfill records`,
      deleted,
      version: 'v2',
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ─── POST: Backfill v3.0 track record (with FX Engine) ──
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const days = Math.min(body.days || 365, 365)
    const hasMetadata = await checkMetadataColumn()

    if (!hasMetadata) {
      return NextResponse.json({
        error: 'metadata column not found. Run: ALTER TABLE trade_focus_records ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT \'{}\';',
      }, { status: 400 })
    }

    // 1. Fetch ALL CB rate snapshots
    const { data: snapshots } = await supabase
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
    const { data: cbRatesData } = await supabase
      .from('central_bank_rates')
      .select('currency, country, bank, rate, target, bias, last_move, next_meeting, flag')

    const currentRatesMap: Record<string, { bank: string; rate: number; target: number | null; bias: string }> = {}
    for (const r of cbRatesData || []) {
      currentRatesMap[r.currency] = { bank: r.bank, rate: r.rate, target: r.target, bias: r.bias }
    }
    const hasSnapshots = snapshotDates.length > 0

    function getRatesForDate(dateStr: string): CBRate[] {
      let ratesMap = currentRatesMap
      if (hasSnapshots) {
        let bestDate = ''
        for (const sd of snapshotDates) {
          if (sd <= dateStr) bestDate = sd; else break
        }
        if (bestDate && snapshotsByDate[bestDate]) ratesMap = snapshotsByDate[bestDate]
        else if (snapshotDates.length > 0) ratesMap = snapshotsByDate[snapshotDates[0]]
      }
      return Object.entries(ratesMap).map(([currency, data]) => ({
        currency, country: '', bank: data.bank, rate: data.rate,
        target: data.target, bias: data.bias, last_move: '', next_meeting: '', flag: '',
      }))
    }

    // 2. Date range
    const today = new Date().toISOString().split('T')[0]
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    // 3. Existing records
    const { data: existingRecords } = await supabase
      .from('trade_focus_records')
      .select('date, pair')
      .eq('metadata->>source', 'v2')
      .gte('date', startDateStr)
    const existingKeys = new Set((existingRecords || []).map(r => `${r.date}-${r.pair}`))

    // 4. Fetch historical prices for all pairs + intermarket
    const priceHistory: Record<string, { date: string; close: number }[]> = {}
    for (const pair of PAIRS) {
      const symbol = PAIR_SYMBOLS[pair]
      if (symbol) {
        priceHistory[symbol] = await fetchHistoricalPrices(symbol, days)
        await new Promise(r => setTimeout(r, 1500))
      }
    }

    const intermarketHistory: Record<string, { date: string; close: number }[]> = {}
    for (const [key, symbol] of Object.entries(INTERMARKET_SYMBOLS)) {
      intermarketHistory[key] = await fetchHistoricalPrices(symbol, days)
      await new Promise(r => setTimeout(r, 1500))
    }

    // 5. Build records using V3 Engine for each date
    const allRecords: Record<string, unknown>[] = []
    const dates: string[] = []
    for (let d = new Date(startDate); d.toISOString().split('T')[0] < today; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }

    const signalCounts = { tradeable: 0, conditional: 0, noTrade: 0, mrSignals: 0, trendSignals: 0 }

    for (const date of dates) {
      // Build IM snapshot for regime classification
      const getIMPct = (key: string): number => {
        const hist = intermarketHistory[key] || []
        const idx = hist.findIndex(p => p.date === date)
        if (idx <= 0) return 0
        const t = hist[idx].close, y = hist[idx - 1].close
        return y !== 0 ? ((t - y) / y) * 100 : 0
      }
      const vixHist = intermarketHistory['vix'] || []
      const vixIdx = vixHist.findIndex(p => p.date === date)
      const vixLevel = vixIdx >= 0 ? vixHist[vixIdx].close : 18

      // Run V3 engine pipeline
      const engineResult = runBackfillPipeline({
        cbRates: getRatesForDate(date),
        priceHistory,
        intermarketHistory,
        date,
        intermarketSnapshot: {
          sp500Pct: getIMPct('sp500'),
          vixLevel,
          goldPct: getIMPct('gold'),
          yieldsPct: getIMPct('us10y'),
        },
      })

      // Extract trade focus (top signals)
      const tradeFocus = extractTradeFocus(engineResult.pairSignals, 5, 2)
      if (tradeFocus.length === 0) continue

      for (const sig of tradeFocus) {
        const symbol = PAIR_SYMBOLS[sig.pair]
        if (!symbol) continue
        const prices = priceHistory[symbol] || []
        const entryIdx = prices.findIndex(px => px.date === date)
        if (entryIdx < 0 || entryIdx >= prices.length - 1) continue

        const key = `${date}-${sig.pair}`
        if (existingKeys.has(key)) continue

        const entryPrice = prices[entryIdx].close
        const exitPrice = prices[entryIdx + 1].close
        const exitDate = prices[entryIdx + 1].date

        const priceDiff = exitPrice - entryPrice
        const isJpy = sig.pair.includes('JPY')
        const pips = Math.round(Math.abs(priceDiff) * (isJpy ? 100 : 10000))

        const isBullish = sig.signal.includes('bullish')
        let result: 'correct' | 'incorrect' = 'incorrect'
        if (isBullish && priceDiff > 0) result = 'correct'
        if (!isBullish && priceDiff < 0) result = 'correct'

        const isMR = sig.signal.includes('mean_reversion')
        if (isMR) signalCounts.mrSignals++; else signalCounts.trendSignals++

        const direction = isBullish ? 'bullish' : 'bearish'
        const conviction = sig.conviction >= 70 ? 'sterk' : sig.conviction >= 40 ? 'matig' : 'laag'
        const tier = sig.conviction >= 60 && sig.tradeability.status === 'tradeable' ? 'tier1' : 'tier2'

        allRecords.push({
          date,
          pair: sig.pair,
          direction,
          conviction,
          score: sig.score,
          entry_price: entryPrice,
          exit_price: exitPrice,
          pips_moved: pips * (result === 'correct' ? 1 : -1),
          regime: engineResult.regime.macro,
          result,
          resolved_at: new Date().toISOString(),
          metadata: {
            source: 'v2' as const,
            version: 'v3.0',
            tier,
            signal: sig.signal,
            subRegime: engineResult.regime.sub,
            regimeConfidence: engineResult.regime.confidence,
            imAlignment: sig.intermarket.alignment,
            tradeability: sig.tradeability.status,
            convictionScore: sig.conviction,
            priceMomentum: sig.priceMomentum,
            reasons: sig.reasons.slice(0, 3),
            callTime: `${date}T07:00:00.000Z`,
            entryTime: `${date}T16:00:00.000Z`,
            exitTime: `${exitDate}T16:00:00.000Z`,
            newsSimulated: true,
            holdingPeriod: 1,
            meanReversion: isMR,
          },
        })
      }
    }

    // 6. Deduplicate
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
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    // 7. Stats
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

    const tier1Records = deduped.filter(r => (r.metadata as { tier?: string })?.tier === 'tier1')
    const tier2Records = deduped.filter(r => (r.metadata as { tier?: string })?.tier === 'tier2')
    const mrRecords = deduped.filter(r => (r.metadata as { meanReversion?: boolean })?.meanReversion === true)
    const trendRecords = deduped.filter(r => (r.metadata as { meanReversion?: boolean })?.meanReversion !== true)

    return NextResponse.json({
      version: 'v3.0',
      message: `Backfilled ${deduped.length} v3.0 records over ${days} days`,
      records: deduped.length,
      skippedExisting: existingKeys.size,
      hasHistoricalSnapshots: hasSnapshots,
      snapshotPeriods: snapshotDates.length,
      stats: calcStats(deduped),
      signalTypes: {
        meanReversion: calcStats(mrRecords),
        trend: calcStats(trendRecords),
      },
      tiers: {
        tier1: calcStats(tier1Records),
        tier2: calcStats(tier2Records),
      },
      note: `V3.0 Edge Extraction Engine met sub-regime classificatie, pair-specifieke intermarket, en 5-categorie signalen. ${hasSnapshots ? `${snapshotDates.length} CB snapshot periodes.` : 'GEEN historische snapshots.'}`,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
