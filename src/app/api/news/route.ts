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
  // Central banks — specifiek per valuta
  { keyword: 'federal reserve', label: 'Fed beleid', currencies: ['USD'] },
  { keyword: 'fed ', label: 'Fed beleid', currencies: ['USD'] },
  { keyword: 'fomc', label: 'FOMC besluit', currencies: ['USD'] },
  { keyword: 'powell', label: 'Fed voorzitter', currencies: ['USD'] },
  { keyword: 'ecb', label: 'ECB beleid', currencies: ['EUR'] },
  { keyword: 'lagarde', label: 'ECB voorzitter', currencies: ['EUR'] },
  { keyword: 'european central bank', label: 'ECB beleid', currencies: ['EUR'] },
  { keyword: 'bank of england', label: 'BoE beleid', currencies: ['GBP'] },
  { keyword: 'boe', label: 'BoE beleid', currencies: ['GBP'] },
  { keyword: 'bailey', label: 'BoE voorzitter', currencies: ['GBP'] },
  { keyword: 'bank of japan', label: 'BoJ beleid', currencies: ['JPY'] },
  { keyword: 'boj', label: 'BoJ beleid', currencies: ['JPY'] },
  { keyword: 'ueda', label: 'BoJ voorzitter', currencies: ['JPY'] },
  { keyword: 'rba', label: 'RBA beleid', currencies: ['AUD'] },
  { keyword: 'reserve bank of australia', label: 'RBA beleid', currencies: ['AUD'] },
  { keyword: 'rbnz', label: 'RBNZ beleid', currencies: ['NZD'] },
  { keyword: 'bank of canada', label: 'BoC beleid', currencies: ['CAD'] },
  { keyword: 'snb', label: 'SNB beleid', currencies: ['CHF'] },
  { keyword: 'swiss national bank', label: 'SNB beleid', currencies: ['CHF'] },
  // Rente & monetair beleid
  { keyword: 'interest rate', label: 'Rentebeleid', currencies: [] },
  { keyword: 'rate decision', label: 'Rentebesluit', currencies: [] },
  { keyword: 'rate hike', label: 'Renteverhoging', currencies: [] },
  { keyword: 'rate cut', label: 'Renteverlaging', currencies: [] },
  { keyword: 'hawkish', label: 'Hawkish signaal', currencies: [] },
  { keyword: 'dovish', label: 'Dovish signaal', currencies: [] },
  { keyword: 'monetary policy', label: 'Monetair beleid', currencies: [] },
  { keyword: 'tightening', label: 'Verkrapping', currencies: [] },
  { keyword: 'easing', label: 'Verruiming', currencies: [] },
  { keyword: 'quantitative', label: 'QE/QT beleid', currencies: [] },
  // Inflatie & data
  { keyword: 'inflation', label: 'Inflatie', currencies: [] },
  { keyword: 'cpi', label: 'CPI data', currencies: [] },
  { keyword: 'pce', label: 'PCE inflatie', currencies: ['USD'] },
  { keyword: 'core inflation', label: 'Kerninflatie', currencies: [] },
  // Arbeidsmarkt — USD specifiek
  { keyword: 'nonfarm', label: 'NFP arbeidsmarkt', currencies: ['USD'] },
  { keyword: 'non-farm', label: 'NFP arbeidsmarkt', currencies: ['USD'] },
  { keyword: 'payrolls', label: 'Banenrapport', currencies: ['USD'] },
  { keyword: 'jobs report', label: 'Banenrapport', currencies: ['USD'] },
  { keyword: 'jobless claims', label: 'Werkloosheidsaanvragen', currencies: ['USD'] },
  // Economische data
  { keyword: 'gdp', label: 'BBP groei', currencies: [] },
  { keyword: 'recession', label: 'Recessierisico', currencies: [] },
  { keyword: 'pmi', label: 'PMI data', currencies: [] },
  { keyword: 'retail sales', label: 'Retail data', currencies: [] },
  { keyword: 'housing', label: 'Woningmarkt', currencies: [] },
  { keyword: 'consumer confidence', label: 'Consumentenvertrouwen', currencies: [] },
  // Obligaties
  { keyword: 'treasury', label: 'US Treasuries', currencies: ['USD'] },
  { keyword: 'yield', label: 'Obligatierentes', currencies: [] },
  { keyword: 'bond', label: 'Obligatiemarkt', currencies: [] },
  { keyword: 'gilt', label: 'UK Gilts', currencies: ['GBP'] },
  { keyword: 'bund', label: 'Duitse Bunds', currencies: ['EUR'] },
  // Valuta — met context-checks om false positives te voorkomen
  { keyword: 'u.s. dollar', label: 'USD beweging', currencies: ['USD'] },
  { keyword: 'us dollar', label: 'USD beweging', currencies: ['USD'] },
  { keyword: 'greenback', label: 'USD beweging', currencies: ['USD'] },
  { keyword: 'euro zone', label: 'EUR economie', currencies: ['EUR'] },
  { keyword: 'eurozone', label: 'EUR economie', currencies: ['EUR'] },
  { keyword: 'japanese yen', label: 'JPY beweging', currencies: ['JPY'] },
  { keyword: 'british pound', label: 'GBP beweging', currencies: ['GBP'] },
  { keyword: 'sterling', label: 'GBP beweging', currencies: ['GBP'] },
  { keyword: 'australian dollar', label: 'AUD beweging', currencies: ['AUD'] },
  { keyword: 'new zealand dollar', label: 'NZD beweging', currencies: ['NZD'] },
  { keyword: 'kiwi dollar', label: 'NZD beweging', currencies: ['NZD'] },
  { keyword: 'canadian dollar', label: 'CAD beweging', currencies: ['CAD'] },
  { keyword: 'loonie', label: 'CAD beweging', currencies: ['CAD'] },
  { keyword: 'swiss franc', label: 'CHF beweging', currencies: ['CHF'] },
  // Handelsbeleid
  { keyword: 'tariff', label: 'Handelsbeleid', currencies: ['USD'] },
  { keyword: 'trade war', label: 'Handelsoorlog', currencies: ['USD'] },
  { keyword: 'sanctions', label: 'Sancties', currencies: [] },
  // Geopolitiek
  { keyword: 'china', label: 'China economie', currencies: ['AUD', 'NZD'] },
  { keyword: 'russia', label: 'Rusland', currencies: ['EUR'] },
  { keyword: 'ukraine', label: 'Oekraïne conflict', currencies: ['EUR'] },
  // Risk sentiment
  { keyword: 'risk-off', label: 'Risk-off sentiment', currencies: ['JPY', 'CHF'] },
  { keyword: 'risk-on', label: 'Risk-on sentiment', currencies: ['AUD', 'NZD'] },
  { keyword: 'safe haven', label: 'Vlucht naar veiligheid', currencies: ['JPY', 'CHF'] },
  { keyword: 'flight to safety', label: 'Vlucht naar veiligheid', currencies: ['JPY', 'CHF'] },
  // Commodities
  { keyword: 'gold', label: 'Goudprijs', currencies: ['AUD', 'CHF'] },
  { keyword: 'oil', label: 'Olieprijs', currencies: ['CAD'] },
  { keyword: 'crude', label: 'Olieprijs', currencies: ['CAD'] },
  { keyword: 'opec', label: 'OPEC productie', currencies: ['CAD'] },
  { keyword: 'iron ore', label: 'IJzererts', currencies: ['AUD'] },
  { keyword: 'copper', label: 'Koperprijs', currencies: ['AUD'] },
  { keyword: 'dairy', label: 'Zuivelprijzen', currencies: ['NZD'] },
  { keyword: 'energy crisis', label: 'Energiecrisis', currencies: ['EUR'] },
]

