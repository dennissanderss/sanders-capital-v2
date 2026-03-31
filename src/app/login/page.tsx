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
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <FadeIn>
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-display font-semibold text-heading text-center mb-8">
            Inloggen
          </h1>

          {/* Password reset form */}
          {showReset ? (
            <div className="space-y-4">
              <p className="text-sm text-text-muted text-center mb-2">
                Vul je e-mailadres in en we sturen een link om je wachtwoord te resetten.
              </p>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm text-text-muted mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent transition-colors"
                    placeholder="je@email.com"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-400/10 px-4 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full px-6 py-3 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {resetLoading ? 'Versturen...' : 'Verstuur reset-link'}
                </button>
              </form>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-400/90 leading-relaxed">
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
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-text-muted mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent transition-colors"
                    placeholder="je@email.com"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-text-muted">Wachtwoord</label>
                    <button
                      type="button"
                      onClick={() => { setShowReset(true); setError(''); setSuccess('') }}
                      className="text-xs text-accent-light/70 hover:text-accent-light transition-colors"
                    >
                      Wachtwoord vergeten?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent transition-colors"
                    placeholder="Je wachtwoord"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-400/10 px-4 py-2 rounded-lg">{error}</p>
                )}

                {success && (
                  <p className="text-sm text-green-400 bg-green-400/10 px-4 py-2 rounded-lg">{success}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Laden...' : 'Inloggen'}
                </button>
              </form>

              <p className="text-sm text-text-muted text-center mt-6">
                Nog geen account?{' '}
                <Link href="/register" className="text-accent-light hover:text-heading transition-colors">
                  Registreren
                </Link>
              </p>
            </>
          )}
        </div>
      </FadeIn>
    </div>
  )
}
