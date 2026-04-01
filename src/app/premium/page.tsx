import Link from 'next/link'
import FadeIn from '@/components/FadeIn'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Premium',
  description: 'Krijg toegang tot professionele trading tools, exclusieve content en verdiepende analyses.',
}

const freeFeatures = [
  'Basis artikelen (zonder account)',
  'Kennisbank basis modules',
  'Community toegang',
]

const premiumFeatures = [
  'Alle basis features',
  'Premium artikelen & analyses',
  'Verdiepende kennisbank modules',
  'Exclusieve community kanalen',
  'Volledige toegang tot alle tools',
]

const tools = [
  {
    name: 'Daily Macro Briefing',
    description: 'Dagelijks overzicht van macro regime, currency scores en trade focus — gebaseerd op centrale bank beleid en rentedata.',
    href: '/tools/fx-selector',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    tags: ['Macro', 'Currencies', 'Dagelijks'],
  },
  {
    name: 'Macro Fundamentals',
    description: 'Rentetarieven, inflatiecijfers en centrale bank beleid per valuta — de data achter de scores.',
    href: '/tools/rentetarieven',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    tags: ['Rentes', 'Inflatie', 'CB Beleid'],
  },
  {
    name: 'TradeScope',
    description: 'Upload je backtest CSV en krijg direct inzicht in je performance — winrate, drawdown, sessie-analyse en meer.',
    href: '/tools/tradescope',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    tags: ['Backtest', 'Statistieken', 'Performance'],
  },
  {
    name: 'TradeMind',
    description: 'Je persoonlijke trading journal — log trades, analyseer patronen in je gedrag en verbeter je edge structureel.',
    href: '/tools',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    tags: ['Journal', 'Psychologie', 'Binnenkort'],
  },
]

const faqItems = [
  {
    q: 'Wat is het verschil tussen gratis en premium?',
    a: 'Gratis leden hebben toegang tot basis artikelen en de kennisbank basis modules. Premium leden krijgen volledige toegang tot alle tools, verdiepende analyses en exclusieve community features.',
  },
  {
    q: 'Is dit financieel advies?',
    a: 'Nee. Alle content en tools zijn puur educatief. Sanders Capital geeft geen financieel advies en is niet verantwoordelijk voor beslissingen die op basis van onze content worden genomen.',
  },
  {
    q: 'Kan ik mijn abonnement opzeggen?',
    a: 'Ja, je kunt je premium abonnement op elk moment opzeggen. Je houdt toegang tot het einde van de betaalperiode.',
  },
  {
    q: 'Hoe krijg ik toegang tot de tools?',
    a: 'Maak eerst een gratis account aan. Zodra premium beschikbaar is, kun je upgraden via je dashboard en krijg je direct toegang tot alle tools.',
  },
]

export default function PremiumPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-24">
      <FadeIn>
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-display font-semibold text-heading mb-4">
            Premium
          </h1>
          <p className="text-text-muted max-w-2xl mx-auto">
            Professionele tools, exclusieve content en verdiepende analyses — alles wat je nodig hebt om data-gedreven te handelen.
          </p>
        </div>
      </FadeIn>

      {/* Premium Tools */}
      <div className="max-w-5xl mx-auto mb-24">
        <FadeIn>
          <div className="text-center mb-12">
            <span className="text-xs tracking-[0.2em] uppercase text-accent-light mb-3 block font-body">
              Gebouwd voor traders
            </span>
            <h2 className="text-2xl md:text-3xl font-display font-semibold text-heading mb-3">
              Premium Tools
            </h2>
            <p className="text-text-muted max-w-xl mx-auto">
              Elke tool lost een specifiek probleem op. Geen ruis, geen overbodige features — alleen wat je nodig hebt.
            </p>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-4">
          {tools.map((tool, i) => (
            <FadeIn key={tool.name} delay={i * 100} className="h-full">
              <Link
                href={tool.href}
                className="block h-full p-6 rounded-xl bg-bg-card border border-border hover:border-accent-dim/40 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent-glow flex items-center justify-center text-accent-light shrink-0 group-hover:bg-accent-dim/20 transition-colors">
                    {tool.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold text-heading mb-1.5 group-hover:text-accent-light transition-colors">
                      {tool.name}
                    </h3>
                    <p className="text-sm text-text-muted leading-relaxed mb-3">
                      {tool.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tool.tags.map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-text-dim border border-white/[0.06]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>

      {/* Pricing tiers */}
      <div className="grid md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto mb-24">
        <FadeIn delay={100}>
          <div className="p-8 rounded-xl bg-bg-card border border-border h-full">
            <div className="mb-6">
              <h2 className="text-xl font-display font-semibold text-heading mb-1">Gratis</h2>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-display font-bold text-heading">&euro;0</span>
                <span className="text-sm text-text-muted">/maand</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-text">{f}</span>
                </li>
              ))}
              {premiumFeatures.slice(1).map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm opacity-40">
                  <span className="w-4 text-center text-text-dim">—</span>
                  <span className="text-text-muted">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="block text-center px-6 py-3 rounded-lg border border-border text-heading text-sm font-medium hover:bg-bg-hover transition-colors"
            >
              Gratis aanmelden
            </Link>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="p-8 rounded-xl bg-bg-card border border-accent/30 h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-accent/20 text-accent-light text-xs rounded-bl-lg">
              Binnenkort
            </div>
            <div className="mb-6">
              <h2 className="text-xl font-display font-semibold text-heading mb-1">Premium</h2>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-display font-bold text-heading">Binnenkort</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8">
              {premiumFeatures.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-text">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/contact"
              className="block text-center px-6 py-3 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors"
            >
              Neem contact op
            </Link>
          </div>
        </FadeIn>
      </div>

      {/* How it works */}
      <FadeIn>
        <div className="max-w-4xl mx-auto mb-24">
          <h2 className="text-2xl font-display font-semibold text-heading text-center mb-12">
            Hoe het werkt
          </h2>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {[
              { step: '1', title: 'Maak een account', desc: 'Registreer gratis en krijg direct toegang tot basis content.' },
              { step: '2', title: 'Verken de tools', desc: 'Ontdek de tools, lees artikelen en vind wat bij je trading past.' },
              { step: '3', title: 'Upgrade naar premium', desc: 'Krijg volledige toegang tot alle tools en exclusieve content.' },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 150}>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-lg bg-accent-glow border border-accent/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-lg font-display font-semibold text-accent-light">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="font-display font-semibold text-heading mb-2">{item.title}</h3>
                  <p className="text-sm text-text-muted">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* FAQ */}
      <FadeIn>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-display font-semibold text-heading text-center mb-12">
            Veelgestelde vragen
          </h2>
          <div className="space-y-4">
            {faqItems.map((item, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="p-6 rounded-xl bg-bg-card border border-border">
                  <h3 className="font-semibold text-heading mb-2">{item.q}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{item.a}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* CTA */}
      <FadeIn>
        <div className="text-center mt-24">
          <Link
            href="/register"
            className="inline-block px-8 py-3.5 rounded-lg bg-accent hover:bg-accent-light text-white font-medium transition-colors"
          >
            Gratis aanmelden
          </Link>
        </div>
      </FadeIn>
    </div>
  )
}
