export default function DisclaimerBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-card border border-border text-xs text-text-muted ${className}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      Educatief, geen financieel advies
    </div>
  )
}
