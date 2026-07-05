// ─────────────────────────────────────────────────────────────
// Sanders Capital — Fundamental Briefing: service-laag
// Genereert gelockte calls, rekent horizons af, en leest de data uit.
// ─────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  MAJORS, PAIRS, PAIR_SYMBOLS, INTERMARKET_SYMBOLS, HORIZONS, FUND_GATE, MAX_CALLS_PER_DAY,
  COMMODITY_SYMBOLS, MODEL_VERSION, CARRY_MIN_DIFF, MAX_POSITION_CALLS,
} from './constants'
import {
  analyzeNewsSentiment, computeCurrencyScores, determineRegime, computePairBias,
  buildConvictionV2, buildConvictionCarry, isAlignedWithRegime, calculateIntermarketAlignment, intermarketContributions,
  type RateRow, type NewsRow, type ImSignal, type CurrencyExtras, type NewsSentiment,
} from './scoring'
import { analyzeNewsPerCurrency } from './newsLlm'
import { fetchCalendar, surpriseScores, inflationGaps, upcomingEventRisk } from './calendar'
import {
  fetchManyDaily, momentum5d, dailyChangePct, evaluateHorizon, todayUTC, pipMult,
  atr14Pips, change5dPct,
} from './prices'
import type {
  CallType, FbCall, HorizonOutcome, CallReasoning, CurrencyFactors, BriefingHeader, FbDataResponse,
  EventRiskItem, SurpriseItem,
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
    .select('title, title_nl, summary, source, affected_currencies, relevance_score, published_at')
    .gte('published_at', since)
    .gte('relevance_score', 2)
    .order('published_at', { ascending: false })
    .limit(50)
  return (data || []) as NewsRow[]
}

// Extra v2-detail per valuta voor het call-detail (transparantie).
interface FactorDetail {
  surpriseDetail?: SurpriseItem[]
  cpiYoY?: number | null
  cpiTarget?: number | null
  commodityName?: string
  commodityChangePct?: number | null
}

function factorsOf(
  ccy: string, cs: ReturnType<typeof computeCurrencyScores>, det?: FactorDetail,
): CurrencyFactors {
  const c = cs[ccy]
  const b = c?.breakdown
  return {
    currency: ccy,
    total: +(c?.score ?? 0).toFixed(2),
    biasLabel: b?.biasLabel || 'onbekend',
    cbPts: b?.biasMultiplied ?? 0,
    ratePts: b?.rateScore ?? 0,
    rate: b?.rate ?? null,
    target: b?.target ?? null,
    newsPts: b?.newsCapped ?? 0,
    newsHeadlines: c?.newsHeadlines || [],
    ...(b?.surprisePts != null ? {
      surprisePts: b.surprisePts,
      inflGapPts: b.inflGapPts,
      commodityPts: b.commodityPts,
      ...det,
    } : {}),
  }
}

// ─── Marktcontext (v2): rates + LLM-nieuws + kalender + grondstoffen ────
// Eén keer per generate berekend; het resultaat (de header) wordt gelockt in
// fb_daily_context zodat de bias-strip net als de calls één keer per ochtend
// vaststaat — en pageloads geen LLM/kalender-calls meer doen.
interface MarketContext {
  cs: ReturnType<typeof computeCurrencyScores>
  regime: string
  rates: Record<string, RateRow>
  news: Record<string, NewsSentiment>
  newsSource: 'llm' | 'keywords'
  eventRisk: Record<string, EventRiskItem[]>
  factorDetail: Record<string, FactorDetail>
}

async function buildMarketContext(sb: SupabaseClient, fromISO: string): Promise<MarketContext> {
  const nowMs = Date.now()
  const [rates, articles, events, comHist] = await Promise.all([
    fetchRates(sb),
    fetchNews(sb),
    fetchCalendar(nowMs),
    fetchManyDaily(Object.entries(COMMODITY_SYMBOLS).map(([ccy, v]) => [ccy, v.symbol] as [string, string]), fromISO),
  ])
  const { sentiment: news, source: newsSource } = await analyzeNewsPerCurrency(articles, nowMs)

  const surprises = surpriseScores(events, nowMs)
  const gaps = inflationGaps(events, nowMs)
  const eventRisk = upcomingEventRisk(events, nowMs, 2)

  const extras: Record<string, CurrencyExtras> = {}
  const factorDetail: Record<string, FactorDetail> = {}
  for (const ccy of MAJORS) {
    const comPct = COMMODITY_SYMBOLS[ccy] ? change5dPct(comHist[ccy] || []) : null
    // 3% beweging in 5 dagen = vol punt; gecapt ±1.
    const commodityPts = comPct == null ? 0 : +Math.max(-1, Math.min(1, comPct / 3)).toFixed(2)
    extras[ccy] = {
      surprisePts: surprises[ccy]?.pts ?? 0,
      inflGapPts: gaps[ccy]?.pts ?? 0,
      commodityPts,
    }
    factorDetail[ccy] = {
      surpriseDetail: surprises[ccy]?.detail || [],
      cpiYoY: gaps[ccy]?.cpiYoY ?? null,
      cpiTarget: gaps[ccy]?.target ?? null,
      commodityName: COMMODITY_SYMBOLS[ccy]?.name,
      commodityChangePct: comPct,
    }
  }

  const cs = computeCurrencyScores(rates, news, extras)
  const { regime } = determineRegime(cs)
  return { cs, regime, rates, news, newsSource, eventRisk, factorDetail }
}

