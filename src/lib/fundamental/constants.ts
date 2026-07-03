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

// ─── Methodiek v2 (bias/timing-splitsing, kalender, grondstoffen) ──────

// Markering in breakdown/reasoning zodat v1- en v2-calls in het trackrecord
// uit elkaar te houden zijn. v2 live sinds 2026-07-03.
export const MODEL_VERSION = 'v2'
export const MODEL_V2_SINCE = '2026-07-03'

// Grondstoffen-proxy per commodity-valuta (5d-verandering → terms-of-trade).
export const COMMODITY_SYMBOLS: Record<string, { symbol: string; name: string }> = {
  AUD: { symbol: 'HG=F', name: 'Koper' },
  CAD: { symbol: 'CL=F', name: 'Olie (WTI)' },
  NZD: { symbol: 'DBA', name: 'Landbouw-index (DBA)' },
}

// Inflatiedoel per centrale bank (midden van de band waar van toepassing).
export const INFLATION_TARGETS: Record<string, number> = {
  USD: 2, EUR: 2, GBP: 2, JPY: 2, CHF: 1, AUD: 2.5, CAD: 2, NZD: 2,
}

// TradingView economic-calendar landcodes per valuta.
export const CCY_COUNTRY: Record<string, string> = {
  USD: 'US', EUR: 'EU', GBP: 'GB', JPY: 'JP', CHF: 'CH', AUD: 'AU', CAD: 'CA', NZD: 'NZ',
}

// Onder deze fractie van de 14d-ATR telt een close-to-close beweging als
// "vlak" (geen win/loss) — alleen weergave/statistiek, DB blijft binair.
export const FLAT_ATR_FRACTION = 0.15
