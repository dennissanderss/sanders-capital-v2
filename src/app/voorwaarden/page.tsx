import FadeIn from '@/components/FadeIn'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Algemene Voorwaarden',
  description: 'Algemene voorwaarden van Sanders Capital.',
}

export default function VoorwaardenPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <FadeIn>
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-semibold text-heading mb-4">
          Algemene Voorwaarden
        </h1>
        <p className="text-sm text-text-dim mb-12">
          Laatst bijgewerkt: 26 maart 2026
        </p>
      </FadeIn>

      <FadeIn delay={100}>
        <div className="space-y-8 text-text leading-relaxed text-sm sm:text-base">

          {/* Artikel 1 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              Artikel 1 — Definities
            </h2>
            <div className="space-y-2">
              <p>In deze algemene voorwaarden wordt verstaan onder:</p>
              <ul className="space-y-1.5 pl-5 list-disc text-text-muted">
                <li><strong className="text-text">Sanders Capital:</strong> de eenmanszaak Sanders Capital, gevestigd in Nederland, aanbieder van het platform sanderscapital.nl.</li>
                <li><strong className="text-text">Platform:</strong> de website sanderscapital.nl, inclusief alle subpagina&apos;s, applicaties en diensten die daaronder vallen, alsmede de gekoppelde Discord-server van Sanders Capital.</li>
                <li><strong className="text-text">Gebruiker:</strong> iedere natuurlijke persoon die het platform bezoekt, zich registreert of een account aanmaakt.</li>
                <li><strong className="text-text">Lid:</strong> een gebruiker die een account heeft aangemaakt op het platform.</li>
                <li><strong className="text-text">Premium lid:</strong> een lid dat een betaald abonnement heeft afgesloten voor toegang tot premium content.</li>
                <li><strong className="text-text">Content:</strong> alle teksten, artikelen, modules, afbeeldingen, video&apos;s, tools en overige materialen op het platform.</li>
                <li><strong className="text-text">Diensten:</strong> alle door Sanders Capital aangeboden diensten, waaronder gratis en betaalde educatieve content, tools en community toegang.</li>
              </ul>
            </div>
          </section>

          {/* Artikel 2 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              Artikel 2 — Toepasselijkheid
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>2.1. Deze algemene voorwaarden zijn van toepassing op elk gebruik van het platform, elke registratie en elk abonnement dat via het platform wordt afgesloten. Dit omvat tevens deelname aan de gekoppelde Discord-community van Sanders Capital.</p>
              <p>2.2. Door het platform te gebruiken, een account aan te maken of een abonnement af te sluiten, verklaart de gebruiker kennis te hebben genomen van deze voorwaarden en hiermee akkoord te gaan.</p>
              <p>2.3. Sanders Capital behoudt zich het recht voor deze voorwaarden eenzijdig te wijzigen. Wijzigingen treden in werking na publicatie op het platform. Bij substantiële wijzigingen worden leden per e-mail geïnformeerd.</p>
            </div>
          </section>

          {/* Artikel 3 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              Artikel 3 — Aard van de diensten
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>3.1. Sanders Capital biedt uitsluitend educatieve content aan met betrekking tot financiële markten. De aangeboden content vormt op geen enkel moment financieel advies, beleggingsadvies of een aanbeveling tot het verrichten van transacties.</p>
              <p>3.2. Sanders Capital is geen beleggingsonderneming, financieel adviseur of vermogensbeheerder en beschikt niet over een vergunning van de Autoriteit Financiële Markten (AFM) of enige andere toezichthouder.</p>
              <p>3.3. De gebruiker erkent dat handel op financiële markten aanzienlijke risico&apos;s met zich meebrengt, waaronder het verlies van de volledige inleg. De gebruiker handelt te allen tijde op eigen risico en verantwoordelijkheid.</p>
            </div>
          </section>

          {/* Artikel 4 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              Artikel 4 — Account en registratie
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>4.1. Voor toegang tot bepaalde onderdelen van het platform is registratie vereist. De gebruiker garandeert dat de bij registratie verstrekte gegevens juist en volledig zijn.</p>
              <p>4.2. De gebruiker is zelf verantwoordelijk voor het vertrouwelijk houden van inloggegevens. Sanders Capital is niet aansprakelijk voor ongeautoriseerd gebruik van het account.</p>
              <p>4.3. De gebruiker dient minimaal 18 jaar oud te zijn om een account aan te maken en gebruik te maken van de diensten.</p>
              <p>4.4. Sanders Capital behoudt zich het recht voor om accounts te weigeren, op te schorten of te beëindigen bij vermoeden van misbruik, fraude of overtreding van deze voorwaarden.</p>
            </div>
          </section>

          {/* Artikel 5 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              Artikel 5 — Abonnementen en betaling
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>5.1. Sanders Capital biedt zowel gratis als betaalde (premium) toegang aan. De specificaties en prijzen van premium abonnementen worden op het platform vermeld.</p>
              <p>5.2. Alle vermelde prijzen zijn in euro&apos;s en inclusief BTW, tenzij anders aangegeven.</p>
              <p>5.3. Betaling geschiedt vooraf via de op het platform aangeboden betaalmethoden. Het premium abonnement gaat in na ontvangst van de betaling.</p>
              <p>5.4. Premium abonnementen worden automatisch verlengd voor dezelfde periode, tenzij de gebruiker het abonnement tijdig opzegt. Opzegging is mogelijk tot uiterlijk 24 uur voor de verlenging via het dashboard of per e-mail.</p>
              <p>5.5. Sanders Capital behoudt zich het recht voor prijzen aan te passen. Bestaande abonnees worden minimaal 30 dagen voor een prijswijziging geïnformeerd en kunnen voor de ingangsdatum opzeggen.</p>
            </div>
          </section>

          {/* Artikel 6 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              Artikel 6 — Herroepingsrecht
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>6.1. Op grond van de Wet Koop op Afstand heeft de consument het recht om binnen 14 dagen na aankoop van een premium abonnement zonder opgave van redenen de overeenkomst te ontbinden (herroepingsrecht).</p>
              <p>6.2. Indien de gebruiker binnen de herroepingstermijn uitdrukkelijk heeft ingestemd met het direct beschikbaar stellen van de digitale content en daarbij afstand heeft gedaan van het herroepingsrecht, is teruggave van het betaalde bedrag niet mogelijk.</p>
              <p>6.3. Om het herroepingsrecht uit te oefenen, dient de gebruiker een ondubbelzinnige verklaring te sturen naar sanderscapital@hotmail.com binnen de gestelde termijn. Terugbetaling vindt plaats binnen 14 dagen na ontvangst van de herroeping.</p>
            </div>
          </section>

          {/* Artikel 7 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              Artikel 7 — Intellectueel eigendom
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>7.1. Alle content op het platform, inclusief maar niet beperkt tot teksten, afbeeldingen, logo&apos;s, video&apos;s, software en de structuur van de website, is eigendom van Sanders Capital en beschermd door het auteursrecht en andere intellectuele eigendomsrechten.</p>
              <p>7.2. Het is de gebruiker niet toegestaan om zonder voorafgaande schriftelijke toestemming content te kopiëren, verspreiden, openbaar maken, bewerken of commercieel te exploiteren.</p>
              <p>7.3. Het delen van premium content met derden, waaronder het doorsturen, screenshotten of op andere wijze verspreiden, is uitdrukkelijk verboden en kan leiden tot onmiddellijke beëindiging van het account zonder restitutie.</p>
            </div>
          </section>

          {/* Artikel 8 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              Artikel 8 — Aansprakelijkheid
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>8.1. Sanders Capital is niet aansprakelijk voor enige directe, indirecte, incidentele, bijzondere of gevolgschade die voortvloeit uit het gebruik van het platform of de content, waaronder maar niet beperkt tot financiële verliezen, gederfde winst of verlies van data.</p>
              <p>8.2. Sanders Capital garandeert niet dat het platform ononderbroken, foutloos of vrij van virussen of andere schadelijke componenten zal functioneren.</p>
              <p>8.3. Sanders Capital garandeert niet dat de aangeboden content volledig, juist of actueel is. De gebruiker is zelf verantwoordelijk voor het verifiëren van informatie en het nemen van beslissingen op basis daarvan.</p>
              <p>8.4. De totale aansprakelijkheid van Sanders Capital jegens de gebruiker is in alle gevallen beperkt tot het bedrag dat de gebruiker in de 12 maanden voorafgaand aan de schadeveroorzakende gebeurtenis aan Sanders Capital heeft betaald.</p>
            </div>
          </section>

          {/* Artikel 9 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              Artikel 9 — Privacy en gegevensbescherming
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>9.1. Sanders Capital verwerkt persoonsgegevens in overeenstemming met de Algemene Verordening Gegevensbescherming (AVG/GDPR).</p>
              <p>9.2. Bij registratie worden de volgende gegevens verzameld: naam, e-mailadres en accountvoorkeuren. Deze gegevens worden uitsluitend gebruikt voor het verlenen van toegang tot het platform en het leveren van de diensten.</p>
              <p>9.3. Persoonsgegevens worden niet verkocht aan of gedeeld met derden, tenzij dit noodzakelijk is voor de uitvoering van de diensten (bijv. betalingsverwerking) of wettelijk verplicht is.</p>
              <p>9.4. Gegevens worden opgeslagen op beveiligde servers. Sanders Capital neemt passende technische en organisatorische maatregelen om persoonsgegevens te beschermen tegen ongeautoriseerde toegang, verlies of misbruik.</p>
              <p>9.5. De gebruiker heeft het recht op inzage, correctie en verwijdering van persoonsgegevens. Verzoeken kunnen worden ingediend via sanderscapital@hotmail.com.</p>
              <p>9.6. Het platform maakt gebruik van functionele cookies die noodzakelijk zijn voor authenticatie en sessiebeheer. Er worden geen tracking cookies van derden geplaatst zonder toestemming.</p>
            </div>
          </section>

          {/* Artikel 10 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              Artikel 10 — Gebruiksregels
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>10.1. De gebruiker verplicht zich het platform uitsluitend te gebruiken voor persoonlijke, niet-commerciële doeleinden, tenzij schriftelijk anders overeengekomen.</p>
              <p>10.2. Het is de gebruiker verboden om:</p>
              <ul className="space-y-1 pl-5 list-disc">
                <li>Het platform te gebruiken op een wijze die in strijd is met wet- of regelgeving.</li>
                <li>Inbreuk te maken op de intellectuele eigendomsrechten van Sanders Capital of derden.</li>
                <li>Het platform te verstoren, overbelasten of de werking ervan te ondermijnen.</li>
                <li>Geautomatiseerde systemen (bots, scrapers) te gebruiken om content te verzamelen.</li>
                <li>Valse of misleidende informatie te verstrekken bij registratie.</li>
              </ul>
            </div>
          </section>

          {/* Artikel 11 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              Artikel 11 — Beëindiging
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>11.1. De gebruiker kan op elk moment het account verwijderen via het dashboard of door een verzoek te sturen naar sanderscapital@hotmail.com.</p>
              <p>11.2. Bij beëindiging van een premium abonnement behoudt de gebruiker toegang tot premium content tot het einde van de lopende abonnementsperiode.</p>
              <p>11.3. Sanders Capital kan het account van een gebruiker onmiddellijk opschorten of beëindigen bij overtreding van deze voorwaarden, zonder voorafgaande waarschuwing en zonder recht op restitutie.</p>
            </div>
          </section>

          {/* Artikel 12 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              Artikel 12 — Overmacht
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>12.1. Sanders Capital is niet aansprakelijk voor het niet of niet tijdig nakomen van verplichtingen als gevolg van overmacht, waaronder maar niet beperkt tot storingen in internet- of hostingdiensten, stroomuitval, cyberaanvallen of andere omstandigheden buiten de redelijke controle van Sanders Capital.</p>
            </div>
          </section>

          {/* Artikel 13 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              Artikel 13 — Toepasselijk recht en geschillen
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>13.1. Op deze algemene voorwaarden en alle overeenkomsten tussen Sanders Capital en de gebruiker is uitsluitend Nederlands recht van toepassing.</p>
              <p>13.2. Geschillen die voortvloeien uit of verband houden met deze voorwaarden worden bij uitsluiting voorgelegd aan de bevoegde rechter in het arrondissement waarin Sanders Capital is gevestigd.</p>
              <p>13.3. Alvorens een geschil voor te leggen aan de rechter, zullen partijen zich inspannen om het geschil in onderling overleg op te lossen.</p>
            </div>
          </section>

          {/* Artikel 14 */}
          <section>
            <h2 className="text-xl font-display font-semibold text-heading mb-3">
              Artikel 14 — Contactgegevens
            </h2>
            <div className="space-y-2 text-text-muted">
              <p>Sanders Capital</p>
              <p>E-mail: sanderscapital@hotmail.com</p>
              <p>Website: sanderscapital.nl</p>
            </div>
          </section>

          {/* Slotbepaling */}
          <section className="pt-4 border-t border-border">
            <p className="text-xs text-text-dim">
              Indien een of meerdere bepalingen van deze algemene voorwaarden nietig of vernietigbaar
              blijken, tast dit de geldigheid van de overige bepalingen niet aan. In plaats van de
              nietige of vernietigde bepaling geldt een bepaling die het doel en de strekking van de
              oorspronkelijke bepaling zo dicht mogelijk benadert.
            </p>
          </section>
        </div>
      </FadeIn>
    </div>
  )
}
