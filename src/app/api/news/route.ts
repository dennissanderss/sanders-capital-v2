import { NextResponse } from 'next/server'
import Parser from 'rss-parser'
import translate from 'google-translate-api-x'

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
  priority: number
}

const FEEDS: FeedSource[] = [
  { url: 'https://www.federalreserve.gov/feeds/press_all.xml', name: 'Federal Reserve', category: 'central-banks', language: 'en', priority: 1 },
  { url: 'https://www.ecb.europa.eu/rss/press.html', name: 'ECB', category: 'central-banks', language: 'en', priority: 1 },
  { url: 'https://www.forexlive.com/feed/', name: 'ForexLive', category: 'forex', language: 'en', priority: 2 },
  { url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', name: 'CNBC Economy', category: 'macro', language: 'en', priority: 2 },
  { url: 'https://feeds.bloomberg.com/markets/news.rss', name: 'Bloomberg Markets', category: 'macro', language: 'en', priority: 2 },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', name: 'NY Times World', category: 'geopolitics', language: 'en', priority: 3 },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', name: 'BBC Business', category: 'macro', language: 'en', priority: 3 },
]

/* ─── Relevance system ─────────────────────────────────────── */
interface RelevanceTag {
  keyword: string
  label: string // Dutch label shown to users
  currencies: string[] // Affected currency pairs
  theme: 'rates' | 'inflation' | 'labor' | 'growth' | 'geopolitics' | 'risk' | 'energy' | 'trade'
}

