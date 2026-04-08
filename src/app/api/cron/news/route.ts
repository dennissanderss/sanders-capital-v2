// ─── Nieuws Cron — Dagelijks RSS feeds ophalen ───────────────
// Voorkomt dat de nieuws database veroudert als niemand de pagina bezoekt.
// Roept dezelfde /api/news endpoint aan om feeds op te halen.

import { NextResponse } from 'next/server'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}` || request.headers.get('x-vercel-cron')

  if (!isCron && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Trigger de nieuws fetch door de /api/news endpoint aan te roepen
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sanderscapital.nl'
    const res = await fetch(`${baseUrl}/api/news?days=3&refresh=true`, {
      signal: AbortSignal.timeout(55000), // Vercel cron timeout = 60s
    })
    const data = await res.json()

    return NextResponse.json({
      triggered: true,
      articles: data.articles?.length ?? 0,
      fetchedAt: data.fetchedAt,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
