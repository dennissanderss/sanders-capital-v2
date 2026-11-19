// ─────────────────────────────────────────────────────────────
// Sanders Capital — Aandelen Analyzer: scoreregels
//
// Twee losse oordelen, bewust gescheiden:
//
//   LANGE TERMIJN (jaren) — kijkt naar het BEDRIJF: kwaliteit, financiële
//   gezondheid, groei en waardering. Bouwstenen uit de literatuur:
//   Piotroski F-score (2000), kwaliteit/winstgevendheid (Novy-Marx 2013),
//   waardering (Fama & French 1992).
//
//   KORTE TERMIJN (dagen–weken) — kijkt naar de KOERS: trend en momentum.
//   Bouwstenen: 200-daags trendfilter (Faber 2007) en 12-1-momentum
//   (Jegadeesh & Titman 1993).
//
// Alles is regelgebaseerd en narekenbaar: elke check toont zijn waarde,
// drempel en punten. Geen enkele regel garandeert rendement.
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

// ─── Kerncijfers (uit quoteSummary, met terugval op jaarrekening) ───
export interface Kern {
  koers: number | null
  marktkap: number | null // in koers-valuta (hoofdeenheid)
  wisselkoers: number | null // jaarrekening-valuta → koers-valuta
  koersWinst: number | null // P/E over de afgelopen 12 maanden
  koersWinstVerwacht: number | null // P/E op verwachte winst
  koersBoek: number | null
  ebitda: number | null
  schuld: number | null
  cash: number | null
  vrijeKasstroom: number | null
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
    { label: 'Rendement op activa gestegen', ok: beter(roa(t), roa(v)) },
    { label: 'Kasstroom hoger dan nettowinst (winst is "echt geld")', ok: beter(t.operationeleKasstroom, t.nettowinst) },
    { label: 'Langlopende schuld t.o.v. activa gedaald', ok: (() => { const a = hefboom(t), b = hefboom(v); return a == null || b == null ? null : a <= b })() },
    { label: 'Liquiditeit (current ratio) verbeterd', ok: beter(current(t), current(v)) },
    { label: 'Geen nieuwe aandelen uitgegeven', ok: t.aandelen == null || v.aandelen == null ? null : t.aandelen <= v.aandelen * 1.005 },
    { label: 'Brutomarge gestegen', ok: beter(marge(t), marge(v)) },
    { label: 'Omloopsnelheid activa gestegen', ok: beter(omloop(t), omloop(v)) },
  ]
  const getoetst = punten.filter((p) => p.ok != null).length
  if (getoetst < 6) return null
  return { score: punten.filter((p) => p.ok === true).length, getoetst, punten }
}

function cagr(eerste: number | null, laatste: number | null, jaren: number): number | null {
  if (eerste == null || laatste == null || jaren <= 0 || eerste <= 0 || laatste <= 0) return null
  return Math.pow(laatste / eerste, 1 / jaren) - 1
}

// ─── LANGE TERMIJN ───────────────────────────────────────────
export interface LangeTermijn {
  oordeel: Oordeel
  score: number | null // 0–100
  samenvatting: string[]
  categorieen: Categorie[]
  piotroski: Piotroski | null
}

