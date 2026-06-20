// ─────────────────────────────────────────────────────────────
// FX ticker feed
//
// Bundles the latest price + daily % change for a set of FX pairs
// (from Yahoo Finance) into one cached response, so the homepage
// ticker can render a live marquee with a single request.
// Read-only. No Supabase.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'

const PAIRS: [string, string][] = [
  ['EUR/USD', 'EURUSD=X'], ['GBP/USD', 'GBPUSD=X'], ['USD/JPY', 'USDJPY=X'],
  ['AUD/USD', 'AUDUSD=X'], ['USD/CAD', 'USDCAD=X'], ['USD/CHF', 'USDCHF=X'],
  ['NZD/USD', 'NZDUSD=X'], ['EUR/GBP', 'EURGBP=X'], ['EUR/JPY', 'EURJPY=X'],
  ['GBP/JPY', 'GBPJPY=X'], ['AUD/JPY', 'AUDJPY=X'], ['EUR/AUD', 'EURAUD=X'],
  ['GBP/CHF', 'GBPCHF=X'], ['AUD/NZD', 'AUDNZD=X'], ['EUR/CAD', 'EURCAD=X'],
  ['CAD/JPY', 'CADJPY=X'],
]

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchPair(symbol: string): Promise<{ price: number; changePct: number } | null> {
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const r = await fetch(
        `https://${host}/v8/finance/chart/${symbol}?interval=1d&range=5d`,
        { headers: { 'User-Agent': UA, Accept: 'application/json' }, next: { revalidate: 300 } },
      )
      if (!r.ok) continue
      const j = await r.json()
      const result = j?.chart?.result?.[0]
      const meta = result?.meta
      const closes: number[] = (result?.indicators?.quote?.[0]?.close || []).filter(
        (c: number | null): c is number => c != null,
      )
      const price: number | undefined = meta?.regularMarketPrice ?? closes.at(-1)
      const prevClose: number | undefined = meta?.chartPreviousClose ?? closes.at(-2)
      if (typeof price !== 'number' || typeof prevClose !== 'number' || prevClose === 0) return null
      return { price, changePct: ((price - prevClose) / prevClose) * 100 }
    } catch {
      continue
    }
  }
  return null
}

export async function GET() {
  const entries = await Promise.all(
    PAIRS.map(async ([pair, symbol]) => {
      const d = await fetchPair(symbol)
      return d ? { pair, price: d.price, changePct: d.changePct } : null
    }),
  )
  const items = entries.filter(Boolean)
  const res = NextResponse.json({ items })
  res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  return res
}
