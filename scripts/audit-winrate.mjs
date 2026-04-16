// ─── AUDIT: Schone winrate berekening over alle paren ───────
// Draait lokaal, pusht NIETS naar de database
// Test meerdere configuraties om de beste te vinden
// ────────────────────────────────────────────────────────────

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── All 21 pairs ──────────────────────────────────────────
const ALL_PAIRS = {
  'EUR/USD': 'EURUSD=X', 'GBP/USD': 'GBPUSD=X', 'USD/JPY': 'USDJPY=X',
  'AUD/USD': 'AUDUSD=X', 'NZD/USD': 'NZDUSD=X', 'USD/CAD': 'USDCAD=X',
  'USD/CHF': 'USDCHF=X', 'EUR/GBP': 'EURGBP=X', 'EUR/JPY': 'EURJPY=X',
  'GBP/JPY': 'GBPJPY=X', 'AUD/JPY': 'AUDJPY=X', 'NZD/JPY': 'NZDJPY=X',
  'CAD/JPY': 'CADJPY=X', 'EUR/AUD': 'EURAUD=X', 'GBP/AUD': 'GBPAUD=X',
  'AUD/NZD': 'AUDNZD=X', 'EUR/CHF': 'EURCHF=X', 'GBP/CHF': 'GBPCHF=X',
  'EUR/CAD': 'EURCAD=X', 'GBP/NZD': 'GBPNZD=X', 'AUD/CAD': 'AUDCAD=X',
}

const MAJORS_10 = ['EUR/USD','GBP/USD','USD/JPY','AUD/USD','NZD/USD','USD/CAD','USD/CHF','EUR/GBP','EUR/JPY','GBP/JPY']

const IM_SYMBOLS = {
  SP500: '%5EGSPC', VIX: '%5EVIX', GOLD: 'GC%3DF',
  US10Y: '%5ETNX', OIL: 'CL%3DF', DXY: 'DX-Y.NYB',
}

const CURRENCIES = ['USD','EUR','GBP','JPY','CHF','AUD','CAD','NZD']
const SAFE_HAVENS = ['JPY','CHF']
const HIGH_YIELD = ['AUD','NZD','CAD']

// ─── Scoring (exact same as backfill) ──────────────────────
const BIAS_SCORES = {
  'hawkish': 2, 'verkrappend': 2, 'voorzichtig verkrappend': 1.5,
  'afwachtend': 0, 'neutraal': 0, 'neutral': 0,
  'voorzichtig verruimend': -1, 'dovish': -2, 'verruimend': -2,
}

function calcCBScore(bias) { return BIAS_SCORES[(bias||'').toLowerCase()] ?? 0 }
function calcRateScore(rate, target) {
  if (rate == null || target == null) return 0
  const d = rate - target
  return d > 0.5 ? 1 : d > 0 ? 0.5 : d > -0.5 ? -0.5 : -1
}

function calcNewsBonus(articles, currency, date) {
  if (!articles?.length) return 0
  const bull = ['rate hike','rate increase','higher than expected','beat expectations','hawkish surprise','tightening cycle']
  const bear = ['rate cut','rate decrease','lower than expected','missed expectations','dovish pivot','easing cycle']
  const neg = ['no ','not ','without ','failed to ','unlikely ','ruled out ']
  let total = 0
  const rel = articles.filter(a => a.affected_currencies?.includes(currency) && a.published_at && new Date(a.published_at) <= new Date(date+'T23:59:59Z'))
  for (const a of rel.slice(0,10)) {
    const t = ((a.title||'')+' '+(a.summary||'')).toLowerCase()
    const pub = new Date(a.published_at)
    const hrs = (new Date(date+'T16:00:00Z').getTime() - pub.getTime()) / 3600000
    if (hrs < 0 || hrs > 72) continue
    const rec = hrs < 12 ? 1.5 : hrs < 24 ? 1.2 : hrs < 48 ? 1.0 : 0.7
    let s = 0
    for (const p of bull) { if (t.includes(p)) { s += neg.some(n => t.includes(n+p)) ? -1.5 : 1.5 } }
    for (const p of bear) { if (t.includes(p)) { s += neg.some(n => t.includes(n+p)) ? 1.5 : -1.5 } }
    const rs = Math.min((a.relevance_score||3)/5, 1) * 1.5
    total += s * 0.25 * rec * rs
  }
  return Math.max(-1.5, Math.min(1.5, total))
}