const RELEVANCE_TAGS: RelevanceTag[] = [
  // Central banks & rates
  { keyword: 'federal reserve', label: 'Fed beleid', currencies: ['USD'], theme: 'rates' },
  { keyword: 'fed ', label: 'Fed beleid', currencies: ['USD'], theme: 'rates' },
  { keyword: 'fomc', label: 'FOMC besluit', currencies: ['USD'], theme: 'rates' },
  { keyword: 'powell', label: 'Fed voorzitter', currencies: ['USD'], theme: 'rates' },
  { keyword: 'ecb', label: 'ECB beleid', currencies: ['EUR'], theme: 'rates' },
  { keyword: 'lagarde', label: 'ECB voorzitter', currencies: ['EUR'], theme: 'rates' },
  { keyword: 'european central bank', label: 'ECB beleid', currencies: ['EUR'], theme: 'rates' },
  { keyword: 'bank of england', label: 'BoE beleid', currencies: ['GBP'], theme: 'rates' },
  { keyword: 'boe', label: 'BoE beleid', currencies: ['GBP'], theme: 'rates' },
  { keyword: 'bank of japan', label: 'BoJ beleid', currencies: ['JPY'], theme: 'rates' },
  { keyword: 'boj', label: 'BoJ beleid', currencies: ['JPY'], theme: 'rates' },
  { keyword: 'rba', label: 'RBA beleid', currencies: ['AUD'], theme: 'rates' },
  { keyword: 'rbnz', label: 'RBNZ beleid', currencies: ['NZD'], theme: 'rates' },
  { keyword: 'bank of canada', label: 'BoC beleid', currencies: ['CAD'], theme: 'rates' },
  { keyword: 'snb', label: 'SNB beleid', currencies: ['CHF'], theme: 'rates' },
  { keyword: 'interest rate', label: 'Rentebeleid', currencies: [], theme: 'rates' },
  { keyword: 'rate decision', label: 'Rentebesluit', currencies: [], theme: 'rates' },
  { keyword: 'rate hike', label: 'Renteverhoging', currencies: [], theme: 'rates' },
  { keyword: 'rate cut', label: 'Renteverlaging', currencies: [], theme: 'rates' },
  { keyword: 'hawkish', label: 'Hawkish signaal', currencies: [], theme: 'rates' },
  { keyword: 'dovish', label: 'Dovish signaal', currencies: [], theme: 'rates' },
  { keyword: 'monetary policy', label: 'Monetair beleid', currencies: [], theme: 'rates' },
  { keyword: 'tightening', label: 'Verkrapping', currencies: [], theme: 'rates' },
  { keyword: 'easing', label: 'Verruiming', currencies: [], theme: 'rates' },
  // Inflation
  { keyword: 'inflation', label: 'Inflatie', currencies: [], theme: 'inflation' },
  { keyword: 'cpi', label: 'CPI data', currencies: [], theme: 'inflation' },
  { keyword: 'pce', label: 'PCE inflatie', currencies: ['USD'], theme: 'inflation' },
  { keyword: 'core inflation', label: 'Kerninflatie', currencies: [], theme: 'inflation' },
  // Labor market
  { keyword: 'nonfarm', label: 'NFP arbeidsmarkt', currencies: ['USD'], theme: 'labor' },
  { keyword: 'non-farm', label: 'NFP arbeidsmarkt', currencies: ['USD'], theme: 'labor' },
  { keyword: 'payrolls', label: 'Banenrapport', currencies: ['USD'], theme: 'labor' },
  { keyword: 'unemployment', label: 'Werkloosheid', currencies: [], theme: 'labor' },
  { keyword: 'jobs report', label: 'Banenrapport', currencies: ['USD'], theme: 'labor' },
  // Growth
  { keyword: 'gdp', label: 'BBP groei', currencies: [], theme: 'growth' },
  { keyword: 'recession', label: 'Recessierisico', currencies: [], theme: 'growth' },
  { keyword: 'pmi', label: 'PMI data', currencies: [], theme: 'growth' },
  { keyword: 'manufacturing', label: 'Industrie', currencies: [], theme: 'growth' },
  { keyword: 'retail sales', label: 'Retail data', currencies: [], theme: 'growth' },
  // Bonds & yields
  { keyword: 'treasury', label: 'US Treasuries', currencies: ['USD'], theme: 'rates' },
  { keyword: 'yield', label: 'Obligatierentes', currencies: [], theme: 'rates' },
  { keyword: 'bond', label: 'Obligatiemarkt', currencies: [], theme: 'rates' },
  // FX specific
  { keyword: 'dollar', label: 'USD beweging', currencies: ['USD'], theme: 'rates' },
  { keyword: 'euro', label: 'EUR beweging', currencies: ['EUR'], theme: 'rates' },
  { keyword: 'yen', label: 'JPY beweging', currencies: ['JPY'], theme: 'rates' },
  { keyword: 'pound', label: 'GBP beweging', currencies: ['GBP'], theme: 'rates' },
  { keyword: 'sterling', label: 'GBP beweging', currencies: ['GBP'], theme: 'rates' },
  // Geopolitics
  { keyword: 'tariff', label: 'Handelsbeleid', currencies: ['USD', 'CNY'], theme: 'trade' },
  { keyword: 'trade war', label: 'Handelsoorlog', currencies: ['USD', 'CNY'], theme: 'trade' },
  { keyword: 'sanctions', label: 'Sancties', currencies: [], theme: 'geopolitics' },
  { keyword: 'war', label: 'Conflict', currencies: [], theme: 'geopolitics' },
  { keyword: 'conflict', label: 'Geopolitiek conflict', currencies: [], theme: 'geopolitics' },
  { keyword: 'nato', label: 'NAVO/defensie', currencies: [], theme: 'geopolitics' },
  { keyword: 'china', label: 'China economie', currencies: ['AUD', 'NZD'], theme: 'geopolitics' },
  { keyword: 'russia', label: 'Rusland', currencies: ['EUR'], theme: 'geopolitics' },
  { keyword: 'ukraine', label: 'Oekraïne conflict', currencies: ['EUR'], theme: 'geopolitics' },
  // Risk sentiment
  { keyword: 'risk-off', label: 'Risk-off sentiment', currencies: ['JPY', 'CHF'], theme: 'risk' },
  { keyword: 'risk-on', label: 'Risk-on sentiment', currencies: ['AUD', 'NZD'], theme: 'risk' },
  { keyword: 'safe haven', label: 'Vlucht naar veiligheid', currencies: ['JPY', 'CHF', 'USD'], theme: 'risk' },
  { keyword: 'gold', label: 'Goudprijs', currencies: ['USD'], theme: 'risk' },
  // Energy
  { keyword: 'oil', label: 'Olieprijs', currencies: ['CAD', 'NOK'], theme: 'energy' },
  { keyword: 'crude', label: 'Olieprijs', currencies: ['CAD', 'NOK'], theme: 'energy' },
  { keyword: 'opec', label: 'OPEC productie', currencies: ['CAD'], theme: 'energy' },
  { keyword: 'energy crisis', label: 'Energiecrisis', currencies: ['EUR'], theme: 'energy' },
]

const LOW_RELEVANCE = [
  'crypto', 'bitcoin', 'nft', 'meme', 'celebrity',
  'sports', 'entertainment', 'fashion', 'recipe',
]

