// ─── Adapters: briefing API + trackrecord → design shape ──────
//
// Pure mapping functions. No fetching. No side effects.
// Read /api/briefing-v2 and /api/trackrecord-v2 responses,
// emit shapes the FX Desk components consume.

import type {
  ApiBriefingData,
  ApiPairBias,
  ApiV3PairSignal,
  ApiTrackRecord,
  DeskToday,
  DeskFxScore,
  DeskCall,
  DeskReasoning,
  DeskIntermarket,
  DeskSentiment,
  DeskCallHistoryRecord,
  Direction,
  SentimentStand,
} from './types'
import {
  convictionForLivePair,
  convictionForHistoricalRecord,
  type ConvictionBreakdown,
} from './conviction'

// ─── Helpers ──────────────────────────────────────────────────
const MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']

function dirOfPair(direction: string): Direction | null {
  if (direction.includes('bullish')) return 'long'
  if (direction.includes('bearish')) return 'short'
  return null
}


function formatDateDutch(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Amsterdam',
    })
  } catch {
    return iso
  }
}

function formatDateShort(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Europe/Amsterdam',
    })
  } catch {
    return iso
  }
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return (
      d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }) +
      ', ' +
      d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
    )
  } catch {
    return iso
  }
}

function regimeNote(regime: string): string {
  const r = (regime || '').toLowerCase()
  if (r.includes('risk-off')) return 'Kapitaal trekt naar veilige havens'
  if (r.includes('risk-on')) return 'Risico-appetijt domineert'
  if (r.includes('usd dominant')) return 'Dollarsterkte stuurt de markt'
  if (r.includes('usd zwak')) return 'Dollar onder druk'
  return 'Geen duidelijk macro-thema'
}

function regimeColor(regime: string): string {
  const r = (regime || '').toLowerCase()
  if (r.includes('risk-off')) return 'var(--loss)'
  if (r.includes('risk-on')) return 'var(--win)'
  if (r.includes('usd dominant')) return 'var(--gold)'
  if (r.includes('usd zwak')) return 'var(--pending)'
  return 'var(--ink-2)'
}

// ─── TODAY (Verdict header data) ──────────────────────────────
export function adaptToday(api: ApiBriefingData, readyCount: number): DeskToday {
  return {
    date: formatDateDutch(api.date),
    regime: api.regime || 'Gemengd',
    regimeColor: regimeColor(api.regime),
    regimeNote: regimeNote(api.regime),
    confidence: Math.round(api.confidence || 0),
    readyCount,
  }
}

// ─── FX_SCORES (per-currency strength) ────────────────────────
export function adaptFxScores(api: ApiBriefingData): DeskFxScore[] {
  const ranking = api.currencyRanking || []
  return ranking
    .map((c) => ({ code: c.currency, score: c.score, bias: c.bias, bank: c.bank }))
    .sort((a, b) => b.score - a.score)
}

// ─── READY / WATCH calls ──────────────────────────────────────
// Mirrors the existing trade-focus logic: 4 filters (score>=2.0, IM>=50,
// contrarian 5d momentum, direction not neutral). Pairs that pass all 4
// are ready. Pairs with score>=2.0 and a direction but failing other
// filters are watchlist.
export function adaptCalls(api: ApiBriefingData): { ready: DeskCall[]; watch: DeskCall[] } {
  const im = api.intermarketAlignment ?? 0
  const imPass = im >= 50
  const v3Signals = api.v3?.pairSignals || []

  const ready: DeskCall[] = []
  const watch: DeskCall[] = []

  for (const p of api.pairBiases || []) {
    const dir = dirOfPair(p.direction)
    if (!dir) continue
    const absScore = Math.abs(p.score)
    if (absScore < 2.0) continue

    const v3 = v3Signals.find((s) => s.pair === p.pair)
    const pips5d = v3?.priceMomentum?.pips5d ?? 0
    const isBullish = dir === 'long'
    const contrarianPass = (isBullish && pips5d < 0) || (!isBullish && pips5d > 0)

    const status: 'ready' | 'watch' = imPass && contrarianPass ? 'ready' : 'watch'
    const note = noteForCall(p, contrarianPass, imPass, status)

    // LIVE conviction: 4-component qualityScore (lib/conviction.ts)
    const breakdown = convictionForLivePair(p, v3, im)

    const item: DeskCall = {
      pair: p.pair,
      base: p.base,
      quote: p.quote,
      dir,
      score: breakdown.total,
      fundScore: p.score,
      status,
      note,
      breakdown,
    }
    if (status === 'watch') item.wait = waitReason(contrarianPass, imPass, v3)
    if (status === 'ready') ready.push(item)
    else watch.push(item)
  }

  ready.sort((a, b) => b.score - a.score)
  watch.sort((a, b) => b.score - a.score)

  return { ready, watch: watch.slice(0, 6) }
}

