// ─── Comprehensive Backfill Optimizer v2 ─────────────────────
// Tests 100+ configurations across multiple dimensions:
//   - Contrarian signal (fade when fundamentals + momentum agree)
//   - Score bands (3.0-3.5, 3.5-4.0, 4.0-5.0, 5.0+)
//   - Pair groups (Majors, Crosses, JPY crosses)
//   - Regime-specific (Risk-Off only, Risk-On only, clear only)
//   - Momentum lookback (1d, 2d, 3d, 5d)
//   - Min pip threshold for mean reversion dip
//   - Hold periods (1d, 2d, 3d)
//   - Combination configs mixing the best of each
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

const ALL_PAIRS = Object.keys(PAIR_SYMBOLS)
const MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF']

const MAJOR_USD_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD', 'USD/CAD', 'USD/CHF']
const CROSS_PAIRS = ALL_PAIRS.filter(p => !MAJOR_USD_PAIRS.includes(p))
const JPY_CROSSES = ALL_PAIRS.filter(p => p.includes('JPY') && !MAJOR_USD_PAIRS.includes(p))

type PairGroup = 'all' | 'majors' | 'crosses' | 'jpy-crosses'
const PAIR_GROUPS: Record<PairGroup, string[]> = {
  'all': ALL_PAIRS,
  'majors': MAJOR_USD_PAIRS,
  'crosses': CROSS_PAIRS,
  'jpy-crosses': JPY_CROSSES,
}

// ─── Scoring helpers ─────────────────────────────────────────

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

// ─── Configuration types ─────────────────────────────────────

type SignalMode = 'normal' | 'contrarian' | 'mean-reversion' | 'contrarian-mr'
type RegimeFilter = 'any' | 'Risk-Off' | 'Risk-On' | 'clear-only' // clear-only = not Gemengd

interface Config {
  name: string
  scoreMin: number
  scoreMax: number           // Infinity = no upper bound
  pairGroup: PairGroup
  regimeFilter: RegimeFilter
  requireRegimeAligned: boolean
  minIntermarketAlignment: number
  onlySterk: boolean
  holdDays: number
  signalMode: SignalMode
  momentumLookback: number   // days for momentum/MR check
  minDipPips: number         // minimum pip move against direction to qualify as "dip"
  maxPerDay: number
}

// ─── Build all configs programmatically ──────────────────────

