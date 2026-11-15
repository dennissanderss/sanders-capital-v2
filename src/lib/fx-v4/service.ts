// ─────────────────────────────────────────────────────────────
// FX v4 — service-laag (live engine van de Daily Macro Briefing)
//
// generateV4Shadow(): berekent één keer per dag de v4-calls en slaat ze
//   op als rijen in trade_focus_records met metadata.source='v4'.
//   (Functienamen dragen nog het shadow-achtervoegsel uit de bouwfase.)
// resolveV4Shadow(): rekent openstaande v4-calls af op 1/3/5/10/20
//   voltooide handelsdagen (close-to-close, drempel 30/50 pips) in de
//   bestaande accuracy-jsonb-kolom. No-leakage: pas als de exit-candle
//   voltooid is.
// legDagInputsVast(): schrijft per dag alle gebruikte inputs (rentes met
//   brondatums, candle-closes, CoT, dump van central_bank_rates) naar
//   Storage-bucket 'v4-inputs', zodat elke score later narekenbaar is.
//
// Signaalregel (het geteste pakket, audit fase 4):
//   1. 5d-prijsmomentum op voltooide dag-candles staat tégen de richting
//      waar het 5d-momentum van het 2-jaars renteverschil naartoe wijst.
//   2. Dan is de call: de richting van de renteherprijzing.
//   Drie zinnen per call, vastgelegd in metadata.redenering.
// ─────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fetchManyDaily, todayUTC, atr14Pips } from '../fundamental/prices'
import type { Candle } from '../fundamental/types'
import { haalRentes, haalCot, type YieldPoint, type CotStand } from './bronnen'
import {
  ENGINE_VERSION, V4_SOURCE, V4_SOURCES_ALL, V4_PAIRS, V4_PAIR_SYMBOLS,
  V4_HORIZONS, V4_METING, pipMultV4, pipDrempel,
} from './constants'
import { isAfgerond } from './uitkomst'

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// laatste waarde op of vóór een datum + de waarde n observaties eerder
function renteStand(reeks: YieldPoint[], totEnMet: string, n: number) {
  let idx = -1
  for (let i = reeks.length - 1; i >= 0; i--) {
    if (reeks[i].date <= totEnMet) { idx = i; break }
  }
  if (idx < 0 || idx < n) return null
  return {
    datum: reeks[idx].date, waarde: reeks[idx].y,
    eerderDatum: reeks[idx - n].date, eerderWaarde: reeks[idx - n].y,
    delta: +(reeks[idx].y - reeks[idx - n].y).toFixed(4),
  }
}

export interface V4Call {
  pair: string
  richting: 'long' | 'short'
  signalDate: string
  signalClose: number
  mom5Pips: number
  mom5Atr: number | null
  yldD5bp: number
  redenering: string[]
}

// ─── zuivere signaalberekening ────────────────────────────────
export function berekenV4Calls(
  candles: Record<string, Candle[]>,
  rentes: Record<string, YieldPoint[]>,
): { calls: V4Call[]; overgeslagen: { pair: string; reden: string }[] } {
  const calls: V4Call[] = []
  const overgeslagen: { pair: string; reden: string }[] = []

  for (const pair of V4_PAIRS) {
    const bars = candles[pair] || []
    if (bars.length < 20) { overgeslagen.push({ pair, reden: 'te weinig candles' }); continue }
    const [base, quote] = pair.split('/')
    const laatste = bars[bars.length - 1]
    const vijfTerug = bars[bars.length - 6]
    const m = pipMultV4(pair)
    const slot = +laatste.close.toFixed(pair.includes('JPY') ? 3 : 5)
    const mom5Pips = +((laatste.close - vijfTerug.close) * m).toFixed(1)
    const atr = atr14Pips(bars, pair)

    const b = renteStand(rentes[base] || [], laatste.date, 5)
    const q = renteStand(rentes[quote] || [], laatste.date, 5)
    if (!b || !q) { overgeslagen.push({ pair, reden: 'rentereeks onvolledig' }); continue }
    const yldD5bp = +((b.delta - q.delta) * 100).toFixed(1)

    if (mom5Pips === 0 || yldD5bp === 0) { overgeslagen.push({ pair, reden: 'geen richting (0-beweging)' }); continue }
    const renteRichting: 'long' | 'short' = yldD5bp > 0 ? 'long' : 'short'
    const contrarianRichting: 'long' | 'short' = mom5Pips < 0 ? 'long' : 'short'
    if (renteRichting !== contrarianRichting) { overgeslagen.push({ pair, reden: 'prijs beweegt mee met de renteherprijzing (geen contrarian-opzet)' }); continue }

    const sterker = renteRichting === 'long' ? base : quote
    const zwakker = renteRichting === 'long' ? quote : base
    calls.push({
      pair,
      richting: renteRichting,
      signalDate: laatste.date,
      signalClose: slot,
      mom5Pips,
      mom5Atr: atr ? +(Math.abs(mom5Pips) / atr).toFixed(2) : null,
      yldD5bp,
      redenering: [
        `${sterker} is sterker dan ${zwakker}: het 2-jaars renteverschil van ${pair} is de afgelopen 5 handelsdagen ${yldD5bp > 0 ? '+' : ''}${yldD5bp} bp richting ${sterker} verschoven (${base}: ${b.eerderWaarde}% op ${b.eerderDatum} → ${b.waarde}% op ${b.datum}; ${quote}: ${q.eerderWaarde}% → ${q.waarde}%).`,
        `De koers is er juist tégen in bewogen: ${mom5Pips > 0 ? '+' : ''}${mom5Pips} pips in 5 dagen${atr ? ` (${(Math.abs(mom5Pips) / atr).toFixed(1)}× de dagelijkse ATR)` : ''}, slot ${slot} op ${laatste.date}.`,
        `Verwachting: herstel richting ${sterker} binnen ~5 handelsdagen, gemeten close-to-close met drempel ${pipDrempel(pair)} pips.`,
      ],
    })
  }
  return { calls, overgeslagen }
}

