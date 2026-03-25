import FadeIn from '@/components/FadeIn'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Over',
  description: 'Over Dennis Sanders — het verhaal achter Sanders Capital.',
}

const timeline = [
  {
    year: '2022',
    title: 'Eerste stappen',
    text: 'Tijdens mijn studie Accountancy raakte ik gefascineerd door de financiële markten. Ik begon met patronen traden. Klassieke chart patterns, hoge leverage, bij brokers waar niemand die serieus tradet ooit zou zitten. Veel enthousiasme, weinig begrip van risico. Zoals de meeste beginners dacht ik dat een paar YouTube-video\u2019s genoeg waren.',
  },
  {
    year: '2023',
    title: 'Verlies, frustratie, zoektocht',
    text: 'Het eerste jaar enthousiasme maakte plaats voor inconsistentie en verlies. Ik ontdekte ICT-modellen en dook diep in complexe technische analyse. Te diep. Ik verdronk in concepten zonder dat ik een duidelijk systeem had. Funded accounts gehaald en weer verloren. Niet \u00e9\u00e9n keer, meerdere keren. Dit was de fase waarin de meeste traders stoppen. Ik stopte niet, maar ik had ook nog geen antwoord.',
  },
  {
    year: '2024',
    title: 'Van chaos naar methode',
    text: 'Het keerpunt. Ik stopte met elke nieuwe strategie najagen en begon met terugkijken. Data verzamelen, trades loggen, patronen herkennen in mijn eigen gedrag. Niet de markt was het probleem, mijn proces was het probleem. Ik ontwikkelde een eigen methodiek en begon mijn trades mechanisch te evalueren. Minder trades, meer kwaliteit.',
  },
  {
    year: '2025',
    title: 'Het proces verfijnen',
    text: 'Nu bouw ik mijn eigen tools. Een persoonlijk trading dashboard, data-analyse systemen, gestructureerde journaling. Ben ik al consistent winstgevend? Nee, nog niet. Maar het verschil met twee jaar geleden is dag en nacht. Ik heb een methodiek, ik heb data, en ik heb een proces dat ik elke week kan evalueren en verbeteren. Tegelijkertijd rond ik mijn studie Accountancy af. Sanders Capital is het platform waar ik deze reis deel. Niet vanuit de finish, maar onderweg.',
  },
]

const currentFocus = [
  'Afstuderen HBO Accountancy',
  'Data-gedreven trading strategie verfijnen',
  'Eigen tools bouwen (trading dashboard, journal systeem)',
  'Sanders Capital community laten groeien',
]

