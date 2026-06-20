// Standalone HTML document that hosts the TradingView "Ticker Tape" embed.
// Served same-origin so TradingView gets a valid referrer (its widgets refuse
// to render inside about:srcdoc), and embedded via <iframe src> on the home so
// the parent-page CookieYes auto-blocker never touches the third-party script.
// NOTE: the symbol field is `proName` (not `proxy`).

const CONFIG = {
  symbols: [
    { description: 'EUR/USD', proName: 'FX:EURUSD' },
    { description: 'GBP/USD', proName: 'FX:GBPUSD' },
    { description: 'USD/JPY', proName: 'FX:USDJPY' },
    { description: 'AUD/USD', proName: 'FX:AUDUSD' },
    { description: 'USD/CAD', proName: 'FX:USDCAD' },
    { description: 'USD/CHF', proName: 'FX:USDCHF' },
    { description: 'NZD/USD', proName: 'FX:NZDUSD' },
    { description: 'EUR/GBP', proName: 'FX:EURGBP' },
    { description: 'EUR/JPY', proName: 'FX:EURJPY' },
    { description: 'GBP/JPY', proName: 'FX:GBPJPY' },
    { description: 'Goud', proName: 'OANDA:XAUUSD' },
  ],
  showSymbolLogo: true,
  isTransparent: true,
  displayMode: 'adaptive',
  colorTheme: 'light',
  locale: 'nl',
}

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden;}
  .tradingview-widget-copyright{display:none!important;}
</style>
</head>
<body>
<div class="tradingview-widget-container">
  <div class="tradingview-widget-container__widget"></div>
  <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js" async>
${JSON.stringify(CONFIG)}
  </script>
</div>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
