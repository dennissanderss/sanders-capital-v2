'use client'

import dynamic from 'next/dynamic'

const TradingViewWidget = dynamic(() => import('@/components/TradingViewWidget'), { ssr: false })

export default function MarktoverzichtPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-display font-semibold text-heading mb-4">
          Marktoverzicht
        </h1>
        <p className="text-text-muted max-w-2xl mx-auto">
          Realtime forex koersen, cross rates en heatmap. Bekijk in één oogopslag
          hoe de belangrijkste valutaparen presteren.
        </p>
      </div>

      {/* Cross Rates */}
      <section className="mb-12">
        <h2 className="text-xl font-display font-semibold text-heading mb-4 flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
          Forex Cross Rates
        </h2>
        <p className="text-sm text-text-dim mb-4">
          Vergelijk alle major valutaparen in één overzichtelijke tabel.
        </p>
        <div className="rounded-xl border border-border overflow-hidden bg-bg-card">
          <TradingViewWidget type="cross-rates" />
        </div>
      </section>

      {/* Heatmap */}
      <section className="mb-12">
        <h2 className="text-xl font-display font-semibold text-heading mb-4 flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          Forex Heatmap
        </h2>
        <p className="text-sm text-text-dim mb-4">
          Visueel overzicht van de sterkste en zwakste valuta&apos;s op dit moment.
        </p>
        <div className="rounded-xl border border-border overflow-hidden bg-bg-card">
          <TradingViewWidget type="forex-heatmap" />
        </div>
      </section>

      <div className="text-center text-xs text-text-dim mt-8">
        <p>Data wordt aangeleverd door TradingView. Dit is geen financieel advies.</p>
      </div>
    </div>
  )
}
