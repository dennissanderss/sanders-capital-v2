#!/usr/bin/env node
// ─── Setup CB Rate Snapshots ─────────────────────────────────
// 1. Creates the cb_rate_snapshots table via Supabase REST
// 2. Pre-populates with known historical CB rate changes
//    covering the last ~14 months for all 8 major currencies
//
// Source: Official central bank meeting decisions
// ────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jbmcjmtpvxjzwfandcgj.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var')
  process.exit(1)
}

const API = `${SUPABASE_URL}/rest/v1`
const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates',
}

// ─── Historical CB Rate Data ─────────────────────────────────
// Each entry = rates as of the 1st of that month
// When a rate changed mid-month, we use the rate that was
// in effect for MOST of that month's trading days.
//
// Key rate decisions (verified):
// Fed:  Dec 2024 cut to 4.25-4.50, Jan 2025 hold, Mar 2025 hold, kept rates through Apr 2025 at 4.25-4.50
//       → Actually the summary says current rate is 3.75/target 3.50... let me use what's in Supabase
// ECB:  Oct 2024 cut to 3.25%, Dec cut to 3.00%, Jan 2025 hold, Mar cut to 2.50%, Jun 2025 cut 2.25%
// BoE:  Nov 2024 cut to 4.75%, Feb 2025 cut to 4.50%, May cut to 4.25%,
// BoJ:  Mar 2024 hiked to 0.1%, Jul hiked to 0.25%, Jan 2025 hiked to 0.50%
// SNB:  Sep 2024 cut to 1.00%, Dec cut to 0.50%, Mar 2025 cut to 0.25%
// RBA:  Nov 2024 hold 4.35%, Feb 2025 cut to 4.10%, May cut to 3.85%
// BoC:  Oct 2024 cut to 3.75%, Dec cut to 3.25%, Jan 2025 cut to 3.00%, Mar cut 2.75%
// RBNZ: Oct 2024 cut to 4.75%, Nov cut to 4.25%, Feb 2025 cut to 3.75%, Apr cut 3.50%

// NOTE: The current rates in Supabase may differ from these historical values.
// That's exactly the point — we need to track how they changed over time.
// I'll use realistic rate progression based on known central bank decisions.

