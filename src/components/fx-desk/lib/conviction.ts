// ─────────────────────────────────────────────────────────────
// Conviction score — ONE shared source of truth.
//
// Mirror of the original `qualityScore` calculation that lived
// inline in src/app/tools/execution/page.tsx (commit 861e427,
// lines 120-125). Reproduced verbatim:
//
//     const fundPts = Math.min(absScore / 5, 1) * 4
//     const contrarianPts = contrarianPass
//       ? (absMom >= 30 && absMom <= 120 ? 2.5 : 1.5) : 0
//     const imPts = (imAlignment / 100) * 2
//     const regimePts = p.regimeAligned ? 1.5 : 0.5
//     const qualityScore = Math.min(10,
//       Math.round((fundPts + contrarianPts + imPts + regimePts) * 10) / 10)
//
// This is NOT a scoring change. The numbers, weights and clamps
// are identical to the existing in-app calculation. Reused here
// so the Briefing's entry-ready cards, the Execution setups and
// (eventually, after explicit OK) the historical Calls list and
// the Prestatie buckets all show the SAME conviction number.
// ─────────────────────────────────────────────────────────────

import type { ApiPairBias, ApiV3PairSignal } from './types'

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
