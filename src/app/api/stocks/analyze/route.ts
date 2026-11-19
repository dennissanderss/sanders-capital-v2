import { NextResponse } from 'next/server'
import { analyseerAandeel } from '@/lib/stocks/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Volledige analyse van één aandeel. Alleen-lezen: geen Supabase, geen
// opslag. Een kwartier gecachet op de CDN zodat herhaald opvragen van
// hetzelfde aandeel Yahoo en Groq niet opnieuw belast.
export async function GET(request: Request) {
  const symbol = (new URL(request.url).searchParams.get('symbol') || '').trim().toUpperCase()
  if (!/^[A-Z0-9.\-]{1,15}$/.test(symbol)) {
    return NextResponse.json({ error: 'Ongeldige ticker' }, { status: 400 })
  }
  try {
    const data = await analyseerAandeel(symbol)
    if (!data) {
      return NextResponse.json({ error: `Geen koersdata gevonden voor ${symbol}` }, { status: 404 })
    }
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    })
  } catch (e) {
    return NextResponse.json({ error: `Analyse mislukt: ${String(e)}` }, { status: 502 })
  }
}
