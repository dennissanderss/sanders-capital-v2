// ─────────────────────────────────────────────────────────────
// Sanders Capital — Fundamental Briefing: prijzen & horizon-evaluatie
//
// ALLES op VOLTOOIDE dag-candles. De candle van vandaag (UTC) is nog in
// beweging en wordt gedropt, zodat een call binnen de dag niet verandert
// en een horizon nooit te vroeg (met onvolledige data) wordt afgerekend.
// ─────────────────────────────────────────────────────────────
import type { Candle, HorizonOutcome } from './types'
import type { Horizon } from './constants'

export function pipMult(pair: string): number {
  return pair.includes('JPY') ? 100 : 10000
}
export function pipDecimals(pair: string): number {
  return pair.includes('JPY') ? 3 : 5
}

export function todayUTC(): string {
  return new Date().toISOString().split('T')[0]
}

// Drop de nog-vormende candle van vandaag (UTC). Op weekenden/feestdagen is
// de laatste candle al voltooid (datum ≠ vandaag) en blijft hij staan.
export function dropForming(bars: Candle[]): Candle[] {
  if (bars.length === 0) return bars
  return bars[bars.length - 1].date === todayUTC() ? bars.slice(0, -1) : bars
}

// Haal voltooide dag-candles (OHLC) op. period1/period2 i.p.v. range omdat
// Yahoo range=2y voor =X soms leeg teruggeeft.
export async function fetchDailyCandles(symbol: string, fromISO: string): Promise<Candle[]> {
  const p1 = Math.floor(new Date(fromISO + 'T00:00:00Z').getTime() / 1000)
  const p2 = Math.floor(Date.now() / 1000)
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
      try {
        const res = await fetch(
          `https://${host}/v8/finance/chart/${symbol}?interval=1d&period1=${p1}&period2=${p2}`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }, next: { revalidate: 300 } },
        )
        if (!res.ok) continue
        const json = await res.json()
        const result = json?.chart?.result?.[0]
        if (!result) continue
        const ts: number[] = result.timestamp || []
        const q = result.indicators?.quote?.[0] || {}
        const bars: Candle[] = ts
          .map((t, i) => ({
            date: new Date(t * 1000).toISOString().split('T')[0],
            open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i],
          }))
          .filter((c): c is Candle => c.close != null && c.high != null && c.low != null)
        if (bars.length > 0) return dropForming(bars)
      } catch { /* try next */ }
    }
    await new Promise((r) => setTimeout(r, 700))
  }
  return []
}

// Batch-fetch meerdere symbolen (4 tegelijk, met pauze tegen rate-limits).
export async function fetchManyDaily(
  entries: [string, string][], fromISO: string,
): Promise<Record<string, Candle[]>> {
  const out: Record<string, Candle[]> = {}
  for (let i = 0; i < entries.length; i += 4) {
    const batch = entries.slice(i, i + 4)
    const res = await Promise.all(batch.map(([, sym]) => fetchDailyCandles(sym, fromISO)))
    batch.forEach(([key], k) => { out[key] = res[k] })
    if (i + 4 < entries.length) await new Promise((r) => setTimeout(r, 500))
  }
  return out
}

// 5-daags momentum in pips, op voltooide candles (laatste vs 5 candles terug).
export function momentum5d(hist: Candle[], pair: string): {
  pips: number
  start: { date: string | null; price: number | null }
  now: { date: string | null; price: number | null }
} {
  if (hist.length < 6) return { pips: 0, start: { date: null, price: null }, now: { date: null, price: null } }
  const last = hist[hist.length - 1]
  const ago = hist[hist.length - 6]
  const pips = Math.round((last.close - ago.close) * pipMult(pair))
  return { pips, start: { date: ago.date, price: ago.close }, now: { date: last.date, price: last.close } }
}

// Daily % change van een intermarket-instrument op voltooide candles.
export function dailyChangePct(hist: Candle[]): { changePct: number; direction: 'up' | 'down' | 'flat' } {
  if (hist.length < 2) return { changePct: 0, direction: 'flat' }
  const cur = hist[hist.length - 1].close
  const prev = hist[hist.length - 2].close
  if (!prev) return { changePct: 0, direction: 'flat' }
  const changePct = +(((cur - prev) / prev) * 100).toFixed(2)
  return { changePct, direction: changePct > 0.01 ? 'up' : changePct < -0.01 ? 'down' : 'flat' }
}

// ─── Horizon-evaluatie (close-to-close + favorabele/adverse excursie) ───
// Geeft null terug zolang de horizon nog niet volledig is verstreken
// (no-leakage: we rekenen pas af als de exit-candle voltooid is).
export function evaluateHorizon(
  hist: Candle[], entryDate: string, entryPrice: number,
  isBull: boolean, pair: string, horizon: Horizon,
): HorizonOutcome | null {
  const ei = hist.findIndex((c) => c.date === entryDate)
  if (ei < 0) return null
  const xi = ei + horizon
  if (xi >= hist.length) return null // nog niet genoeg voltooide candles

  const exit = hist[xi]
  const mult = pipMult(pair)
  const correct = isBull ? exit.close > entryPrice : exit.close < entryPrice

  // Excursie over de periode (ei, xi]: hoogste favorabele en adverse beweging.
  let mfePips = -Infinity, mfeDate = exit.date, mfePrice = exit.close
  let maePips = Infinity, maeDate = exit.date, maePrice = exit.close
  for (let j = ei + 1; j <= xi; j++) {
    const c = hist[j]
    const fav = isBull ? (c.high - entryPrice) : (entryPrice - c.low)
    const favPrice = isBull ? c.high : c.low
    if (fav > mfePips) { mfePips = fav; mfeDate = c.date; mfePrice = favPrice }
    const adv = isBull ? (c.low - entryPrice) : (entryPrice - c.high)
    const advPrice = isBull ? c.low : c.high
    if (adv < maePips) { maePips = adv; maeDate = c.date; maePrice = advPrice }
  }

  return {
    horizon,
    exitDate: exit.date,
    exitPrice: exit.close,
    correct,
    mfePips: Math.round(Math.max(0, mfePips) * mult),
    mfeDate, mfePrice,
    maePips: Math.round(Math.min(0, maePips) * mult), // ≤ 0
    maeDate, maePrice,
    resolved: true,
  }
}
