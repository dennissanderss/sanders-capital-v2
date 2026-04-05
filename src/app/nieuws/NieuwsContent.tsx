'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

interface NewsArticle {
  id: string
  title: string
  titleNl: string
  summary: string
  summaryNl: string
  fullContent: string
  url: string
  source: string
  category: string
  publishedAt: string
  relevanceScore: number
  relevanceTags: string[]
  affectedCurrencies: string[]
  relevanceContext: string
  hasTranslation?: boolean
}

// Helper: get the best available title/summary for display language
function getDisplayTitle(article: NewsArticle, dutch: boolean): string {
  if (dutch && article.titleNl) return article.titleNl
  return article.title
}

function getDisplaySummary(article: NewsArticle, dutch: boolean): string {
  if (dutch && article.summaryNl) return article.summaryNl
  return article.summary
}

interface FxRate {
  pair: string
  price: string
  change: string
  direction: 'up' | 'down' | 'flat'
}

const categories = [
  { value: 'all', label: 'Alles' },
  { value: 'central-banks', label: 'Centrale Banken' },
  { value: 'macro', label: 'Macro-economie' },
  { value: 'forex', label: 'Forex' },
  { value: 'geopolitics', label: 'Geopolitiek' },
]

const dateRanges = [
  { value: 1, label: 'Vandaag' },
  { value: 7, label: 'Deze week' },
  { value: 30, label: 'Deze maand' },
]

const sourceColors: Record<string, string> = {
  'Federal Reserve': 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  'ECB': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  'ForexLive': 'bg-green-500/15 text-green-400 border-green-500/25',
  'CNBC Economy': 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  'Bloomberg Markets': 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  'NY Times World': 'bg-slate-500/15 text-slate-400 border-slate-500/25',
  'BBC Business': 'bg-red-500/15 text-red-400 border-red-500/25',
}