export function analyseLangeTermijn(jaren: JaarRij[], k: Kern, sector: string | null): LangeTermijn {
  const financieel = sector === 'Financial Services'
  const nvt = 'n.v.t. (bank/verzekeraar)'
  const t = jaren[jaren.length - 1] as JaarRij | undefined
  const eerste = jaren[0] as JaarRij | undefined
  const n = jaren.length - 1
  const f = piotroski(jaren)

  // — Kwaliteit —
  const kapitaal = t ? (t.geinvesteerdKapitaal ?? (t.eigenVermogen != null && t.schuld != null ? t.eigenVermogen + t.schuld : null)) : null
  const roic = t && t.ebit != null ? deel(t.ebit * 0.75, kapitaal) : null
  const roe = t ? deel(t.nettowinst, t.eigenVermogen) : null
  const opMarge = t ? deel(t.bedrijfsresultaat, t.omzet) : null
  const fcfJaren = jaren.filter((j) => j.vrijeKasstroom != null)
  const fcfPos = fcfJaren.filter((j) => (j.vrijeKasstroom as number) > 0).length

  const kwaliteit = cat('Kwaliteit van het bedrijf', [
    financieel
      ? check('roe', 'Rendement op eigen vermogen (ROE)',
          'Hoeveel winst het bedrijf maakt met het geld van de aandeelhouders. Bij banken en verzekeraars is dit dé maatstaf; boven 12% is sterk.',
          pct(roe), trap(roe, 0.12, 0.08, 10), 10)
      : check('roic', 'Rendement op geïnvesteerd kapitaal (ROIC)',
          'Hoeveel winst het bedrijf maakt op elke euro die erin gestoken is (eigen geld + leningen). Boven 15% wijst op een sterk bedrijf met een concurrentievoordeel; onder 8% verdient het nauwelijks meer dan het geld kost.',
          pct(roic), trap(roic, 0.15, 0.08, 10), 10),
    financieel
      ? check('marge', 'Operationele marge', 'Bij banken en verzekeraars is deze maatstaf niet vergelijkbaar.', nvt, null, 10)
      : check('marge', 'Operationele marge',
          'Welk deel van elke euro omzet overblijft als winst uit de gewone bedrijfsvoering. Hoge marges (15%+) betekenen prijszettingsmacht; lage marges maken een bedrijf kwetsbaar bij tegenwind. Verschilt wel sterk per sector (supermarkten zitten structureel laag).',
          pct(opMarge), trap(opMarge, 0.15, 0.05, 10), 10),
    financieel
      ? check('fcf', 'Vrije kasstroom', 'Bij banken en verzekeraars zegt de vrije kasstroom weinig.', nvt, null, 10)
      : check('fcf', 'Vrije kasstroom elk jaar positief',
          'Vrije kasstroom is het geld dat écht overblijft nadat alle rekeningen en investeringen zijn betaald. Winst kan boekhoudkundig zijn; kasstroom is geld op de bank. Een bedrijf dat elk jaar geld overhoudt hoeft niet te lenen om te overleven.',
          fcfJaren.length === 0 ? '—' : `${fcfPos} van ${fcfJaren.length} jaar positief`,
          fcfJaren.length === 0 ? null : fcfPos === fcfJaren.length ? 10 : fcfPos >= fcfJaren.length - 1 && fcfJaren.length > 1 ? 5 : 0, 10),
    financieel
      ? check('piotroski', 'Piotroski F-score', 'Deze boekhoudtoets is ontworpen voor gewone bedrijven en werkt niet voor banken en verzekeraars.', nvt, null, 10)
      : check('piotroski', 'Piotroski F-score',
      'Negen simpele ja/nee-vragen over winst, kasstroom, schuld en efficiëntie (professor Piotroski, 2000). Hoe meer ja, hoe gezonder de boekhouding zich ontwikkelt. 7 of hoger is sterk, 3 of lager is een waarschuwing.',
      f ? `${f.score} van ${f.getoetst}` : '—',
      f ? trap(f.score / f.getoetst, 0.75, 0.45, 10) : null, 10),
  ])

  // — Financiële gezondheid —
  const nettoSchuld = k.schuld != null && k.cash != null ? k.schuld - k.cash : t && t.schuld != null && t.cash != null ? t.schuld - t.cash : null
  const ebitda = k.ebitda ?? t?.ebit ?? null
  const schuldRatio = nettoSchuld == null ? null : nettoSchuld <= 0 ? 0 : ebitda != null && ebitda > 0 ? nettoSchuld / ebitda : null
  const aandelenGroei = eerste && t && n > 0 ? cagr(eerste.aandelen, t.aandelen, n) : null

  const gezondheid = cat('Financiële gezondheid', [
    financieel
      ? check('schuld', 'Nettoschuld t.o.v. EBITDA', 'Bij banken is schuld het bedrijfsmodel (spaargeld is "schuld"); deze maatstaf werkt daar niet.', nvt, null, 10)
      : check('schuld', 'Nettoschuld t.o.v. EBITDA',
          'Hoeveel jaar het bedrijf nodig heeft om zijn schuld (na aftrek van cash) af te lossen uit de operationele winst. Onder 1 is heel veilig, boven 3 wordt het risicovol — zeker als de rente stijgt of de winst daalt.',
          nettoSchuld == null ? '—' : nettoSchuld <= 0 ? 'meer cash dan schuld' : schuldRatio == null ? '—' : `${nl(schuldRatio, 1)}×`,
          schuldRatio == null ? (nettoSchuld != null && ebitda != null && ebitda <= 0 ? 0 : null) : schuldRatio < 1 ? 10 : schuldRatio < 3 ? 5 : 0, 10),
    check('verwatering', 'Aantal aandelen',
      'Als een bedrijf steeds nieuwe aandelen uitgeeft, wordt jouw stukje van de taart kleiner (verwatering). Koopt het juist eigen aandelen in, dan wordt jouw stukje groter zonder dat je iets hoeft te doen.',
      aandelenGroei == null ? '—' : `${aandelenGroei > 0 ? '+' : ''}${pct(aandelenGroei)} per jaar`,
      aandelenGroei == null ? null : aandelenGroei <= 0.002 ? 10 : aandelenGroei <= 0.02 ? 5 : 0, 10),
  ])

  // — Groei —
  const omzetGroei = eerste && t && n > 0 ? cagr(eerste.omzet, t.omzet, n) : null
  const wpaGroei = eerste && t && n > 0 ? cagr(eerste.wpa, t.wpa, n) : null
  const vanVerliesNaarWinst = !!(eerste && t && eerste.wpa != null && t.wpa != null && eerste.wpa <= 0 && t.wpa > 0)
  const nogVerlies = !!(t && t.wpa != null && t.wpa <= 0)

  const groei = cat('Groei', [
    check('omzetgroei', `Omzetgroei per jaar (${n > 0 ? n : '?'} jaar)`,
      'Groeit het bedrijf? Zonder omzetgroei kan de winst alleen stijgen door te bezuinigen, en dat houdt een keer op. 10%+ per jaar is sterk; krimp is een waarschuwing.',
      omzetGroei == null ? '—' : `${omzetGroei > 0 ? '+' : ''}${pct(omzetGroei)}`,
      trap(omzetGroei, 0.10, 0.03, 10), 10),
    check('winstgroei', `Groei winst per aandeel (${n > 0 ? n : '?'} jaar)`,
      'Op de lange termijn volgt de koers de winst per aandeel. Dit is uiteindelijk waar je als aandeelhouder voor betaalt.',
      wpaGroei != null ? `${wpaGroei > 0 ? '+' : ''}${pct(wpaGroei)}` : vanVerliesNaarWinst ? 'van verlies naar winst' : nogVerlies ? 'maakt verlies' : '—',
      wpaGroei != null ? trap(wpaGroei, 0.10, 0.03, 10) : vanVerliesNaarWinst ? 5 : nogVerlies ? 0 : null, 10),
  ])

  // — Waardering —
  const pe = k.koersWinstVerwacht != null && k.koersWinstVerwacht > 0 ? k.koersWinstVerwacht : k.koersWinst
  const peLabel = k.koersWinstVerwacht != null && k.koersWinstVerwacht > 0 ? 'verwachte winst' : 'winst afgelopen 12 mnd'
  const fcfTtm = k.vrijeKasstroom ?? t?.vrijeKasstroom ?? null
  const marktkapFin = k.marktkap != null && k.wisselkoers ? k.marktkap / k.wisselkoers : null
  const fcfRendement = deel(fcfTtm, marktkapFin)

  const waardering = cat('Waardering (is de prijs redelijk?)', [
    check('pe', 'Koers-winstverhouding (K/W)',
      'Hoeveel je betaalt voor elke euro winst. K/W 20 betekent: je betaalt 20 keer de jaarwinst. Onder 15 is goedkoop, boven 25 is duur — tenzij het bedrijf hard groeit. Een goed bedrijf tegen een te hoge prijs kan toch een slechte belegging zijn.',
      pe == null ? (nogVerlies ? 'geen winst' : '—') : pe <= 0 ? 'geen winst' : `${nl(pe, 1)} (op ${peLabel})`,
      pe == null ? (nogVerlies ? 0 : null) : pe <= 0 ? 0 : pe <= 15 ? 10 : pe <= 25 ? 5 : 0, 10),
    financieel
      ? check('fcfyield', 'Vrije-kasstroomrendement', 'Bij banken en verzekeraars niet bruikbaar.', nvt, null, 10)
      : check('fcfyield', 'Vrije-kasstroomrendement',
          'Vrije kasstroom gedeeld door de totale beurswaarde. Vergelijk het met rente op een spaarrekening: 5% betekent dat het bedrijf per jaar 5% van zijn beurswaarde aan vrij geld oplevert. Hoe hoger, hoe meer waar voor je geld.',
          pct(fcfRendement), trap(fcfRendement, 0.05, 0.025, 10), 10),
  ])

  const categorieen = [kwaliteit, gezondheid, groei, waardering]
  const punten = categorieen.reduce((a, c) => a + c.punten, 0)
  const max = categorieen.reduce((a, c) => a + c.max, 0)

  if (max < 50) {
    return {
      oordeel: 'onbekend', score: null, categorieen, piotroski: f,
      samenvatting: ['Te weinig jaarrekeningdata beschikbaar om dit aandeel eerlijk te beoordelen.'],
    }
  }

  const score = Math.round((100 * punten) / max)
  const ratio = (c: Categorie) => (c.max > 0 ? c.punten / c.max : null)
  // Een topbedrijf tegen een te hoge prijs is geen koop: 'kopen' vereist
  // dat de waardering minstens deels meewerkt (meer dan een kwart van de punten).
  const teDuur = (() => { const r = ratio(waardering); return r != null && r <= 0.25 })()
  const oordeel: Oordeel = score >= 70 && !teDuur ? 'kopen' : score >= 45 ? 'afwachten' : 'vermijden'
  const sterkBedrijf = (() => {
    const a = kwaliteit.punten + gezondheid.punten + groei.punten
    const b = kwaliteit.max + gezondheid.max + groei.max
    return b > 0 ? a / b : 0
  })()

  const alle = categorieen.flatMap((c) => c.checks)
  const sterk = alle.filter((c) => c.status === 'goed').map((c) => c.label.replace(/ \(.*\)$/, '').toLowerCase())
  const zwak = alle.filter((c) => c.status === 'slecht').map((c) => c.label.replace(/ \(.*\)$/, '').toLowerCase())

  const samenvatting: string[] = []
  if (oordeel === 'kopen') samenvatting.push(`Score ${score}/100: het bedrijf scoort sterk op de meeste punten en de prijs is niet buitensporig.`)
  else if (sterkBedrijf >= 0.7 && teDuur) samenvatting.push(`Score ${score}/100: een sterk bedrijf, maar de koers is prijzig. Veel goed nieuws zit al in de prijs — gespreid instappen of wachten op een lagere koers is dan verstandiger dan alles in één keer kopen.`)
  else if (oordeel === 'afwachten') samenvatting.push(`Score ${score}/100: gemengd beeld — er zijn duidelijke pluspunten, maar ook zwakke plekken.`)
  else samenvatting.push(`Score ${score}/100: op te veel punten zwak om nu als langetermijnbelegging te kopen.`)
  if (sterk.length) samenvatting.push(`Sterk: ${sterk.slice(0, 4).join(', ')}.`)
  if (zwak.length) samenvatting.push(`Zwak: ${zwak.slice(0, 4).join(', ')}.`)
  if (financieel) samenvatting.push('Let op: dit is een bank of verzekeraar. Een deel van de checks is daar niet bruikbaar, dus de score rust op minder punten.')

  return { oordeel, score, samenvatting, categorieen, piotroski: f }
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
  if (c.length < 15) return null
  let som = 0
  for (let i = c.length - 14; i < c.length; i++) {
    som += Math.max(c[i].high - c[i].low, Math.abs(c[i].high - c[i - 1].close), Math.abs(c[i].low - c[i - 1].close))
  }
  return som / 14
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

function rendement(c: DagCandle[], vanTerug: number, totTerug = 0): Rendement | null {
  const a = c[c.length - 1 - vanTerug], b = c[c.length - 1 - totTerug]
  if (!a || !b || !a.close) return null
  return { pct: b.close / a.close - 1, vanDatum: a.date, vanKoers: a.close, totDatum: b.date, totKoers: b.close }
}

export function berekenIndicatoren(c: DagCandle[]): Indicatoren | null {
  if (c.length < 30) return null
  const close = c.map((x) => x.close)
  const i = c.length - 1
  const jaar = c.slice(-252)
  const hoog = jaar.reduce((a, x) => (x.high > a.high ? x : a), jaar[0])
  const laag = jaar.reduce((a, x) => (x.low < a.low ? x : a), jaar[0])
  return {
    slot: c[i].close, slotDatum: c[i].date,
    sma20: smaReeks(close, 20)[i], sma50: smaReeks(close, 50)[i], sma200: smaReeks(close, 200)[i],
    rsi: rsi14(close), atr: atr14(c),
    hoog52: hoog.high, hoog52Datum: hoog.date, laag52: laag.low, laag52Datum: laag.date,
    rendement1m: rendement(c, 21), rendement3m: rendement(c, 63), rendement12m: rendement(c, 252),
    momentum12_1: rendement(c, 252, 21),
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
  koopzone: number | null // bij 'afwachten' wegens oververhitting: wacht op terugval hierheen
  uitleg: string
}
export interface KorteTermijn {
  oordeel: Oordeel
  score: number | null
  samenvatting: string[]
  checks: Check[]
  plan: Handelsplan | null
  indicatoren: Indicatoren | null
}

export function analyseKorteTermijn(c: DagCandle[], valuta: string, cijfersDatum: string | null): KorteTermijn {
  const ind = berekenIndicatoren(c)
  if (!ind || ind.sma200 == null || ind.sma50 == null) {
    return {
      oordeel: 'onbekend', score: null, checks: [], plan: null, indicatoren: ind,
      samenvatting: ['Te weinig koershistorie (minder dan 200 handelsdagen) voor een trendoordeel.'],
    }
  }
  const p = (v: number) => `${valuta} ${nl(v, 2)}`
  const { slot, sma20, sma50, sma200, rsi, atr } = ind
  const bovenSma200 = slot > sma200
  const afstand200 = slot / sma200 - 1
  const vanTop = ind.hoog52 ? slot / ind.hoog52 - 1 : null
  const rnd = (r: Rendement | null) =>
    r ? `${r.pct > 0 ? '+' : ''}${pct(r.pct)} (${p(r.vanKoers)} op ${datumNl(r.vanDatum)} → ${p(r.totKoers)} op ${datumNl(r.totDatum)})` : '—'

  const checks: Check[] = [
    check('trend200', 'Koers boven het 200-daags gemiddelde',
      'Het 200-daags gemiddelde is de gemiddelde slotkoers van de laatste ±10 maanden. Staat de koers erboven, dan is de lange trend omhoog. Dit is het belangrijkste filter: in een dalende trend kopen is "een vallend mes vangen".',
      `${p(slot)} vs ${p(sma200)} (${afstand200 > 0 ? '+' : ''}${pct(afstand200)})`, bovenSma200 ? 25 : 0, 25),
    check('gouden', '50-daags boven 200-daags gemiddelde',
      'Als het kortere gemiddelde boven het langere ligt, versnelt de trend omhoog (ook wel "golden cross" genoemd). Andersom ("death cross") is de trend aan het keren.',
      `${p(sma50)} vs ${p(sma200)}`, sma50 > sma200 ? 15 : 0, 15),
    check('trend50', 'Koers boven het 50-daags gemiddelde',
      'Het 50-daags gemiddelde laat de trend van de laatste ±2,5 maand zien. Een koers erboven betekent dat ook de korte trend meewerkt.',
      `${p(slot)} vs ${p(sma50)}`, slot > sma50 ? 10 : 0, 10),
    check('momentum', 'Momentum 12 maanden (laatste maand niet meegeteld)',
      'Aandelen die het afgelopen jaar goed deden, blijven gemiddeld nog een tijd beter presteren (momentum-effect, Jegadeesh & Titman 1993). De laatste maand telt niet mee omdat die vaak juist tijdelijk terugveert.',
      rnd(ind.momentum12_1), ind.momentum12_1 ? (ind.momentum12_1.pct > 0.10 ? 15 : ind.momentum12_1.pct > 0 ? 7.5 : 0) : null, 15),
    check('kwartaal', 'Rendement laatste 3 maanden',
      'Bevestigt of de beweging nog loopt of juist stilvalt.',
      rnd(ind.rendement3m), ind.rendement3m ? (ind.rendement3m.pct > 0 ? 10 : 0) : null, 10),
    check('rsi', 'RSI (14 dagen) — niet oververhit',
      'De RSI (0–100) meet hoe hard de koers recent gestegen of gedaald is. Boven 70 is het aandeel "overbought": hard opgelopen, kans op een terugval is groter — niet het moment om in te stappen. Tussen 40 en 65 is gezond in een stijgende trend.',
      rsi == null ? '—' : nl(rsi, 0),
      rsi == null ? null : rsi > 75 ? 0 : rsi > 65 ? 7.5 : rsi >= 40 ? 15 : 7.5, 15),
    check('top', 'Afstand tot hoogste koers van 52 weken',
      'Sterke aandelen staan dicht bij hun jaartop. Een aandeel dat 30% onder zijn top staat is niet "goedkoop" — de markt verkoopt het om een reden.',
      vanTop == null || ind.hoog52 == null ? '—' : `${pct(vanTop)} (top ${p(ind.hoog52)} op ${datumNl(ind.hoog52Datum)})`,
      vanTop == null ? null : vanTop >= -0.10 ? 10 : vanTop >= -0.20 ? 5 : 0, 10),
  ]
  const c0 = cat('', checks)
  const score = c0.max > 0 ? Math.round((100 * c0.punten) / c0.max) : null

  const oververhit = rsi != null && rsi > 70
  let oordeel: Oordeel
  const samenvatting: string[] = []
  if (!bovenSma200) {
    oordeel = 'vermijden'
    samenvatting.push(`De koers (${p(slot)}) staat ${afstand200 > -0.02 ? 'net ' : ''}onder het 200-daags gemiddelde (${p(sma200)}): ${afstand200 > -0.02 ? 'de trend staat op de grens en is volgens de regel niet meer omhoog' : 'de trend is omlaag'}. Niet instappen voor de korte termijn; wie het aandeel als korte trade heeft, heeft volgens deze regel geen reden meer om te blijven zitten.`)
  } else if (score != null && score >= 70 && !oververhit) {
    oordeel = 'kopen'
    samenvatting.push(`Score ${score}/100: de trend is omhoog, het momentum werkt mee en het aandeel is niet oververhit.`)
  } else if (oververhit) {
    oordeel = 'afwachten'
    samenvatting.push(`De trend is omhoog, maar het aandeel is hard opgelopen (RSI ${nl(rsi as number, 0)}). Nu instappen is achter de koers aan rennen — wacht op een terugval${sma20 ? ` richting het 20-daags gemiddelde (${p(sma20)})` : ''}.`)
  } else {
    oordeel = 'afwachten'
    samenvatting.push(`Score ${score}/100: de koers staat boven het 200-daags gemiddelde, maar het beeld is nog niet overtuigend genoeg om in te stappen.`)
  }

  if (cijfersDatum) {
    const dagen = Math.round((new Date(cijfersDatum + 'T00:00:00Z').getTime() - Date.now()) / 86400000)
    if (dagen >= 0 && dagen <= 14) {
      samenvatting.push(`Let op: kwartaalcijfers op ${datumNl(cijfersDatum)}. Rond cijfers kan de koers in één nacht 5–15% verspringen; een stop-loss beschermt dan niet volledig. Veel korte-termijnhandelaren stappen niet in vlak vóór cijfers.`)
    }
  }

  let plan: Handelsplan | null = null
  if (oordeel !== 'vermijden' && atr != null && atr > 0) {
    const stop = slot - 2 * atr
    const doel = slot + 3 * atr
    plan = {
      instap: slot, instapDatum: ind.slotDatum,
      stop, stopPct: stop / slot - 1, doel, doelPct: doel / slot - 1,
      koopzone: oververhit ? sma20 : null,
      uitleg: `Stop-loss = 2× de gemiddelde dagbeweging (ATR ${p(atr)}) onder de instap, zodat normale schommelingen je er niet uit gooien. Doel = 3× ATR erboven: je mogelijke winst is 1,5× je risico. Bepaal je aantal aandelen zo dat je bij de stop maximaal 1% van je rekening verliest: aantal = (1% van je rekening) ÷ (instap − stop).`,
    }
  }

  return { oordeel, score, samenvatting, checks, plan, indicatoren: ind }
}

// ─── Historische toets van het trendfilter op dít aandeel ────
// Regel: belegd op dag t+1 als het slot van dag t boven het 200-daags
// gemiddelde staat, anders cash. Signaal op het slot, positie pas de dag
// erna → geen look-ahead. Rendementen op dividend-gecorrigeerde koersen.
// Zonder transactiekosten en belasting.
export interface Toets {
  van: string
  tot: string
  jaren: number
  regel: { totaal: number; perJaar: number; maxVerlies: number }
  kopenHouden: { totaal: number; perJaar: number; maxVerlies: number }
  pctBelegd: number
  wissels: number
}

export function toetsTrendfilter(c: DagCandle[]): Toets | null {
  const a = c.map((x) => x.adj)
  if (a.length < 200 + 252) return null
  const sma = smaReeks(a, 200)
  const start = 199
  let eqR = 1, eqB = 1, piekR = 1, piekB = 1, ddR = 0, ddB = 0, belegd = 0, wissels = 0
  let vorige: boolean | null = null
  for (let i = start; i < a.length - 1; i++) {
    if (!a[i]) continue
    const r = a[i + 1] / a[i] - 1
    const pos = a[i] > (sma[i] as number)
    if (vorige != null && pos !== vorige) wissels++
    vorige = pos
    if (pos) { eqR *= 1 + r; belegd++ }
    eqB *= 1 + r
    piekR = Math.max(piekR, eqR); ddR = Math.min(ddR, eqR / piekR - 1)
    piekB = Math.max(piekB, eqB); ddB = Math.min(ddB, eqB / piekB - 1)
  }
  const dagen = a.length - 1 - start
  const jaren = dagen / 252
  return {
    van: c[start].date, tot: c[c.length - 1].date, jaren,
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

