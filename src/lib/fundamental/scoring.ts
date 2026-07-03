// ─────────────────────────────────────────────────────────────
// Sanders Capital — Fundamental Briefing: scoring
//
// Zelfde methodiek als de oude briefing-v2 tool (CB-bias ×2 + rente vs.
// doel ×1.5 + nieuws, gecapt ±1.5), maar als schone, herbruikbare module.
// Conviction (0-10) hergebruikt de gedeelde convictionBreakdown.
// ─────────────────────────────────────────────────────────────
import { convictionBreakdown, type ConvictionBreakdown } from '@/components/fx-desk/lib/conviction'
import { MAJORS, BIAS_SCORES } from './constants'
import type { CurrencyScore, Direction, ImInstrument, NewsItem } from './types'

export interface RateRow { currency: string; bank?: string; rate: number | null; target: number | null; bias: string }
export interface NewsRow {
  title: string; title_nl?: string | null; summary?: string | null; source?: string | null
  affected_currencies?: string[] | null; relevance_score?: number | null; published_at: string
}

export function biasScore(bias: string): number {
  return BIAS_SCORES[(bias || '').toLowerCase()] ?? 0
}

// rente − doel → score (identiek aan oude tool).
export function rateTargetScore(rate: number | null, target: number | null): number {
  if (rate == null || target == null) return 0
  const diff = rate - target
  if (diff > 0.5) return 1
  if (diff > 0) return 0.5
  if (diff > -0.5) return -0.5
  return -1
}

// ─── Nieuws-sentiment per valuta (faithful port van analyzeNewsSentiment) ──
const NEG_PREFIX = ['no ', 'not ', 'without ', 'failed to ', 'unlikely ', 'ruled out ', 'avoided ']
const BULL_PHRASES = ['rate hike', 'rate increase', 'higher than expected', 'beat expectations', 'exceeded expectations', 'stronger than expected', 'record high', 'hawkish surprise', 'hawkish hold', 'tightening cycle', 'above consensus']
const BULL_WORDS = ['hawkish', 'tightening', 'restrictive', 'robust', 'surge', 'rally', 'booming', 'upbeat', 'outperform', 'accelerat', 'strong', 'growth', 'gain', 'rise', 'climb', 'recover', 'optimis', 'positive', 'boost']
const BEAR_PHRASES = ['rate cut', 'rate decrease', 'lower than expected', 'missed expectations', 'below expected', 'weaker than expected', 'dovish surprise', 'dovish pivot', 'easing cycle', 'below consensus', 'hard landing', 'debt crisis', 'oil prices fall', 'oil price drop', 'crude oil decline', 'under pressure', 'higher prices for', 'supply chain', 'iran deal']
const BEAR_WORDS = ['dovish', 'easing', 'accommodative', 'recession', 'slowdown', 'contraction', 'crisis', 'warning', 'downgrade', 'stagflation', 'deteriorat', 'plunge', 'crash', 'tariff', 'trade war', 'sanction', 'tension', 'conflict', 'geopolit', 'uncertainty', 'risk', 'pressure', 'decline', 'fall', 'drop', 'slide', 'tumble', 'weak']

