// ─────────────────────────────────────────────────────────────
// Yahoo Finance chart proxy
//
// Thin pass-through so the FX Desk PriceChart can fetch OHLC
// without hitting CORS issues directly from the browser.
//
// Read-only. No scoring, no Supabase, no caching beyond what
// Next.js applies via revalidate. Just forwards the request.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'

const ALLOWED_SYMBOLS = new Set([
  'EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'AUDUSD=X', 'NZDUSD=X',
  'USDCAD=X', 'USDCHF=X', 'EURGBP=X', 'EURJPY=X', 'GBPJPY=X',
  'AUDJPY=X', 'NZDJPY=X', 'CADJPY=X', 'EURAUD=X', 'GBPAUD=X',
  'AUDNZD=X', 'EURCHF=X', 'GBPCHF=X', 'EURCAD=X', 'GBPNZD=X',
  'AUDCAD=X',
])

const ALLOWED_RANGES = new Set(['1d', '5d', '1mo', '3mo', '6mo', '1y'])

export async function GET(request: Request) {
  const url = new URL(request.url)
  const symbol = url.searchParams.get('symbol')
  const period1 = url.searchParams.get('period1')
  const period2 = url.searchParams.get('period2')
  const range = url.searchParams.get('range')
  const interval = url.searchParams.get('interval') || '1d'

  if (!symbol || !ALLOWED_SYMBOLS.has(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }
  if (!['1d', '1h', '60m'].includes(interval)) {
    return NextResponse.json({ error: 'Invalid interval' }, { status: 400 })
  }

  // Accept EITHER period1/period2 (epoch seconds) OR range=5d/1mo/...
  let queryString: string
  if (range) {
    if (!ALLOWED_RANGES.has(range)) {
      return NextResponse.json({ error: 'Invalid range' }, { status: 400 })
    }
    queryString = `interval=${interval}&range=${range}`
  } else if (period1 && period2) {
    if (!/^\d+$/.test(period1) || !/^\d+$/.test(period2)) {
      return NextResponse.json({ error: 'period1/period2 must be epoch seconds' }, { status: 400 })
    }
    queryString = `period1=${period1}&period2=${period2}&interval=${interval}`
  } else {
    return NextResponse.json({ error: 'Provide range OR period1+period2' }, { status: 400 })
  }

  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const upstream = await fetch(
        `https://${host}/v8/finance/chart/${symbol}?${queryString}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
          next: { revalidate: 300 },
        },
      )
      if (!upstream.ok) continue
      const json = await upstream.json()
      const res = NextResponse.json(json)
      res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
      return res
    } catch {
      continue
    }
  }

  return NextResponse.json({ error: 'Yahoo Finance unavailable' }, { status: 502 })
}
