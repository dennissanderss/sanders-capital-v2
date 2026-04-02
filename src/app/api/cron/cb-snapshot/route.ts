// ─── Cron: Monthly CB Rate Snapshot ──────────────────────────
// Called by Vercel Cron on the 1st of every month at 06:00 UTC
// Saves a snapshot of current central bank rates to
// cb_rate_snapshots table for historical backfill accuracy.
// ────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const res = await fetch(`${baseUrl}/api/cb-snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // Empty = snapshot current rates
    })

    const data = await res.json()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...data,
    })
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: String(e),
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
