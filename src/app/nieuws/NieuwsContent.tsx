'use client'

import { useState, useEffect, useCallback } from 'react'

interface NewsArticle {
  id: string
  title: string
  summary: string
  url: string
  source: string
  category: string
  publishedAt: string
  relevanceScore: number
}

const categories = [
  { value: 'all', label: 'Alles', icon: 'globe' },
  { value: 'central-banks', label: 'Centrale Banken', icon: 'bank' },
  { value: 'macro', label: 'Macro-economie', icon: 'chart' },
  { value: 'forex', label: 'Forex', icon: 'currency' },
  { value: 'geopolitics', label: 'Geopolitiek', icon: 'world' },
]

const sourceColors: Record<string, string> = {
  'Federal Reserve': 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  'ECB': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  'ForexLive': 'bg-green-500/15 text-green-400 border-green-500/25',
  'CNBC Economy': 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  'Bloomberg Markets': 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  'NY Times World': 'bg-slate-500/15 text-slate-400 border-slate-500/25',
  'BBC Business': 'bg-red-500/15 text-red-400 border-red-500/25',
}

const categoryLabels: Record<string, string> = {
  'central-banks': 'Centrale Banken',
  'macro': 'Macro',
  'forex': 'Forex',
  'geopolitics': 'Geopolitiek',
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Zojuist'
  if (minutes < 60) return `${minutes} min geleden`
  if (hours < 24) return `${hours} uur geleden`
  if (days === 1) return 'Gisteren'
  if (days < 7) return `${days} dagen geleden`
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export default function NieuwsContent() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)

  const fetchNews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/news?category=${activeCategory}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setArticles(data.articles || [])
      setFetchedAt(data.fetchedAt)
    } catch {
      setError('Kon nieuws niet laden. Probeer het later opnieuw.')
    } finally {
      setLoading(false)
    }
  }, [activeCategory])

  useEffect(() => {
    fetchNews()
  }, [fetchNews])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 sm:py-16">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-accent-glow flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
              <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
              <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-heading">
              Nieuws
            </h1>
            <p className="text-sm text-text-muted">
              Gecureerd financieel nieuws, gefilterd op relevantie voor FX
            </p>
          </div>
        </div>
        <p className="text-text-muted max-w-2xl text-sm leading-relaxed mt-3">
          Alleen het nieuws dat er toe doet: centrale bank beslissingen, rentebeleid, inflatie,
          geopolitieke ontwikkelingen en macro-economische data. Automatisch gefilterd uit betrouwbare bronnen.
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-6">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={`px-3.5 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all ${
              activeCategory === cat.value
                ? 'bg-accent/15 text-accent-light border border-accent/25'
                : 'bg-white/[0.03] text-text-muted border border-white/[0.06] hover:bg-white/[0.06] hover:text-heading'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs text-text-dim">
          {fetchedAt && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span>Bijgewerkt {timeAgo(fetchedAt)}</span>
            </>
          )}
          {!loading && articles.length > 0 && (
            <span className="ml-2">{articles.length} artikelen</span>
          )}
        </div>
        <button
          onClick={fetchNews}
          disabled={loading}
          className="text-xs text-text-muted hover:text-heading transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Ververs
        </button>
      </div>

      {/* Loading state */}
      {loading && articles.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-5 rounded-xl bg-bg-card border border-border animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-16 h-5 rounded bg-white/[0.06]" />
                <div className="w-12 h-5 rounded bg-white/[0.06]" />
              </div>
              <div className="w-3/4 h-5 rounded bg-white/[0.06] mb-2" />
              <div className="w-full h-4 rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-6 rounded-xl bg-red-500/[0.06] border border-red-500/20 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={fetchNews}
            className="mt-3 text-xs text-red-400/70 hover:text-red-400 transition-colors"
          >
            Probeer opnieuw
          </button>
        </div>
      )}

      {/* Articles */}
      {!loading && !error && articles.length === 0 && (
        <div className="p-8 rounded-xl bg-bg-card border border-border text-center">
          <p className="text-text-muted">Geen relevant nieuws gevonden voor deze categorie.</p>
        </div>
      )}

      {articles.length > 0 && (
        <div className="space-y-2.5">
          {articles.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 sm:p-5 rounded-xl bg-bg-card border border-border hover:border-border-light transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  {/* Source & category badges */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
                      sourceColors[article.source] || 'bg-white/[0.06] text-text-muted border-white/[0.08]'
                    }`}>
                      {article.source}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-text-dim">
                      {categoryLabels[article.category] || article.category}
                    </span>
                    {article.relevanceScore >= 5 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent-light border border-accent/20 font-semibold">
                        Belangrijk
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-sm sm:text-base font-semibold text-heading group-hover:text-accent-light transition-colors leading-snug mb-1.5">
                    {article.title}
                  </h3>

                  {/* Summary */}
                  {article.summary && (
                    <p className="text-xs sm:text-sm text-text-muted line-clamp-2 leading-relaxed">
                      {article.summary}
                    </p>
                  )}
                </div>

                {/* Time & external icon */}
                <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 shrink-0">
                  <span className="text-xs text-text-dim whitespace-nowrap">
                    {timeAgo(article.publishedAt)}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim group-hover:text-accent-light transition-colors">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-8 text-center">
        <p className="text-[11px] text-text-dim leading-relaxed max-w-lg mx-auto">
          Nieuwsartikelen worden automatisch gefilterd uit publieke bronnen op basis van relevantie voor FX.
          Sanders Capital is niet verantwoordelijk voor de inhoud van externe bronnen.
        </p>
      </div>
    </div>
  )
}
