import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import FadeIn from '@/components/FadeIn'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Educatieve artikelen over trading, marktstructuur, psychologie en risicomanagement.',
}

export default async function BlogPage() {
  const supabase = await createServerSupabaseClient()
  const { data: articles } = await supabase
    .from('articles')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-6xl mx-auto px-6 py-24">
      <FadeIn>
        <div className="mb-16">
          <h1 className="text-4xl md:text-5xl font-display font-semibold text-heading mb-4">
            Blog
          </h1>
          <p className="text-text-muted max-w-2xl">
            Educatieve artikelen over financiële markten, marktstructuur, psychologie en risicomanagement.
          </p>
        </div>
      </FadeIn>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles?.map((article, i) => (
          <FadeIn key={article.id} delay={i * 80}>
            <Link
              href={`/blog/${article.slug}`}
              className="block p-6 rounded-xl bg-bg-card border border-border hover:border-border-light transition-all group h-full"
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
            <p className="text-text-muted">Nog geen artikelen gepubliceerd.</p>
          </div>
        </FadeIn>
      )}
    </div>
  )
}
