#!/usr/bin/env node
// ─── AUDIT FASE 2c — Doorsnedes van de tool-calls ─────────────
// Alles op de auditdataset (ref B, voltooide candles, drempels 30/50).
// Alleen live calls (n=954). Factor-reconstructie:
//   nieuwsbonus per valuta = exacte replay van calcNewsBonus
//   (trackrecord-v2/route.ts) op news_articles met published_at ≤ callTime;
//   CB-component = opgeslagen score − nieuwsverschil (restpost; bevat
//   CB-bias ×2 + rente-vs-doel ×1,5).
//
// Draaien:  node scripts/audit/fase2-analyse.mjs
// ──────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs'

const audit = JSON.parse(readFileSync('scripts/audit/data/audit-outcomes.json', 'utf8'))
const news = JSON.parse(readFileSync('scripts/audit/data/news_articles.json', 'utf8'))
const records = JSON.parse(readFileSync('scripts/audit/data/trade_focus_records.json', 'utf8'))
const callTimeById = new Map(records.map((r) => [r.id, r.metadata?.callTime || r.created_at]))

const live = audit.filter((c) => c.klasse === 'live')
const HORIZONS = [1, 3, 5, 10, 20]

// ─── helpers ──────────────────────────────────────────────────
function wilson(p, n, z = 1.96) {
  if (!n) return [0, 100]
  const d = 1 + (z * z) / n
  const center = (p + (z * z) / (2 * n)) / d
  const half = (z / d) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return [+(100 * (center - half)).toFixed(1), +(100 * (center + half)).toFixed(1)]
}
function clusterCount(calls) {
  const byPair = {}
  for (const c of calls) (byPair[c.pair] = byPair[c.pair] || []).push(c)
  let n = 0
  for (const list of Object.values(byPair)) {
    list.sort((a, b) => a.date.localeCompare(b.date))
    let prev = null
    for (const c of list) {
      const same = prev && prev.richting === c.richting && (new Date(c.date) - new Date(prev.date)) / 86400000 <= 4
      if (!same) n++
      prev = c
    }
  }
  return n
}
function spearman(xs, ys) {
  const n = xs.length
  if (n < 3) return null
  const rank = (arr) => {
    const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0])
    const ranks = new Array(n)
    let i = 0
    while (i < n) {
      let j = i
      while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++
      const avg = (i + j) / 2 + 1
      for (let k = i; k <= j; k++) ranks[idx[k][1]] = avg
      i = j + 1
    }
    return ranks
  }
  const rx = rank(xs), ry = rank(ys)
  const mx = rx.reduce((a, b) => a + b) / n, my = ry.reduce((a, b) => a + b) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - my)
    dx += (rx[i] - mx) ** 2
    dy += (ry[i] - my) ** 2
  }
  return dx && dy ? +(num / Math.sqrt(dx * dy)).toFixed(3) : null
}
// samenvatting van een subset calls op één horizon
function stat(calls, n) {
  const rows = calls.filter((c) => !c.horizons[n].B.open)
  if (!rows.length) return null
  const goed = rows.filter((c) => c.horizons[n].B.richtingGoed).length
  const pips = rows.reduce((s, c) => s + c.horizons[n].B.dirPips, 0) / rows.length
  const atrRows = rows.filter((c) => c.atrB)
  const atr = atrRows.reduce((s, c) => s + c.horizons[n].B.dirPips / c.atrB, 0) / (atrRows.length || 1)
  const nEff = clusterCount(rows)
  const p = goed / rows.length
  return { n: rows.length, nEff, pct: +(100 * p).toFixed(1), ci: wilson(p, nEff), pips: +pips.toFixed(1), atr: +atr.toFixed(3) }
}
const fmtStat = (s) => s ? `${s.pct}% CI[${s.ci}] pips ${s.pips} ATR ${s.atr} (n=${s.n}, eff ${s.nEff})${s.n < 30 ? ' ⚠ n<30' : ''}` : '—'

const out = {}

// ─── 1. loopt het resultaat op met de score? ──────────────────
{
  const bins = [[2, 2.5], [2.5, 3], [3, 3.5], [3.5, 99]]
  out.scoreBins = {}
  for (const [lo, hi] of bins) {
    const subset = live.filter((c) => Math.abs(c.score) >= lo && Math.abs(c.score) < hi)
    out.scoreBins[`${lo}-${hi === 99 ? '+' : hi}`] = Object.fromEntries(
      [5, 10, 20].map((n) => [`${n}d`, stat(subset, n)]),
    )
  }
  out.scoreSpearman = {}
  for (const n of HORIZONS) {
    const rows = live.filter((c) => !c.horizons[n].B.open)
    out.scoreSpearman[`${n}d`] = spearman(rows.map((c) => Math.abs(c.score)), rows.map((c) => c.horizons[n].B.dirPips))
  }
}

