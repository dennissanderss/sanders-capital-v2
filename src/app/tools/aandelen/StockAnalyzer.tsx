'use client'

// ─── Aandelen Analyzer ────────────────────────────────────────
// Eén aandeel, twee gescheiden oordelen:
//   • Lange termijn  — het BEDRIJF (kwaliteit, gezondheid, groei, prijs)
//   • Korte termijn  — de KOERS (trend, momentum, instap/stop/doel)
// Alle regels staan in src/lib/stocks/analysis.ts en zijn per check
// zichtbaar mét waarde en uitleg. Koersbewegingen altijd met begin- en
// eindkoers + datum, zodat alles na te rekenen is in TradingView.
// De oordelen zijn uitkomsten van rekenregels, geen advies: de labels en
// teksten zeggen dat bewust zo (zie docs/audit/aandelen-analyzer-audit.md).

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { AandeelAnalyse } from '@/lib/stocks/service'
import { PLAN_KOSTEN, PLAN_MAX_DAGEN, PLAN_STUDIE, type Check, type Oordeel, type Status, type Categorie } from '@/lib/stocks/analysis'
import type { JaarRij } from '@/lib/stocks/yahoo'
import { nl, pct, groot, datumNl } from '@/lib/stocks/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

interface Suggestie { symbol: string; naam: string; beurs: string; sector: string | null }

