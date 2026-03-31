'use client'

import { useState, useEffect } from 'react'

interface RateData {
  currency: string
  country: string
  bank: string
  rate: number | null
  target: number | null
  flag: string
  source: string
  sourceUrl: string
  lastMove: string
  nextMeeting: string
  bias: string
}

interface RatesResponse {
  rates: RateData[]
  generatedAt: string
  count: number
  error?: string
}

interface MeetingEvent {
  title: string
  currency: string
  date: string
  impact: string
  flag: string
}

// Flag emoji helper from country code
function flagEmoji(code: string) {
  if (!code) return ''
  return code
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}

function BiasTag({ bias }: { bias: string }) {
  if (!bias) return null
  const isHawkish = bias.includes('verkrappend')
  const isDovish = bias.includes('verruimend')
  const color = isHawkish ? 'bg-green-500/15 text-green-400 border-green-500/20'
    : isDovish ? 'bg-red-500/15 text-red-400 border-red-500/20'
    : 'bg-white/5 text-text-dim border-border'
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${color}`}>{bias}</span>
  )
}

function TargetIndicator({ rate, target }: { rate: number | null; target: number | null }) {
  if (rate === null || target === null) return null
  const diff = rate - target
  if (diff === 0) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded border bg-white/5 text-text-dim border-border">
      = target {target}%
    </span>
  )
  const above = diff > 0
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
      above
        ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
        : 'bg-blue-500/15 text-blue-400 border-blue-500/20'
    }`}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {above
          ? <polyline points="18 15 12 9 6 15" />
          : <polyline points="6 9 12 15 18 9" />
        }
      </svg>
      {above ? '+' : ''}{diff.toFixed(2)}% vs target {target}%
    </span>
  )
}

