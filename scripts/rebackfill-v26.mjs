#!/usr/bin/env node
// V2.6 Rebackfill Script
// Deletes all existing v2 trackrecord and rebuilds with v2.6 scoring:
// - Historical CB rate snapshots (rates change per month)
// - Pure CB policy regime (no intermarket override)
// - Expanded news keywords
// - 21 pairs, 5 per day, 365 days history
// - Mean reversion, 2-day hold
//
// PREREQUISITES:
//   1. Run setup-cb-snapshots.mjs first to create the table and populate historical rates
//   2. Create the table in Supabase SQL editor if needed (see setup script output)

const API = 'https://www.sanderscapital.nl/api/trackrecord-v2/backfill'

async function main() {
  console.log('=== V2.6 Track Record Rebackfill ===')
  console.log('Using historical CB rate snapshots per month\n')

  // Step 1: Delete existing records
  console.log('Step 1: Deleting existing v2 backfill records...')
  const delRes = await fetch(API, {
    method: 'DELETE',
    redirect: 'follow',
  })
  const delData = await delRes.json()
  console.log(`  Deleted: ${delData.deleted || 0} records`)

  // Step 2: Wait for DB to settle
  console.log('\nWaiting 3 seconds...')
  await new Promise(r => setTimeout(r, 3000))

  // Step 3: Backfill with v2.6 scoring (365 days)
  console.log('\nStep 2: Backfilling 365 days with v2.6 scoring...')
  console.log('  (21 pairs, historical CB snapshots, mean reversion, 2-day hold)')
  console.log('  This may take 10-15 minutes due to Yahoo Finance rate limits...\n')

  const postRes = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days: 365 }),
    redirect: 'follow',
  })

  const data = await postRes.json()

  if (data.error) {
    console.error('ERROR:', data.error)
    process.exit(1)
  }

  console.log('=== Results ===')
  console.log(`Version: ${data.version}`)
  console.log(`Records: ${data.records}`)
  console.log(`Skipped (existing): ${data.skippedExisting}`)
  console.log(`Historical snapshots: ${data.hasHistoricalSnapshots ? 'YES' : 'NO'}`)
  console.log(`Snapshot periods: ${data.snapshotPeriods}`)
  console.log('')
  console.log('=== Win Rate ===')
  console.log(`Total: ${data.stats?.total}`)
  console.log(`Correct: ${data.stats?.correct}`)
  console.log(`Incorrect: ${data.stats?.incorrect}`)
  console.log(`Win Rate: ${data.stats?.winRate}%`)
  console.log('')
  console.log('=== Filters Applied ===')
  console.log(`Regime alignment: ${data.filters?.filteredByRegimeAlignment}`)
  console.log(`Intermarket: ${data.filters?.filteredByIntermarket}`)
  console.log(`Contradiction: ${data.filters?.filteredByContradiction}`)
  console.log(`Total filtered: ${data.filters?.totalFiltered}`)
  console.log('')
  console.log(data.note || '')
  console.log('\nDone!')
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
