import type { Metadata } from 'next'
import Link from 'next/link'
import FadeIn from '@/components/FadeIn'

export const metadata: Metadata = {
  title: 'Daily Macro Briefing | Introductie | Sanders Capital',
  description: 'Ontdek hoe de Daily Macro Briefing werkt: van macro regime tot trade focus, volledig transparant uitgelegd.',
}

/* ─── Collapsible detail component ─────────────────────────── */
function Collapsible({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex items-center gap-2 cursor-pointer text-sm text-text-dim hover:text-text-muted transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 transition-transform group-open:rotate-90"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {summary}
      </summary>
      <div className="mt-3 pl-5">{children}</div>
    </details>
  )
}

/* ─── Compact step card ────────────────────────────────────── */
function StepCard({
  step,
  title,
  oneLiner,
  problem,
  solution,
  details,
  color,
}: {
  step: number
  title: string
  oneLiner: string
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
      <div className="relative px-5 sm:px-6 py-4 sm:py-5">
        {/* Step badge + title + one-liner */}
        <div className="flex items-center gap-3 mb-2">
          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border text-sm font-bold font-display ${c.badge}`}>
            {step}
          </span>
          <h3 className="text-lg sm:text-xl font-display font-bold text-heading">{title}</h3>
        </div>
        <p className="text-sm text-text-muted mb-3 ml-11">{oneLiner}</p>

        {/* Collapsible details */}
        <div className="ml-11">
          <Collapsible summary="Meer details">
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-red-500/[0.04] border border-red-500/10 px-4 py-3">
                <p className="text-[10px] font-semibold text-red-400/80 uppercase tracking-wider mb-1">Het probleem</p>
                <p className="text-sm text-text leading-relaxed">{problem}</p>
              </div>
              <div className="rounded-xl bg-green-500/[0.04] border border-green-500/10 px-4 py-3">
                <p className="text-[10px] font-semibold text-green-400/80 uppercase tracking-wider mb-1">Onze oplossing</p>
                <p className="text-sm text-text leading-relaxed">{solution}</p>
              </div>
            </div>
            <div className="space-y-2">
              {details.map((detail, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot} mt-1.5 shrink-0`} />
                  <p className="text-sm text-text-muted leading-relaxed">{detail}</p>
                </div>
              ))}
            </div>
          </Collapsible>
        </div>
      </div>
    </div>
  )
}

