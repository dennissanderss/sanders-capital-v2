'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─── Types ──────────────────────────────────────────────────
interface CurrencyRank {
  currency: string
  score: number
  reasons: string[]
  rate: number | null
  bias: string
  flag: string
  bank: string
}

interface PairBias {
  pair: string
  base: string
  quote: string
  direction: string
  conviction: string
  score: number
  reason: string
  rateDiff: number | null
  baseBias: string
  quoteBias: string
}

interface TodayEvent {
  title: string
  currency: string
  date: string
  impact: string
  forecast: string
  previous: string
  flag: string
  countryName: string
  context: string
  time: string
  dateFormatted: string
}

interface IntermarketSignal {
  key: string
  name: string
  unit: string
  context: string
  howToRead: string
  regimeImpact: string
  current: number | null
  change: number | null
  changePct: number | null
  direction: 'up' | 'down' | 'flat'
}

interface BriefingData {
  regime: string
  regimeExplain: string
  regimeMethodology: string
  intermarketSignals: IntermarketSignal[]
  currencyRanking: CurrencyRank[]
  pairBiases: PairBias[]
  todayEvents: TodayEvent[]
  weekEvents: { title: string; currency: string; date: string; impact: string; forecast: string; previous: string }[]
  generatedAt: string
  date: string
  error?: string
}

function flagEmoji(code: string) {
  if (!code || code.length !== 2) return ''
  return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('')
}

// ─── Components ─────────────────────────────────────────────
function RegimeBadge({ regime }: { regime: string }) {
  const colors: Record<string, string> = {
    'Risk-On': 'bg-green-500/15 text-green-400 border-green-500/30',
    'Risk-Off': 'bg-red-500/15 text-red-400 border-red-500/30',
    'USD Dominant': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    'USD Zwak': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    'Gemengd': 'bg-white/10 text-text-muted border-border',
  }
  return (
    <span className={`inline-flex px-3 py-1 rounded-lg text-sm font-semibold border ${colors[regime] || colors['Gemengd']}`}>
      {regime}
    </span>
  )
}

