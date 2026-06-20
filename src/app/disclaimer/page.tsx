import FadeIn from '@/components/FadeIn'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Disclaimer & Privacy',
  description: 'Disclaimer en privacyverklaring van Sanders Capital.',
}

export default function DisclaimerPage() {
  return (
    <div className="bg-bg">
      {/* Page head */}
      <div className="border-b border-border bg-bg-elevated">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <FadeIn>
            <nav className="flex items-center gap-2 text-xs font-mono tracking-wide text-text-dim">
              <Link href="/" className="hover:text-accent transition-colors">
                Home
              </Link>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3 h-3"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
              <span className="text-text-muted">Disclaimer &amp; Privacy</span>
            </nav>

            <span className="mt-5 inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent before:h-px before:w-6 before:bg-accent/70 before:content-['']">
              Juridisch
            </span>

            <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-display font-bold tracking-tight text-heading">
              Disclaimer &amp; Privacy
            </h1>
            <p className="mt-5 max-w-prose text-base sm:text-lg text-text-muted leading-relaxed">
              Laatst bijgewerkt: juni 2026. Lees deze voorwaarden zorgvuldig door.
            </p>
          </FadeIn>
        </div>
      </div>

      {/* Body */}
      <section className="py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <FadeIn delay={100}>
            <div className="space-y-10 text-text leading-relaxed">
              <section>
                <h2 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-heading mb-4">
                  Geen financieel advies
                </h2>
                <p className="text-text-muted leading-[1.8]">
                  Alle content op Sanders Capital is uitsluitend bedoeld voor educatieve en informatieve
                  doeleinden. Niets op deze website, in onze artikelen, kennisbank, community of enige
                  andere communicatie constitueert financieel advies, beleggingsadvies, handelsadvies, of
                  enige andere vorm van professioneel advies.
                </p>
              </section>

              <section>
                <h2 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-heading mb-4">
                  Risicowaarschuwing
                </h2>
                <p className="text-text-muted leading-[1.8]">
                  Handel op financiële markten brengt aanzienlijke risico&apos;s met zich mee, waaronder het
                  risico op verlies van uw volledige inleg. Forex, aandelen, cryptovaluta, opties en
                  andere financiële instrumenten zijn complexe producten die niet geschikt zijn voor alle
                  beleggers. U dient alleen te handelen met geld dat u zich kunt veroorloven te
                  verliezen.
                </p>
              </section>

              <section>
                <h2 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-heading mb-4">
                  Geen garanties
                </h2>
                <p className="text-text-muted leading-[1.8]">
                  Sanders Capital garandeert niet dat de informatie op deze website volledig, nauwkeurig
                  of actueel is. We doen ons best om kwalitatieve content te bieden, maar fouten zijn
                  mogelijk. Gebruik de informatie altijd als startpunt voor uw eigen onderzoek, niet als
                  enige bron.
                </p>
              </section>

              <section>
                <h2 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-heading mb-4">
                  Resultaten uit het verleden
                </h2>
                <p className="text-text-muted leading-[1.8]">
                  Resultaten uit het verleden bieden geen garantie voor toekomstige resultaten. Eventuele
                  voorbeelden, analyses of scenario&apos;s die op deze website worden besproken, zijn
                  uitsluitend bedoeld ter illustratie en educatie.
                </p>
              </section>

              <section>
                <h2 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-heading mb-4">
                  Persoonlijke verantwoordelijkheid
                </h2>
                <p className="text-text-muted leading-[1.8]">
                  U bent volledig verantwoordelijk voor uw eigen financiële beslissingen. Sanders Capital
                  is niet aansprakelijk voor eventuele verliezen, schade of kosten die voortvloeien uit
                  het gebruik van informatie op deze website. Raadpleeg altijd een gekwalificeerd
                  financieel adviseur voordat u handelsbeslissingen neemt.
                </p>
              </section>

              <section id="privacy" className="scroll-mt-24">
                <h2 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-heading mb-4">
                  Privacy
                </h2>
                <p className="text-text-muted leading-[1.8]">
                  Sanders Capital respecteert uw privacy. We verzamelen alleen de gegevens die nodig zijn
                  voor het functioneren van ons platform (e-mailadres, naam bij registratie). We delen uw
                  gegevens niet met derden, tenzij wettelijk verplicht. Uw gegevens worden opgeslagen op
                  beveiligde servers.
                </p>
                <ul className="mt-4 space-y-2 pl-5 list-disc marker:text-accent text-text-muted leading-[1.7]">
                  <li>
                    We gebruiken functionele en analytische cookies om het platform te laten werken en te
                    verbeteren.
                  </li>
                  <li>
                    Gegevens worden bewaard zolang dat nodig is voor de dienst of wettelijk vereist is.
                  </li>
                  <li>
                    Door gebruik te maken van onze website gaat u akkoord met ons cookiebeleid. We
                    gebruiken functionele cookies die noodzakelijk zijn voor authenticatie en sessie
                    management.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-heading mb-4">
                  Intellectueel eigendom
                </h2>
                <p className="text-text-muted leading-[1.8]">
                  Alle content op Sanders Capital, inclusief maar niet beperkt tot teksten, afbeeldingen,
                  logo&apos;s, video&apos;s en de structuur van de website, is beschermd door het
                  auteursrecht. Niets mag zonder schriftelijke toestemming worden gereproduceerd,
                  gedistribueerd of openbaar gemaakt.
                </p>
              </section>

              <section className="pt-6 border-t border-border">
                <h2 className="text-2xl sm:text-3xl font-display font-semibold tracking-tight text-heading mb-4">
                  Contact
                </h2>
                <p className="text-text-muted leading-[1.8]">
                  Vragen over deze disclaimer of het privacybeleid? Neem contact op via{' '}
                  <a
                    href="mailto:sanderscapital@hotmail.com"
                    className="text-accent font-semibold hover:text-accent-light transition-colors"
                  >
                    sanderscapital@hotmail.com
                  </a>{' '}
                  of de{' '}
                  <Link
                    href="/contact"
                    className="text-accent font-semibold hover:text-accent-light transition-colors"
                  >
                    contactpagina
                  </Link>
                  .
                </p>
              </section>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  )
}
