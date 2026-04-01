import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Parser from 'rss-parser'
import translate from 'google-translate-api-x'

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'SandersCapital/1.0',
    'Accept': 'application/rss+xml, application/xml, text/xml',
  },
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* ─── RSS Sources ──────────────────────────────────────────── */
interface FeedSource {
  url: string
  name: string
  category: 'central-banks' | 'macro' | 'forex' | 'geopolitics'
  priority: number
}

const FEEDS: FeedSource[] = [
  { url: 'https://www.federalreserve.gov/feeds/press_all.xml', name: 'Federal Reserve', category: 'central-banks', priority: 1 },
  { url: 'https://www.ecb.europa.eu/rss/press.html', name: 'ECB', category: 'central-banks', priority: 1 },
  { url: 'https://www.forexlive.com/feed/', name: 'ForexLive', category: 'forex', priority: 2 },
  { url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', name: 'CNBC Economy', category: 'macro', priority: 2 },
  { url: 'https://feeds.bloomberg.com/markets/news.rss', name: 'Bloomberg Markets', category: 'macro', priority: 2 },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', name: 'NY Times World', category: 'geopolitics', priority: 3 },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', name: 'BBC Business', category: 'macro', priority: 3 },
]

/* ─── Relevance system ─────────────────────────────────────── */
interface RelevanceTag {
  keyword: string
  label: string
  currencies: string[]
}

const RELEVANCE_TAGS: RelevanceTag[] = [
  { keyword: 'federal reserve', label: 'Fed beleid', currencies: ['USD'] },
  { keyword: 'fed ', label: 'Fed beleid', currencies: ['USD'] },
  { keyword: 'fomc', label: 'FOMC besluit', currencies: ['USD'] },
  { keyword: 'powell', label: 'Fed voorzitter', currencies: ['USD'] },
  { keyword: 'ecb', label: 'ECB beleid', currencies: ['EUR'] },
  { keyword: 'lagarde', label: 'ECB voorzitter', currencies: ['EUR'] },
  { keyword: 'european central bank', label: 'ECB beleid', currencies: ['EUR'] },
  { keyword: 'bank of england', label: 'BoE beleid', currencies: ['GBP'] },
  { keyword: 'boe', label: 'BoE beleid', currencies: ['GBP'] },
  { keyword: 'bank of japan', label: 'BoJ beleid', currencies: ['JPY'] },
  { keyword: 'boj', label: 'BoJ beleid', currencies: ['JPY'] },
  { keyword: 'rba', label: 'RBA beleid', currencies: ['AUD'] },
  { keyword: 'rbnz', label: 'RBNZ beleid', currencies: ['NZD'] },
  { keyword: 'bank of canada', label: 'BoC beleid', currencies: ['CAD'] },
  { keyword: 'snb', label: 'SNB beleid', currencies: ['CHF'] },
  { keyword: 'interest rate', label: 'Rentebeleid', currencies: [] },
  { keyword: 'rate decision', label: 'Rentebesluit', currencies: [] },
  { keyword: 'rate hike', label: 'Renteverhoging', currencies: [] },
  { keyword: 'rate cut', label: 'Renteverlaging', currencies: [] },
  { keyword: 'hawkish', label: 'Hawkish signaal', currencies: [] },
  { keyword: 'dovish', label: 'Dovish signaal', currencies: [] },
  { keyword: 'monetary policy', label: 'Monetair beleid', currencies: [] },
  { keyword: 'tightening', label: 'Verkrapping', currencies: [] },
  { keyword: 'easing', label: 'Verruiming', currencies: [] },
  { keyword: 'inflation', label: 'Inflatie', currencies: [] },
  { keyword: 'cpi', label: 'CPI data', currencies: [] },
  { keyword: 'pce', label: 'PCE inflatie', currencies: ['USD'] },
  { keyword: 'core inflation', label: 'Kerninflatie', currencies: [] },
  { keyword: 'nonfarm', label: 'NFP arbeidsmarkt', currencies: ['USD'] },
  { keyword: 'non-farm', label: 'NFP arbeidsmarkt', currencies: ['USD'] },
  { keyword: 'payrolls', label: 'Banenrapport', currencies: ['USD'] },
  { keyword: 'unemployment', label: 'Werkloosheid', currencies: [] },
  { keyword: 'jobs report', label: 'Banenrapport', currencies: ['USD'] },
  { keyword: 'gdp', label: 'BBP groei', currencies: [] },
  { keyword: 'recession', label: 'Recessierisico', currencies: [] },
  { keyword: 'pmi', label: 'PMI data', currencies: [] },
  { keyword: 'manufacturing', label: 'Industrie', currencies: [] },
  { keyword: 'retail sales', label: 'Retail data', currencies: [] },
  { keyword: 'treasury', label: 'US Treasuries', currencies: ['USD'] },
  { keyword: 'yield', label: 'Obligatierentes', currencies: [] },
  { keyword: 'bond', label: 'Obligatiemarkt', currencies: [] },
  { keyword: 'dollar', label: 'USD beweging', currencies: ['USD'] },
  { keyword: 'euro', label: 'EUR beweging', currencies: ['EUR'] },
  { keyword: 'yen', label: 'JPY beweging', currencies: ['JPY'] },
  { keyword: 'pound', label: 'GBP beweging', currencies: ['GBP'] },
  { keyword: 'sterling', label: 'GBP beweging', currencies: ['GBP'] },
  { keyword: 'tariff', label: 'Handelsbeleid', currencies: ['USD'] },
  { keyword: 'trade war', label: 'Handelsoorlog', currencies: ['USD'] },
  { keyword: 'sanctions', label: 'Sancties', currencies: [] },
  { keyword: 'war', label: 'Conflict', currencies: [] },
  { keyword: 'conflict', label: 'Geopolitiek conflict', currencies: [] },
  { keyword: 'china', label: 'China economie', currencies: ['AUD', 'NZD'] },
  { keyword: 'russia', label: 'Rusland', currencies: ['EUR'] },
  { keyword: 'ukraine', label: 'Oekraïne conflict', currencies: ['EUR'] },
  { keyword: 'risk-off', label: 'Risk-off sentiment', currencies: ['JPY', 'CHF'] },
  { keyword: 'risk-on', label: 'Risk-on sentiment', currencies: ['AUD', 'NZD'] },
  { keyword: 'safe haven', label: 'Vlucht naar veiligheid', currencies: ['JPY', 'CHF', 'USD'] },
  { keyword: 'gold', label: 'Goudprijs', currencies: ['USD'] },
  { keyword: 'oil', label: 'Olieprijs', currencies: ['CAD'] },
  { keyword: 'crude', label: 'Olieprijs', currencies: ['CAD'] },
  { keyword: 'opec', label: 'OPEC productie', currencies: ['CAD'] },
  { keyword: 'energy crisis', label: 'Energiecrisis', currencies: ['EUR'] },
]

