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

// ─── Helper: intermarket conclusion ─────────────────────────
function getIntermarketConclusion(signals: IntermarketSignal[]): { text: string; sentiment: string } {
  const get = (key: string) => signals.find(s => s.key === key)
  const vix = get('vix')
  const sp = get('sp500')
  const gold = get('gold')
  const yields = get('us10y')
  const oil = get('oil')

  const riskOnSignals: string[] = []
  const riskOffSignals: string[] = []

  if (sp?.direction === 'up') riskOnSignals.push('S&P 500 stijgt')
  if (sp?.direction === 'down') riskOffSignals.push('S&P 500 daalt')
  if (vix?.direction === 'down') riskOnSignals.push('VIX daalt')
  if (vix?.direction === 'up') riskOffSignals.push('VIX stijgt')
  if (vix?.current && vix.current > 25) riskOffSignals.push(`VIX hoog (${vix.current})`)
  if (gold?.direction === 'up') riskOffSignals.push('Goud stijgt (vlucht naar veiligheid)')
  if (gold?.direction === 'down') riskOnSignals.push('Goud daalt')
  if (yields?.direction === 'up') riskOffSignals.push('Yields stijgen (USD sterker)')
  if (yields?.direction === 'down') riskOnSignals.push('Yields dalen')

  if (riskOffSignals.length >= 3) {
    return {
      sentiment: 'risk-off',
      text: `Intermarket bevestigt Risk-Off: ${riskOffSignals.join(', ')}. Verwacht sterkte in JPY, CHF en USD. Voorzichtig met long risk-posities (AUD, NZD).`,
    }
  }
  if (riskOnSignals.length >= 3) {
    return {
      sentiment: 'risk-on',
      text: `Intermarket bevestigt Risk-On: ${riskOnSignals.join(', ')}. Verwacht sterkte in AUD, NZD, CAD en zwakte in JPY. Zoek long setups in high-yield paren.`,
    }
  }

  const allPoints = [...riskOnSignals.map(s => `✓ ${s}`), ...riskOffSignals.map(s => `✗ ${s}`)]
  return {
    sentiment: 'mixed',
    text: `Gemengde signalen: ${allPoints.join(', ')}. Geen eenduidige bevestiging — wees selectiever en wacht op duidelijkere price action.`,
  }
}

// ─── Helper: trade focus from pair biases ───────────────────
function getTradeFocus(pairs: PairBias[], events: TodayEvent[], ranking: CurrencyRank[]) {
  // Get top 3 pairs with strongest conviction
  const strong = pairs.filter(p => p.conviction === 'sterk' || p.conviction === 'matig')
  const top = strong.slice(0, 3)

  return top.map(pair => {
    const isBullish = pair.direction.includes('bullish')
    const isBearish = pair.direction.includes('bearish')

    // Find relevant events for this pair
    const pairEvents = events.filter(e => e.currency === pair.base || e.currency === pair.quote)

    // Get currency details
    const baseRank = ranking.find(r => r.currency === pair.base)
    const quoteRank = ranking.find(r => r.currency === pair.quote)

    // Build action text
    let action = ''
    if (isBullish) {
      action = `Zoek LONG structure breaks op je 15min chart. ${pair.base} is fundamenteel sterker dan ${pair.quote}.`
    } else if (isBearish) {
      action = `Zoek SHORT structure breaks op je 15min chart. ${pair.quote} is fundamenteel sterker dan ${pair.base}.`
    } else {
      action = 'Neutraal — wacht op duidelijkere fundamentele divergentie.'
    }

    // Build why
    const whyParts: string[] = []
    if (baseRank?.bias) whyParts.push(`${pair.base}: ${baseRank.bias}`)
    if (quoteRank?.bias) whyParts.push(`${pair.quote}: ${quoteRank.bias}`)
    if (pair.rateDiff !== null) {
      whyParts.push(`Renteverschil: ${pair.rateDiff > 0 ? '+' : ''}${pair.rateDiff}%`)
    }

    // Event warning
    let eventWarning = ''
    if (pairEvents.length > 0) {
      eventWarning = `Let op: ${pairEvents.map(e => `${e.title} (${e.currency}, ${e.time})`).join(', ')} — volatiliteit verwacht.`
    }

    return {
      pair: pair.pair,
      direction: pair.direction,
      conviction: pair.conviction,
      score: pair.score,
      action,
      why: whyParts.join(' | '),
      eventWarning,
      isBullish,
      isBearish,
    }
  })
}

