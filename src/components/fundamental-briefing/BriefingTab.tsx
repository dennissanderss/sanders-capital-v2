'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FbCall } from '@/lib/fundamental/types'
import { HORIZONS } from '@/lib/fundamental/constants'
import { CallDetail } from './CallDetail'
import { dirLabel, fmtDate, zekerheidTier } from './helpers'

// Onder deze zekerheid is een call te zwak om te handelen (richting duidelijk,
// maar momentum/markt/regime bevestigen 'm nauwelijks). Alleen weergave.
const TRADE_MIN = 5

function CallRow({ c, sel, onSelect }: { c: FbCall; sel: boolean; onSelect: () => void }) {
  const long = c.direction === 'bullish'
  const tier = zekerheidTier(c.conviction)
  return (
    <div className={`fb-row${sel ? ' sel' : ''}`} onClick={onSelect}>
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
}

export function BriefingTab({ calls, kind, emptyText, hoofdhorizon }: { calls: FbCall[]; kind: 'daily' | 'weekly'; emptyText: string; hoofdhorizon: number }) {
  const sorted = useMemo(() => [...calls].sort((a, b) => b.conviction - a.conviction), [calls])
  const strong = useMemo(() => sorted.filter((c) => c.conviction >= TRADE_MIN), [sorted])
  const weak = useMemo(() => sorted.filter((c) => c.conviction < TRADE_MIN), [sorted])

  const [selId, setSelId] = useState<string | null>(null)
  const [showWeak, setShowWeak] = useState(false)

  useEffect(() => {
    const pref = strong[0]?.id ?? sorted[0]?.id ?? null
    if (!selId || !sorted.find((c) => c.id === selId)) setSelId(pref)
  }, [sorted, strong, selId])

  const intro = (
    <p className="fb-calls-intro">
      <b>Sterkste calls bovenaan.</b> Het getal is de zekerheid (0–10). Zwakke calls (onder de {TRADE_MIN}) staan apart — die wil je niet traden.
    </p>
  )

  if (sorted.length === 0) {
    return <div>{intro}<div className="fb-empty">{emptyText}</div></div>
  }
  const sel = sorted.find((c) => c.id === selId) || strong[0] || sorted[0]

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
          <div className="fb-list-head">Tradeable calls{strong.length > 0 ? ` (${strong.length})` : ''}</div>
          {strong.length === 0
            ? <div className="fb-empty" style={{ padding: '22px 14px', fontSize: 12.5 }}>Geen calls met genoeg bevestiging vandaag — alle signalen zijn zwak. Vandaag liever niet handelen op deze tool.</div>
            : strong.map((c) => <CallRow key={c.id} c={c} sel={c.id === sel.id} onSelect={() => setSelId(c.id)} />)}

          {weak.length > 0 && (
            <>
              <button className="fb-weak-toggle" onClick={() => setShowWeak((s) => !s)}>
                {showWeak ? '▲' : '▼'} Zwakkere signalen — niet handelen ({weak.length})
              </button>
              {showWeak && (
                <div className="fb-weak-list">
                  {weak.map((c) => <CallRow key={c.id} c={c} sel={c.id === sel.id} onSelect={() => setSelId(c.id)} />)}
                </div>
              )}
            </>
          )}
        </div>
        <CallDetail call={sel} hoofdhorizon={hoofdhorizon} />
      </div>
    </div>
  )
}
