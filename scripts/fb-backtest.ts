// ─────────────────────────────────────────────────────────────
// Fundamental Briefing — point-in-time backtest van methodiek v2
//
// Draaien:  npx tsx scripts/fb-backtest.ts
// Output:   public/fb-backtest-v2.json  (geladen door de Bewijs-tab)
//
// GEEN LOOK-AHEAD. Voor elke gesimuleerde handelsdag D gebruikt het signaal
// uitsluitend informatie die op D om 06:30 UTC (het live cron-moment) bekend
// was: voltooide dag-candles t/m D-1 en kalender-events met een publicatie-
// moment vóór 06:30 UTC. De uitkomst wordt daarna gemeten op de closes van
// D, D+3, D+5, D+10, D+20 — exact zoals de live tool.
//
// Eerlijke afwijkingen t.o.v. live v2 (staan ook in meta.deviations):
//  - GEEN nieuwscomponent: er is geen historisch nieuwsarchief; nieuws
//    simuleren = look-ahead (dat was precies de fout van de oude backfill).
//  - CB-bias is een PROXY uit historische rentebesluiten (laatste verhoging/
//    verlaging, met verval), niet het handmatige bias-label van live.
//  - GEEN rente-vs-doel: het "doel" per centrale bank is historisch niet
//    beschikbaar.
// Verrassingen, inflatie-gap, grondstoffen, momentum/ATR, intermarket,
// regime en de bias/timing-formules zijn identiek aan live v2.
// ─────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import {
  MAJORS, PAIRS, PAIR_SYMBOLS, INTERMARKET_SYMBOLS, COMMODITY_SYMBOLS,
  HORIZONS, FUND_GATE, MAX_CALLS_PER_DAY, INFLATION_TARGETS, CCY_COUNTRY,
} from '../src/lib/fundamental/constants'
import {
  determineRegime, computePairBias, buildConvictionV2,
  calculateIntermarketAlignment, type ImSignal,
} from '../src/lib/fundamental/scoring'
import {
  fetchDailyCandles, atr14Pips, momentum5d, evaluateHorizon, pipMult,
} from '../src/lib/fundamental/prices'
import type { Candle, CurrencyScore } from '../src/lib/fundamental/types'
import { surpriseScores, inflationGaps, upcomingEventRisk, type CalendarEvent } from '../src/lib/fundamental/calendar'

// ── Configuratie ──────────────────────────────────────────────
const START = '2024-08-01'          // eerste gesimuleerde call-dag
const CALL_HOUR_UTC = 6.5           // 06:30 UTC, zelfde als de live cron

// ── Kalender: in blokken van 60 dagen ophalen ─────────────────
async function fetchCalendarRange(fromISO: string, toISO: string): Promise<CalendarEvent[]> {
  const out: CalendarEvent[] = []
  const countries = MAJORS.map((c) => CCY_COUNTRY[c]).join(',')
  let cur = new Date(fromISO + 'T00:00:00Z').getTime()
  const end = new Date(toISO + 'T00:00:00Z').getTime()
  while (cur < end) {
    const next = Math.min(cur + 60 * 86400000, end)
    const url = `https://economic-calendar.tradingview.com/events?from=${new Date(cur).toISOString()}&to=${new Date(next).toISOString()}&countries=${countries}`
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          headers: {
            Origin: 'https://www.tradingview.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const rows: Record<string, unknown>[] = json?.result || []
        for (const r of rows) {
          out.push({
            title: String(r.title || ''),
            indicator: r.indicator ? String(r.indicator) : undefined,
            currency: String(r.currency || ''),
            date: String(r.date || ''),
            importance: typeof r.importance === 'number' ? r.importance : -1,
            actual: typeof r.actual === 'number' ? r.actual : null,
            forecast: typeof r.forecast === 'number' ? r.forecast : null,
            previous: typeof r.previous === 'number' ? r.previous : null,
            unit: r.unit ? String(r.unit) : undefined,
          })
        }
        break
      } catch (e) {
        if (attempt === 2) throw e
        await new Promise((r) => setTimeout(r, 1500))
      }
    }
    console.log(`kalender t/m ${new Date(next).toISOString().slice(0, 10)}: ${out.length} events`)
    cur = next
    await new Promise((r) => setTimeout(r, 400))
  }
  out.sort((a, b) => a.date.localeCompare(b.date))
  return out
}

