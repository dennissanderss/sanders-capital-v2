// ─── Intermarket instrument metadata ─────────────────────────
// Statische uitleg per instrument voor de Briefing drill-down.
// Description = wat is dit instrument (één korte regel, tertiary).
// interpretation = hoe lees je de beweging (één regel, secondary).
// Gekoppeld op de instrument-keys uit /api/briefing-v2 (intermarketSignals[].key).

export interface IntermarketMeta {
  label: string
  description: string
  interpretation: string
}

export const INTERMARKET_META: Record<string, IntermarketMeta> = {
  vix: {
    label: 'VIX',
    description: 'Volatiliteit / angst-index',
    interpretation: 'Daling = markt rustig, risicobereidheid — Risk-On. Stijging = angst — Risk-Off.',
  },
  sp500: {
    label: 'S&P 500',
    description: 'Amerikaanse aandelenindex',
    interpretation: 'Stijging = risicobereidheid — Risk-On. Daling = risico-aversie — Risk-Off.',
  },
  gold: {
    label: 'Goud',
    description: 'Veilige haven & inflatie-hedge',
    interpretation: 'Stijging = vlucht naar veiligheid — vaak Risk-Off. Daling = vertrouwen in risico.',
  },
  dxy: {
    label: 'DXY',
    description: 'Dollar-index (USD vs valutamandje)',
    interpretation: 'Stijging = sterke dollar — druk op EUR, GBP, AUD. Daling = zwakke dollar.',
  },
  us10y: {
    label: 'US 10Y',
    description: 'Amerikaanse 10-jaars rente',
    interpretation: 'Stijging = hogere rente, kapitaal naar USD — vaak dollar-positief.',
  },
  oil: {
    label: 'Olie',
    description: 'Ruwe olieprijs (WTI/Brent)',
    interpretation: 'Stijging = sterker voor olie-exporteurs (CAD), maar inflatiedruk wereldwijd.',
  },
}

export function getIntermarketMeta(key: string): IntermarketMeta {
  return (
    INTERMARKET_META[key.toLowerCase()] ?? {
      label: key.toUpperCase(),
      description: 'Intermarket-instrument',
      interpretation: 'Beweging wordt afgezet tegen het huidige regime.',
    }
  )
}
