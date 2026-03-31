import type { Metadata } from 'next'
import TradeScopeDashboard from './TradeScopeDashboard'

export const metadata: Metadata = {
  title: 'TradeScope — Sanders Capital',
  description: 'Analyseer je trades: metrics, equity curves, Monte Carlo simulaties en strategie optimalisatie.',
}

export default function TradeScopePage() {
  return <TradeScopeDashboard />
}
