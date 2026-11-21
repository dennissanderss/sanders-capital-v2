// ─────────────────────────────────────────────────────────────
// Sanders Capital — Aandelen Analyzer: scoreregels
//
// Twee losse oordelen, bewust gescheiden:
//
//   LANGE TERMIJN (jaren) — kijkt naar het BEDRIJF: kwaliteit, financiële
//   gezondheid, groei en waardering. Geïnspireerd op de Piotroski F-score
//   (2000), winstgevendheid als kwaliteitsmaat (Novy-Marx 2013) en
//   waardering (Fama & French 1992).
//
//   KORTE TERMIJN (dagen–weken) — kijkt naar de KOERS: trend en momentum.
//   Geïnspireerd op het trendfilter van Faber (2007) en het momentum-effect
//   (Jegadeesh & Titman 1993).
//
// Eerlijk over de status: de drempels en gewichten hieronder zijn een eigen
// vereenvoudiging. Het onderzoek toont gemiddelde effecten over duizenden
// aandelen; déze exacte regels zijn niet als strategie getoetst. Alles is
// wel narekenbaar: elke check toont zijn waarde, drempel en punten.
// Zie docs/audit/aandelen-analyzer-audit.md voor de onderbouwing van de keuzes.
// ─────────────────────────────────────────────────────────────
import type { DagCandle, JaarRij } from './yahoo'
import { nl, pct, datumNl } from './format'

export type Status = 'goed' | 'neutraal' | 'slecht' | 'onbekend'
export interface Check {
  id: string
  label: string
  uitleg: string // beginnersuitleg: wat is dit en waarom telt het
  waarde: string
  status: Status
  punten: number | null
  max: number
}
export interface Categorie { naam: string; checks: Check[]; punten: number; max: number }
export type Oordeel = 'kopen' | 'afwachten' | 'vermijden' | 'onbekend'

function check(
  id: string, label: string, uitleg: string, waarde: string, punten: number | null, max: number,
): Check {
  const status: Status = punten == null ? 'onbekend' : punten >= max ? 'goed' : punten <= 0 ? 'slecht' : 'neutraal'
  return { id, label, uitleg, waarde, status, punten, max }
}
// Drempel-helper: hoger is beter.
function trap(v: number | null, goed: number, matig: number, max: number): number | null {
  if (v == null || !Number.isFinite(v)) return null
  return v >= goed ? max : v >= matig ? max / 2 : 0
}
// Glijdende schaal zonder klif: `vol` levert alle punten, `nul` geen, daartussen
// lineair (afgerond op halve punten). Werkt in beide richtingen.
function glijdend(v: number | null, vol: number, nul: number, max: number): number | null {
  if (v == null || !Number.isFinite(v)) return null
  const f = Math.max(0, Math.min(1, (v - nul) / (vol - nul)))
  return Math.round(f * max * 2) / 2
}
function cat(naam: string, checks: Check[]): Categorie {
  const bekend = checks.filter((c) => c.punten != null)
  return {
    naam, checks,
    punten: bekend.reduce((a, c) => a + (c.punten as number), 0),
    max: bekend.reduce((a, c) => a + c.max, 0),
  }
}
const deel = (a: number | null, b: number | null): number | null =>
  a == null || b == null || b === 0 ? null : a / b
const plus = (v: number) => (v > 0 ? '+' : '')
const jarenTussen = (van: string, tot: string) => (Date.parse(tot) - Date.parse(van)) / (365.25 * 86400000)

// ─── Kerncijfers (door service.ts berekend op het voltooide slot) ───
export interface Kern {
  koers: number | null
  marktkap: number | null // in koers-valuta (hoofdeenheid)
  wisselkoers: number | null // jaarrekening-valuta → koers-valuta
  koersWinst: number | null // K/W op de winst van de afgelopen 12 maanden
  koersWinstVerwacht: number | null // K/W op de door analisten verwachte winst (alleen ter vergelijking)
  ebitda: number | null
  schuld: number | null
  cash: number | null
  dividendRendement: number | null
  uitkeringsratio: number | null
  beta: number | null
}

// ─── Piotroski F-score ───────────────────────────────────────
export interface Piotroski { score: number; getoetst: number; punten: { label: string; ok: boolean | null }[] }

export function piotroski(jaren: JaarRij[]): Piotroski | null {
  if (jaren.length < 2) return null
  const t = jaren[jaren.length - 1], v = jaren[jaren.length - 2]
  const roa = (j: JaarRij) => deel(j.nettowinst, j.totaleActiva)
  const hefboom = (j: JaarRij) => deel(j.langlopendeSchuld, j.totaleActiva)
  const current = (j: JaarRij) => deel(j.vlottendeActiva, j.kortlopendeSchulden)
  const marge = (j: JaarRij) => deel(j.brutowinst, j.omzet)
  const omloop = (j: JaarRij) => deel(j.omzet, j.totaleActiva)
  const beter = (a: number | null, b: number | null) => (a == null || b == null ? null : a > b)
  const punten: Piotroski['punten'] = [
    { label: 'Nettowinst positief', ok: t.nettowinst == null ? null : t.nettowinst > 0 },
    { label: 'Operationele kasstroom positief', ok: t.operationeleKasstroom == null ? null : t.operationeleKasstroom > 0 },
    { label: 'Winst per euro bezit gestegen (rendement op activa)', ok: beter(roa(t), roa(v)) },
    { label: 'Kasstroom hoger dan nettowinst (winst is "echt geld")', ok: beter(t.operationeleKasstroom, t.nettowinst) },
    { label: 'Langlopende schuld t.o.v. bezit niet gestegen', ok: (() => { const a = hefboom(t), b = hefboom(v); return a == null || b == null ? null : a <= b })() },
    { label: 'Kan korte schulden beter betalen (current ratio gestegen)', ok: beter(current(t), current(v)) },
    { label: 'Geen nieuwe aandelen uitgegeven', ok: t.aandelen == null || v.aandelen == null ? null : t.aandelen <= v.aandelen * 1.005 },
    { label: 'Brutomarge gestegen', ok: beter(marge(t), marge(v)) },
    { label: 'Meer omzet per euro bezit (omloopsnelheid gestegen)', ok: beter(omloop(t), omloop(v)) },
  ]
  const getoetst = punten.filter((p) => p.ok != null).length
  if (getoetst < 6) return null
  return { score: punten.filter((p) => p.ok === true).length, getoetst, punten }
}

