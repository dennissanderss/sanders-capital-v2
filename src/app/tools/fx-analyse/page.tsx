import type { Metadata } from 'next'
import FxAnalyseDashboard from './FxAnalyseDashboard'

export const metadata: Metadata = {
  title: 'Fundamental FX Analyse — Sanders Capital',
  description: 'Leer fundamentele analyse begrijpen: macro-economie, centrale banken en marktpositionering per valutapaar.',
}

export default function FxAnalysePage() {
  return <FxAnalyseDashboard />
}
