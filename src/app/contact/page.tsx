'use client'

import { useState } from 'react'
import FadeIn from '@/components/FadeIn'
import DisclaimerBadge from '@/components/DisclaimerBadge'

export default function ContactPage() {
  const [form, setForm] = useState({ naam: '', email: '', onderwerp: '', bericht: '' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const subject = encodeURIComponent(form.onderwerp)
    const body = encodeURIComponent(`Naam: ${form.naam}\nEmail: ${form.email}\n\n${form.bericht}`)
    window.location.href = `mailto:sanderscapital@hotmail.com?subject=${subject}&body=${body}`
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <FadeIn>
        <h1 className="text-4xl md:text-5xl font-display font-semibold text-heading mb-4">
          Contact
        </h1>
        <p className="text-text-muted mb-12">
          Heb je een vraag of opmerking? Neem gerust contact met ons op.
        </p>
      </FadeIn>

      <FadeIn delay={100}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-text-muted mb-2">Naam</label>
              <input
                type="text"
                required
                value={form.naam}
                onChange={(e) => setForm({ ...form, naam: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent transition-colors"
                placeholder="Je naam"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-2">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent transition-colors"
                placeholder="je@email.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-2">Onderwerp</label>
            <input
              type="text"
              required
              value={form.onderwerp}
              onChange={(e) => setForm({ ...form, onderwerp: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent transition-colors"
              placeholder="Waar gaat het over?"
            />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-2">Bericht</label>
            <textarea
              required
              rows={6}
              value={form.bericht}
              onChange={(e) => setForm({ ...form, bericht: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-bg-card border border-border text-heading text-sm focus:outline-none focus:border-accent transition-colors resize-none"
              placeholder="Je bericht..."
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors"
          >
            Verstuur bericht
          </button>
        </form>
      </FadeIn>

      <FadeIn delay={200}>
        <div className="mt-16 pt-8 border-t border-border">
          <h2 className="text-xl font-display font-semibold text-heading mb-4">
            Andere manieren om contact op te nemen
          </h2>
          <div className="space-y-3 text-sm text-text-muted">
            <p>
              Email:{' '}
              <a href="mailto:sanderscapital@hotmail.com" className="text-accent-light hover:text-heading transition-colors">
                sanderscapital@hotmail.com
              </a>
            </p>
            <p>
              Instagram:{' '}
              <a href="https://instagram.com/sanderscapital" target="_blank" rel="noopener noreferrer" className="text-accent-light hover:text-heading transition-colors">
                @sanderscapital
              </a>
            </p>
            <p>
              YouTube:{' '}
              <a href="https://youtube.com/@sanderscapital" target="_blank" rel="noopener noreferrer" className="text-accent-light hover:text-heading transition-colors">
                @sanderscapital
              </a>
            </p>
            <p>
              TikTok:{' '}
              <a href="https://tiktok.com/@sanderscapital" target="_blank" rel="noopener noreferrer" className="text-accent-light hover:text-heading transition-colors">
                @sanderscapital
              </a>
            </p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={300}>
        <DisclaimerBadge className="mt-8" />
      </FadeIn>
    </div>
  )
}
