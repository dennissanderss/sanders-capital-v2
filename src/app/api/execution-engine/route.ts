// ═══════════════════════════════════════════════════════════════
// Execution Engine API
// Sanders Capital — Fundamental + Technical Integration
//
// Combines fundamental bias (from briefing-v2) with technical
// state (from TradingView Pine Script) into composite scores
// and trade verdicts.
//
// GET:  Returns fundamental layer + scoring for all 21 pairs
//       (technical data provided via query params or body)
// POST: Accepts technical scan results and returns full verdicts
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import type {
  FundamentalBias,
  RegimeContext,
  TechnicalState,
  ScoringBreakdown,
  TechnicalScoreDetail,
  Verdict,
  VerdictReason,
  ExecutionSignal,
} from '@/lib/execution-types'
import { getCorrelationGroup, ALL_PAIRS } from '@/lib/execution-types'
import { calculatePositionSize } from '@/lib/risk-model'

// ─── Scoring Logic ───────────────────────────────────────────

function calculateTechnicalScore(
  fund: FundamentalBias,
  tech: TechnicalState,
): { score: number; detail: TechnicalScoreDetail } {
  const fundDirection = fund.direction.includes('bullish') ? 'BULLISH' : fund.direction.includes('bearish') ? 'BEARISH' : 'NEUTRAL'

  // 1. HTF Alignment (0 or 1.0) — does HTF structure match fundamental direction?
  const htfAlignment = (
    (fundDirection === 'BULLISH' && tech.htfBias === 'BULLISH') ||
    (fundDirection === 'BEARISH' && tech.htfBias === 'BEARISH')
  ) ? 1.0 : 0

  // 2. Fib Zone Position (0 or 1.0) — is price in the correct discount/premium zone?
  const fibZonePosition = tech.fibZoneValid ? 1.0 : 0

  // 3. LTF Confirmation (0 or 1.0) — enough structure breaks in the right direction?
  const requiredBreaks = 2
  const ltfConfirmation = (
    (tech.direction === 'LONG' && tech.bullBreaks >= requiredBreaks) ||
    (tech.direction === 'SHORT' && tech.bearBreaks >= requiredBreaks)
  ) ? 1.0 : 0

  // 4. ATR Context (0 or 0.5) — is volatility in normal range?
  // We don't have ATR from the table output, so we default to 0.5 if setup is valid
  const atrContext = tech.setupStatus === 'VALID_SETUP' ? 0.5 : 0

  const detail: TechnicalScoreDetail = { htfAlignment, fibZonePosition, ltfConfirmation, atrContext }
  const score = htfAlignment + fibZonePosition + ltfConfirmation + atrContext

  return { score, detail }
}

function calculateRegimeScore(
  fund: FundamentalBias,
  regime: RegimeContext,
): number {
  const isBullish = fund.direction.includes('bullish')
  const isBearish = fund.direction.includes('bearish')
  const base = fund.base
  const quote = fund.quote

  const SAFE_HAVENS = ['JPY', 'CHF']
  const HIGH_YIELD = ['AUD', 'NZD', 'CAD']

  if (regime.regime === 'Gemengd') return 0.75

  if (regime.regime === 'Risk-Off') {
    // Bullish safe havens or bearish high yield = aligned
    if (isBullish && SAFE_HAVENS.includes(base)) return 1.5
    if (isBearish && HIGH_YIELD.includes(base)) return 1.5
    if (isBullish && HIGH_YIELD.includes(quote)) return 1.5
    if (isBearish && SAFE_HAVENS.includes(quote)) return 1.5
    // Contradicts regime
    if (isBullish && HIGH_YIELD.includes(base)) return 0
    if (isBearish && SAFE_HAVENS.includes(base)) return 0
    return 0.75 // neutral to regime
  }

  if (regime.regime === 'Risk-On') {
    if (isBullish && HIGH_YIELD.includes(base)) return 1.5
    if (isBearish && SAFE_HAVENS.includes(base)) return 1.5
    if (isBullish && SAFE_HAVENS.includes(quote)) return 1.5
    if (isBearish && HIGH_YIELD.includes(quote)) return 1.5
    if (isBullish && SAFE_HAVENS.includes(base)) return 0
    if (isBearish && HIGH_YIELD.includes(base)) return 0
    return 0.75
  }

  if (regime.regime === 'USD Dominant') {
    if (isBullish && base === 'USD') return 1.5
    if (isBearish && quote === 'USD') return 1.5
    if (isBearish && base === 'USD') return 0
    if (isBullish && quote === 'USD') return 0
    return 0.75
  }

  if (regime.regime === 'USD Zwak') {
    if (isBearish && base === 'USD') return 1.5
    if (isBullish && quote === 'USD') return 1.5
    if (isBullish && base === 'USD') return 0
    if (isBearish && quote === 'USD') return 0
    return 0.75
  }

  return 0.75
}

