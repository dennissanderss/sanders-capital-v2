'use client'

import { useState } from 'react'
import { DirTag, StatusPill, ZoneLabel, InfoTip, Accordion } from '../atoms'
import { Icons } from '../icons'
import {
  adaptToday,
  adaptFxScores,
  adaptCalls,
  adaptReasoning,
  adaptIntermarket,
  adaptSentiment,
  buildFunnel,
} from '../lib/adapters'
import type { ApiBriefingData, DeskCall, DeskIntermarket, DeskSentiment } from '../lib/types'

interface VandaagProps {
  data: ApiBriefingData
}

export function Vandaag({ data }: VandaagProps) {
  const { ready, watch } = adaptCalls(data)
  const today = adaptToday(data, ready.length)
  const fxScores = adaptFxScores(data)
  const intermarket = adaptIntermarket(data)
  const sentiment = adaptSentiment(data)
  const funnel = buildFunnel(data, ready.length)

  return (
    <div className="fade">
      {/* LEADING LINE */}
      <p className="lead-line">
        <span className="le">{today.regime}</span>, {today.confidence}% confidence. {today.readyCount} entry-ready call{today.readyCount === 1 ? '' : 's'} vandaag, sterke valuta tegen zwakke.
      </p>

      {/* ZONE 1 — VERDICT */}
      <div className="verdict-head">
        <div className="vh-item">
          <span className="mono-label labelrow">
            Regime
            <InfoTip title="Regime" align="left">
              <p>Risk-off betekent dat beleggers risico mijden en kapitaal naar veilige havens verschuiven. Risk-on is het omgekeerde.</p>
              <p className="eg">Veilige havens zijn doorgaans <span className="term">USD</span>, <span className="term">JPY</span> en <span className="term">CHF</span>. Risk-on begunstigt juist AUD, NZD en groeigevoelige munten.</p>
            </InfoTip>
          </span>
          <span className="vh-val">
            <span className="regime-flag">
              <span className="dot" style={{ background: today.regimeColor }} />
              {today.regime}
            </span>
          </span>
        </div>
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

        <IntermarketStrip items={intermarket.items} conclusion={intermarket.conclusion} />
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

// ─── Entry-ready card with expandable reasoning ───────────────
function EntryReadyCard({
  call,
  data,
}: {
  call: DeskCall
  data: ApiBriefingData
}) {
  const [open, setOpen] = useState(false)
  const reasoning = open ? adaptReasoning(data, call) : null

  // Real 4-component conviction breakdown (lib/conviction.ts).
  // Bars are scaled to each component's maximum so the eye reads
  // them against their own ceiling rather than the largest other bar.
  const breakdown = call.breakdown
    ? [
        { k: 'Fundamentele onbalans', v: call.breakdown.fundPts, max: 4 },
        { k: 'Contrarian (5d momentum)', v: call.breakdown.contrarianPts, max: 2.5 },
        { k: 'Intermarket alignment', v: call.breakdown.imPts, max: 2 },
        { k: 'Regime-alignment', v: call.breakdown.regimePts, max: 1.5 },
      ]
    : null

  return (
    <div className={`call-card${open ? ' open' : ''}`}>
      <div className="cc-top">
        <span className="cc-pair">{call.pair}</span>
        <DirTag dir={call.dir} />
      </div>
      <div className="cc-note">{call.note}</div>
      <div className="cc-row">
        <div>
          <span className="mono-label cc-score-label labelrow">
            Score
            <InfoTip pos="top" align="left" title="Conviction-score">
              <p>Een score van 0 tot 10 voor de fundamentele overtuiging achter de call. Hoe hoger, hoe sterker de case.</p>
              <p className="eg">
                <span className="stat">Calls van 8+ wonnen historisch boven 60%.</span>
              </p>
            </InfoTip>
          </span>
          <span className="cc-score num">{call.score.toFixed(1)}</span>
        </div>
        <StatusPill status={call.status} />
      </div>
      <div className="cc-foot">
        <button className={`flowlink ghost${open ? ' open' : ''}`} onClick={() => setOpen((o) => !o)}>
          Redenering <Icons.Chevron size={13} />
        </button>
      </div>
      {open && reasoning && (
        <div className="cc-reason">
          <div className="cr-item">
            <span className="cr-k">Regime-bijdrage</span>
            <p>{reasoning.regime}</p>
          </div>
          <div className="cr-item">
            <span className="cr-k">Nieuws-sentiment</span>
            <p>{reasoning.nieuws}</p>
          </div>
          <div className="cr-item">
            <span className="cr-k">Intermarket-bevestiging</span>
            <p>{reasoning.intermarket}</p>
          </div>
          <div className="cr-item">
            <span className="cr-k">Score-opbouw (qualityScore)</span>
            <div className="cr-bars">
              {(breakdown || []).map(({ k, v, max }) => (
                <div className="cr-bar" key={k}>
                  <span className="cb-k">{k}</span>
                  <span className="cb-track">
                    <span style={{ width: `${Math.min(100, (v / max) * 100)}%` }} />
                  </span>
                  <span className="cb-v num">{v.toFixed(1)}</span>
                </div>
              ))}
              <div className="cr-bar total">
                <span className="cb-k">Conviction</span>
                <span className="cb-track" />
                <span className="cb-v num">{call.score.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Intermarket strip ────────────────────────────────────────
function IntermarketStrip({ items, conclusion }: { items: DeskIntermarket[]; conclusion: string }) {
  const [openIM, setOpenIM] = useState<string | null>(null)
  if (items.length === 0) return null
  return (
    <div className="strip">
      <div className="strip-head">
        <span className="strip-title">Intermarket</span>
      </div>
      <div className="im-row">
        {items.map((it) => (
          <div className="im-item" key={it.key}>
            <span className="mono-label">{it.label}</span>
            <span className="im-val num">{it.value}</span>
            <span className={`im-chg ${it.dir}`}>
              {it.dir === 'up' ? <Icons.Arrow size={11} /> : it.dir === 'down' ? <Icons.ArrowDown size={11} /> : <Icons.Dot size={9} />}
              {it.chg}
            </span>
            <button className="im-details" onClick={() => setOpenIM(openIM === it.key ? null : it.key)}>
              {openIM === it.key ? 'verbergen' : 'details'}
            </button>
          </div>
        ))}
      </div>
      <div className="im-concl">
        <span className="d" />
        {conclusion}
      </div>
      {openIM && (
        <div className="im-drawer">
          <strong>{items.find((i) => i.key === openIM)?.label}.</strong> {items.find((i) => i.key === openIM)?.duiding}
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
