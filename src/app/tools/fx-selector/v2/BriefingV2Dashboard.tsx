'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

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

interface TrackRecordMetadata {
  source?: string
  version?: string
  scoreWithoutNews?: number
  newsInfluence?: number
  confidence?: number
  newsHeadlines?: string[]
  callTime?: string
  entryTime?: string
  exitTime?: string
  newsSimulated?: boolean
  holdingPeriod?: number
  meanReversion?: boolean
  preMomentum?: number
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
  created_at?: string
  resolved_at?: string
  metadata?: TrackRecordMetadata
}

interface TrackStats {
  total: number
  correct: number
  incorrect: number
  pending: number
  winRate: number
  startDate: string | null
  newsInfluenced?: {
    total: number
    correct: number
    winRate: number
  }
}

// ─── Helpers ────────────────────────────────────────────────
function formatCET(isoStr: string | undefined): string {
  if (!isoStr) return ''
  try {
    return new Date(isoStr).toLocaleString('nl-NL', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Amsterdam',
    }) + ' NL'
  } catch { return '' }
}

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
      baseBias: pair.baseBias,
      quoteBias: pair.quoteBias,
      base: pair.base,
      quote: pair.quote,
      rateDiff: pair.rateDiff,
      baseRank,
      quoteRank,
    }
  })
}

const MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']

