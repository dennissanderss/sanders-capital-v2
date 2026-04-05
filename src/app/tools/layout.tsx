'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import AuthGate from '@/components/AuthGate'

interface ToolSetting {
  slug: string
  name: string
  is_premium: boolean
  visible: boolean
}

const premiumTools = [
  { href: '/tools/fx-selector', label: 'Introductie', slug: 'fx-selector', icon: 'info', isIntro: true },
  { href: '/tools/fx-analyse', label: 'Fundamentals', slug: 'fx-analyse', flowArrow: true },
  { href: '/tools/execution', label: 'Execution Engine', slug: 'execution', flowArrow: true },
  { href: '/tools/tradescope', label: 'TradeMind', slug: 'tradescope' },
] as const

const freeTools = [
  { href: '/tools/calculator', label: 'Position Size Calculator', slug: 'calculator' },
  { href: '/tools/rente', label: 'Rentetarieven', slug: 'rente' },
]

const allTools = [...premiumTools, ...freeTools]

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [toolSettings, setToolSettings] = useState<Record<string, ToolSetting>>({})
  const [userRole, setUserRole] = useState<string | null>(null)

  const fetchToolSettings = () => {
    const supabase = createClient()
    supabase.from('tool_settings').select('*').then(({ data }) => {
      if (data) {
        const map: Record<string, ToolSetting> = {}
        data.forEach((t: ToolSetting) => { map[t.slug] = t })
        setToolSettings(map)
      }
    })
  }

  useEffect(() => {
    const supabase = createClient()
    fetchToolSettings()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('role').eq('id', user.id).single().then(({ data: profile }) => {
          setUserRole(profile?.role || 'free')
        })
      } else {
        setUserRole('free')
      }
    })

    // Refresh when admin changes settings
    const handleAdminUpdate = () => fetchToolSettings()
    window.addEventListener('admin-settings-updated', handleAdminUpdate)
    return () => window.removeEventListener('admin-settings-updated', handleAdminUpdate)
  }, [])

  // Use DB setting if available, otherwise fall back to static list
  const isPremiumTool = (slug: string) => {
    if (toolSettings[slug] !== undefined) return toolSettings[slug].is_premium
    return premiumTools.some(t => t.slug === slug)
  }
  const hasAccess = (slug: string) => {
    if (!isPremiumTool(slug)) return true
    return userRole === 'premium' || userRole === 'admin'
  }

  const currentSlug = allTools.find(l => pathname === l.href || pathname.startsWith(l.href + '/'))?.slug
  const blockedPage = currentSlug && !hasAccess(currentSlug)

  return (
    <AuthGate sectionName="de tools">
    <div>
      {/* Tools sub-navigation */}
      <div className="border-b border-border bg-bg-elevated/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <nav className="flex items-center gap-0.5 overflow-x-auto py-1 -mb-px">
            {allTools.map((link, i) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
              const premium = isPremiumTool(link.slug)
              const locked = premium && !hasAccess(link.slug)
              // Show divider between premium and free sections
              const prevPremium = i > 0 ? isPremiumTool(allTools[i - 1].slug) : true
              const showDivider = !premium && prevPremium && i > 0

              const tool = link as typeof premiumTools[number] & { flowArrow?: boolean; isIntro?: boolean }
              return (
                <div key={link.href} className="flex items-center">
                  {showDivider && <div className="w-px h-5 bg-border/50 mx-1.5 shrink-0" />}
                  {/* Flow arrow between premium tools */}
                  {'flowArrow' in tool && tool.flowArrow && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-light/30 shrink-0 -mx-0.5 hidden sm:block"><polyline points="9 18 15 12 9 6" /></svg>
                  )}
                  <Link
                    href={link.href}
                    className={`px-3 sm:px-4 py-2 sm:py-2.5 text-sm whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
                      isActive
                        ? premium ? 'border-gold text-heading' : 'border-accent text-heading'
                        : 'border-transparent text-text-muted hover:text-heading hover:border-border-light'
                    }`}
                  >
                    {'isIntro' in tool && tool.isIntro && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                    )}
                    {link.label}
                    {premium && !('isIntro' in tool && tool.isIntro) && (
                      locked ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold/70">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold-dim text-gold font-semibold leading-none">PRO</span>
                      )
                    )}
                  </Link>
                </div>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Premium lock overlay (separate from auth gate — this checks premium access) */}
      {blockedPage ? (
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="p-8 rounded-2xl bg-bg-card border border-gold/20">
            <div className="w-16 h-16 rounded-full bg-gold-dim flex items-center justify-center mx-auto mb-6">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">Premium Tool</h2>
            <p className="text-sm text-text-muted mb-6 leading-relaxed">
              Deze tool is beschikbaar voor premium leden. Upgrade je account om toegang te krijgen
              tot alle premium tools en exclusieve content.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.push('/tools/calculator')}
                className="px-5 py-2.5 rounded-lg border border-border text-sm text-text-muted hover:text-heading transition-colors"
              >
                Terug naar tools
              </button>
              <button
                onClick={() => router.push('/premium')}
                className="px-5 py-2.5 rounded-lg bg-gold/20 border border-gold/30 text-sm text-gold font-medium hover:bg-gold/30 transition-colors"
              >
                Bekijk Premium
              </button>
            </div>
          </div>
        </div>
      ) : children}
    </div>
    </AuthGate>
  )
}
