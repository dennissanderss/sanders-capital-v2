// ─────────────────────────────────────────────────────────────
// Sanders Capital — Fundamental Briefing: constants
// Eigen, zelfstandige set zodat de oude FX-desk tool onaangeroerd blijft.
// ─────────────────────────────────────────────────────────────

export const MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'] as const
export type Major = (typeof MAJORS)[number]

export const PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD',
  'USD/CAD', 'USD/CHF', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
  'AUD/JPY', 'NZD/JPY', 'CAD/JPY', 'EUR/AUD', 'GBP/AUD',
  'AUD/NZD', 'EUR/CHF', 'GBP/CHF', 'EUR/CAD', 'GBP/NZD',
  'AUD/CAD',
]

export const PAIR_SYMBOLS: Record<string, string> = {
  'EUR/USD': 'EURUSD=X', 'GBP/USD': 'GBPUSD=X', 'USD/JPY': 'USDJPY=X',
  'AUD/USD': 'AUDUSD=X', 'NZD/USD': 'NZDUSD=X', 'USD/CAD': 'USDCAD=X',
  'USD/CHF': 'USDCHF=X', 'EUR/GBP': 'EURGBP=X', 'EUR/JPY': 'EURJPY=X',
  'GBP/JPY': 'GBPJPY=X', 'AUD/JPY': 'AUDJPY=X', 'NZD/JPY': 'NZDJPY=X',
  'CAD/JPY': 'CADJPY=X', 'EUR/AUD': 'EURAUD=X', 'GBP/AUD': 'GBPAUD=X',
  'AUD/NZD': 'AUDNZD=X', 'EUR/CHF': 'EURCHF=X', 'GBP/CHF': 'GBPCHF=X',
  'EUR/CAD': 'EURCAD=X', 'GBP/NZD': 'GBPNZD=X', 'AUD/CAD': 'AUDCAD=X',
}

// Yahoo-encoded intermarket symbols (sp500/vix/gold/us10y/dxy).
export const INTERMARKET_SYMBOLS: Record<string, string> = {
  sp500: '%5EGSPC', vix: '%5EVIX', gold: 'GC%3DF', us10y: '%5ETNX', dxy: 'DX-Y.NYB',
}

// De horizons (handelsdagen) waarop elke call directioneel wordt beoordeeld.
export const HORIZONS = [1, 3, 5, 10, 20] as const
export type Horizon = (typeof HORIZONS)[number]

// Centralebank-bias → score. Identiek aan de oude tool (must stay in sync).
export const BIAS_SCORES: Record<string, number> = {
  hawkish: 2, verkrappend: 2,
  'voorzichtig verkrappend': 1.5,
  afwachtend: 0, neutraal: 0, neutral: 0,
  'voorzichtig verruimend': -1,
  dovish: -2, verruimend: -2,
}

// Fundamentele drempel om een paar als "call" (duidelijke bias) te tellen.
export const FUND_GATE = 2.0
// Max aantal calls per dag dat we opslaan (hoogste conviction eerst).
export const MAX_CALLS_PER_DAY = 8
