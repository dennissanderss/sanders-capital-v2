'use client'

import { useEffect, useMemo, useState } from 'react'
import { HZ_LABEL, sampleTier } from './helpers'
import { Tip, HowToRead } from './ui'

// ─── Data-vorm van public/fb-backtest-v2.json ─────────────────
interface BtHorizon {
  x: string; xp: number; ok: boolean; pips: number; pct: number; cpct?: number
  mfe?: number; mfp?: number; mfd?: string   // grootste beweging mee: pips, prijs, datum
  mae?: number; map?: number; mad?: string   // grootste beweging tegen
}
interface BtTrade {
  d: string; p: string; dir: 'L' | 'S'
  f?: number; bias?: number; timing?: number; c?: number
  diff?: number                       // carry-lens: renteverschil in pp
  e: number; ed: string; atr?: number | null
  h: Record<string, BtHorizon>
}
interface BtData {
  meta: {
    generatedAt: string; model: string; period: { from: string; to: string }
    days: number; trades: number; callMomentUTC: string; method: string; deviations: string[]
    carry?: { trades: number; method: string }
  }
  trades: BtTrade[]
  carryTrades?: BtTrade[]
}

const BT_HORIZONS = [1, 3, 5, 10, 20]

type Preset = 'alle' | 'timing7' | 'zeker7' | 'top1' | 'carry'
const PRESETS: { key: Preset; label: string; desc: string }[] = [
  { key: 'alle', label: 'Alle calls', desc: 'Elke call die de gate haalde (top-8 per dag). Day/swing-model.' },
  { key: 'timing7', label: 'Timing ≥ 7', desc: 'Alleen calls met een gunstig instapmoment — dít is de day/swing-edge.' },
  { key: 'zeker7', label: 'Zekerheid ≥ 7', desc: 'Alleen de sterkste totaalscores (day/swing-model).' },
  { key: 'top1', label: 'Top-1 per dag', desc: 'Alleen de hoogste zekerheid van elke dag (day/swing-model).' },
  { key: 'carry', label: 'Positie (carry)', desc: 'De positie-lens: maandag-entries, long de hoogste beleidsrente (≥ 2pp), niet in Risk-Off. Resultaat incl. swap-benadering.' },
]

