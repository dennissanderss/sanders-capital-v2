'use client'

import { useEffect, useMemo, useState } from 'react'
import './styles.css'
import type { FbDataResponse } from '@/lib/fundamental/types'
import { BriefingTab } from './BriefingTab'
import { PairsTab } from './PairsTab'
import { Trackrecord } from './Trackrecord'
import { Analyse } from './Analyse'
import { BacktestTab } from './BacktestTab'
import { HowItWorks, Tour, type TourStep } from './ui'

type Lens = 'daytrade' | 'swing'
type Tab = 'calls' | 'paren' | 'trackrecord' | 'analyse' | 'bewijs'

const TOUR: TourStep[] = [
  { title: 'Welkom bij de Fundamental Briefing', text: 'Deze tool voorspelt per valutapaar een richting — omhoog of omlaag — op basis van de fundamentals, en houdt eerlijk bij of dat klopt. Bovenaan kies je je stijl: Daytrade (kort, 1 dag aanhouden) of Swing (langer, ~een week). Even in 4 korte stappen.' },
  { title: '1 · De calls van vandaag', tab: 'calls', text: 'Elk paar krijgt een richting (LONG = omhoog, SHORT = omlaag), een BIAS (hoe sterk de fundamentele these is) en een TIMING (hoe gunstig dit instapmoment is). Samen vormen ze de zekerheid van 0 tot 10. Sterke bias + slechte timing = interessant, maar nog even wachten.' },
  { title: '2 · Waarom een call?', tab: 'calls', text: 'Klik op een call. Bovenaan lees je in gewone taal waarom de tool deze richting verwacht. Wil je de exacte berekening? Klik "Toon de berekening".' },
  { title: '3 · Alle paren', tab: 'paren', text: 'Het volledige speelveld: alle 21 paren fundamenteel gescoord, ook de paren die géén call werden. Zo zie je in één oogopslag waar de sterkste divergenties zitten.' },
  { title: '4 · Klopte het? — Trackrecord', tab: 'trackrecord', text: 'Hier zie je van alle voorspellingen hoe vaak de richting goed zat, gemeten op 1 tot 20 dagen — met referentie- en eindkoers per call, zodat je het kunt nachecken.' },
  { title: '5 · Analyse & Bewijs', tab: 'bewijs', text: 'Analyse splitst het verse trackrecord uit; Bewijs toont een point-in-time simulatie over ~2 jaar (3.800+ trades, geen look-ahead) — inclusief de belangrijkste les: handel alleen bij timing ≥ 7.' },
  { title: 'Klaar!', text: 'Je kunt deze rondleiding altijd opnieuw starten via de knop "Rondleiding" bovenaan. Veel succes.' },
]

