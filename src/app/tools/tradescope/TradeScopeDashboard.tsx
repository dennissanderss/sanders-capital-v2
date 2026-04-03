'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { parseCSV, type ParseResult } from './utils/csvParser'
import { calculateMetrics, runMonteCarlo, optimizeRiskReward } from './utils/metrics'
import type { ParsedTrade } from './utils/csvParser'
import type { TradeMetrics } from './utils/metrics'
import { useTrades } from './hooks/useTrades'
import { useAccounts } from './hooks/useAccounts'
import { useStrategies } from './hooks/useStrategies'
import { useSetups } from './hooks/useSetups'
import { dbTradeToAnalytics, type TradeFilters, type TradescopeTab } from './types'
import dynamic from 'next/dynamic'

const DashboardTab = dynamic(() => import('./tabs/DashboardTab'), { ssr: false })
const AnalyticsTab = dynamic(() => import('./tabs/AnalyticsTab'), { ssr: false })
const StrategyTesterTab = dynamic(() => import('./tabs/StrategyTesterTab'), { ssr: false })
const OptimizationTab = dynamic(() => import('./tabs/OptimizationTab'), { ssr: false })
const JournalTab = dynamic(() => import('./tabs/JournalTab'), { ssr: false })
const AccountsTab = dynamic(() => import('./tabs/AccountsTab'), { ssr: false })
const ImportTab = dynamic(() => import('./tabs/ImportTab'), { ssr: false })
const RoutinesTab = dynamic(() => import('./tabs/RoutinesTab'), { ssr: false })
const StrategyAnalysisTab = dynamic(() => import('./tabs/StrategyAnalysisTab'), { ssr: false })
const PsychologyTab = dynamic(() => import('./tabs/PsychologyTab'), { ssr: false })
const InsightsTab = dynamic(() => import('./tabs/InsightsTab'), { ssr: false })
const PlaybookTab = dynamic(() => import('./tabs/PlaybookTab'), { ssr: false })
const NotesTab = dynamic(() => import('./tabs/NotesTab'), { ssr: false })

const tabs: { id: TradescopeTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
  },
  {
    id: 'journal',
    label: 'Journal',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  },
  {
    id: 'strategy',
    label: 'Monte Carlo',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  },
  {
    id: 'optimization',
    label: 'Optimalisatie',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  },
  {
    id: 'strategyAnalysis',
    label: 'Strategie',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
  },
  {
    id: 'psychology',
    label: 'Psychologie',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>,
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 12 18.469V19a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-.531c0-.895-.356-1.754-.988-2.386l-.547-.547z" /></svg>,
  },
  {
    id: 'routines',
    label: 'Routines',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  },
  {
    id: 'playbook',
    label: 'Playbook',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>,
  },
  {
    id: 'notes',
    label: 'Notities',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>,
  },
]

type DataSource = 'db' | 'csv'

