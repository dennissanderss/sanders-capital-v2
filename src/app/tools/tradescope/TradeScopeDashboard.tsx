'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { parseCSV, type ParsedTrade } from './utils/csvParser'
import { calculateMetrics, runMonteCarlo, optimizeRiskReward, type TradeMetrics } from './utils/metrics'
import DashboardTab from './tabs/DashboardTab'
import AnalyticsTab from './tabs/AnalyticsTab'
import StrategyTesterTab from './tabs/StrategyTesterTab'
import OptimizationTab from './tabs/OptimizationTab'

type TabId = 'dashboard' | 'analytics' | 'strategy' | 'optimization'

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: 'strategy',
    label: 'Strategy Tester',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: 'optimization',
    label: 'Optimalisatie',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

export default function TradeScopeDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [trades, setTrades] = useState<ParsedTrade[]>([])
  const [metrics, setMetrics] = useState<TradeMetrics | null>(null)
  const [startingBalance, setStartingBalance] = useState(10000)
  const [isLoading, setIsLoading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setIsLoading(true)
      setFileName(file.name)

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const csvText = event.target?.result as string
          const parsed = parseCSV(csvText)
          setTrades(parsed)
          setMetrics(calculateMetrics(parsed, startingBalance))
        } catch (err) {
          console.error('CSV parse error:', err)
          alert('Kon het CSV bestand niet lezen. Controleer of het een geldig FXReplay export is.')
        } finally {
          setIsLoading(false)
        }
      }
      reader.readAsText(file)
    },
    [startingBalance]
  )

  const handleBalanceChange = useCallback(
    (newBalance: number) => {
      setStartingBalance(newBalance)
      if (trades.length > 0) {
        setMetrics(calculateMetrics(trades, newBalance))
      }
    },
    [trades]
  )

  const monteCarloData = useMemo(() => {
    if (trades.length === 0) return null
    return runMonteCarlo(trades, 1000, startingBalance)
  }, [trades, startingBalance])

  const optimizationData = useMemo(() => {
    if (trades.length === 0) return null
    return optimizeRiskReward(trades, startingBalance)
  }, [trades, startingBalance])

  // Empty state
  if (trades.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-accent-glow flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-heading mb-3">
            TradeScope
          </h1>
          <p className="text-text-muted max-w-lg mx-auto">
            Upload je FXReplay CSV export en krijg direct inzicht in je performance, equity curve,
            Monte Carlo simulaties en optimalisatie suggesties.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-8 rounded-xl glass glass-hover border-2 border-dashed border-border hover:border-accent/50 cursor-pointer transition-all text-center group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim mx-auto mb-4 group-hover:text-accent-light transition-colors">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-heading font-medium mb-1">Upload CSV bestand</p>
            <p className="text-sm text-text-dim">
              Sleep je FXReplay export hierheen of klik om te selecteren
            </p>
          </div>

          <div className="mt-6">
            <label className="block text-xs text-text-dim mb-2">Startbalans</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">$</span>
              <input
                type="number"
                value={startingBalance}
                onChange={(e) => setStartingBalance(Math.max(100, parseInt(e.target.value) || 10000))}
                className="flex-1 px-3 py-2 rounded-lg glass text-sm text-heading bg-transparent border border-border focus:border-accent/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="mt-8 p-4 rounded-lg glass">
            <h3 className="text-xs font-semibold text-heading mb-2">Ondersteunde formaten</h3>
            <ul className="text-xs text-text-dim space-y-1">
              <li className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light"><polyline points="20 6 9 17 4 12" /></svg>
                FXReplay CSV export
              </li>
              <li className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light"><polyline points="20 6 9 17 4 12" /></svg>
                Kolommen: Trade #, Open/Close Date, Symbol, Action, P/L, etc.
              </li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header with file info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-semibold text-heading">TradeScope</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-text-dim">{fileName}</span>
            <span className="text-xs text-text-dim">·</span>
            <span className="text-xs text-text-dim">{trades.length} trades</span>
            <span className="text-xs text-text-dim">·</span>
            <span className="text-xs text-text-dim">
              Startbalans: ${startingBalance.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-dim">Balans:</label>
            <input
              type="number"
              value={startingBalance}
              onChange={(e) => handleBalanceChange(Math.max(100, parseInt(e.target.value) || 10000))}
              className="w-24 px-2 py-1.5 rounded-lg text-xs text-heading bg-transparent border border-border focus:border-accent/50 focus:outline-none transition-colors"
            />
          </div>
          <button
            onClick={() => {
              setTrades([])
              setMetrics(null)
              setFileName(null)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
            className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-heading hover:border-border-light transition-colors"
          >
            Nieuw bestand
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-accent/15 text-accent-light border border-accent/30'
                : 'text-text-muted hover:text-heading hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-text-muted">Trades analyseren...</p>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && metrics && (
            <DashboardTab trades={trades} metrics={metrics} startingBalance={startingBalance} />
          )}
          {activeTab === 'analytics' && metrics && (
            <AnalyticsTab trades={trades} metrics={metrics} />
          )}
          {activeTab === 'strategy' && monteCarloData && (
            <StrategyTesterTab
              trades={trades}
              monteCarloData={monteCarloData}
              startingBalance={startingBalance}
            />
          )}
          {activeTab === 'optimization' && optimizationData && metrics && (
            <OptimizationTab
              trades={trades}
              metrics={metrics}
              optimizationData={optimizationData}
              startingBalance={startingBalance}
            />
          )}
        </>
      )}
    </div>
  )
}