function DirectionBadge({ direction, conviction }: { direction: string; conviction: string }) {
  const isBull = direction.includes('bullish')
  const isBear = direction.includes('bearish')
  const color = isBull ? 'text-green-400' : isBear ? 'text-red-400' : 'text-text-dim'
  const arrow = isBull ? '↑' : isBear ? '↓' : '→'
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-base font-bold ${color}`}>{arrow}</span>
      <span className={`text-sm font-medium ${color} capitalize`}>{direction}</span>
      {conviction !== 'geen' && (
        <span className="text-[10px] text-text-dim">({conviction})</span>
      )}
    </div>
  )
}

function ScoreBar({ score, max = 5 }: { score: number; max?: number }) {
  const pct = Math.min(Math.abs(score) / max * 100, 100)
  const isPositive = score >= 0
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden relative">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 w-px h-full bg-white/10" />
        {isPositive ? (
          <div className="absolute left-1/2 h-full rounded-r-full bg-green-500/60 transition-all" style={{ width: `${pct / 2}%` }} />
        ) : (
          <div className="absolute right-1/2 h-full rounded-l-full bg-red-500/60 transition-all" style={{ width: `${pct / 2}%` }} />
        )}
      </div>
      <span className={`text-xs font-mono w-10 text-right ${score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-text-dim'}`}>
        {score > 0 ? '+' : ''}{score.toFixed(1)}
      </span>
    </div>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────
export default function DailyBriefingDashboard() {
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBriefing = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/briefing')
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'API error')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fout bij ophalen')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBriefing() }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-xs tracking-[0.2em] uppercase text-accent-light mb-3">Dagelijks Bijgewerkt</p>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold text-heading mb-3">
          Daily Macro Briefing
        </h1>
        <p className="text-sm sm:text-base text-text-muted max-w-2xl mx-auto">
          Jouw dagelijkse fundamentele analyse: macro regime, valuta sterkte, pair bias en events met context.
          Open deze tool elke ochtend om je trading bias te bepalen.
        </p>
      </div>

      {loading && (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <span className="inline-block w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Briefing laden...</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm text-center">
          {error}
          <button onClick={fetchBriefing} className="ml-3 underline hover:text-red-200">Opnieuw proberen</button>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Last updated + refresh */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-xs text-text-dim">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span>
                {new Date(data.generatedAt).toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <button
              onClick={fetchBriefing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-heading hover:border-border-light transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Ververs
            </button>
          </div>

          {/* ── 1. MACRO REGIME ── */}
          <section className="mb-8">
            <div className="p-5 sm:p-6 rounded-xl bg-bg-card border border-border">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <h2 className="text-lg font-display font-semibold text-heading">Macro Regime</h2>
                <RegimeBadge regime={data.regime} />
              </div>
              <p className="text-sm text-text-muted leading-relaxed">{data.regimeExplain}</p>

              <div className="mt-4 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <p className="text-xs text-text-dim leading-relaxed mb-2">
                  <strong className="text-text-muted">Hoe wordt het regime bepaald?</strong> {data.regimeMethodology}
                </p>
              </div>

              <div className="mt-3 p-3 rounded-lg bg-accent-glow/10 border border-accent-dim/20">
                <p className="text-xs text-text-dim leading-relaxed">
                  <strong className="text-accent-light">High-yield vs safe-haven valuta&apos;s:</strong>{' '}
                  <em>High-yield</em> valuta&apos;s (AUD, NZD, CAD) hebben hogere rentes en trekken kapitaal aan in goede tijden (Risk-On).
                  <em> Safe-haven</em> valuta&apos;s (JPY, CHF, USD) worden juist sterker in onzekere tijden (Risk-Off) omdat beleggers veiligheid zoeken.
                  Het regime vertelt je welke groep nu dominant is.
                </p>
              </div>
            </div>
          </section>

          {/* ── 1b. INTERMARKET SIGNALS ── */}
          <section className="mb-8">
            <h2 className="text-lg font-display font-semibold text-heading mb-2">Intermarket Signalen</h2>
            <p className="text-xs text-text-muted mb-4">
              Live marktdata die het forex regime beïnvloedt. Gebruik als bevestiging van je fundamentele bias.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.intermarketSignals?.map(signal => {
                const isUp = signal.direction === 'up'
                const isDown = signal.direction === 'down'
                const dirColor = isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-text-dim'
                const dirArrow = isUp ? '▲' : isDown ? '▼' : '—'
                const hasData = signal.current !== null

                return (
                  <div key={signal.key} className="p-4 rounded-xl bg-bg-card border border-border">
                    {/* Header with live data */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-heading">{signal.name}</h3>
                      {hasData && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          isUp ? 'bg-green-500/15 text-green-400' : isDown ? 'bg-red-500/15 text-red-400' : 'bg-white/10 text-text-dim'
                        }`}>
                          {dirArrow} {signal.changePct != null ? `${signal.changePct > 0 ? '+' : ''}${signal.changePct}%` : ''}
                        </span>
                      )}
                    </div>

                    {/* Live price */}
                    {hasData && (
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-xl font-mono font-semibold text-heading">
                          {signal.unit === '$' ? '$' : ''}{signal.current}{signal.unit === '%' ? '%' : ''}
                        </span>
                        <span className={`text-xs font-mono ${dirColor}`}>
                          {signal.change != null ? `${signal.change > 0 ? '+' : ''}${signal.change}` : ''}
                        </span>
                      </div>
                    )}

                    {!hasData && (
                      <div className="mb-3">
                        <span className="text-xs text-text-dim italic">Data niet beschikbaar</span>
                      </div>
                    )}

                    {/* Context */}
                    <p className="text-xs text-text-muted leading-relaxed mb-2">{signal.context}</p>
                    <details className="group">
                      <summary className="text-[11px] text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                        Meer uitleg ▸
                      </summary>
                      <div className="mt-2 p-2 rounded bg-white/[0.03]">
                        <p className="text-[11px] text-text-dim leading-relaxed mb-1">
                          <strong className="text-text-muted">Hoe lezen:</strong> {signal.howToRead}
                        </p>
                        <p className="text-[10px] text-accent-light/50 mt-1">{signal.regimeImpact}</p>
                      </div>
                    </details>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── 2. TODAY'S EVENTS ── */}
          <section className="mb-8">
            <h2 className="text-lg font-display font-semibold text-heading mb-4 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Vandaag &amp; Morgen — High Impact Events
            </h2>
            {data.todayEvents.length === 0 ? (
              <div className="p-4 rounded-xl bg-bg-card border border-border text-center">
                <p className="text-sm text-text-dim">Geen high-impact events vandaag of morgen. Rustige dag — focus op technische setups.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.todayEvents.map((evt, i) => (
                  <div key={i} className="p-4 rounded-xl bg-bg-card border border-border">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-lg">{flagEmoji(evt.flag)}</span>
                      <span className="text-xs font-mono font-bold text-heading">{evt.currency}</span>
                      <span className="text-xs font-mono text-text-dim">{evt.dateFormatted}</span>
                      <span className="text-xs font-mono text-text-dim">{evt.time}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/20">
                        {evt.impact}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-heading mb-1">{evt.title}</h3>
                    <div className="flex gap-4 text-xs text-text-dim mb-3">
                      {evt.forecast && <span>Verwacht: <strong className="text-text-muted">{evt.forecast}</strong></span>}
                      {evt.previous && <span>Vorig: <strong className="text-text-muted">{evt.previous}</strong></span>}
                    </div>
                    {/* Context — the real value */}
                    <div className="p-3 rounded-lg bg-accent-glow/20 border border-accent-dim/30">
                      <p className="text-xs text-text-muted leading-relaxed">
                        <strong className="text-accent-light">Context: </strong>{evt.context}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── 3. CURRENCY SCORECARD ── */}
          <section className="mb-8">
            <h2 className="text-lg font-display font-semibold text-heading mb-2">Currency Scorecard</h2>
            <p className="text-xs text-text-muted mb-4">
              Ranking op basis van CB-bias en rente vs target. Sterkste bovenaan, zwakste onderaan.
              Combineer een sterke met een zwakke valuta voor de beste fundamentele setup.
            </p>
            <div className="rounded-xl bg-bg-card border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">#</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Valuta</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">CB Bias</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Rente</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider min-w-[140px]">Score</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Reden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.currencyRanking.map((ccy, i) => (
                      <tr key={ccy.currency} className={`border-b border-border/30 hover:bg-bg-hover transition-colors ${
                        i === 0 ? 'bg-green-500/[0.04]' : i === data.currencyRanking.length - 1 ? 'bg-red-500/[0.04]' : ''
                      }`}>
                        <td className="px-4 py-3 text-xs text-text-dim font-mono">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{flagEmoji(ccy.flag)}</span>
                            <span className="text-sm font-bold text-heading">{ccy.currency}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <BiasTag bias={ccy.bias} />
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-text-muted hidden sm:table-cell">
                          {ccy.rate != null ? `${ccy.rate}%` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <ScoreBar score={ccy.score} />
                        </td>
                        <td className="px-4 py-3 text-xs text-text-dim hidden md:table-cell max-w-[200px]">
                          {ccy.reasons[0] || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
              <p className="text-xs text-text-dim leading-relaxed">
                <strong className="text-text-muted">Hoe lees je dit?</strong> De score is gebaseerd op centrale bank beleid.
                Een hoge score betekent fundamenteel sterke valuta (hawkish beleid). Let op: een extreem sterke valuta kan technisch overbought zijn —
                de fundamentals geven de richting, je technische analyse bepaalt de timing en entry.
              </p>
            </div>
          </section>

          {/* ── 4. PAIR BIAS TABLE ── */}
          <section className="mb-8">
            <h2 className="text-lg font-display font-semibold text-heading mb-2">Pair Bias</h2>
            <p className="text-xs text-text-muted mb-4">
              Fundamentele richting per paar. Gesorteerd op sterkste divergentie.
              Zoek technische bevestiging op je chart voordat je een positie inneemt.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.pairBiases.map(pair => (
                <div
                  key={pair.pair}
                  className={`p-4 rounded-xl bg-bg-card border transition-colors ${
                    pair.conviction === 'sterk' ? 'border-accent/40' :
                    pair.conviction === 'matig' ? 'border-border-light' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-heading">{pair.pair}</span>
                    <DirectionBadge direction={pair.direction} conviction={pair.conviction} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-dim mb-2">
                    <span>Score: <strong className={`font-mono ${pair.score > 0 ? 'text-green-400' : pair.score < 0 ? 'text-red-400' : 'text-text-dim'}`}>{pair.score > 0 ? '+' : ''}{pair.score}</strong></span>
                    {pair.rateDiff !== null && (
                      <span>Rente diff: <strong className="text-text-muted font-mono">{pair.rateDiff > 0 ? '+' : ''}{pair.rateDiff}%</strong></span>
                    )}
                  </div>
                  <p className="text-xs text-text-dim leading-relaxed">{pair.reason}</p>
                  <div className="mt-2 flex gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-text-dim">{pair.base}: {pair.baseBias || 'n/a'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-text-dim">{pair.quote}: {pair.quoteBias || 'n/a'}</span>
                  </div>
                  {/* Link to FX Analyse for deeper analysis */}
                  <Link
                    href={`/tools/fx-analyse`}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] text-accent-light/60 hover:text-accent-light transition-colors"
                  >
                    Verdiep je in dit paar →
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* ── 5. HOW TO USE ── */}
          <section className="mb-8">
            <div className="p-5 sm:p-6 rounded-xl bg-accent-glow/20 border border-accent-dim/30">
              <h2 className="text-base font-display font-semibold text-heading mb-3">Hoe gebruik je deze briefing?</h2>
              <div className="space-y-2">
                {[
                  { step: '1', text: 'Check het macro regime — trade met het thema, niet ertegen.' },
                  { step: '2', text: 'Bekijk de events van vandaag — weet wat de markt kan bewegen en bereid scenario\'s voor.' },
                  { step: '3', text: 'Kijk naar de currency scorecard — welke valuta\'s zijn sterk/zwak en waarom?' },
                  { step: '4', text: 'Kies je paren uit de pair bias tabel — sterkste vs zwakste = beste divergentie.' },
                  { step: '5', text: 'Open je chart en zoek technische bevestiging — de fundamentals geven richting, technicals geven timing.' },
                ].map(item => (
                  <div key={item.step} className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/20 text-accent-light text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {item.step}
                    </span>
                    <p className="text-xs text-text-muted leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── LINKS ── */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Link
              href="/tools/fx-analyse"
              className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-muted hover:text-heading hover:border-border-light transition-colors"
            >
              Macro Fundamentals →
              <span className="block text-[10px] text-text-dim">Leer hoe valutaparen werken</span>
            </Link>
            <Link
              href="/tools/kalender"
              className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-muted hover:text-heading hover:border-border-light transition-colors"
            >
              Economische Kalender →
              <span className="block text-[10px] text-text-dim">Volledige eventkalender</span>
            </Link>
            <Link
              href="/tools/rente"
              className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-muted hover:text-heading hover:border-border-light transition-colors"
            >
              Rentetarieven →
              <span className="block text-[10px] text-text-dim">Alle centrale bank rentes</span>
            </Link>
          </div>

          {/* Disclaimer */}
          <div className="p-4 rounded-xl border border-border bg-bg-card/30 text-center">
            <p className="text-xs text-text-dim leading-relaxed">
              Deze briefing is puur educatief en geen financieel advies. Data wordt automatisch opgehaald van
              economische kalenders en je eigen CB-rente database. Gebruik dit als framework, niet als handelssignaal.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────
function BiasTag({ bias }: { bias: string }) {
  if (!bias) return <span className="text-xs text-text-dim">—</span>
  const b = bias.toLowerCase()
  const isHawkish = b.includes('verkrappend')
  const isDovish = b.includes('verruimend')
  const color = isHawkish ? 'bg-green-500/15 text-green-400 border-green-500/20'
    : isDovish ? 'bg-red-500/15 text-red-400 border-red-500/20'
    : 'bg-white/10 text-text-muted border-border'
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded border ${color} whitespace-nowrap`}>
      {bias}
    </span>
  )
}
