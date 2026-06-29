// ─────────────────────────────────────────────────────────────
// Sanders Capital — Fundamental Briefing: shared types
// ─────────────────────────────────────────────────────────────
import type { Horizon } from './constants'

export type Direction = 'bullish' | 'bearish'
export type CallType = 'daily' | 'weekly'

export interface ScoreBreakdown {
  biasLabel: string
  biasRaw: number          // -2..+2
  biasMultiplied: number   // biasRaw * 2
  rateScore: number        // rateTargetScore * 1.5
  rate: number | null
  target: number | null
  newsRaw: number          // ongecapt nieuws-sentiment
  newsCapped: number       // ±1.5
  total: number
}

export interface CurrencyScore {
  currency: string
  score: number            // totaal (incl. nieuws)
  baseScore: number        // zonder nieuws
  newsBonus: number
  reasons: string[]
  newsHeadlines: string[]
  breakdown: ScoreBreakdown
}

export interface ConvictionBreakdownLite {
  fundPts: number
  contrarianPts: number
  imPts: number
  regimePts: number
  total: number
}

// Eén voltooide dag-candle.
export interface Candle {
  date: string
  open: number
  high: number
  low: number
  close: number
}

// Eén beoordeelde horizon (close-to-close + favorabele/adverse excursie).
export interface HorizonOutcome {
  horizon: Horizon
  exitDate: string | null
  exitPrice: number | null
  correct: boolean | null          // null = pending
  mfePips: number | null           // grootste beweging JOUW kant op
  mfeDate: string | null
  mfePrice: number | null
  maePips: number | null           // grootste beweging TEGEN je
  maeDate: string | null
  maePrice: number | null
  resolved: boolean
}

// Fundamentele factor-uitleg per valuta (voor het call-detail).
export interface CurrencyFactors {
  currency: string
  total: number
  biasLabel: string
  cbPts: number            // biasRaw * 2
  ratePts: number          // rateTargetScore * 1.5
  rate: number | null
  target: number | null
  newsPts: number          // gecapt
  newsHeadlines: string[]
}

// Append-only (gat 1): per intermarket-instrument de richting + bijdrage.
// Optioneel → oude calls (zonder deze sleutel) blijven geldig.
export interface ImInstrument {
  key: string                 // sp500 | vix | gold | us10y | dxy
  direction: 'up' | 'down' | 'flat'
  changePct: number
  contributed: boolean        // telde dit instrument mee in de alignment?
}

// Append-only (gat 2): de exact meegewogen nieuwskoppen per valuta, met het
// gewicht zoals het in de scoreberekening zat. Optioneel → oude calls leeg.
export interface NewsItem {
  title: string
  source: string
  date: string | null
  weight: number              // relevantie × recentheid (zoals meegewogen)
}

export interface CallReasoning {
  base: CurrencyFactors
  quote: CurrencyFactors
  regime: string
  regimeAligned: boolean
  regimeText: string
  momentum5dPips: number
  momentumStart: { date: string | null; price: number | null }
  momentumNow: { date: string | null; price: number | null }
  imAlignment: number
  intermarket?: ImInstrument[]            // append-only (gat 1)
  newsDetail?: Record<string, NewsItem[]> // append-only (gat 2), per valutacode
}

// Eén gelockte call met al zijn horizon-uitkomsten.
export interface FbCall {
  id: string
  callDate: string
  callType: CallType
  pair: string
  base: string
  quote: string
  direction: Direction
  fundScore: number        // ruw -5..+5
  conviction: number       // 0..10
  breakdown: ConvictionBreakdownLite
  regime: string
  entryPrice: number
  entryDate: string
  reasoning: CallReasoning
  status: string
  outcomes: HorizonOutcome[]
}

export interface BriefingHeader {
  date: string
  regime: string
  regimeExplain: string
  regimeColor: string
  currencyScores: CurrencyScore[]
}

// Response van /api/fundamental-briefing/data
export interface FbDataResponse {
  generatedAt: string
  today: string
  header: BriefingHeader | null
  dailyCalls: FbCall[]
  weeklyCalls: FbCall[]
  trackrecord: FbCall[]
}
