'use client'

import { useMemo, useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import { darkThemeDefaults, COLORS } from './ChartSetup'
import type { TsTrade, TsStrategy, TsSetup, TsAccount } from '../types'
import FilterManager from '../components/FilterManager'
import type { useCustomFilters } from '../hooks/useCustomFilters'

type CustomFiltersHook = ReturnType<typeof useCustomFilters>

interface Props {
  trades: TsTrade[]
  strategies: TsStrategy[]
  setups: TsSetup[]
  accounts: TsAccount[]
  customFilters: CustomFiltersHook
}

type Dimension = 'strategy' | 'setup' | 'symbol' | 'session' | 'day_of_week' | 'environment' | 'action' | 'account' | 'month' | 'emotion_before'

const DIMENSIONS: { id: Dimension; label: string }[] = [
  { id: 'strategy', label: 'Strategie' },
  { id: 'setup', label: 'Setup' },
  { id: 'symbol', label: 'Instrument' },
  { id: 'session', label: 'Sessie' },
  { id: 'day_of_week', label: 'Weekdag' },
  { id: 'action', label: 'Long vs Short' },
  { id: 'account', label: 'Account' },
  { id: 'environment', label: 'Omgeving' },
  { id: 'month', label: 'Maand' },
  { id: 'emotion_before', label: 'Emotie' },
]

interface GroupStats {
  label: string
  trades: number
  wins: number
  winRate: number
  totalPnl: number
  avgPnl: number
  avgR: number
  expectancy: number
  profitFactor: number
  bestTrade: number
  worstTrade: number
  avgHoldTime: number
  color?: string
}

function getGroupKey(trade: TsTrade, dim: Dimension, strategies: TsStrategy[], setups: TsSetup[], accounts: TsAccount[]): string {
  switch (dim) {
    case 'strategy':
      return strategies.find(s => s.id === trade.strategy_id)?.name || 'Geen strategie'
    case 'setup':
      return setups.find(s => s.id === trade.setup_id)?.name || 'Geen setup'
    case 'symbol':
      return trade.symbol
    case 'session':
      return trade.session || 'Onbekend'
    case 'day_of_week':
      return trade.day_of_week || 'Onbekend'
    case 'action':
      return trade.action === 'buy' ? 'Long' : 'Short'
    case 'account':
      return accounts.find(a => a.id === trade.account_id)?.name || 'Geen account'
    case 'environment':
      return trade.environment || 'live'
    case 'month': {
      const d = new Date(trade.open_date)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
    case 'emotion_before':
      return trade.emotion_before || 'Niet ingevuld'
    default:
      return 'Onbekend'
  }
}

export default function StrategyAnalysisTab({ trades, strategies, setups, accounts, customFilters }: Props) {
  const [dimension, setDimension] = useState<Dimension>('strategy')
  const [sortBy, setSortBy] = useState<'trades' | 'winRate' | 'totalPnl' | 'expectancy' | 'profitFactor'>('totalPnl')
  const [showFilterManager, setShowFilterManager] = useState(false)

  const closedTrades = useMemo(() => trades.filter(t => t.status === 'closed' && t.profit_loss !== null), [trades])

  // ── Custom Filter Analytics ──
  const filterAnalytics = useMemo(() => {
    if (customFilters.filters.length === 0 || closedTrades.length === 0) return []

    const results: { category: string; label: string; color: string | null; trades: number; wins: number; winRate: number; avgPnl: number; totalPnl: number; avgR: number; avgPips: number }[] = []

    for (const filter of customFilters.filters) {
      // Find trades that have this filter assigned
      const matchedTrades = closedTrades.filter(t =>
        customFilters.getTradeFilterIds(t.id).includes(filter.id)
      )
      if (matchedTrades.length === 0) continue

      const wins = matchedTrades.filter(t => (t.profit_loss || 0) > 0).length
      const totalPnl = matchedTrades.reduce((s, t) => s + (t.profit_loss || 0), 0)
      const avgR = matchedTrades.filter(t => t.result_r).reduce((s, t) => s + (t.result_r || 0), 0) / (matchedTrades.filter(t => t.result_r).length || 1)
      const avgPips = matchedTrades.filter(t => t.pips).reduce((s, t) => s + (t.pips || 0), 0) / (matchedTrades.filter(t => t.pips).length || 1)

      results.push({
        category: filter.category,
        label: filter.label,
        color: filter.color,
        trades: matchedTrades.length,
        wins,
        winRate: (wins / matchedTrades.length) * 100,
        avgPnl: totalPnl / matchedTrades.length,
        totalPnl,
        avgR,
        avgPips,
      })
    }

    return results
  }, [customFilters.filters, closedTrades, customFilters])

  const groups = useMemo(() => {
    const map = new Map<string, TsTrade[]>()
    closedTrades.forEach(t => {
      const key = getGroupKey(t, dimension, strategies, setups, accounts)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    })

    const stats: GroupStats[] = []
    map.forEach((groupTrades, label) => {
      const wins = groupTrades.filter(t => (t.profit_loss || 0) > 0).length
      const losses = groupTrades.filter(t => (t.profit_loss || 0) < 0).length
      const totalPnl = groupTrades.reduce((s, t) => s + (t.profit_loss || 0), 0)
      const totalWinPnl = groupTrades.filter(t => (t.profit_loss || 0) > 0).reduce((s, t) => s + (t.profit_loss || 0), 0)
      const totalLossPnl = Math.abs(groupTrades.filter(t => (t.profit_loss || 0) < 0).reduce((s, t) => s + (t.profit_loss || 0), 0))
      const avgR = groupTrades.filter(t => t.result_r).reduce((s, t) => s + (t.result_r || 0), 0) / (groupTrades.filter(t => t.result_r).length || 1)
      const avgHold = groupTrades.filter(t => t.holding_time_minutes).reduce((s, t) => s + (t.holding_time_minutes || 0), 0) / (groupTrades.filter(t => t.holding_time_minutes).length || 1)

      stats.push({
        label,
        trades: groupTrades.length,
        wins,
        winRate: groupTrades.length > 0 ? (wins / groupTrades.length) * 100 : 0,
        totalPnl,
        avgPnl: totalPnl / groupTrades.length,
        avgR,
        expectancy: totalPnl / groupTrades.length,
        profitFactor: totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? Infinity : 0,
        bestTrade: Math.max(...groupTrades.map(t => t.profit_loss || 0)),
        worstTrade: Math.min(...groupTrades.map(t => t.profit_loss || 0)),
        avgHoldTime: avgHold,
        color: dimension === 'strategy' ? strategies.find(s => s.name === label)?.color : undefined,
      })
    })

    stats.sort((a, b) => {
      switch (sortBy) {
        case 'trades': return b.trades - a.trades
        case 'winRate': return b.winRate - a.winRate
        case 'totalPnl': return b.totalPnl - a.totalPnl
        case 'expectancy': return b.expectancy - a.expectancy
        case 'profitFactor': return b.profitFactor - a.profitFactor
        default: return b.totalPnl - a.totalPnl
      }
    })

    return stats
  }, [closedTrades, dimension, strategies, setups, accounts, sortBy])

  // Chart data
  const chartData = useMemo(() => ({
    labels: groups.map(g => g.label),
    datasets: [{
      data: groups.map(g => g.totalPnl),
      backgroundColor: groups.map(g => g.totalPnl >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)'),
      borderColor: groups.map(g => g.totalPnl >= 0 ? '#22c55e' : '#ef4444'),
      borderWidth: 1,
      borderRadius: 4,
    }],
  }), [groups])

  const winRateChart = useMemo(() => ({
    labels: groups.map(g => g.label),
    datasets: [{
      data: groups.map(g => g.winRate),
      backgroundColor: groups.map((g, i) => g.color || `hsla(${(i * 40) + 200}, 60%, 55%, 0.6)`),
      borderWidth: 0,
      borderRadius: 4,
    }],
  }), [groups])

  // Group analytics by category
  const analyticsCategories = [...new Set(filterAnalytics.map(a => a.category))]

  return (
    <div>
      {/* Filter Manager toggle */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-display font-semibold text-heading">Strategy Analyse</h2>
          <p className="text-xs text-text-dim mt-0.5">Breakdown van performance per dimensie</p>
        </div>
        <button
          onClick={() => setShowFilterManager(!showFilterManager)}
          className={`px-3 py-1.5 rounded-lg text-xs border transition-colors flex items-center gap-1.5 ${
            showFilterManager ? 'bg-accent/15 text-accent-light border-accent/30' : 'text-text-muted border-border hover:text-heading hover:border-border-light'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Mijn Filters
        </button>
      </div>

      {/* Filter Manager */}
      {showFilterManager && (
        <div className="mb-8">
          <FilterManager
            categories={customFilters.categories}
            filtersByCategory={customFilters.filtersByCategory}
            onCreateFilter={customFilters.createFilter}
            onUpdateFilter={customFilters.updateFilter}
            onDeleteFilter={customFilters.deleteFilter}
            onDeleteCategory={customFilters.deleteCategory}
            onRenameCategory={customFilters.renameCategory}
          />
        </div>
      )}

      {/* Custom Filter Analytics */}
      {filterAnalytics.length > 0 && (
        <div className="mb-8">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-heading">Prestaties per filter</h3>
            <p className="text-xs text-text-dim mt-0.5">Hoe presteren je custom filters?</p>
          </div>
          {analyticsCategories.map(category => {
            const categoryData = filterAnalytics.filter(a => a.category === category)
            const best = categoryData.reduce((a, b) => a.totalPnl > b.totalPnl ? a : b)
            const worst = categoryData.reduce((a, b) => a.totalPnl < b.totalPnl ? a : b)
            return (
              <div key={category} className="mb-4">
                <h4 className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">{category}</h4>
                <div className="glass rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="px-3 py-2.5 text-left text-text-dim font-medium">Filter</th>
                          <th className="px-3 py-2.5 text-right text-text-dim font-medium">Trades</th>
                          <th className="px-3 py-2.5 text-right text-text-dim font-medium">Win Rate</th>
                          <th className="px-3 py-2.5 text-right text-text-dim font-medium">Avg Pips</th>
                          <th className="px-3 py-2.5 text-right text-text-dim font-medium">Avg R</th>
                          <th className="px-3 py-2.5 text-right text-text-dim font-medium">Totaal P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryData.sort((a, b) => b.totalPnl - a.totalPnl).map((row) => {
                          const isBest = row === best && categoryData.length > 1
                          const isWorst = row === worst && categoryData.length > 1 && worst.totalPnl < 0
                          return (
                            <tr key={row.label} className={`border-b border-white/[0.03] ${isBest ? 'bg-green-500/[0.03]' : isWorst ? 'bg-red-500/[0.03]' : 'hover:bg-white/[0.02]'}`}>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  {row.color && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />}
                                  <span className="text-heading font-medium">{row.label}</span>
                                  {isBest && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">beste</span>}
                                  {isWorst && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">slechtste</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right text-text-muted">{row.trades}</td>
                              <td className="px-3 py-2.5 text-right">
                                <span className={row.winRate >= 55 ? 'text-green-400' : row.winRate >= 45 ? 'text-amber-400' : 'text-red-400'}>
                                  {row.winRate.toFixed(1)}%
                                </span>
                              </td>
                              <td className={`px-3 py-2.5 text-right ${row.avgPips >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {row.avgPips >= 0 ? '+' : ''}{row.avgPips.toFixed(1)}
                              </td>
                              <td className="px-3 py-2.5 text-right text-text-muted">
                                {row.avgR ? `${row.avgR > 0 ? '+' : ''}${row.avgR.toFixed(2)}R` : '--'}
                              </td>
                              <td className={`px-3 py-2.5 text-right font-semibold ${row.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {row.totalPnl >= 0 ? '+' : ''}{row.totalPnl.toFixed(2)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {closedTrades.length === 0 && !showFilterManager && filterAnalytics.length === 0 && (
        <div className="text-center py-24">
          <p className="text-text-muted mb-2">Geen trades gevonden</p>
          <p className="text-sm text-text-dim">Voeg trades toe om strategy analyse te zien.</p>
        </div>
      )}

      {closedTrades.length > 0 && (
      <>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-sm font-semibold text-heading">Dimensie Analyse</h3>
          <p className="text-xs text-text-dim mt-0.5">Breakdown per categorie</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={dimension}
            onChange={(e) => setDimension(e.target.value as Dimension)}
            className="px-3 py-1.5 rounded-lg text-xs text-heading border border-border focus:border-accent/50 focus:outline-none cursor-pointer"
          >
            {DIMENSIONS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-1.5 rounded-lg text-xs text-heading border border-border focus:border-accent/50 focus:outline-none cursor-pointer"
          >
            <option value="totalPnl">Sorteer: P&L</option>
            <option value="winRate">Sorteer: Win Rate</option>
            <option value="trades">Sorteer: Trades</option>
            <option value="expectancy">Sorteer: Expectancy</option>
            <option value="profitFactor">Sorteer: Profit Factor</option>
          </select>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="glass rounded-xl p-4">
          <h3 className="text-xs font-semibold text-heading mb-3">P&L per {DIMENSIONS.find(d => d.id === dimension)?.label}</h3>
          <div style={{ height: Math.max(200, groups.length * 35) }}>
            <Bar data={chartData} options={{ ...darkThemeDefaults, indexAxis: 'y' as const, plugins: { ...darkThemeDefaults.plugins, legend: { display: false } } }} />
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <h3 className="text-xs font-semibold text-heading mb-3">Win Rate per {DIMENSIONS.find(d => d.id === dimension)?.label}</h3>
          <div style={{ height: Math.max(200, groups.length * 35) }}>
            <Bar data={winRateChart} options={{ ...darkThemeDefaults, indexAxis: 'y' as const, scales: { x: { ...darkThemeDefaults.scales?.x, max: 100, ticks: { ...darkThemeDefaults.scales?.x?.ticks, callback: (v: unknown) => `${v}%` } } }, plugins: { ...darkThemeDefaults.plugins, legend: { display: false } } }} />
          </div>
        </div>
      </div>

      {/* Detailed table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-3 py-2.5 text-left text-text-dim font-medium">{DIMENSIONS.find(d => d.id === dimension)?.label}</th>
                <th className="px-3 py-2.5 text-right text-text-dim font-medium">Trades</th>
                <th className="px-3 py-2.5 text-right text-text-dim font-medium">Win Rate</th>
                <th className="px-3 py-2.5 text-right text-text-dim font-medium">P&L</th>
                <th className="px-3 py-2.5 text-right text-text-dim font-medium">Avg P&L</th>
                <th className="px-3 py-2.5 text-right text-text-dim font-medium hidden sm:table-cell">Avg R</th>
                <th className="px-3 py-2.5 text-right text-text-dim font-medium hidden sm:table-cell">Profit Factor</th>
                <th className="px-3 py-2.5 text-right text-text-dim font-medium hidden md:table-cell">Beste</th>
                <th className="px-3 py-2.5 text-right text-text-dim font-medium hidden md:table-cell">Slechtste</th>
                <th className="px-3 py-2.5 text-right text-text-dim font-medium hidden lg:table-cell">Gem. duur</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, i) => (
                <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {g.color && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />}
                      <span className="text-heading font-medium">{g.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-text-muted">{g.trades}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={g.winRate >= 55 ? 'text-green-400' : g.winRate >= 45 ? 'text-amber-400' : 'text-red-400'}>
                      {g.winRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className={`px-3 py-2.5 text-right font-semibold ${g.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {g.totalPnl >= 0 ? '+' : ''}{g.totalPnl.toFixed(2)}
                  </td>
                  <td className={`px-3 py-2.5 text-right ${g.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {g.avgPnl >= 0 ? '+' : ''}{g.avgPnl.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-text-muted hidden sm:table-cell">
                    {g.avgR ? `${g.avgR > 0 ? '+' : ''}${g.avgR.toFixed(2)}R` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right hidden sm:table-cell">
                    <span className={g.profitFactor >= 1.5 ? 'text-green-400' : g.profitFactor >= 1 ? 'text-amber-400' : 'text-red-400'}>
                      {g.profitFactor === Infinity ? '∞' : g.profitFactor.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-green-400 hidden md:table-cell">+{g.bestTrade.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-red-400 hidden md:table-cell">{g.worstTrade.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-text-dim hidden lg:table-cell">{formatDuration(g.avgHoldTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key insights */}
      {groups.length >= 2 && (
        <div className="mt-6 glass rounded-xl p-4">
          <h3 className="text-xs font-semibold text-heading mb-3">Inzichten</h3>
          <div className="space-y-2 text-xs">
            {(() => {
              const best = groups.reduce((a, b) => a.totalPnl > b.totalPnl ? a : b)
              const worst = groups.reduce((a, b) => a.totalPnl < b.totalPnl ? a : b)
              const highestWR = groups.filter(g => g.trades >= 5).reduce((a, b) => a.winRate > b.winRate ? a : b, groups[0])
              const bestPF = groups.filter(g => g.trades >= 5 && g.profitFactor !== Infinity).reduce((a, b) => a.profitFactor > b.profitFactor ? a : b, groups[0])

              return (
                <>
                  <Insight type="positive" text={`Beste ${DIMENSIONS.find(d => d.id === dimension)?.label?.toLowerCase()}: "${best.label}" met +$${best.totalPnl.toFixed(2)} over ${best.trades} trades`} />
                  {worst.totalPnl < 0 && <Insight type="negative" text={`Slechtste: "${worst.label}" met $${worst.totalPnl.toFixed(2)} verlies over ${worst.trades} trades`} />}
                  {highestWR && highestWR.trades >= 5 && <Insight type="info" text={`Hoogste win rate: "${highestWR.label}" met ${highestWR.winRate.toFixed(1)}% (${highestWR.trades} trades)`} />}
                  {bestPF && bestPF.trades >= 5 && bestPF.profitFactor > 1 && <Insight type="positive" text={`Beste profit factor: "${bestPF.label}" met ${bestPF.profitFactor.toFixed(2)}`} />}
                  {groups.some(g => g.trades < 5) && <Insight type="warning" text={`${groups.filter(g => g.trades < 5).length} groep(en) met minder dan 5 trades : statistisch niet betrouwbaar`} />}
                </>
              )
            })()}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}

function Insight({ type, text }: { type: 'positive' | 'negative' | 'warning' | 'info'; text: string }) {
  const colors = {
    positive: 'bg-green-500/10 text-green-400 border-green-500/20',
    negative: 'bg-red-500/10 text-red-400 border-red-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    info: 'bg-accent/10 text-accent-light border-accent/20',
  }
  const icons = {
    positive: '↑',
    negative: '↓',
    warning: '⚠',
    info: 'ℹ',
  }
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${colors[type]}`}>
      <span className="font-bold">{icons[type]}</span>
      <span>{text}</span>
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
