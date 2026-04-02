interface SignalPillProps {
  direction: string
  label: string
  value: number | null
  unit: string
  changePct: number | null
  previousClose?: number | null
  change?: number | null
}

export default function SignalPill({ direction, label, value, unit, changePct, previousClose, change }: SignalPillProps) {
  const isUp = direction === 'up'
  const isDown = direction === 'down'
  const formatVal = (v: number | null | undefined) => {
    if (v === null || v === undefined) return 'N/A'
    return `${unit === '$' ? '$' : ''}${v.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${unit === '%' ? '%' : ''}`
  }
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all group">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        isUp ? 'bg-green-500/10 text-green-400' : isDown ? 'bg-red-500/10 text-red-400' : 'bg-white/[0.04] text-text-dim'
      }`}>
        {isUp ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
        ) : isDown ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-text-dim uppercase tracking-wider">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-mono font-bold text-heading">
            {formatVal(value)}
          </span>
          {changePct !== null && (
            <span className={`text-xs font-mono ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-text-dim'}`}>
              {change !== null && change !== undefined ? `${change > 0 ? '+' : ''}${change.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ` : ''}
              ({changePct > 0 ? '+' : ''}{changePct}%)
            </span>
          )}
        </div>
        {previousClose !== null && previousClose !== undefined && (
          <p className="text-[9px] text-text-dim/60 font-mono mt-0.5">
            Vorige dag: {formatVal(previousClose)}
          </p>
        )}
      </div>
    </div>
  )
}
