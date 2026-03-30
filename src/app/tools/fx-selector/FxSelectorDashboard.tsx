'use client'

import { useState, useEffect, useCallback } from 'react'
import FadeIn from '@/components/FadeIn'

interface CurrencyData {
  currency: string
  bias: number
  adj: number
  effective: number
  mom5: number
  mom20: number
}

interface Signal {
  direction: string
  change: number
  current: number | null
}

interface PairData {
  pair: string
  direction: string
  rawDivergence: number
  intermarketAdj: number
  eventPenalty: number
  finalScore: number
  classification: string
  isHighConviction: boolean
  reason: string
  sizeHint: string
  correlationGroup: string
}

interface Change {
  currency: string
  old: number
  new: number
}

interface FxData {
  lastUpdated: string
  regime: string
  riskSentiment: string
  verdict: string[]
  currencies: CurrencyData[]
  signals: Record<string, Signal>
  events: Record<string, string[]>
  tradePairs: PairData[]
  watchPairs: PairData[]
  avoidPairs: PairData[]
  changes: Change[]
}

const SIGNAL_LABELS: Record<string, string> = {
  us10y: 'US 10Y Rente',
  sp500: 'S&P 500',
  vix: 'VIX (Angstindex)',
  oil: 'Olie (WTI)',
  gold: 'Goud',
}

const SIGNAL_EXPLAIN: Record<string, Record<string, string>> = {
  us10y: {
    up: 'Stijgende rente → sterker voor USD',
    down: 'Dalende rente → zwakker voor USD',
    flat: 'Rente stabiel → neutraal',
  },
  sp500: {
    up: 'Aandelen stijgen → risk-on sentiment',
    down: 'Aandelen dalen → risk-off sentiment',
    flat: 'Aandelen stabiel → neutraal',
  },
  vix: {
    up: 'VIX stijgt → meer angst, risk-off',
    down: 'VIX daalt → minder angst, risk-on',
    flat: 'VIX stabiel → neutraal',
  },
  oil: {
    up: 'Olie stijgt → sterker voor CAD',
    down: 'Olie daalt → zwakker voor CAD',
    flat: 'Olie stabiel → neutraal voor CAD',
  },
  gold: {
    up: 'Goud stijgt → veilige haven, sterker JPY/CHF',
    down: 'Goud daalt → minder risk-off',
    flat: 'Goud stabiel → neutraal',
  },
}

function directionArrow(dir: string) {
  if (dir === 'up') return '▲'
  if (dir === 'down') return '▼'
  return '●'
}

function directionColor(dir: string) {
  if (dir === 'up') return 'var(--color-green, #4caf50)'
  if (dir === 'down') return 'var(--color-red, #ef5350)'
  return 'var(--color-text-muted)'
}

function biasLabel(val: number) {
  if (val >= 1.5) return 'Sterk bullish'
  if (val >= 0.5) return 'Bullish'
  if (val > -0.5) return 'Neutraal'
  if (val > -1.5) return 'Bearish'
  return 'Sterk bearish'
}

function biasColor(val: number) {
  if (val >= 1.5) return '#4caf50'
  if (val >= 0.5) return '#81c784'
  if (val > -0.5) return '#6b7084'
  if (val > -1.5) return '#ef9a9a'
  return '#ef5350'
}

