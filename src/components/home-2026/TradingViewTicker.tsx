'use client'

import { useEffect, useRef } from 'react'

// Official TradingView "Ticker Tape" embed — live FX prices, maintained by TV.
const SYMBOLS = [
  { description: 'EUR/USD', proxy: 'FX:EURUSD' },
  { description: 'GBP/USD', proxy: 'FX:GBPUSD' },
  { description: 'USD/JPY', proxy: 'FX:USDJPY' },
  { description: 'AUD/USD', proxy: 'FX:AUDUSD' },
  { description: 'USD/CAD', proxy: 'FX:USDCAD' },
  { description: 'USD/CHF', proxy: 'FX:USDCHF' },
  { description: 'NZD/USD', proxy: 'FX:NZDUSD' },
  { description: 'EUR/GBP', proxy: 'FX:EURGBP' },
  { description: 'EUR/JPY', proxy: 'FX:EURJPY' },
  { description: 'GBP/JPY', proxy: 'FX:GBPJPY' },
  { description: 'Goud', proxy: 'OANDA:XAUUSD' },
]

export default function TradingViewTicker() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const widget = document.createElement('div')
    widget.className = 'tradingview-widget-container__widget'
    el.appendChild(widget)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbols: SYMBOLS,
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: 'adaptive',
      colorTheme: 'light',
      locale: 'nl',
    })
    el.appendChild(script)

    return () => {
      el.innerHTML = ''
    }
  }, [])

  return (
    <div className="tv-ticker-band">
      <div className="tradingview-widget-container" ref={ref} />
    </div>
  )
}