// ─── 2. nieuwsbonus-replay + CB-restpost ──────────────────────
// Exacte kopie van calcNewsBonus (trackrecord-v2/route.ts regel 87-134),
// met als cutoff het werkelijke aanmaakmoment van de call.
const bullishPhrases = ['rate hike', 'rate increase', 'higher than expected', 'beat expectations', 'hawkish surprise', 'tightening cycle']
const bearishPhrases = ['rate cut', 'rate decrease', 'lower than expected', 'missed expectations', 'dovish pivot', 'easing cycle']
const negations = ['no ', 'not ', 'without ', 'failed to ', 'unlikely ', 'ruled out ']
function calcNewsBonus(articles, currency, signalDate) {
  let totalSentiment = 0
  const relevant = articles.filter((a) => a.affected_currencies?.includes(currency))
  for (const article of relevant.slice(0, 10)) {
    const text = ((article.title || '') + ' ' + (article.summary || '')).toLowerCase()
    const pubDate = new Date(article.published_at)
    const signalDateTime = new Date(signalDate + 'T16:00:00Z')
    const hoursAgo = (signalDateTime.getTime() - pubDate.getTime()) / 3600000
    if (hoursAgo < 0 || hoursAgo > 72) continue
    const recency = hoursAgo < 12 ? 1.5 : hoursAgo < 24 ? 1.2 : hoursAgo < 48 ? 1.0 : 0.7
    let sentiment = 0
    for (const phrase of bullishPhrases) {
      if (text.includes(phrase)) sentiment += negations.some((n) => text.includes(n + phrase)) ? -1.5 : 1.5
    }
    for (const phrase of bearishPhrases) {
      if (text.includes(phrase)) sentiment += negations.some((n) => text.includes(n + phrase)) ? 1.5 : -1.5
    }
    const relScore = Math.min((article.relevance_score || 3) / 5, 1) * 1.5
    totalSentiment += sentiment * 0.25 * recency * relScore
  }
  return Math.max(-1.5, Math.min(1.5, totalSentiment))
}
const newsSorted = [...news].sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''))
const bonusCache = new Map()
function newsBonusAt(callTime, currency) {
  const key = callTime + '|' + currency
  if (bonusCache.has(key)) return bonusCache.get(key)
  const t1 = new Date(callTime).getTime()
  const t0 = t1 - 72 * 3600000
  // zelfde venster als de query: laatste 72u, nieuwste eerst, max 200
  const windowArts = newsSorted.filter((a) => {
    const t = new Date(a.published_at).getTime()
    return t <= t1 && t >= t0
  }).slice(0, 200)
  const v = calcNewsBonus(windowArts, currency, callTime.slice(0, 10))
  bonusCache.set(key, v)
  return v
}
{
  let nonZero = 0
  for (const c of live) {
    const [base, quote] = c.pair.split('/')
    const ct = callTimeById.get(c.id)
    const nb = newsBonusAt(ct, base), nq = newsBonusAt(ct, quote)
    c.newsDiff = +(nb - nq).toFixed(2)
    c.cbResid = +(c.score - c.newsDiff).toFixed(2)
    if (c.newsDiff !== 0) nonZero++
  }
  out.nieuwsReplay = { callsMetNieuwsInvloed: nonZero, van: live.length }

  // factor → toekomstige beweging (teken-correlatie met long-pips)
  out.factorSpearman = {}
  for (const n of HORIZONS) {
    const rows = live.filter((c) => !c.horizons[n].B.open)
    const longPips = rows.map((c) => c.horizons[n].B.dirPips * (c.richting === 'long' ? 1 : -1))
    out.factorSpearman[`${n}d`] = {
      cbResid: spearman(rows.map((c) => c.cbResid), longPips),
      newsDiff: spearman(rows.map((c) => c.newsDiff), longPips),
      momentum5d: spearman(rows.map((c) => c.momentum5d ?? 0), longPips),
      imAlignment: spearman(rows.map((c) => c.imAlignment ?? 50), rows.map((c) => c.horizons[n].B.dirPips)),
    }
  }
  // nieuws: helpt het teken? calls waar nieuws dezelfde kant op wijst als de call
  for (const mode of ['mee', 'tegen', 'neutraal']) {
    const subset = live.filter((c) => {
      const aligned = c.newsDiff * (c.richting === 'long' ? 1 : -1)
      return mode === 'mee' ? aligned > 0 : mode === 'tegen' ? aligned < 0 : c.newsDiff === 0
    })
    out[`nieuws_${mode}`] = Object.fromEntries([5, 20].map((n) => [`${n}d`, stat(subset, n)]))
  }
}

// ─── 3. momentum-diepte (|5d-beweging| in ATR) ────────────────
{
  out.momentumDiepte = {}
  const bins = [[0, 0.5], [0.5, 1], [1, 1.5], [1.5, 99]]
  for (const [lo, hi] of bins) {
    const subset = live.filter((c) => c.atrB && c.momentum5d != null && Math.abs(c.momentum5d) / c.atrB >= lo && Math.abs(c.momentum5d) / c.atrB < hi)
    out.momentumDiepte[`${lo}-${hi === 99 ? '+' : hi}×ATR`] = Object.fromEntries([5, 20].map((n) => [`${n}d`, stat(subset, n)]))
  }
}

