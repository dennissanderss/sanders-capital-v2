import type { Metadata } from 'next'
import Link from 'next/link'
import FadeIn from '@/components/FadeIn'

export const metadata: Metadata = {
  title: 'Introductie — Sanders Capital FX System',
  description: 'Van fundamentele bias tot optimale entry: het complete Sanders Capital FX trading systeem uitgelegd van A tot Z.',
}

/* ─── Components ──────────────────────────────────────────────── */
function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/[0.06] bg-bg-card overflow-hidden ${className}`}>{children}</div>
}

function SectionHead({ badge, badgeColor, title, sub }: { badge: string; badgeColor: string; title: string; sub?: string }) {
  return (
    <div className="px-5 sm:px-6 py-4 border-b border-white/[0.04]">
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
            Een geïntegreerd systeem dat <strong className="text-text-muted">fundamentele macro-analyse</strong> combineert met een <strong className="text-text-muted">bewezen technisch timing model</strong> voor forex trading. Van marktregime tot concrete entry — volledig transparant en onderbouwd.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <Link href="/tools/fx-selector/v2" className="px-6 py-2.5 rounded-xl bg-accent/20 border border-accent/30 text-sm text-accent-light hover:bg-accent/30 transition-colors font-medium">
              Open Daily Briefing
            </Link>
            <Link href="/tools/execution" className="px-6 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-400 hover:bg-green-500/20 transition-colors font-medium">
              Open Execution Engine
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* ═══ SYSTEEM FLOW ═══ */}
      <FadeIn>
        <Section>
          <SectionHead badge="Overzicht" badgeColor="text-white bg-white/10" title="Hoe werkt het systeem?" sub="Drie lagen die samen één beslissing vormen" />
          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5 relative">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-green-400 bg-green-500/15 px-2 py-0.5 rounded">Laag 2</span>
                  <span className="text-sm font-semibold text-heading">Execution Engine</span>
                </div>
                <p className="text-[10px] text-text-dim leading-relaxed mb-2">
                  Neemt de concrete trades en bepaalt het <strong className="text-text-muted">optimale instapmoment</strong> op basis van een bewezen mean reversion timing model.
                </p>
                <div className="text-[9px] text-green-400/60 space-y-0.5">
                  <p>&rsaquo; Checkt momentum zone (pips tegen bias)</p>
                  <p>&rsaquo; Wacht op 1H reversal candle</p>
                  <p>&rsaquo; Geeft entry, SL ({'\u0034\u0030'}p) en TP ({'\u0031\u0032\u0030'}p)</p>
                </div>
                <div className="hidden sm:block absolute top-1/2 -right-2 text-green-400/20 text-lg font-bold">&rsaquo;</div>
              </div>

              {/* Laag 3 */}
              <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded">Laag 3</span>
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

            <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
              <p className="text-[10px] text-text-dim">
                <strong className="text-text-muted">Hiërarchie:</strong> Fundamentals bepalen de richting &rarr; Execution bepaalt het timing &rarr; TradeMind meet het resultaat.
                De fundamentele laag is altijd leidend — de technische laag kan een trade nooit forceren als de fundamentals &ldquo;geen trade&rdquo; zeggen.
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
              { n: '4', t: 'Trade Focus', d: 'Filtert 21 paren door 4 criteria: score \u22652.0, IM >50%, contrarian prijsbeweging (5d) en duidelijke richting. Alleen paren die alle 4 passeren worden concrete trades.', c: 'text-gold' },
              { n: '5', t: 'Concrete Trades', d: 'De paren die alle filters passeren. Inclusief call datum/tijd, richting, score en overtuiging. Elk wordt automatisch getracked in het live trackrecord.', c: 'text-purple-400' },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`text-xs font-bold ${s.c} bg-white/[0.05] w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5`}>{s.n}</span>
                <div>
                  <p className="text-sm font-semibold text-heading">{s.t}</p>
                  <p className="text-[10px] text-text-dim leading-relaxed mt-0.5">{s.d}</p>
                </div>
              </div>
            ))}

            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                { v: '56%', l: 'Winrate', s: '434 trades' },
                { v: '21', l: 'Paren', s: '8 valuta\'s' },
                { v: '1 dag', l: 'Hold', s: 'Dagkoers NY close' },
                { v: 'Live', l: 'Trackrecord', s: 'Auto-updated' },
              ].map((m, i) => (
                <div key={i} className="p-2 rounded-lg bg-white/[0.02]">
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

      {/* ═══ EXECUTION ENGINE ═══ */}
      <FadeIn>
        <Section>
          <SectionHead badge="Tool 2" badgeColor="text-green-400 bg-green-500/15" title="Execution Engine" sub="Van fundamentele bias naar optimale entry" />
          <div className="p-5 sm:p-6 space-y-4">
            <p className="text-[10px] text-text-dim leading-relaxed">
              De Execution Engine neemt de concrete trades uit de Daily Macro Briefing en voegt daar een <strong className="text-text-muted">bewezen technisch timing model</strong> aan toe. Het model is gebaseerd op analyse van 434 fundamentele trades met echte Yahoo Finance prijsdata (intraday high/low).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              {[
                { n: '1', t: 'Concrete Trade', d: 'De briefing levert een pair met richting en score', c: 'text-accent-light', bg: 'bg-accent/5 border-accent/15' },
                { n: '2', t: 'Momentum Check', d: 'Is de prijs 30-120p tegen de bias bewogen?', c: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/15' },
                { n: '3', t: '1H Reversal', d: 'Wacht op een reversal candle op de 1H chart', c: 'text-purple-400', bg: 'bg-purple-500/5 border-purple-500/15' },
                { n: '4', t: 'Entry + SL/TP', d: 'SL 40p, TP 120p, RR 1:3, niet aanraken', c: 'text-green-400', bg: 'bg-green-500/5 border-green-500/15' },
              ].map((s, i) => (
                <div key={i} className={`p-3 rounded-xl border ${s.bg} relative`}>
                  <span className={`text-[10px] font-bold ${s.c}`}>Stap {s.n}</span>
                  <p className="text-[10px] font-semibold text-heading mt-0.5">{s.t}</p>
                  <p className="text-[9px] text-text-dim mt-0.5">{s.d}</p>
                  {i < 3 && <div className="hidden sm:block absolute top-1/2 -right-2 text-text-dim/20 text-lg">&rsaquo;</div>}
                </div>
              ))}
            </div>

            {/* 3 modellen */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { n: 'Selective', wr: '62.4%', pf: '4.98', wk: '2.5', tr: 117 },
                { n: 'Balanced', wr: '61.7%', pf: '4.83', wk: '3.6', tr: 167 },
                { n: 'Aggressive', wr: '58.0%', pf: '4.15', wk: '5.6', tr: 262 },
              ].map((m, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-[10px] font-semibold text-heading">{m.n}</p>
                  <p className="text-lg font-mono font-bold text-green-400">{m.wr}</p>
                  <p className="text-[8px] text-text-dim">PF {m.pf} · {m.wk}/week · {m.tr} trades</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <Link href="/tools/execution" className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-400 hover:bg-green-500/20 transition-colors">
                Open Execution Engine &rarr;
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
                  <p>Score = CB beleid (&times;2) + renteverschil (&times;1.5) + nieuws bonus (&plusmn;1.5). Geoptimaliseerd over 434 trades en 2.100 configuraties. Bewezen winrate: 56%.</p>
                </div>
                <div>
                  <p className="text-text-muted font-semibold mb-1">Technisch timing model</p>
                  <p>Gebaseerd op MAE/MFE analyse van echte intraday high/low data (Yahoo Finance) voor 434 trades. Ontdekking: trades met 30-120 pips momentum tegen de bias hebben 62% winrate met PF 4.98.</p>
                </div>
                <div>
                  <p className="text-text-muted font-semibold mb-1">Waarom mean reversion?</p>
                  <p>Backtesting toont aan dat kopen wanneer de prijs tijdelijk tegen de fundamentals ingaat een significant hogere winrate oplevert dan trend-following. De 5-daags contrarian filter is de sterkste edge in het systeem.</p>
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
                { n: '3', t: 'Open de Execution Engine', d: 'Hier zie je dezelfde concrete trades met hun momentum status. Groen = entry ready, amber = wacht op momentum.', href: '/tools/execution' },
                { n: '4', t: 'Kies je model (Selective/Balanced/Aggressive)', d: 'Bepaalt hoeveel trades per week je wilt. Selective = minder maar hogere WR. Aggressive = meer trades.', href: '/tools/execution' },
                { n: '5', t: 'Open de 1H chart bij een groen pair', d: 'Wacht op een reversal candle in de richting van je bias. Entry op de close van die candle.', href: null },
                { n: '6', t: 'Zet SL en TP', d: 'Stop loss: 40 pips. Take profit: 120 pips. Risk/reward: 1:3. Laat de trade lopen — niet aanraken.', href: null },
                { n: '7', t: 'Log in TradeMind', d: 'Registreer je trade met entry, SL, TP, screenshots en notities. Analyseer later je performance.', href: '/tools/tradescope' },
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
            <Link href="/tools/execution" className="px-6 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-400 hover:bg-green-500/20 transition-colors font-medium">
              Execution Engine
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
          Sanders Capital FX System · Fundamentele bias (56% WR) + Technisch timing (58-62% WR, PF 4-5) · 21 paren · 8 valuta&apos;s · Geen financieel advies · Past performance is geen garantie voor toekomstige resultaten
        </p>
      </div>
    </div>
  )
}
