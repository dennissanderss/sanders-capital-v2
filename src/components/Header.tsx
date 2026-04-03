'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import NavIcon from './NavIcon'
import LanguageSelector from './LanguageSelector'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/nieuws', label: 'Nieuws' },
  { href: '/premium', label: 'Premium' },
  { href: '/over', label: 'Over' },
  { href: '/contact', label: 'Contact' },
]

const nieuwsDropdown = [
  { href: '/nieuws', label: 'Dagelijks Financieel Nieuws', desc: 'Het laatste financiële nieuws', icon: 'pulse' },
  { href: '/tools/kalender', label: 'Economische Kalender', desc: 'Aankomende events & data', icon: 'calendar' },
]

const blogDropdown = [
  { href: '/blog', label: 'Artikelen', desc: 'Educatieve artikelen & modules', icon: 'book' },
  { href: '/blog/fx-outlook', label: 'FX Outlook', desc: 'Marktanalyses & macro verwachtingen', icon: 'pulse' },
]

const toolsDropdown = [
  { href: '/tools/fx-analyse', slug: 'fx-analyse', label: 'Macro Fundamentals', desc: 'Valutaparen analyseren op fundamentals', icon: 'layers', defaultPremium: true },
  { href: '/tools/fx-selector', slug: 'fx-selector', label: 'Daily Macro Briefing', desc: 'Dagelijkse marktanalyse & bias', icon: 'compass', defaultPremium: true },
  { href: '/tools/tradescope', slug: 'tradescope', label: 'TradeMind', desc: 'Analyseer je trades & performance', icon: 'activity', defaultPremium: true },
  { href: '/tools/calculator', slug: 'calculator', label: 'Position Size Calculator', desc: 'Bereken je positiegrootte', icon: 'calculator' },
  { href: '/tools/rente', slug: 'rente', label: 'Rentetarieven', desc: 'Centrale bank rentes', icon: 'percent' },
]

interface KbCategory {
  name: string
  slug: string
  icon: string
  is_premium: boolean
}


