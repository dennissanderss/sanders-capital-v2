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

  // Fetch real counts for stats
  const { count: articleCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('published', true)
  const { count: categoryCount } = await supabase
    .from('kennisbank_categories')
    .select('*', { count: 'exact', head: true })

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

        <div className="relative z-10 text-center max-w-3xl mx-auto px-4 sm:px-6">
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 text-center">
          {[
            { end: articleCount || 0, suffix: '+', label: 'Artikelen' },
            { end: categoryCount || 0, suffix: '+', label: 'Onderwerpen' },
            { end: 4, suffix: '+', label: 'Jaren ervaring' },
            { end: 100, suffix: '%', label: 'Data-gedreven' },
          ].map((stat, i) => (
            <FadeIn key={i} delay={i * 100}>
              <div>
                <p className="text-xl sm:text-2xl md:text-3xl font-display font-semibold text-heading">
                  <CounterAnimation end={stat.end} suffix={stat.suffix} />
                </p>
                <p className="text-sm text-text-muted mt-1">{stat.label}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Three Pillars */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
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
              <FadeIn key={i} delay={i * 150} className="h-full">
                <div className="h-full p-8 rounded-xl bg-bg-card border border-border hover:border-border-light transition-colors group">
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
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
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
                <FadeIn key={article.id} delay={i * 100} className="h-full">
                  <Link
                    href={`/blog/${article.slug}`}
                    className="block h-full p-6 rounded-xl bg-bg-card border border-border hover:border-border-light transition-all group"
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

      {/* FX Outlook */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <FadeIn>
            <div className="relative overflow-hidden rounded-2xl border border-accent-dim/30 bg-gradient-to-br from-accent-glow/30 via-bg-card to-bg-card">
              <div className="absolute top-0 right-0 w-1/2 h-full opacity-[0.04]" style={{
                backgroundImage: 'radial-gradient(circle at 70% 30%, rgba(61,110,165,0.8) 0%, transparent 60%)',
              }} />
              <div className="relative grid md:grid-cols-2 gap-8 p-8 md:p-12">
                <div className="flex flex-col justify-center">
                  <span className="text-xs tracking-[0.2em] uppercase text-accent-light mb-3 font-body">
                    Marktanalyse
                  </span>
                  <h2 className="text-2xl md:text-3xl font-display font-semibold text-heading mb-4">
                    FX Outlook
                  </h2>
                  <p className="text-text-muted leading-relaxed mb-6">
                    Wekelijkse en maandelijkse macro-analyses van de valutamarkt. Van centrale bank beleid
                    tot geopolitieke verschuivingen. Begrijp de krachten die valutaparen bewegen en
                    vertaal data naar een onderbouwde visie.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {['Marktanalyse', 'Data', 'Strategie'].map(tag => (
                      <span key={tag} className="text-xs px-2.5 py-1 rounded-md bg-accent/10 text-accent-light border border-accent/20">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Link
                    href="/blog/fx-outlook"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors self-start group"
                  >
                    Bekijk FX Outlook
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 transition-transform">
                      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                    </svg>
                  </Link>
                </div>
                <div className="flex items-center justify-center">
                  <div className="w-full max-w-xs space-y-3">
                    {[
                      { pair: 'EUR/USD', dir: 'Bearish', color: 'text-red-400', badge: 'bg-red-500/10 border-red-500/20' },
                      { pair: 'GBP/JPY', dir: 'Bullish', color: 'text-green-400', badge: 'bg-green-500/10 border-green-500/20' },
                      { pair: 'AUD/USD', dir: 'Neutraal', color: 'text-amber-400', badge: 'bg-amber-500/10 border-amber-500/20' },
                    ].map(item => (
                      <div key={item.pair} className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                        <span className="text-sm font-mono font-bold text-heading">{item.pair}</span>
                        <span className={`text-xs px-2 py-0.5 rounded border ${item.badge} ${item.color}`}>
                          {item.dir}
                        </span>
                      </div>
                    ))}
                    <p className="text-[10px] text-text-dim text-center pt-1">Voorbeeld, geen actueel advies</p>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Premium Tools */}
      <section className="py-24 bg-bg-elevated/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <FadeIn>
            <div className="text-center mb-4">
              <span className="text-xs tracking-[0.2em] uppercase text-accent-light mb-3 block font-body">
                Premium Tools
              </span>
              <h2 className="text-3xl md:text-4xl font-display font-semibold text-heading mb-4">
                Ontdek de tools
              </h2>
              <p className="text-text-muted max-w-2xl mx-auto mb-12">
                De meeste traders missen geen strategie, ze missen structuur. Geen overzicht van macro data,
                geen objectieve currency bias, geen inzicht in hun eigen performance. Deze tools lossen dat op.
              </p>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-4 max-w-5xl mx-auto mb-10">
            {[
              {
                name: 'Daily Macro Briefing',
                problem: 'Elke dag macro data verzamelen kost uren en je mist altijd iets.',
                solution: 'Automatische fundamentele analyse in 5 stappen: marktregime, nieuws sentiment, intermarket signalen, trade focus filter en concrete trades. Dagelijks vernieuwd.',
                href: '/tools/fx-selector',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                ),
              },
              {
                name: 'Macro Fundamentals',
                problem: 'Rentetarieven en CB beleid zijn verspreid over tientallen bronnen.',
                solution: 'Alle rentedata, inflatiecijfers en centrale bank bias per valuta op één plek.',
                href: '/tools/fx-analyse',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                ),
              },
              {
                name: 'TradeMind',
                problem: 'Je hebt backtest data maar geen manier om patronen te zien.',
                solution: 'Upload je CSV en krijg direct winrate, drawdown, sessie- en dag-analyse.',
                href: '/tools/tradescope',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                ),
              },
              {
                name: 'TradeMind Journal',
                problem: 'Je weet niet waarom je verliest omdat je trades niet structureel logt.',
                solution: 'Persoonlijk trading journal. Log trades, herken patronen en verbeter je edge.',
                href: '/tools',
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                ),
              },
            ].map((tool, i) => (
              <FadeIn key={tool.name} delay={i * 100} className="h-full">
                <Link
                  href={tool.href}
                  className="block h-full p-6 rounded-xl bg-bg-card border border-border hover:border-accent-dim/40 transition-all group relative overflow-hidden"
                >
                  {'comingSoon' in tool && tool.comingSoon && (
                    <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded bg-accent/15 text-accent-light border border-accent/20">
                      Binnenkort
                    </span>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-accent-glow flex items-center justify-center text-accent-light shrink-0 group-hover:bg-accent-dim/20 transition-colors">
                      {tool.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold text-heading mb-2 group-hover:text-accent-light transition-colors">
                        {tool.name}
                      </h3>
                      <p className="text-xs text-text-dim mb-1">
                        <span className="text-red-400/70">Probleem:</span> {tool.problem}
                      </p>
                      <p className="text-sm text-text-muted">
                        <span className="text-accent-light/70">Oplossing:</span> {tool.solution}
                      </p>
                    </div>
                  </div>
                </Link>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={400}>
            <div className="text-center">
              <Link
                href="/premium"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors group"
              >
                Bekijk alle premium features
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 transition-transform">
                  <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

    </>
  )
}
