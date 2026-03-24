'use client'

import { useEffect } from 'react'

export default function SentimentPage() {
  useEffect(() => {
    // Load Myfxbook widget script
    const container = document.getElementById('myfxbook-widget')
    if (!container) return

    const script = document.createElement('script')
    script.src = 'https://widgets.myfxbook.com/scripts/fxOutlook.js?type=1&symbols=,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,18,19,20,21,22,23,24,25,26,27,28,29,31,34,36,37,38,40,41,42,43,45,46,47,48,49,50,51,103,107,131,137,1233,1234,1236,1245,1246,1247,1815,1863,1893,2012,2076,2090,2114,2115,2119,2521,2603,2872,3005,3240,3473,5079,5435,5779'
    script.className = 'powered'
    script.onload = () => {
      try {
        // @ts-expect-error - Myfxbook global function
        if (typeof showOutlookWidget === 'function') showOutlookWidget()
      } catch {}
    }
    container.appendChild(script)

    return () => {
      if (container) container.innerHTML = ''
    }
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-display font-semibold text-heading mb-4">
          Forex Sentiment
        </h1>
        <p className="text-text-muted max-w-lg mx-auto mb-5">
          Bekijk hoe retail traders gepositioneerd zijn per valutapaar.
          Sentiment data kan helpen bij het begrijpen van marktdynamiek.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-card border border-border">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-text-dim">Live data via Myfxbook</span>
        </div>
      </div>

      {/* How to read sentiment */}
      <div className="mb-10 p-6 rounded-xl bg-bg-card border border-border">
        <h2 className="text-lg font-display font-semibold text-heading mb-3">Hoe lees je sentiment data?</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-text">
          <div className="p-3 rounded-lg bg-bg border border-border">
            <p className="font-semibold text-green-400 mb-1">% Long (kopers)</p>
            <p className="text-text-muted text-xs">Percentage retail traders dat een kooppositie heeft in dit paar.</p>
          </div>
          <div className="p-3 rounded-lg bg-bg border border-border">
            <p className="font-semibold text-red-400 mb-1">% Short (verkopers)</p>
            <p className="text-text-muted text-xs">Percentage retail traders dat een verkooppositie heeft in dit paar.</p>
          </div>
        </div>
        <p className="text-xs text-text-dim mt-3">
          Contrarian strategie: retail traders zitten vaak aan de verkeerde kant. Als de meerderheid long zit,
          kan dat een bearish signaal zijn — en andersom. Gebruik dit altijd in combinatie met andere analyse.
        </p>
      </div>

      {/* Myfxbook Widget */}
      <div className="rounded-xl bg-bg-card border border-border overflow-hidden p-6">
        <div id="myfxbook-widget" />
        <div className="text-center mt-4">
          <a
            href="https://www.myfxbook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-text-dim hover:text-text-muted transition-colors"
          >
            Powered by Myfxbook.com
          </a>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-xl bg-bg-card border border-border">
        <p className="text-xs text-text-dim text-center">
          Disclaimer: Sentiment data toont posities van retail traders en is geen voorspelling van marktrichting.
          Gebruik dit als aanvullende informatie, niet als basis voor handelsbeslissingen. Dit is geen financieel advies.
        </p>
      </div>
    </div>
  )
}
