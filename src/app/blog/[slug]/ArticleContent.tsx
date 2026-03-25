'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Link from 'next/link'

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
      <article className="prose-sc">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizedContent}</ReactMarkdown>
      </article>
    )
  }

  // Show first 2 paragraphs + blur overlay for non-premium users
  const paragraphs = normalizedContent.split('\n\n')
  const preview = paragraphs.slice(0, 3).join('\n\n')

  return (
    <div className="relative">
      <article className="prose-sc premium-blur">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview}</ReactMarkdown>
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
