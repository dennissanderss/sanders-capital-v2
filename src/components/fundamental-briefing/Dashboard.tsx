'use client'

import { useEffect, useMemo, useState } from 'react'
import './styles.css'
import type { FbDataResponse } from '@/lib/fundamental/types'
import { BriefingTab } from './BriefingTab'
import { Trackrecord } from './Trackrecord'
import { Analyse } from './Analyse'
import { HowItWorks, Tour, type TourStep } from './ui'

type Lens = 'daytrade' | 'swing'
type Tab = 'calls' | 'trackrecord' | 'analyse'

const TOUR: TourStep[] = [
  { title: 'Welkom bij de Fundamental Briefing', text: 'Deze tool voorspelt per valutapaar een richting — omhoog of omlaag — op basis van de fundamentals, en houdt eerlijk bij of dat klopt. Bovenaan kies je je stijl: Daytrade (kort, 1 dag aanhouden) of Swing (langer, ~een week). Even in 4 korte stappen.' },
  { title: '1 · De calls van vandaag', tab: 'calls', text: 'Elk paar krijgt een richting (LONG = omhoog, SHORT = omlaag) en een zekerheid van 0 tot 10. Alleen de sterkere calls staan bovenaan als "tradeable"; zwakke staan apart — die wil je niet traden.' },
  { title: '2 · Waarom een call?', tab: 'calls', text: 'Klik op een call. Bovenaan lees je in gewone taal waarom de tool deze richting verwacht. Wil je de exacte berekening? Klik "Toon de berekening".' },
  { title: '3 · Klopte het? — Trackrecord', tab: 'trackrecord', text: 'Hier zie je van alle voorspellingen hoe vaak de richting goed zat, gemeten op 1 tot 20 dagen — met referentie- en eindkoers per call, zodat je het kunt nachecken.' },
  { title: '4 · Analyse', tab: 'analyse', text: 'Hier splits je de resultaten uit per zekerheid, paar en termijn. Bij te weinig data krijg je een waarschuwing, zodat je geen toevalstreffer voor een patroon aanziet.' },
  { title: 'Klaar!', text: 'Je kunt deze rondleiding altijd opnieuw starten via de knop "Rondleiding" bovenaan. Veel succes.' },
]

export default function Dashboard() {
  const [data, setData] = useState<FbDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [lens, setLens] = useState<Lens>('daytrade')
  const [tab, setTab] = useState<Tab>('calls')
  const [tourIdx, setTourIdx] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/fundamental-briefing/data')
      .then((r) => r.json())
      .then((d) => { if (alive) { setData(d); setLoading(false) } })
      .catch((e) => { if (alive) { setErr(String(e)); setLoading(false) } })
    return () => { alive = false }
  }, [])

  // Rondleiding: de eerste keer automatisch starten.
  useEffect(() => {
    try { if (!localStorage.getItem('fb_tour_v1')) setTourIdx(0) } catch { /* geen storage */ }
  }, [])

  // Tijdens de rondleiding het juiste tabblad tonen.
  useEffect(() => {
    if (tourIdx == null) return
    const s = TOUR[tourIdx]
    if (s?.tab) setTab(s.tab as Tab)
    if (s?.lens) setLens(s.lens as Lens)
  }, [tourIdx])

  const closeTour = () => { setTourIdx(null); try { localStorage.setItem('fb_tour_v1', '1') } catch { /* */ } }

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
        <div className="fb-head-row">
          <h1 className="fb-title">Fundamental Briefing</h1>
          <button className="fb-tour-start" onClick={() => setTourIdx(0)}>? Rondleiding</button>
        </div>
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
      <div className={`fb-mode-banner${lens === 'swing' ? ' exp' : ''}`}>
        {lens === 'daytrade' ? (
          <><b>Daytrade — korte termijn.</b> Elke ochtend verse dagcalls die je dezelfde dag aanhoudt; de tool rekent af op <b>1 handelsdag</b>. Wil je langer aanhouden? Kies <b>Swing</b> hiernaast.</>
        ) : (
          <>⚗️ <b>Swing — langere termijn (experimenteel).</b> Weekcalls (maandagochtend gelockt) die je ongeveer <b>een week</b> aanhoudt; afgerekend op <b>5 handelsdagen</b>. De fundamentele analyse is gelijk aan daytrade — alleen de horizon verschilt. Bouwt zich nog op, lees de cijfers voorlopig.</>
        )}
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

      {tourIdx != null && (
        <Tour
          steps={TOUR}
          index={tourIdx}
          onNext={() => setTourIdx((i) => Math.min(TOUR.length - 1, (i ?? 0) + 1))}
          onPrev={() => setTourIdx((i) => Math.max(0, (i ?? 0) - 1))}
          onClose={closeTour}
        />
      )}
    </div>
  )
}
