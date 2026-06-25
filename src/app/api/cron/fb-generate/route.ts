import { NextResponse } from 'next/server'
import { generateBriefing } from '@/lib/fundamental/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Genereert de gelockte daily-call elke werkdagochtend, en de weekly op maandag.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const daily = await generateBriefing('daily')
    const isMonday = new Date().getUTCDay() === 1
    const weekly = isMonday ? await generateBriefing('weekly') : { skipped: true, created: 0, date: daily.date }
    return NextResponse.json({ ok: true, daily, weekly })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