function noteForCall(p: ApiPairBias, _contrarianPass: boolean, _imPass: boolean, status: 'ready' | 'watch'): string {
  const baseRole = (b: string) => (b ? `${p.base} ${b}` : p.base)
  const quoteRole = (b: string) => (b ? `${p.quote} ${b}` : p.quote)
  const parts: string[] = []
  if (p.baseBias) parts.push(baseRole(p.baseBias))
  if (p.quoteBias) parts.push(quoteRole(p.quoteBias))
  if (parts.length > 0) return parts.join(' versus ')
  if (status === 'watch') return 'Bias aanwezig, wacht op bevestiging'
  return 'Fundamentele divergentie'
}

function waitReason(contrarianPass: boolean, imPass: boolean, v3?: ApiV3PairSignal): string {
  if (!imPass) return 'Wacht op intermarket-bevestiging'
  if (!contrarianPass) {
    const pips5d = v3?.priceMomentum?.pips5d
    if (pips5d != null) return `Wacht op momentum-zone (5d ${pips5d > 0 ? '+' : ''}${pips5d.toFixed(0)}p)`
    return 'Wacht op momentum-zone'
  }
  return 'Wacht op bevestiging'
}

// ─── REASONING (per ready-call expandable) ────────────────────
// Builds the 4-layer reasoning from CB rates, news, intermarket, and the
// pair score components.
export function adaptReasoning(
  api: ApiBriefingData,
  call: DeskCall,
): DeskReasoning {
  const baseRank = (api.currencyRanking || []).find((c) => c.currency === call.base)
  const quoteRank = (api.currencyRanking || []).find((c) => c.currency === call.quote)
  const strong = call.dir === 'long' ? call.base : call.quote
  const weak = call.dir === 'long' ? call.quote : call.base
  const strongRank = call.dir === 'long' ? baseRank : quoteRank
  const weakRank = call.dir === 'long' ? quoteRank : baseRank

  const regime = api.regime || 'Gemengd'
  const regimeText = regimeContribution(regime, strong, weak)

  const strongSent = api.newsSentiment?.[strong]
  const weakSent = api.newsSentiment?.[weak]
  const nieuws = nieuwsContribution(strong, strongSent?.sentiment, weak, weakSent?.sentiment)

  const intermarket = intermarketContribution(regime, api.intermarketAlignment ?? 0)

  // Score breakdown — split into the actual scoring components
  const scoreBars: [string, number][] = []
  if (strongRank?.scoreBreakdown) {
    const sb = strongRank.scoreBreakdown
    const cbAbs = Math.abs(sb.biasMultiplied)
    if (cbAbs > 0) scoreBars.push([`${strong}: CB beleid`, +cbAbs.toFixed(1)])
    const rsAbs = Math.abs(sb.rateScore)
    if (rsAbs > 0) scoreBars.push([`${strong}: rente vs target`, +rsAbs.toFixed(1)])
  }
  if (weakRank?.scoreBreakdown) {
    const sb = weakRank.scoreBreakdown
    const cbAbs = Math.abs(sb.biasMultiplied)
    if (cbAbs > 0) scoreBars.push([`${weak}: CB beleid`, +cbAbs.toFixed(1)])
  }
  // Get pair-level news/rate from pairBiases
  const pair = (api.pairBiases || []).find((p) => p.pair === call.pair)
  if (pair) {
    if (pair.rateDiff !== null && pair.rateDiff !== 0) {
      scoreBars.push(['Rente-divergentie', +Math.abs(pair.rateDiff).toFixed(1)])
    }
    if (pair.newsInfluence !== 0) {
      scoreBars.push(['Nieuws-momentum', +Math.abs(pair.newsInfluence).toFixed(1)])
    }
  }
  if (scoreBars.length === 0) scoreBars.push(['Fundamentele onbalans', +Math.abs(call.fundScore).toFixed(1)])

  return { regime: regimeText, nieuws, intermarket, score: scoreBars }
}

