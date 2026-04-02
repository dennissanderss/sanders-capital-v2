// ─── V2.6 Track Record Backfill API ─────────────────────────
// Backfills up to 365 days of historical v2 records using
// HISTORICAL CB rate snapshots + simulated news bonus:
//   - Uses cb_rate_snapshots table for period-correct rates
//   - Regime determination (safe-haven vs high-yield)
//   - Regime alignment check (pair direction must match regime)
//   - Cross-pair contradiction filter
//   - Historical intermarket data for regime confirmation
//   - Non-aligned pairs never "sterk"
//   - Mean Reversion filter — only trade when
//     2-day price action OPPOSES fundamental direction
//   - 2-day holding period
//   - Score threshold ≥3.0 (sterk + matig)
//   - 21 pairs, top 5 selection, max 2 per currency
//   - Magnitude-weighted intermarket alignment
//
// DELETE: Clears all v2 backfill records (newsSimulated = true)
// POST:   Backfills with historical CB snapshots
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

const MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF']

// ─── Scoring Functions ────────────────────────────────────
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

// ─── Simulated news bonus ─────────────────────────────────
function simulatedNewsBonus(date: string, currency: string): number {
  let hash = 0
  const str = `${date}-${currency}`
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.round(((hash % 100) / 100) * 1.6 * 10 - 8) / 10
}

// ─── V2.1: Regime Determination ───────────────────────────
function determineRegime(scores: Record<string, { total: number }>): string {
  const usd = scores['USD']?.total || 0
  const jpy = scores['JPY']?.total || 0
  const highYieldAvg = (['AUD', 'NZD', 'CAD'] as const)
    .reduce((sum, c) => sum + (scores[c]?.total || 0), 0) / 3

  if (jpy > 1 && highYieldAvg < 0) return 'Risk-Off'
  if (highYieldAvg > 1 && jpy < 0) return 'Risk-On'
  if (usd > 2) return 'USD Dominant'
  if (usd < -2) return 'USD Zwak'
  return 'Gemengd'
}

// ─── V2.1: Is pair aligned with regime? ───────────────────
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

// ─── V2.3: Magnitude-weighted intermarket alignment ───────
function getIntermarketAlignment(
  date: string,
  regime: string,
  intermarketHistory: Record<string, { date: string; close: number }[]>
): number {
  const getStrength = (key: string): { dir: 'up' | 'down' | 'flat'; strength: number } => {
    const prices = intermarketHistory[key] || []
    const idx = prices.findIndex(p => p.date === date)
    if (idx <= 0) return { dir: 'flat', strength: 0 }
    const today = prices[idx].close
    const yesterday = prices[idx - 1].close
    if (yesterday === 0) return { dir: 'flat', strength: 0 }
    const changePct = Math.abs((today - yesterday) / yesterday * 100)
    const dir = today > yesterday * 1.001 ? 'up' as const : today < yesterday * 0.999 ? 'down' as const : 'flat' as const
    const s = changePct > 1.0 ? 1.0 : changePct > 0.5 ? 0.75 : changePct > 0.2 ? 0.5 : 0.25
    return { dir, strength: dir === 'flat' ? 0 : s }
  }

  const sp = getStrength('sp500')
  const vix = getStrength('vix')
  const gold = getStrength('gold')
  const yields = getStrength('us10y')

  let score = 0
  let maxScore = 0

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
    // DXY not available in intermarket history but could be added
  } else if (regime === 'USD Zwak') {
    maxScore = 2.5
    if (yields.dir === 'down') score += yields.strength
    if (sp.dir === 'up') score += 0.5
  } else {
    return 50
  }

  if (maxScore === 0) return 50
  return Math.round((score / maxScore) * 100)
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