const INTERMARKET_HOW_TO_READ: Record<string, { summary: string; detail: string; levels: string; fxImpact: string }> = {
  us10y: {
    summary: 'De rente op 10-jarige Amerikaanse staatsobligaties. Dit is het belangrijkste rentesignaal ter wereld.',
    detail: 'Stijgende yields betekenen dat beleggers hogere vergoeding eisen voor het uitlenen van geld aan de overheid. Dit kan komen door inflatieverwachtingen, hawkish Fed-beleid, of sterk economisch vertrouwen. Dalende yields wijzen op het tegenovergestelde: beleggers vluchten naar de veiligheid van staatsobligaties (risk-off).',
    levels: 'Boven 4.5% = zeer restrictief, drukt aandelen en high-yield valuta\'s. 3.5-4.5% = normaal. Onder 3.5% = accommoderend, ondersteunt risk-on.',
    fxImpact: 'Stijgend → USD sterker (hogere rente trekt kapitaal aan). Dalend → USD zwakker. JPY paren zeer gevoelig: hogere US yields = USD/JPY stijgt.',
  },
  sp500: {
    summary: 'De S&P 500 is de ultieme barometer voor het mondiale risicosentiment.',
    detail: 'De S&P 500 volgt de 500 grootste Amerikaanse bedrijven en wordt wereldwijd als maatstaf gebruikt. Als de S&P stijgt, willen beleggers risico nemen (risk-on). Ze kopen aandelen en high-yield valuta\'s. Als de S&P daalt, vluchten ze naar veilige havens. De correlatie met FX is niet 1:1 maar geeft de richting van het sentiment.',
    levels: 'Dagelijkse beweging >1% = significant. >2% = hoge volatiliteit. De trend (5-daags gemiddelde) is belangrijker dan de dagbeweging.',
    fxImpact: 'Stijgend → AUD, NZD, CAD sterker (carry trades aantrekkelijk). Dalend → JPY, CHF sterker (veilige havens). EUR en GBP reageren minder direct.',
  },
  vix: {
    summary: 'De VIX (Fear Index) meet de verwachte volatiliteit van de S&P 500 over de komende 30 dagen.',
    detail: 'De VIX wordt berekend uit optieprijzen. Een hoge VIX betekent dat beleggers veel betalen voor bescherming tegen koersdalingen — ze zijn bang. Een lage VIX betekent rust. Belangrijk: de VIX is mean-reverting. Na een piek keert hij altijd terug naar gemiddeld niveau. Extremen zijn daarom ook potentiële keerpunten.',
    levels: 'Onder 15 = markt is kalm, risk-on. 15-20 = normaal. 20-25 = verhoogde stress. 25-30 = angst, risk-off. Boven 30 = paniek (zeldzaam, grote kans op snap-back rally).',
    fxImpact: 'VIX stijgt → JPY en CHF sterker, AUD en NZD zwakker. VIX daalt → omgekeerd. VIX boven 25 versterkt het risk-off signaal significant.',
  },
  gold: {
    summary: 'Goud is de oudste veilige haven. Het stijgt bij onzekerheid, inflatie en dalende reële rentes.',
    detail: 'Goud heeft geen rente of dividend, dus het wordt aantrekkelijker als reële rentes (nominale rente minus inflatie) dalen. Bij geopolitieke spanningen en financiële onzekerheid vluchten beleggers naar goud. Goud + dalende aandelen = sterke risk-off bevestiging. Goud + stijgende aandelen = mogelijk inflatiezorgen.',
    levels: 'De absolute prijs is minder belangrijk dan de dagelijkse verandering. Een stijging van >1% op een dag is significant.',
    fxImpact: 'Goud stijgt → vaak JPY en CHF mee sterker (alle veilige havens). Goud daalt → beleggers verlaten veilige havens → AUD (goud-exporteur) kan profiteren.',
  },
  oil: {
    summary: 'Olie (WTI) beïnvloedt specifieke valuta\'s direct via import/export relaties.',
    detail: 'Canada is een grote olie-exporteur: hogere olieprijzen = meer export-inkomsten = sterker CAD. Japan importeert bijna alle olie: hogere olieprijzen = hogere importkosten = zwakker JPY. Indirect: hogere olieprijzen → hogere inflatie → centrale banken worden hawkisher. Dit kan EUR en GBP beïnvloeden.',
    levels: 'Boven $80/vat = bullish voor CAD en inflatoir. $60-80 = normaal. Onder $60 = deflatoir, bearish CAD.',
    fxImpact: 'Stijgend → CAD sterker, JPY zwakker. Dalend → CAD zwakker, JPY minder onder druk. Extreme olieprijzen beïnvloeden het bredere regime.',
  },
  dxy: {
    summary: 'De Dollar Index meet de USD tegen een mandje van 6 valuta\'s (EUR 57.6%, JPY 13.6%, GBP 11.9%, CAD 9.1%, SEK 4.2%, CHF 3.6%).',
    detail: 'Omdat EUR het grootste gewicht heeft (57.6%), beweegt de DXY grotendeels invers aan EUR/USD. Een stijgende DXY bevestigt brede USD-sterkte, niet alleen tegen één valuta. Dit is nuttig om te checken of een USD-move breed gedragen is of geïsoleerd tot één paar.',
    levels: 'Boven 105 = sterke USD. 100-105 = neutraal. Onder 100 = zwakke USD. Extremen (>108 of <95) zijn zeldzaam en wijzen op sterke regimes.',
    fxImpact: 'DXY stijgt → bevestigt USD Dominant regime. DXY daalt → bevestigt USD Zwak regime. Kijk of DXY-beweging consistent is met individuele paarbewegingen.',
  },
}

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
  const [expandedCurrency, setExpandedCurrency] = useState<string | null>(null)
  const [expandedSentiment, setExpandedSentiment] = useState<string | null>(null)
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set())
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null)

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
      // Try v2 endpoint first
      const resV2 = await fetch('/api/trackrecord-v2')
      const jsonV2 = await resV2.json()
      const records = jsonV2.records || []
      if (records.length > 0) {
        setTrackRecords(records)
        setTrackStats(jsonV2.stats || { total: 0, correct: 0, incorrect: 0, pending: 0, winRate: 0, startDate: null })
        return
      }
      // Fallback to v1 if v2 returns empty
      const res = await fetch('/api/trackrecord')
      const json = await res.json()
      setTrackRecords(json.records || [])
      setTrackStats(json.stats || { total: 0, correct: 0, incorrect: 0, pending: 0, winRate: 0, startDate: null })
    } catch { /* table might not exist */ }
  }

  const handleBackfill = async () => {
    setBackfilling(true)
    setBackfillMsg(null)
    try {
      const res = await fetch('/api/trackrecord-v2/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 45 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Backfill mislukt')
      setBackfillMsg(`Backfill voltooid: ${json.added || 0} records toegevoegd, ${json.updated || 0} bijgewerkt.`)
      await fetchTrackRecord()
    } catch (e) {
      setBackfillMsg(e instanceof Error ? e.message : 'Backfill mislukt')
    } finally {
      setBackfilling(false)
    }
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
          <strong>TEST OMGEVING</strong> - Enhanced Daily Macro Briefing met nieuws-integratie. Niet live, alleen voor evaluatie.
        </p>
      </div>

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-accent-light/60 mb-2 font-medium">Daily Macro Briefing</p>
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

                {/* Educational: Why is this risk-on/off? — COLLAPSIBLE */}
                <details className="mt-3 group">
                  <summary className="flex items-center gap-2 text-[11px] text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Waarom is dit {data.regime}?
                  </summary>
                  <div className="mt-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    {data.regime === 'Risk-Off' && (
                      <p className="text-[11px] text-text-dim leading-relaxed">
                        In een <strong className="text-red-400">Risk-Off</strong> omgeving zijn beleggers bang voor economische onzekerheid. Ze verkopen risicovolle beleggingen (aandelen, high-yield valuta&apos;s zoals AUD, NZD, CAD) en vluchten naar &quot;veilige havens&quot; (JPY, CHF, goud, staatsobligaties). Dit gebeurt wanneer centrale banken van veilige-haven landen een hawkish beleid voeren of wanneer er geopolitieke spanningen zijn. Het resultaat: JPY en CHF worden sterker, AUD en NZD worden zwakker.
                      </p>
                    )}
                    {data.regime === 'Risk-On' && (
                      <p className="text-[11px] text-text-dim leading-relaxed">
                        In een <strong className="text-green-400">Risk-On</strong> omgeving hebben beleggers vertrouwen in de economie. Ze kopen risicovolle beleggingen (aandelen, high-yield valuta&apos;s) omdat die hogere rendementen bieden. Valuta&apos;s van landen met hoge rentes (AUD, NZD, CAD) worden sterker doordat beleggers &quot;carry trades&quot; openen: ze lenen in een lage-rente valuta (JPY) en beleggen in een hoge-rente valuta. Het resultaat: AUD, NZD en CAD stijgen, JPY daalt.
                      </p>
                    )}
                    {data.regime === 'USD Dominant' && (
                      <p className="text-[11px] text-text-dim leading-relaxed">
                        De <strong className="text-blue-400">USD domineert</strong> wanneer de Federal Reserve een strak (hawkish) beleid voert. Hogere rentes in de VS trekken internationaal kapitaal aan, want beleggers krijgen meer rendement op USD-obligaties. Dit maakt de dollar sterker tegen bijna alle andere valuta&apos;s. Daarnaast fungeert de dollar als veilige haven in tijden van onzekerheid, wat de dominantie versterkt.
                      </p>
                    )}
                    {data.regime === 'USD Zwak' && (
                      <p className="text-[11px] text-text-dim leading-relaxed">
                        De <strong className="text-amber-400">USD is zwak</strong> wanneer de markt verwacht dat de Fed de rente gaat verlagen (dovish signalen). Lagere rentes maken USD-obligaties minder aantrekkelijk, waardoor kapitaal wegstroomt naar valuta&apos;s met betere rendementen. Andere valuta&apos;s worden relatief sterker, vooral die van landen waar de centrale bank juist hawkish is.
                      </p>
                    )}
                    {data.regime === 'Gemengd' && (
                      <p className="text-[11px] text-text-dim leading-relaxed">
                        Een <strong className="text-text-muted">gemengd</strong> regime betekent dat er geen duidelijke richting is. De fundamentele scores van safe-haven en high-yield valuta&apos;s liggen dicht bij elkaar. Dit kan komen doordat centrale banken vergelijkbaar beleid voeren, of doordat tegenstrijdige factoren (bijv. hawkish Fed maar ook sterke Australische economie) elkaar opheffen. In deze situatie focussen we op individuele paar-divergenties.
                      </p>
                    )}
                  </div>
                </details>
              </div>

              {/* Currency Strength Ranking — CLICKABLE for score breakdown */}
              {data.currencyRanking && data.currencyRanking.length > 0 && (
                <div className="px-5 sm:px-6 py-4 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-[10px] font-semibold text-text-dim uppercase tracking-wider">Valuta Sterkte: van sterk naar zwak</p>
                    <span className="text-[8px] text-text-dim/50">(klik voor detail)</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {data.currencyRanking.map((ccy, i) => {
                      const isStrong = ccy.score > 1
                      const isWeak = ccy.score < -1
                      const isExpanded = expandedCurrency === ccy.currency
                      return (
                        <button
                          key={ccy.currency}
                          onClick={() => setExpandedCurrency(isExpanded ? null : ccy.currency)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
                            isExpanded ? 'ring-1 ring-accent/40 ' : ''
                          }${
                            isStrong ? 'bg-green-500/[0.08] border-green-500/20 text-green-400 hover:bg-green-500/[0.12]' :
                            isWeak ? 'bg-red-500/[0.08] border-red-500/20 text-red-400 hover:bg-red-500/[0.12]' :
                            'bg-white/[0.03] border-border text-text-dim hover:bg-white/[0.06]'
                          }`}
                        >
                          <span className="font-bold text-heading text-[11px]">{i + 1}.</span>
                          <span className="font-semibold">{ccy.currency}</span>
                          <span className="font-mono text-[10px]">
                            {ccy.score > 0 ? '+' : ''}{ccy.score.toFixed(1)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {/* Expanded score breakdown */}
                  {expandedCurrency && (() => {
                    const ccy = data.currencyRanking.find(c => c.currency === expandedCurrency)
                    if (!ccy) return null
                    return (
                      <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] animate-in fade-in duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-heading">{ccy.currency} — Score Opbouw</p>
                          <button onClick={() => setExpandedCurrency(null)} className="text-text-dim hover:text-heading">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {/* CB Bias */}
                          <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-white/[0.02]">
                            <span className="text-text-dim">CB Beleid ({ccy.bank || '—'}): <span className="text-text-muted">{ccy.bias || 'onbekend'}</span></span>
                            <span className={`font-mono font-bold ${ccy.baseScore > 0 ? 'text-green-400' : ccy.baseScore < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                              {ccy.baseScore > 0 ? '+' : ''}{ccy.baseScore.toFixed(1)}
                            </span>
                          </div>
                          {/* Rate vs Target */}
                          {ccy.rate !== null && (
                            <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-white/[0.02]">
                              <span className="text-text-dim">Rente: <span className="text-text-muted">{ccy.rate}%</span></span>
                              <span className="text-[10px] text-text-dim">(onderdeel van basis score)</span>
                            </div>
                          )}
                          {/* News bonus */}
                          {ccy.newsBonus !== 0 && (
                            <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-white/[0.02]">
                              <span className="text-text-dim">Nieuws sentiment bonus</span>
                              <span className={`font-mono font-bold ${ccy.newsBonus > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {ccy.newsBonus > 0 ? '+' : ''}{ccy.newsBonus.toFixed(1)}
                              </span>
                            </div>
                          )}
                          {/* Total */}
                          <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-accent/5 border border-accent/10 font-semibold">
                            <span className="text-text-muted">Totaal</span>
                            <span className={`font-mono font-bold ${ccy.score > 0 ? 'text-green-400' : ccy.score < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                              {ccy.score > 0 ? '+' : ''}{ccy.score.toFixed(1)}
                            </span>
                          </div>
                          {/* Explanation */}
                          {ccy.reasons && ccy.reasons.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {ccy.reasons.map((r, ri) => (
                                <p key={ri} className="text-[10px] text-text-dim flex items-start gap-1">
                                  <span className="text-accent-light shrink-0">&rsaquo;</span> {r}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Expandable: Waarom dit regime? */}
              <div className="px-5 sm:px-6 pb-4">
                <details className="mt-3 group">
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
                <details className="mt-3 group">
                  <summary className="flex items-center gap-2 text-xs text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Hoe wordt het regime bepaald?
                  </summary>
                  <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <div className="space-y-3">
                      <p className="text-xs text-text-dim leading-relaxed">{data.regimeMethodology}</p>
                      <div className="p-3 rounded-lg bg-accent-glow/10 border border-accent-dim/20">
                        <p className="text-xs text-text-dim leading-relaxed">
                          <strong className="text-accent-light">Databron:</strong> Centraal bank persconferenties, policy statements en forward guidance.
                          Score per valuta op basis van hawkish/dovish bias en rentetarieven. Data uit{' '}
                          <a href="/tools/rente" className="text-accent-light underline underline-offset-2 hover:text-accent-light/80">Tools &gt; Rentetarieven</a>.
                        </p>
                      </div>
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
              STAP 2: NIEUWS SENTIMENT
              ════════════════════════════════════════════════════════ */}
          <section className="mb-2">
            <StepHeader
              step={2}
              title="Nieuws Sentiment"
              subtitle="Wat vertelt recent nieuws ons over elke valuta?"
            />

            <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
              {/* Sentiment Grid */}
              <div className="px-5 sm:px-6 py-4">
                <div className="flex items-center gap-2 mb-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-medium">Sentiment per Valuta</p>
                  <span className="text-[8px] text-text-dim/50">(klik voor detail)</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {MAJORS.map(ccy => {
                    const s = data.newsSentiment?.[ccy]
                    const score = s?.score || 0
                    const isExpSentiment = expandedSentiment === ccy
                    return (
                      <button
                        key={ccy}
                        onClick={() => setExpandedSentiment(isExpSentiment ? null : ccy)}
                        className={`text-center p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isExpSentiment ? 'ring-1 ring-accent/40 ' : ''
                        }${
                          score > 0 ? 'bg-green-500/[0.06] border-green-500/15 hover:bg-green-500/[0.1]' :
                          score < 0 ? 'bg-red-500/[0.06] border-red-500/15 hover:bg-red-500/[0.1]' :
                          'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                        }`}
                      >
                        <p className="text-xs font-bold text-heading mb-1">{ccy}</p>
                        <p className={`text-sm font-mono font-bold ${score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                          {score > 0 ? '+' : ''}{score}
                        </p>
                        <p className="text-[9px] text-text-dim mt-0.5">{s?.sentiment || 'neutraal'}</p>
                      </button>
                    )
                  })}
                </div>
                <p className="text-[9px] text-text-dim/50 mt-2 leading-relaxed">
                  Neutraal = geen relevante nieuwsartikelen gevonden voor deze valuta in de afgelopen 72 uur, of het nieuws bevat geen duidelijk bullish/bearish signaal.
                  De score op basis van CB-beleid en rente is onafhankelijk van het nieuws en blijft altijd actief.
                </p>

                {/* Expanded sentiment detail */}
                {expandedSentiment && (() => {
                  const s = data.newsSentiment?.[expandedSentiment]
                  const ccyRank = data.currencyRanking.find(c => c.currency === expandedSentiment)
                  if (!s) return null
                  return (
                    <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] animate-in fade-in duration-200">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-heading">{expandedSentiment} — Nieuws Sentiment Detail</p>
                        <button onClick={() => setExpandedSentiment(null)} className="text-text-dim hover:text-heading">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="text-text-dim">Sentiment score:</span>
                          <span className={`font-mono font-bold ${s.score > 0 ? 'text-green-400' : s.score < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                            {s.score > 0 ? '+' : ''}{s.score}
                          </span>
                          <span className="text-text-dim/60">→</span>
                          <span className="text-text-muted">{s.sentiment}</span>
                        </div>
                        {ccyRank && ccyRank.newsBonus !== 0 && (
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="text-text-dim">Toegepaste bonus (max &plusmn;1.5):</span>
                            <span className={`font-mono font-bold ${ccyRank.newsBonus > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {ccyRank.newsBonus > 0 ? '+' : ''}{ccyRank.newsBonus.toFixed(1)}
                            </span>
                          </div>
                        )}
                        {s.headlines && s.headlines.length > 0 && (
                          <div className="mt-1">
                            <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1">Relevante headlines:</p>
                            {s.headlines.map((h, hi) => (
                              <p key={hi} className="text-[10px] text-text-muted leading-relaxed flex items-start gap-1">
                                <span className="text-accent-light shrink-0">&rsaquo;</span> {h}
                              </p>
                            ))}
                          </div>
                        )}
                        <p className="text-[9px] text-text-dim/60 leading-relaxed">
                          De score wordt berekend op basis van bullish/bearish keywords in recente nieuwsartikelen,
                          gewogen naar relevantie en hoe recent het artikel is. De bonus wordt gecapt op &plusmn;1.5 om ruis te beperken.
                        </p>
                      </div>
                    </div>
                  )
                })()}

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
                <details className="mt-3 group">
                  <summary className="flex items-center gap-2 text-xs text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Hoe wordt nieuws geanalyseerd?
                  </summary>
                  <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                          <p className="text-[10px] text-accent-light font-semibold mb-1">Keyword Analyse</p>
                          <p className="text-[10px] text-text-dim leading-relaxed">
                            Artikelen worden gescand op bullish keywords (hawkish, rate hike, strong, surge, beat) en bearish keywords (dovish, rate cut, weak, recession, decline). Per match wordt het sentiment voor de betreffende valuta aangepast.
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                          <p className="text-[10px] text-accent-light font-semibold mb-1">Recency Weging</p>
                          <p className="text-[10px] text-text-dim leading-relaxed">
                            Recent nieuws weegt zwaarder: artikelen van &lt;12u geleden krijgen factor 1.5x, 12-24u = 1.2x, 24-48u = 1.0x, ouder = 0.7x.
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                          <p className="text-[10px] text-accent-light font-semibold mb-1">Begrenzing</p>
                          <p className="text-[10px] text-text-dim leading-relaxed">
                            Het nieuws-effect is begrensd op maximaal +-1.5 punten per valuta. Dit voorkomt dat een enkele nieuwsgolf de fundamentele analyse volledig overstemt. CB beleid blijft altijd de basis.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>

                {/* Expandable: Databronnen */}
                <details className="mt-3 group">
                  <summary className="flex items-center gap-2 text-xs text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Databronnen
                  </summary>
                  <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <p className="text-[10px] text-text-dim mb-2">RSS feeds worden automatisch elke 2 uur opgehaald uit de volgende bronnen:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {['Federal Reserve', 'ECB', 'ForexLive', 'CNBC', 'Bloomberg', 'BBC', 'NY Times'].map(source => (
                        <div key={source} className="flex items-center gap-1.5 text-[10px] text-text-muted px-2 py-1.5 rounded bg-white/[0.02] border border-white/[0.04]">
                          <span className="w-1 h-1 rounded-full bg-accent-light/40 shrink-0" />
                          {source}
                        </div>
                      ))}
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

              {/* Educational: Why do these combinations signal risk-on/off? */}
              <div className="px-5 sm:px-6">
                <details className="mt-3 group">
                  <summary className="flex items-center gap-2 text-[11px] text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Waarom leiden deze combinaties tot Risk-On of Risk-Off?
                  </summary>
                  <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] space-y-3">
                    <p className="text-[11px] text-text-dim leading-relaxed">
                      Intermarket signalen zijn verbonden door kapitaalstromen. Grote beleggers (pensioenfondsen, hedgefunds) verschuiven miljarden tussen aandelen, obligaties, grondstoffen en valuta&apos;s. Deze verschuivingen laten een herkenbaar patroon achter:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="p-2.5 rounded-lg bg-red-500/[0.04] border border-red-500/10">
                        <p className="text-[10px] font-semibold text-red-400 mb-1">Risk-Off patroon:</p>
                        <p className="text-[10px] text-text-dim leading-relaxed">
                          Beleggers worden angstig &rarr; verkopen aandelen (S&amp;P daalt) &rarr; kopen bescherming via opties (VIX stijgt) &rarr; vluchten naar goud en staatsobligaties (goud stijgt, yields dalen of stijgen door inflatie-angst) &rarr; kopen veilige valuta&apos;s (JPY, CHF). Dit is een zelfversterkende cyclus.
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-green-500/[0.04] border border-green-500/10">
                        <p className="text-[10px] font-semibold text-green-400 mb-1">Risk-On patroon:</p>
                        <p className="text-[10px] text-text-dim leading-relaxed">
                          Beleggers hebben vertrouwen &rarr; kopen aandelen (S&amp;P stijgt) &rarr; verkopen bescherming (VIX daalt) &rarr; verlaten goud (goud daalt) &rarr; zoeken rendement in high-yield valuta&apos;s (AUD, NZD, CAD). Carry trades worden weer aantrekkelijk.
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] text-text-dim leading-relaxed">
                      <strong className="text-accent-light">Belangrijk:</strong> het gaat om de combinatie van signalen, niet om individuele bewegingen. Een VIX die stijgt terwijl de S&amp;P ook stijgt is minder verontrustend dan wanneer beide in dezelfde &quot;angst-richting&quot; bewegen. Hoe meer signalen op dezelfde richting wijzen, hoe sterker het regime-signaal.
                    </p>
                  </div>
                </details>
              </div>

              {/* Expandable: Per-signal explanation */}
              <div className="px-5 sm:px-6 pb-4">
                <details className="mt-3 group">
                  <summary className="flex items-center gap-2 text-xs text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Per signaal uitleg bekijken
                  </summary>
                  <div className="mt-3 space-y-3">
                    {data.intermarketSignals.map(signal => {
                      const isUp = signal.direction === 'up'
                      const isDown = signal.direction === 'down'
                      const info = INTERMARKET_HOW_TO_READ[signal.key]
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
                              {signal.changePct !== null && (
                                <span className={`text-[10px] font-mono ${signal.changePct > 0 ? 'text-green-400' : signal.changePct < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                                  {signal.changePct > 0 ? '+' : ''}{signal.changePct}%
                                </span>
                              )}
                              <span className={`text-xs font-mono font-semibold ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-text-dim'}`}>
                                {isUp ? '\u25B2' : isDown ? '\u25BC' : '\u2014'}
                              </span>
                            </div>
                          </div>
                          <div className="px-4 py-3 space-y-2">
                            {info && (
                              <>
                                <p className="text-[11px] text-text-dim leading-relaxed">{info.summary}</p>
                                <p className="text-[11px] text-text-dim leading-relaxed">{info.detail}</p>
                                <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                  <p className="text-[10px] text-text-dim leading-relaxed">
                                    <strong className="text-text-muted">Niveaus:</strong> {info.levels}
                                  </p>
                                </div>
                                <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                  <p className="text-[10px] text-text-dim leading-relaxed">
                                    <strong className="text-text-muted">FX Impact:</strong> {info.fxImpact}
                                  </p>
                                </div>
                              </>
                            )}
                            {signal.context && !info && <p className="text-[10px] text-text-dim leading-relaxed">{signal.context}</p>}
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

                {/* Expandable: How intermarket confirms regime */}
                <details className="mt-3 group">
                  <summary className="flex items-center gap-2 text-xs text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Hoe bevestigen intermarket signalen het regime?
                  </summary>
                  <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <div className="space-y-2 text-[10px] text-text-dim leading-relaxed">
                      <p>
                        Intermarket signalen worden gebruikt als bevestiging van het macro regime dat in Stap 1 is bepaald op basis van centraal bank beleid.
                        Ze veranderen het regime niet, maar verhogen of verlagen de confidence score.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                          <p className="text-accent-light font-semibold mb-1">Risk-Off bevestigd als:</p>
                          <p>VIX stijgt + S&amp;P 500 daalt + Goud stijgt (minimaal 3 van 4 risk-off signalen)</p>
                        </div>
                        <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                          <p className="text-accent-light font-semibold mb-1">Risk-On bevestigd als:</p>
                          <p>VIX daalt + S&amp;P 500 stijgt + Goud daalt (minimaal 3 van 4 risk-on signalen)</p>
                        </div>
                        <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                          <p className="text-accent-light font-semibold mb-1">USD Dominant bevestigd als:</p>
                          <p>Yields stijgen OF minimaal 2 risk-off signalen actief</p>
                        </div>
                        <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                          <p className="text-accent-light font-semibold mb-1">USD Zwak bevestigd als:</p>
                          <p>Yields dalen OF minimaal 2 risk-on signalen actief</p>
                        </div>
                      </div>
                      <p>
                        Als intermarket signalen het regime bevestigen, wordt de confidence score verhoogd.
                        Bij conflict blijft het regime gelijk maar de confidence score wordt verlaagd, wat leidt tot meer selectieve trade suggesties.
                      </p>
                    </div>
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
                      {/* Call info bar */}
                      <div className="flex flex-wrap items-center gap-3 mb-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-text-dim uppercase tracking-wider">Call:</span>
                          <span className="text-[10px] font-mono font-semibold text-accent-light/80">
                            {new Date().toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })} NL
                          </span>
                        </div>
                        <span className="text-text-dim/20">|</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-text-dim uppercase tracking-wider">Entry:</span>
                          <span className="text-[10px] font-mono text-text-muted">daily close (18:00 NL)</span>
                        </div>
                        <span className="text-text-dim/20">|</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-text-dim uppercase tracking-wider">Exit:</span>
                          <span className="text-[10px] font-mono text-text-muted">+2 dagen daily close</span>
                        </div>
                      </div>

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

                      {/* Expandable: Waarom dit paar? */}
                      <details className="mt-3 group">
                        <summary className="flex items-center gap-2 text-xs text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          Waarom dit paar?
                        </summary>
                        <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                          <div className="space-y-2">
                            {/* Full score breakdown */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                                <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1">{trade.base} (base)</p>
                                <p className={`text-sm font-mono font-bold ${(trade.baseRank?.score || 0) > 0 ? 'text-green-400' : (trade.baseRank?.score || 0) < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                                  {(trade.baseRank?.score || 0) > 0 ? '+' : ''}{(trade.baseRank?.score || 0).toFixed(1)}
                                </p>
                                <p className="text-[9px] text-text-dim mt-0.5">
                                  Basis: {(trade.baseRank?.baseScore || 0) > 0 ? '+' : ''}{(trade.baseRank?.baseScore || 0).toFixed(1)}
                                  {(trade.baseRank?.newsBonus || 0) !== 0 && ` | Nieuws: ${(trade.baseRank?.newsBonus || 0) > 0 ? '+' : ''}${(trade.baseRank?.newsBonus || 0).toFixed(1)}`}
                                </p>
                              </div>
                              <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                                <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1">{trade.quote} (quote)</p>
                                <p className={`text-sm font-mono font-bold ${(trade.quoteRank?.score || 0) > 0 ? 'text-green-400' : (trade.quoteRank?.score || 0) < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                                  {(trade.quoteRank?.score || 0) > 0 ? '+' : ''}{(trade.quoteRank?.score || 0).toFixed(1)}
                                </p>
                                <p className="text-[9px] text-text-dim mt-0.5">
                                  Basis: {(trade.quoteRank?.baseScore || 0) > 0 ? '+' : ''}{(trade.quoteRank?.baseScore || 0).toFixed(1)}
                                  {(trade.quoteRank?.newsBonus || 0) !== 0 && ` | Nieuws: ${(trade.quoteRank?.newsBonus || 0) > 0 ? '+' : ''}${(trade.quoteRank?.newsBonus || 0).toFixed(1)}`}
                                </p>
                              </div>
                            </div>

                            {/* CB bias */}
                            {(trade.baseBias || trade.quoteBias) && (
                              <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                                <p className="text-[10px] text-accent-light font-semibold mb-1">CB Bias</p>
                                <div className="space-y-0.5 text-[10px] text-text-dim">
                                  {trade.baseBias && <p>{trade.base}: {trade.baseBias}</p>}
                                  {trade.quoteBias && <p>{trade.quote}: {trade.quoteBias}</p>}
                                </div>
                              </div>
                            )}

                            {/* Rate differential */}
                            {trade.rateDiff !== null && trade.rateDiff !== 0 && (
                              <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                                <p className="text-[10px] text-accent-light font-semibold mb-1">Renteverschil</p>
                                <p className="text-[10px] text-text-dim">
                                  {trade.base} vs {trade.quote}: {trade.rateDiff > 0 ? '+' : ''}{trade.rateDiff}%.
                                  {trade.rateDiff > 0
                                    ? ` ${trade.base} biedt een hogere rente, wat carry-trade stromen richting ${trade.base} aantrekt.`
                                    : ` ${trade.quote} biedt een hogere rente, wat carry-trade stromen richting ${trade.quote} aantrekt.`
                                  }
                                </p>
                              </div>
                            )}

                            {/* News influence */}
                            {trade.newsInfluence !== 0 && (
                              <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                                <p className="text-[10px] text-accent-light font-semibold mb-1">Nieuws Invloed</p>
                                <p className="text-[10px] text-text-dim">
                                  Het recente nieuws {trade.newsInfluence > 0 ? 'versterkt' : 'verzwakt'} de fundamentele richting met {Math.abs(trade.newsInfluence)} punt.
                                  {trade.newsInfluence > 0
                                    ? ' Nieuwssentiment is in lijn met de CB-divergentie, wat de overtuiging verhoogt.'
                                    : ' Nieuwssentiment gaat tegen de CB-divergentie in, wat de overtuiging verlaagt.'
                                  }
                                </p>
                              </div>
                            )}

                            {/* Full explanation list */}
                            {trade.explanation.length > 0 && (
                              <div className="space-y-1">
                                {trade.explanation.map((exp, j) => (
                                  <div key={j} className="flex items-start gap-1.5 text-[11px] text-text-dim leading-relaxed">
                                    <span className="text-accent-light mt-0.5 shrink-0">&gt;</span>
                                    <span>{exp}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
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

            {/* Expandable: How trade focus pairs are selected */}
            <div className="mt-4">
              <details className="mt-3 group">
                <summary className="flex items-center gap-2 text-xs text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  Hoe worden de trade focus paren geselecteerd?
                </summary>
                <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <div className="space-y-3 text-[10px] text-text-dim leading-relaxed">
                    <p>
                      Een valutapaar zoals <strong className="text-text-muted">EUR/USD</strong> bestaat uit twee valuta&apos;s: de <strong className="text-accent-light">base</strong> (EUR, links) en de <strong className="text-accent-light">quote</strong> (USD, rechts). Als je EUR/USD koopt (LONG), koop je EUR en verkoop je USD.
                    </p>

                    {/* Visual example */}
                    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                      <p className="text-[10px] font-semibold text-text-muted mb-2">Voorbeeld berekening:</p>
                      <div className="flex items-center justify-center gap-2 text-xs mb-2">
                        <div className="p-2 rounded bg-green-500/10 border border-green-500/15 text-center">
                          <p className="text-[9px] text-text-dim">Base (EUR)</p>
                          <p className="text-sm font-mono font-bold text-green-400">+3.0</p>
                          <p className="text-[8px] text-text-dim">hawkish ECB</p>
                        </div>
                        <span className="text-lg text-text-dim font-mono">&minus;</span>
                        <div className="p-2 rounded bg-red-500/10 border border-red-500/15 text-center">
                          <p className="text-[9px] text-text-dim">Quote (USD)</p>
                          <p className="text-sm font-mono font-bold text-red-400">&minus;1.0</p>
                          <p className="text-[8px] text-text-dim">dovish Fed</p>
                        </div>
                        <span className="text-lg text-text-dim font-mono">=</span>
                        <div className="p-2 rounded bg-accent/10 border border-accent/20 text-center">
                          <p className="text-[9px] text-text-dim">Paar Score</p>
                          <p className="text-sm font-mono font-bold text-accent-light">+4.0</p>
                          <p className="text-[8px] text-green-400">bullish</p>
                        </div>
                      </div>
                      <p className="text-[9px] text-text-dim text-center">
                        EUR is fundamenteel sterker dan USD &rarr; EUR/USD zou moeten stijgen &rarr; <strong className="text-green-400">LONG</strong>
                      </p>
                    </div>

                    <p>
                      <strong className="text-text-muted">Elke valuta krijgt een score</strong> op basis van: (1) het beleid van de centrale bank (hawkish = positief, dovish = negatief), (2) de huidige rente t.o.v. het target, en (3) recent nieuws sentiment (max &plusmn;1.5 bonus).
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04] text-center">
                        <p className="text-accent-light font-semibold text-[10px]">Sterk</p>
                        <p className="text-[9px]">Score &ge; 3.5</p>
                        <p className="text-[8px] text-text-dim">Getrackt (2d hold)</p>
                      </div>
                      <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04] text-center">
                        <p className="text-text-muted font-semibold text-[10px]">Matig</p>
                        <p className="text-[9px]">Score &ge; 3.0</p>
                        <p className="text-[8px] text-text-dim">Getrackt (2d hold)</p>
                      </div>
                      <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04] text-center">
                        <p className="text-text-dim font-semibold text-[10px]">Laag</p>
                        <p className="text-[9px]">Score &lt; 3.0</p>
                        <p className="text-[8px] text-text-dim">Te zwak signaal</p>
                      </div>
                    </div>

                    {/* V2.2 Mean Reversion explanation */}
                    <div className="p-3 rounded-lg bg-accent/5 border border-accent/10">
                      <p className="text-[10px] font-semibold text-accent-light mb-2">Mean Reversion Strategie</p>
                      <p className="text-[9px] text-text-dim leading-relaxed mb-2">
                        Het model combineert fundamentele analyse met <strong className="text-text-muted">mean reversion timing</strong>.
                        Een signaal wordt pas geactiveerd als de prijs de afgelopen 2 dagen <em>tegen</em> de fundamentele richting is bewogen.
                      </p>
                      <div className="flex items-center justify-center gap-2 text-xs my-2">
                        <div className="p-2 rounded bg-green-500/10 border border-green-500/15 text-center">
                          <p className="text-[9px] text-text-dim">Fundamenteel</p>
                          <p className="text-xs font-bold text-green-400">Bullish</p>
                        </div>
                        <span className="text-lg text-text-dim font-mono">+</span>
                        <div className="p-2 rounded bg-red-500/10 border border-red-500/15 text-center">
                          <p className="text-[9px] text-text-dim">Prijs (2d)</p>
                          <p className="text-xs font-bold text-red-400">&darr; Dalend</p>
                        </div>
                        <span className="text-lg text-text-dim font-mono">=</span>
                        <div className="p-2 rounded bg-accent/10 border border-accent/20 text-center">
                          <p className="text-[9px] text-text-dim">Actie</p>
                          <p className="text-xs font-bold text-accent-light">LONG</p>
                          <p className="text-[8px] text-green-400">koop de dip</p>
                        </div>
                      </div>
                      <p className="text-[9px] text-text-dim leading-relaxed">
                        <strong className="text-text-muted">Gedachtegang:</strong> Centrale bank beleid bepaalt de langetermijnrichting.
                        Als de prijs tijdelijk tegen die richting ingaat, is dat een <em>reversal-kans</em>.
                        Je koopt niet wanneer iedereen al koopt &mdash; je koopt wanneer de markt een dip maakt.
                        Holding periode: <strong className="text-text-muted">2 dagen</strong> (optimaal voor dit model).
                      </p>
                    </div>

                    <p>
                      <strong className="text-text-muted">Filters:</strong> Intermarket signalen moeten het regime bevestigen. Als aandelen, VIX en goud het regime tegenspreken, wordt &quot;sterk&quot; verlaagd naar &quot;matig&quot;. Cross-pair contradicties worden ook gefilterd.
                    </p>
                  </div>
                </div>
              </details>
            </div>

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
                  {/* Tracking since + Stats Grid */}
                  {trackStats.startDate && (
                    <div className="mt-3 mb-2 flex items-center gap-2 text-[10px] text-text-dim">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>Tracking actief sinds <strong className="text-text-muted">{trackStats.startDate}</strong></span>
                    </div>
                  )}

                  <div className="grid grid-cols-5 gap-2 mt-3 mb-4">
                    {[
                      { label: 'Totaal', value: trackStats.total, color: 'text-heading' },
                      { label: 'Correct', value: trackStats.correct, color: 'text-green-400' },
                      { label: 'Incorrect', value: trackStats.incorrect, color: 'text-red-400' },
                      { label: 'Pending', value: trackStats.pending, color: 'text-amber-400' },
                      { label: 'Win Rate', value: `${trackStats.winRate}%`, color: trackStats.winRate >= 55 ? 'text-green-400' : trackStats.winRate >= 45 ? 'text-amber-400' : 'text-red-400' },
                    ].map(stat => (
                      <div key={stat.label} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                        <p className={`text-lg font-mono font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-[9px] text-text-dim">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* News influence stats */}
                  {trackStats.newsInfluenced && trackStats.newsInfluenced.total > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                      <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1">Nieuws Impact Analyse</p>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-text-muted">
                          Trades met nieuws invloed: <strong className="text-heading">{trackStats.newsInfluenced.total}</strong>
                        </span>
                        <span className={`font-mono font-bold ${trackStats.newsInfluenced.winRate >= 55 ? 'text-green-400' : trackStats.newsInfluenced.winRate >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
                          {trackStats.newsInfluenced.winRate}% win rate
                        </span>
                        <span className="text-text-dim text-[10px]">
                          (vs {trackStats.winRate}% totaal)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Backfill Button */}
                  <div className="mb-4 flex items-center gap-3">
                    <button
                      onClick={handleBackfill}
                      disabled={backfilling}
                      className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-accent/30 bg-accent/10 text-accent-light hover:bg-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {backfilling ? (
                        <span className="flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                          </svg>
                          Backfill bezig...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                          </svg>
                          Backfill 45 dagen
                        </span>
                      )}
                    </button>
                    {backfillMsg && (
                      <span className="text-[10px] text-text-muted">{backfillMsg}</span>
                    )}
                  </div>

                  {/* Historical Records — DETAILED with timestamps */}
                  {trackRecords.length > 0 && (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {trackRecords.slice(0, 40).map(record => {
                        const meta = record.metadata
                        // Call time = signal date at 08:00 NL time (07:00 UTC)
                        // Entry time = signal date at 18:00 NL time (daily close, 16:00 UTC)
                        // Exit time = 2 days later at 18:00 NL time
                        const signalDateStr = record.date // e.g. "2026-03-29"
                        const callTime = meta?.callTime
                          ? formatCET(meta.callTime)
                          : signalDateStr
                            ? formatCET(`${signalDateStr}T07:00:00.000Z`)
                            : formatCET(record.created_at)
                        const entryTime = meta?.entryTime
                          ? formatCET(meta.entryTime)
                          : signalDateStr
                            ? formatCET(`${signalDateStr}T16:00:00.000Z`)
                            : ''
                        const exitTime = meta?.exitTime
                          ? formatCET(meta.exitTime)
                          : ''
                        return (
                          <div key={record.id} className="rounded-xl bg-white/[0.02] border border-white/[0.04] overflow-hidden">
                            {/* Header row */}
                            <div className="px-3 py-2 flex items-center justify-between bg-white/[0.01]">
                              <div className="flex items-center gap-2">
                                <span className="text-text-dim font-mono text-[10px]">{record.date}</span>
                                <span className="font-semibold text-heading font-mono text-xs">{record.pair}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  record.direction.includes('bullish') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                }`}>
                                  {record.direction.includes('bullish') ? 'LONG' : 'SHORT'}
                                </span>
                                <span className="text-[9px] font-mono text-text-dim">score: {record.score}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                record.result === 'correct' ? 'bg-green-500/10 text-green-400' :
                                record.result === 'incorrect' ? 'bg-red-500/10 text-red-400' :
                                'bg-amber-500/10 text-amber-400'
                              }`}>
                                {record.result === 'correct' ? '\u2713 Correct' : record.result === 'incorrect' ? '\u2717 Incorrect' : '\u23F3 Pending'}
                              </span>
                            </div>
                            {/* Detail row: entry, exit, pips, timestamps */}
                            <div className="px-3 py-2 border-t border-white/[0.03]">
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px]">
                                <div>
                                  <span className="text-text-dim/60 block">Call tijdstip</span>
                                  <span className="font-mono text-accent-light/80 font-semibold">
                                    {callTime || '—'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-text-dim/60 block">Entry prijs</span>
                                  <span className="font-mono text-text-muted font-semibold">
                                    {record.entry_price !== null ? record.entry_price : '—'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-text-dim/60 block">Exit prijs <span className="text-text-dim/40">({exitTime || '—'})</span></span>
                                  <span className="font-mono text-text-muted font-semibold">
                                    {record.exit_price !== null ? record.exit_price : '—'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-text-dim/60 block">Pips</span>
                                  {record.pips_moved !== null ? (
                                    <span className={`font-mono font-semibold ${record.pips_moved > 0 ? 'text-green-400' : record.pips_moved < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                                      {record.pips_moved > 0 ? '+' : ''}{record.pips_moved}
                                    </span>
                                  ) : <span className="text-text-dim">—</span>}
                                </div>
                                <div>
                                  <span className="text-text-dim/60 block">Regime</span>
                                  <span className="text-text-dim">{record.regime || '—'}</span>
                                </div>
                              </div>
                              {/* Metadata: news influence */}
                              {meta && meta.newsInfluence !== undefined && Math.abs(meta.newsInfluence) > 0.1 && (
                                <div className="mt-1.5 flex items-center gap-2 text-[9px]">
                                  <span className="text-text-dim/50">Nieuws invloed:</span>
                                  <span className={`font-mono ${meta.newsInfluence > 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                                    {meta.newsInfluence > 0 ? '+' : ''}{meta.newsInfluence}
                                  </span>
                                  {meta.confidence !== undefined && (
                                    <>
                                      <span className="text-text-dim/30">|</span>
                                      <span className="text-text-dim/50">Confidence: {meta.confidence}%</span>
                                    </>
                                  )}
                                  {meta.meanReversion && (
                                    <span className="px-1 py-0.5 rounded bg-purple-500/10 text-purple-400/60 text-[8px]">mean reversion</span>
                                  )}
                                  {meta.holdingPeriod && (
                                    <>
                                      <span className="text-text-dim/30">|</span>
                                      <span className="text-text-dim/50">Hold: {meta.holdingPeriod}d</span>
                                    </>
                                  )}
                                  {meta.newsSimulated && (
                                    <span className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-400/60 text-[8px]">gesimuleerd</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {trackRecords.length === 0 && (
                    <p className="text-xs text-text-dim text-center py-4">Nog geen trackrecord data beschikbaar. Gebruik de backfill knop of wacht tot data automatisch dagelijks wordt opgeslagen.</p>
                  )}

                  {/* Expandable: How trackrecord is calculated */}
                  <details className="mt-3 group">
                    <summary className="flex items-center gap-2 text-xs text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      Hoe wordt het trackrecord berekend?
                    </summary>
                    <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <div className="space-y-2 text-[10px] text-text-dim leading-relaxed">
                        <p>
                          Het trackrecord meet hoe nauwkeurig het mean reversion model is: fundamentele richting + timing via prijsactie. Holding periode: 2 handelsdagen.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.04]">
                            <p className="text-accent-light font-semibold mb-1">Entry &amp; Timing</p>
                            <p>De entry prijs wordt vastgelegd op het moment dat de daily briefing wordt gegenereerd (Europese sessie). Het exacte tijdstip (CET) wordt opgeslagen zodat je kunt terugzoeken in de chart.</p>
                          </div>
                          <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.04]">
                            <p className="text-accent-light font-semibold mb-1">Exit &amp; Resolutie</p>
                            <p>De exit prijs wordt opgehaald <strong className="text-text-muted">2 handelsdagen later</strong> op hetzelfde tijdstip. De 2-daagse holding periode geeft de mean reversion voldoende tijd om te werken.</p>
                          </div>
                          <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.04]">
                            <p className="text-accent-light font-semibold mb-1">Mean Reversion</p>
                            <p>Het model handelt alleen wanneer de 2-daagse prijsactie <strong className="text-text-muted">tegen</strong> de fundamentele richting ingaat. Score &ge;3.0 vereist. Intermarket+regime+cross-pair filters actief.</p>
                          </div>
                          <div className="p-2.5 rounded bg-white/[0.02] border border-white/[0.04]">
                            <p className="text-accent-light font-semibold mb-1">Waarom Mean Reversion?</p>
                            <p>CB-beleid cre&euml;ert langetermijntrends. Als de prijs tijdelijk dáártegen ingaat, is dat een kans. Optimalisatie toonde <strong className="text-text-muted">62% winrate</strong> vs 44% zonder dit filter.</p>
                          </div>
                        </div>
                        <p>
                          Een trade is &quot;correct&quot; als de prijs in de verwachte richting bewoog (LONG = prijs steeg, SHORT = prijs daalde).
                          Scores zijn een combinatie van CB beleid (basis) + nieuws sentiment (bonus, max &plusmn;1.5), gefilterd door intermarket confirmatie.
                        </p>
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </div>
          </section>

          {/* ── Tool Navigation Links ── */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Link href="/tools/fx-analyse" className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-muted hover:text-heading hover:border-border-light transition-colors">
              Macro Fundamentals &rarr;
              <span className="block text-[10px] text-text-dim">Leer hoe valutaparen werken</span>
            </Link>
            <Link href="/tools/kalender" className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-muted hover:text-heading hover:border-border-light transition-colors">
              Economische Kalender &rarr;
              <span className="block text-[10px] text-text-dim">Volledige eventkalender</span>
            </Link>
            <Link href="/tools/rente" className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-muted hover:text-heading hover:border-border-light transition-colors">
              Rentetarieven &rarr;
              <span className="block text-[10px] text-text-dim">Alle centrale bank rentes</span>
            </Link>
            <Link href="/nieuws" className="px-4 py-2.5 rounded-lg border border-accent/20 text-sm text-accent-light/80 hover:text-accent-light hover:border-accent/40 transition-colors">
              Nieuws Feed &rarr;
              <span className="block text-[10px] text-text-dim">Live FX nieuws met vertalingen</span>
            </Link>
          </div>

          {/* ── Methodology Footer ── */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-medium mb-2">Methode &amp; Databronnen</p>
            <p className="text-xs text-text-dim leading-relaxed">{data.regimeMethodology}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['CB Beleid (basis)', 'Rente vs Target', 'Intermarket Signalen', 'Nieuws Sentiment', 'Intermarket Filter', 'Mean Reversion', 'Economische Kalender'].map(tag => (
                <span key={tag} className="text-[9px] px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-text-dim">{tag}</span>
              ))}
            </div>
          </div>

          <div className="mt-4 p-4 rounded-xl border border-border bg-bg-card/30 text-center">
            <p className="text-xs text-text-dim leading-relaxed">
              Deze briefing is puur educatief en geen financieel advies. Data wordt automatisch opgehaald.
              Fundamentals geven de richting, je technische analyse (structure breaks) bepaalt de timing en entry.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
