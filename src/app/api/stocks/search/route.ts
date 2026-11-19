import { NextResponse } from 'next/server'
import { zoek } from '@/lib/stocks/yahoo'

export const dynamic = 'force-dynamic'

// Ticker zoeken op naam of symbool (alleen aandelen).
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 40)
  if (q.length < 1) return NextResponse.json({ resultaten: [] })
  const { resultaten } = await zoek(q)
  return NextResponse.json(
    { resultaten: resultaten.slice(0, 8) },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
  )
}
