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

  // Determine apply threshold: lowest bucket with WR >= 55 and PF >= 1.5 and trades >= 20
  const apply = buckets.find((b) => b.winrate >= 55 && b.pf >= 1.5 && b.trades >= 20)

  return (
    <div className="fade">
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
        {apply ? (
          <>
            <span>
              <strong>Vanaf score {apply.min}</strong> wordt de winrate de moeite waard: {apply.winrate}% met een profit factor van {apply.pf.toFixed(1)}. Zet de filter in Setups daarop af.
            </span>
            <button className="flowlink" onClick={() => onSetTab?.('setups')}>
              <Icons.ArrowLeft size={13} /> Naar Setups
            </button>
          </>
        ) : (
          <>
            <span>Nog onvoldoende statistische diepte om een duidelijke drempel te trekken. Pak de buckets met de meeste trades als referentie.</span>
            <button className="flowlink" onClick={() => onSetTab?.('setups')}>
              <Icons.ArrowLeft size={13} /> Naar Setups
            </button>
          </>
        )}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 10 }}>
        Buckets met weinig trades zijn statistisch minder betrouwbaar. Sterke buckets in gedempt groen, zwakke in gedempt rood.
      </div>
    </div>
  )
}
