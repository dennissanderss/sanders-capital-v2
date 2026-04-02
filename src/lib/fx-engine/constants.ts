// ─── FX Edge Extraction Engine v3 — Constants ───────────
// Pair-specific intermarket weights, currency properties,
// regime weight profiles, and scoring thresholds.
// ──────────────────────────────────────────────────────────

import type { CurrencyFactors, SubRegime } from './types'

export const VERSION = 'v3.0'

// ─── Currency Properties ─────────────────────────────────
export const MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'] as const
export type Major = typeof MAJORS[number]

export const PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD',
  'USD/CAD', 'USD/CHF', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
  'AUD/JPY', 'NZD/JPY', 'CAD/JPY', 'EUR/AUD', 'GBP/AUD',
  'AUD/NZD', 'EUR/CHF', 'GBP/CHF', 'EUR/CAD', 'GBP/NZD',
  'AUD/CAD',
] as const

export const PAIR_SYMBOLS: Record<string, string> = {
  'EUR/USD': 'EURUSD=X', 'GBP/USD': 'GBPUSD=X', 'USD/JPY': 'USDJPY=X',
  'AUD/USD': 'AUDUSD=X', 'NZD/USD': 'NZDUSD=X', 'USD/CAD': 'USDCAD=X',
  'USD/CHF': 'USDCHF=X', 'EUR/GBP': 'EURGBP=X', 'EUR/JPY': 'EURJPY=X',
  'GBP/JPY': 'GBPJPY=X', 'AUD/JPY': 'AUDJPY=X', 'NZD/JPY': 'NZDJPY=X',
  'CAD/JPY': 'CADJPY=X', 'EUR/AUD': 'EURAUD=X', 'GBP/AUD': 'GBPAUD=X',
  'AUD/NZD': 'AUDNZD=X', 'EUR/CHF': 'EURCHF=X', 'GBP/CHF': 'GBPCHF=X',
  'EUR/CAD': 'EURCAD=X', 'GBP/NZD': 'GBPNZD=X', 'AUD/CAD': 'AUDCAD=X',
}

export const INTERMARKET_SYMBOLS: Record<string, string> = {
  sp500: '%5EGSPC', vix: '%5EVIX', gold: 'GC%3DF',
  us10y: '%5ETNX', oil: 'CL%3DF', dxy: 'DX-Y.NYB',
}

// ─── Currency Classification ─────────────────────────────
export const SAFE_HAVENS: Major[] = ['JPY', 'CHF', 'USD']
export const HIGH_YIELD: Major[] = ['AUD', 'NZD', 'CAD']
export const COMMODITY_CURRENCIES: Major[] = ['AUD', 'NZD', 'CAD']

// Commodity sensitivity: positive = rises with commodity prices
export const COMMODITY_SENSITIVITY: Record<Major, number> = {
  AUD: 0.8,   // Iron ore, gold
  NZD: 0.5,   // Dairy, soft commodities
  CAD: 0.9,   // Oil
  USD: -0.3,  // Inverse (oil up = USD down slightly)
  EUR: -0.1,  // Minor inverse
  GBP: 0.1,   // Minor positive (oil producer)
  JPY: -0.6,  // Oil importer
  CHF: 0.0,   // Neutral
}

// Haven sensitivity: positive = benefits from risk-off
export const HAVEN_SENSITIVITY: Record<Major, number> = {
  JPY: 0.9,
  CHF: 0.8,
  USD: 0.5,
  EUR: 0.1,
  GBP: -0.2,
  AUD: -0.7,
  NZD: -0.7,
  CAD: -0.5,
}