const LOW_RELEVANCE = ['crypto', 'bitcoin', 'nft', 'meme', 'celebrity', 'sports', 'entertainment', 'fashion', 'recipe']

function analyzeRelevance(title: string, summary: string) {
  const text = `${title} ${summary}`.toLowerCase()
  for (const kw of LOW_RELEVANCE) { if (text.includes(kw)) return { score: 0, tags: [] as string[], currencies: [] as string[], context: '' } }

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

  const tags = Array.from(matchedTags).slice(0, 3)
  const currencies = Array.from(matchedCurrencies).slice(0, 4)
  let context = tags.length > 0 ? tags.join(', ') : ''
  if (context && currencies.length > 0) context += ` · Raakt ${currencies.join(', ')}`

  return { score, tags, currencies: Array.from(matchedCurrencies), context }
}

/* ─── Translation ──────────────────────────────────────────── */
const translationCache = new Map<string, string>()

async function translateText(text: string): Promise<string> {
  if (!text || text.length < 3) return text
  const cached = translationCache.get(text)
  if (cached) return cached
  try {
    const res = await translate(text, { from: 'en', to: 'nl' })
    translationCache.set(text, res.text)
    return res.text
  } catch { return text }
}

async function translateBatch(texts: string[]): Promise<string[]> {
  const results: string[] = []
  const batchSize = 5
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const translated = await Promise.all(batch.map(t => translateText(t)))
    results.push(...translated)
  }
  return results
}

/* ─── Fetch & Store ────────────────────────────────────────── */
let lastFetchTimestamp = 0
const FETCH_INTERVAL = 10 * 60 * 1000

