'use client'

// ─── Daily Macro Briefing — v4 ────────────────────────────────
// De fundamentele bias-tool na de audit-herbouw (docs/audit/
// fundamental-audit.md). Eén regel, twee tabs:
//   Vandaag     — de calls van de laatste handelsdag, elk in drie zinnen,
//                 plus waarom de overige paren géén call kregen.
//   Trackrecord — forward-only, per horizon (1/3/5/10/20 handelsdagen),
//                 elke uitkomst met begin- en eindkoers + datum zodat je
//                 alles in TradingView kunt nachecken. Geen TP/SL.

import { useEffect, useState } from 'react'

interface HorizonUitkomst {
  status: 'klopt' | 'klopt_niet' | 'te_klein'
  dirPips: number
  atrMult: number | null
  exitDate: string
  exitClose: number
}
interface CotStand { asOf: string; net: number; pct52w: number | null }
interface V4Call {
  id: string
  date: string
  pair: string
  richting: 'long' | 'short'
  redenering: string[]
  signalDate: string | null
  signalClose: number | null
  refDate: string | null
  refClose: number | null
  yldD5bp: number | null
  mom5Pips: number | null
  mom5Atr: number | null
  cotBase: CotStand | null
  cotQuote: CotStand | null
  drempel: number
  horizons: Record<string, HorizonUitkomst>
}
interface V4Data {
  engineVersion: string
  meting: string
  paren: string[]
  laatsteDatum: string | null
  vandaag: {
    calls: V4Call[]
    inputLog: { date: string; overgeslagen?: { pair: string; reden: string }[]; renteBronnen?: Record<string, string> } | null
  }
  trackrecord: {
    totaal: number
    perHorizon: Record<string, { klopt: number; kloptNiet: number; teKlein: number; open: number; winrateBeslist: number | null }>
    calls: V4Call[]
  }
}

const HORIZONS = ['1d', '3d', '5d', '10d', '20d']
const fmtKoers = (v: number | null, pair: string) => (v == null ? '—' : v.toFixed(pair.includes('JPY') ? 3 : 5))
const fmtDatum = (iso: string | null) =>
  iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—'

