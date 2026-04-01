'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthGateProps {
  children: React.ReactNode
  /** What this section is called, for the message (e.g. "artikelen", "tools", "kennisbank") */
  sectionName?: string
}

export default function AuthGate({ children, sectionName = 'content' }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [banned, setBanned] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        // Check if banned
        supabase.from('profiles').select('role, banned_at').eq('id', user.id).single().then(({ data }) => {
          if (data?.banned_at) {
            setBanned(true)
          } else {
            setUser(user)
          }
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (banned) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="p-8 rounded-2xl bg-bg-card border border-red-500/20">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            </div>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              Account geblokkeerd
            </h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Je account is geblokkeerd. Neem contact op als je denkt dat dit een fout is.
            </p>
            <Link
              href="/contact"
              className="inline-block mt-6 px-5 py-2.5 rounded-lg border border-border text-sm text-text-muted hover:text-heading transition-colors"
            >
              Contact opnemen
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center">
          <div className="p-8 sm:p-10 rounded-2xl bg-bg-card border border-border relative overflow-hidden">
            {/* Subtle glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-accent/[0.06] rounded-full blur-3xl" />

            <div className="relative">
              {/* Lock icon */}
              <div className="w-16 h-16 rounded-2xl bg-accent-glow border border-accent/20 flex items-center justify-center mx-auto mb-6">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>

              <h2 className="text-2xl font-display font-semibold text-heading mb-3">
                Maak een gratis account
              </h2>
              <p className="text-text-muted leading-relaxed mb-2">
                Log in of registreer om toegang te krijgen tot {sectionName}.
              </p>
              <p className="text-sm text-text-dim mb-8">
                Gratis account &middot; Geen betaling nodig &middot; Direct toegang
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/login"
                  className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors"
                >
                  Inloggen
                </Link>
                <Link
                  href="/register"
                  className="px-6 py-3 rounded-xl border border-border text-heading text-sm font-medium hover:bg-bg-hover transition-colors"
                >
                  Gratis registreren
                </Link>
              </div>

              {/* Feature hints */}
              <div className="mt-8 pt-6 border-t border-border">
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { icon: '📊', label: 'Premium Tools' },
                    { icon: '📚', label: 'Kennisbank' },
                    { icon: '📈', label: 'Artikelen' },
                  ].map((f) => (
                    <div key={f.label} className="text-xs text-text-dim">
                      <span className="text-lg block mb-1">{f.icon}</span>
                      {f.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
