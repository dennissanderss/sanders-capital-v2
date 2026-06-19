import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import FadeIn from '@/components/FadeIn'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Educatieve artikelen over trading, marktstructuur, psychologie en risicomanagement.',
}

export const revalidate = 60

export default async function BlogPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: articles } = await supabase
    .from('articles')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })

  return (
    <div>
      {/* Page head */}
      <div className="relative overflow-hidden border-b border-border bg-bg-elevated">
        <div
          className="pointer-events-none absolute -right-32 -top-40 h-[420px] w-[420px] rounded-full blur-2xl"
          style={{
            background:
              'radial-gradient(closest-side, rgba(59,130,246,0.16), transparent 70%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-14">
          <FadeIn>
            <nav className="flex items-center gap-2.5 text-[11.5px] font-mono tracking-wide text-text-dim">
              <Link href="/" className="hover:text-accent-light transition-colors">
                Home
              </Link>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
              <span>Blog</span>
            </nav>

            <span className="mt-5 inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent before:h-px before:w-6 before:bg-accent before:opacity-70 before:content-['']">
              Educatie
            </span>

            <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight text-heading">
              Artikelen &amp; modules
            </h1>
            <p className="mt-5 max-w-[60ch] text-base sm:text-lg text-text-muted leading-relaxed">
              Gestructureerde educatieve content over marktstructuur, fundamentals,
              risicomanagement en psychologie. Begin bij de basis of verdiep je in een
              specifiek onderwerp.
            </p>
          </FadeIn>
        </div>
      </div>

      {/* Articles */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <FadeIn>
          <div className="mb-9 flex flex-wrap gap-2">
            <span className="rounded-md bg-accent px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-white">
              Alle
            </span>
            <span className="rounded-md border border-border-light bg-surface px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-text-muted">
              Basis
            </span>
            <span className="rounded-md border border-border-light bg-surface px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-text-muted">
              Risicomanagement
            </span>
            <span className="rounded-md border border-border-light bg-surface px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-text-muted">
              Psychologie
            </span>
            <span className="rounded-md border border-border-light bg-surface px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-text-muted">
              Marktstructuur
            </span>
            <span className="rounded-md border border-border-light bg-surface px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-text-muted">
              FX Outlook
            </span>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {articles?.map((article, i) => (
            <FadeIn key={article.id} delay={i * 80}>
              <Link
                href={`/blog/${article.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl glass glass-hover transition-all hover:-translate-y-0.5"
              >
                {/* Thumb */}
                <div className="relative aspect-[16/8] overflow-hidden border-b border-border bg-surface">
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(420px 200px at 80% 0%, rgba(59,130,246,0.10), transparent 62%)',
                    }}
                  />
                  <div className="absolute left-4 top-4 z-[2] flex items-center gap-2">
                    {article.tag && (
                      <span className="rounded-md border border-accent-dim bg-accent-glow px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-accent">
                        {article.tag}
                      </span>
                    )}
                    {article.is_premium && (
                      <span className="flex items-center gap-1 rounded-md bg-gold-dim px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-gold">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Premium
                      </span>
                    )}
                  </div>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -bottom-7 -right-1.5 font-display text-[160px] font-bold leading-none text-accent/[0.06]"
                  >
                    {(article.tag || article.title || '·').charAt(0)}
                  </span>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col px-6 pb-6 pt-6">
                  <h2 className="text-xl font-display font-semibold leading-tight text-heading transition-colors group-hover:text-accent-light">
                    {article.title}
                  </h2>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-text-muted line-clamp-3">
                    {article.excerpt}
                  </p>
                  <div className="mt-5 flex items-center gap-3 font-mono text-[11px] tracking-wide text-text-dim">
                    <span>{new Date(article.created_at).toLocaleDateString('nl-NL')}</span>
                    <span className="h-[3px] w-[3px] rounded-full bg-text-dim" />
                    <span>{article.reading_time} min leestijd</span>
                  </div>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>

        {(!articles || articles.length === 0) && (
          <FadeIn>
            <div className="text-center py-16">
              <p className="text-text-muted">Nog geen artikelen gepubliceerd.</p>
            </div>
          </FadeIn>
        )}
      </section>
    </div>
  )
}
