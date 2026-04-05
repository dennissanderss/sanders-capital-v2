// ═══════════════════════════════════════════════════════════════
// Execution Engine Types
// Sanders Capital — Fundamental + Technical Integration Layer
// ═══════════════════════════════════════════════════════════════

// ─── Fundamental Layer (read from briefing-v2) ───────────────

export interface FundamentalBias {
  pair: string
  base: string
  quote: string
  direction: 'bullish' | 'licht bullish' | 'neutraal' | 'licht bearish' | 'bearish'
  conviction: 'sterk' | 'matig' | 'laag' | 'geen'
  score: number           // ±5.0 range
  scoreWithoutNews: number
  newsInfluence: number   // ±1.5 range
  baseBias: string        // 'hawkish' | 'dovish' | etc.
  quoteBias: string
  rateDiff: number | null
}

export interface RegimeContext {
  regime: 'Risk-Off' | 'Risk-On' | 'USD Dominant' | 'USD Zwak' | 'Gemengd'
  confidence: number      // 0-100
  intermarketAlignment: number // 0-100
}

// ─── Technical Layer (read from Pine Script via MCP) ─────────

export interface TechnicalState {
  htfBias: 'BULLISH' | 'BEARISH' | 'RANGING'
  swingHigh: number | null
  swingLow: number | null
  fibPrice: number | null
  priceVsFib: 'ABOVE' | 'BELOW' | 'AT' | 'UNKNOWN'
  fibZoneValid: boolean
  bullBreaks: number
  bearBreaks: number
  setupStatus: 'VALID_SETUP' | 'APPROACHING' | 'WAITING_FOR_ZONE' | 'NO_SETUP'
  direction: 'LONG' | 'SHORT' | 'NONE'
  mode: 'Trend' | 'Counter'
  entry: number | null
  sl: number | null
  tp1: number | null
  tp2: number | null
}

// ─── Scoring Model ───────────────────────────────────────────

export interface ScoringBreakdown {
  fundamentalScore: number  // 0-5.0 (50% weight)
  technicalScore: number    // 0-3.5 (35% weight)
  regimeScore: number       // 0-1.5 (15% weight)
  compositeScore: number    // 0-10
}

export interface TechnicalScoreDetail {
  htfAlignment: number      // 0 or 1.0 — HTF bias matches fundamental direction
  fibZonePosition: number   // 0 or 1.0 — price in correct fib zone
  ltfConfirmation: number   // 0 or 1.0 — enough LTF structure breaks
  atrContext: number        // 0 or 0.5 — ATR in normal range
}

// ─── Verdict ─────────────────────────────────────────────────

export type Verdict = 'SKIP' | 'WATCHLIST' | 'VALID' | 'HIGH_CONVICTION'

export interface VerdictReason {
  type: 'fundamental' | 'technical' | 'regime' | 'risk' | 'event'
  message: string
}

// ─── Risk Model ──────────────────────────────────────────────

export interface RiskCalculation {
  positionSizeLots: number
  riskAmount: number        // $ at risk
  riskPercent: number       // % of account
  slDistancePips: number
  rrRatio1: number          // e.g. 2.0
  rrRatio2: number          // e.g. 3.0
  estimatedHoldHours: number
}

// ─── Combined Output Per Pair ────────────────────────────────

export interface ExecutionSignal {
  // Pair info
  pair: string
  base: string
  quote: string
  timestamp: string

  // Fundamental layer
  fundamental: FundamentalBias
  regime: RegimeContext

  // Technical layer
  technical: TechnicalState | null  // null if not scanned

  // Scoring
  scoring: ScoringBreakdown
  technicalDetail: TechnicalScoreDetail | null

  // Decision
  verdict: Verdict
  verdictReasons: VerdictReason[]

  // Execution (only for VALID / HIGH_CONVICTION)
  entry: number | null
  sl: number | null
  tp1: number | null
  tp2: number | null
  risk: RiskCalculation | null

  // Meta
  tradeMode: 'Trend' | 'Counter'
  correlationGroup: string
}

// ─── Correlation Groups ──────────────────────────────────────

export const CORRELATION_GROUPS: Record<string, string[]> = {
  dollar: ['EUR/USD', 'GBP/USD', 'AUD/USD', 'NZD/USD', 'USD/CAD', 'USD/CHF', 'USD/JPY'],
  yen: ['EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY', 'CAD/JPY'],
  commodity: ['AUD/NZD', 'AUD/CAD'],
  euro_cross: ['EUR/GBP', 'EUR/AUD', 'EUR/CHF', 'EUR/CAD'],
  gbp_cross: ['GBP/AUD', 'GBP/CHF', 'GBP/NZD'],
}

export function getCorrelationGroup(pair: string): string {
  for (const [group, pairs] of Object.entries(CORRELATION_GROUPS)) {
    if (pairs.includes(pair)) return group
  }
  return 'other'
}

// ─── All 21 pairs ────────────────────────────────────────────

export const ALL_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD',
  'USD/CAD', 'USD/CHF', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
  'AUD/JPY', 'NZD/JPY', 'CAD/JPY', 'EUR/AUD', 'GBP/AUD',
  'AUD/NZD', 'EUR/CHF', 'GBP/CHF', 'EUR/CAD', 'GBP/NZD',
  'AUD/CAD',
]

// ─── Trade Models (bewezen uit 434 trades, apr 2025 - mar 2026) ─

export interface TradeModel {
  id: string
  name: string
  label: string
  scoreMin: number
  scoreMax: number
  momMin: number
  momMax: number
  sl: number
  tp: number
  rr: number
  expectedWR: number
  expectedPF: number
  expectedExp: number
  tradesPerWeek: number
  tradesPerMonth: number
  monthlyPips: number
  sampleSize: number
}

export const TRADE_MODELS: Record<string, TradeModel> = {
  selective: {
    id: 'selective',
    name: 'Selective',
    label: 'Hoogste winrate',
    scoreMin: 2.0, scoreMax: 3.0,
    momMin: 30, momMax: 120,
    sl: 40, tp: 120, rr: 3.0,
    expectedWR: 62.4, expectedPF: 4.98, expectedExp: 59.8,
    tradesPerWeek: 2.5, tradesPerMonth: 10.8,
    monthlyPips: 646, sampleSize: 117,
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    label: 'Beste balans',
    scoreMin: 2.0, scoreMax: 3.0,
    momMin: 20, momMax: 150,
    sl: 40, tp: 120, rr: 3.0,
    expectedWR: 61.7, expectedPF: 4.83, expectedExp: 58.7,
    tradesPerWeek: 3.6, tradesPerMonth: 15.4,
    monthlyPips: 904, sampleSize: 167,
  },
  aggressive: {
    id: 'aggressive',
    name: 'Aggressive',
    label: 'Maximaal rendement',
    scoreMin: 2.0, scoreMax: 3.0,
    momMin: 0, momMax: 9999,
    sl: 40, tp: 120, rr: 3.0,
    expectedWR: 58.0, expectedPF: 4.15, expectedExp: 52.8,
    tradesPerWeek: 5.6, tradesPerMonth: 24.2,
    monthlyPips: 1278, sampleSize: 262,
  },
}

export const DEFAULT_MODEL = 'balanced'
