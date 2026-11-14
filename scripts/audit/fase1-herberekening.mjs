#!/usr/bin/env node
// ─── AUDIT FASE 1b — Uitkomsten herberekenen uit ruwe candles ──
// Haalt dag-OHLC per paar op bij Yahoo Finance (met de gecorrigeerde
// sessie-datering uit src/lib/fundamental/prices.ts) en bouwt een
// aparte auditdataset. Schrijft NIETS naar de database.
//
// Definities in de auditdataset:
//   Referentie B (primair) = slotkoers van de call-dag zelf: de eerste
//     voltooide dag-candle op of ná de call-datum. Dit is de eerste
//     schone koers die volledig ná publicatie (±06:00 UTC) ligt —
//     geen enkele input van het signaal overlapt met de meetperiode.
//   Referentie A (ter vergelijking) = slotkoers van de laatste voltooide
//     candle vóór de call-dag (de conventie van de nieuwe FB-tool).
//   Horizon n = n voltooide handelsdagen (candles) na de referentie.
//   Status per horizon: beweging in call-richting ≥ drempel → 'klopt';
//     ≤ -drempel → 'klopt_niet'; anders 'te_klein'. Drempel: 30 pips
//     (majors/crosses), 50 pips (JPY-paren). Daarnaast pure richting.
//
// Draaien:  node scripts/audit/fase1-herberekening.mjs
// ──────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const PAIR_SYMBOLS = {
  'EUR/USD': 'EURUSD=X', 'GBP/USD': 'GBPUSD=X', 'USD/JPY': 'USDJPY=X',
  'AUD/USD': 'AUDUSD=X', 'NZD/USD': 'NZDUSD=X', 'USD/CAD': 'USDCAD=X',
  'USD/CHF': 'USDCHF=X', 'EUR/GBP': 'EURGBP=X', 'EUR/JPY': 'EURJPY=X',
  'GBP/JPY': 'GBPJPY=X', 'AUD/JPY': 'AUDJPY=X', 'NZD/JPY': 'NZDJPY=X',
  'CAD/JPY': 'CADJPY=X', 'EUR/AUD': 'EURAUD=X', 'GBP/AUD': 'GBPAUD=X',
  'AUD/NZD': 'AUDNZD=X', 'EUR/CHF': 'EURCHF=X', 'GBP/CHF': 'GBPCHF=X',
  'EUR/CAD': 'EURCAD=X', 'GBP/NZD': 'GBPNZD=X', 'AUD/CAD': 'AUDCAD=X',
}
const HORIZONS = [1, 3, 5, 10, 20]
const DAY_SEC = 86400
const mult = (pair) => (pair.includes('JPY') ? 100 : 10000)
const threshold = (pair) => (pair.includes('JPY') ? 50 : 30)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Sessie-datering: identiek aan src/lib/fundamental/prices.ts (audit-fix jul 2026)
function sessionDateUTC(t) {
  const midnight = Math.round(t / DAY_SEC) * DAY_SEC
  return new Date(midnight * 1000).toISOString().split('T')[0]
}
const distMidnight = (t) => Math.abs(t - Math.round(t / DAY_SEC) * DAY_SEC)
const isWeekendDate = (d) => [0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay())

async function fetchDailyCandles(symbol, fromISO) {
  const p1 = Math.floor(new Date(fromISO + 'T00:00:00Z').getTime() / 1000)
  const nowSec = Math.floor(Date.now() / 1000)
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
      try {
        const res = await fetch(
          `https://${host}/v8/finance/chart/${symbol}?interval=1d&period1=${p1}&period2=${nowSec}`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } },
        )
        if (!res.ok) continue
        const json = await res.json()
        const result = json?.chart?.result?.[0]
        if (!result) continue
        const ts = result.timestamp || []
        const q = result.indicators?.quote?.[0] || {}
        const raw = ts
          .map((t, i) => ({ t, date: sessionDateUTC(t), open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i] }))
          .filter((c) => c.close != null && c.high != null && c.low != null)
          .filter((c) => c.t + DAY_SEC <= nowSec)      // alleen voltooide sessies
          .filter((c) => distMidnight(c.t) <= 7200)     // geen intraday snapshot-bars
        const byDate = new Map()
        for (const c of raw) {
          const cur = byDate.get(c.date)
          if (!cur || distMidnight(c.t) < distMidnight(cur.t)) byDate.set(c.date, c)
        }
        const bars = [...byDate.values()]
          .filter((c) => !isWeekendDate(c.date))
          .sort((a, b) => a.t - b.t)
          .map(({ t, ...c }) => c)
        if (bars.length > 0) return bars
      } catch { /* volgende host */ }
    }
    await sleep(800)
  }
  return []
}

