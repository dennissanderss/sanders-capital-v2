'use client'

import { useState } from 'react'
import type { FbCall } from '@/lib/fundamental/types'
import { HORIZONS } from '@/lib/fundamental/constants'
import { winStats, groupWinrate, convictionBand } from './helpers'

const REGIME_ORDER = ['USD Dominant', 'USD Zwak', 'Risk-Off', 'Risk-On', 'Gemengd']
const CONV_ORDER = ['8.0+', '7.0–8.0', '6.0–7.0', '< 6.0']

function BdCard({ title, rows }: { title: string; rows: { label: string; stats: ReturnType<typeof winStats> }[] }) {
  return (
    <div className="fb-bd-card">
      <div className="fb-bd-title">{title}</div>
      {rows.filter((r) => r.stats.n > 0).length === 0
        ? <div className="fb-note">Nog geen afgeronde calls op deze horizon.</div>
        : rows.filter((r) => r.stats.n > 0).map((r) => (
          <div className="fb-bd-row" key={r.label}>
            <span>{r.label}</span>
            <span className="fb-bd-rate num">{r.stats.winrate}%</span>
            <span className="fb-bd-n num">{r.stats.wins}/{r.stats.n}</span>
          </div>
        ))}
    </div>
  )
}

export function Trackrecord({ trackrecord }: { trackrecord: FbCall[] }) {
  const [hz, setHz] = useState<number>(5)
  const [type, setType] = useState<'all' | 'daily' | 'weekly'>('all')

  const calls = trackrecord.filter((c) => type === 'all' || c.callType === type)
  const overall = winStats(calls, hz)
  const byConv = groupWinrate(calls, hz, convictionBand, CONV_ORDER)
  const byRegime = groupWinrate(calls, hz, (c) => c.regime, REGIME_ORDER)
  const byPair = groupWinrate(calls, hz, (c) => c.pair).sort((a, b) => b.stats.n - a.stats.n).slice(0, 8)

  const resolvedAny = trackrecord.some((c) => c.outcomes.some((o) => o.resolved))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div>
          <span className="fb-mono" style={{ display: 'block', marginBottom: 6 }}>Horizon</span>
          <div className="fb-hz-toggle">
            {HORIZONS.map((h) => (
              <button key={h} className={`fb-hz-btn${hz === h ? ' active' : ''}`} onClick={() => setHz(h)}>{h}d</button>
            ))}
          </div>
        </div>
        <div>
          <span className="fb-mono" style={{ display: 'block', marginBottom: 6 }}>Type</span>
          <div className="fb-hz-toggle">
            {(['all', 'daily', 'weekly'] as const).map((t) => (
              <button key={t} className={`fb-hz-btn${type === t ? ' active' : ''}`} onClick={() => setType(t)}>
                {t === 'all' ? 'Alle' : t === 'daily' ? 'Daily' : 'Weekly'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!resolvedAny ? (
        <div className="fb-empty">
          Het trackrecord bouwt zich <b>vooruit</b> op — er zijn nog geen afgeronde horizons.<br />
          Zodra de eerste calls hun {hz}-daagse venster hebben voltooid, verschijnt hier de trefkans.
        </div>
      ) : (
        <>
          <div className="fb-kpis">
            <div className="fb-kpi"><div className="l">Trefkans · {hz}d</div><div className="v accent num">{overall.winrate}%</div></div>
            <div className="fb-kpi"><div className="l">Juist</div><div className="v win num">{overall.wins}</div></div>
            <div className="fb-kpi"><div className="l">Onjuist</div><div className="v loss num">{overall.losses}</div></div>
            <div className="fb-kpi"><div className="l">Afgerond</div><div className="v num">{overall.n}</div></div>
            <div className="fb-kpi"><div className="l">Pending</div><div className="v num">{overall.pending}</div></div>
          </div>

          <div className="fb-bd">
            <BdCard title="Per conviction" rows={byConv} />
            <BdCard title="Per regime" rows={byRegime} />
          </div>
          <div className="fb-bd" style={{ marginTop: 18 }}>
            <BdCard title="Per paar (top 8 op aantal)" rows={byPair} />
            <div className="fb-bd-card">
              <div className="fb-bd-title">Lezen</div>
              <p className="fb-note" style={{ marginTop: 0 }}>
                Klik een horizon (1/3/5/10/20d) om alle cijfers mee te laten rekenen. 50% = muntje; boven 50% betekent dat
                de fundamentele richting op die horizon vaker juist was. Per rij staat winrate en juist/afgerond.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
