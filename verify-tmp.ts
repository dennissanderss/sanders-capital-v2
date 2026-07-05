// Onafhankelijke verificatie van de backtest-winrates:
// 1) Aggregaten opnieuw berekenen, los van de UI-code.
// 2) Steekproef van trades naspelen tegen VERSE Yahoo-data: klopt de
//    referentiekoers, ligt de exit exact h handelsdagen later, en klopt
//    het win/verlies-oordeel?
import { readFileSync } from 'fs'
import { fetchDailyCandles } from './src/lib/fundamental/prices'
import { PAIR_SYMBOLS } from './src/lib/fundamental/constants'

interface H { x: string; xp: number; ok: boolean; pips: number; pct: number; cpct?: number }
interface T { d: string; p: string; dir: 'L' | 'S'; timing?: number; c?: number; diff?: number; e: number; ed: string; h: Record<string, H> }

const data = JSON.parse(readFileSync('public/fb-backtest-v2.json', 'utf8')) as { trades: T[]; carryTrades: T[] }

function agg(rows: T[], hz: number, useSwap = false) {
  let n = 0, wins = 0
  for (const t of rows) {
    const h = t.h[String(hz)]
    if (!h) continue
    n++
    const pct = useSwap && h.cpct != null ? h.cpct : h.pct
    if (useSwap ? pct > 0 : h.ok) wins++
  }
  return { n, wr: +(100 * wins / Math.max(1, n)).toFixed(1) }
}

console.log('── 1. Aggregaten opnieuw berekend ──')
const t7 = data.trades.filter((t) => (t.timing ?? 0) >= 7)
console.log('day  (timing≥7, 1d):', agg(t7, 1))
console.log('swing(timing≥7, 5d):', agg(t7, 5))
console.log('carry (20d, incl. swap):', agg(data.carryTrades, 20, true))
console.log('carry (20d, alleen koers):', agg(data.carryTrades, 20, false))

// Consistentie: ok-vlag vs pips-teken (close-to-close moet overeenstemmen).
let mismatch = 0, checked = 0
for (const t of [...data.trades, ...data.carryTrades]) {
  for (const k of Object.keys(t.h)) {
    const h = t.h[k]; checked++
    if (h.pips !== 0 && h.ok !== h.pips > 0) mismatch++
  }
}
console.log(`\nok-vlag vs pips-teken: ${mismatch} inconsistenties op ${checked} horizon-uitkomsten`)

async function main() {
  console.log('\n── 2. Steekproef naspelen tegen verse Yahoo-data ──')
  // Deterministische steekproef: elke 400e day/swing-trade + elke 25e carry-trade.
  const sample: { t: T; hz: number; label: string }[] = []
  t7.filter((_, i) => i % 400 === 7).slice(0, 4).forEach((t) => sample.push({ t, hz: 5, label: 'swing' }))
  data.trades.filter((_, i) => i % 900 === 3).slice(0, 3).forEach((t) => sample.push({ t, hz: 1, label: 'day' }))
  data.carryTrades.filter((_, i) => i % 25 === 2).slice(0, 4).forEach((t) => sample.push({ t, hz: 20, label: 'carry' }))

  let okCount = 0, failCount = 0
  for (const { t, hz, label } of sample) {
    const h = t.h[String(hz)]
    if (!h) continue
    const candles = await fetchDailyCandles(PAIR_SYMBOLS[t.p], '2024-03-01')
    const ei = candles.findIndex((c) => c.date === t.ed)
    const issues: string[] = []
    if (ei < 0) { issues.push('entry-datum niet gevonden') }
    else {
      const entry = candles[ei]
      if (Math.abs(entry.close - t.e) / t.e > 0.002) issues.push(`entry-koers wijkt af: ${entry.close} vs ${t.e}`)
      const exit = candles[ei + hz]
      if (!exit) issues.push('exit-candle ontbreekt')
      else {
        if (exit.date !== h.x) issues.push(`exit-datum: ${exit.date} vs ${h.x}`)
        if (Math.abs(exit.close - h.xp) / h.xp > 0.002) issues.push(`exit-koers: ${exit.close} vs ${h.xp}`)
        const shouldWin = t.dir === 'L' ? exit.close > entry.close : exit.close < entry.close
        if (shouldWin !== h.ok) issues.push(`oordeel: hoort ${shouldWin} te zijn, is ${h.ok}`)
        // Entry moet vóór de call-dag liggen (geen look-ahead op de entry zelf).
        if (t.ed >= t.d) issues.push(`entry-datum ${t.ed} niet vóór call-dag ${t.d}`)
      }
    }
    const status = issues.length === 0 ? 'OK ' : 'FOUT'
    if (issues.length === 0) okCount++; else failCount++
    console.log(`${status} [${label}] ${t.d} ${t.p} ${t.dir} ${hz}d: ${t.e} (${t.ed}) → ${h.xp} (${h.x}) ${h.ok ? 'JUIST' : 'ONJUIST'} ${h.pips}p ${issues.join(' | ')}`)
    await new Promise((r) => setTimeout(r, 300))
  }
  console.log(`\nsteekproef: ${okCount} OK, ${failCount} afwijkingen`)
}

main().catch((e) => { console.error(e); process.exit(1) })
