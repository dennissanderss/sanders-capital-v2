'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Link from 'next/link'
import type { ComponentPropsWithoutRef } from 'react'

const components = {
  h2: ({ children }: ComponentPropsWithoutRef<'h2'>) => (
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-heading)', marginTop: '3rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)', lineHeight: 1.2 }}>
      {children}
    </h2>
  ),
  h3: ({ children }: ComponentPropsWithoutRef<'h3'>) => (
    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 600, color: 'var(--color-heading)', marginTop: '2.25rem', marginBottom: '0.5rem', lineHeight: 1.3 }}>
      {children}
    </h3>
  ),
  p: ({ children }: ComponentPropsWithoutRef<'p'>) => (
    <p style={{ marginBottom: '1.25rem', lineHeight: 1.85, color: 'var(--color-text)' }}>
      {children}
    </p>
  ),
  ul: ({ children }: ComponentPropsWithoutRef<'ul'>) => (
    <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.25rem', marginTop: '0.25rem', listStyleType: 'disc' }}>
      {children}
    </ul>
  ),
  ol: ({ children }: ComponentPropsWithoutRef<'ol'>) => (
    <ol style={{ paddingLeft: '1.5rem', marginBottom: '1.25rem', marginTop: '0.25rem', listStyleType: 'decimal' }}>
      {children}
    </ol>
  ),
  li: ({ children }: ComponentPropsWithoutRef<'li'>) => (
    <li style={{ marginBottom: '0.4rem', lineHeight: 1.75, color: 'var(--color-text)' }}>
      {children}
    </li>
  ),
  strong: ({ children }: ComponentPropsWithoutRef<'strong'>) => (
    <strong style={{ fontWeight: 600, color: 'var(--color-heading)' }}>
      {children}
    </strong>
  ),
  em: ({ children }: ComponentPropsWithoutRef<'em'>) => (
    <em style={{ fontStyle: 'italic', color: 'var(--color-accent-light)' }}>
      {children}
    </em>
  ),
  blockquote: ({ children }: ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote style={{ borderLeft: '3px solid var(--color-accent-dim)', paddingLeft: '1rem', margin: '1.5rem 0', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
      {children}
    </blockquote>
  ),
}

export default function ArticleContent({
  content,
  isPremium,
  hasAccess,
}: {
  content: string
  isPremium: boolean
  hasAccess: boolean
}) {
  const normalizedContent = content.replace(/\\n/g, '\n')

  if (!isPremium || hasAccess) {
    return (
      <article>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{normalizedContent}</ReactMarkdown>
      </article>
    )
  }

  // Show first 2 paragraphs + blur overlay for non-premium users
  const paragraphs = normalizedContent.split('\n\n')
  const preview = paragraphs.slice(0, 3).join('\n\n')

  return (
    <div className="relative">
      <article className="premium-blur">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{preview}</ReactMarkdown>
        <div className="h-32" />
      </article>

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
