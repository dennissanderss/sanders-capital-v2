'use client'

import Link from 'next/link'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/kennisbank', label: 'Kennisbank' },
  { href: '/premium', label: 'Premium' },
  { href: '/over', label: 'Over' },
  { href: '/contact', label: 'Contact' },
]

const blogDropdown = [
  { href: '/blog', label: 'Artikelen', desc: 'Educatieve artikelen & modules', icon: 'book' },
  { href: '/blog/fx-outlook', label: 'FX Outlook', desc: 'Marktanalyses & macro verwachtingen', icon: 'pulse' },
]

const toolsDropdown = [
  { href: '/tools/fx-selector', label: 'Daily Macro Briefing', desc: 'Dagelijkse marktanalyse & bias', icon: 'compass', premium: true },
  { href: '/tools/fx-analyse', label: 'Macro Fundamentals', desc: 'Leer valutaparen analyseren', icon: 'layers', premium: true },
  { href: '/tools/calculator', label: 'Position Size Calculator', desc: 'Bereken je positiegrootte', icon: 'calculator' },
  { href: '/tools/kalender', label: 'Economische Kalender', desc: 'Aankomende events & data', icon: 'calendar' },
  { href: '/tools/rente', label: 'Rentetarieven', desc: 'Centrale bank rentes', icon: 'percent' },
]