export default function OverPage() {
  return (
    <div className="py-24">
      {/* Intro */}
      <section className="max-w-3xl mx-auto px-6 mb-24">
        <FadeIn>
          <div className="flex flex-col sm:flex-row items-start gap-8">
            {/* Profile photo */}
            <div className="w-32 h-44 sm:w-36 sm:h-52 rounded-2xl overflow-hidden border border-border shrink-0">
              <Image
                src="/assets/images/dennis2.jpg"
                alt="Dennis Sanders"
                width={144}
                height={208}
                className="w-full h-full object-cover object-center"
                priority
              />
            </div>

            <div>
              <h1 className="text-4xl md:text-5xl font-display font-semibold text-heading mb-2">
                Dennis Sanders
              </h1>
              <p className="text-sm tracking-wide text-accent-light mb-5">
                Accountancystudent. Trader. Data-gedreven.
              </p>
              <p className="text-text leading-relaxed">
                Ik ben Dennis, oprichter van Sanders Capital. Geen guru, geen koopsignalen.
                Gewoon iemand die al 4 jaar lang de markt bestudeert, fouten maakt, data
                verzamelt, en stap voor stap een beter proces bouwt.
              </p>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Timeline */}
      <section className="max-w-4xl mx-auto px-6 mb-24">
        <FadeIn>
          <h2 className="text-2xl font-display font-semibold text-heading text-center mb-16">
            Het verhaal
          </h2>
        </FadeIn>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-border md:-translate-x-px" />

          {timeline.map((item, i) => {
            const isLeft = i % 2 === 0
            return (
              <FadeIn key={item.year} delay={i * 150}>
                <div className={`relative flex items-start mb-16 last:mb-0 ${
                  isLeft ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}>
                  {/* Node */}
                  <div className="absolute left-6 md:left-1/2 w-3 h-3 rounded-full bg-accent border-2 border-bg -translate-x-1.5 mt-2 z-10" />

                  {/* Year badge - mobile */}
                  <div className="md:hidden pl-14 mb-2">
                    <span className="text-xs font-medium tracking-wider text-accent-light bg-accent-glow px-2.5 py-1 rounded-md">
                      {item.year}
                    </span>
                  </div>

                  {/* Content card */}
                  <div className={`ml-14 md:ml-0 md:w-[calc(50%-2rem)] ${
                    isLeft ? 'md:mr-auto md:pr-0' : 'md:ml-auto md:pl-0'
                  }`}>
                    {/* Year badge - desktop */}
                    <div className="hidden md:block mb-2">
                      <span className="text-xs font-medium tracking-wider text-accent-light bg-accent-glow px-2.5 py-1 rounded-md">
                        {item.year}
                      </span>
                    </div>

                    <div className="p-6 rounded-xl bg-bg-card border border-border hover:border-border-light transition-colors">
                      <h3 className="text-lg font-display font-semibold text-heading mb-3">
                        {item.title}
                      </h3>
                      <p className="text-sm text-text leading-relaxed">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            )
          })}
        </div>
      </section>

      {/* Missie */}
      <section className="max-w-3xl mx-auto px-6 mb-24">
        <FadeIn>
          <div className="p-8 rounded-xl bg-bg-card border border-border text-center">
            <h2 className="text-2xl font-display font-semibold text-heading mb-6">
              Waarom dit platform
            </h2>
            <div className="text-text leading-relaxed max-w-2xl mx-auto space-y-4">
              <p>
                Er zijn genoeg community&apos;s van twee- of drieduizend euro waar grote beloftes worden
                gemaakt. Geen trackrecord, geen eerlijke ervaring, geen data. Alleen marketing en
                FOMO. Te veel influencers in deze industrie verdienen hun geld aan commissies en
                affiliate deals, niet aan hun eigen trades. Dat is niet wat ik bouw.
              </p>
              <p>
                Sanders Capital is gebouwd op een simpel principe: waardevolle kennis hoort
                toegankelijk te zijn, en gratis kennis hoort niet oppervlakkig te zijn. Wat je hier
                vindt is gestructureerde educatie vanuit een achtergrond in accountancy en
                data-analyse.
              </p>
              <p className="text-text-muted">
                Ik deel wat ik leer, terwijl ik het leer. Geen heilige graal, geen shortcuts. Gewoon
                eerlijke data, gestructureerde kennis en de discipline om het vol te houden wanneer
                het moeilijk wordt.
              </p>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Huidige focus */}
      <section className="max-w-3xl mx-auto px-6 mb-24">
        <FadeIn>
          <h2 className="text-2xl font-display font-semibold text-heading text-center mb-8">
            Waar ik nu mee bezig ben
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {currentFocus.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-4 rounded-xl bg-bg-card border border-border"
              >
                <div className="w-8 h-8 rounded-lg bg-accent-glow flex items-center justify-center text-accent-light shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="text-sm text-text">{item}</span>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* Disclaimer */}
      <section className="max-w-3xl mx-auto px-6">
        <FadeIn>
          <p className="text-xs text-text-dim text-center leading-relaxed">
            Alle content op Sanders Capital is puur educatief van aard en vormt geen financieel
            advies. Handel op financi\u00eble markten brengt risico&apos;s met zich mee. Lees de
            volledige disclaimer voor meer informatie.
          </p>
        </FadeIn>
      </section>
    </div>
  )
}