export default function V4Briefing() {
  const [data, setData] = useState<V4Data | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [tab, setTab] = useState<'vandaag' | 'trackrecord'>('vandaag')

  useEffect(() => {
    fetch('/api/v4')
      .then((r) => r.json())
      .then((j) => (j.error ? setFout(j.error) : setData(j)))
      .catch((e) => setFout(String(e)))
  }, [])

  if (fout) return <Kader><p className="text-sm text-red-600">Kon de briefing niet laden: {fout}</p></Kader>
  if (!data) return <Kader><p className="text-sm text-text-muted animate-pulse">Briefing laden…</p></Kader>

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* kop */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-heading">Daily Macro Briefing</h1>
          <p className="text-sm text-text-muted mt-1 max-w-2xl">
            Fundamentele richting per valutapaar: wáár de 2-jaars renteverwachting naartoe schuift,
            terwijl de koers er net tegenin bewoog. Richting en onderbouwing — timing, entry en risk bepaal je zelf.
          </p>
        </div>
        <span className="text-[11px] font-semibold tracking-wide uppercase text-accent-light bg-accent-glow border border-accent-dim rounded-full px-3 py-1">
          Engine {data.engineVersion}
        </span>
      </div>

      {/* tabs */}
      <div className="flex gap-2 border-b border-border mt-5 mb-6">
        {([['vandaag', 'Vandaag'], ['trackrecord', `Trackrecord (${data.trackrecord.totaal})`]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id ? 'border-accent text-heading' : 'border-transparent text-text-muted hover:text-heading'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'vandaag' ? <Vandaag data={data} /> : <Trackrecord data={data} />}

      {/* meetmethode — altijd zichtbaar onderaan */}
      <div className="mt-10 rounded-lg bg-surface border border-border px-4 py-3">
        <p className="text-xs text-text-muted leading-relaxed">
          <span className="font-semibold text-heading">Meetmethode:</span> {data.meting}.
          Elke koers staat met datum vermeld en is na te checken in TradingView. Het trackrecord is
          forward-only: het begon leeg op 14 november 2026 en er wordt nooit met terugwerkende kracht
          iets toegevoegd of aangepast. Volledige onderbouwing: audit-rapport in <code className="text-[11px]">docs/audit/</code>.
        </p>
      </div>
    </div>
  )
}

function Kader({ children }: { children: React.ReactNode }) {
  return <div className="max-w-5xl mx-auto px-4 py-16 text-center">{children}</div>
}

// ─── tab: Vandaag ─────────────────────────────────────────────
function Vandaag({ data }: { data: V4Data }) {
  const { calls, inputLog } = data.vandaag
  const vandaagISO = new Date().toISOString().slice(0, 10)

  if (!data.laatsteDatum) {
    return (
      <div className="rounded-xl bg-bg-card border border-border p-8 text-center">
        <h2 className="text-lg font-semibold text-heading mb-2">De nieuwe engine is live</h2>
        <p className="text-sm text-text-muted max-w-xl mx-auto leading-relaxed">
          De eerste calls verschijnen op de eerstvolgende handelsdag rond 08:00 (07:50 wintertijd).
          Het trackrecord begint bewust leeg en bouwt zich dag voor dag vooruit op — geen backfill,
          geen gereconstrueerde geschiedenis. Dat is de les van de audit.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-semibold text-heading">Calls van {fmtDatum(data.laatsteDatum)}</h2>
        {data.laatsteDatum < vandaagISO && (
          <span className="text-xs text-text-dim">(laatste handelsdag — nieuwe calls op de eerstvolgende werkdag ±08:00)</span>
        )}
      </div>

      {calls.length === 0 ? (
        <div className="rounded-xl bg-bg-card border border-border p-6">
          <p className="text-sm text-text-muted">
            Geen calls op {fmtDatum(data.laatsteDatum)}: geen van de {data.paren.length} paren had een
            renteherprijzing mét een koers die er tegenin bewoog. Geen opzet = geen call — de tool forceert niets.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {calls.map((c) => <CallKaart key={c.id} call={c} toonHorizons={false} />)}
        </div>
      )}

      {inputLog?.overgeslagen && inputLog.overgeslagen.length > 0 && (
        <div className="mt-6 rounded-lg bg-bg-card border border-border px-4 py-3">
          <h3 className="text-xs font-semibold text-heading mb-2 uppercase tracking-wide">
            Waarom de andere paren geen call kregen ({fmtDatum(inputLog.date)})
          </h3>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
            {inputLog.overgeslagen.map((o) => (
              <div key={o.pair} className="flex items-baseline gap-2 text-xs">
                <span className="font-medium text-text w-16 shrink-0">{o.pair}</span>
                <span className="text-text-muted">{o.reden}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-text-dim mt-2">
            CHF- en NZD-paren vallen buiten de tool: daarvoor is geen betrouwbare dagelijkse 2-jaars rentebron.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── tab: Trackrecord ─────────────────────────────────────────
function Trackrecord({ data }: { data: V4Data }) {
  const { perHorizon, calls, totaal } = data.trackrecord

  return (
    <div>
      {/* per-horizon samenvatting */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-2">
        {HORIZONS.map((h) => {
          const s = perHorizon[h]
          const beslist = s ? s.klopt + s.kloptNiet : 0
          return (
            <div key={h} className="rounded-lg bg-bg-card border border-border px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">{h.replace('d', ' dagen')}</div>
              <div className="text-xl font-bold text-heading mt-0.5">
                {s?.winrateBeslist != null ? `${s.winrateBeslist}%` : '—'}
              </div>
              <div className="text-[11px] text-text-muted">
                {beslist > 0 ? `${s.klopt} goed · ${s.kloptNiet} fout` : 'nog geen besliste uitkomsten'}
                {s && s.teKlein > 0 ? ` · ${s.teKlein} te klein` : ''}
                {s && s.open > 0 ? ` · ${s.open} open` : ''}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-text-dim mb-6">
        Winrate telt alleen besliste uitkomsten: de koers moet op de horizon minstens de drempel
        (30 pips; 50 bij JPY-paren) in een richting zijn bewogen. Kleinere bewegingen tellen als
        &ldquo;te klein&rdquo; — niet goed, niet fout. Bij minder dan 30 besliste uitkomsten is een
        percentage nog geen bewijs.
      </p>

      {totaal === 0 ? (
        <div className="rounded-xl bg-bg-card border border-border p-8 text-center">
          <p className="text-sm text-text-muted max-w-xl mx-auto leading-relaxed">
            Nog geen calls. Het trackrecord is op 14 november 2026 leeg gestart (forward-only) en vult
            zich automatisch vanaf de eerste handelsdag. De eerste 1-daagse uitkomst verschijnt een dag
            na de eerste call; de 20-daagse na ongeveer een maand.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {calls.map((c) => <CallKaart key={c.id} call={c} toonHorizons />)}
        </div>
      )}
    </div>
  )
}

// ─── call-kaart (gedeeld) ─────────────────────────────────────
function CallKaart({ call, toonHorizons }: { call: V4Call; toonHorizons: boolean }) {
  const [open, setOpen] = useState(!toonHorizons)
  const long = call.richting === 'long'
  const cotExtreem = (c: CotStand | null) => c?.pct52w != null && (c.pct52w >= 90 || c.pct52w <= 10)

  return (
    <div className="rounded-xl bg-bg-card border border-border overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span className={`text-[11px] font-bold tracking-wide px-2 py-0.5 rounded ${long ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {long ? 'LONG' : 'SHORT'}
        </span>
        <span className="font-semibold text-heading">{call.pair}</span>
        <span className="text-xs text-text-dim">{fmtDatum(call.date)}</span>
        <span className="hidden sm:inline text-xs text-text-muted ml-auto">
          rente-Δ5 {call.yldD5bp != null ? `${call.yldD5bp > 0 ? '+' : ''}${call.yldD5bp} bp` : '—'} ·
          koers 5d {call.mom5Pips != null ? `${call.mom5Pips > 0 ? '+' : ''}${call.mom5Pips}p` : '—'}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`shrink-0 text-text-dim transition-transform ${open ? 'rotate-180' : ''} ${toonHorizons ? '' : 'hidden'}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          <ol className="space-y-1.5 mb-3">
            {call.redenering.map((zin, i) => (
              <li key={i} className="text-sm text-text leading-relaxed flex gap-2">
                <span className="text-accent-light font-semibold shrink-0">{i + 1}.</span>
                <span>{zin}</span>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-muted mb-1">
            <span>Signaalbasis: slot <b className="text-heading">{fmtKoers(call.signalClose, call.pair)}</b> op {fmtDatum(call.signalDate)}</span>
            {call.refClose != null && (
              <span>Meetreferentie: slot <b className="text-heading">{fmtKoers(call.refClose, call.pair)}</b> op {fmtDatum(call.refDate)}</span>
            )}
            {call.mom5Atr != null && <span>Stretch: {call.mom5Atr}× dagelijkse ATR</span>}
          </div>
          {(cotExtreem(call.cotBase) || cotExtreem(call.cotQuote)) && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block mb-1">
              Let op: speculantenpositionering op een extreem ({[call.cotBase, call.cotQuote].filter(cotExtreem).map((c) => `${c!.pct52w}e percentiel`).join(' / ')}) — informatief, geen signaalonderdeel.
            </p>
          )}

          {toonHorizons && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-text-dim">
                    <th className="py-1 pr-3 font-medium">Horizon</th>
                    <th className="py-1 pr-3 font-medium">Uitkomst</th>
                    <th className="py-1 pr-3 font-medium">Beweging</th>
                    <th className="py-1 font-medium">Van → naar (narekenbaar)</th>
                  </tr>
                </thead>
                <tbody>
                  {HORIZONS.map((h) => {
                    const u = call.horizons[h]
                    return (
                      <tr key={h} className="border-t border-border">
                        <td className="py-1.5 pr-3 text-text">{h.replace('d', ' dagen')}</td>
                        <td className="py-1.5 pr-3"><StatusChip status={u?.status} /></td>
                        <td className={`py-1.5 pr-3 font-medium ${!u ? 'text-text-dim' : u.dirPips >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {u ? `${u.dirPips > 0 ? '+' : ''}${u.dirPips} pips${u.atrMult != null ? ` (${u.atrMult}× ATR)` : ''}` : '—'}
                        </td>
                        <td className="py-1.5 text-text-muted">
                          {u && call.refClose != null
                            ? `${fmtKoers(call.refClose, call.pair)} (${fmtDatum(call.refDate)}) → ${fmtKoers(u.exitClose, call.pair)} (${fmtDatum(u.exitDate)})`
                            : 'horizon nog niet volledig verstreken'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusChip({ status }: { status?: string }) {
  if (!status) return <span className="text-text-dim">open</span>
  if (status === 'klopt') return <span className="text-emerald-700 font-semibold">richting klopt</span>
  if (status === 'klopt_niet') return <span className="text-red-600 font-semibold">klopt niet</span>
  return <span className="text-text-muted">te klein</span>
}
