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
  const [loading, setLoading] = useState(false)
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

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <FadeIn>
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-display font-semibold text-heading text-center mb-8">
            Inloggen
          </h1>

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
              <label className="block text-sm text-text-muted mb-2">Wachtwoord</label>
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
        </div>
      </FadeIn>
    </div>
  )
}