export interface NewsSentiment { score: number; headlines: string[]; sentiment: string; detail: NewsItem[] }
export function analyzeNewsSentiment(articles: NewsRow[]): Record<string, NewsSentiment> {
  const s: Record<string, { score: number; headlines: string[]; detail: NewsItem[] }> = {}
  for (const c of MAJORS) s[c] = { score: 0, headlines: [], detail: [] }

  for (const a of articles) {
    const text = `${a.title} ${a.summary || ''}`.toLowerCase()
    const ccys = a.affected_currencies || []
    if (ccys.length === 0) continue
    let bull = 0, bear = 0
    for (const p of BULL_PHRASES) if (text.includes(p)) (NEG_PREFIX.some((n) => text.includes(n + p)) ? (bear += 1.5) : (bull += 1.5))
    for (const p of BEAR_PHRASES) if (text.includes(p)) (NEG_PREFIX.some((n) => text.includes(n + p)) ? (bull += 1.5) : (bear += 1.5))
    for (const w of BULL_WORDS) if (text.includes(w)) bull += 0.5
    for (const w of BEAR_WORDS) if (text.includes(w)) bear += 0.5
    if (bull === 0 && bear === 0) continue
    const weight = Math.min((a.relevance_score ?? 0) / 5, 1.5)
    const hoursAgo = (Date.now() - new Date(a.published_at).getTime()) / 3600000
    const recency = hoursAgo < 12 ? 1.5 : hoursAgo < 24 ? 1.2 : hoursAgo < 48 ? 1.0 : 0.7
    const net = (bull - bear) * weight * recency * 0.25
    // Het gewicht zoals het MEEWOOG (relevantie × recentheid). Geen wiskunde-
    // wijziging: dit is exact de multiplier die in `net` zit.
    const effWeight = +(weight * recency).toFixed(2)
    for (const c of ccys) {
      if (s[c]) {
        s[c].score += net
        if (s[c].headlines.length < 3) s[c].headlines.push(a.title_nl || a.title)
        s[c].detail.push({ title: a.title_nl || a.title, source: a.source || 'onbekend', date: a.published_at, weight: effWeight })
      }
    }
  }

  const out: Record<string, NewsSentiment> = {}
  for (const c of MAJORS) {
    const score = Math.round(s[c].score * 10) / 10
    let sentiment = 'neutraal'
    if (score >= 1.0) sentiment = 'sterk positief'
    else if (score >= 0.3) sentiment = 'positief'
    else if (score <= -1.0) sentiment = 'sterk negatief'
    else if (score <= -0.3) sentiment = 'negatief'
    out[c] = { score, headlines: s[c].headlines, sentiment, detail: s[c].detail }
  }
  return out
}

// Welke intermarket-instrumenten de alignment bevestigden, gegeven het regime.
// Beschrijvend; verandert calculateIntermarketAlignment NIET (zelfde condities).
export function intermarketContributions(signals: ImSignal[], regime: string): ImInstrument[] {
  const expect: Record<string, 'up' | 'down' | 'notup'> = {}
  if (regime === 'Risk-Off') Object.assign(expect, { sp500: 'down', vix: 'up', gold: 'up', us10y: 'up', dxy: 'up' })
  else if (regime === 'Risk-On') Object.assign(expect, { sp500: 'up', vix: 'down', gold: 'down', dxy: 'down' })
  else if (regime === 'USD Dominant') Object.assign(expect, { dxy: 'up', us10y: 'up', sp500: 'notup' })
  else if (regime === 'USD Zwak') Object.assign(expect, { dxy: 'down', us10y: 'down', sp500: 'up' })
  return signals.map((sig) => {
    const e = expect[sig.key]
    const contributed = e === 'notup' ? sig.direction !== 'up' : e ? sig.direction === e : false
    return { key: sig.key, direction: sig.direction, changePct: sig.changePct, contributed }
  })
}

