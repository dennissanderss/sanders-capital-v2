'use client'

import { useEffect, useState } from 'react'
import './styles.css'
import type { FbDataResponse } from '@/lib/fundamental/types'
import { BriefingTab } from './BriefingTab'
import { Trackrecord } from './Trackrecord'

type Tab = 'vandaag' | 'weekly' | 'trackrecord'

export default function Dashboard() {
  const [data, setData] = useState<FbDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('vandaag')

  useEffect(() => {
    let alive = true
    fetch('/api/fundamental-briefing/data')
      .then((r) => r.json())
      .then((d) => { if (alive) { setData(d); setLoading(false) } })
      .catch((e) => { if (alive) { setErr(String(e)); setLoading(false) } })
    return () => { alive = false }
  }, [])

  const header = data?.header

  return (
    <div className="fb-tool">
      <div className="fb-head">
        <h1 className="fb-title">Fundamental Briefing</h1>
        <p className="fb-sub">
          Fundamenteel-gedreven valuta-bias, één keer per ochtend gelockt en vast voor de dag (weekly: maandag).
          Elke call wordt eerlijk en zonder look-ahead op meerdere horizons gevolgd — puur of de richting goed zit.
        </p>
      </div>

      {header && (
        <>
          <div className="fb-regime-bar">
            <span className="fb-regime-chip"><span className={`fb-dot ${header.regimeColor}`} />{header.regime}</span>
            <span className="fb-regime-explain">{header.regimeExplain}</span>
          </div>
          <div className="fb-bias-strip">
            {header.currencyScores.map((c) => {
              const pct = Math.min(100, (Math.abs(c.score) / 6) * 100)
              const pos = c.score >= 0
              return (
                <div className="fb-bias-cell" key={c.currency}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span className="fb-bias-ccy">{c.currency}</span>
                    <span className="fb-bias-score num" style={{ color: pos ? 'var(--win)' : 'var(--loss)' }}>
                      {pos ? '+' : ''}{c.score.toFixed(1)}
                    </span>
                  </div>
                  <div className="fb-bias-track">
                    <span className={`fb-bias-fill ${pos ? 'pos' : 'neg'}`} style={{ width: `${pct / 2}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="fb-tabs">
        <button className={`fb-tab${tab === 'vandaag' ? ' active' : ''}`} onClick={() => setTab('vandaag')}>Vandaag</button>
        <button className={`fb-tab${tab === 'weekly' ? ' active' : ''}`} onClick={() => setTab('weekly')}>Weekly</button>
        <button className={`fb-tab${tab === 'trackrecord' ? ' active' : ''}`} onClick={() => setTab('trackrecord')}>Trackrecord</button>
      </div>

      {loading && <div className="fb-empty">Briefing wordt geladen…</div>}
      {err && <div className="fb-empty">Kon de briefing niet laden: {err}</div>}

      {data && !loading && (
        <>
          {tab === 'vandaag' && (
            <BriefingTab calls={data.dailyCalls} kind="daily" emptyText="Nog geen dagcalls voor vandaag — ze worden 's ochtends gegenereerd zodra de markt-data binnen is." />
          )}
          {tab === 'weekly' && (
            <BriefingTab calls={data.weeklyCalls} kind="weekly" emptyText="Nog geen weekcalls — die worden maandagochtend gelockt." />
          )}
          {tab === 'trackrecord' && <Trackrecord trackrecord={data.trackrecord} />}
        </>
      )}
    </div>
  )
}
