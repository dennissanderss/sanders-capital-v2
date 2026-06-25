import { NextResponse } from 'next/server'
import { resolveOutcomes } from '@/lib/fundamental/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Rekent elke dag de horizons af die volledig verstreken zijn (no-leakage).
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const r = await resolveOutcomes()
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