function cagr(eerste: number | null, laatste: number | null, jaren: number): number | null {
  if (eerste == null || laatste == null || jaren <= 0 || eerste <= 0 || laatste <= 0) return null
  return Math.pow(laatste / eerste, 1 / jaren) - 1
}

// ─── Soort bedrijf ───────────────────────────────────────────
// De checks zijn gemaakt voor gewone bedrijven. Voor sommige bedrijfstypen
// passen ze deels of helemaal niet; dan is de tool daar eerlijk over in
// plaats van een schijnzeker cijfer te geven.
//   bank     — banken, verzekeraars, zakenbanken: 5 checks n.v.t., max. Afwachten
//   vastgoed — REITs: winst en schuld werken anders → geen oordeel
//   beperkt  — nutsbedrijven, vermogensbeheerders: alle checks, max. Afwachten
export type BedrijfsSoort = 'gewoon' | 'bank' | 'vastgoed' | 'beperkt'

export function bedrijfsSoort(sector: string | null, industrie: string | null): BedrijfsSoort {
  if (sector === 'Real Estate' || (industrie != null && /^REIT/.test(industrie))) return 'vastgoed'
  if (industrie != null) {
    if (/^(Banks|Insurance)/.test(industrie) || ['Mortgage Finance', 'Financial Conglomerates', 'Capital Markets'].includes(industrie)) return 'bank'
    if (industrie === 'Asset Management') return 'beperkt'
  } else if (sector === 'Financial Services') {
    return 'bank' // bedrijfstak onbekend: voorzichtig
  }
  if (sector === 'Utilities') return 'beperkt'
  return 'gewoon'
}

// ─── LANGE TERMIJN ───────────────────────────────────────────
export interface LangeTermijn {
  oordeel: Oordeel
  score: number | null // 0–100, als percentage van de checks die meetellen
  samenvatting: string[]
  categorieen: Categorie[]
  piotroski: Piotroski | null
  soort: BedrijfsSoort
  checksGeteld: number // aantal checks waar de score op rust
  checksTotaal: number
}

