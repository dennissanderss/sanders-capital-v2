// ─── Bias-analyse (los inzicht-script, NIET in de tool) ───────
// Verkent de bias-accuracy data: timing, persistentie, pips en MFE.
// Verandert niks — leest alleen trade_focus_records.
//
// Draaien:
//   npx tsx src/scripts/analyze-bias.ts
//   npx tsx src/scripts/analyze-bias.ts --minscore=8
//   npx tsx src/scripts/analyze-bias.ts --pair=EUR/USD
//   npx tsx src/scripts/analyze-bias.ts --category=jpy --direction=long
//   npx tsx src/scripts/analyze-bias.ts --regime="Risk-Off" --minscore=7
//
// Filters: --pair  --minscore  --maxscore  --category(major|jpy|cross)
//          --direction(long|short)  --regime

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// ── env ──
const env = readFileSync('.env.local', 'utf8')
const getEnv = (k: string) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : process.env[k] }
const sb = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL')!, getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')!)

// ── args ──
const args: Record<string, string> = {}
for (const a of process.argv.slice(2)) { const m = a.match(/^--([^=]+)=(.*)$/); if (m) args[m[1]] = m[2] }

const H = ['1d', '3d', '5d', '10d', '20d']
const SAFE = ['JPY', 'CHF'], HY = ['AUD', 'NZD', 'CAD']

function category(p: string): string { if (p.includes('JPY')) return 'jpy'; return ['EURUSD', 'GBPUSD', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD'].includes(p.replace('/', '')) ? 'major' : 'cross' }
function aligned(pair: string, dir: string, regime: string): boolean {
  const [b, q] = pair.split('/'); const bull = dir.includes('bullish')
  if (regime === 'Risk-Off') { if (bull && SAFE.includes(b)) return true; if (!bull && SAFE.includes(q)) return true; if (!bull && HY.includes(b)) return true; if (bull && HY.includes(q)) return true }
  if (regime === 'Risk-On') { if (bull && HY.includes(b)) return true; if (!bull && HY.includes(q)) return true; if (!bull && SAFE.includes(b)) return true; if (bull && SAFE.includes(q)) return true }
  if (regime === 'USD Dominant') { if (bull && b === 'USD') return true; if (!bull && q === 'USD') return true }
  if (regime === 'USD Zwak') { if (!bull && b === 'USD') return true; if (bull && q === 'USD') return true }
  if (regime === 'Gemengd') return true
  return false
}
interface Rec { pair: string; direction: string; score: number; regime: string; metadata: { momentum5d?: number; imAlignment?: number } | null; accuracy: Record<string, { pip_move: number | null; status: string | null }> | null; mfe_pips: number | null; mfe_day: number | null }
function conviction(r: Rec): number {
  const aS = Math.abs(r.score); const mom = r.metadata?.momentum5d ?? 0; const bull = r.direction.includes('bullish')
  const cp = (bull && mom < 0) || (!bull && mom > 0)
  const f = Math.min(aS / 5, 1) * 4
  const c = cp ? (Math.abs(mom) >= 30 && Math.abs(mom) <= 120 ? 2.5 : 1.5) : 0
  const i = ((r.metadata?.imAlignment ?? 0) / 100) * 2
  const rg = aligned(r.pair, r.direction, r.regime || 'Gemengd') ? 1.5 : 0.5
  return Math.min(10, Math.round((f + c + i + rg) * 10) / 10)
}
const pad = (s: string | number, n: number) => String(s).padEnd(n)

async function main() {
  let from = 0, all: Rec[] = []
  while (true) {
    const { data } = await sb.from('trade_focus_records').select('pair,direction,score,regime,metadata,accuracy,mfe_pips,mfe_day').range(from, from + 999)
    if (!data || !data.length) break
    all = all.concat(data as Rec[]); if (data.length < 1000) break; from += 1000
  }

  let rows = all.filter((r) => r.accuracy)
  if (args.pair) rows = rows.filter((r) => r.pair === args.pair)
  if (args.category) rows = rows.filter((r) => category(r.pair) === args.category)
  if (args.direction) rows = rows.filter((r) => r.direction.includes(args.direction === 'long' ? 'bullish' : 'bearish'))
  if (args.regime) rows = rows.filter((r) => (r.regime || '') === args.regime)
  if (args.minscore) rows = rows.filter((r) => conviction(r) >= +args.minscore)
  if (args.maxscore) rows = rows.filter((r) => conviction(r) < +args.maxscore)

  const flt = Object.entries(args).map(([k, v]) => `${k}=${v}`).join(' ') || 'geen filters'
  console.log(`\n══ Bias-analyse — ${rows.length} calls (${flt}) ══\n`)
  if (rows.length === 0) { console.log('Geen calls voor dit filter.'); return }

  // 1. trajectory
  console.log('Beweging per horizon (jouw richting):')
  console.log('  ' + pad('horizon', 9) + pad('gem. pips', 12) + 'juiste richting')
  for (const h of H) {
    let sum = 0, n = 0, pos = 0
    for (const r of rows) { const c = r.accuracy![h]; if (!c || c.pip_move == null) continue; sum += c.pip_move; n++; if (c.pip_move > 0) pos++ }
    console.log('  ' + pad(h, 9) + pad((n ? (sum / n >= 0 ? '+' : '') + Math.round(sum / n) : 0) + 'p', 12) + (n ? Math.round(pos / n * 100) : 0) + '%')
  }

  // 2. persistentie
  const fav1 = rows.filter((r) => { const c = r.accuracy!['1d']; return c && c.pip_move != null && c.pip_move > 0 })
  console.log(`\nVan de ${fav1.length} calls die op dag 1 al groen staan, blijft groen op:`)
  for (const h of ['3d', '5d', '10d', '20d']) {
    let still = 0, n = 0
    for (const r of fav1) { const c = r.accuracy![h]; if (!c || c.pip_move == null) continue; n++; if (c.pip_move > 0) still++ }
    console.log('  ' + pad(h, 6) + (n ? Math.round(still / n * 100) : 0) + '%')
  }

  // 3. MFE
  const mv = rows.filter((r) => r.mfe_pips != null)
  if (mv.length) {
    const avg = Math.round(mv.reduce((s, r) => s + (r.mfe_pips || 0), 0) / mv.length)
    const max = Math.max(...mv.map((r) => r.mfe_pips || 0))
    console.log(`\nMFE (grootste favorabele beweging binnen 20d): gem. +${avg}p · max +${max}p`)
    console.log('Wanneer de piek valt:')
    for (const [name, lo, hi] of [['dag 0-1', 0, 1], ['dag 2-3', 2, 3], ['dag 4-5', 4, 5], ['dag 6-10', 6, 10], ['dag 11-20', 11, 20]] as [string, number, number][]) {
      const n = mv.filter((r) => (r.mfe_day ?? -1) >= lo && (r.mfe_day ?? -1) <= hi).length
      console.log('  ' + pad(name, 11) + Math.round(n / mv.length * 100) + '%')
    }
    console.log('Raakte de drempel favorabel binnen 20d (MFE-touch):')
    for (const [maj, jpy] of [[30, 50], [50, 85], [80, 120]] as [number, number][]) {
      let hit = 0
      for (const r of mv) { const thr = r.pair.includes('JPY') ? jpy : maj; if ((r.mfe_pips || 0) >= thr) hit++ }
      console.log('  ' + pad(`${maj}/${jpy} pips`, 13) + Math.round(hit / mv.length * 100) + '%')
    }
  }
  console.log('')
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
