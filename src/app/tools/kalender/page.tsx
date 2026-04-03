'use client'

import { useState, useEffect, Fragment, useCallback } from 'react'

interface CalendarEvent {
  title: string
  currency: string
  date: string
  impact: string
  forecast: string
  previous: string
  actual: string
  flag: string
  countryName: string
}

interface CalendarResponse {
  events: CalendarEvent[]
  meetings: CalendarEvent[]
  count: number
  fetchedAt: string
}

function flagEmoji(code: string) {
  if (!code) return ''
  return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('')
}

function ImpactDot({ impact }: { impact: string }) {
  const color = impact === 'hoog' ? 'bg-red-500'
    : impact === 'medium' ? 'bg-amber-500'
    : impact === 'laag' ? 'bg-yellow-400'
    : impact === 'feestdag' ? 'bg-gray-500'
    : 'bg-gray-600'
  return <span className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
}

function ImpactBadge({ impact }: { impact: string }) {
  const color = impact === 'hoog' ? 'bg-red-500/15 text-red-400 border-red-500/20'
    : impact === 'medium' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    : impact === 'laag' ? 'bg-yellow-400/15 text-yellow-400 border-yellow-400/20'
    : 'bg-white/5 text-text-dim border-border'
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${color} capitalize`}>{impact}</span>
}

/* ─── Event explanation generator ────────────────────────── */
interface EventExplanation {
  what: string
  betterThanExpected: string
  worseThanExpected: string
  waaromBeter: string
  waaromSlechter: string
}

function getEventExplanation(event: CalendarEvent): EventExplanation {
  const t = event.title.toLowerCase()
  const ccy = event.currency

  if (t.includes('cpi') || t.includes('inflation') || t.includes('price index') || t.includes('pce') || t.includes('ppi') || t.includes('producer price')) {
    const isCore = t.includes('core') || t.includes('kern')
    const isCpi = t.includes('cpi') || t.includes('consumer price') || t.includes('pce')
    const isPpi = t.includes('ppi') || t.includes('producer price')
    return {
      what: isPpi
        ? `Meet de verandering in producentenprijzen. PPI is een voorloper van consumenteninflatie: als fabrieken meer betalen, stijgen uiteindelijk ook de winkelprijzen.${isCore ? ' De kern-variant sluit voedsel en energie uit voor een stabieler beeld.' : ''}`
        : `Meet de verandering in consumentenprijzen${isCore ? ' (excl. voedsel en energie)' : ''}. Dit is de belangrijkste indicator voor inflatie en beïnvloedt direct het rentebeleid van de centrale bank.`,
      betterThanExpected: `Hoger dan verwacht = inflatiedruk = hawkish voor ${ccy}. ${ccy} wordt sterker.`,
      worseThanExpected: `Lager dan verwacht = inflatie daalt = dovish voor ${ccy}. ${ccy} wordt zwakker.`,
      waaromBeter: `Hogere inflatie dan verwacht betekent dat prijzen sneller stijgen. De centrale bank moet de rente hoog houden (of zelfs verhogen) om de inflatie af te remmen. Hogere rentes trekken buitenlands kapitaal aan, omdat beleggers meer rendement krijgen op obligaties en spaartegoeden in ${ccy}. Die extra vraag naar ${ccy} drijft de koers omhoog.`,
      waaromSlechter: `Lagere inflatie dan verwacht betekent dat prijzen minder snel stijgen dan gedacht. De centrale bank krijgt ruimte om de rente te verlagen om de economie te stimuleren. Lagere rentes maken beleggen in ${ccy} minder aantrekkelijk vergeleken met andere valuta's. Kapitaal stroomt weg, waardoor ${ccy} zwakker wordt.`,
    }
  }
  if (t.includes('employment') || t.includes('payroll') || t.includes('nfp') || t.includes('non-farm') || t.includes('employment change')) {
    return {
      what: `Meet het aantal nieuwe banen (excl. landbouw). Dit is een van de belangrijkste indicatoren voor de gezondheid van de arbeidsmarkt en economie.`,
      betterThanExpected: `Meer banen dan verwacht = sterke economie = hawkish. ${ccy} wordt sterker.`,
      worseThanExpected: `Minder banen dan verwacht = zwakkere economie = dovish. ${ccy} wordt zwakker.`,
      waaromBeter: `Meer banen dan verwacht betekent een sterkere economie. Meer werkenden betekent meer inkomens en meer consumentenbestedingen, wat de economische groei aandrijft. De centrale bank heeft dan minder reden om rentes te verlagen, omdat de economie al goed draait. Hogere rentes (of de verwachting daarvan) maken ${ccy} aantrekkelijker voor internationale beleggers die op zoek zijn naar rendement.`,
      waaromSlechter: `Minder banen dan verwacht wijst op een vertragende economie. Minder werkenden betekent minder inkomens en minder bestedingen. De centrale bank zal eerder overwegen om rentes te verlagen om de economie te stimuleren en werkgelegenheid te bevorderen. Die verwachting van lagere rentes maakt ${ccy} minder aantrekkelijk voor beleggers, waardoor kapitaal wegstroomt en de valuta zwakker wordt.`,
    }
  }
  if (t.includes('claim') || t.includes('unemployment') || t.includes('jobless')) {
    const isClaims = t.includes('claim') || t.includes('jobless')
    return {
      what: isClaims
        ? `Wekelijks aantal werkloosheidsaanvragen. Lager = minder mensen worden ontslagen = sterkere arbeidsmarkt. Dit is een van de meest actuele arbeidsmarktindicatoren.`
        : `Meet het percentage van de beroepsbevolking dat werkloos is. Een lagere werkloosheid wijst op een sterkere economie.`,
      betterThanExpected: isClaims
        ? `Minder claims dan verwacht = sterke arbeidsmarkt = hawkish voor ${ccy}.`
        : `Lagere werkloosheid dan verwacht = sterkere economie = hawkish voor ${ccy}.`,
      worseThanExpected: isClaims
        ? `Meer claims dan verwacht = zwakkere arbeidsmarkt = dovish voor ${ccy}.`
        : `Hogere werkloosheid dan verwacht = zwakkere economie = dovish voor ${ccy}.`,
      waaromBeter: isClaims
        ? `Minder werkloosheidsaanvragen dan verwacht wijst erop dat bedrijven minder mensen ontslaan. Dit signaleert vertrouwen bij werkgevers en economische stabiliteit. De centrale bank ziet geen noodzaak om de rente te verlagen ter stimulering. Rentes blijven hoog of gaan omhoog, wat buitenlands kapitaal aantrekt en ${ccy} sterker maakt.`
        : `Een lagere werkloosheid betekent dat meer mensen werken en geld uitgeven. Dit houdt de economie sterk en geeft de centrale bank ruimte om de rente hoog te houden. Hogere rentes maken ${ccy} aantrekkelijker voor internationale beleggers, wat de koers opdrijft.`,
      waaromSlechter: isClaims
        ? `Meer werkloosheidsaanvragen dan verwacht betekent dat meer mensen hun baan verliezen. Dit is een signaal van economische verzwakking. Bedrijven krimpen of gaan failliet. De centrale bank zal de rente eerder verlagen om de economie te ondersteunen en banen te behouden. Lagere rentes maken ${ccy} minder aantrekkelijk, waardoor beleggers hun geld elders beleggen.`
        : `Hogere werkloosheid betekent dat meer mensen geen baan vinden. Dit remt consumentenbestedingen en economische groei. De centrale bank zal eerder de rente verlagen om bedrijven en consumenten te stimuleren. Lagere rentevooruitzichten maken ${ccy} minder aantrekkelijk voor beleggers.`,
    }
  }
  if (t.includes('gdp') || t.includes('gross domestic')) {
    return {
      what: `Meet de totale economische output (groei) van een land. Het BBP is het meest complete overzicht van de economische gezondheid en beïnvloedt verwachtingen over rentebeleid.`,
      betterThanExpected: `Hogere groei dan verwacht = hawkish. ${ccy} wordt sterker.`,
      worseThanExpected: `Lagere groei dan verwacht = dovish. ${ccy} wordt zwakker.`,
      waaromBeter: `Hogere economische groei dan verwacht betekent dat bedrijven meer produceren, meer mensen werken en consumenten meer besteden. Een sterke economie geeft de centrale bank het vertrouwen om de rente hoog te houden of zelfs te verhogen, omdat er geen stimulering nodig is. Hogere rentes trekken buitenlandse investeringen aan die ${ccy} moeten kopen, waardoor de vraag naar en de waarde van ${ccy} stijgt.`,
      waaromSlechter: `Lagere groei dan verwacht signaleert dat de economie vertraagt. Bedrijven investeren minder, consumenten worden voorzichtiger. De centrale bank zal eerder de rente verlagen om lenen goedkoper te maken en de economie weer aan te jagen. De verwachting van lagere rentes maakt ${ccy} minder aantrekkelijk voor beleggers die op zoek zijn naar rendement, waardoor de valuta daalt.`,
    }
  }
  if (t.includes('pmi') || t.includes('purchasing manager')) {
    const isServices = t.includes('service')
    const isManuf = t.includes('manufactur')
    const sector = isServices ? 'dienstensector' : isManuf ? 'productiesector' : 'bedrijfssector'
    return {
      what: `Enquete onder inkoopmanagers in de ${sector}. Boven 50 = groei, onder 50 = krimp. Dit is een voorlopende indicator: inkoopmanagers bestellen vandaag wat de economie morgen produceert.`,
      betterThanExpected: `Hoger dan verwacht (zeker boven 50) = economie groeit = hawkish voor ${ccy}.`,
      worseThanExpected: `Lager dan verwacht (zeker onder 50) = economie krimpt = dovish voor ${ccy}.`,
      waaromBeter: `Een hogere PMI dan verwacht betekent dat inkoopmanagers meer orders plaatsen, meer personeel aannemen en hogere productie verwachten. Dit is een vroeg signaal van economische groei. De centrale bank heeft dan minder aanleiding om de rente te verlagen. Stabiele of stijgende rentes houden ${ccy} aantrekkelijk voor internationale beleggers.`,
      waaromSlechter: `Een lagere PMI dan verwacht (vooral onder 50) signaleert dat bedrijven krimpen: minder orders, minder productie, mogelijk ontslagen. Dit voorspelt economische vertraging. De centrale bank zal eerder ingrijpen met renteverlagingen om groei te stimuleren. De markt anticipeert hierop door ${ccy} te verkopen, waardoor de koers daalt.`,
    }
  }
  if (t.includes('ism') || t.includes('manufacturing')) {
    return {
      what: `ISM Manufacturing index: meet de gezondheid van de productiesector. Boven 50 = expansie, onder 50 = krimp. Een breed gevolgde indicator voor de richting van de economie.`,
      betterThanExpected: `Hoger dan verwacht = economie groeit = hawkish voor ${ccy}.`,
      worseThanExpected: `Lager dan verwacht = economie krimpt = dovish voor ${ccy}.`,
      waaromBeter: `Een hogere ISM dan verwacht betekent dat fabrieken meer produceren, meer bestellingen binnenkrijgen en meer personeel aannemen. Dit signaleert brede economische kracht. De centrale bank zal minder geneigd zijn om de rente te verlagen. Het vooruitzicht van aanhoudend hogere rentes maakt ${ccy} aantrekkelijker voor buitenlandse beleggers die rendement zoeken.`,
      waaromSlechter: `Een lagere ISM dan verwacht, vooral onder 50, signaleert krimp in de productiesector. Minder orders en productie wijzen op economische vertraging. De centrale bank zal eerder overwegen de rente te verlagen om de economie te ondersteunen. Verwachte lagere rentes verminderen de aantrekkingskracht van ${ccy} voor beleggers.`,
    }
  }
  if (t.includes('rate') || t.includes('interest') || t.includes('monetary policy') || t.includes('rate decision') || t.includes('cash rate')) {
    return {
      what: `Rentebeslissing van de centrale bank. Dit is het belangrijkste event op de kalender. De beleidsrente bepaalt direct de kosten van lenen en het rendement op sparen. Let ook op het statement en de persconferentie voor hints over toekomstig beleid.`,
      betterThanExpected: `Rente hoger dan verwacht of hawkish statement = ${ccy} sterker.`,
      worseThanExpected: `Rente lager dan verwacht of dovish statement = ${ccy} zwakker.`,
      waaromBeter: `Een hogere rente (of hawkish toon) dan de markt had ingeprijsd trekt direct internationaal kapitaal aan. Beleggers wereldwijd zoeken het hoogste rendement. Hogere rentes in ${ccy} betekenen hogere obligatierendementen en spaarrentes. Om die te kopen, moeten beleggers eerst ${ccy} kopen. Die extra vraag duwt de koers omhoog. Bovendien signaleert een hawkish bank vertrouwen in de economie.`,
      waaromSlechter: `Een lagere rente (of dovish toon) dan verwacht maakt ${ccy}-beleggingen minder rendabel. Beleggers verkopen obligaties in ${ccy} en verschuiven naar valuta's met hogere rentes. Die verkoopdruk verzwakt ${ccy}. Een dovish signaal suggereert ook dat de centrale bank zich zorgen maakt over de economische groei, wat het sentiment verder negatief beinvloedt.`,
    }
  }
  if (t.includes('retail') || t.includes('sales')) {
    return {
      what: `Meet de consumptieve bestedingen. Consumptie is typisch 60-70% van het BBP, waardoor dit een van de meest directe graadmeters is voor economische gezondheid.`,
      betterThanExpected: `Hogere verkopen dan verwacht = sterke consument = hawkish voor ${ccy}.`,
      worseThanExpected: `Lagere verkopen dan verwacht = zwakke consument = dovish voor ${ccy}.`,
      waaromBeter: `Hogere retail sales dan verwacht betekent dat consumenten meer geld uitgeven. Aangezien consumptie het grootste deel van de economie uitmaakt, signaleert dit economische kracht. Meer bestedingen kunnen ook prijzen opdrijven (inflatie). De centrale bank heeft dan minder reden om rentes te verlagen en kan zelfs hawkisher worden. Die renteverwachting maakt ${ccy} aantrekkelijker voor beleggers.`,
      waaromSlechter: `Lagere retail sales dan verwacht betekent dat consumenten de hand op de knip houden. Dit kan komen door onzekerheid, werkloosheid of dalend vertrouwen. Minder consumptie remt de economische groei, waardoor de centrale bank druk voelt om de rente te verlagen ter stimulering. Verwachte lagere rentes maken ${ccy} minder aantrekkelijk, wat de koers drukt.`,
    }
  }
  if (t.includes('consumer confidence') || t.includes('consumer sentiment') || t.includes('michigan')) {
    return {
      what: `Meet het vertrouwen van consumenten in de economie. Hoog vertrouwen betekent dat mensen bereid zijn geld uit te geven; laag vertrouwen leidt tot voorzichtigheid en minder bestedingen.`,
      betterThanExpected: `Hoger vertrouwen dan verwacht = positief voor economische groei = hawkish voor ${ccy}.`,
      worseThanExpected: `Lager vertrouwen dan verwacht = risico op lagere bestedingen = dovish voor ${ccy}.`,
      waaromBeter: `Hoger consumentenvertrouwen dan verwacht betekent dat mensen optimistisch zijn over hun financiele situatie en de economie. Optimistische consumenten geven meer uit, wat de economische groei stimuleert. De centrale bank heeft dan minder aanleiding om de rente te verlagen. Stabiele of stijgende rentes houden ${ccy} aantrekkelijk voor beleggers.`,
      waaromSlechter: `Lager consumentenvertrouwen dan verwacht signaleert dat mensen zich zorgen maken over de economie, hun baan of inkomen. Pessimistische consumenten bezuinigen, wat de economische groei remt. De centrale bank zal eerder ingrijpen met renteverlagingen om het vertrouwen en de bestedingen te herstellen. Lagere rentevooruitzichten verzwakken ${ccy}.`,
    }
  }
  if (t.includes('speak') || t.includes('press conference') || t.includes('testimony') || t.includes('member')) {
    return {
      what: `Toespraak van een centrale bank official. Let op hints over toekomstig rentebeleid. De toon (hawkish vs. dovish) is belangrijker dan specifieke data.`,
      betterThanExpected: `Hawkish toon (inflatiezorgen, geen haast om te verlagen) = ${ccy} sterker.`,
      worseThanExpected: `Dovish toon (groeivertraging, openstaan voor verlaging) = ${ccy} zwakker.`,
      waaromBeter: `Een hawkish toon betekent dat de spreker zich meer zorgen maakt over inflatie dan over groei. Dit impliceert dat de rente langer hoog blijft of zelfs kan stijgen. De markt past renteverwachtingen omhoog aan, waardoor ${ccy} aantrekkelijker wordt voor beleggers. Obligatierendementen stijgen en internationaal kapitaal stroomt naar ${ccy}.`,
      waaromSlechter: `Een dovish toon betekent dat de spreker zich meer zorgen maakt over economische groei dan over inflatie. Dit signaleert dat renteverlagingen waarschijnlijker worden. De markt past renteverwachtingen neerwaarts aan. Lagere verwachte rendementen maken ${ccy} minder aantrekkelijk, waardoor beleggers hun kapitaal verplaatsen naar valuta's met hogere rentevooruitzichten.`,
    }
  }
  if (t.includes('trade balance') || t.includes('export') || t.includes('import') || t.includes('current account')) {
    return {
      what: `Het verschil tussen export en import. Een handelsoverschot (meer export dan import) creëert vraag naar de eigen valuta, omdat buitenlandse kopers moeten betalen in de lokale munt.`,
      betterThanExpected: `Groter overschot of kleiner tekort dan verwacht = positief voor ${ccy}.`,
      worseThanExpected: `Groter tekort dan verwacht = negatief voor ${ccy}.`,
      waaromBeter: `Een groter handelsoverschot (of kleiner tekort) dan verwacht betekent dat het land meer exporteert dan importeert. Buitenlandse kopers moeten ${ccy} kopen om voor die export te betalen, wat directe vraag creëert naar de valuta. Daarnaast wijst een sterk handelsoverschot op concurrerende industrie en een gezonde economie, wat het vertrouwen van beleggers versterkt.`,
      waaromSlechter: `Een groter handelstekort dan verwacht betekent dat het land meer importeert dan exporteert. Het land verkoopt meer van zijn eigen valuta om buitenlandse goederen te kopen (betalen in vreemde valuta). Dit creëert verkoopdruk op ${ccy}. Een structureel groeiend tekort kan ook wijzen op verzwakkende concurrentiekracht, wat het langetermijnvertrouwen in de valuta ondermijnt.`,
    }
  }
  if (t.includes('housing') || t.includes('building permit') || t.includes('housing start') || t.includes('home sales') || t.includes('construction')) {
    return {
      what: `Woningmarktindicator. De vastgoedsector is een belangrijke economische motor: bouwactiviteit genereert werkgelegenheid en stimuleert gerelateerde sectoren (materialen, meubels, financiering).`,
      betterThanExpected: `Sterkere woningmarkt dan verwacht = economische groei = hawkish voor ${ccy}.`,
      worseThanExpected: `Zwakkere woningmarkt dan verwacht = economische vertraging = dovish voor ${ccy}.`,
      waaromBeter: `Sterkere woningmarktcijfers dan verwacht wijzen op een gezonde economie. Meer bouwactiviteit betekent meer banen in de bouw en gerelateerde sectoren, meer hypotheekaanvragen en hogere consumentenuitgaven. De centrale bank heeft dan minder reden om de rente te verlagen. Aanhoudend hogere rentes houden ${ccy} aantrekkelijk voor beleggers.`,
      waaromSlechter: `Zwakkere woningmarktcijfers signaleren economische vertraging. Een krimpende vastgoedmarkt raakt veel sectoren: bouw, financiering, detailhandel. Dalende huizenprijzen verminderen het vermogen van huishoudens en remmen bestedingen. De centrale bank zal eerder de rente verlagen om hypotheken betaalbaarder te maken en de markt te stimuleren. Lagere rentevooruitzichten verzwakken ${ccy}.`,
    }
  }
  if (t.includes('wage') || t.includes('earning') || t.includes('average hourly') || t.includes('labor cost') || t.includes('labour cost')) {
    return {
      what: `Meet loongroei of arbeidskosten. Stijgende lonen zijn een voorloper van inflatie: werknemers met meer geld besteden meer, wat prijzen opdrijft.`,
      betterThanExpected: `Hogere loongroei dan verwacht = inflatiedruk = hawkish voor ${ccy}.`,
      worseThanExpected: `Lagere loongroei dan verwacht = minder inflatiedruk = dovish voor ${ccy}.`,
      waaromBeter: `Hogere loongroei dan verwacht betekent dat werknemers meer verdienen. Dit leidt tot hogere consumentenbestedingen, maar ook tot hogere kosten voor bedrijven, die deze doorberekenen in hun prijzen. Deze loon-prijsspiraal voedt inflatie. De centrale bank moet de rente hoog houden (of verhogen) om deze inflatie te beteugelen. Hogere rentes trekken kapitaal aan naar ${ccy}.`,
      waaromSlechter: `Lagere loongroei dan verwacht betekent minder koopkracht voor werknemers en minder opwaartse druk op prijzen. Dit vermindert inflatiezorgen bij de centrale bank, waardoor er meer ruimte ontstaat voor renteverlagingen. De markt anticipeert op een soepeler monetair beleid, wat ${ccy} minder aantrekkelijk maakt voor rendementszoekende beleggers.`,
    }
  }
  // Generic fallback
  return {
    what: `Economisch datapunt voor ${ccy}. Het verschil tussen de actuele waarde en de verwachting bepaalt de marktreactie.`,
    betterThanExpected: `Beter dan verwacht = positief/hawkish voor ${ccy}. Valuta wordt sterker.`,
    worseThanExpected: `Slechter dan verwacht = negatief/dovish voor ${ccy}. Valuta wordt zwakker.`,
    waaromBeter: `Wanneer een economisch cijfer beter uitvalt dan verwacht, signaleert dit economische kracht. Een sterke economie geeft de centrale bank de ruimte om rentes hoog te houden, wat buitenlands kapitaal aantrekt. Beleggers moeten ${ccy} kopen om in die markt te investeren, waardoor de vraag naar de valuta stijgt en de koers omhoog gaat.`,
    waaromSlechter: `Wanneer een economisch cijfer slechter uitvalt dan verwacht, signaleert dit economische zwakte. De centrale bank zal eerder overwegen om de rente te verlagen om de economie te stimuleren. Lagere rentes maken ${ccy} minder aantrekkelijk voor beleggers die rendement zoeken, waardoor kapitaal wegstroomt en de valuta zwakker wordt.`,
  }
}

