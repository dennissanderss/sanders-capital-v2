import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import './styles.css'

// ─── icons (inline SVG, no library) ───────────────────────────
const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" />
  </svg>
)
const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
const ArrowDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
)

// ─── helpers ──────────────────────────────────────────────────
function shortDateNl(iso?: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('nl-NL', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam',
    })
  } catch { return '' }
}

interface ArticleRow {
  id: string
  slug: string
  title: string
  excerpt: string | null
  tag: string | null
  reading_time: number | null
  created_at: string
}

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: articles } = await supabase
    .from('articles')
    .select('id, slug, title, excerpt, tag, reading_time, created_at')
    .eq('published', true)
    .eq('is_premium', false)
    .order('created_at', { ascending: false })
    .limit(4)

  const list: ArticleRow[] = (articles as ArticleRow[] | null) ?? []
  const hero = list[0]
  const more = list.slice(1, 4)

  return (
    <div className="home-2026">
      {/* HERO */}
      <section className="hero-show">
        <div className="hero-bg">
          <div className="hero-stars" />
          <div className="hero-cols" />
          <div className="planet" />
        </div>
        <div className="wrap">
          <div className="inner">
            <span className="rating">
              <span className="lbl">Uitstekend</span>
              <span className="stars">
                <i><StarIcon /></i><i><StarIcon /></i><i><StarIcon /></i><i><StarIcon /></i><i><StarIcon /></i>
              </span>
              <span className="src"><StarIcon />1.240 traders</span>
            </span>
            <h1 className="h-display">
              <span className="dim">Kennis, discipline</span>
              <br />
              en <span className="accent-it">groei.</span>
            </h1>
            <p className="lead">
              Educatieve content over financiële markten. Macro-analyse, gestructureerde kennis en de tools om met discipline te
              handelen. Voor een community die serieus wil leren.
            </p>
            <div className="hero-cta" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link className="btn btn-primary btn-lg btn-pill" href="/premium">Word lid</Link>
              <Link className="btn btn-ghost btn-lg btn-pill" href="/blog">Bekijk artikelen</Link>
            </div>

            <div className="scan">
              <div className="scan-h">
                <span className="spin" />
                <span className="ti">Markten scannen...</span>
              </div>
              <div className="scan-sub">8 valutaparen geanalyseerd · vandaag</div>
              <div className="scan-row">
                <div className="l">
                  <span className="pin" style={{ background: 'linear-gradient(135deg,#e06a52,#b1432f)' }}>E</span>
                  <div>
                    <div className="nm">EUR/USD</div>
                    <div className="mt">Rente-divergentie, zwak EU-sentiment</div>
                  </div>
                </div>
                <span className="scan-tag" style={{ color: 'var(--bear)', background: 'var(--bear-bg)' }}>Bearish</span>
              </div>
              <div className="scan-row">
                <div className="l">
                  <span className="pin" style={{ background: 'linear-gradient(135deg,#5ec488,#3f8f60)' }}>G</span>
                  <div>
                    <div className="nm">GBP/JPY</div>
                    <div className="mt">Carry-momentum, risk-on bias</div>
                  </div>
                </div>
                <span className="scan-tag" style={{ color: 'var(--bull)', background: 'var(--bull-bg)' }}>Bullish</span>
              </div>
              <div className="scan-row">
                <div className="l">
                  <span className="pin" style={{ background: 'linear-gradient(135deg,#4d8df5,#2f6ad0)' }}>A</span>
                  <div>
                    <div className="nm">AUD/USD</div>
                    <div className="mt">Range-rand, geduld geboden</div>
                  </div>
                </div>
                <span className="scan-tag" style={{ color: 'var(--neutral)', background: 'rgba(139,147,160,0.14)' }}>Neutraal</span>
              </div>
              <div className="scan-fade" />
            </div>
          </div>

          <div className="hero-stats">
            <div className="grp">
              <div className="st"><div className="v">1.240</div><div className="k">Leden in de community</div></div>
              <div className="st"><div className="v">3.500+</div><div className="k">Gedeelde analyses</div></div>
              <div className="st"><div className="v">Dagelijks</div><div className="k">Macro-briefing</div></div>
            </div>
            <a className="scrolldown" href="#verder">
              Scroll
              <span className="circ"><ArrowDown /></span>
            </a>
          </div>
        </div>
      </section>
      <span id="verder" />

      {/* VALUE STRIP */}
      <div className="trust">
        <div className="wrap trust-grid">
          <div className="trust-cell"><div className="v">Kennisbank</div><div className="k">Gestructureerde educatie, gratis toegankelijk</div></div>
          <div className="trust-cell"><div className="v">Daily Macro</div><div className="k">Dagelijkse fundamentele analyse</div></div>
          <div className="trust-cell"><div className="v">FX Outlook</div><div className="k">Wekelijkse en maandelijkse macro</div></div>
          <div className="trust-cell"><div className="v">Community</div><div className="k">Leren en sparren op Discord</div></div>
        </div>
      </div>

      {/* PIJLERS */}
      <section className="sec">
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow center">Onze aanpak</span>
            <h2 className="h2">Drie pijlers</h2>
            <p>Een gestructureerde aanpak gebouwd op kennis, discipline en data.</p>
          </div>
          <div className="pillars">
            <div className="pillar">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 5h11a3 3 0 0 1 3 3v11" />
                  <path d="M4 5v14a3 3 0 0 0 3 3h11" />
                  <path d="M8 9h6M8 13h6" />
                </svg>
              </div>
              <span className="pn">01</span>
              <h3>Kennis</h3>
              <p>Diepgaande educatieve content over marktstructuur, technische analyse en fundamentals.</p>
            </div>
            <div className="pillar">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v18" />
                  <path d="M5 8l7-4 7 4" />
                  <path d="M5 8v8l7 4 7-4V8" />
                </svg>
              </div>
              <span className="pn">02</span>
              <h3>Discipline</h3>
              <p>Gestructureerde processen en psychologische frameworks voor consistente besluitvorming.</p>
            </div>
            <div className="pillar">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 17l5-5 4 4 8-8" />
                  <path d="M16 8h5v5" />
                </svg>
              </div>
              <span className="pn">03</span>
              <h3>Groei</h3>
              <p>Data-gedreven evaluatie en continue verbetering van je analytisch vermogen.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ARTIKELEN */}
      {hero && (
        <section className="sec" style={{ background: 'var(--paper-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          <div className="wrap">
            <div className="sec-bar">
              <div>
                <span className="eyebrow">Educatie</span>
                <h2 className="h2">Laatste artikelen</h2>
              </div>
              <Link className="btn-link" href="/blog">Alle artikelen <ArrowRight /></Link>
            </div>
            <div className="articles">
              <Link className="article-card" href={`/blog/${hero.slug}`}>
                <div className="thumb gold">
                  {hero.tag && <span className="tag">{hero.tag}</span>}
                  <span className="glyph">€</span>
                </div>
                <div className="body">
                  <h3>{hero.title}</h3>
                  {hero.excerpt && <p className="ex">{hero.excerpt}</p>}
                  <div className="meta">
                    <span>{shortDateNl(hero.created_at)}</span>
                    {hero.reading_time && <><span className="sep" /><span>{hero.reading_time} min lezen</span></>}
                  </div>
                </div>
              </Link>
              <div className="article-list">
                {more.map((a, i) => (
                  <Link className="ali" href={`/blog/${a.slug}`} key={a.id}>
                    <span className="idx">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <h3>{a.title}</h3>
                      {a.excerpt && <div className="meta">{a.excerpt}</div>}
                      <div className="meta" style={{ marginTop: 6 }}>
                        {shortDateNl(a.created_at)}{a.reading_time ? ` · ${a.reading_time} min` : ''}
                      </div>
                    </div>
                  </Link>
                ))}
                {more.length === 0 && (
                  <div style={{ padding: '32px 0', color: 'var(--ink-3)', fontSize: 13 }}>Meer artikelen binnenkort.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FX OUTLOOK */}
      <section className="sec">
        <div className="wrap outlook-grid">
          <div>
            <span className="eyebrow">Marktanalyse</span>
            <h2 className="h2" style={{ marginTop: 16 }}>FX Outlook</h2>
            <p className="lead" style={{ marginTop: 20 }}>
              Wekelijkse en maandelijkse macro-analyses van de valutamarkt. Van centralebankbeleid tot geopolitieke verschuivingen.
              Begrijp de krachten die valutaparen bewegen en vertaal data naar een onderbouwde visie.
            </p>
            <div className="chips">
              <span className="chip">Marktanalyse</span>
              <span className="chip">Data</span>
              <span className="chip">Strategie</span>
            </div>
            <div style={{ marginTop: 30 }}>
              <Link className="btn btn-primary" href="/blog/fx-outlook">Bekijk FX Outlook</Link>
            </div>
          </div>
          <div className="bias-card">
            <div className="bh">
              <span className="t">Huidige bias</span>
              <span className="disc-note"><span className="dot" />Voorbeeld</span>
            </div>
            <div className="bias-row">
              <span className="pair">EUR/USD</span>
              <svg className="spark" viewBox="0 0 120 30" preserveAspectRatio="none">
                <polyline points="2,8 24,12 46,10 68,18 90,22 118,26" fill="none" stroke="#b1543f" strokeWidth="1.6" />
              </svg>
              <span className="snap-bias bear">Bearish</span>
            </div>
            <div className="bias-row">
              <span className="pair">GBP/JPY</span>
              <svg className="spark" viewBox="0 0 120 30" preserveAspectRatio="none">
                <polyline points="2,24 24,20 46,22 68,12 90,9 118,4" fill="none" stroke="#3f7d54" strokeWidth="1.6" />
              </svg>
              <span className="snap-bias bull">Bullish</span>
            </div>
            <div className="bias-row">
              <span className="pair">AUD/USD</span>
              <svg className="spark" viewBox="0 0 120 30" preserveAspectRatio="none">
                <polyline points="2,16 24,14 46,17 68,15 90,16 118,15" fill="none" stroke="#8a8378" strokeWidth="1.6" />
              </svg>
              <span className="snap-bias neu">Neutraal</span>
            </div>
            <div className="snap-foot">Voorbeeld, geen actueel advies</div>
          </div>
        </div>
      </section>

      {/* TOOLS (dark band) */}
      <section className="sec band-dark on-dark">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Premium Tools</span>
            <h2 className="h2">Ontdek de tools</h2>
            <p>
              De meeste traders missen geen strategie, ze missen structuur. Geen overzicht van macro data, geen objectieve currency bias,
              geen inzicht in hun eigen performance. Deze tools lossen dat op.
            </p>
          </div>
          <div className="tools-grid">
            <Link className="tool-card" href="/tools/fx-selector/v2">
              <div className="th">
                <span className="tname">
                  <span className="ti">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 3h11l4 4v14H5z" /><path d="M16 3v4h4" /><path d="M9 12h7M9 16h7" />
                    </svg>
                  </span>
                  Daily Macro Briefing
                </span>
                <span className="pro-pill">Pro</span>
              </div>
              <p className="prob"><b>Probleem:</b> elke dag macro data verzamelen kost uren en je mist altijd iets.</p>
              <p className="sol"><b>Oplossing:</b> automatische fundamentele analyse in 5 stappen, dagelijks vernieuwd.</p>
              <div className="arrow"><span className="btn-link">Naar de tool <ArrowRight /></span></div>
            </Link>
            <Link className="tool-card" href="/tools/fx-analyse">
              <div className="th">
                <span className="tname">
                  <span className="ti">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
                    </svg>
                  </span>
                  Fundamentals
                </span>
                <span className="pro-pill">Pro</span>
              </div>
              <p className="prob"><b>Probleem:</b> rentetarieven en CB-beleid zijn verspreid over tientallen bronnen.</p>
              <p className="sol"><b>Oplossing:</b> alle rentedata, inflatiecijfers en centrale-bank bias per valuta op één plek.</p>
              <div className="arrow"><span className="btn-link">Naar de tool <ArrowRight /></span></div>
            </Link>
            <Link className="tool-card" href="/tools/execution">
              <div className="th">
                <span className="tname">
                  <span className="ti">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.5 6.5l1.5 1.5M16 16l1.5 1.5M17.5 6.5L16 8M8 16l-1.5 1.5" />
                    </svg>
                  </span>
                  Execution Engine
                </span>
                <span className="pro-pill">Pro</span>
              </div>
              <p className="prob"><b>Probleem:</b> je fundamentele bias is correct maar je weet niet wanneer je moet instappen.</p>
              <p className="sol"><b>Oplossing:</b> bewezen technisch timing-model met vaste SL/TP en R:R, gekoppeld aan de Daily Briefing.</p>
              <div className="arrow"><span className="btn-link">Naar de tool <ArrowRight /></span></div>
            </Link>
            <Link className="tool-card" href="/tools/tradescope">
              <div className="th">
                <span className="tname">
                  <span className="ti">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 5h16v14H4z" /><path d="M4 10h16M9 5v14" />
                    </svg>
                  </span>
                  TradeMind
                </span>
                <span className="pro-pill">Pro</span>
              </div>
              <p className="prob"><b>Probleem:</b> je hebt trades maar geen manier om patronen te zien.</p>
              <p className="sol"><b>Oplossing:</b> trading journal met screenshots, profit-kalender, emotie-tracking en performance-analyse.</p>
              <div className="arrow"><span className="btn-link">Naar de tool <ArrowRight /></span></div>
            </Link>
          </div>
          <div style={{ marginTop: 32 }}>
            <Link className="btn btn-gold" href="/premium">Bekijk alle premium features</Link>
          </div>
        </div>
      </section>

      {/* COMMUNITY */}
      <section className="sec">
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow center">Community</span>
            <h2 className="h2">Je traint niet alleen</h2>
            <p>Duizenden traders, dagelijkse analyses en een plek om te sparren, te leren en scherp te blijven.</p>
          </div>
          <div className="comm-stats">
            <div className="comm-stat"><div className="v">1.240</div><div className="k">Leden in de community</div></div>
            <div className="comm-stat"><div className="v">86</div><div className="k">Online op dit moment</div></div>
            <div className="comm-stat"><div className="v">3.500+</div><div className="k">Gedeelde analyses &amp; setups</div></div>
          </div>
          <div className="testi-grid">
            <div className="testi">
              <p className="q">De dagelijkse briefing geeft me structuur. Ik begin niet meer blanco aan mijn dag, maar met een helder beeld van het regime.</p>
              <div className="who">
                <span className="av" style={{ background: 'linear-gradient(135deg,#3551e6,#7c3aed)' }}>SK</span>
                <div><div className="nm">Sven K.</div><div className="rl">Lid sinds 2024</div></div>
              </div>
            </div>
            <div className="testi">
              <p className="q">Eindelijk een community die over proces praat in plaats van over winst. De educatie is gewoon goed opgebouwd.</p>
              <div className="who">
                <span className="av" style={{ background: 'linear-gradient(135deg,#0f9d6a,#14b8a6)' }}>MV</span>
                <div><div className="nm">Marit V.</div><div className="rl">Lid sinds 2025</div></div>
              </div>
            </div>
            <div className="testi">
              <p className="q">De journal en de feedback van anderen hebben me geleerd waar ik echt geld liet liggen. Discipline boven hype.</p>
              <div className="who">
                <span className="av" style={{ background: 'linear-gradient(135deg,#f59e0b,#c2410c)' }}>RJ</span>
                <div><div className="nm">Rick J.</div><div className="rl">Lid sinds 2023</div></div>
              </div>
            </div>
          </div>
          <p className="disc-note" style={{ justifyContent: 'center', display: 'flex', marginTop: 22 }}>
            <span className="dot" />Community-stemmen ter illustratie.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="sec-sm cta-band">
        <div className="wrap cta-inner">
          <div>
            <h2>Begin met een solide fundament</h2>
            <p>Start gratis met de kennisbank, of ontdek wat de premium tools voor je structuur en discipline doen.</p>
          </div>
          <div className="cta-actions">
            <Link className="btn btn-primary btn-lg" href="/premium">Premium ontdekken</Link>
            <a className="btn btn-ghost btn-lg" href="https://discord.gg/g8m3rryCRv" target="_blank" rel="noopener noreferrer">
              Join de community
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
