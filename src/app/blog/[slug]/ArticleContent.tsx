'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

const articleStyles = `
  .article-content { max-width: 760px; }
  .article-content > *:first-child { margin-top: 0; }
  .article-content h2 { font-family: var(--font-display); font-size: 2.125rem; font-weight: 700; color: var(--color-heading); margin: 3rem 0 1.125rem; padding-bottom: 0; border-bottom: none; line-height: 1.12; letter-spacing: -0.018em; }
  .article-content h3 { font-family: var(--font-display); font-size: 1.5625rem; font-weight: 700; color: var(--color-heading); margin: 2.25rem 0 0.75rem; line-height: 1.2; letter-spacing: -0.018em; }
  .article-content p { font-size: 1.0625rem; margin-bottom: 1.375rem; line-height: 1.78; color: var(--color-text); }
  .article-content strong { font-weight: 600; color: var(--color-heading); }
  .article-content em { font-style: italic; color: var(--color-accent-light); }
  .article-content ul { list-style-type: disc; padding-left: 1.375rem; margin-bottom: 1.375rem; }
  .article-content ol { list-style-type: decimal; padding-left: 1.375rem; margin-bottom: 1.375rem; }
  .article-content li { font-size: 1.0625rem; margin-bottom: 0.5625rem; line-height: 1.7; color: var(--color-text); }
  .article-content li::marker { color: var(--color-accent); }
  .article-content blockquote { margin: 2rem 0; padding: 0.375rem 0 0.375rem 1.625rem; border-left: 2px solid var(--color-accent); font-family: var(--font-display); font-size: 1.6875rem; font-weight: 500; font-style: normal; line-height: 1.32; letter-spacing: -0.01em; color: var(--color-heading); }
  .article-content a { color: var(--color-accent); }
  .article-content figure, .article-content .figure { margin: 2rem 0; border: 1px solid var(--color-border); border-radius: 5px; overflow: hidden; background: var(--color-bg-card, #fff); }
  .article-content figure img, .article-content .figure img { border-radius: 0; margin: 0; }
  .article-content figure figcaption, .article-content .figure .cap { padding: 0.8125rem 1rem; font-size: 0.71875rem; letter-spacing: 0.03em; color: var(--color-text-dim); border-top: 1px solid var(--color-border); }
  .article-content img { max-width: 100%; border-radius: 6px; display: block; }
  .article-content img[data-broken="1"] { display: none !important; }
  .article-content img[style*="float:left"],
  .article-content img[style*="float: left"],
  .article-content img[data-float="left"],
  .article-content img[float="left"] { float: left !important; margin: 0.5rem 1.5rem 0.75rem 0 !important; display: block !important; }
  .article-content img[style*="float:right"],
  .article-content img[style*="float: right"],
  .article-content img[data-float="right"],
  .article-content img[float="right"] { float: right !important; margin: 0.5rem 0 0.75rem 1.5rem !important; display: block !important; }
  .article-content::after { content: ''; display: table; clear: both; }
  @media (max-width: 640px) {
    .article-content h2 { font-size: 1.5rem; }
    .article-content h3 { font-size: 1.2rem; }
  }
`

export default function ArticleContent({
  content,
  isPremium,
  hasAccess,
}: {
  content: string
  isPremium: boolean
  hasAccess: boolean
}) {
  const articleRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = articleRef.current
    if (!root) return
    const imgs = Array.from(root.querySelectorAll('img'))
    const markBroken = (img: HTMLImageElement) => img.setAttribute('data-broken', '1')
    for (const img of imgs) {
      // Al geladen én broken (complete=true, naturalWidth=0)
      if (img.complete && img.naturalWidth === 0) {
        markBroken(img)
      } else {
        img.addEventListener('error', () => markBroken(img), { once: true })
      }
    }
  }, [content])

  if (!isPremium || hasAccess) {
    return (
      <>
        <style>{articleStyles}</style>
        <article ref={articleRef} className="article-content" dangerouslySetInnerHTML={{ __html: content }} />

        <div className="mt-12 pt-7 border-t border-border flex flex-wrap items-center justify-between gap-5">
          <span className="inline-flex items-center gap-2 text-xs tracking-wide text-text-dim">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Educatief, geen financieel advies
          </span>
          <Link
            href="/blog"
            className="group inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-light transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px] transition-transform group-hover:-translate-x-1">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
            Terug naar artikelen
          </Link>
        </div>
      </>
    )
  }

  // Show preview + blur overlay for non-premium users
  const previewHtml = content.split('</p>').slice(0, 3).join('</p>') + '</p>'

  return (
    <div className="relative">
      <style>{articleStyles}</style>
      <article ref={articleRef} className="article-content premium-blur" dangerouslySetInnerHTML={{ __html: previewHtml }} />
      <div className="h-32" />

      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center pb-8 pt-24 bg-gradient-to-t from-bg via-bg/95 to-transparent">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-gold-dim flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h3 className="text-xl font-display font-semibold text-heading mb-2">
            Premium content
          </h3>
          <p className="text-sm text-text-muted mb-6 max-w-sm">
            Dit artikel is exclusief voor premium leden. Upgrade je account voor volledige toegang.
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
