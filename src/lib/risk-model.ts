// ═══════════════════════════════════════════════════════════════
// Risk Model
// Sanders Capital — Position Sizing, Exposure & Hold Duration
// ═══════════════════════════════════════════════════════════════

import { type Verdict, type RiskCalculation, getCorrelationGroup } from './execution-types'

// ─── Constants ───────────────────────────────────────────────

const RISK_PER_TRADE: Record<Verdict, number> = {
  HIGH_CONVICTION: 0.015,  // 1.5% of account
  VALID: 0.01,             // 1.0% of account
  WATCHLIST: 0,            // no trade
  SKIP: 0,                 // no trade
}

const MAX_TOTAL_RISK = 0.04          // 4% max total open risk
const MAX_TRADES_PER_CORR_GROUP = 1  // 1 trade per correlation group
const MAX_CONCURRENT_TRADES = 3      // max 3 open positions
const MAX_DAILY_LOSS = 0.03          // 3% daily loss limit

// ─── Pip Size ────────────────────────────────────────────────

export function getPipSize(pair: string): number {
  return pair.includes('JPY') ? 0.01 : 0.0001
}

export function getPipValue(pair: string, lotSize: number = 1): number {
  // Approximate pip value per standard lot
  // For USD-quoted pairs: 1 pip = $10 per standard lot
  // For JPY pairs: ~$6.5 per standard lot (approximate)
  // For other crosses: varies, we use $10 as default
  if (pair.includes('JPY')) return 1000 * lotSize // ~$6.5 per pip per mini lot
  return 10 * lotSize // $10 per pip per standard lot (USD pairs)
}

// ─── Position Sizing ─────────────────────────────────────────

export function calculatePositionSize(
  accountBalance: number,
  verdict: Verdict,
  entryPrice: number,
  slPrice: number,
  pair: string,
): RiskCalculation | null {
  const riskPct = RISK_PER_TRADE[verdict]
  if (riskPct === 0) return null

  const pipSize = getPipSize(pair)
  const slDistancePips = Math.abs(entryPrice - slPrice) / pipSize

  if (slDistancePips === 0) return null

  const riskAmount = accountBalance * riskPct
  const pipValue = getPipValue(pair, 1) // per standard lot
  const positionSizeLots = Math.round((riskAmount / (slDistancePips * pipValue)) * 100) / 100

  // Risk/Reward ratios (from entry to SL distance)
  const rrRatio1 = 2.0
  const rrRatio2 = 3.0

  // Estimated hold duration based on timeframe
  // 1H chart, 1:2 RR → typically 12-48 hours
  const estimatedHoldHours = Math.round(slDistancePips * 0.5) // rough estimate

  return {
    positionSizeLots: Math.max(0.01, positionSizeLots), // minimum 0.01 lots
    riskAmount: Math.round(riskAmount * 100) / 100,
    riskPercent: riskPct * 100,
    slDistancePips: Math.round(slDistancePips * 10) / 10,
    rrRatio1,
    rrRatio2,
    estimatedHoldHours: Math.max(4, Math.min(120, estimatedHoldHours)),
  }
}

// ─── Exposure Checks ─────────────────────────────────────────

interface OpenPosition {
  pair: string
  riskPercent: number
}

export function checkCorrelationExposure(
  newPair: string,
  openPositions: OpenPosition[],
): { allowed: boolean; reason: string } {
  const newGroup = getCorrelationGroup(newPair)

  // Check max concurrent trades
  if (openPositions.length >= MAX_CONCURRENT_TRADES) {
    return { allowed: false, reason: `Max ${MAX_CONCURRENT_TRADES} gelijktijdige trades bereikt` }
  }

  // Check correlation group
  const sameGroupCount = openPositions.filter(p => getCorrelationGroup(p.pair) === newGroup).length
  if (sameGroupCount >= MAX_TRADES_PER_CORR_GROUP) {
    return { allowed: false, reason: `Al ${sameGroupCount} trade(s) open in "${newGroup}" groep` }
  }

  // Check total risk
  const totalRisk = openPositions.reduce((sum, p) => sum + p.riskPercent, 0)
  if (totalRisk >= MAX_DAILY_LOSS * 100) {
    return { allowed: false, reason: `Dagelijks verlies limiet (${MAX_DAILY_LOSS * 100}%) bereikt` }
  }

  if (totalRisk >= MAX_TOTAL_RISK * 100) {
    return { allowed: false, reason: `Max totaal risico (${MAX_TOTAL_RISK * 100}%) bereikt` }
  }

  return { allowed: true, reason: 'Exposure OK' }
}

// ─── Hold Duration Estimate ──────────────────────────────────

export function estimateHoldDuration(
  timeframe: string,
  rrTarget: number,
): { minHours: number; maxHours: number; label: string } {
  const tfHours: Record<string, number> = {
    '15': 0.25, '30': 0.5, '60': 1, '240': 4, 'D': 24,
  }
  const baseTf = tfHours[timeframe] || 1

  // Rough estimate: RR target * 4-8 bars to reach TP
  const minBars = Math.round(rrTarget * 4)
  const maxBars = Math.round(rrTarget * 8)

  const minHours = Math.round(minBars * baseTf)
  const maxHours = Math.round(maxBars * baseTf)

  let label = ''
  if (maxHours < 24) label = `${minHours}-${maxHours} uur`
  else if (maxHours < 168) label = `${Math.round(minHours / 24)}-${Math.round(maxHours / 24)} dagen`
  else label = `${Math.round(minHours / 168)}-${Math.round(maxHours / 168)} weken`

  return { minHours, maxHours, label }
}
