'use client'

import { useEffect, useMemo, useState } from 'react'
import { HZ_LABEL, sampleTier } from './helpers'
import { Tip, HowToRead } from './ui'

// ─── Data-vorm van public/fb-backtest-v2.json ─────────────────
interface BtHorizon { x: string; xp: number; ok: boolean; pips: number; pct: number }
interface BtTrade {
  d: string; p: string; dir: 'L' | 'S'; f: number; bias: number; timing: number; c: number
  e: number; ed: string; atr: number | null
  h: Record<string, BtHorizon>
}
interface BtData {
  meta: {
    generatedAt: string; model: string; period: { from: string; to: string }
    days: number; trades: number; callMomentUTC: string; method: string; deviations: string[]
  }
  trades: BtTrade[]
}

const BT_HORIZONS = [1, 3, 5, 10, 20]

type Preset = 'alle' | 'timing7' | 'zeker7' | 'top1'
const PRESETS: { key: Preset; label: string; desc: string }[] = [
  { key: 'alle', label: 'Alle calls', desc: 'Elke call die de gate haalde (top-8 per dag).' },
  { key: 'timing7', label: 'Timing ≥ 7', desc: 'Alleen calls met een gunstig instapmoment — dít is waar de edge zit.' },
  { key: 'zeker7', label: 'Zekerheid ≥ 7', desc: 'Alleen de sterkste totaalscores.' },
  { key: 'top1', label: 'Top-1 per dag', desc: 'Alleen de hoogste zekerheid van elke dag.' },
]

