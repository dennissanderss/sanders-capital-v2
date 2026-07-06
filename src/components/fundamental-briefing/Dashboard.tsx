'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import './styles.css'
import type { FbDataResponse } from '@/lib/fundamental/types'
import { BriefingTab } from './BriefingTab'
import { PairsTab } from './PairsTab'
import { Trackrecord } from './Trackrecord'
import { Analyse } from './Analyse'
import { BacktestTab } from './BacktestTab'
import { HowItWorks, Tour, type TourStep } from './ui'

type Lens = 'daytrade' | 'swing' | 'position'
type Tab = 'calls' | 'paren' | 'trackrecord' | 'analyse' | 'bewijs'

// ─── Zijbalk-iconen (strakke line-icons, geen dependency) ──────
const IconCalls = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h3l2-6 4 12 2-7 1 1h2" /></svg>
)
const IconPairs = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="6" rx="1.2" /><rect x="11" y="3" width="6" height="6" rx="1.2" /><rect x="3" y="11" width="6" height="6" rx="1.2" /><rect x="11" y="11" width="6" height="6" rx="1.2" /></svg>
)
const IconTrack = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" /></svg>
)
const IconAnalyse = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17V9M8 17V4M13 17v-6M18 17V7" /></svg>
)
const IconProof = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2.5 4 5v5c0 3.5 2.5 6 6 7.5 3.5-1.5 6-4 6-7.5V5l-6-2.5Z" /><path d="M7.5 10l1.8 1.8 3.5-3.6" /></svg>
)

const NAV: { key: Tab; label: string; sub: string; icon: ReactNode }[] = [
  { key: 'calls', label: 'Calls vandaag', sub: 'de signalen van nu', icon: <IconCalls /> },
  { key: 'paren', label: 'Alle paren', sub: 'het volledige speelveld', icon: <IconPairs /> },
  { key: 'trackrecord', label: 'Trackrecord', sub: 'klopte het?', icon: <IconTrack /> },
  { key: 'analyse', label: 'Analyse', sub: 'waar werkt het?', icon: <IconAnalyse /> },
  { key: 'bewijs', label: 'Bewijs', sub: '2-jaars simulatie', icon: <IconProof /> },
]

const LENS_META: Record<Lens, { name: string; horizon: string; note: string }> = {
  daytrade: { name: 'Daytrade', horizon: 'zelfde dag · 1 dag', note: 'Kort aanhouden. In de simulatie waren de winners groter dan de verliezers bij goede timing.' },
  swing: { name: 'Swing', horizon: '3–5 dagen', note: 'De sterkste lens in de simulatie — mits je alleen bij goede timing instapt.' },
  position: { name: 'Positie', horizon: 'weken · 20 dagen', note: 'Renteverschil (carry) + swap. Korte simulatie (~8 mnd) — lees als indicatie.' },
}

