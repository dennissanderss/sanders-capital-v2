import Link from 'next/link'
import FadeIn from '@/components/FadeIn'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Premium',
  description: 'Krijg toegang tot professionele trading tools, exclusieve content en verdiepende analyses.',
}

const freeFeatures = [
  'Basis artikelen & kennisbank',
  'Economische kalender',
  'Position Size Calculator',
  'Community toegang',
]

const premiumFeatures = [
  'Daily Macro Briefing',
  'Fundamentals dashboard',
  'TradeMind backtest analyse',
  'TradeMind Journal',
  'Premium artikelen & analyses',
  'Verdiepende kennisbank modules',
  'Exclusieve community kanalen',
]

const tools = [
  {
    name: 'Daily Macro Briefing',
    description: 'Dagelijkse macro analyse in 5 stappen: regime, nieuws sentiment, intermarket signalen, trade focus filter en concrete trades met call en timing.',
    href: '/tools/fx-selector',
    value: 'Bespaart 1-2 uur dagelijkse research',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    name: 'Fundamentals',
    description: 'Rentetarieven, inflatiecijfers en centrale bank beleid per valuta. De data achter de scores, inclusief trackrecord.',
    href: '/tools/fx-analyse',
    value: 'LIVE_WIN_RATE winrate op trackrecord',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    name: 'TradeMind',
    description: 'Upload je backtest CSV en krijg direct inzicht in je performance: winrate, drawdown, sessie-analyse, Monte Carlo en meer.',
    href: '/tools/tradescope',
    value: 'Vergelijkbaar met tools van +$200/jaar',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    name: 'TradeMind Journal',
    description: 'Je persoonlijke trading journal. Log trades, analyseer patronen in je gedrag en verbeter je edge structureel.',
    href: '/tools',
    value: 'Vervangt vergelijkbare journal tools (~$170/jaar)',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    comingSoon: true,
  },
]

const faqItems = [
  {
    q: 'Wat is het verschil tussen gratis en premium?',
    a: 'Gratis leden hebben toegang tot basis artikelen, de kennisbank en gratis tools (kalender, calculator). Premium leden krijgen volledige toegang tot alle professionele tools, verdiepende analyses en exclusieve community features.',
  },
  {
    q: 'Is dit financieel advies?',
    a: 'Nee. Alle content en tools zijn puur educatief. Sanders Capital geeft geen financieel advies en is niet verantwoordelijk voor beslissingen die op basis van onze content worden genomen.',
  },
  {
    q: 'Kan ik mijn abonnement opzeggen?',
    a: 'Ja. Het maandabonnement is op elk moment opzegbaar. Je houdt toegang tot het einde van de lopende betaalperiode. Bij lifetime access geldt een eenmalige betaling zonder verdere verplichtingen.',
  },
  {
    q: 'Hoe krijg ik toegang tot de tools?',
    a: 'Maak eerst een gratis account aan. Daarna kun je upgraden naar premium via de contactpagina en krijg je direct toegang tot alle tools.',
  },
  {
    q: 'Waarom bieden jullie ook lifetime access aan?',
    a: 'Onze tools en content bouwen over tijd meer waarde op. Het fundamentele trackrecord wordt sterker, je journal-data groeit, en je analyses worden beter. Lifetime access is bedoeld voor traders die langetermijn denken en willen investeren in hun ontwikkeling.',
  },
]

async function getLiveWinRate(): Promise<string> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await sb
      .from('trade_focus_records')
      .select('outcome')
      .not('outcome', 'is', null)
      .neq('outcome', 'pending')
    if (!data || data.length < 5) return '61%+'
    const correct = data.filter((r: { outcome: string }) => r.outcome === 'correct').length
    const rate = Math.round((correct / data.length) * 100)
    return `${rate}%`
  } catch {
    return '61%+'
  }
}

