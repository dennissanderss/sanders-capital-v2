import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import FadeIn from '@/components/FadeIn'
import NavIcon from '@/components/NavIcon'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kennisbank',
  description: 'Gestructureerde educatieve content over risicomanagement, psychologie, marktstructuur en meer.',
}


interface KbItem {
  id: string
  title: string
  slug: string
  category: string
  is_premium: boolean
  order_index: number
  documents: { name: string; url: string; size: number }[] | null
}

export default async function KennisbankPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: categories }, { data: rawItems }] = await Promise.all([
    supabase.from('kennisbank_categories').select('*').order('order_index'),
    supabase.from('kennisbank_items').select('*').order('order_index', { ascending: true }),
  ])

  const items = (rawItems ?? []) as KbItem[]

  const groupedItems = (categories ?? []).map((cat) => ({
    ...cat,
    items: items.filter((item) => item.category === cat.slug),
  }))

  return (
    <div>
      {/* Page head */}
      <div className="border-b border-border bg-surface/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-14 sm:pt-20 sm:pb-16">
          <FadeIn>
            <nav className="flex items-center gap-2 text-xs font-mono tracking-wide text-text-dim">
              <Link href="/" className="hover:text-accent-light transition-colors">Home</Link>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              <span className="text-text-muted">Kennisbank</span>
            </nav>
            <span className="mt-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent before:h-px before:w-6 before:bg-accent/70 before:content-['']">
              Kennisbank
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight text-heading">
              Bouw je fundament
            </h1>
            <p className="mt-4 max-w-[60ch] text-base sm:text-lg text-text-muted leading-relaxed">
              Gestructureerde kennis, geordend per onderwerp. Begin bij de basis en verdiep je in de gebieden die jouw besluitvorming het meest versterken.
            </p>
          </FadeIn>
        </div>
      </div>

      {/* Topics grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 auto-rows-fr">
        {groupedItems.map((cat, i) => (
          <FadeIn key={cat.id} delay={i * 100} className="h-full">
            <div
              id={cat.slug}
              className={`p-7 rounded-xl border border-border bg-bg-card transition-all duration-300 glass-hover hover:border-border-light hover:-translate-y-0.5 h-full flex flex-col scroll-mt-24 ${
                cat.is_premium ? 'glass-gold' : ''
              }`}
            >
              <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 rounded-lg bg-accent-glow border border-border flex items-center justify-center text-accent-light shrink-0">
                  <NavIcon icon={cat.icon} size={24} />
                </div>
                <h2 className="text-xl font-display font-bold tracking-tight text-heading pt-1">
                  {cat.name}
                </h2>
              </div>

              {cat.items.length > 0 ? (
                <ul className="space-y-3 flex-1">
                  {cat.items.map((item: KbItem) => (
                    <li key={item.id}>
                      <div className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 shrink-0">
                          {item.is_premium ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/kennisbank/${item.slug}`}
                            className={`hover:underline underline-offset-2 transition-colors ${item.is_premium ? 'text-text-muted hover:text-heading' : 'text-text hover:text-heading'}`}
                          >
                            {item.title}
                          </Link>
                          {/* Download documents */}
                          {Array.isArray(item.documents) && item.documents.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              {(item.documents as { name: string; url: string; size: number }[]).map((doc, di: number) => (
                                <a
                                  key={di}
                                  href={doc.url}
                                  download={doc.name}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-accent-light text-xs hover:bg-accent/20 transition-colors"
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                  {doc.name.length > 20 ? doc.name.slice(0, 18) + '…' : doc.name}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-dim flex-1">Binnenkort beschikbaar</p>
              )}

              {cat.is_premium && (
                <Link
                  href="/premium"
                  className="inline-block mt-4 text-xs text-gold hover:text-gold/80 transition-colors self-start"
                >
                  Ontdek premium →
                </Link>
              )}
            </div>
          </FadeIn>
        ))}
      </div>
      </div>

      {/* CTA band */}
      <section className="border-t border-border bg-surface/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <FadeIn>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold tracking-tight text-heading max-w-[17ch]">
                  Liever lezen per artikel?
                </h2>
                <p className="mt-4 max-w-[46ch] text-text-muted">
                  Alle modules en losse artikelen staan gebundeld in de blog.
                </p>
              </div>
              <div className="shrink-0">
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-4 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/30"
                >
                  Naar artikelen
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  )
}
