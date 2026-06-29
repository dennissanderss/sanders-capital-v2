'use client'

import { useEffect, useState } from 'react'
import type { FbCall } from '@/lib/fundamental/types'
import { HORIZONS } from '@/lib/fundamental/constants'
import { CallDetail } from './CallDetail'
import { dirLabel, fmtDate } from './helpers'
import { HowToRead } from './ui'

export function BriefingTab({ calls, kind, emptyText, hoofdhorizon }: { calls: FbCall[]; kind: 'daily' | 'weekly'; emptyText: string; hoofdhorizon: number }) {
  const [selId, setSelId] = useState<string | null>(calls[0]?.id ?? null)

  useEffect(() => {
    if (!selId || !calls.find((c) => c.id === selId)) setSelId(calls[0]?.id ?? null)
  }, [calls, selId])

  const howto = (
    <HowToRead>
      <p>
        Dit zijn de {kind === 'weekly' ? 'weekcalls (elke maandagochtend gelockt)' : "dagcalls (elke ochtend gelockt, vast voor de dag)"}.
        Elke regel is één <b>voorspelling</b>: een valutapaar met een richting en een zekerheid.
      </p>
      <ol>
        <li><b>LONG</b> = de tool denkt dat het paar omhoog gaat, <b>SHORT</b> = omlaag.</li>
        <li>Het getal rechts is de <b>zekerheid</b> (0-10): hoe sterk de fundamentals die richting steunen.</li>
        <li>De <b>5 bolletjes</b> zijn de check-momenten (1/3/5/10/20 dagen): 🟢 goed · 🔴 fout · ⚪ nog wachten.</li>
        <li>Klik een regel voor de volledige uitleg: tijdlijn, waarom deze zekerheid, en de factoren per valuta.</li>
      </ol>
    </HowToRead>
  )

  if (calls.length === 0) {
    return <div>{howto}<div className="fb-empty">{emptyText}</div></div>
  }
  const sel = calls.find((c) => c.id === selId) || calls[0]

  return (
    <div>
      {howto}
      <div className="fb-legend">
        <span className="it"><span className="fb-hdot win" /> goed</span>
        <span className="it"><span className="fb-hdot loss" /> fout</span>
        <span className="it"><span className="fb-hdot" /> nog wachten</span>
        <span className="it">5 bolletjes = 1 / 3 / 5 / 10 / 20 dagen · getal = zekerheid (0-10)</span>
      </div>
      <div className="fb-layout">
        <div className="fb-list">
          {calls.map((c) => {
            const long = c.direction === 'bullish'
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
                <span className="fb-row-conv num" title="zekerheid (0-10)">{c.conviction.toFixed(1)}</span>
              </div>
            )
          })}
        </div>
        <CallDetail call={sel} hoofdhorizon={hoofdhorizon} />
      </div>
    </div>
  )
}
