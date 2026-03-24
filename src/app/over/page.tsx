import FadeIn from '@/components/FadeIn'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Over',
  description: 'Over Sanders Capital — educatieve content over financiële markten.',
}

export default function OverPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <FadeIn>
        <h1 className="text-4xl md:text-5xl font-display font-semibold text-heading mb-6">
          Over Sanders Capital
        </h1>
      </FadeIn>

      <FadeIn delay={100}>
        <div className="space-y-6 text-text leading-relaxed">
          <p>
            Sanders Capital is een educatief platform gericht op financiële markten. We geloven dat
            gestructureerde kennis, discipline en een data-gedreven aanpak de fundamenten zijn van
            elke succesvolle marktbenadering.
          </p>

          <p>
            Ons doel is om hoogwaardige, toegankelijke educatieve content te bieden die mensen helpt
            een solide fundament op te bouwen. Van marktstructuur en technische analyse tot
            psychologie en risicomanagement — we behandelen de onderwerpen die er echt toe doen.
          </p>

          <h2 className="text-2xl font-display font-semibold text-heading pt-4">Onze aanpak</h2>

          <p>
            We geloven niet in shortcuts of get-rich-quick schema&apos;s. Onze content is gebouwd op
            het principe dat duurzaam succes voortkomt uit diepgaande kennis, consistent gedrag en
            eerlijke zelfreflectie.
          </p>

          <p>
            Elke module in onze kennisbank en elk artikel op onze blog is ontworpen om je niet alleen
            kennis bij te brengen, maar ook de frameworks waarmee je die kennis kunt toepassen.
          </p>

          <h2 className="text-2xl font-display font-semibold text-heading pt-4">Community</h2>

          <p>
            Sanders Capital is meer dan een website — het is een community van mensen die
            geïnteresseerd zijn in financiële markten en bereid zijn om te investeren in hun eigen
            ontwikkeling. Via onze sociale kanalen en premium community delen leden inzichten,
            stellen vragen en groeien samen.
          </p>

          <h2 className="text-2xl font-display font-semibold text-heading pt-4">Belangrijk</h2>

          <p className="text-text-muted">
            Alle content op Sanders Capital is puur educatief van aard. Niets op deze website
            constitueert financieel advies. Handel op financiële markten brengt risico&apos;s met zich
            mee en is niet geschikt voor iedereen. Lees onze volledige disclaimer voor meer
            informatie.
          </p>
        </div>
      </FadeIn>
    </div>
  )
}
