'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import FadeIn from '@/components/FadeIn'

interface CBData {
  bank: string
  rate: number
  stance: string
  bias: string
  last_move: string
  next_meeting: string
  summary: string
  source?: string
}

interface AnalysisData {
  pair: string
  base: string
  quote: string
  context: { name: string; description: string; drivers: string }
  baseCB: CBData
  quoteCB: CBData
  rateDiff: number
  rateAdvantage: string
  sources?: Record<string, { name: string; url: string; description: string }>
  cbDataUpdated?: string
  generatedAt: string
  error?: string
}

const PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD',
  'USD/CAD', 'USD/CHF', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
]

export default function FxAnalyseDashboard() {
  const [selectedPair, setSelectedPair] = useState('EUR/USD')
  const [data, setData] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalysis = useCallback(async (pair: string, refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/analyse?pair=${encodeURIComponent(pair)}${refresh ? '&refresh=1' : ''}`
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || `API error: ${res.status}`)
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
      <FadeIn>
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <p className="text-xs tracking-[0.2em] uppercase text-accent-light mb-3">Educatieve Tool</p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold text-heading mb-3">
            Macro Fundamentals
          </h1>
          <p className="text-sm sm:text-base text-text-muted max-w-2xl mx-auto">
            Begrijp wat een valutapaar beweegt. Selecteer een paar en leer hoe centrale banken,
            renteverschillen en macro-economie de richting bepalen.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-glow/20 border border-accent-dim/30">
            <span className="text-xs text-text-muted">Dit is de achtergrond.</span>
            <Link href="/tools/fx-selector" className="text-xs text-accent-light font-semibold hover:underline">
              Daily Macro Briefing →
            </Link>
            <span className="text-xs text-text-muted">geeft je de dagelijkse conclusie.</span>
          </div>
        </div>

        {/* Pair selector */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
          {PAIRS.map(pair => (
            <button
              key={pair}
              onClick={() => { setSelectedPair(pair); fetchAnalysis(pair) }}
              className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPair === pair && data?.pair === pair
                  ? 'bg-accent text-white'
                  : 'bg-bg-card border border-border text-text-muted hover:text-heading hover:border-border-light'
              }`}
            >
              {pair}
            </button>
          ))}
        </div>

        {/* Refresh + last updated */}
        {data && !loading && (
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8 text-xs text-text-dim">
            <button
              onClick={() => fetchAnalysis(selectedPair, true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-text-muted hover:text-heading hover:border-border-light transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Ververs
            </button>
            <span>Gegenereerd: {new Date(data.generatedAt).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            {data.cbDataUpdated && <span>CB data: {data.cbDataUpdated}</span>}
          </div>
        )}

        {!data && !loading && !error && (
          <div className="text-center py-16">
            <p className="text-text-muted">Selecteer een valutapaar hierboven om de analyse te starten.</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-16 flex flex-col items-center gap-3">
            <span className="inline-block w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="text-text-muted">Analyse laden voor {selectedPair}...</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* 1. Pair Context */}
            <Section number={1} title="Wat is dit paar?">
              <h3 className="text-lg font-display font-semibold text-heading mb-2">{data.context.name}</h3>
              <p className="text-sm text-text leading-relaxed mb-4">{data.context.description}</p>
              <div className="p-4 rounded-lg bg-accent-glow/30 border border-accent-dim/30">
                <p className="text-xs text-accent-light font-semibold mb-1">Wat beweegt dit paar?</p>
                <p className="text-sm text-text-muted leading-relaxed">{data.context.drivers}</p>
              </div>
            </Section>

            {/* 2. Macro Bias — Central Banks */}
            <Section number={2} title="Macro Bias: Centrale Banken">
              <p className="text-sm text-text-muted mb-6 leading-relaxed">
                Valuta&apos;s worden gedreven door centrale banken. Wie de rente het hoogst houdt, trekt kapitaal aan.
                Hieronder vergelijken we beide centrale banken.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <CBCard currency={data.base} cb={data.baseCB} />
                <CBCard currency={data.quote} cb={data.quoteCB} />
              </div>

              {/* Rate differential */}
              <div className="p-4 rounded-lg bg-bg-card border border-border">
                <h4 className="text-sm font-semibold text-heading mb-3">Renteverschil (Rate Differential)</h4>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs text-text-dim mb-1">
                      <span>{data.base}: {data.baseCB.rate}%</span>
                      <span>{data.quote}: {data.quoteCB.rate}%</span>
                    </div>
                    <RateDiffBar base={data.baseCB.rate} quote={data.quoteCB.rate} />
                  </div>
                  <span className="text-lg font-display font-semibold text-heading whitespace-nowrap">
                    {data.rateDiff > 0 ? '+' : ''}{data.rateDiff}%
                  </span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  {data.rateDiff > 0 ? (
                    <>De {data.base} heeft een hogere rente dan de {data.quote}. Dit trekt kapitaal aan naar {data.base}-activa en is fundamenteel bullish voor {data.pair}.</>
                  ) : data.rateDiff < 0 ? (
                    <>De {data.quote} heeft een hogere rente dan de {data.base}. Dit trekt kapitaal aan naar {data.quote}-activa en is fundamenteel bearish voor {data.pair}.</>
                  ) : (
                    <>Beide valuta&apos;s hebben dezelfde rente. Het renteverschil is neutraal; andere factoren bepalen de richting.</>
                  )}
                </p>
                <div className="mt-3 p-3 rounded bg-white/[0.03]">
                  <p className="text-xs text-text-dim">
                    <strong className="text-text-muted">Waarom is dit belangrijk?</strong> Grote beleggers en instituties verplaatsen geld naar de valuta met de hoogste rente (dit heet &quot;carry trade&quot;). Het renteverschil is vaak de belangrijkste fundamentele driver op de lange termijn.
                  </p>
                </div>
              </div>

              {/* Stance comparison */}
              <div className="mt-4 p-4 rounded-lg bg-bg-card border border-border">
                <h4 className="text-sm font-semibold text-heading mb-3">Beleidsrichting vergelijking</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-dim text-xs">{data.base}</span>
                    <p className="text-text-muted">{data.baseCB.stance}</p>
                    <StanceBadge bias={data.baseCB.bias} />
                  </div>
                  <div>
                    <span className="text-text-dim text-xs">{data.quote}</span>
                    <p className="text-text-muted">{data.quoteCB.stance}</p>
                    <StanceBadge bias={data.quoteCB.bias} />
                  </div>
                </div>
                <div className="mt-3 p-3 rounded bg-white/[0.03]">
                  <p className="text-xs text-text-dim">
                    <strong className="text-text-muted">Hoe lees je dit?</strong> &quot;Restrictief&quot; = rente hoog houden (hawkish, goed voor de valuta). &quot;Verruimend&quot; = rente verlagen (dovish, slecht voor de valuta). De richting is belangrijker dan het niveau: een centrale bank die naar verruiming beweegt is bearish, ook als de rente nog hoog is.
                  </p>
                </div>
              </div>
            </Section>

            {/* 3. Bridge to Daily Briefing */}
            <Section number={3} title="Van theorie naar praktijk">
              <p className="text-sm text-text-muted mb-4 leading-relaxed">
                Nu je begrijpt hoe {data.pair} werkt, welke centrale banken er zijn, wat hun beleid is,
                en hoe het renteverschil de richting bepaalt, is de volgende stap: dit dagelijks toepassen.
              </p>

              <div className="p-4 rounded-lg bg-accent-glow/20 border border-accent-dim/30 mb-4">
                <h4 className="text-sm font-semibold text-accent-light mb-2">De sleutel: verrassingen drijven de prijs</h4>
                <p className="text-sm text-text-muted leading-relaxed">
                  De koers van {data.pair} weerspiegelt <em>wat de markt verwacht</em>. Als de {data.baseCB.bank} hawkish is,
                  is dat al deels ingeprijsd. De prijs beweegt pas als er een <strong className="text-heading">verrassing</strong> komt:
                  data die beter of slechter uitkomt dan verwacht, of een centrale bank die van toon verandert.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-bg-card border border-border">
                  <h4 className="text-sm font-semibold text-heading mb-1">Hoe pas je dit toe?</h4>
                  <p className="text-sm text-text-muted leading-relaxed">
                    1. <strong>Ken de achtergrond</strong> (deze tool): wie is hawkish, wie dovish, hoe staat het renteverschil?<br />
                    2. <strong>Check de Daily Briefing</strong>: welke events komen vandaag, wat is de bias per paar?<br />
                    3. <strong>Zoek technische bevestiging</strong>: de fundamentals geven je de richting, technicals geven je de entry.
                  </p>
                </div>

                <Link
                  href="/tools/fx-selector"
                  className="flex items-center justify-between p-4 rounded-lg bg-accent/10 border border-accent/30 hover:bg-accent/15 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-semibold text-heading group-hover:text-accent-light transition-colors">
                      Open Daily Macro Briefing →
                    </p>
                    <p className="text-xs text-text-dim mt-0.5">
                      Bekijk de dagelijkse analyse: regime, currency scorecard en pair bias
                    </p>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light shrink-0">
                    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </Section>

            {/* Sources */}
            {data.sources && (
              <div className="mt-8 p-4 rounded-lg border border-border bg-bg-card/30">
                <h3 className="text-xs font-semibold text-text-muted mb-3">Bronnen</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {Object.values(data.sources).map((src, i) => (
                    <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-start gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-border/50 hover:border-border-light transition-colors group">
                      <svg className="w-3.5 h-3.5 mt-0.5 text-accent-light/50 group-hover:text-accent-light shrink-0 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      <div>
                        <p className="text-xs font-medium text-text-muted group-hover:text-heading transition-colors">{src.name}</p>
                        <p className="text-[10px] text-text-dim leading-relaxed mt-0.5">{src.description}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="mt-4 p-4 rounded-lg border border-border bg-bg-card/30 text-center">
              <p className="text-xs text-text-dim leading-relaxed">
                Deze tool is puur educatief en geen financieel advies.
                Centrale bank data en indicatoren worden periodiek bijgewerkt.
                Gebruik deze analyse als leerframework, niet als handelssignaal.
              </p>
            </div>
          </>
        )}
      </FadeIn>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 sm:mb-8">
      <h2 className="text-lg sm:text-xl font-display font-semibold text-heading mb-4 flex items-center gap-2">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/15 text-accent-light text-xs font-bold flex items-center justify-center">
          {number}
        </span>
        {title}
      </h2>
      <div className="p-4 sm:p-6 rounded-xl bg-bg-card border border-border">
        {children}
      </div>
    </div>
  )
}

function CBCard({ currency, cb }: { currency: string; cb: CBData }) {
  return (
    <div className="p-4 rounded-lg bg-white/[0.02] border border-border/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-heading">{currency}</span>
        <span className="text-lg font-display font-semibold text-accent-light">{cb.rate}%</span>
      </div>
      <p className="text-xs text-text-dim mb-1">{cb.bank}</p>
      <p className="text-sm text-text-muted leading-relaxed mb-3">{cb.summary}</p>
      <div className="space-y-1 text-xs text-text-dim">
        <p>Laatste actie: <span className="text-text-muted">{cb.last_move}</span></p>
        <p>Volgende vergadering: <span className="text-text-muted">{cb.next_meeting}</span></p>
      </div>
      {cb.source && (
        <a href={cb.source} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-[10px] text-accent-light/70 hover:text-accent-light transition-colors">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Bron: {cb.bank}
        </a>
      )}
    </div>
  )
}

function StanceBadge({ bias }: { bias: string }) {
  const isHawkish = bias.includes('verkrappend') || bias.includes('afwachtend')
  const isDovish = bias.includes('verruimend')
  const color = isHawkish ? '#4caf50' : isDovish ? '#ef5350' : '#6b7084'
  return (
    <span className="inline-block text-xs px-2 py-0.5 rounded-full mt-1" style={{ background: color + '22', color }}>
      {bias}
    </span>
  )
}

function RateDiffBar({ base, quote }: { base: number; quote: number }) {
  const max = Math.max(base, quote, 0.5)
  const basePct = (base / max) * 100
  const quotePct = (quote / max) * 100
  return (
    <div className="flex gap-1 h-3">
      <div className="flex-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-accent-light transition-all" style={{ width: `${basePct}%` }} />
      </div>
      <div className="flex-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${quotePct}%` }} />
      </div>
    </div>
  )
}

