'use client'

import { useEffect, useMemo, useState } from 'react'
import { DirTag, OutcomeChip, ResultChip, fmt } from '../atoms'
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
            </>
          )}
        </div>
      </div>
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
