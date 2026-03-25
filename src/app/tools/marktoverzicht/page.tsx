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
        <div className="p-5 rounded-xl bg-bg-card border border-border mb-4">
          <p className="text-sm text-text leading-relaxed mb-3">
            De cross rates tabel toont de wisselkoersen tussen alle major valutaparen in één overzicht.
            Elke cel toont hoeveel van de <span className="text-heading font-medium">horizontale valuta</span> je
            krijgt voor één eenheid van de <span className="text-heading font-medium">verticale valuta</span>.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-text-dim">
            <span><span className="text-green-400">Groen</span> = gestegen ten opzichte van vorige sluiting</span>
            <span><span className="text-red-400">Rood</span> = gedaald ten opzichte van vorige sluiting</span>
          </div>
        </div>
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
        <div className="p-5 rounded-xl bg-bg-card border border-border mb-4">
          <p className="text-sm text-text leading-relaxed mb-3">
            De heatmap geeft een visueel overzicht van de relatieve sterkte van elke valuta.
            Hoe <span className="text-green-400 font-medium">groener</span> een vak, hoe sterker die valuta presteert
            ten opzichte van de rest. Hoe <span className="text-red-400 font-medium">roder</span>, hoe zwakker.
          </p>
          <p className="text-sm text-text leading-relaxed mb-3">
            Dit helpt je snel te identificeren welke valuta&apos;s kracht tonen en welke zwakte &mdash;
            handig om te bepalen welke paren het meest potentieel hebben voor een trade setup.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-text-dim">
            <span><span className="text-green-400">Donkergroen</span> = zeer sterk</span>
            <span><span className="text-green-400/60">Lichtgroen</span> = licht sterk</span>
            <span className="text-text-dim">Grijs = neutraal</span>
            <span><span className="text-red-400/60">Lichtrood</span> = licht zwak</span>
            <span><span className="text-red-400">Donkerrood</span> = zeer zwak</span>
          </div>
        </div>
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
