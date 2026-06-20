import type { Metadata } from 'next'
import Link from 'next/link'
import FadeIn from '@/components/FadeIn'

export const metadata: Metadata = {
  title: 'Introductie — Sanders Capital FX System',
  description: 'Van marktregime tot concrete trade: de Sanders Capital Daily Macro Briefing uitgelegd van A tot Z.',
}

/* ─── Components ──────────────────────────────────────────────── */
function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-black/[0.08] bg-bg-card overflow-hidden ${className}`}>{children}</div>
}

function SectionHead({ badge, badgeColor, title, sub }: { badge: string; badgeColor: string; title: string; sub?: string }) {
  return (
    <div className="px-5 sm:px-6 py-4 border-b border-black/[0.08]">
      <div className="flex items-center gap-2.5">
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${badgeColor}`}>{badge}</span>
        <h2 className="text-base sm:text-lg font-display font-bold text-heading">{title}</h2>
      </div>
      {sub && <p className="text-[11px] text-text-dim mt-1 ml-[3.25rem]">{sub}</p>}
    </div>
  )
}

/* ─── Main page ─────────────────────────────────────────────── */
export default function IntroductionPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

      {/* ═══ HERO ═══ */}
      <FadeIn>
        <div className="text-center py-8">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent-light/50 mb-2">Sanders Capital</p>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-heading mb-3">
            FX Trading System
          </h1>
          <p className="text-sm text-text-dim max-w-2xl mx-auto leading-relaxed">
            Een geïntegreerd systeem dat <strong className="text-text-muted">fundamentele macro-analyse</strong> vertaalt naar concrete valutaparen — van marktregime tot een handvol onderbouwde calls per dag. Volledig transparant en met een live trackrecord.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Link href="/tools/fx-selector/v2" className="px-6 py-2.5 rounded-xl bg-accent/20 border border-accent/30 text-sm text-accent-light hover:bg-accent/30 transition-colors font-medium">
              Open Daily Briefing
            </Link>
            <Link href="/tools/tradescope" className="px-6 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-sm text-purple-400 hover:bg-purple-500/20 transition-colors font-medium">
              Open TradeMind
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* ═══ SYSTEEM FLOW ═══ */}
      <FadeIn>
        <Section>
          <SectionHead badge="Overzicht" badgeColor="text-[#0c1626] bg-[rgba(12,22,38,0.06)]" title="Hoe werkt het systeem?" sub="Twee lagen die samen één beslissing vormen" />
          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Laag 1 */}
              <div className="p-4 rounded-xl border border-accent/20 bg-accent/5 relative">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-accent-light bg-accent/15 px-2 py-0.5 rounded">Laag 1</span>
                  <span className="text-sm font-semibold text-heading">Fundamentele Bias</span>
                </div>
                <p className="text-[10px] text-text-dim leading-relaxed mb-2">
                  De <strong className="text-text-muted">Daily Macro Briefing</strong> analyseert 21 valutaparen op basis van centraal bankbeleid, renteverschillen, nieuws sentiment en intermarket signalen.
                </p>
                <div className="text-[9px] text-accent-light/60 space-y-0.5">
                  <p>&rsaquo; Bepaalt de <strong>richting</strong> (bullish/bearish)</p>
                  <p>&rsaquo; Filtert door 4 criteria (score, IM, contrarian, richting)</p>
                  <p>&rsaquo; Levert <strong>concrete trades</strong> op</p>
                </div>
                <div className="hidden sm:block absolute top-1/2 -right-2 text-accent-light/20 text-lg font-bold">&rsaquo;</div>
              </div>

              {/* Laag 2 */}
              <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded">Laag 2</span>
                  <span className="text-sm font-semibold text-heading">TradeMind</span>
                </div>
                <p className="text-[10px] text-text-dim leading-relaxed mb-2">
                  Log je trades, analyseer je performance en leer van je fouten met een volledig trading journal.
                </p>
                <div className="text-[9px] text-purple-400/60 space-y-0.5">
                  <p>&rsaquo; Trade journal met screenshots</p>
                  <p>&rsaquo; Profit kalender + equity curve</p>
                  <p>&rsaquo; Emotie &amp; discipline tracking</p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-[rgba(12,22,38,0.03)] border border-black/[0.08] text-center">
              <p className="text-[10px] text-text-dim">
                <strong className="text-text-muted">Hiërarchie:</strong> De Daily Macro Briefing bepaalt de richting &rarr; TradeMind meet het resultaat.
                De fundamentele laag is altijd leidend — als de fundamentals &ldquo;geen trade&rdquo; zeggen, is er geen call.
              </p>
            </div>
          </div>
        </Section>
      </FadeIn>

      {/* ═══ DAILY MACRO BRIEFING ═══ */}
      <FadeIn>
        <Section>
          <SectionHead badge="Tool 1" badgeColor="text-accent-light bg-accent/15" title="Daily Macro Briefing" sub="Fundamentele analyse in 5 stappen" />
          <div className="p-5 sm:p-6 space-y-4">
            {[
              { n: '1', t: 'Marktregime', d: 'Classificeert het macro klimaat: Risk-Off, Risk-On, USD Dominant, USD Zwak of Gemengd. Gebaseerd op centraal bankbeleid van 8 valuta\'s.', c: 'text-accent-light' },
              { n: '2', t: 'Nieuws Sentiment', d: 'Analyseert headlines uit 7 bronnen (Fed, ECB, ForexLive, CNBC etc.) en berekent een sentiment score per valuta. Recent nieuws weegt zwaarder.', c: 'text-green-400' },
              { n: '3', t: 'Intermarket Signalen', d: 'Checkt of VIX, S&P500, Gold, US Yields, Oil en DXY het regime bevestigen. Alignment boven 50% = regime bevestigd.', c: 'text-amber-400' },
              { n: '4', t: 'Trade Focus', d: 'Filtert 21 paren door 4 criteria: score ≥2.0, IM >50%, contrarian prijsbeweging (5d) en duidelijke richting. Alleen paren die alle 4 passeren worden concrete trades.', c: 'text-gold' },
              { n: '5', t: 'Concrete Trades', d: 'De paren die alle filters passeren. Inclusief call datum/tijd, richting, score en overtuiging. Elk wordt automatisch getracked in het live trackrecord.', c: 'text-purple-400' },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`text-xs font-bold ${s.c} bg-[rgba(12,22,38,0.04)] w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5`}>{s.n}</span>
                <div>
                  <p className="text-sm font-semibold text-heading">{s.t}</p>
                  <p className="text-[10px] text-text-dim leading-relaxed mt-0.5">{s.d}</p>
                </div>
              </div>
            ))}

            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                { v: '56%', l: 'Winrate', s: '400 trades' },
                { v: '21', l: 'Paren', s: '8 valuta\'s' },
                { v: '1 dag', l: 'Hold', s: 'Dagkoers NY close' },
                { v: 'Live', l: 'Trackrecord', s: 'Auto-updated' },
              ].map((m, i) => (
                <div key={i} className="p-2 rounded-lg bg-[rgba(12,22,38,0.03)]">
                  <p className="text-lg font-mono font-bold text-heading">{m.v}</p>
                  <p className="text-[8px] text-text-dim">{m.l}</p>
                  <p className="text-[7px] text-text-dim/50">{m.s}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <Link href="/tools/fx-selector/v2" className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-accent/15 border border-accent/25 text-sm text-accent-light hover:bg-accent/25 transition-colors">
                Open Daily Macro Briefing &rarr;
              </Link>
            </div>
          </div>
        </Section>
      </FadeIn>

      {/* ═══ VALIDATIE ═══ */}
      <FadeIn>
        <Section>
          <SectionHead badge="Validatie" badgeColor="text-amber-400 bg-amber-500/15" title="Hoe is dit onderbouwd?" sub="Transparante methodiek en databronnen" />
          <div className="p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px] text-text-dim">
              <div className="space-y-3">
                <div>
                  <p className="text-text-muted font-semibold mb-1">Fundamentele scoring (Model B)</p>
                  <p>Score = CB beleid (&times;2) + renteverschil (&times;1.5) + nieuws bonus (&plusmn;1.5). Geoptimaliseerd over 400 trades en 2.100 configuraties. Bewezen winrate: 56%.</p>
                </div>
                <div>
                  <p className="text-text-muted font-semibold mb-1">Intermarket &amp; contrarian filter</p>
                  <p>Een call wordt alleen entry-ready bij intermarket-bevestiging (alignment &gt;50%) en een contrarian prijsbeweging over 5 dagen. Deze filters zijn historisch de sterkste edge in de scoring.</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-text-muted font-semibold mb-1">Databronnen</p>
                  <div className="space-y-1">
                    {[
                      ['CB beleid & rente', 'Supabase DB, bijgewerkt na CB vergaderingen'],
                      ['Nieuws', '7 RSS bronnen (Fed, ECB, ForexLive, CNBC, Bloomberg, BBC, NYT)'],
                      ['Intermarket', 'Yahoo Finance (VIX, S&P, Gold, US10Y, Oil, DXY)'],
                      ['FX koersen', 'Yahoo Finance (21 paren, dagelijks + intraday)'],
                      ['Trackrecord', '434+ trades, live bijgewerkt via cron job'],
                    ].map(([k, v]) => (
                      <p key={k}><strong className="text-text-muted">{k}:</strong> {v}</p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-text-muted font-semibold mb-1">Wat dit systeem NIET doet</p>
                  <div className="space-y-0.5 text-red-400/60">
                    <p>&times; Geen garantie op winst — past performance ≠ future results</p>
                    <p>&times; Geen automatische orderuitvoering</p>
                    <p>&times; Geen financieel advies</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>
      </FadeIn>

      {/* ═══ HOEGEBRUIKEN ═══ */}
      <FadeIn>
        <Section>
          <SectionHead badge="Gebruik" badgeColor="text-purple-400 bg-purple-500/15" title="Stap-voor-stap gebruiken" />
          <div className="p-5 sm:p-6">
            <div className="space-y-3">
              {[
                { n: '1', t: 'Open de Daily Macro Briefing', d: 'Bekijk het marktregime, valutascores en concrete trades van vandaag. Dit is je fundamentele kompas.', href: '/tools/fx-selector/v2' },
                { n: '2', t: 'Bekijk de concrete trades', d: 'In Stap 5 van de briefing staan de paren die alle 4 filters passeren. Dit zijn je kandidaten.', href: '/tools/fx-selector/v2' },
                { n: '3', t: 'Lees de redenering per call', d: 'Klap een entry-ready call open voor regime-bijdrage, nieuws-sentiment, intermarket-bevestiging en de score-opbouw.', href: '/tools/fx-selector/v2' },
                { n: '4', t: 'Bepaal je eigen entry en risk', d: 'De briefing geeft richting en overtuiging. De entry, stop en positiegrootte bepaal je binnen je eigen risicokader.', href: null },
                { n: '5', t: 'Log in TradeMind', d: 'Registreer je trade met entry, SL, TP, screenshots en notities. Analyseer later je performance.', href: '/tools/tradescope' },
              ].map((s) => (
                <div key={s.n} className="flex items-start gap-3">
                  <span className="text-xs font-bold text-accent-light bg-accent/10 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5">{s.n}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-heading">{s.t}</p>
                    <p className="text-[10px] text-text-dim mt-0.5">{s.d}</p>
                  </div>
                  {s.href && (
                    <Link href={s.href} className="text-[9px] text-accent-light/50 hover:text-accent-light shrink-0 mt-1">Open &rarr;</Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Section>
      </FadeIn>

      {/* ═══ CTA ═══ */}
      <FadeIn>
        <div className="text-center py-6 space-y-3">
          <p className="text-sm text-text-dim">Klaar om te beginnen?</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/tools/fx-selector/v2" className="px-6 py-2.5 rounded-xl bg-accent/20 border border-accent/30 text-sm text-accent-light hover:bg-accent/30 transition-colors font-medium">
              Daily Macro Briefing
            </Link>
            <Link href="/tools/tradescope" className="px-6 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-sm text-purple-400 hover:bg-purple-500/20 transition-colors font-medium">
              TradeMind
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* Disclaimer */}
      <div className="text-center pb-6">
        <p className="text-[8px] text-text-dim/30 max-w-lg mx-auto">
          Sanders Capital FX System · Fundamentele bias (56% WR) · 21 paren · 8 valuta&apos;s · Geen financieel advies · Past performance is geen garantie voor toekomstige resultaten
        </p>
      </div>
    </div>
  )
}
