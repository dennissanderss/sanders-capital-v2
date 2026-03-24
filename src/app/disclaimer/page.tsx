import FadeIn from '@/components/FadeIn'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Disclaimer & Privacy',
  description: 'Disclaimer en privacyverklaring van Sanders Capital.',
}

export default function DisclaimerPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <FadeIn>
        <h1 className="text-4xl md:text-5xl font-display font-semibold text-heading mb-12">
          Disclaimer &amp; Privacy
        </h1>
      </FadeIn>

      <FadeIn delay={100}>
        <div className="space-y-8 text-text leading-relaxed">
          <section>
            <h2 className="text-2xl font-display font-semibold text-heading mb-4">
              Geen financieel advies
            </h2>
            <p>
              Alle content op Sanders Capital is uitsluitend bedoeld voor educatieve en informatieve
              doeleinden. Niets op deze website, in onze artikelen, kennisbank, community of enige
              andere communicatie constitueert financieel advies, beleggingsadvies, handelsadvies, of
              enige andere vorm van professioneel advies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold text-heading mb-4">
              Risicowaarschuwing
            </h2>
            <p>
              Handel op financiële markten brengt aanzienlijke risico&apos;s met zich mee, waaronder het
              risico op verlies van uw volledige inleg. Forex, aandelen, cryptovaluta, opties en
              andere financiële instrumenten zijn complexe producten die niet geschikt zijn voor alle
              beleggers. U dient alleen te handelen met geld dat u zich kunt veroorloven te
              verliezen.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold text-heading mb-4">
              Geen garanties
            </h2>
            <p>
              Sanders Capital garandeert niet dat de informatie op deze website volledig, nauwkeurig
              of actueel is. We doen ons best om kwalitatieve content te bieden, maar fouten zijn
              mogelijk. Gebruik de informatie altijd als startpunt voor uw eigen onderzoek, niet als
              enige bron.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold text-heading mb-4">
              Resultaten uit het verleden
            </h2>
            <p>
              Resultaten uit het verleden bieden geen garantie voor toekomstige resultaten. Eventuele
              voorbeelden, analyses of scenario&apos;s die op deze website worden besproken, zijn
              uitsluitend bedoeld ter illustratie en educatie.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold text-heading mb-4">
              Persoonlijke verantwoordelijkheid
            </h2>
            <p>
              U bent volledig verantwoordelijk voor uw eigen financiële beslissingen. Sanders Capital
              is niet aansprakelijk voor eventuele verliezen, schade of kosten die voortvloeien uit
              het gebruik van informatie op deze website. Raadpleeg altijd een gekwalificeerd
              financieel adviseur voordat u handelsbeslissingen neemt.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold text-heading mb-4">
              Privacy
            </h2>
            <p>
              Sanders Capital respecteert uw privacy. We verzamelen alleen de gegevens die nodig zijn
              voor het functioneren van ons platform (e-mailadres, naam bij registratie). We delen uw
              gegevens niet met derden, tenzij wettelijk verplicht. Uw gegevens worden opgeslagen op
              beveiligde servers.
            </p>
            <p className="mt-4">
              Door gebruik te maken van onze website gaat u akkoord met ons cookiebeleid. We
              gebruiken functionele cookies die noodzakelijk zijn voor het functioneren van de
              website, zoals authenticatie en sessie management.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold text-heading mb-4">
              Intellectueel eigendom
            </h2>
            <p>
              Alle content op Sanders Capital — inclusief maar niet beperkt tot teksten, afbeeldingen,
              logo&apos;s, video&apos;s en de structuur van de website — is beschermd door het
              auteursrecht. Niets mag zonder schriftelijke toestemming worden gereproduceerd,
              gedistribueerd of openbaar gemaakt.
            </p>
          </section>

          <section className="pt-4 border-t border-border">
            <p className="text-sm text-text-muted">
              Voor vragen over deze disclaimer kunt u contact opnemen via{' '}
              <a
                href="mailto:sanderscapital@hotmail.com"
                className="text-accent-light hover:text-heading transition-colors"
              >
                sanderscapital@hotmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </FadeIn>
    </div>
  )
}
