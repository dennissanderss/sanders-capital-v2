#!/usr/bin/env node
// ─── FASE 6 — trigger de v4-shadow-cron op productie ──────────
// Wacht tot de nieuwe deploy live is en roept dan één keer
// /api/cron/v4-shadow aan (zelfde pad als de dagelijkse cron).
// Draaien:  node scripts/audit/fase6-trigger-prod.mjs
// ──────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
const g = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'))
  return m ? m[1].trim() : process.env[k]
}
const BASIS = 'https://www.sanderscapital.nl'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (let poging = 1; poging <= 8; poging++) {
  const res = await fetch(`${BASIS}/api/cron/v4-shadow`, {
    headers: { Authorization: `Bearer ${g('CRON_SECRET')}` },
  })
  const tekst = await res.text()
  if (res.status === 404) {
    console.log(`poging ${poging}: route nog niet gedeployed (404) — 45s wachten…`)
    await sleep(45000)
    continue
  }
  console.log('status:', res.status)
  console.log(tekst.slice(0, 1500))
  process.exit(res.ok ? 0 : 1)
}
console.log('route na 8 pogingen nog niet beschikbaar — deploy checken')
process.exit(1)
