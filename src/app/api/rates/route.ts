import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Hardcoded fallback data — used when Supabase is unavailable
const FALLBACK_RATES = [
  { currency: 'USD', country: 'Verenigde Staten', bank: 'Federal Reserve (Fed)', rate: 3.75, target: 3.50, flag: 'US', bias: 'afwachtend', lastMove: '25bp knip (januari 2026)', nextMeeting: '6 mei 2026', sourceUrl: 'https://www.federalreserve.gov/monetarypolicy.htm' },
  { currency: 'EUR', country: 'Eurozone', bank: 'Europese Centrale Bank (ECB)', rate: 1.90, target: 1.75, flag: 'EU', bias: 'afwachtend', lastMove: '25bp knip (januari 2026)', nextMeeting: '16 april 2026', sourceUrl: 'https://www.ecb.europa.eu/mopo/decisions/html/index.en.html' },
  { currency: 'GBP', country: 'Verenigd Koninkrijk', bank: 'Bank of England (BoE)', rate: 3.75, target: 3.50, flag: 'GB', bias: 'voorzichtig verruimend', lastMove: '25bp knip (februari 2026)', nextMeeting: '7 mei 2026', sourceUrl: 'https://www.bankofengland.co.uk/monetary-policy' },
  { currency: 'JPY', country: 'Japan', bank: 'Bank of Japan (BoJ)', rate: 1.00, target: 1.25, flag: 'JP', bias: 'voorzichtig verkrappend', lastMove: '25bp verhoging (januari 2026)', nextMeeting: '28 april 2026', sourceUrl: 'https://www.boj.or.jp/en/mopo/index.htm' },
  { currency: 'CHF', country: 'Zwitserland', bank: 'Zwitserse Nationale Bank (SNB)', rate: 0.00, target: 0.00, flag: 'CH', bias: 'afwachtend', lastMove: '25bp knip (juni 2025)', nextMeeting: '18 juni 2026', sourceUrl: 'https://www.snb.ch/en/iabout/monpol' },
  { currency: 'AUD', country: 'Australië', bank: 'Reserve Bank of Australia (RBA)', rate: 3.85, target: 3.60, flag: 'AU', bias: 'afwachtend', lastMove: 'Ongewijzigd (31 maart 2026)', nextMeeting: '20 mei 2026', sourceUrl: 'https://www.rba.gov.au/monetary-policy/' },
  { currency: 'CAD', country: 'Canada', bank: 'Bank of Canada (BoC)', rate: 2.25, target: 2.00, flag: 'CA', bias: 'afwachtend', lastMove: '25bp knip (december 2025)', nextMeeting: '15 april 2026', sourceUrl: 'https://www.bankofcanada.ca/core-functions/monetary-policy/' },
  { currency: 'NZD', country: 'Nieuw-Zeeland', bank: 'Reserve Bank of New Zealand (RBNZ)', rate: 2.75, target: 2.50, flag: 'NZ', bias: 'afwachtend', lastMove: '25bp knip (februari 2026)', nextMeeting: '13 mei 2026', sourceUrl: 'https://www.rbnz.govt.nz/monetary-policy' },
  { currency: 'CNY', country: 'China', bank: "People's Bank of China (PBoC)", rate: 3.10, target: 3.00, flag: 'CN', bias: '', lastMove: '', nextMeeting: '', sourceUrl: 'http://www.pbc.gov.cn/en/3688006/index.html' },
  { currency: 'SEK', country: 'Zweden', bank: 'Sveriges Riksbank', rate: 2.25, target: 2.00, flag: 'SE', bias: '', lastMove: '', nextMeeting: '', sourceUrl: 'https://www.riksbank.se/en-gb/monetary-policy/' },
  { currency: 'NOK', country: 'Noorwegen', bank: 'Norges Bank', rate: 4.50, target: 4.00, flag: 'NO', bias: '', lastMove: '', nextMeeting: '', sourceUrl: 'https://www.norges-bank.no/en/topics/Monetary-policy/' },
  { currency: 'MXN', country: 'Mexico', bank: 'Banco de México', rate: 9.50, target: 9.00, flag: 'MX', bias: '', lastMove: '', nextMeeting: '', sourceUrl: 'https://www.banxico.org.mx/monetary-policy/index.html' },
  { currency: 'ZAR', country: 'Zuid-Afrika', bank: 'South African Reserve Bank', rate: 7.50, target: 7.25, flag: 'ZA', bias: '', lastMove: '', nextMeeting: '', sourceUrl: 'https://www.resbank.co.za/en/home/what-we-do/monetary-policy' },
  { currency: 'TRY', country: 'Turkije', bank: 'Central Bank of Turkey', rate: 42.50, target: 40.00, flag: 'TR', bias: '', lastMove: '', nextMeeting: '', sourceUrl: 'https://www.tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Main+Menu/Core+Functions/Monetary+Policy/' },
  { currency: 'BRL', country: 'Brazilië', bank: 'Banco Central do Brasil', rate: 14.25, target: 13.75, flag: 'BR', bias: '', lastMove: '', nextMeeting: '', sourceUrl: 'https://www.bcb.gov.br/en/monetarypolicy' },
]

