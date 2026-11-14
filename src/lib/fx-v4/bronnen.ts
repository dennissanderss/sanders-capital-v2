// ─────────────────────────────────────────────────────────────
// FX v4 — externe databronnen (allemaal in fase 4 geverifieerd)
//
// 2-jaars staatsrentes, dagelijks, officiële bronnen:
//   USD FRED DGS2 · EUR ECB (AAA spot 2Y) · JPY MoF JGB · CAD BoC Valet ·
//   AUD RBA tabel F2 · GBP BoE IADB IUDSNPY (5-jaars, expliciet gelabeld)
// CoT: CFTC Socrata-API (legacy futures-only, resource 6dca-aqww),
//   noncommercial long/short — alleen gelogd, geen signaalinput.
//
// Alles cache: 'no-store' (audit fase 1: stale caches corrumpeerden de
// meting) en faal-tolerant: een bron die uitvalt levert null/lege reeks,
// de betrokken paren worden die dag overgeslagen en de uitval wordt in
// de input-log vastgelegd.
// ─────────────────────────────────────────────────────────────

export interface YieldPoint { date: string; y: number }
export interface CotStand { asOf: string; net: number; pct52w: number | null }

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }

async function haalTekst(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: UA, cache: 'no-store' })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

const isNum = (v: string | undefined | null) => v != null && v !== '' && !isNaN(parseFloat(v))
const opschonen = (rows: { date: string; y: string }[], vanaf: string): YieldPoint[] =>
  rows
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date >= vanaf && isNum(r.y))
    .map((r) => ({ date: r.date, y: +parseFloat(r.y).toFixed(3) }))
    .sort((a, b) => a.date.localeCompare(b.date))

const MAAND: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }

