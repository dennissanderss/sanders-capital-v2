import type { Metadata } from 'next'
import FxSelectorDashboard from './FxSelectorDashboard'

export const metadata: Metadata = {
  title: 'Daily FX Pair Selector — Sanders Capital',
  description: 'Automatische FX analyse: valuta sterkte, intermarket signalen en dagelijkse pair selectie.',
}

export default function FxSelectorPage() {
  return <FxSelectorDashboard />
}
