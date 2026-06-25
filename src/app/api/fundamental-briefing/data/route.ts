import { NextResponse } from 'next/server'
import { generateBriefing, readData } from '@/lib/fundamental/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function safe(fn: () => Promise<unknown>) {
  try { await fn() } catch { /* generatie-fout mag het uitlezen niet breken */ }
}

// Leest de gelockte calls + trackrecord. Genereert lui de calls van vandaag
// als de cron nog niet heeft gedraaid (idempotent: bestaande dag wordt
// overgeslagen zonder opnieuw te berekenen).
export async function GET() {
  await safe(() => generateBriefing('daily'))
  const isMonday = new Date().getUTCDay() === 1
  if (isMonday) await safe(() => generateBriefing('weekly'))

  let data = await readData()
  // Bootstrap: nog nooit een weekly? Genereer er één zodat de tab gevuld is.
  if (data.weeklyCalls.length === 0 && !data.trackrecord.some((c) => c.callType === 'weekly')) {
    await safe(() => generateBriefing('weekly'))
    data = await readData()
  }

  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
