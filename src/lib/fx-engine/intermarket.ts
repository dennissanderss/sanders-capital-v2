// ─── FX Edge Extraction Engine v3 — Pair-Specific Intermarket ─
// Instead of one-size-fits-all regime alignment, each pair has
// its own intermarket weight table. USDJPY cares about US10Y,
// USDCAD about oil, AUDUSD about gold, etc.
// ──────────────────────────────────────────────────────────────

import type { MarketDataPoint, IntermarketScore, IntermarketSignal } from './types'
import { PAIR_IM_WEIGHTS, PAIR_IM_DIRECTION } from './constants'

const IM_LABELS: Record<string, string> = {
  sp500: 'S&P 500',
  vix: 'VIX',
  gold: 'Goud',
  us10y: 'US 10Y Yields',
  oil: 'Olie (WTI)',
  dxy: 'DXY',
}

const IM_RELEVANCE: Record<string, Record<string, string>> = {
  us10y: {
    'USD/JPY': 'Hogere yields trekken kapitaal naar USD, weg van JPY',
    'EUR/USD': 'Yield spread VS-EU beïnvloedt EUR/USD',
    default: 'Yield bewegingen beïnvloeden renteverwachtingen',
  },
  oil: {
    'USD/CAD': 'Canada is grote olie-exporteur, hogere olie = sterker CAD',
    'CAD/JPY': 'Olie rijst = CAD sterker, JPY zwakker (importeur)',
    'AUD/CAD': 'Olie vs metalen: CAD volgt olie, AUD volgt goud',
    default: 'Olieprijs beïnvloedt commodity-valuta\'s',
  },
  gold: {
    'AUD/USD': 'Australië is grote goudproducent',
    'USD/CHF': 'Goud en CHF bewegen samen als veilige havens',
    default: 'Goud als veilige haven indicator',
  },
  sp500: {
    default: 'Risicosentiment indicator — risk-on/off barometer',
  },
  vix: {
    default: 'Angst-index — hoge VIX = risk-off, haven bid',
  },
  dxy: {
    'EUR/USD': 'DXY is 57% EUR-gewogen, directe correlatie',
    default: 'Dollar index als USD-sterkte maatstaf',
  },
}

function getStrength(d: MarketDataPoint | null): { dir: 'up' | 'down' | 'flat'; strength: number } {
  if (!d) return { dir: 'flat', strength: 0 }
  const pct = Math.abs(d.changePct ?? 0)
  const dir = (d.changePct ?? 0) > 0.1 ? 'up' as const :
    (d.changePct ?? 0) < -0.1 ? 'down' as const : 'flat' as const
  const strength = pct > 1.5 ? 1.0 : pct > 1.0 ? 0.85 : pct > 0.5 ? 0.7 : pct > 0.2 ? 0.5 : pct > 0.05 ? 0.25 : 0
  return { dir, strength: dir === 'flat' ? 0 : strength }
}

function getRelevance(instrument: string, pair: string): string {
  return IM_RELEVANCE[instrument]?.[pair] || IM_RELEVANCE[instrument]?.default || ''
}

export function scorePairIntermarket(
  pair: string,
  isBullishFundamental: boolean,
  marketData: Record<string, MarketDataPoint>
): IntermarketScore {
  const weights = PAIR_IM_WEIGHTS[pair]
  const directions = PAIR_IM_DIRECTION[pair]

  if (!weights || !directions) {
    return { pair, alignment: 50, signals: [], weight: 0 }
  }

  const signals: IntermarketSignal[] = []
  let alignedScore = 0
  let totalWeight = 0

  for (const [instrument, weight] of Object.entries(weights)) {
    const data = marketData[instrument]
    const { dir, strength } = getStrength(data)

    if (dir === 'flat' || strength === 0) continue

    const expectedDir = directions[instrument]
    if (!expectedDir) continue

    // For bullish fundamental: check if IM confirms bullish
    // For bearish fundamental: check if IM confirms bearish (invert expected)
    let confirms = false
    if (isBullishFundamental) {
      confirms = (expectedDir === 'positive' && dir === 'up') ||
                 (expectedDir === 'negative' && dir === 'down')
    } else {
      confirms = (expectedDir === 'positive' && dir === 'down') ||
                 (expectedDir === 'negative' && dir === 'up')
    }

    const contribution = confirms ? strength * weight : -strength * weight
    alignedScore += contribution
    totalWeight += weight

    signals.push({
      instrument,
      direction: dir,
      strength,
      relevance: getRelevance(instrument, pair) +
        (confirms ? ' → bevestigt' : ' → weerspreekt'),
    })
  }

  // Normalize to 0-100
  const alignment = totalWeight > 0
    ? Math.round(Math.max(0, Math.min(100, 50 + (alignedScore / totalWeight) * 50)))
    : 50

  return { pair, alignment, signals, weight: totalWeight }
}

// Historical intermarket alignment from price history
export function scorePairIntermarketHistorical(
  pair: string,
  date: string,
  isBullishFundamental: boolean,
  intermarketHistory: Record<string, { date: string; close: number }[]>
): IntermarketScore {
  const weights = PAIR_IM_WEIGHTS[pair]
  const directions = PAIR_IM_DIRECTION[pair]

  if (!weights || !directions) {
    return { pair, alignment: 50, signals: [], weight: 0 }
  }

  const signals: IntermarketSignal[] = []
  let alignedScore = 0
  let totalWeight = 0

  for (const [instrument, weight] of Object.entries(weights)) {
    const history = intermarketHistory[instrument] || []
    const idx = history.findIndex(p => p.date === date)
    if (idx <= 0) continue

    const today = history[idx].close
    const yesterday = history[idx - 1].close
    if (yesterday === 0) continue

    const changePct = ((today - yesterday) / yesterday) * 100
    const dir: 'up' | 'down' | 'flat' = changePct > 0.1 ? 'up' : changePct < -0.1 ? 'down' : 'flat'
    const strength = Math.abs(changePct) > 1.5 ? 1.0 :
      Math.abs(changePct) > 1.0 ? 0.85 :
      Math.abs(changePct) > 0.5 ? 0.7 :
      Math.abs(changePct) > 0.2 ? 0.5 :
      Math.abs(changePct) > 0.05 ? 0.25 : 0

    if (dir === 'flat' || strength === 0) continue

    const expectedDir = directions[instrument]
    if (!expectedDir) continue

    let confirms = false
    if (isBullishFundamental) {
      confirms = (expectedDir === 'positive' && dir === 'up') ||
                 (expectedDir === 'negative' && dir === 'down')
    } else {
      confirms = (expectedDir === 'positive' && dir === 'down') ||
                 (expectedDir === 'negative' && dir === 'up')
    }

    const contribution = confirms ? strength * weight : -strength * weight
    alignedScore += contribution
    totalWeight += weight

    signals.push({
      instrument,
      direction: dir,
      strength,
      relevance: (confirms ? 'bevestigt' : 'weerspreekt') + ` richting`,
    })
  }

  const alignment = totalWeight > 0
    ? Math.round(Math.max(0, Math.min(100, 50 + (alignedScore / totalWeight) * 50)))
    : 50

  return { pair, alignment, signals, weight: totalWeight }
}
