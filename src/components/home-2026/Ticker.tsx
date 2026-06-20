'use client'

import { useEffect, useState } from 'react'

interface TickerItem {
  pair: string
  price: number | null
  changePct: number | null
}

// Pairs shown before the live feed loads (and as a stable fallback if it fails).
// Prices/changes stay null until the live /api/fx-ticker response fills them in,
// so we never show fabricated numbers.
const SEED: TickerItem[] = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'USD/CHF',
  'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'EUR/AUD',
  'GBP/CHF', 'AUD/NZD', 'EUR/CAD', 'CAD/JPY',
].map((pair) => ({ pair, price: null, changePct: null }))

function fmtPrice(pair: string, price: number): string {
  return pair.includes('JPY') ? price.toFixed(2) : price.toFixed(4)
}

export default function Ticker() {
  const [items, setItems] = useState<TickerItem[]>(SEED)

  useEffect(() => {
    let cancelled = false
    fetch('/api/fx-ticker')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && Array.isArray(j?.items) && j.items.length) setItems(j.items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Duplicate the list so the marquee can loop seamlessly (translateX -50%).
  const track = [...items, ...items]

  return (
    <div className="ticker" aria-label="Live valutakoersen" role="marquee">
      <div className="ticker-track">
        {track.map((it, i) => {
          const up = (it.changePct ?? 0) >= 0
          return (
            <span className="ticker-item" key={i}>
              <span className="p">{it.pair}</span>
              {it.price != null && <span className="pr">{fmtPrice(it.pair, it.price)}</span>}
              {it.changePct != null && (
                <span className={`chg ${up ? 'up' : 'down'}`}>
                  {up ? '▲' : '▼'} {Math.abs(it.changePct).toFixed(2)}%
                </span>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}
