#!/usr/bin/env node
// ─── AUDIT FASE 1a — Boekhoudcontroles op de opgeslagen calls ──
// Rekent uitsluitend op de lokale export (scripts/audit/data/).
// Geen databasequeries, geen wijzigingen.
//
// Controles:
//  1. Wanneer werden calls aangemaakt (cron 06:00 vs bezoeker-trigger)?
//  2. Hoe lang duurde het echt tot afrekening ("1 dag vasthouden")?
//  3. Openstaande calls die nooit sluiten.
//  4. Interne consistentie: pips_moved vs entry/exit (incl. JPY-omrekening).
//  5. Interne consistentie: result vs richting van de beweging.
//  6. "TP gehit"-badge in de UI: hoe vaak is die claim onwaar (120/40 pips)?
//  7. Clustering: zelfde paar op opeenvolgende dagen → effectief aantal
//     onafhankelijke waarnemingen.
//
// Draaien:  node scripts/audit/fase1-boekhouding.mjs
// ──────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs'

const rows = JSON.parse(readFileSync('scripts/audit/data/trade_focus_records.json', 'utf8'))
const isLive = (r) => {
  const c = (r.created_at || '').slice(0, 10)
  return (new Date(c + 'T00:00:00Z') - new Date(r.date + 'T00:00:00Z')) / 86400000 <= 1.5
}
const live = rows.filter(isLive)
const resolved = live.filter((r) => r.result === 'correct' || r.result === 'incorrect')
const mult = (pair) => (pair.includes('JPY') ? 100 : 10000)
const isLong = (r) => (r.direction || '').includes('bullish')

const out = { nLive: live.length, nResolved: resolved.length }

// ─── 1. aanmaakmoment: cron (06:0x UTC) of bezoeker? ─────────
{
  const hours = {}
  let cron = 0, visitor = 0
  const visitorDates = new Set()
  for (const r of live) {
    const t = r.metadata?.callTime || r.created_at
    const d = new Date(t)
    const h = d.getUTCHours()
    hours[h] = (hours[h] || 0) + 1
    // cron draait 06:00 UTC; alles binnen 06:00–06:14 rekenen we als cron
    if (h === 6 && d.getUTCMinutes() < 15) cron++
    else { visitor++; visitorDates.add(r.date) }
  }
  out.aanmaak = { perUurUTC: hours, cron0600: cron, buitenCron: visitor, dagenMetBuitenCronCalls: visitorDates.size }
}

// ─── 2. werkelijke duur tot afrekening ────────────────────────
{
  const buckets = { '<20u': 0, '20-28u': 0, '28-48u': 0, '48-80u': 0, '>80u': 0 }
  const weekendResolved = []
  const durations = []
  for (const r of resolved) {
    const t0 = new Date(r.metadata?.callTime || r.created_at)
    const t1 = new Date(r.metadata?.exitTime || r.resolved_at)
    if (isNaN(t0) || isNaN(t1)) continue
    const h = (t1 - t0) / 3600000
    durations.push(h)
    if (h < 20) buckets['<20u']++
    else if (h < 28) buckets['20-28u']++
    else if (h < 48) buckets['28-48u']++
    else if (h < 80) buckets['48-80u']++
    else buckets['>80u']++
    const dow = t1.getUTCDay()
    if (dow === 0 || dow === 6) weekendResolved.push({ id: r.id, date: r.date, pair: r.pair, resolved_at: r.resolved_at })
  }
  durations.sort((a, b) => a - b)
  const pct = (p) => durations[Math.floor(p * (durations.length - 1))]
  out.duurTotAfrekening = {
    n: durations.length,
    buckets,
    medianUur: +pct(0.5).toFixed(1),
    p10: +pct(0.1).toFixed(1),
    p90: +pct(0.9).toFixed(1),
    min: +durations[0].toFixed(1),
    max: +durations[durations.length - 1].toFixed(1),
    afgerekendInWeekend: weekendResolved.length,
    weekendVoorbeelden: weekendResolved.slice(0, 5),
  }
}

// ─── 3. calls die nooit sluiten ───────────────────────────────
{
  const pending = live.filter((r) => r.result === 'pending')
  out.openstaand = pending.map((r) => ({
    id: r.id, date: r.date, pair: r.pair, direction: r.direction,
    entry: r.entry_price, created_at: r.created_at,
  }))
}

// ─── 4. pips_moved vs entry/exit (pip-omrekening) ────────────
{
  let ok = 0
  const fouten = []
  let jpyOk = 0, jpyTotal = 0
  for (const r of resolved) {
    if (r.entry_price == null || r.exit_price == null) {
      fouten.push({ id: r.id, date: r.date, pair: r.pair, reden: 'entry of exit ontbreekt' })
      continue
    }
    const expected = Math.round(Math.abs(r.exit_price - r.entry_price) * mult(r.pair)) * (r.result === 'correct' ? 1 : -1)
    const isJpy = r.pair.includes('JPY')
    if (isJpy) jpyTotal++
    if (Math.abs((r.pips_moved ?? 0) - expected) <= 1) { ok++; if (isJpy) jpyOk++ }
    else fouten.push({ id: r.id, date: r.date, pair: r.pair, opgeslagen: r.pips_moved, verwacht: expected, entry: r.entry_price, exit: r.exit_price })
  }
  out.pipsConsistentie = { ok, fouten: fouten.length, jpy: `${jpyOk}/${jpyTotal}`, voorbeelden: fouten.slice(0, 8) }
}

