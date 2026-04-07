// ─── Cron: Daily Track Record Update ───────────────────────
// Resolves pending trades & generates new signals
// Re-exports the trackrecord-v2 POST logic directly
// ────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'

// Import the POST handler directly to avoid self-fetch issues on Vercel
import { POST as trackrecordPost } from '@/app/api/trackrecord-v2/route'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Call the trackrecord-v2 POST handler directly (no HTTP needed)
    const fakeRequest = new Request('http://localhost/api/trackrecord-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await trackrecordPost(fakeRequest)
    const data = await response.json()

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
