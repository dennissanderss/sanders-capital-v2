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
  'USD/CAD':'USDCAD=X','USD/CHF':'USDCHF=X','EUR/JPY':'EURJPY=X','EUR/CHF':'EURCHF=X',
  'GBP/AUD':'GBPAUD=X','GBP/NZD':'GBPNZD=X','EUR/CAD':'EURCAD=X','AUD/NZD':'AUDNZD=X',
}

async function fetchHourly(symbol, date) {
  const d = new Date(date + 'T00:00:00Z')
  const p1 = Math.floor(d.getTime() / 1000) - 86400
  const p2 = Math.floor(d.getTime() / 1000) + 86400 * 2
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1h&period1=${p1}&period2=${p2}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const j = await r.json()
    const c = j.chart?.result?.[0]
    if (!c) return []
    const ts = c.timestamp || [], q = c.indicators?.quote?.[0] || {}
    return ts.map((t, i) => ({
      hour: new Date(t * 1000).getUTCHours(),
      date: new Date(t * 1000).toISOString().split('T')[0],
      o: q.open?.[i], h: q.high?.[i], l: q.low?.[i], c: q.close?.[i],
    })).filter(x => x.o && x.h && x.l && x.c)
  } catch { return [] }
}

async function analyzeConfig(resolved, name, scoreMin, scoreMax, momMin, momMax, slTest, tpTest) {
  const filtered = resolved.filter(t => {
    const s = Math.abs(t.score), m = Math.abs(t.metadata?.momentum5d || 0)
    return s >= scoreMin && s < scoreMax && m >= momMin && m < momMax
  })

  if (filtered.length < 15) return null

  const byPair = {}
  filtered.forEach(t => { if (!byPair[t.pair]) byPair[t.pair] = []; byPair[t.pair].push(t) })

  const results = []
  for (const [pair, pts] of Object.entries(byPair)) {
    const sym = yahooMap[pair]
    if (!sym) continue
    const pip = pair.includes('JPY') ? 0.01 : 0.0001

    for (const trade of pts) {
      const allCandles = await fetchHourly(sym, trade.date)
      const dayCandles = allCandles.filter(c => c.date === trade.date)
      const nextDay = allCandles.filter(c => c.date > trade.date).slice(0, 24)
      if (dayCandles.length === 0) continue

      const isBull = trade.direction === 'bullish'
      const entry = trade.entry_price

      let hitAdverse = false, revCandle = null, revIdx = -1
      for (let i = 0; i < dayCandles.length; i++) {
        const c = dayCandles[i]
        const adv = isBull ? (entry - c.l) / pip : (c.h - entry) / pip
        if (adv > 3) hitAdverse = true
        if (hitAdverse && !revCandle) {
          const isRev = isBull ? (c.c > c.o && c.c > entry) : (c.c < c.o && c.c < entry)
          if (isRev) { revCandle = c; revIdx = i }
        }
      }

      let mfe = 0, mae = 0
      if (revCandle) {
        const re = revCandle.c
        for (const c of [...dayCandles.slice(revIdx), ...nextDay]) {
          const f = isBull ? (c.h - re) / pip : (re - c.l) / pip
          const a = isBull ? (re - c.l) / pip : (c.h - re) / pip
          if (f > mfe) mfe = f
          if (a > mae) mae = a
        }
      }
      results.push({ result: trade.result, hasRev: !!revCandle, mfe: Math.round(mfe), mae: Math.round(mae) })
    }
    await new Promise(r => setTimeout(r, 600))
  }

  const withRev = results.filter(t => t.hasRev)
  if (withRev.length < 10) return null

  // Test SL/TP
  let w = 0, l = 0
  for (const t of withRev) {
    if (t.mae >= slTest) l++
    else if (t.mfe >= tpTest) w++
    else if (t.result === 'correct') w++
    else l++
  }
  const tot = w + l
  const wr = (w / tot * 100).toFixed(1)
  const net = w * tpTest - l * slTest
  const exp = (net / tot).toFixed(1)
  const pf = (l * slTest) > 0 ? ((w * tpTest) / (l * slTest)).toFixed(2) : '999'
  const perWeek = (withRev.length / 46).toFixed(1) // 46 weken in dataset

  return { name, trades: withRev.length, perWeek, wr, pf, exp, net, sl: slTest, tp: tpTest, w, l, filtered: filtered.length }
}

