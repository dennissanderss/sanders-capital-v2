'use client'

import { useState, useEffect, useCallback } from 'react'

interface NewsArticle {
  id: string
  title: string
  titleNl: string
  summary: string
  summaryNl: string
  fullContent: string
  url: string
  source: string
  category: string
  publishedAt: string
  relevanceScore: number
  relevanceTags: string[]
  affectedCurrencies: string[]
  relevanceContext: string
}

const categories = [
  { value: 'all', label: 'Alles' },
  { value: 'central-banks', label: 'Centrale Banken' },
  { value: 'macro', label: 'Macro-economie' },
  { value: 'forex', label: 'Forex' },
  { value: 'geopolitics', label: 'Geopolitiek' },
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

const themeColors: Record<string, string> = {
  rates: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  inflation: 'bg-red-500/10 text-red-400 border-red-500/20',
  labor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  growth: 'bg-green-500/10 text-green-400 border-green-500/20',
  geopolitics: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  risk: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  energy: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  trade: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
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
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null)
  const [showDutch, setShowDutch] = useState(true)

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

  // Close reader on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedArticle(null)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 sm:py-16">
      {/* Article Reader Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4" onClick={() => setSelectedArticle(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-bg-card border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Reader header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${sourceColors[selectedArticle.source] || 'bg-white/[0.06] text-text-muted border-white/[0.08]'}`}>
                  {selectedArticle.source}
                </span>
                <span className="text-xs text-text-dim">{timeAgo(selectedArticle.publishedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Language toggle in reader */}
                <button
                  onClick={() => setShowDutch(!showDutch)}
                  className="text-[10px] px-2 py-1 rounded border border-white/[0.08] text-text-dim hover:text-heading transition-colors"
                >
                  {showDutch ? 'EN' : 'NL'}
                </button>
                <button onClick={() => setSelectedArticle(null)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Reader content */}
            <div className="px-6 py-6">
              <h2 className="text-xl font-display font-semibold text-heading mb-3 leading-snug">
                {showDutch ? selectedArticle.titleNl : selectedArticle.title}
              </h2>

              {/* Relevance context */}
              {selectedArticle.relevanceContext && (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light shrink-0">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span className="text-xs text-accent-light font-medium">{selectedArticle.relevanceContext}</span>
                </div>
              )}

              {/* Affected currencies */}
              {selectedArticle.affectedCurrencies.length > 0 && (
                <div className="flex items-center gap-1.5 mb-4">
                  <span className="text-[10px] text-text-dim">Impact op:</span>
                  {selectedArticle.affectedCurrencies.map(c => (
                    <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent-light border border-accent/20 font-mono font-bold">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Article text */}
              <div className="text-sm text-text leading-relaxed whitespace-pre-line">
                {showDutch ? selectedArticle.summaryNl : selectedArticle.summary}
              </div>

              {selectedArticle.fullContent && selectedArticle.fullContent.length > selectedArticle.summary.length + 50 && (
                <div className="mt-4 text-sm text-text-muted leading-relaxed whitespace-pre-line">
                  {selectedArticle.fullContent.slice(selectedArticle.summary.length).trim().slice(0, 800)}
                  {selectedArticle.fullContent.length > selectedArticle.summary.length + 800 && '...'}
                </div>
              )}
            </div>

            {/* Reader footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <p className="text-[10px] text-text-dim">Bron: {selectedArticle.source}</p>
              <a
                href={selectedArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/15 border border-accent/25 text-accent-light text-sm font-medium hover:bg-accent/25 transition-colors"
              >
                Lees volledig artikel
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}

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
          geopolitieke ontwikkelingen en macro-economische data. Automatisch vertaald en gefilterd.
        </p>

        {/* Sources */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[11px] text-text-dim">Bronnen:</span>
          {[
            { name: 'Federal Reserve', url: 'https://www.federalreserve.gov' },
            { name: 'ECB', url: 'https://www.ecb.europa.eu' },
            { name: 'ForexLive', url: 'https://www.forexlive.com' },
            { name: 'CNBC', url: 'https://www.cnbc.com' },
            { name: 'Bloomberg', url: 'https://www.bloomberg.com' },
            { name: 'BBC', url: 'https://www.bbc.co.uk/news/business' },
            { name: 'NY Times', url: 'https://www.nytimes.com/section/world' },
          ].map((src, i) => (
            <a key={src.name} href={src.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-text-dim hover:text-text-muted transition-colors">
              {src.name}{i < 6 ? ' ·' : ''}
            </a>
          ))}
          <span className="text-[10px] text-text-dim/60 ml-1">(via publieke RSS feeds)</span>
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        {/* Category tabs */}
        <div className="flex items-center gap-2 overflow-x-auto flex-1">
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

        {/* Language toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowDutch(!showDutch)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
              showDutch
                ? 'bg-white/[0.06] border-white/[0.1] text-heading'
                : 'bg-white/[0.03] border-white/[0.06] text-text-muted hover:text-heading'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            {showDutch ? 'NL' : 'EN'}
          </button>
        </div>
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

      {/* Loading */}
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

      {/* Error */}
      {error && (
        <div className="p-6 rounded-xl bg-red-500/[0.06] border border-red-500/20 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={fetchNews} className="mt-3 text-xs text-red-400/70 hover:text-red-400 transition-colors">
            Probeer opnieuw
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && articles.length === 0 && (
        <div className="p-8 rounded-xl bg-bg-card border border-border text-center">
          <p className="text-text-muted">Geen relevant nieuws gevonden voor deze categorie.</p>
        </div>
      )}

      {/* Articles list */}
      {articles.length > 0 && (
        <div className="space-y-2.5">
          {articles.map((article) => (
            <button
              key={article.id}
              onClick={() => setSelectedArticle(article)}
              className="block w-full text-left p-4 sm:p-5 rounded-xl bg-bg-card border border-border hover:border-border-light transition-all group cursor-pointer"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  {/* Source, category & relevance badges */}
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${sourceColors[article.source] || 'bg-white/[0.06] text-text-muted border-white/[0.08]'}`}>
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
                    {/* Currency impact badges */}
                    {article.affectedCurrencies.slice(0, 3).map(c => (
                      <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-text-dim font-mono font-bold">
                        {c}
                      </span>
                    ))}
                  </div>

                  {/* Title */}
                  <h3 className="text-sm sm:text-base font-semibold text-heading group-hover:text-accent-light transition-colors leading-snug mb-1">
                    {showDutch ? (article.titleNl || article.title) : article.title}
                  </h3>

                  {/* Summary */}
                  {article.summary && (
                    <p className="text-xs sm:text-sm text-text-muted line-clamp-2 leading-relaxed mb-1.5">
                      {showDutch ? (article.summaryNl || article.summary) : article.summary}
                    </p>
                  )}

                  {/* Relevance context */}
                  {article.relevanceContext && (
                    <p className="text-[11px] text-accent-light/70 flex items-center gap-1.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {article.relevanceContext}
                    </p>
                  )}
                </div>

                {/* Time */}
                <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 shrink-0">
                  <span className="text-xs text-text-dim whitespace-nowrap">
                    {timeAgo(article.publishedAt)}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim group-hover:text-accent-light transition-colors">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-8 text-center">
        <p className="text-[11px] text-text-dim leading-relaxed max-w-lg mx-auto">
          Nieuwsartikelen worden automatisch gefilterd en vertaald uit publieke RSS feeds.
          Sanders Capital is niet verantwoordelijk voor de inhoud van externe bronnen.
          Vertalingen zijn automatisch en kunnen onnauwkeurigheden bevatten.
        </p>
      </div>
    </div>
  )
}
