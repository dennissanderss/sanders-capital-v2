'use client'

import Link from 'next/link'

const indicators = [
  {
    name: 'CPI (Consumer Price Index)',
    aka: 'Consumentenprijsindex / Inflatie',
    impact: 'Hoog',
    currencies: ['USD', 'EUR', 'GBP', 'Alle majors'],
    what: 'Meet de gemiddelde prijsverandering van een mandje consumptiegoederen en diensten. Het is de belangrijkste maatstaf voor inflatie.',
    whyImportant: 'Centrale banken gebruiken CPI als leidraad voor rentebeleid. Hoge inflatie leidt tot renteverhogingen, lage inflatie tot renteverlagingen.',
    actualBetter: 'CPI lager dan verwacht → inflatie neemt af → centrale bank kan rente verlagen → valuta daalt op korte termijn, aandelen stijgen.',
    actualWorse: 'CPI hoger dan verwacht → inflatie stijgt → centrale bank zal rente verhogen → valuta stijgt op korte termijn, aandelen dalen.',
    frequency: 'Maandelijks',
    note: 'Let ook op Core CPI (exclusief voedsel en energie) — dit is vaak belangrijker voor de markt omdat het minder volatiel is.',
  },
  {
    name: 'NFP (Non-Farm Payrolls)',
    aka: 'Arbeidsmarktrapport VS',
    impact: 'Zeer hoog',
    currencies: ['USD', 'Alle paren met USD'],
    what: 'Het aantal nieuwe banen dat is gecreëerd in de VS, exclusief de landbouwsector. Wordt elke eerste vrijdag van de maand gepubliceerd.',
    whyImportant: 'De arbeidsmarkt is een van de twee mandaten van de Fed (naast prijsstabiliteit). Sterke werkgelegenheid geeft de Fed ruimte om rente hoog te houden.',
    actualBetter: 'Meer banen dan verwacht → sterke economie → Fed houdt rente hoog of verhoogt → USD stijgt.',
    actualWorse: 'Minder banen dan verwacht → zwakke economie → Fed kan rente verlagen → USD daalt.',
    frequency: 'Maandelijks (eerste vrijdag)',
    note: 'Naast het aantal banen kijkt de markt ook naar het werkloosheidspercentage en gemiddelde uurlonen (Average Hourly Earnings).',
  },
  {
    name: 'PMI (Purchasing Managers Index)',
    aka: 'Inkoopmanagersindex',
    impact: 'Hoog',
    currencies: ['USD', 'EUR', 'GBP', 'CNY'],
    what: 'Een enquête onder inkoopmanagers over de economische omstandigheden in hun sector. Een score boven 50 = groei, onder 50 = krimp.',
    whyImportant: 'PMI is een leidende indicator — het geeft een vroeg signaal over de richting van de economie voordat officiële cijfers beschikbaar zijn.',
    actualBetter: 'PMI hoger dan verwacht (of boven 50) → economie groeit → valuta stijgt.',
    actualWorse: 'PMI lager dan verwacht (of onder 50) → economie krimpt → valuta daalt.',
    frequency: 'Maandelijks',
    note: 'Er zijn twee varianten: Manufacturing PMI (industrie) en Services PMI (diensten). De Flash PMI is een vroege schatting, de Final PMI de definitieve versie.',
  },
  {
    name: 'GDP (Gross Domestic Product)',
    aka: 'BBP — Bruto Binnenlands Product',
    impact: 'Hoog',
    currencies: ['Alle majors'],
    what: 'De totale waarde van alle goederen en diensten die in een land worden geproduceerd. Het is de breedste maatstaf voor economische activiteit.',
    whyImportant: 'GDP toont of een economie groeit of krimpt. Twee kwartalen van krimp = technische recessie.',
    actualBetter: 'GDP hoger dan verwacht → economie sterker dan gedacht → valuta stijgt.',
    actualWorse: 'GDP lager dan verwacht → economie zwakker → valuta daalt.',
    frequency: 'Kwartaal (met preliminaire, herziene en finale release)',
    note: 'De markt reageert het sterkst op de eerste release (Advance GDP). Herzieningen hebben minder impact tenzij het verschil groot is.',
  },
  {
    name: 'Interest Rate Decision',
    aka: 'Rentebesluit',
    impact: 'Zeer hoog',
    currencies: ['Valuta van betreffende centrale bank'],
    what: 'Het besluit van een centrale bank over de beleidsrente. Dit is het primaire instrument waarmee centrale banken de economie sturen.',
    whyImportant: 'Rente is de prijs van geld. Hogere rente maakt een valuta aantrekkelijker voor beleggers (hogere opbrengst), lagere rente minder.',
    actualBetter: 'Rente hoger dan verwacht (hawkish) → valuta stijgt sterk.',
    actualWorse: 'Rente lager dan verwacht (dovish) → valuta daalt sterk.',
    frequency: 'Elke 6-8 weken (verschilt per centrale bank)',
    note: 'Vaak is het niet het besluit zelf maar het begeleidende statement en de persconferentie die de meeste volatiliteit veroorzaken. De toon (hawkish vs dovish) is cruciaal.',
  },
  {
    name: 'Unemployment Rate',
    aka: 'Werkloosheidspercentage',
    impact: 'Hoog',
    currencies: ['USD', 'EUR', 'GBP', 'AUD', 'CAD'],
    what: 'Het percentage van de beroepsbevolking dat actief werk zoekt maar geen baan heeft.',
    whyImportant: 'Een dalende werkloosheid duidt op een sterke economie en kan leiden tot hogere lonen en inflatie.',
    actualBetter: 'Werkloosheid lager dan verwacht → sterke arbeidsmarkt → valuta stijgt.',
    actualWorse: 'Werkloosheid hoger dan verwacht → zwakke arbeidsmarkt → valuta daalt.',
    frequency: 'Maandelijks',
    note: 'In de VS wordt dit samen met NFP gepubliceerd. Let ook op de participatiegraad — een dalende werkloosheid door mensen die stoppen met zoeken is misleidend.',
  },
  {
    name: 'Retail Sales',
    aka: 'Detailhandelsverkopen',
    impact: 'Hoog',
    currencies: ['USD', 'GBP', 'EUR', 'AUD', 'CAD'],
    what: 'Meet de totale waarde van verkopen op detailhandelsniveau. Het is een directe maatstaf voor consumentenbestedingen.',
    whyImportant: 'Consumentenbestedingen vormen circa 70% van de economie in ontwikkelde landen. Sterke retail sales = sterke economie.',
    actualBetter: 'Verkopen hoger dan verwacht → consumenten besteden meer → economie groeit → valuta stijgt.',
    actualWorse: 'Verkopen lager dan verwacht → consumenten houden geld vast → economie vertraagt → valuta daalt.',
    frequency: 'Maandelijks',
    note: 'Kijk ook naar Core Retail Sales (exclusief auto\'s) voor een stabieler beeld.',
  },
  {
    name: 'Trade Balance',
    aka: 'Handelsbalans',
    impact: 'Medium',
    currencies: ['USD', 'EUR', 'GBP', 'AUD', 'NZD', 'CAD'],
    what: 'Het verschil tussen de export en import van een land. Een positief getal = handelsoverschot, negatief = handelstekort.',
    whyImportant: 'Een handelsoverschot betekent dat er meer vraag is naar de valuta van het exporterende land.',
    actualBetter: 'Groter overschot of kleiner tekort dan verwacht → meer vraag naar valuta → valuta stijgt.',
    actualWorse: 'Groter tekort dan verwacht → minder vraag naar valuta → valuta daalt.',
    frequency: 'Maandelijks',
    note: 'Vooral belangrijk voor grondstof-exporterende landen zoals Australië, Nieuw-Zeeland en Canada.',
  },
  {
    name: 'PPI (Producer Price Index)',
    aka: 'Producentenprijsindex',
    impact: 'Medium-Hoog',
    currencies: ['USD', 'EUR', 'GBP'],
    what: 'Meet de prijsverandering vanuit het perspectief van de producent. Het is een vroege indicator van consumenteninflatie (CPI).',
    whyImportant: 'Als producenten meer betalen voor grondstoffen, worden die kosten uiteindelijk doorberekend aan consumenten → hogere CPI.',
    actualBetter: 'PPI lager dan verwacht → minder inflatiedruk → valuta daalt (verwachting van lagere rente).',
    actualWorse: 'PPI hoger dan verwacht → meer inflatiedruk → valuta stijgt (verwachting van hogere rente).',
    frequency: 'Maandelijks',
    note: 'PPI wordt vaak een dag voor CPI gepubliceerd en kan een hint geven over de CPI-uitkomst.',
  },
  {
    name: 'Consumer Confidence',
    aka: 'Consumentenvertrouwen',
    impact: 'Medium',
    currencies: ['USD', 'EUR'],
    what: 'Een enquête die meet hoe optimistisch consumenten zijn over de huidige en toekomstige economische situatie.',
    whyImportant: 'Optimistische consumenten besteden meer geld. Het is een voorlopende indicator van retail sales en economische groei.',
    actualBetter: 'Vertrouwen hoger dan verwacht → consumenten optimistisch → verwachting van meer bestedingen → valuta stijgt.',
    actualWorse: 'Vertrouwen lager dan verwacht → consumenten pessimistisch → minder bestedingen verwacht → valuta daalt.',
    frequency: 'Maandelijks',
    note: 'In de VS zijn er twee varianten: Conference Board Consumer Confidence (dinsdag) en University of Michigan Sentiment (vrijdag).',
  },
  {
    name: 'Housing Data',
    aka: 'Woningmarktcijfers',
    impact: 'Medium',
    currencies: ['USD', 'GBP', 'AUD', 'NZD', 'CAD'],
    what: 'Verschillende indicatoren over de woningmarkt: bouwvergunningen, huizenverkopen, huizenprijzen.',
    whyImportant: 'De woningmarkt is een grote sector en gevoelig voor rentewijzigingen. Het geeft een signaal over de gezondheid van de bredere economie.',
    actualBetter: 'Sterker dan verwacht → gezonde economie → valuta stijgt.',
    actualWorse: 'Zwakker dan verwacht → economische vertraging → valuta daalt.',
    frequency: 'Maandelijks (verschillende rapporten)',
    note: 'Vooral belangrijk in landen waar de huizenmarkt een groot deel van de economie uitmaakt (VS, Australië, VK, Canada).',
  },
  {
    name: 'Central Bank Minutes',
    aka: 'Notulen centrale bank',
    impact: 'Hoog',
    currencies: ['Valuta van betreffende centrale bank'],
    what: 'De gedetailleerde notulen van de laatste vergadering van een centrale bank. Ze worden meestal 2-3 weken na het rentebesluit gepubliceerd.',
    whyImportant: 'De notulen onthullen hoe de stemverhoudingen lagen en wat de overwegingen waren — dit geeft hints over toekomstig beleid.',
    actualBetter: 'Hawkish toon (meer leden voor hoge rente) → valuta stijgt.',
    actualWorse: 'Dovish toon (meer leden voor lagere rente) → valuta daalt.',
    frequency: '2-3 weken na elk rentebesluit',
    note: 'FOMC Minutes (Fed), ECB Minutes, BoE Minutes. De markt zoekt naar veranderingen in taal ten opzichte van vorige notulen.',
  },
  {
    name: 'Employment Change / Claimant Count',
    aka: 'Werkgelegenheidsverandering',
    impact: 'Hoog',
    currencies: ['GBP', 'AUD', 'CAD', 'EUR'],
    what: 'Het aantal nieuwe banen of werkloosheidsuitkeringen. De Britse variant heet Claimant Count, de Australische Employment Change.',
    whyImportant: 'Vergelijkbaar met NFP maar dan voor andere landen. Geeft inzicht in de arbeidsmarktkracht.',
    actualBetter: 'Meer banen / minder uitkeringen dan verwacht → sterke economie → valuta stijgt.',
    actualWorse: 'Minder banen / meer uitkeringen dan verwacht → zwakke economie → valuta daalt.',
    frequency: 'Maandelijks',
    note: 'De Australische Employment Change staat bekend om grote verrassingen en hoge volatiliteit in AUD.',
  },
]