// ─── 4. intermarket alignment ─────────────────────────────────
{
  const vals = live.map((c) => c.imAlignment).filter((v) => v != null)
  const distr = {}
  for (const v of vals) distr[v] = (distr[v] || 0) + 1
  out.imDistributie = distr
  out.imBins = {}
  for (const [lo, hi] of [[50, 63], [63, 76], [76, 101]]) {
    const subset = live.filter((c) => c.imAlignment != null && c.imAlignment >= lo && c.imAlignment < hi)
    out.imBins[`${lo}-${hi - 1}`] = Object.fromEntries([5, 20].map((n) => [`${n}d`, stat(subset, n)]))
  }
}

// ─── 5. doorsnedes ────────────────────────────────────────────
function slice(naam, keyFn, horizonten = [5, 20]) {
  const groups = {}
  for (const c of live) {
    const k = keyFn(c)
    if (k == null) continue
    ;(groups[k] = groups[k] || []).push(c)
  }
  out[naam] = {}
  for (const [k, calls] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
    out[naam][k] = Object.fromEntries(horizonten.map((n) => [`${n}d`, stat(calls, n)]))
  }
}
slice('perRichting', (c) => c.richting)
slice('perCategorie', (c) => (c.pair.includes('JPY') ? 'jpy' : ['EUR/USD', 'GBP/USD', 'USD/CHF', 'USD/CAD', 'AUD/USD', 'NZD/USD'].includes(c.pair) ? 'major' : 'cross'))
slice('perRegime', (c) => c.regime || 'onbekend')
slice('perMaand', (c) => c.date.slice(0, 7), [5])
slice('perPaar', (c) => c.pair, [5])
// per valuta: de kant die de call als "sterker" aanwijst
slice('perValutaSterker', (c) => {
  const [base, quote] = c.pair.split('/')
  return c.richting === 'long' ? base : quote
})
slice('perValutaZwakker', (c) => {
  const [base, quote] = c.pair.split('/')
  return c.richting === 'long' ? quote : base
})

writeFileSync('scripts/audit/data/fase2-analyse.json', JSON.stringify(out, null, 2))

// ─── console-samenvatting ─────────────────────────────────────
console.log('── score-bins (5d / 20d richting) ──')
for (const [bin, v] of Object.entries(out.scoreBins)) console.log(`  |score| ${bin}: 5d ${fmtStat(v['5d'])} | 20d ${fmtStat(v['20d'])}`)
console.log('  Spearman |score| → dirPips:', JSON.stringify(out.scoreSpearman))
console.log('\n── factor → long-pips Spearman ──')
for (const [h, v] of Object.entries(out.factorSpearman)) console.log(`  ${h}: ${JSON.stringify(v)}`)
console.log('\n── nieuws t.o.v. call-richting (5d) ──')
for (const mode of ['mee', 'tegen', 'neutraal']) console.log(`  ${mode}: ${fmtStat(out[`nieuws_${mode}`]['5d'])}`)
console.log('  calls met nieuwsinvloed:', JSON.stringify(out.nieuwsReplay))
console.log('\n── momentum-diepte (5d) ──')
for (const [bin, v] of Object.entries(out.momentumDiepte)) console.log(`  ${bin}: ${fmtStat(v['5d'])}`)
console.log('\n── intermarket bins (5d) ──')
for (const [bin, v] of Object.entries(out.imBins)) console.log(`  IM ${bin}: ${fmtStat(v['5d'])}`)
console.log('  IM-waarden distributie:', JSON.stringify(out.imDistributie))
console.log('\n── richting (5d/20d) ──')
for (const [k, v] of Object.entries(out.perRichting)) console.log(`  ${k}: 5d ${fmtStat(v['5d'])} | 20d ${fmtStat(v['20d'])}`)
console.log('\n── categorie (5d) ──')
for (const [k, v] of Object.entries(out.perCategorie)) console.log(`  ${k}: ${fmtStat(v['5d'])}`)
console.log('\n── regime (5d) ──')
for (const [k, v] of Object.entries(out.perRegime)) console.log(`  ${k}: ${fmtStat(v['5d'])}`)
console.log('\n── per maand (5d) ──')
for (const [k, v] of Object.entries(out.perMaand)) console.log(`  ${k}: ${fmtStat(v['5d'])}`)
console.log('\n── per paar (5d) ──')
for (const [k, v] of Object.entries(out.perPaar)) console.log(`  ${k}: ${fmtStat(v['5d'])}`)
console.log('\n── valuta als "sterker" aangewezen (5d) ──')
for (const [k, v] of Object.entries(out.perValutaSterker)) console.log(`  ${k}: ${fmtStat(v['5d'])}`)