function calculateCompositeScore(
  fundScore: number,
  techScore: number,
  regimeScore: number,
): ScoringBreakdown {
  // Weights: Fundamental 50%, Technical 35%, Regime 15%
  const fundamentalComponent = Math.min(Math.abs(fundScore) / 5, 1) * 5.0
  const technicalComponent = Math.min(techScore / 3.5, 1) * 3.5
  const regimeComponent = regimeScore

  const compositeScore = Math.round((fundamentalComponent + technicalComponent + regimeComponent) * 10) / 10

  return {
    fundamentalScore: Math.round(fundamentalComponent * 10) / 10,
    technicalScore: Math.round(technicalComponent * 10) / 10,
    regimeScore: Math.round(regimeComponent * 10) / 10,
    compositeScore: Math.min(10, compositeScore),
  }
}

// ─── Decision Logic ──────────────────────────────────────────

function determineVerdict(
  fund: FundamentalBias,
  tech: TechnicalState | null,
  scoring: ScoringBreakdown,
  regime: RegimeContext,
): { verdict: Verdict; reasons: VerdictReason[] } {
  const reasons: VerdictReason[] = []

  // HARD SKIP: fundamental says no-trade
  if (fund.conviction === 'geen' || fund.direction === 'neutraal') {
    reasons.push({ type: 'fundamental', message: 'Geen fundamentele bias (neutraal/geen conviction)' })
    return { verdict: 'SKIP', reasons }
  }

  // HARD SKIP: fundamental too weak
  if (Math.abs(fund.score) < 2.0) {
    reasons.push({ type: 'fundamental', message: `Score te laag (${fund.score}, nodig: ±2.0)` })
    return { verdict: 'SKIP', reasons }
  }

  // If no technical data, return based on fundamentals only
  if (!tech) {
    reasons.push({ type: 'technical', message: 'Technische scan niet uitgevoerd' })
    if (Math.abs(fund.score) >= 3.5 && (fund.conviction === 'sterk' || fund.conviction === 'matig')) {
      reasons.push({ type: 'fundamental', message: `Sterke fundamentele bias (${fund.score})` })
      return { verdict: 'WATCHLIST', reasons }
    }
    return { verdict: 'SKIP', reasons }
  }

  // HARD SKIP: fundamental direction conflicts with HTF bias
  const fundBull = fund.direction.includes('bullish')
  const fundBear = fund.direction.includes('bearish')
  if ((fundBull && tech.htfBias === 'BEARISH') || (fundBear && tech.htfBias === 'BULLISH')) {
    reasons.push({ type: 'technical', message: `HTF structuur (${tech.htfBias}) conflicteert met fundamentele bias (${fund.direction})` })
    return { verdict: 'SKIP', reasons }
  }

  // HTF is ranging — no clear structure
  if (tech.htfBias === 'RANGING') {
    reasons.push({ type: 'technical', message: 'HTF structuur is RANGING — geen duidelijke trend' })
    if (Math.abs(fund.score) >= 3.5) {
      return { verdict: 'WATCHLIST', reasons }
    }
    return { verdict: 'SKIP', reasons }
  }

  // WATCHLIST: setup is approaching but not valid yet
  if (tech.setupStatus === 'APPROACHING') {
    reasons.push({ type: 'technical', message: 'Prijs nadert fib zone — nog geen LTF bevestiging' })
    return { verdict: 'WATCHLIST', reasons }
  }

  if (tech.setupStatus === 'WAITING_FOR_ZONE') {
    reasons.push({ type: 'technical', message: 'Wacht tot prijs de fib zone bereikt' })
    return { verdict: 'WATCHLIST', reasons }
  }

  if (tech.setupStatus !== 'VALID_SETUP') {
    reasons.push({ type: 'technical', message: `Setup status: ${tech.setupStatus}` })
    return { verdict: 'SKIP', reasons }
  }

  // VALID_SETUP reached — determine conviction level
  reasons.push({ type: 'fundamental', message: `Fundamentele bias: ${fund.direction} (score ${fund.score > 0 ? '+' : ''}${fund.score})` })
  reasons.push({ type: 'technical', message: `HTF ${tech.htfBias}, fib zone valid, ${tech.direction === 'LONG' ? tech.bullBreaks : tech.bearBreaks}x LTF break` })

  // HIGH CONVICTION: composite >= 8, strong fundamental, regime aligned
  if (scoring.compositeScore >= 8.0 && fund.conviction === 'sterk' && scoring.regimeScore >= 1.0) {
    reasons.push({ type: 'regime', message: `Regime (${regime.regime}) bevestigt richting` })
    return { verdict: 'HIGH_CONVICTION', reasons }
  }

  // VALID: composite >= 6
  if (scoring.compositeScore >= 6.0) {
    return { verdict: 'VALID', reasons }
  }

  // Below threshold — watchlist
  reasons.push({ type: 'technical', message: `Composite score (${scoring.compositeScore}) onder drempel (6.0)` })
  return { verdict: 'WATCHLIST', reasons }
}

