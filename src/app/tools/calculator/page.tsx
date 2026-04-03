'use client'

import { useState } from 'react'

const currencyPairs = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'NZD/USD', 'USD/CAD',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'EUR/AUD', 'EUR/CAD', 'GBP/AUD',
  'GBP/CAD', 'XAU/USD', 'XAG/USD',
]

const accountCurrencies = ['USD', 'EUR', 'GBP']

// Approximate pip values per standard lot (100,000 units) in USD
function getPipValue(pair: string): number {
  const p = pair.replace('/', '')
  // For pairs where USD is quote currency, pip = $10 per standard lot
  if (['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'].includes(p)) return 10
  // For JPY pairs, pip value varies but approximate
  if (p.includes('JPY')) return 6.5
  // Gold
  if (p === 'XAUUSD') return 10
  // Silver
  if (p === 'XAGUSD') return 50
  // For pairs where USD is base currency
  if (['USDCHF', 'USDCAD'].includes(p)) return 8
  // Cross pairs - approximate
  return 8
}

export default function CalculatorPage() {
  const [pair, setPair] = useState('EUR/USD')
  const [accountCurrency, setAccountCurrency] = useState('USD')
  const [accountSize, setAccountSize] = useState('')
  const [riskPercent, setRiskPercent] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [result, setResult] = useState<{ riskAmount: number; lots: number; units: number; pipValue: number } | null>(null)

  const calculate = () => {
    const size = parseFloat(accountSize)
    const risk = parseFloat(riskPercent)
    const sl = parseFloat(stopLoss)

    if (!size || !risk || !sl || sl === 0) {
      setResult(null)
      return
    }

    const riskAmount = size * (risk / 100)
    const pipValue = getPipValue(pair)
    const lots = riskAmount / (sl * pipValue)
    const units = lots * 100000

    setResult({ riskAmount, lots, units, pipValue })
  }

  const reset = () => {
    setAccountSize('')
    setRiskPercent('')
    setStopLoss('')
    setResult(null)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-display font-semibold text-heading mb-4">
          Position Size Calculator
        </h1>
        <p className="text-text-muted max-w-lg mx-auto">
          Bereken de juiste positiegrootte op basis van je accountgrootte, risicopercentage en stop-loss afstand.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Input */}
        <div className="space-y-5 p-6 rounded-xl bg-bg-card border border-border">
          <h2 className="text-lg font-display font-semibold text-heading mb-2">Invoer</h2>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">Currency Pair</label>
            <select
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-bg border border-border text-heading text-sm focus:outline-none focus:border-accent"
            >
              {currencyPairs.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">Account Currency</label>
            <select
              value={accountCurrency}
              onChange={(e) => setAccountCurrency(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-bg border border-border text-heading text-sm focus:outline-none focus:border-accent"
            >
              {accountCurrencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">Account Size ({accountCurrency})</label>
            <input
              type="number"
              value={accountSize}
              onChange={(e) => setAccountSize(e.target.value)}
              placeholder="bijv. 10000"
              className="w-full px-4 py-2.5 rounded-lg bg-bg border border-border text-heading text-sm focus:outline-none focus:border-accent placeholder:text-text-dim"
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">Risk Ratio (%)</label>
            <input
              type="number"
              step="0.1"
              value={riskPercent}
              onChange={(e) => setRiskPercent(e.target.value)}
              placeholder="bijv. 1"
              className="w-full px-4 py-2.5 rounded-lg bg-bg border border-border text-heading text-sm focus:outline-none focus:border-accent placeholder:text-text-dim"
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">Stop-Loss (Pips)</label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="bijv. 25"
              className="w-full px-4 py-2.5 rounded-lg bg-bg border border-border text-heading text-sm focus:outline-none focus:border-accent placeholder:text-text-dim"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
            <button
              onClick={calculate}
              className="flex-1 px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors"
            >
              Bereken
            </button>
            <button
              onClick={reset}
              className="px-6 py-2.5 rounded-lg border border-border text-text-muted hover:text-heading text-sm transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="p-6 rounded-xl bg-bg-card border border-border">
          <h2 className="text-lg font-display font-semibold text-heading mb-6">Resultaat</h2>

          {result ? (
            <div className="space-y-5">
              <div className="p-4 rounded-lg bg-bg border border-border">
                <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Risico bedrag</p>
                <p className="text-2xl font-display font-semibold text-heading">
                  {accountCurrency} {result.riskAmount.toFixed(2)}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-accent-glow border border-accent/20">
                <p className="text-xs text-accent-light uppercase tracking-wider mb-1">Position Size</p>
                <p className="text-3xl font-display font-semibold text-heading">
                  {result.lots.toFixed(2)} <span className="text-lg text-text-muted">lots</span>
                </p>
              </div>

              <div className="p-4 rounded-lg bg-bg border border-border">
                <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Units</p>
                <p className="text-2xl font-display font-semibold text-heading">
                  {result.units.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-bg border border-border">
                <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Pip Value (per lot)</p>
                <p className="text-xl font-display font-semibold text-heading">
                  ≈ ${result.pipValue.toFixed(2)}
                </p>
              </div>

              <p className="text-xs text-text-dim">
                * Pip values zijn benaderingen. Gebruik de exacte waarden van je broker voor nauwkeurige berekeningen.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-text-dim mb-4">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="10" x2="16" y2="10" />
                <line x1="8" y1="14" x2="12" y2="14" />
              </svg>
              <p className="text-sm text-text-dim">Vul de invoervelden in en klik op Bereken</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 p-4 rounded-xl bg-bg-card border border-border">
        <p className="text-xs text-text-dim text-center">
          Disclaimer: Deze calculator is een hulpmiddel voor educatieve doeleinden. Resultaten zijn benaderingen.
          Controleer altijd de exacte pip values en margin requirements bij je broker. Dit is geen financieel advies.
        </p>
      </div>
    </div>
  )
}
