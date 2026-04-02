// ─── FX Edge Extraction Engine v3 — 5-Category Signal ────
// Classifies each pair into one of 5 categories:
// 1. bullish_trend       — fundamentals + momentum aligned bullish
// 2. bullish_mean_reversion — fundamentals bullish, price overextended bearish
// 3. bearish_trend       — fundamentals + momentum aligned bearish
// 4. bearish_mean_reversion — fundamentals bearish, price overextended bullish
// 5. no_trade            — conflicting signals or insufficient edge
// ──────────────────────────────────────────────────────────

import type {
  CurrencyScore, PairSignal, SignalCategory, RegimeResult,
  IntermarketScore, TradeabilityResult, CalendarEvent, PriceHistory,
} from './types'
import { PAIRS, THRESHOLDS } from './constants'
import { scorePairIntermarket, scorePairIntermarketHistorical } from './intermarket'
import { assessTradeability, calculatePriceMomentum } from './tradeability'
import type { MarketDataPoint } from './types'

interface ClassifyOptions {
  currencyScores: CurrencyScore[]
  regime: RegimeResult
  marketData: Record<string, MarketDataPoint>
  priceHistory: Record<string, PriceHistory[]>
  calendar: CalendarEvent[]
  date?: string
  // For historical backfill:
  intermarketHistory?: Record<string, { date: string; close: number }[]>
}

function getScoreMap(scores: CurrencyScore[]): Record<string, CurrencyScore> {
  const map: Record<string, CurrencyScore> = {}
  for (const s of scores) map[s.currency] = s
  return map
}