// ─── Parse Pine Table Output ─────────────────────────────────

export function parseTechnicalState(rows: string[]): TechnicalState {
  const getValue = (key: string): string => {
    const row = rows.find(r => r.startsWith(key))
    return row?.split('|')[1]?.trim() ?? ''
  }

  const slTpStr = getValue('SL|TP1|TP2').split('|')

  return {
    htfBias: getValue('HTF Bias') as TechnicalState['htfBias'] || 'RANGING',
    swingHigh: parseFloat(getValue('Swing High')) || null,
    swingLow: parseFloat(getValue('Swing Low')) || null,
    fibPrice: parseFloat(getValue('0.5 Fib')) || null,
    priceVsFib: getValue('Price vs Fib') as TechnicalState['priceVsFib'] || 'UNKNOWN',
    fibZoneValid: getValue('Fib Zone Valid') === 'YES',
    bullBreaks: parseInt(getValue('Bull Breaks')) || 0,
    bearBreaks: parseInt(getValue('Bear Breaks')) || 0,
    setupStatus: getValue('Setup') as TechnicalState['setupStatus'] || 'NO_SETUP',
    direction: getValue('Direction') as TechnicalState['direction'] || 'NONE',
    mode: getValue('Mode') as TechnicalState['mode'] || 'Trend',
    entry: parseFloat(getValue('Entry')) || null,
    sl: slTpStr[0] ? parseFloat(slTpStr[0]) || null : null,
    tp1: slTpStr[1] ? parseFloat(slTpStr[1]) || null : null,
    tp2: slTpStr[2] ? parseFloat(slTpStr[2]) || null : null,
  }
}

// ─── Build Full Signal ───────────────────────────────────────

