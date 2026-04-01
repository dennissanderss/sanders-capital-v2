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

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-heading">{title}</h3>
      <p className="text-xs text-text-dim mt-0.5 leading-relaxed">{desc}</p>
    </div>
  )
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
    const result: { type: 'good' | 'warning' | 'danger' | 'info'; title: string; text: string }[] = []

    // Win rate
    if (metrics.winRate >= 55) {
      result.push({ type: 'good', title: 'Sterke win rate', text: `${metrics.winRate.toFixed(1)}% van je trades is winstgevend. Dit biedt een solide basis.` })
    } else if (metrics.winRate >= 45) {
      result.push({ type: 'info', title: 'Gemiddelde win rate', text: `${metrics.winRate.toFixed(1)}% win rate. Dit kan winstgevend zijn als je gemiddelde winst groter is dan je gemiddeld verlies (goede R:R).` })
    } else {
      result.push({ type: 'warning', title: 'Lage win rate', text: `${metrics.winRate.toFixed(1)}% win rate is onder gemiddeld. Je hebt minimaal 2:1 R:R nodig om winstgevend te zijn.` })
    }

    // RR
    if (metrics.avgRR > 0) {
      if (metrics.avgRR >= 2) {
        result.push({ type: 'good', title: 'Uitstekende R:R', text: `Gemiddeld ${metrics.avgRR.toFixed(1)}:1, je wint meer dan je riskeert per trade.` })
      } else if (metrics.avgRR >= 1.5) {
        result.push({ type: 'info', title: 'Goede R:R', text: `Gemiddeld ${metrics.avgRR.toFixed(1)}:1 risk-reward. Probeer richting 2:1 te verbeteren door je entries of targets te optimaliseren.` })
      } else {
        result.push({ type: 'warning', title: 'Lage R:R', text: `Gemiddeld ${metrics.avgRR.toFixed(1)}:1, je riskeert relatief veel voor je potentiële winst. Betere entries of ruimere targets kunnen helpen.` })
      }
    }

    // Profit factor
    if (metrics.profitFactor >= 2) {
      result.push({ type: 'good', title: 'Excellent profit factor', text: `${metrics.profitFactor.toFixed(2)}: je totale winst is ${metrics.profitFactor.toFixed(1)}x je totale verlies. Dit is een sterke edge.` })
    } else if (metrics.profitFactor >= 1.5) {
      result.push({ type: 'info', title: 'Degelijke profit factor', text: `${metrics.profitFactor.toFixed(2)}, winstgevend maar er is ruimte om je edge te versterken.` })
    } else if (metrics.profitFactor >= 1) {
      result.push({ type: 'warning', title: 'Marginale profit factor', text: `${metrics.profitFactor.toFixed(2)}, je bent net winstgevend. Commissies of slippage kunnen dit snel omkeren.` })
    } else {
      result.push({ type: 'danger', title: 'Negatieve profit factor', text: `${metrics.profitFactor.toFixed(2)}, je verliest structureel geld. Heroverweeg je entry criteria, stop loss plaatsing en trade management.` })
    }

    // Drawdown
    if (metrics.maxDrawdownPercent > 30) {
      result.push({ type: 'danger', title: 'Te hoge drawdown', text: `${metrics.maxDrawdownPercent.toFixed(1)}% max drawdown. Bij een live account kan dit psychologisch onhoudbaar zijn. Verklein je risico per trade.` })
    } else if (metrics.maxDrawdownPercent > 20) {
      result.push({ type: 'warning', title: 'Hoge drawdown', text: `${metrics.maxDrawdownPercent.toFixed(1)}% max drawdown. Overweeg je position sizing te verlagen of strengere trade selectie.` })
    } else if (metrics.maxDrawdownPercent > 0) {
      result.push({ type: 'good', title: 'Gezonde drawdown', text: `${metrics.maxDrawdownPercent.toFixed(1)}% max drawdown is beheersbaar. Je risicomanagement werkt.` })
    }

    // Consecutive losses
    if (metrics.maxConsecutiveLosses >= 8) {
      result.push({ type: 'danger', title: 'Lange losing streak', text: `${metrics.maxConsecutiveLosses} verliezen op rij. Heb je een protocol voor wanneer je stopt met traden na een drawdown?` })
    } else if (metrics.maxConsecutiveLosses >= 5) {
      result.push({ type: 'warning', title: 'Losing streak', text: `${metrics.maxConsecutiveLosses} opeenvolgende verliezen. Stel een max dagverlies in om tilt te voorkomen.` })
    }

    // Session edge
    const sessionEntries = Object.entries(metrics.sessionStats).filter(([, s]) => s.trades >= 5)
    const bestSession = sessionEntries.sort(([, a], [, b]) => b.pnl - a.pnl)[0]
    const worstSession = sessionEntries.sort(([, a], [, b]) => a.pnl - b.pnl)[0]

    if (bestSession && worstSession && bestSession[0] !== worstSession[0] && worstSession[1].pnl < 0) {
      result.push({ type: 'info', title: 'Sessie voorkeur', text: `Je beste sessie is ${bestSession[0]} (${formatMoney(bestSession[1].pnl)}). Overweeg ${worstSession[0]} (${formatMoney(worstSession[1].pnl)}) te vermijden.` })
    }

    // Day edge
    const dayEntries = Object.entries(metrics.dayStats).filter(([, s]) => s.trades >= 3)
    const bestDay = dayEntries.sort(([, a], [, b]) => b.pnl - a.pnl)[0]
    const worstDay = dayEntries.sort(([, a], [, b]) => a.pnl - b.pnl)[0]

    if (bestDay && worstDay && bestDay[0] !== worstDay[0] && worstDay[1].pnl < 0) {
      result.push({ type: 'info', title: 'Dag analyse', text: `Beste dag: ${bestDay[0]} (${formatMoney(bestDay[1].pnl)}). Slechtste: ${worstDay[0]} (${formatMoney(worstDay[1].pnl)}). Overweeg aanpassing.` })
    }

    // Optimal risk
    result.push({ type: 'info', title: 'Optimaal risico', text: `Op basis van je data is ${optimal.riskPercent}% risico per trade optimaal: eindbalans $${optimal.finalEquity.toFixed(0)} met max ${optimal.maxDD.toFixed(1)}% drawdown.` })

    return result
  }, [metrics, optimal])

  const iconMap = {
    good: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400 shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
    ),
    warning: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400 shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    ),
    danger: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 shrink-0"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
    ),
    info: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light shrink-0"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
    ),
  }

  const bgMap = {
    good: 'bg-green-400/5 border-green-400/15',
    warning: 'bg-yellow-400/5 border-yellow-400/15',
    danger: 'bg-red-400/5 border-red-400/15',
    info: 'bg-accent/5 border-accent/15',
  }

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="p-5 rounded-xl glass">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent-glow flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-heading">Automatische Strategie Analyse</h3>
            <p className="text-xs text-text-dim mt-1 leading-relaxed max-w-2xl">
              Op basis van je {trades.length} trades analyseren we je strategie op meerdere vlakken: winstgevendheid,
              risicomanagement, consistentie en optimaal risico per trade. Elke bevinding bevat een concreet advies.
            </p>
          </div>
        </div>
      </div>

      {/* Automated Insights - card style */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((insight, i) => (
          <div key={i} className={`p-4 rounded-xl border ${bgMap[insight.type]}`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {iconMap[insight.type]}
              </div>
              <div>
                <p className="text-sm font-medium text-heading">{insight.title}</p>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">{insight.text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Risk Optimization Chart */}
      <div className="p-5 rounded-xl glass">
        <SectionHeader
          title="Risico vs. Rendement"
          desc="Wat gebeurt er met je eindbalans en drawdown als je meer of minder riskeert per trade? De blauwe lijn toont je eindbalans, de rode stippellijn je maximale drawdown. Het gouden punt markeert het optimale niveau."
        />
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
                  title: { display: true, text: 'Risico per trade (%)', color: '#5a6178', font: { size: 10 } },
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
        <SectionHeader
          title="Expectancy per Risico Niveau"
          desc="Expectancy = het gemiddelde bedrag dat je per trade kunt verwachten. Hoe hoger het risico, hoe groter de schommelingen, maar niet altijd meer winst."
        />
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
                    label: (ctx) => `Gem. per trade: ${formatMoney(ctx.raw as number)}`,
                  },
                },
              },
            } as never}
          />
        </div>
      </div>

      {/* Comparison table */}
      <div className="p-5 rounded-xl glass">
        <SectionHeader
          title="Vergelijking Risico Niveaus"
          desc="Overzicht van wat elk risicopercentage oplevert. 'Optimaal' is het niveau met de hoogste eindbalans binnen een veilige drawdown (< 25%)."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2.5 px-3 text-text-dim font-medium">Risico per trade</th>
                <th className="text-right py-2.5 px-3 text-text-dim font-medium">
                  <span className="flex items-center justify-end gap-1">
                    Expectancy
                    <span className="group relative cursor-help">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim/50"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                      <span className="absolute bottom-full right-0 mb-1 hidden group-hover:block z-20 px-2 py-1.5 rounded-lg bg-bg-elevated border border-border shadow-xl text-[10px] text-text-muted w-40 leading-relaxed font-normal">
                        Gemiddeld verwacht resultaat per trade bij dit risico niveau.
                      </span>
                    </span>
                  </span>
                </th>
                <th className="text-right py-2.5 px-3 text-text-dim font-medium">Eindbalans</th>
                <th className="text-right py-2.5 px-3 text-text-dim font-medium">Return</th>
                <th className="text-right py-2.5 px-3 text-text-dim font-medium">
                  <span className="flex items-center justify-end gap-1">
                    Max DD
                    <span className="group relative cursor-help">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim/50"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                      <span className="absolute bottom-full right-0 mb-1 hidden group-hover:block z-20 px-2 py-1.5 rounded-lg bg-bg-elevated border border-border shadow-xl text-[10px] text-text-muted w-44 leading-relaxed font-normal">
                        Maximale drawdown: de grootste daling van piek tot dal. Onder 20% is veilig, 20-30% is matig, boven 30% is risicovol.
                      </span>
                    </span>
                  </span>
                </th>
                <th className="text-center py-2.5 px-3 text-text-dim font-medium">Beoordeling</th>
              </tr>
            </thead>
            <tbody>
              {optimized.map((o, i) => {
                const returnPct = ((o.finalEquity - startingBalance) / startingBalance) * 100
                const isOptimal = o.riskPercent === optimal.riskPercent
                return (
                  <tr
                    key={i}
                    className={`border-b border-border/30 transition-colors ${isOptimal ? 'bg-gold/[0.04]' : 'hover:bg-white/[0.02]'}`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isOptimal ? 'text-gold' : 'text-heading'}`}>
                          {o.riskPercent}%
                        </span>
                        {isOptimal && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold-dim text-gold font-semibold">
                            OPTIMAAL
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`py-2.5 px-3 text-right ${o.expectancy >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatMoney(o.expectancy)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-heading font-medium">${o.finalEquity.toFixed(0)}</td>
                    <td className={`py-2.5 px-3 text-right ${returnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
                    </td>
                    <td className={`py-2.5 px-3 text-right font-medium ${o.maxDD > 25 ? 'text-red-400' : o.maxDD > 15 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {o.maxDD.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {o.maxDD > 30 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 text-[10px] font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          Risicovol
                        </span>
                      ) : o.maxDD > 20 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 text-[10px] font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                          Matig
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 text-[10px] font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          Veilig
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom explanation */}
      <div className="p-5 rounded-xl glass">
        <SectionHeader
          title="Hoe lees je deze data?"
          desc=""
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-text-muted leading-relaxed">
          <div className="p-3 rounded-lg bg-white/[0.02]">
            <p className="text-heading font-medium mb-1.5">Risico per trade</p>
            <p>Het percentage van je balans dat je riskeert per trade. Bij 1% en een $10.000 account riskeer je $100 per trade. Hoger risico = meer potentieel rendement, maar ook grotere drawdowns.</p>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.02]">
            <p className="text-heading font-medium mb-1.5">Expectancy</p>
            <p>Hoeveel je gemiddeld verdient per trade. Berekend als: (win% x gem. winst) - (loss% x gem. verlies). Positief = winstgevend op de lange termijn.</p>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.02]">
            <p className="text-heading font-medium mb-1.5">Max Drawdown</p>
            <p>De grootste daling van je piek-balans. Een drawdown van 20% betekent dat je account op een gegeven moment 20% lager stond dan het hoogste punt. Onder 20% is gezond.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
