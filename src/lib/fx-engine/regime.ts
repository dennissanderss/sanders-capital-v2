// ─── FX Edge Extraction Engine v3 — Sub-Regime Classifier ─
// Classifies the current market environment into one of 6
// sub-regimes based on intermarket data patterns, not just
// crude Risk-On/Risk-Off.
// ──────────────────────────────────────────────────────────

import type { MarketDataPoint, RegimeResult, SubRegime, MacroRegime, CurrencyScore } from './types'
import { SAFE_HAVENS, HIGH_YIELD } from './constants'

interface IMSnapshot {
  sp500: MarketDataPoint | null
  vix: MarketDataPoint | null
  gold: MarketDataPoint | null
  us10y: MarketDataPoint | null
  oil: MarketDataPoint | null
  dxy: MarketDataPoint | null
}

function getIM(data: Record<string, MarketDataPoint>): IMSnapshot {
  return {
    sp500: data.sp500 || null,
    vix: data.vix || null,
    gold: data.gold || null,
    us10y: data.us10y || null,
    oil: data.oil || null,
    dxy: data.dxy || null,
  }
}

function pct(d: MarketDataPoint | null): number {
  return d?.changePct ?? 0
}

function dir(d: MarketDataPoint | null): 'up' | 'down' | 'flat' {
  return d?.direction ?? 'flat'
}

export function classifyRegime(
  marketData: Record<string, MarketDataPoint>,
  currencyScores: CurrencyScore[]
): RegimeResult {
  const im = getIM(marketData)
  const drivers: string[] = []

  // Build currency score map
  const scoreMap: Record<string, number> = {}
  for (const cs of currencyScores) scoreMap[cs.currency] = cs.weightedTotal

  const jpyScore = scoreMap['JPY'] ?? 0
  const chfScore = scoreMap['CHF'] ?? 0
  const usdScore = scoreMap['USD'] ?? 0
  const highYieldAvg = HIGH_YIELD.reduce((s, c) => s + (scoreMap[c] ?? 0), 0) / HIGH_YIELD.length
  const safeHavenAvg = (jpyScore + chfScore) / 2

  // ─── Sub-regime detection (priority order) ──────────
  let sub: SubRegime = 'range_chop'
  let confidence = 30

  // 1. Geopolitical stress: VIX spike + gold surge + equities down
  const vixHigh = (im.vix?.current ?? 0) > 25 || pct(im.vix) > 5
  const goldUp = pct(im.gold) > 0.5
  const spDown = pct(im.sp500) < -0.5
  if (vixHigh && goldUp && spDown) {
    sub = 'geopolitical_stress'
    confidence = 75
    drivers.push('VIX verhoogd', 'Goud stijgt als veilige haven', 'Aandelen onder druk')
    if (safeHavenAvg > 0) { confidence += 10; drivers.push('Safe-haven valuta\'s sterk') }
  }

  // 2. Growth scare: equities down + yields down + havens bid
  else if (spDown && dir(im.us10y) === 'down' && safeHavenAvg > highYieldAvg) {
    sub = 'growth_scare'
    confidence = 65
    drivers.push('Aandelen en yields dalen samen', 'Vlucht naar veilige havens')
    if (pct(im.sp500) < -1) { confidence += 10; drivers.push('Sterke sell-off in aandelen') }
  }

  // 3. Inflation fear: yields up + gold up + oil up
  else if (dir(im.us10y) === 'up' && (goldUp || pct(im.oil) > 1)) {
    sub = 'inflation_fear'
    confidence = 60
    drivers.push('Yields stijgen', 'Grondstoffen omhoog → inflatiedruk')
    if (pct(im.us10y) > 1) { confidence += 10; drivers.push('Sterke beweging in yields') }
  }

  // 4. Rate repricing: yields moving fast (>1%) without equity crash
  else if (Math.abs(pct(im.us10y)) > 1 && Math.abs(pct(im.sp500)) < 1) {
    sub = 'rate_repricing'
    confidence = 60
    drivers.push(`Yields bewegen snel (${pct(im.us10y) > 0 ? '+' : ''}${pct(im.us10y).toFixed(1)}%)`)
    drivers.push('Markt herprijst rentebeleid')
  }

  // 5. Risk appetite: equities up + VIX down + high-yield strong
  else if (dir(im.sp500) === 'up' && dir(im.vix) !== 'up' && highYieldAvg > safeHavenAvg) {
    sub = 'risk_appetite'
    confidence = 60
    drivers.push('Positief risicosentiment', 'High-yield valuta\'s presteren goed')
    if ((im.vix?.current ?? 20) < 16) { confidence += 10; drivers.push('VIX laag — complacency') }
  }

  // 6. Default: range/chop
  else {
    sub = 'range_chop'
    confidence = 40
    drivers.push('Geen duidelijke marktdriver', 'Gemengde signalen — voorzichtig handelen')
  }

  // ─── Macro regime from fundamentals ─────────────────
  let macro: MacroRegime = 'Gemengd'
  let color = 'gray'

  if (sub === 'geopolitical_stress' || sub === 'growth_scare') {
    macro = 'Risk-Off'
    color = 'red'
  } else if (sub === 'risk_appetite') {
    macro = 'Risk-On'
    color = 'green'
  } else if (usdScore > 2.5) {
    macro = 'USD Dominant'
    color = 'blue'
  } else if (usdScore < -2.5) {
    macro = 'USD Zwak'
    color = 'amber'
  } else if (sub === 'inflation_fear' && dir(im.us10y) === 'up') {
    // Inflation fear with rising yields = often USD positive
    if (usdScore > 0) { macro = 'USD Dominant'; color = 'blue' }
    else { macro = 'Gemengd'; color = 'gray' }
  }

  // Override macro if currency fundamentals are very clear
  if (jpyScore > 1.5 && highYieldAvg < -0.5 && macro === 'Gemengd') {
    macro = 'Risk-Off'
    color = 'red'
    drivers.push('JPY fundamenteel sterk, high-yield zwak')
  }
  if (highYieldAvg > 1.5 && jpyScore < -0.5 && macro === 'Gemengd') {
    macro = 'Risk-On'
    color = 'green'
    drivers.push('High-yield fundamenteel sterk, JPY zwak')
  }

  return { macro, sub, confidence, drivers, color }
}

