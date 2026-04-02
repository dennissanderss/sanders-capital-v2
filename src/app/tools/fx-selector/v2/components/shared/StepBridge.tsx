interface StepBridgeProps {
  icon: 'down' | 'check' | 'arrow'
  text: string
}

export default function StepBridge({ icon, text }: StepBridgeProps) {
  return (
    <div className="flex items-center gap-3 py-4 px-2">
      <div className="flex flex-col items-center gap-1">
        <div className="w-px h-4 bg-accent/20" />
        <div className="w-5 h-5 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
          {icon === 'down' && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent-light">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
          {icon === 'check' && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent-light">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {icon === 'arrow' && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent-light">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          )}
        </div>
        <div className="w-px h-4 bg-accent/20" />
      </div>
      <p className="text-xs text-text-dim italic leading-relaxed">{text}</p>
    </div>
  )
}
