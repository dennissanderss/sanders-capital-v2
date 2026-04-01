'use client'

import { useState, useEffect } from 'react'

// ─── Types ──────────────────────────────────────────────────
interface CurrencyRank {
  currency: string
  score: number
  baseScore: number
  newsBonus: number
  reasons: string[]
  newsHeadlines: string[]
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
  scoreWithoutNews: number
  newsInfluence: number
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
  regimeImpact: string
  current: number | null
  change: number | null
  changePct: number | null
  direction: 'up' | 'down' | 'flat'
}

interface NewsItem {
  id: string
  title: string
  titleEn: string
  source: string
  category: string
  publishedAt: string
  relevanceScore: number
  affectedCurrencies: string[]
  relevanceContext: string
  url: string
}

interface NewsSentiment {
  score: number
  headlines: string[]
  sentiment: string
}

interface BriefingV2Data {
  version: string
  regime: string
  regimeExplain: string
  regimeColor: string
  regimeMethodology: string
  confidence: number
  intermarketSignals: IntermarketSignal[]
  currencyRanking: CurrencyRank[]
  pairBiases: PairBias[]
  todayEvents: TodayEvent[]
  weekEvents: { title: string; currency: string; date: string; impact: string; forecast: string; previous: string }[]
  topNews: NewsItem[]
  newsSentiment: Record<string, NewsSentiment>
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
  startDate: string | null
}

