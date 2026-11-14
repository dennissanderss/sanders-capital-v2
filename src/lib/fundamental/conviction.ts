// ─────────────────────────────────────────────────────────────
// Conviction-breakdown (0-10) — gedeelde rekenkern.
//
// Verhuisd uit components/fx-desk/lib/conviction.ts toen de oude
// fx-desk-UI na de audit is verwijderd (fase 6/7); de Fundamental
// Briefing gebruikt deze berekening nog. Getallen, gewichten en
// clamps zijn ongewijzigd:
//
//     fundPts       = min(|score| / 5, 1) × 4
//     contrarianPts = pass ? (30 ≤ |mom| ≤ 120 ? 2.5 : 1.5) : 0
//     imPts         = (imAlignment / 100) × 2
//     regimePts     = aligned ? 1.5 : 0.5
//     totaal        = min(10, afgerond op 1 decimaal)
// ─────────────────────────────────────────────────────────────

export interface ConvictionInputs {
  absScore: number          // |fundamentele score|, 0..5
  contrarianPass: boolean   // richting vs 5d-prijsmomentum
  absMom: number            // |5d momentum| in pips
  imAlignment: number       // 0..100 (intermarket alignment %)
  regimeAligned: boolean    // past de richting bij het macro-regime
}

export interface ConvictionBreakdown {
  fundPts: number       // 0..4
  contrarianPts: number // 0 of 1.5 of 2.5
  imPts: number         // 0..2
  regimePts: number     // 0.5 of 1.5
  total: number         // 0.5..10
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
