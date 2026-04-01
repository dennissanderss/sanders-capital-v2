import type { Metadata } from 'next'
import AuthGate from '@/components/AuthGate'
import NieuwsContent from './NieuwsContent'

export const metadata: Metadata = {
  title: 'Nieuws',
  description: 'Gecureerd financieel nieuws: centrale banken, rentes, geopolitiek en macro-economie. Alleen wat relevant is voor FX.',
}

export default function NieuwsPage() {
  return (
    <AuthGate sectionName="het nieuws">
      <NieuwsContent />
    </AuthGate>
  )
}
