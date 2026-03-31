import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import FadeIn from '@/components/FadeIn'
import Breadcrumb from '@/components/Breadcrumb'
import KennisbankContent from './KennisbankContent'
import type { Metadata } from 'next'

// Slugs that have dedicated static pages
const STATIC_REDIRECTS: Record<string, string> = {
  '1-economische-begrippen': '/kennisbank/begrippen',
  'economische-begrippen': '/kennisbank/begrippen',
}

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  const { data: item } = await supabase
    .from('kennisbank_items')
    .select('title')
    .eq('slug', slug)
    .single()

  if (!item) return { title: 'Kennisbank item niet gevonden' }
  return { title: item.title + ' | Kennisbank' }
}

export default async function KennisbankItemPage({ params }: Props) {
  const { slug } = await params

  // Redirect slugs that have dedicated static pages
  if (STATIC_REDIRECTS[slug]) redirect(STATIC_REDIRECTS[slug])

  const supabase = await createServerSupabaseClient()

  const { data: item } = await supabase
    .from('kennisbank_items')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!item) notFound()

  // Vorige / volgende items in dezelfde categorie
  const { data: catItems } = await supabase
    .from('kennisbank_items')
    .select('slug, title')
    .eq('category', item.category)
    .order('order_index', { ascending: true })

  const currentIndex = catItems?.findIndex((i) => i.slug === slug) ?? -1
  const prevItem = currentIndex > 0 ? catItems![currentIndex - 1] : null
  const nextItem =
    currentIndex >= 0 && currentIndex < (catItems?.length ?? 0) - 1
      ? catItems![currentIndex + 1]
      : null

  // Check of de categorie premium is
  const { data: category } = await supabase
    .from('kennisbank_categories')
    .select('name, is_premium')
    .eq('slug', item.category)
    .single()

  const isPremium = item.is_premium || category?.is_premium

  // Check toegang voor premium items
  const { data: { user } } = await supabase.auth.getUser()

  let hasAccess = !isPremium
  if (isPremium && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    hasAccess = profile?.role === 'premium' || profile?.role === 'admin'
  }

  const documents: { name: string; url: string; size: number }[] = Array.isArray(item.documents)
    ? item.documents
    : []

  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <FadeIn>
        <Breadcrumb items={[
          { label: 'Kennisbank', href: '/kennisbank' },
          ...(category?.name ? [{ label: category.name, href: `/kennisbank#${item.category}` }] : []),
          { label: item.title },
        ]} />
      </FadeIn>

      <FadeIn delay={100}>
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs px-2.5 py-1 rounded-md bg-accent-glow text-accent-light capitalize">
              {item.category?.replace(/-/g, ' ')}
            </span>
            {isPremium && (
              <span className="text-xs px-2 py-1 rounded-md bg-gold-dim text-gold">Premium</span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-display font-semibold text-heading mb-4">
            {item.title}
          </h1>
        </header>
      </FadeIn>

      <FadeIn delay={200}>
        <KennisbankContent
          content={item.content || ''}
          isPremium={!!isPremium}
          hasAccess={hasAccess}
        />
      </FadeIn>

      {/* Documenten downloaden */}
      {hasAccess && documents.length > 0 && (
        <FadeIn delay={300}>
          <div className="mt-12 p-6 rounded-xl glass">
            <h3 className="text-sm font-semibold text-heading mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Downloads
            </h3>
            <div className="space-y-2">
              {documents.map((doc, i) => (
                <a
                  key={i}
                  href={doc.url}
                  download={doc.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg glass glass-hover transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">
                      {doc.name.endsWith('.pdf') ? '📄' :
                       doc.name.match(/\.docx?$/) ? '📝' :
                       doc.name.match(/\.xlsx?$/) ? '📊' :
                       doc.name.match(/\.pptx?$/) ? '📑' : '📎'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-heading truncate">{doc.name}</p>
                      <p className="text-xs text-text-dim">
                        {doc.size < 1024 * 1024
                          ? (doc.size / 1024).toFixed(1) + ' KB'
                          : (doc.size / (1024 * 1024)).toFixed(1) + ' MB'}
                      </p>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light shrink-0 ml-3 opacity-60 group-hover:opacity-100 transition-opacity">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Vorige / volgende navigatie */}
      <FadeIn delay={400}>
        <div className="mt-16 pt-8 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {prevItem ? (
            <Link
              href={`/kennisbank/${prevItem.slug}`}
              className="p-4 rounded-lg glass glass-hover transition-all"
            >
              <span className="text-xs text-text-dim">Vorig</span>
              <p className="text-sm text-heading mt-1">{prevItem.title}</p>
            </Link>
          ) : <div />}
          {nextItem && (
            <Link
              href={`/kennisbank/${nextItem.slug}`}
              className="p-4 rounded-lg border border-border hover:border-border-light transition-colors text-right"
            >
              <span className="text-xs text-text-dim">Volgend</span>
              <p className="text-sm text-heading mt-1">{nextItem.title}</p>
            </Link>
          )}
        </div>
      </FadeIn>
    </div>
  )
}
