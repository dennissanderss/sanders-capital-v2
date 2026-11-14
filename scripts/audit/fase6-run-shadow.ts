// ─── FASE 6 — handmatige schaduwrun (zelfde code als de cron) ──
// Draaien:  npx tsx scripts/audit/fase6-run-shadow.ts
// Deterministisch: inputs zijn uitsluitend voltooide candles en
// rentestanden t/m gisteren, dus het tijdstip van draaien maakt
// voor de uitkomst niet uit.
// ──────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
for (const regel of env.split('\n')) {
  const m = regel.replace(/\r$/, '').match(/^([A-Z_0-9]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

async function main() {
  const { haalV4Candles, resolveV4Shadow, generateV4Shadow } = await import('../../src/lib/fx-v4/service')

  console.log('candles ophalen…')
  const candles = await haalV4Candles()
  for (const [pair, bars] of Object.entries(candles)) {
    if (bars.length < 20) console.warn(`  LET OP: ${pair} maar ${bars.length} candles`)
  }
  console.log('afrekenen…')
  console.log(JSON.stringify(await resolveV4Shadow(candles)))
  console.log('genereren…')
  console.log(JSON.stringify(await generateV4Shadow(candles), null, 1))
}

main().catch((e) => { console.error(e); process.exit(1) })
