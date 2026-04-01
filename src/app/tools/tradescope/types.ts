// ============================================================
// TradeScope Pro - Shared Types
// ============================================================

export interface TsAccount {
  id: string
  user_id: string
  name: string
  type: 'demo' | 'sim' | 'live' | 'funded' | 'prop_firm'
  broker: string | null
  starting_balance: number
  currency: string
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TsStrategy {
  id: string
  user_id: string
  name: string
  description: string | null
  rules: string | null
  is_active: boolean
  color: string
  created_at: string
  updated_at: string
}

export interface TsSetup {
  id: string
  user_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export interface TsImport {
  id: string
  user_id: string
  account_id: string | null
  filename: string
  format: string
  column_mapping: Record<string, string> | null
  trade_count: number
  status: 'pending' | 'completed' | 'failed'
  error_message: string | null
  created_at: string
}

export interface TsTrade {
  id: string
  user_id: string
  account_id: string | null
  strategy_id: string | null
  setup_id: string | null
  import_id: string | null

  // Trade data
  symbol: string
  action: 'buy' | 'sell'
  lot_size: number
  open_price: number
  close_price: number | null
  sl: number | null
  tp: number | null
  exit_price: number | null
  commission: number
  swap: number

  // Results
  pips: number | null
  profit_loss: number | null
  risk_reward: number | null
  result_r: number | null
  risk_amount: number | null
  position_size: number | null

  // Dates
  open_date: string
  close_date: string | null
  holding_time_minutes: number | null

  // Context
  session: string | null
  day_of_week: string | null
  asset_class: string | null
  environment: 'backtest' | 'sim' | 'demo' | 'live' | 'funded'

  // Journal
  notes: string | null
  mistakes: string | null
  lessons: string | null
  entry_reason: string | null
  exit_reason: string | null
  tags: string[] | null
  confluences: string[] | null

  // Scoring
  confidence_score: number | null
  trade_quality: number | null
  execution_quality: number | null

  // Emotions
  emotion_before: string | null
  emotion_during: string | null
  emotion_after: string | null

  // Discipline
  rules_followed: boolean | null
  was_impulsive: boolean
  was_revenge: boolean
  was_overtrading: boolean
  htf_bias_respected: boolean | null
  news_checked: boolean | null

  // Status
  status: 'open' | 'closed' | 'cancelled'
  is_win: boolean | null

  created_at: string
  updated_at: string

  // Joined data (optional)
  account?: TsAccount
  strategy?: TsStrategy
  setup?: TsSetup
  screenshots?: TsScreenshot[]
}

export interface TsScreenshot {
  id: string
  trade_id: string
  user_id: string
  storage_path: string
  label: string | null
  sort_order: number
  created_at: string
}

export interface TsRoutine {
  id: string
  user_id: string
  date: string

  // Pre-session
  sleep_quality: number | null
  exercised: boolean
  meditated: boolean
  news_checked: boolean
  plan_written: boolean
  prepared_properly: boolean

  // Mood
  mood_before: number | null
  mood_after: number | null
  focus_level: number | null
  stress_level: number | null

  // Post-session
  followed_plan: boolean | null
  overtraded: boolean
  revenge_traded: boolean
  forced_setups: boolean
  broke_risk_rules: boolean
  felt_fear: boolean
  felt_greed: boolean
  felt_frustration: boolean

  // Scores
  discipline_score: number | null
  execution_score: number | null
  patience_score: number | null

  notes: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// Bridge: convert DB trade → existing ParsedTrade for analytics
// ============================================================

import type { ParsedTrade } from './utils/csvParser'
export type { ParsedTrade }

const SESSION_MAP: Record<string, ParsedTrade['session']> = {
  london: 'London',
  'new york': 'New York',
  asia: 'Asia',
  overlap: 'Overlap',
}

function mapSession(s: string | null): ParsedTrade['session'] {
  if (!s) return 'London'
  return SESSION_MAP[s.toLowerCase()] || 'London'
}

export function dbTradeToAnalytics(trade: TsTrade, index: number): ParsedTrade {
  return {
    tradeNumber: index + 1,
    openDate: new Date(trade.open_date),
    closeDate: trade.close_date ? new Date(trade.close_date) : new Date(trade.open_date),
    symbol: trade.symbol,
    action: trade.action,
    lotSize: trade.lot_size || 0,
    openPrice: trade.open_price,
    closePrice: trade.close_price || trade.exit_price || trade.open_price,
    sl: trade.sl || 0,
    tp: trade.tp || 0,
    commission: trade.commission || 0,
    swap: trade.swap || 0,
    pips: trade.pips || 0,
    profitLoss: trade.profit_loss || 0,
    riskReward: trade.risk_reward,
    session: mapSession(trade.session),
    dayOfWeek: trade.day_of_week || new Date(trade.open_date).toLocaleDateString('nl-NL', { weekday: 'long' }),
    holdingTimeMinutes: trade.holding_time_minutes || 0,
    isWin: (trade.profit_loss || 0) > 0,
    tags: (trade.tags || []).join(', '),
  }
}

// ============================================================
// Form types for creating/editing
// ============================================================

export type TradeFormData = Omit<TsTrade, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_win' | 'account' | 'strategy' | 'setup' | 'screenshots'>

export type AccountFormData = Pick<TsAccount, 'name' | 'type' | 'broker' | 'starting_balance' | 'currency' | 'notes'>

export type StrategyFormData = Pick<TsStrategy, 'name' | 'description' | 'rules' | 'color'>

export type SetupFormData = Pick<TsSetup, 'name' | 'description'>

// ============================================================
// Filter types
// ============================================================

export interface TradeFilters {
  accountId?: string
  strategyId?: string
  setupId?: string
  symbol?: string
  action?: 'buy' | 'sell'
  environment?: string
  session?: string
  isWin?: boolean
  dateFrom?: string
  dateTo?: string
  tags?: string[]
}

// ============================================================
// Tab definitions
// ============================================================

export type TradescopeTab = 'dashboard' | 'journal' | 'analytics' | 'strategy' | 'optimization' | 'strategyAnalysis' | 'psychology' | 'insights' | 'routines' | 'accounts' | 'playbook'
