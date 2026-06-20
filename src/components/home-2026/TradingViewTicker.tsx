'use client'

import { useMemo } from 'react'

// Official TradingView "Ticker Tape" embed — live FX prices, maintained by TV.
// Rendered inside an <iframe srcDoc> so the embed script runs in its own
// document: this avoids the parent CookieYes auto-blocker swallowing the
// third-party script, and lets TradingView's loader find its own config
// (a dynamically injected <script> often can't).
const CONFIG = {
  symbols: [
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
  ],
  showSymbolLogo: true,
  isTransparent: true,
  displayMode: 'adaptive',
  colorTheme: 'light',
  locale: 'nl',
}

export default function TradingViewTicker() {
  const srcDoc = useMemo(
    () =>
      `<!DOCTYPE html><html><head><meta charset="utf-8" />` +
      `<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}` +
      `.tradingview-widget-copyright{display:none!important}</style></head><body>` +
      `<div class="tradingview-widget-container">` +
      `<div class="tradingview-widget-container__widget"></div>` +
      `<script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js" async>` +
      JSON.stringify(CONFIG) +
      `<\/script></div></body></html>`,
    [],
  )

  return (
    <div className="tv-ticker-band">
      <iframe
        title="Live valutakoersen"
        srcDoc={srcDoc}
        loading="lazy"
        scrolling="no"
        style={{ width: '100%', height: 48, border: 0, display: 'block' }}
      />
    </div>
  )
}