// ─── POST: Backfill v2.6 track record (with historical CB snapshots) ──
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const days = Math.min(body.days || 365, 365)
    const hasMetadata = await checkMetadataColumn()

    if (!hasMetadata) {
      return NextResponse.json({
        error: 'metadata column not found. Run: ALTER TABLE trade_focus_records ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT \'{}\';',
        version: 'v2',
      }, { status: 400 })
    }

    // 1. Fetch ALL CB rate snapshots (historical monthly data)
    const { data: snapshots, error: snapError } = await supabase
      .from('cb_rate_snapshots')
      .select('snapshot_date, currency, rate, target, bias, bank')
      .order('snapshot_date', { ascending: true })

    // Group snapshots by date for quick lookup
    const snapshotsByDate: Record<string, Record<string, { bank: string; rate: number; target: number | null; bias: string }>> = {}
    for (const s of snapshots || []) {
      const dateKey = s.snapshot_date
      if (!snapshotsByDate[dateKey]) snapshotsByDate[dateKey] = {}
      snapshotsByDate[dateKey][s.currency] = { bank: s.bank, rate: s.rate, target: s.target, bias: s.bias }
    }
    const snapshotDates = Object.keys(snapshotsByDate).sort()

    // Also fetch current rates as fallback
    const { data: cbRates } = await supabase
      .from('central_bank_rates')
      .select('currency, bank, rate, target, bias')

    const currentRatesMap: Record<string, { bank: string; rate: number; target: number | null; bias: string }> = {}
    for (const r of cbRates || []) {
      currentRatesMap[r.currency] = { bank: r.bank, rate: r.rate, target: r.target, bias: r.bias }
    }

    const hasSnapshots = snapshotDates.length > 0

    // Helper: get the CB rates that were in effect for a given date
    // Uses the most recent snapshot on or before that date
    function getRatesForDate(dateStr: string): Record<string, { bank: string; rate: number; target: number | null; bias: string }> {
      if (!hasSnapshots) return currentRatesMap

      // Find the latest snapshot_date <= dateStr
      let bestDate = ''
      for (const sd of snapshotDates) {
        if (sd <= dateStr) bestDate = sd
        else break
      }

      if (bestDate && snapshotsByDate[bestDate]) {
        return snapshotsByDate[bestDate]
      }
      // If date is before all snapshots, use earliest snapshot
      if (snapshotDates.length > 0) {
        return snapshotsByDate[snapshotDates[0]]
      }
      return currentRatesMap
    }

    // 2. Date range
    const today = new Date().toISOString().split('T')[0]
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    // 3. Existing records check
    const { data: existingRecords } = await supabase
      .from('trade_focus_records')
      .select('date, pair')
      .eq('metadata->>source', 'v2')
      .gte('date', startDateStr)

    const existingKeys = new Set(
      (existingRecords || []).map(r => `${r.date}-${r.pair}`)
    )

    // 5. Fetch historical prices for all pairs + intermarket
    const historicalData: Record<string, { date: string; close: number }[]> = {}
    for (const pair of PAIRS) {
      const symbol = PAIR_SYMBOLS[pair]
      if (symbol) {
        historicalData[pair] = await fetchHistoricalPrices(symbol, days)
        await new Promise(r => setTimeout(r, 1500))
      }
    }

    // 5b. V2.1: Fetch historical intermarket data
    const intermarketHistory: Record<string, { date: string; close: number }[]> = {}
    for (const [key, symbol] of Object.entries(INTERMARKET_SYMBOLS)) {
      intermarketHistory[key] = await fetchHistoricalPrices(symbol, days)
      await new Promise(r => setTimeout(r, 1500))
    }

    // 6. Build records with V2.1 FILTERS
    const allRecords: Record<string, unknown>[] = []
    const dates: string[] = []
    for (let d = new Date(startDate); d.toISOString().split('T')[0] < today; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }

    let filteredByRegime = 0
    let filteredByContradiction = 0
    let filteredByIntermarket = 0

    for (const date of dates) {
      // Currency scores for this date using HISTORICAL CB rates
      // V2.6: NO simulated news — pure CB scoring for reliable backfill
      const ratesForDate = getRatesForDate(date)
      const currencyScores: Record<string, { total: number; base: number; newsBonus: number }> = {}
      for (const ccy of MAJORS) {
        const rate = ratesForDate[ccy]
        let base = 0
        if (rate) {
          base += biasScore(rate.bias) * 2
          base += rateTargetScore(rate.rate, rate.target)
        }
        currencyScores[ccy] = { total: base, base, newsBonus: 0 }
      }

      // Determine regime for this date
      let regime = determineRegime(currencyScores)

      // V2.3: Intermarket regime override
      const getPrice = (key: string, d: string) => {
        const prices = intermarketHistory[key] || []
        return prices.find(p => p.date === d)?.close
      }
      const vixPrice = getPrice('vix', date)
      const spDir = (() => {
        const prices = intermarketHistory['sp500'] || []
        const idx = prices.findIndex(p => p.date === date)
        if (idx <= 0) return 'flat'
        const today = prices[idx].close
        const yesterday = prices[idx - 1].close
        return today > yesterday * 1.001 ? 'up' : today < yesterday * 0.999 ? 'down' : 'flat'
      })()

      // v2.5: Regime is PURE CB policy — no intermarket override
      // Intermarket is used only for conviction adjustment (not regime change)

      // Check intermarket alignment for this date (used for conviction only)
      const intermarketAlignment = getIntermarketAlignment(date, regime, intermarketHistory)
      const regimeConfirmed = intermarketAlignment >= 65
      const regimeContradicted = intermarketAlignment <= 35

      // Calculate pair biases
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
          pair, baseCcy, quoteCcy, direction, conviction,
          score: +diff.toFixed(2),
          scoreWithoutNews: +baseOnly.toFixed(2),
          newsInfluence,
        }
      }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score))

      // ─── V2.1 FILTERS ───────────────────────────────────
      for (const pair of pairBiases) {
        const isBullish = pair.direction.includes('bullish')
        const aligned = isAlignedWithRegime(pair.baseCcy, pair.quoteCcy, isBullish, regime)

        // Filter 1: Non-aligned pairs can never be "sterk"
        if (!aligned && regime !== 'Gemengd' && pair.conviction === 'sterk') {
          pair.conviction = 'matig'
          filteredByRegime++
        }

        // Filter 2: Intermarket contradiction downgrades sterk
        if (regimeContradicted && pair.conviction === 'sterk') {
          pair.conviction = 'matig'
          filteredByIntermarket++
        }

        // Filter 3: Intermarket confirmation upgrades aligned matig
        if (regimeConfirmed && pair.conviction === 'matig' && aligned) {
          pair.conviction = 'sterk'
        }
      }

      // Filter 4: Cross-pair contradiction
      const sterkPairs = pairBiases.filter(p => p.conviction === 'sterk')
      for (const pair of sterkPairs) {
        const currencies = pair.pair.split('/')
        const pairImpliesStrong = pair.direction.includes('bullish') ? currencies[0] : currencies[1]
        const contradicts = sterkPairs.some(other => {
          if (other.pair === pair.pair) return false
          const otherCurrencies = other.pair.split('/')
          const otherImpliesWeak = other.direction.includes('bullish') ? otherCurrencies[1] : otherCurrencies[0]
          return pairImpliesStrong === otherImpliesWeak
        })
        if (contradicts) {
          pair.conviction = 'matig'
          filteredByContradiction++
        }
      }

      // V2.6: Score >= 3.0, regime-aligned preferred, diversified
      const candidates = pairBiases
        .filter(p => (p.conviction === 'sterk' || p.conviction === 'matig') && Math.abs(p.score) >= 3.0)

      // Prefer regime-aligned trades, then fill with rest
      const aligned = candidates.filter(p => {
        const isBull = p.direction.includes('bullish')
        return isAlignedWithRegime(p.baseCcy, p.quoteCcy, isBull, regime)
      })
      const nonAligned = candidates.filter(p => !aligned.includes(p))
      const ordered = [...aligned, ...nonAligned]

      // Diversify: max 2 pairs per currency, max 5 total
      const diversified: typeof candidates = []
      const currencyCount: Record<string, number> = {}
      for (const p of ordered) {
        const baseCount = currencyCount[p.baseCcy] || 0
        const quoteCount = currencyCount[p.quoteCcy] || 0
        if (baseCount >= 2 && quoteCount >= 2) continue
        diversified.push(p)
        currencyCount[p.baseCcy] = (currencyCount[p.baseCcy] || 0) + 1
        currencyCount[p.quoteCcy] = (currencyCount[p.quoteCcy] || 0) + 1
        if (diversified.length >= 5) break
      }

      if (diversified.length === 0) continue

      const simulatedConfidence = Math.min(80, 40 + diversified.length * 15)

      for (const p of diversified) {
        const prices = historicalData[p.pair] || []
        const entryIdx = prices.findIndex(px => px.date === date)
        // V2.6: Need 2 days before (momentum) and 2 days after (hold)
        if (entryIdx < 2 || entryIdx >= prices.length - 2) continue

        // V2.6: MEAN REVERSION — 2-day hold
        // Trade when 2-day price action OPPOSES fundamental direction
        // Fundamentals bullish + price falling → BUY the dip
        // Fundamentals bearish + price rising → SELL the rally
        const recentMomentum = prices[entryIdx].close - prices[entryIdx - 2].close
        const isBullishSignal = p.direction.includes('bullish')
        const isBearishSignal = p.direction.includes('bearish')
        const isMeanReversion = (isBullishSignal && recentMomentum < 0) ||
                                (isBearishSignal && recentMomentum > 0)

        if (!isMeanReversion) continue

        const entryPrice = prices[entryIdx].close
        // 2-day holding period
        const exitPrice = prices[entryIdx + 2].close
        const exitDate = prices[entryIdx + 2].date

        const key = `${date}-${p.pair}`
        if (existingKeys.has(key)) continue

        const priceDiff = exitPrice - entryPrice
        const isJpy = p.pair.includes('JPY')
        const pips = Math.round(Math.abs(priceDiff) * (isJpy ? 100 : 10000))

        let result: 'correct' | 'incorrect' = 'incorrect'
        if (p.direction.includes('bullish') && priceDiff > 0) result = 'correct'
        if (p.direction.includes('bearish') && priceDiff < 0) result = 'correct'

        allRecords.push({
          date,
          pair: p.pair,
          direction: p.direction,
          conviction: p.conviction,
          score: p.score,
          entry_price: entryPrice,
          exit_price: exitPrice,
          pips_moved: pips * (result === 'correct' ? 1 : -1),
          regime,
          result,
          resolved_at: new Date().toISOString(),
          metadata: {
            source: 'v2' as const,
            version: 'v2.6',
            scoreWithoutNews: p.scoreWithoutNews,
            newsInfluence: p.newsInfluence,
            confidence: simulatedConfidence,
            intermarketAlignment,
            newsHeadlines: [] as string[],
            callTime: `${date}T07:00:00.000Z`,
            entryTime: `${date}T16:00:00.000Z`,
            exitTime: `${exitDate}T16:00:00.000Z`,
            newsSimulated: true,
            holdingPeriod: 2,
            meanReversion: false,
            preMomentum: 0,
          },
        })
      }
    }

    // 7. Deduplicate
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

    // 8. Stats with pips analysis
    const correctCount = deduped.filter(r => r.result === 'correct').length
    const totalCount = deduped.length
    const totalPips = deduped.reduce((sum, r) => sum + ((r.pips_moved as number) || 0), 0)
    const avgWinPips = correctCount > 0
      ? Math.round(deduped.filter(r => r.result === 'correct').reduce((s, r) => s + ((r.pips_moved as number) || 0), 0) / correctCount)
      : 0
    const avgLossPips = (totalCount - correctCount) > 0
      ? Math.round(deduped.filter(r => r.result === 'incorrect').reduce((s, r) => s + Math.abs((r.pips_moved as number) || 0), 0) / (totalCount - correctCount))
      : 0

    return NextResponse.json({
      version: 'v2.6',
      message: `Backfilled ${deduped.length} v2.6 records over ${days} days`,
      records: deduped.length,
      skippedExisting: existingKeys.size,
      hasHistoricalSnapshots: hasSnapshots,
      snapshotPeriods: snapshotDates.length,
      stats: {
        total: totalCount,
        correct: correctCount,
        incorrect: totalCount - correctCount,
        winRate: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
        totalPips,
        avgWinPips,
        avgLossPips,
        profitFactor: avgLossPips > 0 ? +(avgWinPips / avgLossPips).toFixed(2) : 0,
      },
      filters: {
        filteredByRegimeAlignment: filteredByRegime,
        filteredByIntermarket: filteredByIntermarket,
        filteredByContradiction: filteredByContradiction,
        totalFiltered: filteredByRegime + filteredByIntermarket + filteredByContradiction,
      },
      note: hasSnapshots
        ? `V2.6 backfill met historische CB snapshots (${snapshotDates.length} periodes). Rates veranderen per maand.`
        : 'V2.6 backfill ZONDER historische snapshots — gebruikt huidige rates. Maak eerst snapshots aan.',
    })
  } catch (e) {
    return NextResponse.json({ error: String(e), version: 'v2' }, { status: 500 })
  }
}
