'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const subPages = [
  { href: '/tools/fx-selector', label: 'Introductie', icon: 'info' },
  { href: '/tools/fx-selector/tool', label: 'V1 Briefing', icon: 'play' },
  { href: '/tools/fx-selector/v2', label: 'V2 + Nieuws', icon: 'play' },
]

function SubIcon({ icon }: { icon: string }) {
  if (icon === 'info') return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

export default function FxSelectorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div>
      {/* Sub-navigation */}
      <div className="max-w-6xl mx-auto px-6 pt-4">
        <div className="flex items-center gap-2">
          {subPages.map((page) => {
            const isActive = pathname === page.href
            return (
              <Link
                key={page.href}
                href={page.href}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? page.icon === 'play'
                      ? 'bg-accent/15 border border-accent/30 text-accent-light shadow-sm shadow-accent/10'
                      : 'bg-white/[0.07] border border-white/[0.12] text-heading'
                    : 'text-text-muted hover:text-heading hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <SubIcon icon={page.icon} />
                {page.label}
              </Link>
            )
          })}
        </div>
      </div>

      {children}
    </div>
  )
}
