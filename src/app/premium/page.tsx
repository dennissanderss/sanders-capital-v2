import Link from 'next/link'
import FadeIn from '@/components/FadeIn'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Premium',
  description: 'Krijg toegang tot exclusieve educatieve content en verdiepende analyses.',
}

const freeFeatures = [
  'Basis artikelen',
  'Kennisbank basis modules',
  'Community toegang',
  'Wekelijkse nieuwsbrief',
]

const premiumFeatures = [
  'Alle basis features',
  'Premium artikelen & analyses',
  'Verdiepende kennisbank modules',
  'Exclusieve community kanalen',
  'Maandelijkse live sessies',
  'Persoonlijke leerroutekaart',
]

const faqItems = [
  {
    q: 'Wat is het verschil tussen gratis en premium?',
    a: 'Gratis leden hebben toegang tot basis artikelen en de kennisbank basis modules. Premium leden krijgen toegang tot alle content, inclusief verdiepende analyses, exclusieve modules en community features.',
  },
  {
    q: 'Is dit financieel advies?',
    a: 'Nee. Alle content is puur educatief. Sanders Capital geeft geen financieel advies en is niet verantwoordelijk voor beslissingen die op basis van onze content worden genomen.',
  },
  {
    q: 'Kan ik mijn abonnement opzeggen?',
    a: 'Ja, je kunt je premium abonnement op elk moment opzeggen. Je houdt toegang tot het einde van de betaalperiode.',
  },
  {
    q: 'Hoe krijg ik toegang tot premium content?',
    a: 'Maak eerst een gratis account aan. Zodra premium beschikbaar is, kun je upgraden via je dashboard.',
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
            Krijg toegang tot exclusieve educatieve content, verdiepende analyses en een community van gemotiveerde traders.
          </p>
        </div>
      </FadeIn>

      {/* Pricing tiers */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-24">
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
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Maak een account', desc: 'Registreer gratis en krijg direct toegang tot basis content.' },
              { step: '2', title: 'Verken de content', desc: 'Lees artikelen, verken de kennisbank en ontdek wat bij jou past.' },
              { step: '3', title: 'Upgrade naar premium', desc: 'Krijg toegang tot alle content en exclusieve community features.' },
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
