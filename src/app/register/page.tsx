'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import FadeIn from '@/components/FadeIn'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (password.length < 6) {
      setError('Wachtwoord moet minimaal 6 tekens bevatten.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Update profile with name
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id)
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-[calc(100vh-72px)] grid place-items-center px-4 sm:px-6 py-14 sm:py-20">
      <FadeIn>
        <div className="w-full max-w-[430px]">
          {/* Page head */}
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-[40px] font-display font-bold text-heading leading-[1.02] tracking-tight">
              Maak je account
            </h1>
            <p className="mt-3 text-text-muted text-sm sm:text-[14.5px] leading-relaxed">
              Registreer je en krijg toegang tot je premium tools en journal.
            </p>
          </div>

          {/* Form card */}
          <div className="glass-elevated rounded-xl border border-border-light shadow-xl p-7 sm:p-9">
            <form onSubmit={handleSubmit} className="space-y-[18px]">
              <div>
                <label className="block font-mono text-[11.5px] uppercase tracking-[0.06em] font-medium text-text-dim mb-2">
                  Naam
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-lg bg-surface border border-border text-heading text-[15px] placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
                  placeholder="Je volledige naam"
                />
              </div>
              <div>
                <label className="block font-mono text-[11.5px] uppercase tracking-[0.06em] font-medium text-text-dim mb-2">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-lg bg-surface border border-border text-heading text-[15px] placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
                  placeholder="jij@voorbeeld.nl"
                />
              </div>
              <div>
                <label className="block font-mono text-[11.5px] uppercase tracking-[0.06em] font-medium text-text-dim mb-2">
                  Wachtwoord
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-lg bg-surface border border-border text-heading text-[15px] placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
                  placeholder="Minimaal 6 tekens"
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3.5 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? 'Laden...' : 'Account aanmaken'}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3.5 my-[22px] font-mono text-[11px] uppercase tracking-[0.1em] text-text-dim">
              <span className="flex-1 h-px bg-border-light" />
              of
              <span className="flex-1 h-px bg-border-light" />
            </div>

            <a
              href="https://discord.gg/g8m3rryCRv"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg border border-border text-text text-sm font-medium hover:border-accent hover:text-accent transition-colors"
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
                <path d="M20 5.3A18 18 0 0 0 15.5 4l-.3.5a14 14 0 0 1 3.9 1.9c-3.8-1.8-8.2-1.8-12 0A14 14 0 0 1 11 4.5L10.6 4A18 18 0 0 0 6 5.3C3.2 9.5 2.5 13.6 2.8 17.6A18 18 0 0 0 8.3 20l.6-1c-1-.4-1.8-.9-1.8-.9l.4-.3c3.4 1.6 7.2 1.6 10.6 0l.4.3s-.8.5-1.8.9l.6 1a18 18 0 0 0 5.5-2.4c.4-4.7-.6-8.8-2.8-12.3z" />
              </svg>
              Doorgaan met Discord
            </a>
          </div>

          <p className="text-center mt-6 text-sm text-text-muted">
            Al een account?{' '}
            <Link href="/login" className="text-accent font-semibold hover:text-accent-light transition-colors">
              Inloggen
            </Link>
          </p>

          <div className="mt-5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-600/90 leading-relaxed text-center">
              <strong>Let op:</strong> Na registratie ontvang je een bevestigingsmail van <strong>noreply@mail.app.supabase.io</strong>.
              Check je <strong>spam/ongewenste mail</strong> als je niets ontvangt. De mail komt niet van Sanders Capital maar van onze authenticatie-provider.
            </p>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}
