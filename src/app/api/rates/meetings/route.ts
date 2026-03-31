import { NextResponse } from 'next/server'

// Fetch upcoming CB meeting dates from FairEconomy calendar
// This checks the economic calendar for "Interest Rate Decision" events

const CB_KEYWORDS = ['Interest Rate Decision', 'Rate Decision', 'Monetary Policy', 'Policy Rate']

const CURRENCY_MAP: Record<string, string> = {
  USD: 'USD', EUR: 'EUR', GBP: 'GBP', JPY: 'JPY',
  CHF: 'CHF', AUD: 'AUD', CAD: 'CAD', NZD: 'NZD',
  CNY: 'CNY', SEK: 'SEK', NOK: 'NOK', MXN: 'MXN',
  ZAR: 'ZAR', TRY: 'TRY', BRL: 'BRL',
}

interface CalendarEvent {
  title: string
  country: string
  date: string
  impact: string
  forecast: string
  previous: string
}

async function fetchCalendarWeek(url: string): Promise<CalendarEvent[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function GET() {
  // Fetch this week and next week's calendars
  const [thisWeek, nextWeek] = await Promise.all([
    fetchCalendarWeek('https://nfs.faireconomy.media/ff_calendar_thisweek.json'),
    fetchCalendarWeek('https://nfs.faireconomy.media/ff_calendar_nextweek.json'),
  ])

  const allEvents = [...thisWeek, ...nextWeek]

  // Find rate decision events
  const meetings: Record<string, { date: string; title: string }> = {}

  for (const event of allEvents) {
    const isRateDecision = CB_KEYWORDS.some(kw =>
      event.title?.toLowerCase().includes(kw.toLowerCase())
    )
    if (!isRateDecision) continue

    const ccy = event.country?.toUpperCase()
    if (ccy && CURRENCY_MAP[ccy] && !meetings[ccy]) {
      meetings[ccy] = {
        date: event.date || '',
        title: event.title || '',
      }
    }
  }

  return NextResponse.json({
    meetings,
    fetchedAt: new Date().toISOString(),
    eventsScanned: allEvents.length,
  })
}
