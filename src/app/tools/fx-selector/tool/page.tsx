import type { Metadata } from 'next'
import DailyBriefingDashboard from '../DailyBriefingDashboard'

export const metadata: Metadata = {
  title: 'Daily Macro Briefing | Sanders Capital',
  description: 'Dagelijkse macro-analyse: regime, currency strength, pair bias en economische events met context.',
}

export default function DailyBriefingToolPage() {
  return <DailyBriefingDashboard />
}