function useCountdown(targetDate: Date | null) {
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    if (!targetDate) return
    const tick = () => {
      const now = new Date().getTime()
      const diff = targetDate.getTime() - now
      if (diff <= 0) { setTimeLeft('Nu live!'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(d > 0 ? `${d}d ${h}u ${m}m ${s}s` : h > 0 ? `${h}u ${m}m ${s}s` : `${m}m ${s}s`)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [targetDate])
  return timeLeft
}

function NextEventCountdown({ events }: { events: CalendarEvent[] }) {
  const now = new Date()
  const upcoming = events
    .filter(e => e.impact === 'hoog' && new Date(e.date).getTime() > now.getTime())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const next = upcoming[0] || null
  const nextDate = next ? new Date(next.date) : null
  const countdown = useCountdown(nextDate)

  if (!next) return null

  const timeStr = (() => {
    try { return nextDate!.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) }
    catch { return '' }
  })()
  const dateStr = (() => {
    try { return nextDate!.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }) }
    catch { return '' }
  })()

  return (
    <div className="mb-6 p-4 sm:p-5 rounded-xl bg-bg-card border border-accent/30">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Volgend high-impact event</span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-xl">{flagEmoji(next.flag)}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-heading truncate">{next.currency}, {next.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-text-dim">{dateStr}</span>
              <span className="text-xs font-mono font-semibold text-text-muted">{timeStr}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:text-right">
          <div className="sm:hidden w-px h-8 bg-border" />
          <div>
            <p className="text-xl font-mono font-semibold text-accent-light tracking-tight">{countdown}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD', 'CNY']

export default function KalenderPage() {
  const [data, setData] = useState<CalendarResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [impactFilter, setImpactFilter] = useState<'all' | 'high' | 'medium'>('medium')
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([])
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [expandedWaarom, setExpandedWaarom] = useState<Record<string, boolean>>({})

  const fetchCalendar = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ impact: impactFilter })
      if (selectedCurrencies.length > 0) params.set('currencies', selectedCurrencies.join(','))
      const res = await fetch(`/api/calendar?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'API error')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fout bij ophalen')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCalendar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCurrency = (ccy: string) => {
    setSelectedCurrencies(prev =>
      prev.includes(ccy) ? prev.filter(c => c !== ccy) : [...prev, ccy]
    )
  }

  // Group events by date
  const groupedEvents: Record<string, CalendarEvent[]> = {}
  if (data) {
    for (const event of data.events) {
      let dateKey = 'Onbekend'
      try {
        const d = new Date(event.date)
        if (!isNaN(d.getTime())) {
          dateKey = d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
        }
      } catch { /* use raw */ }
      if (dateKey === 'Onbekend' && event.date) {
        dateKey = event.date.split('T')[0] || event.date.split(' ').slice(0, 3).join(' ')
      }
      if (!groupedEvents[dateKey]) groupedEvents[dateKey] = []
      groupedEvents[dateKey].push(event)
    }
  }

  // Find next upcoming event
  let nextEventId: string | null = null
  if (data) {
    const now = new Date().getTime()
    for (const [dateKey, events] of Object.entries(groupedEvents)) {
      for (let i = 0; i < events.length; i++) {
        try {
          const d = new Date(events[i].date)
          if (!isNaN(d.getTime()) && d.getTime() > now) {
            nextEventId = `${dateKey}-${i}`
            break
          }
        } catch { /* skip */ }
      }
      if (nextEventId) break
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold text-heading mb-4">
          Economische Kalender
        </h1>
        <p className="text-sm sm:text-base text-text-muted max-w-lg mx-auto">
          Aankomende economische events en data releases die de markten beïnvloeden. Klik op een event voor uitleg.
        </p>
      </div>

      {data && <NextEventCountdown events={data.events} />}

      {/* CB Meetings highlight */}
      {data && data.meetings.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-heading uppercase tracking-wider mb-3 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Aankomende rentebeslissingen
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.meetings.map((m, i) => (
              <div key={i} className="p-4 rounded-xl bg-bg-card border border-accent/20 flex items-center gap-3">
                <span className="text-2xl">{flagEmoji(m.flag)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-heading truncate">{m.title}</p>
                  <p className="text-xs text-text-dim">{m.date}</p>
                  {m.forecast && <p className="text-xs text-text-muted mt-0.5">Verwacht: {m.forecast} | Vorig: {m.previous}</p>}
                </div>
                <ImpactDot impact={m.impact} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="flex gap-1 bg-bg-card border border-border rounded-lg p-1">
          {([['all', 'Alles'], ['medium', 'Medium+'], ['high', 'Hoog']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setImpactFilter(val)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                impactFilter === val ? 'bg-accent text-white' : 'text-text-muted hover:text-heading'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 flex-wrap">
          {CURRENCIES.map(ccy => (
            <button
              key={ccy}
              onClick={() => toggleCurrency(ccy)}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                selectedCurrencies.length === 0 || selectedCurrencies.includes(ccy)
                  ? 'border-accent/40 bg-accent/10 text-accent-light'
                  : 'border-border text-text-dim hover:text-text-muted'
              }`}
            >
              {ccy}
            </button>
          ))}
        </div>

        <button
          onClick={fetchCalendar}
          disabled={loading}
          className="ml-auto px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-light text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? (
            <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          )}
          Ververs
        </button>
      </div>

      {data && (
        <div className="flex items-center gap-2 mb-4 text-xs text-text-dim">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          Opgehaald: {new Date(data.fetchedAt).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          <span>·</span>
          <span>{data.count} events</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm text-center">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <span className="inline-block w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-text-muted text-sm">Kalender ophalen...</p>
        </div>
      )}

      {/* Events table grouped by date */}
      {data && Object.keys(groupedEvents).length > 0 && (
        <div className="rounded-xl bg-bg-card border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider w-8">
                    <span className="sr-only">Impact</span>
                  </th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Tijd</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Valuta</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Event</th>
                  <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Impact</th>
                  <th className="text-right px-3 sm:px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Verwacht</th>
                  <th className="text-right px-3 sm:px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Vorig</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedEvents).map(([dateKey, events]) => (
                  <Fragment key={dateKey}>
                    <tr className="bg-bg/50">
                      <td colSpan={7} className="px-3 sm:px-4 py-2">
                        <span className="text-xs font-semibold text-accent-light uppercase tracking-wider">{dateKey}</span>
                      </td>
                    </tr>
                    {events.map((event, i) => {
                      const eventId = `${dateKey}-${i}`
                      const isNext = nextEventId !== null && eventId === nextEventId
                      const isExpanded = expandedEvent === eventId
                      const explanation = getEventExplanation(event)

                      return (
                        <Fragment key={eventId}>
                          <tr
                            className={`border-b border-border/30 hover:bg-bg-hover transition-colors cursor-pointer ${isNext ? 'bg-accent/[0.06] relative' : ''}`}
                            style={isNext ? { boxShadow: 'inset 3px 0 0 0 var(--color-accent, #3b82f6)' } : undefined}
                            onClick={() => setExpandedEvent(isExpanded ? null : eventId)}
                          >
                            <td className="px-3 sm:px-4 py-2.5">
                              <ImpactDot impact={event.impact} />
                            </td>
                            <td className="px-3 sm:px-4 py-2.5">
                              <span className="text-xs font-mono text-text-dim whitespace-nowrap">
                                {(() => { try { const d = new Date(event.date); return !isNaN(d.getTime()) ? d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '—' } catch { return '—' } })()}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">{flagEmoji(event.flag)}</span>
                                <span className="text-xs font-mono text-heading">{event.currency}</span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm text-heading">{event.title}</span>
                                {isNext && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent/15 text-accent-light uppercase tracking-wider shrink-0">Volgende</span>}
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                  className={`text-text-dim/40 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-2.5 hidden sm:table-cell">
                              <ImpactBadge impact={event.impact} />
                            </td>
                            <td className="px-3 sm:px-4 py-2.5 text-right">
                              <span className="text-sm text-text-muted font-mono">{event.forecast || '—'}</span>
                            </td>
                            <td className="px-3 sm:px-4 py-2.5 text-right">
                              <span className="text-sm text-text-dim font-mono">{event.previous || '—'}</span>
                            </td>
                          </tr>
                          {/* Expanded explanation */}
                          {isExpanded && (
                            <tr className="bg-white/[0.02]">
                              <td colSpan={7} className="px-4 sm:px-6 py-3">
                                <div className="grid sm:grid-cols-3 gap-3 text-[11px]">
                                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
                                    <p className="text-accent-light font-semibold mb-1 uppercase tracking-wider text-[10px]">Wat is dit?</p>
                                    <p className="text-text-muted leading-relaxed">{explanation.what}</p>
                                  </div>
                                  <div className="rounded-lg bg-green-500/[0.03] border border-green-500/10 px-3 py-2.5">
                                    <p className="text-green-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">Beter dan verwacht</p>
                                    <p className="text-text-muted leading-relaxed">{explanation.betterThanExpected}</p>
                                  </div>
                                  <div className="rounded-lg bg-red-500/[0.03] border border-red-500/10 px-3 py-2.5">
                                    <p className="text-red-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">Slechter dan verwacht</p>
                                    <p className="text-text-muted leading-relaxed">{explanation.worseThanExpected}</p>
                                  </div>
                                </div>
                                {/* Collapsible "Waarom?" deep explanation */}
                                <div className="mt-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setExpandedWaarom(prev => ({ ...prev, [eventId]: !prev[eventId] }))
                                    }}
                                    className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-light/70 hover:text-accent-light transition-colors group"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                      className={`transition-transform ${expandedWaarom[eventId] ? 'rotate-180' : ''}`}
                                    >
                                      <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                    <span className="uppercase tracking-wider">Waarom? Diepere uitleg</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light/40">
                                      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                  </button>
                                  {expandedWaarom[eventId] && (
                                    <div className="grid sm:grid-cols-2 gap-3 mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                      <div className="rounded-lg bg-green-500/[0.02] border border-green-500/10 px-4 py-3">
                                        <p className="text-green-400 font-semibold mb-1.5 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                                          Waarom sterker bij beter dan verwacht?
                                        </p>
                                        <p className="text-text-muted leading-relaxed text-[11px]">{explanation.waaromBeter}</p>
                                      </div>
                                      <div className="rounded-lg bg-red-500/[0.02] border border-red-500/10 px-4 py-3">
                                        <p className="text-red-400 font-semibold mb-1.5 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                                          Waarom zwakker bij slechter dan verwacht?
                                        </p>
                                        <p className="text-text-muted leading-relaxed text-[11px]">{explanation.waaromSlechter}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && data.count === 0 && (
        <div className="text-center py-12">
          <p className="text-text-muted text-sm">Geen events gevonden met deze filters.</p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-xs text-text-muted">Hoge impact</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-xs text-text-muted">Medium impact</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="text-xs text-text-muted">Lage impact</span>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-xl bg-bg-card border border-border">
        <p className="text-xs text-text-dim text-center">
          Data bron: <a href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer" className="text-accent-light/60 hover:text-accent-light">ForexFactory / FairEconomy</a>.
          Klik op een event voor uitleg over de impact en wat er gebeurt bij een verrassing. Dit is geen financieel advies.
        </p>
      </div>
    </div>
  )
}
