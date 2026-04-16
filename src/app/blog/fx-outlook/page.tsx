import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import FadeIn from '@/components/FadeIn'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FX Outlook | Sanders Capital',
  description: 'Wekelijkse marktanalyses, macro outlook en FX verwachtingen.',
}

export const revalidate = 60

const OUTLOOK_TAGS = ['FX Outlook', 'Marktanalyse', 'Data', 'Strategie']

export default async function FxOutlookPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: articles } = await supabase
    .from('articles')
    .select('*')
    .eq('published', true)
    .in('tag', OUTLOOK_TAGS)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
      <FadeIn>
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-accent-glow flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold text-heading">
                FX Outlook
              </h1>
              <p className="text-sm text-text-muted">
                Marktanalyses, macro verwachtingen &amp; strategische inzichten
              </p>
            </div>
          </div>
          <p className="text-text-muted max-w-2xl mt-4">
            Periodieke analyses van de FX markt. Wat zijn de verwachtingen voor de komende weken?
            Welke macro-thema&apos;s spelen er? En hoe vertaal je dat naar je trading?
          </p>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
        {articles?.map((article, i) => (
          <FadeIn key={article.id} delay={i * 80}>
            <Link
              href={`/blog/${article.slug}`}
              className="block p-6 rounded-xl glass glass-hover transition-all group h-full"
            >
              <div className="flex items-center gap-2 mb-3">
                {article.tag && (
                  <span className="text-xs px-2.5 py-1 rounded-md bg-accent-glow text-accent-light">
                    {article.tag}
                  </span>
                )}
                {article.is_premium && (
                  <span className="text-xs px-2 py-1 rounded-md bg-gold-dim text-gold flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Premium
                  </span>
                )}
              </div>
              <h2 className="text-lg font-display font-semibold text-heading mb-2 group-hover:text-accent-light transition-colors">
                {article.title}
              </h2>
              <p className="text-sm text-text-muted line-clamp-3 mb-4">
                {article.excerpt}
              </p>
              <div className="flex items-center gap-3 text-xs text-text-dim mt-auto">
                <span>{new Date(article.created_at).toLocaleDateString('nl-NL')}</span>
                <span>·</span>
                <span>{article.reading_time} min leestijd</span>
              </div>
            </Link>
          </FadeIn>
        ))}
      </div>

      {(!articles || articles.length === 0) && (
        <FadeIn>
          <div className="text-center py-16">
            <div className="p-8 rounded-2xl bg-bg-card border border-border max-w-md mx-auto">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim mx-auto mb-4">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <p className="text-heading font-display font-semibold mb-2">Binnenkort beschikbaar</p>
              <p className="text-sm text-text-muted mb-4">De eerste FX Outlook analyse wordt binnenkort gepubliceerd.</p>
              <Link href="/blog" className="text-sm text-accent-light hover:text-heading transition-colors">
                Bekijk alle artikelen →
              </Link>
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  )
}
