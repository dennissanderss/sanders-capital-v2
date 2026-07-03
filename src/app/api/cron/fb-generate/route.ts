import { NextResponse } from 'next/server'
import { generateBriefing } from '@/lib/fundamental/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Genereert elke werkdagochtend de gelockte daily-calls (day/swing-lens) en
// de position-calls (carry-lens). Weekly is legacy en wordt niet meer gemaakt.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const daily = await generateBriefing('daily')
    const position = await generateBriefing('position')
    return NextResponse.json({ ok: true, daily, position })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
