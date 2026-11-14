// ─── Uitgeschakeld (audit fase 6) ────────────────────────────
// Dit endpoint kon publiek het trackrecord herschrijven (POST) en zelfs
// records wissen (DELETE). De audit (docs/audit/fundamental-audit.md,
// fase 1/5) toonde aan dat de backfill-data gesimuleerd nieuws en
// look-ahead bevatte en geen bewijswaarde heeft. Backfillen gebeurt
// nooit meer: het trackrecord is vanaf nu forward-only.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'

function gone() {
  return NextResponse.json(
    { error: 'Endpoint verwijderd na audit: het trackrecord is forward-only en wordt nooit meer gebackfilld.' },
    { status: 410 },
  )
}

export async function GET() { return gone() }
export async function POST() { return gone() }
export async function DELETE() { return gone() }
