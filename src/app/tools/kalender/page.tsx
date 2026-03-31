'use client'

import { useState, useEffect, Fragment } from 'react'

interface CalendarEvent {
  title: string
  currency: string
  date: string
  impact: string
  forecast: string
  previous: string
  flag: string
  countryName: string
}

interface CalendarResponse {
  events: CalendarEvent[]
  meetings: CalendarEvent[]
  count: number
  fetchedAt: string
}

function flagEmoji(code: string) {
  if (!code) return ''
  return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('')
}

function ImpactDot({ impact }: { impact: string }) {
  const color = impact === 'hoog' ? 'bg-red-500'
    : impact === 'medium' ? 'bg-amber-500'
    : impact === 'laag' ? 'bg-yellow-400'
    : impact === 'feestdag' ? 'bg-gray-500'
    : 'bg-gray-600'
  return <span className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
}

function ImpactBadge({ impact }: { impact: string }) {
  const color = impact === 'hoog' ? 'bg-red-500/15 text-red-400 border-red-500/20'
    : impact === 'medium' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    : impact === 'laag' ? 'bg-yellow-400/15 text-yellow-400 border-yellow-400/20'
    : 'bg-white/5 text-text-dim border-border'
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${color} capitalize`}>{impact}</span>
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD', 'CNY']

export default function KalenderPage() {
  const [data, setData] = useState<CalendarResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [impactFilter, setImpactFilter] = useState<'all' | 'high' | 'medium'>('medium')
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([])

  const fetchCalendar = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ impact: impactFilter })
      if (selectedCurrencies.length > 0) params.set('currencies', selectedCurrencies.join(','))
      const res = await fetch(`/api/calendar?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'API error')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fout bij ophalen')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCalendar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCurrency = (ccy: string) => {
    setSelectedCurrencies(prev =>
      prev.includes(ccy) ? prev.filter(c => c !== ccy) : [...prev, ccy]
    )
  }

  // Group events by date
  const groupedEvents: Record<string, CalendarEvent[]> = {}
  if (data) {
    for (const event of data.events) {
      // Parse date and create readable key
      let dateKey = 'Onbekend'
      try {
        const d = new Date(event.date)
        if (!isNaN(d.getTime())) {
          dateKey = d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
        }
      } catch { /* use raw */ }
      if (dateKey === 'Onbekend' && event.date) {
        dateKey = event.date.split('T')[0] || event.date.split(' ').slice(0, 3).join(' ')
      }
      if (!groupedEvents[dateKey]) groupedEvents[dateKey] = []
      groupedEvents[dateKey].push(event)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold text-heading mb-4">
          Economische Kalender
        </h1>
        <p className="text-sm sm:text-base text-text-muted max-w-lg mx-auto">
          Aankomende economische events en data releases die de markten beïnvloeden.
        </p>
      </div>

      {/* CB Meetings highlight */}
      {data && data.meetings.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-heading uppercase tracking-wider mb-3 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Aankomende rentebeslissingen
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.meetings.map((m, i) => (
              <div key={i} className="p-4 rounded-xl bg-bg-card border border-accent/20 flex items-center gap-3">
                <span className="text-2xl">{flagEmoji(m.flag)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-heading truncate">{m.title}</p>
                  <p className="text-xs text-text-dim">{m.date}</p>
                  {m.forecast && <p className="text-xs text-text-muted mt-0.5">Verwacht: {m.forecast} | Vorig: {m.previous}</p>}
                </div>
                <ImpactDot impact={m.impact} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="flex gap-1 bg-bg-card border border-border rounded-lg p-1">
          {([['all', 'Alles'], ['medium', 'Medium+'], ['high', 'Hoog']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setImpactFilter(val)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                impactFilter === val ? 'bg-accent text-white' : 'text-text-muted hover:text-heading'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 flex-wrap">
          {CURRENCIES.map(ccy => (
            <button
              key={ccy}
              onClick={() => toggleCurrency(ccy)}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                selectedCurrencies.length === 0 || selectedCurrencies.includes(ccy)
                  ? 'border-accent/40 bg-accent/10 text-accent-light'
                  : 'border-border text-text-dim hover:text-text-muted'
              }`}
            >
              {ccy}
            </button>
          ))}
        </div>

        <button
          onClick={fetchCalendar}
          disabled={loading}
          className="ml-auto px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-light text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? (
            <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          )}
          Ververs
        </button>
      </div>

      {data && (
        <div className="flex items-center gap-2 mb-4 text-xs text-text-dim">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          Opgehaald: {new Date(data.fetchedAt).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          <span>·</span>
          <span>{data.count} events</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm text-center">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <span className="inline-block w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Kalender ophalen...</p>
        </div>
      )}

      {/* Events table grouped by date */}
      {data && Object.keys(groupedEvents).length > 0 && (
        <div className="rounded-xl bg-bg-card border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider w-8">
                    <span className="sr-only">Impact</span>
                  </th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Valuta</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Event</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Impact</th>
                  <th className="text-right px-3 sm:px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Verwacht</th>
                  <th className="text-right px-3 sm:px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Vorig</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedEvents).map(([dateKey, events]) => (
                  <Fragment key={dateKey}>
                    <tr className="bg-bg/50">
                      <td colSpan={6} className="px-3 sm:px-4 py-2">
                        <span className="text-xs font-semibold text-accent-light uppercase tracking-wider">{dateKey}</span>
                      </td>
                    </tr>
                    {events.map((event, i) => (
                      <tr key={`${dateKey}-${i}`} className="border-b border-border/30 hover:bg-bg-hover transition-colors">
                        <td className="px-3 sm:px-4 py-2.5">
                          <ImpactDot impact={event.impact} />
                        </td>
                        <td className="px-3 sm:px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{flagEmoji(event.flag)}</span>
                            <span className="text-xs font-mono text-heading">{event.currency}</span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5">
                          <span className="text-sm text-heading">{event.title}</span>
                          <span className="text-[10px] text-text-dim ml-2 hidden md:inline">
                            {(() => { try { const d = new Date(event.date); return !isNaN(d.getTime()) ? d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '' } catch { return '' } })()}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 hidden sm:table-cell">
                          <ImpactBadge impact={event.impact} />
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-right">
                          <span className="text-sm text-text-muted font-mono">{event.forecast || '—'}</span>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-right">
                          <span className="text-sm text-text-dim font-mono">{event.previous || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && data.count === 0 && (
        <div className="text-center py-12">
          <p className="text-text-muted text-sm">Geen events gevonden met deze filters.</p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-xs text-text-muted">Hoge impact</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-xs text-text-muted">Medium impact</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="text-xs text-text-muted">Lage impact</span>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-xl bg-bg-card border border-border">
        <p className="text-xs text-text-dim text-center">
          Data bron: <a href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer" className="text-accent-light/60 hover:text-accent-light">ForexFactory / FairEconomy</a>.
          Tijden zijn in lokale servertijd. Dit is geen financieel advies.
        </p>
      </div>
    </div>
  )
}
