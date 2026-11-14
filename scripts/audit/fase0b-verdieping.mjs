#!/usr/bin/env node
// ─── AUDIT FASE 0b — Verdieping op de lokale export ───────────
// Rekent op scripts/audit/data/*.json (geen databasequeries behalve
// fb_outcomes-telling). Onderscheidt backfill- van live-calls.
//
// Draaien:  node scripts/audit/fase0b-verdieping.mjs
// ──────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const rows = JSON.parse(readFileSync('scripts/audit/data/trade_focus_records.json', 'utf8'))
const snaps = JSON.parse(readFileSync('scripts/audit/data/cb_rate_snapshots.json', 'utf8'))

const out = {}

// ─── 1. newsSimulated-vlag ────────────────────────────────────
{
  const byFlag = {}
  for (const r of rows) {
    const f = String(r.metadata?.newsSimulated ?? '(ontbreekt)')
    byFlag[f] = (byFlag[f] || 0) + 1
  }
  out.newsSimulated = byFlag
}

// ─── 2. created_at vs date: wanneer is elke rij echt geschreven? ──
// Rijen met een call-datum (ver) vóór hun aanmaakdatum zijn gereconstrueerd
// (backfill), geen live calls.
{
  const byCreatedDay = {}
  for (const r of rows) {
    const c = (r.created_at || '').slice(0, 10)
    byCreatedDay[c] = (byCreatedDay[c] || 0) + 1
  }
  // top-aanmaakdagen (batches)
  const batches = Object.entries(byCreatedDay)
    .filter(([, n]) => n > 10)
    .sort((a, b) => b[1] - a[1])
  out.aanmaakBatches = Object.fromEntries(batches)

  // classificatie: live = call-datum en aanmaakdatum liggen hooguit 1 dag uiteen
  const classify = (r) => {
    const c = (r.created_at || '').slice(0, 10)
    const d = r.date
    if (!c || !d) return 'onbekend'
    const diffDays = (new Date(c + 'T00:00:00Z') - new Date(d + 'T00:00:00Z')) / 86400000
    return diffDays <= 1.5 ? 'live' : 'backfill'
  }
  const stats = { live: { n: 0, min: null, max: null }, backfill: { n: 0, min: null, max: null }, onbekend: { n: 0, min: null, max: null } }
  for (const r of rows) {
    const k = classify(r)
    const s = stats[k]
    s.n++
    if (!s.min || r.date < s.min) s.min = r.date
    if (!s.max || r.date > s.max) s.max = r.date
  }
  out.liveVsBackfill = stats

  // live calls per maand + resultaat per groep
  const liveRows = rows.filter((r) => classify(r) === 'live')
  const bfRows = rows.filter((r) => classify(r) === 'backfill')
  const perMonthLive = {}
  for (const r of liveRows) {
    const m = r.date.slice(0, 7)
    perMonthLive[m] = (perMonthLive[m] || 0) + 1
  }
  out.livePerMaand = perMonthLive
  const res = (rs) => {
    const o = {}
    for (const r of rs) o[r.result ?? '(null)'] = (o[r.result ?? '(null)'] || 0) + 1
    return o
  }
  out.resultaatLive = res(liveRows)
  out.resultaatBackfill = res(bfRows)

  // werkdagen zonder live call binnen de live-periode
  const liveDates = [...new Set(liveRows.map((r) => r.date))].sort()
  const missing = []
  if (liveDates.length >= 2) {
    const have = new Set(liveDates)
    const d0 = new Date(liveDates[0] + 'T00:00:00Z')
    const d1 = new Date(liveDates[liveDates.length - 1] + 'T00:00:00Z')
    for (let d = new Date(d0); d <= d1; d.setUTCDate(d.getUTCDate() + 1)) {
      const dow = d.getUTCDay()
      if (dow === 0 || dow === 6) continue
      const iso = d.toISOString().slice(0, 10)
      if (!have.has(iso)) missing.push(iso)
    }
  }
  out.livePeriode = {
    eerste: liveDates[0] ?? null,
    laatste: liveDates[liveDates.length - 1] ?? null,
    dagenMetCalls: liveDates.length,
    werkdagenZonderCall: missing.length,
    zonderCallPerMaand: missing.reduce((a, d) => { const m = d.slice(0, 7); a[m] = (a[m] || 0) + 1; return a }, {}),
  }

  // export van de classificatie voor latere fases
  writeFileSync(
    'scripts/audit/data/calls-classificatie.json',
    JSON.stringify(rows.map((r) => ({ id: r.id, date: r.date, created_at: r.created_at, klasse: classify(r) })), null, 1),
  )
}

// ─── 3. dubbele calls: detail ─────────────────────────────────
{
  const seen = new Map()
  const dups = []
  for (const r of rows) {
    const key = `${r.date}|${r.pair}`
    if (seen.has(key)) dups.push({ date: r.date, pair: r.pair, ids: [seen.get(key).id, r.id], results: [seen.get(key).result, r.result] })
    else seen.set(key, r)
  }
  out.dubbeleCalls = dups
}

// ─── 4. cb_rate_snapshots: dekking per maand ──────────────────
{
  const byDate = {}
  for (const s of snaps) {
    const d = s.snapshot_date
    byDate[d] = (byDate[d] || 0) + 1
  }
  out.cbSnapshots = {
    datums: Object.keys(byDate).sort(),
    valutasPerDatum: byDate,
    kolommen: snaps[0] ? Object.keys(snaps[0]).sort() : [],
  }
}

// ─── 5. fb_outcomes-telling (nieuwe tool, alleen context) ─────
{
  const env = readFileSync('.env.local', 'utf8')
  const getEnv = (k) => {
    const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'))
    return m ? m[1].trim() : process.env[k]
  }
  const sb = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
  const { count, error } = await sb.from('fb_outcomes').select('id', { count: 'exact', head: true })
  out.fb_outcomes = error ? { error: error.message } : { totaal: count }
}

writeFileSync('scripts/audit/data/fase0b-verdieping.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
