import { createClient } from '@supabase/supabase-js'

const BASE = 'https://sanderscapital.nl'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  // Fetch latest dates for each sub-sitemap
  const sb = getSupabase()

  const [{ data: latestArticle }, { data: latestKb }] = await Promise.all([
    sb.from('articles').select('updated_at').eq('published', true).order('updated_at', { ascending: false }).limit(1).single(),
    sb.from('kennisbank_items').select('updated_at').order('updated_at', { ascending: false }).limit(1).single(),
  ])

  const now = new Date().toISOString()
  const postMod = latestArticle?.updated_at || now
  const kbMod = latestKb?.updated_at || now

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap-style.xsl"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE}/page-sitemap.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE}/post-sitemap.xml</loc>
    <lastmod>${postMod}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE}/kennisbank-sitemap.xml</loc>
    <lastmod>${kbMod}</lastmod>
  </sitemap>
</sitemapindex>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  })
}