function regimeContribution(regime: string, strong: string, weak: string): string {
  const r = regime.toLowerCase()
  if (r.includes('risk-off')) {
    const safeHavens = ['USD', 'JPY', 'CHF']
    if (safeHavens.includes(strong)) return `Risk-off speelt ${strong} in de kaart als veilige haven; ${weak} is relatief kwetsbaar.`
    return `Risk-off weegt op ${weak}; relatieve ruimte voor ${strong} ontstaat.`
  }
  if (r.includes('risk-on')) {
    const highYield = ['AUD', 'NZD', 'CAD']
    if (highYield.includes(strong)) return `Risk-on steunt groeigevoelige munten; ${strong} profiteert ten opzichte van ${weak}.`
    return `Risk-on klimaat begunstigt ${strong} versus ${weak}.`
  }
  if (r.includes('usd dominant')) {
    if (strong === 'USD') return `USD dominant: dollar-momentum trekt ${call(strong, weak)} mee.`
    if (weak === 'USD') return `USD dominant maakt een long ${strong}/USD lastig; richting al ingeprijsd.`
  }
  if (r.includes('usd zwak')) {
    if (weak === 'USD') return `USD zwak: ruimte voor ${strong} ten opzichte van de dollar.`
  }
  return `Het regime ${regime} ondersteunt een onbalans tussen ${strong} en ${weak}.`
}

function call(strong: string, weak: string): string {
  return `${strong} versus ${weak}`
}

function nieuwsContribution(strong: string, strongSent?: string, weak?: string, weakSent?: string): string {
  const parts: string[] = []
  if (strongSent && strongSent !== 'neutraal') parts.push(`${strong} sentiment ${strongSent}`)
  if (weakSent && weakSent !== 'neutraal') parts.push(`${weak} sentiment ${weakSent}`)
  if (parts.length === 0) return 'Nieuwsstroom is gemengd; geen uitgesproken sentiment-impuls.'
  return parts.join('; ') + '.'
}

function intermarketContribution(regime: string, alignment: number): string {
  if (alignment >= 65) return `Intermarket-signalen bevestigen het ${regime}-regime (alignment ${Math.round(alignment)}%).`
  if (alignment >= 50) return `Intermarket loopt in lijn met het regime (alignment ${Math.round(alignment)}%).`
  if (alignment <= 35) return `Intermarket weerspreekt deels het regime (alignment ${Math.round(alignment)}%); voorzichtigheid geboden.`
  return `Intermarket is verdeeld (alignment ${Math.round(alignment)}%).`
}

// ─── INTERMARKET strip ────────────────────────────────────────
const INTERMARKET_LABELS: Record<string, { label: string; unit: string }> = {
  us10y: { label: 'US 10Y', unit: '%' },
  sp500: { label: 'S&P 500', unit: '' },
  vix: { label: 'VIX', unit: '' },
  gold: { label: 'Goud', unit: '$' },
  oil: { label: 'Olie', unit: '$' },
  dxy: { label: 'DXY', unit: '' },
}

const INTERMARKET_ORDER = ['vix', 'sp500', 'gold', 'dxy', 'us10y']

export function adaptIntermarket(api: ApiBriefingData): { items: DeskIntermarket[]; conclusion: string } {
  const signals = api.intermarketSignals || []
  const items: DeskIntermarket[] = []
  for (const key of INTERMARKET_ORDER) {
    const s = signals.find((x) => x.key === key)
    if (!s) continue
    const meta = INTERMARKET_LABELS[key] || { label: s.name, unit: s.unit }
    items.push({
      key: key.toUpperCase(),
      label: meta.label,
      value: s.current != null ? formatVal(s.current, key) : '—',
      chg: s.changePct != null ? `${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(s.key === 'us10y' ? 2 : 1)}%` : '—',
      dir: s.direction,
      duiding: s.context,
    })
  }
  return { items, conclusion: intermarketConclusion(api) }
}