// ─── candles ophalen (of hergebruiken als al gedownload) ─────
const CANDLE_FILE = 'scripts/audit/data/candles.json'
let candles
if (existsSync(CANDLE_FILE)) {
  candles = JSON.parse(readFileSync(CANDLE_FILE, 'utf8'))
  console.log('candles.json hergebruikt (verwijder het bestand voor een verse download)')
} else {
  candles = {}
  const entries = Object.entries(PAIR_SYMBOLS)
  for (let i = 0; i < entries.length; i += 4) {
    const batch = entries.slice(i, i + 4)
    const res = await Promise.all(batch.map(([, sym]) => fetchDailyCandles(sym, '2025-03-01')))
    batch.forEach(([pair], k) => { candles[pair] = res[k] })
    console.log(`  candles: ${Math.min(i + 4, entries.length)}/${entries.length} paren`)
    if (i + 4 < entries.length) await sleep(600)
  }
  writeFileSync(CANDLE_FILE, JSON.stringify(candles))
}
for (const [pair, bars] of Object.entries(candles)) {
  if (bars.length < 400) console.warn(`  LET OP: ${pair} heeft maar ${bars.length} candles`)
}

// ─── ATR14 in pips op een gegeven candle-index ────────────────
function atr14At(bars, idx, pair) {
  if (idx < 14) return null
  let sum = 0
  for (let i = idx - 13; i <= idx; i++) {
    const c = bars[i], prev = bars[i - 1]
    sum += Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
  }
  return Math.round((sum / 14) * mult(pair))
}

// ─── auditdataset bouwen ──────────────────────────────────────
const rows = JSON.parse(readFileSync('scripts/audit/data/trade_focus_records.json', 'utf8'))
const isLiveRow = (r) => (new Date((r.created_at || '').slice(0, 10) + 'T00:00:00Z') - new Date(r.date + 'T00:00:00Z')) / 86400000 <= 1.5

const auditCalls = []
let skipped = 0
for (const r of rows) {
  const bars = candles[r.pair]
  if (!bars || bars.length === 0) { skipped++; continue }
  const isLong = (r.direction || '').includes('bullish')
  const m = mult(r.pair)
  const thr = threshold(r.pair)

  // referenties
  const iB = bars.findIndex((c) => c.date >= r.date)        // eerste candle op/na call-dag
  const iA = iB - 1                                          // laatste candle vóór call-dag
  if (iB < 0 || iA < 0) { skipped++; continue }

  const call = {
    id: r.id, date: r.date, pair: r.pair, klasse: isLiveRow(r) ? 'live' : 'backfill',
    richting: isLong ? 'long' : 'short',
    score: r.score, conviction: r.conviction, regime: r.regime,
    imAlignment: r.metadata?.imAlignment ?? null,
    momentum5d: r.metadata?.momentum5d ?? null,
    opgeslagenResult: r.result, opgeslagenPips: r.pips_moved,
    entryTick: r.entry_price,
    refA: { date: bars[iA].date, close: bars[iA].close },
    refB: { date: bars[iB].date, close: bars[iB].close },
    atrB: atr14At(bars, iB, r.pair),
    // ligt de opgeslagen entry-tick binnen de range van de call-dag-sessie?
    tickInRange: r.entry_price != null
      ? r.entry_price >= bars[iB].low - 2 / m && r.entry_price <= bars[iB].high + 2 / m
      : null,
    horizons: {},
  }

  for (const n of HORIZONS) {
    const evalRef = (ri, refClose) => {
      const xi = ri + n
      if (xi >= bars.length) return { open: true }
      const exit = bars[xi]
      const dirPips = +(((exit.close - refClose) * m) * (isLong ? 1 : -1)).toFixed(1)
      const status = dirPips >= thr ? 'klopt' : dirPips <= -thr ? 'klopt_niet' : 'te_klein'
      return { open: false, exitDate: exit.date, exitClose: exit.close, dirPips, status, richtingGoed: dirPips > 0 }
    }
    call.horizons[n] = { A: evalRef(iA, bars[iA].close), B: evalRef(iB, bars[iB].close) }
  }

  // MFE/MAE t.o.v. referentie B over 20 handelsdagen (context, geen winrate)
  {
    const end = Math.min(iB + 20, bars.length - 1)
    let mfe = 0, mae = 0, mfeDay = 0
    for (let j = iB + 1; j <= end; j++) {
      const c = bars[j]
      const fav = (isLong ? c.high - call.refB.close : call.refB.close - c.low) * m
      const adv = (isLong ? c.low - call.refB.close : call.refB.close - c.high) * m
      if (fav > mfe) { mfe = fav; mfeDay = j - iB }
      if (adv < mae) mae = adv
    }
    call.mfe20 = { pips: Math.round(mfe), dag: mfeDay, dagenBeschikbaar: end - iB }
    call.mae20 = Math.round(mae)
  }

  auditCalls.push(call)
}