async function main() {
  const { data: trades } = await sb.from('trade_focus_records').select('*').order('date')
  const resolved = trades.filter(t => t.result === 'correct' || t.result === 'incorrect')

  console.log(`Totaal: ${resolved.length} trades\n`)
  console.log('Onderzoek: hoe meer trades per week zonder kwaliteit te verliezen?\n')

  // Strategie 1: verbreed de filters
  const configs = [
    // Huidige Config G
    ['Config G (huidig)', 2, 3, 30, 120, 40, 120],
    // Verbreed score
    ['Score 2-3.5, Mom 30-120', 2, 3.5, 30, 120, 40, 120],
    ['Score 2-4, Mom 30-120', 2, 4, 30, 120, 40, 120],
    ['Score 1.5-3, Mom 30-120', 1.5, 3, 30, 120, 40, 120],
    // Verbreed momentum
    ['Score 2-3, Mom 20-150', 2, 3, 20, 150, 40, 120],
    ['Score 2-3, Mom 15-150', 2, 3, 15, 150, 40, 120],
    ['Score 2-3, Mom 10-200', 2, 3, 10, 200, 40, 120],
    // Verbreed beide
    ['Score 2-3.5, Mom 20-150', 2, 3.5, 20, 150, 40, 120],
    ['Score 2-4, Mom 20-150', 2, 4, 20, 150, 40, 120],
    // Andere SL/TP bij bredere filter
    ['Score 2-3.5, Mom 20-150, SL50/TP100', 2, 3.5, 20, 150, 50, 100],
    ['Score 2-3.5, Mom 20-150, SL30/TP90', 2, 3.5, 20, 150, 30, 90],
    ['Score 2-4, Mom 20-150, SL35/TP70', 2, 4, 20, 150, 35, 70],
    // Alle trades (geen mom filter)
    ['Score 2-3, ALLE momentum', 2, 3, 0, 9999, 40, 120],
    ['Score 2-3, ALLE momentum, SL30/TP60', 2, 3, 0, 9999, 30, 60],
  ]

  const results = []
  for (const [name, sMin, sMax, mMin, mMax, sl, tp] of configs) {
    process.stdout.write(`Testing: ${name}...`)
    const r = await analyzeConfig(resolved, name, sMin, sMax, mMin, mMax, sl, tp)
    if (r) {
      results.push(r)
      console.log(` ${r.perWeek}/week, WR=${r.wr}%, PF=${r.pf}`)
    } else {
      console.log(' (te weinig data)')
    }
  }

  // Sorteer op maandelijks rendement (expectancy × trades/maand)
  results.forEach(r => {
    r.monthlyPips = (parseFloat(r.exp) * parseFloat(r.perWeek) * 4.3).toFixed(0)
    r.monthlyReturn = ((parseFloat(r.monthlyPips) * (100 / r.sl) * 0.01) * 100).toFixed(1) // % return bij 1% risk
  })
  results.sort((a, b) => parseFloat(b.monthlyPips) - parseFloat(a.monthlyPips))

  console.log('\n' + '═'.repeat(90))
  console.log('  RESULTATEN — gesorteerd op maandelijks rendement')
  console.log('═'.repeat(90))
  console.log('Config'.padEnd(42) + 'Trades /week  WR      PF     Exp/trade  Pips/mnd  $10k/mnd')
  console.log('─'.repeat(90))

  for (const r of results) {
    const dollarMonth = (parseFloat(r.monthlyPips) * (10000 * 0.01 / r.sl)).toFixed(0)
    console.log(
      r.name.padEnd(42) +
      String(r.trades).padEnd(7) +
      r.perWeek.padEnd(6) +
      (r.wr + '%').padEnd(8) +
      r.pf.padEnd(7) +
      (parseFloat(r.exp) > 0 ? '+' : '') + r.exp.padEnd(11) + 'p' +
      r.monthlyPips.padEnd(10) +
      '$' + dollarMonth
    )
  }

  console.log('\n' + '═'.repeat(90))
  console.log('  AANBEVELING')
  console.log('═'.repeat(90))

  // Vind de config met >= 3 trades/week EN hoogste expectancy
  const min3 = results.filter(r => parseFloat(r.perWeek) >= 3)
  const min4 = results.filter(r => parseFloat(r.perWeek) >= 4)
  const min5 = results.filter(r => parseFloat(r.perWeek) >= 5)

  if (min3.length > 0) {
    const best3 = min3[0]
    console.log(`\nBeste met ≥3/week: ${best3.name}`)
    console.log(`  ${best3.perWeek}/week, WR=${best3.wr}%, PF=${best3.pf}, Exp=${best3.exp}p, ~${best3.monthlyPips}p/mnd`)
  }
  if (min4.length > 0) {
    const best4 = min4[0]
    console.log(`\nBeste met ≥4/week: ${best4.name}`)
    console.log(`  ${best4.perWeek}/week, WR=${best4.wr}%, PF=${best4.pf}, Exp=${best4.exp}p, ~${best4.monthlyPips}p/mnd`)
  }
  if (min5.length > 0) {
    const best5 = min5[0]
    console.log(`\nBeste met ≥5/week: ${best5.name}`)
    console.log(`  ${best5.perWeek}/week, WR=${best5.wr}%, PF=${best5.pf}, Exp=${best5.exp}p, ~${best5.monthlyPips}p/mnd`)
  }
}

main().catch(console.error)
