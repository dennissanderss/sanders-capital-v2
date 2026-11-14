#!/usr/bin/env node
// ─── AUDIT FASE 4b — Verbetervoorstellen toetsen (70/30) ──────
// Universum: alle paren × handelsdagen 2025-04-01 → 2026-11-13.
// Chronologische splitsing: oudste 70% van de handelsdagen = ontwikkel,
// nieuwste 30% = toets (één keer beoordeeld, niets erop afgesteld).
//
// Meting identiek aan fase 1/2: referentie = close van de beslisdag,
// horizon n = n voltooide handelsdagen later; drempels 30/50 pips;
// beslisinputs gebruiken uitsluitend data t/m D-1 (of de op dag D
// 's ochtends gelockte FB-context).
//
// Factoren:
//  F1 rente-momentum  = teken van Δ5 (en Δ20) van het 2j-renteverschil
//  F0 rente-niveau    = teken van het renteverschil zelf (ter vergelijking:
//                       dit is wat de huidige CB-factor in wezen meet)
//  F2 verrassingen    = teken van surpriseDiff uit fb_daily_context
//                       (alleen 2026-07-06+, eigen 70/30 binnen die periode)
//  F3 CoT-extremen    = tegen extreme non-commercial positionering in
//                       (percentiel ≥90/≤10 over trailing 52 weken,
//                       beschikbaar 6 dagen na de as-of-datum)
//  F4 grondstoffen    = olie-Δ5d voor CAD, goud/koper-Δ5d voor AUD
//  F5 risicosentiment = risk-off-verandering (VIX/SP500 Δ5d) voor
//                       JPY/CHF-paren tegen niet-havens
//  REF contrarian     = tegen de 5d-beweging in (voltooide candles)
//
// Draaien:  node scripts/audit/fase4-toets.mjs
// ──────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs'

const candles = JSON.parse(readFileSync('scripts/audit/data/candles.json', 'utf8'))
const yields = JSON.parse(readFileSync('scripts/audit/data/fase4-yields.json', 'utf8'))
const im = JSON.parse(readFileSync('scripts/audit/data/fase4-intermarket.json', 'utf8'))
const cot = JSON.parse(readFileSync('scripts/audit/data/fase4-cot.json', 'utf8'))
const surprises = JSON.parse(readFileSync('scripts/audit/data/fase4-surprises.json', 'utf8'))

const FROM = '2025-04-01', TO = '2026-11-13'
const HORIZONS = [5, 20]
const mult = (p) => (p.includes('JPY') ? 100 : 10000)
const threshold = (p) => (p.includes('JPY') ? 50 : 30)
const YIELD_CCY = Object.keys(yields).filter((c) => (yields[c] || []).length > 200) // USD EUR JPY CAD AUD GBP

// ─── reeks-helpers: laatste waarde op of vóór een datum ───────
function seriesLookup(rows, key = 'y') {
  const norm = rows.map((r) => ({ date: r.date, v: r[key] }))
  return (date) => {
    // binair zoeken naar laatste index met norm[i].date <= date
    let lo = 0, hi = norm.length - 1, ans = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (norm[mid].date <= date) { ans = mid; lo = mid + 1 } else hi = mid - 1
    }
    return ans < 0 ? null : { idx: ans, value: norm[ans].v, at: (i) => norm[i]?.v }
  }
}
const yLookup = Object.fromEntries(YIELD_CCY.map((c) => [c, seriesLookup(yields[c])]))
const imLookup = Object.fromEntries(Object.keys(im).map((k) => [k, seriesLookup(im[k], 'close')]))

// Δn van een reeks, gemeten t/m D-1 (dus alleen op beslisdag bekende data)
function deltaN(lookup, dayBefore, n) {
  const cur = lookup(dayBefore)
  if (!cur || cur.idx < n) return null
  const prev = cur.at(cur.idx - n)
  if (cur.value == null || prev == null) return null
  return +(cur.value - prev).toFixed(4)
}