// Major currencies shown first
const MAJOR_ORDER = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']

// ── Staleness guard ──────────────────────────────────────────
// Parse a "next meeting" string ("28-29 juli 2026", "6 augustus 2026",
// or an ISO date) into a Date, so we can flag when a meeting has passed
// (i.e. the rate row is due for a manual update).
const NL_MONTHS: Record<string, number> = {
  januari: 0, februari: 1, maart: 2, april: 3, mei: 4, juni: 5,
  juli: 6, augustus: 7, september: 8, oktober: 9, november: 10, december: 11,
}
function parseMeetingDate(text: string): Date | null {
  if (!text) return null
  const s = text.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = Date.parse(s)
    if (!isNaN(t)) return new Date(t)
  }
  // "28-29 juli 2026" → take the last day; "6 augustus 2026"
  const m = s.toLowerCase().match(/(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s+([a-zé]+)\s+(\d{4})/)
  if (m) {
    const day = parseInt(m[2] || m[1], 10)
    const month = NL_MONTHS[m[3]]
    const year = parseInt(m[4], 10)
    if (month !== undefined) return new Date(Date.UTC(year, month, day, 23, 59, 59))
  }
  return null
}

export async function GET() {
  let rates = FALLBACK_RATES
  let source = 'fallback'

  // Try Supabase first
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (url && key) {
      const supabase = createClient(url, key)
      const { data, error } = await supabase
        .from('central_bank_rates')
        .select('*')
        .order('currency')

      if (!error && data && data.length > 0) {
        rates = data.map(r => ({
          currency: r.currency,
          country: r.country,
          bank: r.bank,
          rate: r.rate !== null ? Number(r.rate) : null,
          target: r.target !== null ? Number(r.target) : null,
          flag: r.flag || '',
          bias: r.bias || '',
          lastMove: r.last_move || '',
          nextMeeting: r.next_meeting || '',
          sourceUrl: r.source_url || '',
        }))
        source = 'supabase'
      }
    }
  } catch (e) {
    console.error('Supabase fetch failed, using fallback:', e)
  }

  // Sort: majors first, then the rest
  rates.sort((a, b) => {
    const ai = MAJOR_ORDER.indexOf(a.currency)
    const bi = MAJOR_ORDER.indexOf(b.currency)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.currency.localeCompare(b.currency)
  })

  // Flag rows whose scheduled meeting date has passed — these are due for a
  // manual update, so consumers never present a past date as "upcoming".
  const today = Date.now()
  const withFlags = rates.map((r) => {
    const d = parseMeetingDate(r.nextMeeting || '')
    return {
      ...r,
      meetingDate: d ? d.toISOString() : null,
      meetingPassed: d ? d.getTime() < today : false,
    }
  })
  const staleCount = withFlags.filter((r) => r.meetingPassed).length

  return NextResponse.json({
    rates: withFlags,
    generatedAt: new Date().toISOString(),
    count: withFlags.length,
    stale: staleCount,
    source,
  })
}