function formatVal(v: number, key: string): string {
  if (key === 'us10y') return `${v.toFixed(2)}%`
  if (key === 'vix') return v.toFixed(2)
  if (key === 'gold') return v.toLocaleString('nl-NL', { maximumFractionDigits: 0 })
  if (key === 'sp500') return v.toLocaleString('nl-NL', { maximumFractionDigits: 0 })
  if (key === 'dxy') return v.toFixed(2)
  return v.toFixed(2)
}

function intermarketConclusion(api: ApiBriefingData): string {
  const a = api.intermarketAlignment ?? 0
  const r = api.regime || 'Gemengd'
  if (a >= 65) return `Intermarket bevestigt ${r.toLowerCase()}`
  if (a <= 35) return `Intermarket weerspreekt ${r.toLowerCase()}`
  return `Intermarket is verdeeld (${Math.round(a)}% alignment)`
}

// ─── SENTIMENT strip ──────────────────────────────────────────
export function adaptSentiment(api: ApiBriefingData): DeskSentiment[] {
  const ns = api.newsSentiment || {}
  return MAJORS.map((code) => {
    const s = ns[code]
    const stand: SentimentStand = mapSentimentLabel(s?.sentiment)
    return {
      code,
      stand,
      headlines: (s?.headlines || []).slice(0, 3),
    }
  })
}

function mapSentimentLabel(s?: string): SentimentStand {
  if (!s) return 'neutraal'
  if (s.includes('positief')) return 'positief'
  if (s.includes('negatief')) return 'negatief'
  return 'neutraal'
}

// ─── Track record → call history (for Calls tab) ──────────────
export function adaptTrackRecord(records: ApiTrackRecord[]): DeskCallHistoryRecord[] {
  const TP_PIPS = 120 // balanced model TP
  const SL_PIPS = 40  // balanced model SL

  return records
    .map((r) => {
      const dir = dirOfPair(r.direction)
      if (!dir) return null
      if (r.entry_price == null) return null

      const isJpy = r.pair.includes('JPY')
      const pipSize = isJpy ? 0.01 : 0.0001
      const tp = dir === 'long' ? r.entry_price + TP_PIPS * pipSize : r.entry_price - TP_PIPS * pipSize
      const sl = dir === 'long' ? r.entry_price - SL_PIPS * pipSize : r.entry_price + SL_PIPS * pipSize

      const src: 'fundamenteel' | 'engine' =
        r.metadata?.source === 'engine' || r.metadata?.signal === 'engine' ? 'engine' : 'fundamenteel'

      const calledAt = r.metadata?.callTime || r.created_at || r.date
      const closedAt = r.metadata?.exitTime || r.resolved_at || null

      const durationText = buildDuration(calledAt, closedAt, r.metadata?.holdingPeriod)

      // Real 4-component conviction from the stored metadata
      // (regimeAligned derived from regime + direction + pair).
      const conv = convictionForHistoricalRecord(r)

      return {
        id: r.id,
        pair: r.pair,
        dir,
        src,
        score: conv.total,
        fundScore: r.score,
        date: formatDateShort(r.date),
        calledAt: formatDateTime(calledAt) || formatDateShort(r.date),
        closedAt: closedAt ? formatDateTime(closedAt) : null,
        durationText,
        outcome: r.result,
        entry: r.entry_price,
        tp,
        sl,
        close: r.exit_price,
        pips: r.pips_moved,
        note: buildNote(r),
      } satisfies DeskCallHistoryRecord
    })
    .filter((x): x is DeskCallHistoryRecord => x !== null)
}

