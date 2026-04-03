import Link from 'next/link'

function SocialIcon({ type }: { type: 'instagram' | 'youtube' | 'tiktok' | 'discord' }) {
  const icons = {
    discord: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
      </svg>
    ),
    instagram: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
    youtube: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.13C5.12 19.56 12 19.56 12 19.56s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43z" />
        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
      </svg>
    ),
    tiktok: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
      </svg>
    ),
  }
  return icons[type]
}

export default function Footer() {
  return (
    <footer className="border-t border-border bg-bg-elevated/50 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 sm:gap-8 md:gap-10">
          {/* Brand */}
          <div>
            <h3 className="font-display text-lg text-heading mb-3">Sanders Capital</h3>
            <p className="text-sm text-text-muted leading-relaxed mb-4">
              Educatieve content over financiële markten. Geen financieel advies.
            </p>
            <div className="flex gap-3">
              {([
                { type: 'discord' as const, href: 'https://discord.gg/g8m3rryCRv' },
                { type: 'instagram' as const, href: 'https://instagram.com/sanderscapital' },
                { type: 'youtube' as const, href: 'https://youtube.com/@sanderscapital' },
                { type: 'tiktok' as const, href: 'https://tiktok.com/@sanderscapital' },
              ]).map((social) => (
                <a
                  key={social.type}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-text-muted hover:text-heading hover:border-border-light transition-colors"
                >
                  <SocialIcon type={social.type} />
                </a>
              ))}
            </div>
          </div>

          {/* Navigatie */}
          <div>
            <h4 className="text-sm font-semibold text-heading mb-4 tracking-wide">Navigatie</h4>
            <div className="flex flex-col gap-2.5">
              {[
                { href: '/', label: 'Home' },
                { href: '/blog', label: 'Blog' },
                { href: '/premium', label: 'Premium' },
                { href: '/over', label: 'Over ons' },
                { href: '/contact', label: 'Contact' },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="text-sm text-text-muted hover:text-heading transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Kennisbank */}
          <div>
            <h4 className="text-sm font-semibold text-heading mb-4 tracking-wide">Kennisbank</h4>
            <div className="flex flex-col gap-2.5">
              {['Risicomanagement', 'Psychologie', 'Marktstructuur', 'Fundamentals', 'Data-analyse'].map((item) => (
                <Link key={item} href="/kennisbank" className="text-sm text-text-muted hover:text-heading transition-colors">
                  {item}
                </Link>
              ))}
            </div>
          </div>

          {/* Juridisch */}
          <div>
            <h4 className="text-sm font-semibold text-heading mb-4 tracking-wide">Juridisch</h4>
            <div className="flex flex-col gap-2.5">
              <Link href="/disclaimer" className="text-sm text-text-muted hover:text-heading transition-colors">
                Disclaimer
              </Link>
              <Link href="/disclaimer#privacy" className="text-sm text-text-muted hover:text-heading transition-colors">
                Privacy
              </Link>
              <Link href="/voorwaarden" className="text-sm text-text-muted hover:text-heading transition-colors">
                Algemene Voorwaarden
              </Link>
              <Link href="/voorwaarden-discord" className="text-sm text-text-muted hover:text-heading transition-colors">
                Voorwaarden Discord
              </Link>
              <a href="mailto:sanderscapital@hotmail.com" className="text-sm text-text-muted hover:text-heading transition-colors">
                sanderscapital@hotmail.com
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-dim">
            &copy; {new Date().getFullYear()} Sanders Capital. Alle rechten voorbehouden.
          </p>
          <Link href="/disclaimer" className="text-xs text-text-dim hover:text-text-muted transition-colors">
            Disclaimer &amp; Privacy
          </Link>
        </div>
      </div>
    </footer>
  )
}