writeFileSync('scripts/audit/data/audit-outcomes.json', JSON.stringify(auditCalls, null, 1))

// ─── samenvatting ─────────────────────────────────────────────
const sum = { skipped, totaal: auditCalls.length }
for (const klasse of ['live', 'backfill']) {
  const calls = auditCalls.filter((c) => c.klasse === klasse)
  sum[klasse] = { n: calls.length }
  for (const n of HORIZONS) {
    const s = { klopt: 0, klopt_niet: 0, te_klein: 0, open: 0, richtingGoed: 0, richtingTotaal: 0 }
    for (const c of calls) {
      const h = c.horizons[n].B
      if (h.open) { s.open++; continue }
      s[h.status]++
      s.richtingTotaal++
      if (h.richtingGoed) s.richtingGoed++
    }
    const beslist = s.klopt + s.klopt_niet
    sum[klasse][`${n}d`] = {
      ...s,
      winrateDrempel: beslist > 0 ? +((s.klopt / beslist) * 100).toFixed(1) : null,
      winrateRichting: s.richtingTotaal > 0 ? +((s.richtingGoed / s.richtingTotaal) * 100).toFixed(1) : null,
    }
  }
}

// vergelijking: opgeslagen 1d-result vs schone herberekening (ref B, 1d)
{
  const live = auditCalls.filter((c) => c.klasse === 'live' && (c.opgeslagenResult === 'correct' || c.opgeslagenResult === 'incorrect'))
  let agree = 0, disagree = 0, open = 0
  const voorbeelden = []
  for (const c of live) {
    const h = c.horizons[1].B
    if (h.open) { open++; continue }
    const cleanWin = h.richtingGoed
    const storedWin = c.opgeslagenResult === 'correct'
    if (cleanWin === storedWin) agree++
    else { disagree++; if (voorbeelden.length < 5) voorbeelden.push({ id: c.id, date: c.date, pair: c.pair, opgeslagen: c.opgeslagenResult, pipsOpgeslagen: c.opgeslagenPips, schoon1d: h.dirPips }) }
  }
  sum.opgeslagenVsSchoon1d = { eens: agree, oneens: disagree, open, pctOneens: +((disagree / (agree + disagree)) * 100).toFixed(1), voorbeelden }
}

// entry-tick binnen dag-range?
{
  const live = auditCalls.filter((c) => c.klasse === 'live' && c.tickInRange != null)
  const buiten = live.filter((c) => !c.tickInRange)
  sum.entryTickBuitenDagRange = { n: buiten.length, van: live.length, voorbeelden: buiten.slice(0, 5).map((c) => ({ id: c.id, date: c.date, pair: c.pair, entry: c.entryTick })) }
}

writeFileSync('scripts/audit/data/fase1-herberekening-samenvatting.json', JSON.stringify(sum, null, 2))
console.log(JSON.stringify(sum, null, 2))
