// Live FX ticker — the official TradingView "Ticker Tape" widget, hosted on a
// same-origin route (/widgets/ticker) and embedded via an <iframe src>. This
// gives TradingView a valid referrer to render against and keeps the parent
// page's CookieYes auto-blocker from swallowing the third-party script.
export default function TradingViewTicker() {
  return (
    <div className="tv-ticker-band">
      <iframe
        title="Live valutakoersen"
        src="/widgets/ticker"
        loading="lazy"
        scrolling="no"
        style={{ width: '100%', height: 48, border: 0, display: 'block' }}
      />
    </div>
  )
}
