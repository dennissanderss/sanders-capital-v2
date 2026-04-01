import { NextResponse } from 'next/server'
import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'SandersCapital/1.0',
    'Accept': 'application/rss+xml, application/xml, text/xml',
  },
})

/* ─── RSS Sources ──────────────────────────────────────────── */
interface FeedSource {
  url: string
  name: string
  category: 'central-banks' | 'macro' | 'forex' | 'geopolitics'
  language: 'en' | 'nl'
  priority: number // 1 = highest
}

const FEEDS: FeedSource[] = [
  // Central Banks
  {
    url: 'https://www.federalreserve.gov/feeds/press_all.xml',
    name: 'Federal Reserve',
    category: 'central-banks',
    language: 'en',
    priority: 1,
  },
  {
    url: 'https://www.ecb.europa.eu/rss/press.html',
    name: 'ECB',
    category: 'central-banks',
    language: 'en',
    priority: 1,
  },
  // Macro & Forex
  {
    url: 'https://www.forexlive.com/feed/',
    name: 'ForexLive',
    category: 'forex',
    language: 'en',
    priority: 2,
  },
  {
    url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html',
    name: 'CNBC Economy',
    category: 'macro',
    language: 'en',
    priority: 2,
  },
  {
    url: 'https://feeds.bloomberg.com/markets/news.rss',
    name: 'Bloomberg Markets',
    category: 'macro',
    language: 'en',
    priority: 2,
  },
  // Geopolitics & broad
  {
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    name: 'NY Times World',
    category: 'geopolitics',
    language: 'en',
    priority: 3,
  },
  {
    url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    name: 'BBC Business',
    category: 'macro',
    language: 'en',
    priority: 3,
  },
]

/* ─── Relevance keywords (case-insensitive) ────────────────── */
const HIGH_RELEVANCE = [
  'interest rate', 'rate decision', 'rate hike', 'rate cut',
  'federal reserve', 'fed ', 'fomc', 'powell',
  'ecb', 'lagarde', 'european central bank',
  'bank of england', 'boe', 'bank of japan', 'boj',
  'rba', 'reserve bank', 'rbnz', 'bank of canada', 'snb',
  'inflation', 'cpi', 'pce', 'core inflation',
  'nonfarm', 'non-farm', 'payrolls', 'unemployment', 'jobs report',
  'gdp', 'recession', 'economic growth',
  'monetary policy', 'quantitative', 'tightening', 'easing',
  'hawkish', 'dovish', 'pivot',
  'treasury', 'yield', 'bond',
  'dollar', 'euro', 'yen', 'pound', 'sterling', 'forex', 'currency',
  'dxy', 'usd', 'eur', 'gbp', 'jpy',
  'tariff', 'trade war', 'sanctions', 'geopolit',
  'war', 'conflict', 'nato', 'china', 'russia', 'ukraine',
  'oil', 'crude', 'opec', 'energy crisis',
  'gold', 'safe haven', 'risk-off', 'risk-on',
  'pmi', 'manufacturing', 'services',
  'retail sales', 'consumer', 'housing',
]

const LOW_RELEVANCE = [
  'crypto', 'bitcoin', 'nft', 'meme', 'celebrity',
  'sports', 'entertainment', 'fashion', 'recipe',
]

function calculateRelevance(title: string, summary: string): number {
  const text = `${title} ${summary}`.toLowerCase()

  // Filter out irrelevant content
  for (const keyword of LOW_RELEVANCE) {
    if (text.includes(keyword)) return 0
  }

  let score = 0
  for (const keyword of HIGH_RELEVANCE) {
    if (text.includes(keyword)) score += 1
  }

  return score
}

/* ─── Article type ─────────────────────────────────────────── */
export interface NewsArticle {
  id: string
  title: string
  summary: string
  url: string
  source: string
  category: string
  publishedAt: string
  relevanceScore: number
}

/* ─── Cache ─────────────────────────────────────────────────── */
let cachedArticles: NewsArticle[] = []
let cacheTimestamp = 0
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

async function fetchAllFeeds(): Promise<NewsArticle[]> {
  const now = Date.now()
  if (cachedArticles.length > 0 && now - cacheTimestamp < CACHE_DURATION) {
    return cachedArticles
  }

  const results: NewsArticle[] = []

  const feedPromises = FEEDS.map(async (source) => {
    try {
      const feed = await parser.parseURL(source.url)
      const items = (feed.items || []).slice(0, 20) // Max 20 per source

      for (const item of items) {
        const title = item.title?.trim() || ''
        const summary = (item.contentSnippet || item.content || item.summary || '').trim().slice(0, 300)
        const relevance = calculateRelevance(title, summary)

        // Only include if somewhat relevant (score >= 1) or from high-priority sources
        if (relevance >= 1 || (source.priority === 1 && relevance >= 0)) {
          results.push({
            id: `${source.name}-${item.guid || item.link || title}`.slice(0, 120),
            title,
            summary: summary.replace(/<[^>]*>/g, '').slice(0, 200), // Strip HTML
            url: item.link || '',
            source: source.name,
            category: source.category,
            publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
            relevanceScore: relevance + (4 - source.priority), // Boost high-priority sources
          })
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch feed: ${source.name}`, err instanceof Error ? err.message : err)
    }
  })

  await Promise.allSettled(feedPromises)

  // Sort by relevance first, then by date
  results.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  })

  // Deduplicate similar titles
  const seen = new Set<string>()
  const deduped = results.filter((article) => {
    const key = article.title.toLowerCase().slice(0, 60)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  cachedArticles = deduped.slice(0, 50) // Max 50 articles
  cacheTimestamp = now
  return cachedArticles
}

/* ─── GET handler ──────────────────────────────────────────── */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  try {
    let articles = await fetchAllFeeds()

    if (category && category !== 'all') {
      articles = articles.filter((a) => a.category === category)
    }

    return NextResponse.json({ articles, fetchedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json(
      { articles: [], error: 'Failed to fetch news' },
      { status: 500 }
    )
  }
}
