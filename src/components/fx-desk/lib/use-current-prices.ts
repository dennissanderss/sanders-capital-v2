'use client'

import { useEffect, useState } from 'react'

const YAHOO_SYMBOLS: Record<string, string> = {
  'EUR/USD': 'EURUSD=X', 'GBP/USD': 'GBPUSD=X', 'USD/JPY': 'USDJPY=X',
  'AUD/USD': 'AUDUSD=X', 'NZD/USD': 'NZDUSD=X', 'USD/CAD': 'USDCAD=X',
  'USD/CHF': 'USDCHF=X', 'EUR/GBP': 'EURGBP=X', 'EUR/JPY': 'EURJPY=X',
  'GBP/JPY': 'GBPJPY=X', 'AUD/JPY': 'AUDJPY=X', 'NZD/JPY': 'NZDJPY=X',
  'CAD/JPY': 'CADJPY=X', 'EUR/AUD': 'EURAUD=X', 'GBP/AUD': 'GBPAUD=X',
  'AUD/NZD': 'AUDNZD=X', 'EUR/CHF': 'EURCHF=X', 'GBP/CHF': 'GBPCHF=X',
  'EUR/CAD': 'EURCAD=X', 'GBP/NZD': 'GBPNZD=X', 'AUD/CAD': 'AUDCAD=X',
}

// Fetch the latest close for a set of FX pairs from Yahoo Finance.
// Returns Record<pair, lastClose>. Failures silently skipped.
export function useCurrentPrices(pairs: string[]): { prices: Record<string, number>; loading: boolean } {
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  // stable key so the effect doesn't re-run for [a,b] vs [b,a]
  const key = pairs.slice().sort().join('|')

  useEffect(() => {
    if (pairs.length === 0) return
    let cancelled = false
    setLoading(true)

    Promise.all(
      pairs.map(async (pair) => {
        const symbol = YAHOO_SYMBOLS[pair]
        if (!symbol) return null
        try {
          const r = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
            { headers: { Accept: 'application/json' } },
          )
          if (!r.ok) return null
          const json = await r.json()
          const result = json?.chart?.result?.[0]
          const meta = result?.meta
          const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close || []
          const last = meta?.regularMarketPrice ?? closes.filter((c): c is number => c != null).at(-1)
          if (typeof last !== 'number') return null
          return [pair, last] as const
        } catch {
          return null
        }
      }),
    ).then((entries) => {
      if (cancelled) return
      const out: Record<string, number> = {}
      for (const e of entries) if (e) out[e[0]] = e[1]
      setPrices(out)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { prices, loading }
}
