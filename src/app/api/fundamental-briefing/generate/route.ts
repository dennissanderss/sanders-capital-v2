import { NextResponse } from 'next/server'
import { generateBriefing } from '@/lib/fundamental/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(request: Request) {
  const type = new URL(request.url).searchParams.get('type') === 'weekly' ? 'weekly' : 'daily'
  try {
    const r = await generateBriefing(type)
    return NextResponse.json({ ok: true, type, ...r })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

export const POST = handle
export const GET = handle
