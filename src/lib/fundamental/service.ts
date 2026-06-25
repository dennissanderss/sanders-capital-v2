// ─────────────────────────────────────────────────────────────
// Sanders Capital — Fundamental Briefing: service-laag
// Genereert gelockte calls, rekent horizons af, en leest de data uit.
// ─────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  MAJORS, PAIRS, PAIR_SYMBOLS, INTERMARKET_SYMBOLS, HORIZONS, FUND_GATE, MAX_CALLS_PER_DAY,
} from './constants'
import {
  analyzeNewsSentiment, computeCurrencyScores, determineRegime, computePairBias,
  buildConviction, isAlignedWithRegime, calculateIntermarketAlignment,
  type RateRow, type NewsRow, type ImSignal,
} from './scoring'
import {
  fetchManyDaily, momentum5d, dailyChangePct, evaluateHorizon, todayUTC, pipMult,
} from './prices'
import type {
  CallType, FbCall, HorizonOutcome, CallReasoning, CurrencyFactors, BriefingHeader, FbDataResponse,
} from './types'

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

async function fetchRates(sb: SupabaseClient): Promise<Record<string, RateRow>> {
  const { data } = await sb.from('central_bank_rates').select('currency, bank, rate, target, bias')
  const map: Record<string, RateRow> = {}
  for (const r of data || []) map[r.currency] = r
  return map
}

async function fetchNews(sb: SupabaseClient): Promise<NewsRow[]> {
  const since = new Date(Date.now() - 3 * 86400000).toISOString()
  const { data } = await sb
    .from('news_articles')
    .select('title, title_nl, summary, affected_currencies, relevance_score, published_at')
    .gte('published_at', since)
    .gte('relevance_score', 2)
    .order('published_at', { ascending: false })
    .limit(50)
  return (data || []) as NewsRow[]
}

function factorsOf(ccy: string, cs: ReturnType<typeof computeCurrencyScores>): CurrencyFactors {
  const c = cs[ccy]
  return {
    currency: ccy,
    total: +(c?.score ?? 0).toFixed(2),
    biasLabel: c?.breakdown.biasLabel || 'onbekend',
    cbPts: c?.breakdown.biasMultiplied ?? 0,
    ratePts: c?.breakdown.rateScore ?? 0,
    rate: c?.breakdown.rate ?? null,
    target: c?.breakdown.target ?? null,
    newsPts: c?.breakdown.newsCapped ?? 0,
    newsHeadlines: c?.newsHeadlines || [],
  }
}

// ─── Header (regime + bias per valuta) — puur rates+news, geen prijzen ──
async function buildHeader(sb: SupabaseClient): Promise<BriefingHeader> {
  const rates = await fetchRates(sb)
  const news = analyzeNewsSentiment(await fetchNews(sb))
  const cs = computeCurrencyScores(rates, news)
  const reg = determineRegime(cs)
  return {
    date: todayUTC(),
    regime: reg.regime,
    regimeExplain: reg.explain,
    regimeColor: reg.color,
    currencyScores: MAJORS.map((c) => cs[c]).sort((a, b) => b.score - a.score),
  }
}

// ─── Genereren ────────────────────────────────────────────────
export async function generateBriefing(callType: CallType): Promise<{ created: number; skipped?: boolean; date: string }> {
  const sb = getSupabase()
  const callDate = todayUTC()

  // Idempotent: al gegenereerd voor vandaag?
  const { data: existing } = await sb.from('fb_calls').select('id').eq('call_date', callDate).eq('call_type', callType).limit(1)
  if (existing && existing.length > 0) return { created: 0, skipped: true, date: callDate }

  const rates = await fetchRates(sb)
  const news = analyzeNewsSentiment(await fetchNews(sb))
  const cs = computeCurrencyScores(rates, news)
  const { regime } = determineRegime(cs)

  // Prijzen (pairs + intermarket), ~60 dagen terug voor momentum.
  const fromISO = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]
  const pairHist = await fetchManyDaily(PAIRS.map((p) => [p, PAIR_SYMBOLS[p]] as [string, string]), fromISO)
  const imHist = await fetchManyDaily(Object.entries(INTERMARKET_SYMBOLS), fromISO)

  const imSignals: ImSignal[] = Object.keys(INTERMARKET_SYMBOLS).map((k) => {
    const ch = dailyChangePct(imHist[k] || [])
    return { key: k, direction: ch.direction, changePct: ch.changePct }
  })
  const imAlignment = calculateIntermarketAlignment(imSignals, regime)

  type Draft = Omit<FbCall, 'id' | 'status' | 'outcomes'>
  const drafts: Draft[] = []
  for (const pair of PAIRS) {
    const pb = computePairBias(pair, cs)
    if (pb.direction === 'neutraal' || Math.abs(pb.score) < FUND_GATE) continue
    const hist = pairHist[pair] || []
    if (hist.length < 6) continue
    const last = hist[hist.length - 1]
    const mom = momentum5d(hist, pair)
    const conv = buildConviction({
      fundScore: pb.score, base: pb.base, quote: pb.quote, direction: pb.direction,
      momentum5dPips: mom.pips, imAlignment, regime,
    })
    const regimeAligned = isAlignedWithRegime(pb.base, pb.quote, pb.direction === 'bullish', regime)
    const reasoning: CallReasoning = {
      base: factorsOf(pb.base, cs),
      quote: factorsOf(pb.quote, cs),
      regime,
      regimeAligned,
      regimeText: regimeAligned
        ? `${pair} ${pb.direction === 'bullish' ? 'long' : 'short'} past in het ${regime}-regime.`
        : `${pair} is neutraal binnen het ${regime}-regime (telt niet als voorwaarde, alleen voor conviction).`,
      momentum5dPips: mom.pips,
      momentumStart: mom.start,
      momentumNow: mom.now,
      imAlignment,
    }
    drafts.push({
      callDate, callType, pair, base: pb.base, quote: pb.quote,
      direction: pb.direction, fundScore: pb.score, conviction: conv.total,
      breakdown: conv, regime, entryPrice: last.close, entryDate: last.date, reasoning,
    })
  }

  drafts.sort((a, b) => b.conviction - a.conviction)
  const top = drafts.slice(0, MAX_CALLS_PER_DAY)
  if (top.length === 0) return { created: 0, date: callDate }

  const { data: inserted, error } = await sb.from('fb_calls').insert(
    top.map((d) => ({
      call_date: d.callDate, call_type: d.callType, pair: d.pair, base: d.base, quote: d.quote,
      direction: d.direction, fund_score: d.fundScore, conviction: d.conviction,
      breakdown: d.breakdown, regime: d.regime, entry_price: d.entryPrice, entry_date: d.entryDate,
      reasoning: d.reasoning,
    })),
  ).select('id')
  if (error) throw new Error(error.message)

  const outcomes = (inserted || []).flatMap((row) =>
    HORIZONS.map((h) => ({ call_id: row.id, horizon: h, resolved: false })),
  )
  if (outcomes.length > 0) await sb.from('fb_outcomes').insert(outcomes)

  return { created: top.length, date: callDate }
}