export default async function PremiumPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const liveWinRate = await getLiveWinRate()
  const isLoggedIn = !!user

  return (
    <div>
      {/* Page head / hero */}
      <div className="relative overflow-hidden border-b border-d-line bg-gradient-to-b from-[#0b1526] to-d-bg">
        <div className="pointer-events-none absolute -right-32 -top-40 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.18),transparent_70%)] blur-2xl" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16">
          <nav className="flex items-center gap-2 font-body text-[11.5px] tracking-[0.03em] text-d-ink-3">
            <Link href="/" className="hover:text-accent transition-colors">Home</Link>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            <span>Premium</span>
          </nav>
          <span className="mt-5 inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent before:h-px before:w-6 before:bg-accent/70 before:content-['']">
            Premium
          </span>
          <h1 className="mt-4 font-display text-4xl md:text-6xl font-semibold tracking-tight text-white">
            Structuur, geen ruis
          </h1>
          <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-d-ink-2">
            De meeste traders missen geen strategie, ze missen structuur. Premium geeft je een objectieve macro-analyse, een
            getimede uitvoering en inzicht in je eigen performance, op &eacute;&eacute;n plek.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">

      {/* Premium Tools */}
      <div className="max-w-5xl mx-auto mb-20 sm:mb-24">
        <FadeIn>
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent-light mb-4 before:h-px before:w-6 before:bg-accent/70 before:content-['']">
              Wat je krijgt
            </span>
            <h2 className="text-3xl md:text-4xl font-display font-semibold tracking-tight text-heading mb-4">
              Vier tools, &eacute;&eacute;n werkstroom
            </h2>
            <p className="text-text-muted max-w-xl mx-auto leading-relaxed">
              Van fundamentele bias naar getimede uitvoering naar gestructureerde evaluatie. De tools praten met elkaar.
            </p>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-4">
          {tools.map((tool, i) => (
            <FadeIn key={tool.name} delay={i * 100} className="h-full">
              <Link
                href={tool.href}
                className="block h-full p-7 rounded-xl bg-bg-card border border-border shadow-sm hover:border-accent-dim/50 hover:shadow-md transition-all group relative overflow-hidden"
              >
                {'comingSoon' in tool && (
                  <span className="absolute top-4 right-4 font-mono text-[9px] tracking-[0.12em] uppercase px-2 py-1 rounded bg-accent-glow text-accent-light border border-accent/20">
                    Binnenkort
                  </span>
                )}
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-lg bg-accent-glow border border-accent/15 flex items-center justify-center text-accent-light shrink-0 group-hover:bg-accent-dim/20 transition-colors">
                    {tool.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-xl font-semibold text-heading mb-1.5 group-hover:text-accent-light transition-colors">
                      {tool.name}
                    </h3>
                    <p className="text-sm text-text-muted leading-relaxed mb-2.5">
                      {tool.description}
                    </p>
                    <p className="text-xs text-accent-light/80 flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {tool.value.replace('LIVE_WIN_RATE', liveWinRate)}
                    </p>
                  </div>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>

      {/* Pricing */}
      {isLoggedIn ? (
        <div className="max-w-5xl mx-auto mb-20 sm:mb-24">
          <FadeIn>
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent-light mb-4 before:h-px before:w-6 before:bg-accent/70 before:content-['']">
                Investeer in je groei
              </span>
              <h2 className="text-3xl md:text-4xl font-display font-semibold tracking-tight text-heading mb-3">
                Kies je toegang
              </h2>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto items-stretch">
            {/* Free tier */}
            <FadeIn delay={100} className="h-full">
              <div className="p-8 rounded-xl bg-bg-card border border-border shadow-sm h-full flex flex-col">
                <h3 className="font-display text-2xl font-semibold tracking-tight text-heading">Gratis</h3>
                <p className="text-sm text-text-dim mt-2 min-h-[40px]">Begin met de kennisbank en de community.</p>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-display text-5xl font-bold leading-none tracking-tight text-heading">&euro;0</span>
                  <span className="font-mono text-[13px] text-text-dim">/ maand</span>
                </div>
                <ul className="mt-6 pt-6 border-t border-border space-y-3 flex-1">
                  {freeFeatures.map((f) => (
                    <li key={f} className="flex gap-3 text-sm leading-snug">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0 mt-0.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-text">{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 w-full px-6 py-3.5 rounded-lg border border-border text-center text-sm font-semibold text-text-dim">
                  Actief
                </div>
              </div>
            </FadeIn>

            {/* Monthly tier — featured */}
            <FadeIn delay={200} className="h-full">
              <div className="relative p-8 rounded-xl bg-bg-card border border-accent/40 shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_20px_50px_-32px_rgba(12,22,38,0.3)] h-full flex flex-col">
                <span className="absolute -top-3 left-8 font-mono text-[9.5px] tracking-[0.1em] uppercase font-semibold text-white bg-accent px-3 py-1.5 rounded">
                  Aanbevolen
                </span>
                <h3 className="font-display text-2xl font-semibold tracking-tight text-heading">Maandelijks</h3>
                <p className="text-sm text-text-dim mt-2 min-h-[40px]">Alle tools voor dagelijkse structuur en uitvoering.</p>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-display text-5xl font-bold leading-none tracking-tight text-heading">&euro;68,25</span>
                  <span className="font-mono text-[13px] text-text-dim">/ maand</span>
                </div>
                <ul className="mt-6 pt-6 border-t border-border space-y-3 flex-1">
                  {premiumFeatures.map((f) => (
                    <li key={f} className="flex gap-3 text-sm leading-snug">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0 mt-0.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-text">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/contact"
                  className="mt-6 block text-center px-6 py-3.5 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-semibold transition-colors"
                >
                  Neem contact op
                </Link>
              </div>
            </FadeIn>

            {/* Lifetime tier */}
            <FadeIn delay={300} className="h-full">
              <div className="relative p-8 rounded-xl bg-bg-card border border-border shadow-sm h-full flex flex-col overflow-hidden">
                <span className="absolute top-0 right-0 font-mono text-[9.5px] tracking-[0.1em] uppercase font-semibold text-accent-light bg-accent-glow px-3 py-1.5 rounded-bl-lg">
                  Beste waarde
                </span>
                <h3 className="font-display text-2xl font-semibold tracking-tight text-heading">Lifetime Access</h3>
                <p className="text-sm text-text-dim mt-2 min-h-[40px]">Premium met volledige toegang, eenmalig.</p>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-display text-5xl font-bold leading-none tracking-tight text-heading">&euro;699</span>
                  <span className="font-mono text-[13px] text-text-dim">eenmalig</span>
                </div>
                <ul className="mt-6 pt-6 border-t border-border space-y-3 flex-1">
                  {[...premiumFeatures, 'Alle toekomstige tools & updates'].map((f) => (
                    <li key={f} className="flex gap-3 text-sm leading-snug">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0 mt-0.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-text">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/contact"
                  className="mt-6 block text-center px-6 py-3.5 rounded-lg border border-accent/30 text-accent-light text-sm font-semibold hover:border-accent hover:bg-accent-glow transition-colors"
                >
                  Neem contact op
                </Link>
              </div>
            </FadeIn>
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.03em] text-text-dim">
            <span className="w-[5px] h-[5px] rounded-full bg-accent" />
            Educatief, geen financieel advies.
          </p>

          {/* Price justification */}
          <FadeIn delay={400}>
            <div className="max-w-3xl mx-auto mt-12 rounded-xl border border-border bg-bg-card shadow-sm px-6 sm:px-8 py-6 sm:py-8">
              <h3 className="text-xl font-display font-semibold tracking-tight text-heading mb-5 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold">
                  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                Onderbouwing van de investering
              </h3>
              <div className="space-y-4 text-sm text-text-muted leading-relaxed">
                <p>
                  De prijs van Sanders Capital Premium is gebaseerd op de marktwaarde van vergelijkbare tools en diensten.
                  Hieronder een overzicht van wat je ontvangt en wat dit afzonderlijk zou kosten:
                </p>

                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Trading journal software', price: '~$170/jaar', desc: 'TradeMind vervangt vergelijkbare journal tools volledig' },
                    { label: 'Backtest analytics platforms', price: '~$200+/jaar', desc: 'TradeMind met Monte Carlo simulatie en optimalisatie' },
                    { label: 'Fundamentele data services', price: '~$500+/jaar', desc: 'Daily Macro Briefing + Fundamentals dashboard' },
                    { label: 'Trading community & begeleiding', price: 'Onbetaalbaar', desc: 'Directe ondersteuning van een ervaren trader' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-[rgba(12,22,38,0.03)] border border-black/[0.08] px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-heading font-medium">{item.label}</span>
                        <span className="text-xs text-gold font-mono">{item.price}</span>
                      </div>
                      <p className="text-xs text-text-dim">{item.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-black/[0.08]">
                  <p>
                    <strong className="text-heading">Gezamenlijke marktwaarde: meer dan &euro;1.000 per jaar.</strong>{' '}
                    Daarnaast beschik je over een fundamenteel model met een{' '}
                    <strong className="text-heading">{liveWinRate} winrate trackrecord</strong> dat dagelijks wordt bijgehouden.
                    Dit is geen standaard product dat elders verkrijgbaar is.
                  </p>
                </div>

                <p>
                  Sanders Capital is gebouwd door iemand die zelf jarenlang heeft gezocht naar de juiste tools,
                  frameworks en data. Alles is transparant: publiek trackrecord, open databronnen, geen verborgen
                  kosten. Je investeert in een compleet systeem dat over tijd alleen maar waardevoller wordt.
                </p>

                <p className="text-xs text-text-dim pt-1">
                  Bij het maandabonnement van &euro;68,25 betaal je op jaarbasis &euro;819. Met lifetime access
                  bespaar je direct &euro;120+ ten opzichte van het eerste jaar, en daarna betaal je niets meer.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      ) : (
        /* Not logged in */
        <FadeIn>
          <div className="max-w-2xl mx-auto mb-20 sm:mb-24 p-8 sm:p-10 rounded-xl bg-bg-card border border-border shadow-sm text-center">
            <div className="w-14 h-14 rounded-xl bg-accent-glow border border-accent/15 flex items-center justify-center mx-auto mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 className="text-2xl font-display font-semibold tracking-tight text-heading mb-2">
              Pricing beschikbaar na registratie
            </h3>
            <p className="text-text-muted mb-6 max-w-md mx-auto leading-relaxed">
              Maak een gratis account aan om de volledige pricing, vergelijking en onderbouwing te bekijken.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register"
                className="px-6 py-3.5 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-semibold transition-colors"
              >
                Gratis registreren
              </Link>
              <Link
                href="/login"
                className="px-6 py-3.5 rounded-lg border border-border text-heading text-sm font-semibold hover:bg-bg-hover transition-colors"
              >
                Inloggen
              </Link>
            </div>
          </div>
        </FadeIn>
      )}

      {/* How it works */}
      <FadeIn>
        <div className="max-w-4xl mx-auto mb-20 sm:mb-24">
          <h2 className="text-3xl md:text-4xl font-display font-semibold tracking-tight text-heading text-center mb-12">
            Hoe het werkt
          </h2>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {[
              { step: '1', title: 'Maak een account', desc: 'Registreer gratis en krijg direct toegang tot basis content en tools.' },
              { step: '2', title: 'Verken de tools', desc: 'Ontdek wat bij je trading past. Gratis tools zijn direct beschikbaar.' },
              { step: '3', title: 'Upgrade naar premium', desc: 'Neem contact op en krijg volledige toegang tot alle tools en content.' },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 150}>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-lg bg-accent-glow border border-accent/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-lg font-display font-semibold text-accent-light">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-heading mb-2">{item.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* FAQ */}
      <FadeIn>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-display font-semibold tracking-tight text-heading text-center mb-12">
            Veelgestelde vragen
          </h2>
          <div className="space-y-4">
            {faqItems.map((item, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="p-6 sm:p-7 rounded-xl bg-bg-card border border-border shadow-sm">
                  <h3 className="font-display text-lg font-semibold text-heading mb-2">{item.q}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{item.a}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* CTA */}
      <FadeIn>
        <div className="text-center mt-20 sm:mt-24">
          <Link
            href={isLoggedIn ? '/contact' : '/register'}
            className="inline-block px-8 py-3.5 rounded-lg bg-accent hover:bg-accent-light text-white font-semibold transition-colors"
          >
            {isLoggedIn ? 'Neem contact op' : 'Gratis aanmelden'}
          </Link>
        </div>
      </FadeIn>
      </div>
    </div>
  )
}
