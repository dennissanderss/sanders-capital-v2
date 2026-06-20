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

  /* ── card-layout voor begrippen/indicatoren (eco-*) ── */
  .article-content .eco-intro { margin: 0 0 2rem; padding: 1.4rem 1.5rem; border: 1px solid rgba(12,22,38,0.10); border-radius: 14px; background: #ffffff; box-shadow: 0 1px 2px rgba(12,22,38,0.04); }
  .article-content .eco-intro h2 { margin: 0 0 0.5rem; padding: 0; border: none; font-size: 1.3rem; }
  .article-content .eco-intro > p { font-size: 0.97rem; margin: 0 0 0.5rem; }
  .article-content .eco-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; margin: 0.9rem 0; }
  .article-content .eco-3 > div { padding: 0.8rem 0.9rem; border: 1px solid rgba(12,22,38,0.10); border-radius: 10px; background: #f5f7fb; }
  .article-content .eco-3 .k { margin: 0 0 0.2rem; font-size: 0.85rem; font-weight: 700; color: #0c1626; }
  .article-content .eco-3 .v { margin: 0; font-size: 0.78rem; line-height: 1.45; color: #6b7585; }
  .article-content .eco-legend { display: flex; flex-wrap: wrap; gap: 1.1rem; justify-content: center; margin: 0 0 1.6rem; font-size: 0.78rem; color: #6b7585; }
  .article-content .eco-legend span { display: inline-flex; align-items: center; gap: 0.4rem; }
  .article-content .eco-legend i { width: 10px; height: 10px; border-radius: 50%; }
  .article-content .eco-card { margin: 0 0 1.1rem; padding: 1.5rem; border: 1px solid rgba(12,22,38,0.10); border-radius: 14px; background: #ffffff; box-shadow: 0 1px 2px rgba(12,22,38,0.04); }
  .article-content .eco-card-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 0.6rem 0.9rem; margin: 0 0 0.9rem; }
  .article-content .eco-card .nm { margin: 0; padding: 0; border: none; font-family: var(--font-display); font-size: 1.35rem; font-weight: 700; line-height: 1.15; color: #0c1626; letter-spacing: -0.01em; }
  .article-content .eco-card .aka { margin: 0.15rem 0 0; font-size: 0.85rem; color: #6b7585; }
  .article-content .eco-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .article-content .eco-badge { font-size: 0.7rem; font-weight: 700; padding: 0.22rem 0.6rem; border-radius: 999px; border: 1px solid; white-space: nowrap; }
  .article-content .eco-badge.zh { color: #b23a26; background: rgba(212,89,63,0.12); border-color: rgba(212,89,63,0.32); }
  .article-content .eco-badge.h { color: #9a6608; background: rgba(217,160,40,0.16); border-color: rgba(217,160,40,0.36); }
  .article-content .eco-badge.m { color: #7e6a14; background: rgba(202,176,40,0.18); border-color: rgba(202,176,40,0.38); }
  .article-content .eco-freq { font-size: 0.74rem; color: #9aa3b2; }
  .article-content .eco-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0 0 1rem; }
  .article-content .eco-chip { font-size: 0.72rem; color: #3f4a5c; background: #f3f6fb; border: 1px solid rgba(12,22,38,0.10); border-radius: 6px; padding: 0.2rem 0.5rem; }
  .article-content .eco-sec { margin: 0 0 0.85rem; }
  .article-content .eco-sec h4 { margin: 0 0 0.25rem; font-size: 0.82rem; font-weight: 700; color: #0c1626; }
  .article-content .eco-sec p { margin: 0; font-size: 0.95rem; line-height: 1.6; color: #3f4a5c; }
  .article-content .eco-react { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; margin: 0.2rem 0 0.9rem; }
  .article-content .eco-up, .article-content .eco-down { padding: 0.85rem 0.95rem; border-radius: 10px; border: 1px solid; }
  .article-content .eco-up { background: rgba(47,158,111,0.07); border-color: rgba(47,158,111,0.26); }
  .article-content .eco-down { background: rgba(212,89,63,0.06); border-color: rgba(212,89,63,0.24); }
  .article-content .eco-up .lbl, .article-content .eco-down .lbl { display: block; margin: 0 0 0.25rem; font-size: 0.76rem; font-weight: 700; }
  .article-content .eco-up .lbl { color: #2f9e6f; }
  .article-content .eco-down .lbl { color: #d4593f; }
  .article-content .eco-up p, .article-content .eco-down p { margin: 0; font-size: 0.82rem; line-height: 1.5; color: #3f4a5c; }
  .article-content .eco-tip { padding: 0.8rem 0.95rem; border-radius: 10px; background: rgba(59,130,246,0.07); border: 1px solid rgba(59,130,246,0.22); font-size: 0.82rem; line-height: 1.55; color: #3f4a5c; }
  .article-content .eco-tip b { color: #2563eb; }
  @media (max-width: 640px) {
    .article-content .eco-3 { grid-template-columns: 1fr; }
    .article-content .eco-react { grid-template-columns: 1fr; }
    .article-content .eco-card { padding: 1.15rem; }
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
