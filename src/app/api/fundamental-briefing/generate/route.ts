import { NextResponse } from 'next/server'
import { generateBriefing } from '@/lib/fundamental/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// AUDIT-FIX (jul 2026): endpoint was publiek — iedereen kon generatie
// triggeren. Nu zelfde Bearer-auth als de cron. (De data-route genereert
// intern nog steeds lui; dit raakt alleen directe externe aanroepen.)
async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const raw = new URL(request.url).searchParams.get('type')
  const type = raw === 'weekly' ? 'weekly' : raw === 'position' ? 'position' : 'daily'
  try {
    const r = await generateBriefing(type)
    return NextResponse.json({ ok: true, type, ...r })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

export const POST = handle
export const GET = handle
