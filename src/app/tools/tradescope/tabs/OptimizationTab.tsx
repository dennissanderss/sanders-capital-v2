'use client'

import { useMemo } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import type { ParsedTrade } from '../utils/csvParser'
import type { TradeMetrics } from '../utils/metrics'
import { darkThemeDefaults, COLORS } from './ChartSetup'

interface OptData {
  currentMetrics: { riskPercent: number; expectancy: number; finalEquity: number; maxDD: number }
  optimized: { riskPercent: number; expectancy: number; finalEquity: number; maxDD: number }[]
}

interface Props {
  trades: ParsedTrade[]
  metrics: TradeMetrics
  optimizationData: OptData
  startingBalance: number
}

function formatMoney(n: number): string {
  const prefix = n >= 0 ? '+$' : '-$'
  return prefix + Math.abs(n).toFixed(2)
}

export default function OptimizationTab({ trades, metrics, optimizationData, startingBalance }: Props) {
  const { optimized } = optimizationData

  // Find the optimal risk level (highest equity with <25% drawdown)
  const optimal = useMemo(() => {
    const safe = optimized.filter((o) => o.maxDD < 25)
    if (safe.length === 0) return optimized[0]
    return safe.reduce((best, curr) => curr.finalEquity > best.finalEquity ? curr : best, safe[0])
  }, [optimized])

  // Risk vs Return chart
  const riskReturnData = useMemo(() => ({
    labels: optimized.map((o) => `${o.riskPercent}%`),
    datasets: [
      {
        label: 'Eindbalans',
        data: optimized.map((o) => o.finalEquity),
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(61,110,165,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: optimized.map((o) => o.riskPercent === optimal.riskPercent ? 6 : 3),
        pointBackgroundColor: optimized.map((o) => o.riskPercent === optimal.riskPercent ? COLORS.gold : COLORS.accent),
        borderWidth: 2,
        yAxisID: 'y',
      },
      {
        label: 'Max Drawdown %',
        data: optimized.map((o) => o.maxDD),
        borderColor: COLORS.red,
        backgroundColor: 'transparent',
        borderDash: [4, 4],
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 1.5,
        yAxisID: 'y1',
      },
    ],
  }), [optimized, optimal])

  // Expectancy per risk level
  const expectancyData = useMemo(() => ({
    labels: optimized.map((o) => `${o.riskPercent}%`),
    datasets: [
      {
        label: 'Expectancy',
        data: optimized.map((o) => o.expectancy),
        backgroundColor: optimized.map((o) => o.expectancy >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)'),
        borderRadius: 4,
      },
    ],
  }), [optimized])

  // Insights
  const insights = useMemo(() => {
    const result: { type: 'good' | 'warning' | 'danger' | 'info'; text: string }[] = []

    // Win rate assessment
    if (metrics.winRate >= 55) {
      result.push({ type: 'good', text: `Je win rate van ${metrics.winRate.toFixed(1)}% is sterk. Focus op het behouden van deze consistentie.` })
    } else if (metrics.winRate >= 45) {
      result.push({ type: 'info', text: `Je win rate is ${metrics.winRate.toFixed(1)}%. Dit kan winstgevend zijn mits je R:R goed is.` })
    } else {
      result.push({ type: 'warning', text: `Je win rate van ${metrics.winRate.toFixed(1)}% is laag. Je hebt een hoge R:R nodig om winstgevend te blijven.` })
    }

    // RR assessment
    if (metrics.avgRR > 0) {
      if (metrics.avgRR >= 2) {
        result.push({ type: 'good', text: `Je gemiddelde R:R van ${metrics.avgRR.toFixed(1)} is uitstekend.` })
      } else if (metrics.avgRR >= 1.5) {
        result.push({ type: 'info', text: `Je gemiddelde R:R van ${metrics.avgRR.toFixed(1)} is goed. Probeer het richting 2:1 te brengen.` })
      } else {
        result.push({ type: 'warning', text: `Je gemiddelde R:R van ${metrics.avgRR.toFixed(1)} is aan de lage kant. Overweeg betere entries of ruimere targets.` })
      }
    }

    // Profit factor
    if (metrics.profitFactor >= 2) {
      result.push({ type: 'good', text: `Profit factor van ${metrics.profitFactor.toFixed(2)} is excellent.` })
    } else if (metrics.profitFactor >= 1.5) {
      result.push({ type: 'info', text: `Profit factor van ${metrics.profitFactor.toFixed(2)} is degelijk. Er is ruimte voor verbetering.` })
    } else if (metrics.profitFactor >= 1) {
      result.push({ type: 'warning', text: `Profit factor van ${metrics.profitFactor.toFixed(2)} is marginaal. Je edge is dun.` })
    } else {
      result.push({ type: 'danger', text: `Profit factor van ${metrics.profitFactor.toFixed(2)} — je verliest geld. Evalueer je strategie.` })
    }

    // Drawdown
    if (metrics.maxDrawdownPercent > 30) {
      result.push({ type: 'danger', text: `Max drawdown van ${metrics.maxDrawdownPercent.toFixed(1)}% is te hoog. Verklein je risico per trade.` })
    } else if (metrics.maxDrawdownPercent > 20) {
      result.push({ type: 'warning', text: `Max drawdown van ${metrics.maxDrawdownPercent.toFixed(1)}% is hoog. Overweeg position sizing aanpassen.` })
    }

    // Consecutive losses
    if (metrics.maxConsecutiveLosses >= 8) {
      result.push({ type: 'danger', text: `Je hebt ${metrics.maxConsecutiveLosses} opeenvolgende verliezen gehad. Heb je een plan voor losing streaks?` })
    } else if (metrics.maxConsecutiveLosses >= 5) {
      result.push({ type: 'warning', text: `${metrics.maxConsecutiveLosses} opeenvolgende verliezen. Zorg voor een duidelijk protocol bij drawdowns.` })
    }

    // Session edge
    const bestSession = Object.entries(metrics.sessionStats)
      .filter(([, s]) => s.trades >= 5)
      .sort(([, a], [, b]) => b.pnl - a.pnl)[0]
    const worstSession = Object.entries(metrics.sessionStats)
      .filter(([, s]) => s.trades >= 5)
      .sort(([, a], [, b]) => a.pnl - b.pnl)[0]

    if (bestSession && worstSession && bestSession[0] !== worstSession[0]) {
      if (worstSession[1].pnl < 0) {
        result.push({ type: 'info', text: `Je presteert het best in de ${bestSession[0]} sessie. Overweeg de ${worstSession[0]} sessie te vermijden.` })
      }
    }

    // Day edge
    const bestDay = Object.entries(metrics.dayStats)
      .filter(([, s]) => s.trades >= 3)
      .sort(([, a], [, b]) => b.pnl - a.pnl)[0]
    const worstDay = Object.entries(metrics.dayStats)
      .filter(([, s]) => s.trades >= 3)
      .sort(([, a], [, b]) => a.pnl - b.pnl)[0]

    if (bestDay && worstDay && bestDay[0] !== worstDay[0] && worstDay[1].pnl < 0) {
      result.push({ type: 'info', text: `Beste dag: ${bestDay[0]} (${formatMoney(bestDay[1].pnl)}). Slechtste dag: ${worstDay[0]} (${formatMoney(worstDay[1].pnl)}).` })
    }

    // Optimal risk
    result.push({ type: 'info', text: `Optimaal risico per trade: ${optimal.riskPercent}% (max DD ${optimal.maxDD.toFixed(1)}%, eindbalans $${optimal.finalEquity.toFixed(0)}).` })

    return result
  }, [metrics, optimal])

  const iconMap = {
    good: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400 shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12" /></svg>
    ),
    warning: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400 shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    ),
    danger: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
    ),
    info: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
    ),
  }

  return (
    <div className="space-y-6">
      {/* Automated Insights */}
      <div className="p-5 rounded-xl glass">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-accent-glow flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-heading">Automatische Analyse</h3>
            <p className="text-xs text-text-dim mt-1">
              Op basis van je {trades.length} trades hebben we de volgende inzichten gevonden.
            </p>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-text-muted">
              {iconMap[insight.type]}
              <span>{insight.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Optimization Chart */}
      <div className="p-5 rounded-xl glass">
        <h3 className="text-sm font-semibold text-heading mb-1">Risico Optimalisatie</h3>
        <p className="text-xs text-text-dim mb-4">Eindbalans en max drawdown bij verschillende risico niveaus per trade.</p>
        <div className="h-72">
          <Line
            data={riskReturnData}
            options={{
              ...darkThemeDefaults,
              plugins: {
                ...darkThemeDefaults.plugins,
                legend: {
                  display: true,
                  position: 'top',
                  labels: { color: '#5a6178', font: { size: 10 }, boxWidth: 12, padding: 16 },
                },
              },
              scales: {
                x: {
                  ...darkThemeDefaults.scales?.x,
                  title: { display: true, text: 'Risico per trade', color: '#5a6178', font: { size: 10 } },
                },
                y: {
                  ...darkThemeDefaults.scales?.y,
                  position: 'left',
                  title: { display: true, text: 'Eindbalans ($)', color: '#5a6178', font: { size: 10 } },
                },
                y1: {
                  ...darkThemeDefaults.scales?.y,
                  position: 'right',
                  grid: { display: false },
                  title: { display: true, text: 'Max Drawdown (%)', color: '#5a6178', font: { size: 10 } },
                },
              },
            } as never}
          />
        </div>
      </div>

      {/* Expectancy per risk */}
      <div className="p-5 rounded-xl glass">
        <h3 className="text-sm font-semibold text-heading mb-4">Expectancy per Risico Niveau</h3>
        <div className="h-48">
          <Bar
            data={expectancyData}
            options={{
              ...darkThemeDefaults,
              plugins: {
                ...darkThemeDefaults.plugins,
                legend: { display: false },
                tooltip: {
                  ...darkThemeDefaults.plugins?.tooltip,
                  callbacks: {
                    label: (ctx) => `Expectancy: ${formatMoney(ctx.raw as number)}`,
                  },
                },
              },
            } as never}
          />
        </div>
      </div>

      {/* Comparison table */}
      <div className="p-5 rounded-xl glass">
        <h3 className="text-sm font-semibold text-heading mb-4">Risico Niveaus Vergelijking</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-dim">
                <th className="text-left py-2 px-3">Risico %</th>
                <th className="text-right py-2 px-3">Expectancy</th>
                <th className="text-right py-2 px-3">Eindbalans</th>
                <th className="text-right py-2 px-3">Return %</th>
                <th className="text-right py-2 px-3">Max DD %</th>
                <th className="text-center py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {optimized.map((o, i) => {
                const returnPct = ((o.finalEquity - startingBalance) / startingBalance) * 100
                const isOptimal = o.riskPercent === optimal.riskPercent
                return (
                  <tr
                    key={i}
                    className={`border-b border-border/30 ${isOptimal ? 'bg-accent/5' : ''}`}
                  >
                    <td className="py-2 px-3">
                      <span className={`font-medium ${isOptimal ? 'text-gold' : 'text-heading'}`}>
                        {o.riskPercent}%
                      </span>
                      {isOptimal && (
                        <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-gold-dim text-gold font-semibold">
                          OPTIMAAL
                        </span>
                      )}
                    </td>
                    <td className={`py-2 px-3 text-right ${o.expectancy >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatMoney(o.expectancy)}
                    </td>
                    <td className="py-2 px-3 text-right text-heading">${o.finalEquity.toFixed(0)}</td>
                    <td className={`py-2 px-3 text-right ${returnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
                    </td>
                    <td className={`py-2 px-3 text-right ${o.maxDD > 25 ? 'text-red-400' : o.maxDD > 15 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {o.maxDD.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-center">
                      {o.maxDD > 30 ? (
                        <span className="text-red-400">Risicovol</span>
                      ) : o.maxDD > 20 ? (
                        <span className="text-yellow-400">Matig</span>
                      ) : (
                        <span className="text-green-400">Veilig</span>
                      )}
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
}
