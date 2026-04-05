// ─── Execution Engine Cron ────────────────────────────────────
// Dagelijks om 21:00 UTC (23:00 NL) via Vercel Cron:
// 1. Resolve gisteren's pending trades (check prijsbeweging)
// 2. Genereer vandaag's execution signals (concrete trades + momentum)
// ──────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const YAHOO_SYMBOLS: Record<string, string> = {
  'EUR/USD':'EURUSD=X','GBP/USD':'GBPUSD=X','USD/JPY':'USDJPY=X',
  'AUD/USD':'AUDUSD=X','NZD/USD':'NZDUSD=X','USD/CAD':'USDCAD=X',
  'USD/CHF':'USDCHF=X','EUR/GBP':'EURGBP=X','EUR/JPY':'EURJPY=X',
  'GBP/JPY':'GBPJPY=X','AUD/JPY':'AUDJPY=X','NZD/JPY':'NZDJPY=X',
  'CAD/JPY':'CADJPY=X','EUR/AUD':'EURAUD=X','GBP/AUD':'GBPAUD=X',
  'AUD/NZD':'AUDNZD=X','EUR/CHF':'EURCHF=X','GBP/CHF':'GBPCHF=X',
  'EUR/CAD':'EURCAD=X','GBP/NZD':'GBPNZD=X','AUD/CAD':'AUDCAD=X',
}

// Momentum zone ranges per model
const MODELS = {
  selective: { momMin: 30, momMax: 120 },
  balanced: { momMin: 20, momMax: 150 },
  aggressive: { momMin: 0, momMax: 9999 },
}

async function fetchPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } }
    )
    if (!res.ok) return null
    const json = await res.json()
    const closes = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close
    if (!closes || closes.length === 0) return null
    // Laatste beschikbare close
    for (let i = closes.length - 1; i >= 0; i--) {
      if (closes[i] != null) return closes[i]
    }
    return null
  } catch { return null }
}

