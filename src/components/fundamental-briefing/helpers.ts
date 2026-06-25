import type { FbCall, HorizonOutcome } from '@/lib/fundamental/types'

export function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  } catch { return iso }
}

export function fmtPrice(pair: string, price: number | null): string {
  if (price == null) return '—'
  return price.toFixed(pair.includes('JPY') ? 3 : 5)
}

export function dirLabel(dir: string): string {
  return dir === 'bullish' ? 'LONG' : 'SHORT'
}

export function outcomeAt(call: FbCall, horizon: number): HorizonOutcome | undefined {
  return call.outcomes.find((o) => o.horizon === horizon)
}

export interface WinStats { n: number; wins: number; losses: number; pending: number; winrate: number }

// Trefkans op één horizon (alleen geresolvede calls tellen mee).
export function winStats(calls: FbCall[], horizon: number): WinStats {
  let wins = 0, losses = 0, pending = 0
  for (const c of calls) {
    const o = outcomeAt(c, horizon)
    if (!o || !o.resolved || o.correct == null) { pending++; continue }
    if (o.correct) wins++; else losses++
  }
  const n = wins + losses
  return { n, wins, losses, pending, winrate: n ? Math.round((wins / n) * 100) : 0 }
}

// Splitsing naar groepen (label → calls) met winrate op de gekozen horizon.
export function groupWinrate(
  calls: FbCall[], horizon: number, keyFn: (c: FbCall) => string, order?: string[],
): { label: string; stats: WinStats }[] {
  const map: Record<string, FbCall[]> = {}
  for (const c of calls) (map[keyFn(c)] ||= []).push(c)
  const labels = order ? order.filter((l) => map[l]) : Object.keys(map).sort()
  return labels.map((label) => ({ label, stats: winStats(map[label], horizon) }))
}

export function convictionBand(c: FbCall): string {
  const v = c.conviction
  if (v >= 8) return '8.0+'
  if (v >= 7) return '7.0–8.0'
  if (v >= 6) return '6.0–7.0'
  return '< 6.0'
}