// ─── Components ─────────────────────────────────────────────
function ScoreBar({ score, max = 5 }: { score: number; max?: number }) {
  const pct = Math.min(Math.abs(score) / max * 100, 100)
  const isPositive = score >= 0
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden relative">
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

// ─── Main Dashboard ─────────────────────────────────────────
export default function DailyBriefingDashboard() {
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showRegimeDetails, setShowRegimeDetails] = useState(false)

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

  // Derived data
  const intermarketConclusion = data?.intermarketSignals ? getIntermarketConclusion(data.intermarketSignals) : null
  const tradeFocus = data ? getTradeFocus(data.pairBiases, data.todayEvents, data.currencyRanking) : []

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-xs tracking-[0.2em] uppercase text-accent-light mb-3">Dagelijks Bijgewerkt</p>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold text-heading mb-3">
          Daily Macro Briefing
        </h1>
        <p className="text-sm sm:text-base text-text-muted max-w-2xl mx-auto">
          Fundamentele analyse die leidt tot concrete trade focus. Check elke ochtend je bias voordat je je charts opent.
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
          {/* Last updated */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-xs text-text-dim">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              {new Date(data.generatedAt).toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </div>
            <button onClick={fetchBriefing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-heading hover:border-border-light transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Ververs
            </button>
          </div>

          {/* ════════════════════════════════════════════════════════
              1. MACRO REGIME — Visual Dashboard Card
              ════════════════════════════════════════════════════════ */}
          <section className="mb-8">
            <div className="rounded-xl overflow-hidden border border-border">
              {/* Regime header bar */}
              <div className={`px-5 sm:px-6 py-4 ${
                data.regime === 'Risk-Off' ? 'bg-gradient-to-r from-red-500/10 to-red-500/5' :
                data.regime === 'Risk-On' ? 'bg-gradient-to-r from-green-500/10 to-green-500/5' :
                data.regime === 'USD Dominant' ? 'bg-gradient-to-r from-blue-500/10 to-blue-500/5' :
                data.regime === 'USD Zwak' ? 'bg-gradient-to-r from-amber-500/10 to-amber-500/5' :
                'bg-gradient-to-r from-white/5 to-white/[0.02]'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      data.regime === 'Risk-Off' ? 'bg-red-500' :
                      data.regime === 'Risk-On' ? 'bg-green-500' :
                      data.regime === 'USD Dominant' ? 'bg-blue-500' :
                      data.regime === 'USD Zwak' ? 'bg-amber-500' : 'bg-gray-500'
                    } animate-pulse`} />
                    <div>
                      <p className="text-[10px] text-text-dim uppercase tracking-wider">Macro Regime</p>
                      <p className={`text-xl font-display font-bold ${
                        data.regime === 'Risk-Off' ? 'text-red-400' :
                        data.regime === 'Risk-On' ? 'text-green-400' :
                        data.regime === 'USD Dominant' ? 'text-blue-400' :
                        data.regime === 'USD Zwak' ? 'text-amber-400' : 'text-text-muted'
                      }`}>{data.regime}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowRegimeDetails(!showRegimeDetails)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-muted hover:text-heading hover:border-border-light transition-colors"
                  >
                    {showRegimeDetails ? 'Verberg uitleg' : 'Meer uitleg'}
                  </button>
                </div>
              </div>

              {/* Regime body */}
              <div className="px-5 sm:px-6 py-4 bg-bg-card">
                <p className="text-sm text-text-muted leading-relaxed">{data.regimeExplain}</p>

                {/* Expandable details */}
                {showRegimeDetails && (
                  <div className="mt-4 space-y-3">
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <p className="text-xs text-text-dim leading-relaxed">
                        <strong className="text-text-muted">Hoe wordt het regime bepaald?</strong> {data.regimeMethodology}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-accent-glow/10 border border-accent-dim/20">
                      <p className="text-xs text-text-dim leading-relaxed">
                        <strong className="text-accent-light">High-yield vs safe-haven:</strong>{' '}
                        <em>High-yield</em> valuta&apos;s (AUD, NZD, CAD) hebben hogere rentes en trekken kapitaal aan in goede tijden (Risk-On).{' '}
                        <em>Safe-haven</em> valuta&apos;s (JPY, CHF, USD) worden sterker in onzekere tijden (Risk-Off).
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════
              2. INTERMARKET SIGNALEN + CONCLUSIE
              ════════════════════════════════════════════════════════ */}
          <section className="mb-8">
            <h2 className="text-lg font-display font-semibold text-heading mb-4">Intermarket Signalen</h2>

            {/* Signal cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
              {data.intermarketSignals?.map(signal => {
                const isUp = signal.direction === 'up'
                const isDown = signal.direction === 'down'
                const dirColor = isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-text-dim'
                const hasData = signal.current !== null

                return (
                  <div key={signal.key} className="p-3 rounded-xl bg-bg-card border border-border">
                    <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1 truncate">{signal.name}</p>
                    {hasData ? (
                      <>
                        <p className="text-lg font-mono font-semibold text-heading leading-tight">
                          {signal.unit === '$' ? '$' : ''}{signal.current}{signal.unit === '%' ? '%' : ''}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`text-xs font-mono ${dirColor}`}>
                            {isUp ? '▲' : isDown ? '▼' : '—'} {signal.changePct != null ? `${signal.changePct > 0 ? '+' : ''}${signal.changePct}%` : ''}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-text-dim italic mt-1">N/A</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Intermarket conclusion */}
            {intermarketConclusion && (
              <div className={`p-4 rounded-xl border ${
                intermarketConclusion.sentiment === 'risk-off' ? 'bg-red-500/[0.06] border-red-500/20' :
                intermarketConclusion.sentiment === 'risk-on' ? 'bg-green-500/[0.06] border-green-500/20' :
                'bg-white/[0.03] border-border'
              }`}>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Conclusie</p>
                <p className="text-sm text-text-muted leading-relaxed">{intermarketConclusion.text}</p>
              </div>
            )}

            {/* Expandable detail per signal */}
            <details className="mt-3">
              <summary className="text-[11px] text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                Per signaal uitleg bekijken ▸
              </summary>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.intermarketSignals?.map(signal => (
                  <div key={signal.key} className="p-3 rounded-lg bg-white/[0.02] border border-border/50">
                    <p className="text-xs font-semibold text-heading mb-1">{signal.name}</p>
                    <p className="text-[11px] text-text-dim leading-relaxed">{signal.howToRead}</p>
                  </div>
                ))}
              </div>
            </details>
          </section>

          {/* ════════════════════════════════════════════════════════
              3. TRADE FOCUS — De concrete output
              ════════════════════════════════════════════════════════ */}
          {tradeFocus.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-display font-semibold text-heading mb-2">Trade Focus</h2>
              <p className="text-xs text-text-muted mb-4">
                De sterkste fundamentele divergenties van vandaag. Zoek hier je structure breaks.
              </p>
              <div className="space-y-3">
                {tradeFocus.map(tf => (
                  <div
                    key={tf.pair}
                    className={`rounded-xl overflow-hidden border ${
                      tf.isBullish ? 'border-green-500/30' : tf.isBearish ? 'border-red-500/30' : 'border-border'
                    }`}
                  >
                    {/* Pair header */}
                    <div className={`px-5 py-3 flex items-center justify-between ${
                      tf.isBullish ? 'bg-green-500/[0.08]' : tf.isBearish ? 'bg-red-500/[0.08]' : 'bg-white/[0.03]'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-display font-bold text-heading">{tf.pair}</span>
                        <span className={`text-sm font-semibold capitalize ${
                          tf.isBullish ? 'text-green-400' : tf.isBearish ? 'text-red-400' : 'text-text-dim'
                        }`}>
                          {tf.isBullish ? '↑' : tf.isBearish ? '↓' : '→'} {tf.direction}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          tf.conviction === 'sterk' ? 'bg-accent/15 text-accent-light' : 'bg-white/10 text-text-dim'
                        }`}>
                          {tf.conviction}
                        </span>
                      </div>
                      <span className={`text-sm font-mono font-semibold ${
                        tf.score > 0 ? 'text-green-400' : tf.score < 0 ? 'text-red-400' : 'text-text-dim'
                      }`}>
                        {tf.score > 0 ? '+' : ''}{tf.score}
                      </span>
                    </div>

                    {/* Action body */}
                    <div className="px-5 py-4 bg-bg-card">
                      <p className="text-sm text-heading font-medium mb-2">{tf.action}</p>
                      <p className="text-xs text-text-dim mb-2">{tf.why}</p>
                      {tf.eventWarning && (
                        <div className="p-2.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 mt-2">
                          <p className="text-xs text-amber-400/90">⚠ {tf.eventWarning}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <p className="text-xs text-text-dim leading-relaxed">
                  <strong className="text-text-muted">Hoe gebruik je dit?</strong> De fundamentals geven je de richting.
                  Open je 15min chart, zoek 2 structure breaks in de richting van de bias, en neem de trade.
                  Als er vandaag high-impact events zijn voor het paar, wacht dan de release af of trade met een kleiner risico.
                </p>
              </div>
            </section>
          )}

          {/* ════════════════════════════════════════════════════════
              4. TODAY'S EVENTS
              ════════════════════════════════════════════════════════ */}
          <section className="mb-8">
            <h2 className="text-lg font-display font-semibold text-heading mb-4 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Vandaag &amp; Morgen — High Impact
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
                      <span className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/20">{evt.impact}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-heading mb-1">{evt.title}</h3>
                    <div className="flex gap-4 text-xs text-text-dim mb-3">
                      {evt.forecast && <span>Verwacht: <strong className="text-text-muted">{evt.forecast}</strong></span>}
                      {evt.previous && <span>Vorig: <strong className="text-text-muted">{evt.previous}</strong></span>}
                    </div>
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

          {/* ════════════════════════════════════════════════════════
              5. CURRENCY SCORECARD
              ════════════════════════════════════════════════════════ */}
          <section className="mb-8">
            <h2 className="text-lg font-display font-semibold text-heading mb-2">Currency Scorecard</h2>
            <p className="text-xs text-text-muted mb-4">
              Sterkste bovenaan, zwakste onderaan. Combineer sterk + zwak = beste divergentie.
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
                        <td className="px-4 py-3"><BiasTag bias={ccy.bias} /></td>
                        <td className="px-4 py-3 text-sm font-mono text-text-muted hidden sm:table-cell">
                          {ccy.rate != null ? `${ccy.rate}%` : '—'}
                        </td>
                        <td className="px-4 py-3"><ScoreBar score={ccy.score} /></td>
                        <td className="px-4 py-3 text-xs text-text-dim hidden md:table-cell max-w-[200px]">{ccy.reasons[0] || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════
              6. PAIR BIAS TABLE (collapsed by default)
              ════════════════════════════════════════════════════════ */}
          <section className="mb-8">
            <details>
              <summary className="text-lg font-display font-semibold text-heading mb-2 cursor-pointer hover:text-accent-light transition-colors">
                Alle Pair Biases ▸
              </summary>
              <p className="text-xs text-text-muted mb-4 mt-2">
                Fundamentele richting per paar. Gesorteerd op sterkste divergentie.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.pairBiases.map(pair => {
                  const isBull = pair.direction.includes('bullish')
                  const isBear = pair.direction.includes('bearish')
                  return (
                    <div key={pair.pair} className={`p-4 rounded-xl bg-bg-card border transition-colors ${
                      pair.conviction === 'sterk' ? 'border-accent/40' : pair.conviction === 'matig' ? 'border-border-light' : 'border-border'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-heading">{pair.pair}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-base font-bold ${isBull ? 'text-green-400' : isBear ? 'text-red-400' : 'text-text-dim'}`}>
                            {isBull ? '↑' : isBear ? '↓' : '→'}
                          </span>
                          <span className={`text-sm font-medium capitalize ${isBull ? 'text-green-400' : isBear ? 'text-red-400' : 'text-text-dim'}`}>
                            {pair.direction}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-dim mb-2">
                        <span>Score: <strong className={`font-mono ${pair.score > 0 ? 'text-green-400' : pair.score < 0 ? 'text-red-400' : 'text-text-dim'}`}>{pair.score > 0 ? '+' : ''}{pair.score}</strong></span>
                        {pair.rateDiff !== null && (
                          <span>Rente: <strong className="text-text-muted font-mono">{pair.rateDiff > 0 ? '+' : ''}{pair.rateDiff}%</strong></span>
                        )}
                      </div>
                      <p className="text-xs text-text-dim leading-relaxed">{pair.reason}</p>
                    </div>
                  )
                })}
              </div>
            </details>
          </section>

          {/* ── LINKS ── */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Link href="/tools/fx-analyse" className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-muted hover:text-heading hover:border-border-light transition-colors">
              Macro Fundamentals →
              <span className="block text-[10px] text-text-dim">Leer hoe valutaparen werken</span>
            </Link>
            <Link href="/tools/kalender" className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-muted hover:text-heading hover:border-border-light transition-colors">
              Economische Kalender →
              <span className="block text-[10px] text-text-dim">Volledige eventkalender</span>
            </Link>
            <Link href="/tools/rente" className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-muted hover:text-heading hover:border-border-light transition-colors">
              Rentetarieven →
              <span className="block text-[10px] text-text-dim">Alle centrale bank rentes</span>
            </Link>
          </div>

          <div className="p-4 rounded-xl border border-border bg-bg-card/30 text-center">
            <p className="text-xs text-text-dim leading-relaxed">
              Deze briefing is puur educatief en geen financieel advies. Data wordt automatisch opgehaald.
              Fundamentals geven de richting — je technische analyse (structure breaks) bepaalt de timing en entry.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
