'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import LanguageSelector from './LanguageSelector'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/nieuws', label: 'Nieuws' },
  { href: '/premium', label: 'Premium' },
  { href: '/over', label: 'Over' },
  { href: '/contact', label: 'Contact' },
]

const blogDropdown = [
  { href: '/blog', label: 'Artikelen', desc: 'Educatieve artikelen & modules', icon: 'book' },
  { href: '/blog/fx-outlook', label: 'FX Outlook', desc: 'Marktanalyses & macro verwachtingen', icon: 'pulse' },
]

const toolsDropdown = [
  { href: '/tools/fx-selector', slug: 'fx-selector', label: 'Daily Macro Briefing', desc: 'Dagelijkse marktanalyse & bias', icon: 'compass', defaultPremium: true },
  { href: '/tools/fx-analyse', slug: 'fx-analyse', label: 'Macro Fundamentals', desc: 'Leer valutaparen analyseren', icon: 'layers', defaultPremium: true },
  { href: '/tools/tradescope', slug: 'tradescope', label: 'TradeScope', desc: 'Analyseer je trades & performance', icon: 'activity', defaultPremium: true },
  { href: '/tools/calculator', slug: 'calculator', label: 'Position Size Calculator', desc: 'Bereken je positiegrootte', icon: 'calculator' },
  { href: '/tools/kalender', slug: 'kalender', label: 'Economische Kalender', desc: 'Aankomende events & data', icon: 'calendar' },
  { href: '/tools/rente', slug: 'rente', label: 'Rentetarieven', desc: 'Centrale bank rentes', icon: 'percent' },
]

interface KbCategory {
  name: string
  slug: string
  icon: string
  is_premium: boolean
}

function NavIcon({ icon }: { icon: string }) {
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
    // Kennisbank icons
    case 'shield': return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
    case 'smile': return <svg {...props}><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
    case 'activity': return <svg {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
    case 'monitor': return <svg {...props}><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
    case 'settings': return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
    case 'lock': return <svg {...props}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
    case 'star': return <svg {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
    case 'trending-up': return <svg {...props}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
    default: return null
  }
}

export default function Header() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [kbCategories, setKbCategories] = useState<KbCategory[]>([])
  const [toolPremiumMap, setToolPremiumMap] = useState<Record<string, boolean>>({})

  // Fetch categories & tool settings from DB
  const fetchData = () => {
    const supabase = createClient()
    supabase.from('kennisbank_categories').select('name, slug, icon, is_premium').order('order_index').then(({ data }) => {
      if (data) setKbCategories(data)
    })
    supabase.from('tool_settings').select('slug, is_premium').then(({ data }) => {
      if (data) {
        const map: Record<string, boolean> = {}
        data.forEach((t: { slug: string; is_premium: boolean }) => { map[t.slug] = t.is_premium })
        setToolPremiumMap(map)
      }
    })
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    fetchData()

    // Listen for admin changes to refresh nav badges
    const handleAdminUpdate = () => fetchData()
    window.addEventListener('admin-settings-updated', handleAdminUpdate)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('admin-settings-updated', handleAdminUpdate)
    }
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

          {/* Nieuws */}
          <Link
            href="/nieuws"
            className={`relative text-sm tracking-wide transition-colors duration-200 hover:text-heading ${
              pathname.startsWith('/nieuws') ? 'text-heading' : 'text-text-muted'
            }`}
          >
            Nieuws
            {pathname.startsWith('/nieuws') && <span className="absolute -bottom-1 left-0 right-0 h-px bg-accent" />}
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
                      <NavIcon icon={item.icon} />
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

          {/* Kennisbank dropdown */}
          <div className="relative group/kb">
            <button
              className={`relative text-sm tracking-wide transition-colors duration-200 hover:text-heading flex items-center gap-1 cursor-pointer ${
                pathname.startsWith('/kennisbank') ? 'text-heading' : 'text-text-muted'
              }`}
              onClick={() => window.location.href = '/kennisbank'}
            >
              Kennisbank
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 transition-transform duration-200 group-hover/kb:rotate-180">
                <path d="M2.5 4 5 6.5 7.5 4" />
              </svg>
              {pathname.startsWith('/kennisbank') && (
                <span className="absolute -bottom-1 left-0 right-0 h-px bg-accent" />
              )}
            </button>

            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover/kb:opacity-100 group-hover/kb:visible transition-all duration-200 before:absolute before:top-0 before:left-0 before:right-0 before:h-2 before:bg-transparent">
              <div className="rounded-xl shadow-2xl border border-white/[0.12] py-2 min-w-[280px]" style={{ background: 'rgba(13, 14, 20, 0.97)', backdropFilter: 'blur(24px)' }}>
                {kbCategories.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/kennisbank#${cat.slug}`}
                    className="flex items-start gap-3 px-4 py-2.5 transition-all duration-150 hover:bg-white/[0.08]"
                  >
                    <span className="mt-0.5 flex-shrink-0 text-text-dim">
                      <NavIcon icon={cat.icon} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-muted transition-colors">
                          {cat.name}
                        </span>
                        {cat.is_premium && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/10 text-accent-light leading-none">
                            Pro
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

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
                    {i === 3 && <div className="my-1.5 mx-3 h-px bg-white/[0.06]" />}
                    <Link
                      href={item.href}
                      className={`flex items-start gap-3 px-4 py-2.5 transition-all duration-150 hover:bg-white/[0.08] ${
                        pathname === item.href ? 'bg-white/[0.06]' : ''
                      }`}
                    >
                      <span className={`mt-0.5 flex-shrink-0 ${pathname === item.href ? 'text-accent-light' : 'text-text-dim'}`}>
                        <NavIcon icon={item.icon} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${pathname === item.href ? 'text-heading' : 'text-text-muted'} transition-colors`}>
                            {item.label}
                          </span>
                          {(item.slug in toolPremiumMap ? toolPremiumMap[item.slug] : item.defaultPremium) && (
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

          {/* Remaining: Premium, Over, Contact (Nieuws is handled separately above) */}
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
          <LanguageSelector />
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

            {/* Nieuws */}
            <Link href="/nieuws" className={`text-sm py-2 transition-colors ${pathname.startsWith('/nieuws') ? 'text-heading' : 'text-text-muted'}`}>
              Nieuws
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

            {/* Kennisbank section */}
            <div className="text-sm py-2 text-text-muted font-semibold">Kennisbank</div>
            {kbCategories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/kennisbank#${cat.slug}`}
                className="text-sm py-1.5 pl-4 transition-colors text-text-muted flex items-center gap-2"
              >
                {cat.name}
                {cat.is_premium && (
                  <span className="text-[9px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded bg-accent/10 text-accent-light leading-none">
                    Pro
                  </span>
                )}
              </Link>
            ))}
            {/* Tools section */}
            <div className="text-sm py-2 text-text-muted font-semibold">Tools</div>
            {toolsDropdown.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm py-1.5 pl-4 transition-colors flex items-center gap-2 ${
                  pathname === item.href ? 'text-heading' : 'text-text-muted'
                }`}
              >
                {item.label}
                {(item.slug in toolPremiumMap ? toolPremiumMap[item.slug] : item.defaultPremium) && (
                  <span className="text-[9px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded bg-accent/10 text-accent-light leading-none">
                    Pro
                  </span>
                )}
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

            {/* Language */}
            <div className="pt-2 border-t border-white/[0.06]">
              <LanguageSelector />
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