function analyzeRelevance(title: string, summary: string): {
  score: number
  tags: string[]
  currencies: string[]
  context: string
} {
  const text = `${title} ${summary}`.toLowerCase()

  for (const keyword of LOW_RELEVANCE) {
    if (text.includes(keyword)) return { score: 0, tags: [], currencies: [], context: '' }
  }

  const matchedTags = new Set<string>()
  const matchedCurrencies = new Set<string>()
  let score = 0

  for (const tag of RELEVANCE_TAGS) {
    if (text.includes(tag.keyword)) {
      score += 1
      matchedTags.add(tag.label)
      tag.currencies.forEach(c => matchedCurrencies.add(c))
    }
  }

  // Build context string
  const tags = Array.from(matchedTags).slice(0, 3)
  const currencies = Array.from(matchedCurrencies).slice(0, 4)
  let context = ''
  if (tags.length > 0) {
    context = tags.join(', ')
    if (currencies.length > 0) {
      context += ` · Raakt ${currencies.join(', ')}`
    }
  }

  return { score, tags, currencies: Array.from(matchedCurrencies), context }
}

/* ─── Article type ─────────────────────────────────────────── */
export interface NewsArticle {
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

/* ─── Translation cache ────────────────────────────────────── */
const translationCache = new Map<string, string>()

async function translateText(text: string): Promise<string> {
  if (!text || text.length < 3) return text
  const cached = translationCache.get(text)
  if (cached) return cached

  try {
    const res = await translate(text, { from: 'en', to: 'nl' })
    const translated = res.text
    translationCache.set(text, translated)
    return translated
  } catch {
    return text // Return original on failure
  }
}

async function translateBatch(texts: string[]): Promise<string[]> {
  // Translate in parallel but with a concurrency limit
  const results: string[] = []
  const batchSize = 5
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const translated = await Promise.all(batch.map(t => translateText(t)))
    results.push(...translated)
  }
  return results
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

  const rawResults: {
    title: string
    summary: string
    fullContent: string
    url: string
    source: string
    category: string
    publishedAt: string
    relevanceScore: number
    relevanceTags: string[]
    affectedCurrencies: string[]
    relevanceContext: string
  }[] = []

  const feedPromises = FEEDS.map(async (source) => {
    try {
      const feed = await parser.parseURL(source.url)
      const items = (feed.items || []).slice(0, 20)

      for (const item of items) {
        const title = item.title?.trim() || ''
        const rawSummary = (item.contentSnippet || item.content || item.summary || '').trim()
        const summary = rawSummary.replace(/<[^>]*>/g, '').slice(0, 300)
        const fullContent = (item.content || item['content:encoded'] || item.summary || rawSummary || '').replace(/<[^>]*>/g, '').slice(0, 2000)
        const analysis = analyzeRelevance(title, summary)

        if (analysis.score >= 1 || (source.priority === 1 && analysis.score >= 0)) {
          rawResults.push({
            title,
            summary: summary.slice(0, 250),
            fullContent: fullContent.slice(0, 1500),
            url: item.link || '',
            source: source.name,
            category: source.category,
            publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
            relevanceScore: analysis.score + (4 - source.priority),
            relevanceTags: analysis.tags,
            affectedCurrencies: analysis.currencies,
            relevanceContext: analysis.context,
          })
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch feed: ${source.name}`, err instanceof Error ? err.message : err)
    }
  })

  await Promise.allSettled(feedPromises)

  // Sort by relevance then date
  rawResults.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  })

  // Deduplicate
  const seen = new Set<string>()
  const deduped = rawResults.filter((article) => {
    const key = article.title.toLowerCase().slice(0, 60)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 40)

  // Translate titles and summaries to Dutch
  const titles = deduped.map(a => a.title)
  const summaries = deduped.map(a => a.summary)

  let translatedTitles: string[]
  let translatedSummaries: string[]
  try {
    [translatedTitles, translatedSummaries] = await Promise.all([
      translateBatch(titles),
      translateBatch(summaries),
    ])
  } catch {
    translatedTitles = titles
    translatedSummaries = summaries
  }

  cachedArticles = deduped.map((article, i) => ({
    id: `${article.source}-${article.url || article.title}`.slice(0, 120),
    ...article,
    titleNl: translatedTitles[i] || article.title,
    summaryNl: translatedSummaries[i] || article.summary,
  }))

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
