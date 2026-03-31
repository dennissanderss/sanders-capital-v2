'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const toolLinks = [
  { href: '/tools/fx-selector', label: 'FX Selector' },
  { href: '/tools/fx-analyse', label: 'FX Analyse' },
  { href: '/tools/marktoverzicht', label: 'Marktoverzicht' },
  { href: '/tools/calculator', label: 'Position Size Calculator' },
  { href: '/tools/kalender', label: 'Economische Kalender', sub: [
    { href: '/tools/begrippen', label: 'Begrippen' },
  ]},
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
              const isActive = pathname === link.href || link.sub?.some(s => pathname === s.href)
              return (
                <div key={link.href} className="relative group flex items-center">
                  <Link
                    href={link.href}
                    className={`px-3 sm:px-4 py-2 sm:py-2.5 text-sm whitespace-nowrap transition-colors border-b-2 ${
                      isActive
                        ? 'border-accent text-heading'
                        : 'border-transparent text-text-muted hover:text-heading hover:border-border-light'
                    }`}
                  >
                    {link.label}
                  </Link>
                  {link.sub && (
                    <>
                      <span className="text-text-dim px-1">|</span>
                      {link.sub.map((subLink) => (
                        <Link
                          key={subLink.href}
                          href={subLink.href}
                          className={`px-3 py-2.5 text-xs whitespace-nowrap transition-colors border-b-2 ${
                            pathname === subLink.href
                              ? 'border-accent text-heading'
                              : 'border-transparent text-text-dim hover:text-text-muted hover:border-border-light'
                          }`}
                        >
                          {subLink.label}
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              )
            })}
          </nav>
        </div>
      </div>

      {children}
    </div>
  )
}
