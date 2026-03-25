import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import DisclaimerBadge from '@/components/DisclaimerBadge'
import FadeIn from '@/components/FadeIn'
import ArticleContent from './ArticleContent'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  const { data: article } = await supabase
    .from('articles')
    .select('title, excerpt')
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (!article) return { title: 'Artikel niet gevonden' }

  return {
    title: article.title,
    description: article.excerpt,
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: article } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (!article) notFound()

  // Get previous and next articles
  const { data: allArticles } = await supabase
    .from('articles')
    .select('slug, title')
    .eq('published', true)
    .order('created_at', { ascending: true })

  const currentIndex = allArticles?.findIndex((a) => a.slug === slug) ?? -1
  const prevArticle = currentIndex > 0 ? allArticles![currentIndex - 1] : null
  const nextArticle =
    currentIndex >= 0 && currentIndex < (allArticles?.length ?? 0) - 1
      ? allArticles![currentIndex + 1]
      : null

  // Check user access for premium articles
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let hasAccess = !article.is_premium
  if (article.is_premium && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    hasAccess = profile?.role === 'premium' || profile?.role === 'admin'
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <FadeIn>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-heading transition-colors mb-8"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Terug naar blog
        </Link>
      </FadeIn>

      <FadeIn delay={100}>
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            {article.tag && (
              <span className="text-xs px-2.5 py-1 rounded-md bg-accent-glow text-accent-light">
                {article.tag}
              </span>
            )}
            {article.is_premium && (
              <span className="text-xs px-2 py-1 rounded-md bg-gold-dim text-gold">
                Premium
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-display font-semibold text-heading mb-4">
            {article.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-text-muted">
            <span>{new Date(article.created_at).toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>·</span>
            <span>{article.reading_time} min leestijd</span>
          </div>
        </header>
      </FadeIn>

      <FadeIn delay={200}>
        <ArticleContent
          content={article.content || ''}
          isPremium={article.is_premium}
          hasAccess={hasAccess}
        />
      </FadeIn>

      <FadeIn delay={300}>
        <DisclaimerBadge className="mt-12" />
      </FadeIn>

      {/* Previous/Next navigation */}
      <FadeIn delay={400}>
        <div className="mt-16 pt-8 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {prevArticle ? (
            <Link
              href={`/blog/${prevArticle.slug}`}
              className="p-4 rounded-lg border border-border hover:border-border-light transition-colors"
            >
              <span className="text-xs text-text-dim">Vorig</span>
              <p className="text-sm text-heading mt-1">{prevArticle.title}</p>
            </Link>
          ) : (
            <div />
          )}
          {nextArticle && (
            <Link
              href={`/blog/${nextArticle.slug}`}
              className="p-4 rounded-lg border border-border hover:border-border-light transition-colors text-right"
            >
              <span className="text-xs text-text-dim">Volgend</span>
              <p className="text-sm text-heading mt-1">{nextArticle.title}</p>
            </Link>
          )}
        </div>
      </FadeIn>
    </div>
  )
}
