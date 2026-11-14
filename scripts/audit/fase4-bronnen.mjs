#!/usr/bin/env node
// ─── AUDIT FASE 4a — Bronnenverificatie + download (alleen-lezen) ──
// Probeert per onderzoeksrichting een echte, gratis bron en rapporteert
// wat werkt. Niets wordt verzonnen: een bron die faalt of niet te
// verifiëren is, wordt als zodanig gerapporteerd en niet gebruikt.
//
//  1. 2-jaars staatsrentes (officiële bronnen per land):
//     USD FRED DGS2 · EUR ECB yield curve · JPY MoF JGB · CAD BoC Valet ·
//     AUD RBA F2 · CHF SNB rendoblid · GBP BoE IADB (code onzeker →
//     alleen accepteren als de titel expliciet "2 year" zegt) · NZD RBNZ
//     (alleen xlsx → niet in dit script).
//  2. Risicosentiment + grondstoffen: Yahoo ^VIX, ^GSPC, CL=F, GC=F, HG=F.
//  3. CFTC CoT (legacy futures-only, jaarbestanden 2025+2026).
//  4. Dataverrassingen: fb_daily_context.header.currencyScores[].breakdown
//     .surprisePts (point-in-time vastgelegd sinds 6 jul 2026).
//
// Draaien:  node scripts/audit/fase4-bronnen.mjs
// ──────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

mkdirSync('scripts/audit/data', { recursive: true })
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
const status = {}
const yields = {} // ccy -> [{date, y}]

async function tryFetch(url, opts = {}) {
  const res = await fetch(url, { headers: UA, ...opts })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}
const isNum = (v) => v !== '' && v != null && !isNaN(parseFloat(v))
const clean = (rows) => rows
  .filter((r) => r.date >= '2025-03-01' && isNum(r.y))
  .map((r) => ({ date: r.date, y: +parseFloat(r.y).toFixed(3) }))
  .sort((a, b) => a.date.localeCompare(b.date))

// ─── USD: FRED DGS2 ───────────────────────────────────────────
try {
  const txt = await tryFetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2')
  const rows = txt.trim().split('\n').slice(1).map((l) => {
    const [date, v] = l.split(',')
    return { date, y: v }
  })
  yields.USD = clean(rows)
  status.USD = { bron: 'FRED DGS2 (US Treasury 2Y, dagelijks)', rijen: yields.USD.length, van: yields.USD[0]?.date, tot: yields.USD[yields.USD.length - 1]?.date }
} catch (e) { status.USD = { fout: String(e) } }

// ─── EUR: ECB yield curve 2Y (AAA euro area) ─────────────────
try {
  const txt = await tryFetch('https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y?format=csvdata&startPeriod=2025-03-01')
  const lines = txt.trim().split('\n')
  const header = lines[0].split(',')
  const iDate = header.indexOf('TIME_PERIOD'), iVal = header.indexOf('OBS_VALUE')
  const rows = lines.slice(1).map((l) => {
    const p = l.split(',')
    return { date: p[iDate], y: p[iVal] }
  })
  yields.EUR = clean(rows)
  status.EUR = { bron: 'ECB Data Portal, euro area AAA spot 2Y, dagelijks', rijen: yields.EUR.length, van: yields.EUR[0]?.date, tot: yields.EUR[yields.EUR.length - 1]?.date }
} catch (e) { status.EUR = { fout: String(e) } }