export function analyseLangeTermijn(
  jaren: JaarRij[], k: Kern, sector: string | null, industrie: string | null, vanTop: number | null,
): LangeTermijn {
  const soort = bedrijfsSoort(sector, industrie)
  const financieel = soort === 'bank'
  const nvt = 'n.v.t. (bank/verzekeraar)'
  const t = jaren[jaren.length - 1] as JaarRij | undefined
  const v = jaren.length > 1 ? jaren[jaren.length - 2] : undefined
  const eerste = jaren[0] as JaarRij | undefined
  // Aantal jaren uit de boekjaardata zelf: werkt ook bij een ontbrekend of verschoven boekjaar.
  const n = eerste && t && eerste !== t ? jarenTussen(eerste.datum, t.datum) : 0
  const nTekst = n > 0 ? `${Math.round(n)}` : '?'
  const f = piotroski(jaren)

  // — Kwaliteit —
  // Geïnvesteerd kapitaal altijd zelf: eigen vermogen + schuld. Yahoo's eigen
  // veld bleek soms alleen het eigen vermogen te bevatten (Unilever: 47% i.p.v. ±17%).
  const kapitaalVan = (j: JaarRij | undefined) => (j && j.eigenVermogen != null && j.schuld != null ? j.eigenVermogen + j.schuld : null)
  const kapT = kapitaalVan(t), kapV = kapitaalVan(v)
  const kapitaal = kapT != null && kapV != null && kapV > 0 ? (kapT + kapV) / 2 : kapT
  const roic = t && t.ebit != null && kapitaal != null && kapitaal > 0 ? (t.ebit * 0.75) / kapitaal : null
  const roe = t && t.eigenVermogen != null && t.eigenVermogen > 0 ? deel(t.nettowinst, t.eigenVermogen) : null
  const opMarge = t ? deel(t.bedrijfsresultaat, t.omzet) : null
  const fcfJaren = jaren.filter((j) => j.vrijeKasstroom != null)
  const fcfPos = fcfJaren.filter((j) => (j.vrijeKasstroom as number) > 0).length
  // Piotroski omgerekend naar de schaal van 9, ook als er minder vragen te toetsen waren.
  const f9 = f ? (f.score * 9) / f.getoetst : null

  const kwaliteit = cat('Kwaliteit van het bedrijf', [
    financieel
      ? check('roe', 'Rendement op eigen vermogen (ROE)',
          'Hoeveel winst het bedrijf maakt met het geld van de aandeelhouders. Bij banken en verzekeraars is dit de gebruikelijke maatstaf. Vanaf 12% krijgt het alle punten, vanaf 8% de helft.',
          pct(roe), trap(roe, 0.12, 0.08, 10), 10)
      : check('roic', 'Rendement op geïnvesteerd kapitaal (ROIC)',
          'Hoeveel winst het bedrijf maakt op elke euro die erin gestoken is (eigen geld + leningen), na een vaste 25% belasting. Vanaf 15% alle punten, vanaf 8% de helft; daaronder verdient het bedrijf nauwelijks meer dan het geld kost. Let op: bij bedrijven die veel eigen aandelen inkopen (zoals Apple) valt dit getal hoger uit dan het werkelijk is.',
          pct(roic), trap(roic, 0.15, 0.08, 10), 10),
    financieel
      ? check('marge', 'Operationele marge', 'Bij banken en verzekeraars is deze maatstaf niet vergelijkbaar.', nvt, null, 10)
      : check('marge', 'Operationele marge',
          'Welk deel van elke euro omzet overblijft als winst uit de gewone bedrijfsvoering. Vanaf 15% alle punten, vanaf 5% de helft. Dit verschilt sterk per sector: een supermarkt met 4% marge kan prima draaien, dus lees een lage score hier niet los van het soort bedrijf.',
          pct(opMarge), trap(opMarge, 0.15, 0.05, 10), 10),
    financieel
      ? check('fcf', 'Vrije kasstroom', 'Bij banken en verzekeraars zegt de vrije kasstroom weinig.', nvt, null, 10)
      : check('fcf', 'Vrije kasstroom elk jaar positief',
          'Vrije kasstroom is het geld dat écht overblijft nadat alle rekeningen en investeringen zijn betaald. Winst kan boekhoudkundig zijn; kasstroom is geld op de bank. Elk jaar positief geeft alle punten, één negatief jaar de helft.',
          fcfJaren.length === 0 ? '—' : `${fcfPos} van ${fcfJaren.length} jaar positief`,
          fcfJaren.length === 0 ? null : fcfPos === fcfJaren.length ? 10 : fcfPos >= fcfJaren.length - 1 && fcfJaren.length > 1 ? 5 : 0, 10),
    financieel
      ? check('piotroski', 'Piotroski F-score', 'Deze boekhoudtoets is ontworpen voor gewone bedrijven en werkt niet voor banken en verzekeraars.', nvt, null, 10)
      : check('piotroski', 'Piotroski F-score',
          'Negen ja/nee-vragen over winst, kasstroom, schuld en efficiëntie: het laatste boekjaar vergeleken met het jaar ervoor. 7 of hoger geeft alle punten, 4 tot 6 de helft, 3 of lager is een waarschuwing. Kanttekening: professor Piotroski (2000) testte dit op goedkope, kleine bedrijven. Bij een groot bedrijf op recordniveau zegt "niet verder verbeterd" weinig.',
          f ? `${f.score} van ${f.getoetst}` : '—',
          f9 == null ? null : f9 >= 6.75 ? 10 : f9 >= 3.5 ? 5 : 0, 10),
  ])

  // — Financiële gezondheid —
  const cashJaar = t ? (t.cashEnBeleggingen ?? t.cash) : null
  const opKern = k.schuld != null && k.cash != null
  const nettoSchuld = opKern ? (k.schuld as number) - (k.cash as number) : t && t.schuld != null && cashJaar != null ? t.schuld - cashJaar : null
  const ebitda = k.ebitda ?? t?.ebitda ?? null
  const ebitdaOfEbit = ebitda ?? t?.ebit ?? null
  const opEbit = ebitda == null && ebitdaOfEbit != null
  const schuldRatio = nettoSchuld == null ? null : nettoSchuld <= 0 ? 0 : ebitdaOfEbit != null && ebitdaOfEbit > 0 ? nettoSchuld / ebitdaOfEbit : null
  const verlieslatend = ebitdaOfEbit != null && ebitdaOfEbit <= 0
  const aandelenGroei = eerste && t && n > 0 ? cagr(eerste.aandelen, t.aandelen, n) : null

  const gezondheid = cat('Financiële gezondheid', [
    financieel
      ? check('schuld', 'Nettoschuld t.o.v. EBITDA', 'Bij banken is schuld het bedrijfsmodel (spaargeld is "schuld"); deze maatstaf werkt daar niet.', nvt, null, 10)
      : check('schuld', 'Nettoschuld t.o.v. EBITDA',
          'EBITDA is de winst uit de bedrijfsvoering vóór rente, belasting en afschrijvingen. Deze verhouding zegt hoeveel jaar het bedrijf nodig heeft om zijn schuld (na aftrek van cash) daaruit af te lossen. Onder 1 alle punten, onder 3 de helft, daarboven wordt het risicovol. Heeft een bedrijf meer cash dan schuld maar draait het verlies, dan krijgt het de helft: de cash raakt dan op.',
          nettoSchuld == null ? '—'
            : nettoSchuld <= 0 ? (verlieslatend ? 'meer cash dan schuld, maar de bedrijfsvoering kost geld' : 'meer cash dan schuld')
            : schuldRatio == null ? (verlieslatend ? 'schuld bij een verlieslatende bedrijfsvoering' : '—')
            : `${nl(schuldRatio, 1)}×${opEbit ? ' (op EBIT; EBITDA onbekend)' : ''}`,
          nettoSchuld == null ? null
            : nettoSchuld <= 0 ? (verlieslatend ? 5 : 10)
            : schuldRatio == null ? (verlieslatend ? 0 : null)
            : schuldRatio < 1 ? 10 : schuldRatio < 3 ? 5 : 0, 10),
    check('verwatering', 'Aantal aandelen',
      'Als een bedrijf steeds nieuwe aandelen uitgeeft, wordt jouw stukje van de taart kleiner (verwatering). Koopt het juist eigen aandelen in, dan wordt jouw stukje groter. Gelijk of dalend geeft alle punten, tot 2% groei per jaar de helft.',
      aandelenGroei == null ? '—' : `${plus(aandelenGroei)}${pct(aandelenGroei)} per jaar`,
      aandelenGroei == null ? null : aandelenGroei <= 0.002 ? 10 : aandelenGroei <= 0.02 ? 5 : 0, 10),
  ])

  // — Groei —
  // Een omzetdaling van meer dan 40% in één jaar is bijna altijd een andere
  // definitie in de databron (Adyen: bruto → netto), geen echte krimp.
  const omzetSprong = jaren.some((j, i) => i > 0 && j.omzet != null && jaren[i - 1].omzet != null && (jaren[i - 1].omzet as number) > 0 && j.omzet / (jaren[i - 1].omzet as number) < 0.6)
  const omzetGroei = !omzetSprong && eerste && t && n > 0 ? cagr(eerste.omzet, t.omzet, n) : null
  const wpaGroei = eerste && t && n > 0 ? cagr(eerste.wpa, t.wpa, n) : null
  const vanVerliesNaarWinst = !!(eerste && t && eerste.wpa != null && t.wpa != null && eerste.wpa <= 0 && t.wpa > 0)
  const nogVerlies = !!(t && t.wpa != null && t.wpa <= 0)

  const groei = cat('Groei', [
    check('omzetgroei', `Omzetgroei per jaar (${nTekst} jaar)`,
      'Groeit het bedrijf? Zonder omzetgroei kan de winst alleen stijgen door te bezuinigen, en dat houdt een keer op. Vanaf 10% per jaar alle punten, vanaf 3% de helft. Kanttekening: met maar een paar jaar data hangt dit sterk af van het startjaar. Bij olie-, mijnbouw- en chipbedrijven gaat de omzet in golven; een start op een piekjaar geeft dan onterecht krimp.',
      omzetSprong ? 'sprong in de cijfers van de databron — niet te beoordelen' : omzetGroei == null ? '—' : `${plus(omzetGroei)}${pct(omzetGroei)}`,
      trap(omzetGroei, 0.10, 0.03, 10), 10),
    check('winstgroei', `Groei winst per aandeel (${nTekst} jaar)`,
      'Op de lange termijn volgt de koers de winst per aandeel. Vanaf 10% per jaar alle punten, vanaf 3% de helft. Ook hier geldt: sterk afhankelijk van het startjaar.',
      wpaGroei != null ? `${plus(wpaGroei)}${pct(wpaGroei)}` : vanVerliesNaarWinst ? 'van verlies naar winst' : nogVerlies ? 'maakt verlies' : '—',
      wpaGroei != null ? trap(wpaGroei, 0.10, 0.03, 10) : vanVerliesNaarWinst ? 5 : nogVerlies ? 0 : null, 10),
  ])

  // — Waardering —
  // K/W op de GEREALISEERDE winst. De verwachte winst is een schatting van
  // analisten en die zijn structureel te optimistisch; die tonen we alleen ernaast.
  const pe = k.koersWinst
  const peVerwacht = k.koersWinstVerwacht != null && k.koersWinstVerwacht > 0 ? k.koersWinstVerwacht : null
  // Vrije kasstroom uit de jaarrekening: hetzelfde getal als in het tabblad
  // Jaarcijfers. Yahoo's eigen "free cashflow" gebruikt een andere definitie
  // en zat er soms ver naast (Microsoft: 3 mld i.p.v. 67 mld).
  const fcfJaar = t?.vrijeKasstroom ?? null
  const marktkapFin = k.marktkap != null && k.wisselkoers ? k.marktkap / k.wisselkoers : null
  const fcfRendement = deel(fcfJaar, marktkapFin)

  const waardering = cat('Waardering (is de prijs redelijk?)', [
    check('pe', 'Koers-winstverhouding (K/W)',
      'Hoeveel je betaalt voor elke euro winst van de afgelopen 12 maanden. K/W 20 betekent: je betaalt 20 keer de jaarwinst. Tot 15 alle punten, vanaf 30 geen, daartussen glijdend. Dit is een grove maat: snelgroeiende bedrijven zijn terecht duurder, en bij banken is een lage K/W normaal. Een goed bedrijf tegen een te hoge prijs kan toch een slechte belegging zijn.',
      pe == null ? (nogVerlies ? 'geen winst' : '—') : pe <= 0 ? 'geen winst' : `${nl(pe, 1)}${peVerwacht ? ` (analisten rekenen voor komend jaar op ${nl(peVerwacht, 1)})` : ''}`,
      pe == null ? (nogVerlies ? 0 : null) : pe <= 0 ? 0 : glijdend(pe, 15, 30, 10), 10),
    financieel
      ? check('fcfyield', 'Vrije-kasstroomrendement', 'Bij banken en verzekeraars niet bruikbaar.', nvt, null, 10)
      : check('fcfyield', 'Vrije-kasstroomrendement',
          'De vrije kasstroom van het laatste boekjaar gedeeld door de totale beurswaarde. Vergelijk het met rente op een spaarrekening: 5% betekent dat het bedrijf per jaar 5% van zijn beurswaarde aan vrij geld oplevert. Vanaf 5% alle punten, onder 2% geen, daartussen glijdend.',
          pct(fcfRendement), glijdend(fcfRendement, 0.05, 0.02, 10), 10),
  ])

  const categorieen = [kwaliteit, gezondheid, groei, waardering]
  const alle = categorieen.flatMap((c) => c.checks)
  const checksTotaal = alle.length
  const checksGeteld = alle.filter((c) => c.punten != null).length
  const basis = { categorieen, piotroski: f, soort, checksGeteld, checksTotaal }

  if (soort === 'vastgoed') {
    return {
      ...basis, oordeel: 'onbekend', score: null,
      samenvatting: [
        'Dit is een vastgoedfonds (REIT). De maatstaven van deze tool passen daar niet: winst wordt gedrukt door afschrijvingen, schuld hoort bij het bedrijfsmodel en groei komt uit nieuwe aandelen. Vastgoedfondsen worden beoordeeld op andere cijfers (kasstroom uit verhuur, bezettingsgraad, looptijd van de leningen).',
        'De checks hieronder staan er ter informatie, maar er volgt geen oordeel uit.',
      ],
    }
  }

  const punten = categorieen.reduce((a, c) => a + c.punten, 0)
  const max = categorieen.reduce((a, c) => a + c.max, 0)
  if (max < (financieel ? 40 : 50)) {
    return {
      ...basis, oordeel: 'onbekend', score: null,
      samenvatting: ['Te weinig jaarrekeningdata beschikbaar om dit aandeel eerlijk te beoordelen.'],
    }
  }

  const score = Math.round((100 * punten) / max)
  const ratio = (c: Categorie) => (c.max > 0 ? c.punten / c.max : null)
  // Een topbedrijf tegen een te hoge prijs is niet koopwaardig: de waardering
  // moet bekend zijn én minstens deels meewerken (meer dan een kwart van de punten).
  const waarderingOnbekend = waardering.max === 0
  const teDuur = (() => { const r = ratio(waardering); return r != null && r <= 0.25 })()
  // Lage K/W terwijl de koers ver onder zijn top staat: de markt verwacht
  // waarschijnlijk dat de winst gaat dalen (piekwinst). Dan is "goedkoop" schijn.
  const piekwinst = pe != null && pe > 0 && pe <= 15 && vanTop != null && vanTop < -0.30
  const beperkt = soort === 'bank' || soort === 'beperkt'
  const voldoet = score >= 70 && !teDuur && !waarderingOnbekend
  const oordeel: Oordeel = voldoet && !piekwinst && !beperkt ? 'kopen' : score >= 45 ? 'afwachten' : 'vermijden'
  const sterkBedrijf = (() => {
    const a = kwaliteit.punten + gezondheid.punten + groei.punten
    const b = kwaliteit.max + gezondheid.max + groei.max
    return b > 0 ? a / b : 0
  })()

  const kort = (c: Check) => c.label.replace(/ \(.*\)$/, '').toLowerCase()
  const sterk = alle.filter((c) => c.status === 'goed').map(kort)
  const zwak = alle.filter((c) => c.status === 'slecht').map(kort)
  const kop = checksGeteld < checksTotaal ? `Score ${score}/100 op ${checksGeteld} van de ${checksTotaal} checks` : `Score ${score}/100`

  const samenvatting: string[] = []
  if (oordeel === 'kopen') samenvatting.push(`${kop}: het bedrijf scoort sterk op de meeste punten en de prijs is volgens deze regels niet buitensporig.`)
  else if (voldoet && beperkt && soort === 'bank') samenvatting.push(`${kop}: de cijfers die we kunnen toetsen zien er goed uit, maar bij een bank of verzekeraar meten we maar de helft. Wat er echt toe doet (kapitaalbuffer, kwaliteit van de leningen, renteafhankelijkheid) zit niet in deze tool. Daarom hooguit Afwachten.`)
  else if (voldoet && beperkt) samenvatting.push(`${kop}: de cijfers zien er goed uit, maar voor dit soort bedrijf (nutsbedrijf of vermogensbeheerder) passen de maatstaven maar deels: hoge schuld en lage marges horen daar bij het model. Daarom hooguit Afwachten.`)
  else if (voldoet && piekwinst) samenvatting.push(`${kop}: op papier goedkoop, maar de koers staat ${pct(-(vanTop as number), 0)} onder zijn hoogste punt van het afgelopen jaar. Dat wijst erop dat beleggers verwachten dat de winst gaat dalen; een lage K/W is dan misleidend. Daarom Afwachten.`)
  else if (score >= 70 && waarderingOnbekend) samenvatting.push(`${kop}: het bedrijf scoort goed, maar de waardering is niet te bepalen. Zonder te weten of de prijs redelijk is, geen koopwaardig-oordeel.`)
  else if (sterkBedrijf >= 0.7 && teDuur) samenvatting.push(`${kop}: een sterk bedrijf, maar de koers is prijzig. Veel goed nieuws zit al in de prijs — gespreid instappen of wachten op een lagere koers is dan verstandiger dan alles in één keer kopen.`)
  else if (oordeel === 'afwachten') samenvatting.push(`${kop}: gemengd beeld — er zijn duidelijke pluspunten, maar ook zwakke plekken.`)
  else samenvatting.push(`${kop}: op te veel punten zwak om volgens deze regels koopwaardig te zijn voor de lange termijn.`)
  if (sterk.length) samenvatting.push(`Sterk: ${sterk.slice(0, 4).join(', ')}.`)
  if (zwak.length) samenvatting.push(`Zwak: ${zwak.slice(0, 4).join(', ')}.`)
  if (omzetSprong) samenvatting.push('Let op: de omzetcijfers van de databron maken een onverklaarbare sprong. De omzetgroei telt daarom niet mee; controleer de omzet in het jaarverslag.')
  if (t && jarenTussen(t.datum, new Date().toISOString().slice(0, 10)) > 1.35) samenvatting.push(`Let op: het laatste beschikbare boekjaar eindigde op ${datumNl(t.datum)}. De cijfers zijn dus meer dan een jaar oud.`)

  return { ...basis, oordeel, score, samenvatting }
}