// ─── per land één fetcher ─────────────────────────────────────
async function renteUSD(vanaf: string): Promise<YieldPoint[]> {
  const txt = await haalTekst(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2&cosd=${vanaf}`)
  if (!txt) return []
  const rows = txt.trim().split('\n').slice(1).map((l) => {
    const [date, v] = l.split(',')
    return { date, y: v }
  })
  return opschonen(rows, vanaf)
}

async function renteEUR(vanaf: string): Promise<YieldPoint[]> {
  const txt = await haalTekst(`https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y?format=csvdata&startPeriod=${vanaf}`)
  if (!txt) return []
  const lines = txt.trim().split('\n')
  const header = lines[0].split(',')
  const iDate = header.indexOf('TIME_PERIOD'), iVal = header.indexOf('OBS_VALUE')
  if (iDate < 0 || iVal < 0) return []
  return opschonen(lines.slice(1).map((l) => {
    const p = l.split(',')
    return { date: p[iDate], y: p[iVal] }
  }), vanaf)
}

async function renteJPY(vanaf: string): Promise<YieldPoint[]> {
  // huidige-jaarbestand is klein; het historische bestand is de fallback
  for (const url of [
    'https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/jgbcme.csv',
    'https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/historical/jgbcme_all.csv',
  ]) {
    const txt = await haalTekst(url)
    if (!txt) continue
    const lines = txt.split('\n')
    const hIdx = lines.findIndex((l) => l.includes('2Y'))
    if (hIdx < 0) continue
    const i2y = lines[hIdx].split(',').map((s) => s.trim()).findIndex((h) => h === '2Y')
    const rows = lines.slice(hIdx + 1).map((l) => {
      const p = l.split(',')
      const m = (p[0] || '').trim().replace(/\//g, '-').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
      return { date: m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '', y: p[i2y] }
    })
    const uit = opschonen(rows, vanaf)
    if (uit.length >= 8) return uit
  }
  return []
}

async function renteCAD(vanaf: string): Promise<YieldPoint[]> {
  const txt = await haalTekst(`https://www.bankofcanada.ca/valet/observations/BD.CDN.2YR.DQ.YLD/csv?start_date=${vanaf}`)
  if (!txt) return []
  const lines = txt.trim().split('\n')
  const hIdx = lines.findIndex((l) => l.replace(/"/g, '').startsWith('date'))
  if (hIdx < 0) return []
  return opschonen(lines.slice(hIdx + 1).map((l) => {
    const p = l.replace(/"/g, '').split(',')
    return { date: p[0], y: p[1] }
  }), vanaf)
}

async function renteAUD(vanaf: string): Promise<YieldPoint[]> {
  const txt = await haalTekst('https://www.rba.gov.au/statistics/tables/csv/f2-data.csv')
  if (!txt) return []
  const lines = txt.split('\n')
  const idIdx = lines.findIndex((l) => l.startsWith('Series ID'))
  if (idIdx < 0) return []
  const col = lines[idIdx].split(',').map((s) => s.trim()).findIndex((id) => id.includes('GBAG2'))
  if (col < 0) return []
  return opschonen(lines.slice(idIdx + 1).map((l) => {
    const p = l.split(',')
    const m = (p[0] || '').trim().match(/^(\d{1,2})-(\w{3})-(\d{4})$/)
    return { date: m ? `${m[3]}-${MAAND[m[2]]}-${m[1].padStart(2, '0')}` : '', y: p[col] }
  }), vanaf)
}

async function renteGBP(vanaf: string): Promise<YieldPoint[]> {
  // LET OP: IUDSNPY is de 5-JAARS nominal par yield (geen gratis dagelijkse
  // 2-jaars gilt-reeks geverifieerd in fase 4). Wordt zo gelabeld gelogd.
  const d = (iso: string) => {
    const [y, m, dd] = iso.split('-')
    const MM = Object.entries(MAAND).find(([, v]) => v === m)?.[0] || 'Jan'
    return `${dd}/${MM}/${y}`
  }
  const vandaag = new Date().toISOString().slice(0, 10)
  const txt = await haalTekst(`https://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp?csv.x=yes&Datefrom=${d(vanaf)}&Dateto=${d(vandaag)}&SeriesCodes=IUDSNPY&CSVF=TN&UsingCodes=Y&VPD=Y`)
  if (!txt) return []
  return opschonen(txt.trim().split('\n').map((l) => {
    const p = l.split(',')
    const m = (p[0] || '').match(/^(\d{1,2}) (\w{3}) (\d{4})$/)
    return { date: m ? `${m[3]}-${MAAND[m[2]]}-${m[1].padStart(2, '0')}` : '', y: p[1] }
  }), vanaf)
}

export async function haalRentes(vanaf: string): Promise<Record<string, YieldPoint[]>> {
  const [usd, eur, jpy, cad, aud, gbp] = await Promise.all([
    renteUSD(vanaf), renteEUR(vanaf), renteJPY(vanaf), renteCAD(vanaf), renteAUD(vanaf), renteGBP(vanaf),
  ])
  return { USD: usd, EUR: eur, JPY: jpy, CAD: cad, AUD: aud, GBP: gbp }
}

// ─── CoT via de CFTC Socrata-API (alleen logging) ─────────────
const COT_MARKTEN: Record<string, string> = {
  EUR: 'EURO FX -', JPY: 'JAPANESE YEN -', GBP: 'BRITISH POUND',
  AUD: 'AUSTRALIAN DOLLAR -', CAD: 'CANADIAN DOLLAR -',
}

export async function haalCot(vandaag: string): Promise<Record<string, CotStand | null>> {
  const uit: Record<string, CotStand | null> = {}
  for (const [ccy, prefix] of Object.entries(COT_MARKTEN)) {
    try {
      const url = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json?' + new URLSearchParams({
        $limit: '60',
        $order: 'report_date_as_yyyy_mm_dd DESC',
        $where: `starts_with(market_and_exchange_names,'${prefix}')`,
        $select: 'report_date_as_yyyy_mm_dd,noncomm_positions_long_all,noncomm_positions_short_all',
      })
      const res = await fetch(url, { headers: UA, cache: 'no-store' })
      if (!res.ok) { uit[ccy] = null; continue }
      const json = (await res.json()) as { report_date_as_yyyy_mm_dd: string; noncomm_positions_long_all: string; noncomm_positions_short_all: string }[]
      // publicatievertraging: een rapport (as-of dinsdag) is pas ~vrijdag
      // publiek; we gebruiken het vanaf 6 kalenderdagen na de as-of-datum
      const bruikbaar = json
        .map((r) => ({ asOf: r.report_date_as_yyyy_mm_dd.slice(0, 10), net: parseInt(r.noncomm_positions_long_all, 10) - parseInt(r.noncomm_positions_short_all, 10) }))
        .filter((r) => {
          const beschikbaar = new Date(r.asOf + 'T00:00:00Z')
          beschikbaar.setUTCDate(beschikbaar.getUTCDate() + 6)
          return beschikbaar.toISOString().slice(0, 10) <= vandaag && !isNaN(r.net)
        })
        .sort((a, b) => a.asOf.localeCompare(b.asOf))
      if (bruikbaar.length === 0) { uit[ccy] = null; continue }
      const laatste = bruikbaar[bruikbaar.length - 1]
      const venster = bruikbaar.slice(-52)
      const pct = venster.length >= 30
        ? +(100 * venster.filter((r) => r.net <= laatste.net).length / venster.length).toFixed(0)
        : null
      uit[ccy] = { asOf: laatste.asOf, net: laatste.net, pct52w: pct }
    } catch {
      uit[ccy] = null
    }
  }
  return uit
}
