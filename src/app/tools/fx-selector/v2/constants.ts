// ─── Constants ──────────────────────────────────────────────

export const MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'] as const

export const INTERMARKET_HOW_TO_READ: Record<string, { summary: string; detail: string; levels: string; fxImpact: string }> = {
  us10y: {
    summary: 'De rente op 10-jarige Amerikaanse staatsobligaties. Dit is het belangrijkste rentesignaal ter wereld.',
    detail: 'Stijgende yields betekenen dat beleggers hogere vergoeding eisen voor het uitlenen van geld aan de overheid. Dit kan komen door inflatieverwachtingen, hawkish Fed-beleid, of sterk economisch vertrouwen. Dalende yields wijzen op het tegenovergestelde: beleggers vluchten naar de veiligheid van staatsobligaties (risk-off).',
    levels: 'Boven 4.5% = zeer restrictief, drukt aandelen en high-yield valuta\'s. 3.5-4.5% = normaal. Onder 3.5% = accommoderend, ondersteunt risk-on.',
    fxImpact: 'Stijgend → USD sterker (hogere rente trekt kapitaal aan). Dalend → USD zwakker. JPY paren zeer gevoelig: hogere US yields = USD/JPY stijgt.',
  },
  sp500: {
    summary: 'De S&P 500 is de ultieme barometer voor het mondiale risicosentiment.',
    detail: 'De S&P 500 volgt de 500 grootste Amerikaanse bedrijven en wordt wereldwijd als maatstaf gebruikt. Als de S&P stijgt, willen beleggers risico nemen (risk-on). Ze kopen aandelen en high-yield valuta\'s. Als de S&P daalt, vluchten ze naar veilige havens. De correlatie met FX is niet 1:1 maar geeft de richting van het sentiment.',
    levels: 'Dagelijkse beweging >1% = significant. >2% = hoge volatiliteit. De trend (5-daags gemiddelde) is belangrijker dan de dagbeweging.',
    fxImpact: 'Stijgend → AUD, NZD, CAD sterker (carry trades aantrekkelijk). Dalend → JPY, CHF sterker (veilige havens). EUR en GBP reageren minder direct.',
  },
  vix: {
    summary: 'De VIX (Fear Index) meet de verwachte volatiliteit van de S&P 500 over de komende 30 dagen.',
    detail: 'De VIX wordt berekend uit optieprijzen. Een hoge VIX betekent dat beleggers veel betalen voor bescherming tegen koersdalingen — ze zijn bang. Een lage VIX betekent rust. Belangrijk: de VIX is mean-reverting. Na een piek keert hij altijd terug naar gemiddeld niveau. Extremen zijn daarom ook potentiële keerpunten.',
    levels: 'Onder 15 = markt is kalm, risk-on. 15-20 = normaal. 20-25 = verhoogde stress. 25-30 = angst, risk-off. Boven 30 = paniek (zeldzaam, grote kans op snap-back rally).',
    fxImpact: 'VIX stijgt → JPY en CHF sterker, AUD en NZD zwakker. VIX daalt → omgekeerd. VIX boven 25 versterkt het risk-off signaal significant.',
  },
  gold: {
    summary: 'Goud is de oudste veilige haven. Het stijgt bij onzekerheid, inflatie en dalende reële rentes.',
    detail: 'Goud heeft geen rente of dividend, dus het wordt aantrekkelijker als reële rentes (nominale rente minus inflatie) dalen. Bij geopolitieke spanningen en financiële onzekerheid vluchten beleggers naar goud. Goud + dalende aandelen = sterke risk-off bevestiging. Goud + stijgende aandelen = mogelijk inflatiezorgen.',
    levels: 'De absolute prijs is minder belangrijk dan de dagelijkse verandering. Een stijging van >1% op een dag is significant.',
    fxImpact: 'Goud stijgt → vaak JPY en CHF mee sterker (alle veilige havens). Goud daalt → beleggers verlaten veilige havens → AUD (goud-exporteur) kan profiteren.',
  },
  oil: {
    summary: 'Olie (WTI) beïnvloedt specifieke valuta\'s direct via import/export relaties.',
    detail: 'Canada is een grote olie-exporteur: hogere olieprijzen = meer export-inkomsten = sterker CAD. Japan importeert bijna alle olie: hogere olieprijzen = hogere importkosten = zwakker JPY. Indirect: hogere olieprijzen → hogere inflatie → centrale banken worden hawkisher. Dit kan EUR en GBP beïnvloeden.',
    levels: 'Boven $80/vat = bullish voor CAD en inflatoir. $60-80 = normaal. Onder $60 = deflatoir, bearish CAD.',
    fxImpact: 'Stijgend → CAD sterker, JPY zwakker. Dalend → CAD zwakker, JPY minder onder druk. Extreme olieprijzen beïnvloeden het bredere regime.',
  },
  dxy: {
    summary: 'De Dollar Index meet de USD tegen een mandje van 6 valuta\'s (EUR 57.6%, JPY 13.6%, GBP 11.9%, CAD 9.1%, SEK 4.2%, CHF 3.6%).',
    detail: 'Omdat EUR het grootste gewicht heeft (57.6%), beweegt de DXY grotendeels invers aan EUR/USD. Een stijgende DXY bevestigt brede USD-sterkte, niet alleen tegen één valuta. Dit is nuttig om te checken of een USD-move breed gedragen is of geïsoleerd tot één paar.',
    levels: 'Boven 105 = sterke USD. 100-105 = neutraal. Onder 100 = zwakke USD. Extremen (>108 of <95) zijn zeldzaam en wijzen op sterke regimes.',
    fxImpact: 'DXY stijgt → bevestigt USD Dominant regime. DXY daalt → bevestigt USD Zwak regime. Kijk of DXY-beweging consistent is met individuele paarbewegingen.',
  },
}

export const REGIME_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/25', glow: 'shadow-red-500/10' },
  green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/25', glow: 'shadow-green-500/10' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/25', glow: 'shadow-blue-500/10' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25', glow: 'shadow-amber-500/10' },
  gray: { bg: 'bg-white/[0.04]', text: 'text-text-muted', border: 'border-white/[0.08]', glow: '' },
}