// ─── Indicatoren op voltooide dag-candles ────────────────────
function smaReeks(v: number[], n: number): (number | null)[] {
  const out: (number | null)[] = new Array(v.length).fill(null)
  let som = 0
  for (let i = 0; i < v.length; i++) {
    som += v[i]
    if (i >= n) som -= v[i - n]
    if (i >= n - 1) out[i] = som / n
  }
  return out
}
// RSI en ATR met de afvlakking van Wilder: dezelfde methode als TradingView.
function rsi14(close: number[]): number | null {
  const n = 14
  if (close.length < n + 1) return null
  let winst = 0, verlies = 0
  for (let i = 1; i <= n; i++) {
    const d = close[i] - close[i - 1]
    if (d >= 0) winst += d; else verlies -= d
  }
  winst /= n; verlies /= n
  for (let i = n + 1; i < close.length; i++) {
    const d = close[i] - close[i - 1]
    winst = (winst * (n - 1) + Math.max(d, 0)) / n
    verlies = (verlies * (n - 1) + Math.max(-d, 0)) / n
  }
  if (verlies === 0) return 100
  return 100 - 100 / (1 + winst / verlies)
}
function atr14(c: DagCandle[]): number | null {
  const n = 14
  if (c.length < n + 1) return null
  const tr = (i: number) => Math.max(c[i].high - c[i].low, Math.abs(c[i].high - c[i - 1].close), Math.abs(c[i].low - c[i - 1].close))
  let atr = 0
  for (let i = 1; i <= n; i++) atr += tr(i)
  atr /= n
  for (let i = n + 1; i < c.length; i++) atr = (atr * (n - 1) + tr(i)) / n
  return atr
}