function fmtP(pair: string, v: number): string { return v.toFixed(pair.includes('JPY') ? 3 : 5) }
function fmtD(iso: string): string {
  try { return new Date(iso + 'T00:00:00Z').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' }) } catch { return iso }
}

function applyPreset(trades: BtTrade[], preset: Preset): BtTrade[] {
  if (preset === 'timing7') return trades.filter((t) => t.timing >= 7)
  if (preset === 'zeker7') return trades.filter((t) => t.c >= 7)
  if (preset === 'top1') {
    const best: Record<string, BtTrade> = {}
    for (const t of trades) if (!best[t.d] || t.c > best[t.d].c) best[t.d] = t
    return Object.values(best)
  }
  return trades
}

function stats(trades: BtTrade[], hz: number) {
  let n = 0, wins = 0, pips = 0, posPct = 0, negPct = 0
  for (const t of trades) {
    const h = t.h[String(hz)]
    if (!h) continue
    n++
    if (h.ok) wins++
    pips += h.pips
    if (h.pct > 0) posPct += h.pct; else negPct -= h.pct
  }
  return {
    n, wins,
    winrate: n ? Math.round((wins / n) * 1000) / 10 : 0,
    pips,
    avgPips: n ? Math.round(pips / n) : 0,
    pf: n === 0 ? null : negPct > 0 ? Math.round((posPct / negPct) * 100) / 100 : Infinity,
    tier: sampleTier(n),
  }
}

// Cumulatieve %-curve (close-to-close, gelijk gewicht per trade).
function equitySeries(trades: BtTrade[], hz: number): { x: number; y: number }[] {
  const rows = trades
    .map((t) => ({ d: t.d, pct: t.h[String(hz)]?.pct }))
    .filter((r): r is { d: string; pct: number } => r.pct != null)
    .sort((a, b) => a.d.localeCompare(b.d))
  let cum = 0
  return rows.map((r, i) => { cum += r.pct; return { x: i, y: +cum.toFixed(2) } })
}

function EquityCurve({ series }: { series: { x: number; y: number }[] }) {
  if (series.length < 2) return null
  const W = 720, H = 150, PAD = 6
  const minY = Math.min(0, ...series.map((p) => p.y))
  const maxY = Math.max(0, ...series.map((p) => p.y))
  const sx = (x: number) => PAD + (x / (series.length - 1)) * (W - 2 * PAD)
  const sy = (y: number) => H - PAD - ((y - minY) / Math.max(1e-9, maxY - minY)) * (H - 2 * PAD)
  const path = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')
  const last = series[series.length - 1]
  const up = last.y >= 0
  return (
    <div className="fb-eq">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Cumulatief resultaat">
        <line x1={PAD} x2={W - PAD} y1={sy(0)} y2={sy(0)} className="fb-eq-zero" />
        <path d={path} className={`fb-eq-line ${up ? 'up' : 'down'}`} />
      </svg>
      <div className="fb-eq-label num">cumulatief {last.y >= 0 ? '+' : ''}{last.y.toFixed(1)}% (som van close-to-close %-resultaten, gelijk gewicht per trade)</div>
    </div>
  )
}

export function BacktestTab() {
  const [data, setData] = useState<BtData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [preset, setPreset] = useState<Preset>('timing7')
  const [hz, setHz] = useState<number>(5)
  const [showList, setShowList] = useState(false)
  const [listLimit, setListLimit] = useState(100)

  useEffect(() => {
    let alive = true
    fetch('/fb-backtest-v2.json')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { if (alive) setData(d) })
      .catch((e) => { if (alive) setErr(String(e)) })
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => (data ? applyPreset(data.trades, preset) : []), [data, preset])
  const head = useMemo(() => stats(filtered, hz), [filtered, hz])
  const series = useMemo(() => equitySeries(filtered, hz), [filtered, hz])

  const byPair = useMemo(() => {
    if (!filtered.length) return []
    const map: Record<string, BtTrade[]> = {}
    for (const t of filtered) (map[t.p] ||= []).push(t)
    return Object.entries(map)
      .map(([p, rows]) => ({ pair: p, s: stats(rows, hz) }))
      .filter((g) => g.s.n >= 20)
      .sort((a, b) => (b.s.pf === Infinity ? 99 : b.s.pf ?? 0) - (a.s.pf === Infinity ? 99 : a.s.pf ?? 0))
  }, [filtered, hz])

  const listRows = useMemo(() =>
    [...filtered].sort((a, b) => b.d.localeCompare(a.d)).slice(0, listLimit),
  [filtered, listLimit])

  if (err) return <div className="fb-empty">Kon de backtest-data niet laden: {err}</div>
  if (!data) return <div className="fb-empty">Backtest wordt geladen…</div>

  const m = data.meta
  const pfTxt = head.pf == null ? '—' : head.pf === Infinity ? '∞' : head.pf.toFixed(2)
  const pfCls = head.pf != null && head.pf !== Infinity ? (head.pf >= 1.05 ? 'win' : head.pf <= 0.95 ? 'loss' : '') : ''

  return (
    <div>
      <HowToRead title="Wat is deze backtest — en wat niet?">
        <p>
          Een <b>point-in-time simulatie</b> van de v2-methodiek over {m.days} handelsdagen
          ({fmtD(m.period.from)} – {fmtD(m.period.to)}), samen {m.trades.toLocaleString('nl-NL')} trades.
          Per dag gebruikt het signaal uitsluitend wat om {m.callMomentUTC} UTC bekend was: voltooide dag-candles t/m de
          vorige handelsdag en kalender-events van vóór dat moment. <b>Geen look-ahead.</b>
        </p>
        <ol>
          {m.deviations.map((d, i) => <li key={i}>{d}</li>)}
        </ol>
        <p>De uitkomsten zijn dus een eerlijke ondergrens van de <i>testbare</i> onderdelen — het live-model heeft daarbovenop nieuws + handmatige CB-labels, die hier niet gesimuleerd kunnen worden.</p>
      </HowToRead>

      {/* Hoofdinzicht */}
      <div className="fb-bt-insights">
        <div className="fb-bt-insight main">
          <div className="t">💡 De belangrijkste uitkomst</div>
          <p>
            De edge zit in de <b>timing</b>, niet in het fundamentele niveau. Calls met <b>timing ≥ 7</b> (gunstige tegendraadse
            strekking, marktbevestiging, geen cijfers op komst) haalden op 5 dagen <b>{stats(applyPreset(data.trades, 'timing7'), 5).winrate}% winrate</b> en
            profit factor <b>{(stats(applyPreset(data.trades, 'timing7'), 5).pf ?? 0).toFixed(2)}</b> over {stats(applyPreset(data.trades, 'timing7'), 5).n} trades
            ({stats(applyPreset(data.trades, 'timing7'), 5).pips > 0 ? '+' : ''}{stats(applyPreset(data.trades, 'timing7'), 5).pips.toLocaleString('nl-NL')} pips).
            Zonder dat filter is het geheel een muntje ({stats(data.trades, 1).winrate}% op 1 dag) en op langere horizon verliesgevend.
          </p>
        </div>
        <div className="fb-bt-insight">
          <div className="t">Wat werkt niet</div>
          <p>
            Een hoge fundamentele score alléén voorspelde in deze simulatie <b>niets</b> — op 10–20 dagen zelfs negatief.
            Renteverleden is ingeprijsd; vandaar dat live v2 op nieuws + verrassingen leunt (hier niet testbaar) en timing apart toont.
          </p>
        </div>
        <div className="fb-bt-insight">
          <div className="t">Hoe dit de tool stuurt</div>
          <p>
            De timing-score die je bij elke live call ziet is exact de score die hier de rangorde bepaalde: van PF {(stats(data.trades.filter((t) => t.timing >= 7), 1).pf ?? 0).toFixed(2)} (timing ≥ 7)
            naar PF {(stats(data.trades.filter((t) => t.timing < 3), 1).pf ?? 0).toFixed(2)} (timing &lt; 3) op 1 dag. Vuistregel: <b>handel alleen bij timing ≥ 7</b>.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="fb-an-controls">
        <div>
          <span className="fb-mono">Selectie</span>
          <div className="fb-hz-toggle">
            {PRESETS.map((p) => (
              <button key={p.key} className={`fb-hz-btn${preset === p.key ? ' active' : ''}`} onClick={() => setPreset(p.key)} title={p.desc}>{p.label}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="fb-mono">Termijn</span>
          <div className="fb-hz-toggle">
            {BT_HORIZONS.map((h) => <button key={h} className={`fb-hz-btn${hz === h ? ' active' : ''}`} onClick={() => setHz(h)}>{HZ_LABEL[h].replace(' dag', 'd').replace('en', '')}</button>)}
          </div>
        </div>
      </div>
      <p className="fb-note" style={{ margin: '0 0 14px' }}>{PRESETS.find((p) => p.key === preset)?.desc}</p>

      {/* KPI's */}
      <div className="fb-kpis">
        <div className="fb-kpi"><div className="l">Trades</div><div className="v num">{head.n.toLocaleString('nl-NL')}</div></div>
        <div className="fb-kpi"><div className="l">Winrate · {HZ_LABEL[hz]}</div><div className="v accent num">{head.winrate}%</div></div>
        <div className="fb-kpi"><div className="l">Profit factor <Tip text="Som winst-% ÷ som verlies-% (close-to-close)." /></div><div className={`v num ${pfCls}`}>{pfTxt}</div></div>
        <div className="fb-kpi"><div className="l">Som pips <Tip text="Alle pips per trade zijn hieronder in de lijst na te rekenen met referentie- en eindkoers + datum. Let op: pips over verschillende paren optellen is indicatief — de PF op % is de eerlijkere maat." /></div><div className={`v num ${head.pips > 0 ? 'win' : head.pips < 0 ? 'loss' : ''}`}>{head.pips > 0 ? '+' : ''}{head.pips.toLocaleString('nl-NL')}</div></div>
        <div className="fb-kpi"><div className="l">Gem. pips/trade</div><div className={`v num ${head.avgPips > 0 ? 'win' : head.avgPips < 0 ? 'loss' : ''}`}>{head.avgPips > 0 ? '+' : ''}{head.avgPips}</div></div>
      </div>

      <EquityCurve series={series} />

      {/* Per termijn overzicht voor de huidige selectie */}
      <div className="fb-bd" style={{ marginTop: 18 }}>
        <div className="fb-bd-card">
          <div className="fb-bd-title">Per termijn (huidige selectie)</div>
          <div className="fb-an-head"><span></span><span>winrate</span><span>PF</span><span></span></div>
          {BT_HORIZONS.map((h) => {
            const s = stats(filtered, h)
            return (
              <div key={h} className={`fb-an-row tier-${s.tier.tier}`}>
                <span className="fb-an-label">{HZ_LABEL[h]}</span>
                <span className="num fb-an-wr">{s.n ? `${s.winrate}%` : '—'}</span>
                <span className={`num fb-an-pf ${s.pf != null && s.pf !== Infinity ? (s.pf >= 1.05 ? 'fb-pos' : s.pf <= 0.95 ? 'fb-neg' : '') : ''}`}>{s.pf == null ? '—' : s.pf === Infinity ? '∞' : s.pf.toFixed(2)}</span>
                <span className="fb-an-n num">{s.n ? `n=${s.n}` : '—'}</span>
              </div>
            )
          })}
        </div>
        <div className="fb-bd-card">
          <div className="fb-bd-title">Per timing-score · {HZ_LABEL[hz]} <Tip text="De kern van het bewijs: hogere timing → beter resultaat, laag → slechter. Dit is dezelfde score die je bij elke live call ziet." /></div>
          <div className="fb-an-head"><span></span><span>winrate</span><span>PF</span><span></span></div>
          {[{ lo: 7, hi: 99, label: 'timing 7+' }, { lo: 5, hi: 7, label: '5–7' }, { lo: 3, hi: 5, label: '3–5' }, { lo: 0, hi: 3, label: '< 3' }].map((b) => {
            const s = stats(data.trades.filter((t) => t.timing >= b.lo && t.timing < b.hi), hz)
            return (
              <div key={b.label} className={`fb-an-row tier-${s.tier.tier}`}>
                <span className="fb-an-label">{b.label}</span>
                <span className="num fb-an-wr">{s.n ? `${s.winrate}%` : '—'}</span>
                <span className={`num fb-an-pf ${s.pf != null && s.pf !== Infinity ? (s.pf >= 1.05 ? 'fb-pos' : s.pf <= 0.95 ? 'fb-neg' : '') : ''}`}>{s.pf == null ? '—' : s.pf === Infinity ? '∞' : s.pf.toFixed(2)}</span>
                <span className="fb-an-n num">{s.n ? `n=${s.n}` : '—'}</span>
              </div>
            )
          })}
          <p className="fb-an-foot">Buckets over álle {data.trades.length.toLocaleString('nl-NL')} trades (ongeacht de selectie hierboven).</p>
        </div>
      </div>

      {byPair.length > 0 && (
        <div className="fb-bd-card" style={{ marginTop: 18 }}>
          <div className="fb-bd-title">Per paar · {HZ_LABEL[hz]} (huidige selectie, n ≥ 20)</div>
          <div className="fb-an-head"><span></span><span>winrate</span><span>PF</span><span></span></div>
          {byPair.map((g) => (
            <div key={g.pair} className={`fb-an-row tier-${g.s.tier.tier}`}>
              <span className="fb-an-label">{g.pair}</span>
              <span className="num fb-an-wr">{g.s.winrate}%</span>
              <span className={`num fb-an-pf ${g.s.pf != null && g.s.pf !== Infinity ? (g.s.pf >= 1.05 ? 'fb-pos' : g.s.pf <= 0.95 ? 'fb-neg' : '') : ''}`}>{g.s.pf == null ? '—' : g.s.pf === Infinity ? '∞' : g.s.pf.toFixed(2)}</span>
              <span className="fb-an-n num">n={g.s.n}</span>
            </div>
          ))}
        </div>
      )}

      {/* Trade-lijst: elk pips-getal met referentie→eindkoers + datum */}
      <button className="fb-calc-toggle" onClick={() => setShowList((s) => !s)}>
        {showList ? '▲ Verberg de trade-lijst' : `▾ Toon alle trades (${filtered.length.toLocaleString('nl-NL')}) — met koersen en datums, na te checken in TradingView`}
      </button>
      {showList && (
        <div className="fb-tr-list">
          <div className="fb-tr2-head">
            <span>Datum</span><span>Paar</span><span>Referentie</span><span>Eindkoers · {HZ_LABEL[hz]}</span><span>Resultaat</span>
            <span className="fb-tr2-sec">bias / timing</span>
          </div>
          {listRows.map((t, i) => {
            const h = t.h[String(hz)]
            return (
              <div className="fb-tr2-row" key={`${t.d}-${t.p}-${i}`}>
                <span className="num">{fmtD(t.d)}</span>
                <span><b>{t.p}</b> <span className={`fb-chip ${t.dir === 'L' ? 'long' : 'short'}`}>{t.dir === 'L' ? 'LONG' : 'SHORT'}</span></span>
                <span className="num">{fmtP(t.p, t.e)}<br /><span className="fb-mono" style={{ textTransform: 'none' }}>{fmtD(t.ed)}</span></span>
                <span className="num">{h ? <>{fmtP(t.p, h.xp)}<br /><span className="fb-mono" style={{ textTransform: 'none' }}>{fmtD(h.x)}</span></> : '—'}</span>
                <span>{h
                  ? <span className={`fb-tr-verdict ${h.ok ? 'win' : 'loss'}`}>{h.ok ? 'JUIST' : 'ONJUIST'}<span className="num" style={{ fontWeight: 400, marginLeft: 4 }}>{h.pips > 0 ? '+' : ''}{h.pips}p</span></span>
                  : <span className="fb-tr-verdict pending">—</span>}</span>
                <span className="fb-tr2-sec num" style={{ fontSize: 11 }}>{t.bias.toFixed(1)} / {t.timing.toFixed(1)}</span>
              </div>
            )
          })}
          {filtered.length > listLimit && (
            <button className="fb-weak-toggle" onClick={() => setListLimit((l) => l + 300)}>
              ▼ Toon meer ({(filtered.length - listLimit).toLocaleString('nl-NL')} resterend)
            </button>
          )}
        </div>
      )}

      <p className="fb-note">
        Simulatie gegenereerd op {new Date(m.generatedAt).toLocaleDateString('nl-NL')} · in-sample resultaat, geen garantie —
        het verse forward-trackrecord (tabblad Trackrecord) is de lopende toets. Educatief, geen financieel advies.
      </p>
    </div>
  )
}
