'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import FadeIn from '@/components/FadeIn'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail) return
    setResetLoading(true)
    setError('')
    setSuccess('')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/dashboard`,
    })

    if (error) {
      setError(error.message)
    } else {
      setSuccess('Reset-link verstuurd! Check je inbox (en spam/ongewenste mail). De e-mail komt van noreply@mail.app.supabase.io.')
      setShowReset(false)
    }
    setResetLoading(false)
  }

  return (
    <div className="min-h-[calc(100vh-72px)] grid place-items-center px-4 sm:px-6 py-14 sm:py-20">
      <FadeIn>
        <div className="w-full max-w-[430px]">
          {/* Auth header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-display font-semibold text-heading tracking-tight">
              {showReset ? 'Wachtwoord vergeten' : 'Welkom terug'}
            </h1>
            <p className="mt-3 text-sm text-text-muted">
              {showReset
                ? 'Vul je e-mailadres in en we sturen een link om je wachtwoord te resetten.'
                : 'Log in om bij je premium tools en journal te komen.'}
            </p>
          </div>

          {/* Form card */}
          <div className="glass-elevated rounded-2xl p-7 sm:p-9 shadow-xl">
            {/* Password reset form */}
            {showReset ? (
              <div className="space-y-5">
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-text-dim mb-2">E-mail</label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-bg-card border border-border text-heading text-sm placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
                      placeholder="jij@voorbeeld.nl"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full px-6 py-3 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-accent/30"
                  >
                    {resetLoading ? 'Versturen...' : 'Verstuur reset-link'}
                  </button>
                </form>

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-600 leading-relaxed">
                    De e-mail wordt verstuurd vanuit <strong>noreply@mail.app.supabase.io</strong>. Check je spam/ongewenste mail als je niets ontvangt.
                  </p>
                </div>

                <button
                  onClick={() => { setShowReset(false); setError('') }}
                  className="w-full text-sm text-text-muted hover:text-heading transition-colors text-center"
                >
                  ← Terug naar inloggen
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-wider text-text-dim mb-2">E-mail</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-bg-card border border-border text-heading text-sm placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
                      placeholder="jij@voorbeeld.nl"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-medium uppercase tracking-wider text-text-dim">Wachtwoord</label>
                      <button
                        type="button"
                        onClick={() => { setShowReset(true); setError(''); setSuccess('') }}
                        className="text-xs font-semibold text-accent hover:text-accent-light transition-colors normal-case tracking-normal"
                      >
                        Wachtwoord vergeten?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-bg-card border border-border text-heading text-sm placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
                      placeholder="••••••••"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>
                  )}

                  {success && (
                    <p className="text-sm text-green-600 bg-green-500/10 px-4 py-2 rounded-lg">{success}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-6 py-3 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-accent/30"
                  >
                    {loading ? 'Laden...' : 'Inloggen'}
                  </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3.5 my-6 text-[11px] uppercase tracking-[0.1em] text-text-dim">
                  <span className="flex-1 h-px bg-border" />
                  of
                  <span className="flex-1 h-px bg-border" />
                </div>

                <a
                  href="https://discord.gg/g8m3rryCRv"
                  target="_blank"
                  rel="noopener"
                  className="w-full flex items-center justify-center gap-2.5 px-6 py-3 rounded-lg border border-border text-heading text-sm font-semibold hover:border-accent hover:text-accent transition-colors"
                >
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
                    <path d="M20 5.3A18 18 0 0 0 15.5 4l-.3.5a14 14 0 0 1 3.9 1.9c-3.8-1.8-8.2-1.8-12 0A14 14 0 0 1 11 4.5L10.6 4A18 18 0 0 0 6 5.3C3.2 9.5 2.5 13.6 2.8 17.6A18 18 0 0 0 8.3 20l.6-1c-1-.4-1.8-.9-1.8-.9l.4-.3c3.4 1.6 7.2 1.6 10.6 0l.4.3s-.8.5-1.8.9l.6 1a18 18 0 0 0 5.5-2.4c.4-4.7-.6-8.8-2.8-12.3z" />
                  </svg>
                  Doorgaan met Discord
                </a>
              </>
            )}
          </div>

          {!showReset && (
            <p className="text-center mt-6 text-sm text-text-muted">
              Nog geen account?{' '}
              <Link href="/register" className="text-accent font-semibold hover:text-accent-light transition-colors">
                Registreren
              </Link>
            </p>
          )}
        </div>
      </FadeIn>
    </div>
  )
}
