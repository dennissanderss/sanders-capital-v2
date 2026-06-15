'use client'

import { useMemo } from 'react'
import { ZoneLabel, InfoTip } from '../atoms'
import { Icons } from '../icons'
import { buildPerfBuckets } from '../lib/adapters'
import type { ApiTrackRecord } from '../lib/types'

interface PrestatieProps {
  records: ApiTrackRecord[]
  onSetTab?: (tab: string) => void
}

const wColor = (w: number) => (w >= 60 ? 'var(--win)' : w < 50 ? 'var(--loss)' : 'var(--gold)')
const pfColor = (p: number) => (p >= 2 ? 'var(--win)' : p < 1 ? 'var(--loss)' : 'var(--ink)')

export function Prestatie({ records, onSetTab }: PrestatieProps) {
  const buckets = useMemo(() => buildPerfBuckets(records || []), [records])

  // Highlight the bucket with the strongest historical performance.
  // We sort populated buckets (>= 10 trades) by win-rate × profit-factor
  // and take the top one as the "sweet spot" to suggest.
  const sweet = [...buckets]
    .filter((b) => b.trades >= 10)
    .sort((a, b) => b.winrate * b.pf - a.winrate * a.pf)[0]

  return (
    <div className="fade">
      <p style={{
        fontSize: 13,
        color: 'var(--ink-2)',
        margin: '0 0 22px',
        lineHeight: 1.5,
        maxWidth: '60ch',
      }}>
        Backtest samenvatting. Historische uitkomsten van alle {buckets.reduce((s, b) => s + b.trades, 0)} afgesloten trades, gegroepeerd per conviction-score. Let goed op het aantal trades per bucket: kleine samples kunnen variantie zijn, geen signaal.
      </p>
      <ZoneLabel
        info={
          <InfoTip title="Prestatie per score" align="left">
            <p>Historische uitkomsten gegroepeerd per conviction-score (0 - 10). Hogere buckets presteren doorgaans sterker, maar let op de steekproefgrootte.</p>
            <p className="eg">Buckets met &lt; 20 trades zijn statistisch minder betrouwbaar en krijgen een &quot;klein sample&quot;-tag.</p>
          </InfoTip>
        }
      >
        Prestatie per conviction-score
      </ZoneLabel>

      <div className="perf">
        <div className="phead">
          <span className="mono-label">Score-bucket</span>
          <span className="mono-label">Trades</span>
          <span className="mono-label">Winrate</span>
          <span className="mono-label">Profit factor</span>
          <span className="mono-label r">Gem. resultaat</span>
        </div>
        {buckets.map((b) => {
          const small = b.trades > 0 && b.trades < 20
          const empty = b.trades === 0
          return (
            <div className="prow" key={b.range}>
              <div className="pb">
                <span className="pb-range">{b.range}</span>
              </div>
              <div className="pt">
                <span className="pt-n num">{b.trades}</span>
                {small && <span className="smalltag">klein sample</span>}
                {empty && <span className="smalltag">geen data</span>}
              </div>
              <div className="pw">
                <div className="pw-bar">
                  <span style={{ width: `${b.winrate}%`, background: wColor(b.winrate) }} />
                </div>
                <span className="pw-val num" style={{ color: empty ? 'var(--ink-4)' : wColor(b.winrate) }}>
                  {empty ? '—' : `${b.winrate}%`}
                </span>
              </div>
              <div className="pf-cell num" style={{ color: empty ? 'var(--ink-4)' : pfColor(b.pf) }}>
                {empty ? '—' : b.pf.toFixed(1)}
              </div>
              <div
                className="pp num"
                style={{ color: empty ? 'var(--ink-4)' : b.avgPips >= 0 ? 'var(--win)' : 'var(--loss)' }}
              >
                {empty ? '—' : `${b.avgPips >= 0 ? '+' : ''}${b.avgPips}`}
                {!empty && <span className="unit"> pips</span>}
              </div>
            </div>
          )
        })}
      </div>

      <div className="perf-apply">
        {sweet ? (
          <>
            <span>
              <strong>Beste bucket: {sweet.range}</strong> met {sweet.winrate}% winrate en profit factor {sweet.pf.toFixed(1)} over {sweet.trades} trades. Houd er rekening mee dat hogere score in deze backtest niet automatisch hogere winrate betekent — de score is één signaal, geen garantie.
            </span>
            <button className="flowlink" onClick={() => onSetTab?.('setups')}>
              <Icons.ArrowLeft size={13} /> Naar Setups
            </button>
          </>
        ) : (
          <>
            <span>Nog onvoldoende statistische diepte. Pak de buckets met de meeste trades als referentie.</span>
            <button className="flowlink" onClick={() => onSetTab?.('setups')}>
              <Icons.ArrowLeft size={13} /> Naar Setups
            </button>
          </>
        )}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 10 }}>
        Buckets met &lt; 20 trades krijgen een &quot;klein sample&quot;-tag. Sterke buckets gedempt groen, zwakke gedempt rood.
      </div>
    </div>
  )
}