// ─── genereren (idempotent per dag) ───────────────────────────
export async function generateV4Shadow(candles: Record<string, Candle[]>) {
  const sb = getSupabase()
  const vandaag = todayUTC()
  const dag = new Date(vandaag + 'T00:00:00Z').getUTCDay()
  if (dag === 0 || dag === 6) return { status: 'weekend', calls: 0 }

  const { data: bestaand } = await sb
    .from('trade_focus_records')
    .select('id')
    .eq('date', vandaag)
    .in('metadata->>source', [...V4_SOURCES_ALL])
    .limit(1)
  if (bestaand && bestaand.length > 0) return { status: 'al gegenereerd', calls: 0 }

  const vanaf = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10)
  const rentes = await haalRentes(vanaf)
  const cot = await haalCot(vandaag)
  const { calls: kandidaten, overgeslagen } = berekenV4Calls(candles, rentes)

  // ── Eén lopende call per paar ──────────────────────────────
  // Zolang een eerdere call niet is afgerond (doel gehaald óf de
  // 5-dagen-deadline afgerekend), krijgt dat paar geen nieuwe call.
  // Voorkomt dat dezelfde these dag na dag opnieuw wordt uitgestuurd
  // (de cluster-fout van de oude tool) en dat een paar wordt
  // "nageroepen" nadat het doel al binnen is.
  const kijkVanaf = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
  const { data: recent } = await sb
    .from('trade_focus_records')
    .select('pair, date, accuracy')
    .in('metadata->>source', [...V4_SOURCES_ALL])
    .gte('date', kijkVanaf)
  const lopend = new Map<string, string>()
  for (const r of recent || []) {
    if (!isAfgerond(r.accuracy)) lopend.set(r.pair, r.date)
  }
  const calls = kandidaten.filter((c) => !lopend.has(c.pair))
  for (const c of kandidaten) {
    if (lopend.has(c.pair)) {
      overgeslagen.push({ pair: c.pair, reden: `er loopt al een call op dit paar (van ${lopend.get(c.pair)})` })
    }
  }

  if (calls.length > 0) {
    const rijen = calls.map((c) => {
      const [base, quote] = c.pair.split('/')
      return {
        date: vandaag,
        pair: c.pair,
        direction: c.richting === 'long' ? 'bullish_mean_reversion' : 'bearish_mean_reversion',
        conviction: 'v4',
        score: c.yldD5bp, // renteverschuiving in bp, teken richting long
        entry_price: c.signalClose, // slotkoers waarop het signaal is berekend
        regime: 'n.v.t. (v4)',
        result: 'pending',
        methodology: 'v4-close-to-close',
        metadata: {
          source: V4_SOURCE,
          engine_version: ENGINE_VERSION,
          richting: c.richting,
          signalDate: c.signalDate,
          signalClose: c.signalClose,
          mom5Pips: c.mom5Pips,
          mom5Atr: c.mom5Atr,
          yldD5bp: c.yldD5bp,
          cotBase: cot[base] ?? null,
          cotQuote: cot[quote] ?? null,
          redenering: c.redenering,
          meting: V4_METING,
        },
      }
    })
    const { error } = await sb.from('trade_focus_records').insert(rijen)
    if (error) return { status: 'fout bij insert: ' + error.message, calls: 0 }
  }

  await legDagInputsVast(sb, vandaag, candles, rentes, cot, calls, overgeslagen)
  return { status: 'ok', calls: calls.length, overgeslagen: overgeslagen.length }
}