function ImpactBadge({ level }: { level: string }) {
  const color = level === 'Zeer hoog' ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : level === 'Hoog' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${color}`}>{level}</span>
  )
}

export default function BegrippenContent({ hasAccess }: { hasAccess: boolean }) {
  if (!hasAccess) {
    // Show first 2 indicators as preview, then premium gate
    const preview = indicators.slice(0, 2)
    return (
      <>
        {/* Quick reference */}
        <div className="mb-12 p-6 rounded-xl bg-bg-card border border-border">
          <h2 className="text-lg font-display font-semibold text-heading mb-4">Hoe lees je economische data?</h2>
          <div className="space-y-3 text-sm text-text">
            <p>Bij elk economisch event zie je drie getallen:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
              <div className="p-3 rounded-lg bg-bg border border-border">
                <p className="font-semibold text-heading mb-1">Previous</p>
                <p className="text-text-muted text-xs">Het resultaat van de vorige periode</p>
              </div>
              <div className="p-3 rounded-lg bg-bg border border-border">
                <p className="font-semibold text-heading mb-1">Forecast</p>
                <p className="text-text-muted text-xs">De verwachting van analisten</p>
              </div>
              <div className="p-3 rounded-lg bg-bg border border-border">
                <p className="font-semibold text-heading mb-1">Actual</p>
                <p className="text-text-muted text-xs">Het werkelijke resultaat</p>
              </div>
            </div>
            <p>De markt reageert op het <strong className="text-heading">verschil tussen Actual en Forecast</strong>. Als het actual cijfer al ingeprijsd is (gelijk aan forecast), beweegt de markt nauwelijks. De verrassing is wat telt.</p>
          </div>
        </div>

        {/* Preview indicators */}
        <div className="space-y-6 relative">
          {preview.map((ind) => (
            <div key={ind.name} className="rounded-xl bg-bg-card border border-border overflow-hidden">
              <div className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-xl font-display font-semibold text-heading">{ind.name}</h2>
                    <p className="text-sm text-text-muted">{ind.aka}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ImpactBadge level={ind.impact} />
                    <span className="text-xs text-text-dim">{ind.frequency}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {ind.currencies.map((c) => (
                    <span key={c} className="px-2 py-0.5 rounded bg-bg border border-border text-xs font-mono text-text-muted">{c}</span>
                  ))}
                </div>
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-heading mb-1">Wat is het?</h3>
                  <p className="text-sm text-text">{ind.what}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-heading mb-1">Waarom belangrijk?</h3>
                  <p className="text-sm text-text">{ind.whyImportant}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Premium gate overlay */}
          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center pb-8 pt-32 bg-gradient-to-t from-bg via-bg/95 to-transparent">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-gold-dim flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h3 className="text-lg font-display font-semibold text-heading mb-2">Premium Content</h3>
              <p className="text-sm text-text-muted mb-5 max-w-md">
                Alle {indicators.length} economische indicatoren uitgelegd — beschikbaar voor premium leden.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link
                  href="/kennisbank"
                  className="px-5 py-2.5 rounded-lg border border-border text-sm text-text-muted hover:text-heading transition-colors"
                >
                  Terug naar kennisbank
                </Link>
                <Link
                  href="/premium"
                  className="px-5 py-2.5 rounded-lg bg-gold/20 border border-gold/30 text-sm text-gold font-medium hover:bg-gold/30 transition-colors"
                >
                  Bekijk Premium
                </Link>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Full access
  return (
    <>
      {/* Quick reference */}
      <div className="mb-12 p-6 rounded-xl bg-bg-card border border-border">
        <h2 className="text-lg font-display font-semibold text-heading mb-4">Hoe lees je economische data?</h2>
        <div className="space-y-3 text-sm text-text">
          <p>Bij elk economisch event zie je drie getallen:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
            <div className="p-3 rounded-lg bg-bg border border-border">
              <p className="font-semibold text-heading mb-1">Previous</p>
              <p className="text-text-muted text-xs">Het resultaat van de vorige periode</p>
            </div>
            <div className="p-3 rounded-lg bg-bg border border-border">
              <p className="font-semibold text-heading mb-1">Forecast</p>
              <p className="text-text-muted text-xs">De verwachting van analisten</p>
            </div>
            <div className="p-3 rounded-lg bg-bg border border-border">
              <p className="font-semibold text-heading mb-1">Actual</p>
              <p className="text-text-muted text-xs">Het werkelijke resultaat</p>
            </div>
          </div>
          <p>De markt reageert op het <strong className="text-heading">verschil tussen Actual en Forecast</strong>. Als het actual cijfer al ingeprijsd is (gelijk aan forecast), beweegt de markt nauwelijks. De verrassing is wat telt.</p>
        </div>
      </div>

      {/* Impact legend */}
      <div className="mb-8 flex flex-wrap gap-4 justify-center">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-xs text-text-muted">Zeer hoge impact</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-xs text-text-muted">Hoge impact</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span className="text-xs text-text-muted">Medium impact</span>
        </div>
      </div>

      {/* All indicators */}
      <div className="space-y-6">
        {indicators.map((ind) => (
          <div key={ind.name} id={ind.name.split(' ')[0].toLowerCase()} className="rounded-xl bg-bg-card border border-border overflow-hidden">
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-display font-semibold text-heading">{ind.name}</h2>
                  <p className="text-sm text-text-muted">{ind.aka}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ImpactBadge level={ind.impact} />
                  <span className="text-xs text-text-dim">{ind.frequency}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {ind.currencies.map((c) => (
                  <span key={c} className="px-2 py-0.5 rounded bg-bg border border-border text-xs font-mono text-text-muted">{c}</span>
                ))}
              </div>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-heading mb-1">Wat is het?</h3>
                <p className="text-sm text-text">{ind.what}</p>
              </div>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-heading mb-1">Waarom belangrijk?</h3>
                <p className="text-sm text-text">{ind.whyImportant}</p>
              </div>
              <div className="grid md:grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <h3 className="text-sm font-semibold text-green-400 mb-1">Actual beter dan Forecast</h3>
                  <p className="text-xs text-text">{ind.actualBetter}</p>
                </div>
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <h3 className="text-sm font-semibold text-red-400 mb-1">Actual slechter dan Forecast</h3>
                  <p className="text-xs text-text">{ind.actualWorse}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-accent-glow border border-accent/20">
                <p className="text-xs text-text-muted"><strong className="text-accent-light">Tip:</strong> {ind.note}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 p-4 rounded-xl bg-bg-card border border-border">
        <p className="text-xs text-text-dim text-center">
          Disclaimer: Deze informatie is puur educatief. Economische indicatoren zijn complex en marktreacties zijn niet altijd voorspelbaar.
          Context, verwachtingen en marktsentiment spelen allemaal een rol. Dit is geen financieel advies.
        </p>
      </div>
    </>
  )
}
