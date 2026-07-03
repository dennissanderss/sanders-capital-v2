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
// Sinds de drie-lenzen-versie: daily + position, elke werkdag. Weekly is
// legacy en wordt niet meer aangevuld (swing = dagcalls op 5d-horizon).
export async function GET() {
  await safe(() => generateBriefing('daily'))
  await safe(() => generateBriefing('position'))

  const data = await readData()
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