export default function Dashboard() {
  const [data, setData] = useState<FbDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [lens, setLens] = useState<Lens>('daytrade')
  const [tab, setTab] = useState<Tab>('calls')
  const [tourIdx, setTourIdx] = useState<number | null>(null)
  const [focusPair, setFocusPair] = useState<string | null>(null)

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
          Fundamenteel-gedreven valuta-bias, één keer per ochtend gelockt en daarna eerlijk gevolgd — puur of de richting goed zit.
        </p>
      </div>

      <HowItWorks />

      {/* Lens-schakelaar — de uitleg zit ín de knop, geen aparte banner */}
      <div className="fb-lens">
        <button className={`fb-lens-btn${lens === 'daytrade' ? ' active' : ''}`} onClick={() => setLens('daytrade')}>
          <span className="fb-lens-name">Daytrade</span>
          <span className="fb-lens-desc">elke ochtend verse dagcalls · zelfde dag aanhouden · afgerekend op 1 handelsdag</span>
        </button>
        <button className={`fb-lens-btn${lens === 'swing' ? ' active' : ''}`} onClick={() => setLens('swing')}>
          <span className="fb-lens-name">Swing <span className="fb-exp">experimenteel</span></span>
          <span className="fb-lens-desc">weekcalls, maandag gelockt · ~een week aanhouden · afgerekend op 5 handelsdagen</span>
        </button>
      </div>

      {header && (
        <>
          <div className="fb-regime-bar">
            <span className="fb-regime-chip"><span className={`fb-dot ${header.regimeColor}`} />{header.regime}</span>
            <span className="fb-regime-explain">{header.regimeExplain}</span>
            <span className={`fb-lock-chip${header.locked ? '' : ' live'}`} title={header.locked
              ? 'Deze scores zijn bij de ochtend-generate vastgezet en veranderen vandaag niet meer.'
              : 'Nog geen gelockte snapshot voor vandaag — dit is een live berekening.'}>
              {header.locked ? `🔒 gelockt · ${new Date(header.date + 'T00:00:00Z').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : 'live'}
            </span>
          </div>
          <div className="fb-bias-strip">
            {header.currencyScores.map((c, i) => {
              const maxAbs = Math.max(3, ...header.currencyScores.map((x) => Math.abs(x.score)))
              const pct = Math.min(100, (Math.abs(c.score) / maxAbs) * 100)
              const pos = c.score >= 0
              const strongest = i === 0 || i === header.currencyScores.length - 1
              return (
                <div className={`fb-bias-cell${strongest ? ' edge' : ''}`} key={c.currency}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span className="fb-bias-ccy">{c.currency}</span>
                    <span className="fb-bias-score num" style={{ color: pos ? 'var(--win)' : 'var(--loss)' }}>{pos ? '+' : ''}{c.score.toFixed(1)}</span>
                  </div>
                  <div className="fb-bias-track"><span className="fb-bias-mid" /><span className={`fb-bias-fill ${pos ? 'pos' : 'neg'}`} style={{ width: `${pct / 2}%` }} /></div>
                </div>
              )
            })}
          </div>
          {header.currencyScores.length >= 2 && (() => {
            const top = header.currencyScores[0]
            const bottom = header.currencyScores[header.currencyScores.length - 1]
            const spread = top.score - bottom.score
            if (spread < 2) return null
            return (
              <p className="fb-thesis">
                Sterkste divergentie vandaag: <b>{top.currency}</b> ({top.score >= 0 ? '+' : ''}{top.score.toFixed(1)}) vs. <b>{bottom.currency}</b> ({bottom.score >= 0 ? '+' : ''}{bottom.score.toFixed(1)}) — daar zit fundamenteel de duidelijkste paar-these.
              </p>
            )
          })()}
        </>
      )}

      <div className="fb-tabs">
        <button className={`fb-tab${tab === 'calls' ? ' active' : ''}`} onClick={() => setTab('calls')}>Calls van vandaag</button>
        <button className={`fb-tab${tab === 'paren' ? ' active' : ''}`} onClick={() => setTab('paren')}>Alle paren</button>
        <button className={`fb-tab${tab === 'trackrecord' ? ' active' : ''}`} onClick={() => setTab('trackrecord')}>Trackrecord</button>
        <button className={`fb-tab${tab === 'analyse' ? ' active' : ''}`} onClick={() => setTab('analyse')}>Analyse</button>
        <button className={`fb-tab${tab === 'bewijs' ? ' active' : ''}`} onClick={() => setTab('bewijs')}>Bewijs <span className="fb-tab-badge">backtest</span></button>
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
              focusPair={focusPair}
              emptyText={cfg.kind === 'weekly' ? "Nog geen weekcalls — die worden maandagochtend gelockt." : "Nog geen dagcalls voor vandaag — ze worden 's ochtends gegenereerd."}
            />
          )}
          {tab === 'paren' && (
            <PairsTab
              header={header ?? null}
              todayCalls={cfg.todayCalls}
              onSelectPair={(p) => { setFocusPair(p); setTab('calls') }}
            />
          )}
          {tab === 'trackrecord' && (
            <Trackrecord calls={cfg.trackrecord} hoofdhorizon={cfg.hoofd} secondaryHorizons={cfg.secondary} lensLabel={cfg.label} />
          )}
          {tab === 'analyse' && <Analyse calls={cfg.trackrecord} />}
          {tab === 'bewijs' && <BacktestTab />}
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
