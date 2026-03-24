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
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <FadeIn>
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-display font-semibold text-heading text-center mb-8">
            Registreren
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-text-muted mb-2">Naam</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent transition-colors"
                placeholder="Je volledige naam"
              />
            </div>
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
                placeholder="Minimaal 6 tekens"
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
              {loading ? 'Laden...' : 'Account aanmaken'}
            </button>
          </form>

          <p className="text-sm text-text-muted text-center mt-6">
            Al een account?{' '}
            <Link href="/login" className="text-accent-light hover:text-heading transition-colors">
              Inloggen
            </Link>
          </p>
        </div>
      </FadeIn>
    </div>
  )
}
