'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AuthGate from '@/components/AuthGate'

const blogTabs = [
  { href: '/blog', label: 'Artikelen' },
  { href: '/blog/fx-outlook', label: 'FX Outlook' },
]

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AuthGate sectionName="artikelen en analyses">
      <div>
        {/* Blog sub-navigation */}
        <div className="border-b border-border bg-bg-elevated/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <nav className="flex items-center gap-0.5 overflow-x-auto py-1 -mb-px">
              {blogTabs.map((tab) => {
                const isActive = pathname === tab.href
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`px-3 sm:px-4 py-2 sm:py-2.5 text-sm whitespace-nowrap transition-colors border-b-2 ${
                      isActive
                        ? 'border-accent text-heading'
                        : 'border-transparent text-text-muted hover:text-heading hover:border-border-light'
                    }`}
                  >
                    {tab.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>

        {children}
      </div>
    </AuthGate>
  )
}
