'use client'

import { useMemo, useState } from 'react'
import type { TsTrade, TsStrategy, TsSetup } from '../types'

interface Props {
  trades: TsTrade[]
  strategies: TsStrategy[]
  setups: TsSetup[]
}

interface PlaybookEntry {
  key: string
  label: string
  strategy?: TsStrategy
  setup?: TsSetup
  trades: TsTrade[]
  wins: number
  losses: number
  winRate: number
  totalPnl: number
  avgPnl: number
  avgR: number
  avgQuality: number
  avgDuration: number
  profitFactor: number
  bestConditions: string[]
  commonMistakes: string[]
  rules: string[]
}

export default function PlaybookTab({ trades, strategies, setups }: Props) {
  const [view, setView] = useState<'strategies' | 'setups'>('strategies')
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)

  const closed = useMemo(() => trades.filter(t => t.status === 'closed' && t.profit_loss !== null), [trades])

  const entries = useMemo((): PlaybookEntry[] => {
    const groups = new Map<string, TsTrade[]>()

    closed.forEach(t => {
      const key = view === 'strategies'
        ? (t.strategy_id || 'no-strategy')
        : (t.setup_id || 'no-setup')
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    })

    return Array.from(groups.entries())
      .filter(([, tds]) => tds.length >= 3) // min 3 trades for playbook
      .map(([key, tds]): PlaybookEntry => {
        const strategy = view === 'strategies' ? strategies.find(s => s.id === key) : undefined
        const setup = view === 'setups' ? setups.find(s => s.id === key) : undefined
        const wins = tds.filter(t => (t.profit_loss || 0) > 0)
        const losses = tds.filter(t => (t.profit_loss || 0) <= 0)
        const totalPnl = tds.reduce((s, t) => s + (t.profit_loss || 0), 0)
        const avgPnl = totalPnl / tds.length
        const avgR = tds.filter(t => t.result_r !== null).reduce((s, t) => s + (t.result_r || 0), 0) / (tds.filter(t => t.result_r !== null).length || 1)
        const avgQuality = tds.filter(t => t.trade_quality !== null).reduce((s, t) => s + (t.trade_quality || 0), 0) / (tds.filter(t => t.trade_quality !== null).length || 1)
        const avgDuration = tds.filter(t => t.holding_time_minutes !== null).reduce((s, t) => s + (t.holding_time_minutes || 0), 0) / (tds.filter(t => t.holding_time_minutes !== null).length || 1)
        const grossProfit = wins.reduce((s, t) => s + (t.profit_loss || 0), 0)
        const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.profit_loss || 0), 0))
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

        // Best conditions: most common session/day among winners
        const winSessions = new Map<string, number>()
        const winDays = new Map<string, number>()
        wins.forEach(t => {
          if (t.session) winSessions.set(t.session, (winSessions.get(t.session) || 0) + 1)
          if (t.day_of_week) winDays.set(t.day_of_week, (winDays.get(t.day_of_week) || 0) + 1)
        })
        const bestConditions: string[] = []
        const topSession = [...winSessions.entries()].sort((a, b) => b[1] - a[1])[0]
        if (topSession && topSession[1] >= 2) bestConditions.push(`Beste sessie: ${topSession[0]}`)
        const topDay = [...winDays.entries()].sort((a, b) => b[1] - a[1])[0]
        if (topDay && topDay[1] >= 2) bestConditions.push(`Beste dag: ${topDay[0]}`)

        // Common mistakes
        const mistakes: string[] = []
        const impulsiveCount = tds.filter(t => t.was_impulsive).length
        const revengeCount = tds.filter(t => t.was_revenge).length
        const rulesNotFollowed = tds.filter(t => t.rules_followed === false).length
        if (impulsiveCount > 0) mistakes.push(`Impulsief: ${impulsiveCount}x`)
        if (revengeCount > 0) mistakes.push(`Revenge: ${revengeCount}x`)
        if (rulesNotFollowed > 0) mistakes.push(`Regels gebroken: ${rulesNotFollowed}x`)

        // Rules from strategy
        const rules: string[] = []
        if (strategy?.rules) {
          rules.push(...strategy.rules.split('\n').filter(r => r.trim()))
        }

        return {
          key,
          label: strategy?.name || setup?.name || (view === 'strategies' ? 'Geen strategie' : 'Geen setup'),
          strategy,
          setup,
          trades: tds,
          wins: wins.length,
          losses: losses.length,
          winRate: (wins.length / tds.length) * 100,
          totalPnl,
          avgPnl,
          avgR,
          avgQuality,
          avgDuration,
          profitFactor,
          bestConditions,
          commonMistakes: mistakes,
          rules,
        }
      })
      .sort((a, b) => b.totalPnl - a.totalPnl)
  }, [closed, view, strategies, setups])

  const gradeEntry = (e: PlaybookEntry): { grade: string; color: string } => {
    let score = 0
    if (e.winRate >= 60) score += 3
    else if (e.winRate >= 50) score += 2
    else if (e.winRate >= 40) score += 1
    if (e.profitFactor >= 2) score += 3
    else if (e.profitFactor >= 1.5) score += 2
    else if (e.profitFactor >= 1) score += 1
    if (e.avgR >= 1.5) score += 2
    else if (e.avgR >= 1) score += 1
    if (e.trades.length >= 20) score += 1

    if (score >= 8) return { grade: 'A+', color: 'text-green-400' }
    if (score >= 6) return { grade: 'A', color: 'text-green-400' }
    if (score >= 5) return { grade: 'B', color: 'text-blue-400' }
    if (score >= 3) return { grade: 'C', color: 'text-amber-400' }
    return { grade: 'D', color: 'text-red-400' }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-semibold text-heading">Playbook</h2>
          <p className="text-xs text-text-dim mt-1">Je beste strategieën en setups op basis van historische data</p>
        </div>
        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView('strategies')}
            className={`px-3 py-1.5 text-xs transition-colors ${view === 'strategies' ? 'bg-accent/15 text-accent-light' : 'text-text-muted hover:text-heading'}`}
          >
            Strategieën
          </button>
          <button
            onClick={() => setView('setups')}
            className={`px-3 py-1.5 text-xs transition-colors ${view === 'setups' ? 'bg-accent/15 text-accent-light' : 'text-text-muted hover:text-heading'}`}
          >
            Setups
          </button>
        </div>
      </div>

      {entries.length === 0 && (
        <div className="text-center py-16">
          <p className="text-text-muted mb-2">Niet genoeg data</p>
          <p className="text-xs text-text-dim">Minimaal 3 trades per {view === 'strategies' ? 'strategie' : 'setup'} nodig voor het playbook.</p>
        </div>
      )}

      {/* Playbook cards */}
      <div className="space-y-3">
        {entries.map(entry => {
          const { grade, color } = gradeEntry(entry)
          const isExpanded = expandedEntry === entry.key

          return (
            <div key={entry.key} className="rounded-xl glass overflow-hidden">
              {/* Card header */}
              <button
                onClick={() => setExpandedEntry(isExpanded ? null : entry.key)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className={`text-2xl font-display font-bold ${color}`}>{grade}</span>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      {entry.strategy?.color && (
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.strategy.color }} />
                      )}
                      <span className="text-sm font-medium text-heading">{entry.label}</span>
                    </div>
                    <span className="text-xs text-text-dim">{entry.trades.length} trades</span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-text-dim">Win Rate</div>
                    <div className={`text-sm font-medium ${entry.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                      {entry.winRate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-text-dim">Profit Factor</div>
                    <div className="text-sm font-medium text-heading">{entry.profitFactor === Infinity ? '∞' : entry.profitFactor.toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-text-dim">P&L</div>
                    <div className={`text-sm font-medium ${entry.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${entry.totalPnl.toFixed(2)}
                    </div>
                  </div>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`text-text-dim transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-border">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4">
                    <Stat label="Win / Loss" value={`${entry.wins} / ${entry.losses}`} />
                    <Stat label="Gem. P&L" value={`$${entry.avgPnl.toFixed(2)}`} color={entry.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'} />
                    <Stat label="Gem. R" value={entry.avgR.toFixed(2)} />
                    <Stat label="Gem. Kwaliteit" value={entry.avgQuality > 0 ? `${entry.avgQuality.toFixed(1)}/5` : '—'} />
                    <Stat label="Gem. Duur" value={formatDuration(entry.avgDuration)} />
                    <Stat label="Win Rate" value={`${entry.winRate.toFixed(1)}%`} color={entry.winRate >= 50 ? 'text-green-400' : 'text-red-400'} />
                    <Stat label="Profit Factor" value={entry.profitFactor === Infinity ? '∞' : entry.profitFactor.toFixed(2)} />
                    <Stat label="Totaal P&L" value={`$${entry.totalPnl.toFixed(2)}`} color={entry.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'} />
                  </div>

                  {/* Best conditions */}
                  {entry.bestConditions.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-heading mb-2 flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400"><polyline points="20 6 9 17 4 12" /></svg>
                        Beste omstandigheden
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {entry.bestConditions.map((c, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Common mistakes */}
                  {entry.commonMistakes.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-medium text-heading mb-2 flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                        Veelgemaakte fouten
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {entry.commonMistakes.map((m, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strategy rules */}
                  {entry.rules.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-heading mb-2 flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-light"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                        Regels
                      </h4>
                      <ul className="space-y-1">
                        {entry.rules.map((r, i) => (
                          <li key={i} className="text-xs text-text-muted flex items-start gap-2">
                            <span className="text-accent-light mt-0.5">•</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recent trades preview */}
                  <div className="mt-4">
                    <h4 className="text-xs font-medium text-heading mb-2">Laatste 5 trades</h4>
                    <div className="space-y-1">
                      {entry.trades.slice(-5).reverse().map(t => (
                        <div key={t.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-md bg-white/[0.02]">
                          <div className="flex items-center gap-3">
                            <span className={`w-1.5 h-1.5 rounded-full ${(t.profit_loss || 0) > 0 ? 'bg-green-400' : 'bg-red-400'}`} />
                            <span className="text-text-muted">{t.symbol}</span>
                            <span className="text-text-dim uppercase">{t.action}</span>
                            <span className="text-text-dim">{new Date(t.open_date).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })}</span>
                          </div>
                          <span className={`font-medium ${(t.profit_loss || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${(t.profit_loss || 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-xs text-text-dim">{label}</div>
      <div className={`text-sm font-medium ${color || 'text-heading'}`}>{value}</div>
    </div>
  )
}

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '—'
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}u ${m}m` : `${h}u`
}
