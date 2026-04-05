// ─── Single Source of Truth: FX Pairs & Symbols ─────────────
// Importeer overal: import { PAIR_SYMBOLS, PAIRS, CURRENCIES } from '@/lib/constants/pairs'

export const PAIR_SYMBOLS: Record<string, string> = {
  'EUR/USD': 'EURUSD=X',
  'GBP/USD': 'GBPUSD=X',
  'USD/JPY': 'USDJPY=X',
  'AUD/USD': 'AUDUSD=X',
  'NZD/USD': 'NZDUSD=X',
  'USD/CAD': 'USDCAD=X',
  'USD/CHF': 'USDCHF=X',
  'EUR/GBP': 'EURGBP=X',
  'EUR/JPY': 'EURJPY=X',
  'GBP/JPY': 'GBPJPY=X',
  'AUD/JPY': 'AUDJPY=X',
  'NZD/JPY': 'NZDJPY=X',
  'CAD/JPY': 'CADJPY=X',
  'EUR/AUD': 'EURAUD=X',
  'GBP/AUD': 'GBPAUD=X',
  'AUD/NZD': 'AUDNZD=X',
  'EUR/CHF': 'EURCHF=X',
  'GBP/CHF': 'GBPCHF=X',
  'EUR/CAD': 'EURCAD=X',
  'GBP/NZD': 'GBPNZD=X',
  'AUD/CAD': 'AUDCAD=X',
}

export const PAIRS = Object.keys(PAIR_SYMBOLS)

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']

export const SAFE_HAVENS = ['JPY', 'CHF']
export const HIGH_YIELD = ['AUD', 'NZD', 'CAD']

export const INTERMARKET_SYMBOLS: Record<string, string> = {
  SP500: '%5EGSPC',
  VIX: '%5EVIX',
  GOLD: 'GC%3DF',
  US10Y: '%5ETNX',
  OIL: 'CL%3DF',
  DXY: 'DX-Y.NYB',
}

export function getPipSize(pair: string): number {
  return pair.includes('JPY') ? 0.01 : 0.0001
}
