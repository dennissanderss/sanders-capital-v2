import { NextResponse } from 'next/server'
import { resolveOutcomes } from '@/lib/fundamental/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle() {
  try {
    const r = await resolveOutcomes()
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

export const POST = handle
export const GET = handle
