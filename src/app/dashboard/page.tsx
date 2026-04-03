'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import FadeIn from '@/components/FadeIn'

interface Profile {
  id: string
  email: string
  full_name: string
  role: string
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data)
        setEditName(data.full_name || '')
      }
      setLoading(false)
    }
    load()
  }, [router])

  const handleUpdateName = async () => {
    if (!profile) return
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({ full_name: editName })
      .eq('id', profile.id)
    setProfile({ ...profile, full_name: editName })
    setSaving(false)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <p className="text-text-muted">Laden...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-24">
      <FadeIn>
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-display font-semibold text-heading">
              Welkom{profile?.full_name ? `, ${profile.full_name}` : ''}
            </h1>
            <p className="text-text-muted mt-1">
              Account type:{' '}
              <span className="capitalize text-accent-light">{profile?.role || 'free'}</span>
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm px-4 py-2 rounded-lg border border-border text-text-muted hover:text-heading hover:border-border-light transition-colors"
          >
            Uitloggen
          </button>
        </div>
      </FadeIn>

      {/* Upgrade CTA for free users */}
      {profile?.role === 'free' && (
        <FadeIn delay={100}>
          <div className="p-6 rounded-xl bg-accent-glow border border-accent/20 mb-8">
            <h2 className="text-lg font-display font-semibold text-heading mb-2">
              Upgrade naar Premium
            </h2>
            <p className="text-sm text-text-muted mb-4">
              Krijg toegang tot alle premium artikelen, verdiepende kennisbank modules en exclusieve community features.
            </p>
            <Link
              href="/premium"
              className="inline-block px-5 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors"
            >
              Ontdek Premium
            </Link>
          </div>
        </FadeIn>
      )}

      {/* Quick links */}
      <FadeIn delay={150}>
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <Link
            href="/blog"
            className="p-5 rounded-xl bg-bg-card border border-border hover:border-border-light transition-colors"
          >
            <h3 className="font-display font-semibold text-heading mb-1">Blog</h3>
            <p className="text-sm text-text-muted">Bekijk alle beschikbare artikelen</p>
          </Link>
          <Link
            href="/kennisbank"
            className="p-5 rounded-xl bg-bg-card border border-border hover:border-border-light transition-colors"
          >
            <h3 className="font-display font-semibold text-heading mb-1">Kennisbank</h3>
            <p className="text-sm text-text-muted">Gestructureerde educatieve modules</p>
          </Link>
          <Link
            href="/contact"
            className="p-5 rounded-xl bg-bg-card border border-border hover:border-border-light transition-colors"
          >
            <h3 className="font-display font-semibold text-heading mb-1">Contact</h3>
            <p className="text-sm text-text-muted">Stel je vraag aan ons team</p>
          </Link>
        </div>
      </FadeIn>

      {/* Admin link */}
      {profile?.role === 'admin' && (
        <FadeIn delay={200}>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gold-dim border border-gold/20 text-gold text-sm font-medium hover:bg-gold/20 transition-colors mb-12"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Admin Panel
          </Link>
        </FadeIn>
      )}

      {/* Account settings */}
      <FadeIn delay={250}>
        <div className="p-6 rounded-xl bg-bg-card border border-border">
          <h2 className="text-lg font-display font-semibold text-heading mb-4">
            Account instellingen
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-muted mb-2">Email</label>
              <p className="text-sm text-text">{profile?.email}</p>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-2">Naam</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg bg-bg border border-border text-heading text-sm focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  onClick={handleUpdateName}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}
