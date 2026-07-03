// ─────────────────────────────────────────────────────────────
// Sanders Capital — Fundamental Briefing: shared types
// ─────────────────────────────────────────────────────────────
import type { Horizon } from './constants'

export type Direction = 'bullish' | 'bearish'
// 'position' = carry-lens (sinds jul 2026); 'weekly' is legacy (niet meer gegenereerd).
export type CallType = 'daily' | 'weekly' | 'position'

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
  // v2 (append-only — v1-data mist deze):
  surprisePts?: number     // macro-verrassingen, gecapt ±2
  inflGapPts?: number      // inflatie t.o.v. doel, gecapt ±1
  commodityPts?: number    // grondstoffen-terms-of-trade, gecapt ±1
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

// v2: zekerheid gesplitst in BIAS (fundamenteel) en TIMING (instapkwaliteit).
// total = 0.6 × bias + 0.4 × timing. Opgeslagen in dezelfde JSONB-kolom;
// v1-rijen hebben de oude vorm — onderscheid via isV2Breakdown().
export interface ConvictionV2 {
  v: 2
  kind?: 'carry'         // positie-lens: fundPts komt uit het renteverschil
  // Bias-kant (0..10): hoe sterk de fundamentals de richting steunen.
  fundPts: number        // geschaalde |fund_score|, 0..8.5
  regimePts: number      // 0.5 of 1.5
  biasScore: number      // fundPts + regimePts, 0.5..10
  // Timing-kant (0..10): hoe gunstig het instapmoment is.
  stretchPts: number     // ATR-genormaliseerde tegendraadse beweging, 0..4
  imPts: number          // intermarket-bevestiging, 0..3
  eventPts: number       // event-rust (geen high-impact events op komst), 0..3
  timingScore: number    // stretchPts + imPts + eventPts, 0..10
  total: number          // blend (de "zekerheid")
}

export type ConvictionAny = ConvictionBreakdownLite | ConvictionV2

export function isV2Breakdown(b: ConvictionAny): b is ConvictionV2 {
  return (b as ConvictionV2).v === 2
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

// Eén meegewogen macro-verrassing (actual vs. forecast uit de kalender).
export interface SurpriseItem {
  title: string
  date: string             // ISO van de publicatie
  actual: number
  forecast: number
  unit?: string
  importance: number       // -1 laag · 0 middel · 1 hoog
  pts: number              // bijdrage aan de verrassingsscore (getekend)
}

// Aankomend high-impact kalender-event (timing-risico).
export interface EventRiskItem {
  currency: string
  title: string
  date: string             // ISO
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
  // v2 (append-only — v1-calls missen deze):
  surprisePts?: number
  surpriseDetail?: SurpriseItem[]
  inflGapPts?: number
  cpiYoY?: number | null
  cpiTarget?: number | null
  commodityPts?: number
  commodityName?: string
  commodityChangePct?: number | null
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
  impact?: number             // v2: LLM-richting voor déze valuta (-2..+2)
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
  // v2 (append-only):
  modelVersion?: string                   // 'v2' vanaf 2026-07-03
  atrPips?: number                        // 14d-ATR in pips op call-moment
  eventRisk?: EventRiskItem[]             // high-impact events binnen het timing-venster
  newsSource?: 'llm' | 'keywords'         // hoe het nieuws is gelabeld
  // Positie-lens (carry), append-only:
  carryDiffPp?: number                    // beleidsrente base − quote, in pp
  carryBaseRate?: number | null
  carryQuoteRate?: number | null
  swapPctPer30d?: number                  // indicatieve swap-opbrengst per 30 dagen
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
  fundScore: number        // ruwe paar-onbalans
  conviction: number       // 0..10
  breakdown: ConvictionAny
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
  locked?: boolean         // true = 's ochtends gelockte snapshot (fb_daily_context)
}

// Response van /api/fundamental-briefing/data
export interface FbDataResponse {
  generatedAt: string
  today: string
  header: BriefingHeader | null
  dailyCalls: FbCall[]
  weeklyCalls: FbCall[]      // legacy — wordt niet meer aangevuld
  positionCalls: FbCall[]    // carry-lens (vandaag)
  trackrecord: FbCall[]
}
