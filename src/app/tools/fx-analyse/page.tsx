import type { Metadata } from 'next'
import FxAnalyseDashboard from './FxAnalyseDashboard'

export const metadata: Metadata = {
  title: 'Macro Fundamentals — Sanders Capital',
  description: 'Leer hoe valutaparen werken: macro-economie, centrale banken en renteverschillen per paar.',
}

export default function FxAnalysePage() {
  return <FxAnalyseDashboard />
}
