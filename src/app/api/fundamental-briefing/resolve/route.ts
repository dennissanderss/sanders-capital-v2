import { NextResponse } from 'next/server'
import { resolveOutcomes } from '@/lib/fundamental/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// AUDIT-FIX (jul 2026): dit endpoint was publiek. Een weekend-aanroep kon
// horizons afrekenen op Yahoo's tijdelijke weekend-quote-bar (afwijkende
// close) en dat permanent wegschrijven. Nu: zelfde Bearer-auth als de cron,
// en in het weekend wordt er sowieso niet geresolvet (markt dicht; de
// doordeweekse cron rekent alles alsnog af — uitkomsten veranderen daar
// niet door, alleen het moment van afrekenen).
async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dow = new Date().getUTCDay()
  if (dow === 0 || dow === 6) {
    return NextResponse.json({ ok: true, resolved: 0, skipped: 'weekend' })
  }
  try {
    const r = await resolveOutcomes()
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

export const POST = handle
export const GET = handle