const categoryLabels: Record<string, string> = {
  'central-banks': 'Centrale Banken',
  'macro': 'Macro',
  'forex': 'Forex',
  'geopolitics': 'Geopolitiek',
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Zojuist'
  if (minutes < 60) return `${minutes} min geleden`
  if (hours < 24) return `${hours} uur geleden`
  if (days === 1) return 'Gisteren'
  if (days < 7) return `${days} dagen geleden`
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

/* ─── Economic Impact Analysis ───────────────────────────── */
interface ImpactResult {
  currency: string
  direction: 'bullish' | 'bearish'
  explanation: string
  waarom: string
}

interface EconomicRule {
  // Keywords that trigger this rule (matched against lowercased title+summary)
  keywords: string[]
  // Direction modifiers: if these words appear, override direction
  positiveModifiers: string[] // words meaning "higher/increase" -> use baseDirection
  negativeModifiers: string[] // words meaning "lower/decrease" -> flip baseDirection
  // Base direction when positive modifiers match (or no modifier context)
  baseDirection: 'bullish' | 'bearish'
  currency: string
  explanationBullish: string
  explanationBearish: string
  waaromBullish: string
  waaromBearish: string
}

const ECONOMIC_RULES: EconomicRule[] = [
  // ─── US Employment ─────────────────
  {
    keywords: ['nonfarm', 'non-farm', 'payrolls', 'nfp'],
    positiveModifiers: ['rise', 'higher', 'beat', 'strong', 'surge', 'gain', 'add', 'increase', 'stijg', 'hoger', 'boven verwachting'],
    negativeModifiers: ['fall', 'lower', 'miss', 'weak', 'drop', 'decline', 'below', 'daal', 'lager', 'onder verwachting'],
    baseDirection: 'bullish',
    currency: 'USD',
    explanationBullish: 'Meer banen \u2192 sterkere economie \u2192 Fed houdt rente hoog \u2192 USD sterker',
    explanationBearish: 'Minder banen \u2192 zwakkere economie \u2192 Fed verlaagt rente \u2192 USD zwakker',
    waaromBullish: 'Als er meer banen bijkomen dan verwacht, wijst dit op een groeiende economie. Bedrijven investeren en nemen personeel aan. De Federal Reserve zal dan minder snel de rente verlagen, omdat de economie geen extra stimulans nodig heeft. Hogere rentes maken het aantrekkelijker om dollars aan te houden (meer rendement), waardoor buitenlands kapitaal instroomt en de dollar sterker wordt.',
    waaromBearish: 'Als er minder banen bijkomen dan verwacht, wijst dit op een vertragende economie. De Federal Reserve zal dan eerder overwegen om de rente te verlagen om de economie te stimuleren. Lagere rentes maken het minder aantrekkelijk om dollars aan te houden, waardoor de dollar in waarde daalt ten opzichte van andere valuta\u2019s.',
  },
  {
    keywords: ['unemployment', 'werkloosheid', 'jobless'],
    positiveModifiers: ['rise', 'higher', 'increase', 'stijg', 'hoger', 'up'],
    negativeModifiers: ['fall', 'lower', 'drop', 'decline', 'daal', 'lager', 'down'],
    baseDirection: 'bearish',
    currency: 'USD',
    explanationBullish: 'Lagere werkloosheid \u2192 sterkere arbeidsmarkt \u2192 Fed hawkish \u2192 USD sterker',
    explanationBearish: 'Hogere werkloosheid \u2192 zwakkere economie \u2192 Fed dovish \u2192 USD zwakker',
    waaromBullish: 'Dalende werkloosheid betekent dat meer mensen een baan vinden, wat wijst op een gezonde economie. Dit kan ook leiden tot hogere lonen en meer bestedingen, wat inflatiedruk cre\u00ebert. De Fed zal dan eerder geneigd zijn om de rente hoog te houden of te verhogen, wat de dollar aantrekkelijker maakt voor beleggers.',
    waaromBearish: 'Stijgende werkloosheid wijst erop dat bedrijven minder mensen aannemen of personeel ontslaan. Dit is een teken van economische verzwakking. De Federal Reserve zal in reactie hierop een soepeler monetair beleid voeren (lagere rente) om de economie te ondersteunen, wat de dollar verzwakt doordat beleggers elders hogere rendementen zoeken.',
  },
  {
    keywords: ['jobs report', 'banenrapport', 'employment'],
    positiveModifiers: ['strong', 'beat', 'surge', 'sterk', 'boven'],
    negativeModifiers: ['weak', 'miss', 'disappointing', 'zwak', 'onder'],
    baseDirection: 'bullish',
    currency: 'USD',
    explanationBullish: 'Sterke arbeidsmarkt \u2192 Fed kan rente hoog houden \u2192 USD sterker',
    explanationBearish: 'Zwakke arbeidsmarkt \u2192 Fed kan rente verlagen \u2192 USD zwakker',
    waaromBullish: 'Een sterk banenrapport signaleert economische kracht. Wanneer de arbeidsmarkt krap is, stijgen lonen en nemen consumenten meer uit. De Fed zal dan minder reden zien om de rente te verlagen, wat de renteverschillen met andere landen vergroot en de dollar ondersteunt.',
    waaromBearish: 'Een zwak banenrapport wijst op een afkoelende economie. Minder werkgelegenheid betekent minder inkomen en bestedingen. De Fed zal dan eerder geneigd zijn de rente te verlagen om groei te stimuleren. Lagere rentes verminderen de aantrekkingskracht van dollardenomineerde beleggingen.',
  },
  // ─── Inflation / CPI ──────────────
  {
    keywords: ['cpi', 'consumer price', 'consumentenprijzen'],
    positiveModifiers: ['rise', 'higher', 'hot', 'above', 'beat', 'stijg', 'hoger', 'boven'],
    negativeModifiers: ['fall', 'lower', 'cool', 'below', 'miss', 'daal', 'lager', 'onder'],
    baseDirection: 'bullish',
    currency: 'USD',
    explanationBullish: 'Hogere inflatie \u2192 Fed verkrapt beleid \u2192 USD sterker (korte termijn)',
    explanationBearish: 'Lagere inflatie \u2192 Fed kan verruimen \u2192 USD zwakker',
    waaromBullish: 'Hogere inflatie dan verwacht betekent dat prijzen sneller stijgen. De Fed moet dan de rente verhogen of hoog houden om inflatie te bestrijden. Hogere rentes trekken buitenlands kapitaal aan (beleggers zoeken het hoogste rendement), wat de vraag naar dollars verhoogt en de koers opdrijft.',
    waaromBearish: 'Lagere inflatie dan verwacht geeft de Fed ruimte om de rente te verlagen zonder prijsstabiliteit in gevaar te brengen. Dit vooruitzicht van lagere rentes maakt dollardenomineerde beleggingen minder aantrekkelijk. Beleggers verschuiven kapitaal naar valuta\u2019s met hogere rendementen.',
  },
  {
    keywords: ['inflation', 'inflatie'],
    positiveModifiers: ['rise', 'higher', 'hot', 'surge', 'persistent', 'sticky', 'stijg', 'hoger', 'hardnekkig'],
    negativeModifiers: ['fall', 'lower', 'cool', 'ease', 'slow', 'daal', 'lager', 'afneem'],
    baseDirection: 'bullish',
    currency: 'USD',
    explanationBullish: 'Hogere inflatie \u2192 centrale bank verkrapt \u2192 valuta sterker',
    explanationBearish: 'Lagere inflatie \u2192 centrale bank kan verruimen \u2192 valuta zwakker',
    waaromBullish: 'Wanneer inflatie oploopt, moet de centrale bank ingrijpen met hogere rentes om de geldhoeveelheid te beperken. Hogere rentes maken beleggingen in die valuta aantrekkelijker voor internationale investeerders, wat de koers ondersteunt. Dit mechanisme staat bekend als het "renteverschil-effect".',
    waaromBearish: 'Afnemende inflatie vermindert de druk op de centrale bank om de rente hoog te houden. Het vooruitzicht van lagere rentes maakt de valuta minder aantrekkelijk voor beleggers die rendement zoeken. Kapitaalstromen verschuiven richting valuta\u2019s waar hogere rentes verwacht worden.',
  },
  {
    keywords: ['pce', 'core pce'],
    positiveModifiers: ['rise', 'higher', 'above', 'hot', 'stijg', 'hoger'],
    negativeModifiers: ['fall', 'lower', 'below', 'cool', 'daal', 'lager'],
    baseDirection: 'bullish',
    currency: 'USD',
    explanationBullish: 'Hogere PCE \u2192 Fed houdt vast aan verkrapping \u2192 USD sterker',
    explanationBearish: 'Lagere PCE \u2192 Fed kan versoepelen \u2192 USD zwakker',
    waaromBullish: 'De PCE-index (Personal Consumption Expenditures) is de favoriete inflatiemeter van de Fed. Een hoger dan verwachte PCE bevestigt dat inflatiedruk aanhoudt, waardoor de Fed minder ruimte heeft om de rente te verlagen. Dit houdt het rentevoordeel van de dollar in stand.',
    waaromBearish: 'Een lagere PCE-reading dan verwacht suggereert dat inflatie sneller afkoelt. Dit geeft de Fed meer ruimte om de rente te verlagen in de toekomst. Financi\u00eble markten prijzen dan lagere rentes in, wat de dollar verzwakt ten opzichte van valuta\u2019s waar de rente langer hoog blijft.',
  },
  // ─── GDP ──────────────────────────
  {
    keywords: ['gdp', 'bbp', 'gross domestic'],
    positiveModifiers: ['growth', 'expand', 'beat', 'strong', 'rise', 'groei', 'stijg', 'sterk'],
    negativeModifiers: ['shrink', 'contract', 'miss', 'weak', 'decline', 'krimp', 'daal', 'zwak'],
    baseDirection: 'bullish',
    currency: 'USD',
    explanationBullish: 'Hoger BBP \u2192 sterkere economie \u2192 valuta sterker',
    explanationBearish: 'Lager BBP \u2192 zwakkere economie \u2192 valuta zwakker',
    waaromBullish: 'Een hoger BBP dan verwacht toont aan dat de economie harder groeit. Dit trekt buitenlandse investeringen aan, verhoogt het vertrouwen in de munt en vermindert de kans op renteverlagingen. Sterke economische groei maakt een land aantrekkelijker voor kapitaal, wat de valuta ondersteunt.',
    waaromBearish: 'Een lager BBP dan verwacht wijst op economische zwakte of krimp. Dit vermindert het vertrouwen van beleggers en vergroot de kans dat de centrale bank de rente verlaagt om groei te stimuleren. Buitenlandse investeerders trekken kapitaal terug naar markten met betere groeivooruitzichten.',
  },
  // ─── Rate decisions ───────────────
  {
    keywords: ['rate hike', 'renteverhoging', 'raises rate', 'verhoogt rente'],
    positiveModifiers: [],
    negativeModifiers: [],
    baseDirection: 'bullish',
    currency: 'USD',
    explanationBullish: 'Renteverhoging \u2192 hogere yields \u2192 valuta aantrekkelijker \u2192 sterker',
    explanationBearish: '',
    waaromBullish: 'Een renteverhoging maakt sparen en beleggen in die valuta direct aantrekkelijker. Internationale beleggers verplaatsen kapitaal naar het land met de hogere rente om meer rendement te behalen (dit heet "carry trade"). De toegenomen vraag naar de valuta drijft de koers omhoog.',
    waaromBearish: '',
  },
  {
    keywords: ['rate cut', 'renteverlaging', 'cuts rate', 'verlaagt rente'],
    positiveModifiers: [],
    negativeModifiers: [],
    baseDirection: 'bearish',
    currency: 'USD',
    explanationBullish: '',
    explanationBearish: 'Renteverlaging \u2192 lagere yields \u2192 valuta minder aantrekkelijk \u2192 zwakker',
    waaromBullish: '',
    waaromBearish: 'Een renteverlaging vermindert het rendement op beleggingen in die valuta. Beleggers die rendement zoeken verplaatsen hun kapitaal naar landen met hogere rentes. Deze uitstroom van kapitaal vermindert de vraag naar de valuta, waardoor de koers daalt. Hoe groter het renteverschil met andere landen, hoe sterker dit effect.',
  },
  {
    keywords: ['hawkish'],
    positiveModifiers: [],
    negativeModifiers: [],
    baseDirection: 'bullish',
    currency: 'USD',
    explanationBullish: 'Hawkish signaal \u2192 rente blijft hoog of stijgt \u2192 valuta sterker',
    explanationBearish: '',
    waaromBullish: '\u201cHawkish\u201d betekent dat de centrale bank prioriteit geeft aan inflatiebestrijding boven economische groei. Dit signaleert dat rentes hoog blijven of verder stijgen. Markten reageren door de valuta te kopen, omdat hogere rentes meer rendement opleveren voor beleggers.',
    waaromBearish: '',
  },
  {
    keywords: ['dovish'],
    positiveModifiers: [],
    negativeModifiers: [],
    baseDirection: 'bearish',
    currency: 'USD',
    explanationBullish: '',
    explanationBearish: 'Dovish signaal \u2192 rente gaat omlaag \u2192 valuta zwakker',
    waaromBullish: '',
    waaromBearish: '\u201cDovish\u201d betekent dat de centrale bank prioriteit geeft aan economische groei boven inflatiebestrijding. Dit signaleert toekomstige renteverlagingen. Markten reageren door de valuta te verkopen, omdat lagere rentes het rendement op beleggingen in die munt verminderen.',
  },
  // ─── PMI ──────────────────────────
  {
    keywords: ['pmi', 'purchasing manager'],
    positiveModifiers: ['rise', 'above', 'expand', 'beat', 'stijg', 'boven', 'hoger'],
    negativeModifiers: ['fall', 'below', 'contract', 'miss', 'daal', 'onder', 'lager'],
    baseDirection: 'bullish',
    currency: 'USD',
    explanationBullish: 'PMI boven 50 / stijgend \u2192 groeiende economie \u2192 valuta sterker',
    explanationBearish: 'PMI onder 50 / dalend \u2192 krimpende economie \u2192 valuta zwakker',
    waaromBullish: 'De PMI (Purchasing Managers Index) is een voorlopende indicator: inkoopmanagers weten als eersten of er meer of minder geproduceerd gaat worden. Een PMI boven 50 wijst op expansie. Dit signaal geeft beleggers vertrouwen dat de economie groeit, wat investeringen en de valuta ondersteunt.',
    waaromBearish: 'Een PMI onder 50 wijst op krimp in de productiesector. Inkoopmanagers bestellen minder materialen, wat duidt op afnemende bedrijvigheid. Dit vergroot de kans op economische vertraging en renteverlagingen door de centrale bank, wat de valuta onder druk zet.',
  },
  // ─── Retail Sales ─────────────────
  {
    keywords: ['retail sales', 'detailhandel'],
    positiveModifiers: ['rise', 'higher', 'beat', 'surge', 'strong', 'stijg', 'hoger', 'sterk'],
    negativeModifiers: ['fall', 'lower', 'miss', 'weak', 'drop', 'daal', 'lager', 'zwak'],
    baseDirection: 'bullish',
    currency: 'USD',
    explanationBullish: 'Hogere retail sales \u2192 sterke consument \u2192 economie groeit \u2192 valuta sterker',
    explanationBearish: 'Lagere retail sales \u2192 zwakke consument \u2192 economie verzwakt \u2192 valuta zwakker',
    waaromBullish: 'Consumentenbestedingen vormen het grootste deel van de economie (circa 70% van het VS-BBP). Hogere detailhandelsverkopen wijzen op consumentenvertrouwen en een gezonde economie. Dit vermindert de noodzaak voor renteverlagingen en trekt buitenlands kapitaal aan.',
    waaromBearish: 'Dalende detailhandelsverkopen wijzen op een consument die minder uitgeeft, mogelijk door onzekerheid of dalende koopkracht. Omdat consumentenbestedingen de motor van de economie zijn, vergroot dit de kans op een vertraging en stimuleringsmaatregelen van de centrale bank.',
  },
  // ─── Recession ────────────────────
  {
    keywords: ['recession', 'recessie'],
    positiveModifiers: ['risk', 'fear', 'warning', 'risico', 'angst'],
    negativeModifiers: ['avoid', 'unlikely', 'onwaarschijnlijk'],
    baseDirection: 'bearish',
    currency: 'USD',
    explanationBullish: 'Recessie onwaarschijnlijk \u2192 sterke economie \u2192 valuta sterker',
    explanationBearish: 'Recessierisico \u2192 Fed verlaagt rente \u2192 valuta zwakker',
    waaromBullish: 'Wanneer recessierisico\u2019s afnemen, groeit het vertrouwen dat de economie op koers blijft. Beleggers zijn bereid meer te investeren in dat land, wat de vraag naar de valuta verhoogt. De centrale bank hoeft ook geen noodmaatregelen te nemen zoals agressieve renteverlagingen.',
    waaromBearish: 'Recessieangst zorgt voor een vlucht uit risicovolle beleggingen. De centrale bank zal preventief de rente verlagen om de economie te ondersteunen. Daarnaast vermindert economische onzekerheid de aantrekkingskracht van het land voor buitenlandse investeerders, wat de valuta verzwakt.',
  },
  // ─── Tightening / Easing ──────────
  {
    keywords: ['tightening', 'verkrapping', 'quantitative tightening'],
    positiveModifiers: [],
    negativeModifiers: [],
    baseDirection: 'bullish',
    currency: 'USD',
    explanationBullish: 'Verkrapping monetair beleid \u2192 hogere rentes \u2192 valuta sterker',
    explanationBearish: '',
    waaromBullish: 'Bij monetaire verkrapping (quantitative tightening) vermindert de centrale bank de geldhoeveelheid door obligaties te verkopen of niet te herfinancieren. Minder geld in omloop maakt elke eenheid meer waard. Gecombineerd met hogere rentes maakt dit de valuta aantrekkelijker voor beleggers.',
    waaromBearish: '',
  },
  {
    keywords: ['easing', 'verruiming', 'quantitative easing'],
    positiveModifiers: [],
    negativeModifiers: [],
    baseDirection: 'bearish',
    currency: 'USD',
    explanationBullish: '',
    explanationBearish: 'Verruiming monetair beleid \u2192 meer liquiditeit \u2192 valuta zwakker',
    waaromBullish: '',
    waaromBearish: 'Bij monetaire verruiming (quantitative easing) koopt de centrale bank obligaties op en pompt zo nieuw geld in de economie. Meer geld in omloop vermindert de waarde per eenheid. Daarnaast drukt QE de rente, waardoor beleggers elders hogere rendementen zoeken en de valuta verzwakt.',
  },
  // ─── Treasury / Yields ────────────
  {
    keywords: ['treasury yield', 'treasury yields', 'bond yield', 'obligatierente'],
    positiveModifiers: ['rise', 'surge', 'climb', 'stijg', 'hoger'],
    negativeModifiers: ['fall', 'drop', 'decline', 'daal', 'lager'],
    baseDirection: 'bullish',
    currency: 'USD',
    explanationBullish: 'Stijgende yields \u2192 hogere rendementen \u2192 USD aantrekkelijker',
    explanationBearish: 'Dalende yields \u2192 lagere rendementen \u2192 USD minder aantrekkelijk',
    waaromBullish: 'Stijgende obligatierentes bieden beleggers meer rendement op veilige staatsobligaties. Internationale investeerders moeten dollars kopen om Amerikaanse obligaties te kopen, wat de vraag naar de dollar verhoogt. Het renteverschil met andere landen is een van de belangrijkste drijvers van valutakoersen.',
    waaromBearish: 'Dalende obligatierentes verminderen het rendement op veilige staatsobligaties. Beleggers verkopen deze obligaties en zoeken hogere rendementen elders. De verminderde vraag naar dollars (nodig om obligaties te kopen) zorgt voor een zwakkere dollar.',
  },
  // ─── Tariffs / Trade ──────────────
  {
    keywords: ['tariff', 'tariffs', 'trade war', 'handelsoorlog'],
    positiveModifiers: ['impose', 'increase', 'new', 'escalat', 'verhoog', 'nieuw'],
    negativeModifiers: ['remove', 'reduce', 'ease', 'deal', 'verwijder', 'verlaag'],
    baseDirection: 'bullish',
    currency: 'USD',
    explanationBullish: 'Hogere tarieven \u2192 risk-off + inflatie \u2192 USD als veilige haven sterker',
    explanationBearish: 'Lagere tarieven \u2192 risk-on \u2192 minder vraag naar USD als veilige haven',
    waaromBullish: 'Handelstarieven cre\u00ebren onzekerheid op wereldwijde markten. In tijden van onzekerheid vluchten beleggers naar "veilige havens" zoals de dollar en Amerikaanse staatsobligaties. Daarnaast kunnen tarieven de binnenlandse inflatie opdrijven, wat de verwachting van hogere rentes versterkt.',
    waaromBearish: 'Het verlagen of opheffen van tarieven vermindert handelsrisico\u2019s en bevordert wereldwijde economische groei. In een risk-on omgeving hebben beleggers minder behoefte aan veilige havens zoals de dollar, en investeren ze in hoger-renderende valuta\u2019s van opkomende markten.',
  },
  // ─── Risk sentiment ───────────────
  {
    keywords: ['risk-off', 'safe haven', 'vlucht naar veiligheid'],
    positiveModifiers: [],
    negativeModifiers: [],
    baseDirection: 'bullish',
    currency: 'JPY',
    explanationBullish: 'Risk-off sentiment \u2192 vlucht naar veilige havens \u2192 JPY/CHF sterker',
    explanationBearish: '',
    waaromBullish: 'Bij risk-off sentiment verkopen beleggers risicovolle beleggingen en kopen ze veilige havens. De Japanse yen is een traditionele veilige haven vanwege Japan\u2019s status als grootste netto-crediteur ter wereld. Beleggers wikkelen ook carry trades af (lenen in JPY om elders te beleggen), waardoor ze JPY terugkopen.',
    waaromBearish: '',
  },
  {
    keywords: ['risk-on', 'risk appetite'],
    positiveModifiers: [],
    negativeModifiers: [],
    baseDirection: 'bullish',
    currency: 'AUD',
    explanationBullish: 'Risk-on sentiment \u2192 meer risicobereidheid \u2192 AUD/NZD sterker',
    explanationBearish: '',
    waaromBullish: 'Bij risk-on sentiment zoeken beleggers hogere rendementen en accepteren ze meer risico. De Australische dollar profiteert hiervan vanwege de relatief hoge rente, de sterke grondstoffenexport en de nauwe economische banden met het groeiende Azi\u00eb. Beleggers openen ook carry trades, waarbij ze goedkoop lenen in laag-rente valuta\u2019s en beleggen in AUD.',
    waaromBearish: '',
  },
]

// Map article currencies to likely central bank context
const CURRENCY_CENTRAL_BANK: Record<string, string> = {
  USD: 'Fed', EUR: 'ECB', GBP: 'BoE', JPY: 'BoJ',
  AUD: 'RBA', NZD: 'RBNZ', CAD: 'BoC', CHF: 'SNB',
}

// Central bank keywords -> override the currency for a rule
const CENTRAL_BANK_CURRENCY: Record<string, string> = {
  'federal reserve': 'USD', 'fed ': 'USD', 'fomc': 'USD', 'powell': 'USD',
  'ecb': 'EUR', 'lagarde': 'EUR', 'european central bank': 'EUR',
  'bank of england': 'GBP', 'boe': 'GBP', 'bailey': 'GBP',
  'bank of japan': 'JPY', 'boj': 'JPY', 'ueda': 'JPY',
  'rba': 'AUD', 'reserve bank of australia': 'AUD',
  'rbnz': 'NZD', 'reserve bank of new zealand': 'NZD',
  'bank of canada': 'CAD', 'boc': 'CAD', 'macklem': 'CAD',
  'snb': 'CHF', 'swiss national bank': 'CHF',
}

function analyzeEconomicImpact(article: NewsArticle): ImpactResult | null {
  const text = `${article.title} ${article.summary}`.toLowerCase()

  // Detect which currency is being discussed (from central bank mentions or article metadata)
  let detectedCurrency = ''
  for (const [keyword, currency] of Object.entries(CENTRAL_BANK_CURRENCY)) {
    if (text.includes(keyword)) {
      detectedCurrency = currency
      break
    }
  }
  // Fallback: use first affected currency from the article's metadata
  if (!detectedCurrency && article.affectedCurrencies.length > 0) {
    detectedCurrency = article.affectedCurrencies[0]
  }

  for (const rule of ECONOMIC_RULES) {
    const matched = rule.keywords.some(kw => text.includes(kw))
    if (!matched) continue

    // Use detected currency, or fallback to rule default
    const currency = detectedCurrency || rule.currency

    // Determine direction: check modifiers
    let direction = rule.baseDirection

    if (rule.positiveModifiers.length > 0 || rule.negativeModifiers.length > 0) {
      const hasPositive = rule.positiveModifiers.some(m => text.includes(m))
      const hasNegative = rule.negativeModifiers.some(m => text.includes(m))

      if (hasNegative && !hasPositive) {
        // Flip direction
        direction = rule.baseDirection === 'bullish' ? 'bearish' : 'bullish'
      }
      // If both or neither modifier found, keep baseDirection (headline is ambiguous, use base assumption)
    }

    const explanation = direction === 'bullish' ? rule.explanationBullish : rule.explanationBearish
    if (!explanation) continue

    const waarom = direction === 'bullish' ? rule.waaromBullish : rule.waaromBearish

    // Replace generic "valuta" with the actual currency name
    const bank = CURRENCY_CENTRAL_BANK[currency] || ''
    const replaceContext = (str: string) => str
      .replace(/valuta/g, currency)
      .replace(/centrale bank/g, bank || 'centrale bank')
      .replace(/Fed/g, bank || 'Fed')

    return {
      currency,
      direction,
      explanation: replaceContext(explanation),
      waarom: waarom ? replaceContext(waarom) : '',
    }
  }

  return null
}

/* ─── Impact Indicator Component ─────────────────────────── */
function ImpactIndicator({ article, compact = false }: { article: NewsArticle; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [showWaarom, setShowWaarom] = useState(false)
  const impact = useMemo(() => analyzeEconomicImpact(article), [article])

  if (!impact) return null

  const isBullish = impact.direction === 'bullish'

  if (compact) {
    // Compact pill for article cards
    return (
      <span
        className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border font-semibold ${
          isBullish
            ? 'bg-green-500/10 text-green-400 border-green-500/20'
            : 'bg-red-500/10 text-red-400 border-red-500/20'
        }`}
        title={impact.explanation}
      >
        <span>{isBullish ? '\u2191' : '\u2193'}</span>
        <span>{impact.currency}</span>
      </span>
    )
  }

  // Full impact box for article reader
  return (
    <div className={`rounded-lg border p-3 mb-4 ${
      isBullish
        ? 'bg-green-500/[0.06] border-green-500/20'
        : 'bg-red-500/[0.06] border-red-500/20'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`text-lg leading-none ${isBullish ? 'text-green-400' : 'text-red-400'}`}>
            {isBullish ? '\u2191' : '\u2193'}
          </span>
          <span className={`text-xs font-semibold ${isBullish ? 'text-green-400' : 'text-red-400'}`}>
            Impact: {impact.currency} {isBullish ? 'bullish' : 'bearish'}
          </span>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`text-text-dim transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-white/[0.06]">
          <p className={`text-xs leading-relaxed ${isBullish ? 'text-green-300/80' : 'text-red-300/80'}`}>
            {impact.explanation}
          </p>
          {impact.waarom && (
            <div className="mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); setShowWaarom(!showWaarom) }}
                className={`inline-flex items-center gap-1 text-[10px] font-medium transition-colors ${
                  isBullish ? 'text-green-400/60 hover:text-green-400' : 'text-red-400/60 hover:text-red-400'
                }`}
              >
                <svg
                  width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform ${showWaarom ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                Waarom?
              </button>
              {showWaarom && (
                <p className={`mt-1.5 text-[11px] leading-relaxed ${isBullish ? 'text-green-300/60' : 'text-red-300/60'}`}>
                  {impact.waarom}
                </p>
              )}
            </div>
          )}
          <p className="text-[8px] text-text-dim/40 mt-3 leading-relaxed">
            Deze analyse is gebaseerd op standaard economische relaties. Het systeem detecteert automatisch economische termen in het artikel en past de bekende marktlogica toe. Bij complexe of tegenstrijdige situaties kan de werkelijke marktreactie afwijken.
          </p>
          <p className="text-[9px] text-text-dim/50 mt-1 italic">Educatief, geen advies</p>
        </div>
      )}
    </div>
  )
}

/* ─── Live FX Widget ──────────────────────────────────────── */
const MAJOR_PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD']

function FxWidget() {
  const [rates, setRates] = useState<FxRate[]>([])
  const [prevRates, setPrevRates] = useState<Record<string, string>>({})
  const [flashPairs, setFlashPairs] = useState<Record<string, 'up' | 'down'>>({})
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    async function fetchRates() {
      try {
        const pairs = MAJOR_PAIRS.map(p => ({
          pair: p,
          base: p.slice(0, 3),
          quote: p.slice(3),
        }))

        const results: FxRate[] = []

        // Fetch via exchangerate.host free API
        const responses = await Promise.allSettled(
          pairs.map(async ({ pair, base, quote }) => {
            const res = await fetch(
              `https://api.exchangerate.host/convert?from=${base}&to=${quote}&amount=1`,
              { cache: 'no-store' }
            )
            const data = await res.json()
            if (data.result) {
              return {
                pair: `${base}/${quote}`,
                price: pair.includes('JPY') ? data.result.toFixed(2) : data.result.toFixed(4),
                change: '',
                direction: 'flat' as const,
              }
            }
            return null
          })
        )

        for (const r of responses) {
          if (r.status === 'fulfilled' && r.value) {
            results.push(r.value)
          }
        }

        // Fallback if API failed
        if (results.length === 0) {
          const fallback: Record<string, string> = {
            'EUR/USD': '1.0850', 'GBP/USD': '1.2640', 'USD/JPY': '151.20',
            'USD/CHF': '0.8820', 'AUD/USD': '0.6530', 'USD/CAD': '1.3560',
          }
          for (const [pair, price] of Object.entries(fallback)) {
            results.push({ pair, price, change: '', direction: 'flat' })
          }
        }

        // Detect price changes and flash
        const flashes: Record<string, 'up' | 'down'> = {}
        for (const rate of results) {
          const prev = prevRates[rate.pair]
          if (prev && prev !== rate.price) {
            flashes[rate.pair] = parseFloat(rate.price) > parseFloat(prev) ? 'up' : 'down'
          }
        }

        // Store current prices for next comparison
        const newPrev: Record<string, string> = {}
        for (const r of results) newPrev[r.pair] = r.price
        setPrevRates(newPrev)

        if (Object.keys(flashes).length > 0) {
          setFlashPairs(flashes)
          setTimeout(() => setFlashPairs({}), 1200)
        }

        setRates(results)
        setLastUpdate(new Date())
      } catch {
        setRates([
          { pair: 'EUR/USD', price: '1.0850', change: '', direction: 'flat' },
          { pair: 'GBP/USD', price: '1.2640', change: '', direction: 'flat' },
          { pair: 'USD/JPY', price: '151.20', change: '', direction: 'flat' },
          { pair: 'USD/CHF', price: '0.8820', change: '', direction: 'flat' },
          { pair: 'AUD/USD', price: '0.6530', change: '', direction: 'flat' },
          { pair: 'USD/CAD', price: '1.3560', change: '', direction: 'flat' },
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchRates()
    // Refresh every 30 seconds for more responsive feel
    const interval = setInterval(fetchRates, 30000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevRates])

  if (loading) {
    return (
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="shrink-0 w-[110px] h-[52px] rounded-lg bg-white/[0.03] border border-white/[0.06] animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
      {rates.map((rate) => {
        const flash = flashPairs[rate.pair]
        return (
          <div
            key={rate.pair}
            className={`shrink-0 px-3 py-2 rounded-lg border transition-all duration-300 ${
              flash === 'up' ? 'bg-green-500/[0.08] border-green-500/25' :
              flash === 'down' ? 'bg-red-500/[0.08] border-red-500/25' :
              'bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12]'
            }`}
          >
            <div className="text-[10px] text-text-dim font-medium">{rate.pair}</div>
            <div className={`text-sm font-mono font-semibold transition-colors duration-300 ${
              flash === 'up' ? 'text-green-400' :
              flash === 'down' ? 'text-red-400' :
              'text-heading'
            }`}>{rate.price}</div>
          </div>
        )
      })}
      <div className="shrink-0 flex flex-col items-start gap-0.5 pl-1">
        <div className="flex items-center gap-1 text-[9px] text-text-dim/50">
          <span className="w-1 h-1 rounded-full bg-green-400/50 animate-pulse" />
          Indicatief
        </div>
        {lastUpdate && (
          <span className="text-[8px] text-text-dim/30">
            {lastUpdate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── Main Component ──────────────────────────────────────── */
export default function NieuwsContent() {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeDays, setActiveDays] = useState(7)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null)
  const [showDutch, setShowDutch] = useState(true)

  const [isFirstLoad, setIsFirstLoad] = useState(true)

  const fetchNews = useCallback(async (retry = false) => {
    if (!retry) setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/news?category=${activeCategory}&days=${activeDays}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const arts = data.articles || []
      setArticles(arts)
      setFetchedAt(data.fetchedAt)

      // First load returns empty because feeds are being fetched in background
      // Auto-retry after 8 seconds to pick up the newly stored articles
      if (arts.length === 0 && isFirstLoad) {
        setIsFirstLoad(false)
        setTimeout(() => fetchNews(true), 8000)
      } else {
        setIsFirstLoad(false)
      }
    } catch {
      setError('Kon nieuws niet laden. Probeer het later opnieuw.')
    } finally {
      setLoading(false)
    }
  }, [activeCategory, activeDays, isFirstLoad])

  useEffect(() => {
    fetchNews()
  }, [fetchNews])

  // Close reader on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedArticle(null)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  // Group articles by date for timeline view
  const groupedArticles: { date: string; label: string; articles: NewsArticle[] }[] = []
  const dateMap = new Map<string, NewsArticle[]>()
  for (const article of articles) {
    const d = new Date(article.publishedAt)
    const key = d.toLocaleDateString('nl-NL', { year: 'numeric', month: '2-digit', day: '2-digit' })
    if (!dateMap.has(key)) dateMap.set(key, [])
    dateMap.get(key)!.push(article)
  }
  for (const [dateKey, arts] of dateMap) {
    const d = new Date(arts[0].publishedAt)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    let label: string
    if (d.toDateString() === today.toDateString()) {
      label = 'Vandaag'
    } else if (d.toDateString() === yesterday.toDateString()) {
      label = 'Gisteren'
    } else {
      label = d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
    }
    groupedArticles.push({ date: dateKey, label, articles: arts })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* Article Reader Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-4 sm:py-8 px-2 sm:px-4" onClick={() => setSelectedArticle(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-bg-card border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Reader header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${sourceColors[selectedArticle.source] || 'bg-white/[0.06] text-text-muted border-white/[0.08]'}`}>
                  {selectedArticle.source}
                </span>
                <span className="text-xs text-text-dim">{timeAgo(selectedArticle.publishedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Language toggle in reader */}
                <button
                  onClick={() => setShowDutch(!showDutch)}
                  className="text-[10px] px-2 py-1 rounded border border-white/[0.08] text-text-dim hover:text-heading transition-colors"
                >
                  {showDutch ? 'EN' : 'NL'}
                </button>
                <button onClick={() => setSelectedArticle(null)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Reader content */}
            <div className="px-4 sm:px-6 py-4 sm:py-6">
              <h2 className="text-xl font-display font-semibold text-heading mb-3 leading-snug">
                {getDisplayTitle(selectedArticle, showDutch)}
                {showDutch && !selectedArticle.titleNl && (
                  <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/60 font-normal align-middle">Vertaling niet beschikbaar</span>
                )}
              </h2>

              {/* Relevance context */}
              {selectedArticle.relevanceContext && (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light shrink-0">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span className="text-xs text-accent-light font-medium">{selectedArticle.relevanceContext}</span>
                </div>
              )}

              {/* Affected currencies */}
              {selectedArticle.affectedCurrencies.length > 0 && (
                <div className="flex items-center gap-1.5 mb-4">
                  <span className="text-[10px] text-text-dim">Impact op:</span>
                  {selectedArticle.affectedCurrencies.map(c => (
                    <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent-light border border-accent/20 font-mono font-bold">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Economic impact indicator */}
              <ImpactIndicator article={selectedArticle} />

              {/* Article text */}
              <div className="text-sm text-text leading-relaxed whitespace-pre-line">
                {getDisplaySummary(selectedArticle, showDutch)}
              </div>

              {selectedArticle.fullContent && selectedArticle.fullContent.length > selectedArticle.summary.length + 50 && (
                <div className="mt-4 text-sm text-text-muted leading-relaxed whitespace-pre-line">
                  {selectedArticle.fullContent.slice(selectedArticle.summary.length).trim().slice(0, 800)}
                  {selectedArticle.fullContent.length > selectedArticle.summary.length + 800 && '...'}
                </div>
              )}
            </div>

            {/* Reader footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border flex items-center justify-between gap-3">
              <p className="text-[10px] text-text-dim">Bron: {selectedArticle.source}</p>
              <a
                href={selectedArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent/15 border border-accent/25 text-accent-light text-sm font-medium hover:bg-accent/25 transition-colors"
              >
                Lees volledig artikel
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-accent-glow flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
              <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
              <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-heading">
              Nieuws
            </h1>
            <p className="text-sm text-text-muted">
              Gecureerd financieel nieuws, gefilterd op relevantie voor FX
            </p>
          </div>
        </div>
        <p className="text-text-muted max-w-2xl text-sm leading-relaxed mt-3">
          Alleen het nieuws dat er toe doet: centrale bank beslissingen, rentebeleid, inflatie,
          geopolitieke ontwikkelingen en macro-economische data. Automatisch vertaald en gefilterd.
        </p>

        {/* Sources */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[11px] text-text-dim">Bronnen:</span>
          {[
            { name: 'Federal Reserve', url: 'https://www.federalreserve.gov' },
            { name: 'ECB', url: 'https://www.ecb.europa.eu' },
            { name: 'ForexLive', url: 'https://www.forexlive.com' },
            { name: 'CNBC', url: 'https://www.cnbc.com' },
            { name: 'Bloomberg', url: 'https://www.bloomberg.com' },
            { name: 'BBC', url: 'https://www.bbc.co.uk/news/business' },
            { name: 'NY Times', url: 'https://www.nytimes.com/section/world' },
          ].map((src, i) => (
            <a key={src.name} href={src.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-text-dim hover:text-text-muted transition-colors">
              {src.name}{i < 6 ? ' ·' : ''}
            </a>
          ))}
          <span className="text-[10px] text-text-dim/60 ml-1">(via publieke RSS feeds)</span>
        </div>
      </div>

      {/* Live FX Widget */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span className="text-xs font-medium text-text-muted">Major Pairs</span>
        </div>
        <FxWidget />
      </div>

      {/* Controls bar */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Category tabs + language toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 overflow-x-auto flex-1">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`px-3.5 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all ${
                  activeCategory === cat.value
                    ? 'bg-accent/15 text-accent-light border border-accent/25'
                    : 'bg-white/[0.03] text-text-muted border border-white/[0.06] hover:bg-white/[0.06] hover:text-heading'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Language toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowDutch(!showDutch)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                showDutch
                  ? 'bg-white/[0.06] border-white/[0.1] text-heading'
                  : 'bg-white/[0.03] border-white/[0.06] text-text-muted hover:text-heading'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              {showDutch ? 'NL' : 'EN'}
            </button>
          </div>
        </div>

        {/* Date range selector */}
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="text-xs text-text-dim mr-1">Periode:</span>
          {dateRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => setActiveDays(range.value)}
              className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-all ${
                activeDays === range.value
                  ? 'bg-white/[0.08] text-heading border border-white/[0.12]'
                  : 'text-text-dim hover:text-text-muted hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs text-text-dim">
          {fetchedAt && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span>Bijgewerkt {timeAgo(fetchedAt)}</span>
            </>
          )}
          {!loading && articles.length > 0 && (
            <>
              <span className="ml-2">{articles.length} artikelen</span>
              <span className="ml-2 text-accent-light/50">&middot; Artikelen &lt; 72u be&iuml;nvloeden de Daily Briefing scoring</span>
            </>
          )}
        </div>
        <button
          onClick={fetchNews}
          disabled={loading}
          className="text-xs text-text-muted hover:text-heading transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Ververs
        </button>
      </div>

      {/* Loading */}
      {loading && articles.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-5 rounded-xl bg-bg-card border border-border animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-16 h-5 rounded bg-white/[0.06]" />
                <div className="w-12 h-5 rounded bg-white/[0.06]" />
              </div>
              <div className="w-3/4 h-5 rounded bg-white/[0.06] mb-2" />
              <div className="w-full h-4 rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-6 rounded-xl bg-red-500/[0.06] border border-red-500/20 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={fetchNews} className="mt-3 text-xs text-red-400/70 hover:text-red-400 transition-colors">
            Probeer opnieuw
          </button>
        </div>
      )}

      {/* Empty / Loading feeds */}
      {!loading && !error && articles.length === 0 && (
        <div className="p-8 rounded-xl bg-bg-card border border-border text-center">
          {isFirstLoad ? (
            <>
              <div className="flex justify-center mb-3">
                <span className="inline-block w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
              <p className="text-text-muted text-sm">Nieuwsfeeds worden voor het eerst opgehaald...</p>
              <p className="text-text-dim text-xs mt-1">Dit duurt enkele seconden. De pagina ververst automatisch.</p>
            </>
          ) : (
            <>
              <p className="text-text-muted text-sm">Geen relevant nieuws gevonden voor deze periode en categorie.</p>
              <p className="text-text-dim text-xs mt-1">Probeer een andere periode of categorie, of ververs handmatig.</p>
            </>
          )}
        </div>
      )}

      {/* Articles grouped by date */}
      {groupedArticles.length > 0 && (
        <div className="space-y-6">
          {groupedArticles.map((group) => (
            <div key={group.date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">{group.label}</h3>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-text-dim">{group.articles.length} artikelen</span>
              </div>

              {/* Articles for this date */}
              <div className="space-y-2.5">
                {group.articles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => setSelectedArticle(article)}
                    className="block w-full text-left p-4 sm:p-5 rounded-xl bg-bg-card border border-border hover:border-border-light transition-all group cursor-pointer"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Source, category & relevance badges */}
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${sourceColors[article.source] || 'bg-white/[0.06] text-text-muted border-white/[0.08]'}`}>
                            {article.source}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-text-dim">
                            {categoryLabels[article.category] || article.category}
                          </span>
                          {article.relevanceScore >= 5 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent-light border border-accent/20 font-semibold">
                              Belangrijk
                            </span>
                          )}
                          {/* Currency impact badges */}
                          {article.affectedCurrencies.slice(0, 3).map(c => (
                            <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-text-dim font-mono font-bold">
                              {c}
                            </span>
                          ))}
                          {/* Economic impact indicator */}
                          <ImpactIndicator article={article} compact />
                        </div>

                        {/* Title */}
                        <h3 className="text-sm sm:text-base font-semibold text-heading group-hover:text-accent-light transition-colors leading-snug mb-1">
                          {getDisplayTitle(article, showDutch)}
                          {showDutch && !article.titleNl && (
                            <span className="ml-1.5 text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400/60 font-normal align-middle">EN</span>
                          )}
                        </h3>

                        {/* Summary */}
                        {article.summary && (
                          <p className="text-xs sm:text-sm text-text-muted line-clamp-2 leading-relaxed mb-1.5">
                            {getDisplaySummary(article, showDutch)}
                          </p>
                        )}

                        {/* Relevance context */}
                        {article.relevanceContext && (
                          <p className="text-[11px] text-accent-light/70 flex items-center gap-1.5">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {article.relevanceContext}
                          </p>
                        )}
                      </div>

                      {/* Time */}
                      <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 shrink-0">
                        <span className="text-xs text-text-dim whitespace-nowrap">
                          {timeAgo(article.publishedAt)}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim group-hover:text-accent-light transition-colors">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-8 text-center">
        <p className="text-[11px] text-text-dim leading-relaxed max-w-lg mx-auto">
          Nieuwsartikelen worden automatisch gefilterd en vertaald uit publieke RSS feeds.
          Sanders Capital is niet verantwoordelijk voor de inhoud van externe bronnen.
          Vertalingen zijn automatisch en kunnen onnauwkeurigheden bevatten.
          Koersen zijn indicatief en kunnen afwijken van actuele marktprijzen.
        </p>
      </div>
    </div>
  )
}
