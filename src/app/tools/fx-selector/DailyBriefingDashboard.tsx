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

interface TrackRecord {
  id: string
  date: string
  pair: string
  direction: string
  conviction: string
  score: number
  entry_price: number | null
  exit_price: number | null
  result: 'pending' | 'correct' | 'incorrect'
  pips_moved: number | null
  regime: string
}

interface TrackStats {
  total: number
  correct: number
  incorrect: number
  pending: number
  winRate: number
}

function flagEmoji(code: string) {
  if (!code || code.length !== 2) return ''
  return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('')
}

// ─── Helper: intermarket conclusion ─────────────────────────
function getIntermarketConclusion(signals: IntermarketSignal[], regime: string): { text: string; sentiment: string; confirmsRegime: boolean } {
  const get = (key: string) => signals.find(s => s.key === key)
  const vix = get('vix')
  const sp = get('sp500')
  const gold = get('gold')
  const yields = get('us10y')

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

  const isRiskOff = riskOffSignals.length >= 3
  const isRiskOn = riskOnSignals.length >= 3

  // Check if intermarket confirms the regime
  const confirmsRegime =
    (regime === 'Risk-Off' && isRiskOff) ||
    (regime === 'Risk-On' && isRiskOn) ||
    (regime === 'USD Dominant' && (yields?.direction === 'up' || riskOffSignals.length >= 2)) ||
    (regime === 'USD Zwak' && (yields?.direction === 'down' || riskOnSignals.length >= 2))

  if (isRiskOff) {
    return {
      sentiment: 'risk-off',
      confirmsRegime,
      text: `Intermarket bevestigt Risk-Off: ${riskOffSignals.join(', ')}. Verwacht sterkte in JPY, CHF en USD. Voorzichtig met long risk-posities (AUD, NZD).`,
    }
  }
  if (isRiskOn) {
    return {
      sentiment: 'risk-on',
      confirmsRegime,
      text: `Intermarket bevestigt Risk-On: ${riskOnSignals.join(', ')}. Verwacht sterkte in AUD, NZD, CAD en zwakte in JPY. Zoek long setups in high-yield paren.`,
    }
  }

  const allPoints = [...riskOnSignals.map(s => `✓ ${s}`), ...riskOffSignals.map(s => `✗ ${s}`)]
  return {
    sentiment: 'mixed',
    confirmsRegime: false,
    text: `Gemengde signalen: ${allPoints.join(', ')}. Geen eenduidige bevestiging — wees selectiever en wacht op duidelijkere price action.`,
  }
}

