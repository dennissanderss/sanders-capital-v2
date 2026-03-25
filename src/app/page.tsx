import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import FadeIn from '@/components/FadeIn'
import CounterAnimation from '@/components/CounterAnimation'
import DisclaimerBadge from '@/components/DisclaimerBadge'
import TickerTape from '@/components/TickerTape'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: articles } = await supabase
    .from('articles')
    .select('*')
    .eq('published', true)
    .eq('is_premium', false)
    .order('created_at', { ascending: false })
    .limit(3)

  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(61,110,165,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(61,110,165,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-accent-glow via-transparent to-transparent" />

        <div className="relative z-10 text-center max-w-3xl mx-auto px-6">
          <FadeIn>
            <DisclaimerBadge className="mb-6" />
          </FadeIn>
          <FadeIn delay={100}>
            <p className="text-sm tracking-[0.2em] uppercase text-accent-light mb-4 font-body">
              Community &amp; Educatie
            </p>
          </FadeIn>
          <FadeIn delay={200}>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-display font-semibold text-heading leading-tight mb-6">
              Kennis. Discipline.{' '}
              <em className="text-accent-light">Groei.</em>
            </h1>
          </FadeIn>
          <FadeIn delay={300}>
            <p className="text-lg text-text-muted max-w-xl mx-auto mb-8">
              Educatieve content over financiële markten. Bouw een solide fundament met
              gestructureerde kennis, discipline en data-gedreven inzichten.
            </p>
          </FadeIn>
          <FadeIn delay={400}>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                href="/blog"
                className="px-6 py-3 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors"
              >
                Bekijk artikelen
              </Link>
              <Link
                href="/premium"
                className="px-6 py-3 rounded-lg border border-border text-heading text-sm font-medium hover:bg-bg-hover transition-colors"
              >
                Premium ontdekken
              </Link>
              <a
                href="https://discord.gg/g8m3rryCRv"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-lg border border-accent-dim text-accent-light text-sm font-medium hover:bg-accent-glow transition-colors flex items-center gap-2 justify-center"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
                Join de community
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Ticker Tape */}
      <div className="border-y border-border bg-bg-elevated/50">
        <div className="max-w-6xl mx-auto">
          <TickerTape />
        </div>
      </div>

      {/* Stats */}
      <section className="border-y border-border bg-bg-elevated/50">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 text-center">
          {[
            { end: 50, suffix: '+', label: 'Artikelen' },
            { end: 12, suffix: '+', label: 'Onderwerpen' },
            { end: 0, label: '', text: 'Gratis community' },
            { end: 0, label: '', text: '100% data-gedreven' },
          ].map((stat, i) => (
            <FadeIn key={i} delay={i * 100}>
              <div>
                <p className="text-xl sm:text-2xl md:text-3xl font-display font-semibold text-heading">
                  {stat.text ? (
                    stat.text
                  ) : (
                    <CounterAnimation end={stat.end} suffix={stat.suffix} />
                  )}
                </p>
                {stat.label && (
                  <p className="text-sm text-text-muted mt-1">{stat.label}</p>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Three Pillars */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-display font-semibold text-heading text-center mb-4">
              Drie pijlers
            </h2>
            <p className="text-text-muted text-center max-w-2xl mx-auto mb-16">
              Een gestructureerde aanpak gebouwd op kennis, discipline en data.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
            {[
              {
                icon: (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                ),
                title: 'Kennis',
                description:
                  'Diepgaande educatieve content over marktstructuur, technische analyse en fundamentals.',
              },
              {
                icon: (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                ),
                title: 'Discipline',
                description:
                  'Gestructureerde processen en psychologische frameworks voor consistente besluitvorming.',
              },
              {
                icon: (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                ),
                title: 'Groei',
                description:
                  'Data-gedreven evaluatie en continue verbetering van je analytisch vermogen.',
              },
            ].map((pillar, i) => (
              <FadeIn key={i} delay={i * 150}>
                <div className="p-8 rounded-xl bg-bg-card border border-border hover:border-border-light transition-colors group">
                  <div className="w-12 h-12 rounded-lg bg-accent-glow flex items-center justify-center text-accent-light mb-5 group-hover:bg-accent-dim/20 transition-colors">
                    {pillar.icon}
                  </div>
                  <h3 className="text-xl font-display font-semibold text-heading mb-3">
                    {pillar.title}
                  </h3>
                  <p className="text-sm text-text-muted leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Articles */}
      {articles && articles.length > 0 && (
        <section className="py-24 bg-bg-elevated/30">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="flex items-center justify-between mb-12">
                <h2 className="text-3xl font-display font-semibold text-heading">
                  Laatste artikelen
                </h2>
                <Link
                  href="/blog"
                  className="text-sm text-accent-light hover:text-accent transition-colors"
                >
                  Alle artikelen →
                </Link>
              </div>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-6">
              {articles.map((article, i) => (
                <FadeIn key={article.id} delay={i * 100}>
                  <Link
                    href={`/blog/${article.slug}`}
                    className="block p-6 rounded-xl bg-bg-card border border-border hover:border-border-light transition-all group"
                  >
                    {article.tag && (
                      <span className="inline-block text-xs px-2.5 py-1 rounded-md bg-accent-glow text-accent-light mb-3">
                        {article.tag}
                      </span>
                    )}
                    <h3 className="text-lg font-display font-semibold text-heading mb-2 group-hover:text-accent-light transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-sm text-text-muted line-clamp-2 mb-4">
                      {article.excerpt}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-text-dim">
                      <span>{new Date(article.created_at).toLocaleDateString('nl-NL')}</span>
                      <span>·</span>
                      <span>{article.reading_time} min</span>
                    </div>
                  </Link>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-display font-semibold text-heading mb-4">
              Klaar om te beginnen?
            </h2>
            <p className="text-text-muted mb-8 max-w-lg mx-auto">
              Krijg toegang tot premium educatieve content, verdiepende analyses en exclusieve community features.
            </p>
            <Link
              href="/premium"
              className="inline-block px-8 py-3.5 rounded-lg bg-accent hover:bg-accent-light text-white font-medium transition-colors"
            >
              Ontdek Premium
            </Link>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