export default function TradeScopeDashboard() {
  const [activeTab, setActiveTab] = useState<TradescopeTab>('dashboard')
  const [dataSource, setDataSource] = useState<DataSource>('db')
  const [filters, setFilters] = useState<TradeFilters>({})

  // DB data
  const { accounts, loading: accountsLoading } = useAccounts()
  const { strategies } = useStrategies()
  const { setups } = useSetups()
  const { trades: dbTrades, loading: tradesLoading, refetch: refetchTrades } = useTrades(filters)

  // CSV data (legacy mode)
  const [csvTrades, setCsvTrades] = useState<ParsedTrade[]>([])
  const [csvMetrics, setCsvMetrics] = useState<TradeMetrics | null>(null)
  const [startingBalance, setStartingBalance] = useState(10000)
  const [balanceInput, setBalanceInput] = useState('10000')
  const [backtestBalance, setBacktestBalance] = useState<number | null>(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const rawTradesRef = useRef<ParsedTrade[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Convert DB trades to analytics format
  const analyticsTrades = useMemo(() => {
    if (dataSource === 'csv') return csvTrades
    return dbTrades
      .filter(t => t.status === 'closed' && t.profit_loss !== null)
      .map((t, i) => dbTradeToAnalytics(t, i))
  }, [dataSource, dbTrades, csvTrades])

  // Calculate balance from selected account or default
  const activeBalance = useMemo(() => {
    if (dataSource === 'csv') return startingBalance
    if (filters.accountId) {
      const acc = accounts.find(a => a.id === filters.accountId)
      return acc?.starting_balance || 10000
    }
    return accounts[0]?.starting_balance || 10000
  }, [dataSource, startingBalance, filters.accountId, accounts])

  // Calculate metrics from active trades
  const metrics = useMemo(() => {
    if (dataSource === 'csv') return csvMetrics
    if (analyticsTrades.length === 0) return null
    return calculateMetrics(analyticsTrades, activeBalance)
  }, [dataSource, csvMetrics, analyticsTrades, activeBalance])

  const monteCarloData = useMemo(() => {
    if (analyticsTrades.length === 0) return null
    return runMonteCarlo(analyticsTrades, 1000, activeBalance)
  }, [analyticsTrades, activeBalance])

  const optimizationData = useMemo(() => {
    if (analyticsTrades.length === 0) return null
    return optimizeRiskReward(analyticsTrades, activeBalance)
  }, [analyticsTrades, activeBalance])

  // CSV upload handler
  const handleCsvUpload = useCallback((files: FileList) => {
    setCsvLoading(true)
    const fileArray = Array.from(files)
    let processed = 0
    let allNewTrades: ParsedTrade[] = []
    let detectedBal: number | null = null

    fileArray.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const csvText = event.target?.result as string
          const result: ParseResult = parseCSV(csvText)
          allNewTrades = [...allNewTrades, ...result.trades]
          if (result.detectedBalance && !detectedBal) detectedBal = result.detectedBalance
        } catch (err) {
          console.error(`CSV parse error (${file.name}):`, err)
        }
        processed++
        if (processed === fileArray.length) {
          if (detectedBal) {
            setBacktestBalance(detectedBal)
            setStartingBalance(detectedBal)
            setBalanceInput(detectedBal.toString())
          }
          const existing = rawTradesRef.current
          const combined = [...existing, ...allNewTrades]
          const seen = new Set<string>()
          const unique = combined.filter((t) => {
            const key = `${t.openDate.getTime()}-${t.symbol}-${t.profitLoss}-${t.action}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          unique.sort((a, b) => a.openDate.getTime() - b.openDate.getTime())
          unique.forEach((t, i) => { t.tradeNumber = i + 1 })
          rawTradesRef.current = unique.map(t => ({ ...t }))
          const bal = detectedBal || startingBalance
          setCsvTrades(unique)
          setCsvMetrics(calculateMetrics(unique, bal))
          setDataSource('csv')
          setCsvLoading(false)
        }
      }
      reader.readAsText(file)
    })
  }, [startingBalance])

  const isLoading = dataSource === 'db' ? (tradesLoading || accountsLoading) : csvLoading
  const hasData = analyticsTrades.length > 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-semibold text-heading">TradeMind</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-text-dim">{analyticsTrades.length} trades</span>
            {filters.accountId && (
              <>
                <span className="text-xs text-text-dim">·</span>
                <span className="text-xs text-accent-light">
                  {accounts.find(a => a.id === filters.accountId)?.name || 'Account'}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Data source toggle */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setDataSource('db')}
              className={`px-3 py-1.5 text-xs transition-colors ${dataSource === 'db' ? 'bg-accent/15 text-accent-light' : 'text-text-muted hover:text-heading'}`}
            >
              Database
            </button>
            <button
              onClick={() => setDataSource('csv')}
              className={`px-3 py-1.5 text-xs transition-colors ${dataSource === 'csv' ? 'bg-accent/15 text-accent-light' : 'text-text-muted hover:text-heading'}`}
            >
              CSV
            </button>
          </div>

          {/* Account filter (DB mode) */}
          {dataSource === 'db' && accounts.length > 0 && (
            <select
              value={filters.accountId || ''}
              onChange={(e) => setFilters(f => ({ ...f, accountId: e.target.value || undefined }))}
              className="px-3 py-1.5 rounded-lg text-xs text-heading border border-border focus:border-accent/50 focus:outline-none cursor-pointer"
            >
              <option value="">Alle accounts</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}

          {/* CSV upload (CSV mode) */}
          {dataSource === 'csv' && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-accent/30 text-xs text-accent-light hover:bg-accent/10 transition-colors flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload CSV
              </button>
              <input ref={fileInputRef} type="file" accept=".csv" multiple onChange={(e) => e.target.files && handleCsvUpload(e.target.files)} className="hidden" />
            </>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1 scrollbar-hide">
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
            <p className="text-sm text-text-muted">Trades laden...</p>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && (
            hasData && metrics ? (
              <DashboardTab trades={analyticsTrades} metrics={metrics} startingBalance={activeBalance} />
            ) : (
              <EmptyState onUpload={(f) => { setDataSource('csv'); handleCsvUpload(f) }} onGoToJournal={() => setActiveTab('journal')} onGoToAccounts={() => setActiveTab('accounts')} />
            )
          )}

          {activeTab === 'journal' && (
            <JournalTab
              accounts={accounts}
              strategies={strategies}
              setups={setups}
              filters={filters}
              onFiltersChange={setFilters}
              onTradeChanged={refetchTrades}
            />
          )}

          {activeTab === 'analytics' && hasData && metrics && (
            <AnalyticsTab trades={analyticsTrades} metrics={metrics} />
          )}

          {activeTab === 'strategy' && hasData && monteCarloData && (
            <StrategyTesterTab trades={analyticsTrades} monteCarloData={monteCarloData} startingBalance={activeBalance} />
          )}

          {activeTab === 'optimization' && hasData && optimizationData && metrics && (
            <OptimizationTab trades={analyticsTrades} metrics={metrics} optimizationData={optimizationData} startingBalance={activeBalance} />
          )}

          {activeTab === 'strategyAnalysis' && hasData && (
            <StrategyAnalysisTab trades={dbTrades} strategies={strategies} setups={setups} accounts={accounts} />
          )}

          {activeTab === 'psychology' && hasData && (
            <PsychologyTab trades={dbTrades} />
          )}

          {activeTab === 'insights' && hasData && (
            <InsightsTab trades={dbTrades} strategies={strategies} />
          )}

          {activeTab === 'routines' && <RoutinesTab />}

          {activeTab === 'playbook' && hasData && (
            <PlaybookTab trades={dbTrades} strategies={strategies} setups={setups} />
          )}

          {activeTab === 'notes' && <NotesTab />}

          {activeTab === 'accounts' && <AccountsTab />}

          {/* Show empty hint for analytics tabs without data */}
          {['analytics', 'strategy', 'optimization', 'strategyAnalysis', 'psychology', 'insights', 'playbook'].includes(activeTab) && !hasData && (
            <div className="text-center py-24">
              <p className="text-text-muted mb-2">Geen trades gevonden</p>
              <p className="text-sm text-text-dim">Voeg trades toe via het Journal of importeer een CSV bestand.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Empty state component ─────────────────────────────────
function EmptyState({ onUpload, onGoToJournal, onGoToAccounts }: {
  onUpload: (files: FileList) => void
  onGoToJournal: () => void
  onGoToAccounts: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="max-w-3xl mx-auto py-12">
      <div className="text-center mb-12">
        <div className="w-16 h-16 rounded-2xl bg-accent-glow flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <h2 className="text-2xl font-display font-semibold text-heading mb-3">
          Welkom bij TradeMind
        </h2>
        <p className="text-text-muted max-w-lg mx-auto">
          Je complete trading journal en analytics platform. Begin met het aanmaken van een account en het toevoegen van trades.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {/* Create account */}
        <button
          onClick={onGoToAccounts}
          className="p-6 rounded-xl glass glass-hover text-left group transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-accent-glow flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
              <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-heading mb-1">Account aanmaken</h3>
          <p className="text-xs text-text-dim">Demo, live, funded of prop firm account toevoegen.</p>
        </button>

        {/* Add trade */}
        <button
          onClick={onGoToJournal}
          className="p-6 rounded-xl glass glass-hover text-left group transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-accent-glow flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-heading mb-1">Trade toevoegen</h3>
          <p className="text-xs text-text-dim">Handmatig een trade loggen met journaling.</p>
        </button>

        {/* Upload CSV */}
        <button
          onClick={() => fileRef.current?.click()}
          className="p-6 rounded-xl glass glass-hover text-left group transition-all"
        >
          <input ref={fileRef} type="file" accept=".csv" multiple onChange={(e) => e.target.files && onUpload(e.target.files)} className="hidden" />
          <div className="w-10 h-10 rounded-lg bg-accent-glow flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-heading mb-1">CSV importeren</h3>
          <p className="text-xs text-text-dim">FXReplay of MT4/MT5 exports uploaden.</p>
        </button>
      </div>
    </div>
  )
}