const TOUR: TourStep[] = [
  { title: 'Welkom bij de Fundamental Briefing', text: 'Deze tool voorspelt per valutapaar een richting — omhoog of omlaag — op basis van de fundamentals, en houdt eerlijk bij of dat klopt. Links kies je een onderdeel, bovenaan je stijl. Even in 4 korte stappen.' },
  { title: '1 · Kies je stijl', text: 'Bovenaan schakel je tussen Daytrade (kort), Swing (paar dagen) en Positie (weken, carry). Elke stijl gebruikt het model dat op díe horizon het best werkt.' },
  { title: '2 · De calls van vandaag', tab: 'calls', text: 'Elk paar krijgt een richting (LONG = omhoog, SHORT = omlaag), een BIAS (hoe sterk de these) en een TIMING (hoe gunstig het instapmoment). Klik een call voor de onderbouwing tot de bron.' },
  { title: '3 · Klopte het? — Trackrecord & Analyse', tab: 'trackrecord', text: 'Hier zie je van alle voorspellingen hoe vaak de richting goed zat, mét de beweging in pips (referentie- en eindkoers erbij, na te checken in TradingView).' },
  { title: '4 · Bewijs', tab: 'bewijs', text: 'Een point-in-time simulatie over ~2 jaar (zonder vooruitkijken) — inclusief de belangrijkste les: handel alleen bij timing ≥ 7.' },
  { title: 'Klaar!', text: 'Je kunt deze rondleiding altijd opnieuw starten via de knop onderaan de zijbalk. Veel succes.' },
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

  useEffect(() => {
    try { if (!localStorage.getItem('fb_tour_v1')) setTourIdx(0) } catch { /* geen storage */ }
  }, [])

  useEffect(() => {
    if (tourIdx == null) return
    const s = TOUR[tourIdx]
    if (s?.tab) setTab(s.tab as Tab)
    if (s?.lens) setLens(s.lens as Lens)
  }, [tourIdx])

  const closeTour = () => { setTourIdx(null); try { localStorage.setItem('fb_tour_v1', '1') } catch { /* */ } }

  const header = data?.header

  const cfg = useMemo(() => {
    const all = data?.trackrecord || []
    if (lens === 'position') {
      return {
        label: 'Positie', kind: 'position' as const,
        todayCalls: data?.positionCalls || [],
        trackrecord: all.filter((c) => c.callType === 'position'),
        hoofd: 20, secondary: [5, 10],
      }
    }
    const isDay = lens === 'daytrade'
    return {
      label: isDay ? 'Daytrade' : 'Swing',
      kind: 'daily' as const,
      todayCalls: data?.dailyCalls || [],
      trackrecord: all.filter((c) => c.callType === 'daily' || (!isDay && c.callType === 'weekly')),
      hoofd: isDay ? 1 : 5,
      secondary: isDay ? [3, 5, 10, 20] : [1, 3, 10, 20],
    }
  }, [lens, data])

  const lm = LENS_META[lens]

  return (
    <div className="fb-tool fb-shell">
      {/* ── Zijbalk ── */}
      <aside className="fb-sb">
        <div className="fb-sb-brand">
          <span className="fb-sb-logo">FB</span>
          <span className="fb-sb-brandtxt">
            <b>Fundamental</b>
            <span>Briefing</span>
          </span>
        </div>

        <nav className="fb-sb-nav">
          {NAV.map((item) => (
            <button
              key={item.key}
              className={`fb-sb-item${tab === item.key ? ' active' : ''}`}
              onClick={() => setTab(item.key)}
            >
              <span className="fb-sb-ic">{item.icon}</span>
              <span className="fb-sb-lbl">
                <b>{item.label}</b>
                <span>{item.sub}</span>
              </span>
              {item.key === 'bewijs' && <span className="fb-sb-badge">2j</span>}
            </button>
          ))}
        </nav>

        <div className="fb-sb-foot">
          <button className="fb-sb-tour" onClick={() => setTourIdx(0)}>
            <span>?</span> Rondleiding
          </button>
          <div className="fb-sb-note">Educatief · geen financieel advies</div>
        </div>
      </aside>

      {/* ── Hoofdvenster ── */}
      <div className="fb-main">
        {/* Bovenbalk: stijl-schakelaar + regime + status */}
        <header className="fb-topbar">
          <div className="fb-lens-seg" role="tablist" aria-label="Handelsstijl">
            {(['daytrade', 'swing', 'position'] as Lens[]).map((l) => (
              <button key={l} className={`fb-lens-opt${lens === l ? ' active' : ''}`} onClick={() => setLens(l)}>
                {LENS_META[l].name}
                {l === 'position' && <span className="fb-lens-tag">carry</span>}
              </button>
            ))}
          </div>

          <div className="fb-topbar-right">
            {header && (
              <>
                <span className="fb-tb-regime"><span className={`fb-dot ${header.regimeColor}`} />{header.regime}</span>
                <span className={`fb-tb-lock${header.locked ? '' : ' live'}`} title={header.locked
                  ? 'Vanochtend vastgezet — verandert vandaag niet meer.'
                  : 'Nog geen gelockte snapshot — live berekening.'}>
                  {header.locked
                    ? `🔒 ${new Date(header.date + 'T00:00:00Z').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`
                    : 'live'}
                </span>
              </>
            )}
          </div>
        </header>

        {/* Lens-context (één eerlijke regel) */}
        <div className="fb-lens-ctx">
          <span className="fb-lens-ctx-name">{lm.name}</span>
          <span className="fb-lens-ctx-hz">{lm.horizon}</span>
          <span className="fb-lens-ctx-note">{lm.note}</span>
        </div>

        {/* Marktcontext-rail: valutasterkte (altijd zichtbaar) */}
        {header && (
          <div className="fb-rail">
            <div className="fb-rail-head">Valutasterkte<span className="fb-rail-sub">{header.regimeExplain}</span></div>
            <div className="fb-rail-strip">
              {header.currencyScores.map((c, i) => {
                const maxAbs = Math.max(3, ...header.currencyScores.map((x) => Math.abs(x.score)))
                const pct = Math.min(100, (Math.abs(c.score) / maxAbs) * 100)
                const pos = c.score >= 0
                const edge = i === 0 || i === header.currencyScores.length - 1
                return (
                  <div className={`fb-rail-cell${edge ? ' edge' : ''}`} key={c.currency}>
                    <div className="fb-rail-top">
                      <span className="fb-rail-ccy">{c.currency}</span>
                      <span className="fb-rail-score num" style={{ color: pos ? 'var(--win)' : 'var(--loss)' }}>{pos ? '+' : ''}{c.score.toFixed(1)}</span>
                    </div>
                    <div className="fb-rail-track"><span className="fb-rail-mid" /><span className={`fb-rail-fill ${pos ? 'pos' : 'neg'}`} style={{ width: `${pct / 2}%` }} /></div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <main className="fb-content">
          {tab === 'calls' && <HowItWorks />}

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
                  today={data?.today}
                  emptyText={cfg.kind === 'position'
                    ? 'Geen positie-calls op dit moment. Dat betekent: geen paar met minstens 2 procentpunt renteverschil buiten een Risk-Off-regime — niet handelen is dan de call.'
                    : "Nog geen dagcalls voor vandaag — ze worden 's ochtends gegenereerd."}
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
        </main>
      </div>

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