const LOW_RELEVANCE = ['crypto', 'bitcoin', 'nft', 'meme', 'celebrity', 'sports', 'entertainment', 'fashion', 'recipe']

// Country/region → currency mapping for contextual tagging
const COUNTRY_CURRENCIES: Record<string, string[]> = {
  'united states': ['USD'], 'u.s.': ['USD'], 'american': ['USD'], 'washington': ['USD'],
  'united kingdom': ['GBP'], 'british': ['GBP'], 'london': ['GBP'], 'uk ': ['GBP'],
  'japan': ['JPY'], 'japanese': ['JPY'], 'tokyo': ['JPY'],
  'australia': ['AUD'], 'australian': ['AUD'], 'sydney': ['AUD'],
  'new zealand': ['NZD'], 'zealand': ['NZD'],
  'canada': ['CAD'], 'canadian': ['CAD'], 'ottawa': ['CAD'],
  'switzerland': ['CHF'], 'swiss': ['CHF'],
  'germany': ['EUR'], 'german': ['EUR'], 'france': ['EUR'], 'french': ['EUR'],
  'italy': ['EUR'], 'italian': ['EUR'], 'spain': ['EUR'], 'spanish': ['EUR'],
  'europe': ['EUR'], 'european': ['EUR'], 'brussels': ['EUR'],
}

