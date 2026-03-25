import FadeIn from '@/components/FadeIn'
import DisclaimerBadge from '@/components/DisclaimerBadge'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Neem contact op met Sanders Capital.',
}

const situations = [
  'Je weet niet waar je moet beginnen',
  'Je zoekt een sparringspartner of accountability buddy',
  'Je loopt vast in je strategie of proces',
  'Je hebt een vraag over de content',
  'Je wilt samenwerken of feedback geven',
]

const contactLinks = [
  {
    label: 'Email',
    value: 'sanderscapital@hotmail.com',
    href: 'mailto:sanderscapital@hotmail.com',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
  },
  {
    label: 'Discord Community',
    value: 'Sanders Capital Community',
    href: 'https://discord.gg/g8m3rryCRv',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
      </svg>
    ),
  },
  {
    label: 'Instagram',
    value: '@sanderscapital',
    href: 'https://instagram.com/sanderscapital',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    value: '@sanderscapital',
    href: 'https://youtube.com/@sanderscapital',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
      </svg>
    ),
  },
  {
    label: 'TikTok',
    value: '@sanderscapital',
    href: 'https://tiktok.com/@sanderscapital',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.69a8.18 8.18 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.12z"/>
      </svg>
    ),
  },
]

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      {/* Header */}
      <FadeIn>
        <h1 className="text-4xl md:text-5xl font-display font-semibold text-heading mb-6">
          Contact
        </h1>
      </FadeIn>

      {/* Situaties */}
      <FadeIn delay={100}>
        <div className="mb-12">
          <p className="text-text leading-relaxed mb-6">
            Herken je een van deze situaties?
          </p>
          <div className="space-y-3 mb-8">
            {situations.map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                <span className="text-text-muted text-sm">{s}</span>
              </div>
            ))}
          </div>
          <p className="text-text leading-relaxed">
            Neem contact op via onderstaande kanalen, of{' '}
            <a
              href="https://discord.gg/g8m3rryCRv"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-light hover:text-heading transition-colors underline underline-offset-2"
            >
              join de Discord community
            </a>{' '}
            om direct in contact te komen met andere leden.
          </p>
        </div>
      </FadeIn>

      {/* Contact opties */}
      <FadeIn delay={200}>
        <h2 className="text-xl font-display font-semibold text-heading mb-6">
          Manieren om contact op te nemen
        </h2>
        <div className="space-y-3">
          {contactLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith('mailto') ? undefined : '_blank'}
              rel={link.href.startsWith('mailto') ? undefined : 'noopener noreferrer'}
              className="flex items-center gap-4 p-4 rounded-xl bg-bg-card border border-border hover:border-border-light transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-bg-hover flex items-center justify-center text-accent-light group-hover:text-heading transition-colors shrink-0">
                {link.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-heading">{link.label}</p>
                <p className="text-xs text-text-muted truncate">{link.value}</p>
              </div>
              <svg className="w-4 h-4 text-text-dim ml-auto shrink-0 group-hover:text-text-muted transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={300}>
        <DisclaimerBadge className="mt-12" />
      </FadeIn>
    </div>
  )
}