// Simplified regime for backfill (no live intermarket data)
export function classifyRegimeFromRates(
  currencyScores: CurrencyScore[],
  intermarketSnapshot?: { sp500Pct: number; vixLevel: number; goldPct: number; yieldsPct: number }
): RegimeResult {
  const scoreMap: Record<string, number> = {}
  for (const cs of currencyScores) scoreMap[cs.currency] = cs.weightedTotal

  // If we have intermarket data, build a mock MarketDataPoint set
  if (intermarketSnapshot) {
    const mockData: Record<string, MarketDataPoint> = {
      sp500: {
        current: 0, previousClose: 0,
        change: 0, changePct: intermarketSnapshot.sp500Pct,
        direction: intermarketSnapshot.sp500Pct > 0.1 ? 'up' : intermarketSnapshot.sp500Pct < -0.1 ? 'down' : 'flat',
      },
      vix: {
        current: intermarketSnapshot.vixLevel, previousClose: 0,
        change: 0, changePct: 0,
        direction: intermarketSnapshot.vixLevel > 25 ? 'up' : 'flat',
      },
      gold: {
        current: 0, previousClose: 0,
        change: 0, changePct: intermarketSnapshot.goldPct,
        direction: intermarketSnapshot.goldPct > 0.1 ? 'up' : intermarketSnapshot.goldPct < -0.1 ? 'down' : 'flat',
      },
      us10y: {
        current: 0, previousClose: 0,
        change: 0, changePct: intermarketSnapshot.yieldsPct,
        direction: intermarketSnapshot.yieldsPct > 0.1 ? 'up' : intermarketSnapshot.yieldsPct < -0.1 ? 'down' : 'flat',
      },
    }
    return classifyRegime(mockData, currencyScores)
  }

  // Pure fundamentals fallback
  const jpyScore = scoreMap['JPY'] ?? 0
  const usdScore = scoreMap['USD'] ?? 0
  const highYieldAvg = HIGH_YIELD.reduce((s, c) => s + (scoreMap[c] ?? 0), 0) / HIGH_YIELD.length

  let macro: MacroRegime = 'Gemengd'
  let sub: SubRegime = 'range_chop'
  let color = 'gray'
  const drivers: string[] = []

  if (jpyScore > 1 && highYieldAvg < 0) {
    macro = 'Risk-Off'; sub = 'growth_scare'; color = 'red'
    drivers.push('JPY sterk, high-yield zwak')
  } else if (highYieldAvg > 1 && jpyScore < 0) {
    macro = 'Risk-On'; sub = 'risk_appetite'; color = 'green'
    drivers.push('High-yield sterk, JPY zwak')
  } else if (usdScore > 2) {
    macro = 'USD Dominant'; sub = 'rate_repricing'; color = 'blue'
    drivers.push('USD dominant')
  } else if (usdScore < -2) {
    macro = 'USD Zwak'; sub = 'rate_repricing'; color = 'amber'
    drivers.push('USD zwak')
  } else {
    drivers.push('Gemengd regime')
  }

  return { macro, sub, confidence: 50, drivers, color }
}
