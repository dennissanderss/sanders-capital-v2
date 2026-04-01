import type { Metadata } from 'next'
import BriefingV2Dashboard from '../v2/BriefingV2Dashboard'

export const metadata: Metadata = {
  title: 'Daily Macro Briefing | Sanders Capital',
  description: 'Dagelijkse macro-analyse met nieuws sentiment, intermarket signalen, mean reversion strategie en transparant trackrecord.',
}

export default function DailyBriefingToolPage() {
  return <BriefingV2Dashboard />
}
