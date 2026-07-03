import type { FbCall, HorizonOutcome, CurrencyFactors } from '@/lib/fundamental/types'
import { isV2Breakdown } from '@/lib/fundamental/types'
import { FLAT_ATR_FRACTION } from '@/lib/fundamental/constants'

// ─── v2-accessors: bias- en timing-score van een call ─────────
// v1-calls hebben geen splitsing: bias valt terug op de zekerheid, timing is
// onbekend (null) — de UI toont dan alleen de zekerheid.
export function biasScoreOf(c: FbCall): number {
  return isV2Breakdown(c.breakdown) ? c.breakdown.biasScore : c.conviction
}
export function timingScoreOf(c: FbCall): number | null {
  return isV2Breakdown(c.breakdown) ? c.breakdown.timingScore : null
}
export function isV2Call(c: FbCall): boolean {
  return isV2Breakdown(c.breakdown)
}

// Korte driver-omschrijving per valuta uit de al-berekende factoren.
function ccyDriver(f: CurrencyFactors): string {
  const parts: string[] = []
  if (f.cbPts >= 1) parts.push('havikse centrale bank')
  else if (f.cbPts <= -1) parts.push('verruimende centrale bank')
  if (f.ratePts > 0) parts.push('rente boven doel')
  else if (f.ratePts < 0) parts.push('rente onder doel')
  if ((f.surprisePts ?? 0) >= 0.5) parts.push('meevallende macro-cijfers')
  else if ((f.surprisePts ?? 0) <= -0.5) parts.push('tegenvallende macro-cijfers')
  if (f.newsPts >= 0.3) parts.push('positief nieuws')
  else if (f.newsPts <= -0.3) parts.push('negatief nieuws')
  return parts.slice(0, 2).join(', ')
}

// Eén gewone-taal-zin: wat verwacht de tool en waarom. Puur uit opgeslagen
// data — geen herberekening.
export function plainSummary(call: FbCall): string {
  const r = call.reasoning
  const b = call.breakdown
  const long = call.direction === 'bullish'
  const strong = long ? r.base : r.quote
  const weak = long ? r.quote : r.base
  const driver = ccyDriver(strong)

  let mom: string
  if (isV2Breakdown(b)) {
    if (b.stretchPts >= 2.5) {
      mom = long
        ? 'De koers daalde de afgelopen dagen juist — een gunstig moment om long in te stappen.'
        : 'De koers steeg de afgelopen dagen juist — een gunstig moment om short in te stappen.'
    } else if (b.stretchPts <= 0.5) {
      mom = 'De koers is al flink de verwachte kant op gelopen — late instap (chasing).'
    } else {
      mom = 'Het recente koersverloop is neutraal voor de instap.'
    }
    if (b.eventPts < 3) mom += ' Let op: binnen 2 dagen staan er high-impact cijfers gepland.'
  } else {
    mom = 'contrarianPts' in b && b.contrarianPts > 0
      ? (long
        ? 'De koers daalde de afgelopen dagen juist — een gunstiger moment om long in te stappen.'
        : 'De koers steeg de afgelopen dagen juist — een gunstiger moment om short in te stappen.')
      : 'Het recente koersverloop gaf geen extra instapvoordeel.'
  }

  if (isV2Breakdown(b)) {
    const biasTxt = b.biasScore >= 7 ? 'Sterke' : b.biasScore >= 5 ? 'Redelijke' : 'Zwakke'
    const timingTxt = b.timingScore >= 6.5 ? 'goede' : b.timingScore >= 4 ? 'matige' : 'slechte'
    return `De ${strong.currency} is fundamenteel sterker dan de ${weak.currency}${driver ? ` (${driver})` : ''}. ${mom} → ${biasTxt} ${long ? 'long' : 'short'}-bias op ${call.pair}, met ${timingTxt} timing (${b.timingScore.toFixed(1)}/10).`
  }

  let conf: string
  if (call.regime === 'Gemengd') {
    conf = 'De bredere markt geeft nu geen duidelijke bevestiging (gemengd regime).'
  } else {
    const c = ('imPts' in b ? b.imPts : 0) + ('regimePts' in b ? b.regimePts : 0) // max 3.5
    conf = c >= 2.5 ? 'Markt en regime bevestigen de richting sterk.'
      : c >= 1.5 ? 'Markt en regime bevestigen de richting deels.'
      : 'Markt en regime bevestigen de richting nauwelijks.'
  }
  const tier = zekerheidTier(call.conviction).cls
  const sterkte = tier === 'sterk' ? 'Sterke' : tier === 'matig' ? 'Redelijke' : 'Zwakke'
  return `De ${strong.currency} is fundamenteel sterker dan de ${weak.currency}${driver ? ` (${driver})` : ''}. ${mom} ${conf} → ${sterkte} ${long ? 'long' : 'short'} ${call.pair}.`
}

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

