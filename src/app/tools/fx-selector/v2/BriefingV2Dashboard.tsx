'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import SummaryBar from './components/SummaryBar'
import DivergenceAlert from './components/DivergenceAlert'
import ConfluenceMeter from './components/ConfluenceMeter'
import { formatCET, flagEmoji, timeAgo, timeAgoDutch, getIntermarketConclusion } from './utils'

// ─── Types ──────────────────────────────────────────────────
interface CurrencyRank {
  currency: string
  score: number
  baseScore: number
  newsBonus: number
  reasons: string[]
  newsHeadlines: string[]
  scoreBreakdown?: ScoreBreakdown | null
  rate: number | null
  bias: string
  flag: string
  bank: string
}

interface ConfluenceData {
  factors: {
    fundamenteel: boolean
    regime: boolean
    intermarket: boolean
    news: boolean
  }
  score: number
  total: number
}

interface DivergenceInfo {
  hasDivergence: boolean
  priceDirection: string
  fundamentalDirection: string
  pricePct: number
  message: string
}

interface ScoreBreakdown {
  biasLabel: string
  biasRaw: number
  biasMultiplied: number
  rateScore: number
  rate: number | null
  target: number | null
  newsRaw: number
  newsCapped: number
  total: number
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
  confluence?: ConfluenceData
  tradeFocusTier?: string
  regimeAligned?: boolean
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
  previousClose: number | null
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
  regimeConfidence?: number
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
  newsLastUpdated?: string
  newsCount?: number
  regimeSource?: string
  intermarketAlignment?: number
  confidenceBreakdown?: {
    fundamentalClarity: number
    fundamentalSpread: number
    newsAlignment: number
    intermarketAlignment: number
    regimeBonus: number
    regimeConfidence: number
    formula: string
  }
  divergences?: Record<string, DivergenceInfo>
  currencyMomentum?: Record<string, { direction: string; changePct: number }>
  // V3 Engine output
  v3?: {
    regime: { macro: string; sub: string; confidence: number; drivers: string[]; color: string }
    currencyScores: { currency: string; factors: Record<string, number>; weightedTotal: number; rawTotal: number; rank: number; reasons: string[] }[]
    pairSignals: { pair: string; signal: string; conviction: number; score: number; tradeability: { status: string; reasons: string[] }; intermarket: { pair: string; alignment: number; signals: { instrument: string; direction: string; strength: number; relevance: string }[] }; reasons: string[]; priceMomentum: { direction: string; pips1d: number; pips5d: number; atr20d: number; extensionRatio: number } }[]
    tradeFocus: { pair: string; signal: string; conviction: number; score: number; tradeability: string; reasons: string[] }[]
    metadata: { version: string; timestamp: string; subRegime: string; signalCount: { tradeable: number; conditional: number; noTrade: number } }
  } | null
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
  imAlignment?: number
  signal?: string
  momentum5d?: number
  lookbackDays?: number
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

// ─── Helpers imported from ./utils ──────────────────────────

function buildTradeFocusItem(pair: PairBias, events: TodayEvent[], ranking: CurrencyRank[]) {
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
}

function getTradeFocus(pairs: PairBias[], events: TodayEvent[], ranking: CurrencyRank[]) {
  // Primary: score >= 3.0, sterk or matig conviction
  const primary = pairs
    .filter(p => (p.conviction === 'sterk' || p.conviction === 'matig') && Math.abs(p.score) >= 3.0)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 5)
    .map(p => buildTradeFocusItem(p, events, ranking))

  // Watchlist: score >= 2.0 but not in primary, not neutral
  const primaryPairs = new Set(primary.map(p => p.pair))
  const watchlist = pairs
    .filter(p => !primaryPairs.has(p.pair) && Math.abs(p.score) >= 2.0 && p.direction !== 'neutraal')
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 5)

  return { primary, watchlist }
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
    detail: 'De VIX wordt berekend uit optieprijzen. Een hoge VIX betekent dat beleggers veel betalen voor bescherming tegen koersdalingen, ze zijn bang. Een lage VIX betekent rust. Belangrijk: de VIX is mean-reverting. Na een piek keert hij altijd terug naar gemiddeld niveau. Extremen zijn daarom ook potentiële keerpunten.',
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

// ─── Inline Education Component ────────────────────────────
function InlineEducation({ text }: { text: string }) {
  return (
    <details className="group/edu inline-block align-middle">
      <summary className="inline-flex items-center gap-1 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="w-4 h-4 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-[9px] text-accent-light/70 hover:text-accent-light hover:bg-accent/20 transition-all shrink-0" title="Uitleg">i</span>
      </summary>
      <div className="mt-1.5 p-2.5 rounded-lg bg-white/[0.04] border border-accent/15 text-[10px] text-text-dim leading-relaxed max-w-md">
        {text}
      </div>
    </details>
  )
}

// ─── Score Legend Component ─────────────────────────────────
function ScoreLegend() {
  return (
    <div className="inline-flex items-center gap-2 text-[8px] text-text-dim/60 ml-1">
      <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400/70 border border-green-500/10">&ge;3.0 Trade</span>
      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/70 border border-amber-500/10">2-3 Watch</span>
      <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-text-dim/50 border border-white/[0.06]">&lt;2 Geen</span>
    </div>
  )
}

// ─── Alignment Label Helper ────────────────────────────────
function AlignmentLabel({ value }: { value: number }) {
  if (value > 60) return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 font-bold">Sterk</span>
  if (value >= 30) return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold">Gemiddeld</span>
  return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 font-bold">Zwak</span>
}