export default function Header() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [kbCategories, setKbCategories] = useState<KbCategory[]>([])
  const [toolPremiumMap, setToolPremiumMap] = useState<Record<string, boolean>>({})
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

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
    setOpenDropdown(null)
  }, [pathname])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: scrolled ? 'rgba(13, 16, 22, 0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(24px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(24px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'background 0.4s ease, border-bottom 0.4s ease, backdrop-filter 0.4s ease',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image
            src="/assets/images/logo.png"
            alt="Sanders Capital"
            width={36}
            height={36}
            className="rounded"
            priority
          />
          <span className="text-lg font-semibold tracking-wider text-heading font-display">
            SANDERS CAPITAL
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-7">
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

          {/* Nieuws dropdown */}
          <div className="relative group/nieuws">
            <button
              className={`relative text-sm tracking-wide transition-colors duration-200 hover:text-heading flex items-center gap-1 cursor-pointer ${
                pathname.startsWith('/nieuws') || pathname === '/tools/kalender' ? 'text-heading' : 'text-text-muted'
              }`}
              onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'nieuws' ? null : 'nieuws') }}
            >
              Nieuws
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`mt-0.5 transition-transform duration-200 ${openDropdown === 'nieuws' ? 'rotate-180' : ''} group-hover/nieuws:rotate-180`}>
                <path d="M2.5 4 5 6.5 7.5 4" />
              </svg>
              {(pathname.startsWith('/nieuws') || pathname === '/tools/kalender') && (
                <span className="absolute -bottom-1 left-0 right-0 h-px bg-accent" />
              )}
            </button>

            <div className={`absolute top-full left-1/2 -translate-x-1/2 pt-2 transition-all duration-200 before:absolute before:top-0 before:left-0 before:right-0 before:h-2 before:bg-transparent ${openDropdown === 'nieuws' ? 'opacity-100 visible' : 'opacity-0 invisible group-hover/nieuws:opacity-100 group-hover/nieuws:visible'}`}>
              <div className="rounded-xl shadow-2xl border border-white/[0.12] py-2 min-w-[280px]" style={{ background: 'rgba(13, 14, 20, 0.97)', backdropFilter: 'blur(24px)' }}>
                {nieuwsDropdown.map((item) => (
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

          {/* Blog dropdown */}
          <div className="relative group/blog">
            <button
              className={`relative text-sm tracking-wide transition-colors duration-200 hover:text-heading flex items-center gap-1 cursor-pointer ${
                pathname.startsWith('/blog') ? 'text-heading' : 'text-text-muted'
              }`}
              onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'blog' ? null : 'blog') }}
            >
              Blog
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`mt-0.5 transition-transform duration-200 ${openDropdown === 'blog' ? 'rotate-180' : ''} group-hover/blog:rotate-180`}>
                <path d="M2.5 4 5 6.5 7.5 4" />
              </svg>
              {pathname.startsWith('/blog') && (
                <span className="absolute -bottom-1 left-0 right-0 h-px bg-accent" />
              )}
            </button>

            <div className={`absolute top-full left-1/2 -translate-x-1/2 pt-2 transition-all duration-200 before:absolute before:top-0 before:left-0 before:right-0 before:h-2 before:bg-transparent ${openDropdown === 'blog' ? 'opacity-100 visible' : 'opacity-0 invisible group-hover/blog:opacity-100 group-hover/blog:visible'}`}>
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
              onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'kb' ? null : 'kb') }}
            >
              Kennisbank
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`mt-0.5 transition-transform duration-200 ${openDropdown === 'kb' ? 'rotate-180' : ''} group-hover/kb:rotate-180`}>
                <path d="M2.5 4 5 6.5 7.5 4" />
              </svg>
              {pathname.startsWith('/kennisbank') && (
                <span className="absolute -bottom-1 left-0 right-0 h-px bg-accent" />
              )}
            </button>

            <div className={`absolute top-full left-1/2 -translate-x-1/2 pt-2 transition-all duration-200 before:absolute before:top-0 before:left-0 before:right-0 before:h-2 before:bg-transparent ${openDropdown === 'kb' ? 'opacity-100 visible' : 'opacity-0 invisible group-hover/kb:opacity-100 group-hover/kb:visible'}`}>
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
              onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'tools' ? null : 'tools') }}
            >
              Tools
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`mt-0.5 transition-transform duration-200 ${openDropdown === 'tools' ? 'rotate-180' : ''} group-hover/tools:rotate-180`}>
                <path d="M2.5 4 5 6.5 7.5 4" />
              </svg>
              {pathname.startsWith('/tools') && (
                <span className="absolute -bottom-1 left-0 right-0 h-px bg-accent" />
              )}
            </button>

            <div className={`absolute top-full left-1/2 -translate-x-1/2 pt-2 transition-all duration-200 before:absolute before:top-0 before:left-0 before:right-0 before:h-2 before:bg-transparent ${openDropdown === 'tools' ? 'opacity-100 visible' : 'opacity-0 invisible group-hover/tools:opacity-100 group-hover/tools:visible'}`}>
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
          className="lg:hidden flex flex-col gap-1.5 p-3"
          aria-label="Menu"
        >
          <span className={`w-5 h-px bg-heading transition-transform duration-200 ${mobileOpen ? 'rotate-45 translate-y-[4px]' : ''}`} />
          <span className={`w-5 h-px bg-heading transition-opacity duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-px bg-heading transition-transform duration-200 ${mobileOpen ? '-rotate-45 -translate-y-[4px]' : ''}`} />
        </button>
      </div>

      {/* Mobile slide-out overlay */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile slide-out panel */}
      <nav
        className={`lg:hidden fixed top-0 right-0 z-50 h-[100dvh] transition-transform duration-300 ease-out ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          width: '95%',
          maxWidth: '420px',
          background: 'rgba(10, 12, 16, 0.99)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Close button */}
        <div className="flex items-center justify-between px-8 h-16 border-b border-white/[0.06]">
          <span className="text-sm font-display font-semibold text-heading tracking-wider">Menu</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors"
            aria-label="Sluiten"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-8 py-6 flex flex-col items-center text-center" style={{ height: 'calc(100dvh - 4rem)' }}>
          {/* Main links */}
          <div className="w-full flex flex-col items-center gap-1 mb-6">
            {[
              { href: '/', label: 'Home' },
              { href: '/premium', label: 'Premium' },
              { href: '/over', label: 'Over' },
              { href: '/contact', label: 'Contact' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`w-full py-3 text-base font-medium rounded-lg transition-colors ${
                  pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
                    ? 'text-heading bg-white/[0.04]'
                    : 'text-text-muted hover:text-heading hover:bg-white/[0.03]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className="w-16 h-px bg-white/[0.08] mb-6" />

          {/* Nieuws section */}
          <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim mb-3 font-semibold">Nieuws</p>
          <div className="w-full flex flex-col items-center gap-1 mb-6">
            {nieuwsDropdown.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full py-2.5 text-sm rounded-lg transition-colors ${
                  pathname === item.href ? 'text-heading bg-white/[0.04]' : 'text-text-muted hover:text-heading hover:bg-white/[0.03]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Blog section */}
          <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim mb-3 font-semibold">Blog</p>
          <div className="w-full flex flex-col items-center gap-1 mb-6">
            {blogDropdown.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full py-2.5 text-sm rounded-lg transition-colors ${
                  pathname === item.href ? 'text-heading bg-white/[0.04]' : 'text-text-muted hover:text-heading hover:bg-white/[0.03]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Kennisbank section */}
          <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim mb-3 font-semibold">Kennisbank</p>
          <div className="w-full flex flex-col items-center gap-1 mb-6">
            {kbCategories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/kennisbank#${cat.slug}`}
                className="w-full py-2.5 text-sm text-text-muted hover:text-heading hover:bg-white/[0.03] rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {cat.name}
                {cat.is_premium && (
                  <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/10 text-accent-light leading-none">
                    Pro
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Tools section */}
          <p className="text-[10px] uppercase tracking-[0.2em] text-text-dim mb-3 font-semibold">Tools</p>
          <div className="w-full flex flex-col items-center gap-1 mb-6">
            {toolsDropdown.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full py-2.5 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  pathname === item.href ? 'text-heading bg-white/[0.04]' : 'text-text-muted hover:text-heading hover:bg-white/[0.03]'
                }`}
              >
                {item.label}
                {(item.slug in toolPremiumMap ? toolPremiumMap[item.slug] : item.defaultPremium) && (
                  <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/10 text-accent-light leading-none">
                    Pro
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className="w-16 h-px bg-white/[0.08] mb-6" />

          {/* Login / Dashboard */}
          <Link
            href={user ? '/dashboard' : '/login'}
            className="w-full py-3 text-sm font-medium rounded-lg border border-accent/30 text-accent-light hover:bg-accent-glow transition-colors mb-4"
          >
            {user ? 'Dashboard' : 'Inloggen'}
          </Link>

          {/* Language selector */}
          <div className="mt-auto pt-4">
            <LanguageSelector />
          </div>
        </div>
      </nav>
    </header>
  )
}