function calcScores(cbRates, news, date) {
  const scores = {}
  for (const cur of CURRENCIES) {
    const r = cbRates.find(x => x.currency === cur)
    if (!r) { scores[cur] = 0; continue }
    scores[cur] = calcCBScore(r.bias) * 2 + calcRateScore(r.rate, r.target) * 1.5 + calcNewsBonus(news, cur, date)
  }
  return scores
}

function regime(scores) {
  const jpy = scores.JPY || 0
  const hy = HIGH_YIELD.reduce((s,c) => s + (scores[c]||0), 0) / HIGH_YIELD.length
  if (jpy > 1 && hy < 0) return 'Risk-Off'
  if (hy > 1 && jpy < 0) return 'Risk-On'
  if ((scores.USD||0) > 2) return 'USD Dominant'
  if ((scores.USD||0) < -2) return 'USD Zwak'
  return 'Gemengd'
}

function imAlignment(imHist, date, reg) {
  const chg = (k) => {
    const h = imHist[k] || []
    const i = h.findIndex(p => p.date === date)
    if (i <= 0) return null
    return h[i-1].close !== 0 ? ((h[i].close - h[i-1].close) / h[i-1].close) * 100 : null
  }
  let al = 0, tot = 0
  if (reg === 'Risk-Off') {
    const v=chg('VIX'), g=chg('GOLD'), s=chg('SP500'), y=chg('US10Y')
    if (v!==null&&v>0) al++; tot++
    if (g!==null&&g>0) al++; tot++
    if (s!==null&&s<0) al++; tot++
    if (y!==null&&y<0) al++; tot++
  } else if (reg === 'Risk-On') {
    const v=chg('VIX'), s=chg('SP500'), y=chg('US10Y'), o=chg('OIL')
    if (v!==null&&v<0) al++; tot++
    if (s!==null&&s>0) al++; tot++
    if (y!==null&&y>0) al++; tot++
    if (o!==null&&o>0) al++; tot++
  } else if (reg === 'USD Dominant' || reg === 'USD Zwak') {
    const up = reg === 'USD Dominant'
    const d=chg('DXY'), g=chg('GOLD')
    if (d!==null) { if ((d>0)===up) al++; tot++ }
    if (g!==null) { if ((g<0)===up) al++; tot++ }
  }
  return tot > 0 ? (al/tot)*100 : 50
}

// ─── Fetch prices ──────────────────────────────────────────
async function fetchPrices(symbol, days) {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days<=95?`${days+5}d`:days<=365?'1y':'2y'}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!r.ok) return []
    const j = await r.json()
    const res = j.chart?.result?.[0]
    if (!res) return []
    return (res.timestamp||[]).map((ts,i) => ({
      date: new Date(ts*1000).toISOString().split('T')[0],
      close: res.indicators?.quote?.[0]?.close?.[i],
    })).filter(d => d.close != null)
  } catch { return [] }
}