export function classifyPairSignals(opts: ClassifyOptions): PairSignal[] {
  const { currencyScores, regime, marketData, priceHistory, calendar, date, intermarketHistory } = opts
  const scoreMap = getScoreMap(currencyScores)
  const signals: PairSignal[] = []

  for (const pair of PAIRS) {
    const [base, quote] = pair.split('/')
    const baseScore = scoreMap[base]
    const quoteScore = scoreMap[quote]

    if (!baseScore || !quoteScore) continue

    const scoreDiff = baseScore.weightedTotal - quoteScore.weightedTotal
    const absDiff = Math.abs(scoreDiff)
    const isBullish = scoreDiff > 0

    // Calculate pair-specific intermarket
    let intermarket: IntermarketScore
    if (date && intermarketHistory) {
      intermarket = scorePairIntermarketHistorical(pair, date, isBullish, intermarketHistory)
    } else {
      intermarket = scorePairIntermarket(pair, isBullish, marketData)
    }

    // Calculate price momentum
    const pairSymbol = pair.replace('/', '')
    const history = priceHistory[`${pairSymbol}=X`] || priceHistory[pairSymbol] || []
    const momentum = calculatePriceMomentum(pair, history)

    // Determine signal category
    let signal: SignalCategory = 'no_trade'
    const reasons: string[] = []

    if (absDiff < THRESHOLDS.weakSignal) {
      signal = 'no_trade'
      reasons.push('Score verschil te klein voor signaal')
    } else {
      // Check momentum vs fundamental alignment
      const momentumAligned = (isBullish && momentum.direction === 'up') ||
                               (!isBullish && momentum.direction === 'down')
      const momentumOpposed = (isBullish && momentum.direction === 'down') ||
                               (!isBullish && momentum.direction === 'up')

      if (momentumOpposed && momentum.extensionRatio >= THRESHOLDS.mrEntryExtension) {
        // Mean reversion opportunity
        signal = isBullish ? 'bullish_mean_reversion' : 'bearish_mean_reversion'
        reasons.push(
          `Fundamenteel ${isBullish ? 'bullish' : 'bearish'} maar prijs overextended`,
          `Mean reversion kans (extensie ${momentum.extensionRatio.toFixed(1)}x ATR)`,
        )
      } else if (momentumAligned || momentum.direction === 'flat') {
        // Trend signal
        signal = isBullish ? 'bullish_trend' : 'bearish_trend'
        reasons.push(
          `Fundamenteel en momentum ${isBullish ? 'bullish' : 'bearish'} aligned`,
        )
      } else if (momentumOpposed && momentum.extensionRatio < THRESHOLDS.mrEntryExtension) {
        // Momentum opposed but not extended enough for MR
        if (absDiff >= THRESHOLDS.strongSignal) {
          // Strong fundamental conviction overrides weak counter-momentum
          signal = isBullish ? 'bullish_trend' : 'bearish_trend'
          reasons.push(
            'Sterke fundamentele overtuiging ondanks lichte tegenwind',
          )
        } else {
          signal = 'no_trade'
          reasons.push('Momentum tegenstrijdig, onvoldoende extensie voor MR')
        }
      }

      // Intermarket confirmation/contradiction
      if (intermarket.alignment >= THRESHOLDS.imStrongConfirm) {
        reasons.push(`Intermarket bevestigt (${intermarket.alignment}%)`)
      } else if (intermarket.alignment <= THRESHOLDS.imContradiction) {
        reasons.push(`Intermarket weerspreekt (${intermarket.alignment}%)`)
        // Downgrade trend to no_trade if IM strongly contradicts
        if (signal === 'bullish_trend' || signal === 'bearish_trend') {
          if (absDiff < THRESHOLDS.strongSignal) {
            signal = 'no_trade'
            reasons.push('Signal geblokkeerd door intermarket tegenstrijdigheid')
          }
        }
      }
    }

    // Calculate conviction (0-100)
    let conviction = 0
    if (signal !== 'no_trade') {
      // Base conviction from score difference (0-50)
      conviction = Math.min(50, Math.round((absDiff / 6) * 50))
      // IM bonus (0-25)
      conviction += Math.round(Math.max(0, (intermarket.alignment - 50)) / 2)
      // Momentum alignment bonus (0-15)
      if ((isBullish && momentum.direction === 'up') || (!isBullish && momentum.direction === 'down')) {
        conviction += 15
      }
      // Regime alignment bonus (0-10)
      if (isRegimeAligned(base, quote, isBullish, regime.macro)) {
        conviction += 10
      }
      conviction = Math.min(95, conviction)
    }

    // Tradeability assessment
    const tradeability = assessTradeability(
      pair, conviction, momentum, intermarket, calendar, date
    )

    // Override signal if not tradeable
    if (tradeability.status === 'not_tradeable' && signal !== 'no_trade') {
      reasons.push('Geblokkeerd door tradeability filter')
    }

    signals.push({
      pair,
      base,
      quote,
      signal,
      conviction,
      score: Math.round(scoreDiff * 100) / 100,
      tradeability,
      intermarket,
      regime,
      reasons,
      baseScore,
      quoteScore,
      priceMomentum: momentum,
    })
  }

  // Sort by conviction (highest first), then by absolute score
  signals.sort((a, b) => {
    if (a.signal === 'no_trade' && b.signal !== 'no_trade') return 1
    if (a.signal !== 'no_trade' && b.signal === 'no_trade') return -1
    if (b.conviction !== a.conviction) return b.conviction - a.conviction
    return Math.abs(b.score) - Math.abs(a.score)
  })

  return signals
}

function isRegimeAligned(base: string, quote: string, isBullish: boolean, regime: string): boolean {
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

// Extract trade focus (top tradeable signals)
export function extractTradeFocus(
  signals: PairSignal[],
  maxPairs: number = 5,
  maxPerCurrency: number = 2
): PairSignal[] {
  const focus: PairSignal[] = []
  const currencyCount: Record<string, number> = {}

  for (const sig of signals) {
    if (sig.signal === 'no_trade') continue
    if (sig.tradeability.status === 'not_tradeable') continue
    if (focus.length >= maxPairs) break

    const baseCount = currencyCount[sig.base] || 0
    const quoteCount = currencyCount[sig.quote] || 0
    if (baseCount >= maxPerCurrency || quoteCount >= maxPerCurrency) continue

    focus.push(sig)
    currencyCount[sig.base] = baseCount + 1
    currencyCount[sig.quote] = quoteCount + 1
  }

  return focus
}
