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
  getCurrencyFactorBreakdown,
  getPairMomentum,
  getPairIntermarket,
  getRegimeAlignmentText,
  getRegimeDrivers,
  adaptIntermarketSection,
} from '../lib/adapters'
import type { ApiBriefingData, DeskCall, DeskSentiment } from '../lib/types'

interface VandaagProps {
  data: ApiBriefingData
}

export function Vandaag({ data }: VandaagProps) {
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
            <EntryReadyCard key={c.pair} call={c} data={data} />
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

// ─── Entry-ready card with subscore drill-down ────────────────
function EntryReadyCard({ call, data }: { call: DeskCall; data: ApiBriefingData }) {
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
      </div>

      {open && (
        <div className="cc-reason">
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
              <span className="sub-val num accent">{call.score.toFixed(1)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function renderSubDetail(key: string, data: ApiBriefingData, call: DeskCall) {
  if (key === 'fund') {
    const baseFb = getCurrencyFactorBreakdown(data, call.base)
    const quoteFb = getCurrencyFactorBreakdown(data, call.quote)
    const cols = [baseFb, quoteFb].filter((x): x is NonNullable<typeof x> => x !== null)
    if (cols.length === 0) return <p className="sub-note">Factor-breakdown niet beschikbaar.</p>
    return (
      <div className="factor-grid">
        {cols.map((fb) => (
          <div className="factor-col" key={fb.currency}>
            <div className="factor-col-head">
              <span className="fc-cur">{fb.currency}</span>
              <span className="fc-total num">{fb.weightedTotal > 0 ? '+' : ''}{fb.weightedTotal.toFixed(1)}</span>
            </div>
            {fb.rows.map((r) => (
              <div className="factor-row" key={r.key}>
                <span className="fr-label">{r.label}</span>
                <span className="fr-val num">{r.value > 0 ? '+' : ''}{r.value.toFixed(1)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }
  if (key === 'mom') {
    const m = getPairMomentum(data, call)
    if (!m) return <p className="sub-note">Momentum-data niet beschikbaar.</p>
    return (
      <div className="sub-lines">
        <div className="sub-line"><span>Beweging (5 dagen)</span><span className="num">{m.pipMove > 0 ? '+' : ''}{m.pipMove} pips</span></div>
        <div className="sub-line"><span>Zone</span><span>{m.zoneLabel}</span></div>
        <p className="sub-note">{m.contrarianPass ? 'De prijs bewoog tégen de fundamentele richting — een mean-reversion kans.' : 'De prijs liep al mee met de fundamentals.'}</p>
      </div>
    )
  }
  if (key === 'im') {
    const im = getPairIntermarket(data, call)
    if (!im || im.instruments.length === 0) return <p className="sub-note">Intermarket-data niet beschikbaar.</p>
    return (
      <div className="sub-lines">
        <div className="sub-line"><span>Alignment</span><span className="num">{im.alignment}%</span></div>
        {im.instruments.map((ins, i) => (
          <div className="im-pair-row" key={i}>
            <span className="ipr-name">{ins.name}</span>
            <span className="ipr-rel">{ins.relevance}</span>
          </div>
        ))}
      </div>
    )
  }
  if (key === 'regime') {
    const r = getRegimeAlignmentText(data, call)
    return (
      <div className="sub-lines">
        <span className={`confirm-tag ${r.aligned ? 'yes' : 'no'}`}>{r.aligned ? 'past in regime' : 'neutraal in regime'}</span>
        <p className="sub-note">{r.text}</p>
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
