'use client'

// ─── Fundamental Briefing — de simpele versie ─────────────────
// Eén vraag, één antwoord: naar welk paar moet je vandaag kijken,
// welke kant op, en hoeveel pips is het doel. Aangedreven door de
// geauditeerde v4-engine (/api/v4). Alle verdieping (waarom, koersen,
// horizons) zit achter één klik; de rest van het scherm blijft leeg.
//
// Doel-definitie (zelfde meting als het trackrecord): +30 pips
// (50 bij JPY-paren) in de callrichting, gehaald zodra de slotkoers
// van dag 1, 3 of 5 er minstens zoveel op staat. Close-to-close,
// geen TP/SL, alles narekenbaar in TradingView.

import { useEffect, useState } from 'react'

interface HorizonUitkomst {
  status: 'klopt' | 'klopt_niet' | 'te_klein'
  dirPips: number
  exitDate: string
  exitClose: number
}
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
  drempel: number
  horizons: Record<string, HorizonUitkomst>
}
interface V4Data {
  laatsteDatum: string | null
  vandaag: { calls: V4Call[] }
  trackrecord: { totaal: number; calls: V4Call[] }
}

const fmtKoers = (v: number | null, pair: string) => (v == null ? '—' : v.toFixed(pair.includes('JPY') ? 3 : 5))
const fmtDatum = (iso: string | null) =>
  iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—'

// doel gehaald zodra de slotkoers van dag 1, 3 of 5 ≥ drempel in de richting staat
function doelStatus(c: V4Call): { status: 'gehaald' | 'niet_gehaald' | 'loopt'; naDagen?: number } {
  for (const [h, dagen] of [['1d', 1], ['3d', 3], ['5d', 5]] as const) {
    if (c.horizons[h]?.status === 'klopt') return { status: 'gehaald', naDagen: dagen }
  }
  if (c.horizons['5d']) return { status: 'niet_gehaald' }
  return { status: 'loopt' }
}

