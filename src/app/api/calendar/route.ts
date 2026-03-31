import { NextResponse } from 'next/server'

interface RawEvent {
  title: string
  country: string
  date: string
  impact: string
  forecast: string
  previous: string
}

const IMPACT_MAP: Record<string, string> = {
  High: 'hoog',
  Medium: 'medium',
  Low: 'laag',
  Holiday: 'feestdag',
}

const COUNTRY_NAMES: Record<string, string> = {
  USD: 'VS', EUR: 'EU', GBP: 'VK', JPY: 'JP',
  AUD: 'AU', CAD: 'CA', CHF: 'CH', NZD: 'NZ',
  CNY: 'CN',
}

const FLAGS: Record<string, string> = {
  USD: 'US', EUR: 'EU', GBP: 'GB', JPY: 'JP',
  AUD: 'AU', CAD: 'CA', CHF: 'CH', NZD: 'NZ',
  CNY: 'CN',
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const impact = searchParams.get('impact') || 'all' // all, high, medium
  const currencies = searchParams.get('currencies')?.split(',') || []

  try {
    // Fetch this week and next week
    const [thisWeekRes, nextWeekRes] = await Promise.all([
      fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { next: { revalidate: 1800 } }),
      fetch('https://nfs.faireconomy.media/ff_calendar_nextweek.json', { next: { revalidate: 1800 } }),
    ])

    const thisWeek: RawEvent[] = thisWeekRes.ok ? await thisWeekRes.json() : []
    const nextWeek: RawEvent[] = nextWeekRes.ok ? await nextWeekRes.json() : []

    let events = [...thisWeek, ...nextWeek].map(e => ({
      title: e.title || '',
      currency: e.country?.toUpperCase() || '',
      date: e.date || '',
      impact: IMPACT_MAP[e.impact] || e.impact || '',
      forecast: e.forecast || '',
      previous: e.previous || '',
      flag: FLAGS[e.country?.toUpperCase()] || '',
      countryName: COUNTRY_NAMES[e.country?.toUpperCase()] || e.country || '',
    }))

    // Filter by impact
    if (impact === 'high') {
      events = events.filter(e => e.impact === 'hoog')
    } else if (impact === 'medium') {
      events = events.filter(e => e.impact === 'hoog' || e.impact === 'medium')
    }

    // Filter by currencies
    if (currencies.length > 0 && currencies[0] !== '') {
      events = events.filter(e => currencies.includes(e.currency))
    }

    // Extract CB meeting events
    const meetingKeywords = ['Interest Rate', 'Rate Decision', 'Monetary Policy', 'Policy Rate', 'Cash Rate']
    const meetings = events.filter(e =>
      meetingKeywords.some(kw => e.title.toLowerCase().includes(kw.toLowerCase()))
    )

    return NextResponse.json({
      events,
      meetings,
      count: events.length,
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e), events: [], meetings: [], count: 0 }, { status: 500 })
  }
}
