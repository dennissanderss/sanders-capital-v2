'use client'

// ─── Aandelen Analyzer ────────────────────────────────────────
// Eén aandeel, twee gescheiden oordelen:
//   • Lange termijn  — het BEDRIJF (kwaliteit, gezondheid, groei, prijs)
//   • Korte termijn  — de KOERS (trend, momentum, instap/stop/doel)
// Alle regels staan in src/lib/stocks/analysis.ts en zijn per check
// zichtbaar mét waarde en uitleg. Koersbewegingen altijd met begin- en
// eindkoers + datum, zodat alles na te rekenen is in TradingView.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { AandeelAnalyse } from '@/lib/stocks/service'
import type { Check, Oordeel, Status, Categorie } from '@/lib/stocks/analysis'
import type { JaarRij } from '@/lib/stocks/yahoo'
import { nl, pct, groot, datumNl } from '@/lib/stocks/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

interface Suggestie { symbol: string; naam: string; beurs: string; sector: string | null }

const VOORBEELDEN = [
  ['ASML.AS', 'ASML'], ['ADYEN.AS', 'Adyen'], ['SHELL.AS', 'Shell'], ['INGA.AS', 'ING'],
  ['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['NVDA', 'Nvidia'], ['GOOGL', 'Alphabet'],
]

const OORDEEL_LANG: Record<Oordeel, string> = {
  kopen: 'Kopen', afwachten: 'Afwachten', vermijden: 'Niet kopen', onbekend: 'Geen oordeel',
}
const OORDEEL_KORT: Record<Oordeel, string> = {
  kopen: 'Kopen', afwachten: 'Wachten', vermijden: 'Niet instappen / verkopen', onbekend: 'Geen oordeel',
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

type Tab = 'bedrijf' | 'lang' | 'kort' | 'cijfers'

export default function StockAnalyzer() {
  const [zoekterm, setZoekterm] = useState('')
  const [suggesties, setSuggesties] = useState<Suggestie[]>([])
  const [toonSuggesties, setToonSuggesties] = useState(false)
  const [data, setData] = useState<AandeelAnalyse | null>(null)
  const [laden, setLaden] = useState<string | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('bedrijf')
  const aanvraag = useRef(0)

  const analyseer = (symbol: string) => {
    const s = symbol.trim().toUpperCase()
    if (!s) return
    const id = ++aanvraag.current
    setLaden(s); setFout(null); setToonSuggesties(false); setZoekterm(s)
    fetch(`/api/stocks/analyze?symbol=${encodeURIComponent(s)}`)
      .then((r) => r.json())
      .then((j) => {
        if (id !== aanvraag.current) return
        if (j.error) { setFout(j.error); setData(null) } else {
          setData(j); setTab('bedrijf')
          window.history.replaceState(null, '', `?symbol=${encodeURIComponent(s)}`)
        }
      })
      .catch((e) => { if (id === aanvraag.current) setFout(String(e)) })
      .finally(() => { if (id === aanvraag.current) setLaden(null) })
  }

  // Deelbare link: ?symbol=ASML.AS opent direct de analyse.
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('symbol')
    if (s) analyseer(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Suggesties tijdens het typen (naam of ticker).
  useEffect(() => {
    const q = zoekterm.trim()
    if (q.length < 2 || !toonSuggesties) { setSuggesties([]); return }
    const t = setTimeout(() => {
      fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((j) => setSuggesties(j.resultaten || []))
        .catch(() => setSuggesties([]))
    }, 250)
    return () => clearTimeout(t)
  }, [zoekterm, toonSuggesties])

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
        onSubmit={(e) => { e.preventDefault(); analyseer(suggesties[0]?.symbol && !/^[A-Za-z0-9.\-]{1,15}$/.test(zoekterm.trim()) ? suggesties[0].symbol : zoekterm) }}
        className="relative max-w-xl"
      >
        <div className="flex gap-2">
          <input
            value={zoekterm}
            onChange={(e) => { setZoekterm(e.target.value); setToonSuggesties(true) }}
            onFocus={() => setToonSuggesties(true)}
            onBlur={() => setTimeout(() => setToonSuggesties(false), 150)}
            placeholder="Bedrijfsnaam of ticker, bijv. ASML of AAPL"
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
        {toonSuggesties && suggesties.length > 0 && (
          <ul className="absolute z-20 left-0 right-0 mt-1 rounded-xl bg-bg-card border border-border shadow-lg overflow-hidden">
            {suggesties.map((s) => (
              <li key={s.symbol}>
                <button
                  type="button" onMouseDown={(e) => { e.preventDefault(); analyseer(s.symbol) }}
                  className="w-full text-left px-4 py-2.5 hover:bg-bg-hover flex items-baseline gap-3"
                >
                  <span className="text-sm font-semibold text-heading w-24 shrink-0">{s.symbol}</span>
                  <span className="text-sm text-text truncate flex-1">{s.naam}</span>
                  <span className="text-xs text-text-dim shrink-0">{s.beurs}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
      <div className="flex flex-wrap gap-2 mt-3">
        {VOORBEELDEN.map(([sym, label]) => (
          <button
            key={sym} onClick={() => analyseer(sym)}
            className="px-3 py-1 rounded-full border border-border text-xs text-text-muted hover:text-heading hover:border-border-light transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-text-dim mt-2">
        Tip: hetzelfde bedrijf staat vaak op meerdere beurzen. Amsterdam eindigt op <code>.AS</code> (koers in euro), Amerikaanse tickers hebben geen toevoeging.
      </p>

      {laden && (
        <div className="mt-10 rounded-2xl bg-bg-card border border-border p-8 text-center">
          <p className="text-sm text-text-muted animate-pulse">{laden} wordt geanalyseerd — jaarrekening, kasstromen en 10 jaar koersen ophalen…</p>
        </div>
      )}
      {fout && !laden && (
        <div className="mt-10 rounded-2xl bg-bg-card border border-red-200 p-6">
          <p className="text-sm text-red-600">{fout}</p>
          <p className="text-xs text-text-muted mt-1">Controleer de ticker of zoek op bedrijfsnaam en kies een resultaat uit de lijst.</p>
        </div>
      )}

      {data && !laden && <Resultaat d={data} tab={tab} setTab={setTab} />}

      <p className="text-[11px] text-text-dim leading-relaxed mt-10 max-w-3xl">
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

  return (
    <div className="mt-8 space-y-5">
      {/* ── kop ── */}
      <div className="rounded-2xl bg-bg-card border border-border p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-dim">
              {d.symbol}{d.beurs ? ` · ${d.beurs}` : ''}
            </p>
            <h2 className="text-xl font-bold text-heading mt-0.5">{d.naam}</h2>
            <p className="text-sm text-text-muted mt-0.5">
              {[d.sector, d.industrie].filter(Boolean).join(' · ') || '—'}
              {d.land ? ` · ${[d.stad, d.land].filter(Boolean).join(', ')}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-heading">{prijs(k.slot)}</p>
            <p className="text-xs text-text-muted">
              slotkoers {datumNl(k.slotDatum)}
              {dag != null && (
                <span className={dag >= 0 ? 'text-emerald-600' : 'text-red-600'}> · {dag >= 0 ? '+' : ''}{pct(dag, 2)}</span>
              )}
            </p>
            {dag != null && (
              <p className="text-[11px] text-text-dim">t.o.v. {prijs(k.vorigSlot)} op {datumNl(k.vorigSlotDatum)}</p>
            )}
            {liveAfwijkend && (
              <p className="text-[11px] text-text-dim">
                nu (lopende sessie): {prijs(k.live)}{k.liveTijd ? ` · ${new Date(k.liveTijd).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 mt-5 pt-5 border-t border-border">
          <Feit label="Beurswaarde" waarde={groot(k.marktkap, k.marktkapValuta)} uitleg="Wat alle aandelen samen waard zijn" />
          <Feit label="Koers/winst" waarde={d.kern.koersWinst != null && d.kern.koersWinst > 0 ? nl(d.kern.koersWinst, 1) : '—'} uitleg="Prijs per euro jaarwinst" />
          <Feit label="Dividend" waarde={d.kern.dividendRendement ? pct(d.kern.dividendRendement) : 'geen'} uitleg="Jaarlijkse uitkering t.o.v. de koers" />
          <Feit label="Volgende cijfers" waarde={d.cijfersDatum ? datumNl(d.cijfersDatum) : '—'} uitleg="Kwartaalcijfers: koers kan dan fors bewegen" />
        </div>

        {positie52 != null && ind && (
          <div className="mt-5">
            <div className="flex justify-between text-[11px] text-text-dim mb-1">
              <span>52-weeks laag {prijs(ind.laag52)} ({datumNl(ind.laag52Datum)})</span>
              <span>52-weeks hoog {prijs(ind.hoog52)} ({datumNl(ind.hoog52Datum)})</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-bg-hover">
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent border-2 border-white shadow" style={{ left: `${positie52 * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {d.waarschuwingen.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
          {d.waarschuwingen.map((w) => <p key={w} className="text-xs text-amber-800">{w}</p>)}
        </div>
      )}

      {/* ── de twee oordelen ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <OordeelKaart
          titel="Lange termijn" sub="Jaren vasthouden · kijkt naar het bedrijf"
          oordeel={d.langeTermijn.oordeel} label={OORDEEL_LANG[d.langeTermijn.oordeel]}
          score={d.langeTermijn.score} tekst={d.langeTermijn.samenvatting} onMeer={() => setTab('lang')}
        />
        <OordeelKaart
          titel="Korte termijn" sub="Dagen tot weken · kijkt naar de koers"
          oordeel={d.korteTermijn.oordeel} label={OORDEEL_KORT[d.korteTermijn.oordeel]}
          score={d.korteTermijn.score} tekst={d.korteTermijn.samenvatting} onMeer={() => setTab('kort')}
        />
      </div>
      <p className="text-[11px] text-text-dim -mt-2">
        De twee oordelen kunnen elkaar tegenspreken — dat is normaal. Een uitstekend bedrijf kan in een dalende
        koerstrend zitten (lange termijn interessant, korte termijn niet), en andersom.
      </p>

      {/* ── tabs ── */}
      <div className="flex gap-1 border-b border-border overflow-x-auto overflow-y-hidden">
        {([['bedrijf', 'Het bedrijf'], ['lang', 'Lange termijn'], ['kort', 'Korte termijn'], ['cijfers', 'Jaarcijfers']] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
              tab === id ? 'border-accent text-heading font-semibold' : 'border-transparent text-text-muted hover:text-heading'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'bedrijf' && <TabBedrijf d={d} />}
      {tab === 'lang' && <TabLang d={d} prijs={prijs} />}
      {tab === 'kort' && <TabKort d={d} prijs={prijs} />}
      {tab === 'cijfers' && <TabCijfers d={d} />}
    </div>
  )
}

function Feit({ label, waarde, uitleg }: { label: string; waarde: string; uitleg: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">{label}</p>
      <p className="text-base font-semibold text-heading">{waarde}</p>
      <p className="text-[11px] text-text-muted leading-snug">{uitleg}</p>
    </div>
  )
}

function OordeelKaart({ titel, sub, oordeel, label, score, tekst, onMeer }: {
  titel: string; sub: string; oordeel: Oordeel; label: string; score: number | null; tekst: string[]; onMeer: () => void
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
        {tekst.map((t) => <p key={t} className="text-sm text-text leading-relaxed">{t}</p>)}
      </div>
      <button onClick={onMeer} className="self-start mt-3 text-xs font-medium text-accent-light hover:underline">
        bekijk de onderbouwing →
      </button>
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
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-start gap-3 text-left">
        <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_STIP[c.status]}`} />
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-heading">{c.label}</span>
          <span className="block text-xs text-text-muted break-words">{c.waarde}</span>
        </span>
        <span className="text-xs text-text-dim shrink-0 mt-0.5">
          {c.punten == null ? 'n.v.t.' : `${nl(c.punten, c.punten % 1 ? 1 : 0)}/${c.max}`} <span className="ml-1">{open ? '−' : '?'}</span>
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
            <Kaart titel="Marktpositie en concurrenten"><p className="text-sm text-text leading-relaxed">{v.marktpositie}</p></Kaart>
            <Kaart titel="Waar komt het vandaan?"><p className="text-sm text-text leading-relaxed">{v.herkomst}</p></Kaart>
            <Kaart titel="Kansen">
              <ul className="space-y-1.5">{v.kansen.map((x) => <li key={x} className="text-sm text-text leading-relaxed flex gap-2"><span className="text-emerald-600 shrink-0">+</span>{x}</li>)}</ul>
            </Kaart>
            <Kaart titel="Risico's">
              <ul className="space-y-1.5">{v.risicos.map((x) => <li key={x} className="text-sm text-text leading-relaxed flex gap-2"><span className="text-red-600 shrink-0">−</span>{x}</li>)}</ul>
            </Kaart>
          </div>
          <p className="text-[11px] text-text-dim">
            Deze uitleg is door AI geschreven op basis van het officiële bedrijfsprofiel en kan fouten bevatten.
            De oordelen en cijfers op deze pagina komen níet van AI, maar uit vaste rekenregels.
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
          <Feit label="Sector" waarde={d.sector || '—'} uitleg={d.industrie || ''} />
          <Feit label="Hoofdkantoor" waarde={d.stad || '—'} uitleg={d.land || ''} />
          <Feit label="Werknemers" waarde={d.werknemers ? nl(d.werknemers, 0) : '—'} uitleg="voltijd" />
          <Feit label="Notering" waarde={d.beurs || '—'} uitleg={`koers in ${d.valuta}`} />
        </div>
        {d.bestuur.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-dim mb-1.5">Wie leidt het bedrijf</p>
            {d.bestuur.map((b) => (
              <p key={b.naam} className="text-sm text-text"><span className="text-heading font-medium">{b.naam}</span> — {b.titel}</p>
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
        <Kaart titel="Recent nieuws" sub="Engelstalige koppen van Yahoo Finance; niet alles gaat alleen over dit bedrijf.">
          <div className="divide-y divide-border">
            {d.nieuws.map((n) => (
              <a key={n.link} href={n.link} target="_blank" rel="noopener noreferrer" className="block py-2 hover:bg-bg-hover -mx-2 px-2 rounded">
                <p className="text-sm text-heading">{n.titel}</p>
                <p className="text-[11px] text-text-dim">{n.bron}{n.datum ? ` · ${datumNl(n.datum)}` : ''}</p>
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
  return (
    <div className="space-y-4">
      <Kaart titel="Hoe dit oordeel tot stand komt">
        <p className="text-sm text-text leading-relaxed">
          Voor de lange termijn koop je een stukje van een bedrijf. Vier vragen tellen: is het een{' '}
          <strong className="text-heading">goed bedrijf</strong> (kwaliteit), staat het er{' '}
          <strong className="text-heading">financieel gezond</strong> voor, <strong className="text-heading">groeit</strong> het,
          en is de <strong className="text-heading">prijs redelijk</strong>? Elke check hieronder levert punten op; klik op een
          regel voor uitleg. Vanaf 70 punten én een niet te hoge prijs wordt het oordeel Kopen, onder 45 Niet kopen.
        </p>
        <p className="text-xs text-text-muted leading-relaxed mt-2">
          De checks zijn gebaseerd op kenmerken waarvan onderzoek laat zien dat ze historisch samenhingen met beter
          rendement: winstgevendheid en kwaliteit (Novy-Marx, 2013), de Piotroski F-score (2000) en waardering
          (Fama &amp; French, 1992). Dat is een gemiddelde over duizenden aandelen en tientallen jaren — geen garantie
          voor dit ene aandeel. Spreid daarom altijd over meerdere bedrijven.
        </p>
      </Kaart>

      <div className="grid md:grid-cols-2 gap-4">
        {lt.categorieen.map((c) => <CategorieBlok key={c.naam} c={c} />)}
      </div>

      {f && d.sector !== 'Financial Services' && (
        <Kaart titel={`Piotroski F-score: ${f.score} van ${f.getoetst}`} sub="Negen ja/nee-vragen: laatste boekjaar vergeleken met het jaar ervoor.">
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {f.punten.map((p) => (
              <p key={p.label} className="text-sm text-text flex gap-2">
                <span className={p.ok == null ? 'text-text-dim' : p.ok ? 'text-emerald-600' : 'text-red-600'}>{p.ok == null ? '?' : p.ok ? '✓' : '✗'}</span>
                {p.label}
              </p>
            ))}
          </div>
        </Kaart>
      )}

      {a && (
        <Kaart titel="Ter vergelijking: wat vinden analisten?" sub="Telt niet mee in het oordeel hierboven.">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
            <Feit label="Gemiddeld koersdoel" waarde={prijs(a.koersdoel)} uitleg={a.koersdoel ? `${pct(a.koersdoel / d.koers.slot - 1)} t.o.v. slot ${prijs(d.koers.slot)}` : ''} />
            <Feit label="Laagste – hoogste" waarde={`${a.laag != null ? nl(a.laag, 0) : '—'} – ${a.hoog != null ? nl(a.hoog, 0) : '—'}`} uitleg={`${a.aantal ?? '?'} analisten`} />
            <Feit label="Adviezen" waarde={a.kopen != null ? `${a.kopen} kopen` : '—'} uitleg={a.houden != null ? `${a.houden} houden · ${a.verkopen} verkopen` : ''} />
          </div>
          <p className="text-xs text-text-muted leading-relaxed mt-3">
            Analisten van banken zijn structureel optimistisch en zitten er vaak naast. Gebruik dit als extra
            informatie, niet als reden om te kopen.
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
  const [bereik, setBereik] = useState(252)
  const reeks = useMemo(() => d.grafiek.slice(-bereik), [d.grafiek, bereik])

  const grafiekData = useMemo(() => ({
    labels: reeks.map((p) => p.d),
    datasets: [
      { label: 'Slotkoers', data: reeks.map((p) => p.c), borderColor: '#0c1626', borderWidth: 1.6, pointRadius: 0, tension: 0 },
      { label: '50-daags gemiddelde', data: reeks.map((p) => p.s50), borderColor: '#3b82f6', borderWidth: 1.2, pointRadius: 0, tension: 0 },
      { label: '200-daags gemiddelde', data: reeks.map((p) => p.s200), borderColor: '#f59e0b', borderWidth: 1.2, pointRadius: 0, tension: 0 },
      ...(plan ? [
        { label: 'Doel', data: reeks.map(() => plan.doel), borderColor: '#10b981', borderWidth: 1, borderDash: [5, 4], pointRadius: 0 },
        { label: 'Stop-loss', data: reeks.map(() => plan.stop), borderColor: '#ef4444', borderWidth: 1, borderDash: [5, 4], pointRadius: 0 },
      ] : []),
    ],
  }), [reeks, plan])

  return (
    <div className="space-y-4">
      <Kaart titel="Hoe dit oordeel tot stand komt">
        <p className="text-sm text-text leading-relaxed">
          Voor de korte termijn doet het bedrijf er weinig toe; je handelt de <strong className="text-heading">koerstrend</strong>.
          De regel is simpel: alleen kopen als de trend omhoog is (koers boven het 200-daags gemiddelde), het
          momentum meewerkt en het aandeel niet net hard is opgelopen. Staat de koers onder het 200-daags
          gemiddelde, dan is het oordeel altijd Niet instappen — ongeacht hoe goed het bedrijf is.
        </p>
        <p className="text-xs text-text-muted leading-relaxed mt-2">
          Onderbouwing: trendvolgen met het 200-daags gemiddelde (Faber, 2007) en het momentum-effect (Jegadeesh
          &amp; Titman, 1993) zijn twee van de best gedocumenteerde patronen op de beurs. Ze werken gemiddeld,
          niet elke keer: reken op regelmatig kleine verliezen. Daarom hoort er altijd een stop-loss bij. Alle
          berekeningen draaien op afgeronde handelsdagen (slotkoers {datumNl(d.koers.slotDatum)}), niet op de lopende dag.
        </p>
      </Kaart>

      <Kaart titel="Koers met trendlijnen">
        <div className="flex gap-1 mb-3">
          {([[126, '6 mnd'], [252, '1 jaar'], [504, '2 jaar']] as [number, string][]).map(([n, label]) => (
            <button
              key={n} onClick={() => setBereik(n)}
              className={`px-3 py-1 rounded-lg text-xs border transition-colors ${bereik === n ? 'border-accent text-heading bg-accent-glow' : 'border-border text-text-muted hover:text-heading'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="h-72">
          <Line
            data={grafiekData}
            options={{
              responsive: true, maintainAspectRatio: false, animation: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 14, boxHeight: 2, font: { size: 11 } } },
                tooltip: { callbacks: { title: (items) => datumNl(items[0]?.label) } },
              },
              scales: {
                x: { ticks: { maxTicksLimit: 7, font: { size: 10 }, callback: function (v) { const l = this.getLabelForValue(v as number); return l ? `${l.slice(8, 10)}-${l.slice(5, 7)}-${l.slice(2, 4)}` : '' } }, grid: { display: false } },
                y: { ticks: { font: { size: 10 } }, grid: { color: 'rgba(12,22,38,0.06)' } },
              },
            }}
          />
        </div>
      </Kaart>

      {plan && (
        <Kaart
          titel={kt.oordeel === 'kopen' ? 'Handelsplan' : 'Handelsplan (pas als het oordeel Kopen wordt)'}
          sub={`Gerekend vanaf de slotkoers van ${datumNl(plan.instapDatum)}.`}
        >
          <div className="grid grid-cols-3 gap-4">
            <Feit label="Instap" waarde={prijs(plan.instap)} uitleg={`slot ${datumNl(plan.instapDatum)}`} />
            <Feit label="Stop-loss" waarde={prijs(plan.stop)} uitleg={`${pct(plan.stopPct)} — hier stap je uit met verlies`} />
            <Feit label="Doel" waarde={prijs(plan.doel)} uitleg={`+${pct(plan.doelPct)} — hier neem je winst`} />
          </div>
          {plan.koopzone != null && (
            <p className="text-sm text-amber-700 mt-3">
              Het aandeel is nu oververhit. Betere instap: bij een terugval richting {prijs(plan.koopzone)} (20-daags gemiddelde).
            </p>
          )}
          <p className="text-xs text-text-muted leading-relaxed mt-3">{plan.uitleg}</p>
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
                <tr className="text-left text-[11px] uppercase tracking-wide text-text-dim">
                  <th className="py-1.5 font-semibold"></th>
                  <th className="py-1.5 font-semibold text-right">Totaal</th>
                  <th className="py-1.5 font-semibold text-right">Per jaar</th>
                  <th className="py-1.5 font-semibold text-right">Grootste daling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-2 text-heading">Alleen belegd boven 200-daags gemiddelde</td>
                  <td className="py-2 text-right text-heading font-medium">{t.regel.totaal >= 0 ? '+' : ''}{pct(t.regel.totaal, 0)}</td>
                  <td className="py-2 text-right text-text">{pct(t.regel.perJaar)}</td>
                  <td className="py-2 text-right text-red-600">{pct(t.regel.maxVerlies, 0)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-heading">Kopen en vasthouden</td>
                  <td className="py-2 text-right text-heading font-medium">{t.kopenHouden.totaal >= 0 ? '+' : ''}{pct(t.kopenHouden.totaal, 0)}</td>
                  <td className="py-2 text-right text-text">{pct(t.kopenHouden.perJaar)}</td>
                  <td className="py-2 text-right text-red-600">{pct(t.kopenHouden.maxVerlies, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-text-muted leading-relaxed mt-3">
            Regel: het slot van vandaag boven het 200-daags gemiddelde → morgen belegd, anders in cash. Dat was{' '}
            {pct(t.pctBelegd, 0)} van de tijd belegd, met {t.wissels} keer in- of uitstappen.{' '}
            {t.regel.totaal > t.kopenHouden.totaal
              ? 'Op dit aandeel leverde het filter meer op dan vasthouden.'
              : Math.abs(t.regel.maxVerlies) < Math.abs(t.kopenHouden.maxVerlies) - 0.05
                ? 'Op dit aandeel leverde het filter minder op dan vasthouden, maar de grootste daling was kleiner: het filter is vooral een rem op grote verliezen, geen rendementsmachine.'
                : 'Op dit aandeel leverde het filter minder op dan vasthouden en beschermde het nauwelijks.'}{' '}
            Dit is alleen het trendfilter, niet het volledige oordeel hierboven, en in het echt gaan er nog
            transactiekosten af.
          </p>
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
      { label: 'Cash', uitleg: 'Geld op de bank', waarde: (j) => j.cash, soort: 'bedrag' },
      { label: 'Totale schuld', uitleg: 'Leningen en obligaties', waarde: (j) => j.schuld, soort: 'bedrag' },
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
  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">
        Bedragen in {d.jaarrekeningValuta || 'de valuta van de jaarrekening'}, per boekjaar (kolom = einddatum boekjaar).
        Bron: jaarrekening via Yahoo Finance. mln = miljoen, mld = miljard, bln = biljoen.
      </p>
      {CIJFER_BLOKKEN.map((blok) => (
        <Kaart key={blok.titel} titel={blok.titel} sub={blok.uitleg}>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-text-dim">
                  <th className="py-1.5 text-left font-semibold"></th>
                  {jaren.map((j) => (
                    <th key={j.datum} className="py-1.5 text-right font-semibold whitespace-nowrap pl-3">
                      {new Date(j.datum + 'T00:00:00Z').toLocaleDateString('nl-NL', { month: 'short', year: 'numeric', timeZone: 'UTC' })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {blok.rijen.map((r) => (
                  <tr key={r.label}>
                    <td className="py-2 pr-3">
                      <span className="block text-heading">{r.label}</span>
                      <span className="block text-[11px] text-text-muted leading-snug">{r.uitleg}</span>
                    </td>
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
