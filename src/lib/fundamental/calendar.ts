// ─────────────────────────────────────────────────────────────
// Sanders Capital — Fundamental Briefing: economische kalender (v2)
//
// Bron: TradingView economic-calendar API (actual + forecast + importance
// per event, per valuta). Drie afgeleiden:
//   1. Macro-verrassingsscore per valuta (actual vs. forecast, gewogen op
//      impact en recentheid, wegzakkend over 5 dagen) — BIAS-input.
//   2. Aankomende high-impact events per valuta — TIMING-input (event-risico).
//   3. Inflatie-gap: recentste CPI y/y t.o.v. het doel van de centrale
//      bank — BIAS-input (beleidsrichting-druk).
// ─────────────────────────────────────────────────────────────
import { MAJORS, CCY_COUNTRY, INFLATION_TARGETS } from './constants'
import type { EventRiskItem, SurpriseItem } from './types'

export interface CalendarEvent {
  title: string
  indicator?: string
  currency: string          // 'USD' | 'EUR' | ...
  date: string              // ISO
  importance: number        // -1 laag · 0 middel · 1 hoog
  actual: number | null
  forecast: number | null
  previous: number | null
  unit?: string
}

// Indicatoren waar HOGER dan verwacht NEGATIEF is voor de valuta.
const INVERSE_KEYWORDS = ['unemployment', 'jobless', 'claims', 'bankrupt', 'foreclosure', 'delinquen']

// Events die géén schone valuta-richting hebben: voorraden en veilingen zeggen
// iets over olie/gas/obligaties, niet over de waarde van de munt.
const EXCLUDE_KEYWORDS = ['crude oil', 'oil stocks', 'natural gas', 'gasoline', 'distillate', 'api weekly', 'auction', 'baker hughes']

function isInverse(ev: CalendarEvent): boolean {
  const t = `${ev.indicator || ''} ${ev.title}`.toLowerCase()
  return INVERSE_KEYWORDS.some((k) => t.includes(k))
}

function isExcluded(ev: CalendarEvent): boolean {
  const t = `${ev.indicator || ''} ${ev.title}`.toLowerCase()
  return EXCLUDE_KEYWORDS.some((k) => t.includes(k))
}

