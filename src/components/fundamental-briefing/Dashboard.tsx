'use client'

import { useEffect, useMemo, useState } from 'react'
import './styles.css'
import type { FbDataResponse } from '@/lib/fundamental/types'
import { BriefingTab } from './BriefingTab'
import { Trackrecord } from './Trackrecord'
import { Analyse } from './Analyse'
import { HowItWorks } from './ui'

type Lens = 'daytrade' | 'swing'
type Tab = 'calls' | 'trackrecord' | 'analyse'

export default function Dashboard() {
  const [data, setData] = useState<FbDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [lens, setLens] = useState<Lens>('daytrade')
  const [tab, setTab] = useState<Tab>('calls')

  useEffect(() => {
    let alive = true
    fetch('/api/fundamental-briefing/data')
      .then((r) => r.json())
      .then((d) => { if (alive) { setData(d); setLoading(false) } })
      .catch((e) => { if (alive) { setErr(String(e)); setLoading(false) } })
    return () => { alive = false }
  }, [])

  const header = data?.header

  // Lens bepaalt: welke calls, welke hoofdhorizon, welke secundaire horizons.
  const cfg = useMemo(() => {
    const isDay = lens === 'daytrade'
    const all = data?.trackrecord || []
    return {
      label: isDay ? 'Daytrade' : 'Swing',
      kind: (isDay ? 'daily' : 'weekly') as 'daily' | 'weekly',
      todayCalls: isDay ? (data?.dailyCalls || []) : (data?.weeklyCalls || []),
      trackrecord: all.filter((c) => c.callType === (isDay ? 'daily' : 'weekly')),
      hoofd: isDay ? 1 : 5,
      secondary: isDay ? [3, 5, 10, 20] : [3, 10, 20],
      experimental: !isDay,
    }
  }, [lens, data])

  return (
    <div className="fb-tool">
      <div className="fb-head">
        <h1 className="fb-title">Fundamental Briefing</h1>
        <p className="fb-sub">
          Fundamenteel-gedreven valuta-bias, één keer per ochtend gelockt en vast voor de dag (swing: maandag).
          Elke call wordt eerlijk en zonder look-ahead op meerdere horizons gevolgd — puur of de richting goed zit.
        </p>
      </div>

      <HowItWorks />

      {/* Lens-schakelaar */}
      <div className="fb-lens">
        <button className={`fb-lens-btn${lens === 'daytrade' ? ' active' : ''}`} onClick={() => setLens('daytrade')}>
          <span className="fb-lens-name">Daytrade</span>
          <span className="fb-lens-desc">dagcalls · meet op 1 dag</span>
        </button>
        <button className={`fb-lens-btn${lens === 'swing' ? ' active' : ''}`} onClick={() => setLens('swing')}>
          <span className="fb-lens-name">Swing <span className="fb-exp">experimenteel</span></span>
          <span className="fb-lens-desc">weekcalls · meet op 5 dagen</span>
        </button>
      </div>
      {lens === 'swing' && (
        <div className="fb-exp-banner">⚗️ <b>Swing is experimenteel</b> en bouwt zich nog op — de weekcalls hebben tijd nodig om hun 5-daagse venster te vullen. Lees de cijfers voorlopig.</div>
      )}

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
                    <span className="fb-bias-score num" style={{ color: pos ? 'var(--win)' : 'var(--loss)' }}>{pos ? '+' : ''}{c.score.toFixed(1)}</span>
                  </div>
                  <div className="fb-bias-track"><span className={`fb-bias-fill ${pos ? 'pos' : 'neg'}`} style={{ width: `${pct / 2}%` }} /></div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="fb-tabs">
        <button className={`fb-tab${tab === 'calls' ? ' active' : ''}`} onClick={() => setTab('calls')}>Calls van vandaag</button>
        <button className={`fb-tab${tab === 'trackrecord' ? ' active' : ''}`} onClick={() => setTab('trackrecord')}>Trackrecord</button>
        <button className={`fb-tab${tab === 'analyse' ? ' active' : ''}`} onClick={() => setTab('analyse')}>Analyse</button>
      </div>

      {loading && <div className="fb-empty">Briefing wordt geladen…</div>}
      {err && <div className="fb-empty">Kon de briefing niet laden: {err}</div>}

      {data && !loading && (
        <>
          {tab === 'calls' && (
            <BriefingTab
              calls={cfg.todayCalls}
              kind={cfg.kind}
              hoofdhorizon={cfg.hoofd}
              emptyText={cfg.kind === 'weekly' ? "Nog geen weekcalls — die worden maandagochtend gelockt." : "Nog geen dagcalls voor vandaag — ze worden 's ochtends gegenereerd."}
            />
          )}
          {tab === 'trackrecord' && (
            <Trackrecord calls={cfg.trackrecord} hoofdhorizon={cfg.hoofd} secondaryHorizons={cfg.secondary} lensLabel={cfg.label} />
          )}
          {tab === 'analyse' && <Analyse calls={cfg.trackrecord} />}
        </>
      )}
    </div>
  )
}
