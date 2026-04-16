import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

const yahooMap = {
  'EUR/USD':'EURUSD=X','GBP/USD':'GBPUSD=X','AUD/USD':'AUDUSD=X','NZD/USD':'NZDUSD=X',
  'EUR/GBP':'EURGBP=X','GBP/JPY':'GBPJPY=X','AUD/JPY':'AUDJPY=X','AUD/CAD':'AUDCAD=X',
  'EUR/AUD':'EURAUD=X','GBP/CHF':'GBPCHF=X','NZD/JPY':'NZDJPY=X','USD/JPY':'USDJPY=X',
  'USD/CAD':'USDCAD=X','USD/CHF':'USDCHF=X','EUR/JPY':'EURJPY=X',
}

async function fetchHourly(symbol, date) {
  // Haal 1H candles op voor specifieke dag + dag erna (2 dagen)
  const d = new Date(date + 'T00:00:00Z')
  const period1 = Math.floor(d.getTime() / 1000) - 86400 // dag ervoor (voor context)
  const period2 = Math.floor(d.getTime() / 1000) + 86400 * 2 // 2 dagen erna

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1h&period1=${period1}&period2=${period2}`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const j = await r.json()
    const c = j.chart?.result?.[0]
    if (!c) return []

    const ts = c.timestamp || []
    const q = c.indicators?.quote?.[0] || {}

    return ts.map((t, i) => ({
      time: new Date(t * 1000).toISOString(),
      hour: new Date(t * 1000).getUTCHours(),
      date: new Date(t * 1000).toISOString().split('T')[0],
      open: q.open?.[i],
      high: q.high?.[i],
      low: q.low?.[i],
      close: q.close?.[i],
    })).filter(c => c.open && c.high && c.low && c.close)
  } catch (e) {
    return []
  }
}

async function main() {
  const { data: trades } = await sb.from('trade_focus_records').select('*').order('date')
  const resolved = trades.filter(t => t.result === 'correct' || t.result === 'incorrect')
  const sweet = resolved.filter(t => {
    const s = Math.abs(t.score), m = Math.abs(t.metadata?.momentum5d || 0)
    return s >= 2 && s < 3 && m >= 50 && m < 100
  })

  console.log('════════════════════════════════════════════════════════════')
  console.log('  INTRADAY ANALYSE — 1H CANDLE DATA VOOR SWEET SPOT TRADES')
  console.log('════════════════════════════════════════════════════════════\n')
  console.log(`Analyseer ${sweet.length} sweet spot trades met 1H candle data...\n`)

  // Verzamel data per pair (batch ophalen)
  const uniquePairs = [...new Set(sweet.map(t => t.pair))]
  const allResults = []

  for (const pair of uniquePairs) {
    const sym = yahooMap[pair]
    if (!sym) continue

    const pairTrades = sweet.filter(t => t.pair === pair)
    const pip = pair.includes('JPY') ? 0.01 : 0.0001

    for (const trade of pairTrades) {
      const candles = await fetchHourly(sym, trade.date)
      if (candles.length === 0) continue

      const entryDate = trade.date
      const isBull = trade.direction === 'bullish'
      const entryPrice = trade.entry_price

      // Filter candles voor de entry dag
      const dayCandles = candles.filter(c => c.date === entryDate)
      if (dayCandles.length === 0) continue

      // Vind het moment van maximale adverse excursion (MAE)
      // = de candle waar de prijs het verst TEGEN je ging
      let maxMAE = 0, maeHour = -1, maeCandle = null
      let maxMFE = 0, mfeHour = -1, mfeCandle = null

      for (const c of dayCandles) {
        const mae = isBull ? (entryPrice - c.low) / pip : (c.high - entryPrice) / pip
        const mfe = isBull ? (c.high - entryPrice) / pip : (entryPrice - c.low) / pip

        if (mae > maxMAE) { maxMAE = mae; maeHour = c.hour; maeCandle = c }
        if (mfe > maxMFE) { maxMFE = mfe; mfeHour = c.hour; mfeCandle = c }
      }

      // Analyse van de candles: welke sessie was de omslag?
      // London: 07-12 UTC, NY overlap: 12-17 UTC, NY: 17-22 UTC
      const getSession = (h) => {
        if (h >= 0 && h < 7) return 'Asia'
        if (h >= 7 && h < 12) return 'London'
        if (h >= 12 && h < 17) return 'Overlap'
        return 'NY_Late'
      }

      // Vind de eerste candle die in de juiste richting breekt na MAE
      let reversalHour = -1, reversalSession = ''
      let hitMAEFirst = false

      for (const c of dayCandles) {
        const adverse = isBull ? (entryPrice - c.low) / pip : (c.high - entryPrice) / pip
        if (adverse > 5) hitMAEFirst = true // prijs ging eerst tegen je

        if (hitMAEFirst) {
          // Zoek de bullish/bearish reversal candle
          const isBullCandle = c.close > c.open
          const isBearCandle = c.close < c.open

          if ((isBull && isBullCandle && c.close > entryPrice) ||
              (!isBull && isBearCandle && c.close < entryPrice)) {
            reversalHour = c.hour
            reversalSession = getSession(c.hour)
            break
          }
        }
      }

      // RSI-achtige momentum: was er een duidelijke candle pattern?
      // Tel consecutive candles in de VERKEERDE richting voor de omslag
      let consecutiveAgainst = 0
      for (const c of dayCandles) {
        if (c.hour > maeHour) break
        const against = isBull ? c.close < c.open : c.close > c.open
        if (against) consecutiveAgainst++
        else consecutiveAgainst = 0
      }

      allResults.push({
        pair, date: entryDate, direction: trade.direction, result: trade.result,
        mae: Math.round(maxMAE), mfe: Math.round(maxMFE),
        maeHour, mfeHour, maeSession: getSession(maeHour), mfeSession: getSession(mfeHour),
        reversalHour, reversalSession,
        consecutiveAgainst,
        totalCandles: dayCandles.length,
      })
    }

    process.stdout.write('.')
    await new Promise(r => setTimeout(r, 1500))
  }

  console.log(`\n\nSuccesvol geanalyseerd: ${allResults.length} trades\n`)

  if (allResults.length === 0) { console.log('Geen data'); return }

  const winners = allResults.filter(t => t.result === 'correct')
  const losers = allResults.filter(t => t.result === 'incorrect')

  // ─── 1. WANNEER WORDT DE MAE GEZET? ─────────────────────
  console.log('=== 1. WANNEER GAAT DE PRIJS HET VERST TEGEN JE? (MAE uur) ===')
  const maeByHour = {}
  allResults.forEach(t => {
    if (t.maeHour < 0) return
    const h = t.maeHour
    if (!maeByHour[h]) maeByHour[h] = 0
    maeByHour[h]++
  })
  Object.entries(maeByHour).sort(([a],[b]) => Number(a)-Number(b)).forEach(([h, c]) => {
    const bar = '█'.repeat(c)
    console.log(`  ${String(h).padStart(2)}:00 UTC: ${String(c).padStart(3)} trades ${bar}`)
  })

  // Per sessie
  console.log('\nMAE per sessie:')
  const maeBySess = {}
  allResults.forEach(t => { if (!maeBySess[t.maeSession]) maeBySess[t.maeSession] = 0; maeBySess[t.maeSession]++ })
  Object.entries(maeBySess).sort(([,a],[,b]) => b-a).forEach(([s,c]) => {
    console.log(`  ${s.padEnd(10)}: ${c} trades (${(c/allResults.length*100).toFixed(0)}%)`)
  })

  // ─── 2. WANNEER DRAAIT DE PRIJS OM? (reversal) ──────────
  console.log('\n=== 2. WANNEER DRAAIT DE PRIJS OM? (reversal candle) ===')
  console.log('Alleen winners:')
  const revByHour = {}
  winners.filter(t => t.reversalHour >= 0).forEach(t => {
    if (!revByHour[t.reversalHour]) revByHour[t.reversalHour] = 0
    revByHour[t.reversalHour]++
  })
  Object.entries(revByHour).sort(([a],[b]) => Number(a)-Number(b)).forEach(([h, c]) => {
    const bar = '█'.repeat(c)
    console.log(`  ${String(h).padStart(2)}:00 UTC: ${String(c).padStart(3)} reversals ${bar}`)
  })

  console.log('\nReversal per sessie (winners):')
  const revBySess = {}
  winners.filter(t => t.reversalSession).forEach(t => { if (!revBySess[t.reversalSession]) revBySess[t.reversalSession] = 0; revBySess[t.reversalSession]++ })
  Object.entries(revBySess).sort(([,a],[,b]) => b-a).forEach(([s,c]) => {
    console.log(`  ${s.padEnd(10)}: ${c} reversals (${(c/winners.length*100).toFixed(0)}%)`)
  })

  // ─── 3. WINNERS vs LOSERS INTRADAY PATROON ──────────────
  console.log('\n=== 3. WINNERS vs LOSERS INTRADAY ===')
  console.log(`Winners (${winners.length}): avg MAE=${Math.round(winners.reduce((s,t)=>s+t.mae,0)/winners.length)}p @ ${winners.filter(t=>t.maeHour>=0).length>0 ? (winners.filter(t=>t.maeHour>=0).reduce((s,t)=>s+t.maeHour,0)/winners.filter(t=>t.maeHour>=0).length).toFixed(0) : '?'}:00 UTC, avg MFE=${Math.round(winners.reduce((s,t)=>s+t.mfe,0)/winners.length)}p @ ${winners.filter(t=>t.mfeHour>=0).length>0 ? (winners.filter(t=>t.mfeHour>=0).reduce((s,t)=>s+t.mfeHour,0)/winners.filter(t=>t.mfeHour>=0).length).toFixed(0) : '?'}:00 UTC`)
  console.log(`Losers  (${losers.length}): avg MAE=${Math.round(losers.reduce((s,t)=>s+t.mae,0)/losers.length)}p @ ${losers.filter(t=>t.maeHour>=0).length>0 ? (losers.filter(t=>t.maeHour>=0).reduce((s,t)=>s+t.maeHour,0)/losers.filter(t=>t.maeHour>=0).length).toFixed(0) : '?'}:00 UTC, avg MFE=${Math.round(losers.reduce((s,t)=>s+t.mfe,0)/losers.length)}p @ ${losers.filter(t=>t.mfeHour>=0).length>0 ? (losers.filter(t=>t.mfeHour>=0).reduce((s,t)=>s+t.mfeHour,0)/losers.filter(t=>t.mfeHour>=0).length).toFixed(0) : '?'}:00 UTC`)

  // ─── 4. CONSECUTIVE CANDLES TEGEN JE VOOR OMSLAG ─────────
  console.log('\n=== 4. HOEVEEL CANDLES GAAN EERST TEGEN JE? ===')
  const consDist = {}
  allResults.forEach(t => { consDist[t.consecutiveAgainst] = (consDist[t.consecutiveAgainst] || 0) + 1 })
  Object.entries(consDist).sort(([a],[b]) => Number(a)-Number(b)).forEach(([n, c]) => {
    const wr = allResults.filter(t => t.consecutiveAgainst === Number(n) && t.result === 'correct').length
    console.log(`  ${n} candles: ${c} trades, ${wr} wins (${(wr/c*100).toFixed(0)}% WR)`)
  })

  // ─── 5. OPTIMALE ENTRY TIMING ────────────────────────────
  console.log('\n=== 5. CONCLUSIE: OPTIMALE ENTRY TIMING ===')

  // Welk uur heeft de beste winrate als je op DAT uur instapt?
  // Simuleer: als je pas instapt bij de reversal candle
  console.log('\nAls je wacht op de reversal candle (eerste candle die terugdraait):')
  const revWins = winners.filter(t => t.reversalHour >= 0).length
  const revTotal = allResults.filter(t => t.reversalHour >= 0).length
  console.log(`  ${revWins}/${revTotal} = ${(revWins/revTotal*100).toFixed(1)}% winrate`)

  // Per sessie entry winrate
  console.log('\nWinrate als je instapt TIJDENS specifieke sessie:')
  const sessions = ['Asia', 'London', 'Overlap', 'NY_Late']
  for (const sess of sessions) {
    // Trades waar de MAE in deze sessie valt (= de dip/piek is tijdens deze sessie)
    const sessT = allResults.filter(t => t.maeSession === sess)
    const sessW = sessT.filter(t => t.result === 'correct').length
    if (sessT.length > 0)
      console.log(`  ${sess.padEnd(10)}: ${sessW}/${sessT.length} = ${(sessW/sessT.length*100).toFixed(0)}% WR (MAE valt in ${sess})`)
  }
}

main().catch(console.error)