// ─── Fetch ────────────────────────────────────────────────────
// Eén window: ~40 dagen terug (maandelijkse CPI + verrassingen) tot 7 dagen
// vooruit (event-risico). Draait één keer per generate — niet per pageload.
export async function fetchCalendar(nowMs: number): Promise<CalendarEvent[]> {
  const from = new Date(nowMs - 40 * 86400000).toISOString()
  const to = new Date(nowMs + 7 * 86400000).toISOString()
  const countries = MAJORS.map((c) => CCY_COUNTRY[c]).join(',')
  const url = `https://economic-calendar.tradingview.com/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&countries=${countries}`
  try {
    const res = await fetch(url, {
      headers: {
        Origin: 'https://www.tradingview.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return []
    const json = await res.json()
    const rows: unknown[] = Array.isArray(json) ? json : json?.result || []
    return (rows as Record<string, unknown>[]).map((r) => ({
      title: String(r.title || ''),
      indicator: r.indicator ? String(r.indicator) : undefined,
      currency: String(r.currency || ''),
      date: String(r.date || ''),
      importance: typeof r.importance === 'number' ? r.importance : -1,
      actual: typeof r.actual === 'number' ? r.actual : null,
      forecast: typeof r.forecast === 'number' ? r.forecast : null,
      previous: typeof r.previous === 'number' ? r.previous : null,
      unit: r.unit ? String(r.unit) : undefined,
    })).filter((e) => e.currency && e.date)
  } catch {
    return [] // kalender is een verrijking — zonder valt de score terug op de rest
  }
}

// ─── 1. Verrassingsscore per valuta ───────────────────────────
// Per event: teken(actual − forecast, evt. omgekeerd) × impact-gewicht ×
// grootte × recentheid. Grootte is genormaliseerd op de VERWACHTE verandering
// (|forecast − previous|) zodat "0,1pp boven verwachting op CPI" zwaarder
// weegt dan hetzelfde verschil op een grillige reeks. Som gecapt op ±2.
export function surpriseScores(events: CalendarEvent[], nowMs: number): Record<string, { pts: number; detail: SurpriseItem[] }> {
  const out: Record<string, { pts: number; detail: SurpriseItem[] }> = {}
  for (const c of MAJORS) out[c] = { pts: 0, detail: [] }

  for (const ev of events) {
    if (!out[ev.currency]) continue
    if (ev.actual == null || ev.forecast == null || isExcluded(ev)) continue
    const t = new Date(ev.date).getTime()
    if (!Number.isFinite(t) || t > nowMs) continue
    const ageH = (nowMs - t) / 3600000
    if (ageH > 120) continue // ouder dan 5 dagen telt niet meer

    const diff = ev.actual - ev.forecast
    if (diff === 0) continue
    const sign = (diff > 0 ? 1 : -1) * (isInverse(ev) ? -1 : 1)

    const impW = ev.importance >= 1 ? 1.0 : ev.importance === 0 ? 0.5 : 0.2
    const expectedMove = ev.previous != null ? Math.abs(ev.forecast - ev.previous) : 0
    const scale = Math.max(expectedMove, 0.1 * Math.max(Math.abs(ev.forecast), Math.abs(ev.previous ?? 0)), 1e-9)
    const magnitude = Math.min(Math.max(Math.abs(diff) / scale, 0.25), 1.5)
    const recency = ageH < 24 ? 1.0 : ageH < 48 ? 0.8 : ageH < 72 ? 0.6 : ageH < 96 ? 0.45 : 0.3

    const pts = +(sign * impW * magnitude * recency).toFixed(2)
    if (pts === 0) continue
    out[ev.currency].pts += pts
    out[ev.currency].detail.push({
      title: ev.title, date: ev.date, actual: ev.actual, forecast: ev.forecast,
      unit: ev.unit, importance: ev.importance, pts,
    })
  }

  for (const c of MAJORS) {
    out[c].pts = +Math.max(-2, Math.min(2, out[c].pts)).toFixed(2)
    // Grootste bijdragen eerst; max 6 in het detail (transparant, niet eindeloos).
    out[c].detail.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts))
    out[c].detail = out[c].detail.slice(0, 6)
  }
  return out
}

// ─── 2. Event-risico (timing) ─────────────────────────────────
// High-impact events binnen het venster (default 2 kalenderdagen + vandaag)
// per valuta. Wie vlak vóór CPI/NFP instapt, gokt op de uitkomst — dat drukt
// de timing-score en levert een expliciete waarschuwing op in de call.
export function upcomingEventRisk(events: CalendarEvent[], nowMs: number, windowDays = 2): Record<string, EventRiskItem[]> {
  const out: Record<string, EventRiskItem[]> = {}
  for (const c of MAJORS) out[c] = []
  const until = nowMs + windowDays * 86400000
  for (const ev of events) {
    if (!out[ev.currency]) continue
    if (ev.importance < 1 || ev.actual != null) continue
    const t = new Date(ev.date).getTime()
    if (!Number.isFinite(t) || t < nowMs || t > until) continue
    out[ev.currency].push({ currency: ev.currency, title: ev.title, date: ev.date })
  }
  for (const c of MAJORS) out[c].sort((a, b) => a.date.localeCompare(b.date))
  return out
}

// ─── 3. Inflatie-gap per valuta ───────────────────────────────
// Recentste headline-CPI y/y (actual) t.o.v. het doel van de centrale bank.
// Hoger dan doel → hawkish druk → positief voor de valuta (beleidsrichting-
// model). Gecapt op ±1: gap van 2pp = vol punt.
export function inflationGaps(events: CalendarEvent[], nowMs: number): Record<string, { pts: number; cpiYoY: number; target: number } | null> {
  const out: Record<string, { pts: number; cpiYoY: number; target: number } | null> = {}
  for (const c of MAJORS) out[c] = null

  const isHeadlineCpiYoY = (ev: CalendarEvent) => {
    const t = `${ev.indicator || ''} ${ev.title}`.toLowerCase()
    if (!/inflation rate|cpi/.test(t)) return false
    if (!/yoy|y\/y/.test(t)) return false
    return !/core|trimmed|median|ppi|wpi|import|producer/.test(t)
  }

  const newest: Record<string, number> = {}
  for (const ev of events) {
    if (ev.actual == null || !out.hasOwnProperty(ev.currency) || !isHeadlineCpiYoY(ev)) continue
    const t = new Date(ev.date).getTime()
    if (!Number.isFinite(t) || t > nowMs) continue
    if (t <= (newest[ev.currency] ?? -1)) continue
    newest[ev.currency] = t
    const target = INFLATION_TARGETS[ev.currency] ?? 2
    const pts = +Math.max(-1, Math.min(1, (ev.actual - target) / 2)).toFixed(2)
    out[ev.currency] = { pts, cpiYoY: ev.actual, target }
  }
  return out
}
