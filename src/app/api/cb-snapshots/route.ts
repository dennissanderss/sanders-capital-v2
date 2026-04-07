// ─── CB Rate Snapshots API ───────────────────────────────────
// Stores monthly snapshots of central bank rates so that
// historical backfill can use the rates that were actually
// in effect at each point in time.
//
// Table: cb_rate_snapshots
//   id          serial PK
//   snapshot_date  date (first of month, e.g. 2025-06-01)
//   currency    text
//   rate        numeric(6,2)
//   target      numeric(6,2)
//   bias        text
//   bank        text
//   created_at  timestamptz DEFAULT now()
//   UNIQUE(snapshot_date, currency)
//
// GET:  List all snapshots (optionally filter by ?currency=USD)
// POST: Take a snapshot of current rates (or POST historical data)
// ────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET: Retrieve snapshots
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const currency = searchParams.get('currency')

  let query = getSupabase()
    .from('cb_rate_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false })

  if (currency) {
    query = query.eq('currency', currency.toUpperCase())
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ snapshots: data, count: data?.length || 0 })
}

// POST: Take a snapshot (current rates or historical bulk insert)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    // Option 1: Bulk insert historical snapshots
    if (body.historical && Array.isArray(body.historical)) {
      const records = body.historical.map((h: {
        snapshot_date: string
        currency: string
        rate: number
        target: number | null
        bias: string
        bank: string
      }) => ({
        snapshot_date: h.snapshot_date,
        currency: h.currency,
        rate: h.rate,
        target: h.target,
        bias: h.bias,
        bank: h.bank,
      }))

      const { error } = await getSupabase()
        .from('cb_rate_snapshots')
        .upsert(records, { onConflict: 'snapshot_date,currency' })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        message: `Inserted/updated ${records.length} historical snapshots`,
        count: records.length,
      })
    }

    // Option 2: Snapshot current rates from central_bank_rates table
    const { data: currentRates, error: fetchError } = await getSupabase()
      .from('central_bank_rates')
      .select('currency, bank, rate, target, bias')

    if (fetchError || !currentRates?.length) {
      return NextResponse.json({
        error: fetchError?.message || 'No current rates found',
      }, { status: 500 })
    }

    // Use first of current month as snapshot date
    const now = new Date()
    const snapshotDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const records = currentRates.map(r => ({
      snapshot_date: snapshotDate,
      currency: r.currency,
      rate: r.rate,
      target: r.target,
      bias: r.bias,
      bank: r.bank,
    }))

    const { error } = await getSupabase()
      .from('cb_rate_snapshots')
      .upsert(records, { onConflict: 'snapshot_date,currency' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: `Snapshot saved for ${snapshotDate}`,
      snapshotDate,
      currencies: records.length,
      rates: records.map(r => ({ currency: r.currency, rate: r.rate, bias: r.bias })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