function fmtP(pair: string, v: number): string { return v.toFixed(pair.includes('JPY') ? 3 : 5) }
function fmtD(iso: string): string {
  try { return new Date(iso + 'T00:00:00Z').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' }) } catch { return iso }
}

function applyPreset(data: BtData, preset: Preset): BtTrade[] {
  const trades = data.trades
  if (preset === 'carry') return data.carryTrades || []
  if (preset === 'timing7') return trades.filter((t) => (t.timing ?? 0) >= 7)
  if (preset === 'zeker7') return trades.filter((t) => (t.c ?? 0) >= 7)
  if (preset === 'top1') {
    const best: Record<string, BtTrade> = {}
    for (const t of trades) if (!best[t.d] || (t.c ?? 0) > (best[t.d].c ?? 0)) best[t.d] = t
    return Object.values(best)
  }
  return trades
}

// useSwap: reken met %-resultaat inclusief swap-benadering (carry-lens).
function stats(trades: BtTrade[], hz: number, useSwap = false) {
  let n = 0, wins = 0, pips = 0, posPct = 0, negPct = 0
  for (const t of trades) {
    const h = t.h[String(hz)]
    if (!h) continue
    const pct = useSwap && h.cpct != null ? h.cpct : h.pct
    n++
    if (useSwap ? pct > 0 : h.ok) wins++
    pips += h.pips
    if (pct > 0) posPct += pct; else negPct -= pct
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

// Move-kwaliteit: richting juist ÉN beweging groot genoeg om op te handelen.
function btMoveStats(trades: BtTrade[], hz: number, thr: number) {
  let n = 0, corrMove = 0, allMove = 0, corr = 0
  const mfes: number[] = [], maes: number[] = []
  for (const t of trades) {
    const h = t.h[String(hz)]
    if (!h || h.mfe == null) continue
    n++
    mfes.push(h.mfe); maes.push(h.mae ?? 0)
    const has = h.mfe >= thr
    if (has) allMove++
    if (h.ok) { corr++; if (has) corrMove++ }
  }
  mfes.sort((a, b) => a - b); maes.sort((a, b) => a - b)
  return {
    n,
    pctCorrMove: n ? Math.round((corrMove / n) * 1000) / 10 : 0,
    pctAllMove: n ? Math.round((allMove / n) * 1000) / 10 : 0,
    pctOfCorr: corr ? Math.round((corrMove / corr) * 1000) / 10 : 0,
    medMfe: n ? mfes[Math.floor(n / 2)] : null,
    medMae: n ? maes[Math.floor(n / 2)] : null,
    tier: sampleTier(n),
  }
}
const MOVE_THRS = [20, 30, 50, 75]

// Cumulatieve %-curve (close-to-close, gelijk gewicht per trade).
function equitySeries(trades: BtTrade[], hz: number, useSwap = false): { x: number; y: number }[] {
  const rows = trades
    .map((t) => {
      const h = t.h[String(hz)]
      return { d: t.d, pct: h ? (useSwap && h.cpct != null ? h.cpct : h.pct) : undefined }
    })
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
  const [moveDrempel, setMoveDrempel] = useState<number>(30)

  useEffect(() => {
    let alive = true
    fetch('/fb-backtest-v2.json')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { if (alive) setData(d) })
      .catch((e) => { if (alive) setErr(String(e)) })
    return () => { alive = false }
  }, [])

  // De positie-lens is een 20-dagen-model; spring daar automatisch heen.
  useEffect(() => { if (preset === 'carry') setHz(20) }, [preset])

  const isCarry = preset === 'carry'
  const filtered = useMemo(() => (data ? applyPreset(data, preset) : []), [data, preset])
  const head = useMemo(() => stats(filtered, hz, isCarry), [filtered, hz, isCarry])
  const headPrice = useMemo(() => stats(filtered, hz, false), [filtered, hz])
  const series = useMemo(() => equitySeries(filtered, hz, isCarry), [filtered, hz, isCarry])

  const byPair = useMemo(() => {
    if (!filtered.length) return []
    const map: Record<string, BtTrade[]> = {}
    for (const t of filtered) (map[t.p] ||= []).push(t)
    return Object.entries(map)
      .map(([p, rows]) => ({ pair: p, s: stats(rows, hz, isCarry), m: btMoveStats(rows, hz, moveDrempel) }))
      .filter((g) => g.s.n >= (isCarry ? 10 : 20))
      .sort((a, b) => b.m.pctCorrMove - a.m.pctCorrMove)
  }, [filtered, hz, isCarry, moveDrempel])

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
        <p>
          De simulatie mist onderdelen van het live-model (nieuws, handmatige CB-labels) — dat drukt de cijfers.
          Maar er is ook een kracht die ze juist <b>optilt</b>: de getoonde selecties (zoals timing ≥ 7) zijn op deze zelfde data
          gekozen. De waarheid ligt daartussen; het vers opgebouwde trackrecord is de echte toets.
          &quot;In-sample&quot; betekent precies dat: getest op de data waarop de regels ook zijn afgesteld.
        </p>
      </HowToRead>

      {/* Hoofdinzicht — AUDIT-FIX: eerlijker framing. "Bewezen" → gesimuleerd;
          de 1d-winrate is niet van toeval te onderscheiden (edge = winstverhouding);
          carry beslaat maar ~8 maanden; de timing≥7-drempel is op deze data
          gekozen en het verse trackrecord is de echte toets. */}
      <div className="fb-bt-insights">
        <div className="fb-bt-insight main">
          <div className="t">💡 Wat de simulatie laat zien</div>
          <p>
            <b>Daytrade (1d):</b> winrate ≈ muntje ({stats(applyPreset(data, 'timing7'), 1).winrate}%), maar de winners waren gemiddeld groter dan de verliezers (PF {(stats(applyPreset(data, 'timing7'), 1).pf ?? 0).toFixed(2)} bij timing ≥ 7, n={stats(applyPreset(data, 'timing7'), 1).n}).{' '}
            <b>Swing (5d):</b> de sterkste lens: {stats(applyPreset(data, 'timing7'), 5).winrate}% · PF {(stats(applyPreset(data, 'timing7'), 5).pf ?? 0).toFixed(2)} bij timing ≥ 7 (n={stats(applyPreset(data, 'timing7'), 5).n}; door overlappende posities is de bewijskracht kleiner dan n doet vermoeden).{' '}
            <b>Positie/carry (20d):</b> {stats(applyPreset(data, 'carry'), 20, true).winrate}% · PF {(stats(applyPreset(data, 'carry'), 20, true).pf ?? 0).toFixed(2)} incl. swap — maar gemeten over slechts ~8 maanden in één gunstig regime; lees dit als indicatie, niet als bewijs.
          </p>
        </div>
        <div className="fb-bt-insight">
          <div className="t">Wat werkt niet</div>
          <p>
            Het fundamentele niveau alléén voorspelde niets ({stats(data.trades, 1).winrate}% op 1 dag; 20d PF {(stats(data.trades, 20).pf ?? 0).toFixed(2)}) — renteverleden is ingeprijsd.
            Ook een hoge <b>bias-score</b> gaf geen betere uitkomsten; alle voorspelkracht zat in de <b>timing</b>-score. Sorteer je op zekerheid, weeg dan zelf vooral timing.
          </p>
        </div>
        <div className="fb-bt-insight">
          <div className="t">Vuistregels — met slag om de arm</div>
          <p>
            Day/swing: <b>alleen handelen bij timing ≥ 7</b> (PF {(stats(data.trades.filter((t) => (t.timing ?? 0) >= 7), 1).pf ?? 0).toFixed(2)} vs. {(stats(data.trades.filter((t) => (t.timing ?? 0) < 3), 1).pf ?? 0).toFixed(2)} bij timing &lt; 3; het patroon loopt netjes op over de buckets en hield in beide simulatiejaren stand).
            Die drempel is wel op déze data gekozen — het verse trackrecord moet hem bevestigen.
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
      <p className="fb-note" style={{ margin: '0 0 14px' }}>
        {PRESETS.find((p) => p.key === preset)?.desc}
        {isCarry && m.carry ? <> {m.carry.method}</> : null}
      </p>

      {/* KPI's */}
      <div className="fb-kpis">
        <div className="fb-kpi"><div className="l">Trades</div><div className="v num">{head.n.toLocaleString('nl-NL')}</div></div>
        <div className="fb-kpi"><div className="l">Winrate · {HZ_LABEL[hz]}{isCarry ? ' · incl. swap' : ''}</div><div className="v accent num">{head.winrate}%</div></div>
        <div className="fb-kpi"><div className="l">Profit factor{isCarry ? ' · incl. swap' : ''} <Tip text={isCarry ? 'Som winst-% ÷ som verlies-%, met het renteverschil naar rato van de dagen meegerekend (swap-benadering op beleidsrente — broker-swap is ongunstiger).' : 'Som winst-% ÷ som verlies-% (close-to-close).'} /></div><div className={`v num ${pfCls}`}>{pfTxt}</div></div>
        {isCarry && (
          <div className="fb-kpi"><div className="l">Alleen koers <Tip text="Zelfde trades, zonder swap: zo zie je hoeveel van het rendement uit het renteverschil komt." /></div><div className="v num">{headPrice.winrate}% · PF {headPrice.pf == null ? '—' : headPrice.pf === Infinity ? '∞' : headPrice.pf.toFixed(2)}</div></div>
        )}
        <div className="fb-kpi"><div className="l">Som pips <Tip text="Alle pips per trade zijn hieronder in de lijst na te rekenen met referentie- en eindkoers + datum. Let op: pips over verschillende paren optellen is indicatief — de PF op % is de eerlijkere maat. Pips zijn puur koers (zonder swap)." /></div><div className={`v num ${head.pips > 0 ? 'win' : head.pips < 0 ? 'loss' : ''}`}>{head.pips > 0 ? '+' : ''}{head.pips.toLocaleString('nl-NL')}</div></div>
        <div className="fb-kpi"><div className="l">Gem. pips/trade</div><div className={`v num ${head.avgPips > 0 ? 'win' : head.avgPips < 0 ? 'loss' : ''}`}>{head.avgPips > 0 ? '+' : ''}{head.avgPips}</div></div>
      </div>

      <EquityCurve series={series} />

      {/* Per termijn overzicht voor de huidige selectie */}
      <div className="fb-bd" style={{ marginTop: 18 }}>
        <div className="fb-bd-card">
          <div className="fb-bd-title">Per termijn (huidige selectie{isCarry ? ', incl. swap' : ''})</div>
          <div className="fb-an-head"><span></span><span>winrate</span><span title="Profit factor: opgetelde winst ÷ opgeteld verlies. Boven 1 = winstgevend, onder 1 = verliesgevend.">PF</span><span></span></div>
          {BT_HORIZONS.map((h) => {
            const s = stats(filtered, h, isCarry)
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
          <div className="fb-bd-title">Per timing-score · {HZ_LABEL[hz]} <Tip text="De kern van het day/swing-bewijs: hogere timing → beter resultaat, laag → slechter. Dit is dezelfde score die je bij elke live call ziet." /></div>
          <div className="fb-an-head"><span></span><span>winrate</span><span title="Profit factor: opgetelde winst ÷ opgeteld verlies. Boven 1 = winstgevend, onder 1 = verliesgevend.">PF</span><span></span></div>
          {[{ lo: 7, hi: 99, label: 'timing 7+' }, { lo: 5, hi: 7, label: '5–7' }, { lo: 3, hi: 5, label: '3–5' }, { lo: 0, hi: 3, label: '< 3' }].map((b) => {
            const s = stats(data.trades.filter((t) => (t.timing ?? 0) >= b.lo && (t.timing ?? 0) < b.hi), hz)
            return (
              <div key={b.label} className={`fb-an-row tier-${s.tier.tier}`}>
                <span className="fb-an-label">{b.label}</span>
                <span className="num fb-an-wr">{s.n ? `${s.winrate}%` : '—'}</span>
                <span className={`num fb-an-pf ${s.pf != null && s.pf !== Infinity ? (s.pf >= 1.05 ? 'fb-pos' : s.pf <= 0.95 ? 'fb-neg' : '') : ''}`}>{s.pf == null ? '—' : s.pf === Infinity ? '∞' : s.pf.toFixed(2)}</span>
                <span className="fb-an-n num">{s.n ? `n=${s.n}` : '—'}</span>
              </div>
            )
          })}
          <p className="fb-an-foot">Buckets over álle {data.trades.length.toLocaleString('nl-NL')} day/swing-trades (ongeacht de selectie hierboven).</p>
        </div>
      </div>

      {/* Move-kwaliteit: voor de technische trader dé vraag — kwam er ook een
          beweging die groot genoeg was om op te handelen? */}
      <div className="fb-bd-card" style={{ marginTop: 18 }}>
        <div className="fb-bd-title">
          Beweging — was er ook echt iets te verdienen? · {HZ_LABEL[hz]}
          <Tip text="Per trade meten we de grootste beweging in de voorspelde richting binnen de termijn (grootste meebeweging). 'Juist + move' = richting klopte én die beweging haalde de drempel — alleen die calls hebben waarde als je technisch handelt. 'Tegen' = de mediane grootste beweging de verkeerde kant op binnen dezelfde termijn: wat je onderweg typisch moet uitzitten." />
        </div>
        <div className="fb-an-controls" style={{ margin: '4px 0 10px' }}>
          <div>
            <span className="fb-mono">Minimale beweging</span>
            <div className="fb-hz-toggle">
              {MOVE_THRS.map((t) => (
                <button key={t} className={`fb-hz-btn${moveDrempel === t ? ' active' : ''}`} onClick={() => setMoveDrempel(t)}>{t} pips</button>
              ))}
            </div>
          </div>
        </div>
        {(() => {
          const s = btMoveStats(filtered, hz, moveDrempel)
          if (s.n === 0) return <div className="fb-note" style={{ margin: 0 }}>Geen bewegingsdata in deze selectie (draai het backtest-script opnieuw voor MFE-velden).</div>
          return (
            <>
              <div className="fb-an-headline" style={{ marginBottom: 12 }}>
                <div><div className="l">Juist én ≥ {moveDrempel} pips mee</div><div className="v accent num">{s.pctCorrMove}%</div></div>
                <div><div className="l">Mediane beweging mee / tegen</div><div className="v num">{s.medMfe}p <span className="fb-neg" style={{ fontSize: 15 }}>/ {s.medMae}p</span></div></div>
                <div><div className="l">Van de juiste calls haalde de drempel</div><div className="v num">{s.pctOfCorr}% <span className="fb-an-flats">n={s.n}</span></div></div>
              </div>
              <div className="fb-an-head"><span></span><span>juist+move</span><span>mee/tegen</span><span></span></div>
              {[{ lo: 7, hi: 99, label: 'timing 7+' }, { lo: 5, hi: 7, label: '5–7' }, { lo: 3, hi: 5, label: '3–5' }, { lo: 0, hi: 3, label: '< 3' }].map((b) => {
                const bs = btMoveStats(data.trades.filter((t) => (t.timing ?? 0) >= b.lo && (t.timing ?? 0) < b.hi), hz, moveDrempel)
                if (bs.n === 0) return null
                return (
                  <div key={b.label} className={`fb-an-row tier-${bs.tier.tier}`}>
                    <span className="fb-an-label">{b.label}</span>
                    <span className="num fb-an-wr">{bs.pctCorrMove}%</span>
                    <span className="num fb-an-pf">{bs.medMfe}/{bs.medMae}</span>
                    <span className="fb-an-n num">n={bs.n}</span>
                  </div>
                )
              })}
              <p className="fb-an-foot">
                Timing-buckets over álle day/swing-trades. Elke beweging is per trade na te rekenen: open de trade-lijst hieronder — de koersen en datums staan erbij.
                &quot;Tegen&quot; zegt niet wannéér: de tegenbeweging kan vóór of ná de meebeweging vallen.
              </p>
            </>
          )
        })()}
      </div>

      {byPair.length > 0 && (
        <div className="fb-bd-card" style={{ marginTop: 18 }}>
          <div className="fb-bd-title">Per paar · {HZ_LABEL[hz]} (huidige selectie, n ≥ 20) <Tip text={`Gesorteerd op 'juist + move': het percentage calls waar de richting klopte én de koers minstens ${moveDrempel} pips meebewoog — de maat die telt als je technisch instapt.`} /></div>
          <div className="fb-an-head"><span></span><span>juist+move</span><span>winrate</span><span></span></div>
          {byPair.map((g) => (
            <div key={g.pair} className={`fb-an-row tier-${g.s.tier.tier}`}>
              <span className="fb-an-label">{g.pair}</span>
              <span className="num fb-an-wr">{g.m.n ? `${g.m.pctCorrMove}%` : '—'}</span>
              <span className="num fb-an-pf">{g.s.winrate}%</span>
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
          {isCarry && (
            <p className="fb-note" style={{ margin: '8px 0' }}>
              <b>Let op:</b> het oordeel per rij (JUIST/ONJUIST) kijkt alleen naar de <b>koers</b>; de winrate- en PF-cijfers
              bovenaan rekenen het renteverschil (swap) mee. Een rij kan dus ONJUIST zijn op koers en toch licht positief incl. swap.
            </p>
          )}
          <div className="fb-tr2-head">
            <span>Datum</span><span>Paar</span><span>Referentie</span><span>Eindkoers · {HZ_LABEL[hz]}</span><span>Resultaat</span>
            <span className="fb-tr2-sec">{isCarry ? 'renteverschil' : 'bias / timing'}</span>
          </div>
          {listRows.map((t, i) => {
            const h = t.h[String(hz)]
            return (
              <div className="fb-tr2-row" key={`${t.d}-${t.p}-${i}`}>
                <span className="num">{fmtD(t.d)}</span>
                <span><b>{t.p}</b> <span className={`fb-chip ${t.dir === 'L' ? 'long' : 'short'}`}>{t.dir === 'L' ? 'LONG' : 'SHORT'}</span></span>
                <span className="num">{fmtP(t.p, t.e)}<br /><span className="fb-mono" style={{ textTransform: 'none' }}>{fmtD(t.ed)}</span></span>
                <span className="num">{h ? <>{fmtP(t.p, h.xp)}<br /><span className="fb-mono" style={{ textTransform: 'none' }}>{fmtD(h.x)}</span></> : '—'}</span>
                <span>
                  {h
                    ? <span className={`fb-tr-verdict ${h.ok ? 'win' : 'loss'}`}>{h.ok ? 'JUIST' : 'ONJUIST'}<span className="num" style={{ fontWeight: 400, marginLeft: 4 }}>{h.pips > 0 ? '+' : ''}{h.pips}p</span></span>
                    : <span className="fb-tr-verdict pending">—</span>}
                  {h?.mfe != null && (
                    <span className="fb-move-note num" title={`Grootste beweging mee: ${fmtP(t.p, t.e)} (${fmtD(t.ed)}) → ${h.mfp != null ? fmtP(t.p, h.mfp) : '?'} (${h.mfd ? fmtD(h.mfd) : '?'}). Grootste beweging tegen: ${h.mae ?? 0}p${h.map != null ? ` tot ${fmtP(t.p, h.map)}` : ''}${h.mad ? ` (${fmtD(h.mad)})` : ''}.`}>
                      mee +{h.mfe}p · tegen {h.mae ?? 0}p
                    </span>
                  )}
                </span>
                <span className="fb-tr2-sec num" style={{ fontSize: 11 }}>{isCarry
                  ? (t.diff != null ? `${t.diff > 0 ? '+' : ''}${t.diff}pp` : '—')
                  : `${(t.bias ?? 0).toFixed(1)} / ${(t.timing ?? 0).toFixed(1)}`}</span>
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