export interface Indicatoren {
  slot: number
  slotDatum: string
  sma20: number | null
  sma50: number | null
  sma200: number | null
  rsi: number | null
  atr: number | null
  hoog52: number | null
  hoog52Datum: string | null
  laag52: number | null
  laag52Datum: string | null
  rendement1m: Rendement | null
  rendement3m: Rendement | null
  rendement12m: Rendement | null
  momentum12_1: Rendement | null
}
// Elk rendement mét begin- en eindkoers + datum: narekenbaar in TradingView.
export interface Rendement { pct: number; vanDatum: string; vanKoers: number; totDatum: string; totKoers: number }

// Kalenderdatum N maanden vóór een ISO-datum. Een vast aantal koersdagen (252)
// klopt niet per beurs: Amsterdam telt er ±256 per jaar, Tokio ±245.
function maandenTerug(iso: string, maanden: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  const dag = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() - maanden)
  const laatste = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(dag, laatste))
  return d.toISOString().slice(0, 10)
}
// Laatste candle op of vóór een datum.
function candleOp(c: DagCandle[], datum: string): DagCandle | null {
  for (let i = c.length - 1; i >= 0; i--) if (c[i].date <= datum) return c[i]
  return null
}
function rendement(c: DagCandle[], vanMaanden: number, totMaanden = 0): Rendement | null {
  const slotDatum = c[c.length - 1].date
  const a = candleOp(c, maandenTerug(slotDatum, vanMaanden))
  const b = totMaanden === 0 ? c[c.length - 1] : candleOp(c, maandenTerug(slotDatum, totMaanden))
  if (!a || !b || !a.close || a.date >= b.date) return null
  return { pct: b.close / a.close - 1, vanDatum: a.date, vanKoers: a.close, totDatum: b.date, totKoers: b.close }
}

