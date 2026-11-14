// ─── FASE 6 — dry-run van de v4-signaalweg (geen inserts) ─────
// Haalt live candles + rentes en print welke calls de engine NU zou
// geven (signaalbasis = laatste voltooide candles). Test daarnaast de
// Storage-bucket met een verificatiebestand. Schrijft géén calls.
// Compileren+draaien: zie fase6-run-shadow (zelfde route).
// ──────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'

const env = readFileSync('.env.local', 'utf8')
for (const regel of env.split('\n')) {
  const m = regel.replace(/\r$/, '').match(/^([A-Z_0-9]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

async function main() {
  const { haalV4Candles, berekenV4Calls } = await import('../../src/lib/fx-v4/service')
  const { haalRentes, haalCot } = await import('../../src/lib/fx-v4/bronnen')
  const { createClient } = await import('@supabase/supabase-js')

  const vanaf = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10)
  console.log('candles + rentes + cot ophalen…')
  const [candles, rentes, cot] = await Promise.all([
    haalV4Candles(),
    haalRentes(vanaf),
    haalCot(new Date().toISOString().slice(0, 10)),
  ])

  for (const [ccy, reeks] of Object.entries(rentes)) {
    const l = reeks[reeks.length - 1]
    console.log(`  rente ${ccy}: ${reeks.length} punten, laatste ${l?.date} = ${l?.y}%`)
  }
  console.log('  cot:', JSON.stringify(cot))

  const { calls, overgeslagen } = berekenV4Calls(candles, rentes)
  console.log(`\nzou ${calls.length} calls geven:`)
  for (const c of calls) {
    console.log(`  ${c.pair} ${c.richting.toUpperCase()} | rente-Δ5 ${c.yldD5bp}bp | mom5 ${c.mom5Pips}p (${c.mom5Atr}×ATR) | basis ${c.signalDate} @ ${c.signalClose}`)
    for (const zin of c.redenering) console.log(`    · ${zin}`)
  }
  console.log(`\novergeslagen (${overgeslagen.length}):`)
  for (const o of overgeslagen) console.log(`  ${o.pair}: ${o.reden}`)

  // Storage-verificatie (bucket + upload, onschuldig testbestand)
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await sb.storage.createBucket('v4-inputs', { public: false }).catch(() => null)
  const { error } = await sb.storage
    .from('v4-inputs')
    .upload('_verificatie.json', JSON.stringify({ test: true, op: new Date().toISOString() }), { contentType: 'application/json', upsert: true })
  console.log('\nStorage-test:', error ? 'FOUT: ' + error.message : 'bucket v4-inputs schrijfbaar ✓')
}

main().catch((e) => { console.error(e); process.exit(1) })
