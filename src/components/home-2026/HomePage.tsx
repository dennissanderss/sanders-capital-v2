import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import RevealInit from './RevealInit'
import './styles.css'

// ─── icons (inline SVG, no library) ───────────────────────────
const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
const Cross = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 6.5" />
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
      <RevealInit />

      {/* HERO */}
      <section className="hero-show">
        <div className="hero-bg">
          <div className="hero-stars" />
          <div className="hero-cols" />
        </div>
        <div className="wrap hero-2col">
          <div className="hero-left">
            <span className="eyebrow">Educatieve content over financiële markten · Geen financieel advies</span>
            <h1 className="h-display">
              <span className="dim">De wereld van kennis,</span>
              <br />
              discipline en <span className="accent-it">groei.</span>
            </h1>
            <p className="lead">
              Educatieve content over financiële markten. Macro-analyse, gestructureerde kennis en de tools om met discipline te
              handelen. Voor een community die serieus wil leren.
            </p>
            <div className="hero-cta">
              <Link className="btn btn-primary btn-lg btn-pill" href="/premium">Word lid</Link>
              <Link className="btn btn-ghost btn-lg btn-pill" href="/blog">Bekijk artikelen</Link>
            </div>
            <figure className="hero-quote">
              <span className="bar" />
              <div>
                <blockquote>&ldquo;Verwar winnende en verliezende trades niet met goede en slechte trades.&rdquo;</blockquote>
                <figcaption>Jack D. Schwager · Hedge Fund Market Wizards</figcaption>
              </div>
            </figure>
          </div>

          <div className="globe-stage" aria-hidden="true">
            <div className="globe-orb-wrap">
              <div className="globe-orb" />
            </div>
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

      {/* EDGE / MANIFEST */}
      <section className="sec edge-sec">
        <div className="wrap edge-grid">
          <div className="reveal">
            <span className="eyebrow">De aanpak</span>
            <h2 className="edge-title">De markt beweegt op <span className="accent-it">verwachtingen</span>, niet op patronen alleen.</h2>
            <div className="cred">
              <span><b>4+ jaar</b> ervaring</span>
              <span className="cdot" />
              <span><b>Data</b>-gedreven</span>
              <span className="cdot" />
              <span><b>Fundamenteel</b> × technisch</span>
            </div>
          </div>
          <div className="edge-body reveal">
            <p>De meeste traders leren technische analyse en smart money concepts. Nuttig, maar het is de helft van het verhaal. Een chart laat zien <em>wat</em> er is gebeurd, niet <em>waarom</em> de prijs beweegt.</p>
            <p>Valuta&apos;s bewegen op verwachtingen: rente, inflatie, deflatie, groei en het beleid van centrale banken. Verschuift die verwachting, dan verschuift het kapitaal. Wie alleen naar structuur kijkt, handelt op het gevolg en mist de oorzaak.</p>
            <p>Daarom combineer ik fundamentele analyse met techniek. Fundamenteel bepaalt de richting en de overtuiging, techniek bepaalt de timing en het risico. Samen leveren ze een tradeverhaal die ergens op staat.</p>
          </div>
        </div>
      </section>

      {/* METHODE: FUNDAMENTEEL × TECHNISCH */}
      <section className="sec band-dark on-dark">
        <div className="wrap">
          <div className="sec-head center reveal">
            <span className="eyebrow center">De methode</span>
            <h2 className="h2">Twee lagen, één beslissing</h2>
            <p>Geen of-of, maar en-en. De ene laag zegt welke kant op, de andere wanneer.</p>
          </div>
          <div className="combine">
            <div className="combine-card reveal">
              <div className="cc-h">
                <span className="cc-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2.5-6 4 12 2.5-6H21" /></svg>
                </span>
                <span className="cc-step">Laag 01</span>
              </div>
              <h3>Fundamenteel</h3>
              <span className="cc-tag">Het waarom · richting</span>
              <p>Rente, inflatie, groei en centralebankbeleid bepalen welke valuta sterker of zwakker wordt. Dit geeft de bias: met welke stroom je mee wilt.</p>
              <div className="chips">
                <span className="chip">Rente</span><span className="chip">Inflatie</span><span className="chip">Centrale banken</span><span className="chip">Sentiment</span>
              </div>
            </div>

            <div className="combine-op reveal"><span>×</span></div>

            <div className="combine-card reveal">
              <div className="cc-h">
                <span className="cc-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" /></svg>
                </span>
                <span className="cc-step">Laag 02</span>
              </div>
              <h3>Technisch</h3>
              <span className="cc-tag">Het wanneer · timing</span>
              <p>Marktstructuur en smart money concepts bepalen waar en wanneer je instapt, met een vooraf bepaald risico. Dit is de uitvoering van de bias.</p>
              <div className="chips">
                <span className="chip">Structuur</span><span className="chip">Liquiditeit</span><span className="chip">Entries</span><span className="chip">Risico</span>
              </div>
            </div>
          </div>
          <div className="combine-result reveal">
            <span className="cr-eq">=</span>
            <p>Een onderbouwde trade: <b>richting met overtuiging, timing met discipline.</b></p>
          </div>
        </div>
      </section>

      {/* WAAROM TECHNIEK ALLEEN TEKORTSCHIET */}
      <section className="sec">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Het verschil</span>
            <h2 className="h2">Waarom techniek alleen tekortschiet</h2>
            <p>Dezelfde chart, een ander spel. Het verschil zit in het begrijpen van de oorzaak.</p>
          </div>
          <div className="compare">
            <div className="compare-col muted reveal">
              <div className="comp-head"><span className="comp-label">Alleen technisch</span><span className="comp-sub">patronen zonder context</span></div>
              <ul>
                <li><Cross />Handelt op het gevolg, niet op de oorzaak</li>
                <li><Cross />Vecht tegen het nieuws en de data</li>
                <li><Cross />Elke setup voelt even zwaar wegen</li>
                <li><Cross />Geen idee waarom een move doorzet of faalt</li>
              </ul>
            </div>
            <div className="compare-col accent reveal">
              <div className="comp-head"><span className="comp-label">Fundamenteel + technisch</span><span className="comp-sub">richting én timing</span></div>
              <ul>
                <li><Check />Begrijpt waaróm de prijs beweegt</li>
                <li><Check />Handelt met de macro-stroom mee</li>
                <li><Check />Timing op een onderbouwde bias</li>
                <li><Check />Hogere overtuiging, scherper risico</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ARTIKELEN */}
      {hero && (
        <section className="sec" style={{ background: 'var(--paper-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          <div className="wrap">
            <div className="sec-bar reveal">
              <div>
                <span className="eyebrow">Educatie</span>
                <h2 className="h2">Laatste artikelen</h2>
              </div>
              <Link className="btn-link" href="/blog">Alle artikelen <ArrowRight /></Link>
            </div>
            <div className="articles">
              <Link className="article-card reveal" href={`/blog/${hero.slug}`}>
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
                  <Link className="ali reveal" href={`/blog/${a.slug}`} key={a.id}>
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
          <div className="reveal">
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
          <div className="bias-card reveal">
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
          <div className="sec-head reveal">
            <span className="eyebrow">Premium Tools</span>
            <h2 className="h2">Ontdek de tools</h2>
            <p>
              De meeste traders missen geen strategie, ze missen structuur. Geen overzicht van macro data, geen objectieve currency bias,
              geen inzicht in hun eigen performance. Deze tools lossen dat op.
            </p>
          </div>
          <div className="tools-grid">
            <Link className="tool-card reveal" href="/tools/fx-selector/v2">
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
              <p className="sol"><b>Oplossing:</b> automatische fundamentele analyse in 5 stappen: marktregime, nieuws-sentiment, intermarket-signalen, trade-focus filter en concrete trades. Dagelijks vernieuwd.</p>
              <div className="arrow"><span className="btn-link">Naar de tool <ArrowRight /></span></div>
            </Link>
            <Link className="tool-card reveal" href="/tools/fx-analyse">
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
            <Link className="tool-card reveal" href="/tools/execution">
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
              <p className="sol"><b>Oplossing:</b> bewezen technisch timing-model met vaste SL/TP en R:R, automatisch gekoppeld aan de Daily Briefing.</p>
              <div className="arrow"><span className="btn-link">Naar de tool <ArrowRight /></span></div>
            </Link>
            <Link className="tool-card reveal" href="/tools/tradescope">
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

      {/* CTA */}
      <section className="sec-sm cta-band">
        <div className="wrap cta-inner reveal">
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