// ─── Pair-Specific Intermarket Weights ───────────────────
// Which intermarket instruments matter most for each pair.
// Weights 0-1, should sum to roughly 1.0 per pair.
export const PAIR_IM_WEIGHTS: Record<string, Record<string, number>> = {
  'EUR/USD': { dxy: 0.35, us10y: 0.25, sp500: 0.20, gold: 0.10, vix: 0.10 },
  'GBP/USD': { dxy: 0.30, us10y: 0.25, sp500: 0.20, oil: 0.15, vix: 0.10 },
  'USD/JPY': { us10y: 0.40, sp500: 0.25, vix: 0.20, gold: 0.15 },
  'AUD/USD': { sp500: 0.25, gold: 0.25, oil: 0.20, vix: 0.15, dxy: 0.15 },
  'NZD/USD': { sp500: 0.30, dxy: 0.20, vix: 0.20, gold: 0.15, oil: 0.15 },
  'USD/CAD': { oil: 0.45, us10y: 0.20, sp500: 0.15, dxy: 0.10, vix: 0.10 },
  'USD/CHF': { gold: 0.30, vix: 0.25, us10y: 0.20, sp500: 0.15, dxy: 0.10 },
  'EUR/GBP': { oil: 0.20, us10y: 0.20, sp500: 0.20, gold: 0.20, vix: 0.20 },
  'EUR/JPY': { sp500: 0.30, vix: 0.25, us10y: 0.20, gold: 0.15, oil: 0.10 },
  'GBP/JPY': { sp500: 0.30, vix: 0.25, us10y: 0.20, oil: 0.15, gold: 0.10 },
  'AUD/JPY': { sp500: 0.30, vix: 0.25, gold: 0.20, oil: 0.15, us10y: 0.10 },
  'NZD/JPY': { sp500: 0.30, vix: 0.25, gold: 0.20, oil: 0.15, us10y: 0.10 },
  'CAD/JPY': { oil: 0.35, sp500: 0.25, vix: 0.20, us10y: 0.10, gold: 0.10 },
  'EUR/AUD': { gold: 0.25, sp500: 0.25, oil: 0.20, vix: 0.15, us10y: 0.15 },
  'GBP/AUD': { gold: 0.25, sp500: 0.25, oil: 0.20, vix: 0.15, us10y: 0.15 },
  'AUD/NZD': { gold: 0.30, oil: 0.25, sp500: 0.20, vix: 0.15, us10y: 0.10 },
  'EUR/CHF': { gold: 0.25, vix: 0.25, sp500: 0.20, us10y: 0.20, oil: 0.10 },
  'GBP/CHF': { gold: 0.25, vix: 0.25, sp500: 0.20, us10y: 0.15, oil: 0.15 },
  'EUR/CAD': { oil: 0.35, sp500: 0.20, us10y: 0.15, gold: 0.15, vix: 0.15 },
  'GBP/NZD': { sp500: 0.25, oil: 0.20, gold: 0.20, vix: 0.20, us10y: 0.15 },
  'AUD/CAD': { oil: 0.35, gold: 0.25, sp500: 0.20, vix: 0.10, us10y: 0.10 },
}

// Expected IM direction for bullish base. E.g. for USD/JPY bullish:
// us10y should go up (positive correlation)
export const PAIR_IM_DIRECTION: Record<string, Record<string, 'positive' | 'negative'>> = {
  'EUR/USD': { dxy: 'negative', us10y: 'negative', sp500: 'positive', gold: 'positive', vix: 'negative' },
  'GBP/USD': { dxy: 'negative', us10y: 'negative', sp500: 'positive', oil: 'positive', vix: 'negative' },
  'USD/JPY': { us10y: 'positive', sp500: 'positive', vix: 'negative', gold: 'negative' },
  'AUD/USD': { sp500: 'positive', gold: 'positive', oil: 'positive', vix: 'negative', dxy: 'negative' },
  'NZD/USD': { sp500: 'positive', dxy: 'negative', vix: 'negative', gold: 'positive', oil: 'positive' },
  'USD/CAD': { oil: 'negative', us10y: 'positive', sp500: 'negative', dxy: 'positive', vix: 'positive' },
  'USD/CHF': { gold: 'negative', vix: 'negative', us10y: 'positive', sp500: 'positive', dxy: 'positive' },
  'EUR/GBP': { oil: 'negative', us10y: 'negative', sp500: 'positive', gold: 'positive', vix: 'positive' },
  'EUR/JPY': { sp500: 'positive', vix: 'negative', us10y: 'positive', gold: 'negative', oil: 'positive' },
  'GBP/JPY': { sp500: 'positive', vix: 'negative', us10y: 'positive', oil: 'positive', gold: 'negative' },
  'AUD/JPY': { sp500: 'positive', vix: 'negative', gold: 'positive', oil: 'positive', us10y: 'positive' },
  'NZD/JPY': { sp500: 'positive', vix: 'negative', gold: 'positive', oil: 'positive', us10y: 'positive' },
  'CAD/JPY': { oil: 'positive', sp500: 'positive', vix: 'negative', us10y: 'positive', gold: 'negative' },
  'EUR/AUD': { gold: 'negative', sp500: 'negative', oil: 'negative', vix: 'positive', us10y: 'negative' },
  'GBP/AUD': { gold: 'negative', sp500: 'negative', oil: 'negative', vix: 'positive', us10y: 'negative' },
  'AUD/NZD': { gold: 'positive', oil: 'positive', sp500: 'positive', vix: 'negative', us10y: 'positive' },
  'EUR/CHF': { gold: 'negative', vix: 'negative', sp500: 'positive', us10y: 'positive', oil: 'positive' },
  'GBP/CHF': { gold: 'negative', vix: 'negative', sp500: 'positive', us10y: 'positive', oil: 'positive' },
  'EUR/CAD': { oil: 'negative', sp500: 'positive', us10y: 'negative', gold: 'positive', vix: 'positive' },
  'GBP/NZD': { sp500: 'negative', oil: 'negative', gold: 'negative', vix: 'positive', us10y: 'negative' },
  'AUD/CAD': { oil: 'negative', gold: 'positive', sp500: 'positive', vix: 'negative', us10y: 'positive' },
}

