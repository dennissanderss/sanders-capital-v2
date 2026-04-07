// ─── Cron: Daily Track Record Update ───────────────────────
// Resolves pending trades & generates new signals
// Called by Vercel Cron + external cron via trigger-all
// ────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Use SITE_URL with redirect: 'follow' to handle www redirects
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const res = await fetch(`${baseUrl}/api/trackrecord-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      redirect: 'follow',
    })

    // Guard against HTML responses (redirect)
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('json')) {
      return NextResponse.json({
        success: false,
        error: `Got ${contentType} instead of JSON (status ${res.status}). Possible redirect.`,
        url: `${baseUrl}/api/trackrecord-v2`,
        timestamp: new Date().toISOString(),
      }, { status: 500 })
    }

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