// ─── Valutascores ─────────────────────────────────────────────
// v1: CB×2 + rente-vs-doel×1.5 + nieuws (±1.5).
// v2 voegt toe (via `extras`, allemaal optioneel — zonder extras is de
// uitkomst identiek aan v1): macro-verrassingen (±2), inflatie-gap (±1)
// en grondstoffen-terms-of-trade (±1, alleen AUD/CAD/NZD).
export interface CurrencyExtras {
  surprisePts?: number
  inflGapPts?: number
  commodityPts?: number
}
export function computeCurrencyScores(
  ratesMap: Record<string, RateRow>,
  news: Record<string, { score: number; headlines: string[]; sentiment: string }>,
  extras?: Record<string, CurrencyExtras>,
): Record<string, CurrencyScore> {
  const out: Record<string, CurrencyScore> = {}
  for (const ccy of MAJORS) {
    const rate = ratesMap[ccy]
    const reasons: string[] = []
    let baseScore = 0, bs = 0, rts = 0
    if (rate) {
      bs = biasScore(rate.bias)
      baseScore += bs * 2
      if (bs > 0) reasons.push(`${rate.bank || ccy}: ${rate.bias} (hawkish)`)
      else if (bs < 0) reasons.push(`${rate.bank || ccy}: ${rate.bias} (dovish)`)
      else if (rate.bias) reasons.push(`${rate.bank || ccy}: ${rate.bias}`)
      rts = rateTargetScore(rate.rate, rate.target)
      baseScore += rts * 1.5
      if (rts > 0) reasons.push(`Rente (${rate.rate}%) boven doel (${rate.target}%) → restrictief`)
      else if (rts < 0) reasons.push(`Rente (${rate.rate}%) onder doel (${rate.target}%) → accommoderend`)
    }
    const nd = news[ccy]
    const newsBonus = Math.max(-1.5, Math.min(1.5, nd?.score || 0))
    if (newsBonus > 0.3) reasons.push(`Nieuws-sentiment positief (${nd.sentiment})`)
    else if (newsBonus < -0.3) reasons.push(`Nieuws-sentiment negatief (${nd.sentiment})`)

    const ex = extras?.[ccy]
    const surprisePts = ex?.surprisePts ?? 0
    const inflGapPts = ex?.inflGapPts ?? 0
    const commodityPts = ex?.commodityPts ?? 0
    if (surprisePts >= 0.5) reasons.push('Macro-data verraste positief')
    else if (surprisePts <= -0.5) reasons.push('Macro-data viel tegen')
    if (inflGapPts >= 0.3) reasons.push('Inflatie boven doel → hawkish druk')
    else if (inflGapPts <= -0.3) reasons.push('Inflatie onder doel → ruimte voor verruiming')
    if (commodityPts >= 0.3) reasons.push('Grondstoffenprijzen in de rug')
    else if (commodityPts <= -0.3) reasons.push('Grondstoffenprijzen tegen')
    const extraTotal = surprisePts + inflGapPts + commodityPts

    out[ccy] = {
      currency: ccy,
      score: baseScore + newsBonus + extraTotal,
      baseScore,
      newsBonus: Math.round(newsBonus * 10) / 10,
      reasons,
      newsHeadlines: nd?.headlines || [],
      breakdown: {
        biasLabel: rate?.bias || 'onbekend',
        biasRaw: bs, biasMultiplied: bs * 2,
        rateScore: rts * 1.5, rate: rate?.rate ?? null, target: rate?.target ?? null,
        newsRaw: nd?.score || 0, newsCapped: newsBonus,
        total: baseScore + newsBonus + extraTotal,
        ...(extras ? { surprisePts, inflGapPts, commodityPts } : {}),
      },
    }
  }
  return out
}

// ─── Regime (puur CB-beleid) ──────────────────────────────────
export function determineRegime(cs: Record<string, CurrencyScore>): { regime: string; explain: string; color: string } {
  const usd = cs['USD']?.score || 0
  const jpy = cs['JPY']?.score || 0
  const hy = (['AUD', 'NZD', 'CAD'].reduce((a, c) => a + (cs[c]?.score || 0), 0)) / 3
  const f = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`
  if (jpy > 1 && hy < 0) return { regime: 'Risk-Off', color: 'red', explain: `JPY fundamenteel sterk (${f(jpy)}) en high-yield valuta's zwak (gem. ${f(hy)}). Risk-off omgeving.` }
  if (hy > 1 && jpy < 0) return { regime: 'Risk-On', color: 'green', explain: `High-yield valuta's sterk (gem. ${f(hy)}) en JPY zwak (${f(jpy)}). Risk-on omgeving.` }
  if (usd > 2) return { regime: 'USD Dominant', color: 'blue', explain: `USD scoort ${f(usd)} — ver boven de rest. Hawkish Fed/hoge rente trekt kapitaal naar de dollar.` }
  if (usd < -2) return { regime: 'USD Zwak', color: 'amber', explain: `USD scoort ${f(usd)} — dovish Fed. Kansen in sterke valuta's tegen de dollar.` }
  return { regime: 'Gemengd', color: 'gray', explain: `Geen duidelijk macro-thema (USD ${f(usd)}, JPY ${f(jpy)}, HY ${f(hy)}). Focus op paar-divergenties.` }
}