// ─── Sub-Regime Weight Profiles ──────────────────────────
// Weights for each currency factor depending on sub-regime.
// These determine WHAT MATTERS in the current market environment.
export const REGIME_WEIGHTS: Record<SubRegime, CurrencyFactors> = {
  growth_scare: {
    cb: 1.0,
    inflation: 0.5,
    growth: 2.0,       // Growth data is king
    sentiment: 1.5,
    commodity: 1.0,
    haven: 1.5,         // Haven flows matter
    momentum: 0.8,
  },
  geopolitical_stress: {
    cb: 0.5,            // CB less relevant during geopolitical events
    inflation: 0.3,
    growth: 0.5,
    sentiment: 2.0,     // News sentiment dominates
    commodity: 1.5,     // Oil/gold spike matters
    haven: 2.0,         // Haven flows are the primary driver
    momentum: 1.0,
  },
  inflation_fear: {
    cb: 2.0,            // CB response to inflation is critical
    inflation: 2.0,     // Inflation data is the primary driver
    growth: 0.5,
    sentiment: 1.0,
    commodity: 1.5,     // Oil/energy drives inflation
    haven: 0.5,
    momentum: 0.8,
  },
  rate_repricing: {
    cb: 2.0,            // CB signals drive everything
    inflation: 1.0,
    growth: 1.0,
    sentiment: 1.0,
    commodity: 0.5,
    haven: 0.5,
    momentum: 1.5,      // Momentum follows repricing fast
  },
  risk_appetite: {
    cb: 1.0,
    inflation: 0.5,
    growth: 1.5,
    sentiment: 1.5,
    commodity: 1.0,
    haven: -0.5,        // Havens weaken in risk-on
    momentum: 1.5,      // Trend following works in risk-on
  },
  range_chop: {
    cb: 1.5,            // Fundamentals matter but weakly
    inflation: 1.0,
    growth: 1.0,
    sentiment: 0.5,     // Noise in sentiment
    commodity: 0.5,
    haven: 0.5,
    momentum: 0.3,      // Momentum is unreliable in chop
  },
}

// ─── Scoring Thresholds ──────────────────────────────────
export const THRESHOLDS = {
  // Pair score difference for signal strength
  strongSignal: 3.5,      // "sterk" conviction
  moderateSignal: 2.0,    // "matig" conviction
  weakSignal: 0.5,        // "licht" conviction — below this = no_trade

  // Mean reversion: extension ratio thresholds
  mrEntryExtension: 1.2,  // 3d move > 1.2x ATR = potential MR
  mrDangerExtension: 2.0, // 3d move > 2.0x ATR = too extended, wait

  // Tradeability
  extensionWarning: 1.5,  // ATR ratio for extension warning
  minConviction: 30,      // Minimum conviction score to be tradeable

  // Intermarket
  imStrongConfirm: 70,    // IM alignment > 70% = strong confirmation
  imContradiction: 30,    // IM alignment < 30% = contradiction

  // Minimum number of confirming factors
  minFactors: 3,          // At least 3 factors must align
} as const

// ─── Bias Score Mapping ──────────────────────────────────
export const BIAS_SCORES: Record<string, number> = {
  'verkrappend': 2,
  'hawkish': 2,
  'voorzichtig verkrappend': 1.5,
  'afwachtend': 0,
  'neutraal': 0,
  'voorzichtig verruimend': -1,
  'verruimend': -2,
  'dovish': -2,
}

// ─── Pip Values (approximate, for ATR calculations) ──────
export const PIP_MULTIPLIER: Record<string, number> = {
  'EUR/USD': 10000, 'GBP/USD': 10000, 'AUD/USD': 10000,
  'NZD/USD': 10000, 'USD/CAD': 10000, 'USD/CHF': 10000,
  'EUR/GBP': 10000, 'EUR/AUD': 10000, 'GBP/AUD': 10000,
  'AUD/NZD': 10000, 'EUR/CHF': 10000, 'GBP/CHF': 10000,
  'EUR/CAD': 10000, 'GBP/NZD': 10000, 'AUD/CAD': 10000,
  // JPY pairs: 1 pip = 0.01
  'USD/JPY': 100, 'EUR/JPY': 100, 'GBP/JPY': 100,
  'AUD/JPY': 100, 'NZD/JPY': 100, 'CAD/JPY': 100,
}
