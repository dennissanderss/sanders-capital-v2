import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Economische Kalender - Sanders Capital',
  description: 'Bekijk aankomende economische events, nieuwsberichten en data releases die de financiële markten beïnvloeden.',
}

export default function KalenderPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-display font-semibold text-heading mb-4">
          Economische Kalender
        </h1>
        <p className="text-text-muted max-w-lg mx-auto">
          Overzicht van aankomende economische events en data releases die de markten beïnvloeden.
        </p>
      </div>

      <div className="rounded-xl bg-bg-card border border-border overflow-hidden">
        <iframe
          src="https://www.tradingeconics.com/calendar/widget?lang=nl"
          width="100%"
          height="600"
          className="hidden"
        />
        {/* TradingView Economic Calendar Widget */}
        <div className="tradingview-widget-container">
          <iframe
            src="https://s.tradingview.com/embed-widget/events/?locale=en#%7B%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Atrue%2C%22width%22%3A%22100%25%22%2C%22height%22%3A600%2C%22importanceFilter%22%3A%22-1%2C0%2C1%22%2C%22countryFilter%22%3A%22us%2Cgb%2Ceu%2Cjp%2Cau%2Cca%2Cch%2Cnz%22%7D"
            width="100%"
            height="600"
            style={{ border: 'none' }}
            title="Economische Kalender"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-xs text-text-muted">Hoge impact</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-xs text-text-muted">Medium impact</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span className="text-xs text-text-muted">Lage impact</span>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-xl bg-bg-card border border-border">
        <p className="text-xs text-text-dim text-center">
          Data wordt geleverd door TradingView. Tijden worden automatisch aangepast aan je lokale tijdzone.
          Dit is geen financieel advies.
        </p>
      </div>
    </div>
  )
}