function buildDuration(calledAt?: string | null, closedAt?: string | null, holdingPeriod?: number): string {
  if (!closedAt) return 'Lopend'
  if (!calledAt) return holdingPeriod != null ? `${holdingPeriod} dag${holdingPeriod === 1 ? '' : 'en'}` : '—'
  try {
    const start = new Date(calledAt).getTime()
    const end = new Date(closedAt).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '—'
    const diffMs = end - start
    const days = Math.floor(diffMs / 86400000)
    const hours = Math.floor((diffMs % 86400000) / 3600000)
    if (days === 0) return `${hours} uur`
    if (hours === 0) return `${days} dag${days === 1 ? '' : 'en'}`
    return `${days} dag${days === 1 ? '' : 'en'} ${hours} uur`
  } catch {
    return '—'
  }
}

function buildNote(r: ApiTrackRecord): string {
  const bits: string[] = []
  if (r.regime) bits.push(`Regime ${r.regime}`)
  if (r.metadata?.confidence) bits.push(`confidence ${r.metadata.confidence}%`)
  if (r.metadata?.momentum5d != null) bits.push(`5d momentum ${r.metadata.momentum5d > 0 ? '+' : ''}${r.metadata.momentum5d}p`)
  if (r.metadata?.imAlignment != null) bits.push(`IM ${Math.round(r.metadata.imAlignment)}%`)
  if (bits.length === 0) return 'Call uit het trackrecord.'
  return bits.join(' · ') + '.'
}

// ─── Performance buckets from track record ────────────────────
export interface PerfBucket {
  range: string
  min: number  // inclusive (conviction 0-10)
  max: number  // exclusive
  trades: number
  winrate: number
  pf: number
  avgPips: number
}

export function buildPerfBuckets(records: ApiTrackRecord[]): PerfBucket[] {
  const buckets: PerfBucket[] = [
    { range: '9 - 10', min: 9, max: 10.01, trades: 0, winrate: 0, pf: 0, avgPips: 0 },
    { range: '8 - 9',  min: 8, max: 9,     trades: 0, winrate: 0, pf: 0, avgPips: 0 },
    { range: '7 - 8',  min: 7, max: 8,     trades: 0, winrate: 0, pf: 0, avgPips: 0 },
    { range: '6 - 7',  min: 6, max: 7,     trades: 0, winrate: 0, pf: 0, avgPips: 0 },
    { range: '5 - 6',  min: 5, max: 6,     trades: 0, winrate: 0, pf: 0, avgPips: 0 },
    { range: '< 5',    min: 0, max: 5,     trades: 0, winrate: 0, pf: 0, avgPips: 0 },
  ]

  for (const b of buckets) {
    const inBucket = records.filter((r) => {
      const c = convictionForHistoricalRecord(r).total
      return c >= b.min && c < b.max && r.result !== 'pending'
    })
    const wins = inBucket.filter((r) => r.result === 'correct')
    const losses = inBucket.filter((r) => r.result === 'incorrect')
    const totalWinPips = wins.reduce((s, r) => s + Math.max(0, r.pips_moved || 0), 0)
    const totalLossPips = losses.reduce((s, r) => s + Math.abs(Math.min(0, r.pips_moved || 0)), 0)
    const totalPips = inBucket.reduce((s, r) => s + (r.pips_moved || 0), 0)
    b.trades = inBucket.length
    b.winrate = inBucket.length > 0 ? Math.round((wins.length / inBucket.length) * 100) : 0
    b.pf = totalLossPips > 0 ? +(totalWinPips / totalLossPips).toFixed(1) : wins.length > 0 ? 99 : 0
    b.avgPips = inBucket.length > 0 ? Math.round(totalPips / inBucket.length) : 0
  }

  return buckets
}

// ─── Methodiek funnel from live data ──────────────────────────
export function buildFunnel(api: ApiBriefingData, readyCount: number): { label: string; count: number }[] {
  const all = (api.pairBiases || []).length
  const withDirection = (api.pairBiases || []).filter((p) => p.direction !== 'neutraal').length
  const overThreshold = (api.pairBiases || []).filter((p) => Math.abs(p.score) >= 2.0 && p.direction !== 'neutraal').length
  return [
    { label: 'Alle paren', count: all },
    { label: 'Na regime-check', count: withDirection },
    { label: 'Score boven drempel', count: overThreshold },
    { label: 'Na intermarket & contrarian', count: readyCount },
  ]
}