/* ─── Main page ─────────────────────────────────────────────── */
export default function DailyBriefingIntroPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10 sm:py-16">
      {/* Hero - short and punchy */}
      <FadeIn>
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent-light text-xs font-medium mb-4">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            Premium Tool
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-bold text-heading leading-tight mb-3">
            Daily Macro Briefing
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Elke dag in 60 seconden weten waar de markt staat en waar jouw beste trades liggen.
          </p>
          <div className="mt-6">
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

      {/* Five Steps - compact with collapsible details */}
      <FadeIn>
        <div className="flex items-center gap-3 mb-6">
          <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </span>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-heading">Hoe werkt het? 5 stappen</h2>
        </div>
      </FadeIn>

      <div className="space-y-3 mb-10 sm:mb-14">
        <FadeIn>
          <StepCard
            step={1}
            title="Marktregime bepalen"
            oneLiner="De basis waar je altijd mee begint. Op basis van centraal bank beleid (rentes, bias, laatste acties) wordt bepaald of de markt Risk-On, Risk-Off, USD Dominant, USD Zwak of Gemengd is."
            color="blue"
            problem="Je weet niet of de markt in risk-on, risk-off of een dollargevoelige fase zit. Je koopt AUD/JPY terwijl de markt in paniek is."
            solution="Het model bepaalt het huidige marktregime op basis van centraal bankbeleid. De zekerheid geeft aan hoe eenduidig het beeld is."
            details={[
              'Vijf regimes: Risk-Off, Risk-On, USD Dominant, USD Zwak en Gemengd.',
              'De regime zekerheid is gebaseerd op de spread tussen de sterkste en zwakste valuta. Hoe groter het verschil, hoe duidelijker het regime.',
              'Waarom eerst het regime? Dezelfde data betekent iets heel anders in een ander marktklimaat.',
            ]}
          />
        </FadeIn>

        <FadeIn>
          <div className="flex items-center gap-2 text-text-muted text-sm py-1 pl-11">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
            <span>Regime geeft context voor verdere analyse</span>
          </div>
        </FadeIn>

        <FadeIn>
          <StepCard
            step={2}
            title="Nieuws Sentiment"
            oneLiner="Headlines worden geanalyseerd per valuta. Het sentiment (positief/negatief) wordt als nieuws bonus verwerkt in de valutascore uit Stap 1. Een positief nieuwsbericht over de dollar verhoogt de USD score."
            color="green"
            problem="Tientallen headlines scannen en interpreteren kost tijd en leidt tot confirmation bias."
            solution="Headlines van 7 bronnen worden automatisch geanalyseerd. Hawkish/dovish sentiment wordt meegewogen in de score."
            details={[
              'Bronnen: Fed, ECB, ForexLive, CNBC, Bloomberg, BBC, NYT.',
              'Per valuta wordt het sentiment bepaald als bonus of malus op de fundamentele score.',
              'Je ziet per valuta welke headlines het sentiment bepalen.',
            ]}
          />
        </FadeIn>

        <FadeIn>
          <div className="flex items-center gap-2 text-text-muted text-sm py-1 pl-11">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
            <span>Sentiment meegewogen in scores</span>
          </div>
        </FadeIn>

        <FadeIn>
          <StepCard
            step={3}
            title="Intermarket Signalen"
            oneLiner="DXY, yields, S&P 500, VIX, goud en olie worden gecheckt of ze in lijn bewegen met het marktregime uit Stap 1. Bijvoorbeeld: bij risk-off verwacht je stijgende VIX en dalende S&P 500. Als de intermarket data dit bevestigt (alignment >50%), zijn de signalen betrouwbaarder."
            color="amber"
            problem="Je tradet forex zonder te kijken naar wat aandelen, goud of yields doen."
            solution="Zes instrumenten worden gecheckt op alignment met het regime. Dit bepaalt hoe streng de filters worden."
            details={[
              'Zes instrumenten: DXY, US10Y, S&P 500, VIX, goud en olie.',
              'Alignment boven 50% = intermarket bevestiging. Zonder bevestiging worden filters strenger.',
              'Dit filtert valse signalen op dagen dat de brede markt tegenspreekt.',
            ]}
          />
        </FadeIn>

        <FadeIn>
          <div className="flex items-center gap-2 text-text-muted text-sm py-1 pl-11">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
            <span>Nu hebben we regime + scores + nieuws + intermarket. Stap 4 combineert dit alles in een filter.</span>
          </div>
        </FadeIn>

        <FadeIn>
          <StepCard
            step={4}
            title="Trade Focus"
            oneLiner="Alle informatie uit stap 1 t/m 3 wordt nu gecombineerd. De valutascore (CB beleid x2 + renteverschil x1.5 + nieuws bonus) bepaalt de richting. Alleen paren met score ≥2.0, intermarket alignment >50% en een 5-daagse prijsbeweging tegen de richting in (contrarian) komen er doorheen."
            color="gold"
            problem="Je opent TradingView en zoekt willekeurig door paren zonder te weten waar je moet focussen."
            solution="Een compact filterproces selecteert welke paren alle criteria overleven."
            details={[
              'Alle 10 major paren starten in de pool.',
              'Filter: minimaal 2.0 scoreverschil en duidelijke richting.',
              'Bij sterke alignment (>50%) gaan alle paren door. Bij zwak alleen paren met score >= 3.5.',
            ]}
          />
        </FadeIn>

        <FadeIn>
          <div className="flex items-center gap-2 text-text-muted text-sm py-1 pl-11">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
            <span>Uitgewerkt tot concrete trades</span>
          </div>
        </FadeIn>

        <FadeIn>
          <StepCard
            step={5}
            title="Concrete Trades"
            oneLiner="Trade cards met call (long/short), conviction score en entry/exit timing. Hold: 1 handelsdag."
            color="purple"
            problem="Je hebt een lijst met paren maar geen concreet plan: richting, timing, overtuiging."
            solution="Kwalificerende signalen worden uitgewerkt tot professionele trade cards."
            details={[
              'Contrarian mean reversion: het model wacht tot de prijs 5 dagen tegen de fundamentele richting beweegt, dan pas een signaal.',
              'Elke card toont: paar, richting, conviction score, regime context en timing.',
              'Elke trade verschijnt automatisch in het trackrecord.',
            ]}
          />
        </FadeIn>
      </div>

      {/* Separator between 5 steps and detail sections */}
      <FadeIn>
        <div className="flex items-center gap-4 mb-10 sm:mb-14">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-text-muted font-medium whitespace-nowrap">Het model in meer detail</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      </FadeIn>

      {/* Mean Reversion - collapsed */}
      <FadeIn>
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-b from-purple-500/[0.04] to-transparent px-6 sm:px-8 py-5 sm:py-6 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/[0.04] rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </span>
              <h2 className="text-lg sm:text-xl font-display font-bold text-heading">
                Mean Reversion: de kern van het model
              </h2>
            </div>
            <p className="text-sm text-text-muted ml-11 mb-3">
              Geen momentum, maar contrarian: wacht tot de prijs tegen de fundamentele richting ingaat en trade de terugkeer.
            </p>
            <div className="ml-11">
              <Collapsible summary="Hoe werkt mean reversion?">
                {/* Visual diagram */}
                <div className="flex flex-col items-center mb-5">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-text-dim font-medium mb-3">Visueel voorbeeld</p>
                  <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
                    <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/15 text-center min-w-[80px]">
                      <p className="text-[10px] text-text-dim mb-1">Fundamenteel</p>
                      <p className="text-base font-bold text-green-400">Bullish</p>
                    </div>
                    <span className="text-xl text-text-dim font-mono">+</span>
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/15 text-center min-w-[80px]">
                      <p className="text-[10px] text-text-dim mb-1">Prijs (5d)</p>
                      <p className="text-base font-bold text-red-400">Dalend</p>
                    </div>
                    <span className="text-xl text-text-dim font-mono">=</span>
                    <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-center min-w-[80px]">
                      <p className="text-[10px] text-text-dim mb-1">Signaal</p>
                      <p className="text-base font-bold text-accent-light">LONG</p>
                    </div>
                  </div>
                </div>

                {/* Optimizer results */}
                <div className="rounded-xl bg-purple-500/[0.06] border border-purple-500/15 p-4 mb-4">
                  <p className="text-[10px] font-semibold text-purple-400/80 uppercase tracking-wider mb-2">Optimizer: 1.260 configuraties getest</p>
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
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                    <p className="text-xs font-semibold text-heading mb-2">Hoe wordt de prijsbeweging gemeten?</p>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      Het model haalt via Yahoo Finance de dagelijkse slotkoersen op van elk valutapaar.
                      Vervolgens vergelijkt het de slotkoers van vandaag met de slotkoers van exact <strong className="text-heading">5 handelsdagen</strong> geleden.
                      Is de prijs over die 5 dagen gedaald terwijl de fundamentele score bullish is? Dan is er een contrarian signaal (LONG).
                      Is de prijs gestegen terwijl de score bearish is? Dan een SHORT signaal.
                    </p>
                    <p className="text-[11px] text-text-dim mt-2">
                      Waarom precies 5 dagen? De optimizer testte lookback periodes van 2, 3, 4 en 5 dagen.
                      5 dagen leverde de beste combinatie van winrate (56%) en profit factor (1.42).
                      Kortere periodes gaven te veel ruis, langere periodes misten de timing.
                    </p>
                  </div>

                  {/* Optimizer vergelijkingstabel */}
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                    <p className="text-xs font-semibold text-heading mb-2">Wat ging goed en wat niet? Optimizer resultaten</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-text-dim border-b border-white/[0.06]">
                            <th className="text-left py-1.5 pr-3">Strategie</th>
                            <th className="text-right py-1.5 px-2">Win Rate</th>
                            <th className="text-right py-1.5 px-2">PF</th>
                            <th className="text-right py-1.5 px-2">Pips</th>
                            <th className="text-right py-1.5 pl-2">Resultaat</th>
                          </tr>
                        </thead>
                        <tbody className="text-text-muted">
                          <tr className="border-b border-white/[0.04]">
                            <td className="py-1.5 pr-3">Momentum (koop bij stijging)</td>
                            <td className="text-right py-1.5 px-2 text-red-400">43%</td>
                            <td className="text-right py-1.5 px-2 text-red-400">0.89</td>
                            <td className="text-right py-1.5 px-2 text-red-400">-812</td>
                            <td className="text-right py-1.5 pl-2 text-red-400">Verlies</td>
                          </tr>
                          <tr className="border-b border-white/[0.04]">
                            <td className="py-1.5 pr-3">Contrarian 2d lookback</td>
                            <td className="text-right py-1.5 px-2 text-text-dim">48%</td>
                            <td className="text-right py-1.5 px-2 text-text-dim">1.02</td>
                            <td className="text-right py-1.5 px-2 text-text-dim">+189</td>
                            <td className="text-right py-1.5 pl-2 text-text-dim">Break-even</td>
                          </tr>
                          <tr className="border-b border-white/[0.04]">
                            <td className="py-1.5 pr-3">Contrarian 3d lookback</td>
                            <td className="text-right py-1.5 px-2 text-amber-400">52%</td>
                            <td className="text-right py-1.5 px-2 text-amber-400">1.18</td>
                            <td className="text-right py-1.5 px-2 text-amber-400">+1.105</td>
                            <td className="text-right py-1.5 pl-2 text-amber-400">Redelijk</td>
                          </tr>
                          <tr className="bg-green-500/[0.06] rounded">
                            <td className="py-1.5 pr-3 font-semibold text-green-400">Contrarian 5d + IM ✓</td>
                            <td className="text-right py-1.5 px-2 font-bold text-green-400">56%</td>
                            <td className="text-right py-1.5 px-2 font-bold text-green-400">1.42</td>
                            <td className="text-right py-1.5 px-2 font-bold text-green-400">+2.423</td>
                            <td className="text-right py-1.5 pl-2 font-bold text-green-400">Beste</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-text-dim mt-2">
                      IM = Intermarket bevestiging. De combinatie van 5-daagse contrarian + intermarket filter was veruit het sterkst uit 1.260 geteste configuraties.
                    </p>
                  </div>

                  <p>
                    Holding periode: 1 handelsdag. Entry op dagkoers signaaldag, exit dagkoers 1 handelsdag later.
                  </p>

                  {/* Trackrecord disclaimer */}
                  <div className="rounded-lg bg-accent/[0.04] border border-accent/15 p-3">
                    <p className="text-xs font-semibold text-heading mb-1">Het trackrecord blijft altijd actueel</p>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      Het trackrecord wordt elke handelsdag automatisch bijgewerkt om 23:00 uur (NL tijd).
                      Nieuwe signalen worden gegenereerd en openstaande trades worden na 1 handelsdag afgerekend op basis van de slotkoers.
                      De winrate en statistieken zijn dus geen momentopname maar een lopend resultaat dat meebeweegt met de markt.
                      De 56% winrate is het huidige gemiddelde. Dit kan stijgen of dalen naarmate er meer data binnenkomt.
                    </p>
                  </div>
                </div>
              </Collapsible>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Hoe gebruik je het? - collapsed */}
      <FadeIn>
        <div className="rounded-2xl border border-accent/15 bg-gradient-to-b from-accent/[0.04] to-transparent px-6 sm:px-8 py-5 sm:py-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
            </span>
            <h2 className="text-lg sm:text-xl font-display font-bold text-heading">Hoe gebruik je het?</h2>
          </div>
          <p className="text-sm text-text-muted ml-11 mb-3">
            Lees het dashboard van boven naar beneden: regime, sentiment, intermarket, funnel, trades.
          </p>
          <div className="ml-11">
            <Collapsible summary="Stap-voor-stap uitleg">
              <div className="space-y-3">
                {[
                  { n: '1', t: 'Check het marktregime', d: 'In welk regime zit de markt? Dit bepaalt of je agressief of voorzichtig moet zijn.' },
                  { n: '2', t: 'Bekijk het nieuws sentiment', d: 'Welke valuta krijgt positief of negatief sentiment uit recent nieuws?' },
                  { n: '3', t: 'Bekijk de intermarket signalen', d: 'Bevestigen aandelen, yields, VIX en goud het regime?' },
                  { n: '4', t: 'Bekijk de Trade Focus funnel', d: 'Hoeveel van de 10 paren overleven elke filterlaag?' },
                  { n: '5', t: 'Bekijk de concrete trades', d: 'Trade cards met call, conviction score en timing. Hold: 1 handelsdag.' },
                  { n: '6', t: 'Pas je eigen technische analyse toe', d: 'De fundamentele richting is bepaald. Gebruik je eigen bewezen technische strategie voor de exacte entry en exit timing.' },
                ].map(({ n, t, d }) => (
                  <div key={n} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-[10px] font-bold text-accent-light shrink-0 mt-0.5">{n}</span>
                    <div>
                      <p className="text-sm font-semibold text-heading">{t}</p>
                      <p className="text-xs text-text-muted mt-0.5">{d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Collapsible>
          </div>
        </div>
      </FadeIn>

      {/* Macro Fundamentals link - compact */}
      <FadeIn>
        <div className="rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/[0.06] via-bg-card to-accent/[0.03] px-6 sm:px-8 py-5 sm:py-6 mb-6 relative overflow-hidden">
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-heading">Databron: Macro Fundamentals</p>
                <p className="text-xs text-text-muted">Rentetarieven, inflatiecijfers en CB bias voeden de currency scores.</p>
              </div>
            </div>
            <Link
              href="/tools/fx-analyse"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-heading hover:bg-white/[0.08] transition-colors"
            >
              Bekijk
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* Databronnen - collapsed */}
      <FadeIn>
        <div className="rounded-2xl border border-border bg-bg-card px-6 sm:px-8 py-5 sm:py-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-display font-bold text-heading">Databronnen</h2>
            </div>
          </div>
          <p className="text-sm text-text-muted ml-11 mb-3">
            Centrale Bank Data, Nieuws Sentiment, Intermarket Data, Yahoo Finance dagkoersen.
          </p>
          <div className="ml-11">
            <Collapsible summary="Bekijk alle bronnen">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-bg-card px-4 py-3">
                  <p className="text-sm font-semibold text-heading">Centrale Bank Data</p>
                  <p className="text-xs text-text-muted mt-0.5">Rente, target, bias en vergaderdata. Fed, ECB, BoE, BoJ, RBA, RBNZ, BoC, SNB.</p>
                </div>
                <div className="rounded-xl border border-border bg-bg-card px-4 py-3">
                  <p className="text-sm font-semibold text-heading">Nieuws Sentiment</p>
                  <p className="text-xs text-text-muted mt-0.5">Headlines geanalyseerd op impact per valuta. Hawkish/dovish als bonus in de score.</p>
                </div>
                <div className="rounded-xl border border-border bg-bg-card px-4 py-3">
                  <p className="text-sm font-semibold text-heading">Intermarket Data</p>
                  <p className="text-xs text-text-muted mt-0.5">DXY, US10Y, goud, S&P 500, VIX en olie via Yahoo Finance.</p>
                </div>
                <div className="rounded-xl border border-border bg-bg-card px-4 py-3">
                  <p className="text-sm font-semibold text-heading">Yahoo Finance (Dagkoersen)</p>
                  <p className="text-xs text-text-muted mt-0.5">Dagkoersen voor 10 major paren. Trackrecord: signaaldag vs. 1 handelsdag later.</p>
                </div>
              </div>
            </Collapsible>
          </div>
        </div>
      </FadeIn>

      {/* Disclaimer - compact */}
      <FadeIn>
        <div className="rounded-2xl border border-border bg-bg-card px-6 sm:px-8 py-4 sm:py-5 mb-10">
          <div className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-heading mb-1">Disclaimer</p>
              <p className="text-xs text-text-muted leading-relaxed">
                Dit is geen handelssignaal maar een fundamentele bias. Het is aan jou om je technische entry te vinden en risicomanagement toe te passen.
                Fundamentelen bewegen langzaam; events kunnen de bias tijdelijk overrulen. Het trackrecord is volledig transparant.
              </p>
            </div>
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
