import { NextResponse } from 'next/server'
import { analyseerAandeel } from '@/lib/stocks/service'
import { vereisToolToegang } from '@/lib/tool-toegang'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const geenCache = { 'Cache-Control': 'private, no-store' }

// Volledige analyse van één aandeel. Alleen voor ingelogde leden met toegang
// tot de tool: elke aanvraag kost calls naar Yahoo en Groq. Daarom ook geen
// publieke CDN-cache; de service houdt zelf een korte cache per aandeel bij.
export async function GET(request: Request) {
  const geweigerd = await vereisToolToegang('aandelen', true)
  if (geweigerd) return geweigerd

  const symbol = (new URL(request.url).searchParams.get('symbol') || '').trim().toUpperCase()
  if (!/^[A-Z0-9.\-]{1,15}$/.test(symbol)) {
    return NextResponse.json(
      { error: 'Dat is geen geldige ticker. Indices, valuta en futures worden niet ondersteund; zoek op bedrijfsnaam en kies een resultaat.' },
      { status: 400, headers: geenCache },
    )
  }
  try {
    const data = await analyseerAandeel(symbol)
    if (!data) {
      return NextResponse.json({ error: `Geen koersdata gevonden voor ${symbol}.` }, { status: 404, headers: geenCache })
    }
    return NextResponse.json(data, { headers: geenCache })
  } catch (e) {
    console.error('[stocks/analyze]', symbol, e)
    return NextResponse.json(
      { error: 'De analyse is mislukt door een storing bij de databron. Probeer het over een minuut opnieuw.' },
      { status: 502, headers: geenCache },
    )
  }
}