// ─── Main audit ────────────────────────────────────────────
async function main() {
  console.log('=== WINRATE AUDIT — ALLE CONFIGURATIES ===\n')
  console.log('Fetching data...\n')

  // 1. CB snapshots
  const { data: snaps } = await sb.from('cb_rate_snapshots').select('*').order('snapshot_date')
  const snapByDate = {}
  for (const s of snaps||[]) {
    if (!snapByDate[s.snapshot_date]) snapByDate[s.snapshot_date] = {}
    snapByDate[s.snapshot_date][s.currency] = s
  }
  const snapDates = Object.keys(snapByDate).sort()

  const { data: cbCurrent } = await sb.from('central_bank_rates').select('*')
  const curMap = {}
  for (const r of cbCurrent||[]) curMap[r.currency] = r

  function ratesForDate(d) {
    let m = curMap, best = ''
    for (const sd of snapDates) { if (sd <= d) best = sd; else break }
    if (best && snapByDate[best]) m = snapByDate[best]
    return Object.entries(m).map(([c, data]) => ({ currency: c, rate: data.rate, target: data.target, bias: data.bias }))
  }

  // 2. News
  const start = new Date(); start.setDate(start.getDate() - 365)
  const { data: news } = await sb.from('news_articles')
    .select('title,summary,affected_currencies,published_at,relevance_score')
    .gte('published_at', start.toISOString()).order('published_at', { ascending: false }).limit(2000)

  // 3. Prices
  console.log('Fetching price data for 21 pairs + intermarket...')
  const prices = {}
  for (const [pair, sym] of Object.entries(ALL_PAIRS)) {
    prices[pair] = await fetchPrices(sym, 375)
    process.stdout.write('.')
    await new Promise(r => setTimeout(r, 1200))
  }
  const imHist = {}
  for (const [k, sym] of Object.entries(IM_SYMBOLS)) {
    imHist[k] = await fetchPrices(sym, 375)
    process.stdout.write('.')
    await new Promise(r => setTimeout(r, 1200))
  }
  console.log(' Done!\n')

  // 4. Build dates
  const today = new Date().toISOString().split('T')[0]
  const dates = []
  for (let d = new Date(start); d.toISOString().split('T')[0] < today; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0])
  }

  // 5. Test configurations
  const configs = [
    // score threshold, lookback days, hold days, IM threshold, contrarian only, pair set name
    { name: 'HUIDIG (10 pairs, score≥2, 5d, IM>50)', threshold: 2.0, lookback: 5, hold: 1, imMin: 50, contrarianOnly: true, pairs: MAJORS_10 },
    { name: '21 pairs, score≥2, 5d contrarian, IM>50', threshold: 2.0, lookback: 5, hold: 1, imMin: 50, contrarianOnly: true, pairs: Object.keys(ALL_PAIRS) },
    { name: '21 pairs, score≥3, 5d contrarian, IM>50', threshold: 3.0, lookback: 5, hold: 1, imMin: 50, contrarianOnly: true, pairs: Object.keys(ALL_PAIRS) },
    { name: '10 pairs, score≥3, 5d contrarian, IM>50', threshold: 3.0, lookback: 5, hold: 1, imMin: 50, contrarianOnly: true, pairs: MAJORS_10 },
    { name: '21 pairs, score≥2, 3d contrarian, IM>50', threshold: 2.0, lookback: 3, hold: 1, imMin: 50, contrarianOnly: true, pairs: Object.keys(ALL_PAIRS) },
    { name: '21 pairs, score≥2, 5d contrarian, geen IM', threshold: 2.0, lookback: 5, hold: 1, imMin: 0, contrarianOnly: true, pairs: Object.keys(ALL_PAIRS) },
    { name: '21 pairs, score≥2, 5d ANY (geen contrarian), IM>50', threshold: 2.0, lookback: 5, hold: 1, imMin: 50, contrarianOnly: false, pairs: Object.keys(ALL_PAIRS) },
    { name: '21 pairs, score≥2, 5d contrarian, 2d hold, IM>50', threshold: 2.0, lookback: 5, hold: 2, imMin: 50, contrarianOnly: true, pairs: Object.keys(ALL_PAIRS) },
    { name: '10 pairs, score≥2, 5d contrarian, geen IM', threshold: 2.0, lookback: 5, hold: 1, imMin: 0, contrarianOnly: true, pairs: MAJORS_10 },
    { name: '21 pairs, score≥4, 5d contrarian, IM>50', threshold: 4.0, lookback: 5, hold: 1, imMin: 50, contrarianOnly: true, pairs: Object.keys(ALL_PAIRS) },
  ]

  for (const cfg of configs) {
    const trades = []

    for (const date of dates) {
      const cb = ratesForDate(date)
      const sc = calcScores(cb, news||[], date)
      const reg = regime(sc)
      const im = imAlignment(imHist, date, reg)

      if (cfg.imMin > 0 && im <= cfg.imMin) continue

      for (const pair of cfg.pairs) {
        const [base, quote] = pair.split('/')
        const diff = (sc[base]||0) - (sc[quote]||0)
        const absDiff = Math.abs(diff)
        if (absDiff < cfg.threshold) continue

        const isBull = diff > 0
        const ph = prices[pair] || []
        const ei = ph.findIndex(p => p.date === date)
        if (ei < cfg.lookback || ei >= ph.length - cfg.hold) continue

        const ep = ph[ei].close
        const lp = ph[ei - cfg.lookback].close
        const mom = ep - lp

        if (cfg.contrarianOnly) {
          const isContr = (isBull && mom < 0) || (!isBull && mom > 0)
          if (!isContr) continue
        }

        const xp = ph[ei + cfg.hold].close
        const pd = xp - ep
        let win = false
        if (isBull && pd > 0) win = true
        if (!isBull && pd < 0) win = true

        trades.push({
          date, pair, direction: isBull ? 'bullish' : 'bearish',
          score: Math.round(diff * 100) / 100,
          conviction: absDiff >= 3.5 ? 'sterk' : 'matig',
          win, im: Math.round(im),
          pips: Math.round(Math.abs(pd) * (pair.includes('JPY') ? 100 : 10000)) * (win ? 1 : -1),
        })
      }
    }

    const wins = trades.filter(t => t.win).length
    const wr = trades.length > 0 ? (wins/trades.length*100).toFixed(1) : '0.0'
    const totalPips = trades.reduce((s,t) => s + t.pips, 0)

    console.log(`\n${'═'.repeat(60)}`)
    console.log(`CONFIG: ${cfg.name}`)
    console.log(`${'─'.repeat(60)}`)
    console.log(`Trades: ${trades.length} | Wins: ${wins} | WR: ${wr}% | Pips: ${totalPips}`)

    if (trades.length > 0) {
      // Per pair
      const pp = {}
      trades.forEach(t => {
        if (!pp[t.pair]) pp[t.pair] = { w: 0, t: 0 }
        pp[t.pair].t++
        if (t.win) pp[t.pair].w++
      })
      console.log('\nPer pair:')
      Object.entries(pp).sort(([,a],[,b]) => (b.w/b.t)-(a.w/a.t)).forEach(([p,s]) => {
        console.log(`  ${p.padEnd(10)} ${s.w}/${s.t} = ${(s.w/s.t*100).toFixed(1)}%`)
      })

      // Per conviction
      const sterk = trades.filter(t => t.conviction === 'sterk')
      const matig = trades.filter(t => t.conviction === 'matig')
      const sw = sterk.filter(t => t.win).length
      const mw = matig.filter(t => t.win).length
      console.log(`\nSterk (≥3.5): ${sw}/${sterk.length} = ${sterk.length>0?(sw/sterk.length*100).toFixed(1):'0'}%`)
      console.log(`Matig (2-3.5): ${mw}/${matig.length} = ${matig.length>0?(mw/matig.length*100).toFixed(1):'0'}%`)

      // Per maand
      console.log('\nPer maand:')
      const pm = {}
      trades.forEach(t => {
        const m = t.date.slice(0,7)
        if (!pm[m]) pm[m] = { w: 0, t: 0 }
        pm[m].t++
        if (t.win) pm[m].w++
      })
      Object.entries(pm).sort().forEach(([m,s]) => {
        const bar = '█'.repeat(Math.round(s.w/s.t*20))
        console.log(`  ${m}: ${s.w}/${s.t} = ${(s.w/s.t*100).toFixed(1).padStart(5)}% ${bar}`)
      })
    }
  }

  console.log('\n\n=== AUDIT COMPLEET ===')
}

main().catch(console.error)
