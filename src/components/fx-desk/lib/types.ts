// ─── Briefing API types (subset we read) ──────────────────────
// Mirrors /api/briefing-v2 response — read-only. Do not modify the API.

export interface ApiCurrencyRank {
  currency: string
  score: number
  baseScore: number
  newsBonus: number
  reasons: string[]
  newsHeadlines: string[]
  rate: number | null
  bias: string
  flag: string
  bank: string
  scoreBreakdown?: {
    biasLabel: string
    biasRaw: number
    biasMultiplied: number
    rateScore: number
    rate: number | null
    target: number | null
    newsRaw: number
    newsCapped: number
    total: number
  } | null
}

export interface ApiPairBias {
  pair: string
  base: string
  quote: string
  direction: string
  conviction: string
  score: number
  scoreWithoutNews: number
  newsInfluence: number
  reason: string
  rateDiff: number | null
  baseBias: string
  quoteBias: string
  regimeAligned?: boolean
  tradeFocusTier?: string
  confluence?: {
    factors: { fundamenteel: boolean; regime: boolean; intermarket: boolean; news: boolean }
    score: number
    total: number
  }
}

export interface ApiIntermarketSignal {
  key: string
  name: string
  unit: string
  context: string
  regimeImpact: string
  current: number | null
  previousClose: number | null
  change: number | null
  changePct: number | null
  direction: 'up' | 'down' | 'flat'
}

export interface ApiNewsSentiment {
  score: number
  headlines: string[]
  sentiment: string
}

export interface ApiV3Factors {
  cb: number
  inflation: number
  growth: number
  sentiment: number
  commodity: number
  haven: number
  momentum: number
}

export interface ApiV3CurrencyScore {
  currency: string
  factors: ApiV3Factors
  weightedTotal: number
  rawTotal: number
  rank: number
  reasons: string[]
}

export interface ApiV3PairSignal {
  pair: string
  signal: string
  conviction: number
  score: number
  tradeability: { status: string; reasons: string[] }
  intermarket: {
    pair: string
    alignment: number
    signals: { instrument: string; direction: string; strength: number; relevance: string }[]
  }
  reasons: string[]
  priceMomentum: { direction: string; pips1d: number; pips5d: number; atr20d: number; extensionRatio: number; price5dAgo?: number | null; priceNow?: number | null }
}

export interface ApiTodayEvent {
  title: string
  currency: string
  date: string
  impact: string
  forecast: string
  previous: string
  flag: string
  countryName: string
  context: string
  time: string
  dateFormatted: string
}

export interface ApiBriefingData {
  version: string
  regime: string
  regimeExplain: string
  regimeColor: string
  regimeMethodology: string
  regimeSource?: string
  confidence: number
  intermarketAlignment?: number
  intermarketSignals: ApiIntermarketSignal[]
  currencyRanking: ApiCurrencyRank[]
  pairBiases: ApiPairBias[]
  todayEvents: ApiTodayEvent[]
  weekEvents: { title: string; currency: string; date: string; impact: string; forecast: string; previous: string }[]
  topNews: {
    id: string
    title: string
    titleEn: string
    source: string
    category: string
    publishedAt: string
    relevanceScore: number
    affectedCurrencies: string[]
    relevanceContext: string
    url: string
  }[]
  newsSentiment: Record<string, ApiNewsSentiment>
  generatedAt: string
  date: string
  newsLastUpdated?: string
  newsCount?: number
  v3?: {
    regime: { macro: string; sub: string; confidence: number; drivers: string[]; color: string }
    currencyScores?: ApiV3CurrencyScore[]
    pairSignals: ApiV3PairSignal[]
  } | null
}

// ─── Trackrecord types (from /api/trackrecord-v2) ─────────────
export interface ApiTrackRecord {
  id: string
  date: string
  pair: string
  direction: string
  conviction: string
  score: number
  entry_price: number | null
  exit_price: number | null
  result: 'pending' | 'correct' | 'incorrect'
  pips_moved: number | null
  regime: string
  created_at?: string
  resolved_at?: string
  metadata?: {
    source?: string
    version?: string
    scoreWithoutNews?: number
    newsInfluence?: number
    confidence?: number
    newsHeadlines?: string[]
    callTime?: string
    entryTime?: string
    exitTime?: string
    holdingPeriod?: number
    momentum5d?: number
    imAlignment?: number
    signal?: string
  }
}

// ─── Design-shape types (what components consume) ─────────────
export type Direction = 'long' | 'short'

export interface DeskToday {
  date: string
  regime: string
  regimeColor: string
  regimeNote: string
  confidence: number
  readyCount: number
}

export interface DeskFxScore {
  code: string
  score: number  // -5 .. +5
  bias: string
  bank: string
}

export interface ConvictionBreakdownLite {
  fundPts: number
  contrarianPts: number
  imPts: number
  regimePts: number
  total: number
}

export interface DeskCall {
  pair: string
  base: string
  quote: string
  dir: Direction
  score: number       // 0..10 conviction
  fundScore: number   // raw -5..+5
  status: 'ready' | 'watch'
  note: string
  wait?: string
  breakdown?: ConvictionBreakdownLite   // 4-component breakdown, present for live calls
}

export interface DeskReasoning {
  regime: string
  nieuws: string
  intermarket: string
  score: [string, number][]   // breakdown bars
}

export interface DeskIntermarket {
  key: string
  label: string
  value: string
  chg: string
  dir: 'up' | 'down' | 'flat'
  duiding: string
}

export type SentimentStand = 'positief' | 'neutraal' | 'negatief'

export interface DeskSentiment {
  code: string
  stand: SentimentStand
  headlines: string[]
}

export interface DeskCallHistoryRecord {
  id: string
  pair: string
  dir: Direction
  src: 'fundamenteel' | 'engine'
  score: number       // 0..10 conviction
  fundScore: number   // raw -5..+5
  date: string        // formatted "13 jun"
  calledAt: string    // "13 jun, 09:15"
  closedAt: string | null
  durationText: string
  outcome: 'correct' | 'incorrect' | 'pending'
  entry: number
  tp: number
  sl: number
  close: number | null
  pips: number | null
  note: string
}
