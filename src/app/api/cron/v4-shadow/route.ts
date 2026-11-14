// ─── Cron: v4-engine in schaduwmodus ──────────────────────────
// Draait ma-vr om 06:50 UTC (na de oude trackrecord-cron van 06:00):
//   1. rekent openstaande v4-calls af (close-to-close, 5 horizons)
//   2. genereert de v4-calls van vandaag (opgeslagen met
//      metadata.source='v4-shadow'; de site toont alleen de oude engine)
//   3. legt alle dag-inputs vast in Storage-bucket 'v4-inputs'
// Zie docs/audit/fundamental-audit.md (fase 4/6) voor de onderbouwing.
// ──────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { generateV4Shadow, resolveV4Shadow, haalV4Candles } from '@/lib/fx-v4/service'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const candles = await haalV4Candles()
    const afgerekend = await resolveV4Shadow(candles)
    const gegenereerd = await generateV4Shadow(candles)
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      afgerekend,
      gegenereerd,
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
