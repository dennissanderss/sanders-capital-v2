'use client'

import { useEffect, useState } from 'react'
import type { FbCall } from '@/lib/fundamental/types'
import { HORIZONS } from '@/lib/fundamental/constants'
import { CallDetail } from './CallDetail'
import { dirLabel, fmtDate } from './helpers'

export function BriefingTab({ calls, emptyText }: { calls: FbCall[]; emptyText: string }) {
  const [selId, setSelId] = useState<string | null>(calls[0]?.id ?? null)

  useEffect(() => {
    if (!selId || !calls.find((c) => c.id === selId)) setSelId(calls[0]?.id ?? null)
  }, [calls, selId])

  if (calls.length === 0) {
    return <div className="fb-empty">{emptyText}</div>
  }
  const sel = calls.find((c) => c.id === selId) || calls[0]

  return (
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
                      return <span key={h} className={`fb-hdot${cls}`} title={`${h}d`} />
                    })}
                  </span>
                  {' '}· {fmtDate(c.entryDate)}
                </div>
              </div>
              <span className="fb-row-conv num">{c.conviction.toFixed(1)}</span>
            </div>
          )
        })}
      </div>
      <CallDetail call={sel} />
    </div>
  )
}