// ─── Resolven (vervallen horizons afrekenen) ──────────────────
export async function resolveOutcomes(): Promise<{ resolved: number }> {
  const sb = getSupabase()
  const { data: rows } = await sb
    .from('fb_outcomes')
    .select('id, horizon, call_id, fb_calls!inner(pair, direction, entry_date, entry_price)')
    .eq('resolved', false)
    .limit(2000)
  if (!rows || rows.length === 0) return { resolved: 0 }

  // Per paar de history één keer ophalen.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pairsNeeded = [...new Set(rows.map((r: any) => r.fb_calls.pair))] as string[]
  const fromISO = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
  const hist = await fetchManyDaily(pairsNeeded.map((p) => [p, PAIR_SYMBOLS[p]] as [string, string]), fromISO)

  let resolved = 0
  const touchedCalls = new Set<string>()
  for (const r of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (r as any).fb_calls
    const out = evaluateHorizon(
      hist[call.pair] || [], call.entry_date, Number(call.entry_price),
      call.direction === 'bullish', call.pair, r.horizon,
    )
    if (!out) continue // nog pending
    await sb.from('fb_outcomes').update({
      exit_date: out.exitDate, exit_price: out.exitPrice, correct: out.correct,
      mfe_pips: out.mfePips, mfe_date: out.mfeDate, mfe_price: out.mfePrice,
      mae_pips: out.maePips, mae_date: out.maeDate, mae_price: out.maePrice,
      resolved: true, resolved_at: new Date().toISOString(),
    }).eq('id', r.id)
    resolved++
    touchedCalls.add(r.call_id)
  }

  // Calls waarvan alle horizons klaar zijn → status 'complete'.
  for (const cid of touchedCalls) {
    const { data: rem } = await sb.from('fb_outcomes').select('id').eq('call_id', cid).eq('resolved', false).limit(1)
    if (!rem || rem.length === 0) await sb.from('fb_calls').update({ status: 'complete' }).eq('id', cid)
  }
  return { resolved }
}

// ─── Uitlezen voor de UI ──────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCall(c: any, outByCall: Record<string, HorizonOutcome[]>): FbCall {
  return {
    id: c.id, callDate: c.call_date, callType: c.call_type, pair: c.pair, base: c.base, quote: c.quote,
    direction: c.direction, fundScore: Number(c.fund_score), conviction: Number(c.conviction),
    breakdown: c.breakdown, regime: c.regime, entryPrice: Number(c.entry_price), entryDate: c.entry_date,
    reasoning: c.reasoning, status: c.status,
    outcomes: (outByCall[c.id] || []).sort((a, b) => a.horizon - b.horizon),
  }
}

export async function readData(): Promise<FbDataResponse> {
  const sb = getSupabase()
  const today = todayUTC()

  const { data: calls } = await sb.from('fb_calls').select('*').order('call_date', { ascending: false }).limit(4000)
  const ids = (calls || []).map((c) => c.id)
  const outByCall: Record<string, HorizonOutcome[]> = {}
  if (ids.length > 0) {
    const { data: outs } = await sb.from('fb_outcomes').select('*').in('call_id', ids)
    for (const o of outs || []) {
      (outByCall[o.call_id] ||= []).push({
        horizon: o.horizon, exitDate: o.exit_date, exitPrice: o.exit_price == null ? null : Number(o.exit_price),
        correct: o.correct, mfePips: o.mfe_pips, mfeDate: o.mfe_date, mfePrice: o.mfe_price == null ? null : Number(o.mfe_price),
        maePips: o.mae_pips, maeDate: o.mae_date, maePrice: o.mae_price == null ? null : Number(o.mae_price), resolved: o.resolved,
      })
    }
  }

  const all = (calls || []).map((c) => rowToCall(c, outByCall))
  const dailyCalls = all.filter((c) => c.callType === 'daily' && c.callDate === today)
  const latestWeeklyDate = all.filter((c) => c.callType === 'weekly').map((c) => c.callDate).sort().slice(-1)[0]
  const weeklyCalls = all.filter((c) => c.callType === 'weekly' && c.callDate === latestWeeklyDate)

  const header = await buildHeader(sb)
  return {
    generatedAt: new Date().toISOString(),
    today,
    header,
    dailyCalls,
    weeklyCalls,
    trackrecord: all,
  }
}

export { pipMult }
