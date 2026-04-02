'use client'

import { memo } from 'react'

interface SummaryBarProps {
  regime: string
  regimeColor: string
  confidence: number
  topPairs: Array<{ pair: string; direction: string; score: number }>
  winRate: number
  totalTrades: number
  generatedAt: string
  onRefresh: () => void
  loading: boolean
}

function SummaryBar({ regime, regimeColor, confidence, topPairs, winRate, totalTrades, generatedAt, onRefresh, loading }: SummaryBarProps) {
  // Format time
  const updateTime = (() => {
    try {
      return new Date(generatedAt).toLocaleString('nl-NL', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam'
      }) + ' NL'
    } catch { return '' }
  })()

  // Regime accent colors
  const accentMap: Record<string, string> = {
    red: 'border-red-500/40 bg-red-500/5',
    green: 'border-green-500/40 bg-green-500/5',
    blue: 'border-accent/40 bg-accent/5',
    amber: 'border-amber-500/40 bg-amber-500/5',
    gray: 'border-white/10 bg-white/[0.02]',
  }
  const accent = accentMap[regimeColor] || accentMap.gray

  // Confidence color
  const confColor = confidence >= 65 ? 'text-green-400' : confidence >= 40 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className={`rounded-2xl border ${accent} px-4 sm:px-6 py-3 mb-4`}>
      <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
        {/* Regime */}
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${
            regimeColor === 'red' ? 'bg-red-500' :
            regimeColor === 'green' ? 'bg-green-500' :
            regimeColor === 'blue' ? 'bg-accent-light' :
            regimeColor === 'amber' ? 'bg-amber-500' : 'bg-text-dim'
          } animate-pulse`} />
          <span className="font-display font-bold text-heading text-sm sm:text-base">{regime}</span>
        </div>

        <span className="text-white/10">|</span>

        {/* Confidence */}
        <div className="flex items-center gap-1.5">
          <span className={`font-mono font-bold text-sm ${confColor}`}>{confidence}%</span>
          <span className="text-[9px] text-text-dim uppercase tracking-wider">conf</span>
        </div>

        <span className="text-white/10 hidden sm:inline">|</span>

        {/* Top Pairs */}
        <div className="hidden sm:flex items-center gap-3">
          <span className="text-[9px] text-text-dim uppercase tracking-wider">TOP:</span>
          {topPairs.slice(0, 3).map(p => (
            <div key={p.pair} className="flex items-center gap-1">
              <span className="font-mono text-xs text-heading font-semibold">{p.pair.replace('/', '')}</span>
              <span className={`text-xs font-bold ${p.direction.includes('bullish') ? 'text-green-400' : 'text-red-400'}`}>
                {p.direction.includes('bullish') ? '↑' : '↓'}
              </span>
            </div>
          ))}
        </div>

        <span className="text-white/10 hidden sm:inline">|</span>

        {/* Win Rate */}
        <div className="flex items-center gap-1.5">
          <span className={`font-mono font-bold text-sm ${winRate >= 55 ? 'text-green-400' : winRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {winRate}%
          </span>
          <span className="text-[9px] text-text-dim uppercase tracking-wider">win ({totalTrades})</span>
        </div>

        {/* Spacer + Update time + Refresh */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] text-text-dim/50">{updateTime}</span>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors text-text-dim hover:text-heading disabled:opacity-50"
            title="Ververs data"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(SummaryBar)
