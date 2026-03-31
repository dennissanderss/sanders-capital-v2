'use client'

import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { ParsedTrade } from '../utils/csvParser'
import { darkThemeDefaults, COLORS } from './ChartSetup'

interface MonteCarloResult {
  median: number[]
  p5: number[]
  p95: number[]
  p25: number[]
  p75: number[]
  ruinProbability: number
  medianFinal: number
  avgMaxDrawdown: number
}

interface Props {
  trades: ParsedTrade[]
  monteCarloData: MonteCarloResult
  startingBalance: number
}

function MetricCard({ label, value, color, tooltip }: { label: string; value: string; color?: string; tooltip?: string }) {
  return (
    <div className="p-4 rounded-xl glass relative group">
      <p className="text-xs text-text-dim mb-1 flex items-center gap-1">
        {label}
        {tooltip && (
          <span className="cursor-help">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim/50">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 px-3 py-2 rounded-lg bg-bg-elevated border border-border shadow-xl text-xs text-text-muted max-w-[220px] leading-relaxed whitespace-normal font-normal">
              {tooltip}
            </span>
          </span>
        )}
      </p>
      <p className={`text-lg font-semibold ${color || 'text-heading'}`}>{value}</p>
    </div>
  )
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-heading">{title}</h3>
      <p className="text-xs text-text-dim mt-0.5 leading-relaxed">{desc}</p>
    </div>
  )
}