function ToolIcon({ icon }: { icon: string }) {
  const props = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (icon) {
    case 'compass': return <svg {...props}><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>
    case 'layers': return <svg {...props}><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
    case 'bar-chart': return <svg {...props}><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>
    case 'calculator': return <svg {...props}><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="8" y2="10.01" /><line x1="12" y1="10" x2="12" y2="10.01" /><line x1="16" y1="10" x2="16" y2="10.01" /><line x1="8" y1="14" x2="8" y2="14.01" /><line x1="12" y1="14" x2="12" y2="14.01" /><line x1="16" y1="14" x2="16" y2="14.01" /><line x1="8" y1="18" x2="16" y2="18" /></svg>
    case 'calendar': return <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
    case 'percent': return <svg {...props}><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>
    case 'book': return <svg {...props}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
    case 'pulse': return <svg {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
    default: return null
  }
}

export default function Header() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'glass-elevated border-b border-white/[0.07]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <img
            src="/assets/images/logo.png"
            alt="Sanders Capital"
            width={36}
            height={36}
            className="rounded"
          />
          <span className="text-lg font-semibold tracking-wider text-heading font-display">
            SANDERS CAPITAL
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {/* Home */}
          <Link
            href="/"
            className={`relative text-sm tracking-wide transition-colors duration-200 hover:text-heading ${
              pathname === '/' ? 'text-heading' : 'text-text-muted'
            }`}
          >
            Home
            {pathname === '/' && <span className="absolute -bottom-1 left-0 right-0 h-px bg-accent" />}
          </Link>

          {/* Blog dropdown */}
          <div className="relative group/blog">
            <button
              className={`relative text-sm tracking-wide transition-colors duration-200 hover:text-heading flex items-center gap-1 cursor-pointer ${
                pathname.startsWith('/blog') ? 'text-heading' : 'text-text-muted'
              }`}
              onClick={() => window.location.href = '/blog'}
            >
              Blog
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 transition-transform duration-200 group-hover/blog:rotate-180">
                <path d="M2.5 4 5 6.5 7.5 4" />
              </svg>
              {pathname.startsWith('/blog') && (
                <span className="absolute -bottom-1 left-0 right-0 h-px bg-accent" />
              )}
            </button>

            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover/blog:opacity-100 group-hover/blog:visible transition-all duration-200 before:absolute before:top-0 before:left-0 before:right-0 before:h-2 before:bg-transparent">
              <div className="rounded-xl shadow-2xl border border-white/[0.12] py-2 min-w-[260px]" style={{ background: 'rgba(13, 14, 20, 0.97)', backdropFilter: 'blur(24px)' }}>
                {blogDropdown.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-start gap-3 px-4 py-2.5 transition-all duration-150 hover:bg-white/[0.08] ${
                      pathname === item.href ? 'bg-white/[0.06]' : ''
                    }`}
                  >
                    <span className={`mt-0.5 flex-shrink-0 ${pathname === item.href ? 'text-accent-light' : 'text-text-dim'}`}>
                      <ToolIcon icon={item.icon} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium ${pathname === item.href ? 'text-heading' : 'text-text-muted'} transition-colors`}>
                        {item.label}
                      </span>
                      <p className="text-xs text-text-dim mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Kennisbank */}
          <Link
            href="/kennisbank"
            className={`relative text-sm tracking-wide transition-colors duration-200 hover:text-heading ${
              pathname.startsWith('/kennisbank') ? 'text-heading' : 'text-text-muted'
            }`}
          >
            Kennisbank
            {pathname.startsWith('/kennisbank') && <span className="absolute -bottom-1 left-0 right-0 h-px bg-accent" />}
          </Link>

          {/* Tools dropdown */}
          <div className="relative group/tools">
            <button
              className={`relative text-sm tracking-wide transition-colors duration-200 hover:text-heading flex items-center gap-1 cursor-pointer ${
                pathname.startsWith('/tools') ? 'text-heading' : 'text-text-muted'
              }`}
              onClick={() => window.location.href = '/tools'}
            >
              Tools
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 transition-transform duration-200 group-hover/tools:rotate-180">
                <path d="M2.5 4 5 6.5 7.5 4" />
              </svg>
              {pathname.startsWith('/tools') && (
                <span className="absolute -bottom-1 left-0 right-0 h-px bg-accent" />
              )}
            </button>

            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover/tools:opacity-100 group-hover/tools:visible transition-all duration-200 before:absolute before:top-0 before:left-0 before:right-0 before:h-2 before:bg-transparent">
              <div className="rounded-xl shadow-2xl border border-white/[0.12] py-2 min-w-[280px]" style={{ background: 'rgba(13, 14, 20, 0.97)', backdropFilter: 'blur(24px)' }}>
                {toolsDropdown.map((item, i) => (
                  <div key={item.href}>
                    {i === 2 && <div className="my-1.5 mx-3 h-px bg-white/[0.06]" />}
                    <Link
                      href={item.href}
                      className={`flex items-start gap-3 px-4 py-2.5 transition-all duration-150 hover:bg-white/[0.08] ${
                        pathname === item.href ? 'bg-white/[0.06]' : ''
                      }`}
                    >
                      <span className={`mt-0.5 flex-shrink-0 ${pathname === item.href ? 'text-accent-light' : 'text-text-dim'}`}>
                        <ToolIcon icon={item.icon} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${pathname === item.href ? 'text-heading' : 'text-text-muted'} transition-colors`}>
                            {item.label}
                          </span>
                          {item.premium && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/10 text-accent-light leading-none">
                              Pro
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-dim mt-0.5 leading-relaxed">{item.desc}</p>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Remaining: Premium, Over, Contact */}
          {navLinks.filter(l => ['Premium', 'Over', 'Contact'].includes(l.label)).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative text-sm tracking-wide transition-colors duration-200 hover:text-heading ${
                pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
                  ? 'text-heading'
                  : 'text-text-muted'
              }`}
            >
              {link.label}
              {(pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))) && (
                <span className="absolute -bottom-1 left-0 right-0 h-px bg-accent" />
              )}
            </Link>
          ))}
          {user ? (
            <Link
              href="/dashboard"
              className="text-sm px-4 py-1.5 rounded-lg border border-border text-heading hover:bg-bg-hover transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-sm px-4 py-1.5 rounded-lg border border-accent/30 text-accent-light hover:bg-accent-glow transition-colors"
            >
              Inloggen
            </Link>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden flex flex-col gap-1.5 p-3"
          aria-label="Menu"
        >
          <span className={`w-5 h-px bg-heading transition-transform duration-200 ${mobileOpen ? 'rotate-45 translate-y-[4px]' : ''}`} />
          <span className={`w-5 h-px bg-heading transition-opacity duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-px bg-heading transition-transform duration-200 ${mobileOpen ? '-rotate-45 -translate-y-[4px]' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="md:hidden glass-elevated border-b border-white/[0.07]">
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-3">
            <Link href="/" className={`text-sm py-2 transition-colors ${pathname === '/' ? 'text-heading' : 'text-text-muted'}`}>
              Home
            </Link>

            {/* Blog section */}
            <div className="text-sm py-2 text-text-muted font-semibold">Blog</div>
            {blogDropdown.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm py-1.5 pl-4 transition-colors ${
                  pathname === item.href ? 'text-heading' : 'text-text-muted'
                }`}
              >
                {item.label}
              </Link>
            ))}

            <Link href="/kennisbank" className={`text-sm py-2 transition-colors ${pathname.startsWith('/kennisbank') ? 'text-heading' : 'text-text-muted'}`}>
              Kennisbank
            </Link>

            {/* Tools section */}
            <div className="text-sm py-2 text-text-muted font-semibold">Tools</div>
            {toolsDropdown.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm py-1.5 pl-4 transition-colors ${
                  pathname === item.href ? 'text-heading' : 'text-text-muted'
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Premium, Over, Contact */}
            {navLinks.filter(l => ['Premium', 'Over', 'Contact'].includes(l.label)).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm py-2 transition-colors ${
                  pathname === link.href ? 'text-heading' : 'text-text-muted'
                }`}
              >
                {link.label}
              </Link>
            ))}

            <Link
              href={user ? '/dashboard' : '/login'}
              className="text-sm py-2 text-accent-light"
            >
              {user ? 'Dashboard' : 'Inloggen'}
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
