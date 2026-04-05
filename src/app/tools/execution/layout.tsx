import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Execution Engine — Sanders Capital',
  description: 'Optimale entry, stop loss en take profit voor forex trades. Mean reversion timing model met 58-62% winrate en profit factor 4-5. Gekoppeld aan de Daily Macro Briefing.',
}

export default function ExecutionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
