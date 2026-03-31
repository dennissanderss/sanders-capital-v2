import { NextResponse } from 'next/server'

// Central bank data — mirrors api/_lib/macro_data.py
const CENTRAL_BANKS: Record<string, {
  bank: string; rate: number; country: string; flag: string
  bias: string; lastMove: string; nextMeeting: string; sourceUrl: string
}> = {
  USD: { bank: 'Federal Reserve (Fed)', rate: 3.75, country: 'Verenigde Staten', flag: 'US', bias: 'afwachtend', lastMove: '25bp knip (januari 2026)', nextMeeting: '6 mei 2026', sourceUrl: 'https://www.federalreserve.gov/monetarypolicy.htm' },
  EUR: { bank: 'Europese Centrale Bank (ECB)', rate: 1.90, country: 'Eurozone', flag: 'EU', bias: 'afwachtend', lastMove: '25bp knip (januari 2026)', nextMeeting: '16 april 2026', sourceUrl: 'https://www.ecb.europa.eu/mopo/decisions/html/index.en.html' },
  GBP: { bank: 'Bank of England (BoE)', rate: 3.75, country: 'Verenigd Koninkrijk', flag: 'GB', bias: 'voorzichtig verruimend', lastMove: '25bp knip (februari 2026)', nextMeeting: '7 mei 2026', sourceUrl: 'https://www.bankofengland.co.uk/monetary-policy' },
  JPY: { bank: 'Bank of Japan (BoJ)', rate: 1.00, country: 'Japan', flag: 'JP', bias: 'voorzichtig verkrappend', lastMove: '25bp verhoging (januari 2026)', nextMeeting: '28 april 2026', sourceUrl: 'https://www.boj.or.jp/en/mopo/index.htm' },
  CHF: { bank: 'Zwitserse Nationale Bank (SNB)', rate: 0.00, country: 'Zwitserland', flag: 'CH', bias: 'afwachtend', lastMove: '25bp knip (juni 2025)', nextMeeting: '18 juni 2026', sourceUrl: 'https://www.snb.ch/en/iabout/monpol' },
  AUD: { bank: 'Reserve Bank of Australia (RBA)', rate: 3.35, country: 'Australië', flag: 'AU', bias: 'voorzichtig verruimend', lastMove: '25bp knip (februari 2026)', nextMeeting: '5 mei 2026', sourceUrl: 'https://www.rba.gov.au/monetary-policy/' },
  CAD: { bank: 'Bank of Canada (BoC)', rate: 2.25, country: 'Canada', flag: 'CA', bias: 'afwachtend', lastMove: '25bp knip (december 2025)', nextMeeting: '15 april 2026', sourceUrl: 'https://www.bankofcanada.ca/core-functions/monetary-policy/' },
  NZD: { bank: 'Reserve Bank of New Zealand (RBNZ)', rate: 2.75, country: 'Nieuw-Zeeland', flag: 'NZ', bias: 'afwachtend', lastMove: '25bp knip (februari 2026)', nextMeeting: '13 mei 2026', sourceUrl: 'https://www.rbnz.govt.nz/monetary-policy' },
}

const EXTRA_RATES: Record<string, { bank: string; country: string; flag: string; rate: number; sourceUrl: string }> = {
  CNY: { bank: "People's Bank of China (PBoC)", country: 'China', flag: 'CN', rate: 3.10, sourceUrl: 'http://www.pbc.gov.cn/en/3688006/index.html' },
  SEK: { bank: 'Sveriges Riksbank', country: 'Zweden', flag: 'SE', rate: 2.25, sourceUrl: 'https://www.riksbank.se/en-gb/monetary-policy/' },
  NOK: { bank: 'Norges Bank', country: 'Noorwegen', flag: 'NO', rate: 4.50, sourceUrl: 'https://www.norges-bank.no/en/topics/Monetary-policy/' },
  MXN: { bank: 'Banco de México', country: 'Mexico', flag: 'MX', rate: 9.50, sourceUrl: 'https://www.banxico.org.mx/monetary-policy/index.html' },
  ZAR: { bank: 'South African Reserve Bank', country: 'Zuid-Afrika', flag: 'ZA', rate: 7.50, sourceUrl: 'https://www.resbank.co.za/en/home/what-we-do/monetary-policy' },
  TRY: { bank: 'Central Bank of Turkey', country: 'Turkije', flag: 'TR', rate: 42.50, sourceUrl: 'https://www.tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Main+Menu/Core+Functions/Monetary+Policy/' },
  BRL: { bank: 'Banco Central do Brasil', country: 'Brazilië', flag: 'BR', rate: 14.25, sourceUrl: 'https://www.bcb.gov.br/en/monetarypolicy' },
}

export async function GET() {
  const rates = [
    ...Object.entries(CENTRAL_BANKS).map(([ccy, cb]) => ({
      currency: ccy,
      country: cb.country,
      bank: cb.bank,
      rate: cb.rate,
      flag: cb.flag,
      source: 'macro_data',
      sourceUrl: cb.sourceUrl,
      lastMove: cb.lastMove,
      nextMeeting: cb.nextMeeting,
      bias: cb.bias,
    })),
    ...Object.entries(EXTRA_RATES).map(([ccy, info]) => ({
      currency: ccy,
      country: info.country,
      bank: info.bank,
      rate: info.rate,
      flag: info.flag,
      source: 'static',
      sourceUrl: info.sourceUrl,
      lastMove: '',
      nextMeeting: '',
      bias: '',
    })),
  ]

  return NextResponse.json({
    rates,
    generatedAt: new Date().toISOString(),
    count: rates.length,
  })
}
