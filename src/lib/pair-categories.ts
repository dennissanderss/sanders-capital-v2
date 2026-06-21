// ─── Pair-categorie + pip-drempels ───────────────────────────
// Bepaalt per valutapaar de categorie en de minimale beweging
// (drempel) die als "richting klopt" telt in de bias-accuracy.

export type PairCategory = 'major' | 'jpy' | 'cross'

export function getPairCategory(pair: string): PairCategory {
  if (pair.includes('JPY')) return 'jpy'
  const MAJORS = ['EURUSD', 'GBPUSD', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD']
  if (MAJORS.includes(pair.replace('/', ''))) return 'major'
  return 'cross'
}

export const PIP_THRESHOLDS: Record<PairCategory, number> = {
  major: 30,
  jpy: 50,
  cross: 30,
}

export function getPipThreshold(pair: string): number {
  return PIP_THRESHOLDS[getPairCategory(pair)]
}

// 1 pip = 0.01 voor JPY-paren (X.XX), anders 0.0001 (X.XXXX)
export function pipSize(pair: string): number {
  return pair.includes('JPY') ? 0.01 : 0.0001
}
