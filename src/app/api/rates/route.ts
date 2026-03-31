import { NextResponse } from 'next/server'

// Central bank data — mirrors api/_lib/macro_data.py
const CENTRAL_BANKS: Record<string, {
  bank: string; rate: number; country: string; flag: string
  bias: string; lastMove: string; nextMeeting: string
}> = {
  USD: { bank: 'Federal Reserve (Fed)', rate: 3.75, country: 'Verenigde Staten', flag: 'US', bias: 'afwachtend', lastMove: '25bp knip (januari 2026)', nextMeeting: '6 mei 2026' },
  EUR: { bank: 'Europese Centrale Bank (ECB)', rate: 1.90, country: 'Eurozone', flag: 'EU', bias: 'afwachtend', lastMove: '25bp knip (januari 2026)', nextMeeting: '16 april 2026' },
  GBP: { bank: 'Bank of England (BoE)', rate: 3.75, country: 'Verenigd Koninkrijk', flag: 'GB', bias: 'voorzichtig verruimend', lastMove: '25bp knip (februari 2026)', nextMeeting: '7 mei 2026' },
  JPY: { bank: 'Bank of Japan (BoJ)', rate: 1.00, country: 'Japan', flag: 'JP', bias: 'voorzichtig verkrappend', lastMove: '25bp verhoging (januari 2026)', nextMeeting: '28 april 2026' },
  CHF: { bank: 'Zwitserse Nationale Bank (SNB)', rate: 0.00, country: 'Zwitserland', flag: 'CH', bias: 'afwachtend', lastMove: '25bp knip (juni 2025)', nextMeeting: '18 juni 2026' },
  AUD: { bank: 'Reserve Bank of Australia (RBA)', rate: 3.35, country: 'Australië', flag: 'AU', bias: 'voorzichtig verruimend', lastMove: '25bp knip (februari 2026)', nextMeeting: '5 mei 2026' },
  CAD: { bank: 'Bank of Canada (BoC)', rate: 2.25, country: 'Canada', flag: 'CA', bias: 'afwachtend', lastMove: '25bp knip (december 2025)', nextMeeting: '15 april 2026' },
  NZD: { bank: 'Reserve Bank of New Zealand (RBNZ)', rate: 2.75, country: 'Nieuw-Zeeland', flag: 'NZ', bias: 'afwachtend', lastMove: '25bp knip (februari 2026)', nextMeeting: '13 mei 2026' },
}

const EXTRA_RATES: Record<string, { bank: string; country: string; flag: string; rate: number }> = {
  CNY: { bank: "People's Bank of China (PBoC)", country: 'China', flag: 'CN', rate: 3.10 },
  SEK: { bank: 'Sveriges Riksbank', country: 'Zweden', flag: 'SE', rate: 2.25 },
  NOK: { bank: 'Norges Bank', country: 'Noorwegen', flag: 'NO', rate: 4.50 },
  MXN: { bank: 'Banco de México', country: 'Mexico', flag: 'MX', rate: 9.50 },
  ZAR: { bank: 'South African Reserve Bank', country: 'Zuid-Afrika', flag: 'ZA', rate: 7.50 },
  TRY: { bank: 'Central Bank of Turkey', country: 'Turkije', flag: 'TR', rate: 42.50 },
  BRL: { bank: 'Banco Central do Brasil', country: 'Brazilië', flag: 'BR', rate: 14.25 },
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
