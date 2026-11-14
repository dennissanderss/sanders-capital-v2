#!/usr/bin/env node
// ─── AUDIT FASE 0 — Inventarisatie (alleen-lezen) ─────────────
// Leest trade_focus_records, execution_signals, cb_rate_snapshots,
// central_bank_rates, news_articles en fb_calls/fb_outcomes.
// Schrijft NIETS naar de database. Exporteert ruwe data naar
// scripts/audit/data/ zodat latere fases lokaal kunnen rekenen.
//
// Draaien:  node scripts/audit/fase0-inventaris.mjs
// ──────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ─── env laden uit .env.local ─────────────────────────────────
const env = readFileSync('.env.local', 'utf8')
const getEnv = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'))
  return m ? m[1].trim() : process.env[k]
}
const sb = createClient(
  getEnv('NEXT_PUBLIC_SUPABASE_URL'),
  getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
)

const DATA_DIR = 'scripts/audit/data'
mkdirSync(DATA_DIR, { recursive: true })

// ─── helper: volledige tabel ophalen met paginatie ────────────
async function fetchAll(table, select = '*', orderCol = null) {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(select).range(from, from + PAGE - 1)
    if (orderCol) q = q.order(orderCol, { ascending: true })
    const { data, error } = await q
    if (error) return { rows, error: error.message }
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return { rows, error: null }
}

const out = { generatedAt: new Date().toISOString() }

// ─── 1. trade_focus_records (de call-tabel van de oude tool) ──
{
  const { rows, error } = await fetchAll('trade_focus_records', '*', 'date')
  if (error) {
    out.trade_focus_records = { error }
  } else {
    writeFileSync(`${DATA_DIR}/trade_focus_records.json`, JSON.stringify(rows, null, 1))

    // kolommen (unie van keys over alle rijen)
    const cols = new Set()
    for (const r of rows) Object.keys(r).forEach((k) => cols.add(k))
    const metaKeys = new Set()
    for (const r of rows) Object.keys(r.metadata || {}).forEach((k) => metaKeys.add(k))

    // per source
    const bySource = {}
    for (const r of rows) {
      const s = r.metadata?.source ?? '(geen source)'
      bySource[s] = (bySource[s] || 0) + 1
    }

    // per maand (alle rijen + alleen v2)
    const perMonth = {}
    const perMonthV2 = {}
    for (const r of rows) {
      const m = (r.date || '').slice(0, 7)
      perMonth[m] = (perMonth[m] || 0) + 1
      if (r.metadata?.source === 'v2') perMonthV2[m] = (perMonthV2[m] || 0) + 1
    }

    // dubbele calls: zelfde date+pair+source
    const seen = new Map()
    const dups = []
    for (const r of rows) {
      const key = `${r.date}|${r.pair}|${r.metadata?.source ?? ''}`
      if (seen.has(key)) dups.push({ key, ids: [seen.get(key), r.id] })
      else seen.set(key, r.id)
    }

    // v2: eerste/laatste datum + werkdagen zonder calls
    const v2 = rows.filter((r) => r.metadata?.source === 'v2')
    const v2Dates = [...new Set(v2.map((r) => r.date))].sort()
    const missingWeekdays = []
    if (v2Dates.length >= 2) {
      const d0 = new Date(v2Dates[0] + 'T00:00:00Z')
      const d1 = new Date(v2Dates[v2Dates.length - 1] + 'T00:00:00Z')
      const have = new Set(v2Dates)
      for (let d = new Date(d0); d <= d1; d.setUTCDate(d.getUTCDate() + 1)) {
        const dow = d.getUTCDay()
        if (dow === 0 || dow === 6) continue // weekend
        const iso = d.toISOString().slice(0, 10)
        if (!have.has(iso)) missingWeekdays.push(iso)
      }
    }

    // vulling van de bias-accuracy kolommen (herontwerp sessie 2)
    const nAccuracy = rows.filter((r) => r.accuracy != null).length
    const nMfe = rows.filter((r) => r.mfe_pips != null).length
    const methodology = {}
    for (const r of rows) {
      const m = r.methodology ?? '(null)'
      methodology[m] = (methodology[m] || 0) + 1
    }

    // resultaatstatus
    const byResult = {}
    for (const r of rows) byResult[r.result ?? '(null)'] = (byResult[r.result ?? '(null)'] || 0) + 1

    // per source: datumbereik
    const rangeBySource = {}
    for (const r of rows) {
      const s = r.metadata?.source ?? '(geen source)'
      if (!rangeBySource[s]) rangeBySource[s] = { min: r.date, max: r.date }
      if (r.date < rangeBySource[s].min) rangeBySource[s].min = r.date
      if (r.date > rangeBySource[s].max) rangeBySource[s].max = r.date
    }

    // versies in metadata
    const byVersion = {}
    for (const r of rows) {
      const v = r.metadata?.version ?? '(geen version)'
      byVersion[v] = (byVersion[v] || 0) + 1
    }

    out.trade_focus_records = {
      totaal: rows.length,
      kolommen: [...cols].sort(),
      metadataKeys: [...metaKeys].sort(),
      bySource,
      byVersion,
      rangeBySource,
      byResult,
      perMonth,
      perMonthV2,
      v2: {
        totaal: v2.length,
        eersteDatum: v2Dates[0] ?? null,
        laatsteDatum: v2Dates[v2Dates.length - 1] ?? null,
        unieke_dagen: v2Dates.length,
        werkdagenZonderCalls: missingWeekdays.length,
        werkdagenZonderCallsLijst: missingWeekdays,
      },
      dubbeleCalls: { aantal: dups.length, voorbeelden: dups.slice(0, 10) },
      biasAccuracyVulling: { metAccuracy: nAccuracy, metMfe: nMfe, methodology },
    }
  }
}

