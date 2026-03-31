'use client'

import { useMemo, useState } from 'react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import type { ParsedTrade } from '../utils/csvParser'
import type { TradeMetrics } from '../utils/metrics'
import { darkThemeDefaults, COLORS } from './ChartSetup'

interface Props {
  trades: ParsedTrade[]
  metrics: TradeMetrics
  startingBalance: number
}

function MetricCard({ label, value, sub, color, tooltip }: { label: string; value: string; sub?: string; color?: string; tooltip?: string }) {
  return (
    <div className="p-4 rounded-xl glass relative group">
      <p className="text-xs text-text-dim mb-1 flex items-center gap-1">
        {label}
        {tooltip && (
          <span className="cursor-help">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim/50">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 px-3 py-2 rounded-lg bg-bg-elevated border border-border shadow-xl text-xs text-text-muted max-w-[200px] leading-relaxed whitespace-normal font-normal">
              {tooltip}
            </span>
          </span>
        )}
      </p>
      <p className={`text-lg font-semibold ${color || 'text-heading'}`}>{value}</p>
      {sub && <p className="text-xs text-text-dim mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-heading">{title}</h3>
      <p className="text-xs text-text-dim mt-0.5">{desc}</p>
    </div>
  )
}

function formatMoney(n: number): string {
  const prefix = n >= 0 ? '+$' : '-$'
  return prefix + Math.abs(n).toFixed(2)
}

function formatPct(n: number): string {
  return n.toFixed(1) + '%'
}

export default function DashboardTab({ trades, metrics, startingBalance }: Props) {
  // Equity chart data
  const equityData = useMemo(() => ({
    labels: metrics.equityCurve.map((_, i) => (i === 0 ? 'Start' : `#${i}`)),
    datasets: [
      {
        label: 'Equity',
        data: metrics.equityCurve.map((p) => p.equity),
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(61,110,165,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  }), [metrics])

  // Drawdown chart
  const drawdownData = useMemo(() => ({
    labels: metrics.drawdownCurve.map((_, i) => `#${i + 1}`),
    datasets: [
      {
        label: 'Drawdown %',
        data: metrics.drawdownCurve.map((p) => p.drawdown),
        borderColor: COLORS.red,
        backgroundColor: 'rgba(239,68,68,0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.5,
      },
    ],
  }), [metrics])

  // PnL per trade bar chart
  const pnlBarData = useMemo(() => ({
    labels: trades.map((_, i) => `#${i + 1}`),
    datasets: [
      {
        label: 'P/L',
        data: trades.map((t) => t.profitLoss),
        backgroundColor: trades.map((t) => t.profitLoss >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)'),
        borderRadius: 2,
      },
    ],
  }), [trades])

  // Win/Loss doughnut
  const winLossData = useMemo(() => ({
    labels: ['Wins', 'Losses', 'Breakeven'],
    datasets: [
      {
        data: [metrics.wins, metrics.losses, metrics.breakeven],
        backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(239,68,68,0.8)', 'rgba(90,97,120,0.5)'],
        borderWidth: 0,
      },
    ],
  }), [metrics])

  // RR distribution
  const rrBuckets = useMemo(() => {
    const buckets: Record<string, number> = { '<0.5': 0, '0.5-1': 0, '1-1.5': 0, '1.5-2': 0, '2-3': 0, '3+': 0 }
    trades.forEach((t) => {
      if (t.riskReward === null) return
      const rr = t.riskReward
      if (rr < 0.5) buckets['<0.5']++
      else if (rr < 1) buckets['0.5-1']++
      else if (rr < 1.5) buckets['1-1.5']++
      else if (rr < 2) buckets['1.5-2']++
      else if (rr < 3) buckets['2-3']++
      else buckets['3+']++
    })
    return buckets
  }, [trades])

  // Day of week chart
  const dayData = useMemo(() => {
    const days = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag']
    const dayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr']
    return {
      labels: dayLabels,
      datasets: [
        {
          label: 'P/L',
          data: days.map((d) => metrics.dayStats[d]?.pnl || 0),
          backgroundColor: days.map((d) => (metrics.dayStats[d]?.pnl || 0) >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)'),
          borderRadius: 4,
        },
      ],
    }
  }, [metrics])

  // Long vs Short doughnut
  const longShortData = useMemo(() => ({
    labels: ['Long', 'Short'],
    datasets: [
      {
        data: [metrics.totalLongs, metrics.totalShorts],
        backgroundColor: ['rgba(61,110,165,0.8)', 'rgba(184,147,90,0.8)'],
        borderWidth: 0,
      },
    ],
  }), [metrics])

  // ── Profit Calendar: grouped by month ──
  const calendarMonths = useMemo(() => {
    const entries = Object.entries(metrics.dailyPnL).sort(([a], [b]) => a.localeCompare(b))
    if (entries.length === 0) return []

    // Group by month
    const monthMap = new Map<string, { dateStr: string; pnl: number }[]>()
    entries.forEach(([dateStr, pnl]) => {
      const key = dateStr.slice(0, 7) // "2023-03"
      if (!monthMap.has(key)) monthMap.set(key, [])
      monthMap.get(key)!.push({ dateStr, pnl })
    })

    return Array.from(monthMap.entries()).map(([monthKey, days]) => {
      const [year, month] = monthKey.split('-').map(Number)
      const monthName = new Date(year, month - 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
      const totalPnL = days.reduce((s, d) => s + d.pnl, 0)
      const winDays = days.filter((d) => d.pnl > 0).length
      const lossDays = days.filter((d) => d.pnl < 0).length

      // Build full month grid
      const firstDay = new Date(year, month - 1, 1)
      const daysInMonth = new Date(year, month, 0).getDate()
      // Monday = 0 start
      let startCol = firstDay.getDay() - 1
      if (startCol < 0) startCol = 6

      const dayMap = new Map(days.map((d) => [d.dateStr, d.pnl]))
      const maxPnl = Math.max(...days.map((d) => Math.abs(d.pnl)), 1)

      const gridCells: { day: number; pnl: number | null; dateStr: string }[] = []
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        gridCells.push({ day: d, pnl: dayMap.has(ds) ? dayMap.get(ds)! : null, dateStr: ds })
      }

      return { monthKey, monthName, totalPnL, winDays, lossDays, startCol, gridCells, maxPnl }
    })
  }, [metrics])

  const pnlColor = metrics.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'

  return (
    <div className="space-y-6">
      {/* Top metrics bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Totaal P/L"
          value={formatMoney(metrics.totalPnL)}
          color={pnlColor}
          tooltip="De totale winst of verlies over alle trades heen."
        />
        <MetricCard
          label="Win Rate"
          value={formatPct(metrics.winRate)}
          sub={`${metrics.wins}W / ${metrics.losses}L`}
          tooltip="Percentage winstgevende trades. Boven 50% is goed, maar hangt af van je R:R."
        />
        <MetricCard
          label="Profit Factor"
          value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
          tooltip="Totale winst gedeeld door totaal verlies. Boven 1.5 is degelijk, boven 2.0 is sterk."
        />
        <MetricCard
          label="Expectancy"
          value={formatMoney(metrics.expectancy)}
          color={metrics.expectancy >= 0 ? 'text-green-400' : 'text-red-400'}
          tooltip="Het gemiddelde bedrag dat je per trade kunt verwachten te verdienen."
        />
        <MetricCard
          label="Max Drawdown"
          value={formatPct(metrics.maxDrawdownPercent)}
          sub={`$${metrics.maxDrawdown.toFixed(2)}`}
          color="text-red-400"
          tooltip="De grootste daling vanaf een piek in je equity. Onder 20% is gezond."
        />
        <MetricCard
          label="Sharpe Ratio"
          value={metrics.sharpeRatio.toFixed(2)}
          tooltip="Risico-gecorrigeerd rendement. Boven 1.0 is goed, boven 2.0 is uitstekend."
        />
      </div>

      {/* Equity curve + Drawdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl glass">
          <SectionHeader title="Equity Curve" desc="Verloop van je balans per trade. Stijgend = winstgevend." />
          <div className="h-64">
            <Line
              data={equityData}
              options={{
                ...darkThemeDefaults,
                plugins: {
                  ...darkThemeDefaults.plugins,
                  tooltip: {
                    ...darkThemeDefaults.plugins?.tooltip,
                    callbacks: {
                      label: (ctx) => `$${(ctx.raw as number).toFixed(2)}`,
                    },
                  },
                },
              } as never}
            />
          </div>
        </div>
        <div className="p-5 rounded-xl glass">
          <SectionHeader title="Drawdown" desc="Hoe ver je balans zakt vanaf de hoogste piek. Hoe dichter bij 0%, hoe beter." />
          <div className="h-64">
            <Line
              data={drawdownData}
              options={{
                ...darkThemeDefaults,
                plugins: {
                  ...darkThemeDefaults.plugins,
                  tooltip: {
                    ...darkThemeDefaults.plugins?.tooltip,
                    callbacks: {
                      label: (ctx) => `${(ctx.raw as number).toFixed(2)}%`,
                    },
                  },
                },
              } as never}
            />
          </div>
        </div>
      </div>

      {/* PnL per trade */}
      <div className="p-5 rounded-xl glass">
        <SectionHeader title="P/L per Trade" desc="Winst of verlies per individuele trade. Groen = winst, rood = verlies." />
        <div className="h-48">
          <Bar
            data={pnlBarData}
            options={{
              ...darkThemeDefaults,
              plugins: {
                ...darkThemeDefaults.plugins,
                tooltip: {
                  ...darkThemeDefaults.plugins?.tooltip,
                  callbacks: {
                    label: (ctx) => formatMoney(ctx.raw as number),
                  },
                },
              },
            } as never}
          />
        </div>
      </div>

      {/* Win/Loss, Long/Short, RR Distribution, Day PnL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl glass">
          <SectionHeader title="Win / Loss" desc="Verdeling winstgevende vs verliesgevende trades." />
          <div className="h-36 flex items-center justify-center">
            <Doughnut
              data={winLossData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: { legend: { display: false } },
              }}
            />
          </div>
          <div className="flex justify-center gap-4 mt-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> {metrics.wins} wins</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> {metrics.losses} losses</span>
          </div>
        </div>

        <div className="p-5 rounded-xl glass">
          <SectionHeader title="Long / Short" desc="Verdeling en winrate per richting." />
          <div className="h-36 flex items-center justify-center">
            <Doughnut
              data={longShortData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: { legend: { display: false } },
              }}
            />
          </div>
          <div className="flex justify-center gap-4 mt-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#3d6ea5]" /> {metrics.totalLongs}L ({formatPct(metrics.longWinRate)})</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#b8935a]" /> {metrics.totalShorts}S ({formatPct(metrics.shortWinRate)})</span>
          </div>
        </div>

        <div className="p-5 rounded-xl glass">
          <SectionHeader title="R:R Distributie" desc="Hoe vaak je op welke risk:reward uitkomt." />
          <div className="h-40">
            <Bar
              data={{
                labels: Object.keys(rrBuckets),
                datasets: [{
                  data: Object.values(rrBuckets),
                  backgroundColor: 'rgba(61,110,165,0.6)',
                  borderRadius: 3,
                }],
              }}
              options={{
                ...darkThemeDefaults,
                plugins: { ...darkThemeDefaults.plugins, legend: { display: false } },
              } as never}
            />
          </div>
        </div>

        <div className="p-5 rounded-xl glass">
          <SectionHeader title="P/L per Dag" desc="Op welke weekdag presteer je het best?" />
          <div className="h-40">
            <Bar
              data={dayData}
              options={{
                ...darkThemeDefaults,
                plugins: { ...darkThemeDefaults.plugins, legend: { display: false } },
              } as never}
            />
          </div>
        </div>
      </div>

      {/* Stats Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl glass">
          <SectionHeader title="Statistieken" desc="Gedetailleerde cijfers over je performance." />
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-text-dim">Gem. winst</span>
              <span className="text-green-400">{formatMoney(metrics.avgWin)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Gem. verlies</span>
              <span className="text-red-400">-${metrics.avgLoss.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Beste trade</span>
              <span className="text-green-400">{formatMoney(metrics.bestTrade)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Slechtste trade</span>
              <span className="text-red-400">{formatMoney(metrics.worstTrade)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Max cons. wins</span>
              <span className="text-heading">{metrics.maxConsecutiveWins}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Max cons. losses</span>
              <span className="text-heading">{metrics.maxConsecutiveLosses}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Gem. R:R</span>
              <span className="text-heading">{metrics.avgRR.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Gem. holding time</span>
              <span className="text-heading">{Math.round(metrics.avgHoldingTime)} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Totaal pips</span>
              <span className={metrics.totalPips >= 0 ? 'text-green-400' : 'text-red-400'}>{metrics.totalPips.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-dim">Gem. pips/trade</span>
              <span className={metrics.avgPips >= 0 ? 'text-green-400' : 'text-red-400'}>{metrics.avgPips.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Pair stats */}
        <div className="p-5 rounded-xl glass">
          <SectionHeader title="Per Paar" desc="Winrate en resultaat per currency pair." />
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {Object.entries(metrics.pairStats)
              .sort(([, a], [, b]) => b.trades - a.trades)
              .map(([pair, stats]) => (
                <div key={pair} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-heading font-medium">{pair}</span>
                    <span className="text-xs text-text-dim">{stats.trades}x</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-text-dim">{formatPct(stats.winRate)} WR</span>
                    <span className={`text-xs font-medium ${stats.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatMoney(stats.pnl)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── Profit Calendar ── */}
      {calendarMonths.length > 0 && (
        <div className="p-5 rounded-xl glass">
          <SectionHeader title="Profit Kalender" desc="Dagelijks resultaat per maand. Donkerder = groter bedrag." />
          <div className="space-y-6">
            {calendarMonths.map((month) => (
              <div key={month.monthKey}>
                {/* Month header */}
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-heading capitalize">{month.monthName}</h4>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-400/70">{month.winDays} groene dagen</span>
                    <span className="text-red-400/70">{month.lossDays} rode dagen</span>
                    <span className={`font-semibold ${month.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatMoney(month.totalPnL)}
                    </span>
                  </div>
                </div>

                {/* Day labels */}
                <div className="grid grid-cols-7 gap-1.5 mb-1">
                  {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((d) => (
                    <div key={d} className="text-center text-[10px] text-text-dim/60 font-medium">{d}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1.5">
                  {/* Empty cells before first day */}
                  {Array.from({ length: month.startCol }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}

                  {/* Day cells */}
                  {month.gridCells.map((cell) => {
                    const hasTrades = cell.pnl !== null
                    const intensity = hasTrades ? Math.min(Math.abs(cell.pnl!) / month.maxPnl, 1) : 0

                    return (
                      <div
                        key={cell.dateStr}
                        className="relative group"
                      >
                        <div
                          className={`aspect-[4/3] rounded-lg flex flex-col items-center justify-center transition-all ${
                            hasTrades
                              ? 'cursor-default'
                              : 'opacity-30'
                          }`}
                          style={hasTrades ? {
                            backgroundColor: cell.pnl! >= 0
                              ? `rgba(34,197,94,${0.1 + intensity * 0.45})`
                              : `rgba(239,68,68,${0.1 + intensity * 0.45})`,
                          } : {
                            backgroundColor: 'rgba(255,255,255,0.02)',
                          }}
                        >
                          <span className={`text-[11px] leading-none ${hasTrades ? 'text-text-muted' : 'text-text-dim/40'}`}>
                            {cell.day}
                          </span>
                          {hasTrades && (
                            <span className={`text-[10px] font-medium leading-none mt-0.5 ${cell.pnl! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {cell.pnl! >= 0 ? '+' : ''}{cell.pnl!.toFixed(0)}
                            </span>
                          )}
                        </div>

                        {/* Hover tooltip */}
                        {hasTrades && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-20 px-2.5 py-1.5 rounded-lg bg-bg-elevated border border-border shadow-xl text-xs whitespace-nowrap">
                            <span className="text-text-dim">{new Date(cell.dateStr).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                            <span className={`ml-2 font-semibold ${cell.pnl! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatMoney(cell.pnl!)}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-border/30">
            <div className="flex items-center gap-2 text-xs text-text-dim">
              <div className="flex items-center gap-0.5">
                <div className="w-4 h-3 rounded bg-red-400/15" />
                <div className="w-4 h-3 rounded bg-red-400/35" />
                <div className="w-4 h-3 rounded bg-red-400/55" />
              </div>
              Verlies
            </div>
            <div className="flex items-center gap-2 text-xs text-text-dim">
              <div className="flex items-center gap-0.5">
                <div className="w-4 h-3 rounded bg-green-400/15" />
                <div className="w-4 h-3 rounded bg-green-400/35" />
                <div className="w-4 h-3 rounded bg-green-400/55" />
              </div>
              Winst
            </div>
          </div>
        </div>
      )}

      {/* Trade Table */}
      <div className="p-5 rounded-xl glass">
        <SectionHeader title="Alle Trades" desc="Chronologisch overzicht van elke trade met details." />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-dim">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">Datum</th>
                <th className="text-left py-2 px-2">Paar</th>
                <th className="text-left py-2 px-2">Richting</th>
                <th className="text-right py-2 px-2">Lot</th>
                <th className="text-right py-2 px-2">Pips</th>
                <th className="text-right py-2 px-2">P/L</th>
                <th className="text-right py-2 px-2">R:R</th>
                <th className="text-left py-2 px-2">Sessie</th>
                <th className="text-right py-2 px-2">Duur</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={i} className="border-b border-border/30 hover:bg-white/[0.02] transition-colors">
                  <td className="py-2 px-2 text-text-dim">{t.tradeNumber}</td>
                  <td className="py-2 px-2 text-text-muted">{t.openDate.toLocaleDateString('nl-NL')}</td>
                  <td className="py-2 px-2 text-heading font-medium">{t.symbol}</td>
                  <td className="py-2 px-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${t.action === 'buy' ? 'bg-[#3d6ea5]/20 text-[#5a8ec4]' : 'bg-[#b8935a]/20 text-[#b8935a]'}`}>
                      {t.action === 'buy' ? 'LONG' : 'SHORT'}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right text-text-muted">{t.lotSize}</td>
                  <td className={`py-2 px-2 text-right ${t.pips >= 0 ? 'text-green-400' : 'text-red-400'}`}>{t.pips.toFixed(1)}</td>
                  <td className={`py-2 px-2 text-right font-medium ${t.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatMoney(t.profitLoss)}
                  </td>
                  <td className="py-2 px-2 text-right text-text-muted">{t.riskReward?.toFixed(1) ?? '-'}</td>
                  <td className="py-2 px-2 text-text-dim">{t.session}</td>
                  <td className="py-2 px-2 text-right text-text-dim">
                    {t.holdingTimeMinutes < 60 ? `${t.holdingTimeMinutes}m` : `${Math.round(t.holdingTimeMinutes / 60)}h`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