// ─── dagelijkse input-vastlegging (Storage) ───────────────────
async function legDagInputsVast(
  sb: SupabaseClient,
  vandaag: string,
  candles: Record<string, Candle[]>,
  rentes: Record<string, YieldPoint[]>,
  cot: Record<string, CotStand | null>,
  calls: V4Call[],
  overgeslagen: { pair: string; reden: string }[],
) {
  try {
    // bucket aanmaken als die nog niet bestaat (idempotent)
    await sb.storage.createBucket('v4-inputs', { public: false }).catch(() => null)
    const { data: cbDump } = await sb.from('central_bank_rates').select('*')
    const inhoud = {
      date: vandaag,
      vastgelegdOp: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
      meting: V4_METING,
      rentes: Object.fromEntries(Object.entries(rentes).map(([ccy, reeks]) => [ccy, reeks.slice(-30)])),
      renteBronnen: {
        USD: 'FRED DGS2 (2j)', EUR: 'ECB AAA spot 2Y', JPY: 'MoF JGB 2Y',
        CAD: 'BoC BD.CDN.2YR.DQ.YLD', AUD: 'RBA F2 (AGS 2j)', GBP: 'BoE IUDSNPY (5j!)',
      },
      candleCloses: Object.fromEntries(Object.entries(candles).map(([pair, bars]) => [pair, bars.slice(-10)])),
      cot,
      centralBankRatesDump: cbDump ?? [],
      calls,
      overgeslagen,
    }
    await sb.storage
      .from('v4-inputs')
      .upload(`${vandaag}.json`, JSON.stringify(inhoud, null, 1), { contentType: 'application/json', upsert: true })
  } catch {
    // logging mag de call-generatie nooit blokkeren
  }
}

// ─── afrekenen (no-leakage, multi-horizon) ────────────────────
export async function resolveV4Shadow(candles: Record<string, Candle[]>) {
  const sb = getSupabase()
  const { data: alle } = await sb
    .from('trade_focus_records')
    .select('id, date, pair, exit_price, metadata, accuracy')
    .in('metadata->>source', [...V4_SOURCES_ALL])
    .order('date', { ascending: true })
    .limit(1000)
  // alleen rijen waar de 20d-horizon nog niet is afgerekend
  const open = (alle || []).filter((r) => !(r.accuracy as Record<string, unknown> | null)?.['20d'])

  let bijgewerkt = 0
  for (const rij of open) {
    const bars = candles[rij.pair]
    if (!bars || bars.length === 0) continue
    const m = pipMultV4(rij.pair)
    const drempel = pipDrempel(rij.pair)
    const isLong = rij.metadata?.richting === 'long'

    // referentie = eerste voltooide candle op/na de call-datum
    const refIdx = bars.findIndex((c) => c.date >= rij.date)
    if (refIdx < 0) continue
    const ref = bars[refIdx]
    const atr = refIdx >= 15 ? atr14Pips(bars.slice(0, refIdx + 1), rij.pair) : null

    const accuracy: Record<string, unknown> = { ...(rij.accuracy || {}) }
    let nieuw = false
    for (const n of V4_HORIZONS) {
      const key = `${n}d`
      if (accuracy[key]) continue
      const xi = refIdx + n
      if (xi >= bars.length) continue // horizon nog niet volledig verstreken
      const exit = bars[xi]
      const dirPips = +(((exit.close - ref.close) * m) * (isLong ? 1 : -1)).toFixed(1)
      accuracy[key] = {
        status: dirPips >= drempel ? 'klopt' : dirPips <= -drempel ? 'klopt_niet' : 'te_klein',
        dirPips,
        atrMult: atr ? +(dirPips / atr).toFixed(3) : null,
        exitDate: exit.date,
        exitClose: exit.close,
      }
      nieuw = true
    }
    if (!nieuw && rij.metadata?.refClose != null) continue

    const { error } = await sb
      .from('trade_focus_records')
      .update({
        accuracy,
        computed_at: new Date().toISOString(),
        methodology: 'v4-close-to-close',
        exit_price: rij.exit_price ?? ref.close, // meetreferentie, geen trade-exit
        metadata: { ...(rij.metadata || {}), refDate: ref.date, refClose: ref.close },
      })
      .eq('id', rij.id)
    if (!error) bijgewerkt++
  }
  return { bijgewerkt, openstaand: open.length }
}

// ─── candles één keer ophalen voor generate + resolve ─────────
export async function haalV4Candles(): Promise<Record<string, Candle[]>> {
  const vanaf = new Date(Date.now() - 80 * 86400000).toISOString().slice(0, 10)
  return fetchManyDaily(Object.entries(V4_PAIR_SYMBOLS), vanaf)
}