// ── CB-stance-proxy uit historische rentebesluiten ────────────
// Laatste beleidswijziging vóór t: verhoging → hawkish, verlaging → dovish,
// met verval (≤120d: ±2 · ≤270d: ±1 · anders 0). Ruw maar point-in-time.
interface RateDecision { t: number; rate: number }
function buildRateDecisions(events: CalendarEvent[]): Record<string, RateDecision[]> {
  const out: Record<string, RateDecision[]> = {}
  for (const c of MAJORS) out[c] = []
  for (const ev of events) {
    if (ev.actual == null || !out[ev.currency]) continue
    const t = `${ev.indicator || ''} ${ev.title}`.toLowerCase()
    if (!/(interest rate decision|rate decision)/.test(t)) continue
    out[ev.currency].push({ t: new Date(ev.date).getTime(), rate: ev.actual })
  }
  for (const c of MAJORS) out[c].sort((a, b) => a.t - b.t)
  return out
}
// Beleidsrente op een moment t (point-in-time, uit de besluiten-reeks).
function rateAt(decisions: RateDecision[], nowMs: number): number | null {
  let r: number | null = null
  for (const d of decisions) { if (d.t < nowMs) r = d.rate; else break }
  return r
}

function cbBiasRaw(decisions: RateDecision[], nowMs: number): number {
  let lastMoveT = -1, dir = 0
  for (let i = 1; i < decisions.length; i++) {
    if (decisions[i].t >= nowMs) break
    const d = decisions[i].rate - decisions[i - 1].rate
    if (Math.abs(d) > 1e-9) { lastMoveT = decisions[i].t; dir = d > 0 ? 1 : -1 }
  }
  if (dir === 0 || lastMoveT < 0) return 0
  const days = (nowMs - lastMoveT) / 86400000
  if (days <= 120) return dir * 2
  if (days <= 270) return dir * 1
  return 0
}

// ── Candle-hulpjes ────────────────────────────────────────────
function upTo(hist: Candle[], dateExcl: string): Candle[] {
  // Voltooide candles vóór de call-dag (datum < dateExcl).
  let i = hist.length
  while (i > 0 && hist[i - 1].date >= dateExcl) i--
  return hist.slice(0, i)
}
function change5d(hist: Candle[]): number | null {
  if (hist.length < 6) return null
  const last = hist[hist.length - 1].close, ago = hist[hist.length - 6].close
  if (!ago) return null
  return +(((last - ago) / ago) * 100).toFixed(2)
}
function dailyChange(hist: Candle[]): { changePct: number; direction: 'up' | 'down' | 'flat' } {
  if (hist.length < 2) return { changePct: 0, direction: 'flat' }
  const cur = hist[hist.length - 1].close, prev = hist[hist.length - 2].close
  if (!prev) return { changePct: 0, direction: 'flat' }
  const changePct = +(((cur - prev) / prev) * 100).toFixed(2)
  return { changePct, direction: changePct > 0.01 ? 'up' : changePct < -0.01 ? 'down' : 'flat' }
}