export default function FxSelectorDashboard() {
  const [data, setData] = useState<FxData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updates, setUpdates] = useState<string[]>([])

  const fetchData = useCallback(async (endpoint: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const json = await res.json()
      setData(json)
      setUpdates(prev => [
        `${new Date().toLocaleTimeString('nl-NL')} — Data bijgewerkt`,
        ...prev.slice(0, 9),
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData('/api/data')
  }, [fetchData])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
      <FadeIn>
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <p className="text-xs tracking-[0.2em] uppercase text-accent-light mb-3">Premium Tool</p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold text-heading mb-3">
            Daily FX Pair Selector
          </h1>
          <p className="text-sm sm:text-base text-text-muted max-w-2xl mx-auto">
            Automatische analyse van 28 valutaparen op basis van momentum, intermarket signalen
            en economische kalender. Elke dag verse data.
          </p>
        </div>

        {/* Update button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <button
            onClick={() => fetchData('/api/refresh')}
            disabled={loading}
            className="px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Data ophalen...
              </>
            ) : (
              'Update Data'
            )}
          </button>
          {data?.lastUpdated && (
            <span className="text-xs text-text-dim">
              Laatst bijgewerkt: {new Date(data.lastUpdated).toLocaleString('nl-NL')}
            </span>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {/* Update history */}
        {updates.length > 0 && (
          <div className="mb-8 p-3 rounded-lg bg-bg-card border border-border">
            <p className="text-xs text-text-dim mb-1 font-semibold">Update geschiedenis</p>
            {updates.map((u, i) => (
              <p key={i} className="text-xs text-text-muted">{u}</p>
            ))}
          </div>
        )}

        {data && (
          <>
            {/* Verdict */}
            <Section title="Samenvatting">
              <div className="space-y-2">
                {data.verdict.map((line, i) => (
                  <p key={i} className="text-sm sm:text-base text-text leading-relaxed">{line}</p>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge label={`Regime: ${data.regime}`} color={data.regime === 'trend' ? '#4caf50' : data.regime === 'transition' ? '#ef5350' : '#6b7084'} />
                <Badge label={`Sentiment: ${data.riskSentiment}`} color={data.riskSentiment === 'risk-on' ? '#4caf50' : data.riskSentiment === 'risk-off' ? '#ef5350' : '#6b7084'} />
              </div>
            </Section>

            {/* Trade pairs */}
            <Section title="Trade paren" icon="🎯">
              {data.tradePairs.length === 0 ? (
                <p className="text-sm text-text-muted italic">Geen trade-waardige paren vandaag.</p>
              ) : (
                <div className="space-y-3">
                  {data.tradePairs.map(p => (
                    <PairCard key={p.pair} pair={p} type="trade" />
                  ))}
                </div>
              )}
            </Section>

            {/* Watch pairs */}
            {data.watchPairs.length > 0 && (
              <Section title="Watch paren" icon="👁">
                <div className="space-y-3">
                  {data.watchPairs.map(p => (
                    <PairCard key={p.pair} pair={p} type="watch" />
                  ))}
                </div>
              </Section>
            )}

            {/* Avoid pairs */}
            {data.avoidPairs.length > 0 && (
              <Section title="Vermijden" icon="⛔">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {data.avoidPairs.map(p => (
                    <div key={p.pair} className="p-3 rounded-lg bg-bg-card/50 border border-border/50 flex items-center justify-between">
                      <span className="text-sm text-text-muted">{p.pair}</span>
                      <span className="text-xs text-text-dim">Score: {p.finalScore}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Currency strength */}
            <Section title="Valuta sterkte">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full min-w-[500px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-text-dim text-xs">
                      <th className="text-left py-2 px-3">Valuta</th>
                      <th className="text-center py-2 px-3">Momentum</th>
                      <th className="text-center py-2 px-3">Intermarket</th>
                      <th className="text-center py-2 px-3">Effectief</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-left py-2 px-3 w-32">Sterkte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.currencies.map(c => (
                      <tr key={c.currency} className="border-b border-border/50 hover:bg-bg-hover/30 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-heading">{c.currency}</td>
                        <td className="py-2.5 px-3 text-center" style={{ color: biasColor(c.bias) }}>
                          {c.bias > 0 ? '+' : ''}{c.bias}
                        </td>
                        <td className="py-2.5 px-3 text-center text-text-muted">
                          {c.adj !== 0 ? (c.adj > 0 ? '+' : '') + c.adj : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold" style={{ color: biasColor(c.effective) }}>
                          {c.effective > 0 ? '+' : ''}{c.effective}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{
                            background: biasColor(c.effective) + '22',
                            color: biasColor(c.effective),
                          }}>
                            {biasLabel(c.effective)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <StrengthBar value={c.effective} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Intermarket signals */}
            <Section title="Intermarket signalen">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(data.signals).map(([key, sig]) => (
                  <div key={key} className="p-4 rounded-lg bg-bg-card border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-heading">{SIGNAL_LABELS[key] || key}</span>
                      <span style={{ color: directionColor(sig.direction), fontSize: '14px' }}>
                        {directionArrow(sig.direction)} {sig.change > 0 ? '+' : ''}{sig.change}%
                      </span>
                    </div>
                    {sig.current && (
                      <p className="text-xs text-text-dim mb-1">Huidig: {sig.current.toLocaleString('nl-NL')}</p>
                    )}
                    <p className="text-xs text-text-muted">
                      {SIGNAL_EXPLAIN[key]?.[sig.direction] || ''}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Economic calendar */}
            {Object.keys(data.events).length > 0 && (
              <Section title="Economische kalender (vandaag)">
                <div className="space-y-3">
                  {Object.entries(data.events).map(([ccy, evts]) => (
                    <div key={ccy}>
                      <span className="text-sm font-semibold text-heading">{ccy}</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {evts.map((evt, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/20">
                            {evt}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Changes from yesterday */}
            {data.changes.length > 0 && (
              <Section title="Veranderingen t.o.v. gisteren">
                <div className="space-y-1">
                  {data.changes.map(c => (
                    <div key={c.currency} className="flex items-center gap-3 text-sm">
                      <span className="font-semibold text-heading w-10">{c.currency}</span>
                      <span className="text-text-dim">{c.old > 0 ? '+' : ''}{c.old}</span>
                      <span className="text-text-dim">→</span>
                      <span style={{ color: biasColor(c.new) }}>{c.new > 0 ? '+' : ''}{c.new}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* What to do */}
            <Section title="Wat moet ik nu doen?">
              <div className="space-y-3">
                {[
                  { step: '1', text: 'Bekijk de samenvatting en het marktregime bovenaan.' },
                  { step: '2', text: 'Check de trade paren — focus op paren met de hoogste score.' },
                  { step: '3', text: 'Controleer of er high-impact nieuws is voor die valuta\'s.' },
                  { step: '4', text: 'Open je chart en zoek een entry op basis van je eigen strategie.' },
                  { step: '5', text: 'Gebruik altijd een stop-loss en de juiste positiegrootte.' },
                ].map(item => (
                  <div key={item.step} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent-light text-xs font-semibold flex items-center justify-center mt-0.5">
                      {item.step}
                    </span>
                    <p className="text-sm text-text-muted">{item.text}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Disclaimer */}
            <div className="mt-8 p-4 rounded-lg border border-border bg-bg-card/30 text-center">
              <p className="text-xs text-text-dim leading-relaxed">
                Deze tool is puur educatief en geen financieel advies.
                Resultaten zijn gebaseerd op historische data met ~15 min vertraging (Yahoo Finance).
                Handel altijd op eigen risico.
              </p>
            </div>
          </>
        )}

        {!data && !loading && !error && (
          <div className="text-center py-16">
            <p className="text-text-muted">Klik op &quot;Update Data&quot; om de analyse te starten.</p>
          </div>
        )}
      </FadeIn>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 sm:mb-8">
      <h2 className="text-lg sm:text-xl font-display font-semibold text-heading mb-4 flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {title}
      </h2>
      <div className="p-4 sm:p-6 rounded-xl bg-bg-card border border-border">
        {children}
      </div>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-xs px-3 py-1 rounded-full font-medium"
      style={{ background: color + '22', color }}
    >
      {label}
    </span>
  )
}

function StrengthBar({ value }: { value: number }) {
  const pct = ((value + 2) / 4) * 100
  const clamp = Math.max(5, Math.min(95, pct))
  return (
    <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
      <div
        className="absolute top-0 bottom-0 rounded-full transition-all duration-500"
        style={{
          left: value >= 0 ? '50%' : `${clamp}%`,
          width: value >= 0 ? `${clamp - 50}%` : `${50 - clamp}%`,
          background: biasColor(value),
        }}
      />
    </div>
  )
}

function PairCard({ pair, type }: { pair: PairData; type: 'trade' | 'watch' }) {
  const isTrade = type === 'trade'
  const borderColor = isTrade
    ? pair.isHighConviction ? 'border-green-500/40' : 'border-accent/30'
    : 'border-yellow-500/20'

  return (
    <div className={`p-4 sm:p-5 rounded-xl bg-bg-card border ${borderColor} ${pair.isHighConviction ? 'ring-1 ring-green-500/20' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <span className="text-base sm:text-lg font-display font-semibold text-heading">{pair.pair}</span>
          <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
            pair.direction === 'LONG'
              ? 'bg-green-500/15 text-green-400'
              : 'bg-red-500/15 text-red-400'
          }`}>
            {pair.direction}
          </span>
          {pair.isHighConviction && (
            <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-300 font-semibold">
              HIGH CONVICTION
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-text-dim">
          <span>Score: <strong className="text-heading">{pair.finalScore}</strong></span>
          {pair.sizeHint && <span className="px-2 py-0.5 rounded bg-white/5">{pair.sizeHint}</span>}
        </div>
      </div>
      <p className="text-xs sm:text-sm text-text-muted">{pair.reason}</p>
      <div className="flex flex-wrap gap-3 mt-2 text-xs text-text-dim">
        <span>Divergentie: {pair.rawDivergence}</span>
        {pair.intermarketAdj !== 0 && <span>IM adj: {pair.intermarketAdj}</span>}
        {pair.eventPenalty > 0 && <span className="text-red-400">Event penalty: -{pair.eventPenalty}</span>}
        <span>Groep: {pair.correlationGroup}</span>
      </div>
    </div>
  )
}
