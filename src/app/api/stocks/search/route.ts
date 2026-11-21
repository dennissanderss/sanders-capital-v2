import { NextResponse } from 'next/server'
import { zoek } from '@/lib/stocks/yahoo'
import { vereisToolToegang } from '@/lib/tool-toegang'

export const dynamic = 'force-dynamic'

// Ticker zoeken op naam of symbool (alleen aandelen). Zelfde toegang als de analyse.
export async function GET(request: Request) {
  const geweigerd = await vereisToolToegang('aandelen', true)
  if (geweigerd) return geweigerd

  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 40)
  if (q.length < 1) return NextResponse.json({ resultaten: [] })
  const { resultaten, ok } = await zoek(q)
  return NextResponse.json(
    { resultaten: resultaten.slice(0, 8), ok },
    // Per gebruiker in de browser bewaren mag; een mislukte zoekopdracht niet.
    { headers: { 'Cache-Control': ok ? 'private, max-age=600' : 'private, no-store' } },
  )
}
