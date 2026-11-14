// ─── GET /api/v4 — data voor de Daily Macro Briefing (v4) ─────
// Levert de calls van de laatste handelsdag + het volledige forward-only
// trackrecord met per-horizon uitkomsten (close-to-close, drempels 30/50
// pips). Alles herleidbaar: elke koers heeft een datum en is na te
// checken in TradingView. Leest ook de dagelijkse input-log (Storage)
// voor de overgeslagen paren en de bron-provenance.
// ──────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { ENGINE_VERSION, V4_SOURCES_ALL, V4_HORIZONS, V4_METING, V4_PAIRS, pipDrempel } from '@/lib/fx-v4/constants'

export const dynamic = 'force-dynamic'

interface V4Rij {
  id: string
  date: string
  pair: string
  result: string
  accuracy: Record<string, { status: string; dirPips: number; atrMult: number | null; exitDate: string; exitClose: number }> | null
  metadata: Record<string, unknown> | null
}

export async function GET() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const { data, error } = await sb
      .from('trade_focus_records')
      .select('id, date, pair, result, accuracy, metadata')
      .in('metadata->>source', [...V4_SOURCES_ALL])
      .order('date', { ascending: false })
      .limit(1000)
    if (error) throw new Error(error.message)

    const rijen = (data || []) as V4Rij[]
    const calls = rijen.map((r) => {
      const m = r.metadata || {}
      return {
        id: r.id,
        date: r.date,
        pair: r.pair,
        richting: (m.richting as string) || 'long',
        redenering: (m.redenering as string[]) || [],
        signalDate: (m.signalDate as string) ?? null,
        signalClose: (m.signalClose as number) ?? null,
        refDate: (m.refDate as string) ?? null,
        refClose: (m.refClose as number) ?? null,
        yldD5bp: (m.yldD5bp as number) ?? null,
        mom5Pips: (m.mom5Pips as number) ?? null,
        mom5Atr: (m.mom5Atr as number) ?? null,
        cotBase: m.cotBase ?? null,
        cotQuote: m.cotQuote ?? null,
        drempel: pipDrempel(r.pair),
        horizons: r.accuracy || {},
      }
    })

    // aggregaten per horizon (alleen besliste uitkomsten tellen mee)
    const perHorizon: Record<string, { klopt: number; kloptNiet: number; teKlein: number; open: number; winrateBeslist: number | null }> = {}
    for (const n of V4_HORIZONS) {
      const key = `${n}d`
      let klopt = 0, kloptNiet = 0, teKlein = 0, open = 0
      for (const c of calls) {
        const h = c.horizons[key]
        if (!h) { open++; continue }
        if (h.status === 'klopt') klopt++
        else if (h.status === 'klopt_niet') kloptNiet++
        else teKlein++
      }
      const beslist = klopt + kloptNiet
      perHorizon[key] = {
        klopt, kloptNiet, teKlein, open,
        winrateBeslist: beslist > 0 ? +(100 * klopt / beslist).toFixed(1) : null,
      }
    }

    // vandaag/laatste handelsdag + input-log (overgeslagen paren, provenance)
    const laatsteDatum = calls[0]?.date ?? null
    const vandaagCalls = laatsteDatum ? calls.filter((c) => c.date === laatsteDatum) : []
    let inputLog: { date: string; overgeslagen?: { pair: string; reden: string }[]; renteBronnen?: Record<string, string> } | null = null
    for (let terug = 0; terug < 6 && !inputLog; terug++) {
      const d = new Date(Date.now() - terug * 86400000).toISOString().slice(0, 10)
      const { data: bestand } = await sb.storage.from('v4-inputs').download(`${d}.json`)
      if (bestand) {
        try {
          const json = JSON.parse(await bestand.text())
          inputLog = { date: d, overgeslagen: json.overgeslagen, renteBronnen: json.renteBronnen }
        } catch { /* corrupte log overslaan */ }
      }
    }

    const res = NextResponse.json({
      engineVersion: ENGINE_VERSION,
      meting: V4_METING,
      paren: V4_PAIRS,
      laatsteDatum,
      vandaag: { calls: vandaagCalls, inputLog },
      trackrecord: { totaal: calls.length, perHorizon, calls },
      gegenereerdOp: new Date().toISOString(),
    })
    res.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300')
    return res
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