async function main() {
  const histFrom = new Date(new Date(START + 'T00:00:00Z').getTime() - 120 * 86400000).toISOString().slice(0, 10)

  console.log('── candles ophalen (21 paren + intermarket + grondstoffen) ──')
  const candles: Record<string, Candle[]> = {}
  const allSymbols: [string, string][] = [
    ...PAIRS.map((p) => [p, PAIR_SYMBOLS[p]] as [string, string]),
    ...Object.entries(INTERMARKET_SYMBOLS),
    ...Object.entries(COMMODITY_SYMBOLS).map(([c, v]) => [`COM:${c}`, v.symbol] as [string, string]),
  ]
  for (const [key, sym] of allSymbols) {
    candles[key] = await fetchDailyCandles(sym, histFrom)
    if (candles[key].length === 0) console.warn(`⚠ geen candles voor ${key} (${sym})`)
    await new Promise((r) => setTimeout(r, 250))
  }
  console.log(`candles klaar; EUR/USD: ${candles['EUR/USD']?.length} dagen`)

  console.log('── kalender ophalen ──')
  const calFrom = new Date(new Date(START + 'T00:00:00Z').getTime() - 60 * 86400000).toISOString().slice(0, 10)
  const events = await fetchCalendarRange(calFrom, new Date().toISOString().slice(0, 10))
  const withActual = events.filter((e) => e.actual != null).length
  console.log(`events: ${events.length}, met actual: ${withActual}`)
  const decisions = buildRateDecisions(events)
  for (const c of MAJORS) console.log(`  ${c}: ${decisions[c].length} rentebesluiten`)

  // Call-dagen = handelsdagen uit de EUR/USD-reeks vanaf START.
  const dayList = (candles['EUR/USD'] || []).map((c) => c.date).filter((d) => d >= START)
  console.log(`── simulatie over ${dayList.length} handelsdagen ──`)

  // mfe/mae = grootste beweging mee/tegen binnen de horizon (pips, met koers
  // en datum zodat elke move in TradingView na te rekenen is).
  interface BtHorizon {
    x: string; xp: number; ok: boolean; pips: number; pct: number; cpct?: number
    mfe?: number; mfp?: number; mfd?: string   // favorabel: pips, prijs, datum
    mae?: number; map?: number; mad?: string   // adverse:  pips, prijs, datum
  }
  interface BtTrade {
    d: string; p: string; dir: 'L' | 'S'; f: number; bias: number; timing: number; c: number
    e: number; ed: string; atr: number | null
    h: Partial<Record<number, BtHorizon>>
  }
  const trades: BtTrade[] = []
  // Carry-lens: maandag-entries, long de high-yielder (|verschil| ≥ 2pp),
  // niet in Risk-Off. cpct = %-resultaat inclusief swap-benadering.
  interface CarryTrade { d: string; p: string; dir: 'L' | 'S'; diff: number; e: number; ed: string; h: Partial<Record<number, BtHorizon>> }
  const carryTrades: CarryTrade[] = []

  for (const D of dayList) {
    const nowMs = new Date(D + 'T00:00:00Z').getTime() + CALL_HOUR_UTC * 3600000

    // Valutascores (point-in-time): CB-proxy ×2 + verrassingen + inflatie + grondstoffen.
    const surprises = surpriseScores(events, nowMs)
    const gaps = inflationGaps(events, nowMs)
    const risk = upcomingEventRisk(events, nowMs, 2)
    const cs: Record<string, CurrencyScore> = {}
    for (const ccy of MAJORS) {
      const comHist = COMMODITY_SYMBOLS[ccy] ? upTo(candles[`COM:${ccy}`] || [], D) : []
      const comPct = comHist.length ? change5d(comHist) : null
      const commodityPts = comPct == null ? 0 : +Math.max(-1, Math.min(1, comPct / 3)).toFixed(2)
      const score = cbBiasRaw(decisions[ccy], nowMs) * 2
        + (surprises[ccy]?.pts ?? 0)
        + (gaps[ccy]?.pts ?? 0)
        + commodityPts
      cs[ccy] = { currency: ccy, score, baseScore: score, newsBonus: 0, reasons: [], newsHeadlines: [], breakdown: null as never }
    }
    const { regime } = determineRegime(cs)

    const imSignals: ImSignal[] = Object.keys(INTERMARKET_SYMBOLS).map((k) => {
      const ch = dailyChange(upTo(candles[k] || [], D))
      return { key: k, direction: ch.direction, changePct: ch.changePct }
    })
    const imAlignment = calculateIntermarketAlignment(imSignals, regime)

    type Draft = BtTrade & { conv: number }
    const drafts: Draft[] = []
    for (const pair of PAIRS) {
      const pb = computePairBias(pair, cs)
      if (pb.direction === 'neutraal' || Math.abs(pb.score) < FUND_GATE) continue
      const hist = upTo(candles[pair] || [], D)
      if (hist.length < 15) continue
      const last = hist[hist.length - 1]
      const mom = momentum5d(hist, pair)
      const atr = atr14Pips(hist, pair)
      const evCount = (risk[pb.base]?.length || 0) + (risk[pb.quote]?.length || 0)
      const conv = buildConvictionV2({
        fundScore: pb.score, base: pb.base, quote: pb.quote, direction: pb.direction,
        momentum5dPips: mom.pips, atrPips: atr, imAlignment, regime,
        highImpactEventCount: Math.min(evCount, 4),
      })
      drafts.push({
        d: D, p: pair, dir: pb.direction === 'bullish' ? 'L' : 'S',
        f: +pb.score.toFixed(2), bias: conv.biasScore, timing: conv.timingScore, c: conv.total,
        e: last.close, ed: last.date, atr, h: {}, conv: conv.total,
      })
    }
    drafts.sort((a, b) => b.conv - a.conv)
    const top = drafts.slice(0, MAX_CALLS_PER_DAY)

    // Uitkomsten meten op de volledige (toekomstige) reeks — evaluatie mag
    // vooruit kijken, alleen het SIGNAAL niet.
    for (const t of top) {
      const isBull = t.dir === 'L'
      for (const hz of HORIZONS) {
        const out = evaluateHorizon(candles[t.p] || [], t.ed, t.e, isBull, t.p, hz)
        if (!out || out.exitPrice == null) continue
        const mult = pipMult(t.p)
        const raw = out.exitPrice - t.e
        const pips = Math.round((isBull ? raw : -raw) * mult)
        const pct = +(((isBull ? raw : -raw) / t.e) * 100).toFixed(3)
        t.h[hz] = {
          x: out.exitDate!, xp: out.exitPrice, ok: !!out.correct, pips, pct,
          mfe: out.mfePips ?? undefined, mfp: out.mfePrice ?? undefined, mfd: out.mfeDate ?? undefined,
          mae: out.maePips ?? undefined, map: out.maePrice ?? undefined, mad: out.maeDate ?? undefined,
        }
      }
      const { conv: _omit, ...rest } = t
      trades.push(rest)
    }

    // ── Carry-lens: alleen op maandagen (weken vasthouden, geen overlap-explosie) ──
    const isMonday = new Date(D + 'T00:00:00Z').getUTCDay() === 1
    if (isMonday && regime !== 'Risk-Off') {
      for (const pair of PAIRS) {
        const [base, quote] = pair.split('/')
        const rb = rateAt(decisions[base], nowMs), rq = rateAt(decisions[quote], nowMs)
        if (rb == null || rq == null) continue
        const diff = +(rb - rq).toFixed(2)
        if (Math.abs(diff) < 2) continue
        const hist = upTo(candles[pair] || [], D)
        if (hist.length < 2) continue
        const entry = hist[hist.length - 1]
        const isBull = diff > 0
        const ct: CarryTrade = { d: D, p: pair, dir: isBull ? 'L' : 'S', diff, e: entry.close, ed: entry.date, h: {} }
        for (const hz of HORIZONS) {
          const out = evaluateHorizon(candles[pair] || [], entry.date, entry.close, isBull, pair, hz)
          if (!out || out.exitPrice == null) continue
          const mult = pipMult(pair)
          const raw = out.exitPrice - entry.close
          const pips = Math.round((isBull ? raw : -raw) * mult)
          const pct = +(((isBull ? raw : -raw) / entry.close) * 100).toFixed(3)
          const calDays = (new Date(out.exitDate! + 'T00:00:00Z').getTime() - new Date(entry.date + 'T00:00:00Z').getTime()) / 86400000
          const cpct = +(pct + (Math.abs(diff) * calDays) / 365).toFixed(3)
          ct.h[hz] = {
            x: out.exitDate!, xp: out.exitPrice, ok: !!out.correct, pips, pct, cpct,
            mfe: out.mfePips ?? undefined, mfp: out.mfePrice ?? undefined, mfd: out.mfeDate ?? undefined,
            mae: out.maePips ?? undefined, map: out.maePrice ?? undefined, mad: out.maeDate ?? undefined,
          }
        }
        carryTrades.push(ct)
      }
    }
  }

  console.log(`trades: ${trades.length} | carry-trades (maandagen): ${carryTrades.length}`)

  // Snelle sanity-samenvatting per horizon.
  for (const hz of HORIZONS) {
    const done = trades.filter((t) => t.h[hz])
    const wins = done.filter((t) => t.h[hz]!.ok).length
    const sumPips = done.reduce((a, t) => a + t.h[hz]!.pips, 0)
    const posPct = done.filter((t) => t.h[hz]!.pct > 0).reduce((a, t) => a + t.h[hz]!.pct, 0)
    const negPct = done.filter((t) => t.h[hz]!.pct < 0).reduce((a, t) => a - t.h[hz]!.pct, 0)
    console.log(`${String(hz).padStart(2)}d: n=${done.length} winrate=${(100 * wins / Math.max(1, done.length)).toFixed(1)}% som=${sumPips}p PF%=${negPct > 0 ? (posPct / negPct).toFixed(2) : '∞'}`)
  }
  console.log('carry-lens:')
  for (const hz of HORIZONS) {
    const done = carryTrades.filter((t) => t.h[hz])
    if (!done.length) continue
    const winsC = done.filter((t) => (t.h[hz]!.cpct ?? 0) > 0).length
    const posC = done.filter((t) => (t.h[hz]!.cpct ?? 0) > 0).reduce((a, t) => a + t.h[hz]!.cpct!, 0)
    const negC = done.filter((t) => (t.h[hz]!.cpct ?? 0) < 0).reduce((a, t) => a - t.h[hz]!.cpct!, 0)
    console.log(`${String(hz).padStart(2)}d: n=${done.length} winrate(incl.swap)=${(100 * winsC / done.length).toFixed(1)}% PF=${negC > 0 ? (posC / negC).toFixed(2) : '∞'}`)
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    model: 'v2',
    period: { from: dayList[0], to: dayList[dayList.length - 1] },
    days: dayList.length,
    trades: trades.length,
    callMomentUTC: '06:30',
    method: 'Point-in-time simulatie: per dag alleen voltooide dag-candles t/m de vorige handelsdag en kalender-events van vóór 06:30 UTC. Zelfde gate (|score| ≥ 2), zelfde top-8-selectie, zelfde bias/timing-formules als live v2.',
    deviations: [
      'Geen nieuwscomponent: er bestaat geen historisch nieuwsarchief; nieuws achteraf simuleren zou look-ahead zijn.',
      'CB-bias is een proxy uit historische rentebesluiten (laatste verhoging/verlaging met verval), niet het handmatige live-label.',
      'Geen rente-vs-doel-component: het beleidsdoel per centrale bank is historisch niet beschikbaar.',
    ],
    carry: {
      trades: carryTrades.length,
      method: 'Carry-lens: maandag-entries, long de valuta met de hoogste beleidsrente (verschil ≥ 2pp), niet in Risk-Off. cpct = koersresultaat + renteverschil naar rato van de kalenderdagen (swap-benadering op beleidsrente; echte broker-swap is ongunstiger).',
    },
  }

  const outPath = resolve(__dirname, '../public/fb-backtest-v2.json')
  mkdirSync(resolve(__dirname, '../public'), { recursive: true })
  const payload = JSON.stringify({ meta, trades, carryTrades })
  writeFileSync(outPath, payload)
  console.log(`geschreven: ${outPath} (${(payload.length / 1024).toFixed(0)} kB)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