export function berekenIndicatoren(c: DagCandle[]): Indicatoren | null {
  if (c.length < 30) return null
  const close = c.map((x) => x.close)
  const i = c.length - 1
  const grens = maandenTerug(c[i].date, 12)
  const jaar = c.filter((x) => x.date > grens)
  const hoog = jaar.reduce((a, x) => (x.high > a.high ? x : a), jaar[0])
  const laag = jaar.reduce((a, x) => (x.low < a.low ? x : a), jaar[0])
  // Alleen "52 weken" noemen als er ook echt (bijna) een jaar historie is.
  const heeftJaar = c[0].date <= maandenTerug(c[i].date, 11)
  return {
    slot: c[i].close, slotDatum: c[i].date,
    sma20: smaReeks(close, 20)[i], sma50: smaReeks(close, 50)[i], sma200: smaReeks(close, 200)[i],
    rsi: rsi14(close), atr: atr14(c),
    hoog52: heeftJaar ? hoog.high : null, hoog52Datum: heeftJaar ? hoog.date : null,
    laag52: heeftJaar ? laag.low : null, laag52Datum: heeftJaar ? laag.date : null,
    rendement1m: rendement(c, 1), rendement3m: rendement(c, 3),
    rendement12m: heeftJaar ? rendement(c, 12) : null,
    momentum12_1: heeftJaar ? rendement(c, 12, 1) : null,
  }
}

// ─── KORTE TERMIJN ───────────────────────────────────────────
export interface Handelsplan {
  instap: number
  instapDatum: string
  stop: number
  stopPct: number
  doel: number
  doelPct: number
  atr: number
  uitleg: string[]
}
export interface KorteTermijn {
  oordeel: Oordeel
  score: number | null
  samenvatting: string[]
  checks: Check[]
  plan: Handelsplan | null // alleen bij een instapsignaal
  koopzone: number | null // bij oververhitting: wacht op terugval hierheen (20-daags gemiddelde)
  indicatoren: Indicatoren | null
}

// Aantal kalenderdagen tot de kwartaalcijfers (0 = vandaag), op hele dagen.
function dagenTot(datum: string): number {
  const vandaag = new Date().toISOString().slice(0, 10)
  return Math.round((Date.parse(datum) - Date.parse(vandaag)) / 86400000)
}

