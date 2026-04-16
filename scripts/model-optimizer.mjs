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

async function main() {
  const { data: trades } = await sb.from('trade_focus_records').select('*').order('date')
  const resolved = trades.filter(t => t.result === 'correct' || t.result === 'incorrect')

  console.log(`Totaal resolved: ${resolved.length}\n`)

  // ─── TEST MEERDERE FILTER CONFIGURATIES ────────────────
  // Het doel: meer trades per week met behoud van goede winrate en expectancy
  const configs = [
    // Test 1 was: score 2-3, mom 50-100 → 68 trades, 67.6% WR
    { name: 'A: Score 2-3.5, Mom 30-100', scoreMin: 2, scoreMax: 3.5, momMin: 30, momMax: 100 },
    { name: 'B: Score 2-4, Mom 30-100', scoreMin: 2, scoreMax: 4, momMin: 30, momMax: 100 },
    { name: 'C: Score 2-3.5, Mom 20-120', scoreMin: 2, scoreMax: 3.5, momMin: 20, momMax: 120 },
    { name: 'D: Score 2-4, Mom 20-120', scoreMin: 2, scoreMax: 4, momMin: 20, momMax: 120 },
    { name: 'E: Alle score>=2, Mom 30-100', scoreMin: 2, scoreMax: 99, momMin: 30, momMax: 100 },
    { name: 'F: Alle score>=2, Mom 20-150', scoreMin: 2, scoreMax: 99, momMin: 20, momMax: 150 },
    { name: 'G: Score 2-3, Mom 30-120', scoreMin: 2, scoreMax: 3, momMin: 30, momMax: 120 },
    { name: 'H: Score 2-3, Mom 20-150', scoreMin: 2, scoreMax: 3, momMin: 20, momMax: 150 },
  ]

  // Eerst zonder intraday data — puur op dagbasis
  console.log('=== FASE 1: DAGBASIS ANALYSE (snel) ===\n')
  console.log('Config'.padEnd(40) + 'Trades  /week   WR      Exp(dag)')
  console.log('─'.repeat(70))

  const totalDays = 73 // handelsdagen in dataset

  for (const cfg of configs) {
    const filtered = resolved.filter(t => {
      const s = Math.abs(t.score), m = Math.abs(t.metadata?.momentum5d || 0)
      return s >= cfg.scoreMin && s < cfg.scoreMax && m >= cfg.momMin && m < cfg.momMax
    })
    const wins = filtered.filter(t => t.result === 'correct').length
    const wr = filtered.length > 0 ? (wins / filtered.length * 100).toFixed(1) : '0'
    const perWeek = (filtered.length / totalDays * 5).toFixed(1)

    // Dagbasis expectancy
    const pipsData = filtered.map(t => {
      const pip = t.pair.includes('JPY') ? 0.01 : 0.0001
      const bull = t.direction === 'bullish'
      return bull ? (t.exit_price - t.entry_price) / pip : (t.entry_price - t.exit_price) / pip
    })
    const avgPips = pipsData.length > 0 ? (pipsData.reduce((a, b) => a + b, 0) / pipsData.length).toFixed(1) : '0'

    console.log(`${cfg.name.padEnd(40)}${String(filtered.length).padEnd(8)}${perWeek.padEnd(8)}${(wr + '%').padEnd(8)}${avgPips}p`)
  }

  // ─── FASE 2: TOP 3 CONFIGS MET INTRADAY DATA ──────────
  // Kies configs met beste trades/week × WR balans
  console.log('\n\n=== FASE 2: INTRADAY ANALYSE VOOR TOP CONFIGS ===\n')

  const topConfigs = [
    { name: 'D: Score 2-4, Mom 20-120', scoreMin: 2, scoreMax: 4, momMin: 20, momMax: 120 },
    { name: 'F: Alle score>=2, Mom 20-150', scoreMin: 2, scoreMax: 99, momMin: 20, momMax: 150 },
    { name: 'G: Score 2-3, Mom 30-120', scoreMin: 2, scoreMax: 3, momMin: 30, momMax: 120 },
  ]

  for (const cfg of topConfigs) {
    const filtered = resolved.filter(t => {
      const s = Math.abs(t.score), m = Math.abs(t.metadata?.momentum5d || 0)
      return s >= cfg.scoreMin && s < cfg.scoreMax && m >= cfg.momMin && m < cfg.momMax
    })

    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  ${cfg.name} — ${filtered.length} trades (${(filtered.length / totalDays * 5).toFixed(1)}/week)`)
    console.log(`${'═'.repeat(60)}`)

    // Haal intraday data op per pair
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

        // Reversal candle detectie
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

        // MAE/MFE vanaf reversal
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
      process.stdout.write('.')
      await new Promise(r => setTimeout(r, 800))
    }

    const withRev = results.filter(t => t.hasRev)
    console.log(`\nMet reversal candle: ${withRev.length}/${results.length}`)

    // Test SL/TP combos (RR >= 1:1 alleen)
    const combos = []
    for (let sl = 20; sl <= 50; sl += 5) {
      for (let tp of [sl, Math.round(sl * 1.5), sl * 2, Math.round(sl * 2.5), sl * 3]) {
        if (tp > 120) continue
        let w = 0, l = 0
        for (const t of withRev) {
          if (t.mae >= sl) l++
          else if (t.mfe >= tp) w++
          else if (t.result === 'correct') w++
          else l++
        }
        const tot = w + l
        if (tot < 10) continue
        const wr = (w / tot * 100).toFixed(1)
        const net = w * tp - l * sl
        const exp = (net / tot).toFixed(1)
        const pf = (l * sl) > 0 ? ((w * tp) / (l * sl)).toFixed(2) : '999'
        const perWeek = (withRev.length / totalDays * 5).toFixed(1)
        const perMonth = (withRev.length / totalDays * 21).toFixed(1)
        const monthlyPips = (net / tot) * parseFloat(perMonth)
        combos.push({ sl, tp, rr: (tp / sl).toFixed(1), wr, pf, exp, perWeek, perMonth, monthlyPips: monthlyPips.toFixed(0), w, l, tot })
      }
    }

    combos.sort((a, b) => parseFloat(b.monthlyPips) - parseFloat(a.monthlyPips))
    console.log('\nTOP 5 (maandelijks rendement, RR >= 1:1):')
    console.log('SL   TP   RR    WR      PF     /week  /maand  Exp/trade  Pips/mnd')
    console.log('─'.repeat(75))
    combos.slice(0, 5).forEach(c => {
      console.log(
        `${String(c.sl).padEnd(5)}${String(c.tp).padEnd(5)}` +
        `${'1:' + c.rr}`.padEnd(6) +
        `${c.wr}%`.padEnd(8) +
        `${c.pf}`.padEnd(7) +
        `${c.perWeek}`.padEnd(7) +
        `${c.perMonth}`.padEnd(8) +
        `${parseFloat(c.exp) > 0 ? '+' : ''}${c.exp}p`.padEnd(11) +
        `${parseFloat(c.monthlyPips) > 0 ? '+' : ''}${c.monthlyPips}p`
      )
    })

    // Rendement voor top combo
    if (combos.length > 0) {
      const best = combos[0]
      console.log(`\nRendement (1% risico per trade):`)
      for (const bal of [10000, 25000]) {
        const rpp = (bal * 0.01) / best.sl
        const monthly = parseFloat(best.monthlyPips) * rpp
        console.log(`  $${bal}: ~$${monthly.toFixed(0)}/maand (${(monthly / bal * 100).toFixed(1)}%)`)
      }
    }
  }
}

main().catch(console.error)
