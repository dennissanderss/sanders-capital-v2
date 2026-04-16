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

async function main() {
  const { data: trades } = await sb.from('trade_focus_records').select('*').order('date')
  const resolved = trades.filter(t => t.result === 'correct' || t.result === 'incorrect')
  const sweet = resolved.filter(t => {
    const s = Math.abs(t.score), m = Math.abs(t.metadata?.momentum5d || 0)
    return s >= 2 && s < 3 && m >= 50 && m < 100
  })

  console.log(`Analyseer ${sweet.length} sweet spot trades...\n`)

  const results = []
  const uniquePairs = [...new Set(sweet.map(t => t.pair))]

  for (const pair of uniquePairs) {
    const sym = yahooMap[pair]
    if (!sym) continue
    const pip = pair.includes('JPY') ? 0.01 : 0.0001
    const pts = sweet.filter(t => t.pair === pair)

    for (const trade of pts) {
      const allCandles = await fetchHourly(sym, trade.date)
      const dayCandles = allCandles.filter(c => c.date === trade.date)
      const nextDayCandles = allCandles.filter(c => c.date > trade.date).slice(0, 24)
      if (dayCandles.length === 0) continue

      const isBull = trade.direction === 'bullish'
      const entry = trade.entry_price

      // Vind reversal candle
      let hitAdverse = false, reversalCandle = null, reversalIdx = -1, candlesAgainst = 0
      for (let i = 0; i < dayCandles.length; i++) {
        const c = dayCandles[i]
        const adverse = isBull ? (entry - c.l) / pip : (c.h - entry) / pip
        if (adverse > 3) hitAdverse = true
        if (hitAdverse && !reversalCandle) {
          const isRev = isBull ? (c.c > c.o && c.c > entry) : (c.c < c.o && c.c < entry)
          if (isRev) { reversalCandle = c; reversalIdx = i }
          else candlesAgainst++
        }
      }

      // MAE uur voor sessie filter
      let maeHour = -1, maxMAE = 0
      for (const c of dayCandles) {
        const mae = isBull ? (entry - c.l) / pip : (c.h - entry) / pip
        if (mae > maxMAE) { maxMAE = mae; maeHour = c.hour }
      }
      const goodSession = maeHour >= 0 && maeHour < 12 // Asia + London

      // MFE en MAE vanaf reversal entry
      let mfeFromRev = 0, maeFromRev = 0
      if (reversalCandle) {
        const revEntry = reversalCandle.c
        const allAfter = [...dayCandles.slice(reversalIdx), ...nextDayCandles]
        for (const c of allAfter) {
          const mfe = isBull ? (c.h - revEntry) / pip : (revEntry - c.l) / pip
          const mae = isBull ? (revEntry - c.l) / pip : (c.h - revEntry) / pip
          if (mfe > mfeFromRev) mfeFromRev = mfe
          if (mae > maeFromRev) maeFromRev = mae
        }
      }

      results.push({
        pair, date: trade.date, result: trade.result,
        hasReversal: !!reversalCandle,
        reversalHour: reversalCandle ? reversalCandle.hour : -1,
        candlesAgainst, goodSession,
        maeFromRev: Math.round(maeFromRev),
        mfeFromRev: Math.round(mfeFromRev),
      })
    }
    process.stdout.write('.')
    await new Promise(r => setTimeout(r, 1500))
  }

  const withRev = results.filter(t => t.hasReversal)
  const goodSessRev = withRev.filter(t => t.goodSession)
  const max3candles = withRev.filter(t => t.candlesAgainst <= 3)
  const fullFilter = withRev.filter(t => t.goodSession && t.candlesAgainst <= 3)

  console.log(`\n\n${'═'.repeat(60)}`)
  console.log('  DEFINITIEF MODEL — RESULTATEN')
  console.log(`${'═'.repeat(60)}\n`)

  // Test alle groepen
  const groups = [
    { name: 'Alle reversal trades', data: withRev },
    { name: '+ Sessie filter (Asia/London)', data: goodSessRev },
    { name: '+ Max 3 candles tegen', data: max3candles },
    { name: '+ Beide filters', data: fullFilter },
  ]

  for (const group of groups) {
    console.log(`\n── ${group.name} (${group.data.length} trades) ──`)

    const combos = []
    for (let sl = 20; sl <= 50; sl += 5) {
      for (let tp = 20; tp <= 80; tp += 5) {
        if (tp < sl) continue // alleen RR >= 1:1
        let wins = 0, losses = 0
        for (const t of group.data) {
          if (t.maeFromRev >= sl) losses++
          else if (t.mfeFromRev >= tp) wins++
          else if (t.result === 'correct') wins++
          else losses++
        }
        const total = wins + losses
        if (total === 0) continue
        const wr = (wins / total * 100).toFixed(1)
        const rr = (tp / sl).toFixed(1)
        const netPips = wins * tp - losses * sl
        const exp = (netPips / total).toFixed(1)
        const pf = (losses * sl) > 0 ? ((wins * tp) / (losses * sl)).toFixed(2) : '999'
        combos.push({ sl, tp, rr, wr, exp, pf, wins, losses, total, netPips })
      }
    }

    combos.sort((a, b) => parseFloat(b.exp) - parseFloat(a.exp))
    console.log('  Beste 5 (op expectancy, RR >= 1:1):')
    combos.slice(0, 5).forEach(c => {
      console.log(`  SL=${c.sl} TP=${c.tp} (1:${c.rr}) → WR=${c.wr}%, PF=${c.pf}, Exp=${parseFloat(c.exp) > 0 ? '+' : ''}${c.exp}p/trade, Net=${c.netPips > 0 ? '+' : ''}${c.netPips}p`)
    })
  }

  // ─── DEFINITIEF MODEL MET BESTE COMBO ──────────────────
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  FREQUENTIE & RENDEMENT')
  console.log(`${'═'.repeat(60)}\n`)

  const totalDays = 325

  for (const group of groups) {
    const combos = []
    for (let sl = 20; sl <= 50; sl += 5) {
      for (let tp = 20; tp <= 80; tp += 5) {
        if (tp < sl) continue
        let wins = 0, losses = 0
        for (const t of group.data) {
          if (t.maeFromRev >= sl) losses++
          else if (t.mfeFromRev >= tp) wins++
          else if (t.result === 'correct') wins++
          else losses++
        }
        const total = wins + losses
        if (total === 0) continue
        const netPips = wins * tp - losses * sl
        const exp = netPips / total
        combos.push({ sl, tp, exp, wins, losses, total, netPips, wr: (wins / total * 100).toFixed(1), pf: (losses * sl) > 0 ? ((wins * tp) / (losses * sl)).toFixed(2) : '999' })
      }
    }
    combos.sort((a, b) => b.exp - a.exp)
    const best = combos[0]
    if (!best) continue

    const perWeek = (group.data.length / totalDays * 5).toFixed(1)
    const perMonth = (group.data.length / totalDays * 21).toFixed(1)
    const monthlyPips = best.exp * parseFloat(perMonth)

    console.log(`${group.name}:`)
    console.log(`  Trades: ${group.data.length} (${perWeek}/week, ${perMonth}/maand)`)
    console.log(`  Beste: SL=${best.sl} TP=${best.tp} → WR=${best.wr}%, PF=${best.pf}, Exp=${best.exp > 0 ? '+' : ''}${best.exp.toFixed(1)}p`)
    console.log(`  Pips/maand: ${monthlyPips > 0 ? '+' : ''}${monthlyPips.toFixed(0)}`)

    for (const bal of [5000, 10000, 25000]) {
      const riskPerPip = (bal * 0.01) / best.sl
      const monthly = monthlyPips * riskPerPip
      console.log(`  $${bal}: ~$${monthly.toFixed(0)}/maand (${(monthly / bal * 100).toFixed(1)}%)`)
    }
    console.log('')
  }
}

main().catch(console.error)