const VOORBEELDEN = [
  ['ASML.AS', 'ASML'], ['ADYEN.AS', 'Adyen'], ['SHELL.AS', 'Shell'], ['INGA.AS', 'ING'],
  ['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['NVDA', 'Nvidia'], ['GOOGL', 'Alphabet'],
]

const OORDEEL_LANG: Record<Oordeel, string> = {
  kopen: 'Koopwaardig volgens de regels', afwachten: 'Afwachten', vermijden: 'Niet koopwaardig', onbekend: 'Geen oordeel',
}
const OORDEEL_KORT: Record<Oordeel, string> = {
  kopen: 'Instap mogelijk', afwachten: 'Wachten', vermijden: 'Geen nieuwe trade', onbekend: 'Geen oordeel',
}
const OORDEEL_KLEUR: Record<Oordeel, string> = {
  kopen: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  afwachten: 'bg-amber-50 text-amber-700 border-amber-200',
  vermijden: 'bg-red-50 text-red-700 border-red-200',
  onbekend: 'bg-bg-hover text-text-muted border-border',
}
const STATUS_STIP: Record<Status, string> = {
  goed: 'bg-emerald-500', neutraal: 'bg-amber-400', slecht: 'bg-red-500', onbekend: 'bg-slate-300',
}
const STATUS_TEKST: Record<Status, string> = {
  goed: 'goed', neutraal: 'matig', slecht: 'zwak', onbekend: 'niet beoordeeld',
}

type Tab = 'bedrijf' | 'lang' | 'kort' | 'cijfers'
const TICKER = /^[A-Za-z0-9.\-]{1,15}$/
const plus = (v: number) => (v > 0 ? '+' : '')
const isAandeel = (d: AandeelAnalyse) => !d.type || d.type === 'EQUITY'

async function zoekOp(q: string): Promise<Suggestie[]> {
  try {
    const r = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`)
    if (!r.ok) return []
    const j = await r.json()
    return Array.isArray(j?.resultaten) ? j.resultaten : []
  } catch {
    return []
  }
}

export default function StockAnalyzer() {
  const [zoekterm, setZoekterm] = useState('')
  const [suggesties, setSuggesties] = useState<Suggestie[]>([])
  const [toonSuggesties, setToonSuggesties] = useState(false)
  const [keuze, setKeuze] = useState(-1)
  const [alternatieven, setAlternatieven] = useState<Suggestie[]>([])
  const [data, setData] = useState<AandeelAnalyse | null>(null)
  const [laden, setLaden] = useState<string | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('bedrijf')
  const aanvraag = useRef(0)

  // `isTicker`: de invoer is zeker een ticker (gekozen uit de lijst of een
  // voorbeeld). Anders is het vrije invoer en zoeken we eerst: wie "Shell"
  // of "Adyen" typt, bedoelt een bedrijf en geen ticker.
  const analyseer = async (invoer: string, isTicker = false) => {
    const ruw = invoer.trim()
    if (!ruw) return
    const id = ++aanvraag.current
    const actueel = () => id === aanvraag.current
    setLaden(ruw); setFout(null); setAlternatieven([]); setToonSuggesties(false); setKeuze(-1)
    try {
      let symbol = ruw.toUpperCase()
      let anderen: Suggestie[] = []
      if (!isTicker) {
        const res = await zoekOp(ruw)
        if (!actueel()) return
        const exact = res.find((x) => x.symbol.toUpperCase() === symbol)
        if (!exact && res.length > 0) {
          // Zelfde bedrijf ook in Amsterdam genoteerd? Dan die: koers in euro.
          const amsterdam = res.find((x) => x.symbol.toUpperCase().endsWith('.AS') && x.naam === res[0].naam)
          symbol = (amsterdam ?? res[0]).symbol.toUpperCase()
        }
        else if (!exact && !TICKER.test(ruw)) {
          setFout(`Niets gevonden voor "${ruw}". Controleer de spelling of probeer de ticker.`); setData(null)
          return
        }
        anderen = res.filter((x) => x.symbol.toUpperCase() !== symbol).slice(0, 5)
      }
      setLaden(symbol)
      const r = await fetch(`/api/stocks/analyze?symbol=${encodeURIComponent(symbol)}`)
      let j: (AandeelAnalyse & { error?: string }) | null = null
      try { j = await r.json() } catch { /* geen JSON: storing of time-out */ }
      if (!actueel()) return
      if (!r.ok || !j || j.error) {
        setData(null)
        setFout(j?.error || (r.status === 504
          ? 'De databron reageerde te traag. Probeer het over een minuut opnieuw.'
          : 'De analyse kon niet worden opgehaald. Probeer het over een minuut opnieuw.'))
        if (r.status === 404) {
          if (anderen.length === 0) anderen = (await zoekOp(ruw)).filter((x) => x.symbol.toUpperCase() !== symbol).slice(0, 5)
          if (actueel()) setAlternatieven(anderen)
        }
        return
      }
      setData(j); setTab(isAandeel(j) ? 'bedrijf' : 'kort'); setZoekterm(symbol); setAlternatieven(anderen)
      window.history.replaceState(null, '', `?symbol=${encodeURIComponent(symbol)}`)
    } catch {
      if (actueel()) { setData(null); setFout('Geen verbinding met de server. Controleer je internet en probeer het opnieuw.') }
    } finally {
      if (actueel()) setLaden(null)
    }
  }

  // Deelbare link: ?symbol=ASML.AS opent direct de analyse.
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('symbol')
    if (s) analyseer(s, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Suggesties tijdens het typen (naam of ticker). Een traag antwoord op een
  // oudere zoekterm mag een nieuwer antwoord niet overschrijven.
  useEffect(() => {
    const q = zoekterm.trim()
    if (q.length < 2 || !toonSuggesties) { setSuggesties([]); return }
    let actief = true
    const t = setTimeout(() => {
      zoekOp(q).then((res) => { if (actief) { setSuggesties(res); setKeuze(-1) } })
    }, 250)
    return () => { actief = false; clearTimeout(t) }
  }, [zoekterm, toonSuggesties])

  const lijstOpen = toonSuggesties && suggesties.length > 0

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-heading">Aandelen Analyzer</h1>
      <p className="text-sm text-text-muted mt-1 mb-6 max-w-2xl">
        Zoek een aandeel en krijg in gewone taal: wat het bedrijf doet, hoe gezond de cijfers zijn, en
        twee losse oordelen — één voor de <strong className="text-heading">lange termijn</strong> (jaren
        vasthouden) en één voor de <strong className="text-heading">korte termijn</strong> (dagen tot weken).
      </p>

      {/* ── zoeken ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (keuze >= 0 && suggesties[keuze]) analyseer(suggesties[keuze].symbol, true)
          else analyseer(zoekterm)
        }}
        className="relative max-w-xl"
      >
        <div className="flex gap-2">
          <input
            value={zoekterm}
            onChange={(e) => { setZoekterm(e.target.value); setToonSuggesties(true) }}
            onFocus={() => setToonSuggesties(true)}
            onBlur={() => setTimeout(() => setToonSuggesties(false), 150)}
            onKeyDown={(e) => {
              if (!lijstOpen) return
              if (e.key === 'ArrowDown') { e.preventDefault(); setKeuze((k) => Math.min(k + 1, suggesties.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setKeuze((k) => Math.max(k - 1, -1)) }
              else if (e.key === 'Escape') setToonSuggesties(false)
            }}
            placeholder="Bedrijfsnaam of ticker, bijv. ASML of AAPL"
            aria-label="Zoek een aandeel op bedrijfsnaam of ticker"
            role="combobox" aria-expanded={lijstOpen} aria-controls="aandeel-suggesties" aria-autocomplete="list"
            className="flex-1 px-4 py-3 rounded-xl bg-bg-card border border-border text-heading text-sm placeholder:text-text-dim focus:outline-none focus:border-accent"
            autoComplete="off"
          />
          <button
            type="submit" disabled={!!laden}
            className="px-5 py-3 rounded-xl bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {laden ? 'Bezig…' : 'Analyseer'}
          </button>
        </div>
        {lijstOpen && (
          <ul id="aandeel-suggesties" role="listbox" className="absolute z-20 left-0 right-0 mt-1 rounded-xl bg-bg-card border border-border shadow-lg overflow-hidden">
            {suggesties.map((s, i) => (
              <li key={s.symbol} role="option" aria-selected={i === keuze}>
                <button
                  type="button" tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => analyseer(s.symbol, true)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-bg-hover flex items-baseline gap-3 ${i === keuze ? 'bg-bg-hover' : ''}`}
                >
                  <span className="text-sm font-semibold text-heading w-24 shrink-0">{s.symbol}</span>
                  <span className="text-sm text-text truncate flex-1">{s.naam}</span>
                  <span className="text-xs text-text-muted shrink-0">{s.beurs}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
      <div className="flex flex-wrap gap-2 mt-3">
        {VOORBEELDEN.map(([sym, label]) => (
          <button
            key={sym} onClick={() => analyseer(sym, true)}
            className="px-3 py-1 rounded-full border border-border text-xs text-text-muted hover:text-heading hover:border-border-light transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-text-muted mt-2">
        Tip: hetzelfde bedrijf staat vaak op meerdere beurzen. Amsterdam eindigt op <code>.AS</code> (koers in euro), Amerikaanse tickers hebben geen toevoeging.
      </p>

      <div aria-live="polite">
        {laden && (
          <div className="mt-10 rounded-2xl bg-bg-card border border-border p-8 text-center">
            <p className="text-sm text-text-muted animate-pulse">{laden} wordt geanalyseerd — jaarrekening, kasstromen en 10 jaar koersen ophalen…</p>
          </div>
        )}
        {fout && !laden && (
          <div className="mt-10 rounded-2xl bg-bg-card border border-red-200 p-6" role="alert">
            <p className="text-sm text-red-600">{fout}</p>
            {alternatieven.length === 0 && (
              <p className="text-xs text-text-muted mt-1">Zoek op bedrijfsnaam en kies een resultaat uit de lijst.</p>
            )}
          </div>
        )}
        {alternatieven.length > 0 && !laden && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted">{fout ? 'Bedoelde je:' : 'Andere noteringen of bedrijven met deze naam:'}</span>
            {alternatieven.map((s) => (
              <button
                key={s.symbol} onClick={() => analyseer(s.symbol, true)}
                className="px-3 py-1 rounded-full border border-border text-xs text-text hover:text-heading hover:border-border-light transition-colors"
              >
                <span className="font-semibold">{s.symbol}</span> · {s.naam}{s.beurs ? ` · ${s.beurs}` : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {data && !laden && <Resultaat d={data} tab={tab} setTab={setTab} />}

      <p className="text-xs text-text-muted leading-relaxed mt-10 max-w-3xl">
        Educatief hulpmiddel, geen beleggingsadvies. De oordelen komen uit vaste rekenregels op openbare data
        (Yahoo Finance) en houden geen rekening met jouw situatie, spreiding of belasting. Data kan fouten of
        vertraging bevatten; controleer belangrijke cijfers in het jaarverslag van het bedrijf. Resultaten uit
        het verleden bieden geen garantie voor de toekomst — je kunt je inleg verliezen.
      </p>
    </div>
  )
}

// ─── Resultaat ────────────────────────────────────────────────
function Resultaat({ d, tab, setTab }: { d: AandeelAnalyse; tab: Tab; setTab: (t: Tab) => void }) {
  const prijs = (v: number | null | undefined) => (v == null ? '—' : `${d.valuta} ${nl(v, 2)}`)
  const k = d.koers
  const dag = k.vorigSlot ? k.slot / k.vorigSlot - 1 : null
  const ind = d.korteTermijn.indicatoren
  const positie52 = ind?.hoog52 != null && ind.laag52 != null && ind.hoog52 > ind.laag52
    ? Math.max(0, Math.min(1, (k.slot - ind.laag52) / (ind.hoog52 - ind.laag52))) : null
  const liveAfwijkend = k.live != null && Math.abs(k.live / k.slot - 1) > 0.0005
  const tijdstip = (iso: string) => new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const aandeel = isAandeel(d)
  const tabs = (aandeel
    ? [['bedrijf', 'Het bedrijf'], ['lang', 'Lange termijn'], ['kort', 'Korte termijn'], ['cijfers', 'Jaarcijfers']]
    : [['kort', 'Korte termijn']]) as [Tab, string][]
  const actief: Tab = tabs.some(([id]) => id === tab) ? tab : tabs[0][0]
  const div = d.kern.dividendRendement

  return (
    <div className="mt-8 space-y-5">
      {/* ── kop ── */}
      <div className="rounded-2xl bg-bg-card border border-border p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {d.symbol}{d.beurs ? ` · ${d.beurs}` : ''}
            </p>
            <h2 className="text-xl font-bold text-heading mt-0.5">{d.naam}</h2>
            <p className="text-sm text-text-muted mt-0.5">
              {[d.sectorNl, d.industrie].filter(Boolean).join(' · ') || (aandeel ? '—' : 'ETF of fonds')}
              {d.landNl ? ` · ${[d.stad, d.landNl].filter(Boolean).join(', ')}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-heading">{prijs(k.slot)}</p>
            <p className="text-xs text-text-muted">
              slotkoers {datumNl(k.slotDatum)}
              {dag != null && (
                <span className={dag > 0 ? 'text-emerald-600' : dag < 0 ? 'text-red-600' : ''}> · {plus(dag)}{pct(dag, 2)}</span>
              )}
            </p>
            {dag != null && (
              <p className="text-xs text-text-muted">t.o.v. {prijs(k.vorigSlot)} op {datumNl(k.vorigSlotDatum)}</p>
            )}
            {liveAfwijkend && (
              <p className="text-xs text-text-muted">
                {k.sessieOpen ? 'tussenstand, beurs is open' : 'laatste koers'}: {prijs(k.live)}{k.liveTijd ? ` · ${tijdstip(k.liveTijd)}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 mt-5 pt-5 border-t border-border">
          <Feit label="Beurswaarde" waarde={groot(k.marktkap, k.marktkapValuta)} uitleg="Wat alle aandelen samen waard zijn" />
          <Feit label="Koers/winst" waarde={d.kern.koersWinst != null && d.kern.koersWinst > 0 ? nl(d.kern.koersWinst, 1) : '—'} uitleg="Prijs per euro winst van de afgelopen 12 maanden" />
          <Feit label="Dividend" waarde={div == null ? '—' : div === 0 ? 'geen' : pct(div)} uitleg="Jaarlijkse uitkering t.o.v. de koers" />
          <Feit label="Volgende cijfers" waarde={d.cijfersDatum ? datumNl(d.cijfersDatum) : '—'} uitleg="Kwartaalcijfers: koers kan dan fors bewegen" />
        </div>

        {positie52 != null && ind && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>52-weeks laag {prijs(ind.laag52)} ({datumNl(ind.laag52Datum)})</span>
              <span>52-weeks hoog {prijs(ind.hoog52)} ({datumNl(ind.hoog52Datum)})</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-bg-hover" role="img" aria-label={`De slotkoers staat op ${pct(positie52, 0)} van de afstand tussen het laagste en hoogste punt van het afgelopen jaar`}>
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent border-2 border-white shadow" style={{ left: `${positie52 * 100}%` }} />
            </div>
          </div>
        )}
        <p className="text-xs text-text-muted mt-4">
          Gegevens opgehaald op {tijdstip(d.gemaaktOp)}. Alle oordelen rekenen met de slotkoers van {datumNl(k.slotDatum)}.
        </p>
      </div>

      {d.waarschuwingen.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
          {d.waarschuwingen.map((w, i) => <p key={i} className="text-xs text-amber-800">{w}</p>)}
        </div>
      )}

      {/* ── de twee oordelen ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <OordeelKaart
          titel="Lange termijn" sub="Jaren vasthouden · kijkt naar het bedrijf"
          oordeel={d.langeTermijn.oordeel} label={OORDEEL_LANG[d.langeTermijn.oordeel]}
          score={d.langeTermijn.score} tekst={d.langeTermijn.samenvatting}
          onMeer={aandeel ? () => setTab('lang') : undefined}
        />
        <OordeelKaart
          titel="Korte termijn" sub="Dagen tot weken · kijkt alleen naar de koers"
          oordeel={d.korteTermijn.oordeel} label={OORDEEL_KORT[d.korteTermijn.oordeel]}
          score={d.korteTermijn.score} tekst={d.korteTermijn.samenvatting} onMeer={() => setTab('kort')}
          voet="Dit gaat alleen over korte trades. Het zegt niets over wat je met een langetermijnpositie moet doen."
        />
      </div>
      <div className="rounded-xl bg-surface border border-border px-4 py-3 text-sm text-text leading-relaxed">
        <strong className="text-heading">Lees dit als uitkomst van rekenregels, niet als advies.</strong>{' '}
        De twee oordelen kunnen elkaar tegenspreken; dat is normaal, want ze kijken naar iets anders. En één
        aandeel is geen portefeuille: steek niet meer dan ongeveer 5% van je geld in één aandeel, riskeer per
        korte trade hooguit 1% van je rekening, en vergelijk altijd met het simpele alternatief: een wereldwijd
        indexfonds.
      </div>

      {/* ── tabs ── */}
      <div role="tablist" aria-label="Onderdelen van de analyse" className="flex gap-1 border-b border-border overflow-x-auto overflow-y-hidden">
        {tabs.map(([id, label]) => (
          <button
            key={id} role="tab" aria-selected={actief === id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
              actief === id ? 'border-accent text-heading font-semibold' : 'border-transparent text-text-muted hover:text-heading'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {actief === 'bedrijf' && <TabBedrijf d={d} />}
        {actief === 'lang' && <TabLang d={d} prijs={prijs} />}
        {actief === 'kort' && <TabKort d={d} prijs={prijs} />}
        {actief === 'cijfers' && <TabCijfers d={d} />}
      </div>
    </div>
  )
}

function Feit({ label, waarde, uitleg }: { label: string; waarde: string; uitleg: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="text-base font-semibold text-heading">{waarde}</p>
      <p className="text-xs text-text-muted leading-snug">{uitleg}</p>
    </div>
  )
}

function OordeelKaart({ titel, sub, oordeel, label, score, tekst, onMeer, voet }: {
  titel: string; sub: string; oordeel: Oordeel; label: string; score: number | null; tekst: string[]; onMeer?: () => void; voet?: string
}) {
  return (
    <div className="rounded-2xl bg-bg-card border border-border p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-heading">{titel}</p>
          <p className="text-xs text-text-muted">{sub}</p>
        </div>
        {score != null && (
          <p className="text-sm font-semibold text-text-muted shrink-0">{score}<span className="text-text-dim">/100</span></p>
        )}
      </div>
      <span className={`self-start mt-3 px-3 py-1 rounded-full border text-sm font-semibold ${OORDEEL_KLEUR[oordeel]}`}>{label}</span>
      <div className="mt-3 space-y-1.5 flex-1">
        {tekst.map((t, i) => <p key={i} className="text-sm text-text leading-relaxed">{t}</p>)}
      </div>
      {voet && <p className="text-xs text-text-muted mt-3">{voet}</p>}
      {onMeer && (
        <button onClick={onMeer} className="self-start mt-3 text-xs font-medium text-accent-light hover:underline">
          bekijk de onderbouwing →
        </button>
      )}
    </div>
  )
}

function Kaart({ titel, children, sub }: { titel: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-bg-card border border-border p-5">
      <p className="text-sm font-bold text-heading">{titel}</p>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

function CheckRij({ c }: { c: Check }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="py-2.5">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-start gap-3 text-left">
        <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_STIP[c.status]}`} aria-hidden="true" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-heading">{c.label}<span className="sr-only"> ({STATUS_TEKST[c.status]})</span></span>
          <span className="block text-xs text-text-muted break-words">{c.waarde}</span>
        </span>
        <span className="text-xs text-text-muted shrink-0 mt-0.5">
          {c.punten == null ? 'telt niet mee' : `${nl(c.punten, c.punten % 1 ? 1 : 0)}/${c.max}`} <span className="ml-1" aria-hidden="true">{open ? '−' : '?'}</span>
        </span>
      </button>
      {open && <p className="text-xs text-text-muted leading-relaxed mt-2 ml-[22px] p-3 rounded-lg bg-surface">{c.uitleg}</p>}
    </div>
  )
}

function CategorieBlok({ c }: { c: Categorie }) {
  return (
    <Kaart titel={c.naam} sub={c.max > 0 ? `${nl(c.punten, c.punten % 1 ? 1 : 0)} van ${c.max} punten` : 'niet te beoordelen'}>
      <div className="divide-y divide-border">
        {c.checks.map((x) => <CheckRij key={x.id} c={x} />)}
      </div>
    </Kaart>
  )
}

// ─── Tab: het bedrijf ─────────────────────────────────────────
function TabBedrijf({ d }: { d: AandeelAnalyse }) {
  const v = d.verhaal
  return (
    <div className="space-y-4">
      {v ? (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <Kaart titel="Wat doet dit bedrijf?"><p className="text-sm text-text leading-relaxed">{v.wat}</p></Kaart>
            <Kaart titel="Hoe verdient het geld?"><p className="text-sm text-text leading-relaxed">{v.verdienmodel}</p></Kaart>
            {v.marktpositie && <Kaart titel="Marktpositie en concurrenten"><p className="text-sm text-text leading-relaxed">{v.marktpositie}</p></Kaart>}
            {v.herkomst && <Kaart titel="Waar zit het en waar is het actief?"><p className="text-sm text-text leading-relaxed">{v.herkomst}</p></Kaart>}
            {v.kansen.length > 0 && (
              <Kaart titel="Kansen">
                <ul className="space-y-1.5">{v.kansen.map((x, i) => <li key={i} className="text-sm text-text leading-relaxed flex gap-2"><span className="text-emerald-600 shrink-0">+</span>{x}</li>)}</ul>
              </Kaart>
            )}
            {v.risicos.length > 0 && (
              <Kaart titel="Risico's">
                <ul className="space-y-1.5">{v.risicos.map((x, i) => <li key={i} className="text-sm text-text leading-relaxed flex gap-2"><span className="text-red-600 shrink-0">−</span>{x}</li>)}</ul>
              </Kaart>
            )}
          </div>
          <p className="text-xs text-text-muted">
            Deze uitleg is door AI geschreven: een samenvatting van het bedrijfsprofiel bij Yahoo Finance, aangevuld
            met algemene kennis van het taalmodel. De feiten zijn niet gecontroleerd en kunnen fout zijn; gebruik
            het als eerste kennismaking. De oordelen en cijfers op deze pagina komen níet van AI, maar uit vaste rekenregels.
          </p>
        </>
      ) : d.profiel ? (
        <Kaart titel="Bedrijfsprofiel" sub="Nederlandse uitleg is nu niet beschikbaar — dit is het originele (Engelse) profiel.">
          <p className="text-sm text-text leading-relaxed">{d.profiel}</p>
        </Kaart>
      ) : (
        <Kaart titel="Bedrijfsprofiel"><p className="text-sm text-text-muted">Geen profiel beschikbaar.</p></Kaart>
      )}

      <Kaart titel="Feiten">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
          <Feit label="Sector" waarde={d.sectorNl || '—'} uitleg={d.industrie ? `bedrijfstak: ${d.industrie}` : ''} />
          <Feit label="Hoofdkantoor" waarde={d.stad || '—'} uitleg={d.landNl || ''} />
          <Feit label="Werknemers" waarde={d.werknemers ? nl(d.werknemers, 0) : '—'} uitleg={d.werknemers ? 'voltijd' : ''} />
          <Feit label="Notering" waarde={d.beurs || '—'} uitleg={`koers in ${d.valuta}`} />
        </div>
        {d.bestuur.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Wie leidt het bedrijf <span className="normal-case font-normal">(functietitels in het Engels, zoals het bedrijf ze opgeeft)</span></p>
            {d.bestuur.map((b, i) => (
              <p key={i} className="text-sm text-text"><span className="text-heading font-medium">{b.naam}</span> — {b.titel}</p>
            ))}
          </div>
        )}
        {d.website && (
          <a href={d.website} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-xs font-medium text-accent-light hover:underline">
            {d.website.replace(/^https?:\/\//, '')} ↗
          </a>
        )}
      </Kaart>

      {d.nieuws.length > 0 && (
        <Kaart titel="Recent nieuws" sub="Engelstalige koppen van Yahoo Finance, gezocht op de bedrijfsnaam; niet alles gaat alleen over dit bedrijf.">
          <div className="divide-y divide-border">
            {d.nieuws.map((n, i) => (
              <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" className="block py-2 hover:bg-bg-hover -mx-2 px-2 rounded">
                <p className="text-sm text-heading">{n.titel}</p>
                <p className="text-xs text-text-muted">{n.bron}{n.datum ? ` · ${datumNl(n.datum)}` : ''}</p>
              </a>
            ))}
          </div>
        </Kaart>
      )}
    </div>
  )
}

// ─── Tab: lange termijn ───────────────────────────────────────
function TabLang({ d, prijs }: { d: AandeelAnalyse; prijs: (v: number | null | undefined) => string }) {
  const lt = d.langeTermijn
  const a = d.analisten
  const f = lt.piotroski
  const adviezen = a && a.kopen != null && a.houden != null && a.verkopen != null ? a.kopen + a.houden + a.verkopen : null
  const doelPct = a?.koersdoel ? a.koersdoel / d.koers.slot - 1 : null
  return (
    <div className="space-y-4">
      <Kaart titel="Hoe dit oordeel tot stand komt">
        <p className="text-sm text-text leading-relaxed">
          Voor de lange termijn koop je een stukje van een bedrijf. Vier vragen tellen: is het een{' '}
          <strong className="text-heading">goed bedrijf</strong> (kwaliteit), staat het er{' '}
          <strong className="text-heading">financieel gezond</strong> voor, <strong className="text-heading">groeit</strong> het,
          en is de <strong className="text-heading">prijs redelijk</strong>? Elke check levert punten op; klik op een
          regel voor uitleg en de precieze grenzen. De score is het percentage behaalde punten van de checks die meetellen
          {lt.checksGeteld < lt.checksTotaal ? ` (hier ${lt.checksGeteld} van de ${lt.checksTotaal})` : ''}.
        </p>
        <p className="text-sm text-text leading-relaxed mt-2">
          <strong className="text-heading">Koopwaardig</strong>{' '}is een aandeel bij een score van 70 of hoger, mits de
          waardering bekend is en meer dan een kwart van haar punten haalt (anders is het &quot;sterk maar prijzig&quot;),
          en mits een lage koers-winstverhouding niet samengaat met een koers die meer dan 30% onder de jaartop staat.
          Onder de 45 is het oordeel Niet koopwaardig. Banken, verzekeraars, nutsbedrijven en vermogensbeheerders komen
          hooguit op Afwachten, omdat de checks daar maar deels passen; vastgoedfondsen krijgen geen oordeel.
        </p>
        <p className="text-xs text-text-muted leading-relaxed mt-2">
          Waar komt dit vandaan? De checks zijn geïnspireerd op onderzoek, maar zijn er een vereenvoudiging van.
          Novy-Marx (2013) vond dat winstgevende bedrijven gemiddeld beter renderen, gemeten als rangorde over duizenden
          aandelen. Piotroski (2000) testte zijn score op goedkope, kleine bedrijven. Fama &amp; French (1992) lieten
          zien dat goedkope aandelen als groep beter deden. Geen van die studies toetste onze grenzen of onze verdeling
          van de punten (40 kwaliteit, 20 gezondheid, 20 groei, 20 waardering); die zijn een eigen keuze. Het oordeel is
          dus een nette checklist, geen bewezen strategie.
        </p>
      </Kaart>

      <div className="grid md:grid-cols-2 gap-4">
        {lt.categorieen.map((c) => <CategorieBlok key={c.naam} c={c} />)}
      </div>

      {f && lt.soort !== 'bank' && (
        <Kaart
          titel={`Piotroski F-score: ${f.score} van ${f.getoetst}`}
          sub={`Ja/nee-vragen: het laatste boekjaar vergeleken met het jaar ervoor.${f.getoetst < 9 ? ` ${9 - f.getoetst} van de negen vragen waren niet te beantwoorden met de beschikbare cijfers.` : ''}`}
        >
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {f.punten.map((p) => (
              <p key={p.label} className="text-sm text-text flex gap-2">
                <span className={p.ok == null ? 'text-text-dim' : p.ok ? 'text-emerald-600' : 'text-red-600'} aria-hidden="true">{p.ok == null ? '?' : p.ok ? '✓' : '✗'}</span>
                <span>{p.label}<span className="sr-only">: {p.ok == null ? 'onbekend' : p.ok ? 'ja' : 'nee'}</span></span>
              </p>
            ))}
          </div>
        </Kaart>
      )}

      {a && (
        <Kaart titel="Ter vergelijking: wat vinden analisten?" sub="Telt niet mee in het oordeel hierboven.">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            <Feit label="Gemiddeld koersdoel" waarde={prijs(a.koersdoel)} uitleg={doelPct != null ? `${plus(doelPct)}${pct(doelPct)} t.o.v. slot ${prijs(d.koers.slot)} op ${datumNl(d.koers.slotDatum)}` : ''} />
            <Feit label="Laagste – hoogste doel" waarde={`${prijs(a.laag)} – ${prijs(a.hoog)}`} uitleg={`koersdoelen van ${a.aantal ?? '?'} analisten`} />
            <Feit label="Adviezen" waarde={a.kopen != null ? `${a.kopen} kopen` : '—'} uitleg={a.houden != null ? `${a.houden} houden · ${a.verkopen} verkopen${adviezen != null ? ` (${adviezen} adviezen)` : ''}` : ''} />
          </div>
          <p className="text-xs text-text-muted leading-relaxed mt-3">
            Analisten van banken zijn structureel optimistisch en zitten er vaak naast. Daarom rekent het oordeel
            hierboven met de gerealiseerde winst en niet met hun verwachting. Gebruik dit als extra informatie, niet
            als reden om te kopen.
          </p>
        </Kaart>
      )}
    </div>
  )
}

// ─── Tab: korte termijn ───────────────────────────────────────
function TabKort({ d, prijs }: { d: AandeelAnalyse; prijs: (v: number | null | undefined) => string }) {
  const kt = d.korteTermijn
  const plan = kt.plan
  const t = d.toets
  const pl = d.planToets
  const [bereik, setBereik] = useState(252)
  const [rekening, setRekening] = useState('')
  const reeks = useMemo(() => d.grafiek.slice(-bereik), [d.grafiek, bereik])
  const bereiken = ([[126, '6 mnd'], [252, '1 jaar'], [504, '2 jaar']] as [number, string][]).filter(([n], i) => i === 0 || d.grafiek.length >= n * 0.8)

  const grafiekData = useMemo(() => {
    // Stop en doel alleen over de laatste weken tekenen: ze horen bij vandaag, niet bij een jaar geleden.
    const vanaf = Math.max(0, reeks.length - 30)
    return {
      labels: reeks.map((p) => p.d),
      datasets: [
        { label: 'Slotkoers', data: reeks.map((p) => p.c), borderColor: '#0c1626', borderWidth: 1.6, pointRadius: 0, tension: 0 },
        { label: '50-daags gemiddelde', data: reeks.map((p) => p.s50), borderColor: '#3b82f6', borderWidth: 1.2, pointRadius: 0, tension: 0 },
        { label: '200-daags gemiddelde', data: reeks.map((p) => p.s200), borderColor: '#f59e0b', borderWidth: 1.2, pointRadius: 0, tension: 0 },
        ...(plan ? [
          { label: 'Doel', data: reeks.map((_, i) => (i >= vanaf ? plan.doel : null)), borderColor: '#10b981', borderWidth: 1.2, borderDash: [5, 4], pointRadius: 0 },
          { label: 'Stop-loss', data: reeks.map((_, i) => (i >= vanaf ? plan.stop : null)), borderColor: '#ef4444', borderWidth: 1.2, borderDash: [5, 4], pointRadius: 0 },
        ] : []),
      ],
    }
  }, [reeks, plan])

  // Rekenhulp: hoeveel aandelen bij 1% risico. Alles in de hoofdvaluta van het aandeel.
  const bedrag = Number(rekening.replace(/\./g, '').replace(',', '.'))
  const risicoPerAandeel = plan ? (plan.instap - plan.stop) * d.koers.factor : 0
  const aantal = plan && bedrag > 0 && risicoPerAandeel > 0 ? Math.floor((bedrag * 0.01) / risicoPerAandeel) : null
  const inleg = aantal != null && plan ? aantal * plan.instap * d.koers.factor : null
  const hv = d.koers.hoofdValuta

  return (
    <div className="space-y-4">
      <Kaart titel="Hoe dit oordeel tot stand komt">
        <p className="text-sm text-text leading-relaxed">
          Voor de korte termijn doet het bedrijf er weinig toe; je handelt de <strong className="text-heading">koerstrend</strong>.
          Een instapsignaal vraagt vier dingen tegelijk: de koers staat boven het 200-daags én het 50-daags
          gemiddelde, de score is 70 of hoger, de RSI is niet boven 70 (niet oververhit), en er komen binnen 14 dagen
          geen kwartaalcijfers. Staat de koers onder het 200-daags gemiddelde, dan is het oordeel altijd Geen nieuwe
          trade — ongeacht hoe goed het bedrijf is.
        </p>
        <p className="text-xs text-text-muted leading-relaxed mt-2">
          Waar komt dit vandaan, en wat is het waard? Faber (2007) liet zien dat een trendfilter grote dalingen
          beperkt bij ongeveer gelijk rendement; hij toetste dat maandelijks op hele markten, niet dagelijks op losse
          aandelen. Jegadeesh &amp; Titman (1993) vonden het momentum-effect bij mandjes van honderden aandelen die
          maanden werden vastgehouden. Wij passen die ideeën toe op één aandeel en een termijn van dagen tot weken;
          dat is een stap verder dan het onderzoek draagt. De zeven checks meten bovendien grotendeels hetzelfde (de
          trend), dus een score van 100 is geen zeven keer onafhankelijke bevestiging. Zie het als een risicofilter:
          het houdt je uit dalende aandelen, maar het is geen winstformule. Wij hebben het handelsplan zelf
          teruggerekend; de uitkomst staat onderaan deze pagina en is nuchter. Alle berekeningen draaien op
          afgeronde handelsdagen (slotkoers {datumNl(d.koers.slotDatum)}), niet op de lopende dag.
        </p>
      </Kaart>

      <Kaart titel="Koers met trendlijnen">
        {bereiken.length > 1 && (
          <div className="flex gap-1 mb-3">
            {bereiken.map(([n, label]) => (
              <button
                key={n} onClick={() => setBereik(n)} aria-pressed={bereik === n}
                className={`px-3 py-1 rounded-lg text-xs border transition-colors ${bereik === n ? 'border-accent text-heading bg-accent-glow' : 'border-border text-text-muted hover:text-heading'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="h-72">
          <Line
            data={grafiekData}
            aria-label={`Koersgrafiek van ${d.naam} met het 50-daags en 200-daags gemiddelde`}
            options={{
              locale: 'nl-NL',
              responsive: true, maintainAspectRatio: false, animation: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 14, boxHeight: 2, font: { size: 11 } } },
                tooltip: {
                  callbacks: {
                    title: (items) => datumNl(items[0]?.label),
                    label: (item) => `${item.dataset.label}: ${d.valuta} ${nl(item.parsed.y as number, 2)}`,
                  },
                },
              },
              scales: {
                x: { ticks: { maxTicksLimit: 7, font: { size: 10 }, callback: function (v) { const l = this.getLabelForValue(v as number); return l ? `${l.slice(8, 10)}-${l.slice(5, 7)}-${l.slice(2, 4)}` : '' } }, grid: { display: false } },
                y: { ticks: { font: { size: 10 } }, grid: { color: 'rgba(12,22,38,0.06)' } },
              },
            }}
          />
        </div>
      </Kaart>

      {kt.koopzone != null && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-sm text-amber-800">
            Het aandeel is nu oververhit. Er is daarom geen handelsplan. Een rustiger instapmoment is een terugval
            richting het 20-daags gemiddelde, nu {prijs(kt.koopzone)}; daarna rekent de tool opnieuw.
          </p>
        </div>
      )}

      {plan && (
        <Kaart titel="Handelsplan" sub={`Gerekend vanaf de slotkoers van ${datumNl(plan.instapDatum)}. De niveaus gelden voor deze dag; morgen zijn ze anders.`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Feit label="Instap" waarde={prijs(plan.instap)} uitleg={`slot ${datumNl(plan.instapDatum)}`} />
            <Feit label="Stop-loss" waarde={prijs(plan.stop)} uitleg={`${pct(plan.stopPct)} — hier stap je uit met verlies`} />
            <Feit label="Doel" waarde={prijs(plan.doel)} uitleg={`+${pct(plan.doelPct)} — hier neem je winst`} />
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm font-semibold text-heading">Hoeveel aandelen?</p>
            <p className="text-xs text-text-muted mt-0.5">
              Vuistregel: verlies per trade hooguit 1% van je rekening. Vul je rekeninggrootte in; er wordt niets opgeslagen.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <label className="text-xs text-text-muted" htmlFor="rekeninggrootte">Rekening in {hv}</label>
              <input
                id="rekeninggrootte" inputMode="decimal" value={rekening} onChange={(e) => setRekening(e.target.value)}
                placeholder="bijv. 10000"
                className="w-36 px-3 py-2 rounded-lg bg-bg-card border border-border text-heading text-sm placeholder:text-text-dim focus:outline-none focus:border-accent"
              />
            </div>
            {aantal != null && inleg != null && (
              aantal < 1 ? (
                <p className="text-sm text-text mt-2">
                  Met deze rekening is één aandeel al meer risico dan 1%: het verlies bij de stop is {hv} {nl(risicoPerAandeel, 2)} per aandeel,
                  en 1% van je rekening is {hv} {nl(bedrag * 0.01, 2)}. Deze trade past dus niet.
                </p>
              ) : (
                <p className="text-sm text-text mt-2">
                  <strong className="text-heading">{aantal} aandelen</strong> — inleg ongeveer {hv} {nl(inleg, 0)} ({pct(inleg / bedrag, 0)} van je rekening),
                  verlies bij de stop ongeveer {hv} {nl(aantal * risicoPerAandeel, 0)}.
                  {inleg / bedrag > 0.2 ? ' Let op: dat is een groot deel van je rekening in één aandeel.' : ''}
                  {hv !== 'EUR' ? ` Je rekening en dit aandeel staan hier beide in ${hv}; heb je een eurorekening, dan loop je daarbovenop valutarisico.` : ''}
                </p>
              )
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border space-y-2">
            {plan.uitleg.map((u, i) => <p key={i} className="text-xs text-text-muted leading-relaxed">{u}</p>)}
          </div>
        </Kaart>
      )}

      <Kaart titel="De checks" sub={kt.score != null ? `${kt.score} van 100 punten · klik op een regel voor uitleg` : undefined}>
        {kt.checks.length === 0
          ? <p className="text-sm text-text-muted">{kt.samenvatting[0]}</p>
          : <div className="divide-y divide-border">{kt.checks.map((c) => <CheckRij key={c.id} c={c} />)}</div>}
      </Kaart>

      {t && (
        <Kaart
          titel="Had het trendfilter op dit aandeel gewerkt?"
          sub={`Teruggerekend van ${datumNl(t.van)} tot ${datumNl(t.tot)} (${nl(t.jaren, 1)} jaar), inclusief dividend, zonder kosten.`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-text-muted">
                  <th className="py-1.5 font-semibold"><span className="sr-only">Aanpak</span></th>
                  <th className="py-1.5 font-semibold text-right">Totaal</th>
                  <th className="py-1.5 font-semibold text-right">Per jaar</th>
                  <th className="py-1.5 font-semibold text-right">Grootste daling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-2 text-heading">Alleen belegd boven 200-daags gemiddelde</td>
                  <td className="py-2 text-right text-heading font-medium">{plus(t.regel.totaal)}{pct(t.regel.totaal, 0)}</td>
                  <td className="py-2 text-right text-text">{plus(t.regel.perJaar)}{pct(t.regel.perJaar)}</td>
                  <td className="py-2 text-right text-red-600">{pct(t.regel.maxVerlies, 0)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-heading">Kopen en vasthouden</td>
                  <td className="py-2 text-right text-heading font-medium">{plus(t.kopenHouden.totaal)}{pct(t.kopenHouden.totaal, 0)}</td>
                  <td className="py-2 text-right text-text">{plus(t.kopenHouden.perJaar)}{pct(t.kopenHouden.perJaar)}</td>
                  <td className="py-2 text-right text-red-600">{pct(t.kopenHouden.maxVerlies, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-text-muted leading-relaxed mt-3">
            Regel: sluit de koers boven het 200-daags gemiddelde, dan ben je vanaf het slot van de volgende
            handelsdag belegd; anders zit je in cash (0% rente). Dat was {pct(t.pctBelegd, 0)} van de tijd belegd, met {t.wissels} keer in- of uitstappen.{' '}
            {t.regel.totaal > t.kopenHouden.totaal
              ? 'Op dit aandeel leverde het filter meer op dan vasthouden.'
              : Math.abs(t.regel.maxVerlies) < Math.abs(t.kopenHouden.maxVerlies) - 0.05
                ? 'Op dit aandeel leverde het filter minder op dan vasthouden, maar de grootste daling was kleiner: het filter is vooral een rem op grote verliezen, geen rendementsmachine.'
                : 'Op dit aandeel leverde het filter minder op dan vasthouden en beschermde het nauwelijks.'}
          </p>
          <p className="text-xs text-text-muted leading-relaxed mt-2">
            Kopen en vasthouden narekenen: {prijs(t.vanKoers)} op {datumNl(t.van)} → {prijs(t.totKoers)} op {datumNl(t.tot)}.
            Dit zijn koersen gecorrigeerd voor dividend; zet in TradingView de optie ADJ aan om dezelfde beginkoers te zien.
          </p>
          <p className="text-xs text-text-muted leading-relaxed mt-2">
            Dit is alleen het trendfilter, zonder stop en doel; het handelsplan zelf staat hieronder. Er gaan in het
            echt ook nog transactiekosten af ({t.wissels} keer handelen), en dit aandeel bestaat nog steeds —
            aandelen die in deze periode zijn verdwenen zie je hier nooit, wat vasthouden mooier doet lijken.
          </p>
        </Kaart>
      )}

      {pl && (
        <Kaart
          titel="Had het handelsplan op dit aandeel gewerkt?"
          sub={`Elke keer dat de regels een instapsignaal gaven, van ${datumNl(pl.van)} tot ${datumNl(pl.tot)} (${nl(pl.jaren, 1)} jaar), na ${pct(PLAN_KOSTEN, 1)} kosten per trade.`}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
            <Feit label="Trades" waarde={`${pl.aantal}`} uitleg={`${pl.viaDoel} via doel · ${pl.viaStop} via stop · ${pl.viaTijd} na ${PLAN_MAX_DAGEN} dagen`} />
            <Feit label="Met winst" waarde={`${pl.winnaars} (${pct(pl.winnaars / pl.aantal, 0)})`} uitleg="Bij puur toeval zou dat rond 40% liggen" />
            <Feit label="Gemiddeld per trade" waarde={`${plus(pl.gemPct)}${pct(pl.gemPct, 2)}`} uitleg={`winst gem. ${pl.gemWinst != null ? `+${pct(pl.gemWinst)}` : '—'} · verlies gem. ${pl.gemVerlies != null ? pct(pl.gemVerlies) : '—'}`} />
            <Feit label="Bij 1% risico per trade" waarde={`${plus(pl.somR)}${nl(pl.somR, 0)}%`} uitleg={`opgeteld over alle trades, in ${nl(pl.jaren, 0)} jaar`} />
          </div>
          <p className="text-sm text-text leading-relaxed mt-4">
            {pl.aantal < 20
              ? 'Dit zijn te weinig trades om er iets uit af te leiden.'
              : pl.gemPct > 0
                ? 'Op dit aandeel leverde het plan in het verleden iets op. Lees dat niet als bewijs: zie hieronder.'
                : 'Op dit aandeel kostte het plan in het verleden geld.'}
          </p>
          <p className="text-xs text-text-muted leading-relaxed mt-2">
            <strong className="text-heading">Wat het bredere onderzoek zegt.</strong> Wij hebben dit plan teruggerekend
            over {PLAN_STUDIE.aandelen} grote aandelen uit de VS, Nederland en Europa ({nl(PLAN_STUDIE.trades, 0)} trades): gemiddeld{' '}
            +{pct(PLAN_STUDIE.gemPct, 1)} per trade na kosten, {pct(PLAN_STUDIE.winnend, 0)} met winst, positief bij {PLAN_STUDIE.positief} van
            de {PLAN_STUDIE.aandelen} aandelen. Ter controle deden we hetzelfde zónder instapsignaal: gewoon elke keer instappen
            met dezelfde stop en hetzelfde doel. Dat gaf +{pct(PLAN_STUDIE.zonderSignaal.gemPct, 1)} per trade. Het
            instapsignaal voegde dus niets toe. De kleine plus komt van een beurs die in die jaren steeg, en van het
            feit dat dit aandelen zijn die het hebben overleefd. Dit plan is daarmee een manier om je verlies per
            trade te begrenzen, geen aangetoonde manier om de markt te verslaan.
          </p>
          <p className="text-xs text-text-muted leading-relaxed mt-2">
            Zo is gerekend: signaal op het slot, instap op de opening van de volgende handelsdag, stop 2× en doel 3×
            de ATR vanaf die instap. Opent de koers voorbij stop of doel, dan geldt de openingskoers. Worden beide op
            één dag geraakt, dan telt de stop. Na {PLAN_MAX_DAGEN} handelsdagen zonder stop of doel: uit op het slot. Eén
            trade tegelijk. De regel &quot;geen instap vlak voor kwartaalcijfers&quot; zit er niet in, want oude
            cijferdata zijn niet beschikbaar.
          </p>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm min-w-[520px]">
              <caption className="text-left text-xs font-semibold text-heading pb-1.5">De laatste trades, na te kijken in TradingView</caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-text-muted">
                  <th className="py-1.5 font-semibold">Instap</th>
                  <th className="py-1.5 font-semibold">Uit</th>
                  <th className="py-1.5 font-semibold">Reden</th>
                  <th className="py-1.5 font-semibold text-right">Resultaat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pl.trades.map((x) => (
                  <tr key={x.instapDatum}>
                    <td className="py-2 text-text whitespace-nowrap">{datumNl(x.instapDatum)} · {prijs(x.instap)}</td>
                    <td className="py-2 text-text whitespace-nowrap">{datumNl(x.uitDatum)} · {prijs(x.uit)}</td>
                    <td className="py-2 text-text-muted">{x.reden === 'doel' ? 'doel geraakt' : x.reden === 'stop' ? 'stop geraakt' : `${PLAN_MAX_DAGEN} dagen voorbij`}</td>
                    <td className={`py-2 text-right font-medium ${x.pct > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{plus(x.pct)}{pct(x.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Kaart>
      )}
    </div>
  )
}

// ─── Tab: jaarcijfers ─────────────────────────────────────────
type RijDef = { label: string; uitleg: string; waarde: (j: JaarRij) => number | null; soort: 'bedrag' | 'pct' | 'getal' | 'aantal' }
const deel = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : a / b)

const CIJFER_BLOKKEN: { titel: string; uitleg: string; rijen: RijDef[] }[] = [
  {
    titel: 'Winst-en-verliesrekening',
    uitleg: 'Wat er in een jaar is verkocht en wat daarvan overbleef.',
    rijen: [
      { label: 'Omzet', uitleg: 'Alles wat het bedrijf heeft verkocht', waarde: (j) => j.omzet, soort: 'bedrag' },
      { label: 'Brutowinst', uitleg: 'Omzet min de directe kosten van het product', waarde: (j) => j.brutowinst, soort: 'bedrag' },
      { label: 'Bedrijfsresultaat', uitleg: 'Winst uit de gewone bedrijfsvoering, vóór rente en belasting', waarde: (j) => j.bedrijfsresultaat, soort: 'bedrag' },
      { label: 'EBITDA', uitleg: 'Bedrijfsresultaat vóór afschrijvingen: maat voor wat de bedrijfsvoering aan geld oplevert', waarde: (j) => j.ebitda, soort: 'bedrag' },
      { label: 'Nettowinst', uitleg: 'Wat er onder de streep overblijft voor de aandeelhouders', waarde: (j) => j.nettowinst, soort: 'bedrag' },
      { label: 'Winst per aandeel', uitleg: 'Nettowinst gedeeld door het aantal aandelen', waarde: (j) => j.wpa, soort: 'getal' },
      { label: 'Brutomarge', uitleg: 'Brutowinst als % van de omzet', waarde: (j) => deel(j.brutowinst, j.omzet), soort: 'pct' },
      { label: 'Operationele marge', uitleg: 'Bedrijfsresultaat als % van de omzet', waarde: (j) => deel(j.bedrijfsresultaat, j.omzet), soort: 'pct' },
      { label: 'Nettomarge', uitleg: 'Nettowinst als % van de omzet', waarde: (j) => deel(j.nettowinst, j.omzet), soort: 'pct' },
    ],
  },
  {
    titel: 'Kasstromen',
    uitleg: 'Het geld dat echt binnenkwam en uitging — moeilijker te "sturen" dan winst.',
    rijen: [
      { label: 'Operationele kasstroom', uitleg: 'Geld dat de gewone bedrijfsvoering opleverde', waarde: (j) => j.operationeleKasstroom, soort: 'bedrag' },
      { label: 'Investeringen', uitleg: 'Uitgaven aan fabrieken, machines, software (negatief = uitgegeven)', waarde: (j) => j.capex, soort: 'bedrag' },
      { label: 'Vrije kasstroom', uitleg: 'Wat overblijft na investeringen — hieruit komen dividend en aflossingen', waarde: (j) => j.vrijeKasstroom, soort: 'bedrag' },
      { label: 'Dividend uitgekeerd', uitleg: 'Uitbetaald aan aandeelhouders (negatief = uitgekeerd)', waarde: (j) => j.dividend, soort: 'bedrag' },
      { label: 'Inkoop eigen aandelen', uitleg: 'Het bedrijf koopt aandelen terug, waardoor jouw deel groter wordt', waarde: (j) => j.inkoop, soort: 'bedrag' },
    ],
  },
  {
    titel: 'Balans',
    uitleg: 'Wat het bedrijf bezit en wat het schuldig is, op de laatste dag van het boekjaar.',
    rijen: [
      { label: 'Cash en beleggingen', uitleg: 'Geld op de bank plus beleggingen die snel te verkopen zijn', waarde: (j) => j.cashEnBeleggingen ?? j.cash, soort: 'bedrag' },
      { label: 'Totale schuld', uitleg: 'Leningen, obligaties en leaseverplichtingen', waarde: (j) => j.schuld, soort: 'bedrag' },
      { label: 'Eigen vermogen', uitleg: 'Bezittingen min schulden: wat van de aandeelhouders is', waarde: (j) => j.eigenVermogen, soort: 'bedrag' },
      { label: 'Totale activa', uitleg: 'Alles wat het bedrijf bezit', waarde: (j) => j.totaleActiva, soort: 'bedrag' },
      { label: 'Aantal aandelen', uitleg: 'Daalt bij inkoop, stijgt bij uitgifte (verwatering)', waarde: (j) => j.aandelen, soort: 'aantal' },
    ],
  },
]

function TabCijfers({ d }: { d: AandeelAnalyse }) {
  const jaren = d.jaren
  if (jaren.length === 0) {
    return <Kaart titel="Jaarcijfers"><p className="text-sm text-text-muted">Geen jaarrekening beschikbaar voor dit aandeel.</p></Kaart>
  }
  const fmt = (v: number | null, soort: RijDef['soort']) =>
    v == null ? '—' : soort === 'pct' ? pct(v) : soort === 'getal' ? nl(v, 2) : groot(v)
  const fv = d.jaarrekeningValuta
  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted leading-relaxed">
        Alle bedragen{fv ? ` in ${fv}` : ' in de valuta van de jaarrekening'}, ook de winst per aandeel; per boekjaar (kolom = einddatum boekjaar).
        mln = miljoen, mld = miljard, bln = biljoen. Bron: jaarrekening zoals Yahoo Finance die aanlevert. Die bevat
        soms fouten of een andere indeling dan het bedrijf zelf gebruikt; controleer belangrijke cijfers in het jaarverslag
        {d.website ? <> op <a href={d.website} target="_blank" rel="noopener noreferrer" className="text-accent-light hover:underline">de website van het bedrijf</a> (zoek naar &quot;Investors&quot; of &quot;Investor Relations&quot;)</> : ''}.
      </p>
      {CIJFER_BLOKKEN.map((blok) => (
        <Kaart key={blok.titel} titel={blok.titel} sub={blok.uitleg}>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-text-muted">
                  <th className="py-1.5 text-left font-semibold"><span className="sr-only">Post</span></th>
                  {jaren.map((j) => (
                    <th key={j.datum} className="py-1.5 text-right font-semibold whitespace-nowrap pl-3">
                      {new Date(j.datum + 'T00:00:00Z').toLocaleDateString('nl-NL', { month: 'short', year: 'numeric', timeZone: 'UTC' })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {blok.rijen.filter((r) => jaren.some((j) => r.waarde(j) != null)).map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      <span className="block text-heading">{r.label}</span>
                      <span className="block text-xs text-text-muted leading-snug">{r.uitleg}</span>
                    </th>
                    {jaren.map((j) => {
                      const v = r.waarde(j)
                      return (
                        <td key={j.datum} className={`py-2 pl-3 text-right whitespace-nowrap align-top ${v != null && v < 0 && r.soort !== 'bedrag' ? 'text-red-600' : 'text-text'}`}>
                          {fmt(v, r.soort)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Kaart>
      ))}
    </div>
  )
}
