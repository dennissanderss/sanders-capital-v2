'use client'

import { useMemo } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import type { ParsedTrade } from '../utils/csvParser'
import type { TradeMetrics } from '../utils/metrics'
import { darkThemeDefaults, COLORS } from './ChartSetup'

interface Props {
  trades: ParsedTrade[]
  metrics: TradeMetrics
}

function formatMoney(n: number): string {
  const prefix = n >= 0 ? '+$' : '-$'
  return prefix + Math.abs(n).toFixed(2)
}

export default function AnalyticsTab({ trades, metrics }: Props) {
  // Session analysis
  const sessionData = useMemo(() => ({
    labels: ['London', 'New York', 'Overlap', 'Asia'],
    datasets: [
      {
        label: 'P/L',
        data: ['London', 'New York', 'Overlap', 'Asia'].map(
          (s) => metrics.sessionStats[s]?.pnl || 0
        ),
        backgroundColor: ['London', 'New York', 'Overlap', 'Asia'].map(
          (s) => (metrics.sessionStats[s]?.pnl || 0) >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)'
        ),
        borderRadius: 4,
      },
    ],
  }), [metrics])

  // Hourly distribution
  const hourlyData = useMemo(() => {
    const hours: Record<number, { count: number; pnl: number; wins: number }> = {}
    for (let h = 0; h < 24; h++) hours[h] = { count: 0, pnl: 0, wins: 0 }
    trades.forEach((t) => {
      const h = t.openDate.getUTCHours()
      hours[h].count++
      hours[h].pnl += t.profitLoss
      if (t.isWin) hours[h].wins++
    })

    return {
      labels: Object.keys(hours).map((h) => `${h}:00`),
      datasets: [
        {
          label: 'Trades',
          data: Object.values(hours).map((h) => h.count),
          backgroundColor: 'rgba(61,110,165,0.6)',
          borderRadius: 2,
          yAxisID: 'y',
        },
        {
          label: 'P/L',
          data: Object.values(hours).map((h) => h.pnl),
          type: 'line' as const,
          borderColor: COLORS.gold,
          backgroundColor: 'transparent',
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.3,
          yAxisID: 'y1',
        },
      ],
    }
  }, [trades])

  // Monthly performance
  const monthlyData = useMemo(() => {
    const months = Object.entries(metrics.monthlyReturns).sort(([a], [b]) => a.localeCompare(b))
    return {
      labels: months.map(([m]) => {
        const [year, month] = m.split('-')
        const date = new Date(+year, +month - 1)
        return date.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
      }),
      datasets: [
        {
          label: 'Maand P/L',
          data: months.map(([, pnl]) => pnl),
          backgroundColor: months.map(([, pnl]) => pnl >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)'),
          borderRadius: 4,
        },
      ],
    }
  }, [metrics])

  // Cumulative PnL over time
  const cumulativeData = useMemo(() => {
    let cumulative = 0
    const data = trades.map((t) => {
      cumulative += t.profitLoss
      return { date: t.closeDate, value: cumulative }
    })
    return {
      labels: data.map((d) => d.date.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })),
      datasets: [
        {
          label: 'Cumulatief P/L',
          data: data.map((d) => d.value),
          borderColor: COLORS.accent,
          backgroundColor: 'rgba(61,110,165,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    }
  }, [trades])

  // Holding time vs PnL scatter
  const holdingVsPnl = useMemo(() => {
    const buckets: Record<string, { pnl: number; count: number }> = {
      '<5m': { pnl: 0, count: 0 },
      '5-15m': { pnl: 0, count: 0 },
      '15-30m': { pnl: 0, count: 0 },
      '30m-1h': { pnl: 0, count: 0 },
      '1-2h': { pnl: 0, count: 0 },
      '2-4h': { pnl: 0, count: 0 },
      '4h+': { pnl: 0, count: 0 },
    }
    trades.forEach((t) => {
      const m = t.holdingTimeMinutes
      const key = m < 5 ? '<5m' : m < 15 ? '5-15m' : m < 30 ? '15-30m' : m < 60 ? '30m-1h' : m < 120 ? '1-2h' : m < 240 ? '2-4h' : '4h+'
      buckets[key].pnl += t.profitLoss
      buckets[key].count++
    })
    return {
      labels: Object.keys(buckets),
      datasets: [
        {
          label: 'Gem. P/L',
          data: Object.values(buckets).map((b) => b.count > 0 ? b.pnl / b.count : 0),
          backgroundColor: Object.values(buckets).map((b) => {
            const avg = b.count > 0 ? b.pnl / b.count : 0
            return avg >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)'
          }),
          borderRadius: 4,
        },
      ],
    }
  }, [trades])

  // Win streak analysis
  const streakData = useMemo(() => {
    const streaks: number[] = []
    let current = 0
    trades.forEach((t) => {
      if (t.isWin) {
        current++
      } else {
        if (current > 0) streaks.push(current)
        current = -1
      }
      if (!t.isWin) {
        current--
      }
    })

    // Calculate trade frequency per week
    const weekMap: Record<string, number> = {}
    trades.forEach((t) => {
      const d = t.openDate
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toISOString().split('T')[0]
      weekMap[key] = (weekMap[key] || 0) + 1
    })

    const weeks = Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b))
    return {
      labels: weeks.map(([w]) => {
        const d = new Date(w)
        return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })
      }),
      datasets: [
        {
          label: 'Trades per week',
          data: weeks.map(([, c]) => c),
          borderColor: COLORS.accent,
          backgroundColor: 'rgba(61,110,165,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          borderWidth: 2,
        },
      ],
    }
  }, [trades])

  return (
    <div className="space-y-6">
      {/* Session & Hourly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl glass">
          <h3 className="text-sm font-semibold text-heading mb-4">Performance per Sessie</h3>
          <div className="h-56">
            <Bar
              data={sessionData}
              options={{
                ...darkThemeDefaults,
                plugins: { ...darkThemeDefaults.plugins, legend: { display: false } },
              } as never}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {['London', 'New York', 'Overlap', 'Asia'].map((s) => {
              const stat = metrics.sessionStats[s]
              return stat && stat.trades > 0 ? (
                <div key={s} className="text-xs p-2 rounded-lg glass">
                  <span className="text-text-dim">{s}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-heading">{stat.trades}x</span>
                    <span className="text-text-dim">·</span>
                    <span className="text-text-dim">{stat.winRate.toFixed(0)}% WR</span>
                    <span className={stat.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>{formatMoney(stat.pnl)}</span>
                  </div>
                </div>
              ) : null
            })}
          </div>
        </div>

        <div className="p-5 rounded-xl glass">
          <h3 className="text-sm font-semibold text-heading mb-4">Uur Distributie (UTC)</h3>
          <div className="h-56">
            <Bar
              data={hourlyData}
              options={{
                ...darkThemeDefaults,
                plugins: { ...darkThemeDefaults.plugins, legend: { display: false } },
                scales: {
                  ...darkThemeDefaults.scales,
                  y: {
                    ...darkThemeDefaults.scales?.y,
                    position: 'left',
                  },
                  y1: {
                    ...darkThemeDefaults.scales?.y,
                    position: 'right',
                    grid: { display: false },
                  },
                },
              } as never}
            />
          </div>
        </div>
      </div>

      {/* Monthly Performance */}
      <div className="p-5 rounded-xl glass">
        <h3 className="text-sm font-semibold text-heading mb-4">Maandelijks Resultaat</h3>
        <div className="h-56">
          <Bar
            data={monthlyData}
            options={{
              ...darkThemeDefaults,
              plugins: {
                ...darkThemeDefaults.plugins,
                legend: { display: false },
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

      {/* Cumulative + Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl glass">
          <h3 className="text-sm font-semibold text-heading mb-4">Cumulatief P/L</h3>
          <div className="h-56">
            <Line
              data={cumulativeData}
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

        <div className="p-5 rounded-xl glass">
          <h3 className="text-sm font-semibold text-heading mb-4">Trade Frequentie per Week</h3>
          <div className="h-56">
            <Line
              data={streakData}
              options={{
                ...darkThemeDefaults,
                plugins: { ...darkThemeDefaults.plugins, legend: { display: false } },
              } as never}
            />
          </div>
        </div>
      </div>

      {/* Holding Time */}
      <div className="p-5 rounded-xl glass">
        <h3 className="text-sm font-semibold text-heading mb-4">Gem. P/L per Holding Time</h3>
        <div className="h-48">
          <Bar
            data={holdingVsPnl}
            options={{
              ...darkThemeDefaults,
              plugins: {
                ...darkThemeDefaults.plugins,
                legend: { display: false },
                tooltip: {
                  ...darkThemeDefaults.plugins?.tooltip,
                  callbacks: {
                    label: (ctx) => `Gem: ${formatMoney(ctx.raw as number)}`,
                  },
                },
              },
            } as never}
          />
        </div>
      </div>
    </div>
  )
}
