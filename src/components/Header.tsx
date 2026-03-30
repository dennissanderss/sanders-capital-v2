'use client'

import Link from 'next/link'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/blog', label: 'Blog' },
  { href: '/kennisbank', label: 'Kennisbank' },
  { href: '/premium', label: 'Premium' },
  { href: '/over', label: 'Over' },
  { href: '/contact', label: 'Contact' },
]

const toolsDropdown = [
  { href: '/tools/fx-selector', label: 'FX Pair Selector' },
  { href: '/tools/marktoverzicht', label: 'Marktoverzicht' },
  { href: '/tools/calculator', label: 'Position Size Calculator' },
  { href: '/tools/kalender', label: 'Economische Kalender' },
  { href: '/tools/begrippen', label: 'Economische Begrippen', sub: true },
  { href: '/tools/rente', label: 'Rentetarieven' },
]

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
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.slice(0, 3).map((link) => (
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

          {/* Tools dropdown */}
          <div className="relative group">
            <Link
              href="/tools"
              className={`relative text-sm tracking-wide transition-colors duration-200 hover:text-heading flex items-center gap-1 ${
                pathname.startsWith('/tools') ? 'text-heading' : 'text-text-muted'
              }`}
            >
              Tools
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 transition-transform duration-200 group-hover:rotate-180">
                <path d="M2.5 4 5 6.5 7.5 4" />
              </svg>
              {pathname.startsWith('/tools') && (
                <span className="absolute -bottom-1 left-0 right-0 h-px bg-accent" />
              )}
            </Link>

            {/* Dropdown menu */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <div className="glass-elevated rounded-xl shadow-2xl py-2 min-w-[220px]">
                {toolsDropdown.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-4 py-2.5 text-sm transition-colors hover:bg-bg-hover ${
                      item.sub ? 'pl-8 text-text-dim hover:text-text-muted' : 'text-text-muted hover:text-heading'
                    } ${pathname === item.href ? 'text-heading bg-bg-hover' : ''}`}
                  >
                    {item.sub && <span className="text-text-dim mr-1">└</span>}
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {navLinks.slice(3).map((link) => (
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
            {navLinks.slice(0, 3).map((link) => (
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
            {navLinks.slice(3).map((link) => (
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
