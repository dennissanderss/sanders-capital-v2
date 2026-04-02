// ─── FX Edge Extraction Engine v3 — Tradeability Filter ──
// Determines if a pair signal is tradeable based on:
// 1. Price extension (5d move vs 20d ATR)
// 2. Event risk (high-impact event within 24h)
// 3. Conflicting intermarket signals
// 4. Minimum conviction threshold
//
// Lookback: 5 days (optimizer optimal), Hold: 3 days
// Output: tradeable | conditional | not_tradeable
// ──────────────────────────────────────────────────────────

import type {
  PriceHistory, CalendarEvent, IntermarketScore,
  TradeabilityResult, Tradeability,
} from './types'
import { THRESHOLDS, PIP_MULTIPLIER } from './constants'

interface PriceMomentum {
  direction: 'up' | 'down' | 'flat'
  pips1d: number
  pips5d: number
  atr20d: number
  extensionRatio: number
}

export function calculatePriceMomentum(
  pair: string,
  history: PriceHistory[]
): PriceMomentum {
  const mult = PIP_MULTIPLIER[pair] || 10000

  if (history.length < 21) {
    return { direction: 'flat', pips1d: 0, pips5d: 0, atr20d: 0, extensionRatio: 0 }
  }

  const recent = history.slice(-21)

  // 1d move
  const last = recent[recent.length - 1].close
  const prev1d = recent[recent.length - 2].close
  const pips1d = Math.round((last - prev1d) * mult)

  // 5d move (optimizer optimal lookback)
  const prev5d = recent.length >= 6 ? recent[recent.length - 6].close : prev1d
  const pips5d = Math.round((last - prev5d) * mult)

  // 20d ATR (average true range approximation using daily ranges)
  let atrSum = 0
  for (let i = 1; i < recent.length; i++) {
    atrSum += Math.abs(recent[i].close - recent[i - 1].close) * mult
  }
  const atr20d = Math.round(atrSum / (recent.length - 1))

  const extensionRatio = atr20d > 0 ? Math.round(Math.abs(pips5d) / atr20d * 100) / 100 : 0

  // Direction based on 5d lookback (contrarian signal window)
  // Threshold relative to ATR for pair-agnostic comparison
  const dirThreshold = Math.max(5, Math.round(atr20d * 0.3))
  const direction: 'up' | 'down' | 'flat' =
    pips5d > dirThreshold ? 'up' : pips5d < -dirThreshold ? 'down' : 'flat'

  return { direction, pips1d, pips5d, atr20d, extensionRatio }
}

export function assessTradeability(
  pair: string,
  conviction: number,
  momentum: PriceMomentum,
  intermarket: IntermarketScore,
  calendar: CalendarEvent[],
  signalDate?: string
): TradeabilityResult {
  const reasons: string[] = []
  let blockers = 0
  let warnings = 0

  // 1. Extension check
  const extensionWarning = momentum.extensionRatio > THRESHOLDS.extensionWarning
  if (extensionWarning) {
    warnings++
    reasons.push(`Prijs overextended (${momentum.extensionRatio.toFixed(1)}x ATR in 5d)`)
  }
  if (momentum.extensionRatio > THRESHOLDS.mrDangerExtension) {
    blockers++
    reasons.push(`Extreme extensie (${momentum.extensionRatio.toFixed(1)}x ATR) — wacht op terugval`)
  }

  // 2. Event risk
  const [base, quote] = pair.split('/')
  const now = signalDate ? new Date(signalDate) : new Date()
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const nowStr = now.toISOString().split('T')[0]
  const nextStr = next24h.toISOString().split('T')[0]

  const upcomingHighImpact = calendar.filter(e => {
    const eCcy = e.country?.toUpperCase()
    if (eCcy !== base && eCcy !== quote) return false
    if (e.impact !== 'High') return false
    const eDate = e.date?.split('T')[0] || ''
    return eDate >= nowStr && eDate <= nextStr
  })

  const eventRisk = upcomingHighImpact.length > 0
  if (eventRisk) {
    warnings++
    const eventNames = upcomingHighImpact.slice(0, 2).map(e => e.title).join(', ')
    reasons.push(`Event risico: ${eventNames}`)
  }

  // Check for rate decisions (critical events that block trading)
  const rateDecision = upcomingHighImpact.some(e =>
    e.title.toLowerCase().includes('rate') || e.title.toLowerCase().includes('monetary')
  )
  if (rateDecision) {
    blockers++
    reasons.push('Rentebeslissing nadert — niet handelen')
  }

  // 3. Intermarket conflict
  const conflictingIM = intermarket.alignment < THRESHOLDS.imContradiction
  if (conflictingIM) {
    warnings++
    reasons.push(`Intermarket tegenstrijdig (${intermarket.alignment}% alignment)`)
  }

  // 4. Conviction check
  if (conviction < THRESHOLDS.minConviction) {
    blockers++
    reasons.push(`Overtuiging te laag (${conviction}%)`)
  }

  // Determine tradeability status
  let status: Tradeability
  if (blockers > 0) {
    status = 'not_tradeable'
  } else if (warnings >= 2) {
    status = 'conditional'
    reasons.push('Meerdere waarschuwingen — verlaag positiegrootte')
  } else if (warnings === 1) {
    status = 'conditional'
    reasons.push('Één waarschuwing — handel met extra voorzichtigheid')
  } else {
    status = 'tradeable'
    reasons.push('Alle filters doorstaan')
  }

  return { status, reasons, extensionWarning, eventRisk, conflictingIM }
}
