import { createClient } from '@supabase/supabase-js'

const BASE = 'https://sanderscapital.nl'

export const revalidate = 3600 // revalidate every hour

export async function GET() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: articles } = await sb
    .from('articles')
    .select('slug, title, updated_at, created_at, content')
    .eq('published', true)
    .order('created_at', { ascending: false })

  const urls = (articles || []).map(a => {
    const lastmod = a.updated_at || a.created_at || new Date().toISOString()
    // Extract first image from HTML content for image sitemap
    const imgMatch = a.content?.match(/<img[^>]+src="([^"]+)"/)
    const imageTag = imgMatch
      ? `\n    <image:image>
      <image:loc>${imgMatch[1]}</image:loc>
      <image:title>${escapeXml(a.title)}</image:title>
    </image:image>`
      : ''

    return `  <url>
    <loc>${BASE}/blog/${a.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${imageTag}
  </url>`
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap-style.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  })
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