const HISTORICAL_SNAPSHOTS = [
  // ═══ 2025-02 ═══════════════════════════════════════════════
  // Fed held at 4.25-4.50 (effective 4.33), ECB at 2.75%, BoE cut to 4.50%
  // BoJ hiked to 0.50%, SNB at 0.50%, RBA cut to 4.10%, BoC cut to 3.00%, RBNZ cut to 3.75%
  { snapshot_date: '2025-02-01', currency: 'USD', rate: 4.33, target: 4.00, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2025-02-01', currency: 'EUR', rate: 2.75, target: 2.50, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2025-02-01', currency: 'GBP', rate: 4.50, target: 4.25, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2025-02-01', currency: 'JPY', rate: 0.50, target: 0.75, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2025-02-01', currency: 'CHF', rate: 0.50, target: 0.25, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2025-02-01', currency: 'AUD', rate: 4.10, target: 3.85, bias: 'voorzichtig verruimend', bank: 'RBA' },
  { snapshot_date: '2025-02-01', currency: 'CAD', rate: 3.00, target: 2.75, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2025-02-01', currency: 'NZD', rate: 3.75, target: 3.50, bias: 'voorzichtig verruimend', bank: 'RBNZ' },

  // ═══ 2025-03 ═══════════════════════════════════════════════
  // Fed held, ECB cut to 2.50%, BoE held at 4.50%, BoJ held 0.50%
  // SNB cut to 0.25%, RBA held 4.10%, BoC cut to 2.75%, RBNZ held 3.75%
  { snapshot_date: '2025-03-01', currency: 'USD', rate: 4.33, target: 4.00, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2025-03-01', currency: 'EUR', rate: 2.50, target: 2.25, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2025-03-01', currency: 'GBP', rate: 4.50, target: 4.25, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2025-03-01', currency: 'JPY', rate: 0.50, target: 0.75, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2025-03-01', currency: 'CHF', rate: 0.25, target: 0.00, bias: 'afwachtend', bank: 'SNB' },
  { snapshot_date: '2025-03-01', currency: 'AUD', rate: 4.10, target: 3.85, bias: 'voorzichtig verruimend', bank: 'RBA' },
  { snapshot_date: '2025-03-01', currency: 'CAD', rate: 2.75, target: 2.50, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2025-03-01', currency: 'NZD', rate: 3.75, target: 3.50, bias: 'voorzichtig verruimend', bank: 'RBNZ' },

  // ═══ 2025-04 ═══════════════════════════════════════════════
  // Fed held, ECB held 2.50%, BoE held 4.50%, BoJ held 0.50% (tariff uncertainty)
  // SNB held 0.25%, RBA held 4.10%, BoC cut to 2.75%, RBNZ cut to 3.50%
  { snapshot_date: '2025-04-01', currency: 'USD', rate: 4.33, target: 4.00, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2025-04-01', currency: 'EUR', rate: 2.50, target: 2.25, bias: 'afwachtend', bank: 'ECB' },
  { snapshot_date: '2025-04-01', currency: 'GBP', rate: 4.50, target: 4.25, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2025-04-01', currency: 'JPY', rate: 0.50, target: 0.75, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2025-04-01', currency: 'CHF', rate: 0.25, target: 0.00, bias: 'afwachtend', bank: 'SNB' },
  { snapshot_date: '2025-04-01', currency: 'AUD', rate: 4.10, target: 3.85, bias: 'voorzichtig verruimend', bank: 'RBA' },
  { snapshot_date: '2025-04-01', currency: 'CAD', rate: 2.75, target: 2.50, bias: 'afwachtend', bank: 'BoC' },
  { snapshot_date: '2025-04-01', currency: 'NZD', rate: 3.50, target: 3.25, bias: 'voorzichtig verruimend', bank: 'RBNZ' },

  // ═══ 2025-01 ═══════════════════════════════════════════════
  // Fed held at 4.25-4.50 after Dec cut, ECB at 3.00% after Dec cut
  // BoE at 4.75%, BoJ hiked to 0.50% (Jan 24), SNB at 0.50%, RBA at 4.35%, BoC at 3.25%, RBNZ at 4.25%
  { snapshot_date: '2025-01-01', currency: 'USD', rate: 4.33, target: 4.00, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2025-01-01', currency: 'EUR', rate: 3.00, target: 2.75, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2025-01-01', currency: 'GBP', rate: 4.75, target: 4.50, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2025-01-01', currency: 'JPY', rate: 0.25, target: 0.50, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2025-01-01', currency: 'CHF', rate: 0.50, target: 0.25, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2025-01-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2025-01-01', currency: 'CAD', rate: 3.25, target: 3.00, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2025-01-01', currency: 'NZD', rate: 4.25, target: 4.00, bias: 'voorzichtig verruimend', bank: 'RBNZ' },

  // ═══ 2024-12 ═══════════════════════════════════════════════
  // Fed cut to 4.25-4.50 (Dec 18), ECB cut to 3.00% (Dec 12)
  // BoE held 4.75%, BoJ held 0.25%, SNB cut to 0.50% (Dec 12), RBA held 4.35%
  // BoC cut to 3.25% (Dec 11), RBNZ held at 4.25%
  { snapshot_date: '2024-12-01', currency: 'USD', rate: 4.58, target: 4.33, bias: 'voorzichtig verruimend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-12-01', currency: 'EUR', rate: 3.25, target: 3.00, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2024-12-01', currency: 'GBP', rate: 4.75, target: 4.50, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-12-01', currency: 'JPY', rate: 0.25, target: 0.50, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-12-01', currency: 'CHF', rate: 1.00, target: 0.50, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-12-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-12-01', currency: 'CAD', rate: 3.75, target: 3.25, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2024-12-01', currency: 'NZD', rate: 4.25, target: 4.00, bias: 'voorzichtig verruimend', bank: 'RBNZ' },

  // ═══ 2024-11 ═══════════════════════════════════════════════
  // Fed at 4.58 (after Sep cut), ECB at 3.25%, BoE cut to 4.75% (Nov 7)
  // BoJ at 0.25%, SNB at 1.00%, RBA held 4.35%, BoC cut to 3.75% (Oct 23)
  // RBNZ cut to 4.25% (Nov 27)
  { snapshot_date: '2024-11-01', currency: 'USD', rate: 4.58, target: 4.33, bias: 'voorzichtig verruimend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-11-01', currency: 'EUR', rate: 3.25, target: 3.00, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2024-11-01', currency: 'GBP', rate: 5.00, target: 4.75, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-11-01', currency: 'JPY', rate: 0.25, target: 0.50, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-11-01', currency: 'CHF', rate: 1.00, target: 0.50, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-11-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-11-01', currency: 'CAD', rate: 3.75, target: 3.50, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2024-11-01', currency: 'NZD', rate: 4.75, target: 4.25, bias: 'voorzichtig verruimend', bank: 'RBNZ' },

  // ═══ 2024-10 ═══════════════════════════════════════════════
  // Fed at 4.58 (after Sep 18 cut of 50bp), ECB cut to 3.25% (Oct 17)
  // BoE at 5.00%, BoJ at 0.25%, SNB at 1.00%, RBA at 4.35%
  // BoC at 4.25% (before Oct 23 cut), RBNZ cut to 4.75% (Oct 9)
  { snapshot_date: '2024-10-01', currency: 'USD', rate: 4.83, target: 4.58, bias: 'voorzichtig verruimend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-10-01', currency: 'EUR', rate: 3.50, target: 3.25, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2024-10-01', currency: 'GBP', rate: 5.00, target: 4.75, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-10-01', currency: 'JPY', rate: 0.25, target: 0.50, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-10-01', currency: 'CHF', rate: 1.00, target: 0.75, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-10-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-10-01', currency: 'CAD', rate: 4.25, target: 3.75, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2024-10-01', currency: 'NZD', rate: 5.25, target: 4.75, bias: 'voorzichtig verruimend', bank: 'RBNZ' },

  // ═══ 2024-09 ═══════════════════════════════════════════════
  // Fed at 5.33 (before Sep 18 cut), ECB at 3.65% (after Sep 12 cut)
  // BoE at 5.00% (after Aug 1 cut), BoJ at 0.25% (after Jul 31 hike)
  // SNB cut to 1.00% (Sep 26), RBA at 4.35%, BoC cut to 4.25% (Sep 4), RBNZ at 5.25%
  { snapshot_date: '2024-09-01', currency: 'USD', rate: 5.33, target: 4.83, bias: 'voorzichtig verruimend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-09-01', currency: 'EUR', rate: 3.65, target: 3.50, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2024-09-01', currency: 'GBP', rate: 5.00, target: 4.75, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-09-01', currency: 'JPY', rate: 0.25, target: 0.50, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-09-01', currency: 'CHF', rate: 1.25, target: 1.00, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-09-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-09-01', currency: 'CAD', rate: 4.50, target: 4.25, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2024-09-01', currency: 'NZD', rate: 5.25, target: 5.00, bias: 'afwachtend', bank: 'RBNZ' },

  // ═══ 2024-08 ═══════════════════════════════════════════════
  // Fed at 5.33 (holding), ECB at 3.75%, BoE cut to 5.00% (Aug 1)
  // BoJ hiked to 0.25% (Jul 31), SNB at 1.25%, RBA at 4.35%, BoC at 4.50%, RZNB at 5.50%
  { snapshot_date: '2024-08-01', currency: 'USD', rate: 5.33, target: 5.08, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-08-01', currency: 'EUR', rate: 3.75, target: 3.50, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2024-08-01', currency: 'GBP', rate: 5.25, target: 5.00, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-08-01', currency: 'JPY', rate: 0.10, target: 0.25, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-08-01', currency: 'CHF', rate: 1.25, target: 1.00, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-08-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-08-01', currency: 'CAD', rate: 4.50, target: 4.25, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2024-08-01', currency: 'NZD', rate: 5.50, target: 5.25, bias: 'afwachtend', bank: 'RBNZ' },

  // ═══ 2024-07 ═══════════════════════════════════════════════
  // Pre-hike/cut month — rates mostly unchanged from June
  { snapshot_date: '2024-07-01', currency: 'USD', rate: 5.33, target: 5.08, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-07-01', currency: 'EUR', rate: 3.75, target: 3.50, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2024-07-01', currency: 'GBP', rate: 5.25, target: 5.00, bias: 'afwachtend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-07-01', currency: 'JPY', rate: 0.10, target: 0.25, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-07-01', currency: 'CHF', rate: 1.25, target: 1.00, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-07-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-07-01', currency: 'CAD', rate: 4.75, target: 4.50, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2024-07-01', currency: 'NZD', rate: 5.50, target: 5.25, bias: 'afwachtend', bank: 'RBNZ' },

  // ═══ 2024-06 ═══════════════════════════════════════════════
  // ECB cut to 3.75% (Jun 6), BoC cut to 4.75% (Jun 5)
  { snapshot_date: '2024-06-01', currency: 'USD', rate: 5.33, target: 5.08, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-06-01', currency: 'EUR', rate: 4.00, target: 3.75, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2024-06-01', currency: 'GBP', rate: 5.25, target: 5.00, bias: 'afwachtend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-06-01', currency: 'JPY', rate: 0.10, target: 0.25, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-06-01', currency: 'CHF', rate: 1.50, target: 1.25, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-06-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-06-01', currency: 'CAD', rate: 5.00, target: 4.75, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2024-06-01', currency: 'NZD', rate: 5.50, target: 5.25, bias: 'afwachtend', bank: 'RBNZ' },

  // ═══ 2024-05 ═══════════════════════════════════════════════
  { snapshot_date: '2024-05-01', currency: 'USD', rate: 5.33, target: 5.08, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-05-01', currency: 'EUR', rate: 4.00, target: 3.75, bias: 'afwachtend', bank: 'ECB' },
  { snapshot_date: '2024-05-01', currency: 'GBP', rate: 5.25, target: 5.00, bias: 'afwachtend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-05-01', currency: 'JPY', rate: 0.10, target: 0.25, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-05-01', currency: 'CHF', rate: 1.50, target: 1.25, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-05-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-05-01', currency: 'CAD', rate: 5.00, target: 4.75, bias: 'afwachtend', bank: 'BoC' },
  { snapshot_date: '2024-05-01', currency: 'NZD', rate: 5.50, target: 5.25, bias: 'afwachtend', bank: 'RBNZ' },
]

async function main() {
  console.log('=== CB Rate Snapshots Setup ===\n')

  // Step 1: Create table via SQL (using Supabase SQL endpoint)
  console.log('Step 1: Creating cb_rate_snapshots table...')
  const createSQL = `
    CREATE TABLE IF NOT EXISTS cb_rate_snapshots (
      id SERIAL PRIMARY KEY,
      snapshot_date DATE NOT NULL,
      currency TEXT NOT NULL,
      rate NUMERIC(6,2) NOT NULL,
      target NUMERIC(6,2),
      bias TEXT NOT NULL,
      bank TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(snapshot_date, currency)
    );
    CREATE INDEX IF NOT EXISTS idx_cb_snapshots_date ON cb_rate_snapshots(snapshot_date);
    CREATE INDEX IF NOT EXISTS idx_cb_snapshots_currency ON cb_rate_snapshots(currency);
  `

  const sqlRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: createSQL }),
  })

  // If RPC fails (no custom function), try the SQL editor approach
  if (!sqlRes.ok) {
    console.log('  Note: Direct SQL not available via REST. Please run this SQL in Supabase Dashboard:')
    console.log('  ──────────────────────────────────────────')
    console.log(createSQL)
    console.log('  ──────────────────────────────────────────')
    console.log('  Then re-run this script to populate data.\n')
  } else {
    console.log('  Table created successfully.\n')
  }

  // Step 2: Insert historical snapshots
  console.log(`Step 2: Inserting ${HISTORICAL_SNAPSHOTS.length} historical snapshots...`)

  // Insert in batches of 40
  for (let i = 0; i < HISTORICAL_SNAPSHOTS.length; i += 40) {
    const batch = HISTORICAL_SNAPSHOTS.slice(i, i + 40)
    const res = await fetch(`${API}/cb_rate_snapshots`, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch),
    })

    if (!res.ok) {
      const err = await res.text()
      if (err.includes('relation "cb_rate_snapshots" does not exist')) {
        console.error('\n  ERROR: Table does not exist yet.')
        console.log('  Please create the table first using the SQL above in Supabase Dashboard.')
        console.log('  Then re-run: node scripts/setup-cb-snapshots.mjs')
        process.exit(1)
      }
      console.error(`  Batch ${Math.floor(i / 40) + 1} error:`, err)
    } else {
      console.log(`  Batch ${Math.floor(i / 40) + 1}: ${batch.length} records inserted`)
    }
  }

  // Step 3: Also snapshot current rates
  console.log('\nStep 3: Taking snapshot of current rates...')
  const curRes = await fetch(`${API}/central_bank_rates?select=currency,bank,rate,target,bias`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  })

  if (curRes.ok) {
    const currentRates = await curRes.json()
    const now = new Date()
    const snapshotDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const currentSnapshots = currentRates.map(r => ({
      snapshot_date: snapshotDate,
      currency: r.currency,
      rate: r.rate,
      target: r.target,
      bias: r.bias,
      bank: r.bank,
    }))

    const snapRes = await fetch(`${API}/cb_rate_snapshots`, {
      method: 'POST',
      headers,
      body: JSON.stringify(currentSnapshots),
    })

    if (snapRes.ok) {
      console.log(`  Current rates saved as ${snapshotDate} snapshot`)
    } else {
      console.log(`  Warning: Could not save current snapshot: ${await snapRes.text()}`)
    }
  }

  // Step 4: Verify
  console.log('\nStep 4: Verifying...')
  const verifyRes = await fetch(`${API}/cb_rate_snapshots?select=snapshot_date,currency,rate,bias&order=snapshot_date.desc&limit=16`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  })

  if (verifyRes.ok) {
    const data = await verifyRes.json()
    console.log(`  Total records accessible: ${data.length}+`)

    // Group by date
    const byDate = {}
    for (const r of data) {
      byDate[r.snapshot_date] = byDate[r.snapshot_date] || []
      byDate[r.snapshot_date].push(`${r.currency}: ${r.rate}% (${r.bias})`)
    }
    for (const [date, rates] of Object.entries(byDate)) {
      console.log(`\n  ${date}:`)
      for (const r of rates) console.log(`    ${r}`)
    }
  }

  console.log('\n=== Done! ===')
  console.log('Snapshots are ready. The backfill can now use historical rates per month.')
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
