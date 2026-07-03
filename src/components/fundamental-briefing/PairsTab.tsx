'use client'

import { useMemo } from 'react'
import type { BriefingHeader, FbCall } from '@/lib/fundamental/types'
import { PAIRS, FUND_GATE } from '@/lib/fundamental/constants'
import { timingScoreOf, biasScoreOf } from './helpers'
import { Tip, HowToRead } from './ui'

// Alle 21 paren fundamenteel gescoord — het volledige speelveld, niet alleen
// de top-8 calls. Puur uit de (gelockte) valutascores van de header; het
// paar-verschil is exact dezelfde som als in de call-generatie.
export function PairsTab({ header, todayCalls, onSelectPair }: {
  header: BriefingHeader | null
  todayCalls: FbCall[]
  onSelectPair?: (pair: string) => void
}) {
  const rows = useMemo(() => {
    if (!header) return []
    const score: Record<string, number> = {}
    for (const c of header.currencyScores) score[c.currency] = c.score
    return PAIRS.map((pair) => {
      const [base, quote] = pair.split('/')
      const diff = +( (score[base] ?? 0) - (score[quote] ?? 0) ).toFixed(2)
      const direction = diff > 0.5 ? 'LONG' : diff < -0.5 ? 'SHORT' : '—'
      const call = todayCalls.find((c) => c.pair === pair)
      return { pair, base, quote, diff, direction, isCall: !!call, call }
    }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  }, [header, todayCalls])

  if (!header) return <div className="fb-empty">Geen marktdata beschikbaar.</div>

  const maxAbs = Math.max(2, ...rows.map((r) => Math.abs(r.diff)))

  return (
    <div>
      <HowToRead title="Hoe lees ik dit overzicht?">
        <p>
          Dit is het <b>volledige speelveld</b>: alle 21 paren, gescoord op het verschil tussen de twee fundamentele
          valutascores (bovenaan de pagina). Positief = LONG-neiging (basisvaluta sterker), negatief = SHORT.
        </p>
        <ol>
          <li>Alleen paren met |score| ≥ {FUND_GATE.toFixed(0)} halen de <b>gate</b>; daarvan worden er maximaal 8 per dag een echte call (tabblad Calls).</li>
          <li>Een paar zónder call-badge kan alsnog interessant zijn — check dan zelf de timing (recente strekking, cijfers op komst).</li>
          <li>De scores zijn {header.locked ? "'s ochtends gelockt en veranderen vandaag niet meer" : 'live berekend (nog geen gelockte snapshot)'}.</li>
        </ol>
      </HowToRead>

      <div className="fb-pair-grid">
        {rows.map((r) => {
          const pct = Math.min(100, (Math.abs(r.diff) / maxAbs) * 100)
          const pos = r.diff >= 0
          const gated = Math.abs(r.diff) >= FUND_GATE
          const timing = r.call ? timingScoreOf(r.call) : null
          return (
            <div
              key={r.pair}
              className={`fb-pair-cell${gated ? '' : ' dim'}${r.isCall ? ' is-call' : ''}`}
              onClick={r.isCall && onSelectPair ? () => onSelectPair(r.pair) : undefined}
              role={r.isCall && onSelectPair ? 'button' : undefined}
              title={r.isCall ? 'Bekijk de call van vandaag' : undefined}
            >
              <div className="fb-pair-top">
                <span className="fb-pair-name">{r.pair}</span>
                <span className={`fb-chip ${r.direction === 'LONG' ? 'long' : r.direction === 'SHORT' ? 'short' : 'none'}`}>{r.direction}</span>
              </div>
              <div className="fb-pair-score-row">
                <span className="num fb-pair-score" style={{ color: r.direction === '—' ? 'var(--ink-4)' : pos ? 'var(--win)' : 'var(--loss)' }}>
                  {r.diff > 0 ? '+' : ''}{r.diff.toFixed(1)}
                </span>
                {r.isCall && r.call && (
                  <span className="fb-pair-callinfo num">
                    call · bias {biasScoreOf(r.call).toFixed(1)}{timing != null ? ` · timing ${timing.toFixed(1)}` : ''}
                  </span>
                )}
                {!r.isCall && gated && <span className="fb-pair-callinfo">gate gehaald, buiten top-8</span>}
                {!gated && <span className="fb-pair-callinfo">onder de gate — geen duidelijke these</span>}
              </div>
              <div className="fb-bias-track"><span className="fb-bias-mid" /><span className={`fb-bias-fill ${pos ? 'pos' : 'neg'}`} style={{ width: `${pct / 2}%` }} /></div>
            </div>
          )
        })}
      </div>

      <p className="fb-note">
        Score = valutascore basis − valutascore quote (centrale bank, rente vs. doel, nieuws per valuta, macro-verrassingen,
        inflatie-gap, grondstoffen). Zie de bias-strip bovenaan voor de acht losse valutascores. <Tip text="Klik op een paar met een call-badge om de volledige onderbouwing te zien op het Calls-tabblad." />
      </p>
    </div>
  )
}
