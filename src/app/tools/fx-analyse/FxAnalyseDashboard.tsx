'use client'

import { useState, useCallback } from 'react'
import FadeIn from '@/components/FadeIn'

interface CBData {
  bank: string
  rate: number
  stance: string
  bias: string
  last_move: string
  next_meeting: string
  summary: string
}

interface CalendarEvent {
  currency: string
  title: string
  impact: string
  date: string
  forecast: string
  previous: string
}

interface IndicatorInfo {
  name: string
  what: string
  why: string
  surprise: string
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
  calendar: CalendarEvent[]
  indicators: Record<string, IndicatorInfo>
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
  const [expandedIndicators, setExpandedIndicators] = useState<Set<string>>(new Set())

  const fetchAnalysis = useCallback(async (pair: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analyse?pair=${encodeURIComponent(pair)}`)
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || `API error: ${res.status}`)
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleIndicator = (key: string) => {
    setExpandedIndicators(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
      <FadeIn>
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <p className="text-xs tracking-[0.2em] uppercase text-accent-light mb-3">Educatieve Tool</p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold text-heading mb-3">
            Fundamental FX Analyse
          </h1>
          <p className="text-sm sm:text-base text-text-muted max-w-2xl mx-auto">
            Begrijp wat een valutapaar beweegt: macro-economie, centrale banken, economische kalender
            en marktpositionering. Selecteer een paar en leer analyseren.
          </p>
        </div>

        {/* Pair selector */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
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
                    <>Beide valuta&apos;s hebben dezelfde rente. Het renteverschil is neutraal — andere factoren bepalen de richting.</>
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
                    <strong className="text-text-muted">Hoe lees je dit?</strong> &quot;Restrictief&quot; = rente hoog houden (hawkish, goed voor de valuta). &quot;Verruimend&quot; = rente verlagen (dovish, slecht voor de valuta). De richting is belangrijker dan het niveau — een centrale bank die naar verruiming beweegt is bearish, ook als de rente nog hoog is.
                  </p>
                </div>
              </div>
            </Section>

            {/* 3. Economic Calendar */}
            <Section number={3} title="Economische Kalender (deze week)">
              <p className="text-sm text-text-muted mb-4 leading-relaxed">
                Hieronder staan de belangrijkste datareleases deze week voor {data.base} en {data.quote}.
                Elk cijfer kan de verwachtingen over rentebeleid veranderen — en daarmee de koers.
              </p>

              {data.calendar.length === 0 ? (
                <p className="text-sm text-text-dim italic">Geen high-impact events gevonden voor deze week.</p>
              ) : (
                <div className="space-y-3">
                  {data.calendar.map((evt, i) => (
                    <div key={i} className="p-4 rounded-lg bg-bg-card border border-border">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          evt.currency === data.base ? 'bg-accent/15 text-accent-light' : 'bg-gold-dim text-gold'
                        }`}>
                          {evt.currency}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          evt.impact === 'high' ? 'bg-red-500/15 text-red-300' : 'bg-yellow-500/15 text-yellow-300'
                        }`}>
                          {evt.impact === 'high' ? 'High Impact' : 'Medium Impact'}
                        </span>
                        <span className="text-xs text-text-dim">{evt.date}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-heading mb-2">{evt.title}</h4>
                      <div className="flex gap-4 text-xs text-text-dim">
                        {evt.forecast && <span>Verwachting: <strong className="text-text-muted">{evt.forecast}</strong></span>}
                        {evt.previous && <span>Vorige: <strong className="text-text-muted">{evt.previous}</strong></span>}
                      </div>

                      {/* Scenario analysis */}
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <ScenarioBox
                          label="Lager dan verwacht"
                          color="#ef5350"
                          text={`Dovish voor ${evt.currency}. ${evt.currency === data.base ? `Bearish voor ${data.pair}` : `Bullish voor ${data.pair}`}. Markt kan meer knipverwachtingen inprijzen.`}
                        />
                        <ScenarioBox
                          label="In lijn met verwachting"
                          color="#6b7084"
                          text="Neutraal. De markt heeft dit al ingeprijsd. Kleine reactie tenzij de details verrassen."
                        />
                        <ScenarioBox
                          label="Hoger dan verwacht"
                          color="#4caf50"
                          text={`Hawkish voor ${evt.currency}. ${evt.currency === data.base ? `Bullish voor ${data.pair}` : `Bearish voor ${data.pair}`}. Markt kan knipverwachtingen terugschroeven.`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* 4. Indicator Education */}
            <Section number={4} title="Indicatoren uitgelegd">
              <p className="text-sm text-text-muted mb-4 leading-relaxed">
                Klik op een indicator om te leren wat het is, waarom het belangrijk is, en hoe de markt erop reageert.
              </p>
              <div className="space-y-2">
                {Object.entries(data.indicators).map(([key, ind]) => (
                  <div key={key} className="rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => toggleIndicator(key)}
                      className="w-full text-left p-3 sm:p-4 flex items-center justify-between hover:bg-bg-hover/30 transition-colors"
                    >
                      <span className="text-sm font-semibold text-heading">{ind.name}</span>
                      <span className="text-text-dim text-xs">{expandedIndicators.has(key) ? '▼' : '▶'}</span>
                    </button>
                    {expandedIndicators.has(key) && (
                      <div className="px-3 sm:px-4 pb-4 space-y-3">
                        <div>
                          <p className="text-xs text-accent-light font-semibold mb-1">Wat meet het?</p>
                          <p className="text-sm text-text-muted">{ind.what}</p>
                        </div>
                        <div>
                          <p className="text-xs text-accent-light font-semibold mb-1">Waarom is het belangrijk?</p>
                          <p className="text-sm text-text-muted">{ind.why}</p>
                        </div>
                        <div>
                          <p className="text-xs text-accent-light font-semibold mb-1">Hoe reageert de markt?</p>
                          <p className="text-sm text-text-muted">{ind.surprise}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            {/* 5. Market Positioning */}
            <Section number={5} title="Marktpositionering">
              <p className="text-sm text-text-muted mb-4 leading-relaxed">
                De markt prijst verwachtingen in voordat events plaatsvinden. Het is cruciaal om te begrijpen
                wat al ingeprijsd is — want de koers beweegt op <strong className="text-heading">verrassingen</strong>, niet op het nieuws zelf.
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-bg-card border border-border">
                  <h4 className="text-sm font-semibold text-heading mb-2">Wat is al ingeprijsd?</h4>
                  <p className="text-sm text-text-muted leading-relaxed">
                    De huidige koers van {data.pair} weerspiegelt de marktverwachtingen over het renteverschil
                    tussen de {data.baseCB.bank} ({data.baseCB.rate}%) en de {data.quoteCB.bank} ({data.quoteCB.rate}%).
                    {data.baseCB.bias.includes('verruimend') && ` De markt verwacht dat de ${data.baseCB.bank} verder knipt — dit is al deels ingeprijsd.`}
                    {data.quoteCB.bias.includes('verruimend') && ` De markt verwacht dat de ${data.quoteCB.bank} verder knipt — dit is al deels ingeprijsd.`}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-bg-card border border-border">
                  <h4 className="text-sm font-semibold text-heading mb-2">Waar zit de asymmetrie?</h4>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Asymmetrie ontstaat wanneer de markt te veel of te weinig heeft ingeprijsd.
                    Let op de beleidsrichting: als de {data.baseCB.bank} ({data.baseCB.bias}) agressiever knipt dan verwacht,
                    is dat bearish voor {data.pair}. Als de {data.quoteCB.bank} ({data.quoteCB.bias}) juist minder
                    knipt dan verwacht, is dat ook bearish voor {data.pair}.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-accent-glow/20 border border-accent-dim/30">
                  <h4 className="text-sm font-semibold text-accent-light mb-2">Hoe gebruik je dit?</h4>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Vraag jezelf altijd af: &quot;Wat verwacht de markt?&quot; en &quot;Wat als het anders uitpakt?&quot;
                    De grootste bewegingen komen niet van goed of slecht nieuws, maar van <strong className="text-heading">verrassingen</strong>.
                    Als iedereen verwacht dat de Fed gaat knippen en ze doen het niet — dat is een verrassing.
                    Dat is wanneer de grote moves gebeuren.
                  </p>
                </div>
              </div>
            </Section>

            {/* 6. Framework */}
            <Section number={6} title="Hoe analyseer je zelf?">
              <div className="space-y-3">
                {[
                  { step: '1', title: 'Begrijp het paar', text: 'Weet welke economieën en centrale banken je vergelijkt. Welke kant is de basis, welke de quote?' },
                  { step: '2', title: 'Vergelijk macro', text: 'Welke economie is sterker? Hogere groei, hogere inflatie, sterkere arbeidsmarkt? Die valuta is fundamenteel sterker.' },
                  { step: '3', title: 'Check de centrale banken', text: 'Wie is hawkish (rente hoog/hoger)? Wie is dovish (rente lager)? De hawkish kant heeft het fundamentele voordeel.' },
                  { step: '4', title: 'Kijk naar de kalender', text: 'Welke data komt eraan? Wat is de verwachting? Wat als het hoger/lager uitkomt? Bereid je voor op scenario\'s.' },
                  { step: '5', title: 'Check wat ingeprijsd is', text: 'Verwacht de markt al knipjes? Dan is dat ingeprijsd. De koers beweegt alleen bij verrassingen.' },
                  { step: '6', title: 'Bouw je bias', text: 'Combineer alles: macro + beleid + kalender + positionering = je fundamentele richting. Zoek dan technische bevestiging op je chart.' },
                ].map(item => (
                  <div key={item.step} className="flex items-start gap-3 p-3 rounded-lg bg-bg-card/50">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/20 text-accent-light text-xs font-bold flex items-center justify-center mt-0.5">
                      {item.step}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-heading">{item.title}</p>
                      <p className="text-xs text-text-muted mt-0.5">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Disclaimer */}
            <div className="mt-8 p-4 rounded-lg border border-border bg-bg-card/30 text-center">
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

function ScenarioBox({ label, color, text }: { label: string; color: string; text: string }) {
  return (
    <div className="p-2.5 rounded-lg" style={{ background: color + '0d', border: `1px solid ${color}22` }}>
      <p className="text-xs font-semibold mb-1" style={{ color }}>{label}</p>
      <p className="text-xs text-text-muted leading-relaxed">{text}</p>
    </div>
  )
}