// ─── Oordeel per call/horizon, mét vlak-deadband ──────────────
// Een close-to-close beweging kleiner dan 15% van de 14d-ATR is een
// muntje-op-zijn-kant: "vlak". Die telt niet mee in de trefkans (wel apart
// zichtbaar). Alleen v2-calls hebben een ATR; v1-calls blijven binair.
export type Verdict = 'win' | 'loss' | 'flat' | 'pending'

export function verdictOf(call: FbCall, o: HorizonOutcome | undefined): Verdict {
  if (!o || !o.resolved || o.correct == null) return 'pending'
  const atr = call.reasoning.atrPips
  if (atr && atr > 0 && o.exitPrice != null) {
    const mult = call.pair.includes('JPY') ? 100 : 10000
    const movePips = Math.abs(o.exitPrice - call.entryPrice) * mult
    if (movePips < FLAT_ATR_FRACTION * atr) return 'flat'
  }
  return o.correct ? 'win' : 'loss'
}

export interface WinStats { n: number; wins: number; losses: number; flats: number; pending: number; winrate: number }

// Trefkans op één horizon (alleen geresolvede calls tellen mee; "vlak"
// telt niet als win of verlies).
export function winStats(calls: FbCall[], horizon: number): WinStats {
  let wins = 0, losses = 0, flats = 0, pending = 0
  for (const c of calls) {
    const v = verdictOf(c, outcomeAt(c, horizon))
    if (v === 'pending') pending++
    else if (v === 'flat') flats++
    else if (v === 'win') wins++
    else losses++
  }
  const n = wins + losses
  return { n, wins, losses, flats, pending, winrate: n ? Math.round((wins / n) * 100) : 0 }
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

// Close-to-close resultaat in % (positief = de voorspelde kant op).
export function closeToClosePct(call: FbCall, o: HorizonOutcome | undefined): number | null {
  if (!o || !o.resolved || o.exitPrice == null || !call.entryPrice) return null
  const raw = (o.exitPrice - call.entryPrice) / call.entryPrice
  return (call.direction === 'bullish' ? raw : -raw) * 100
}

// Profit factor op één horizon = som winst-% ÷ som verlies-% (close-to-close).
// Op %-rendement, niet op pips: een pip GBP/NZD is economisch iets anders dan
// een pip EUR/USD — pips over paren optellen laat high-vol paren domineren.
export function profitFactor(calls: FbCall[], horizon: number): number | null {
  let win = 0, loss = 0, n = 0
  for (const c of calls) {
    const p = closeToClosePct(c, outcomeAt(c, horizon))
    if (p == null) continue
    n++
    if (p > 0) win += p; else loss += -p
  }
  if (n === 0) return null
  if (loss === 0) return win > 0 ? Infinity : null
  return +(win / loss).toFixed(2)
}

// Korte duiding van een profit factor (voor naast het getal).
export function pfVerdict(pf: number | null): { cls: 'win' | 'loss' | 'neutral'; text: string } | null {
  if (pf == null) return null
  if (pf >= 1.05) return { cls: 'win', text: 'winstgevend: winners samen groter dan losers' }
  if (pf > 0.95) return { cls: 'neutral', text: 'break-even' }
  return { cls: 'loss', text: 'verliesgevend: losers samen groter dan winners' }
}

// ─── Kalibratie: zekerheid → waargenomen trefkans ─────────────
// Wilson-interval zodat een bucket met n=8 en 75% niet als "edge" oogt.
export function wilson(wins: number, n: number): { lo: number; hi: number } {
  if (n === 0) return { lo: 0, hi: 100 }
  const z = 1.96, p = wins / n
  const denom = 1 + (z * z) / n
  const center = (p + (z * z) / (2 * n)) / denom
  const margin = (z / denom) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return { lo: Math.round(Math.max(0, center - margin) * 100), hi: Math.round(Math.min(1, center + margin) * 100) }
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
