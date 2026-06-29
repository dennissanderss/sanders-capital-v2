'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FbCall } from '@/lib/fundamental/types'
import { HORIZONS } from '@/lib/fundamental/constants'
import { CallDetail } from './CallDetail'
import { dirLabel, fmtDate, zekerheidTier } from './helpers'

export function BriefingTab({ calls, kind, emptyText, hoofdhorizon }: { calls: FbCall[]; kind: 'daily' | 'weekly'; emptyText: string; hoofdhorizon: number }) {
  // Sterkste zekerheid bovenaan.
  const sorted = useMemo(() => [...calls].sort((a, b) => b.conviction - a.conviction), [calls])
  const [selId, setSelId] = useState<string | null>(sorted[0]?.id ?? null)

  useEffect(() => {
    if (!selId || !sorted.find((c) => c.id === selId)) setSelId(sorted[0]?.id ?? null)
  }, [sorted, selId])

  const intro = (
    <p className="fb-calls-intro">
      Een <b>call</b> = een paar met een duidelijke fundamentele richting. Het getal rechts is de <b>zekerheid</b> (0–10):
      hoe sterk die richting is. <b>Sterkste bovenaan.</b> Een lage zekerheid (bv. 3.3) is een <b>zwakke</b> call —
      de richting is duidelijk, maar momentum, markt en regime bevestigen 'm nauwelijks.
    </p>
  )

  if (sorted.length === 0) {
    return <div>{intro}<div className="fb-empty">{emptyText}</div></div>
  }
  const sel = sorted.find((c) => c.id === selId) || sorted[0]

  return (
    <div>
      {intro}
      <div className="fb-legend">
        <span className="it"><span className="fb-hdot win" /> goed</span>
        <span className="it"><span className="fb-hdot loss" /> fout</span>
        <span className="it"><span className="fb-hdot" /> nog wachten</span>
        <span className="it">5 bolletjes = 1 / 3 / 5 / 10 / 20 dagen</span>
      </div>
      <div className="fb-layout">
        <div className="fb-list">
          {sorted.map((c) => {
            const long = c.direction === 'bullish'
            const tier = zekerheidTier(c.conviction)
            return (
              <div key={c.id} className={`fb-row${c.id === sel.id ? ' sel' : ''}`} onClick={() => setSelId(c.id)}>
                <span className={`fb-chip ${long ? 'long' : 'short'}`}>{dirLabel(c.direction)}</span>
                <div>
                  <div className="fb-row-pair">{c.pair}</div>
                  <div className="fb-row-meta">
                    <span className="fb-dots">
                      {HORIZONS.map((h) => {
                        const o = c.outcomes.find((x) => x.horizon === h)
                        const cls = !o || !o.resolved || o.correct == null ? '' : o.correct ? ' win' : ' loss'
                        return <span key={h} className={`fb-hdot${cls}`} title={`${h} dagen`} />
                      })}
                    </span>
                    {' '}· instap {fmtDate(c.entryDate)}
                  </div>
                </div>
                <div className="fb-row-conv-cell">
                  <span className="fb-row-conv num" title="zekerheid (0-10)">{c.conviction.toFixed(1)}</span>
                  <span className={`fb-ztag ${tier.cls}`}>{tier.label}</span>
                </div>
              </div>
            )
          })}
        </div>
        <CallDetail call={sel} hoofdhorizon={hoofdhorizon} />
      </div>
    </div>
  )
}