function headerFromContext(ctx: MarketContext, date: string): BriefingHeader {
  const reg = determineRegime(ctx.cs)
  return {
    date,
    regime: reg.regime,
    regimeExplain: reg.explain,
    regimeColor: reg.color,
    currencyScores: MAJORS.map((c) => ctx.cs[c]).sort((a, b) => b.score - a.score),
    locked: true,
  }
}

// Gelockte header opslaan; faalt stil als de migratie nog niet is gedraaid.
async function storeDailyHeader(sb: SupabaseClient, date: string, header: BriefingHeader): Promise<void> {
  try {
    await sb.from('fb_daily_context').upsert({ ctx_date: date, header }, { onConflict: 'ctx_date' })
  } catch { /* tabel ontbreekt → live fallback in readData */ }
}

// ─── Header voor de UI: gelockte snapshot, anders live fallback ─────────
async function buildHeader(sb: SupabaseClient): Promise<BriefingHeader> {
  try {
    const { data } = await sb
      .from('fb_daily_context')
      .select('ctx_date, header')
      .order('ctx_date', { ascending: false })
      .limit(1)
    const row = data?.[0]
    if (row?.header) return { ...(row.header as BriefingHeader), locked: true }
  } catch { /* tabel ontbreekt → live fallback */ }

  // Fallback (geen snapshot): goedkope live berekening zonder LLM/kalender —
  // zelfde wiskunde als v1, alleen voor weergave tot de eerste generate draait.
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
    locked: false,
  }
}