function buildConfigs(): Config[] {
  const configs: Config[] = []

  const base = (name: string, overrides: Partial<Config>): Config => ({
    name,
    scoreMin: 3.0,
    scoreMax: Infinity,
    pairGroup: 'all',
    regimeFilter: 'any',
    requireRegimeAligned: false,
    minIntermarketAlignment: 0,
    onlySterk: false,
    holdDays: 2,
    signalMode: 'mean-reversion',
    momentumLookback: 2,
    minDipPips: 0,
    maxPerDay: 5,
    ...overrides,
  })

  // ── 1. CONTRARIAN configs (the key new dimension) ──────────
  // When fundamentals + momentum AGREE, trade OPPOSITE direction
  for (const hold of [1, 2, 3]) {
    for (const lookback of [1, 2, 3, 5]) {
      configs.push(base(`CONTRARIAN lb${lookback}d hold${hold}d score≥3.0`, {
        signalMode: 'contrarian', momentumLookback: lookback, holdDays: hold,
      }))
    }
    configs.push(base(`CONTRARIAN lb3d hold${hold}d score≥3.5`, {
      signalMode: 'contrarian', momentumLookback: 3, holdDays: hold, scoreMin: 3.5,
    }))
    configs.push(base(`CONTRARIAN lb3d hold${hold}d score≥4.0`, {
      signalMode: 'contrarian', momentumLookback: 3, holdDays: hold, scoreMin: 4.0,
    }))
  }
  // Contrarian + regime aligned
  configs.push(base('CONTRARIAN lb3d hold2d regime-aligned', {
    signalMode: 'contrarian', momentumLookback: 3, holdDays: 2, requireRegimeAligned: true,
  }))
  configs.push(base('CONTRARIAN lb3d hold2d regime-aligned score≥3.5', {
    signalMode: 'contrarian', momentumLookback: 3, holdDays: 2, requireRegimeAligned: true, scoreMin: 3.5,
  }))
  // Contrarian + pair groups
  for (const pg of ['majors', 'crosses', 'jpy-crosses'] as PairGroup[]) {
    configs.push(base(`CONTRARIAN lb3d hold2d ${pg}`, {
      signalMode: 'contrarian', momentumLookback: 3, holdDays: 2, pairGroup: pg,
    }))
  }
  // Contrarian + regime filters
  for (const rf of ['Risk-Off', 'Risk-On', 'clear-only'] as RegimeFilter[]) {
    configs.push(base(`CONTRARIAN lb3d hold2d ${rf}`, {
      signalMode: 'contrarian', momentumLookback: 3, holdDays: 2, regimeFilter: rf,
    }))
  }
  // Contrarian with min dip
  for (const dip of [20, 30, 50]) {
    configs.push(base(`CONTRARIAN lb3d hold2d minDip${dip}`, {
      signalMode: 'contrarian', momentumLookback: 3, holdDays: 2, minDipPips: dip,
    }))
  }
  // Contrarian MR hybrid: contrarian direction but only enter on dip
  configs.push(base('CONTRARIAN-MR lb3d hold2d score≥3.0', {
    signalMode: 'contrarian-mr', momentumLookback: 3, holdDays: 2,
  }))
  configs.push(base('CONTRARIAN-MR lb3d hold2d score≥3.5', {
    signalMode: 'contrarian-mr', momentumLookback: 3, holdDays: 2, scoreMin: 3.5,
  }))

  // ── 2. Score band configs ──────────────────────────────────
  const bands: [number, number, string][] = [
    [3.0, 3.5, '3.0-3.5'], [3.5, 4.0, '3.5-4.0'],
    [4.0, 5.0, '4.0-5.0'], [5.0, Infinity, '5.0+'],
  ]
  for (const [min, max, label] of bands) {
    for (const hold of [1, 2, 3]) {
      configs.push(base(`Band ${label} MR hold${hold}d`, {
        scoreMin: min, scoreMax: max, holdDays: hold,
      }))
      configs.push(base(`Band ${label} CONTRARIAN hold${hold}d`, {
        scoreMin: min, scoreMax: max, holdDays: hold, signalMode: 'contrarian', momentumLookback: 3,
      }))
    }
  }

  // ── 3. Pair group configs ──────────────────────────────────
  for (const pg of ['majors', 'crosses', 'jpy-crosses'] as PairGroup[]) {
    for (const hold of [1, 2, 3]) {
      configs.push(base(`${pg} MR hold${hold}d score≥3.0`, {
        pairGroup: pg, holdDays: hold,
      }))
      configs.push(base(`${pg} MR hold${hold}d score≥3.5`, {
        pairGroup: pg, holdDays: hold, scoreMin: 3.5,
      }))
    }
  }

  // ── 4. Regime-specific configs ─────────────────────────────
  for (const rf of ['Risk-Off', 'Risk-On', 'clear-only'] as RegimeFilter[]) {
    for (const hold of [1, 2, 3]) {
      configs.push(base(`${rf} MR hold${hold}d score≥3.0`, {
        regimeFilter: rf, holdDays: hold,
      }))
      configs.push(base(`${rf} MR hold${hold}d score≥3.5`, {
        regimeFilter: rf, holdDays: hold, scoreMin: 3.5,
      }))
    }
  }

  // ── 5. Momentum lookback configs ───────────────────────────
  for (const lb of [1, 2, 3, 5]) {
    for (const hold of [1, 2, 3]) {
      configs.push(base(`MR lb${lb}d hold${hold}d score≥3.0`, {
        momentumLookback: lb, holdDays: hold,
      }))
    }
  }

  // ── 6. Min dip pip threshold ───────────────────────────────
  for (const dip of [20, 30, 50]) {
    for (const hold of [1, 2, 3]) {
      configs.push(base(`MR minDip${dip} hold${hold}d score≥3.0`, {
        minDipPips: dip, holdDays: hold,
      }))
    }
  }

  // ── 7. No-filter / normal signal baselines ─────────────────
  for (const hold of [1, 2, 3]) {
    configs.push(base(`Normal (no MR) hold${hold}d score≥3.0`, {
      signalMode: 'normal', holdDays: hold,
    }))
    configs.push(base(`Normal (no MR) hold${hold}d score≥3.5`, {
      signalMode: 'normal', holdDays: hold, scoreMin: 3.5,
    }))
  }

  // ── 8. Combination "best of" configs ───────────────────────
  // Contrarian + high score + regime aligned + intermarket
  configs.push(base('COMBO: CONTR+score≥4+regime+IM≥50 hold2d', {
    signalMode: 'contrarian', momentumLookback: 3, scoreMin: 4.0,
    requireRegimeAligned: true, minIntermarketAlignment: 50, holdDays: 2,
  }))
  configs.push(base('COMBO: CONTR+score≥3.5+regime+IM≥50 hold2d', {
    signalMode: 'contrarian', momentumLookback: 3, scoreMin: 3.5,
    requireRegimeAligned: true, minIntermarketAlignment: 50, holdDays: 2,
  }))
  configs.push(base('COMBO: CONTR+score≥3.5+regime hold1d', {
    signalMode: 'contrarian', momentumLookback: 3, scoreMin: 3.5,
    requireRegimeAligned: true, holdDays: 1,
  }))
  configs.push(base('COMBO: CONTR+score≥3.5+regime hold3d', {
    signalMode: 'contrarian', momentumLookback: 3, scoreMin: 3.5,
    requireRegimeAligned: true, holdDays: 3,
  }))
  // Contrarian + majors only + dip filter
  configs.push(base('COMBO: CONTR+majors+minDip30 hold2d', {
    signalMode: 'contrarian', momentumLookback: 3, pairGroup: 'majors', minDipPips: 30, holdDays: 2,
  }))
  configs.push(base('COMBO: CONTR+majors+score≥3.5 hold2d', {
    signalMode: 'contrarian', momentumLookback: 3, pairGroup: 'majors', scoreMin: 3.5, holdDays: 2,
  }))
  // Risk-Off + JPY crosses contrarian
  configs.push(base('COMBO: CONTR+jpy-crosses+Risk-Off hold2d', {
    signalMode: 'contrarian', momentumLookback: 3, pairGroup: 'jpy-crosses', regimeFilter: 'Risk-Off', holdDays: 2,
  }))
  // MR combos with best filters
  configs.push(base('COMBO: MR+lb1d+score≥3.5+regime hold1d', {
    momentumLookback: 1, scoreMin: 3.5, requireRegimeAligned: true, holdDays: 1,
  }))
  configs.push(base('COMBO: MR+lb5d+minDip30+score≥3.5 hold2d', {
    momentumLookback: 5, minDipPips: 30, scoreMin: 3.5, holdDays: 2,
  }))
  configs.push(base('COMBO: MR+majors+regime+IM≥50 hold2d', {
    pairGroup: 'majors', requireRegimeAligned: true, minIntermarketAlignment: 50, holdDays: 2,
  }))
  configs.push(base('COMBO: MR+sterk+regime+IM≥65 hold2d', {
    onlySterk: true, scoreMin: 3.5, requireRegimeAligned: true, minIntermarketAlignment: 65, holdDays: 2,
  }))
  // Clear regime only combos
  configs.push(base('COMBO: CONTR+clear-only+score≥3.5 hold2d', {
    signalMode: 'contrarian', momentumLookback: 3, regimeFilter: 'clear-only', scoreMin: 3.5, holdDays: 2,
  }))
  configs.push(base('COMBO: MR+clear-only+score≥3.5+regime hold2d', {
    regimeFilter: 'clear-only', scoreMin: 3.5, requireRegimeAligned: true, holdDays: 2,
  }))

  // Deduplicate by name
  const seen = new Set<string>()
  return configs.filter(c => {
    if (seen.has(c.name)) return false
    seen.add(c.name)
    return true
  })
}

