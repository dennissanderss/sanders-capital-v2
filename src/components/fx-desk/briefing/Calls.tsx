'use client'

import { useEffect, useMemo, useState } from 'react'
import { DirTag, OutcomeChip, ResultChip, fmt } from '../atoms'
import { Icons } from '../icons'
import { PriceChart } from '../PriceChart'
import { adaptTrackRecord } from '../lib/adapters'
import type { ApiTrackRecord, DeskCallHistoryRecord } from '../lib/types'

interface CallsProps {
  records: ApiTrackRecord[]
  loading?: boolean
}

type OutcomeFilter = 'alle' | 'correct' | 'incorrect' | 'pending'

export function Calls({ records, loading }: CallsProps) {
  const desk = useMemo(() => adaptTrackRecord(records || []), [records])

  // Bron-filter (alle / fundamenteel / engine) is verwijderd: er zijn geen
  // engine-records in trade_focus_records (alle 688 hebben metadata.source = 'v2').
  // Filter kwam alleen als bron van verwarring. Houd alleen uitkomst + paar.
  const [out, setOut] = useState<OutcomeFilter>('alle')
  const [pairFilter, setPairFilter] = useState<string>('alle')
  const [selId, setSelId] = useState<string | null>(null)

  const allPairs = useMemo(() => Array.from(new Set(desk.map((d) => d.pair))).sort(), [desk])

  const filtered = useMemo(() => {
    return desk.filter((d) => {
      if (out !== 'alle' && d.outcome !== out) return false
      if (pairFilter !== 'alle' && d.pair !== pairFilter) return false
      return true
    })
  }, [desk, out, pairFilter])

  useEffect(() => {
    if (filtered.length === 0) {
      setSelId(null)
      return
    }
    if (!selId || !filtered.find((d) => d.id === selId)) {
      setSelId(filtered[0].id)
    }
  }, [filtered, selId])

  const sel: DeskCallHistoryRecord | null = useMemo(() => {
    if (!selId) return filtered[0] || null
    return desk.find((d) => d.id === selId) || filtered[0] || null
  }, [desk, filtered, selId])

  const stats = useMemo(() => {
    const resolved = desk.filter((d) => d.outcome !== 'pending')
    const wins = resolved.filter((d) => d.outcome === 'correct')
    const losses = resolved.filter((d) => d.outcome === 'incorrect')
    const winPips = wins.reduce((s, d) => s + Math.max(0, d.pips || 0), 0)
    const lossPips = losses.reduce((s, d) => s + Math.abs(Math.min(0, d.pips || 0)), 0)
    const totalPips = Math.round(resolved.reduce((s, d) => s + (d.pips || 0), 0))
    return {
      resolved: resolved.length,
      wins: wins.length,
      losses: losses.length,
      pending: desk.filter((d) => d.outcome === 'pending').length,
      winrate: resolved.length ? Math.round((wins.length / resolved.length) * 100) : 0,
      totalPips,
      profitFactor: lossPips > 0 ? +(winPips / lossPips).toFixed(2) : wins.length > 0 ? 99 : 0,
    }
  }, [desk])

  return (
    <div className="fade">
      <p style={{
        fontSize: 13,
        color: 'var(--ink-2)',
        margin: '0 0 22px',
        lineHeight: 1.5,
        maxWidth: '60ch',
      }}>
        De backtest. Elke call uit het trackrecord met instap, take profit, stop, uitkomst en de koersgrafiek per trade. Filter op uitkomst of paar.
      </p>

      {/* Prestatie-overzicht (volledige trackrecord) */}
      <div className="perf-summary">
        <div className="ps"><span className="mono-label">Calls afgerond</span><span className="ps-v num">{stats.resolved}</span></div>
        <div className="ps"><span className="mono-label">Wins</span><span className="ps-v num pos">{stats.wins}</span></div>
        <div className="ps"><span className="mono-label">Verlies</span><span className="ps-v num neg">{stats.losses}</span></div>
        <div className="ps"><span className="mono-label">Winrate</span><span className="ps-v num accent">{stats.winrate}%</span></div>
        <div className="ps"><span className="mono-label">Totaal pips</span><span className={`ps-v num ${stats.totalPips >= 0 ? 'pos' : 'neg'}`}>{stats.totalPips >= 0 ? '+' : ''}{stats.totalPips}</span></div>
        <div className="ps"><span className="mono-label">Profit factor</span><span className="ps-v num">{stats.profitFactor}</span></div>
        <div className="ps"><span className="mono-label">Open</span><span className="ps-v num">{stats.pending}</span></div>
      </div>

      <div className="calls-layout">
        {/* LEFT — filters + list */}
        <div>
          <div className="filterbar">
            <FilterGroup label="Uitkomst" options={[
              { id: 'alle', label: 'Alle' },
              { id: 'correct', label: 'Win' },
              { id: 'incorrect', label: 'Loss' },
              { id: 'pending', label: 'Open' },
            ]} value={out} onChange={(v) => setOut(v as OutcomeFilter)} />
          </div>
          {allPairs.length > 0 && (
            <div className="filterbar">
              <label className="mono-label" style={{ alignSelf: 'center', marginRight: 4 }}>Paar</label>
              <select
                value={pairFilter}
                onChange={(e) => setPairFilter(e.target.value)}
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                  fontSize: 12,
                  padding: '7px 12px',
                  borderRadius: 2,
                  fontFamily: 'inherit',
                }}
              >
                <option value="alle">Alle paren</option>
                {allPairs.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginBottom: 10 }}>
            {loading ? 'Laden…' : `${filtered.length} call${filtered.length === 1 ? '' : 's'}`}
          </div>

          <div className="call-list">
            {filtered.length === 0 ? (
              <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                {loading ? 'Calls worden geladen…' : 'Geen calls voldoen aan dit filter.'}
              </div>
            ) : (
              filtered.slice(0, 100).map((c) => (
                <div key={c.id} className={`row${c.id === selId ? ' sel' : ''}`} onClick={() => setSelId(c.id)}>
                  <div className="cl-pair">
                    <DirTag dir={c.dir} />
                    <div>
                      <div className="p">{c.pair}</div>
                      <div className="cl-meta">
                        {c.date} · <span className="src-tag">{c.src}</span>
                      </div>
                    </div>
                  </div>
                  <div className="cl-score num">{c.score.toFixed(1)}</div>
                  <OutcomeChip outcome={c.outcome} />
                </div>
              ))
            )}
          </div>
          {filtered.length > 100 && (
            <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 8, textAlign: 'center' }}>
              Eerste 100 van {filtered.length} getoond. Filter strakker voor specifieke calls.
            </div>
          )}
        </div>

        {/* RIGHT — detail */}
        <div className="detail">
          {!sel ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              Selecteer een call links om de details te zien.
            </div>
          ) : (
            <>
              <div className="detail-head">
                <div>
                  <div className="detail-pair">{sel.pair}</div>
                  <div className="detail-headtags">
                    <DirTag dir={sel.dir} />
                    <span className="src-tag">{sel.src}</span>
                  </div>
                </div>
                <ResultChip outcome={sel.outcome} />
              </div>

              <div className="chart-wrap">
                <PriceChart
                  pair={sel.pair}
                  entry={sel.entry}
                  tp={sel.tp}
                  sl={sel.sl}
                  calledAt={sel.calledAt}
                  closedAt={sel.closedAt}
                  outcome={sel.outcome}
                  dir={sel.dir}
                />
                <div className="chart-legend">
                  <span className="lg">
                    <span className="sw" style={{ borderTopColor: 'var(--gold)' }} />
                    Koers / instap
                  </span>
                  <span className="lg">
                    <span className="sw" style={{ borderTopColor: 'var(--win)', borderTopStyle: 'dashed' }} />
                    Take profit
                  </span>
                  <span className="lg">
                    <span className="sw" style={{ borderTopColor: 'var(--loss)', borderTopStyle: 'dashed' }} />
                    Stop
                  </span>
                </div>
              </div>

              <div className="detail-fields">
                <div className="df">
                  <span className="k mono-label">Gecalled op</span>
                  <span className="v dt">{sel.calledAt}</span>
                </div>
                <div className="df">
                  <span className="k mono-label">Instap</span>
                  <span className="v num">{fmt(sel.entry, sel.entry > 50 ? 2 : 4)}</span>
                </div>
                <div className="df">
                  <span className="k mono-label">Take profit</span>
                  <span className="v num">{fmt(sel.tp, sel.tp > 50 ? 2 : 4)}</span>
                  <span className={`tp-badge ${sel.outcome === 'correct' ? 'yes' : sel.outcome === 'incorrect' ? 'no' : 'open'}`}>
                    {sel.outcome === 'correct' ? 'TP gehit: ja' : sel.outcome === 'incorrect' ? 'TP gehit: nee' : 'Nog niet geraakt'}
                  </span>
                </div>
                <div className="df">
                  <span className="k mono-label">Stop</span>
                  <span className="v num">{fmt(sel.sl, sel.sl > 50 ? 2 : 4)}</span>
                </div>
                <div className="df">
                  <span className="k mono-label">Gesloten op</span>
                  <span className="v dt">{sel.closedAt || 'Open positie'}</span>
                </div>
                <div className="df">
                  <span className="k mono-label">Duur</span>
                  <span className="v dt">{sel.durationText}</span>
                </div>
                <div className="df">
                  <span className="k mono-label">Resultaat</span>
                  <span className={`v num${sel.pips == null ? '' : sel.pips >= 0 ? ' pos' : ' neg'}`}>
                    {sel.pips == null ? '—' : `${sel.pips >= 0 ? '+' : ''}${sel.pips}`}
                    {sel.pips != null && <span className="unit"> pips</span>}
                  </span>
                </div>
                <div className="df">
                  <span className="k mono-label">Score</span>
                  <span className="v num" style={{ color: 'var(--gold)' }}>{sel.score.toFixed(1)}</span>
                </div>
              </div>

              <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-2)', margin: '16px 0 0' }}>{sel.note}</p>

              <ScoreDrilldown key={sel.id} sel={sel} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Score drill-down — waarom scoort deze call X? ────────────