export default function SimpleBriefing() {
  const [data, setData] = useState<V4Data | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [toonAlles, setToonAlles] = useState(false)

  useEffect(() => {
    fetch('/api/v4')
      .then((r) => r.json())
      .then((j) => (j.error ? setFout(j.error) : setData(j)))
      .catch((e) => setFout(String(e)))
  }, [])

  if (fout) return <Leeg><p className="text-sm text-red-600">Kon de briefing niet laden: {fout}</p></Leeg>
  if (!data) return <Leeg><p className="text-sm text-text-muted animate-pulse">Laden…</p></Leeg>

  const calls = data.vandaag.calls
  const alle = data.trackrecord.calls
  const afgerekend = alle.map(doelStatus).filter((s) => s.status !== 'loopt')
  const gehaald = afgerekend.filter((s) => s.status === 'gehaald').length

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-heading">Fundamental Briefing</h1>
      <p className="text-sm text-text-muted mt-1 mb-8">
        Welk paar is vandaag interessant volgens het systeem — en hoeveel pips is het doel.
      </p>

      {/* ── vandaag ── */}
      {!data.laatsteDatum ? (
        <div className="rounded-2xl bg-bg-card border border-border p-8 text-center">
          <p className="text-base font-semibold text-heading mb-1">Nog geen calls</p>
          <p className="text-sm text-text-muted">
            De eerste calls verschijnen op de eerstvolgende handelsdag rond 08:00.
          </p>
        </div>
      ) : calls.length === 0 ? (
        <div className="rounded-2xl bg-bg-card border border-border p-8 text-center">
          <p className="text-base font-semibold text-heading mb-1">Vandaag geen interessant paar</p>
          <p className="text-sm text-text-muted">
            Geen paar had op {fmtDatum(data.laatsteDatum)} een renteherprijzing mét een koers die er
            tegenin bewoog. Het systeem forceert niets: geen opzet = geen call.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-dim">
            {fmtDatum(data.laatsteDatum)} · {calls.length === 1 ? '1 paar' : `${calls.length} paren`} om naar te kijken
          </p>
          {calls.map((c) => <VandaagKaart key={c.id} call={c} />)}
        </div>
      )}

      {/* ── score ── */}
      <div className="mt-10">
        <div className="rounded-2xl bg-bg-card border border-border px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Doel gehaald</p>
            <p className="text-xl font-bold text-heading">
              {afgerekend.length === 0 ? '—' : `${gehaald} van ${afgerekend.length}`}
              {afgerekend.length > 0 && <span className="text-sm font-semibold text-text-muted ml-2">({Math.round((100 * gehaald) / afgerekend.length)}%)</span>}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Calls totaal</p>
            <p className="text-xl font-bold text-heading">{data.trackrecord.totaal}</p>
          </div>
          <div className="flex-1 min-w-[180px]">
            <p className="text-[11px] text-text-muted leading-relaxed">
              Doel = +30 pips (50 bij JPY) binnen 5 handelsdagen, op dagslotkoersen. Forward-only
              sinds 14 nov 2026 — geen backfill. {afgerekend.length < 30 && afgerekend.length > 0 ? 'Nog te weinig calls voor conclusies.' : ''}
            </p>
          </div>
          {alle.length > 0 && (
            <button onClick={() => setToonAlles((v) => !v)} className="text-xs font-medium text-accent-light hover:underline">
              {toonAlles ? 'verberg alle calls' : 'alle calls bekijken'}
            </button>
          )}
        </div>

        {toonAlles && alle.length > 0 && (
          <div className="mt-3 rounded-2xl bg-bg-card border border-border divide-y divide-border">
            {alle.map((c) => <HistorieRij key={c.id} call={c} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function Leeg({ children }: { children: React.ReactNode }) {
  return <div className="max-w-3xl mx-auto px-4 py-20 text-center">{children}</div>
}

// ─── kaart voor een call van vandaag ─────────────────────────
function VandaagKaart({ call }: { call: V4Call }) {
  const [open, setOpen] = useState(false)
  const long = call.richting === 'long'
  return (
    <div className="rounded-2xl bg-bg-card border border-border p-5">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-2xl font-bold text-heading tracking-tight">{call.pair}</span>
        <span className={`text-xs font-bold tracking-wide px-2.5 py-1 rounded-lg ${long ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {long ? 'LONG' : 'SHORT'}
        </span>
        <span className="ml-auto text-right">
          <span className="block text-lg font-bold text-heading">{long ? '+' : '−'}{call.drempel} pips</span>
          <span className="block text-[11px] text-text-dim -mt-0.5">doel · binnen 5 handelsdagen</span>
        </span>
      </div>
      <p className="text-xs text-text-muted mt-2">
        Signaal op slot {fmtKoers(call.signalClose, call.pair)} ({fmtDatum(call.signalDate)}) — meting start op de eerstvolgende dagslotkoers.
      </p>
      <button onClick={() => setOpen((v) => !v)} className="mt-3 text-xs font-medium text-accent-light hover:underline">
        {open ? 'verberg uitleg' : 'waarom dit paar?'}
      </button>
      {open && (
        <ol className="mt-2 space-y-1.5">
          {call.redenering.map((zin, i) => (
            <li key={i} className="text-sm text-text leading-relaxed flex gap-2">
              <span className="text-accent-light font-semibold shrink-0">{i + 1}.</span>
              <span>{zin}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

// ─── rij in de volledige lijst ───────────────────────────────
function HistorieRij({ call }: { call: V4Call }) {
  const [open, setOpen] = useState(false)
  const d = doelStatus(call)
  const long = call.richting === 'long'
  const pips5 = call.horizons['5d']?.dirPips

  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm">
        <span className="text-xs text-text-dim w-16 shrink-0">{fmtDatum(call.date)}</span>
        <span className="font-semibold text-heading w-20 shrink-0">{call.pair}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${long ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{long ? 'LONG' : 'SHORT'}</span>
        <span className="ml-auto text-xs">
          {d.status === 'gehaald' && <span className="text-emerald-700 font-semibold">doel gehaald{d.naDagen ? ` (dag ${d.naDagen})` : ''}</span>}
          {d.status === 'niet_gehaald' && <span className="text-red-600 font-semibold">niet gehaald{pips5 != null ? ` (${pips5 > 0 ? '+' : ''}${pips5}p na 5d)` : ''}</span>}
          {d.status === 'loopt' && <span className="text-text-dim">loopt nog</span>}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3">
          <ol className="space-y-1 mb-2">
            {call.redenering.map((zin, i) => (
              <li key={i} className="text-xs text-text-muted leading-relaxed">{i + 1}. {zin}</li>
            ))}
          </ol>
          <p className="text-[11px] text-text-dim">
            Meetstart: slot {fmtKoers(call.refClose, call.pair)} ({fmtDatum(call.refDate)}).{' '}
            {(['1d', '3d', '5d', '10d', '20d'] as const)
              .filter((h) => call.horizons[h])
              .map((h) => {
                const u = call.horizons[h]
                return `${h}: ${u.dirPips > 0 ? '+' : ''}${u.dirPips}p naar ${fmtKoers(u.exitClose, call.pair)} (${fmtDatum(u.exitDate)})`
              })
              .join(' · ') || 'Nog geen voltooide horizons.'}
          </p>
        </div>
      )}
    </div>
  )
}
