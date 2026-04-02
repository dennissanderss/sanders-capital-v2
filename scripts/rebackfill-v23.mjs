#!/usr/bin/env node
// V2.3 Rebackfill Script
// Deletes all existing v2 trackrecord and rebuilds with v2.3 scoring:
// - 21 pairs (was 10)
// - Intermarket regime override
// - Magnitude-weighted alignment
// - News cap ±2.0
// - Top 5 pairs per day (was 3)
// - 60 days history (was 45)

const API = 'https://www.sanderscapital.nl/api/trackrecord-v2/backfill'

async function main() {
  console.log('=== V2.3 Track Record Rebackfill ===\n')

  // Step 1: Delete existing records
  console.log('Step 1: Deleting existing v2 backfill records...')
  const delRes = await fetch(API, {
    method: 'DELETE',
    redirect: 'follow',
  })
  const delData = await delRes.json()
  console.log(`  Deleted: ${delData.deleted || 0} records`)
  console.log(`  Response: ${delData.message || JSON.stringify(delData)}`)

  // Step 2: Wait for DB to settle
  console.log('\nWaiting 3 seconds...')
  await new Promise(r => setTimeout(r, 3000))

  // Step 3: Backfill with v2.3 scoring
  console.log('\nStep 2: Backfilling 60 days with v2.3 scoring...')
  console.log('  (21 pairs, intermarket override, magnitude alignment, 2-day hold)')
  console.log('  This may take 2-3 minutes due to Yahoo Finance rate limits...\n')

  const postRes = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days: 60 }),
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