// ─── 5. result vs richting van de beweging ────────────────────
{
  let consistent = 0
  const tegenspraak = []
  let zeroMoves = 0
  for (const r of resolved) {
    if (r.entry_price == null || r.exit_price == null) continue
    const diff = r.exit_price - r.entry_price
    if (diff === 0) { zeroMoves++; continue }
    const won = isLong(r) ? diff > 0 : diff < 0
    const expected = won ? 'correct' : 'incorrect'
    if (r.result === expected) consistent++
    else tegenspraak.push({ id: r.id, date: r.date, pair: r.pair, direction: r.direction, entry: r.entry_price, exit: r.exit_price, result: r.result })
  }
  out.resultConsistentie = {
    consistent, tegenspraken: tegenspraak.length,
    nulBewegingAlsVerlies: zeroMoves,
    voorbeelden: tegenspraak.slice(0, 8),
  }
}

// ─── 6. de "TP gehit"-badge (UI verzint TP 120 / SL 40 pips) ──
{
  const correct = resolved.filter((r) => r.result === 'correct')
  const incorrect = resolved.filter((r) => r.result === 'incorrect')
  const tpEcht = correct.filter((r) => (r.pips_moved ?? 0) >= 120)
  const tpVals = correct.filter((r) => (r.pips_moved ?? 0) < 120)
  // voorbeeld uit de opdracht: EUR/CHF 2026-06-18
  const voorbeeld = rows.find((r) => r.id === '0c60a3f3-41d0-4420-821c-85d8cc01b6f2')
  out.tpBadge = {
    correctTotaal: correct.length,
    echtMinstens120Pips: tpEcht.length,
    valseTpClaim: tpVals.length,
    incorrectTotaal: incorrect.length,
    bekendVoorbeeld: voorbeeld ? { id: voorbeeld.id, date: voorbeeld.date, pair: voorbeeld.pair, entry: voorbeeld.entry_price, exit: voorbeeld.exit_price, pips: voorbeeld.pips_moved, result: voorbeeld.result } : null,
    valseVoorbeelden: tpVals.slice(0, 5).map((r) => ({ id: r.id, date: r.date, pair: r.pair, pips: r.pips_moved })),
  }
}

// ─── 7. clustering → effectief aantal onafhankelijke calls ───
// Cluster = zelfde paar + zelfde richting, waarbij de volgende call binnen
// 4 kalenderdagen valt (overbrugt weekend). Elke cluster telt als 1
// onafhankelijke waarneming.
{
  const sorted = [...live].sort((a, b) => (a.pair + a.date).localeCompare(b.pair + b.date))
  let clusters = 0
  const clusterSizes = []
  let prev = null
  let size = 0
  for (const r of sorted) {
    const sameRun = prev
      && prev.pair === r.pair
      && isLong(prev) === isLong(r)
      && (new Date(r.date) - new Date(prev.date)) / 86400000 <= 4
    if (sameRun) size++
    else {
      if (size > 0) clusterSizes.push(size)
      clusters++
      size = 1
    }
    prev = r
  }
  if (size > 0) clusterSizes.push(size)
  const maxSize = Math.max(...clusterSizes)
  const langste = []
  {
    // vind de langste runs voor het rapport
    let p = null, s = 0, start = null
    for (const r of sorted) {
      const sameRun = p && p.pair === r.pair && isLong(p) === isLong(r) && (new Date(r.date) - new Date(p.date)) / 86400000 <= 4
      if (sameRun) s++
      else { if (s >= 10 && p) langste.push({ pair: p.pair, tot: p.date, van: start, lengte: s }); s = 1; start = r.date }
      p = r
    }
    if (s >= 10 && p) langste.push({ pair: p.pair, tot: p.date, van: start, lengte: s })
  }
  out.clustering = {
    callsLive: live.length,
    clusters,
    gemClusterGrootte: +(live.length / clusters).toFixed(2),
    maxClusterGrootte: maxSize,
    langsteRuns: langste.sort((a, b) => b.lengte - a.lengte).slice(0, 8),
  }
}

// ─── 8. gemiddelde beweging vs spread (kosten) ────────────────
{
  const absPips = resolved.map((r) => Math.abs(r.pips_moved ?? 0)).sort((a, b) => a - b)
  const avg = absPips.reduce((a, b) => a + b, 0) / absPips.length
  out.bewegingVsSpread = {
    gemAbsPips1d: +avg.toFixed(1),
    mediaanAbsPips1d: absPips[Math.floor(absPips.length / 2)],
    toelichting: 'typische retail-spread: majors 0.6-1.5 pips, crosses 2-4 pips, JPY-crosses 2-5 pips — niet meegenomen in de meting',
  }
}

writeFileSync('scripts/audit/data/fase1-boekhouding.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
