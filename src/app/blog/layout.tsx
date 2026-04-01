import AuthGate from '@/components/AuthGate'

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate sectionName="artikelen en analyses">{children}</AuthGate>
}