// ─── Helper: trade focus from pair biases ───────────────────
function getTradeFocus(pairs: PairBias[], events: TodayEvent[], ranking: CurrencyRank[]) {
  const strong = pairs.filter(p => p.conviction === 'sterk' || p.conviction === 'matig')
  const top = strong.slice(0, 3)

  return top.map(pair => {
    const isBullish = pair.direction.includes('bullish')
    const isBearish = pair.direction.includes('bearish')
    const pairEvents = events.filter(e => e.currency === pair.base || e.currency === pair.quote)
    const baseRank = ranking.find(r => r.currency === pair.base)
    const quoteRank = ranking.find(r => r.currency === pair.quote)

    let action = ''
    if (isBullish) {
      action = `Zoek LONG structure breaks op je 15min chart. ${pair.base} is fundamenteel sterker dan ${pair.quote}.`
    } else if (isBearish) {
      action = `Zoek SHORT structure breaks op je 15min chart. ${pair.quote} is fundamenteel sterker dan ${pair.base}.`
    } else {
      action = 'Neutraal — wacht op duidelijkere fundamentele divergentie.'
    }

    const whyParts: string[] = []
    if (baseRank?.bias) whyParts.push(`${pair.base}: ${baseRank.bias}`)
    if (quoteRank?.bias) whyParts.push(`${pair.quote}: ${quoteRank.bias}`)
    if (pair.rateDiff !== null) {
      whyParts.push(`Renteverschil: ${pair.rateDiff > 0 ? '+' : ''}${pair.rateDiff}%`)
    }

    // Build detailed fundamental explanation
    const explanationParts: string[] = []
    if (isBullish || isBearish) {
      const strongCcy = isBullish ? pair.base : pair.quote
      const weakCcy = isBullish ? pair.quote : pair.base
      const strongRank = isBullish ? baseRank : quoteRank
      const weakRank = isBullish ? quoteRank : baseRank

      // Score comparison — altijd tonen
      if (strongRank && weakRank) {
        explanationParts.push(`Fundamentele score: ${strongCcy} = ${strongRank.score > 0 ? '+' : ''}${strongRank.score.toFixed(1)} vs ${weakCcy} = ${weakRank.score > 0 ? '+' : ''}${weakRank.score.toFixed(1)}. Hoe groter het verschil, hoe sterker de divergentie.`)
      }

      // Strong currency bias
      if (strongRank?.bias) {
        const b = strongRank.bias.toLowerCase()
        if (b.includes('verkrappend') || b.includes('hawkish')) {
          explanationParts.push(`${strongCcy} is hawkish (${strongRank.bias}) — de centrale bank verkrapt of houdt rente hoog. Dit trekt kapitaal aan en maakt de valuta sterker.`)
        } else if (b.includes('verruimend') || b.includes('dovish')) {
          explanationParts.push(`${strongCcy} is dovish (${strongRank.bias}) — maar scoort alsnog hoger dan ${weakCcy} door andere factoren (rente, macro-dynamiek).`)
        } else if (b.includes('afwachtend')) {
          explanationParts.push(`${strongCcy} is afwachtend (${strongRank.bias}) — de centrale bank houdt beleid stabiel. Sterkte komt vanuit de zwakte van ${weakCcy}.`)
        } else {
          explanationParts.push(`${strongCcy}: ${strongRank.bias} — huidige CB-positie geeft een fundamenteel voordeel t.o.v. ${weakCcy}.`)
        }
      }

      // Weak currency bias
      if (weakRank?.bias) {
        const b = weakRank.bias.toLowerCase()
        if (b.includes('verruimend') || b.includes('dovish')) {
          explanationParts.push(`${weakCcy} is dovish (${weakRank.bias}) — de centrale bank verruimt of verlaagt rente. Dit jaagt kapitaal weg en maakt de valuta zwakker.`)
        } else if (b.includes('verkrappend') || b.includes('hawkish')) {
          explanationParts.push(`${weakCcy} is hawkish (${weakRank.bias}) — maar scoort alsnog lager dan ${strongCcy} door rente- of macro-verschil.`)
        } else if (b.includes('afwachtend')) {
          explanationParts.push(`${weakCcy} is afwachtend (${weakRank.bias}) — scoort lager door rente- of macro-dynamiek t.o.v. ${strongCcy}.`)
        } else {
          explanationParts.push(`${weakCcy}: ${weakRank.bias} — huidige CB-positie is fundamenteel zwakker dan ${strongCcy}.`)
        }
      }

      // Rate differential — altijd tonen als beschikbaar
      if (pair.rateDiff !== null) {
        const higher = pair.rateDiff > 0 ? pair.base : pair.quote
        const lower = pair.rateDiff > 0 ? pair.quote : pair.base
        const absDiff = Math.abs(pair.rateDiff)
        if (absDiff >= 1) {
          explanationParts.push(`Renteverschil: ${higher} biedt ${absDiff}% meer rente dan ${lower}. Grotere renteverschillen trekken carry-trade kapitaal aan richting de hogere rente.`)
        } else if (absDiff > 0) {
          explanationParts.push(`Renteverschil: ${higher} biedt ${absDiff}% meer rente dan ${lower}. Klein verschil — de CB-bias weegt hier zwaarder.`)
        } else {
          explanationParts.push(`Renteverschil: gelijk (${pair.base} en ${pair.quote} hebben dezelfde rente). De divergentie komt puur uit CB-beleidsverschillen.`)
        }
      }
    }

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
      explanation: explanationParts,
      eventWarning,
      isBullish,
      isBearish,
    }
  })
}

