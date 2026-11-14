#!/usr/bin/env node
// ─── AUDIT FASE 2b — Baselines: waar komt de (eventuele) edge vandaan? ──
// Vergelijkt op dezelfde dagen en paren (live periode, alle 21 paren):
//   1. muntworp        — theoretisch 50% (drift per paar apart gerapporteerd)
//   2. alleen contrarian — tegen de 5-daagse beweging in, elk paar elke dag
//   3. alleen momentum  — met de 5-daagse beweging mee, elk paar elke dag
//   4. fundamentals-proxy — richting van de meest recente tool-call voor dat
//      paar (≤ 7 kalenderdagen oud), zonder contrarian-timing. BENADERING:
//      de echte dagelijkse fundamentele score is niet reconstrueerbaar
//      (inputs niet bewaard, zie fase 0).
//   5. de volledige tool — de opgeslagen calls zelf
//
// Meting identiek aan de auditdataset (fase 1): referentie = close van de
// call-dag, horizon n = n voltooide handelsdagen later, drempel 30/50 pips.
// Beslissingsinput (5d-momentum) gebruikt alleen candles die op de
// beslisdag al voltooid waren (t/m D-1).
//
// Betrouwbaarheid: n_eff = aantal onafhankelijke clusters (zelfde paar +
// zelfde richting, opeenvolgend ≤ 4 kalenderdagen). Wilson-interval op n_eff.
//
// Draaien:  node scripts/audit/fase2-baselines.mjs
// ──────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs'

const candles = JSON.parse(readFileSync('scripts/audit/data/candles.json', 'utf8'))
const audit = JSON.parse(readFileSync('scripts/audit/data/audit-outcomes.json', 'utf8'))
const PAIRS = Object.keys(candles)
const HORIZONS = [1, 3, 5, 10, 20]
const FROM = '2026-04-03', TO = '2026-11-13'
const mult = (p) => (p.includes('JPY') ? 100 : 10000)
const threshold = (p) => (p.includes('JPY') ? 50 : 30)

function atr14At(bars, idx, pair) {
  if (idx < 14) return null
  let sum = 0
  for (let i = idx - 13; i <= idx; i++) {
    const c = bars[i], prev = bars[i - 1]
    sum += Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
  }
  return (sum / 14) * mult(pair)
}

// tool-calls (live) per dag+paar
const toolCalls = new Map()
for (const c of audit.filter((c) => c.klasse === 'live')) {
  toolCalls.set(`${c.date}|${c.pair}`, c)
}
// per paar: gesorteerde lijst van calls (voor de fundamentals-proxy)
const callsByPair = {}
for (const c of audit.filter((c) => c.klasse === 'live')) {
  (callsByPair[c.pair] = callsByPair[c.pair] || []).push(c)
}
for (const list of Object.values(callsByPair)) list.sort((a, b) => a.date.localeCompare(b.date))

// ─── cellen bouwen: elk paar × elke handelsdag in de live periode ──
const cells = []
for (const pair of PAIRS) {
  const bars = candles[pair]
  const m = mult(pair)
  for (let i = 6; i < bars.length; i++) {
    const d = bars[i].date
    if (d < FROM || d > TO) continue
    // 5d-momentum op voltooide candles t/m D-1 (bekend op beslismoment 06:00)
    const mom5 = +((bars[i - 1].close - bars[i - 6].close) * m).toFixed(1)
    if (mom5 === 0) continue
    const atr = atr14At(bars, i, pair)
    const cell = { pair, date: d, mom5, atr, ref: bars[i].close, horizons: {} }
    for (const n of HORIZONS) {
      if (i + n >= bars.length) { cell.horizons[n] = null; continue }
      // beweging per horizon in "long-pips" (positief = koers omhoog)
      cell.horizons[n] = +(((bars[i + n].close - bars[i].close) * m)).toFixed(1)
    }
    // fundamentals-proxy: meest recente call ≤ 7 kalenderdagen terug (incl. vandaag)
    const list = callsByPair[pair] || []
    let proxy = null
    for (let k = list.length - 1; k >= 0; k--) {
      if (list[k].date > d) continue
      const ageDays = (new Date(d) - new Date(list[k].date)) / 86400000
      if (ageDays <= 7) proxy = list[k].richting
      break
    }
    cell.fundProxy = proxy
    const tc = toolCalls.get(`${d}|${pair}`)
    cell.tool = tc ? tc.richting : null
    cells.push(cell)
  }
}

// ─── strategie evalueren over cellen ──────────────────────────
function wilson(p, n, z = 1.96) {
  if (n === 0) return [0, 1]
  const d = 1 + (z * z) / n
  const center = (p + (z * z) / (2 * n)) / d
  const half = (z / d) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return [+(100 * (center - half)).toFixed(1), +(100 * (center + half)).toFixed(1)]
}

function clusterCount(trades) {
  // trades: {pair, date, dir}; cluster = zelfde paar+richting, gat ≤ 4 dagen
  const byPair = {}
  for (const t of trades) (byPair[t.pair] = byPair[t.pair] || []).push(t)
  let clusters = 0
  for (const list of Object.values(byPair)) {
    list.sort((a, b) => a.date.localeCompare(b.date))
    let prev = null
    for (const t of list) {
      const same = prev && prev.dir === t.dir && (new Date(t.date) - new Date(prev.date)) / 86400000 <= 4
      if (!same) clusters++
      prev = t
    }
  }
  return clusters
}

