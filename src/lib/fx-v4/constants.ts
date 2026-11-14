// ─────────────────────────────────────────────────────────────
// FX v4 (schaduwmodus) — constanten
//
// De v4-engine implementeert exact het pakket dat de chronologische
// 70/30-toets overleefde (docs/audit/fundamental-audit.md, fase 4):
// contrarian op voltooide dag-candles, alleen waar het 5-daagse
// momentum van het 2-jaars renteverschil dezelfde kant op wijst.
// Geen entries, geen SL/TP: bias en onderbouwing.
// ─────────────────────────────────────────────────────────────

export const ENGINE_VERSION = 'v4.0-shadow'

// Alleen paren waarvan BEIDE benen een geverifieerde dagelijkse
// rentereeks hebben (fase 4): USD, EUR, JPY, CAD, AUD (2-jaars) en
// GBP (5-jaars — geen gratis dagelijkse 2-jaars gilt-reeks gevonden).
// CHF- en NZD-paren vallen buiten v4 tot er een bron voor is.
export const V4_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'] as const

export const V4_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'CAD/JPY',
  'EUR/AUD', 'GBP/AUD', 'EUR/CAD', 'AUD/CAD',
] as const

export const V4_PAIR_SYMBOLS: Record<string, string> = {
  'EUR/USD': 'EURUSD=X', 'GBP/USD': 'GBPUSD=X', 'USD/JPY': 'USDJPY=X',
  'AUD/USD': 'AUDUSD=X', 'USD/CAD': 'USDCAD=X', 'EUR/GBP': 'EURGBP=X',
  'EUR/JPY': 'EURJPY=X', 'GBP/JPY': 'GBPJPY=X', 'AUD/JPY': 'AUDJPY=X',
  'CAD/JPY': 'CADJPY=X', 'EUR/AUD': 'EURAUD=X', 'GBP/AUD': 'GBPAUD=X',
  'EUR/CAD': 'EURCAD=X', 'AUD/CAD': 'AUDCAD=X',
}

// Meetdefinitie (identiek aan de auditdataset, fase 1):
// referentie = slotkoers van de call-dag (eerste voltooide candle op/na de
// call-datum, dus volledig ná publicatie); horizon n = n voltooide
// handelsdagen later; "klopt" vanaf de drempel in callrichting.
export const V4_HORIZONS = [1, 3, 5, 10, 20] as const
export type V4Horizon = (typeof V4_HORIZONS)[number]

export const pipMultV4 = (pair: string): number => (pair.includes('JPY') ? 100 : 10000)
export const pipDrempel = (pair: string): number => (pair.includes('JPY') ? 50 : 30)

// Metingtekst die bij elke call wordt vastgelegd (zelfverklarend record).
export const V4_METING =
  'referentie = slotkoers van de call-dag; horizons 1/3/5/10/20 voltooide ' +
  'handelsdagen, close-to-close; drempel 30 pips (50 voor JPY-paren); geen TP/SL'
