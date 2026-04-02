'use client'

import { memo } from 'react'

interface ConfluenceData {
  factors: {
    fundamenteel: boolean
    regime: boolean
    intermarket: boolean
    news: boolean
  }
  score: number
  total: number
}

interface ConfluenceMeterProps {
  confluence: ConfluenceData
}

const FACTOR_LABELS: Record<string, string> = {
  fundamenteel: 'Fundamenteel',
  regime: 'Regime',
  intermarket: 'Intermarket',
  news: 'Nieuws',
}

function ConfluenceMeter({ confluence }: ConfluenceMeterProps) {
  if (!confluence?.factors) return null

  const { factors, score, total } = confluence

  const scoreColor = score >= 4 ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                     score >= 3 ? 'text-green-400/80 bg-green-500/5 border-green-500/15' :
                     score >= 2 ? 'text-amber-400 bg-amber-500/5 border-amber-500/15' :
                     'text-red-400 bg-red-500/5 border-red-500/15'

  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${scoreColor}`}>
      <span className="text-[10px] font-bold font-mono">{score}/{total}</span>
      <div className="flex items-center gap-1.5">
        {Object.entries(factors).map(([key, aligned]) => (
          <div key={key} className="flex items-center gap-0.5" title={`${FACTOR_LABELS[key]}: ${aligned ? 'bevestigt' : 'tegenspreekt'}`}>
            <span className={`text-[9px] ${aligned ? 'text-green-400' : 'text-red-400/60'}`}>
              {aligned ? '\u2713' : '\u2717'}
            </span>
            <span className={`text-[8px] ${aligned ? 'text-text-muted' : 'text-text-dim/40'}`}>
              {FACTOR_LABELS[key]?.slice(0, 4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default memo(ConfluenceMeter)
