import Link from 'next/link'

function SocialIcon({ type }: { type: 'instagram' | 'youtube' | 'tiktok' }) {
  const icons = {
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
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <h3 className="font-display text-lg text-heading mb-3">Sanders Capital</h3>
            <p className="text-sm text-text-muted leading-relaxed mb-4">
              Educatieve content over financiële markten. Geen financieel advies.
            </p>
            <div className="flex gap-3">
              {(['instagram', 'youtube', 'tiktok'] as const).map((social) => (
                <a
                  key={social}
                  href={`https://${social === 'instagram' ? 'instagram.com' : social === 'youtube' ? 'youtube.com/@' : 'tiktok.com/@'}sanderscapital`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-text-muted hover:text-heading hover:border-border-light transition-colors"
                >
                  <SocialIcon type={social} />
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
              <Link href="/disclaimer" className="text-sm text-text-muted hover:text-heading transition-colors">
                Privacy
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