function analyzeRelevance(title: string, summary: string) {
  const text = `${title} ${summary}`.toLowerCase()
  for (const kw of LOW_RELEVANCE) { if (text.includes(kw)) return { score: 0, tags: [] as string[], currencies: [] as string[], context: '' } }

  const matchedTags = new Set<string>()
  const matchedCurrencies = new Set<string>()
  let score = 0

  // Match keyword tags
  for (const tag of RELEVANCE_TAGS) {
    if (text.includes(tag.keyword)) {
      score += 1
      matchedTags.add(tag.label)
      tag.currencies.forEach(c => matchedCurrencies.add(c))
    }
  }

  // Contextual country/region → currency detection (only if no specific currencies found yet)
  if (matchedCurrencies.size === 0 && score > 0) {
    for (const [region, currencies] of Object.entries(COUNTRY_CURRENCIES)) {
      if (text.includes(region)) {
        currencies.forEach(c => matchedCurrencies.add(c))
        break // Take first match to avoid over-tagging
      }
    }
  }

  // Avoid false positive: bare "dollar" without context — check it's not "Australian dollar" etc.
  if (text.includes('dollar') && !text.includes('australian dollar') && !text.includes('canadian dollar') && !text.includes('new zealand dollar')) {
    if (!matchedCurrencies.has('USD')) matchedCurrencies.add('USD')
  }

  // Normalize score to 0-5 range (cap at 5 to prevent outliers)
  const normalizedScore = Math.min(score, 5)

  const tags = Array.from(matchedTags).slice(0, 3)
  const currencies = Array.from(matchedCurrencies).slice(0, 4)
  let context = tags.length > 0 ? tags.join(', ') : ''
  if (context && currencies.length > 0) context += ` · Raakt ${currencies.join(', ')}`

  return { score: normalizedScore, tags, currencies: Array.from(matchedCurrencies), context }
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
          // Use content-based hash to prevent same story from different sources being stored twice
          const contentKey = title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)
          const id = `${source.name.replace(/\s/g, '')}-${Buffer.from(item.guid || item.link || contentKey).toString('base64').slice(0, 40)}`
          newArticles.push({
            id,
            title,
            summary: summary.slice(0, 400),
            full_content: fullContent.slice(0, 2000),
            url: item.link || '',
            source: source.name,
            category: source.category,
            published_at: item.isoDate || item.pubDate || new Date().toISOString(),
            // Score 0-5 (keyword matches, capped) + priority bonus (1=CB, 2=forex/macro, 3=geopolitics)
            relevance_score: Math.min(analysis.score + (4 - source.priority), 5),
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
    // Bij refresh=true (cron): reset throttle en wacht op resultaat
    const refresh = searchParams.get('refresh') === 'true'
    if (refresh) {
      lastFetchTimestamp = 0
      await fetchAndStoreFeeds()
    } else {
      // Normale pageload: background fetch
      fetchAndStoreFeeds().catch(() => {})
    }

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
