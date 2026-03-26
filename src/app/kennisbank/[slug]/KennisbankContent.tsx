'use client'

import Link from 'next/link'

const articleStyles = `
  .article-content h2 { font-family: var(--font-display); font-size: 2rem; font-weight: 700; color: var(--color-heading); margin-top: 3rem; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border); line-height: 1.2; }
  .article-content h3 { font-family: var(--font-display); font-size: 1.5rem; font-weight: 600; color: var(--color-heading); margin-top: 2.25rem; margin-bottom: 0.5rem; line-height: 1.3; }
  .article-content p { margin-bottom: 1.25rem; line-height: 1.85; color: var(--color-text); }
  .article-content strong { font-weight: 600; color: var(--color-heading); }
  .article-content em { font-style: italic; color: var(--color-accent-light); }
  .article-content ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1.25rem; }
  .article-content ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1.25rem; }
  .article-content li { margin-bottom: 0.4rem; line-height: 1.75; color: var(--color-text); }
  .article-content blockquote { border-left: 3px solid var(--color-accent-dim); padding-left: 1rem; margin: 1.5rem 0; color: var(--color-text-muted); font-style: italic; }
  .article-content img { max-width: 100%; border-radius: 6px; }
  .article-content img[style*="float: left"] { float: left; margin: 0.5rem 1.5rem 0.75rem 0; }
  .article-content img[style*="float: right"] { float: right; margin: 0.5rem 0 0.75rem 1.5rem; }
  .article-content::after { content: ''; display: table; clear: both; }
`

export default function KennisbankContent({
  content,
  isPremium,
  hasAccess,
}: {
  content: string
  isPremium: boolean
  hasAccess: boolean
}) {
  if (!isPremium || hasAccess) {
    return (
      <>
        <style>{articleStyles}</style>
        <article className="article-content" dangerouslySetInnerHTML={{ __html: content }} />
      </>
    )
  }

  const previewHtml = content.split('</p>').slice(0, 3).join('</p>') + '</p>'

  return (
    <div className="relative">
      <style>{articleStyles}</style>
      <article className="article-content" dangerouslySetInnerHTML={{ __html: previewHtml }} />
      <div className="h-32" />
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center pb-8 pt-24 bg-gradient-to-t from-bg via-bg/95 to-transparent">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-gold-dim flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h3 className="text-xl font-display font-semibold text-heading mb-2">Premium content</h3>
          <p className="text-sm text-text-muted mb-6 max-w-sm">
            Dit onderdeel is exclusief voor premium leden. Upgrade je account voor volledige toegang.
          </p>
          <Link
            href="/premium"
            className="inline-block px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors"
          >
            Ontdek Premium
          </Link>
        </div>
      </div>
    </div>
  )
}
