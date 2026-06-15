// ─── Shell configuration for both FX Desk tools ───────────────
//
// Defines the title, one-line subtitle, "Hoe werkt dit?" popover content,
// tab list, and methodology accordion content for each tool.

export type ShellTab = { id: string; label: string }

export type ShellHowTo = {
  title: string
  body: string
  steps: string[]
}

export type ShellMethodBlock = {
  h: string
  type: 'p' | 'ul'
  text?: string
  items?: string[]
}

export type ShellToolConfig = {
  key: 'briefing' | 'execution'
  href: string
  title: string
  oneline: string
  tabs: ShellTab[]
  howto: ShellHowTo
  method: ShellMethodBlock[]
}

export const TOOL_CONFIG: Record<'briefing' | 'execution', ShellToolConfig> = {
  briefing: {
    key: 'briefing',
    href: '/tools/fx-selector/v2',
    title: 'Briefing',
    oneline:
      'Dagelijkse fundamentele analyse van de valutamarkt, vertaald naar een handvol concrete calls met een score en een status.',
    tabs: [
      { id: 'vandaag', label: 'Vandaag' },
      { id: 'calls', label: 'Calls' },
    ],
    howto: {
      title: 'Hoe werkt de Briefing?',
      body: 'Elke ochtend weegt het model de macrostand, het rente-beeld en het marktsentiment. Daaruit volgt een marktregime, een confidence en een korte lijst valutaparen met de sterkste fundamentele onbalans.',
      steps: [
        'Lees bovenaan het regime en de confidence van vandaag.',
        'Bekijk de valutascores om te zien welke munten sterk of zwak staan.',
        'Pak de concrete calls: paar, richting, score en of ze entry-ready zijn.',
        'Onder Calls vind je het volledige spoor met uitkomst per call.',
      ],
    },
    method: [
      {
        h: 'Wat de score betekent',
        type: 'p',
        text: 'De score van 0 tot 10 weegt vier lagen: de fundamentele onbalans tussen beide munten, de afstand tot belangrijke renteverwachtingen, het momentum in het marktsentiment en de timing van de instap. Een call wordt pas entry-ready boven 6,0 met een passend regime.',
      },
      {
        h: 'Regime en confidence',
        type: 'ul',
        items: [
          'Het regime beschrijft de heersende risicohouding: risk-on, risk-off of neutraal.',
          'De confidence drukt uit hoe eenduidig de signalen samenvallen, niet de verwachte winstkans.',
          'Bij lage confidence verschuiven calls vaker naar de watchlist in plaats van entry-ready.',
        ],
      },
      {
        h: 'Hoe uitkomsten worden geboekt',
        type: 'p',
        text: 'Een call is correct als de koers het beoogde doel raakt voor de stop. Incorrect betekent dat de stop eerst werd geraakt. Pending blijft staan zolang de positie open is. Het resultaat wordt in pips genoteerd en gekoppeld aan de oorspronkelijke score, zodat de kalibratie van het model meetbaar blijft.',
      },
      {
        h: 'Bron van de call',
        type: 'ul',
        items: [
          'Fundamenteel: gedreven door macro, rente en sentiment uit deze briefing.',
          'Engine: gedreven door het technische uitvoeringsmodel van de Execution Engine.',
          'Beide bronnen lopen door dezelfde scoring, zodat ze vergelijkbaar blijven.',
        ],
      },
    ],
  },

  execution: {
    key: 'execution',
    href: '/tools/execution',
    title: 'Execution Engine',
    oneline:
      'Wat doet deze tool: het vertaalt de actieve strategie naar concrete entry-ready setups van vandaag, met instap, stop, target en de bijpassende positiegrootte.',
    tabs: [
      { id: 'setups', label: 'Setups' },
      { id: 'prestatie', label: 'Prestatie' },
    ],
    howto: {
      title: 'Hoe werkt de Execution Engine?',
      body: 'Kies een strategie en de engine toont de setups die vandaag aan de regels van dat profiel voldoen. De getoonde cijfers per strategie zijn de profielkenmerken, geen belofte over een individuele trade.',
      steps: [
        'Kies een strategie: Selective, Balanced of Aggressive.',
        'Bekijk de entry-ready setups met instap, stop, target en R:R.',
        'Stel je account en risk-percentage in voor de lotgrootte.',
        'Voer de setups uit volgens je eigen risicokader.',
      ],
    },
    method: [
      {
        h: 'De drie strategieën',
        type: 'ul',
        items: [
          'Selective: strenge filters, weinig maar hoog-overtuigde signalen.',
          'Balanced: de standaard, een evenwicht tussen frequentie en kwaliteit.',
          'Aggressive: brede dekking, meer signalen en meer ruis.',
        ],
      },
      {
        h: 'Winrate en profit factor',
        type: 'p',
        text: 'Winrate is het aandeel winnende trades binnen het profiel. Profit factor is de verhouding tussen totale winst en totaal verlies; boven 1,0 is netto positief. Trades per week geeft de verwachte frequentie. Deze waarden horen bij het profiel als geheel, niet bij een losse setup.',
      },
      {
        h: 'Position size',
        type: 'p',
        text: 'De lotgrootte volgt uit je accountomvang, je gekozen risk-percentage en de gemiddelde stop-afstand van de strategie. Pas het risk-percentage aan om de berekening direct mee te laten bewegen. Dit is een indicatieve hulpmiddel, geen handelsadvies.',
      },
    ],
  },
}