export default function StrategyTesterTab({ trades, monteCarloData, startingBalance }: Props) {
  const { median, p5, p95, p25, p75, ruinProbability, medianFinal, avgMaxDrawdown } = monteCarloData

  const chartData = useMemo(() => ({
    labels: Array.from({ length: median.length }, (_, i) => i === 0 ? 'Start' : `Trade ${i}`),
    datasets: [
      {
        label: 'P95 (Best case)',
        data: p95,
        borderColor: 'rgba(34,197,94,0.3)',
        backgroundColor: 'transparent',
        borderDash: [4, 4],
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.3,
      },
      {
        label: 'P75',
        data: p75,
        borderColor: 'rgba(34,197,94,0.5)',
        backgroundColor: 'rgba(34,197,94,0.05)',
        fill: '+1',
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.3,
      },
      {
        label: 'Mediaan',
        data: median,
        borderColor: COLORS.accent,
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.3,
      },
      {
        label: 'P25',
        data: p25,
        borderColor: 'rgba(239,68,68,0.5)',
        backgroundColor: 'rgba(239,68,68,0.05)',
        fill: '+1',
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.3,
      },
      {
        label: 'P5 (Worst case)',
        data: p5,
        borderColor: 'rgba(239,68,68,0.3)',
        backgroundColor: 'transparent',
        borderDash: [4, 4],
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.3,
      },
    ],
  }), [median, p5, p95, p25, p75])

  const returnPct = ((medianFinal - startingBalance) / startingBalance) * 100

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="p-5 rounded-xl glass">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-accent-glow flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-heading">Monte Carlo Simulatie</h3>
            <p className="text-xs text-text-dim mt-1">
              1.000 simulaties op basis van {trades.length} trades. De volgorde van je trades wordt
              random gehusseld om te testen hoe robuust je strategie is onder verschillende scenario&apos;s.
            </p>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Mediaan Eindbalans"
          value={`$${medianFinal.toFixed(0)}`}
          color={medianFinal > startingBalance ? 'text-green-400' : 'text-red-400'}
          tooltip="De middelste eindbalans uit alle 1.000 simulaties. 50% eindigt hoger, 50% lager."
        />
        <MetricCard
          label="Mediaan Return"
          value={`${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%`}
          color={returnPct >= 0 ? 'text-green-400' : 'text-red-400'}
          tooltip="Het verwachte rendement op je startbalans in het mediaanscenario."
        />
        <MetricCard
          label="Ruin Probability"
          value={`${ruinProbability.toFixed(1)}%`}
          color={ruinProbability > 5 ? 'text-red-400' : ruinProbability > 1 ? 'text-yellow-400' : 'text-green-400'}
          tooltip="Kans dat je account naar $0 gaat. Onder 1% is uitstekend, boven 5% is zorgelijk."
        />
        <MetricCard
          label="Gem. Max Drawdown"
          value={`${avgMaxDrawdown.toFixed(1)}%`}
          color="text-red-400"
          tooltip="De gemiddelde maximale drawdown over alle simulaties. Lager = stabieler."
        />
      </div>

      {/* Monte Carlo fan chart */}
      <div className="p-5 rounded-xl glass">
        <SectionHeader title="Simulatie Resultaten" desc="Fan chart: de groene band toont gunstige scenario's, de rode band ongunstige. De blauwe lijn is de mediaan." />
        <div className="h-80">
          <Line
            data={chartData}
            options={{
              ...darkThemeDefaults,
              plugins: {
                ...darkThemeDefaults.plugins,
                legend: {
                  display: true,
                  position: 'top',
                  labels: {
                    color: '#5a6178',
                    font: { size: 10 },
                    boxWidth: 12,
                    padding: 16,
                  },
                },
                tooltip: {
                  ...darkThemeDefaults.plugins?.tooltip,
                  callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: $${(ctx.raw as number).toFixed(0)}`,
                  },
                },
              },
            } as never}
          />
        </div>
      </div>

      {/* Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl glass">
          <SectionHeader title="Scenario Ranges" desc="Eindbalans per percentiel. P95 = top 5% scenario's, P5 = slechtste 5%." />
          <div className="space-y-4">
            {[
              { label: 'Best case (P95)', value: p95[p95.length - 1], pct: ((p95[p95.length - 1] - startingBalance) / startingBalance * 100) },
              { label: 'Optimistisch (P75)', value: p75[p75.length - 1], pct: ((p75[p75.length - 1] - startingBalance) / startingBalance * 100) },
              { label: 'Mediaan (P50)', value: median[median.length - 1], pct: ((median[median.length - 1] - startingBalance) / startingBalance * 100) },
              { label: 'Pessimistisch (P25)', value: p25[p25.length - 1], pct: ((p25[p25.length - 1] - startingBalance) / startingBalance * 100) },
              { label: 'Worst case (P5)', value: p5[p5.length - 1], pct: ((p5[p5.length - 1] - startingBalance) / startingBalance * 100) },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-text-dim">{s.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-heading">${s.value.toFixed(0)}</span>
                  <span className={`text-xs font-medium ${s.pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {s.pct >= 0 ? '+' : ''}{s.pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl glass">
          <SectionHeader title="Interpretatie" desc="Wat betekenen deze resultaten voor jouw strategie?" />
          <div className="space-y-3 text-sm text-text-muted">
            {ruinProbability < 1 && (
              <div className="flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400 shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12" /></svg>
                <span>Je strategie heeft een zeer laag ruin risico ({ruinProbability.toFixed(1)}%). Dit is uitstekend.</span>
              </div>
            )}
            {ruinProbability >= 1 && ruinProbability < 10 && (
              <div className="flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400 shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                <span>Je ruin probability is {ruinProbability.toFixed(1)}%. Overweeg je risico per trade te verlagen.</span>
              </div>
            )}
            {ruinProbability >= 10 && (
              <div className="flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                <span>Waarschuwing: je ruin probability is {ruinProbability.toFixed(1)}%. Dit risico is te hoog. Verlaag je positie grootte.</span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
              <span>De mediaan drawdown is {avgMaxDrawdown.toFixed(1)}%. {avgMaxDrawdown < 15 ? 'Dit is acceptabel.' : avgMaxDrawdown < 30 ? 'Dit is aan de hoge kant.' : 'Dit is risicovol.'}</span>
            </div>
            <div className="flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
              <span>In 50% van de simulaties eindig je boven ${medianFinal.toFixed(0)} ({returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%).</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