// ─── JPY: Japans MoF JGB-curve (meerdere bekende locaties) ────
try {
  let txt = null
  for (const url of [
    'https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/historical/jgbcme_all.csv',
    'https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/jgbcme.csv',
    'https://www.mof.go.jp/jgbs/reference/interest_rate/jgbcme.csv',
  ]) {
    try { txt = await tryFetch(url); if (txt.length > 500) break } catch { txt = null }
  }
  if (!txt) throw new Error('geen van de MoF-locaties bereikbaar')
  const lines = txt.split('\n')
  const hIdx = lines.findIndex((l) => l.includes('2Y') || l.includes('2年'))
  const header = lines[hIdx].split(',').map((s) => s.trim())
  const i2y = header.findIndex((h) => h === '2Y')
  const rows = lines.slice(hIdx + 1).map((l) => {
    const p = l.split(',')
    const d = (p[0] || '').trim().replace(/\//g, '-')
    // datums als 2026-1-5 → 2026-01-05
    const m = d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    return { date: m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : d, y: p[i2y] }
  })
  yields.JPY = clean(rows)
  status.JPY = { bron: 'Japans Ministry of Finance, JGB 2Y, dagelijks', rijen: yields.JPY.length, van: yields.JPY[0]?.date, tot: yields.JPY[yields.JPY.length - 1]?.date }
} catch (e) { status.JPY = { fout: String(e) } }

// ─── CAD: Bank of Canada Valet ────────────────────────────────
try {
  const txt = await tryFetch('https://www.bankofcanada.ca/valet/observations/BD.CDN.2YR.DQ.YLD/csv?start_date=2025-03-01')
  const lines = txt.trim().split('\n')
  const hIdx = lines.findIndex((l) => l.startsWith('"date"') || l.startsWith('date'))
  const rows = lines.slice(hIdx + 1).map((l) => {
    const p = l.replace(/"/g, '').split(',')
    return { date: p[0], y: p[1] }
  })
  yields.CAD = clean(rows)
  status.CAD = { bron: 'Bank of Canada Valet, benchmark 2Y, dagelijks', rijen: yields.CAD.length, van: yields.CAD[0]?.date, tot: yields.CAD[yields.CAD.length - 1]?.date }
} catch (e) { status.CAD = { fout: String(e) } }

// ─── AUD: RBA tabel F2 (AGS 2-jaars) ──────────────────────────
try {
  const txt = await tryFetch('https://www.rba.gov.au/statistics/tables/csv/f2-data.csv')
  const lines = txt.split('\n')
  const idIdx = lines.findIndex((l) => l.startsWith('Series ID'))
  const ids = lines[idIdx].split(',').map((s) => s.trim())
  const col = ids.findIndex((id) => id.includes('GBAG2'))
  if (col < 0) throw new Error('kolom FCMYGBAG2 niet gevonden')
  const rows = lines.slice(idIdx + 1).map((l) => {
    const p = l.split(',')
    const d = (p[0] || '').trim() // formaat 05-Jun-2026
    const m = d.match(/^(\d{1,2})-(\w{3})-(\d{4})$/)
    const MM = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }
    return { date: m ? `${m[3]}-${MM[m[2]]}-${m[1].padStart(2, '0')}` : '', y: p[col] }
  })
  yields.AUD = clean(rows)
  status.AUD = { bron: 'RBA tabel F2, Australian Government 2Y, dagelijks', rijen: yields.AUD.length, van: yields.AUD[0]?.date, tot: yields.AUD[yields.AUD.length - 1]?.date }
} catch (e) { status.AUD = { fout: String(e) } }

// ─── CHF: SNB rendoblid (Eidgenossen spot-curve) ──────────────
try {
  // de SNB-API geeft ~100 rijen per request → in vensters van 4 maanden ophalen
  const rows = []
  const vensters = [
    ['2025-03-01', '2025-06-30'], ['2025-07-01', '2025-10-31'], ['2025-11-01', '2026-02-28'],
    ['2026-03-01', '2026-06-30'], ['2026-07-01', '2026-11-14'],
  ]
  for (const [van, tot] of vensters) {
    const txt = await tryFetch(`https://data.snb.ch/api/cube/rendoblid/data/csv/en?fromDate=${van}&toDate=${tot}`)
    const lines = txt.trim().split('\n')
    const hIdx = lines.findIndex((l) => l.toLowerCase().startsWith('date'))
    for (const l of lines.slice(hIdx + 1)) {
      const p = l.replace(/"/g, '').split(';')
      if (p.length >= 3 && p[1] === '2J') rows.push({ date: p[0], y: p[2] })
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  yields.CHF = clean(rows)
  status.CHF = { bron: 'SNB data portal, Bundesobligationen 2J spot, dagelijks', rijen: yields.CHF.length, van: yields.CHF[0]?.date, tot: yields.CHF[yields.CHF.length - 1]?.date }
} catch (e) { status.CHF = { fout: String(e) } }

// ─── GBP: BoE IADB — alleen accepteren met expliciete titel ───
try {
  const url = 'https://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp?csv.x=yes&Datefrom=01/Mar/2025&Dateto=14/Nov/2026&SeriesCodes=IUDSNPY&CSVF=TT&UsingCodes=Y&VPD=Y'
  const txt = await tryFetch(url)
  const lines = txt.trim().split('\n')
  const titel = (lines[0] || '') + ' ' + (lines[1] || '')
  // IUDSNPY is blijkens de beschrijving de 5-JAARS nominal par yield.
  // Er is geen gratis dagelijkse 2-jaars gilt-reeks geverifieerd; we nemen
  // GBP mee met deze 5-jaars reeks en labelen dat expliciet.
  if (!/5 year/i.test(titel)) {
    status.GBP = { fout: `BoE-reeks IUDSNPY onverwachte beschrijving: "${titel.slice(0, 120)}" — niet gebruikt` }
  } else {
    const rows = lines.slice(1).map((l) => {
      const p = l.split(',')
      const m = (p[0] || '').match(/^(\d{1,2}) (\w{3}) (\d{4})$/)
      const MM = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }
      return { date: m ? `${m[3]}-${MM[m[2]]}-${m[1].padStart(2, '0')}` : '', y: p[1] }
    })
    yields.GBP = clean(rows)
    status.GBP = { bron: 'BoE IADB IUDSNPY — LET OP: 5-jaars par yield (geen gratis dagelijkse 2-jaars gilt-reeks geverifieerd)', rijen: yields.GBP.length, van: yields.GBP[0]?.date, tot: yields.GBP[yields.GBP.length - 1]?.date }
  }
} catch (e) { status.GBP = { fout: String(e) } }

status.NZD = { fout: 'RBNZ publiceert dagelijkse 2Y-swaprentes alleen als xlsx (tabel B2) — bron bestaat, maar niet machinaal getoetst in deze audit' }

writeFileSync('scripts/audit/data/fase4-yields.json', JSON.stringify(yields))

// ─── Yahoo: VIX, S&P 500, olie, goud, koper ───────────────────
{
  const DAY_SEC = 86400
  const sessionDateUTC = (t) => new Date(Math.round(t / DAY_SEC) * DAY_SEC * 1000).toISOString().split('T')[0]
  const distMidnight = (t) => Math.abs(t - Math.round(t / DAY_SEC) * DAY_SEC)
  async function fetchDaily(symbol) {
    const p1 = Math.floor(new Date('2025-03-01T00:00:00Z').getTime() / 1000)
    const nowSec = Math.floor(Date.now() / 1000)
    for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
      try {
        const res = await fetch(`https://${host}/v8/finance/chart/${symbol}?interval=1d&period1=${p1}&period2=${nowSec}`, { headers: UA })
        if (!res.ok) continue
        const json = await res.json()
        const r = json?.chart?.result?.[0]
        if (!r?.timestamp) continue
        const q = r.indicators?.quote?.[0] || {}
        const byDate = new Map()
        for (let i = 0; i < r.timestamp.length; i++) {
          const t = r.timestamp[i]
          if (q.close?.[i] == null) continue
          if (t + DAY_SEC > nowSec) continue
          const date = sessionDateUTC(t)
          const cur = byDate.get(date)
          if (!cur || distMidnight(t) < distMidnight(cur.t)) byDate.set(date, { t, date, close: q.close[i] })
        }
        return [...byDate.values()].sort((a, b) => a.t - b.t).map(({ t, ...c }) => c)
      } catch { /* volgende host */ }
    }
    return []
  }
  const im = {}
  for (const [key, sym] of Object.entries({ vix: '%5EVIX', sp500: '%5EGSPC', oil: 'CL%3DF', gold: 'GC%3DF', copper: 'HG%3DF' })) {
    im[key] = await fetchDaily(sym)
    status[`yahoo_${key}`] = { rijen: im[key].length, van: im[key][0]?.date, tot: im[key][im[key].length - 1]?.date }
    await new Promise((r) => setTimeout(r, 400))
  }
  writeFileSync('scripts/audit/data/fase4-intermarket.json', JSON.stringify(im))
}

// ─── CFTC CoT: legacy futures-only jaarbestanden ──────────────
// Download als tekst lukt niet (zip) — we halen de zips apart op via curl
// in de shell; hier alleen parsen als de bestanden al lokaal staan.
{
  // match op "NAAM - BEURS" zodat cross-rate markten (bv. EURO FX/BRITISH
  // POUND XRATE) niet meetellen
  const MARKTEN = {
    'EURO FX -': 'EUR', 'JAPANESE YEN -': 'JPY', 'BRITISH POUND -': 'GBP',
    'BRITISH POUND STERLING -': 'GBP', 'AUSTRALIAN DOLLAR -': 'AUD',
    'NZ DOLLAR -': 'NZD', 'NEW ZEALAND DOLLAR -': 'NZD',
    'CANADIAN DOLLAR -': 'CAD', 'SWISS FRANC -': 'CHF', 'U.S. DOLLAR INDEX -': 'USD',
  }
  const cot = []
  for (const jaar of [2025, 2026]) {
    try {
      const txt = readFileSync(`scripts/audit/data/cot${jaar}.txt`, 'latin1')
      // CSV: kolom 0 = marktnaam, 2 = datum yyyy-mm-dd, 7/8 = noncomm long/short (All)
      for (const line of txt.split('\n')) {
        const p = line.split(',').map((s) => s.replace(/"/g, '').trim())
        if (p.length < 10) continue
        const markt = Object.keys(MARKTEN).find((m) => p[0].toUpperCase().startsWith(m))
        if (!markt) continue
        const date = p[2]
        const long = parseInt(p[7], 10), short = parseInt(p[8], 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(long) || isNaN(short)) continue
        cot.push({ ccy: MARKTEN[markt], date, net: long - short, long, short })
      }
    } catch { /* bestand ontbreekt */ }
  }
  cot.sort((a, b) => a.date.localeCompare(b.date))
  writeFileSync('scripts/audit/data/fase4-cot.json', JSON.stringify(cot))
  status.cot = cot.length > 0
    ? { bron: 'CFTC legacy COT futures-only (deacot-jaarbestanden)', rijen: cot.length, van: cot[0]?.date, tot: cot[cot.length - 1]?.date }
    : { fout: 'cot2025.txt/cot2026.txt niet gevonden — eerst downloaden met curl + tar (zie rapport)' }
}

// ─── Dataverrassingen uit fb_daily_context ────────────────────
{
  const env = readFileSync('.env.local', 'utf8')
  const g = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : process.env[k] }
  const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'))
  const { data, error } = await sb.from('fb_daily_context').select('ctx_date, header').order('ctx_date', { ascending: true })
  if (error) {
    status.surprises = { fout: error.message }
  } else {
    const out = []
    for (const row of data || []) {
      const scores = row.header?.currencyScores || []
      const perCcy = {}
      for (const s of scores) {
        perCcy[s.currency] = {
          surprise: s.breakdown?.surprisePts ?? null,
          inflGap: s.breakdown?.inflGapPts ?? null,
          commodity: s.breakdown?.commodityPts ?? null,
          news: s.breakdown?.newsCapped ?? null,
          totaal: s.score ?? null,
        }
      }
      out.push({ date: row.ctx_date, perCcy })
    }
    writeFileSync('scripts/audit/data/fase4-surprises.json', JSON.stringify(out))
    status.surprises = { bron: 'fb_daily_context (point-in-time gelockt sinds 2026-07-06)', rijen: out.length, van: out[0]?.date, tot: out[out.length - 1]?.date }
  }
}

writeFileSync('scripts/audit/data/fase4-bronnen-status.json', JSON.stringify(status, null, 2))
console.log(JSON.stringify(status, null, 2))