function evaluate(naam, picks) {
  // picks: [{cell, dir}] — dir = 'long' | 'short'
  const out = { strategie: naam }
  for (const n of HORIZONS) {
    const rows = picks.filter((p) => p.cell.horizons[n] != null)
    let klopt = 0, kloptNiet = 0, teKlein = 0, richtingGoed = 0, pipsSum = 0, atrSum = 0, atrN = 0
    const decidedTrades = []
    for (const { cell, dir } of rows) {
      const thr = threshold(cell.pair)
      const dirPips = cell.horizons[n] * (dir === 'long' ? 1 : -1)
      pipsSum += dirPips
      if (cell.atr) { atrSum += dirPips / cell.atr; atrN++ }
      if (dirPips > 0) richtingGoed++
      if (dirPips >= thr) { klopt++; decidedTrades.push({ pair: cell.pair, date: cell.date, dir }) }
      else if (dirPips <= -thr) { kloptNiet++; decidedTrades.push({ pair: cell.pair, date: cell.date, dir }) }
      else teKlein++
    }
    const beslist = klopt + kloptNiet
    const allTrades = rows.map(({ cell, dir }) => ({ pair: cell.pair, date: cell.date, dir }))
    const nEff = clusterCount(allTrades)
    const nEffBeslist = clusterCount(decidedTrades)
    const pDrempel = beslist > 0 ? klopt / beslist : null
    const pRichting = rows.length > 0 ? richtingGoed / rows.length : null
    out[`${n}d`] = {
      n: rows.length, nEff,
      winrateDrempel: pDrempel != null ? +(100 * pDrempel).toFixed(1) : null,
      ciDrempel: pDrempel != null ? wilson(pDrempel, nEffBeslist) : null,
      winrateRichting: pRichting != null ? +(100 * pRichting).toFixed(1) : null,
      ciRichting: pRichting != null ? wilson(pRichting, nEff) : null,
      gemPips: +(pipsSum / rows.length).toFixed(1),
      gemATR: atrN > 0 ? +(atrSum / atrN).toFixed(3) : null,
      teKleinPct: +(100 * teKlein / rows.length).toFixed(0),
    }
  }
  return out
}

const strategies = [
  evaluate('alleen contrarian (alle paren, elke dag)', cells.map((c) => ({ cell: c, dir: c.mom5 < 0 ? 'long' : 'short' }))),
  evaluate('alleen momentum (alle paren, elke dag)', cells.map((c) => ({ cell: c, dir: c.mom5 > 0 ? 'long' : 'short' }))),
  evaluate('fundamentals-proxy (richting laatste call ≤7d, zonder contrarian-timing)',
    cells.filter((c) => c.fundProxy).map((c) => ({ cell: c, dir: c.fundProxy }))),
  evaluate('volledige tool (opgeslagen calls)', cells.filter((c) => c.tool).map((c) => ({ cell: c, dir: c.tool }))),
  // contrarian beperkt tot dezelfde cellen als de tool → isoleert de
  // fundamentele selectie (richting is per constructie identiek; dit is een
  // consistentiecheck en hoort 1-op-1 gelijk te zijn aan de tool)
  evaluate('contrarian op exact de tool-cellen (check)', cells.filter((c) => c.tool).map((c) => ({ cell: c, dir: c.mom5 < 0 ? 'long' : 'short' }))),
]

// afwijking tool-richting vs contrarian-richting op tool-cellen
{
  const toolCells = cells.filter((c) => c.tool)
  const anders = toolCells.filter((c) => c.tool !== (c.mom5 < 0 ? 'long' : 'short'))
  strategies.push({ strategie: 'META', toolCellen: toolCells.length, toolRichtingAndersDanContrarian: anders.length, cellenTotaal: cells.length })
}

// drift per paar (basiskans dat de koers omhoog ging, 5d-horizon)
const drift = {}
for (const pair of PAIRS) {
  const rows = cells.filter((c) => c.pair === pair && c.horizons[5] != null)
  if (rows.length === 0) continue
  drift[pair] = +(100 * rows.filter((c) => c.horizons[5] > 0).length / rows.length).toFixed(1)
}

const result = { cellen: cells.length, periode: `${FROM} → ${TO}`, strategies, drift5d: drift }
writeFileSync('scripts/audit/data/fase2-baselines.json', JSON.stringify(result, null, 2))

for (const s of strategies) {
  if (s.strategie === 'META') { console.log('\nMETA:', JSON.stringify(s)); continue }
  console.log(`\n── ${s.strategie} ──`)
  for (const n of HORIZONS) {
    const r = s[`${n}d`]
    console.log(`  ${String(n).padStart(2)}d: richting ${r.winrateRichting}% CI[${r.ciRichting}] | drempel ${r.winrateDrempel}% CI[${r.ciDrempel}] | pips ${r.gemPips} | ATR ${r.gemATR} | n=${r.n} (eff ${r.nEff}) | te_klein ${r.teKleinPct}%`)
  }
}
console.log('\ndrift 5d (% cellen omhoog):', JSON.stringify(drift))
