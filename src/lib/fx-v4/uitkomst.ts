// ─────────────────────────────────────────────────────────────
// FX v4 — doel-uitkomst van een call (één bron van waarheid)
//
// De regel (zie ook de tool-pagina):
//   WIN  ("gehaald")      zodra de slotkoers van dag 1, 3 of 5 minstens
//                         het doel (30/50 pips) in de callrichting staat.
//                         Definitief — latere dagen veranderen er niets aan.
//   LOSS ("niet_gehaald") als dag 5 is afgerekend zonder dat een van de
//                         drie meetmomenten het doel haalde.
//   anders "loopt"        — met de laatste tussenstand erbij.
//
// Gebruikt door: de engine (geen nieuwe call op een paar met een lopende
// call), de API (serialisatie) en indirect de UI.
// ─────────────────────────────────────────────────────────────

export interface HorizonRecord {
  status: string
  dirPips: number
  exitDate: string
  exitClose: number
  atrMult?: number | null
}
export type AccuracyMap = Record<string, HorizonRecord> | null | undefined

export interface DoelUitkomst {
  status: 'gehaald' | 'niet_gehaald' | 'loopt'
  dagGehaald?: 1 | 3 | 5
  pips?: number
  exitClose?: number
  exitDate?: string
  tussenstand?: { dag: 1 | 3; pips: number; exitClose: number; exitDate: string } | null
}

const MEETMOMENTEN = [['1d', 1], ['3d', 3], ['5d', 5]] as const

export function doelUitkomst(accuracy: AccuracyMap): DoelUitkomst {
  const acc = accuracy || {}
  for (const [key, dag] of MEETMOMENTEN) {
    const h = acc[key]
    if (h?.status === 'klopt') {
      return { status: 'gehaald', dagGehaald: dag, pips: h.dirPips, exitClose: h.exitClose, exitDate: h.exitDate }
    }
  }
  const vijf = acc['5d']
  if (vijf) {
    return { status: 'niet_gehaald', pips: vijf.dirPips, exitClose: vijf.exitClose, exitDate: vijf.exitDate }
  }
  // loopt nog: meest recente tussenstand (dag 3 boven dag 1)
  for (const [key, dag] of [['3d', 3], ['1d', 1]] as const) {
    const h = acc[key]
    if (h) return { status: 'loopt', tussenstand: { dag, pips: h.dirPips, exitClose: h.exitClose, exitDate: h.exitDate } }
  }
  return { status: 'loopt', tussenstand: null }
}

export function isAfgerond(accuracy: AccuracyMap): boolean {
  return doelUitkomst(accuracy).status !== 'loopt'
}