export function analyseKorteTermijn(c: DagCandle[], valuta: string, cijfersDatum: string | null, toets: Toets | null): KorteTermijn {
  const ind = berekenIndicatoren(c)
  if (!ind || ind.sma200 == null || ind.sma50 == null) {
    return {
      oordeel: 'onbekend', score: null, checks: [], plan: null, koopzone: null, indicatoren: ind,
      samenvatting: ['Te weinig koershistorie (minder dan 200 handelsdagen) voor een trendoordeel.'],
    }
  }
  const p = (v: number) => `${valuta} ${nl(v, 2)}`
  const { slot, sma20, sma50, sma200, rsi, atr } = ind
  const bovenSma200 = slot > sma200
  const bovenSma50 = slot > sma50
  const afstand200 = slot / sma200 - 1
  const vanTop = ind.hoog52 ? slot / ind.hoog52 - 1 : null
  const rnd = (r: Rendement | null) =>
    r ? `${plus(r.pct)}${pct(r.pct)} (${p(r.vanKoers)} op ${datumNl(r.vanDatum)} → ${p(r.totKoers)} op ${datumNl(r.totDatum)})` : '—'

  const checks: Check[] = [
    check('trend200', 'Koers boven het 200-daags gemiddelde',
      'Het 200-daags gemiddelde is de gemiddelde slotkoers van de laatste ±10 maanden. Staat de koers erboven, dan is de lange trend omhoog. Dit is een risicofilter: het houdt je uit langdurige dalingen, maar het verhoogt het rendement meestal niet. Onderaan deze pagina zie je hoe het op dit aandeel uitpakte.',
      `${p(slot)} tegenover ${p(sma200)} (${plus(afstand200)}${pct(afstand200)})`, bovenSma200 ? 25 : 0, 25),
    check('gouden', '50-daags boven 200-daags gemiddelde',
      'Als het kortere gemiddelde boven het langere ligt, is de trend van de laatste maanden sterker dan die van het afgelopen jaar ("golden cross"). Andersom ("death cross") is de trend aan het keren.',
      `${p(sma50)} tegenover ${p(sma200)}`, sma50 > sma200 ? 15 : 0, 15),
    check('trend50', 'Koers boven het 50-daags gemiddelde',
      'Het 50-daags gemiddelde laat de trend van de laatste ±2,5 maand zien. Staat de koers eronder, dan is het aandeel de laatste weken aan het zakken, ook als de lange trend nog omhoog is. Zonder deze check geen instapsignaal.',
      `${p(slot)} tegenover ${p(sma50)}`, bovenSma50 ? 10 : 0, 10),
    check('momentum', 'Momentum 12 maanden (laatste maand niet meegeteld)',
      'Aandelen die het afgelopen jaar goed deden, bleven in onderzoek gemiddeld nog enkele maanden beter presteren (Jegadeesh & Titman, 1993). Meer dan +10% geeft alle punten, positief de helft. Kanttekening: dat onderzoek ging over mandjes van honderden aandelen die 3 tot 12 maanden werden vastgehouden, niet over één aandeel voor een paar weken.',
      rnd(ind.momentum12_1), ind.momentum12_1 ? (ind.momentum12_1.pct > 0.10 ? 15 : ind.momentum12_1.pct > 0 ? 7.5 : 0) : null, 15),
    check('kwartaal', 'Rendement laatste 3 maanden',
      'Bevestigt of de beweging nog loopt of juist stilvalt. Positief geeft de punten.',
      rnd(ind.rendement3m), ind.rendement3m ? (ind.rendement3m.pct > 0 ? 10 : 0) : null, 10),
    check('rsi', 'RSI (14 dagen): niet oververhit, niet in vrije val',
      'De RSI (0–100) meet hoe hard de koers de laatste weken is gestegen of gedaald. Tussen 40 en 65 alle punten. Boven 70 noemen we het aandeel oververhit: geen instap, en geen punten. Tussen 65 en 70 de helft. Onder 40 ook de helft, omdat het aandeel dan juist hard daalt. Dit is een vuistregel uit de praktijk, geen onderzocht patroon.',
      rsi == null ? '—' : nl(rsi, 0),
      rsi == null ? null : rsi > 70 ? 0 : rsi > 65 ? 7.5 : rsi >= 40 ? 15 : 7.5, 15),
    check('top', 'Afstand tot hoogste koers van 52 weken',
      'Sterke aandelen staan dicht bij hun jaartop. Binnen 10% van de top alle punten, binnen 20% de helft. Een aandeel dat ver onder zijn top staat is niet vanzelf "goedkoop": de markt verkoopt het om een reden.',
      vanTop == null || ind.hoog52 == null ? '—' : `${pct(vanTop)} (top ${p(ind.hoog52)} op ${datumNl(ind.hoog52Datum)})`,
      vanTop == null ? null : vanTop >= -0.10 ? 10 : vanTop >= -0.20 ? 5 : 0, 10),
  ]
  const c0 = cat('', checks)
  const score = c0.max > 0 ? Math.round((100 * c0.punten) / c0.max) : null

  const oververhit = rsi != null && rsi > 70
  const dagenCijfers = cijfersDatum ? dagenTot(cijfersDatum) : null
  const cijfersDichtbij = dagenCijfers != null && dagenCijfers >= 0 && dagenCijfers <= 14
  const maand = ind.rendement1m
  let oordeel: Oordeel
  const samenvatting: string[] = []
  if (!bovenSma200) {
    oordeel = 'vermijden'
    samenvatting.push(`De koers (${p(slot)}) staat ${afstand200 > -0.02 ? 'net ' : ''}onder het 200-daags gemiddelde (${p(sma200)}): ${afstand200 > -0.02 ? 'de trend staat op de grens en is volgens de regel niet meer omhoog' : 'de trend is omlaag'}. Geen nieuwe korte trade. Wie al een korte trade heeft lopen, heeft volgens deze regel geen reden meer om te blijven zitten.`)
  } else if (oververhit) {
    oordeel = 'afwachten'
    samenvatting.push(`De trend is omhoog, maar het aandeel is hard opgelopen (RSI ${nl(rsi as number, 0)}). Nu instappen is achter de koers aan rennen — wacht op een terugval${sma20 ? ` richting het 20-daags gemiddelde (${p(sma20)})` : ''}.`)
  } else if (!bovenSma50) {
    oordeel = 'afwachten'
    samenvatting.push(`Score ${score}/100: de lange trend is nog omhoog, maar de koers (${p(slot)}) is onder het 50-daags gemiddelde (${p(sma50)}) gezakt${maand ? ` en staat ${plus(maand.pct)}${pct(maand.pct)} sinds ${datumNl(maand.vanDatum)}` : ''}. De laatste weken daalt het aandeel dus. Wachten tot de koers weer boven het 50-daags gemiddelde sluit.`)
  } else if (score != null && score >= 70 && cijfersDichtbij) {
    oordeel = 'afwachten'
    samenvatting.push(`Score ${score}/100: de trend klopt, maar op ${datumNl(cijfersDatum)} komen de kwartaalcijfers. Rond cijfers kan de koers in één nacht 5–15% verspringen, dwars door je stop-loss heen. Wachten tot na de cijfers.`)
  } else if (score != null && score >= 70) {
    oordeel = 'kopen'
    const mee = checks.filter((x) => x.status === 'goed').length
    samenvatting.push(`Score ${score}/100: de koers staat boven het 200- en het 50-daags gemiddelde en is niet oververhit; ${mee} van de ${checks.length} checks staan op groen.`)
  } else {
    oordeel = 'afwachten'
    const mis = checks.filter((x) => x.status === 'slecht').map((x) => x.label.replace(/ \(.*\)$/, '').replace(/:.*$/, '').toLowerCase())
    samenvatting.push(`Score ${score}/100: de koers staat boven het 200-daags gemiddelde, maar het beeld is nog niet sterk genoeg voor een instap${mis.length ? ` (zwak: ${mis.slice(0, 3).join(', ')})` : ''}.`)
  }

  if (cijfersDichtbij && oordeel === 'vermijden') {
    samenvatting.push(`Let op: kwartaalcijfers op ${datumNl(cijfersDatum)}. Rond cijfers kan de koers in één nacht 5–15% verspringen.`)
  }
  // De uitkomst van de historische toets hoort bij het oordeel, niet onderaan de pagina.
  if (toets && oordeel !== 'vermijden') {
    const meer = toets.regel.totaal > toets.kopenHouden.totaal
    const rem = Math.abs(toets.regel.maxVerlies) < Math.abs(toets.kopenHouden.maxVerlies) - 0.05
    samenvatting.push(
      `Ter relativering: het 200-daags filter leverde op dit aandeel de afgelopen ${nl(toets.jaren, 0)} jaar ${plus(toets.regel.totaal)}${pct(toets.regel.totaal, 0)} op, tegenover ${plus(toets.kopenHouden.totaal)}${pct(toets.kopenHouden.totaal, 0)} bij gewoon vasthouden. ${
        meer ? 'Hier werkte het filter dus beter.' : rem ? 'Minder rendement, wel een kleinere grootste daling.' : 'Hier werkte het filter dus niet: minder rendement en nauwelijks bescherming.'}`,
    )
  }

  let plan: Handelsplan | null = null
  if (oordeel === 'kopen' && atr != null && atr > 0) {
    const stop = slot - 2 * atr
    const doel = slot + 3 * atr
    plan = {
      instap: slot, instapDatum: ind.slotDatum,
      stop, stopPct: stop / slot - 1, doel, doelPct: doel / slot - 1, atr,
      uitleg: [
        `De ATR (${p(atr)}) is de gemiddelde dagelijkse koersbeweging van de laatste weken. De stop-loss ligt 2× ATR onder de instap, zodat normale schommelingen je er niet uit gooien. Het doel ligt 3× ATR erboven: de mogelijke winst is 1,5× het risico.`,
        'Eerlijk over het bewijs: dit plan is niet getoetst. Als koersen puur willekeurig bewegen, wordt het doel in 40% van de gevallen eerder geraakt dan de stop, en is het resultaat over veel trades nul — vóór kosten. Het plan verdient alleen geld als de trend je meer dan die 40% oplevert, en dat hebben wij niet aangetoond. Het plan beperkt vooral je verlies per trade.',
        'In de praktijk: je koopt op de opening van de volgende handelsdag, niet op het getoonde slot; schuif stop en doel mee met je echte instapkoers. Een stop-loss is geen garantie: bij slecht nieuws kan de koers lager openen dan je stop. Reken op 0,2–0,7% kosten per retourtje (transactiekosten, spread en bij Amerikaanse aandelen valutakosten). Is na 20 handelsdagen stop noch doel geraakt, sluit de trade dan.',
      ],
    }
  }

  return { oordeel, score, samenvatting, checks, plan, koopzone: oververhit ? sma20 : null, indicatoren: ind }
}

