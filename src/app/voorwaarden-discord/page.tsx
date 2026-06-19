import FadeIn from '@/components/FadeIn'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Algemene Voorwaarden Discord',
  description: 'Algemene voorwaarden voor de Sanders Capital Discord-server.',
}

export default function VoorwaardenDiscordPage() {
  return (
    <div>
      {/* Page head */}
      <div className="border-b border-border bg-bg-elevated">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-14 sm:pt-24 sm:pb-16">
          <FadeIn>
            <div className="flex items-center gap-2 text-xs font-mono tracking-wide text-text-dim">
              <Link href="/" className="hover:text-accent transition-colors">Home</Link>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M9 6l6 6-6 6" />
              </svg>
              <span>Voorwaarden Discord</span>
            </div>
            <span className="mt-5 inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent before:content-[''] before:w-6 before:h-px before:bg-accent/70">
              Juridisch
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-display font-bold text-heading tracking-tight">
              Algemene Voorwaarden Discord
            </h1>
            <p className="mt-4 text-base sm:text-lg text-text-muted leading-relaxed max-w-[60ch]">
              Laatst bijgewerkt: 26 maart 2026. Door lid te worden van de Sanders Capital
              Discord-server ga je akkoord met onderstaande voorwaarden. Deze voorwaarden gelden
              aanvullend op de{' '}
              <Link href="/voorwaarden" className="text-accent hover:text-accent-light transition-colors underline underline-offset-2">
                Algemene Voorwaarden
              </Link>{' '}
              van sanderscapital.nl.
            </p>
          </FadeIn>
        </div>
      </div>

      {/* Body */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <FadeIn delay={100}>
          <div className="space-y-12 text-text leading-relaxed text-sm sm:text-base">

          {/* 1 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              1. Aard van de community
            </h2>
            <p className="text-text-muted">
              De Sanders Capital Discord is een educatieve community gericht op financi&euml;le
              markten. Alles wat gedeeld wordt door Sanders Capital of door leden, inclusief
              analyses, trade-idee&euml;n, setups en gesprekken, is geen financieel advies.
              Sanders Capital is geen beleggingsonderneming en beschikt niet over een
              AFM-vergunning. Je handelt te allen tijde op eigen risico en verantwoordelijkheid.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              2. Toegang en lidmaatschap
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>
                2.1. Toegang tot de Discord-server is beschikbaar voor geregistreerde gebruikers.
                Bepaalde kanalen zijn exclusief toegankelijk voor premium leden met een actief
                abonnement via sanderscapital.nl.
              </p>
              <p>
                2.2. Je dient minimaal 18 jaar oud te zijn om deel te nemen aan de Discord-server.
              </p>
              <p>
                2.3. Sanders Capital behoudt zich het recht voor om toegang te weigeren, te beperken
                of in te trekken zonder opgave van redenen.
              </p>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              3. Gedragsregels
            </h2>
            <div className="space-y-3 text-text-muted">
              <p>Het volgende is niet toegestaan:</p>
              <ul className="space-y-1.5 pl-5 list-disc">
                <li>Financieel advies geven aan andere leden of doen alsof je een financieel adviseur bent.</li>
                <li>Spam, zelfpromotie, affiliate-links of reclame plaatsen zonder toestemming.</li>
                <li>Andere leden beledigen, intimideren, discrimineren of anderszins respectloos benaderen.</li>
                <li>Misleidende informatie verspreiden, waaronder nep-resultaten, gemanipuleerde screenshots of valse claims over rendement.</li>
                <li>Het werven van leden voor andere Discord-servers, signaalgroepen of betaalde diensten.</li>
                <li>Het delen van illegale content of content die in strijd is met de Discord Terms of Service.</li>
              </ul>
              <p>
                Overtredingen kunnen leiden tot een waarschuwing, mute, kick of permanente ban,
                naar oordeel van Sanders Capital.
              </p>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              4. Intellectueel eigendom
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>
                4.1. Alle content gedeeld door Sanders Capital in de Discord, inclusief analyses,
                educatief materiaal, video&apos;s, afbeeldingen en tools, is eigendom van Sanders
                Capital en auteursrechtelijk beschermd.
              </p>
              <p>
                4.2. Het is niet toegestaan om premium content of betaalde content te kopi&euml;ren,
                screenshotten, opnemen of verspreiden buiten de server. Dit geldt ook voor het
                delen met niet-leden.
              </p>
              <p>
                4.3. Overtreding van dit artikel leidt tot onmiddellijke verwijdering uit de server
                en be&euml;indiging van je premium abonnement, zonder recht op restitutie.
              </p>
            </div>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              5. Aansprakelijkheid
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>
                5.1. Sanders Capital is niet aansprakelijk voor enige schade, direct of indirect,
                die voortvloeit uit informatie, analyses of gesprekken binnen de Discord-server,
                waaronder financi&euml;le verliezen.
              </p>
              <p>
                5.2. Sanders Capital is niet verantwoordelijk voor uitspraken, adviezen of content
                gedeeld door andere leden. Elk lid is zelf verantwoordelijk voor zijn eigen
                berichten en handelsbeslissingen.
              </p>
              <p>
                5.3. Sanders Capital garandeert geen specifieke resultaten, rendementen of prestaties.
              </p>
            </div>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              6. Privacy
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>
                6.1. Door deel te nemen aan de Discord-server ga je ermee akkoord dat je
                Discord-gebruikersnaam en activiteit binnen de server zichtbaar is voor andere leden.
              </p>
              <p>
                6.2. Sanders Capital verzamelt geen aanvullende persoonsgegevens via Discord buiten
                wat Discord zelf verwerkt. Voor de verwerking van gegevens via sanderscapital.nl
                verwijzen wij naar ons privacybeleid op de website.
              </p>
              <p>
                6.3. Het is leden niet toegestaan om persoonsgegevens van andere leden te verzamelen,
                op te slaan of te verspreiden.
              </p>
            </div>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              7. Wijzigingen
            </h2>
            <p className="text-text-muted">
              Sanders Capital behoudt zich het recht voor deze voorwaarden op elk moment te wijzigen.
              Wijzigingen worden gecommuniceerd via de Discord-server. Voortgezet gebruik na
              bekendmaking geldt als acceptatie.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              8. Toepasselijk recht
            </h2>
            <p className="text-text-muted">
              Op deze voorwaarden is Nederlands recht van toepassing. Geschillen worden voorgelegd
              aan de bevoegde rechter in het arrondissement waarin Sanders Capital is gevestigd.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              9. Contact
            </h2>
            <p className="text-text-muted">
              Vragen over deze voorwaarden? Neem contact op via{' '}
              <a
                href="mailto:sanderscapital@hotmail.com"
                className="text-accent-light hover:text-heading transition-colors"
              >
                sanderscapital@hotmail.com
              </a>{' '}
              of via het{' '}
              <Link
                href="/contact"
                className="text-accent-light hover:text-heading transition-colors"
              >
                contactformulier
              </Link>{' '}
              op sanderscapital.nl.
            </p>
          </section>

          {/* Slotverklaring */}
          <section className="pt-6 border-t border-border">
            <p className="text-sm text-text-muted text-center italic">
              Door lid te blijven van deze server bevestig je dat je deze voorwaarden hebt gelezen
              en ermee akkoord gaat.
            </p>
          </section>
          </div>
        </FadeIn>
      </section>
    </div>
  )
}
