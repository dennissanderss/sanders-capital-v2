// ─── Types ──────────────────────────────────────────────────

export interface CurrencyRank {
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
}

export interface PairBias {
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
}

export interface TodayEvent {
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

export interface WeekEvent {
  title: string
  currency: string
  date: string
  impact: string
  forecast: string
  previous: string
}

export interface IntermarketSignal {
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

export interface NewsItem {
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
}

export interface NewsSentiment {
  score: number
  headlines: string[]
  sentiment: string
}

export interface BriefingV2Data {
  version: string
  regime: string
  regimeExplain: string
  regimeColor: string
  regimeMethodology: string
  confidence: number
  intermarketSignals: IntermarketSignal[]
  currencyRanking: CurrencyRank[]
  pairBiases: PairBias[]
  todayEvents: TodayEvent[]
  weekEvents: WeekEvent[]
  topNews: NewsItem[]
  newsSentiment: Record<string, NewsSentiment>
  generatedAt: string
  date: string
  error?: string
  newsLastUpdated?: string
  newsCount?: number
  regimeSource?: string
  intermarketAlignment?: number
}

export interface TrackRecordMetadata {
  source?: string
  version?: string
  scoreWithoutNews?: number
  newsInfluence?: number
  confidence?: number
  newsHeadlines?: string[]
  callTime?: string
  entryTime?: string
  exitTime?: string
  newsSimulated?: boolean
  holdingPeriod?: number
  meanReversion?: boolean
  preMomentum?: number
}

export interface TrackRecord {
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
  metadata?: TrackRecordMetadata
}

export interface TrackStats {
  total: number
  correct: number
  incorrect: number
  pending: number
  winRate: number
  startDate: string | null
  newsInfluenced?: {
    total: number
    correct: number
    winRate: number
  }
}