// CoT: per valuta weekrapporten met beschikbaarheidsdatum + trailing percentiel
const cotByCcy = {}
for (const r of cot) (cotByCcy[r.ccy] = cotByCcy[r.ccy] || []).push(r)
for (const list of Object.values(cotByCcy)) list.sort((a, b) => a.date.localeCompare(b.date))
function cotPercentile(ccy, date) {
  const list = cotByCcy[ccy]
  if (!list) return null
  // beschikbaar vanaf 6 kalenderdagen na de as-of-datum (publicatie vrijdag)
  const avail = list.filter((r) => {
    const d = new Date(r.date); d.setDate(d.getDate() + 6)
    return d.toISOString().slice(0, 10) <= date
  })
  if (avail.length < 30) return null
  const windowRows = avail.slice(-52)
  const cur = avail[avail.length - 1].net
  const below = windowRows.filter((r) => r.net <= cur).length
  return { pct: (below / windowRows.length) * 100, net: cur }
}

// verrassingen per datum
const surByDate = new Map(surprises.map((s) => [s.date, s.perCcy]))

// grondstof- en havengevoeligheid (zelfde tekens als de engine-constants)
const COMMODITY = { AUD: (d5gold, d5copper) => 0.6 * d5gold + 0.4 * d5copper, CAD: (d5oil) => d5oil }
const HAVENS = ['JPY', 'CHF']
const NON_HAVENS = ['AUD', 'NZD', 'CAD', 'EUR', 'GBP', 'USD']

// ─── cellen bouwen met alle factorwaarden ─────────────────────
const cells = []
for (const [pair, bars] of Object.entries(candles)) {
  const [base, quote] = pair.split('/')
  const m = mult(pair)
  for (let i = 26; i < bars.length; i++) {
    const d = bars[i].date
    if (d < FROM || d > TO) continue
    const dayBefore = bars[i - 1].date
    const cell = { pair, base, quote, date: d, ref: bars[i].close }
    // ATR14 op beslisdag
    let atr = 0
    for (let k = i - 13; k <= i; k++) {
      const c = bars[k], prev = bars[k - 1]
      atr += Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
    }
    cell.atr = (atr / 14) * m
    for (const n of HORIZONS) {
      cell[`h${n}`] = i + n < bars.length ? +(((bars[i + n].close - bars[i].close) * m)).toFixed(1) : null
    }
    // REF: 5d-momentum op voltooide candles
    cell.mom5 = +((bars[i - 1].close - bars[i - 6].close) * m).toFixed(1)

    // F1/F0: renteverschil (alleen als beide benen een reeks hebben)
    if (yLookup[base] && yLookup[quote]) {
      const bL = yLookup[base](dayBefore), qL = yLookup[quote](dayBefore)
      if (bL && qL) {
        cell.yldLevel = +(bL.value - qL.value).toFixed(3)
        const b5 = deltaN(yLookup[base], dayBefore, 5), q5 = deltaN(yLookup[quote], dayBefore, 5)
        const b20 = deltaN(yLookup[base], dayBefore, 20), q20 = deltaN(yLookup[quote], dayBefore, 20)
        if (b5 != null && q5 != null) cell.yldD5 = +(b5 - q5).toFixed(4)
        if (b20 != null && q20 != null) cell.yldD20 = +(b20 - q20).toFixed(4)
      }
    }
    // F2: verrassingsverschil (gelockte ochtendwaarde van dag D zelf)
    const sur = surByDate.get(d)
    if (sur && sur[base] && sur[quote] && sur[base].surprise != null && sur[quote].surprise != null) {
      cell.surDiff = +(sur[base].surprise - sur[quote].surprise).toFixed(3)
    }
    // F3: CoT-extremen
    const cotB = cotPercentile(base, d), cotQ = cotPercentile(quote, d)
    cell.cotB = cotB, cell.cotQ = cotQ
    // F4: grondstoffen
    const oil5 = deltaN(imLookup.oil, dayBefore, 5), gold5 = deltaN(imLookup.gold, dayBefore, 5), cop5 = deltaN(imLookup.copper, dayBefore, 5)
    const oilRef = imLookup.oil(dayBefore), goldRef = imLookup.gold(dayBefore), copRef = imLookup.copper(dayBefore)
    const pct = (dlt, ref) => (dlt != null && ref && ref.value ? (dlt / ref.value) * 100 : null)
    const commScore = (ccy) => {
      if (ccy === 'CAD') return pct(oil5, oilRef)
      if (ccy === 'AUD') {
        const g = pct(gold5, goldRef), c = pct(cop5, copRef)
        return g != null && c != null ? 0.6 * g + 0.4 * c : null
      }
      return 0
    }
    const cb = commScore(base), cq = commScore(quote)
    if (cb != null && cq != null && (base === 'AUD' || base === 'CAD' || quote === 'AUD' || quote === 'CAD')) {
      cell.commDiff = +(cb - cq).toFixed(3)
    }
    // F5: risicosentiment (VIX- en SP500-verandering over 5 dagen, in %)
    const vix5 = pct(deltaN(imLookup.vix, dayBefore, 5), imLookup.vix(dayBefore))
    const sp5 = pct(deltaN(imLookup.sp500, dayBefore, 5), imLookup.sp500(dayBefore))
    if (vix5 != null && sp5 != null) cell.riskOff5 = +(vix5 - sp5).toFixed(2)

    cells.push(cell)
  }
}