// ─── 2. overige tabellen: aantallen + datumbereik ─────────────
async function tableSummary(table, dateCol) {
  const { rows, error } = await fetchAll(table, '*', dateCol)
  if (error) return { error }
  writeFileSync(`${DATA_DIR}/${table}.json`, JSON.stringify(rows, null, 1))
  const dates = rows.map((r) => r[dateCol]).filter(Boolean).sort()
  return {
    totaal: rows.length,
    eerste: dates[0] ?? null,
    laatste: dates[dates.length - 1] ?? null,
    kolommen: rows[0] ? Object.keys(rows[0]).sort() : [],
  }
}

out.execution_signals = await tableSummary('execution_signals', 'date')
out.cb_rate_snapshots = await tableSummary('cb_rate_snapshots', 'snapshot_date')
out.central_bank_rates = await tableSummary('central_bank_rates', 'currency')
out.fb_calls = await tableSummary('fb_calls', 'call_date')
out.fb_outcomes = await tableSummary('fb_outcomes', 'created_at')

// news_articles: alleen samenvatting (kan groot zijn) — geen volledige export
{
  const { count, error } = await sb.from('news_articles').select('id', { count: 'exact', head: true })
  let first = null, last = null
  if (!error) {
    const { data: f } = await sb.from('news_articles').select('published_at').order('published_at', { ascending: true }).limit(1)
    const { data: l } = await sb.from('news_articles').select('published_at').order('published_at', { ascending: false }).limit(1)
    first = f?.[0]?.published_at ?? null
    last = l?.[0]?.published_at ??  null
  }
  out.news_articles = error ? { error: error.message } : { totaal: count, eerste: first, laatste: last }
}

writeFileSync(`${DATA_DIR}/fase0-inventaris.json`, JSON.stringify(out, null, 2))

// ─── beknopte console-weergave ────────────────────────────────
const t = out.trade_focus_records
console.log('── trade_focus_records ──')
console.log('totaal:', t.totaal)
console.log('per source:', JSON.stringify(t.bySource))
console.log('per version:', JSON.stringify(t.byVersion))
console.log('range per source:', JSON.stringify(t.rangeBySource))
console.log('result:', JSON.stringify(t.byResult))
console.log('per maand:', JSON.stringify(t.perMonth))
console.log('v2:', JSON.stringify({ ...t.v2, werkdagenZonderCallsLijst: `(${t.v2.werkdagenZonderCallsLijst.length} dagen, zie json)` }))
console.log('dubbele calls:', t.dubbeleCalls.aantal)
console.log('bias-accuracy vulling:', JSON.stringify(t.biasAccuracyVulling))
console.log('kolommen:', t.kolommen.join(', '))
console.log('metadata keys:', t.metadataKeys.join(', '))
console.log('── overige tabellen ──')
for (const k of ['execution_signals', 'cb_rate_snapshots', 'central_bank_rates', 'fb_calls', 'fb_outcomes', 'news_articles']) {
  const v = out[k]
  console.log(k + ':', v.error ? 'FOUT: ' + v.error : `${v.totaal} rijen (${v.eerste ?? '?'} → ${v.laatste ?? '?'})`)
}
console.log('\nVolledige inventaris: scripts/audit/data/fase0-inventaris.json')
