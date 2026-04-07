// Force dynamic rendering — admin page needs runtime env vars
export const dynamic = 'force-dynamic'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
