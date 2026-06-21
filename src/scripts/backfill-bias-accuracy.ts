// ─── Backfill bias-accuracy (Sessie 2) ───────────────────────
// Berekent voor elke call in trade_focus_records de bias-accuracy
// op 5 horizonten (1/3/5/10/20 dagen) + MFE binnen 20 dagen, via
// historische Yahoo Finance OHLC.
//
// Draaien (lokaal, niet op Vercel):
//   npx tsx src/scripts/backfill-bias-accuracy.ts
//
// Eigenschappen:
//   - Idempotent: overschrijft per rij, kan opnieuw draaien.
//   - Throttled: pauze tussen Yahoo-calls om rate-limiting te voorkomen.
//   - Logs voortgang per 50 calls.
//   - Vereist dat de migratie (supabase_migration_bias_accuracy.sql) is gedraaid.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { PAIR_SYMBOLS } from '../lib/fx-engine/constants'
import { getPipThreshold, pipSize } from '../lib/pair-categories'

// ─── env uit .env.local laden ─────────────────────────────────
const env = readFileSync('.env.local', 'utf8')
const getEnv = (k: string): string | undefined => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'))
  return m ? m[1].trim() : process.env[k]
}
const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL')!
const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')!
const CUTOFF = getEnv('BRIEFING_METHODOLOGY_CUTOFF') || '2026-06-21'

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

const HORIZONS = [1, 3, 5, 10, 20] as const
const DAY_MS = 86400 * 1000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Candle { t: number; close: number; high: number; low: number }

async function fetchCandles(symbol: string, startMs: number): Promise<Candle[] | null> {
  const period1 = Math.floor(startMs / 1000) - 86400 * 2
  const period2 = Math.floor(startMs / 1000) + 86400 * 28
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${period1}&period2=${period2}`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) { await sleep(800); continue }
      const json = await res.json()
      const r = json?.chart?.result?.[0]
      if (!r?.timestamp) return null
      const q = r.indicators?.quote?.[0] || {}
      const out: Candle[] = []
      for (let i = 0; i < r.timestamp.length; i++) {
        const close = q.close?.[i]
        if (close == null) continue
        out.push({ t: r.timestamp[i] * 1000, close, high: q.high?.[i] ?? close, low: q.low?.[i] ?? close })
      }
      out.sort((a, b) => a.t - b.t)
      return out
    } catch {
      await sleep(800)
    }
  }
  return null
}

type Status = 'klopt' | 'klopt_niet' | 'te_klein' | null
interface HorizonResult { price_at_horizon: number | null; pip_move: number | null; status: Status }

function computeHorizon(candles: Candle[], startMs: number, n: number, entry: number, isLong: boolean, threshold: number, ps: number): HorizonResult {
  const target = startMs + n * DAY_MS
  const c = candles.find((x) => x.t >= target)
  if (!c) return { price_at_horizon: null, pip_move: null, status: null }
  const raw = (c.close - entry) / ps
  const pip = Math.round(isLong ? raw : -raw)
  let status: Status
  if (pip >= threshold) status = 'klopt'
  else if (pip <= -threshold) status = 'klopt_niet'
  else status = 'te_klein'
  return { price_at_horizon: +c.close.toFixed(5), pip_move: pip, status }
}

function computeMFE(candles: Candle[], startMs: number, entry: number, isLong: boolean, ps: number): { mfe_pips: number | null; mfe_day: number | null } {
  const window = candles.filter((x) => x.t >= startMs && x.t <= startMs + 20 * DAY_MS)
  if (window.length === 0) return { mfe_pips: null, mfe_day: null }
  let best = -Infinity
  let bestT = startMs
  for (const c of window) {
    const fav = isLong ? (c.high - entry) / ps : (entry - c.low) / ps
    if (fav > best) { best = fav; bestT = c.t }
  }
  return { mfe_pips: Math.round(best), mfe_day: Math.max(0, Math.round((bestT - startMs) / DAY_MS)) }
}

async function main() {
  const { data: records, error } = await sb
    .from('trade_focus_records')
    .select('id, date, pair, direction, entry_price')
    .order('date', { ascending: true })
  if (error) { console.error('Kon calls niet ophalen:', error.message); process.exit(1) }
  if (!records) { console.error('Geen calls.'); process.exit(1) }

  console.log(`Backfill gestart — ${records.length} calls, cutoff ${CUTOFF}`)
  let done = 0, skipped = 0, failed = 0

  for (const rec of records) {
    done++
    const entry = rec.entry_price as number | null
    const symbol = PAIR_SYMBOLS[rec.pair]
    if (entry == null || !symbol) { skipped++; continue }

    const isLong = String(rec.direction).includes('bullish')
    const ps = pipSize(rec.pair)
    const threshold = getPipThreshold(rec.pair)
    const startMs = new Date(rec.date + 'T00:00:00Z').getTime()

    const candles = await fetchCandles(symbol, startMs)
    await sleep(220) // throttle Yahoo
    if (!candles || candles.length === 0) { failed++; continue }

    const accuracy: Record<string, HorizonResult> = {}
    for (const n of HORIZONS) {
      accuracy[`${n}d`] = computeHorizon(candles, startMs, n, entry, isLong, threshold, ps)
    }
    const { mfe_pips, mfe_day } = computeMFE(candles, startMs, entry, isLong, ps)
    const methodology = rec.date < CUTOFF ? 'historical' : 'current'

    const { error: upErr } = await sb
      .from('trade_focus_records')
      .update({ accuracy, mfe_pips, mfe_day, methodology, computed_at: new Date().toISOString() })
      .eq('id', rec.id)
    if (upErr) { failed++; if (failed <= 3) console.error(`  update faalde (${rec.pair} ${rec.date}):`, upErr.message) }

    if (done % 50 === 0) console.log(`  ${done}/${records.length} verwerkt (${skipped} skip, ${failed} fout)`)
  }

  console.log(`Klaar. ${done} verwerkt, ${skipped} overgeslagen, ${failed} mislukt.`)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