// ─── Helpers ────────────────────────────────────────────────
function flagEmoji(code: string) {
  if (!code || code.length !== 2) return ''
  return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('')
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}u`
  return `${Math.floor(hours / 24)}d`
}

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
  if (gold?.direction === 'up') riskOffSignals.push('Goud stijgt')
  if (gold?.direction === 'down') riskOnSignals.push('Goud daalt')
  if (yields?.direction === 'up') riskOffSignals.push('Yields stijgen')
  if (yields?.direction === 'down') riskOnSignals.push('Yields dalen')

  const isRiskOff = riskOffSignals.length >= 3
  const isRiskOn = riskOnSignals.length >= 3

  const confirmsRegime =
    (regime === 'Risk-Off' && isRiskOff) ||
    (regime === 'Risk-On' && isRiskOn) ||
    (regime === 'USD Dominant' && (yields?.direction === 'up' || riskOffSignals.length >= 2)) ||
    (regime === 'USD Zwak' && (yields?.direction === 'down' || riskOnSignals.length >= 2))

  if (isRiskOff) {
    return { sentiment: 'risk-off', confirmsRegime, text: `Risk-Off: ${riskOffSignals.join(', ')}.` }
  }
  if (isRiskOn) {
    return { sentiment: 'risk-on', confirmsRegime, text: `Risk-On: ${riskOnSignals.join(', ')}.` }
  }

  return { sentiment: 'mixed', confirmsRegime: false, text: `Gemengd: ${[...riskOnSignals, ...riskOffSignals].join(', ')}.` }
}

function getTradeFocus(pairs: PairBias[], events: TodayEvent[], ranking: CurrencyRank[]) {
  const strong = pairs.filter(p => p.conviction === 'sterk' || p.conviction === 'matig')
  return strong.slice(0, 3).map(pair => {
    const isBullish = pair.direction.includes('bullish')
    const isBearish = pair.direction.includes('bearish')
    const pairEvents = events.filter(e => e.currency === pair.base || e.currency === pair.quote)
    const baseRank = ranking.find(r => r.currency === pair.base)
    const quoteRank = ranking.find(r => r.currency === pair.quote)

    let action = ''
    if (isBullish) action = `LONG ${pair.pair}: ${pair.base} fundamenteel sterker dan ${pair.quote}.`
    else if (isBearish) action = `SHORT ${pair.pair}: ${pair.quote} fundamenteel sterker dan ${pair.base}.`
    else action = 'Neutraal, wacht op duidelijkere divergentie.'

    const explanationParts: string[] = []
    if (isBullish || isBearish) {
      const strongCcy = isBullish ? pair.base : pair.quote
      const weakCcy = isBullish ? pair.quote : pair.base
      const strongRank = isBullish ? baseRank : quoteRank
      const weakRank = isBullish ? quoteRank : baseRank

      if (strongRank && weakRank) {
        explanationParts.push(`Score: ${strongCcy} = ${strongRank.score > 0 ? '+' : ''}${strongRank.score.toFixed(1)} vs ${weakCcy} = ${weakRank.score > 0 ? '+' : ''}${weakRank.score.toFixed(1)}`)
      }
      if (strongRank?.bias) explanationParts.push(`${strongCcy}: ${strongRank.bias}`)
      if (weakRank?.bias) explanationParts.push(`${weakCcy}: ${weakRank.bias}`)
      if (pair.rateDiff !== null && pair.rateDiff !== 0) {
        explanationParts.push(`Renteverschil: ${pair.rateDiff > 0 ? '+' : ''}${pair.rateDiff}%`)
      }
      if (pair.newsInfluence !== 0) {
        explanationParts.push(`Nieuws effect: ${pair.newsInfluence > 0 ? '+' : ''}${pair.newsInfluence} punt`)
      }
    }

    return {
      pair: pair.pair, direction: pair.direction, conviction: pair.conviction,
      score: pair.score, scoreWithoutNews: pair.scoreWithoutNews, newsInfluence: pair.newsInfluence, action, explanation: explanationParts,
      eventWarning: pairEvents.length > 0 ? `${pairEvents.map(e => `${e.title} (${e.time})`).join(', ')}` : '',
      isBullish, isBearish,
    }
  })
}

const MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']

// ─── Step Header Component ─────────────────────────────────
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

// ─── Step Bridge Component ──────────────────────────────────
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

// ─── Confidence Ring Component ──────────────────────────────
function ConfidenceRing({ value, size = 64 }: { value: number; size?: number }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const color = value >= 70 ? '#22c55e' : value >= 45 ? '#eab308' : '#ef4444'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-mono font-bold text-heading">{value}%</span>
      </div>
    </div>
  )
}

// ─── Signal Pill Component ──────────────────────────────────
function SignalPill({ direction, label, value, unit, changePct }: {
  direction: string; label: string; value: number | null; unit: string; changePct: number | null
}) {
  const isUp = direction === 'up'
  const isDown = direction === 'down'
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all group">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        isUp ? 'bg-green-500/10 text-green-400' : isDown ? 'bg-red-500/10 text-red-400' : 'bg-white/[0.04] text-text-dim'
      }`}>
        {isUp ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
        ) : isDown ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-text-dim uppercase tracking-wider">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-mono font-bold text-heading">
            {value !== null ? `${unit === '$' ? '$' : ''}${value}${unit === '%' ? '%' : ''}` : 'N/A'}
          </span>
          {changePct !== null && (
            <span className={`text-xs font-mono ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-text-dim'}`}>
              {changePct > 0 ? '+' : ''}{changePct}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────
export default function BriefingV2Dashboard() {
  const [data, setData] = useState<BriefingV2Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trackRecords, setTrackRecords] = useState<TrackRecord[]>([])
  const [trackStats, setTrackStats] = useState<TrackStats>({ total: 0, correct: 0, incorrect: 0, pending: 0, winRate: 0, startDate: null })
  const [showTrackRecord, setShowTrackRecord] = useState(false)
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set())

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/briefing-v2')
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
      setTrackStats(json.stats || { total: 0, correct: 0, incorrect: 0, pending: 0, winRate: 0, startDate: null })
    } catch { /* table might not exist */ }
  }

  useEffect(() => {
    fetchData()
    fetchTrackRecord()
  }, [])

  // Auto-save track record daily
  useEffect(() => {
    if (data && !loading) {
      const lastSave = localStorage.getItem('track_last_save_v2')
      const today = new Date().toISOString().split('T')[0]
      if (lastSave !== today) {
        fetch('/api/trackrecord', { method: 'POST' }).then(() => fetchTrackRecord())
        localStorage.setItem('track_last_save_v2', today)
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

  const intermarketConclusion = data?.intermarketSignals ? getIntermarketConclusion(data.intermarketSignals, data.regime) : null
  const tradeFocus = data ? getTradeFocus(data.pairBiases, data.todayEvents, data.currencyRanking) : []

  const regimeColors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/25', glow: 'shadow-red-500/10' },
    green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/25', glow: 'shadow-green-500/10' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/25', glow: 'shadow-blue-500/10' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25', glow: 'shadow-amber-500/10' },
    gray: { bg: 'bg-white/[0.04]', text: 'text-text-muted', border: 'border-white/[0.08]', glow: '' },
  }

  const rc = regimeColors[data?.regimeColor || 'gray']

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* ── Test Banner ── */}
      <div className="mb-6 px-4 py-2.5 rounded-lg bg-amber-500/[0.08] border border-amber-500/20 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p className="text-xs text-amber-300">
          <strong>TEST OMGEVING</strong> - Enhanced Daily Macro Briefing v2 met nieuws-integratie. Niet live, alleen voor evaluatie.
        </p>
      </div>

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-accent-light/60 mb-2 font-medium">V2 Enhanced</p>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-heading mb-1">
              Daily Macro Briefing
            </h1>
            <p className="text-sm text-text-muted max-w-xl">
              Stapsgewijze analyse: macro regime, nieuws sentiment, intermarket bevestiging en concrete trade focus.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <div className="flex items-center gap-2 text-xs text-text-dim">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span>{new Date(data.generatedAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
            <button onClick={fetchData} disabled={loading} className="p-2 rounded-lg border border-border hover:border-border-light text-text-muted hover:text-heading transition-all disabled:opacity-50">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={loading ? 'animate-spin' : ''}>
                <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <p className="text-sm text-text-muted">Analyse laden...</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-500/25 bg-red-500/[0.06] text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={fetchData} className="mt-2 text-xs text-red-400/60 hover:text-red-400">Opnieuw</button>
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── High Impact Events Banner ── */}
          {data.todayEvents.length > 0 && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/[0.04] overflow-hidden">
              <div className="px-4 py-2 border-b border-red-500/10 flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-400">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider">High Impact Events Vandaag</span>
              </div>
              <div className="px-4 py-2.5 flex flex-wrap gap-x-6 gap-y-1.5">
                {data.todayEvents.map((evt, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <span className="text-sm leading-none">{flagEmoji(evt.flag)}</span>
                    <span className="font-mono font-bold text-heading">{evt.time}</span>
                    <span className="text-text-muted">{evt.title}</span>
                    {evt.forecast && <span className="text-text-dim">({evt.forecast})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              STAP 1: MACRO REGIME
              ════════════════════════════════════════════════════════ */}
          <section className="mb-2">
            <StepHeader
              step={1}
              title="Macro Regime"
              subtitle="Wat is het huidige marktklimaat? Gebaseerd op centraal bank beleid."
            />

            <div className={`rounded-2xl border ${rc.border} ${rc.bg} overflow-hidden shadow-lg ${rc.glow}`}>
              {/* Regime header */}
              <div className="px-5 sm:px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full animate-pulse ${
                      data.regime === 'Risk-Off' ? 'bg-red-500' :
                      data.regime === 'Risk-On' ? 'bg-green-500' :
                      data.regime === 'USD Dominant' ? 'bg-blue-500' :
                      data.regime === 'USD Zwak' ? 'bg-amber-500' : 'bg-gray-500'
                    }`} />
                    <h2 className={`text-2xl font-display font-bold ${rc.text}`}>{data.regime}</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <ConfidenceRing value={data.confidence} size={52} />
                    <div className="text-right">
                      <p className="text-[10px] text-text-dim uppercase tracking-wider">Confidence</p>
                      <p className="text-xs text-text-muted">
                        {data.confidence >= 70 ? 'Sterke consensus' : data.confidence >= 45 ? 'Gemengde signalen' : 'Zwakke consensus'}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-text-muted leading-relaxed mt-3">{data.regimeExplain}</p>
              </div>

              {/* Currency Strength Ranking */}
              {data.currencyRanking && data.currencyRanking.length > 0 && (
                <div className="px-5 sm:px-6 py-4 border-t border-white/[0.06]">
                  <p className="text-[10px] font-semibold text-text-dim uppercase tracking-wider mb-3">Valuta Sterkte: van sterk naar zwak</p>
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
                </div>
              )}

              {/* Expandable: Waarom dit regime? */}
              <div className="px-5 sm:px-6 pb-4">
                <details className="group">
                  <summary className="flex items-center gap-2 text-xs text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Waarom {data.regime}? De cijfers erachter
                  </summary>
                  <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] space-y-3">
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
                                    <span className="text-[10px] text-text-dim">{c.bias || '\u2014'}</span>
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
                                    <span className="text-[10px] text-text-dim">{c.bias || '\u2014'}</span>
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
                            {data.regime === 'Risk-Off' && `Safe-haven gemiddeld (${safeAvg > 0 ? '+' : ''}${safeAvg.toFixed(1)}) is sterker dan high-yield (${highAvg > 0 ? '+' : ''}${highAvg.toFixed(1)}) \u2192 kapitaal stroomt naar veilige havens \u2192 Risk-Off.`}
                            {data.regime === 'Risk-On' && `High-yield gemiddeld (${highAvg > 0 ? '+' : ''}${highAvg.toFixed(1)}) is sterker dan safe-haven (${safeAvg > 0 ? '+' : ''}${safeAvg.toFixed(1)}) \u2192 kapitaal zoekt rendement \u2192 Risk-On.`}
                            {data.regime === 'USD Dominant' && `USD score is hoog door hawkish Fed-beleid. Dit trekt kapitaal naar de dollar, ongeacht het bredere sentiment.`}
                            {data.regime === 'USD Zwak' && `USD score is laag door dovish verwachtingen. Kapitaal stroomt weg van de dollar naar sterkere alternatieven.`}
                            {data.regime === 'Gemengd' && `Geen duidelijk verschil tussen safe-haven en high-yield scores. De markt heeft geen dominant thema, focus op individuele paar-divergenties.`}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </details>

                {/* Expandable: Methodology */}
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
                        <strong className="text-accent-light">Databron:</strong> Centraal bank persconferenties, policy statements en forward guidance.
                        Score per valuta op basis van hawkish/dovish bias en rentetarieven. Data uit{' '}
                        <a href="/tools/rente" className="text-accent-light underline underline-offset-2 hover:text-accent-light/80">Tools &gt; Rentetarieven</a>.
                      </p>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </section>

          {/* Bridge: Regime → Nieuws */}
          <StepBridge
            icon="down"
            text={`Het regime is ${data.regime}. Laten we nu kijken wat het recente nieuws zegt over elke valuta...`}
          />

          {/* ════════════════════════════════════════════════════════
              STAP 2: NIEUWS SENTIMENT (NIEUW in v2)
              ════════════════════════════════════════════════════════ */}
          <section className="mb-2">
            <StepHeader
              step={2}
              title="Nieuws Sentiment"
              subtitle="NIEUW in v2 - Wat vertelt recent nieuws ons over elke valuta?"
            />

            <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
              {/* Sentiment Grid */}
              <div className="px-5 sm:px-6 py-4">
                <div className="flex items-center gap-2 mb-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-medium">Sentiment per Valuta</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent-light border border-accent/20 font-bold">NIEUW</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {MAJORS.map(ccy => {
                    const s = data.newsSentiment?.[ccy]
                    const score = s?.score || 0
                    return (
                      <div key={ccy} className={`text-center p-2.5 rounded-xl border transition-all ${
                        score > 0 ? 'bg-green-500/[0.06] border-green-500/15' :
                        score < 0 ? 'bg-red-500/[0.06] border-red-500/15' :
                        'bg-white/[0.02] border-white/[0.06]'
                      }`}>
                        <p className="text-xs font-bold text-heading mb-1">{ccy}</p>
                        <p className={`text-sm font-mono font-bold ${score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                          {score > 0 ? '+' : ''}{score}
                        </p>
                        <p className="text-[9px] text-text-dim mt-0.5">{s?.sentiment || 'neutraal'}</p>
                      </div>
                    )
                  })}
                </div>

                {/* News boosted / penalized currencies */}
                {(() => {
                  const boosted = data.currencyRanking.filter(c => c.newsBonus > 0).sort((a, b) => b.newsBonus - a.newsBonus)
                  const penalized = data.currencyRanking.filter(c => c.newsBonus < 0).sort((a, b) => a.newsBonus - b.newsBonus)
                  if (boosted.length === 0 && penalized.length === 0) return null
                  return (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {boosted.map(c => (
                        <span key={c.currency} className="text-[10px] px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/15 text-green-400 font-medium">
                          {c.currency} +{c.newsBonus} door nieuws
                        </span>
                      ))}
                      {penalized.map(c => (
                        <span key={c.currency} className="text-[10px] px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/15 text-red-400 font-medium">
                          {c.currency} {c.newsBonus} door nieuws
                        </span>
                      ))}
                    </div>
                  )
                })()}
              </div>

              {/* Top News Headlines */}
              {data.topNews.length > 0 && (
                <div className="border-t border-white/[0.04]">
                  <div className="px-5 sm:px-6 py-3 border-b border-white/[0.04]">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-medium">Belangrijkste Headlines</p>
                  </div>
                  <div className="divide-y divide-white/[0.03]">
                    {data.topNews.slice(0, 8).map(article => (
                      <a
                        key={article.id}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-5 sm:px-6 py-3 hover:bg-white/[0.02] transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-text-dim font-medium">{article.source}</span>
                              {article.affectedCurrencies.slice(0, 3).map(c => (
                                <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent-light font-mono font-bold">{c}</span>
                              ))}
                              {article.relevanceScore >= 5 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-bold">HIGH</span>
                              )}
                            </div>
                            <p className="text-sm text-heading group-hover:text-accent-light transition-colors leading-snug">
                              {article.title}
                            </p>
                            {article.relevanceContext && (
                              <p className="text-[10px] text-accent-light/60 mt-1">{article.relevanceContext}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-text-dim shrink-0">{timeAgo(article.publishedAt)}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Expandable: News methodology */}
              <div className="px-5 sm:px-6 py-4 border-t border-white/[0.04]">
                <details className="group">
                  <summary className="flex items-center gap-2 text-xs text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Hoe wordt nieuws geanalyseerd?
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <p className="text-xs text-text-dim leading-relaxed">
                        Nieuwsartikelen uit 7 bronnen worden geanalyseerd op bullish/bearish keywords per valuta.
                        Elk artikel krijgt een relevantie-score en wordt gekoppeld aan de valuta&apos;s die het betreft.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                        <p className="text-[10px] text-accent-light font-semibold mb-1">Keyword Analyse</p>
                        <p className="text-[10px] text-text-dim leading-relaxed">
                          Artikelen worden gescand op bullish keywords (rate hike, hawkish, strong growth) en bearish keywords (rate cut, dovish, recession risk) per valuta.
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                        <p className="text-[10px] text-accent-light font-semibold mb-1">Recentheid Weging</p>
                        <p className="text-[10px] text-text-dim leading-relaxed">
                          Recent nieuws weegt zwaarder: &lt;12u = 1.5x, 12-24u = 1.2x, 24-48u = 1.0x, ouder = 0.7x. Zo telt vers nieuws het meest mee.
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                        <p className="text-[10px] text-accent-light font-semibold mb-1">Begrenzing +-1.5</p>
                        <p className="text-[10px] text-text-dim leading-relaxed">
                          Het nieuws-effect is gemaximeerd op +-1.5 punten. De fundamentele CB-analyse blijft altijd de basis, nieuws is een aanvullend signaal.
                        </p>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-accent-glow/10 border border-accent-dim/20">
                      <p className="text-[10px] text-text-dim leading-relaxed">
                        <strong className="text-accent-light">Databronnen:</strong> Reuters, Bloomberg, FXStreet, ForexLive, Investing.com, DailyFX, Central Banking. Artikelen worden automatisch elke 2 uur opgehaald.
                      </p>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </section>

          {/* Bridge: Nieuws → Intermarket */}
          <StepBridge
            icon="down"
            text={`Nieuws sentiment is verwerkt. Laten we nu checken of de intermarket signalen het regime bevestigen...`}
          />

          {/* ════════════════════════════════════════════════════════
              STAP 3: INTERMARKET SIGNALEN
              ════════════════════════════════════════════════════════ */}
          <section className="mb-2">
            <StepHeader
              step={3}
              title="Intermarket Signalen"
              subtitle="Bevestigen aandelen, yields, VIX en goud het regime?"
            />

            <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
              <div className="px-5 sm:px-6 py-4">
                {/* Signal Pills Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
                  {data.intermarketSignals.map(signal => (
                    <SignalPill
                      key={signal.key}
                      direction={signal.direction}
                      label={signal.name}
                      value={signal.current}
                      unit={signal.unit}
                      changePct={signal.changePct}
                    />
                  ))}
                </div>

                {/* Conclusion + Confidence Ring */}
                {intermarketConclusion && (
                  <div className={`p-4 rounded-xl border ${
                    intermarketConclusion.sentiment === 'risk-off' ? 'bg-red-500/[0.06] border-red-500/20' :
                    intermarketConclusion.sentiment === 'risk-on' ? 'bg-green-500/[0.06] border-green-500/20' :
                    'bg-white/[0.03] border-border'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
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
                      <div className="ml-4 shrink-0">
                        <ConfidenceRing value={data.confidence} size={56} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Expandable: Per-signal explanation */}
              <div className="px-5 sm:px-6 pb-4">
                <details className="group">
                  <summary className="flex items-center gap-2 text-xs text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Per signaal uitleg bekijken
                  </summary>
                  <div className="mt-3 space-y-2">
                    {data.intermarketSignals.map(signal => {
                      const isUp = signal.direction === 'up'
                      const isDown = signal.direction === 'down'
                      return (
                        <div key={signal.key} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-heading">{signal.name}</span>
                            <div className="flex items-center gap-2">
                              {signal.current !== null && (
                                <span className="text-[10px] font-mono text-text-muted">
                                  {signal.unit === '$' ? '$' : ''}{signal.current}{signal.unit === '%' ? '%' : ''}
                                </span>
                              )}
                              <span className={`text-xs font-mono font-semibold ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-text-dim'}`}>
                                {isUp ? '\u25B2' : isDown ? '\u25BC' : '\u2014'}
                              </span>
                            </div>
                          </div>
                          {signal.context && <p className="text-[10px] text-text-dim leading-relaxed">{signal.context}</p>}
                          <p className="text-[10px] text-accent-light/70 mt-1">
                            <strong>Regime impact:</strong> {signal.regimeImpact}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </details>
              </div>
            </div>
          </section>

          {/* Bridge: Intermarket → Trade Focus */}
          <StepBridge
            icon={intermarketConclusion?.confirmsRegime ? 'check' : 'arrow'}
            text={
              intermarketConclusion?.confirmsRegime
                ? `Intermarket bevestigt het ${data.regime} regime. Alle signalen gecombineerd leiden tot onze trade focus...`
                : `Intermarket geeft gemengde signalen. We focussen op de sterkste fundamentele divergenties, maar wees selectiever.`
            }
          />

          {/* ════════════════════════════════════════════════════════
              STAP 4: TRADE FOCUS
              ════════════════════════════════════════════════════════ */}
          <section className="mb-2">
            <StepHeader
              step={4}
              title="Trade Focus"
              subtitle="De concrete output: top paren met richting, overtuiging en score."
            />

            {tradeFocus.length > 0 ? (
              <div className="space-y-4">
                {tradeFocus.map((trade, i) => (
                  <div key={trade.pair} className="rounded-2xl border border-border bg-bg-card overflow-hidden">
                    {/* Trade header */}
                    <div className={`px-5 py-4 flex items-center justify-between ${
                      trade.isBullish ? 'bg-gradient-to-r from-green-500/[0.06] to-transparent' :
                      trade.isBearish ? 'bg-gradient-to-r from-red-500/[0.06] to-transparent' :
                      'bg-white/[0.02]'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-text-dim bg-white/[0.06] w-6 h-6 rounded-full flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-display font-bold text-heading">{trade.pair}</h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              trade.isBullish ? 'bg-green-500/15 text-green-400 border border-green-500/20' :
                              trade.isBearish ? 'bg-red-500/15 text-red-400 border border-red-500/20' :
                              'bg-white/[0.06] text-text-dim border border-white/[0.08]'
                            }`}>
                              {trade.direction}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              trade.conviction === 'sterk' ? 'bg-white/[0.08] text-heading' :
                              'bg-white/[0.04] text-text-dim'
                            }`}>
                              {trade.conviction}
                            </span>
                          </div>
                          <p className="text-xs text-text-muted mt-0.5">{trade.action}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-mono font-bold ${
                          trade.score > 0 ? 'text-green-400' : trade.score < 0 ? 'text-red-400' : 'text-text-dim'
                        }`}>{trade.score > 0 ? '+' : ''}{trade.score}</p>
                        <p className="text-[9px] text-text-dim">totaal score</p>
                      </div>
                    </div>

                    {/* Score breakdown + warnings */}
                    <div className="px-5 py-3 border-t border-white/[0.04]">
                      {/* Score breakdown: base vs news */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-text-dim uppercase tracking-wider">Basis:</span>
                          <span className="text-xs font-mono font-bold text-text-muted">
                            {trade.scoreWithoutNews > 0 ? '+' : ''}{trade.scoreWithoutNews}
                          </span>
                        </div>
                        {trade.newsInfluence !== 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-text-dim uppercase tracking-wider">Nieuws:</span>
                            <span className={`text-xs font-mono font-bold ${trade.newsInfluence > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {trade.newsInfluence > 0 ? '+' : ''}{trade.newsInfluence}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* News influence badge */}
                      {trade.newsInfluence !== 0 && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-light">
                            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                          </svg>
                          <span className={`text-[10px] font-medium ${trade.newsInfluence > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            Nieuws {trade.newsInfluence > 0 ? 'versterkt' : 'verzwakt'} deze trade met {Math.abs(trade.newsInfluence)} punt
                          </span>
                        </div>
                      )}

                      {/* Event warning */}
                      {trade.eventWarning && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                          <span className="text-[10px] text-amber-300">Let op: {trade.eventWarning}</span>
                        </div>
                      )}

                      {/* Expandable explanation per pair */}
                      <details className="group mt-1" open={expandedPairs.has(trade.pair)} onClick={(e) => { e.preventDefault(); togglePairExpanded(trade.pair) }}>
                        <summary className="flex items-center gap-2 text-[11px] text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${expandedPairs.has(trade.pair) ? 'rotate-90' : ''}`}>
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          Fundamentele onderbouwing
                        </summary>
                        {expandedPairs.has(trade.pair) && (
                          <div className="mt-2 space-y-1.5">
                            {trade.explanation.map((exp, j) => (
                              <div key={j} className="flex items-start gap-1.5 text-[11px] text-text-dim leading-relaxed">
                                <span className="text-accent-light mt-0.5 shrink-0">&gt;</span>
                                <span>{exp}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </details>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 rounded-xl bg-bg-card border border-border text-center">
                <p className="text-sm text-text-muted">Geen sterke divergenties gevonden vandaag. Wacht op duidelijkere fundamentele signalen.</p>
              </div>
            )}

            {/* Full Pair Bias Table */}
            <div className="mt-4 rounded-2xl border border-border bg-bg-card overflow-hidden">
              <details className="group">
                <summary className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-medium">Alle Paren Bekijken (gesorteerd op divergentie)</p>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-dim transition-transform group-open:rotate-180">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <div className="overflow-x-auto border-t border-white/[0.04]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.04]">
                        <th className="px-4 py-2.5 text-left text-text-dim font-medium">Paar</th>
                        <th className="px-4 py-2.5 text-left text-text-dim font-medium">Richting</th>
                        <th className="px-4 py-2.5 text-center text-text-dim font-medium">Score</th>
                        <th className="px-4 py-2.5 text-center text-text-dim font-medium hidden sm:table-cell">Nieuws</th>
                        <th className="px-4 py-2.5 text-center text-text-dim font-medium hidden md:table-cell">Rente</th>
                        <th className="px-4 py-2.5 text-left text-text-dim font-medium">Overtuiging</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pairBiases.map(pair => (
                        <tr key={pair.pair} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-2.5 font-mono font-bold text-heading">{pair.pair}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pair.direction.includes('bullish') ? 'bg-green-500/10 text-green-400' :
                              pair.direction.includes('bearish') ? 'bg-red-500/10 text-red-400' :
                              'bg-white/[0.04] text-text-dim'
                            }`}>
                              {pair.direction}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center font-mono font-bold">
                            <span className={pair.score > 0 ? 'text-green-400' : pair.score < 0 ? 'text-red-400' : 'text-text-dim'}>
                              {pair.score > 0 ? '+' : ''}{pair.score}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center font-mono hidden sm:table-cell">
                            {pair.newsInfluence !== 0 ? (
                              <span className={pair.newsInfluence > 0 ? 'text-green-400' : 'text-red-400'}>
                                {pair.newsInfluence > 0 ? '+' : ''}{pair.newsInfluence}
                              </span>
                            ) : (
                              <span className="text-text-dim">0</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center font-mono hidden md:table-cell">
                            {pair.rateDiff !== null ? (
                              <span className="text-text-muted">{pair.rateDiff > 0 ? '+' : ''}{pair.rateDiff}%</span>
                            ) : (
                              <span className="text-text-dim">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              pair.conviction === 'sterk' ? 'bg-accent/10 text-accent-light font-bold' :
                              pair.conviction === 'matig' ? 'bg-white/[0.06] text-text-muted' :
                              pair.conviction === 'laag' ? 'bg-white/[0.03] text-text-dim' :
                              'text-text-dim'
                            }`}>
                              {pair.conviction}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </section>

          {/* Bridge: Trade Focus → Trackrecord */}
          <StepBridge
            icon="down"
            text="Hoe goed presteert dit model historisch? Bekijk het trackrecord hieronder."
          />

          {/* ════════════════════════════════════════════════════════
              STAP 5: TRACKRECORD
              ════════════════════════════════════════════════════════ */}
          <section className="mb-8">
            <StepHeader
              step={5}
              title="Trackrecord"
              subtitle="Historische prestaties van het model. Hoe accuraat zijn de trade focus suggesties?"
            />

            <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
              <button
                onClick={() => setShowTrackRecord(!showTrackRecord)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-light">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  <span className="text-sm font-semibold text-heading">Trackrecord Bekijken</span>
                  {trackStats.total > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      trackStats.winRate >= 60 ? 'bg-green-500/15 text-green-400' :
                      trackStats.winRate >= 40 ? 'bg-amber-500/15 text-amber-400' :
                      'bg-red-500/15 text-red-400'
                    }`}>
                      {trackStats.winRate}% win rate
                    </span>
                  )}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-text-dim transition-transform ${showTrackRecord ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showTrackRecord && (
                <div className="px-5 pb-5 border-t border-white/[0.04]">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-3 mt-4 mb-4">
                    {[
                      { label: 'Totaal', value: trackStats.total, color: 'text-heading' },
                      { label: 'Correct', value: trackStats.correct, color: 'text-green-400' },
                      { label: 'Incorrect', value: trackStats.incorrect, color: 'text-red-400' },
                      { label: 'Pending', value: trackStats.pending, color: 'text-amber-400' },
                    ].map(stat => (
                      <div key={stat.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                        <p className={`text-xl font-mono font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] text-text-dim">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Historical Records Table */}
                  {trackRecords.length > 0 && (
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                      {trackRecords.slice(0, 20).map(record => (
                        <div key={record.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-text-dim font-mono">{record.date}</span>
                            <span className="font-semibold text-heading">{record.pair}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              record.direction.includes('bullish') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {record.direction.includes('bullish') ? 'LONG' : 'SHORT'}
                            </span>
                            <span className="text-text-dim font-mono">{record.score}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded font-semibold ${
                            record.result === 'correct' ? 'bg-green-500/10 text-green-400' :
                            record.result === 'incorrect' ? 'bg-red-500/10 text-red-400' :
                            'bg-white/[0.06] text-text-dim'
                          }`}>
                            {record.result === 'correct' ? 'Correct' : record.result === 'incorrect' ? 'Incorrect' : 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {trackRecords.length === 0 && (
                    <p className="text-xs text-text-dim text-center py-4">Nog geen trackrecord data beschikbaar. Data wordt automatisch dagelijks opgeslagen.</p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── Methodology Footer ── */}
          <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-medium mb-2">V2 Methode &amp; Databronnen</p>
            <p className="text-xs text-text-dim leading-relaxed">{data.regimeMethodology}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['CB Beleid (basis)', 'Rente vs Target', 'Intermarket Signalen', 'Nieuws Sentiment (v2)', 'Economische Kalender'].map(tag => (
                <span key={tag} className="text-[9px] px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-text-dim">{tag}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
