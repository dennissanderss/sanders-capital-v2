'use client'

import { useState } from 'react'
import { DirTag, StatusPill, ZoneLabel, InfoTip, Accordion } from '../atoms'
import { Icons } from '../icons'
import {
  adaptToday,
  adaptFxScores,
  adaptCalls,
  adaptSentiment,
  buildFunnel,
  getFundamentalBreakdown,
  getPairMomentum,
  getPairIntermarket,
  getRegimeAlignmentText,
  getRegimeDrivers,
  adaptIntermarketSection,
} from '../lib/adapters'
import type { ApiBriefingData, DeskCall, DeskSentiment } from '../lib/types'

interface VandaagProps {
  data: ApiBriefingData
  onGoCalls?: () => void
}

export function Vandaag({ data, onGoCalls }: VandaagProps) {
  const { ready, watch } = adaptCalls(data)
  const today = adaptToday(data, ready.length)
  const fxScores = adaptFxScores(data)
  const sentiment = adaptSentiment(data)
  const funnel = buildFunnel(data, ready.length)
  const [regimeOpen, setRegimeOpen] = useState(false)
  const drivers = getRegimeDrivers(data)

  return (
    <div className="fade">
      {/* LEADING LINE */}
      <p className="lead-line">
        <span className="le">{today.regime}</span>, {today.confidence}% confidence. {today.readyCount} entry-ready call{today.readyCount === 1 ? '' : 's'} vandaag, sterke valuta tegen zwakke.
      </p>

      {/* ZONE 1 — VERDICT (regime banner, uitklapbaar) */}
      <div className="verdict-wrap">
        <div className="verdict-head">
          <button className="vh-item vh-clickable" onClick={() => setRegimeOpen((o) => !o)} aria-expanded={regimeOpen}>
            <span className="mono-label">Regime</span>
            <span className="vh-val">
              <span className="regime-flag">
                <span className="dot" style={{ background: today.regimeColor }} />
                {today.regime}
              </span>
            </span>
            <Icons.Chevron size={15} className={`vh-chev${regimeOpen ? ' open' : ''}`} />
          </button>
          <div className="vh-sep" />
          <div className="vh-item">
            <span className="mono-label">Confidence</span>
            <span className="vh-val num">{today.confidence}%</span>
          </div>
          <div className="vh-sep" />
          <div className="vh-item">
            <span className="mono-label">Datum</span>
            <span className="vh-val dt">{today.date}</span>
          </div>
        </div>
        {regimeOpen && (
          <div className="regime-panel">
            {data.regimeExplain && <p className="regime-oneline">{data.regimeExplain}</p>}
            {drivers.length > 0 && (
              <div className="regime-why">
                <span className="cr-k">Waarom {today.regime}?</span>
                <ul className="why-list">
                  {drivers.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
            {!data.regimeExplain && drivers.length === 0 && (
              <p className="regime-oneline" style={{ color: 'var(--ink-3)' }}>Geen aanvullende toelichting beschikbaar.</p>
            )}
          </div>
        )}
      </div>

      <ZoneLabel live>Entry-ready vandaag</ZoneLabel>
      {ready.length === 0 ? (
        <div className="strip" style={{ padding: '22px 18px', color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
          Geen entry-ready calls vandaag. Bekijk de watchlist hieronder.
        </div>
      ) : (
        <div className="call-cards">
          {ready.map((c) => (
            <EntryReadyCard key={c.pair} call={c} data={data} onGoCalls={onGoCalls} />
          ))}
        </div>
      )}

      {/* ZONE 2 — WATCHLIST */}
      <div className="section-gap">
        <ZoneLabel>Watchlist</ZoneLabel>
        {watch.length === 0 ? (
          <div className="strip" style={{ padding: '22px 18px', color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
            Geen watchlist-calls vandaag.
          </div>
        ) : (
          <div className="watch-cards">
            {watch.map((c) => (
              <div className="watch-card" key={c.pair}>
                <div className="wc-top">
                  <span className="wc-pair">{c.pair}</span>
                  <DirTag dir={c.dir} />
                </div>
                <div className="wc-reason">
                  <Icons.Clock size={12} />
                  {c.wait || 'Wacht op bevestiging'}
                </div>
                <div className="wc-foot">
                  <span className="wc-score num">Score {c.score.toFixed(1)}</span>
                  <StatusPill status="watch" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ZONE 3 — MARKTBEELD */}
      <div className="section-gap">
        <ZoneLabel
          info={
            <InfoTip title="Marktbeeld" align="left">
              <p>De onderbouwing naast de calls: valutascores, intermarket-signalen en sentiment. Compact gehouden, details een klik dieper.</p>
            </InfoTip>
          }
        >
          Marktbeeld
        </ZoneLabel>

        {/* Currency scores */}
        <div className="strip">
          <div className="strip-head">
            <span className="strip-title labelrow">
              Valutascores
              <InfoTip title="Valutascores" align="left">
                <p>Elke munt krijgt een score van zwak (negatief) tot sterk (positief). Het verschil tussen twee munten bepaalt de richting van de call.</p>
                <p className="eg">Voorbeeld: <span className="term">USD +3,8</span> tegenover <span className="term">AUD -3,1</span> geeft een sterke AUD/USD short.</p>
              </InfoTip>
            </span>
          </div>
          <div className="fx-grid flush">
            {fxScores.map((f) => {
              const pct = Math.min(50, (Math.abs(f.score) / 5) * 50)
              const pos = f.score >= 0
              return (
                <div className="fx-cell" key={f.code}>
                  <div className="fx-top">
                    <span className="fx-code">{f.code}</span>
                    <span className="fx-score num" style={{ color: pos ? 'var(--ink)' : 'var(--ink-3)' }}>
                      {pos ? '+' : ''}
                      {f.score.toFixed(1)}
                    </span>
                  </div>
                  <div className="fx-bar">
                    <span className="fx-mid" />
                    <span className={pos ? 'pos' : 'neg'} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <IntermarketSection data={data} />
        <SentimentStrip items={sentiment} />
      </div>

      {/* ZONE 4 — METHODIEK */}
      <div className="section-gap">
        <Accordion title="Methodiek" hint="Proces, filter funnel en databronnen">
          <div className="method-grid">
            <div className="method">
              <h5>Proces</h5>
              <div className="proc-steps">
                {[
                  { n: '01', name: 'Macro Regime', desc: 'Bepaalt de heersende risicohouding (risk-on, risk-off of neutraal) uit rente, groei en centralebankbeleid.' },
                  { n: '02', name: 'Nieuws Sentiment', desc: 'Weegt de nieuwsstroom per valuta tot een sentimentstand: positief, neutraal of negatief.' },
                  { n: '03', name: 'Intermarket', desc: 'Toetst de these aan VIX, aandelen, goud, de dollar en rentes voor bevestiging.' },
                  { n: '04', name: 'Trade Focus', desc: 'Vertaalt de sterkste fundamentele onbalansen naar concrete calls met een conviction-score.' },
                ].map((p) => (
                  <div className="proc-step" key={p.n}>
                    <span className="ps-n">{p.n}</span>
                    <div>
                      <div className="ps-name">{p.name}</div>
                      <div className="ps-desc">{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="method">
              <h5>Filter funnel</h5>
              <div className="funnel">
                {funnel.map((f, i) => {
                  const w = funnel[0].count > 0 ? Math.round((f.count / funnel[0].count) * 100) : 0
                  const last = i === funnel.length - 1
                  return (
                    <div className={`fn-row${last ? ' final' : ''}`} key={i}>
                      <span className="fn-label">{f.label}</span>
                      <div className="fn-bar">
                        <span style={{ width: `${w}%` }} />
                      </div>
                      <span className="fn-count num">{f.count}</span>
                    </div>
                  )
                })}
              </div>
              <div className="fn-note">
                Van {funnel[0].count} paren krimpt het universum naar {funnel[funnel.length - 1].count} concrete call
                {funnel[funnel.length - 1].count === 1 ? '' : 's'}.
              </div>
            </div>
          </div>
          <div className="method-sources">
            <h5>Databronnen</h5>
            <div className="src-list">
              {[
                'Centralebank-rates (Supabase)',
                'Macro-agenda (Forex Factory)',
                'Nieuws RSS (Fed, ECB, ForexLive, CNBC e.a.)',
                'Intermarket (Yahoo Finance)',
                'FX koersen (Yahoo Finance)',
              ].map((s, i) => (
                <span className="src-chip" key={i}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        </Accordion>
      </div>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────
const sgn = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1)
const fmtPrice = (p: number | null, jpy: boolean) => (p == null ? '—' : p.toFixed(jpy ? 3 : 5))
const fmtDay = (iso: string | null) => {
  if (!iso) return ''
  try { return new Date(iso + 'T00:00:00Z').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' }) } catch { return iso }
}

// ─── Entry-ready card with subscore drill-down ────────────────
function EntryReadyCard({ call, data, onGoCalls }: { call: DeskCall; data: ApiBriefingData; onGoCalls?: () => void }) {
  const [open, setOpen] = useState(false)
  const [openSub, setOpenSub] = useState<string | null>(null)

  const b = call.breakdown
  const subs = b
    ? [
        { key: 'fund', label: 'Fundamentele onbalans', val: b.fundPts },
        { key: 'mom', label: '5d momentum', val: b.contrarianPts },
        { key: 'im', label: 'Intermarket alignment', val: b.imPts },
        { key: 'regime', label: 'Regime alignment', val: b.regimePts },
      ]
    : []

  // Voorwaarden om "entry-ready" (een call) te zijn — de echte drempels.
  const mom = getPairMomentum(data, call)
  const imAlign = Math.round(data.intermarketAlignment ?? 0)
  const criteria = [
    { label: 'Fundamentele onbalans — score ≥ 2,0', val: Math.abs(call.fundScore).toFixed(1), ok: Math.abs(call.fundScore) >= 2.0 },
    { label: '5d momentum — tégen de richting (contrarian)', val: mom ? `${mom.pipMove > 0 ? '+' : ''}${mom.pipMove}p` : '—', ok: mom?.contrarianPass ?? false },
    { label: 'Intermarket alignment ≥ 50%', val: `${imAlign}%`, ok: imAlign >= 50 },
    { label: 'Duidelijke richting (long/short)', val: call.dir === 'long' ? 'Long' : 'Short', ok: true },
  ]

  return (
    <div className={`call-card${open ? ' open' : ''}`}>
      <div className="cc-top">
        <span className="cc-pair">{call.pair}</span>
        <DirTag dir={call.dir} />
      </div>
      <div className="cc-note">{call.note}</div>
      <div className="cc-row">
        <div>
          <span className="mono-label cc-score-label">Score</span>
          <span className="cc-score num">{call.score.toFixed(1)}</span>
        </div>
        <StatusPill status={call.status} />
      </div>
      <div className="cc-foot">
        <button className={`flowlink ghost${open ? ' open' : ''}`} onClick={() => setOpen((o) => !o)}>
          Redenering <Icons.Chevron size={13} />
        </button>
        {call.status === 'ready' && onGoCalls && (
          <button className="flowlink" onClick={onGoCalls}>
            Bekijk in Calls <Icons.ArrowRight size={13} />
          </button>
        )}
      </div>

      {open && b && (
        <div className="cc-reason">
          <div className="call-criteria">
            <span className="cc-crit-title">Wanneer is het een call?</span>
            {criteria.map((c, i) => (
              <div className="crit-row" key={i}>
                <span className={`crit-mark ${c.ok ? 'ok' : 'no'}`}>{c.ok ? '✓' : '✗'}</span>
                <span className="crit-label">{c.label}</span>
                <span className="crit-val num">{c.val}</span>
              </div>
            ))}
            <p className="crit-note">Voldoet aan alle vier → <b>entry-ready</b>. Dit zijn dezelfde drie subscores hieronder (onbalans, momentum, intermarket) + de richting. <b>Regime alignment</b> is géén voorwaarde — die telt alleen mee voor de conviction (de kwaliteit, 0-10).</p>
          </div>
          <p className="sub-intro">De conviction (max 10) is de optelsom van vier subscores. Klik een rij open voor de berekening.</p>
          <div className="sub-rows">
            {subs.map((s) => (
              <div className={`sub-row${openSub === s.key ? ' open' : ''}`} key={s.key}>
                <button className="sub-row-head" onClick={() => setOpenSub((k) => (k === s.key ? null : s.key))}>
                  <span className="sub-label">{s.label}</span>
                  <span className="sub-val num">{s.val.toFixed(1)}</span>
                  <Icons.Chevron size={12} className={`sub-chev${openSub === s.key ? ' open' : ''}`} />
                </button>
                {openSub === s.key && <div className="sub-detail">{renderSubDetail(s.key, data, call)}</div>}
              </div>
            ))}
            <div className="sub-total">
              <span className="sub-label">Conviction</span>
              <span className="sub-sum num">{b.fundPts.toFixed(1)} + {b.contrarianPts.toFixed(1)} + {b.imPts.toFixed(1)} + {b.regimePts.toFixed(1)}</span>
              <span className="sub-val num accent">{call.score.toFixed(1)}</span>
            </div>
          </div>
          <p className="sub-livenote">Dit is de <b>live</b> stand — score, regime en intermarket bewegen gedurende de dag mee. In de <b>Calls-tab</b> staat de conviction zoals die bij het uitsturen van de call is vastgelegd; die kan daarom afwijken.</p>
        </div>
      )}
    </div>
  )
}

function renderSubDetail(key: string, data: ApiBriefingData, call: DeskCall) {
  const b = call.breakdown
  const jpy = call.pair.includes('JPY')

  if (key === 'fund') {
    const fb = getFundamentalBreakdown(data, call)
    return (
      <div className="sub-lines">
        <p className="sub-explain">Het verschil tussen beide valutascores. Per valuta: centralebankbeleid (×2) + rente vs. doel + nieuws.</p>
        <div className="factor-grid">
          {[fb.base, fb.quote].map((c) => (
            <div className="factor-col" key={c.currency}>
              <div className="factor-col-head">
                <span className="fc-cur">{c.currency}</span>
                <span className="fc-total num">{sgn(c.total)}</span>
              </div>
              <div className="factor-row"><span className="fr-label">CB-beleid{c.biasLabel ? ` · ${c.biasLabel}` : ''}</span><span className="fr-val num">{sgn(c.cb)}</span></div>
              <div className="factor-row"><span className="fr-label">Rente vs. doel</span><span className="fr-val num">{sgn(c.rate)}</span></div>
              <div className="factor-row"><span className="fr-label">Nieuws</span><span className="fr-val num">{sgn(c.news)}</span></div>
            </div>
          ))}
        </div>
        <p className="sub-formula">
          Verschil: {call.base} {sgn(fb.base.total)} − {call.quote} {sgn(fb.quote.total)} = <b>{sgn(fb.diff)}</b><br />
          Geschaald: min(|{fb.diff.toFixed(1)}| ÷ 5, 1) × 4 = <b className="accent">{(b?.fundPts ?? 0).toFixed(1)}</b>
        </p>
      </div>
    )
  }

  if (key === 'mom') {
    const m = getPairMomentum(data, call)
    if (!m) return <p className="sub-note">Momentum-data niet beschikbaar.</p>
    const pts = b?.contrarianPts ?? 0
    return (
      <div className="sub-lines">
        <p className="sub-explain">De koers moet de afgelopen 5 dagen tégen de fundamentele richting zijn bewogen (mean-reversion: koop de dip / verkoop de rally).</p>
        {m.price5dAgo != null && m.priceNow != null && (
          <>
            <div className="sub-line"><span>Start{m.date5dAgo ? ` · ${fmtDay(m.date5dAgo)}` : ' (5d geleden)'}</span><span className="num">{fmtPrice(m.price5dAgo, jpy)}</span></div>
            <div className="sub-line"><span>Nu{m.dateNow ? ` · ${fmtDay(m.dateNow)}` : ''}</span><span className="num">{fmtPrice(m.priceNow, jpy)}</span></div>
          </>
        )}
        <div className="sub-line"><span>Beweging</span><span className={`num ${m.pipMove >= 0 ? 'pos' : 'neg'}`}>{m.pipMove > 0 ? '+' : ''}{m.pipMove} pips</span></div>
        <div className="sub-line"><span>Zone</span><span>{Math.abs(m.pipMove)}p · {m.zoneLabel}</span></div>
        <p className="sub-formula">
          {m.contrarianPass
            ? (m.inZone ? 'Tegen de richting én in optimale zone (30-120p) → ' : 'Tegen de richting, maar buiten optimale zone → ')
            : 'Liep mee met de fundamentals (geen mean-reversion) → '}
          <b className="accent">{pts.toFixed(1)}</b>
        </p>
      </div>
    )
  }

  if (key === 'im') {
    const im = getPairIntermarket(data, call)
    if (!im) return <p className="sub-note">Intermarket-data niet beschikbaar.</p>
    const pts = b?.imPts ?? 0
    return (
      <div className="sub-lines">
        <p className="sub-explain">Alignment = welk deel van de markt-brede signalen (VIX, aandelen, goud, dollar, rente) bij deze richting past. 100% = alles bevestigt, 0% = alles spreekt tegen.</p>
        <div className="sub-line"><span>Alignment</span><span className="num">{im.alignment}%</span></div>
        <p className="sub-formula">{im.alignment}% ÷ 100 × 2 = <b className="accent">{pts.toFixed(1)}</b></p>
        {im.instruments.length > 0 && (
          <div className="im-relevance">
            {im.instruments.map((ins, i) => (
              <div className="im-pair-row" key={i}>
                <span className="ipr-name">{ins.name}</span>
                <span className="ipr-rel">{ins.relevance}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (key === 'regime') {
    const r = getRegimeAlignmentText(data, call)
    const pts = b?.regimePts ?? 0
    return (
      <div className="sub-lines">
        <p className="sub-explain">Past de richting van deze call bij het huidige marktregime ({data.regime})?</p>
        <span className={`confirm-tag ${r.aligned ? 'yes' : 'no'}`}>{r.aligned ? 'past in regime' : 'neutraal'}</span>
        <p className="sub-note">{r.text}</p>
        <p className="sub-formula">{r.aligned ? 'Past in het regime → ' : 'Neutraal in het regime → '}<b className="accent">{pts.toFixed(1)}</b></p>
      </div>
    )
  }
  return null
}

// ─── Intermarket section (drill-down met uitleg per instrument) ─
function IntermarketSection({ data }: { data: ApiBriefingData }) {
  const [open, setOpen] = useState(false)
  const sec = adaptIntermarketSection(data)
  if (sec.instruments.length === 0) return null
  return (
    <div className="strip">
      <button className="im-head-card" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="strip-title">Intermarket</span>
        <span className="im-align">
          <span className="im-align-pct num">{sec.alignment}%</span>
          <span className="im-align-label">{sec.label}</span>
        </span>
        <Icons.Chevron size={14} className={`im-head-chev${open ? ' open' : ''}`} />
      </button>
      <div className="im-concl">
        <span className="d" />
        {sec.conclusion}
      </div>
      {open && (
        <div className="im-list">
          {sec.instruments.map((ins) => (
            <div className="im-list-row" key={ins.key}>
              <div className="im-meta">
                <span className="im-name">{ins.label}</span>
                <span className="im-desc">{ins.description}</span>
                <span className="im-interp">{ins.interpretation}</span>
              </div>
              <div className="im-right">
                <span className="im-val num">{ins.value}</span>
                <span className={`im-chg ${ins.dir}`}>
                  {ins.dir === 'up' ? <Icons.Arrow size={11} /> : ins.dir === 'down' ? <Icons.ArrowDown size={11} /> : <Icons.Dot size={9} />}
                  {ins.chg}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sentiment strip ──────────────────────────────────────────
function SentimentStrip({ items }: { items: DeskSentiment[] }) {
  const [openH, setOpenH] = useState(false)
  return (
    <div className="strip">
      <div className="strip-head">
        <span className="strip-title">Sentiment per valuta</span>
        <button className={`flowlink hl${openH ? ' open' : ''}`} onClick={() => setOpenH((o) => !o)}>
          headlines <Icons.Chevron size={13} />
        </button>
      </div>
      <div className="sent-row">
        {items.map((s) => (
          <div className="sent-item" key={s.code}>
            <span className="sent-code">{s.code}</span>
            <span className={`sent-bar ${s.stand}`}>
              <i />
              <i />
              <i />
            </span>
            <span className={`sent-tag ${s.stand}`}>{s.stand[0].toUpperCase() + s.stand.slice(1)}</span>
          </div>
        ))}
      </div>
      {openH && (
        <div className="sent-drawer">
          <div className="cols">
            {items.map((s) => (
              <div className="sh-item" key={s.code}>
                <span className="sh-code">{s.code}</span>
                <span className="sh-list">
                  {s.headlines.length === 0 ? (
                    <span style={{ color: 'var(--ink-4)' }}>Geen recente headlines</span>
                  ) : (
                    s.headlines.map((h, i) => <span key={i}>{h}</span>)
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