export default function RentePage() {
  const [data, setData] = useState<RatesResponse | null>(null)
  const [meetings, setMeetings] = useState<MeetingEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRates = async () => {
    setLoading(true)
    setError(null)
    try {
      const [ratesRes, meetingsRes] = await Promise.all([
        fetch('/api/rates'),
        fetch('/api/rates/meetings'),
      ])
      const ratesJson = await ratesRes.json()
      if (!ratesRes.ok || ratesJson.error) throw new Error(ratesJson.error || `API error: ${ratesRes.status}`)
      setData(ratesJson)

      if (meetingsRes.ok) {
        const meetingsJson = await meetingsRes.json()
        const meetingsList: MeetingEvent[] = Object.entries(meetingsJson.meetings || {}).map(
          ([ccy, m]) => ({ currency: ccy, ...(m as { date: string; title: string }), impact: 'hoog', flag: ratesJson.rates?.find((r: RateData) => r.currency === ccy)?.flag || '' })
        )
        setMeetings(meetingsList)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch on mount
  useEffect(() => { fetchRates() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const majors = data?.rates.filter(r =>
    ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'].includes(r.currency)
  ) || []
  const others = data?.rates.filter(r =>
    !['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'].includes(r.currency)
  ) || []

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      <div className="text-center mb-10">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold text-heading mb-4">
          Rentetarieven Centrale Banken
        </h1>
        <p className="text-sm sm:text-base text-text-muted max-w-lg mx-auto mb-6">
          Overzicht van de actuele beleidsrentes van de belangrijkste centrale banken wereldwijd.
        </p>

        <button
          onClick={fetchRates}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Ophalen...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {data ? 'Ververs rentetarieven' : 'Rentetarieven ophalen'}
            </>
          )}
        </button>

        {data && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-card border border-border">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-text-dim">
              Opgehaald: {new Date(data.generatedAt).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-xs text-text-dim">·</span>
            <span className="text-xs text-text-dim">{data.count} landen</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm text-center">
          {error}
        </div>
      )}

      {!data && !loading && !error && (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <span className="inline-block w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Rentetarieven ophalen...</p>
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <span className="inline-block w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Rentetarieven ophalen...</p>
        </div>
      )}

      {data && (
        <>
          {/* Major currencies highlight */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-10">
            {majors.map((item) => (
              <a key={item.currency} href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="p-4 rounded-xl bg-bg-card border border-border text-center hover:border-border-light transition-colors group block">
                <p className="text-2xl mb-1">{flagEmoji(item.flag)}</p>
                <p className="text-xs text-text-muted mb-1">{item.currency}</p>
                <p className="text-xl font-display font-semibold text-heading">
                  {item.rate !== null ? `${item.rate}%` : '—'}
                </p>
                <p className="text-xs text-text-dim mt-1">{item.bank.split('(')[0].trim()}</p>
                {item.target !== null && (
                  <p className="text-[10px] text-text-dim mt-1.5">Target: {item.target}%</p>
                )}
                <div className="mt-1.5 flex flex-col items-center gap-1">
                  <TargetIndicator rate={item.rate} target={item.target} />
                  {item.bias && <BiasTag bias={item.bias} />}
                </div>
                <p className="text-[10px] text-accent-light/0 group-hover:text-accent-light/70 transition-colors mt-1.5 flex items-center justify-center gap-1">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Bron
                </p>
              </a>
            ))}
          </div>

          {/* Upcoming meetings */}
          {meetings.length > 0 && (
            <div className="mb-10">
              <h2 className="text-sm font-semibold text-heading uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Aankomende rentebeslissingen (komende 2 weken)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {meetings.map((m) => {
                  const rateInfo = data?.rates.find(r => r.currency === m.currency)
                  return (
                    <div key={m.currency} className="p-4 rounded-xl bg-bg-card border border-accent/20 flex items-center gap-3">
                      <span className="text-2xl">{flagEmoji(m.flag)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-heading">{m.currency}</span>
                          {rateInfo?.bias && <BiasTag bias={rateInfo.bias} />}
                        </div>
                        <p className="text-xs text-text-muted truncate">{m.title}</p>
                        <p className="text-xs text-text-dim mt-0.5">
                          {(() => { try { return new Date(m.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) } catch { return m.date } })()}
                        </p>
                        {rateInfo && rateInfo.rate !== null && (
                          <p className="text-[10px] text-text-dim mt-0.5">
                            Huidige rente: {rateInfo.rate}% {rateInfo.target !== null ? `· Target: ${rateInfo.target}%` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Upcoming meetings from rate data (when no calendar meetings found) */}
          {meetings.length === 0 && data?.rates.some(r => r.nextMeeting) && (
            <div className="mb-10">
              <h2 className="text-sm font-semibold text-heading uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Volgende vergaderingen
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {majors.filter(r => r.nextMeeting).map((r) => (
                  <div key={r.currency} className="p-3 rounded-lg bg-bg-card border border-border text-center">
                    <span className="text-lg">{flagEmoji(r.flag)}</span>
                    <p className="text-xs font-semibold text-heading mt-1">{r.currency}</p>
                    <p className="text-[10px] text-text-dim">{r.nextMeeting}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full table */}
          <div className="rounded-xl bg-bg-card border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-2 sm:px-4 md:px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Land</th>
                    <th className="text-left px-2 sm:px-4 md:px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Centrale Bank</th>
                    <th className="text-left px-2 sm:px-4 md:px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Valuta</th>
                    <th className="text-right px-2 sm:px-4 md:px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Rente</th>
                    <th className="text-right px-2 sm:px-4 md:px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Target</th>
                    <th className="text-center px-2 sm:px-4 md:px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">vs Target</th>
                    <th className="text-left px-2 sm:px-4 md:px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Laatste actie</th>
                    <th className="text-left px-2 sm:px-4 md:px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden lg:table-cell">Bias</th>
                    <th className="text-center px-2 sm:px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Bron</th>
                  </tr>
                </thead>
                <tbody>
                  {[...majors, ...others].map((item) => (
                    <tr key={item.currency} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{flagEmoji(item.flag)}</span>
                          <span className="text-sm text-heading">{item.country}</span>
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3.5 text-sm text-text-muted">{item.bank}</td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3.5">
                        <span className="px-2 py-0.5 rounded bg-bg border border-border text-xs font-mono text-heading">{item.currency}</span>
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3.5 text-right">
                        <span className="text-sm font-semibold text-heading">
                          {item.rate !== null ? `${item.rate}%` : '—'}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3.5 text-right hidden sm:table-cell">
                        <span className="text-sm text-text-dim">
                          {item.target !== null ? `${item.target}%` : '—'}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3.5 text-center hidden sm:table-cell">
                        {item.rate !== null && item.target !== null ? (() => {
                          const diff = item.rate - item.target
                          if (diff === 0) return <span className="text-[11px] text-text-dim">Op target</span>
                          const above = diff > 0
                          return (
                            <span className={`text-[11px] inline-flex items-center gap-0.5 ${above ? 'text-amber-400' : 'text-blue-400'}`}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                {above
                                  ? <polyline points="18 15 12 9 6 15" />
                                  : <polyline points="6 9 12 15 18 9" />
                                }
                              </svg>
                              {above ? '+' : ''}{diff.toFixed(2)}%
                            </span>
                          )
                        })() : '—'}
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3.5 text-xs text-text-dim hidden md:table-cell">
                        {item.lastMove || '—'}
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3.5 hidden lg:table-cell">
                        <BiasTag bias={item.bias} />
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3.5 text-center">
                        {item.sourceUrl ? (
                          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-accent-light/60 hover:text-accent-light transition-colors">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                            Officieel
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-bg-card border border-border">
            <p className="text-xs text-text-dim text-center">
              Rentetarieven worden opgehaald uit onze centrale bank database en waar mogelijk aangevuld met live data.
              Raadpleeg de officiële websites van de centrale banken voor de meest actuele informatie.
              Dit is geen financieel advies.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
