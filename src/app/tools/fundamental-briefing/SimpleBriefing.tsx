'use client'

// ─── Fundamental Briefing — de simpele versie ─────────────────
// Eén vraag, één antwoord: naar welk paar moet je nú kijken, welke
// kant op, en hoeveel pips is het doel. Aangedreven door de
// geauditeerde v4-engine (/api/v4).
//
// Spelregels (zelfde meting als het trackrecord):
//   • Doel = +30 pips (50 bij JPY) in de callrichting.
//   • WIN  zodra de slotkoers van dag 1, 3 of 5 het doel haalt —
//     definitief, latere dagen veranderen er niets meer aan.
//   • LOSS als de deadline (slot dag 5) verstrijkt zonder doel.
//   • Zolang een call loopt, geeft de engine dat paar niet opnieuw.
//   • Elke uitkomst staat er mét koersen en datums bij — narekenbaar
//     in TradingView.

import { useEffect, useState } from 'react'

interface HorizonUitkomst {
  status: 'klopt' | 'klopt_niet' | 'te_klein'
  dirPips: number
  exitDate: string
  exitClose: number
}
interface DoelUitkomst {
  status: 'gehaald' | 'niet_gehaald' | 'loopt'
  dagGehaald?: 1 | 3 | 5
  pips?: number
  exitClose?: number
  exitDate?: string
  tussenstand?: { dag: 1 | 3; pips: number; exitClose: number; exitDate: string } | null
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
  uitkomst: DoelUitkomst
}
interface V4Data {
  laatsteDatum: string | null
  actief: { calls: V4Call[] }
  trackrecord: { totaal: number; calls: V4Call[] }
}

