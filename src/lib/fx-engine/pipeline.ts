// ─── FX Edge Extraction Engine v3 — Pipeline Orchestrator ─
// Connects all modules: regime → scoring → intermarket →
// tradeability → signal classification → trade focus.
//
// Two modes:
// 1. Live mode: Full data (CB rates, news, calendar, market data)
// 2. Backfill mode: Historical CB rates + price history only
// ──────────────────────────────────────────────────────────

import type { EngineInput, EngineOutput, PriceHistory } from './types'
import { VERSION } from './constants'
import { classifyRegime, classifyRegimeFromRates } from './regime'
import { scoreCurrencies, scoreCurrenciesFromRates } from './scoring'
import { classifyPairSignals, extractTradeFocus } from './signal'

// ─── Live Pipeline ───────────────────────────────────────
export function runLivePipeline(input: EngineInput): EngineOutput {
  // Step 1: Initial currency scoring with neutral weights (for regime detection)
  const initialScores = scoreCurrencies(
    input.cbRates, input.news, input.calendar,
    input.marketData, input.priceHistory, 'range_chop'
  )

  // Step 2: Classify regime using initial scores + intermarket
  const regime = classifyRegime(input.marketData, initialScores)

  // Step 3: Re-score with regime-appropriate weights
  const currencyScores = scoreCurrencies(
    input.cbRates, input.news, input.calendar,
    input.marketData, input.priceHistory, regime.sub
  )

  // Step 4: Classify pair signals (includes IM + tradeability)
  const pairSignals = classifyPairSignals({
    currencyScores,
    regime,
    marketData: input.marketData,
    priceHistory: input.priceHistory,
    calendar: input.calendar,
  })

  // Step 5: Extract trade focus
  const tradeFocus = extractTradeFocus(pairSignals)

  // Count signal types
  const signalCount = {
    tradeable: pairSignals.filter(s => s.tradeability.status === 'tradeable' && s.signal !== 'no_trade').length,
    conditional: pairSignals.filter(s => s.tradeability.status === 'conditional' && s.signal !== 'no_trade').length,
    noTrade: pairSignals.filter(s => s.signal === 'no_trade' || s.tradeability.status === 'not_tradeable').length,
  }

  return {
    regime,
    currencyScores,
    pairSignals,
    tradeFocus,
    metadata: {
      version: VERSION,
      timestamp: new Date().toISOString(),
      subRegime: regime.sub,
      signalCount,
    },
  }
}

// ─── Backfill Pipeline ───────────────────────────────────
// Simpler: no news, no calendar. Uses historical CB rates + price data.
export function runBackfillPipeline(input: {
  cbRates: import('./types').CBRate[]
  priceHistory: Record<string, PriceHistory[]>
  intermarketHistory: Record<string, { date: string; close: number }[]>
  date: string
  // Optional intermarket snapshot for regime classification
  intermarketSnapshot?: { sp500Pct: number; vixLevel: number; goldPct: number; yieldsPct: number }
}): EngineOutput {
  // Step 1: Score currencies from CB rates only (neutral weights first)
  const initialScores = scoreCurrenciesFromRates(input.cbRates, 'range_chop')

  // Step 2: Classify regime
  const regime = classifyRegimeFromRates(initialScores, input.intermarketSnapshot)

  // Step 3: Re-score with regime weights
  const currencyScores = scoreCurrenciesFromRates(input.cbRates, regime.sub)

  // Step 4: Classify pair signals with historical IM
  const pairSignals = classifyPairSignals({
    currencyScores,
    regime,
    marketData: {},
    priceHistory: input.priceHistory,
    calendar: [],
    date: input.date,
    intermarketHistory: input.intermarketHistory,
  })

  // Step 5: Extract trade focus (more lenient for backfill — no event risk)
  const tradeFocus = extractTradeFocus(pairSignals)

  const signalCount = {
    tradeable: pairSignals.filter(s => s.tradeability.status === 'tradeable' && s.signal !== 'no_trade').length,
    conditional: pairSignals.filter(s => s.tradeability.status === 'conditional' && s.signal !== 'no_trade').length,
    noTrade: pairSignals.filter(s => s.signal === 'no_trade' || s.tradeability.status === 'not_tradeable').length,
  }

  return {
    regime,
    currencyScores,
    pairSignals,
    tradeFocus,
    metadata: {
      version: VERSION,
      timestamp: input.date,
      subRegime: regime.sub,
      signalCount,
    },
  }
}