// ─── 70/30-splitsing op handelsdagen ──────────────────────────
const allDates = [...new Set(cells.map((c) => c.date))].sort()
const splitDate = allDates[Math.floor(allDates.length * 0.7)]
const inTrain = (c) => c.date < splitDate
console.log(`cellen: ${cells.length} | handelsdagen: ${allDates.length} | ontwikkel: ${allDates[0]} → ${splitDate} (excl.) | toets: ${splitDate} → ${allDates[allDates.length - 1]}`)

// ─── evaluatie-helpers (zelfde definities als fase 2) ─────────
function wilson(p, n, z = 1.96) {
  if (!n) return [0, 100]
  const d = 1 + (z * z) / n
  const center = (p + (z * z) / (2 * n)) / d
  const half = (z / d) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return [+(100 * (center - half)).toFixed(1), +(100 * (center + half)).toFixed(1)]
}
function clusterCount(trades) {
  const byPair = {}
  for (const t of trades) (byPair[t.pair] = byPair[t.pair] || []).push(t)
  let n = 0
  for (const list of Object.values(byPair)) {
    list.sort((a, b) => a.date.localeCompare(b.date))
    let prev = null
    for (const t of list) {
      const same = prev && prev.dir === t.dir && (new Date(t.date) - new Date(prev.date)) / 86400000 <= 4
      if (!same) n++
      prev = t
    }
  }
  return n
}
function evalPicks(picks, horizon) {
  const rows = picks.filter((p) => p.cell[`h${horizon}`] != null)
  if (rows.length === 0) return null
  let goed = 0, klopt = 0, kloptNiet = 0, pipsSum = 0, atrSum = 0
  for (const { cell, dir } of rows) {
    const dirPips = cell[`h${horizon}`] * (dir === 'long' ? 1 : -1)
    pipsSum += dirPips
    atrSum += cell.atr ? dirPips / cell.atr : 0
    if (dirPips > 0) goed++
    const thr = threshold(cell.pair)
    if (dirPips >= thr) klopt++
    else if (dirPips <= -thr) kloptNiet++
  }
  const nEff = clusterCount(rows.map(({ cell, dir }) => ({ pair: cell.pair, date: cell.date, dir })))
  const p = goed / rows.length
  const beslist = klopt + kloptNiet
  return {
    n: rows.length, nEff,
    richting: +(100 * p).toFixed(1), ci: wilson(p, nEff),
    drempelWinrate: beslist ? +(100 * klopt / beslist).toFixed(1) : null,
    gemPips: +(pipsSum / rows.length).toFixed(1), gemATR: +(atrSum / rows.length).toFixed(3),
  }
}
function evalStrategie(naam, pickFn, universe = cells) {
  const picks = []
  for (const c of universe) {
    const dir = pickFn(c)
    if (dir) picks.push({ cell: c, dir })
  }
  const out = { strategie: naam }
  for (const [periode, filt] of [['ontwikkel', inTrain], ['toets', (c) => !inTrain(c)]]) {
    out[periode] = {}
    const sub = picks.filter((p) => filt(p.cell))
    for (const n of HORIZONS) out[periode][`${n}d`] = evalPicks(sub, n)
  }
  return out
}

