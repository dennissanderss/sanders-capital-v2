// ─── One-time DB Setup ───────────────────────────────────────
// Creates the cb_rate_snapshots table and populates historical data.
// Call once: POST /api/setup-db
// After running successfully, this endpoint can be deleted.
// ────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Historical CB rate snapshots — verified central bank decisions
const HISTORICAL: {
  snapshot_date: string
  currency: string
  rate: number
  target: number | null
  bias: string
  bank: string
}[] = [
  // ═══ 2024-05 ═══
  { snapshot_date: '2024-05-01', currency: 'USD', rate: 5.33, target: 5.08, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-05-01', currency: 'EUR', rate: 4.00, target: 3.75, bias: 'afwachtend', bank: 'ECB' },
  { snapshot_date: '2024-05-01', currency: 'GBP', rate: 5.25, target: 5.00, bias: 'afwachtend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-05-01', currency: 'JPY', rate: 0.10, target: 0.25, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-05-01', currency: 'CHF', rate: 1.50, target: 1.25, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-05-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-05-01', currency: 'CAD', rate: 5.00, target: 4.75, bias: 'afwachtend', bank: 'BoC' },
  { snapshot_date: '2024-05-01', currency: 'NZD', rate: 5.50, target: 5.25, bias: 'afwachtend', bank: 'RBNZ' },
  // ═══ 2024-06 ═══ ECB cut to 3.75%, BoC cut to 4.75%
  { snapshot_date: '2024-06-01', currency: 'USD', rate: 5.33, target: 5.08, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-06-01', currency: 'EUR', rate: 4.00, target: 3.75, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2024-06-01', currency: 'GBP', rate: 5.25, target: 5.00, bias: 'afwachtend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-06-01', currency: 'JPY', rate: 0.10, target: 0.25, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-06-01', currency: 'CHF', rate: 1.50, target: 1.25, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-06-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-06-01', currency: 'CAD', rate: 5.00, target: 4.75, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2024-06-01', currency: 'NZD', rate: 5.50, target: 5.25, bias: 'afwachtend', bank: 'RBNZ' },
  // ═══ 2024-07 ═══ ECB first cut applied (3.75%), BoC cut applied (4.75%)
  { snapshot_date: '2024-07-01', currency: 'USD', rate: 5.33, target: 5.08, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-07-01', currency: 'EUR', rate: 3.75, target: 3.50, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2024-07-01', currency: 'GBP', rate: 5.25, target: 5.00, bias: 'afwachtend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-07-01', currency: 'JPY', rate: 0.10, target: 0.25, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-07-01', currency: 'CHF', rate: 1.25, target: 1.00, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-07-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-07-01', currency: 'CAD', rate: 4.75, target: 4.50, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2024-07-01', currency: 'NZD', rate: 5.50, target: 5.25, bias: 'afwachtend', bank: 'RBNZ' },
  // ═══ 2024-08 ═══ BoE cut to 5.00% (Aug 1), BoJ hiked to 0.25% (Jul 31)
  { snapshot_date: '2024-08-01', currency: 'USD', rate: 5.33, target: 5.08, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-08-01', currency: 'EUR', rate: 3.75, target: 3.50, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2024-08-01', currency: 'GBP', rate: 5.25, target: 5.00, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-08-01', currency: 'JPY', rate: 0.10, target: 0.25, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-08-01', currency: 'CHF', rate: 1.25, target: 1.00, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-08-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-08-01', currency: 'CAD', rate: 4.50, target: 4.25, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2024-08-01', currency: 'NZD', rate: 5.50, target: 5.25, bias: 'afwachtend', bank: 'RBNZ' },
  // ═══ 2024-09 ═══ Fed 50bp cut (Sep 18), BoE at 5.00%, BoJ at 0.25%, SNB cut (Sep 26), BoC cut to 4.25%
  { snapshot_date: '2024-09-01', currency: 'USD', rate: 5.33, target: 4.83, bias: 'voorzichtig verruimend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-09-01', currency: 'EUR', rate: 3.65, target: 3.50, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2024-09-01', currency: 'GBP', rate: 5.00, target: 4.75, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-09-01', currency: 'JPY', rate: 0.25, target: 0.50, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-09-01', currency: 'CHF', rate: 1.25, target: 1.00, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-09-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-09-01', currency: 'CAD', rate: 4.50, target: 4.25, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2024-09-01', currency: 'NZD', rate: 5.25, target: 5.00, bias: 'afwachtend', bank: 'RBNZ' },
  // ═══ 2024-10 ═══ Fed at 4.83 post-cut, ECB cut to 3.25% (Oct 17), RBNZ cut to 4.75% (Oct 9), BoC cut to 3.75% (Oct 23)
  { snapshot_date: '2024-10-01', currency: 'USD', rate: 4.83, target: 4.58, bias: 'voorzichtig verruimend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-10-01', currency: 'EUR', rate: 3.50, target: 3.25, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2024-10-01', currency: 'GBP', rate: 5.00, target: 4.75, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-10-01', currency: 'JPY', rate: 0.25, target: 0.50, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-10-01', currency: 'CHF', rate: 1.00, target: 0.75, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-10-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-10-01', currency: 'CAD', rate: 4.25, target: 3.75, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2024-10-01', currency: 'NZD', rate: 5.25, target: 4.75, bias: 'voorzichtig verruimend', bank: 'RBNZ' },
  // ═══ 2024-11 ═══ BoE cut to 4.75% (Nov 7), BoC at 3.75%, RZNZ cut to 4.25% (Nov 27)
  { snapshot_date: '2024-11-01', currency: 'USD', rate: 4.58, target: 4.33, bias: 'voorzichtig verruimend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-11-01', currency: 'EUR', rate: 3.25, target: 3.00, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2024-11-01', currency: 'GBP', rate: 5.00, target: 4.75, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-11-01', currency: 'JPY', rate: 0.25, target: 0.50, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-11-01', currency: 'CHF', rate: 1.00, target: 0.50, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-11-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-11-01', currency: 'CAD', rate: 3.75, target: 3.50, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2024-11-01', currency: 'NZD', rate: 4.75, target: 4.25, bias: 'voorzichtig verruimend', bank: 'RBNZ' },
  // ═══ 2024-12 ═══ Fed cut to 4.33 (Dec 18), ECB cut to 3.00% (Dec 12), SNB cut to 0.50% (Dec 12), BoC cut to 3.25% (Dec 11)
  { snapshot_date: '2024-12-01', currency: 'USD', rate: 4.58, target: 4.33, bias: 'voorzichtig verruimend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2024-12-01', currency: 'EUR', rate: 3.25, target: 3.00, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2024-12-01', currency: 'GBP', rate: 4.75, target: 4.50, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2024-12-01', currency: 'JPY', rate: 0.25, target: 0.50, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2024-12-01', currency: 'CHF', rate: 1.00, target: 0.50, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2024-12-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2024-12-01', currency: 'CAD', rate: 3.75, target: 3.25, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2024-12-01', currency: 'NZD', rate: 4.25, target: 4.00, bias: 'voorzichtig verruimend', bank: 'RBNZ' },
  // ═══ 2025-01 ═══ Fed at 4.33 post Dec cut, ECB at 3.00%, BoE at 4.75%, BoJ hiked to 0.50% (Jan 24)
  { snapshot_date: '2025-01-01', currency: 'USD', rate: 4.33, target: 4.00, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2025-01-01', currency: 'EUR', rate: 3.00, target: 2.75, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2025-01-01', currency: 'GBP', rate: 4.75, target: 4.50, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2025-01-01', currency: 'JPY', rate: 0.25, target: 0.50, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2025-01-01', currency: 'CHF', rate: 0.50, target: 0.25, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2025-01-01', currency: 'AUD', rate: 4.35, target: 4.10, bias: 'afwachtend', bank: 'RBA' },
  { snapshot_date: '2025-01-01', currency: 'CAD', rate: 3.25, target: 3.00, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2025-01-01', currency: 'NZD', rate: 4.25, target: 4.00, bias: 'voorzichtig verruimend', bank: 'RBNZ' },
  // ═══ 2025-02 ═══ BoJ at 0.50%, BoE cut to 4.50% (Feb 6), RBA cut to 4.10% (Feb 18), BoC cut to 3.00%, RBNZ cut to 3.75%
  { snapshot_date: '2025-02-01', currency: 'USD', rate: 4.33, target: 4.00, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2025-02-01', currency: 'EUR', rate: 2.75, target: 2.50, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2025-02-01', currency: 'GBP', rate: 4.50, target: 4.25, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2025-02-01', currency: 'JPY', rate: 0.50, target: 0.75, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2025-02-01', currency: 'CHF', rate: 0.50, target: 0.25, bias: 'voorzichtig verruimend', bank: 'SNB' },
  { snapshot_date: '2025-02-01', currency: 'AUD', rate: 4.10, target: 3.85, bias: 'voorzichtig verruimend', bank: 'RBA' },
  { snapshot_date: '2025-02-01', currency: 'CAD', rate: 3.00, target: 2.75, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2025-02-01', currency: 'NZD', rate: 3.75, target: 3.50, bias: 'voorzichtig verruimend', bank: 'RBNZ' },
  // ═══ 2025-03 ═══ ECB cut to 2.50%, SNB cut to 0.25%, BoC cut to 2.75%
  { snapshot_date: '2025-03-01', currency: 'USD', rate: 4.33, target: 4.00, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2025-03-01', currency: 'EUR', rate: 2.50, target: 2.25, bias: 'voorzichtig verruimend', bank: 'ECB' },
  { snapshot_date: '2025-03-01', currency: 'GBP', rate: 4.50, target: 4.25, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2025-03-01', currency: 'JPY', rate: 0.50, target: 0.75, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2025-03-01', currency: 'CHF', rate: 0.25, target: 0.00, bias: 'afwachtend', bank: 'SNB' },
  { snapshot_date: '2025-03-01', currency: 'AUD', rate: 4.10, target: 3.85, bias: 'voorzichtig verruimend', bank: 'RBA' },
  { snapshot_date: '2025-03-01', currency: 'CAD', rate: 2.75, target: 2.50, bias: 'voorzichtig verruimend', bank: 'BoC' },
  { snapshot_date: '2025-03-01', currency: 'NZD', rate: 3.75, target: 3.50, bias: 'voorzichtig verruimend', bank: 'RBNZ' },
  // ═══ 2025-04 ═══ RBNZ cut to 3.50%, tariff uncertainty → most CB on hold
  { snapshot_date: '2025-04-01', currency: 'USD', rate: 4.33, target: 4.00, bias: 'afwachtend', bank: 'Federal Reserve (Fed)' },
  { snapshot_date: '2025-04-01', currency: 'EUR', rate: 2.50, target: 2.25, bias: 'afwachtend', bank: 'ECB' },
  { snapshot_date: '2025-04-01', currency: 'GBP', rate: 4.50, target: 4.25, bias: 'voorzichtig verruimend', bank: 'Bank of England (BoE)' },
  { snapshot_date: '2025-04-01', currency: 'JPY', rate: 0.50, target: 0.75, bias: 'voorzichtig verkrappend', bank: 'Bank of Japan (BoJ)' },
  { snapshot_date: '2025-04-01', currency: 'CHF', rate: 0.25, target: 0.00, bias: 'afwachtend', bank: 'SNB' },
  { snapshot_date: '2025-04-01', currency: 'AUD', rate: 4.10, target: 3.85, bias: 'voorzichtig verruimend', bank: 'RBA' },
  { snapshot_date: '2025-04-01', currency: 'CAD', rate: 2.75, target: 2.50, bias: 'afwachtend', bank: 'BoC' },
  { snapshot_date: '2025-04-01', currency: 'NZD', rate: 3.50, target: 3.25, bias: 'voorzichtig verruimend', bank: 'RBNZ' },
]

export async function POST() {
  try {
    // Step 1: Create the table using raw SQL via supabase-js
    // Since we can't run DDL via PostgREST, we'll use a workaround:
    // Create a temporary function that creates the table
    const { error: fnError } = await supabase.rpc('create_cb_snapshots_table', {})
      .single()

    // If the function doesn't exist, we need to create the table manually
    // Try to just insert into the table — if it exists, great; if not, we'll get an error
    const { error: testError } = await supabase
      .from('cb_rate_snapshots')
      .select('id')
      .limit(1)

    if (testError && testError.message.includes('does not exist')) {
      return NextResponse.json({
        error: 'Table cb_rate_snapshots does not exist. Please create it in the Supabase SQL Editor:',
        sql: `CREATE TABLE IF NOT EXISTS cb_rate_snapshots (
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
CREATE INDEX IF NOT EXISTS idx_cb_snapshots_currency ON cb_rate_snapshots(currency);`,
        step: 'Copy the SQL above, go to Supabase Dashboard → SQL Editor → paste and run. Then call this endpoint again.',
      }, { status: 400 })
    }

    // Step 2: Upsert historical data
    const { error: insertError } = await supabase
      .from('cb_rate_snapshots')
      .upsert(HISTORICAL, { onConflict: 'snapshot_date,currency' })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Step 3: Also snapshot current rates
    const { data: currentRates } = await supabase
      .from('central_bank_rates')
      .select('currency, bank, rate, target, bias')

    if (currentRates?.length) {
      const now = new Date()
      const snapshotDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      await supabase
        .from('cb_rate_snapshots')
        .upsert(
          currentRates.map(r => ({
            snapshot_date: snapshotDate,
            currency: r.currency,
            rate: r.rate,
            target: r.target,
            bias: r.bias,
            bank: r.bank,
          })),
          { onConflict: 'snapshot_date,currency' }
        )
    }

    // Step 4: Count results
    const { data: all } = await supabase
      .from('cb_rate_snapshots')
      .select('snapshot_date, currency, rate, bias')
      .order('snapshot_date', { ascending: true })

    const dates = [...new Set((all || []).map(r => r.snapshot_date))].sort()

    return NextResponse.json({
      success: true,
      message: `Populated ${(all || []).length} CB rate snapshots across ${dates.length} months`,
      months: dates,
      totalRecords: (all || []).length,
      sample: (all || []).slice(-8).map(r => `${r.snapshot_date} ${r.currency}: ${r.rate}% (${r.bias})`),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