async function fetchAndStoreFeeds(): Promise<void> {
  const now = Date.now()
  if (now - lastFetchTimestamp < FETCH_INTERVAL) return
  lastFetchTimestamp = now

  const newArticles: {
    id: string; title: string; summary: string; full_content: string;
    url: string; source: string; category: string; published_at: string;
    relevance_score: number; relevance_tags: string[];
    affected_currencies: string[]; relevance_context: string;
  }[] = []

  const feedPromises = FEEDS.map(async (source) => {
    try {
      const feed = await parser.parseURL(source.url)
      for (const item of (feed.items || []).slice(0, 25)) {
        const title = item.title?.trim() || ''
        const rawSummary = (item.contentSnippet || item.content || item.summary || '').trim()
        const summary = rawSummary.replace(/<[^>]*>/g, '').slice(0, 400)
        const fullContent = (item.content || item['content:encoded'] || item.summary || rawSummary || '').replace(/<[^>]*>/g, '').slice(0, 2000)
        const analysis = analyzeRelevance(title, summary)

        if (analysis.score >= 1 || (source.priority === 1)) {
          const id = `${source.name.replace(/\s/g, '')}-${Buffer.from(item.guid || item.link || title).toString('base64').slice(0, 40)}`
          newArticles.push({
            id,
            title,
            summary: summary.slice(0, 400),
            full_content: fullContent.slice(0, 2000),
            url: item.link || '',
            source: source.name,
            category: source.category,
            published_at: item.isoDate || item.pubDate || new Date().toISOString(),
            relevance_score: analysis.score + (4 - source.priority),
            relevance_tags: analysis.tags,
            affected_currencies: analysis.currencies,
            relevance_context: analysis.context,
          })
        }
      }
    } catch (err) {
      console.warn(`Feed error: ${source.name}`, err instanceof Error ? err.message : '')
    }
  })

  await Promise.allSettled(feedPromises)

  // Upsert into Supabase (ignore conflicts)
  if (newArticles.length > 0) {
    await supabase.from('news_articles').upsert(newArticles, { onConflict: 'id', ignoreDuplicates: true })
  }

  // Translate new articles that don't have translations yet
  // Also retry articles where title_nl = title (translation might have failed silently)
  const { data: untranslatedNull } = await supabase
    .from('news_articles')
    .select('id, title, summary, full_content')
    .is('title_nl', null)
    .order('published_at', { ascending: false })
    .limit(20)

  // Also find articles where title_nl equals title (English = not actually translated)
  const { data: untranslatedSame } = await supabase
    .from('news_articles')
    .select('id, title, summary, full_content')
    .not('title_nl', 'is', null)
    .order('published_at', { ascending: false })
    .limit(50)

  // Filter to only those where title_nl === title (failed translations)
  const failedTranslations = (untranslatedSame || []).filter(a => a.title_nl === a.title).slice(0, 10)

  const untranslated = [...(untranslatedNull || []), ...failedTranslations]

  if (untranslated && untranslated.length > 0) {
    const titles = untranslated.map(a => a.title)
    const summaries = untranslated.map(a => a.summary || '')
    const contents = untranslated.map(a => (a.full_content || '').slice(0, 800))

    try {
      const [translatedTitles, translatedSummaries, translatedContents] = await Promise.all([
        translateBatch(titles),
        translateBatch(summaries),
        translateBatch(contents),
      ])

      for (let i = 0; i < untranslated.length; i++) {
        await supabase.from('news_articles').update({
          title_nl: translatedTitles[i],
          summary_nl: translatedSummaries[i],
        }).eq('id', untranslated[i].id)
        // Store translated content in summary_nl (we use it in the reader)
        // We concatenate: first summary_nl, then rest of translated content
        if (translatedContents[i] && translatedContents[i] !== translatedSummaries[i]) {
          await supabase.from('news_articles').update({
            summary_nl: translatedSummaries[i],
            // We'll add a full_content_nl field conceptually via the summary_nl + response
          }).eq('id', untranslated[i].id)
        }
      }
    } catch (err) {
      console.warn('Translation batch failed:', err instanceof Error ? err.message : '')
    }
  }
}

/* ─── GET handler ──────────────────────────────────────────── */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const days = parseInt(searchParams.get('days') || '30')

  try {
    // Trigger background fetch & store
    fetchAndStoreFeeds().catch(() => {})

    // Read from DB with date range
    const since = new Date(Date.now() - days * 86400000).toISOString()
    let query = supabase
      .from('news_articles')
      .select('*')
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(100)

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    const { data: articles, error } = await query

    if (error) {
      // Fallback: if table doesn't exist yet, return empty
      console.warn('DB query failed:', error.message)
      return NextResponse.json({ articles: [], fetchedAt: new Date().toISOString() })
    }

    // Map DB columns to frontend format
    const mapped = (articles || []).map(a => ({
      id: a.id,
      title: a.title,
      titleNl: a.title_nl || '',  // Keep empty if not translated — don't fallback to English
      summary: a.summary || '',
      summaryNl: a.summary_nl || '',  // Keep empty if not translated
      fullContent: a.full_content || '',
      url: a.url,
      source: a.source,
      category: a.category,
      publishedAt: a.published_at,
      relevanceScore: a.relevance_score || 0,
      relevanceTags: a.relevance_tags || [],
      affectedCurrencies: a.affected_currencies || [],
      relevanceContext: a.relevance_context || '',
      hasTranslation: !!(a.title_nl && a.title_nl !== a.title),  // True only if actually translated
    }))

    return NextResponse.json({ articles: mapped, fetchedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json({ articles: [], error: 'Failed to fetch news' }, { status: 500 })
  }
}
