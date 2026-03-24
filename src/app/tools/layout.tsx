'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const toolLinks = [
  { href: '/tools/calculator', label: 'Position Size Calculator' },
  { href: '/tools/kalender', label: 'Economische Kalender' },
  { href: '/tools/begrippen', label: 'Economische Begrippen' },
  { href: '/tools/rente', label: 'Rentetarieven' },
]

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div>
      {/* Tools sub-navigation */}
      <div className="border-b border-border bg-bg-elevated/50">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex items-center gap-1 overflow-x-auto py-1 -mb-px">
            {toolLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2.5 text-sm whitespace-nowrap transition-colors border-b-2 ${
                    isActive
                      ? 'border-accent text-heading'
                      : 'border-transparent text-text-muted hover:text-heading hover:border-border-light'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {children}
    </div>
  )
}