// ─── Paar-bias (base − quote) ─────────────────────────────────
export interface PairBias {
  pair: string; base: string; quote: string
  direction: Direction | 'neutraal'; score: number
}
export function computePairBias(pair: string, cs: Record<string, CurrencyScore>): PairBias {
  const [base, quote] = pair.split('/')
  const diff = (cs[base]?.score || 0) - (cs[quote]?.score || 0)
  let direction: Direction | 'neutraal' = 'neutraal'
  if (diff > 0.5) direction = 'bullish'
  else if (diff < -0.5) direction = 'bearish'
  return { pair, base, quote, direction, score: +diff.toFixed(2) }
}

// ─── Regime-alignment (verbatim regels van de oude tool) ──────
export function isAlignedWithRegime(base: string, quote: string, isBull: boolean, regime: string): boolean {
  const sh = ['JPY', 'CHF'], hy = ['AUD', 'NZD', 'CAD']
  if (regime === 'Risk-Off') {
    if (isBull && sh.includes(base)) return true
    if (!isBull && sh.includes(quote)) return true
    if (!isBull && hy.includes(base)) return true
    if (isBull && hy.includes(quote)) return true
  }
  if (regime === 'Risk-On') {
    if (isBull && hy.includes(base)) return true
    if (!isBull && hy.includes(quote)) return true
    if (!isBull && sh.includes(base)) return true
    if (isBull && sh.includes(quote)) return true
  }
  if (regime === 'USD Dominant') { if (isBull && base === 'USD') return true; if (!isBull && quote === 'USD') return true }
  if (regime === 'USD Zwak') { if (!isBull && base === 'USD') return true; if (isBull && quote === 'USD') return true }
  if (regime === 'Gemengd') return true
  return false
}

// ─── Intermarket-alignment (faithful port) ────────────────────
export interface ImSignal { key: string; direction: 'up' | 'down' | 'flat'; changePct: number }
export function calculateIntermarketAlignment(signals: ImSignal[], regime: string): number {
  const get = (k: string) => signals.find((s) => s.key === k)
  const strength = (s?: ImSignal) => {
    if (!s || s.direction === 'flat') return 0
    const p = Math.abs(s.changePct)
    return p > 1.0 ? 1.0 : p > 0.5 ? 0.75 : p > 0.2 ? 0.5 : 0.25
  }
  const sp = get('sp500'), vix = get('vix'), gold = get('gold'), yields = get('us10y'), dxy = get('dxy')
  let score = 0, max = 0
  if (regime === 'Risk-Off') {
    max = 5
    if (sp?.direction === 'down') score += strength(sp)
    if (vix?.direction === 'up') score += strength(vix)
    if (gold?.direction === 'up') score += strength(gold)
    if (yields?.direction === 'up') score += strength(yields)
    if (dxy?.direction === 'up') score += strength(dxy)
  } else if (regime === 'Risk-On') {
    max = 4
    if (sp?.direction === 'up') score += strength(sp)
    if (vix?.direction === 'down') score += strength(vix)
    if (gold?.direction === 'down') score += strength(gold)
    if (dxy?.direction === 'down') score += strength(dxy)
  } else if (regime === 'USD Dominant') {
    max = 3
    if (dxy?.direction === 'up') score += strength(dxy)
    if (yields?.direction === 'up') score += strength(yields)
    if (sp?.direction !== 'up') score += 0.5
  } else if (regime === 'USD Zwak') {
    max = 3
    if (dxy?.direction === 'down') score += strength(dxy)
    if (yields?.direction === 'down') score += strength(yields)
    if (sp?.direction === 'up') score += 0.5
  } else {
    return 50 // Gemengd: neutraal
  }
  if (max === 0) return 50
  return Math.round((score / max) * 100)
}