export async function POST(request: Request) {
  // Auth check
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().split('T')[0]
    const results = { resolved: 0, generated: 0, errors: [] as string[] }

    // ─── STAP 1: Resolve gisteren's pending trades ───────
    const { data: pending } = await supabase
      .from('execution_signals')
      .select('*')
      .eq('result', 'pending')

    if (pending && pending.length > 0) {
      for (const signal of pending) {
        const sym = YAHOO_SYMBOLS[signal.pair]
        if (!sym) continue

        const exitPrice = await fetchPrice(sym)
        if (!exitPrice || !signal.entry_price) continue

        const isBull = signal.fund_direction === 'bullish' || signal.fund_direction?.includes('bullish')
        const isJpy = signal.pair.includes('JPY')
        const pipSize = isJpy ? 0.01 : 0.0001
        const priceDiff = exitPrice - signal.entry_price
        const pipsMoved = Math.round(Math.abs(priceDiff) / pipSize)

        let result: 'correct' | 'incorrect' = 'incorrect'
        if (isBull && priceDiff > 0) result = 'correct'
        if (!isBull && priceDiff < 0) result = 'correct'

        await supabase.from('execution_signals').update({
          exit_price: exitPrice,
          result,
          pips_moved: pipsMoved * (result === 'correct' ? 1 : -1),
          resolved_at: new Date().toISOString(),
        }).eq('id', signal.id)

        results.resolved++
        await new Promise(r => setTimeout(r, 500))
      }
    }

    // ─── STAP 2: Haal briefing data op ───────────────────
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sanderscapital.nl'
    let briefing
    try {
      const briefingRes = await fetch(`${baseUrl}/api/briefing-v2`, { next: { revalidate: 0 } })
      briefing = await briefingRes.json()
    } catch (e) {
      results.errors.push('Briefing fetch failed: ' + String(e))
      return NextResponse.json(results)
    }

    if (!briefing || briefing.error) {
      results.errors.push('Briefing error: ' + (briefing?.error || 'no data'))
      return NextResponse.json(results)
    }

    const imAlignment = briefing.intermarketAlignment ?? 0
    const v3Signals = briefing.v3?.pairSignals || []

    // ─── STAP 3: Genereer execution signals ──────────────
    const pairBiases = briefing.pairBiases || []

    for (const pb of pairBiases) {
      const absScore = Math.abs(pb.score)
      const isBullish = pb.direction?.includes('bullish')
      const isBearish = pb.direction?.includes('bearish')
      const isNeutral = !isBullish && !isBearish

      // Skip als geen richting of te lage score
      if (isNeutral || pb.conviction === 'geen' || absScore < 2.0) continue

      // 4 filters check (exact zoals briefing UI)
      const scorePass = absScore >= 2.0
      const imPass = imAlignment > 50
      const v3 = v3Signals.find((s: { pair: string }) => s.pair === pb.pair)
      const pips5d = v3?.priceMomentum?.pips5d ?? 0
      const contrarianPass = (isBullish && pips5d < 0) || (isBearish && pips5d > 0)

      // Alleen concrete trades (4/4 filters) opslaan
      if (!scorePass || !imPass || !contrarianPass) continue

      // Check of al bestaat voor vandaag
      const { data: existing } = await supabase
        .from('execution_signals')
        .select('id')
        .eq('date', today)
        .eq('pair', pb.pair)
        .limit(1)

      if (existing && existing.length > 0) continue

      // Haal entry prijs op
      const sym = YAHOO_SYMBOLS[pb.pair]
      const entryPrice = sym ? await fetchPrice(sym) : null

      // Momentum zone per model
      const absMom = Math.abs(pips5d)
      const selectiveZone = absMom >= MODELS.selective.momMin && absMom <= MODELS.selective.momMax
      const balancedZone = absMom >= MODELS.balanced.momMin && absMom <= MODELS.balanced.momMax
      const aggressiveZone = true // alle momentum

      await supabase.from('execution_signals').insert({
        date: today,
        pair: pb.pair,
        fund_direction: pb.direction,
        fund_conviction: pb.conviction,
        fund_score: pb.score,
        regime: briefing.regime,
        momentum_5d: pips5d,
        is_contrarian: contrarianPass,
        selective_in_zone: selectiveZone,
        balanced_in_zone: balancedZone,
        aggressive_in_zone: aggressiveZone,
        entry_price: entryPrice,
        result: 'pending',
      })

      results.generated++
      await new Promise(r => setTimeout(r, 500))
    }

    return NextResponse.json({
      ...results,
      date: today,
      regime: briefing.regime,
      imAlignment,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// GET: Haal trackrecord stats op
export async function GET() {
  try {
    const { data: signals } = await supabase
      .from('execution_signals')
      .select('*')
      .order('date', { ascending: false })

    if (!signals) return NextResponse.json({ error: 'No data' }, { status: 500 })

    const resolved = signals.filter(s => s.result === 'correct' || s.result === 'incorrect')
    const pending = signals.filter(s => s.result === 'pending')

    // Stats per model
    function modelStats(filterFn: (s: typeof signals[0]) => boolean) {
      const filtered = resolved.filter(filterFn)
      const correct = filtered.filter(s => s.result === 'correct').length
      const total = filtered.length
      return {
        total,
        correct,
        incorrect: total - correct,
        winRate: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
        totalPips: Math.round(filtered.reduce((sum, s) => sum + (s.pips_moved || 0), 0)),
      }
    }

    return NextResponse.json({
      overall: {
        total: signals.length,
        resolved: resolved.length,
        pending: pending.length,
        correct: resolved.filter(s => s.result === 'correct').length,
        winRate: resolved.length > 0
          ? Math.round((resolved.filter(s => s.result === 'correct').length / resolved.length) * 1000) / 10
          : 0,
      },
      models: {
        selective: modelStats(s => s.selective_in_zone === true),
        balanced: modelStats(s => s.balanced_in_zone === true),
        aggressive: modelStats(s => s.aggressive_in_zone === true),
      },
      recentTrades: signals.slice(0, 20).map(s => ({
        date: s.date,
        pair: s.pair,
        direction: s.fund_direction,
        score: s.fund_score,
        momentum: s.momentum_5d,
        result: s.result,
        pips: s.pips_moved,
        selective: s.selective_in_zone,
        balanced: s.balanced_in_zone,
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