// ─── Main route handler ──────────────────────────────────────

export async function GET() {
  try {
    const days = 250

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

    // 2. Fetch historical prices (all pairs + intermarket)
    const historicalData: Record<string, { date: string; close: number }[]> = {}
    for (const pair of ALL_PAIRS) {
      const symbol = PAIR_SYMBOLS[pair]
      historicalData[pair] = await fetchHistoricalPrices(symbol, days)
      await new Promise(r => setTimeout(r, 1500))
    }

    const intermarketHistory: Record<string, { date: string; close: number }[]> = {}
    for (const [key, symbol] of Object.entries(INTERMARKET_SYMBOLS)) {
      intermarketHistory[key] = await fetchHistoricalPrices(symbol, days)
      await new Promise(r => setTimeout(r, 1500))
    }

    // 3. Build date range
    const today = new Date().toISOString().split('T')[0]
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const dates: string[] = []
    for (let d = new Date(startDate); d.toISOString().split('T')[0] < today; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }

    // 4. Pre-calculate daily data (shared across all configs)
    const dailyData: {
      date: string
      regime: string
      intermarketAlignment: number
      pairBiases: {
        pair: string; baseCcy: string; quoteCcy: string
        direction: string; conviction: string; score: number
      }[]
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

      const pairBiases = ALL_PAIRS.map(pair => {
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

    // 5. Build and test all configs
    const CONFIGS = buildConfigs()

    const results = CONFIGS.map(cfg => {
      let correct = 0, incorrect = 0, totalPips = 0
      const allowedPairs = PAIR_GROUPS[cfg.pairGroup]

      for (const day of dailyData) {
        // Regime filter
        if (cfg.regimeFilter === 'Risk-Off' && day.regime !== 'Risk-Off') continue
        if (cfg.regimeFilter === 'Risk-On' && day.regime !== 'Risk-On') continue
        if (cfg.regimeFilter === 'clear-only' && day.regime === 'Gemengd') continue

        // Intermarket filter
        if (cfg.minIntermarketAlignment > 0 && day.intermarketAlignment < cfg.minIntermarketAlignment) continue

        // Filter candidates
        let candidates = day.pairBiases.filter(p => {
          if (!allowedPairs.includes(p.pair)) return false
          const absScore = Math.abs(p.score)
          if (absScore < cfg.scoreMin) return false
          if (absScore >= cfg.scoreMax) return false
          if (p.direction === 'neutraal') return false
          return true
        })

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
          // Need enough history for lookback AND enough forward for hold
          const neededBack = Math.max(cfg.momentumLookback, 2)
          if (entryIdx < neededBack || entryIdx >= prices.length - cfg.holdDays) continue

          const isBull = p.direction.includes('bullish')
          const isBear = p.direction.includes('bearish')
          const isJpy = p.pair.includes('JPY')
          const pipMultiplier = isJpy ? 100 : 10000

          // Calculate momentum over the lookback period
          const momentum = prices[entryIdx].close - prices[entryIdx - cfg.momentumLookback].close
          const momentumPips = Math.abs(momentum) * pipMultiplier

          // Check minimum dip threshold
          if (cfg.minDipPips > 0 && momentumPips < cfg.minDipPips) continue

          // Determine trade direction based on signal mode
          let tradeDirection: 'long' | 'short' | null = null

          if (cfg.signalMode === 'normal') {
            // Normal: trade in fundamental direction, no momentum filter
            tradeDirection = isBull ? 'long' : 'short'

          } else if (cfg.signalMode === 'mean-reversion') {
            // Mean reversion: only enter when price has moved AGAINST the fundamental direction
            const isMR = (isBull && momentum < 0) || (isBear && momentum > 0)
            if (!isMR) continue
            tradeDirection = isBull ? 'long' : 'short'

          } else if (cfg.signalMode === 'contrarian') {
            // CONTRARIAN: when fundamentals + momentum AGREE, trade OPPOSITE
            // If fundamentals say bullish AND price is going up → SHORT (fade the agreement)
            // If fundamentals say bearish AND price is going down → LONG (fade the agreement)
            const momAgreesWithFundamental = (isBull && momentum > 0) || (isBear && momentum < 0)
            if (!momAgreesWithFundamental) continue // only trade when they agree
            // Trade opposite to fundamental direction
            tradeDirection = isBull ? 'short' : 'long'

          } else if (cfg.signalMode === 'contrarian-mr') {
            // Contrarian MR hybrid: direction is contrarian, but wait for a dip in that contrarian direction
            // Step 1: fundamentals + momentum must agree
            const momAgreesWithFundamental = (isBull && momentum > 0) || (isBear && momentum < 0)
            if (!momAgreesWithFundamental) continue
            // Step 2: contrarian direction is opposite to fundamental
            // Step 3: check 1-day momentum for a dip in the contrarian direction
            const shortTermMom = prices[entryIdx].close - prices[entryIdx - 1].close
            // If contrarian direction is short (fade bullish), we want a bounce (shortTermMom > 0) to fade
            // If contrarian direction is long (fade bearish), we want a dip (shortTermMom < 0) to buy
            const contraDip = (isBull && shortTermMom > 0) || (isBear && shortTermMom < 0)
            if (!contraDip) continue
            tradeDirection = isBull ? 'short' : 'long'
          }

          if (!tradeDirection) continue

          const entryPrice = prices[entryIdx].close
          const exitPrice = prices[entryIdx + cfg.holdDays].close
          const priceDiff = exitPrice - entryPrice
          const pips = Math.round(Math.abs(priceDiff) * pipMultiplier)

          const isCorrect =
            (tradeDirection === 'long' && priceDiff > 0) ||
            (tradeDirection === 'short' && priceDiff < 0)

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
        meaningful: total >= 40,
      }
    })

    // Sort by win rate desc, then trades desc
    results.sort((a, b) => b.winRate - a.winRate || b.trades - a.trades)

    // Tag meaningful results
    const meaningful = results.filter(r => r.meaningful)
    const topMeaningful = meaningful.slice(0, 30)

    return NextResponse.json({
      message: `Tested ${CONFIGS.length} configurations over ${days} days`,
      days,
      snapshotPeriods: snapshotDates.length,
      totalConfigs: CONFIGS.length,
      summary: {
        meaningfulConfigs: meaningful.length,
        bestMeaningfulWinRate: topMeaningful[0]?.winRate ?? 0,
        bestMeaningfulConfig: topMeaningful[0]?.config ?? 'N/A',
      },
      top30meaningful: topMeaningful,
      allResults: results,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