// ─── Conviction v1 (0-10) — hergebruikt de gedeelde breakdown ─
// Blijft bestaan voor de oude FX-desk tool; de Fundamental Briefing
// gebruikt sinds v2 buildConvictionV2 hieronder.
export function buildConviction(p: {
  fundScore: number; base: string; quote: string; direction: Direction
  momentum5dPips: number; imAlignment: number; regime: string
}): ConvictionBreakdown {
  const isBull = p.direction === 'bullish'
  const contrarianPass = (isBull && p.momentum5dPips < 0) || (!isBull && p.momentum5dPips > 0)
  const regimeAligned = isAlignedWithRegime(p.base, p.quote, isBull, p.regime)
  return convictionBreakdown({
    absScore: Math.abs(p.fundScore),
    contrarianPass,
    absMom: Math.abs(p.momentum5dPips),
    imAlignment: p.imAlignment,
    regimeAligned,
  })
}

// ─── Conviction v2: BIAS en TIMING als aparte scores ──────────
//
// Bias (0.5..10)  = hoe sterk de fundamentals de richting steunen:
//   fundPts   = min(|fund_score| / 6, 1) × 8.5   (6 = zeer sterke divergentie)
//   regimePts = past bij het macro-regime ? 1.5 : 0.5
//
// Timing (0..10) = hoe gunstig het instapmoment is:
//   stretchPts = ATR-genormaliseerde tegendraadse beweging. De 5d-beweging in
//                eenheden van de 14d-ATR, positief als de koers TEGEN de
//                fundamentele richting in liep (dip om te kopen / rally om te
//                shorten). -0.5 ATR (chasing) → 0 pt · 0 → 1 pt · +1.5 ATR → 4 pt.
//                Vervangt de vaste 30–120-pips-band: 60 pips is op EUR/CHF
//                een uitschieter en op GBP/NZD ruis — ATR maakt dat eerlijk.
//   imPts      = intermarket-bevestiging: alignment% / 100 × 3.
//   eventPts   = event-rust: 3 − 1.5 per high-impact event (CPI, NFP,
//                rentebesluit…) voor base of quote binnen het venster, min 0.
//
// Zekerheid (total) = 0.6 × bias + 0.4 × timing — bias weegt zwaarder omdat
// het forward-trackrecord liet zien dat de richting vaker goed zit dan het
// moment; de UI toont beide apart.
export interface ConvictionV2Result {
  v: 2
  fundPts: number; regimePts: number; biasScore: number
  stretchPts: number; imPts: number; eventPts: number; timingScore: number
  total: number
}
const r1 = (v: number) => Math.round(v * 10) / 10
export function buildConvictionV2(p: {
  fundScore: number; base: string; quote: string; direction: Direction
  momentum5dPips: number; atrPips: number | null; imAlignment: number; regime: string
  highImpactEventCount: number
}): ConvictionV2Result {
  const isBull = p.direction === 'bullish'
  const regimeAligned = isAlignedWithRegime(p.base, p.quote, isBull, p.regime)

  // Bias
  const fundPts = Math.min(Math.abs(p.fundScore) / 6, 1) * 8.5
  const regimePts = regimeAligned ? 1.5 : 0.5
  const biasScore = Math.min(10, fundPts + regimePts)

  // Timing — stretch in ATR-eenheden (tegen de richting in = positief).
  let stretchPts = 1 // zonder ATR (te weinig historie): neutraal
  if (p.atrPips != null && p.atrPips > 0) {
    const momAtr = p.momentum5dPips / p.atrPips
    const stretch = isBull ? -momAtr : momAtr
    stretchPts = Math.max(0, Math.min(1, (stretch + 0.5) / 2)) * 4
  }
  const imPts = (p.imAlignment / 100) * 3
  const eventPts = Math.max(0, 3 - 1.5 * p.highImpactEventCount)
  const timingScore = Math.min(10, stretchPts + imPts + eventPts)

  const total = Math.min(10, r1(0.6 * biasScore + 0.4 * timingScore))
  return {
    v: 2,
    fundPts: r1(fundPts), regimePts: r1(regimePts), biasScore: r1(biasScore),
    stretchPts: r1(stretchPts), imPts: r1(imPts), eventPts: r1(eventPts), timingScore: r1(timingScore),
    total,
  }
}
