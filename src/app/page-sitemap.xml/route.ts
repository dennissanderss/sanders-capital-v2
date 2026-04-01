const BASE = 'https://sanderscapital.nl'

interface SitemapEntry {
  loc: string
  lastmod: string
  changefreq: string
  priority: number
}

const staticPages: SitemapEntry[] = [
  { loc: '/',                    lastmod: new Date().toISOString(), changefreq: 'weekly',  priority: 1.0 },
  { loc: '/blog',               lastmod: new Date().toISOString(), changefreq: 'daily',   priority: 0.9 },
  { loc: '/blog/fx-outlook',    lastmod: new Date().toISOString(), changefreq: 'weekly',  priority: 0.8 },
  { loc: '/nieuws',             lastmod: new Date().toISOString(), changefreq: 'daily',   priority: 0.8 },
  { loc: '/kennisbank',         lastmod: new Date().toISOString(), changefreq: 'weekly',  priority: 0.9 },
  { loc: '/kennisbank/begrippen', lastmod: new Date().toISOString(), changefreq: 'monthly', priority: 0.7 },
  { loc: '/premium',            lastmod: new Date().toISOString(), changefreq: 'monthly', priority: 0.8 },
  { loc: '/over',               lastmod: new Date().toISOString(), changefreq: 'monthly', priority: 0.5 },
  { loc: '/contact',            lastmod: new Date().toISOString(), changefreq: 'monthly', priority: 0.5 },
  { loc: '/tools',              lastmod: new Date().toISOString(), changefreq: 'weekly',  priority: 0.7 },
  { loc: '/tools/fx-analyse',   lastmod: new Date().toISOString(), changefreq: 'weekly',  priority: 0.7 },
  { loc: '/tools/fx-selector',  lastmod: new Date().toISOString(), changefreq: 'daily',   priority: 0.7 },
  { loc: '/tools/tradescope',   lastmod: new Date().toISOString(), changefreq: 'weekly',  priority: 0.7 },
  { loc: '/tools/kalender',     lastmod: new Date().toISOString(), changefreq: 'daily',   priority: 0.7 },
  { loc: '/tools/rente',        lastmod: new Date().toISOString(), changefreq: 'daily',   priority: 0.7 },
  { loc: '/tools/calculator',   lastmod: new Date().toISOString(), changefreq: 'monthly', priority: 0.6 },
  { loc: '/disclaimer',         lastmod: new Date().toISOString(), changefreq: 'yearly',  priority: 0.3 },
  { loc: '/voorwaarden',        lastmod: new Date().toISOString(), changefreq: 'yearly',  priority: 0.3 },
  { loc: '/voorwaarden-discord', lastmod: new Date().toISOString(), changefreq: 'yearly', priority: 0.3 },
]

export async function GET() {
  const urls = staticPages.map(p => `  <url>
    <loc>${BASE}${p.loc}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')

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
