'use client'

import { useMemo, useState } from 'react'
import { DirTag, StatusPill, ZoneLabel, fmt } from '../atoms'
import { Icons } from '../icons'
import { adaptCalls } from '../lib/adapters'
import { useCurrentPrices } from '../lib/use-current-prices'
import { TRADE_MODELS, DEFAULT_MODEL } from '@/lib/execution-types'
import type { ApiBriefingData, DeskCall } from '../lib/types'

interface SetupsProps {
  data: ApiBriefingData
  onGoBriefing?: (pair?: string) => void
  onSetTab?: (tab: string) => void
}

interface SetupRow extends DeskCall {
  entry: number | null
  stop: number | null
  target: number | null
  rr: number
}

export function Setups({ data, onGoBriefing, onSetTab }: SetupsProps) {
  const { ready, watch } = useMemo(() => adaptCalls(data), [data])

  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL)
  const [risk, setRisk] = useState(1.0)
  const [account, setAccount] = useState(10000)
  const [minScore, setMinScore] = useState(6.0)

  const model = TRADE_MODELS[modelId]
  const { prices, loading: pricesLoading } = useCurrentPrices(ready.map((c) => c.pair))

  // Build setup rows (entry from live price, stop/target from model)
  const setups = useMemo<SetupRow[]>(
    () =>
      ready.map((c) => buildSetup(c, prices[c.pair] ?? null, model.sl, model.tp)),
    [ready, prices, model.sl, model.tp],
  )

  const filteredSetups = useMemo(
    () => setups.filter((s) => s.score >= minScore),
    [setups, minScore],
  )

  // Position size — simple 1% risk model
  const riskAmt = account * (risk / 100)
  const avgStopPips = model.sl // pips
  const pipValuePerLot = 10 // USD per pip per standard lot (approx)
  const lots = avgStopPips > 0 ? (riskAmt / (avgStopPips * pipValuePerLot)).toFixed(2) : '0.00'

  return (
    <div className="fade">
      {/* ZONE 1 — Setups table */}
      <div>
        <div className="zone-label">
          <span className="tick" />
          <span className="mono-label">Entry-ready setups vandaag</span>
          <span className="rule" />
          <div className="minscore">
            <span className="mono-label">Min. score</span>
            <input
              type="range"
              min="5"
              max="9"
              step="0.1"
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
            />
            <span className="ms-val num">{minScore.toFixed(1)}</span>
            <button className="flowlink mini" onClick={() => onSetTab?.('prestatie')}>
              zie Prestatie <Icons.ArrowRight size={12} />
            </button>
          </div>
        </div>

        <div className="setups">
          <div className="head">
            <span className="mono-label">Paar</span>
            <span className="mono-label">Score</span>
            <span className="mono-label">Instap</span>
            <span className="mono-label">Stop</span>
            <span className="mono-label">Target</span>
            <span className="mono-label">R : R</span>
            <span className="mono-label r">Status</span>
          </div>
          {filteredSetups.length === 0 ? (
            <div className="setups-empty">
              {ready.length === 0
                ? 'Geen entry-ready calls vandaag.'
                : `Geen setups boven score ${minScore.toFixed(1)}. Verlaag de minimale score.`}
            </div>
          ) : (
            filteredSetups.map((s) => {
              const d = decimalsFor(s.pair)
              return (
                <div className="srow" key={s.pair}>
                  <div className="pairc">
                    <div className="top">
                      <span className="sp">{s.pair}</span>
                      <DirTag dir={s.dir} />
                    </div>
                    <button className="flowlink back" onClick={() => onGoBriefing?.(s.pair)}>
                      <Icons.ArrowLeft size={13} /> Uit briefing
                    </button>
                  </div>
                  <span className="sc num">{s.score.toFixed(1)}</span>
                  <span className="vv num">{s.entry != null ? fmt(s.entry, d) : pricesLoading ? '…' : '—'}</span>
                  <span className="vv muted num">{s.stop != null ? fmt(s.stop, d) : '—'}</span>
                  <span className="vv num">{s.target != null ? fmt(s.target, d) : '—'}</span>
                  <span className="rr num">{s.rr.toFixed(2)}</span>
                  <span className="end">
                    <StatusPill status="ready" />
                  </span>
                </div>
              )
            })
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 10 }}>
          {filteredSetups.length} van {ready.length} entry-ready setup{ready.length === 1 ? '' : 's'} getoond. Zwakke calls worden weggefilterd onder score {minScore.toFixed(1)}.
        </div>
      </div>

      {/* ZONE 2 — Strategy */}
      <div className="section-gap">
        <ZoneLabel>Strategie</ZoneLabel>
        <div className="model-grid">
          {Object.values(TRADE_MODELS).map((m) => (
            <button key={m.id} className={`model-card${m.id === modelId ? ' active' : ''}`} onClick={() => setModelId(m.id)}>
              <div className="mc-name">{m.name}</div>
              <div className="mc-desc">{m.label}</div>
              <div className="mc-stats">
                <div className="s">
                  <span className="k mono-label">Winrate</span>
                  <span className="v num">{m.expectedWR}%</span>
                </div>
                <div className="s">
                  <span className="k mono-label">Profit factor</span>
                  <span className="v num">{m.expectedPF.toFixed(1)}</span>
                </div>
                <div className="s">
                  <span className="k mono-label">Trades / week</span>
                  <span className="v num">{m.tradesPerWeek.toFixed(1)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ZONE 3 — Position size */}
      <div className="section-gap">
        <ZoneLabel>Position size</ZoneLabel>
        <div className="possize">
          <div className="field">
            <span className="k mono-label">Account</span>
            <div className="control">
              <span className="unit">&euro;</span>
              <input
                type="number"
                min="100"
                step="100"
                value={account}
                onChange={(e) => setAccount(Math.max(100, parseInt(e.target.value) || 0))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  fontFamily: 'var(--font-head)',
                  fontSize: 28,
                  fontWeight: 600,
                  lineHeight: 1,
                  width: 120,
                  padding: 0,
                  outline: 'none',
                }}
              />
            </div>
          </div>
          <div className="field">
            <span className="k mono-label">Risk per trade</span>
            <div className="control">
              <span className="v num">{risk.toFixed(1)}</span>
              <span className="unit">%</span>
              <span className="stepper">
                <button onClick={() => setRisk((r) => Math.max(0.1, +(r - 0.1).toFixed(1)))}>−</button>
                <button onClick={() => setRisk((r) => Math.min(5, +(r + 0.1).toFixed(1)))}>+</button>
              </span>
            </div>
          </div>
          <div className="field">
            <span className="k mono-label">Risicobedrag</span>
            <div className="control">
              <span className="unit">&euro;</span>
              <span className="v num">{riskAmt.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
          <div className="field">
            <span className="k mono-label">Lotgrootte</span>
            <div className="control">
              <span className="v out num">{lots}</span>
              <span className="unit">lot</span>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 10 }}>
          Indicatief, op basis van {model.sl} pips stop-afstand bij strategie {model.name}. Geen handelsadvies.
        </div>
      </div>

      {/* ZONE 4 — Waiting */}
      <div className="section-gap">
        <ZoneLabel>Wachtend</ZoneLabel>
        {watch.length === 0 ? (
          <div className="strip" style={{ padding: '22px 18px', color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
            Geen watchlist-calls vandaag.
          </div>
        ) : (
          <div className="waiting">
            {watch.map((w) => (
              <div className="wrow" key={w.pair}>
                <div className="top">
                  <span className="sp">{w.pair}</span>
                  <DirTag dir={w.dir} />
                </div>
                <span className="sc num">{w.score.toFixed(1)}</span>
                <span className="reason">
                  <Icons.Clock size={13} />
                  {w.wait || 'Wacht op bevestiging'}
                </span>
                <span className="end">
                  <StatusPill status="watch" />
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 10 }}>
          Nog geen instap, stop of target. Deze calls worden setups zodra ze in de Briefing entry-ready worden.
        </div>
      </div>
    </div>
  )
}

// ─── Build a setup row from a ready call + live price + model ──
function buildSetup(c: DeskCall, livePrice: number | null, slPips: number, tpPips: number): SetupRow {
  if (livePrice == null) {
    return { ...c, entry: null, stop: null, target: null, rr: tpPips / slPips }
  }
  const pipSize = c.pair.includes('JPY') ? 0.01 : 0.0001
  const entry = livePrice
  const stop = c.dir === 'long' ? entry - slPips * pipSize : entry + slPips * pipSize
  const target = c.dir === 'long' ? entry + tpPips * pipSize : entry - tpPips * pipSize
  return { ...c, entry, stop, target, rr: tpPips / slPips }
}

function decimalsFor(pair: string): number {
  return pair.includes('JPY') ? 2 : 4
}
