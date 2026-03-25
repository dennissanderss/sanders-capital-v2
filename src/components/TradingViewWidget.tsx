'use client'

import { useEffect, useRef } from 'react'

interface TradingViewWidgetProps {
  type: 'ticker-tape' | 'cross-rates' | 'forex-heatmap'
  className?: string
}

export default function TradingViewWidget({ type, className = '' }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    container.innerHTML = ''

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    container.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true

    if (type === 'ticker-tape') {
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js'
      script.textContent = JSON.stringify({
        symbols: [
          { proName: 'FX:EURUSD', title: 'EUR/USD' },
          { proName: 'FX:GBPUSD', title: 'GBP/USD' },
          { proName: 'FX:USDJPY', title: 'USD/JPY' },
          { proName: 'FX:USDCHF', title: 'USD/CHF' },
          { proName: 'FX:AUDUSD', title: 'AUD/USD' },
          { proName: 'TVC:GOLD', title: 'XAU/USD' },
        ],
        showSymbolLogo: true,
        isTransparent: true,
        displayMode: 'adaptive',
        colorTheme: 'dark',
        locale: 'nl_NL',
      })
    } else if (type === 'cross-rates') {
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-forex-cross-rates.js'
      script.textContent = JSON.stringify({
        width: '100%',
        height: 400,
        currencies: ['EUR', 'USD', 'JPY', 'GBP', 'CHF', 'AUD', 'CAD', 'NZD'],
        isTransparent: true,
        colorTheme: 'dark',
        locale: 'nl_NL',
      })
    } else if (type === 'forex-heatmap') {
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-forex-heat-map.js'
      script.textContent = JSON.stringify({
        width: '100%',
        height: 400,
        currencies: ['EUR', 'USD', 'JPY', 'GBP', 'CHF', 'AUD', 'CAD', 'NZD'],
        isTransparent: true,
        colorTheme: 'dark',
        locale: 'nl_NL',
      })
    }

    container.appendChild(script)

    return () => {
      container.innerHTML = ''
    }
  }, [type])

  return (
    <div
      ref={containerRef}
      className={`tradingview-widget-container ${className}`}
    />
  )
}
