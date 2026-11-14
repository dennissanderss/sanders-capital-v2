// ─── Uitgeschakeld (audit fase 6) ────────────────────────────
// De optimizer testte 100+ configuraties op de gesimuleerde
// backfill-periode (look-ahead) en leverde de overfitte parameters van
// v3.1 op (zie docs/audit/fundamental-audit.md, fase 3/4). Parameters
// worden voortaan alleen nog buiten productie getoetst met een
// chronologische ontwikkel/toets-splitsing (scripts/audit/).
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { error: 'Endpoint verwijderd na audit: optimaliseren op de eigen (gesimuleerde) dataset is afgeschaft.' },
    { status: 410 },
  )
}