// ─── Signal Pill Component ──────────────────────────────────
function SignalPill({ direction, label, value, unit, changePct, previousClose, change }: {
  direction: string; label: string; value: number | null; unit: string; changePct: number | null; previousClose?: number | null; change?: number | null
}) {
  const isUp = direction === 'up'
  const isDown = direction === 'down'
  const formatVal = (v: number | null | undefined) => {
    if (v === null || v === undefined) return 'N/A'
    return `${unit === '$' ? '$' : ''}${v.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${unit === '%' ? '%' : ''}`
  }
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all group">
      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
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
            {formatVal(value)}
          </span>
          {changePct !== null && (
            <span className={`text-xs font-mono ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-text-dim'}`}>
              {change !== null && change !== undefined ? `${change > 0 ? '+' : ''}${change.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ` : ''}
              ({changePct > 0 ? '+' : ''}{changePct}%)
            </span>
          )}
        </div>
        {previousClose !== null && previousClose !== undefined && (
          <p className="text-[9px] text-text-dim/60 font-mono mt-0.5">
            Vorige dag: {formatVal(previousClose)}
          </p>
        )}
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
  const [showConfidenceBreakdown, setShowConfidenceBreakdown] = useState(false)
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set())
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null)

  // Daily change indicators for track record stats
  const todayChanges = useMemo(() => {
    if (trackRecords.length === 0) return null
    const today = new Date().toISOString().split('T')[0]
    const todayRecords = trackRecords.filter(r => r.date === today)
    if (todayRecords.length === 0) return null
    const newTotal = todayRecords.length
    const newCorrect = todayRecords.filter(r => r.result === 'correct').length
    const newIncorrect = todayRecords.filter(r => r.result === 'incorrect').length
    const newPending = todayRecords.filter(r => r.result === 'pending').length
    // Win rate change: calculate what win rate would be without today's resolved trades
    const resolvedToday = todayRecords.filter(r => r.result !== 'pending').length
    const prevTotal = trackStats.total - newTotal
    const prevCorrect = trackStats.correct - newCorrect
    const prevResolved = prevTotal - (trackStats.pending - newPending)
    const prevWinRate = prevResolved > 0 ? Math.round((prevCorrect / prevResolved) * 100) : 0
    const winRateDiff = trackStats.winRate - prevWinRate
    return { total: newTotal, correct: newCorrect, incorrect: newIncorrect, pending: newPending, winRateDiff, resolvedToday }
  }, [trackRecords, trackStats])

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
        body: JSON.stringify({ days: 365 }),
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
  const tradeFocusResult = data ? getTradeFocus(data.pairBiases, data.todayEvents, data.currencyRanking) : { primary: [], watchlist: [] }
  const tradeFocus = tradeFocusResult.primary
  const watchlist = tradeFocusResult.watchlist

  const regimeColors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/25', glow: 'shadow-red-500/10' },
    green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/25', glow: 'shadow-green-500/10' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/25', glow: 'shadow-blue-500/10' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25', glow: 'shadow-amber-500/10' },
    gray: { bg: 'bg-white/[0.04]', text: 'text-text-muted', border: 'border-white/[0.08]', glow: '' },
  }

  const rc = regimeColors[data?.regimeColor || 'gray']

  const formatUpdateTime = (isoDate?: string) => {
    if (!isoDate) return ''
    try {
      return new Date(isoDate).toLocaleString('nl-NL', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam'
      }) + ' NL'
    } catch { return '' }
  }
  const lastUpdate = formatUpdateTime(data?.generatedAt)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* ── Test Banner ── */}
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

      {/* ── Summary Bar ── */}
      {data && (
        <SummaryBar
          regime={data.regime}
          regimeColor={data.regimeColor}
          confidence={data.confidence}
          topPairs={tradeFocus.slice(0, 3).map(t => ({ pair: t.pair, direction: t.isBullish ? 'bullish' : t.isBearish ? 'bearish' : 'neutraal', score: t.score }))}
          winRate={trackStats.winRate}
          totalTrades={trackStats.total}
          generatedAt={data.generatedAt}
          onRefresh={fetchData}
          loading={loading}
        />
      )}

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
          {/* High Impact Events — compact notice inside regime section handled below */}

          {/* ════════════════════════════════════════════════════════
              STAP 1: MACRO REGIME
              ════════════════════════════════════════════════════════ */}
          <section className="mb-2">
            <StepHeader
              step={1}
              title="Macro Regime"
              subtitle="Wat is het huidige marktklimaat? Gebaseerd op centraal bank beleid."
            />
            <div className="mb-3 ml-11" />

            <div className={`rounded-2xl border ${rc.border} ${rc.bg} overflow-hidden shadow-lg ${rc.glow}`}>
              {/* Regime header */}
              <div className="px-5 sm:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className={`w-3 h-3 rounded-full animate-pulse shrink-0 ${
                      data.regime === 'Risk-Off' ? 'bg-red-500' :
                      data.regime === 'Risk-On' ? 'bg-green-500' :
                      data.regime === 'USD Dominant' ? 'bg-blue-500' :
                      data.regime === 'USD Zwak' ? 'bg-amber-500' : 'bg-gray-500'
                    }`} />
                    <h2 className={`text-xl sm:text-2xl font-display font-bold ${rc.text}`}>{data.regime}</h2>
                    {lastUpdate && (
                      <span className="text-[9px] text-text-dim/50 font-normal hidden sm:inline">Laatste update: {lastUpdate}</span>
                    )}
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/[0.06] text-text-dim border border-white/[0.06]">
                      Bron: {data.regimeSource || 'centraal bank beleid'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ConfidenceRing value={data.regimeConfidence ?? data.confidence} size={48} />
                    <div className="text-right">
                      <p className="text-[10px] text-text-dim uppercase tracking-wider">Regime Zekerheid</p>
                      <p className="text-xs text-text-muted">
                        {(data.regimeConfidence ?? data.confidence) >= 70 ? 'Sterke consensus' : (data.regimeConfidence ?? data.confidence) >= 45 ? 'Gemengde signalen' : 'Zwakke consensus'}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-text-muted leading-relaxed mt-3">{data.regimeExplain}</p>

                {/* High Impact Events — compact inline */}
                {data.todayEvents.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/[0.04] border border-red-500/10">
                    <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider shrink-0">Events:</span>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {data.todayEvents.slice(0, 4).map((evt, i) => (
                        <span key={i} className="text-[10px] text-text-muted">
                          {flagEmoji(evt.flag)} <span className="font-mono text-heading">{evt.time}</span> {evt.title}
                        </span>
                      ))}
                      {data.todayEvents.length > 4 && (
                        <span className="text-[10px] text-text-dim">+{data.todayEvents.length - 4} meer</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Confidence Breakdown — clickable "Hoe berekend?" */}
                <div className="mt-3">
                  <button
                    onClick={() => setShowConfidenceBreakdown(!showConfidenceBreakdown)}
                    className="flex items-center gap-1.5 text-[11px] text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showConfidenceBreakdown ? 'rotate-90' : ''}`}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Hoe berekend? ({data.regimeConfidence ?? data.confidence}% regime zekerheid)
                  </button>
                  {showConfidenceBreakdown && (
                    <div className="mt-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <p className="text-[10px] text-text-dim mb-3 leading-relaxed">
                        De regime zekerheid geeft aan hoe duidelijk het centraal bank beeld is. Dit is puur gebaseerd op de spread tussen de sterkste en zwakste valuta. Hoe groter het verschil, hoe duidelijker het regime.
                      </p>
                      {/* Breakdown bars */}
                      {(() => {
                        const bd = data.confidenceBreakdown
                        const regConf = data.regimeConfidence ?? data.confidence
                        const spread = bd?.fundamentalSpread ?? 0
                        return (
                          <div className="space-y-2">
                            <div>
                              <div className="flex items-center justify-between text-[10px] mb-0.5">
                                <span className="text-text-muted">Fundamentele duidelijkheid</span>
                                <span className="font-mono text-heading">{regConf}%</span>
                              </div>
                              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${regConf >= 65 ? 'bg-green-500/60' : regConf >= 40 ? 'bg-amber-500/60' : 'bg-red-500/60'}`} style={{ width: `${Math.min(100, regConf)}%` }} />
                              </div>
                              <p className="text-[9px] text-text-dim/50 mt-0.5">
                                Spread van {spread.toFixed ? spread.toFixed(1) : spread} punten tussen sterkste en zwakste valuta. Een spread van 6+ = zeer duidelijk, 4+ = duidelijk, 2+ = onduidelijk.
                              </p>
                            </div>
                            <div className="pt-2 mt-2 border-t border-white/[0.05] text-[10px] font-mono text-text-dim">
                              Regime zekerheid: {regConf}%
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>

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
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-[10px] font-semibold text-text-dim uppercase tracking-wider">Valuta Sterkte: van sterk naar zwak</p>
                    <span className="text-[8px] text-text-dim/50">(klik voor detail)</span>
                  </div>
                  <div className="mb-3">
                    <ScoreLegend />
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
                      <div key={ccy.currency} className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] transition-all duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-heading">{ccy.currency}: Score Opbouw</p>
                          <button onClick={(e) => { e.stopPropagation(); setExpandedCurrency(null) }} className="text-text-dim hover:text-heading p-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {/* CB Bias */}
                          <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-white/[0.02]">
                            <span className="text-text-dim">CB Beleid ({ccy.bank || '\u2014'}): <span className="text-text-muted">{ccy.bias || 'onbekend'}</span></span>
                            <span className={`font-mono font-bold ${ccy.baseScore > 0 ? 'text-green-400' : ccy.baseScore < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                              {ccy.baseScore > 0 ? '+' : ''}{ccy.baseScore.toFixed(1)}
                            </span>
                          </div>
                          {/* Rate */}
                          {ccy.rate !== null && (
                            <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-white/[0.02]">
                              <span className="text-text-dim">Rente: <span className="text-text-muted">{ccy.rate}%</span></span>
                              <span className="text-[10px] text-text-dim">(onderdeel van basis score)</span>
                            </div>
                          )}
                          {/* News bonus */}
                          <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-white/[0.02]">
                            <span className="text-text-dim">Nieuws sentiment bonus</span>
                            <span className={`font-mono font-bold ${ccy.newsBonus > 0 ? 'text-green-400' : ccy.newsBonus < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                              {ccy.newsBonus > 0 ? '+' : ''}{ccy.newsBonus.toFixed(1)}
                            </span>
                          </div>
                          {/* Total */}
                          <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-accent/5 border border-accent/10 font-semibold">
                            <span className="text-text-muted">Totaal = CB basis + nieuws</span>
                            <span className={`font-mono font-bold ${ccy.score > 0 ? 'text-green-400' : ccy.score < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                              {ccy.baseScore > 0 ? '+' : ''}{ccy.baseScore.toFixed(1)} {ccy.newsBonus >= 0 ? '+' : ''} {ccy.newsBonus.toFixed(1)} = {ccy.score > 0 ? '+' : ''}{ccy.score.toFixed(1)}
                            </span>
                          </div>
                          {/* Reasons */}
                          {ccy.reasons && ccy.reasons.length > 0 && (
                            <div className="mt-2">
                              <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1">Redenen:</p>
                              <div className="space-y-0.5">
                                {ccy.reasons.map((r, ri) => (
                                  <p key={ri} className="text-[10px] text-text-dim flex items-start gap-1">
                                    <span className="text-accent-light shrink-0">&rsaquo;</span> {r}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* News Headlines */}
                          {ccy.newsHeadlines && ccy.newsHeadlines.length > 0 && (
                            <div className="mt-2">
                              <p className="text-[10px] text-text-dim uppercase tracking-wider mb-1">Nieuws headlines:</p>
                              <div className="space-y-0.5">
                                {ccy.newsHeadlines.map((h, hi) => (
                                  <p key={hi} className="text-[10px] text-text-muted flex items-start gap-1 leading-relaxed">
                                    <span className="text-accent-light shrink-0">&rsaquo;</span> {h}
                                  </p>
                                ))}
                              </div>
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
            <div className="mb-3 ml-11" />

            <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
              {/* Sentiment Grid */}
              <div className="px-4 sm:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-medium">Sentiment per Valuta</p>
                    <span className="text-[8px] text-text-dim/50">(klik voor detail)</span>
                  </div>
                  {(data.newsLastUpdated || data.newsCount) && (
                    <div className="sm:text-right">
                      {data.newsLastUpdated && (
                        <p className="text-[9px] text-text-dim/60">
                          Laatste update: <span className="text-text-dim">{timeAgoDutch(data.newsLastUpdated)}</span>
                        </p>
                      )}
                      {data.newsCount !== undefined && (
                        <p className="text-[9px] text-text-dim/50">
                          Op basis van {data.newsCount} artikelen (afgelopen 3 dagen)
                        </p>
                      )}
                    </div>
                  )}
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
                    <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] transition-all duration-200">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-heading">{expandedSentiment}: Nieuws Sentiment Detail</p>
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
                          <span className="text-text-dim/60">&rarr;</span>
                          <span className="text-text-muted">{s.sentiment}</span>
                        </div>
                        {ccyRank && (
                          <div className="flex items-center gap-2 sm:gap-3 text-[11px] flex-wrap">
                            <span className="text-text-dim">CB basis:</span>
                            <span className="font-mono font-bold text-heading">{ccyRank.baseScore > 0 ? '+' : ''}{ccyRank.baseScore.toFixed(1)}</span>
                            <span className="text-text-dim/60">+</span>
                            <span className="text-text-dim">nieuws:</span>
                            <span className={`font-mono font-bold ${ccyRank.newsBonus > 0 ? 'text-green-400' : ccyRank.newsBonus < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                              {ccyRank.newsBonus > 0 ? '+' : ''}{ccyRank.newsBonus.toFixed(1)}
                            </span>
                            <span className="text-text-dim/60">=</span>
                            <span className={`font-mono font-bold ${ccyRank.score > 0 ? 'text-green-400' : ccyRank.score < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                              {ccyRank.score > 0 ? '+' : ''}{ccyRank.score.toFixed(1)}
                            </span>
                          </div>
                        )}
                        {ccyRank && ccyRank.newsBonus !== 0 && (
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="text-text-dim">Toegepaste bonus (max &plusmn;2.0):</span>
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
                        {/* Empty state: no headlines */}
                        {s.headlines.length === 0 && (
                          <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                            <p className="text-[10px] text-text-muted leading-relaxed">
                              <strong className="text-heading">Geen recente headlines gevonden</strong> voor {expandedSentiment} in de afgelopen 72 uur
                              die een duidelijk hawkish of bearish signaal bevatten.
                            </p>
                            <p className="text-[10px] text-text-dim mt-1 leading-relaxed">
                              Dit betekent dat de score voor {expandedSentiment} volledig op CB-beleid en rente is gebaseerd.
                              Het nieuws versterkt noch verzwakt de fundamentele bias op dit moment.
                            </p>
                          </div>
                        )}
                        <p className="text-[9px] text-text-dim/60 leading-relaxed">
                          De score wordt berekend op basis van bullish/bearish keywords in recente nieuwsartikelen,
                          gewogen naar relevantie en hoe recent het artikel is. De bonus wordt gecapt op &plusmn;2.0 om ruis te beperken.
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

              {/* Top News Headlines (collapsible) */}
              {data.topNews.length > 0 && (
                <div className="border-t border-white/[0.04]">
                  <details className="group">
                    <summary className="px-5 sm:px-6 py-3 flex items-center gap-2 cursor-pointer hover:bg-white/[0.02] transition-colors list-none [&::-webkit-details-marker]:hidden">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim transition-transform group-open:rotate-90 shrink-0">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-medium">Belangrijkste Headlines ({data.topNews.slice(0, 8).length} artikelen)</p>
                    </summary>
                    <div className="divide-y divide-white/[0.03] border-t border-white/[0.04]">
                      {data.topNews.slice(0, 8).map(article => (
                        <a
                          key={article.id}
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block px-5 sm:px-6 py-3 hover:bg-white/[0.02] transition-colors group/link"
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
                              <p className="text-sm text-heading group-hover/link:text-accent-light transition-colors leading-snug">
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
                  </details>
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
                            Het nieuws-effect is begrensd op maximaal +-2.0 punten per valuta. Dit voorkomt dat een enkele nieuwsgolf de fundamentele analyse volledig overstemt. CB beleid blijft altijd de basis.
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
            <div className="mb-3 ml-11" />

            <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
              <div className="px-5 sm:px-6 py-4">
                {lastUpdate && (
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] text-text-dim/50">Laatste update: {lastUpdate}</span>
                    <span className="text-[9px] text-text-dim/40">Koersen via Yahoo Finance · Cache: 5 minuten · Ververs de pagina voor actuele data</span>
                  </div>
                )}
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
                      previousClose={signal.previousClose}
                      change={signal.change}
                    />
                  ))}
                </div>

                {/* Conclusion + Alignment Score */}
                {intermarketConclusion && (() => {
                  const alignment = data.intermarketAlignment
                  const alignColor = alignment !== undefined
                    ? (alignment > 65 ? 'text-green-400' : alignment >= 35 ? 'text-amber-400' : 'text-red-400')
                    : ''
                  const alignBg = alignment !== undefined
                    ? (alignment > 65 ? 'bg-green-500/[0.06] border-green-500/20' : alignment >= 35 ? 'bg-amber-500/[0.06] border-amber-500/20' : 'bg-red-500/[0.06] border-red-500/20')
                    : (intermarketConclusion.sentiment === 'risk-off' ? 'bg-red-500/[0.06] border-red-500/20' :
                       intermarketConclusion.sentiment === 'risk-on' ? 'bg-green-500/[0.06] border-green-500/20' :
                       'bg-white/[0.03] border-border')
                  return (
                    <div className={`p-4 rounded-xl border ${alignBg}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Conclusie</p>
                            {alignment !== undefined && (
                              <>
                                <span className={`text-sm font-mono font-bold ${alignColor}`}>
                                  {alignment}%
                                </span>
                                <AlignmentLabel value={alignment} />
                              </>
                            )}
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
                          {alignment !== undefined && (
                            <div className="mt-2">
                              <details className="group/im">
                                <summary className="flex items-center gap-1.5 text-[10px] text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors list-none [&::-webkit-details-marker]:hidden">
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open/im:rotate-90 shrink-0">
                                    <polyline points="9 18 15 12 9 6" />
                                  </svg>
                                  Wat betekent {alignment}% alignment?
                                </summary>
                                <div className="mt-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                                  <p className="text-[10px] text-text-dim leading-relaxed">
                                    {alignment < 30
                                      ? `Slechts ${alignment}% van de intermarket indicatoren bevestigt het regime. Dit betekent dat goud, VIX, S&P 500 en obligatierentes niet in lijn bewegen met het verwachte patroon. Signalen zijn daardoor minder betrouwbaar.`
                                      : alignment <= 60
                                      ? `${alignment}% van de indicatoren bevestigt het regime. Gemengd beeld — sommige instrumenten bewegen mee, andere niet. Voorzichtigheid geboden bij het innemen van posities.`
                                      : `${alignment}% van de indicatoren bevestigt het regime. Sterk signaal — goud, VIX, S&P 500 en obligatierentes bewegen in lijn met het verwachte patroon. Intermarket data ondersteunt de fundamentele analyse.`
                                    }
                                  </p>
                                  <p className="text-[9px] text-text-dim/50 mt-1.5">
                                    Berekening: per signaal wordt gecheckt of de richting het regime bevestigt. De sterkte weegt mee: &gt;1% = vol gewicht, 0.5-1% = 75%, 0.2-0.5% = 50%, &lt;0.2% = 25%. Totaal / maximum = alignment %.
                                  </p>
                                </div>
                              </details>
                            </div>
                          )}
                        </div>
                        <div className="ml-4 shrink-0">
                          <ConfidenceRing value={alignment ?? data.confidence} size={56} />
                        </div>
                      </div>
                    </div>
                  )
                })()}
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
                        Ze veranderen het regime niet, maar verhogen of verlagen de zekerheid score.
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
                        Als intermarket signalen het regime bevestigen, wordt de zekerheid score verhoogd.
                        Bij conflict blijft het regime gelijk maar de zekerheid score wordt verlaagd, wat leidt tot meer selectieve trade suggesties.
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
                ? `Intermarket bevestigt het ${data.regime} regime. Nu filteren we de paren naar concrete trades...`
                : `Intermarket geeft gemengde signalen. Extra streng filteren naar alleen de sterkste setups.`
            }
          />

          {/* ════════════════════════════════════════════════════════
              STAP 4: TRADE FOCUS (FILTER FUNNEL)
              ════════════════════════════════════════════════════════ */}
          <section className="mb-2">
            <StepHeader
              step={4}
              title="Trade Focus"
              subtitle="Filterproces: welke paren overleven alle criteria?"
            />
            <div className="mb-3 ml-11" />

            {(() => {
              const totalPairs = data.pairBiases.length
              const scorePass = data.pairBiases.filter(p => Math.abs(p.score) >= 2.0 && p.direction !== 'neutraal')
              const imAlignment = data.intermarketAlignment ?? 0
              const imPass = imAlignment > 50 ? scorePass : scorePass.filter(p => Math.abs(p.score) >= 3.5)
              const finalCount = tradeFocus.length

              return (
                <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
                  {/* Compact funnel visualization */}
                  <div className="px-5 sm:px-6 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-medium">Filter Funnel</p>
                      {lastUpdate && <span className="text-[9px] text-text-dim/50 ml-auto">Update: {lastUpdate}</span>}
                    </div>

                    {/* Funnel steps */}
                    <div className="space-y-1.5">
                      {/* Step: All pairs */}
                      <div className="flex items-center gap-3">
                        <div className="w-full">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-text-dim">Alle geanalyseerde paren</span>
                            <span className="text-xs font-mono font-bold text-heading">{totalPairs}</span>
                          </div>
                          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-white/[0.15]" style={{ width: '100%' }} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-dim/40"><polyline points="6 9 12 15 18 9" /></svg>
                        <span className="text-[9px] text-text-dim/50 ml-1">Score &ge; 2.0 + richting</span>
                      </div>

                      {/* Step: Score filter */}
                      <div className="flex items-center gap-3">
                        <div className="w-full">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-text-dim">Fundamentele divergentie (score &ge; 2.0)</span>
                            <span className="text-xs font-mono font-bold text-amber-400">{scorePass.length}</span>
                          </div>
                          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-amber-500/40" style={{ width: `${Math.max(5, (scorePass.length / totalPairs) * 100)}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-dim/40"><polyline points="6 9 12 15 18 9" /></svg>
                        <span className="text-[9px] text-text-dim/50 ml-1">+ IM bevestiging + regime + contrarian</span>
                      </div>

                      {/* Step: Final trades */}
                      <div className="flex items-center gap-3">
                        <div className="w-full">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-text-muted font-semibold">Concrete trades (alle filters)</span>
                            <span className="text-xs font-mono font-bold text-green-400">{finalCount}</span>
                          </div>
                          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-green-500/50" style={{ width: `${Math.max(5, (finalCount / totalPairs) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Compact summary */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="text-[9px] px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-text-dim">
                        Score &ge; 3.0
                      </span>
                      <span className="text-[9px] px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-text-dim inline-flex items-center gap-1.5">
                        IM alignment: {imAlignment}% <AlignmentLabel value={imAlignment} />
                      </span>
                      <span className="text-[9px] px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-text-dim">
                        Regime: {data.regime}
                      </span>
                      <span className="text-[9px] px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-text-dim">
                        Contrarian timing
                      </span>
                    </div>
                  </div>

                  {/* Collapsible: Divergence Alerts */}
                  {data.divergences && Object.keys(data.divergences).length > 0 && (
                    <div className="px-5 sm:px-6 pb-3 border-t border-white/[0.04]">
                      <details className="group">
                        <summary className="flex items-center gap-2 py-2 text-[11px] text-amber-400/70 cursor-pointer hover:text-amber-400 transition-colors">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          Divergentie alerts ({Object.keys(data.divergences).filter(k => data.divergences![k].hasDivergence).length})
                        </summary>
                        <div className="mt-1">
                          <DivergenceAlert divergences={data.divergences} />
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Collapsible: Watchlist */}
                  {watchlist.length > 0 && (
                    <div className="px-5 sm:px-6 pb-3 border-t border-white/[0.04]">
                      <details className="group">
                        <summary className="flex items-center gap-2 py-2 text-[11px] text-text-dim cursor-pointer hover:text-text-muted transition-colors">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          Watchlist ({watchlist.length} paren, score 2.0-3.0)
                        </summary>
                        <div className="mt-1 divide-y divide-white/[0.03]">
                          {watchlist.map(wp => {
                            const wIsBullish = wp.direction.includes('bullish')
                            const wIsBearish = wp.direction.includes('bearish')
                            return (
                              <div key={wp.pair} className="px-2 py-1.5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-[11px] text-text-muted">{wp.pair}</span>
                                  <span className={`text-[10px] ${wIsBullish ? 'text-green-400' : wIsBearish ? 'text-red-400' : 'text-text-dim'}`}>
                                    {wIsBullish ? '\u25B2' : wIsBearish ? '\u25BC' : '\u2014'} {wp.direction}
                                  </span>
                                </div>
                                <span className={`text-[10px] font-mono font-bold ${wp.score > 0 ? 'text-green-400/70' : wp.score < 0 ? 'text-red-400/70' : 'text-text-dim'}`}>
                                  {wp.score > 0 ? '+' : ''}{wp.score}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Collapsible: All pairs table */}
                  <div className="px-5 sm:px-6 pb-3 border-t border-white/[0.04]">
                    <details className="group">
                      <summary className="flex items-center gap-2 py-2 text-[11px] text-text-dim cursor-pointer hover:text-text-muted transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        Alle {totalPairs} paren bekijken (gesorteerd op divergentie)
                      </summary>
                      <div className="mt-1 mb-2">
                        <ScoreLegend />
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="border-b border-white/[0.04]">
                              <th className="px-2 py-1.5 text-left text-text-dim font-medium">Paar</th>
                              <th className="px-2 py-1.5 text-left text-text-dim font-medium">Richting</th>
                              <th className="px-2 py-1.5 text-center text-text-dim font-medium">Score</th>
                              <th className="px-2 py-1.5 text-left text-text-dim font-medium">Overtuiging</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.pairBiases.map(pair => (
                              <tr key={pair.pair} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                                <td className="px-2 py-1.5 font-mono font-bold text-heading">{pair.pair}</td>
                                <td className="px-2 py-1.5">
                                  <span className={`text-[9px] font-bold ${
                                    pair.direction.includes('bullish') ? 'text-green-400' :
                                    pair.direction.includes('bearish') ? 'text-red-400' :
                                    'text-text-dim'
                                  }`}>{pair.direction}</span>
                                </td>
                                <td className="px-2 py-1.5 text-center font-mono font-bold">
                                  <span className={pair.score > 0 ? 'text-green-400' : pair.score < 0 ? 'text-red-400' : 'text-text-dim'}>
                                    {pair.score > 0 ? '+' : ''}{pair.score}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5">
                                  <span className={`text-[9px] ${
                                    pair.conviction === 'sterk' ? 'text-accent-light font-bold' :
                                    pair.conviction === 'matig' ? 'text-text-muted' :
                                    'text-text-dim'
                                  }`}>{pair.conviction}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </div>

                  {/* Collapsible: How trade focus works */}
                  <div className="px-5 sm:px-6 pb-4 border-t border-white/[0.04]">
                    <details className="group">
                      <summary className="flex items-center gap-2 py-2 text-[11px] text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        Hoe werkt het filterproces?
                      </summary>
                      <div className="mt-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                        <div className="space-y-2 text-[10px] text-text-dim leading-relaxed">
                          <p>Elk paar doorloopt 4 filters. Alleen paren die alle 4 passeren worden een concrete trade:</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04] text-center">
                              <p className="text-accent-light font-semibold">1. Fundamenteel</p>
                              <p className="text-[9px]">Score &ge; 3.0</p>
                            </div>
                            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04] text-center">
                              <p className="text-accent-light font-semibold">2. Regime</p>
                              <p className="text-[9px]">Past bij huidig regime</p>
                            </div>
                            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04] text-center">
                              <p className="text-accent-light font-semibold">3. Intermarket</p>
                              <p className="text-[9px]">IM alignment &gt; 50%</p>
                            </div>
                            <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04] text-center">
                              <p className="text-accent-light font-semibold">4. Contrarian</p>
                              <p className="text-[9px]">Prijs tegen richting (5d)</p>
                            </div>
                          </div>
                          <p>
                            <strong className="text-text-muted">Mean Reversion:</strong> Het model koopt wanneer de prijs tijdelijk tegen de fundamentele richting ingaat. Holding: 1 handelsdag.
                          </p>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              )
            })()}
          </section>

          {/* Bridge: Filter → Concrete Trades */}
          <StepBridge
            icon="arrow"
            text={
              tradeFocus.length > 0
                ? `${tradeFocus.length} ${tradeFocus.length === 1 ? 'paar heeft' : 'paren hebben'} alle filters gepasseerd. Hieronder de concrete trades met call en tijdstip.`
                : 'Geen paren door alle filters. Wacht op duidelijkere setups.'
            }
          />

          {/* ════════════════════════════════════════════════════════
              STAP 5: CONCRETE TRADES (FINAL OUTPUT)
              ════════════════════════════════════════════════════════ */}
          <section className="mb-8">
            <StepHeader
              step={5}
              title="Concrete Trades"
              subtitle="Alle kwalificerende signalen met call, tijdstip en entry/exit."
            />
            <div className="mb-3 ml-11" />

            {/* Score legenda */}
            <div className="mb-4 rounded-xl bg-white/[0.02] border border-white/[0.06] px-4 py-3">
              <p className="text-[10px] font-semibold text-heading uppercase tracking-wider mb-2">Hoe lees je de score?</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                  <span className="text-text-muted"><strong className="text-green-400">≥ 5.0</strong> = sterk signaal</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent-light shrink-0" />
                  <span className="text-text-muted"><strong className="text-accent-light">3.0 – 5.0</strong> = goed signaal</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-text-muted"><strong className="text-amber-400">2.0 – 3.0</strong> = watchlist</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-text-dim shrink-0" />
                  <span className="text-text-muted"><strong className="text-text-dim">&lt; 2.0</strong> = geen signaal</span>
                </div>
              </div>
              <p className="text-[9px] text-text-dim mt-2">De score is opgebouwd uit: CB beleid (x2) + renteverschil (x1.5) + nieuws bonus. Overtuiging: sterk (&ge;5), matig (3-5). Hoe hoger de score, hoe sterker de fundamentele onderbouwing.</p>
            </div>

            {tradeFocus.length > 0 ? (
              <div className="space-y-3">
                {tradeFocus.map((trade, i) => {
                  const pairData = data.pairBiases.find(p => p.pair === trade.pair)
                  const callTimestamp = data.generatedAt
                    ? new Date(data.generatedAt).toLocaleString('nl-NL', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                        timeZone: 'Europe/Amsterdam'
                      }) + ' NL'
                    : 'vandaag'

                  return (
                    <div key={trade.pair} className={`rounded-2xl border overflow-hidden ${
                      trade.isBullish ? 'border-green-500/25 bg-gradient-to-br from-green-500/[0.04] to-bg-card' :
                      trade.isBearish ? 'border-red-500/25 bg-gradient-to-br from-red-500/[0.04] to-bg-card' :
                      'border-border bg-bg-card'
                    }`}>
                      {/* Trade card header */}
                      <div className="px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                            trade.isBullish ? 'bg-green-500/15 text-green-400' :
                            trade.isBearish ? 'bg-red-500/15 text-red-400' :
                            'bg-white/[0.06] text-text-dim'
                          }`}>
                            {trade.isBullish ? '\u25B2' : trade.isBearish ? '\u25BC' : '\u2014'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xl font-display font-bold text-heading">{trade.pair}</h3>
                              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                trade.isBullish ? 'bg-green-500/15 text-green-400 border border-green-500/20' :
                                trade.isBearish ? 'bg-red-500/15 text-red-400 border border-red-500/20' :
                                'bg-white/[0.06] text-text-dim border border-white/[0.08]'
                              }`}>
                                {trade.isBullish ? 'LONG' : trade.isBearish ? 'SHORT' : 'NEUTRAAL'}
                              </span>
                            </div>
                            <p className="text-[11px] text-text-muted mt-0.5">{trade.action}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {pairData?.confluence && <ConfluenceMeter confluence={pairData.confluence} />}
                          <div className="text-right">
                            <p className={`text-2xl font-mono font-bold ${
                              trade.score > 0 ? 'text-green-400' : trade.score < 0 ? 'text-red-400' : 'text-text-dim'
                            }`}>{trade.score > 0 ? '+' : ''}{trade.score}</p>
                            <p className="text-[9px] text-text-dim">{trade.conviction} overtuiging</p>
                            <p className="text-[8px] text-text-dim/50 mt-0.5">{Math.abs(trade.score) >= 3.0 ? 'Trade Focus' : Math.abs(trade.score) >= 2.0 ? 'Watchlist' : 'Geen signaal'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Trade details grid */}
                      <div className="px-5 py-3 border-t border-white/[0.06]">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                          <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                            <span className="text-[9px] text-text-dim uppercase tracking-wider block mb-0.5">Call</span>
                            <span className="text-[11px] font-mono font-semibold text-accent-light">{callTimestamp}</span>
                          </div>
                          <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                            <span className="text-[9px] text-text-dim uppercase tracking-wider block mb-0.5">Entry</span>
                            <span className="text-[11px] font-mono font-semibold text-text-muted">dagkoers vandaag</span>
                          </div>
                          <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                            <span className="text-[9px] text-text-dim uppercase tracking-wider block mb-0.5">Exit</span>
                            <span className="text-[11px] font-mono font-semibold text-text-muted">dagkoers +1 handelsdag</span>
                          </div>
                          <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                            <span className="text-[9px] text-text-dim uppercase tracking-wider block mb-0.5">Methode</span>
                            <span className="text-[11px] font-mono font-semibold text-purple-400/80">mean reversion</span>
                          </div>
                        </div>

                        {/* Regime context */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[9px] text-text-dim uppercase tracking-wider">Regime:</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${rc.bg} ${rc.text} ${rc.border}`}>{data.regime}</span>
                        </div>

                        {/* Filter badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 text-green-400/80 border border-green-500/15 font-medium">&#x2713; Fund ({trade.score > 0 ? '+' : ''}{trade.score})</span>
                          <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 text-green-400/80 border border-green-500/15 font-medium">&#x2713; Regime</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${
                            (data.intermarketAlignment ?? 0) > 50
                              ? 'bg-green-500/10 text-green-400/80 border border-green-500/15'
                              : 'bg-amber-500/10 text-amber-400/80 border border-amber-500/15'
                          }`}>&#x2713; Inter {data.intermarketAlignment ?? '?'}%</span>
                          <span className="text-[9px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400/80 border border-purple-500/15 font-medium">&#x2713; Contrarian</span>
                        </div>

                        {/* Score breakdown compact */}
                        <div className="flex items-center gap-3 text-[10px]">
                          <span className="text-text-dim">Basis: <span className="font-mono font-bold text-text-muted">{trade.scoreWithoutNews > 0 ? '+' : ''}{trade.scoreWithoutNews}</span></span>
                          {trade.newsInfluence !== 0 && (
                            <span className="text-text-dim">Nieuws: <span className={`font-mono font-bold ${trade.newsInfluence > 0 ? 'text-green-400' : 'text-red-400'}`}>{trade.newsInfluence > 0 ? '+' : ''}{trade.newsInfluence}</span></span>
                          )}
                        </div>

                        {/* Event warning */}
                        {trade.eventWarning && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            <span className="text-[10px] text-amber-300">Let op: {trade.eventWarning}</span>
                          </div>
                        )}

                        {/* Collapsible: Details */}
                        <details className="mt-3 group">
                          <summary className="flex items-center gap-2 text-[11px] text-accent-light/60 cursor-pointer hover:text-accent-light transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                            Waarom dit paar?
                          </summary>
                          <div className="mt-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                            <div className="space-y-2">
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
                              {(trade.baseBias || trade.quoteBias) && (
                                <div className="text-[10px] text-text-dim">
                                  {trade.baseBias && <span className="mr-3">{trade.base}: {trade.baseBias}</span>}
                                  {trade.quoteBias && <span>{trade.quote}: {trade.quoteBias}</span>}
                                </div>
                              )}
                              {trade.rateDiff !== null && trade.rateDiff !== 0 && (
                                <p className="text-[10px] text-text-dim">Renteverschil: {trade.rateDiff > 0 ? '+' : ''}{trade.rateDiff}%</p>
                              )}
                              {trade.explanation.length > 0 && (
                                <div className="space-y-0.5">
                                  {trade.explanation.map((exp, j) => (
                                    <p key={j} className="text-[10px] text-text-dim flex items-start gap-1">
                                      <span className="text-accent-light shrink-0">&rsaquo;</span> {exp}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-bg-card border border-border text-center">
                <p className="text-sm text-text-muted">Geen paren door alle filters vandaag.</p>
                <p className="text-[10px] text-text-dim mt-1">Wacht op duidelijkere fundamentele divergenties of check de watchlist in Stap 4.</p>
              </div>
            )}

            {/* V3 signals overview — collapsible */}
            {data?.v3 && (
              <div className="mt-4 rounded-2xl border border-border bg-bg-card overflow-hidden">
                <details className="group">
                  <summary className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-dim"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-medium">Alle Signalen (Detail)</span>
                      <span className="text-[9px] text-text-dim/50">
                        {data.v3.metadata.signalCount.tradeable} tradeable / {data.v3.metadata.signalCount.conditional} conditional / {data.v3.metadata.signalCount.noTrade} no-trade
                      </span>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-dim transition-transform group-open:rotate-180">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </summary>
                  <div className="px-5 pb-4 border-t border-white/[0.04]">
                    <div className="mt-3 overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="text-text-dim border-b border-white/[0.04]">
                            <th className="text-left py-1 px-1">Paar</th>
                            <th className="text-left py-1 px-1">Signaal</th>
                            <th className="text-right py-1 px-1">Score</th>
                            <th className="text-right py-1 px-1">Conv.</th>
                            <th className="text-right py-1 px-1">IM%</th>
                            <th className="text-center py-1 px-1">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.v3.pairSignals.map((sig: { pair: string; signal: string; score: number; conviction: number; intermarket: { alignment: number }; tradeability: { status: string } }) => (
                            <tr key={sig.pair} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                              <td className="py-1 px-1 font-mono text-heading">{sig.pair}</td>
                              <td className={`py-1 px-1 ${
                                sig.signal.includes('bullish') ? 'text-green-400' :
                                sig.signal.includes('bearish') ? 'text-red-400' : 'text-text-dim'
                              }`}>{sig.signal.replace(/_/g, ' ')}</td>
                              <td className={`py-1 px-1 text-right font-mono ${sig.score > 0 ? 'text-green-400' : sig.score < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                                {sig.score > 0 ? '+' : ''}{sig.score}
                              </td>
                              <td className="py-1 px-1 text-right font-mono text-text-muted">{sig.conviction}%</td>
                              <td className="py-1 px-1 text-right font-mono text-text-muted">{sig.intermarket.alignment}%</td>
                              <td className="py-1 px-1 text-center">
                                <span className={`inline-block w-2 h-2 rounded-full ${
                                  sig.tradeability.status === 'tradeable' ? 'bg-green-400' :
                                  sig.tradeability.status === 'conditional' ? 'bg-amber-400' : 'bg-red-400'
                                }`} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </section>

          {/* ── Trackrecord (collapsible footer section) ── */}
          <section className="mb-8">
            <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
              <button
                onClick={() => setShowTrackRecord(!showTrackRecord)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-light">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  <span className="text-sm font-semibold text-heading">Trackrecord</span>
                  {trackStats.total > 0 && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      trackStats.winRate >= 60 ? 'bg-green-500/15 text-green-400' :
                      trackStats.winRate >= 40 ? 'bg-amber-500/15 text-amber-400' :
                      'bg-red-500/15 text-red-400'
                    }`}>
                      {trackStats.winRate}% win rate ({trackStats.total} trades)
                    </span>
                  )}
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-text-dim transition-transform ${showTrackRecord ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showTrackRecord && (
                <div className="px-5 pb-5 border-t border-white/[0.04]">
                  {trackStats.startDate && (
                    <div className="mt-3 mb-2 flex items-center gap-2 text-[10px] text-text-dim">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>Tracking actief sinds <strong className="text-text-muted">{trackStats.startDate}</strong></span>
                    </div>
                  )}

                  <div className="mt-2 mb-3 p-2.5 rounded-lg bg-accent/[0.04] border border-accent/10">
                    <p className="text-[10px] text-text-dim leading-relaxed">
                      Dit trackrecord wordt automatisch bijgewerkt op elke handelsdag om 23:00 uur (NL tijd). Nieuwe signalen worden dagelijks gegenereerd en openstaande trades worden na 1 handelsdag afgerekend op basis van de slotkoers. Zo blijven de winrate en statistieken altijd actueel.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3 mb-4">
                    {[
                      { label: 'Totaal', value: trackStats.total, color: 'text-heading', daily: todayChanges ? todayChanges.total : 0, isPercent: false },
                      { label: 'Correct', value: trackStats.correct, color: 'text-green-400', daily: todayChanges ? todayChanges.correct : 0, isPercent: false },
                      { label: 'Incorrect', value: trackStats.incorrect, color: 'text-red-400', daily: todayChanges ? todayChanges.incorrect : 0, isPercent: false },
                      { label: 'Pending', value: trackStats.pending, color: 'text-amber-400', daily: todayChanges ? todayChanges.pending : 0, isPercent: false },
                      { label: 'Win Rate', value: `${trackStats.winRate}%`, color: trackStats.winRate >= 55 ? 'text-green-400' : trackStats.winRate >= 45 ? 'text-amber-400' : 'text-red-400', daily: todayChanges ? todayChanges.winRateDiff : 0, isPercent: true },
                    ].map(stat => (
                      <div key={stat.label} className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                        <p className={`text-lg font-mono font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-[9px] text-text-dim">{stat.label}</p>
                        {todayChanges ? (
                          <p className={`text-[9px] mt-0.5 font-mono ${stat.daily > 0 ? 'text-green-400' : stat.daily < 0 ? 'text-red-400' : 'text-text-dim/50'}`}>
                            {stat.daily > 0 ? `+${stat.daily}` : stat.daily < 0 ? `${stat.daily}` : '0'}{stat.isPercent ? '%' : ''}
                          </p>
                        ) : (
                          <p className="text-[9px] mt-0.5 text-text-dim/30">geen nieuwe</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {trackStats.newsInfluenced && trackStats.newsInfluenced.total > 0 && (
                    <div className="mb-4 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                      <div className="flex items-center gap-4 text-[10px]">
                        <span className="text-text-muted">Trades met nieuws invloed: <strong className="text-heading">{trackStats.newsInfluenced.total}</strong></span>
                        <span className={`font-mono font-bold ${trackStats.newsInfluenced.winRate >= 55 ? 'text-green-400' : 'text-amber-400'}`}>{trackStats.newsInfluenced.winRate}% win rate</span>
                      </div>
                    </div>
                  )}

                  <div className="mb-4 flex items-center gap-3">
                    <button onClick={handleBackfill} disabled={backfilling} className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-accent/30 bg-accent/10 text-accent-light hover:bg-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      {backfilling ? (
                        <span className="flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                          Backfill bezig...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                          Backfill 365 dagen
                        </span>
                      )}
                    </button>
                    {backfillMsg && <span className="text-[10px] text-text-muted">{backfillMsg}</span>}
                  </div>

                  {trackRecords.length > 0 && (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {trackRecords.slice(0, 40).map(record => {
                        const meta = record.metadata as TrackRecordMetadata | undefined
                        const formatCallTime = () => {
                          if (meta?.callTime) {
                            try {
                              return new Date(meta.callTime).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) + ' NL'
                            } catch { /* fall through */ }
                          }
                          return record.date || ''
                        }
                        return (
                          <div key={record.id} className="rounded-lg bg-white/[0.02] border border-white/[0.04] overflow-hidden">
                            <div className={`px-3 py-1.5 flex items-center justify-between ${
                              record.direction.includes('bullish') ? 'bg-gradient-to-r from-green-500/[0.04] to-transparent' : 'bg-gradient-to-r from-red-500/[0.04] to-transparent'
                            }`}>
                              <div className="flex items-center gap-2">
                                <span className="text-text-dim font-mono text-[10px]">{record.date}</span>
                                <span className="font-semibold text-heading font-mono text-[11px]">{record.pair}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                  record.direction.includes('bullish') ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                                }`}>{record.direction.includes('bullish') ? '\u25B2' : '\u25BC'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-mono font-bold ${record.score > 0 ? 'text-green-400' : 'text-red-400'}`}>{record.score > 0 ? '+' : ''}{record.score}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                  record.result === 'correct' ? 'bg-green-500/15 text-green-400' : record.result === 'incorrect' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/10 text-amber-400'
                                }`}>{record.result === 'correct' ? '\u2713' : record.result === 'incorrect' ? '\u2717' : '\u23F3'}</span>
                              </div>
                            </div>
                            <div className="px-3 py-1.5 border-t border-white/[0.03] flex flex-wrap items-center gap-3 text-[9px] text-text-dim">
                              <span>Call: <span className="font-mono text-accent-light/70">{formatCallTime()}</span></span>
                              <span>Entry: <span className="font-mono text-text-muted">{record.entry_price ?? '—'}</span></span>
                              <span>Exit: <span className="font-mono text-text-muted">{record.exit_price ?? '—'}</span></span>
                              {record.pips_moved !== null && (
                                <span>Pips: <span className={`font-mono font-bold ${record.pips_moved > 0 ? 'text-green-400' : 'text-red-400'}`}>{record.pips_moved > 0 ? '+' : ''}{record.pips_moved}</span></span>
                              )}
                              <div className="flex items-center gap-1 ml-auto">
                                <span className="px-1 py-0.5 rounded bg-green-500/10 text-green-400/60">&#x2713;F</span>
                                <span className="px-1 py-0.5 rounded bg-green-500/10 text-green-400/60">&#x2713;R</span>
                                {meta?.imAlignment && meta.imAlignment > 50 && <span className="px-1 py-0.5 rounded bg-green-500/10 text-green-400/60">&#x2713;I</span>}
                                {meta?.meanReversion && <span className="px-1 py-0.5 rounded bg-purple-500/10 text-purple-400/60">&#x2713;C</span>}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {trackRecords.length === 0 && (
                    <p className="text-xs text-text-dim text-center py-4">Nog geen trackrecord data. Gebruik backfill of wacht tot data automatisch wordt opgeslagen.</p>
                  )}
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
            <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim font-medium mb-3">Methode &amp; Databronnen</p>

            <div className="space-y-3 text-[11px] text-text-dim leading-relaxed">
              <div>
                <p className="font-semibold text-text-muted mb-1">Hoe werkt dit model?</p>
                <p>De briefing analyseert de FX markt in 5 stappen. Elke stap bouwt voort op de vorige:</p>
                <ol className="list-decimal list-inside mt-1 space-y-0.5 text-[10px]">
                  <li><strong className="text-text-muted">Marktregime</strong> bepaald door CB beleid en intermarket data. Dit geeft context voor alle verdere analyse.</li>
                  <li><strong className="text-text-muted">Nieuws Sentiment</strong> headlines automatisch geanalyseerd op impact per valuta. Positief/negatief sentiment wordt meegewogen in de score.</li>
                  <li><strong className="text-text-muted">Intermarket bevestiging</strong> VIX, S&amp;P 500, goud, yields en DXY worden gecheckt. Alleen bij alignment &gt;50% worden signalen doorgelaten.</li>
                  <li><strong className="text-text-muted">Trade Focus</strong> paren met score &ge;2.0, contrarian prijsactie (5d lookback) en intermarket bevestiging.</li>
                  <li><strong className="text-text-muted">Concrete Trades</strong> trade cards met call, conviction score en timing. Hold: 1 handelsdag.</li>
                </ol>
              </div>

              <div>
                <p className="font-semibold text-text-muted mb-1">Databronnen</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
                  {[
                    { bron: 'CB rentetarieven en beleid', detail: 'Supabase DB, bijgewerkt na CB vergaderingen' },
                    { bron: 'Intermarket koersen', detail: 'Yahoo Finance API (cache: 5 min)' },
                    { bron: 'Nieuws artikelen', detail: 'Bloomberg, ForexLive, CNBC via Supabase (laatste 72 uur)' },
                    { bron: 'Dagkoersen (10 major paren)', detail: 'Yahoo Finance, dagelijks vernieuwd' },
                    { bron: 'Track Record', detail: 'Supabase DB, dagelijks automatisch geresolved na 1 handelsdag' },
                  ].map(item => (
                    <div key={item.bron} className="flex items-start gap-1.5 p-1.5 rounded bg-white/[0.02]">
                      <span className="text-accent-light/40 mt-0.5">&#x2022;</span>
                      <div>
                        <span className="text-text-muted font-medium">{item.bron}</span>
                        <span className="text-text-dim/60 block">{item.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-semibold text-text-muted mb-1">Update frequenties</p>
                <p className="text-[10px]">
                  CB beleid: na elke vergadering · Intermarket: elke 5 min · Nieuws: analyse afgelopen 72 uur · Track record: dagelijks automatisch
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {['CB Beleid x2', 'Rente x1.5', 'Nieuws bonus', 'Intermarket >50%', 'Contrarian 5d', '10 Major Paren', 'Hold 1d', 'Dagkoers NY Close'].map(tag => (
                <span key={tag} className="text-[9px] px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-text-dim">{tag}</span>
              ))}
            </div>
          </div>

          <div className="mt-4 p-4 rounded-xl border border-border bg-bg-card/30 text-center">
            <p className="text-xs text-text-dim leading-relaxed">
              Deze briefing is puur educatief en geen financieel advies. Data wordt automatisch opgehaald en verwerkt.
              Fundamentals geven de richting, technische analyse (structure breaks) bepaalt de timing en entry.
            </p>
            <p className="text-[9px] text-text-dim/40 mt-1">
              Sanders Capital Fundamentals · Gegenereerd: {formatCET(data.generatedAt)} · 10 major paren · 8 valuta&apos;s · 6 intermarket instrumenten
            </p>
          </div>
        </>
      )}
    </div>
  )
}
