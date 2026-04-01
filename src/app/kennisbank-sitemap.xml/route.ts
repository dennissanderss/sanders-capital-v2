import { createClient } from '@supabase/supabase-js'

const BASE = 'https://sanderscapital.nl'

export const revalidate = 3600

export async function GET() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: items } = await sb
    .from('kennisbank_items')
    .select('slug, title, updated_at, created_at')
    .order('created_at', { ascending: false })

  const urls = (items || []).map(k => {
    const lastmod = k.updated_at || k.created_at || new Date().toISOString()
    return `  <url>
    <loc>${BASE}/kennisbank/${k.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
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
