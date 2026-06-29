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

// Close-to-close resultaat in pips (positief = de voorspelde kant op).
export function closeToClosePips(call: FbCall, o: HorizonOutcome | undefined): number | null {
  if (!o || !o.resolved || o.exitPrice == null) return null
  const mult = call.pair.includes('JPY') ? 100 : 10000
  const raw = o.exitPrice - call.entryPrice
  return Math.round((call.direction === 'bullish' ? raw : -raw) * mult)
}

// Profit factor op één horizon = som winst-pips ÷ som verlies-pips (close-to-close).
export function profitFactor(calls: FbCall[], horizon: number): number | null {
  let win = 0, loss = 0, n = 0
  for (const c of calls) {
    const p = closeToClosePips(c, outcomeAt(c, horizon))
    if (p == null) continue
    n++
    if (p > 0) win += p; else loss += -p
  }
  if (n === 0) return null
  if (loss === 0) return win > 0 ? Infinity : null
  return +(win / loss).toFixed(2)
}

export const HZ_LABEL: Record<number, string> = { 1: '1 dag', 3: '3 dagen', 5: '5 dagen', 10: '10 dagen', 20: '20 dagen' }

// Zekerheid-indeling (alleen weergave — verandert de score niet).
// Een call met lage zekerheid is een ZWAKKE call: richting duidelijk, maar
// nauwelijks bevestigd door momentum/markt/regime.
export function zekerheidTier(v: number): { label: string; cls: 'sterk' | 'matig' | 'zwak' } {
  if (v >= 7) return { label: 'sterk', cls: 'sterk' }
  if (v >= 5) return { label: 'matig', cls: 'matig' }
  return { label: 'zwak', cls: 'zwak' }
}

export type SampleTier = 'ruis' | 'voorlopig' | 'betrouwbaar'
// Sample-guard: voorkomt dat een dunne, mooi-ogende bucket als edge wordt gelezen.
export function sampleTier(n: number): { tier: SampleTier; label: string } {
  if (n < 30) return { tier: 'ruis', label: 'te weinig data (n<30)' }
  if (n < 100) return { tier: 'voorlopig', label: 'voorlopig (n<100)' }
  return { tier: 'betrouwbaar', label: 'betrouwbaar' }
}
