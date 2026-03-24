import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Rentetarieven - Sanders Capital',
  description: 'Actuele rentetarieven van centrale banken wereldwijd.',
}

const interestRates = [
  { country: '🇺🇸', name: 'Verenigde Staten', bank: 'Federal Reserve (Fed)', rate: '4.25-4.50%', currency: 'USD' },
  { country: '🇪🇺', name: 'Eurozone', bank: 'Europese Centrale Bank (ECB)', rate: '2.65%', currency: 'EUR' },
  { country: '🇬🇧', name: 'Verenigd Koninkrijk', bank: 'Bank of England (BoE)', rate: '4.50%', currency: 'GBP' },
  { country: '🇯🇵', name: 'Japan', bank: 'Bank of Japan (BoJ)', rate: '0.50%', currency: 'JPY' },
  { country: '🇨🇭', name: 'Zwitserland', bank: 'Swiss National Bank (SNB)', rate: '0.25%', currency: 'CHF' },
  { country: '🇦🇺', name: 'Australië', bank: 'Reserve Bank of Australia (RBA)', rate: '4.10%', currency: 'AUD' },
  { country: '🇨🇦', name: 'Canada', bank: 'Bank of Canada (BoC)', rate: '2.75%', currency: 'CAD' },
  { country: '🇳🇿', name: 'Nieuw-Zeeland', bank: 'Reserve Bank of NZ (RBNZ)', rate: '3.75%', currency: 'NZD' },
  { country: '🇨🇳', name: 'China', bank: "People's Bank of China (PBoC)", rate: '3.10%', currency: 'CNY' },
  { country: '🇸🇪', name: 'Zweden', bank: 'Sveriges Riksbank', rate: '2.25%', currency: 'SEK' },
  { country: '🇳🇴', name: 'Noorwegen', bank: 'Norges Bank', rate: '4.50%', currency: 'NOK' },
  { country: '🇲🇽', name: 'Mexico', bank: 'Banco de México', rate: '9.50%', currency: 'MXN' },
  { country: '🇿🇦', name: 'Zuid-Afrika', bank: 'South African Reserve Bank', rate: '7.50%', currency: 'ZAR' },
  { country: '🇹🇷', name: 'Turkije', bank: 'Central Bank of Turkey', rate: '42.50%', currency: 'TRY' },
  { country: '🇧🇷', name: 'Brazilië', bank: 'Banco Central do Brasil', rate: '14.25%', currency: 'BRL' },
]

export default function RentePage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-display font-semibold text-heading mb-4">
          Rentetarieven Centrale Banken
        </h1>
        <p className="text-text-muted max-w-lg mx-auto">
          Overzicht van de actuele beleidsrentes van de belangrijkste centrale banken wereldwijd.
        </p>
      </div>

      {/* Major currencies highlight */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {interestRates.slice(0, 8).map((item) => (
          <div key={item.currency} className="p-4 rounded-xl bg-bg-card border border-border text-center">
            <p className="text-2xl mb-1">{item.country}</p>
            <p className="text-xs text-text-muted mb-1">{item.currency}</p>
            <p className="text-xl font-display font-semibold text-heading">{item.rate}</p>
            <p className="text-xs text-text-dim mt-1">{item.bank.split('(')[0].trim()}</p>
          </div>
        ))}
      </div>

      {/* Full table */}
      <div className="rounded-xl bg-bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Land</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Centrale Bank</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Valuta</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Rente</th>
              </tr>
            </thead>
            <tbody>
              {interestRates.map((item) => (
                <tr key={item.currency} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.country}</span>
                      <span className="text-sm text-heading">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-text-muted">{item.bank}</td>
                  <td className="px-6 py-3.5">
                    <span className="px-2 py-0.5 rounded bg-bg border border-border text-xs font-mono text-heading">{item.currency}</span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className="text-sm font-semibold text-heading">{item.rate}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-xl bg-bg-card border border-border">
        <p className="text-xs text-text-dim text-center">
          Rentetarieven worden periodiek bijgewerkt. Raadpleeg de officiële websites van de centrale banken voor de meest actuele informatie.
          Dit is geen financieel advies.
        </p>
      </div>
    </div>
  )
}
