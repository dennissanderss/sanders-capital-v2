// ─── FX Edge Extraction Engine v3 — Type Definitions ─────
// Core types for multi-factor currency scoring, sub-regime
// classification, pair-specific intermarket, and 5-category
// signal output.
// ──────────────────────────────────────────────────────────

// ─── Sub-Regime Classification ───────────────────────────
export type SubRegime =
  | 'growth_scare'       // Weak data + dovish shift fears
  | 'geopolitical_stress' // VIX spike, gold surge, haven bid
  | 'inflation_fear'     // Hot CPI, hawkish repricing
  | 'rate_repricing'     // Yields moving fast on CB surprise
  | 'risk_appetite'      // Equities up, VIX low, carry positive
  | 'range_chop'         // No clear driver, mixed signals

export type MacroRegime = 'Risk-Off' | 'Risk-On' | 'USD Dominant' | 'USD Zwak' | 'Gemengd'

export interface RegimeResult {
  macro: MacroRegime
  sub: SubRegime
  confidence: number       // 0-100
  drivers: string[]        // Human-readable reasons
  color: string            // UI color
}

// ─── Currency Factor Scores ──────────────────────────────
export interface CurrencyFactors {
  cb: number               // Central bank bias + rate vs target (-5 to +5)
  inflation: number        // CPI trend vs expectations (-2 to +2)
  growth: number           // GDP/PMI/employment signals (-2 to +2)
  sentiment: number        // News sentiment (-2 to +2)
  commodity: number        // Commodity exposure impact (-2 to +2)
  haven: number            // Safe-haven flow signal (-2 to +2)
  momentum: number         // Price momentum alignment (-2 to +2)
}

export interface CurrencyScore {
  currency: string
  factors: CurrencyFactors
  weights: CurrencyFactors  // Context-dependent weights for this regime
  weightedTotal: number     // Sum of (factor * weight)
  rawTotal: number          // Sum of factors (unweighted)
  rank: number              // 1-8 among majors
  reasons: string[]
}

// ─── Pair Analysis ───────────────────────────────────────
export type SignalCategory =
  | 'bullish_trend'          // Fundamentals + momentum aligned bullish
  | 'bullish_mean_reversion' // Fundamentals bullish but price overextended bearish
  | 'bearish_trend'          // Fundamentals + momentum aligned bearish
  | 'bearish_mean_reversion' // Fundamentals bearish but price overextended bullish
  | 'no_trade'               // Conflicting signals or insufficient edge

export type Tradeability = 'tradeable' | 'conditional' | 'not_tradeable'

export interface TradeabilityResult {
  status: Tradeability
  reasons: string[]
  extensionWarning: boolean  // 5d move > 1.5x 20d ATR
  eventRisk: boolean         // High-impact event within 24h
  conflictingIM: boolean     // Intermarket contradicts fundamental bias
}

export interface IntermarketScore {
  pair: string
  alignment: number          // 0-100, how much IM confirms fundamental direction
  signals: IntermarketSignal[]
  weight: number             // Pair-specific weight (some pairs more IM-sensitive)
}

export interface IntermarketSignal {
  instrument: string         // e.g. 'us10y', 'oil', 'gold'
  direction: 'up' | 'down' | 'flat'
  strength: number           // 0-1
  relevance: string          // Why this matters for this pair
}

export interface PairSignal {
  pair: string
  base: string
  quote: string
  signal: SignalCategory
  conviction: number         // 0-100
  score: number              // base_weighted - quote_weighted
  tradeability: TradeabilityResult
  intermarket: IntermarketScore
  regime: RegimeResult
  reasons: string[]
  // Breakdown for UI
  baseScore: CurrencyScore
  quoteScore: CurrencyScore
  priceMomentum: {
    direction: 'up' | 'down' | 'flat'
    pips1d: number
    pips5d: number
    atr20d: number
    extensionRatio: number   // abs(5d move) / ATR
  }
}

// ─── Pipeline Input/Output ───────────────────────────────
export interface CBRate {
  currency: string
  country: string
  bank: string
  rate: number | null
  target: number | null
  bias: string
  last_move: string
  next_meeting: string
  flag: string
}

export interface MarketDataPoint {
  current: number
  previousClose: number
  change: number
  changePct: number
  direction: 'up' | 'down' | 'flat'
}

export interface PriceHistory {
  date: string
  close: number
}

export interface NewsArticle {
  id: string
  title: string
  title_nl: string | null
  summary: string
  summary_nl: string | null
  source: string
  category: string
  published_at: string
  relevance_score: number
  relevance_tags: string[]
  affected_currencies: string[]
  relevance_context: string
  url: string
}

export interface CalendarEvent {
  title: string
  country: string
  date: string
  impact: string
  forecast: string
  previous: string
}

export interface EngineInput {
  cbRates: CBRate[]
  marketData: Record<string, MarketDataPoint>
  priceHistory: Record<string, PriceHistory[]>  // keyed by pair symbol
  news: NewsArticle[]
  calendar: CalendarEvent[]
  // Optional: historical CB snapshots for backfill
  historicalRates?: Record<string, CBRate[]>     // keyed by date
  date?: string                                   // for backfill mode
}

export interface EngineOutput {
  regime: RegimeResult
  currencyScores: CurrencyScore[]
  pairSignals: PairSignal[]
  tradeFocus: PairSignal[]      // Top signals filtered for tradeability
  metadata: {
    version: string
    timestamp: string
    subRegime: SubRegime
    signalCount: { tradeable: number; conditional: number; noTrade: number }
  }
}
