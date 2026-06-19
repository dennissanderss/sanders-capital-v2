'use client'

import Link from 'next/link'

const articleStyles = `
  .article-content { max-width: 720px; }
  .article-content h2 { font-family: var(--font-display); font-size: 2.125rem; font-weight: 700; color: var(--color-heading); margin: 3rem 0 1.125rem; line-height: 1.2; letter-spacing: -0.01em; }
  .article-content h3 { font-family: var(--font-display); font-size: 1.5625rem; font-weight: 600; color: var(--color-heading); margin: 2.25rem 0 0.75rem; line-height: 1.3; }
  .article-content p { margin: 0 0 1.375rem; font-size: 1.0625rem; line-height: 1.78; color: var(--color-text); }
  .article-content strong { font-weight: 600; color: var(--color-heading); }
  .article-content em { font-style: italic; color: var(--color-accent-light); }
  .article-content ul { list-style-type: disc; padding-left: 1.375rem; margin: 0 0 1.375rem; }
  .article-content ol { list-style-type: decimal; padding-left: 1.375rem; margin: 0 0 1.375rem; }
  .article-content li { margin-bottom: 0.5625rem; font-size: 1.0625rem; line-height: 1.7; color: var(--color-text); }
  .article-content li::marker { color: var(--color-accent); }
  .article-content a { color: var(--color-accent); text-decoration: none; }
  .article-content a:hover { color: var(--color-accent-light); }
  .article-content blockquote { margin: 2rem 0; padding: 0.375rem 0 0.375rem 1.625rem; border-left: 2px solid var(--color-accent); font-family: var(--font-display); font-size: 1.6875rem; font-weight: 500; font-style: normal; line-height: 1.32; letter-spacing: -0.01em; color: var(--color-heading); }
  .article-content blockquote p { font-size: inherit; line-height: inherit; color: inherit; margin: 0; }
  .article-content figure { margin: 2rem 0; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; background: var(--color-surface); }
  .article-content figure img { display: block; width: 100%; border-radius: 0; }
  .article-content figcaption { padding: 0.8125rem 1rem; font-size: 0.75rem; letter-spacing: 0.02em; color: var(--color-text-dim); border-top: 1px solid var(--color-border); }
  .article-content img { max-width: 100%; border-radius: 8px; }
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
          <div className="w-12 h-12 rounded-full bg-accent-glow flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h3 className="text-2xl font-display font-semibold text-heading mb-2">Premium content</h3>
          <p className="text-sm text-text-muted mb-6 max-w-sm">
            Dit onderdeel is exclusief voor premium leden. Upgrade je account voor volledige toegang.
          </p>
          <Link
            href="/premium"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium shadow-sm transition-colors"
          >
            Ontdek Premium
          </Link>
        </div>
      </div>
    </div>
  )
}
