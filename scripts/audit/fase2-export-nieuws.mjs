#!/usr/bin/env node
// ─── AUDIT FASE 2a — Nieuws-export (alleen-lezen) ─────────────
// Exporteert news_articles (alleen de velden die calcNewsBonus gebruikt)
// voor het naspelen van de nieuwsbonus per call.
// Draaien:  node scripts/audit/fase2-export-nieuws.mjs
// ──────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('.env.local', 'utf8')
const getEnv = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'))
  return m ? m[1].trim() : process.env[k]
}
const sb = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

const rows = []
const PAGE = 1000
for (let from = 0; ; from += PAGE) {
  const { data, error } = await sb
    .from('news_articles')
    .select('title, summary, affected_currencies, published_at, relevance_score')
    .gte('published_at', '2026-03-25')
    .order('published_at', { ascending: true })
    .range(from, from + PAGE - 1)
  if (error) { console.error('FOUT:', error.message); process.exit(1) }
  rows.push(...(data || []))
  if (!data || data.length < PAGE) break
}
writeFileSync('scripts/audit/data/news_articles.json', JSON.stringify(rows))
console.log(`geëxporteerd: ${rows.length} artikelen (${rows[0]?.published_at} → ${rows[rows.length - 1]?.published_at})`)

// dekkingscheck: artikelen per dag (gaten = dagen waarop de nieuwsbonus 0 was)
const perDay = {}
for (const r of rows) perDay[(r.published_at || '').slice(0, 10)] = (perDay[(r.published_at || '').slice(0, 10)] || 0) + 1
const days = Object.keys(perDay).sort()
let gaten = 0
for (let d = new Date(days[0] + 'T00:00:00Z'); d <= new Date(days[days.length - 1] + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
  if (!perDay[d.toISOString().slice(0, 10)]) gaten++
}
const counts = days.map((d) => perDay[d]).sort((a, b) => a - b)
console.log(`dagen met artikelen: ${days.length}, dagen zonder: ${gaten}, mediaan/dag: ${counts[Math.floor(counts.length / 2)]}, max/dag: ${counts[counts.length - 1]}`)
