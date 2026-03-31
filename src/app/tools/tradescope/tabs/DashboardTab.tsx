'use client'

import { useMemo } from 'react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import type { ParsedTrade } from '../utils/csvParser'
import type { TradeMetrics } from '../utils/metrics'
import { darkThemeDefaults, COLORS } from './ChartSetup'

interface Props {
  trades: ParsedTrade[]
  metrics: TradeMetrics
  startingBalance: number
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="p-4 rounded-xl glass">
      <p className="text-xs text-text-dim mb-1">{label}</p>
      <p className={`text-lg font-semibold ${color || 'text-heading'}`}>{value}</p>
      {sub && <p className="text-xs text-text-dim mt-0.5">{sub}</p>}
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

  // Profit calendar
  const calendarData = useMemo(() => {
    const entries = Object.entries(metrics.dailyPnL).sort(([a], [b]) => a.localeCompare(b))
    return entries
  }, [metrics])

  const pnlColor = metrics.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'

  return (
    <div className="space-y-6">
      {/* Top metrics bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Totaal P/L" value={formatMoney(metrics.totalPnL)} color={pnlColor} />
        <MetricCard label="Win Rate" value={formatPct(metrics.winRate)} sub={`${metrics.wins}W / ${metrics.losses}L`} />
        <MetricCard label="Profit Factor" value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)} />
        <MetricCard label="Expectancy" value={formatMoney(metrics.expectancy)} color={metrics.expectancy >= 0 ? 'text-green-400' : 'text-red-400'} />
        <MetricCard label="Max Drawdown" value={formatPct(metrics.maxDrawdownPercent)} sub={`$${metrics.maxDrawdown.toFixed(2)}`} color="text-red-400" />
        <MetricCard label="Sharpe Ratio" value={metrics.sharpeRatio.toFixed(2)} />
      </div>

      {/* Equity curve + Drawdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl glass">
          <h3 className="text-sm font-semibold text-heading mb-4">Equity Curve</h3>
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
          <h3 className="text-sm font-semibold text-heading mb-4">Drawdown</h3>
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
        <h3 className="text-sm font-semibold text-heading mb-4">P/L per Trade</h3>
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
          <h3 className="text-sm font-semibold text-heading mb-4">Win / Loss</h3>
          <div className="h-40 flex items-center justify-center">
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
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> {metrics.wins}W</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> {metrics.losses}L</span>
          </div>
        </div>

        <div className="p-5 rounded-xl glass">
          <h3 className="text-sm font-semibold text-heading mb-4">Long / Short</h3>
          <div className="h-40 flex items-center justify-center">
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
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3d6ea5]" /> {metrics.totalLongs}L ({formatPct(metrics.longWinRate)})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#b8935a]" /> {metrics.totalShorts}S ({formatPct(metrics.shortWinRate)})</span>
          </div>
        </div>

        <div className="p-5 rounded-xl glass">
          <h3 className="text-sm font-semibold text-heading mb-4">R:R Distributie</h3>
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
          <h3 className="text-sm font-semibold text-heading mb-4">P/L per Dag</h3>
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
          <h3 className="text-sm font-semibold text-heading mb-4">Statistieken</h3>
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
          <h3 className="text-sm font-semibold text-heading mb-4">Per Paar</h3>
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

      {/* Profit Calendar */}
      {calendarData.length > 0 && (
        <div className="p-5 rounded-xl glass">
          <h3 className="text-sm font-semibold text-heading mb-4">Profit Kalender</h3>
          <div className="grid grid-cols-7 gap-1.5">
            {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((d) => (
              <div key={d} className="text-center text-xs text-text-dim py-1">{d}</div>
            ))}
            {calendarData.map(([dateStr, pnl]) => {
              const date = new Date(dateStr)
              const dayOfWeek = date.getDay()
              const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Monday = 0
              const intensity = Math.min(Math.abs(pnl) / 200, 1) // Normalize

              return (
                <div
                  key={dateStr}
                  className="aspect-square rounded-md flex flex-col items-center justify-center text-xs cursor-default relative group"
                  style={{
                    gridColumnStart: adjustedDay + 1,
                    backgroundColor: pnl >= 0
                      ? `rgba(34,197,94,${0.15 + intensity * 0.5})`
                      : `rgba(239,68,68,${0.15 + intensity * 0.5})`,
                  }}
                >
                  <span className="text-[10px] text-text-dim">{date.getDate()}</span>
                  <span className={`text-[9px] font-medium ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}
                  </span>
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 px-2 py-1 rounded bg-bg-elevated text-xs text-heading whitespace-nowrap border border-border shadow-lg">
                    {dateStr}: {formatMoney(pnl)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Trade Table */}
      <div className="p-5 rounded-xl glass">
        <h3 className="text-sm font-semibold text-heading mb-4">Alle Trades</h3>
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
