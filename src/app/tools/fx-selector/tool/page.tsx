import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

const BriefingV2Dashboard = dynamic(() => import('../v2/BriefingV2Dashboard'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-text-muted">Dashboard laden...</p>
      </div>
    </div>
  ),
})

export const metadata: Metadata = {
  title: 'Daily Macro Briefing | Sanders Capital',
  description: 'Dagelijkse macro-analyse met nieuws sentiment, intermarket signalen, mean reversion strategie en transparant trackrecord.',
}

export default function DailyBriefingToolPage() {
  return <BriefingV2Dashboard />
}
