#!/usr/bin/env node
// ─── AUDIT FASE 3 — Diagnose-checks ───────────────────────────
// (a) Veroudering van de handmatige CB-labels (laatste update per valuta).
// (b) Tool-prestatie vóór vs ná de label-bevriezing (24 jun 2026).
// (c) De EUR-sterker-calls vóór vs ná de bevriezing.
// (d) Optimizer-claims (in-sample, gesimuleerde periode) vs schone live meting.
//
// Draaien:  node scripts/audit/fase3-checks.mjs
// ──────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs'

const audit = JSON.parse(readFileSync('scripts/audit/data/audit-outcomes.json', 'utf8'))
const cb = JSON.parse(readFileSync('scripts/audit/data/central_bank_rates.json', 'utf8'))
const live = audit.filter((c) => c.klasse === 'live')
const FREEZE = '2026-06-24' // dag na de laatste update van central_bank_rates

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
function stat(calls, h) {
  const rows = calls.filter((c) => !c.horizons[h].B.open)
  if (!rows.length) return null
  const goed = rows.filter((c) => c.horizons[h].B.richtingGoed).length
  const pips = rows.reduce((s, c) => s + c.horizons[h].B.dirPips, 0) / rows.length
  const nEff = clusterCount(rows)
  const p = goed / rows.length
  return { n: rows.length, nEff, pct: +(100 * p).toFixed(1), ci: wilson(p, nEff), pips: +pips.toFixed(1) }
}

const out = {}

// (a) CB-labels: laatste update per valuta
out.cbLabels = cb
  .filter((r) => ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'].includes(r.currency))
  .map((r) => ({ currency: r.currency, bias: r.bias, rate: r.rate, target: r.target, updated_at: r.updated_at }))

// (b) vóór vs ná bevriezing
for (const [naam, filter] of [
  ['voorBevriezing', (c) => c.date < FREEZE],
  ['naBevriezing', (c) => c.date >= FREEZE],
]) {
  const subset = live.filter(filter)
  out[naam] = Object.fromEntries([1, 5, 10, 20].map((h) => [`${h}d`, stat(subset, h)]))
  out[naam].aantalCalls = subset.length
}

// (c) EUR-sterker-calls vóór/ná
{
  const eurSterker = live.filter((c) => {
    const [base, quote] = c.pair.split('/')
    const sterker = c.richting === 'long' ? base : quote
    return sterker === 'EUR'
  })
  out.eurSterkerVoor = { ...Object.fromEntries([5, 20].map((h) => [`${h}d`, stat(eurSterker.filter((c) => c.date < FREEZE), h)])), n: eurSterker.filter((c) => c.date < FREEZE).length }
  out.eurSterkerNa = { ...Object.fromEntries([5, 20].map((h) => [`${h}d`, stat(eurSterker.filter((c) => c.date >= FREEZE), h)])), n: eurSterker.filter((c) => c.date >= FREEZE).length }
}

// (d) optimizer-claims vs schone live meting
{
  const cfg = JSON.parse(readFileSync('scripts/model-configG-final.json', 'utf8'))
  out.optimizerClaim = {
    bron: 'scripts/model-configG-final.json',
    periode: cfg.period,
    sampleSize: cfg.sampleSize,
    claim: cfg.performance,
    kanttekening: 'afgesteld op de backfill-periode (gesimuleerd nieuws, look-ahead); sl/tp 40/120 zijn de verzonnen UI-waardes uit fase 1',
  }
  out.schoneLiveMeting = { '5d': stat(live, 5), '20d': stat(live, 20) }
}

writeFileSync('scripts/audit/data/fase3-checks.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
