'use client'

import { memo } from 'react'

interface DivergenceInfo {
  hasDivergence: boolean
  priceDirection: string
  fundamentalDirection: string
  pricePct: number
  message: string
}

interface DivergenceAlertProps {
  divergences: Record<string, DivergenceInfo>
}

function DivergenceAlert({ divergences }: DivergenceAlertProps) {
  if (!divergences) return null

  const items = Object.entries(divergences).filter(([, d]) => d.hasDivergence)

  if (items.length === 0) return null

  return (
    <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-500/[0.06] via-bg-card to-purple-500/[0.03] px-5 sm:px-6 py-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-display font-bold text-heading">Divergentie Gedetecteerd</p>
          <p className="text-[9px] text-text-dim">Prijs beweegt tegen de fundamentele richting &rarr; mean reversion kans</p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map(([ccy, div]) => (
          <div key={ccy} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            {/* Valuta + pijlen die divergentie tonen */}
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-heading text-sm">{ccy}</span>
              <div className="flex items-center gap-1">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  div.fundamentalDirection === 'bullish' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  Fund: {div.fundamentalDirection === 'bullish' ? '\u2191' : '\u2193'}
                </span>
                <span className="text-text-dim text-xs">vs</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  div.priceDirection === 'up' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  Prijs: {div.priceDirection === 'up' ? '\u2191' : '\u2193'} {Math.abs(div.pricePct).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Bericht */}
            <p className="text-[10px] text-text-muted leading-relaxed flex-1">
              {div.message}
            </p>
          </div>
        ))}
      </div>

      {/* Uitleg: hoe werkt divergentie detectie? */}
      <details className="mt-3 group">
        <summary className="flex items-center gap-1.5 text-[10px] text-purple-400/60 cursor-pointer hover:text-purple-400 transition-colors">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-open:rotate-90">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          Hoe werkt divergentie detectie?
        </summary>
        <div className="mt-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[10px] text-text-dim leading-relaxed space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-purple-400 font-bold shrink-0">1.</span>
            <p><strong className="text-text-muted">Fundamentele richting:</strong> elke valuta krijgt een score op basis van centraal bank beleid (hawkish/dovish) en de rente t.o.v. het doel. Score &gt; +1.0 = bullish, &lt; -1.0 = bearish.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-purple-400 font-bold shrink-0">2.</span>
            <p><strong className="text-text-muted">Koersrichting (5 dagen):</strong> we halen de koers op via Yahoo Finance en berekenen de procentuele verandering over de afgelopen 5 handelsdagen. Hiervoor gebruiken we alle 21 valutaparen.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-purple-400 font-bold shrink-0">3.</span>
            <p><strong className="text-text-muted">Divergentie check:</strong> als de fundamentele richting bullish is maar de prijs daalt (of andersom), is er een divergentie. De koers beweegt tegen de &quot;logische&quot; richting in.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-purple-400 font-bold shrink-0">4.</span>
            <p><strong className="text-text-muted">Mean reversion signaal:</strong> historisch keert de prijs vaak terug naar de fundamentele waarde. Een divergentie is daarom een potentieel instappunt: de markt heeft &quot;overreact&quot; en een correctie wordt waarschijnlijker.</p>
          </div>
        </div>
      </details>
    </div>
  )
}

export default memo(DivergenceAlert)