export function buildExecutionSignal(
  fund: FundamentalBias,
  regime: RegimeContext,
  tech: TechnicalState | null,
  accountBalance: number = 10000,
): ExecutionSignal {
  // Calculate scores
  const techResult = tech ? calculateTechnicalScore(fund, tech) : null
  const techScore = techResult?.score ?? 0
  const regimeScore = calculateRegimeScore(fund, regime)
  const scoring = calculateCompositeScore(fund.score, techScore, regimeScore)

  // Determine verdict
  const { verdict, reasons } = determineVerdict(fund, tech, scoring, regime)

  // Calculate risk if tradeable
  let risk = null
  if ((verdict === 'VALID' || verdict === 'HIGH_CONVICTION') && tech?.entry && tech?.sl) {
    risk = calculatePositionSize(accountBalance, verdict, tech.entry, tech.sl, fund.pair)
  }

  return {
    pair: fund.pair,
    base: fund.base,
    quote: fund.quote,
    timestamp: new Date().toISOString(),
    fundamental: fund,
    regime,
    technical: tech,
    scoring,
    technicalDetail: techResult?.detail ?? null,
    verdict,
    verdictReasons: reasons,
    entry: tech?.entry ?? null,
    sl: tech?.sl ?? null,
    tp1: tech?.tp1 ?? null,
    tp2: tech?.tp2 ?? null,
    risk,
    tradeMode: tech?.mode ?? 'Trend',
    correlationGroup: getCorrelationGroup(fund.pair),
  }
}

// ─── API Handlers ────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    // Determine base URL from the incoming request
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`
    const briefingRes = await fetch(`${baseUrl}/api/briefing-v2`, { next: { revalidate: 0 } })

    if (!briefingRes.ok) {
      return NextResponse.json({ error: `Briefing API returned ${briefingRes.status}` }, { status: 502 })
    }

    const briefing = await briefingRes.json()
    if (briefing.error) {
      return NextResponse.json({ error: briefing.error }, { status: 502 })
    }

    const regime: RegimeContext = {
      regime: briefing.regime || 'Gemengd',
      confidence: briefing.confidence || 0,
      intermarketAlignment: briefing.intermarketAlignment || 0,
    }

    // Build signals for all pairs (fundamental only, no technical scan)
    const signals: ExecutionSignal[] = (briefing.pairBiases || []).map((pb: FundamentalBias) => {
      return buildExecutionSignal(pb, regime, null)
    })

    // Sort by composite score descending
    signals.sort((a, b) => b.scoring.compositeScore - a.scoring.compositeScore)

    return NextResponse.json({
      version: 'v1.0',
      generatedAt: new Date().toISOString(),
      regime,
      signals,
      stats: {
        total: signals.length,
        skip: signals.filter(s => s.verdict === 'SKIP').length,
        watchlist: signals.filter(s => s.verdict === 'WATCHLIST').length,
        valid: signals.filter(s => s.verdict === 'VALID').length,
        highConviction: signals.filter(s => s.verdict === 'HIGH_CONVICTION').length,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { technicalScans, accountBalance } = body as {
      technicalScans: Record<string, string[]>
      accountBalance?: number
    }

    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`
    const briefingRes = await fetch(`${baseUrl}/api/briefing-v2`, { next: { revalidate: 0 } })

    if (!briefingRes.ok) {
      return NextResponse.json({ error: `Briefing API returned ${briefingRes.status}` }, { status: 502 })
    }

    const briefing = await briefingRes.json()
    if (briefing.error) {
      return NextResponse.json({ error: briefing.error }, { status: 502 })
    }

    const regime: RegimeContext = {
      regime: briefing.regime || 'Gemengd',
      confidence: briefing.confidence || 0,
      intermarketAlignment: briefing.intermarketAlignment || 0,
    }

    // Build signals with technical data
    const signals: ExecutionSignal[] = (briefing.pairBiases || []).map((pb: FundamentalBias) => {
      const techRows = technicalScans?.[pb.pair]
      const tech = techRows ? parseTechnicalState(techRows) : null
      return buildExecutionSignal(pb, regime, tech, accountBalance || 10000)
    })

    // Sort by composite score descending
    signals.sort((a, b) => b.scoring.compositeScore - a.scoring.compositeScore)

    return NextResponse.json({
      version: 'v1.0',
      generatedAt: new Date().toISOString(),
      regime,
      signals,
      stats: {
        total: signals.length,
        skip: signals.filter(s => s.verdict === 'SKIP').length,
        watchlist: signals.filter(s => s.verdict === 'WATCHLIST').length,
        valid: signals.filter(s => s.verdict === 'VALID').length,
        highConviction: signals.filter(s => s.verdict === 'HIGH_CONVICTION').length,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