// ─── Genereren ────────────────────────────────────────────────
export async function generateBriefing(callType: CallType): Promise<{ created: number; skipped?: boolean; date: string }> {
  const sb = getSupabase()
  const callDate = todayUTC()

  // Weekend: de forexmarkt is dicht — geen nieuwe calls. Voorkomt dat een
  // pageload op zaterdag/zondag (lazy generate) rommel-calls lockt met
  // dezelfde entry als vrijdag.
  const dow = new Date().getUTCDay()
  if (dow === 0 || dow === 6) return { created: 0, skipped: true, date: callDate }

  // Idempotent: al gegenereerd voor vandaag?
  const { data: existing } = await sb.from('fb_calls').select('id').eq('call_date', callDate).eq('call_type', callType).limit(1)
  if (existing && existing.length > 0) return { created: 0, skipped: true, date: callDate }

  // Marktcontext v2: rates + LLM-nieuws + kalender + grondstoffen.
  const fromISO = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]
  const ctx = await buildMarketContext(sb, fromISO)
  const { cs, regime, rates, news, newsSource, eventRisk, factorDetail } = ctx

  // Header één keer per ochtend locken (bias-strip = zelfde snapshot als de calls).
  await storeDailyHeader(sb, callDate, headerFromContext(ctx, callDate))

  // Prijzen (pairs + intermarket), ~60 dagen terug voor momentum + ATR.
  const pairHist = await fetchManyDaily(PAIRS.map((p) => [p, PAIR_SYMBOLS[p]] as [string, string]), fromISO)
  const imHist = await fetchManyDaily(Object.entries(INTERMARKET_SYMBOLS), fromISO)

  const imSignals: ImSignal[] = Object.keys(INTERMARKET_SYMBOLS).map((k) => {
    const ch = dailyChangePct(imHist[k] || [])
    return { key: k, direction: ch.direction, changePct: ch.changePct }
  })
  const imAlignment = calculateIntermarketAlignment(imSignals, regime)
  // Append-only (gat 1): per-instrument bijdrage, voor de uitklap. Zelfde
  // condities als de alignment-berekening; verandert die niet.
  const imContrib = intermarketContributions(imSignals, regime)

  type Draft = Omit<FbCall, 'id' | 'status' | 'outcomes'>
  const drafts: Draft[] = []
  for (const pair of PAIRS) {
    const hist = pairHist[pair] || []
    if (hist.length < 6) continue
    const last = hist[hist.length - 1]
    const mom = momentum5d(hist, pair)
    const atrPips = atr14Pips(hist, pair)
    const [pairBase, pairQuote] = pair.split('/')

    // Event-risico voor dit paar: high-impact events voor base of quote.
    const pairEvents = [...(eventRisk[pairBase] || []), ...(eventRisk[pairQuote] || [])]
      .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)

    let direction: 'bullish' | 'bearish'
    let fundScore: number
    let conv: ReturnType<typeof buildConvictionV2>
    let carryExtras: Partial<CallReasoning> = {}

    if (callType === 'position') {
      // ── Positie-lens (carry): richting = beleidsrenteverschil ──
      // Carry crasht historisch in Risk-Off → dan geen positie-calls.
      if (regime === 'Risk-Off') continue
      const rb = rates[pairBase]?.rate, rq = rates[pairQuote]?.rate
      if (rb == null || rq == null) continue
      const diff = +(rb - rq).toFixed(2)
      if (Math.abs(diff) < CARRY_MIN_DIFF) continue
      direction = diff > 0 ? 'bullish' : 'bearish'
      fundScore = diff
      conv = buildConvictionCarry({
        diffPp: diff, direction, regime,
        momentum5dPips: mom.pips, atrPips, imAlignment,
        highImpactEventCount: pairEvents.length,
      })
      carryExtras = {
        carryDiffPp: diff,
        carryBaseRate: rb,
        carryQuoteRate: rq,
        swapPctPer30d: +((Math.abs(diff) * 30) / 365).toFixed(2),
      }
    } else {
      // ── Day/swing: fundamentele onbalans (v2) ──
      const pb = computePairBias(pair, cs)
      if (pb.direction === 'neutraal' || Math.abs(pb.score) < FUND_GATE) continue
      direction = pb.direction
      fundScore = pb.score
      conv = buildConvictionV2({
        fundScore: pb.score, base: pb.base, quote: pb.quote, direction: pb.direction,
        momentum5dPips: mom.pips, atrPips, imAlignment, regime,
        highImpactEventCount: pairEvents.length,
      })
    }

    const regimeAligned = callType === 'position'
      ? regime !== 'Risk-Off'
      : isAlignedWithRegime(pairBase, pairQuote, direction === 'bullish', regime)
    const reasoning: CallReasoning = {
      base: factorsOf(pairBase, cs, factorDetail[pairBase]),
      quote: factorsOf(pairQuote, cs, factorDetail[pairQuote]),
      regime,
      regimeAligned,
      regimeText: callType === 'position'
        ? `Carry-positie in ${regime}-regime (in Risk-Off worden geen positie-calls gegeven — daar crasht carry historisch).`
        : regimeAligned
          ? `${pair} ${direction === 'bullish' ? 'long' : 'short'} past in het ${regime}-regime.`
          : `${pair} is neutraal binnen het ${regime}-regime (telt niet als voorwaarde, alleen voor de bias-score).`,
      momentum5dPips: mom.pips,
      momentumStart: mom.start,
      momentumNow: mom.now,
      imAlignment,
      // Append-only sleutels. Oude rijen missen deze en tonen in de UI
      // "niet vastgelegd voor deze call".
      intermarket: imContrib,
      newsDetail: {
        [pairBase]: news[pairBase]?.detail || [],
        [pairQuote]: news[pairQuote]?.detail || [],
      },
      // v2:
      modelVersion: MODEL_VERSION,
      atrPips: atrPips ?? undefined,
      eventRisk: pairEvents,
      newsSource,
      ...carryExtras,
    }
    drafts.push({
      callDate, callType, pair, base: pairBase, quote: pairQuote,
      direction, fundScore, conviction: conv.total,
      breakdown: conv, regime, entryPrice: last.close, entryDate: last.date, reasoning,
    })
  }

  drafts.sort((a, b) => b.conviction - a.conviction)
  const top = drafts.slice(0, callType === 'position' ? MAX_POSITION_CALLS : MAX_CALLS_PER_DAY)
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
  // Laatste beschikbare dag i.p.v. strikt "vandaag": in het weekend (of vóór
  // de ochtend-cron) tonen we de meest recente gelockte calls; de UI legt
  // uit waaróm er geen verse zijn.
  const latestDailyDate = all.filter((c) => c.callType === 'daily').map((c) => c.callDate).sort().slice(-1)[0]
  const dailyCalls = all.filter((c) => c.callType === 'daily' && c.callDate === latestDailyDate)
  const latestWeeklyDate = all.filter((c) => c.callType === 'weekly').map((c) => c.callDate).sort().slice(-1)[0]
  const weeklyCalls = all.filter((c) => c.callType === 'weekly' && c.callDate === latestWeeklyDate)
  const latestPositionDate = all.filter((c) => c.callType === 'position').map((c) => c.callDate).sort().slice(-1)[0]
  const positionCalls = all.filter((c) => c.callType === 'position' && c.callDate === latestPositionDate)

  const header = await buildHeader(sb)
  return {
    generatedAt: new Date().toISOString(),
    today,
    header,
    dailyCalls,
    weeklyCalls,
    positionCalls,
    trackrecord: all,
  }
}

export { pipMult }
