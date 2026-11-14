#!/usr/bin/env node
// ─── AUDIT FASE 2d — Robuuste factor-splitsing + stabiliteitschecks ──
// Zonder nieuws-replay: splitst de score per call in
//   niveau  = mediaan van de score van dat paar over de sample (≈ CB+rente,
//             want die component is traag en bepaalt het niveau), en
//   afwijking = score − niveau (≈ nieuwsbonus, de enige snelle component).
// Correleert beide (Spearman) met de beweging erna per horizon.
// Plus: hoe vaak verspringt de ruwe score dag-op-dag (> 0.3)?
//
// Draaien:  node scripts/audit/fase2-factorsplit.mjs
// ──────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs'

const audit = JSON.parse(readFileSync('scripts/audit/data/audit-outcomes.json', 'utf8'))
const live = audit.filter((c) => c.klasse === 'live')

function spearman(xs, ys) {
  const n = xs.length
  if (n < 3) return null
  const rank = (a) => {
    const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0])
    const r = new Array(n)
    let i = 0
    while (i < n) {
      let j = i
      while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++
      const avg = (i + j) / 2 + 1
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg
      i = j + 1
    }
    return r
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

const out = {}

// niveau per paar = mediaan van de signed scores
const byPair = {}
for (const c of live) (byPair[c.pair] = byPair[c.pair] || []).push(c.score)
const med = {}
for (const [p, v] of Object.entries(byPair)) {
  const s = [...v].sort((a, b) => a - b)
  med[p] = s[Math.floor(s.length / 2)]
}

out.niveauVsAfwijking = {}
for (const h of [1, 3, 5, 10, 20]) {
  const rows = live.filter((c) => !c.horizons[h].B.open)
  const longPips = rows.map((c) => c.horizons[h].B.dirPips * (c.richting === 'long' ? 1 : -1))
  out.niveauVsAfwijking[`${h}d`] = {
    scoreNiveau_cb: spearman(rows.map((c) => med[c.pair]), longPips),
    dagAfwijking_nieuws: spearman(rows.map((c) => c.score - med[c.pair]), longPips),
    n: rows.length,
  }
}

// dag-op-dag stabiliteit van de ruwe score (zelfde paar, gat ≤ 4 dagen)
{
  const byPairCalls = {}
  for (const c of live) (byPairCalls[c.pair] = byPairCalls[c.pair] || []).push(c)
  const verdeling = {}
  for (const [pair, list] of Object.entries(byPairCalls)) {
    list.sort((a, b) => a.date.localeCompare(b.date))
    let j = 0, tot = 0
    for (let i = 1; i < list.length; i++) {
      if ((new Date(list[i].date) - new Date(list[i - 1].date)) / 86400000 > 4) continue
      tot++
      if (Math.abs(list[i].score - list[i - 1].score) > 0.3) j++
    }
    if (tot > 5) verdeling[pair] = +(100 * j / tot).toFixed(0)
  }
  const vals = Object.values(verdeling).sort((a, b) => a - b)
  out.scoreStabiliteit = { perPaarPctSprongen: verdeling, mediaanPct: vals[Math.floor(vals.length / 2)] }
}

writeFileSync('scripts/audit/data/fase2-factorsplit.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
