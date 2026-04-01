import BriefingV2Dashboard from './BriefingV2Dashboard'

export const metadata = {
  title: 'Daily Macro Briefing | Sanders Capital',
  description: 'Dagelijkse macro-analyse met nieuws sentiment, intermarket signalen, mean reversion strategie en transparant trackrecord.',
}

export default function DailyBriefingPage() {
  return <BriefingV2Dashboard />
}
