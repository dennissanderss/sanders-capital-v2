#!/usr/bin/env node
// ─── FASE 6 — engine_version op bestaande calls ───────────────
// Zet metadata.engine_version op elke rij in trade_focus_records,
// op basis van de audit-classificatie (fase 0b):
//   newsSimulated=true                    → 'backfill-simulatie'
//   live, call-datum t/m 2026-04-07       → 'v3.1-optimizer-vroeg'
//   live, daarna                          → 'v3.1-optimizer'
//
// Veiligheid:
//   - maakt eerst een verse lokale backup van id+metadata
//   - merge: bestaande metadata-keys blijven onaangetast
//   - idempotent: rijen met een engine_version worden overgeslagen
//   - verifieert achteraf de aantallen en dat er geen keys verloren zijn
//
// Draaien:  node scripts/audit/fase6-engineversion.mjs
// ──────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('.env.local', 'utf8')
const g = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : process.env[k] }
const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'))

// ─── 1. verse backup ──────────────────────────────────────────
const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('trade_focus_records')
    .select('id, date, created_at, metadata')
    .order('date', { ascending: true })
    .range(from, from + 999)
  if (error) { console.error('FOUT bij lezen:', error.message); process.exit(1) }
  rows.push(...(data || []))
  if (!data || data.length < 1000) break
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
writeFileSync(`scripts/audit/data/backup-metadata-${stamp}.json`, JSON.stringify(rows))
console.log(`backup: ${rows.length} rijen → scripts/audit/data/backup-metadata-${stamp}.json`)

// ─── 2. label bepalen + mergen ────────────────────────────────
const labelFor = (r) => {
  if (r.metadata?.newsSimulated === true) return 'backfill-simulatie'
  return r.date <= '2026-04-07' ? 'v3.1-optimizer-vroeg' : 'v3.1-optimizer'
}

let updated = 0, skipped = 0, failed = 0
const plan = { 'backfill-simulatie': 0, 'v3.1-optimizer-vroeg': 0, 'v3.1-optimizer': 0 }
const queue = rows.filter((r) => {
  if (r.metadata?.engine_version) { skipped++; return false }
  plan[labelFor(r)]++
  return true
})
console.log('te labelen:', queue.length, JSON.stringify(plan), '| al gelabeld (overgeslagen):', skipped)

const CONC = 10
for (let i = 0; i < queue.length; i += CONC) {
  const batch = queue.slice(i, i + CONC)
  await Promise.all(batch.map(async (r) => {
    const { error } = await sb
      .from('trade_focus_records')
      .update({ metadata: { ...(r.metadata || {}), engine_version: labelFor(r) } })
      .eq('id', r.id)
    if (error) { failed++; console.error('  FOUT', r.id, error.message) } else updated++
  }))
  if ((i / CONC) % 20 === 0) console.log(`  ${Math.min(i + CONC, queue.length)}/${queue.length}…`)
}
console.log(`bijgewerkt: ${updated}, mislukt: ${failed}`)

// ─── 3. verificatie ───────────────────────────────────────────
const verify = []
for (let from = 0; ; from += 1000) {
  const { data } = await sb
    .from('trade_focus_records')
    .select('id, metadata')
    .range(from, from + 999)
  verify.push(...(data || []))
  if (!data || data.length < 1000) break
}
const counts = {}
for (const r of verify) {
  const v = r.metadata?.engine_version ?? '(ontbreekt)'
  counts[v] = (counts[v] || 0) + 1
}
console.log('verificatie engine_version:', JSON.stringify(counts))

// geen metadata-keys verloren? vergelijk keysets met de backup
const backupById = new Map(rows.map((r) => [r.id, r.metadata || {}]))
let keyLoss = 0
for (const r of verify) {
  const oud = backupById.get(r.id)
  if (!oud) continue
  for (const k of Object.keys(oud)) {
    if (!(k in (r.metadata || {}))) { keyLoss++; console.error('  KEY VERLOREN:', r.id, k); break }
  }
}
console.log(keyLoss === 0 ? 'geen metadata-keys verloren ✓' : `LET OP: ${keyLoss} rijen met verloren keys`)
