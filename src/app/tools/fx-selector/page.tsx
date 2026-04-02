import type { Metadata } from 'next'
import Link from 'next/link'
import FadeIn from '@/components/FadeIn'

export const metadata: Metadata = {
  title: 'Daily Macro Briefing | Introductie | Sanders Capital',
  description: 'Ontdek hoe de Daily Macro Briefing werkt: van macro regime tot trade focus, volledig transparant uitgelegd.',
}

/* ─── Step card component ───────────────────────────────────── */
function StepCard({
  step,
  title,
  problem,
  solution,
  details,
  color,
}: {
  step: number
  title: string
  problem: string
  solution: string
  details: string[]
  color: 'blue' | 'green' | 'gold' | 'purple' | 'amber'
}) {
  const colorMap = {
    blue: {
      badge: 'bg-accent/15 text-accent-light border-accent/25',
      border: 'border-accent/15 hover:border-accent/25',
      glow: 'from-accent/5',
      dot: 'bg-accent-light',
    },
    green: {
      badge: 'bg-green-500/15 text-green-400 border-green-500/25',
      border: 'border-green-500/15 hover:border-green-500/25',
      glow: 'from-green-500/5',
      dot: 'bg-green-400',
    },
    gold: {
      badge: 'bg-gold-dim text-gold border-gold/25',
      border: 'border-gold/15 hover:border-gold/25',
      glow: 'from-gold/5',
      dot: 'bg-gold',
    },
    purple: {
      badge: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
      border: 'border-purple-500/15 hover:border-purple-500/25',
      glow: 'from-purple-500/5',
      dot: 'bg-purple-400',
    },
    amber: {
      badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
      border: 'border-amber-500/15 hover:border-amber-500/25',
      glow: 'from-amber-500/5',
      dot: 'bg-amber-400',
    },
  }
  const c = colorMap[color]

  return (
    <div className={`relative rounded-2xl border ${c.border} bg-bg-card overflow-hidden transition-all duration-300`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${c.glow} to-transparent pointer-events-none`} />
      <div className="relative px-6 sm:px-8 py-6 sm:py-8">
        {/* Step badge */}
        <div className="flex items-center gap-3 mb-5">
          <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border text-sm font-bold font-display ${c.badge}`}>
            {step}
          </span>
          <h3 className="text-xl sm:text-2xl font-display font-bold text-heading">{title}</h3>
        </div>

        {/* Problem → Solution */}
        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          <div className="rounded-xl bg-red-500/[0.04] border border-red-500/10 px-4 py-3">
            <p className="text-[10px] font-semibold text-red-400/80 uppercase tracking-wider mb-1">Het probleem</p>
            <p className="text-sm text-text leading-relaxed">{problem}</p>
          </div>
          <div className="rounded-xl bg-green-500/[0.04] border border-green-500/10 px-4 py-3">
            <p className="text-[10px] font-semibold text-green-400/80 uppercase tracking-wider mb-1">Onze oplossing</p>
            <p className="text-sm text-text leading-relaxed">{solution}</p>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2">
          {details.map((detail, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot} mt-1.5 shrink-0`} />
              <p className="text-sm text-text-muted leading-relaxed">{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Data source card ──────────────────────────────────────── */
function SourceCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-card px-4 py-3 flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 text-accent-light">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-heading">{title}</p>
        <p className="text-xs text-text-muted mt-0.5">{desc}</p>
      </div>
    </div>
  )
}

/* ─── Main page ─────────────────────────────────────────────── */
export default function DailyBriefingIntroPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10 sm:py-16">
      {/* Hero */}
      <FadeIn>
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent-light text-xs font-medium mb-5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            Premium Tool
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-bold text-heading leading-tight mb-4">
            Daily Macro Briefing
          </h1>
          <p className="text-xs font-mono text-purple-400/80 mb-3">v3.0 — Edge Extraction Engine</p>
          <p className="text-lg sm:text-xl text-text-muted max-w-2xl mx-auto leading-relaxed">
            Elke dag in 60 seconden weten waar de markt staat, welke valuta sterk of zwak is,
            en waar jouw beste trade setups liggen. Sub-regime classificatie, 7-factor scoring,
            pair-specifieke intermarket analyse en 5-categorie signaaloutput — in één overzicht.
          </p>
          <div className="mt-8">
            <Link
              href="/tools/fx-selector/tool"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent/15 border border-accent/30 text-accent-light font-semibold hover:bg-accent/25 transition-all shadow-sm shadow-accent/10"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Open de Tool
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* The Problem */}
      <FadeIn>
        <div className="rounded-2xl border border-border bg-gradient-to-b from-bg-card to-bg-elevated px-6 sm:px-8 py-6 sm:py-8 mb-10 sm:mb-14">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-heading mb-4 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </span>
            Waarom deze tool?
          </h2>
          <div className="space-y-3 text-text leading-relaxed">
            <p>
              De meeste traders beginnen hun dag met tientallen tabs open: nieuwswebsites,
              economische kalenders, Twitter, en willekeurige YouTube-analyses. Ze proberen een beeld
              te vormen van &quot;waar de markt naartoe gaat&quot;, maar eindigen met <strong className="text-heading">information overload</strong> en
              tegenstrijdige signalen.
            </p>
            <p>
              Het resultaat? Je opent een trade zonder duidelijke bias, zonder te weten of je
              <strong className="text-heading"> met of tegen de fundamentele stroom in gaat</strong>, en zonder context over
              wat vandaag de markt kan bewegen.
            </p>
            <p className="text-accent-light font-medium">
              De Daily Macro Briefing v3.0 lost dit op met een gelaagde Edge Extraction Engine.
            </p>
          </div>
        </div>
      </FadeIn>

      {/* Four Steps */}
      <div className="space-y-6 sm:space-y-8 mb-10 sm:mb-14">
        <FadeIn>
          <StepCard
            step={1}
            title="Sub-Regime Classificatie"
            color="blue"
            problem="Je weet niet of de markt in risk-on, risk-off of een dollargevoelige fase zit. Je tradet AUD/JPY long terwijl de markt in paniek is."
            solution="Het model classificeert de markt in 6 sub-regimes op basis van CB beleid + intermarket data. Dit bepaalt welke factoren het zwaarst wegen."
            details={[
              'Zes sub-regimes: Growth Scare (groeiangst), Geopolitical Stress (VIX spike + goud), Inflation Fear (stijgende yields + olie), Rate Repricing (snelle yield bewegingen), Risk Appetite (aandelen up, VIX laag), Range Chop (geen driver).',
              'Elk sub-regime heeft eigen gewichten: bij inflation_fear telt CB beleid en inflatiedata 2x zo zwaar. Bij geopolitical_stress domineert haven flow en sentiment.',
              'De engine bepaalt eerst het sub-regime, en herberekent daarna alle currency scores met de juiste gewichten. Zo past de analyse zich aan de marktomgeving aan.',
              'Regime confidence geeft aan hoe duidelijk de signalen zijn. Hoe hoger, hoe betrouwbaarder de analyse.',
            ]}
          />
        </FadeIn>

        <FadeIn>
          <StepCard
            step={2}
            title="7-Factor Currency Scoring"
            color="green"
            problem="Je hebt geen overzicht van welke valuta fundamenteel sterk of zwak is. Traditionele modellen kijken alleen naar rente — maar in een inflation scare telt inflatiedata veel zwaarder."
            solution="Elke valuta wordt gescoord op 7 factoren, met gewichten die automatisch verschuiven per sub-regime. De sterkste en zwakste valuta's worden objectief bepaald."
            details={[
              'Factor 1 — CB Beleid: hawkish/dovish bias van de centrale bank + rente vs target. Dit is de basis.',
              'Factor 2 — Inflatie: CPI/PPI data uit de economische kalender. Hoger dan verwacht = hawkish druk.',
              'Factor 3 — Groei: GDP, PMI, employment data. Sterke groei = valuta ondersteund.',
              'Factor 4 — Sentiment: Nieuws headlines worden geanalyseerd op bullish/bearish impact per valuta.',
              'Factor 5 — Commodity: Olie en goud impact. CAD volgt olie (0.9 sensitivity), AUD volgt goud (0.8).',
              'Factor 6 — Haven: Safe-haven flows. JPY (0.9), CHF (0.8) profiteren van risk-off. AUD/NZD (-0.7) lijden.',
              'Factor 7 — Momentum: 5-daagse prijsrichting als contrarian filter (mean reversion).',
              'De gewichten per factor worden bepaald door het sub-regime. In range_chop wegen fundamentals licht, in rate_repricing weegt CB beleid 2x.',
            ]}
          />
        </FadeIn>

        <FadeIn>
          <StepCard
            step={3}
            title="Pair-Specifieke Intermarket"
            color="amber"
            problem="Je tradet forex in isolatie. Standaard modellen gebruiken dezelfde intermarket check voor alle paren — maar USD/CAD reageert op olie, USD/JPY op yields."
            solution="Elk van de 21 paren heeft een eigen intermarket gewichtstabel. Het model checkt per paar welke instrumenten relevant zijn en hoeveel ze meewegen."
            details={[
              'USD/CAD: olie weegt 45%, yields 20%, S&P 15%. Stijgende olie = sterker CAD = pair daalt.',
              'USD/JPY: yields wegen 40%, S&P 25%, VIX 20%. Stijgende yields = pair stijgt.',
              'AUD/USD: S&P 25%, goud 25%, olie 20%. Risk-on markten = pair stijgt.',
              'EUR/USD: DXY 35%, yields 25%, S&P 20%. Stijgende DXY = pair daalt.',
              'Per instrument wordt gecheckt: bevestigt de richting de fundamentele bias van het paar? Alignment 0-100%.',
              'Bij alignment < 30% (sterke tegenspraak) kan een signaal geblokkeerd worden. Bij > 70% stijgt de overtuiging.',
            ]}
          />
        </FadeIn>

        <FadeIn>
          <StepCard
            step={4}
            title="5-Categorie Signaal Output"
            color="gold"
            problem="Je opent TradingView en zoekt willekeurig door 28 forex paren. Je weet niet waar je moet focussen en mist de beste setups."
            solution="Elk van de 21 paren krijgt een van 5 signaalcategorieën, gefilterd op tradeability. De top 5 paren worden automatisch geselecteerd als Trade Focus."
            details={[
              'Bullish Trend: fundamenteel sterk + prijs beweegt al in de juiste richting. Meegaan met de stroom.',
              'Bullish Mean Reversion: fundamenteel sterk + prijs is de afgelopen 5 dagen gedaald. Contrarian: koop de dip.',
              'Bearish Trend: fundamenteel zwak + prijs daalt al. Short met de trend mee.',
              'Bearish Mean Reversion: fundamenteel zwak + prijs is de afgelopen 5 dagen gestegen. Contrarian: verkoop de rally.',
              'No Trade: geen duidelijk fundamenteel verschil, of tradeability filter blokkeert (te ver uitgelopen, event risk, intermarket conflict).',
              'Tradeability filter checkt 3 dingen: (1) is de prijs niet te ver uitgelopen (extension > 2× ATR), (2) staat er een high-impact event op de kalender, (3) bevestigt intermarket de richting.',
              'Trade Focus selecteert max 5 paren met de hoogste conviction, max 2 per valuta om concentratierisico te beperken.',
              'Bij elk paar zie je signaalcategorie, conviction score, tradeability status, intermarket alignment % en pricemomentum.',
            ]}
          />
        </FadeIn>
      </div>

      {/* Mean Reversion Visual */}
      <FadeIn>
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-b from-purple-500/[0.04] to-transparent px-6 sm:px-8 py-6 sm:py-8 mb-10 sm:mb-14 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/[0.04] rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </span>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-heading">
                Mean Reversion — de kern van het model
              </h2>
            </div>
            <p className="text-sm text-text-muted leading-relaxed mb-6">
              De Daily Macro Briefing gebruikt geen momentum strategie (kopen omdat de prijs stijgt).
              In plaats daarvan past het model <strong className="text-heading">contrarian mean reversion</strong> toe:
              het wacht tot de prijs tijdelijk <em>tegen</em> de fundamentele richting ingaat en tradet dan de terugkeer.
              De V3 engine ondersteunt ook trend-signalen, maar de optimizer bevestigde dat contrarian het sterkst is.
            </p>

            {/* Visual diagram */}
            <div className="flex flex-col items-center mb-6">
              <p className="text-[10px] uppercase tracking-[0.15em] text-text-dim font-medium mb-4">Visueel voorbeeld — Contrarian Mean Reversion</p>
              <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
                <div className="p-3 sm:p-4 rounded-xl bg-green-500/10 border border-green-500/15 text-center min-w-[90px]">
                  <p className="text-[10px] text-text-dim mb-1">Fundamenteel</p>
                  <p className="text-base sm:text-lg font-bold text-green-400">Bullish</p>
                  <p className="text-[9px] text-text-dim mt-0.5">7-factor score hoog</p>
                </div>
                <span className="text-2xl text-text-dim font-mono">+</span>
                <div className="p-3 sm:p-4 rounded-xl bg-red-500/10 border border-red-500/15 text-center min-w-[90px]">
                  <p className="text-[10px] text-text-dim mb-1">Prijs (5 dagen)</p>
                  <p className="text-base sm:text-lg font-bold text-red-400">↓ Dalend</p>
                  <p className="text-[9px] text-text-dim mt-0.5">korte dip</p>
                </div>
                <span className="text-2xl text-text-dim font-mono">=</span>
                <div className="p-3 sm:p-4 rounded-xl bg-accent/10 border border-accent/20 text-center min-w-[90px]">
                  <p className="text-[10px] text-text-dim mb-1">Signaal</p>
                  <p className="text-base sm:text-lg font-bold text-accent-light">LONG</p>
                  <p className="text-[9px] text-green-400 mt-0.5">bullish MR</p>
                </div>
              </div>
            </div>

            {/* Optimizer results */}
            <div className="rounded-xl bg-purple-500/[0.06] border border-purple-500/15 p-4 mb-6">
              <p className="text-[10px] font-semibold text-purple-400/80 uppercase tracking-wider mb-2">Optimizer resultaten — 1.260 configuraties getest</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-heading font-mono">56%</p>
                  <p className="text-[10px] text-text-dim">Win Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-heading font-mono">190</p>
                  <p className="text-[10px] text-text-dim">Trades / jaar</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-green-400 font-mono">+2.423</p>
                  <p className="text-[10px] text-text-dim">Pips totaal</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-heading font-mono">PF 1.42</p>
                  <p className="text-[10px] text-text-dim">Profit Factor</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm text-text-muted leading-relaxed">
              <p>
                <strong className="text-heading">Gedachtegang:</strong> De 7-factor score bepaalt de fundamentele richting van een valuta.
                Als de prijs de afgelopen 5 dagen tegen die richting ingaat, is dat een <em>reversal-kans</em>.
                Je koopt niet wanneer iedereen al koopt — je koopt wanneer de markt een dip maakt.
              </p>
              <p>
                <strong className="text-heading">Waarom werkt dit?</strong> Optimalisatie over 1.260 configuraties (momentum, contrarian, lookback 2-5d, hold 1-2d, 3 scoring modellen)
                toonde aan dat de contrarian strategie met 5-daagse lookback, 1-dag hold en intermarket bevestiging het sterkst presteert:
                56% winrate, PF 1.42, +2.423 pips over 190 trades. Momentum (kopen omdat het stijgt) scoorde consistent het slechtst.
              </p>
              <p>
                <strong className="text-heading">Holding periode:</strong> 1 handelsdag. De entry is de dagkoers op de signaaldag,
                de exit is de dagkoers 1 handelsdag later. Dit is geoptimaliseerd voor daily traders met minimale
                blootstelling aan overnight event risk.
              </p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Connection to Macro Fundamentals */}
      <FadeIn>
        <div className="rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/[0.06] via-bg-card to-accent/[0.03] px-6 sm:px-8 py-6 sm:py-8 mb-10 sm:mb-14 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/[0.04] rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </span>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-heading">
                De rode draad: Macro Fundamentals
              </h2>
            </div>
            <div className="space-y-3 text-sm text-text-muted leading-relaxed">
              <p>
                De Daily Macro Briefing is <strong className="text-heading">direct gekoppeld</strong> aan de{' '}
                <Link href="/tools/rentetarieven" className="text-accent-light hover:underline font-medium">
                  Macro Fundamentals
                </Link>{' '}
                tool. Alle rentetarieven, inflatiecijfers en centrale bank bias die je daar ziet, vormen de{' '}
                <strong className="text-heading">databron</strong> achter de currency scores in deze tool.
              </p>
              <p>
                Wanneer een centrale bank haar beleid wijzigt (bijv. een renteverhoging of hawkish toonverandering),
                wordt dit eerst bijgewerkt in Macro Fundamentals. De Daily Macro Briefing pakt deze data automatisch op
                en herberekent de scores. Zo werken beide tools als <strong className="text-heading">één systeem</strong>.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/tools/rentetarieven"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-heading hover:bg-white/[0.08] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                Bekijk Macro Fundamentals
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <div className="flex items-center gap-2 text-[11px] text-text-dim">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light/50">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                Macro Fundamentals → Currency Scores → Trade Focus
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Data Sources */}
      <FadeIn>
        <div className="mb-10 sm:mb-14">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-heading mb-5 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </span>
            Databronnen
          </h2>
          <p className="text-sm text-text-muted mb-4 leading-relaxed">
            Volledige transparantie: dit zijn de bronnen die het model gebruikt. Geen black box.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <SourceCard
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>}
              title="Centrale Bank Data"
              desc="Rente, target, bias en vergaderdata per bank. Handmatig bijgewerkt uit officiële statements (Fed, ECB, BoE, BoJ, RBA, RBNZ, BoC, SNB)."
            />
            <SourceCard
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
              title="Economische Kalender"
              desc="High-impact events van ForexFactory/FairEconomy. CPI, NFP, rentebeslissingen — met forecast, previous en context per event."
            />
            <SourceCard
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /></svg>}
              title="Nieuws Sentiment"
              desc="Actuele financiële headlines worden geanalyseerd op impact per valuta. Hawkish of dovish sentiment wordt als bonus (max ±2.0) meegewogen in de currency score."
            />
            <SourceCard
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
              title="Intermarket Data (Pair-Specifiek)"
              desc="DXY, US10Y, goud, S&P 500, VIX en olie via Yahoo Finance. Elk paar heeft eigen gewichten: USD/CAD weegt olie 45%, USD/JPY weegt yields 40%."
            />
            <SourceCard
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>}
              title="Yahoo Finance (Dagkoers + Intermarket)"
              desc="Dagkoersen voor alle 21 paren + intermarket instrumenten (DXY, US10Y, goud, S&P, VIX, olie). Trackrecord: dagkoers signaaldag vs. 3 handelsdagen later."
            />
          </div>
        </div>
      </FadeIn>

      {/* How to use */}
      <FadeIn>
        <div className="rounded-2xl border border-accent/15 bg-gradient-to-b from-accent/[0.04] to-transparent px-6 sm:px-8 py-6 sm:py-8 mb-10 sm:mb-14">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-heading mb-5 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
            </span>
            Hoe gebruik je het?
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-xs font-bold text-accent-light shrink-0 mt-0.5">1</span>
              <div>
                <p className="text-sm font-semibold text-heading">Check het Sub-Regime</p>
                <p className="text-sm text-text-muted mt-0.5">Begin bovenaan. In welk sub-regime zit de markt? Growth scare, geopolitical stress, inflation fear, rate repricing, risk appetite of range chop? Dit bepaalt welke factoren het zwaarst wegen.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-xs font-bold text-accent-light shrink-0 mt-0.5">2</span>
              <div>
                <p className="text-sm font-semibold text-heading">Bekijk de Currency Scores (7 factoren)</p>
                <p className="text-sm text-text-muted mt-0.5">Welke valuta scoort het hoogst op de 7-factor analyse? De gewichten zijn automatisch aangepast aan het sub-regime. Klik op een valuta voor de volledige factoronderbouwing.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-xs font-bold text-accent-light shrink-0 mt-0.5">3</span>
              <div>
                <p className="text-sm font-semibold text-heading">Check het V3 Edge Engine Panel</p>
                <p className="text-sm text-text-muted mt-0.5">Bekijk de signaalverdeling: hoeveel paren zijn tradeable, conditional of no-trade? De top signalen tonen categorie (trend/mean reversion), conviction en intermarket alignment.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-xs font-bold text-accent-light shrink-0 mt-0.5">4</span>
              <div>
                <p className="text-sm font-semibold text-heading">Bekijk de Pair-Specifieke Intermarket</p>
                <p className="text-sm text-text-muted mt-0.5">Elk paar heeft een eigen intermarket gewichtstabel. Bij alignment &gt; 70% stijgt de overtuiging, bij &lt; 30% wordt het signaal mogelijk geblokkeerd. Klik op een paar voor details.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-xs font-bold text-accent-light shrink-0 mt-0.5">5</span>
              <div>
                <p className="text-sm font-semibold text-heading">Focus op de Trade Focus paren</p>
                <p className="text-sm text-text-muted mt-0.5">De engine selecteert max 5 paren met de hoogste conviction. Kijk naar de signaalcategorie (bullish/bearish, trend/MR) en pas je eigen strategie toe in die richting. Hold = 3 handelsdagen.</p>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Important disclaimer */}
      <FadeIn>
        <div className="rounded-2xl border border-border bg-bg-card px-6 sm:px-8 py-6 sm:py-8 mb-10">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-heading mb-4 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            Belangrijk om te weten
          </h2>
          <div className="space-y-3 text-sm text-text-muted leading-relaxed">
            <p>
              <strong className="text-heading">Dit is geen handelssignaal.</strong> De Daily Macro Briefing geeft je een fundamentele bias: de richting
              waarin de macro-data wijst. Het is aan jou om je technische entry te vinden en je risicomanagement toe te passen.
            </p>
            <p>
              <strong className="text-heading">Fundamentelen bewegen langzaam.</strong> De bias verandert pas als een centrale bank haar toon aanpast,
              niet bij elke nieuwskop. Daarom kan dezelfde bias weken achtereen gelden.
            </p>
            <p>
              <strong className="text-heading">Events kunnen de bias tijdelijk overrulen.</strong> Een verrassende CPI-print of
              onverwachte renteverlaging kan de markt tegen de fundamentele bias in bewegen. Check altijd de kalender.
            </p>
            <p>
              <strong className="text-heading">Het trackrecord is transparant.</strong> We meten of de bias klopte via een contrarian mean reversion model (dagkoers op signaaldag → dagkoers 3 handelsdagen later).
              Elke trade bevat de signaalcategorie, conviction score en sub-regime. Geen cherry-picking.
            </p>
          </div>
        </div>
      </FadeIn>

      {/* CTA */}
      <FadeIn>
        <div className="text-center">
          <Link
            href="/tools/fx-selector/tool"
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-accent/15 border border-accent/30 text-accent-light font-semibold text-lg hover:bg-accent/25 transition-all shadow-sm shadow-accent/10"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Open Daily Macro Briefing
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </FadeIn>
    </div>
  )
}
