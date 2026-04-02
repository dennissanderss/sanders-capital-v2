// ─── Cron: Daily Track Record Update ───────────────────────
// Called by Vercel Cron every weekday at 21:00 UTC (23:00 NL)
// 1. Resolves pending trades from previous days
// 2. Creates new trade focus records for today
// ────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Verify this is a Vercel cron call (or local dev)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Call the trackrecord-v2 POST endpoint internally
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const res = await fetch(`${baseUrl}/api/trackrecord-v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
