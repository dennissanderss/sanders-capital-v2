// ─── FX Edge Extraction Engine v3 ────────────────────────
// Public API — import everything from here.
// ──────────────────────────────────────────────────────────

export { runLivePipeline, runBackfillPipeline } from './pipeline'
export { classifyRegime, classifyRegimeFromRates } from './regime'
export { scoreCurrencies, scoreCurrenciesFromRates } from './scoring'
export { scorePairIntermarket, scorePairIntermarketHistorical } from './intermarket'
export { assessTradeability, calculatePriceMomentum } from './tradeability'
export { classifyPairSignals, extractTradeFocus } from './signal'
export { VERSION, MAJORS, PAIRS, PAIR_SYMBOLS, INTERMARKET_SYMBOLS, THRESHOLDS } from './constants'

export type {
  SubRegime, MacroRegime, RegimeResult,
  CurrencyFactors, CurrencyScore,
  SignalCategory, Tradeability, TradeabilityResult,
  IntermarketScore, IntermarketSignal,
  PairSignal,
  CBRate, MarketDataPoint, PriceHistory, NewsArticle, CalendarEvent,
  EngineInput, EngineOutput,
} from './types'