const fmtKoers = (v: number | null | undefined, pair: string) => (v == null ? '—' : v.toFixed(pair.includes('JPY') ? 3 : 5))
const fmtDatum = (iso: string | null | undefined) =>
  iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—'

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

  const actief = data.actief.calls
  const alle = data.trackrecord.calls
  const afgerond = alle.filter((c) => c.uitkomst.status !== 'loopt')
  const gehaald = afgerond.filter((c) => c.uitkomst.status === 'gehaald').length

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-heading">Fundamental Briefing</h1>
      <p className="text-sm text-text-muted mt-1 mb-8">
        Naar welk paar moet je nu kijken — en hoeveel pips is het doel.
      </p>

      {/* ── actieve calls ── */}
      {actief.length === 0 ? (
        <div className="rounded-2xl bg-bg-card border border-border p-8 text-center">
          <p className="text-base font-semibold text-heading mb-1">
            {data.laatsteDatum ? 'Geen actieve calls' : 'Nog geen calls'}
          </p>
          <p className="text-sm text-text-muted">
            {data.laatsteDatum
              ? 'Alle eerdere calls zijn afgerond en er was geen nieuw paar met een goede opzet. Volgende check: eerstvolgende handelsdag rond 08:00.'
              : 'De eerste calls verschijnen op de eerstvolgende handelsdag rond 08:00.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-dim">
            Actief · {actief.length === 1 ? '1 paar' : `${actief.length} paren`} om naar te kijken
          </p>
          {actief.map((c) => <ActieveKaart key={c.id} call={c} />)}
        </div>
      )}

      {/* ── score ── */}
      <div className="mt-10">
        <div className="rounded-2xl bg-bg-card border border-border px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Doel gehaald</p>
            <p className="text-xl font-bold text-heading">
              {afgerond.length === 0 ? '—' : `${gehaald} van ${afgerond.length}`}
              {afgerond.length > 0 && <span className="text-sm font-semibold text-text-muted ml-2">({Math.round((100 * gehaald) / afgerond.length)}%)</span>}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Calls totaal</p>
            <p className="text-xl font-bold text-heading">{data.trackrecord.totaal}</p>
          </div>
          <div className="flex-1 min-w-[180px]">
            <p className="text-[11px] text-text-muted leading-relaxed">
              Win = slotkoers van dag 1, 3 of 5 haalt het doel (+30 pips, JPY +50). Loss = deadline
              (dag 5) voorbij zonder doel. Forward-only sinds 14 nov 2026 — geen backfill.
              {afgerond.length > 0 && afgerond.length < 30 ? ' Nog te weinig calls voor conclusies.' : ''}
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

function RichtingChip({ richting, groot = false }: { richting: 'long' | 'short'; groot?: boolean }) {
  const long = richting === 'long'
  return (
    <span className={`font-bold tracking-wide rounded-lg border ${groot ? 'text-xs px-2.5 py-1' : 'text-[10px] px-1.5 py-0.5'} ${long ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
      {long ? 'LONG' : 'SHORT'}
    </span>
  )
}

// ─── kaart voor een actieve call ─────────────────────────────
function ActieveKaart({ call }: { call: V4Call }) {
  const [open, setOpen] = useState(false)
  const t = call.uitkomst.tussenstand
  return (
    <div className="rounded-2xl bg-bg-card border border-border p-5">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-2xl font-bold text-heading tracking-tight">{call.pair}</span>
        <RichtingChip richting={call.richting} groot />
        <span className="ml-auto text-right">
          <span className="block text-lg font-bold text-heading">{call.richting === 'long' ? '+' : '−'}{call.drempel} pips</span>
          <span className="block text-[11px] text-text-dim -mt-0.5">doel · binnen 5 handelsdagen</span>
        </span>
      </div>

      <p className="text-xs text-text-muted mt-2">
        Call van {fmtDatum(call.date)}.{' '}
        {call.refClose != null
          ? <>Startpunt: slot <b className="text-heading">{fmtKoers(call.refClose, call.pair)}</b> ({fmtDatum(call.refDate)}).</>
          : <>Startpunt wordt de slotkoers van {fmtDatum(call.date)} (signaal berekend op slot {fmtKoers(call.signalClose, call.pair)} van {fmtDatum(call.signalDate)}).</>}
      </p>
      {t && (
        <p className={`text-xs font-medium mt-1 ${t.pips >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
          Tussenstand na dag {t.dag}: {t.pips > 0 ? '+' : ''}{t.pips} pips (slot {fmtKoers(t.exitClose, call.pair)}, {fmtDatum(t.exitDate)}) — doel nog niet gehaald, deadline dag 5.
        </p>
      )}

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
  const u = call.uitkomst

  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} className="w-full px-4 py-2.5 text-left">
        <span className="flex items-center gap-3 text-sm">
          <span className="text-xs text-text-dim w-16 shrink-0">{fmtDatum(call.date)}</span>
          <span className="font-semibold text-heading w-20 shrink-0">{call.pair}</span>
          <RichtingChip richting={call.richting} />
          <span className="ml-auto text-xs">
            {u.status === 'gehaald' && <span className="text-emerald-700 font-semibold">✅ win — doel gehaald op dag {u.dagGehaald}</span>}
            {u.status === 'niet_gehaald' && <span className="text-red-600 font-semibold">❌ loss — doel niet gehaald</span>}
            {u.status === 'loopt' && <span className="text-text-dim">loopt nog</span>}
          </span>
        </span>
        {/* waarom win/loss — altijd zichtbaar, met koersen en datums */}
        {u.status === 'gehaald' && (
          <span className="block text-[11px] text-text-muted mt-1 pl-[4.75rem]">
            Slot op dag {u.dagGehaald} stond {u.pips != null && u.pips > 0 ? '+' : ''}{u.pips} pips in de callrichting
            (doel was {call.drempel}): van {fmtKoers(call.refClose, call.pair)} ({fmtDatum(call.refDate)}) naar {fmtKoers(u.exitClose, call.pair)} ({fmtDatum(u.exitDate)}).
          </span>
        )}
        {u.status === 'niet_gehaald' && (
          <span className="block text-[11px] text-text-muted mt-1 pl-[4.75rem]">
            Geen van de meetmomenten (slot dag 1, 3, 5) haalde {call.drempel} pips; na 5 dagen {u.pips != null && u.pips > 0 ? '+' : ''}{u.pips} pips:
            van {fmtKoers(call.refClose, call.pair)} ({fmtDatum(call.refDate)}) naar {fmtKoers(u.exitClose, call.pair)} ({fmtDatum(u.exitDate)}).
          </span>
        )}
      </button>
      {open && (
        <div className="px-4 pb-3">
          <ol className="space-y-1 mb-2">
            {call.redenering.map((zin, i) => (
              <li key={i} className="text-xs text-text-muted leading-relaxed">{i + 1}. {zin}</li>
            ))}
          </ol>
          <p className="text-[11px] text-text-dim">
            {(['1d', '3d', '5d', '10d', '20d'] as const)
              .filter((h) => call.horizons[h])
              .map((h) => {
                const x = call.horizons[h]
                return `${h}: ${x.dirPips > 0 ? '+' : ''}${x.dirPips}p, slot ${fmtKoers(x.exitClose, call.pair)} (${fmtDatum(x.exitDate)})`
              })
              .join(' · ') || 'Nog geen voltooide meetmomenten.'}
          </p>
        </div>
      )}
    </div>
  )
}
