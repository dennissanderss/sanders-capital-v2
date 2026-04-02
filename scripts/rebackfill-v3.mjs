#!/usr/bin/env node
// V3.0 Rebackfill Script — FX Edge Extraction Engine
// Deletes all existing v2 trackrecord and rebuilds with v3.0 engine:
// - Sub-regime classification (6 types)
// - Multi-factor context-weighted scoring
// - Pair-specific intermarket weights
// - 5-category signals (trend, mean-reversion, no-trade)
// - Tradeability filter
// - 1-day hold

const API = 'https://www.sanderscapital.nl/api/trackrecord-v2/backfill'

async function main() {
  console.log('=== V3.0 Track Record Rebackfill ===')
  console.log('FX Edge Extraction Engine\n')

  // Step 1: Delete existing records
  console.log('Step 1: Deleting existing backfill records...')
  const delRes = await fetch(API, { method: 'DELETE', redirect: 'follow' })
  const delData = await delRes.json()
  console.log(`  Deleted: ${delData.deleted || 0} records`)

  // Step 2: Wait
  console.log('\nWaiting 3 seconds...')
  await new Promise(r => setTimeout(r, 3000))

  // Step 3: Backfill with v3.0 engine (365 days)
  console.log('\nStep 2: Backfilling 365 days with V3.0 engine...')
  console.log('  (21 pairs, sub-regimes, pair-specific IM, 5-category signals)')
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
  console.log('=== Overall Stats ===')
  console.log(`Total: ${data.stats?.total}`)
  console.log(`Correct: ${data.stats?.correct}`)
  console.log(`Win Rate: ${data.stats?.winRate}%`)
  console.log(`Total Pips: ${data.stats?.totalPips}`)
  console.log(`Avg Win: ${data.stats?.avgWinPips} pips`)
  console.log(`Avg Loss: ${data.stats?.avgLossPips} pips`)
  console.log(`Profit Factor: ${data.stats?.profitFactor}`)
  console.log('')
  console.log('=== Signal Types ===')
  const mr = data.signalTypes?.meanReversion
  const tr = data.signalTypes?.trend
  if (mr) console.log(`Mean Reversion: ${mr.total} trades, ${mr.winRate}% win, PF ${mr.profitFactor}`)
  if (tr) console.log(`Trend: ${tr.total} trades, ${tr.winRate}% win, PF ${tr.profitFactor}`)
  console.log('')
  console.log('=== Tiers ===')
  const t1 = data.tiers?.tier1
  const t2 = data.tiers?.tier2
  if (t1) console.log(`Tier 1: ${t1.total} trades, ${t1.winRate}% win, PF ${t1.profitFactor}`)
  if (t2) console.log(`Tier 2: ${t2.total} trades, ${t2.winRate}% win, PF ${t2.profitFactor}`)
  console.log('')
  console.log(data.note || '')
  console.log('\nDone!')
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
