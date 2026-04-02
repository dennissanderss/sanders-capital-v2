import type { IntermarketSignal, PairBias, TodayEvent, CurrencyRank } from './types'

// ─── Formatting Helpers ─────────────────────────────────────

export function formatCET(isoStr: string | undefined): string {
  if (!isoStr) return ''
  try {
    return new Date(isoStr).toLocaleString('nl-NL', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Amsterdam',
    }) + ' NL'
  } catch { return '' }
}

export function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return ''
  return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('')
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}u`
  return `${Math.floor(hours / 24)}d`
}

export function timeAgoDutch(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} min geleden`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} uur geleden`
  const days = Math.floor(hours / 24)
  return `${days} dag${days > 1 ? 'en' : ''} geleden`
}

export function formatUpdateTime(isoDate?: string): string {
  if (!isoDate) return ''
  try {
    return new Date(isoDate).toLocaleString('nl-NL', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam'
    }) + ' NL'
  } catch { return '' }
}

// ─── Intermarket Analysis ───────────────────────────────────

export function getIntermarketConclusion(
  signals: IntermarketSignal[],
  regime: string
): { text: string; sentiment: string; confirmsRegime: boolean } {
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

// ─── Trade Focus ────────────────────────────────────────────

export function buildTradeFocusItem(
  pair: PairBias,
  events: TodayEvent[],
  ranking: CurrencyRank[]
) {
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

export function getTradeFocus(
  pairs: PairBias[],
  events: TodayEvent[],
  ranking: CurrencyRank[]
) {
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
