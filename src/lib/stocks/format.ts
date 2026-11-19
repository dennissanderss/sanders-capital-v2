// ─────────────────────────────────────────────────────────────
// Sanders Capital — Aandelen Analyzer: opmaak-helpers (server + client)
// ─────────────────────────────────────────────────────────────

export function nl(v: number, d = 2): string {
  return v.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export function pct(v: number | null | undefined, d = 1): string {
  return v == null || !Number.isFinite(v) ? '—' : `${nl(v * 100, d)}%`
}

// Grote bedragen leesbaar: 1,2 bln / 3,4 mld / 560 mln.
export function groot(v: number | null | undefined, valuta?: string | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  let s: string
  if (abs >= 1e12) s = `${nl(v / 1e12, 2)} bln`
  else if (abs >= 1e9) s = `${nl(v / 1e9, 1)} mld`
  else if (abs >= 1e6) s = `${nl(v / 1e6, 0)} mln`
  else s = nl(v, 0)
  return valuta ? `${valuta} ${s}` : s
}

export function datumNl(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}
