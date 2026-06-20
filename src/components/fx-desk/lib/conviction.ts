// ─────────────────────────────────────────────────────────────
// Conviction score — ONE shared source of truth.
//
// The 4-component `qualityScore` calculation. Numbers, weights and
// clamps are the original, unchanged values:
//
//     const fundPts = Math.min(absScore / 5, 1) * 4
//     const contrarianPts = contrarianPass
//       ? (absMom >= 30 && absMom <= 120 ? 2.5 : 1.5) : 0
//     const imPts = (imAlignment / 100) * 2
//     const regimePts = p.regimeAligned ? 1.5 : 0.5
//     const qualityScore = Math.min(10,
//       Math.round((fundPts + contrarianPts + imPts + regimePts) * 10) / 10)
//
// Shared so the Briefing's entry-ready cards and the historical
// Calls list show the SAME conviction number.
// ─────────────────────────────────────────────────────────────

import type { ApiPairBias, ApiV3PairSignal, ApiTrackRecord } from './types'

export interface ConvictionInputs {
  absScore: number          // |fundamental score|, 0..5
  contrarianPass: boolean   // direction vs 5d price momentum
  absMom: number            // |5d momentum| in pips
  imAlignment: number       // 0..100 (global intermarket alignment %)
  regimeAligned: boolean    // pair direction aligns with the macro regime
}

export interface ConvictionBreakdown {
  fundPts: number       // 0..4
  contrarianPts: number // 0 or 1.5 or 2.5
  imPts: number         // 0..2
  regimePts: number     // 0.5 or 1.5
  total: number         // 0.5..10
}

export function convictionScore(i: ConvictionInputs): number {
  return convictionBreakdown(i).total
}

export function convictionBreakdown(i: ConvictionInputs): ConvictionBreakdown {
  const fundPts = Math.min(i.absScore / 5, 1) * 4
  const contrarianPts = i.contrarianPass
    ? (i.absMom >= 30 && i.absMom <= 120 ? 2.5 : 1.5)
    : 0
  const imPts = (i.imAlignment / 100) * 2
  const regimePts = i.regimeAligned ? 1.5 : 0.5
  const total = Math.min(
    10,
    Math.round((fundPts + contrarianPts + imPts + regimePts) * 10) / 10,
  )
  return {
    fundPts: round1(fundPts),
    contrarianPts: round1(contrarianPts),
    imPts: round1(imPts),
    regimePts: round1(regimePts),
    total,
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

// ─── Live pair: derive inputs from briefing API shape ────────
//
// For pairs in the current briefing response we have everything
// at hand: pair.score, pair.regimeAligned, intermarketAlignment,
// and the v3 signal's pips5d.

export function convictionForLivePair(
  pair: ApiPairBias,
  v3Signal: ApiV3PairSignal | undefined,
  intermarketAlignment: number,
): ConvictionBreakdown {
  const absScore = Math.abs(pair.score)
  const pips5d = v3Signal?.priceMomentum?.pips5d ?? 0
  const isBullish = pair.direction.includes('bullish')
  const isBearish = pair.direction.includes('bearish')
  const contrarianPass =
    (isBullish && pips5d < 0) || (isBearish && pips5d > 0)
  return convictionBreakdown({
    absScore,
    contrarianPass,
    absMom: Math.abs(pips5d),
    imAlignment: intermarketAlignment,
    regimeAligned: pair.regimeAligned ?? false,
  })
}

// ─── Regime-Pair Alignment Check ─────────────────────────────
//
// Verbatim copy of isAlignedWithRegime() from
// src/app/api/briefing-v2/route.ts (lines 807-840). Reproduced
// here so historical records — which store regime + direction +
// pair but not the regimeAligned boolean — can have their
// alignment reconstructed deterministically on the client.
// Not a scoring change: same function, same rules, just used in
// a new place. Keep in sync with the API if either ever moves.

function isAlignedWithRegime(
  pair: { pair: string; direction: string; base: string; quote: string },
  regime: string,
): boolean {
  const safeHavens = ['JPY', 'CHF']
  const highYield = ['AUD', 'NZD', 'CAD']
  const isBullish = pair.direction.includes('bullish')

  if (regime === 'Risk-Off') {
    if (isBullish && safeHavens.includes(pair.base)) return true
    if (!isBullish && safeHavens.includes(pair.quote)) return true
    if (!isBullish && highYield.includes(pair.base)) return true
    if (isBullish && highYield.includes(pair.quote)) return true
  }
  if (regime === 'Risk-On') {
    if (isBullish && highYield.includes(pair.base)) return true
    if (!isBullish && highYield.includes(pair.quote)) return true
    if (!isBullish && safeHavens.includes(pair.base)) return true
    if (isBullish && safeHavens.includes(pair.quote)) return true
  }
  if (regime === 'USD Dominant') {
    if (isBullish && pair.base === 'USD') return true
    if (!isBullish && pair.quote === 'USD') return true
  }
  if (regime === 'USD Zwak') {
    if (!isBullish && pair.base === 'USD') return true
    if (isBullish && pair.quote === 'USD') return true
  }
  if (regime === 'Gemengd') return true
  return false
}

// ─── Historical record: derive inputs from stored metadata ───
//
// trade_focus_records persists 3 of the 4 components directly:
//   fundPts        from abs(record.score)
//   contrarianPts  from metadata.momentum5d + record.direction
//   imPts          from metadata.imAlignment
//   regimePts      regimeAligned is NOT stored — reconstructed
//                  here from regime + direction + pair via the
//                  isAlignedWithRegime() helper above (identical
//                  to the live API logic).

export function convictionForHistoricalRecord(r: ApiTrackRecord): ConvictionBreakdown {
  const absScore = Math.abs(r.score)
  const pips5d = r.metadata?.momentum5d ?? 0
  const isBullish = r.direction.includes('bullish')
  const isBearish = r.direction.includes('bearish')
  const contrarianPass =
    (isBullish && pips5d < 0) || (isBearish && pips5d > 0)
  const imAlignment = r.metadata?.imAlignment ?? 0

  const [base, quote] = r.pair.split('/')
  const regimeAligned = isAlignedWithRegime(
    { pair: r.pair, direction: r.direction, base: base || '', quote: quote || '' },
    r.regime || 'Gemengd',
  )

  return convictionBreakdown({
    absScore,
    contrarianPass,
    absMom: Math.abs(pips5d),
    imAlignment,
    regimeAligned,
  })
}