// Toont dezelfde 4 subscores als de live entry-ready kaart in Vandaag,
// maar opgebouwd uit de waarden die bij het uitsturen van de call zijn
// vastgelegd (metadata). De diepere fund-sublaag per valuta (CB/rente/
// nieuws) en exacte momentum-koersen bestaan alleen live; voor een
// historische call tonen we de paar-score en pip-beweging.
function ScoreDrilldown({ sel }: { sel: DeskCallHistoryRecord }) {
  const [openSub, setOpenSub] = useState<string | null>(null)
  const b = sel.breakdown

  const absFund = Math.abs(sel.fundScore)
  const absMom = Math.abs(sel.momentum5d)
  const inZone = absMom >= 30 && absMom <= 120

  const criteria = [
    { label: 'Fundamentele onbalans — score ≥ 2,0', val: absFund.toFixed(1), ok: absFund >= 2.0 },
    { label: '5d momentum — tégen de richting (contrarian)', val: `${sel.momentum5d > 0 ? '+' : ''}${sel.momentum5d}p`, ok: sel.contrarianPass },
    { label: 'Intermarket alignment ≥ 50%', val: `${sel.imAlignment}%`, ok: sel.imAlignment >= 50 },
    { label: 'Duidelijke richting (long/short)', val: sel.dir === 'long' ? 'Long' : 'Short', ok: true },
  ]

  const subs = [
    { key: 'fund', label: 'Fundamentele onbalans', val: b.fundPts },
    { key: 'mom', label: '5d momentum', val: b.contrarianPts },
    { key: 'im', label: 'Intermarket alignment', val: b.imPts },
    { key: 'regime', label: 'Regime alignment', val: b.regimePts },
  ]

  return (
    <div className="cc-reason" style={{ marginTop: 20 }}>
      <div className="call-criteria">
        <span className="cc-crit-title">Wanneer is het een call?</span>
        {criteria.map((c, i) => (
          <div className="crit-row" key={i}>
            <span className={`crit-mark ${c.ok ? 'ok' : 'no'}`}>{c.ok ? '✓' : '✗'}</span>
            <span className="crit-label">{c.label}</span>
            <span className="crit-val num">{c.val}</span>
          </div>
        ))}
        <p className="crit-note">Voldoet aan alle vier → de call wordt uitgestuurd. <b>Regime alignment</b> is géén voorwaarde — die telt alleen mee voor de conviction (de kwaliteit, 0-10).</p>
      </div>
      <p className="sub-intro">De conviction ({sel.score.toFixed(1)} van 10) is de optelsom van vier subscores. Klik een rij open voor de berekening.</p>
      <div className="sub-rows">
        {subs.map((s) => (
          <div className={`sub-row${openSub === s.key ? ' open' : ''}`} key={s.key}>
            <button className="sub-row-head" onClick={() => setOpenSub((k) => (k === s.key ? null : s.key))}>
              <span className="sub-label">{s.label}</span>
              <span className="sub-val num">{s.val.toFixed(1)}</span>
              <Icons.Chevron size={12} className={`sub-chev${openSub === s.key ? ' open' : ''}`} />
            </button>
            {openSub === s.key && (
              <div className="sub-detail">
                {s.key === 'fund' && (
                  <div className="sub-lines">
                    <p className="sub-explain">Het netto fundamentele verschil tussen beide valuta&apos;s ({sel.pair}), op een schaal van −5 tot +5. Hoe groter de onbalans, hoe meer punten (max 4).</p>
                    <div className="sub-line"><span>Paar-score</span><span className="num">{sel.fundScore > 0 ? '+' : ''}{sel.fundScore.toFixed(1)}</span></div>
                    <p className="sub-formula">Geschaald: min(|{sel.fundScore.toFixed(1)}| ÷ 5, 1) × 4 = <b className="accent">{b.fundPts.toFixed(1)}</b></p>
                  </div>
                )}
                {s.key === 'mom' && (
                  <div className="sub-lines">
                    <p className="sub-explain">De koers moet de afgelopen 5 dagen tégen de fundamentele richting zijn bewogen (mean-reversion: koop de dip / verkoop de rally). Optimale zone: 30–120 pips.</p>
                    <div className="sub-line"><span>Beweging (5d)</span><span className={`num ${sel.momentum5d >= 0 ? 'pos' : 'neg'}`}>{sel.momentum5d > 0 ? '+' : ''}{sel.momentum5d} pips</span></div>
                    <div className="sub-line"><span>Zone</span><span>{absMom}p · {inZone ? 'optimaal (30–120)' : absMom < 30 ? 'klein (<30)' : 'groot (>120)'}</span></div>
                    <p className="sub-formula">
                      {sel.contrarianPass
                        ? (inZone ? 'Tegen de richting én in optimale zone → ' : 'Tegen de richting, maar buiten optimale zone → ')
                        : 'Liep mee met de fundamentals (geen mean-reversion) → '}
                      <b className="accent">{b.contrarianPts.toFixed(1)}</b>
                    </p>
                  </div>
                )}
                {s.key === 'im' && (
                  <div className="sub-lines">
                    <p className="sub-explain">Alignment = welk deel van de markt-brede signalen (VIX, aandelen, goud, dollar, rente) bij deze richting paste. 100% = alles bevestigt, 0% = alles spreekt tegen.</p>
                    <div className="sub-line"><span>Alignment</span><span className="num">{sel.imAlignment}%</span></div>
                    <p className="sub-formula">{sel.imAlignment}% ÷ 100 × 2 = <b className="accent">{b.imPts.toFixed(1)}</b></p>
                  </div>
                )}
                {s.key === 'regime' && (
                  <div className="sub-lines">
                    <p className="sub-explain">Past de richting van deze call bij het marktregime ({sel.regime}) op het moment van uitsturen?</p>
                    <span className={`confirm-tag ${sel.regimeAligned ? 'yes' : 'no'}`}>{sel.regimeAligned ? 'past in regime' : 'neutraal'}</span>
                    <p className="sub-formula">{sel.regimeAligned ? 'Past in het regime → ' : 'Neutraal in het regime → '}<b className="accent">{b.regimePts.toFixed(1)}</b></p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div className="sub-total">
          <span className="sub-label">Conviction</span>
          <span className="sub-sum num">{b.fundPts.toFixed(1)} + {b.contrarianPts.toFixed(1)} + {b.imPts.toFixed(1)} + {b.regimePts.toFixed(1)}</span>
          <span className="sub-val num accent">{sel.score.toFixed(1)}</span>
        </div>
      </div>
      <p className="sub-livenote">Dit is de conviction zoals <b>vastgelegd bij het uitsturen</b> van de call. De live stand in de Vandaag-tab kan afwijken omdat score, regime en intermarket gedurende de dag meebewegen.</p>
    </div>
  )
}

// ─── Filter button group ──────────────────────────────────────
function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <>
      <span className="mono-label" style={{ alignSelf: 'center', marginRight: 4 }}>{label}</span>
      {options.map((o) => (
        <button key={o.id} className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </>
  )
}