// ─── strategieën ──────────────────────────────────────────────
const strategieen = [
  evalStrategie('REF contrarian (tegen 5d-beweging)', (c) => (c.mom5 === 0 ? null : c.mom5 < 0 ? 'long' : 'short')),
  evalStrategie('F0 rente-NIVEAU (oude-factor-analoog)', (c) => (c.yldLevel == null || c.yldLevel === 0 ? null : c.yldLevel > 0 ? 'long' : 'short')),
  evalStrategie('F1 rente-momentum Δ5', (c) => (c.yldD5 == null || c.yldD5 === 0 ? null : c.yldD5 > 0 ? 'long' : 'short')),
  evalStrategie('F1 rente-momentum Δ20', (c) => (c.yldD20 == null || c.yldD20 === 0 ? null : c.yldD20 > 0 ? 'long' : 'short')),
  evalStrategie('F1 rente-momentum Δ5, alleen |Δ| ≥ 5bp', (c) => (c.yldD5 == null || Math.abs(c.yldD5) < 0.05 ? null : c.yldD5 > 0 ? 'long' : 'short')),
  evalStrategie('F2 verrassingsverschil (sinds jul 2026)', (c) => (c.surDiff == null || c.surDiff === 0 ? null : c.surDiff > 0 ? 'long' : 'short')),
  evalStrategie('F3 CoT-extreem faden (≥90/≤10 pct)', (c) => {
    const bExt = c.cotB && (c.cotB.pct >= 90 ? 'top' : c.cotB.pct <= 10 ? 'bodem' : null)
    const qExt = c.cotQ && (c.cotQ.pct >= 90 ? 'top' : c.cotQ.pct <= 10 ? 'bodem' : null)
    // fade: extreem-long positionering in base → short het paar; extreem-short → long
    if (bExt && !qExt) return bExt === 'top' ? 'short' : 'long'
    if (qExt && !bExt) return qExt === 'top' ? 'long' : 'short'
    return null
  }),
  evalStrategie('F4 grondstof-momentum (AUD/CAD-paren)', (c) => (c.commDiff == null || Math.abs(c.commDiff) < 0.5 ? null : c.commDiff > 0 ? 'long' : 'short')),
  evalStrategie('F5 risk-off-verandering (JPY/CHF-paren)', (c) => {
    if (c.riskOff5 == null || Math.abs(c.riskOff5) < 3) return null
    const bHaven = HAVENS.includes(c.base), qHaven = HAVENS.includes(c.quote)
    if (bHaven === qHaven) return null // alleen haven-vs-niet-haven
    const havenSterker = c.riskOff5 > 0
    return bHaven ? (havenSterker ? 'long' : 'short') : (havenSterker ? 'short' : 'long')
  }),
  // combinatie, vooraf gespecificeerd: contrarian ALLEEN waar rente-momentum
  // dezelfde kant op wijst (timing van het enige werkende ingrediënt + een
  // factor die verandering meet i.p.v. niveau)
  evalStrategie('COMBI contrarian + rente-momentum Δ5 eens', (c) => {
    if (c.mom5 === 0 || c.yldD5 == null || c.yldD5 === 0) return null
    const contr = c.mom5 < 0 ? 'long' : 'short'
    const yld = c.yldD5 > 0 ? 'long' : 'short'
    return contr === yld ? contr : null
  }),
]

writeFileSync('scripts/audit/data/fase4-toets.json', JSON.stringify({ splitDate, strategieen }, null, 2))

for (const s of strategieen) {
  console.log(`\n── ${s.strategie} ──`)
  for (const periode of ['ontwikkel', 'toets']) {
    for (const h of HORIZONS) {
      const r = s[periode][`${h}d`]
      console.log(`  ${periode.padEnd(9)} ${String(h).padStart(2)}d: ${r ? `${r.richting}% CI[${r.ci}] | drempel ${r.drempelWinrate}% | pips ${r.gemPips} | ATR ${r.gemATR} | n=${r.n} (eff ${r.nEff})` : '—'}`)
    }
  }
}