// ─── Historische toets van het trendfilter op dít aandeel ────
// Regel: signaal op het slot van dag t (slot boven het 200-daags gemiddelde,
// dezelfde ongecorrigeerde reeks als het oordeel). Je kunt daar pas ná dat slot
// op handelen, dus de positie gaat in op het slot van dag t+1 en levert het
// rendement van t+1 naar t+2. Rendementen op dividend-gecorrigeerde koersen.
// Zonder transactiekosten en belasting; cash levert 0% op.
export interface Toets {
  van: string
  tot: string
  jaren: number
  vanKoers: number // dividend-gecorrigeerd
  totKoers: number
  regel: { totaal: number; perJaar: number; maxVerlies: number }
  kopenHouden: { totaal: number; perJaar: number; maxVerlies: number }
  pctBelegd: number
  wissels: number
}

export function toetsTrendfilter(c: DagCandle[]): Toets | null {
  if (c.length < 200 + 252) return null
  const a = c.map((x) => x.adj)
  const sma = smaReeks(c.map((x) => x.close), 200)
  const start = 200 // eerste dag waarop een signaal van de dag ervoor bestaat
  let eqR = 1, eqB = 1, piekR = 1, piekB = 1, ddR = 0, ddB = 0, belegd = 0, wissels = 0, dagen = 0
  let vorige: boolean | null = null
  for (let i = start; i < a.length - 1; i++) {
    if (!a[i]) continue
    const r = a[i + 1] / a[i] - 1
    const pos = c[i - 1].close > (sma[i - 1] as number)
    if (vorige != null && pos !== vorige) wissels++
    vorige = pos
    if (pos) { eqR *= 1 + r; belegd++ }
    eqB *= 1 + r
    dagen++
    piekR = Math.max(piekR, eqR); ddR = Math.min(ddR, eqR / piekR - 1)
    piekB = Math.max(piekB, eqB); ddB = Math.min(ddB, eqB / piekB - 1)
  }
  const jaren = jarenTussen(c[start].date, c[c.length - 1].date)
  if (jaren <= 0 || dagen === 0) return null
  return {
    van: c[start].date, tot: c[c.length - 1].date, jaren,
    vanKoers: a[start], totKoers: a[a.length - 1],
    regel: { totaal: eqR - 1, perJaar: Math.pow(eqR, 1 / jaren) - 1, maxVerlies: ddR },
    kopenHouden: { totaal: eqB - 1, perJaar: Math.pow(eqB, 1 / jaren) - 1, maxVerlies: ddB },
    pctBelegd: belegd / dagen, wissels,
  }
}

// Reeks voor de grafiek (laatste ±2 jaar) met de twee gemiddelden.
export interface GrafiekPunt { d: string; c: number; s50: number | null; s200: number | null }
export function grafiekReeks(c: DagCandle[], aantal = 504): GrafiekPunt[] {
  const close = c.map((x) => x.close)
  const s50 = smaReeks(close, 50), s200 = smaReeks(close, 200)
  const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100)
  return c.map((x, i) => ({ d: x.date, c: x.close, s50: r2(s50[i]), s200: r2(s200[i]) })).slice(-aantal)
}
