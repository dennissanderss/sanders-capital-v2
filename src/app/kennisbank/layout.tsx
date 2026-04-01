import AuthGate from '@/components/AuthGate'

export default function KennisbankLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate sectionName="de kennisbank">{children}</AuthGate>
}