// ─── Step components ────────────────────────────────────────
function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/15 border border-accent/30 text-accent-light text-sm font-bold shrink-0">
        {step}
      </div>
      <div>
        <h2 className="text-lg font-display font-semibold text-heading leading-tight">{title}</h2>
        <p className="text-[11px] text-text-dim">{subtitle}</p>
      </div>
    </div>
  )
}

function StepBridge({ icon, text }: { icon: 'down' | 'check' | 'arrow'; text: string }) {
  return (
    <div className="flex items-center gap-3 py-4 px-2">
      <div className="flex flex-col items-center gap-1">
        <div className="w-px h-4 bg-accent/20" />
        <div className="w-5 h-5 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
          {icon === 'down' && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent-light">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
          {icon === 'check' && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent-light">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {icon === 'arrow' && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent-light">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          )}
        </div>
        <div className="w-px h-4 bg-accent/20" />
      </div>
      <p className="text-xs text-text-dim italic leading-relaxed">{text}</p>
    </div>
  )
}

// ─── Components ─────────────────────────────────────────────
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
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set())
  const [trackRecords, setTrackRecords] = useState<TrackRecord[]>([])
  const [trackStats, setTrackStats] = useState<TrackStats>({ total: 0, correct: 0, incorrect: 0, pending: 0, winRate: 0 })
  const [showTrackRecord, setShowTrackRecord] = useState(false)

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

  const fetchTrackRecord = async () => {
    try {
      const res = await fetch('/api/trackrecord')
      const json = await res.json()
      setTrackRecords(json.records || [])
      setTrackStats(json.stats || { total: 0, correct: 0, incorrect: 0, pending: 0, winRate: 0 })
    } catch {
      // Track record table might not exist yet
    }
  }

  const saveTrackRecord = async () => {
    try {
      await fetch('/api/trackrecord', { method: 'POST' })
      await fetchTrackRecord()
    } catch {}
  }

  const [backfilling, setBackfilling] = useState(false)
  const backfillTrackRecord = async () => {
    setBackfilling(true)
    try {
      await fetch('/api/trackrecord/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 14 }),
      })
      await fetchTrackRecord()
    } catch {}
    setBackfilling(false)
  }

  useEffect(() => {
    fetchBriefing()
    fetchTrackRecord()
  }, [])

  // Auto-save track record when briefing loads (once per day)
  useEffect(() => {
    if (data && !loading) {
      const lastSave = localStorage.getItem('track_last_save')
      const today = new Date().toISOString().split('T')[0]
      if (lastSave !== today) {
        saveTrackRecord()
        localStorage.setItem('track_last_save', today)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading])

  const togglePairExpanded = (pair: string) => {
    setExpandedPairs(prev => {
      const next = new Set(prev)
      if (next.has(pair)) next.delete(pair)
      else next.add(pair)
      return next
    })
  }

  // Derived data
  const intermarketConclusion = data?.intermarketSignals ? getIntermarketConclusion(data.intermarketSignals, data.regime) : null
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
              STAP 1: MACRO REGIME — Het startpunt
              ════════════════════════════════════════════════════════ */}
          <section className="mb-2">
            <StepHeader
              step={1}
              title="Macro Regime"
              subtitle="Wat is het huidige marktklimaat? Dit bepaalt welke valuta's de wind mee hebben."
            />
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
                      <p className={`text-xl font-display font-bold ${
                        data.regime === 'Risk-Off' ? 'text-red-400' :
                        data.regime === 'Risk-On' ? 'text-green-400' :
                        data.regime === 'USD Dominant' ? 'text-blue-400' :
                        data.regime === 'USD Zwak' ? 'text-amber-400' : 'text-text-muted'
                      }`}>{data.regime}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Regime body */}
              <div className="px-5 sm:px-6 py-4 bg-bg-card">
                <p className="text-sm text-text-muted leading-relaxed">{data.regimeExplain}</p>

                {/* Regime drivers — welke cijfers leiden tot dit regime */}
                <details className="mt-4 group">
                  <summary className="flex items-center gap-2 text-xs text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Waarom {data.regime}? — de cijfers erachter
                  </summary>
                  <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] space-y-3">
                    {/* Safe-haven vs high-yield scores */}
                    {(() => {
                      const safeHavens = data.currencyRanking.filter(c => ['JPY', 'CHF', 'USD'].includes(c.currency))
                      const highYield = data.currencyRanking.filter(c => ['AUD', 'NZD', 'CAD'].includes(c.currency))
                      const safeAvg = safeHavens.reduce((s, c) => s + c.score, 0) / (safeHavens.length || 1)
                      const highAvg = highYield.reduce((s, c) => s + c.score, 0) / (highYield.length || 1)
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                              <p className="text-[10px] text-text-dim uppercase tracking-wider mb-2">Safe-Haven (JPY, CHF, USD)</p>
                              {safeHavens.map(c => (
                                <div key={c.currency} className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-text-muted font-medium">{c.currency}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-text-dim">{c.bias || '—'}</span>
                                    <span className={`font-mono font-semibold ${c.score > 0 ? 'text-green-400' : c.score < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                                      {c.score > 0 ? '+' : ''}{c.score.toFixed(1)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                              <div className="mt-2 pt-2 border-t border-white/[0.05] flex items-center justify-between text-[10px]">
                                <span className="text-text-dim">Gemiddeld</span>
                                <span className={`font-mono font-bold ${safeAvg > 0 ? 'text-green-400' : safeAvg < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                                  {safeAvg > 0 ? '+' : ''}{safeAvg.toFixed(1)}
                                </span>
                              </div>
                            </div>
                            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                              <p className="text-[10px] text-text-dim uppercase tracking-wider mb-2">High-Yield (AUD, NZD, CAD)</p>
                              {highYield.map(c => (
                                <div key={c.currency} className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-text-muted font-medium">{c.currency}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-text-dim">{c.bias || '—'}</span>
                                    <span className={`font-mono font-semibold ${c.score > 0 ? 'text-green-400' : c.score < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                                      {c.score > 0 ? '+' : ''}{c.score.toFixed(1)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                              <div className="mt-2 pt-2 border-t border-white/[0.05] flex items-center justify-between text-[10px]">
                                <span className="text-text-dim">Gemiddeld</span>
                                <span className={`font-mono font-bold ${highAvg > 0 ? 'text-green-400' : highAvg < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                                  {highAvg > 0 ? '+' : ''}{highAvg.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className={`p-2.5 rounded-lg border text-[11px] leading-relaxed ${
                            data.regime === 'Risk-Off' ? 'bg-red-500/[0.05] border-red-500/15 text-red-300/80' :
                            data.regime === 'Risk-On' ? 'bg-green-500/[0.05] border-green-500/15 text-green-300/80' :
                            data.regime === 'USD Dominant' ? 'bg-blue-500/[0.05] border-blue-500/15 text-blue-300/80' :
                            data.regime === 'USD Zwak' ? 'bg-amber-500/[0.05] border-amber-500/15 text-amber-300/80' :
                            'bg-white/[0.03] border-border text-text-dim'
                          }`}>
                            {data.regime === 'Risk-Off' && `Safe-haven gemiddeld (${safeAvg > 0 ? '+' : ''}${safeAvg.toFixed(1)}) is sterker dan high-yield (${highAvg > 0 ? '+' : ''}${highAvg.toFixed(1)}) → kapitaal stroomt naar veilige havens → Risk-Off.`}
                            {data.regime === 'Risk-On' && `High-yield gemiddeld (${highAvg > 0 ? '+' : ''}${highAvg.toFixed(1)}) is sterker dan safe-haven (${safeAvg > 0 ? '+' : ''}${safeAvg.toFixed(1)}) → kapitaal zoekt rendement → Risk-On.`}
                            {data.regime === 'USD Dominant' && `USD score is hoog door hawkish Fed-beleid. Dit trekt kapitaal naar de dollar, ongeacht het bredere sentiment.`}
                            {data.regime === 'USD Zwak' && `USD score is laag door dovish verwachtingen. Kapitaal stroomt weg van de dollar naar sterkere alternatieven.`}
                            {data.regime === 'Gemengd' && `Geen duidelijk verschil tussen safe-haven en high-yield scores. De markt heeft geen dominant thema — focus op individuele paar-divergenties.`}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </details>

                {/* Regime methodology */}
                <details className="mt-2 group">
                  <summary className="flex items-center gap-2 text-xs text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Hoe wordt het regime bepaald?
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <p className="text-xs text-text-dim leading-relaxed">{data.regimeMethodology}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-accent-glow/10 border border-accent-dim/20">
                      <p className="text-xs text-text-dim leading-relaxed">
                        <strong className="text-accent-light">High-yield vs safe-haven:</strong>{' '}
                        <em>High-yield</em> valuta&apos;s (AUD, NZD, CAD) hebben hogere rentes en trekken kapitaal aan in goede tijden (Risk-On).{' '}
                        <em>Safe-haven</em> valuta&apos;s (JPY, CHF, USD) worden sterker in onzekere tijden (Risk-Off).
                      </p>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </section>

          {/* Bridge: Regime → Intermarket */}
          <StepBridge
            icon="down"
            text={`Het regime is ${data.regime} — klopt dit met wat de markten laten zien? De intermarket signalen hieronder bevestigen of weerleggen dit.`}
          />

          {/* ════════════════════════════════════════════════════════
              STAP 2: INTERMARKET SIGNALEN — Bevestiging
              ════════════════════════════════════════════════════════ */}
          <section className="mb-2">
            <StepHeader
              step={2}
              title="Intermarket Signalen"
              subtitle="Bevestigen de markten het regime? Aandelen, yields, VIX en goud vertellen het verhaal."
            />

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

            {/* Intermarket conclusion with regime link */}
            {intermarketConclusion && (
              <div className={`p-4 rounded-xl border ${
                intermarketConclusion.sentiment === 'risk-off' ? 'bg-red-500/[0.06] border-red-500/20' :
                intermarketConclusion.sentiment === 'risk-on' ? 'bg-green-500/[0.06] border-green-500/20' :
                'bg-white/[0.03] border-border'
              }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Conclusie</p>
                  {intermarketConclusion.confirmsRegime ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 font-medium">
                      Bevestigt {data.regime}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium">
                      Conflicteert met regime
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-muted leading-relaxed">{intermarketConclusion.text}</p>
              </div>
            )}

            <details className="mt-3 group">
              <summary className="flex items-center gap-2 text-[11px] text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Per signaal uitleg bekijken
              </summary>
              <div className="mt-3 space-y-3">
                {data.intermarketSignals?.map(signal => {
                  const isUp = signal.direction === 'up'
                  const isDown = signal.direction === 'down'
                  return (
                    <div key={signal.key} className="rounded-xl bg-white/[0.02] border border-border/50 overflow-hidden">
                      <div className="px-4 py-2.5 bg-white/[0.02] border-b border-border/30 flex items-center justify-between">
                        <p className="text-sm font-semibold text-heading">{signal.name}</p>
                        <div className="flex items-center gap-2">
                          {signal.current !== null && (
                            <span className="text-xs font-mono text-text-muted">
                              {signal.unit === '$' ? '$' : ''}{signal.current}{signal.unit === '%' ? '%' : ''}
                            </span>
                          )}
                          <span className={`text-xs font-mono font-semibold ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-text-dim'}`}>
                            {isUp ? '▲' : isDown ? '▼' : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        {signal.howToRead.split('\n\n').map((paragraph, pi) => (
                          <p key={pi} className="text-[11px] text-text-dim leading-relaxed">
                            {paragraph}
                          </p>
                        ))}
                        <div className="mt-2 p-2.5 rounded-lg bg-accent-glow/10 border border-accent-dim/20">
                          <p className="text-[11px] text-text-dim leading-relaxed">
                            <strong className="text-accent-light">Regime impact:</strong> {signal.regimeImpact}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </details>

            {/* Currency Strength mini-bar */}
            {data.currencyRanking && data.currencyRanking.length > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-bg-card border border-border">
                <p className="text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-3">Valuta Sterkte — van sterk naar zwak</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {data.currencyRanking.map((ccy, i) => {
                    const isStrong = ccy.score > 1
                    const isWeak = ccy.score < -1
                    return (
                      <div
                        key={ccy.currency}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
                          isStrong ? 'bg-green-500/[0.08] border-green-500/20 text-green-400' :
                          isWeak ? 'bg-red-500/[0.08] border-red-500/20 text-red-400' :
                          'bg-white/[0.03] border-border text-text-dim'
                        }`}
                      >
                        <span className="font-bold text-heading text-[11px]">{i + 1}.</span>
                        <span className="font-semibold">{ccy.currency}</span>
                        <span className="font-mono text-[10px]">
                          {ccy.score > 0 ? '+' : ''}{ccy.score.toFixed(1)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <details className="mt-2 group">
                  <summary className="flex items-center gap-2 text-[10px] text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Hoe wordt de score berekend?
                  </summary>
                  <p className="mt-2 text-[10px] text-text-dim leading-relaxed">
                    De score is gebaseerd op centraal bank beleid: hawkish bias = hogere score (sterke valuta), dovish = lagere score (zwakke valuta).
                    Renteverschil t.o.v. het target telt ook mee. De sterkste tegenover de zwakste geeft de beste trade setups.
                  </p>
                </details>
              </div>
            )}
          </section>

          {/* Bridge: Intermarket → Trade Focus */}
          <StepBridge
            icon={intermarketConclusion?.confirmsRegime ? 'check' : 'arrow'}
            text={
              intermarketConclusion?.confirmsRegime
                ? `Intermarket bevestigt het ${data.regime} regime. We zoeken nu de sterkste valuta-divergenties die hierbij passen.`
                : `Intermarket geeft gemengde signalen. We focussen op de paren met de sterkste fundamentele divergentie, maar wees selectiever met entries.`
            }
          />

          {/* ════════════════════════════════════════════════════════
              STAP 3: TRADE FOCUS — De concrete output
              ════════════════════════════════════════════════════════ */}
          {tradeFocus.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center justify-between">
                <StepHeader
                  step={3}
                  title="Trade Focus"
                  subtitle="De sterkste divergenties vertaald naar concrete paren. Zoek hier je structure breaks."
                />
                {/* Track record link */}
                <button
                  onClick={() => setShowTrackRecord(!showTrackRecord)}
                  className="flex items-center gap-1.5 text-xs text-accent-light/70 hover:text-accent-light transition-colors shrink-0"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  Trackrecord
                  {trackStats.total > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      trackStats.winRate >= 60 ? 'bg-green-500/15 text-green-400' :
                      trackStats.winRate >= 40 ? 'bg-amber-500/15 text-amber-400' :
                      'bg-red-500/15 text-red-400'
                    }`}>
                      {trackStats.winRate}%
                    </span>
                  )}
                </button>
              </div>

              {/* ── Trackrecord Panel ── */}
              {showTrackRecord && (
                <div className="mb-5 rounded-xl border border-accent/20 overflow-hidden">
                  <div className="px-5 py-3 bg-gradient-to-r from-accent/10 to-accent/5 border-b border-accent/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-text-dim uppercase tracking-wider">Trade Focus Trackrecord</p>
                        <p className="text-[10px] text-text-dim mt-0.5">Laatste 30 dagen — gemeten vanaf NY sessie opening (14:00 CET)</p>
                      </div>
                      {trackStats.total > 0 && (
                        <div className="text-right">
                          <p className={`text-2xl font-display font-bold ${
                            trackStats.winRate >= 60 ? 'text-green-400' :
                            trackStats.winRate >= 40 ? 'text-amber-400' : 'text-red-400'
                          }`}>{trackStats.winRate}%</p>
                          <p className="text-[10px] text-text-dim">win rate</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-5 py-4 bg-bg-card">
                    {trackStats.total === 0 && trackStats.pending === 0 ? (
                      <p className="text-xs text-text-dim text-center py-2">
                        Nog geen trackrecord beschikbaar. Data wordt dagelijks opgebouwd.
                      </p>
                    ) : (
                      <>
                        {/* Stats row */}
                        <div className="grid grid-cols-4 gap-3 mb-4">
                          <div className="text-center">
                            <p className="text-lg font-mono font-bold text-heading">{trackStats.total}</p>
                            <p className="text-[10px] text-text-dim">Totaal</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-mono font-bold text-green-400">{trackStats.correct}</p>
                            <p className="text-[10px] text-text-dim">Correct</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-mono font-bold text-red-400">{trackStats.incorrect}</p>
                            <p className="text-[10px] text-text-dim">Incorrect</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-mono font-bold text-amber-400">{trackStats.pending}</p>
                            <p className="text-[10px] text-text-dim">Pending</p>
                          </div>
                        </div>

                        {/* Win rate bar */}
                        {trackStats.total > 0 && (
                          <div className="mb-4">
                            <div className="h-3 rounded-full bg-white/5 overflow-hidden flex">
                              <div
                                className="h-full bg-green-500/60 transition-all duration-500"
                                style={{ width: `${trackStats.winRate}%` }}
                              />
                              <div
                                className="h-full bg-red-500/60 transition-all duration-500"
                                style={{ width: `${100 - trackStats.winRate}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Correct trades */}
                        {trackRecords.filter(r => r.result === 'correct').length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                              Correct ({trackRecords.filter(r => r.result === 'correct').length})
                            </p>
                            <div className="space-y-1">
                              {trackRecords.filter(r => r.result === 'correct').slice(0, 5).map(record => (
                                <div key={record.id} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-green-500/[0.04] border border-green-500/10 text-xs">
                                  <span className="text-text-dim font-mono w-16 shrink-0">{record.date}</span>
                                  <span className="font-bold text-heading w-16 shrink-0">{record.pair}</span>
                                  <span className={record.direction.includes('bullish') ? 'text-green-400' : 'text-red-400'}>
                                    {record.direction.includes('bullish') ? '↑ LONG' : '↓ SHORT'}
                                  </span>
                                  <span className="ml-auto font-mono text-green-400 font-semibold">
                                    {record.pips_moved != null ? `+${Math.abs(record.pips_moved)} pips` : '✓'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Incorrect trades */}
                        {trackRecords.filter(r => r.result === 'incorrect').length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              Incorrect ({trackRecords.filter(r => r.result === 'incorrect').length})
                            </p>
                            <div className="space-y-1">
                              {trackRecords.filter(r => r.result === 'incorrect').slice(0, 5).map(record => (
                                <div key={record.id} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-red-500/[0.04] border border-red-500/10 text-xs">
                                  <span className="text-text-dim font-mono w-16 shrink-0">{record.date}</span>
                                  <span className="font-bold text-heading w-16 shrink-0">{record.pair}</span>
                                  <span className={record.direction.includes('bullish') ? 'text-green-400' : 'text-red-400'}>
                                    {record.direction.includes('bullish') ? '↑ LONG' : '↓ SHORT'}
                                  </span>
                                  <span className="ml-auto font-mono text-red-400 font-semibold">
                                    {record.pips_moved != null ? `${record.pips_moved} pips` : '✗'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pending trades */}
                        {trackRecords.filter(r => r.result === 'pending').length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Pending ({trackRecords.filter(r => r.result === 'pending').length})
                            </p>
                            <div className="space-y-1">
                              {trackRecords.filter(r => r.result === 'pending').slice(0, 5).map(record => (
                                <div key={record.id} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-amber-500/[0.04] border border-amber-500/10 text-xs">
                                  <span className="text-text-dim font-mono w-16 shrink-0">{record.date}</span>
                                  <span className="font-bold text-heading w-16 shrink-0">{record.pair}</span>
                                  <span className={record.direction.includes('bullish') ? 'text-green-400' : 'text-red-400'}>
                                    {record.direction.includes('bullish') ? '↑ LONG' : '↓ SHORT'}
                                  </span>
                                  <span className="ml-auto font-mono text-amber-400">afwachten...</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex items-center justify-between mt-3 gap-3">
                      <p className="text-[10px] text-text-dim leading-relaxed">
                        Meting: daily close → daily close. Meet of de fundamentele bias klopte op dagbasis — niet je entry of structure break.
                      </p>
                      <button
                        onClick={backfillTrackRecord}
                        disabled={backfilling}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/20 text-[10px] text-accent-light/70 hover:text-accent-light hover:border-accent/40 transition-colors disabled:opacity-50"
                      >
                        {backfilling ? (
                          <span className="inline-block w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" />
                            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                          </svg>
                        )}
                        {backfilling ? 'Laden...' : 'Backfill 14d'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {tradeFocus.map(tf => {
                  const isExpanded = expandedPairs.has(tf.pair)
                  return (
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
                        <p className="text-xs text-text-dim mb-3">{tf.why}</p>

                        {tf.eventWarning && (
                          <div className="p-2.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 mb-3">
                            <p className="text-xs text-amber-400/90">⚠ {tf.eventWarning}</p>
                          </div>
                        )}

                        {/* Collapsible fundamental explanation */}
                        {tf.explanation && tf.explanation.length > 0 && (
                          <button
                            onClick={() => togglePairExpanded(tf.pair)}
                            className="flex items-center gap-2 text-[11px] text-accent-light/60 hover:text-accent-light transition-colors w-full text-left"
                          >
                            <svg
                              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                            Waarom {tf.isBullish ? 'bullish' : tf.isBearish ? 'bearish' : 'neutraal'}? — fundamentele onderbouwing
                          </button>
                        )}

                        {isExpanded && tf.explanation && tf.explanation.length > 0 && (
                          <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1.5">
                            {tf.explanation.map((line: string, i: number) => (
                              <p key={i} className="text-[11px] text-text-dim leading-relaxed">
                                {line}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* How to use box */}
              <div className="mt-4 p-4 rounded-xl bg-accent-glow/5 border border-accent-dim/20">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-heading mb-1">Hoe gebruik je dit?</p>
                    <p className="text-[11px] text-text-dim leading-relaxed">
                      <strong className="text-text-muted">Stap 1:</strong> Het regime en intermarket geven je de context.{' '}
                      <strong className="text-text-muted">Stap 2:</strong> De Trade Focus geeft je de richting.{' '}
                      <strong className="text-text-muted">Stap 3:</strong> Open je 15min chart, zoek 2 structure breaks in de richting van de bias.
                      Als er high-impact events zijn, wacht de release af of trade met kleiner risico.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ════════════════════════════════════════════════════════
              4. TODAY'S EVENTS (collapsed by default)
              ════════════════════════════════════════════════════════ */}
          <section className="mb-8">
            <details className="group">
              <summary className="text-lg font-display font-semibold text-heading mb-2 cursor-pointer hover:text-accent-light transition-colors flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light transition-transform group-open:rotate-90 shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Vandaag &amp; Morgen — High Impact
                <span className="text-[10px] font-normal text-text-dim bg-white/5 px-2 py-0.5 rounded ml-1">
                  {data.todayEvents.length} events
                </span>
              </summary>
              <div className="mt-3">
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
              </div>
            </details>
          </section>

          {/* ════════════════════════════════════════════════════════
              5. PAIR BIAS TABLE (collapsed by default)
              ════════════════════════════════════════════════════════ */}
          <section className="mb-8">
            <details className="group">
              <summary className="text-lg font-display font-semibold text-heading mb-2 cursor-pointer hover:text-accent-light transition-colors flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light transition-transform group-open:rotate-90 shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Alle Pair Biases
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
                      <div className="flex gap-2 mb-2">
                        <BiasTag bias={pair.baseBias} />
                        <span className="text-text-dim text-xs">vs</span>
                        <BiasTag bias={pair.quoteBias} />
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
