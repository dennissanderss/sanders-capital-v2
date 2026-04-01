'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { parseCSV, type ParsedTrade, type ParseResult } from './utils/csvParser'
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

interface UploadedFile {
  name: string
  tradeCount: number
}

export default function TradeScopeDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [trades, setTrades] = useState<ParsedTrade[]>([])
  const [metrics, setMetrics] = useState<TradeMetrics | null>(null)
  const [startingBalance, setStartingBalance] = useState(10000)
  const [balanceInput, setBalanceInput] = useState('10000')
  const [backtestBalance, setBacktestBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addFileInputRef = useRef<HTMLInputElement>(null)
  // Store original unscaled trades — always scale from these to avoid compound scaling
  const rawTradesRef = useRef<ParsedTrade[]>([])

  // Scale P&L from backtest balance to user's starting balance
  const scaleTrades = useCallback((originalTrades: ParsedTrade[], origBalance: number | null, targetBalance: number): ParsedTrade[] => {
    if (!origBalance || origBalance === targetBalance || origBalance === 0) return originalTrades
    const scale = targetBalance / origBalance
    return originalTrades.map(t => ({
      ...t,
      profitLoss: +(t.profitLoss * scale).toFixed(2),
      // Keep pips and riskReward unchanged — those are price-based, not balance-based
    }))
  }, [])

  const processFiles = useCallback(
    (files: FileList, append: boolean) => {
      setIsLoading(true)
      const fileArray = Array.from(files)
      let processed = 0
      let allNewTrades: ParsedTrade[] = []
      let detectedBal: number | null = null
      const newFileNames: UploadedFile[] = []

      fileArray.forEach((file) => {
        const reader = new FileReader()
        reader.onload = (event) => {
          try {
            const csvText = event.target?.result as string
            const result: ParseResult = parseCSV(csvText)
            allNewTrades = [...allNewTrades, ...result.trades]
            newFileNames.push({ name: file.name, tradeCount: result.trades.length })
            // Use detected balance from first file that has it
            if (result.detectedBalance && !detectedBal) {
              detectedBal = result.detectedBalance
            }
          } catch (err) {
            console.error(`CSV parse error (${file.name}):`, err)
          }

          processed++
          if (processed === fileArray.length) {
            // Store detected backtest balance
            if (detectedBal && !append) {
              setBacktestBalance(detectedBal)
              // Auto-set starting balance to detected value if it's the first upload
              setStartingBalance(detectedBal)
              setBalanceInput(detectedBal.toString())
            }

            // Merge & deduplicate (always merge with raw/unscaled trades)
            const existingRaw = append ? rawTradesRef.current : []
            const combined = [...existingRaw, ...allNewTrades]

            const seen = new Set<string>()
            const unique = combined.filter((t) => {
              const key = `${t.openDate.getTime()}-${t.symbol}-${t.profitLoss}-${t.action}`
              if (seen.has(key)) return false
              seen.add(key)
              return true
            })

            unique.sort((a, b) => a.openDate.getTime() - b.openDate.getTime())
            unique.forEach((t, i) => { t.tradeNumber = i + 1 })

            // Store unscaled trades as the source of truth
            rawTradesRef.current = unique.map(t => ({ ...t }))

            // Use the detected balance (or fallback) for initial metrics calc
            const bal = detectedBal || startingBalance
            setTrades(unique)
            setMetrics(calculateMetrics(unique, bal))
            setUploadedFiles((prev) => append ? [...prev, ...newFileNames] : newFileNames)
            setIsLoading(false)
          }
        }
        reader.readAsText(file)
      })
    },
    [startingBalance, backtestBalance]
  )

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return
      processFiles(files, false)
    },
    [processFiles]
  )

  const handleAddFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return
      processFiles(files, true)
      // Reset so same file can be re-selected
      if (addFileInputRef.current) addFileInputRef.current.value = ''
    },
    [processFiles]
  )

  // Apply balance change: always scale from raw (unscaled) trades to avoid compound scaling
  const applyBalance = useCallback(
    (newBalance: number) => {
      setStartingBalance(newBalance)
      if (rawTradesRef.current.length > 0 && backtestBalance && backtestBalance !== newBalance) {
        // Always scale from the ORIGINAL raw trades, never from already-scaled trades
        const scaled = scaleTrades(rawTradesRef.current, backtestBalance, newBalance)
        setTrades(scaled)
        setMetrics(calculateMetrics(scaled, newBalance))
      } else if (rawTradesRef.current.length > 0) {
        // No scaling needed — use raw trades directly
        const raw = rawTradesRef.current.map(t => ({ ...t }))
        setTrades(raw)
        setMetrics(calculateMetrics(raw, newBalance))
      }
    },
    [backtestBalance, scaleTrades]
  )

  // Commit balance input on blur or Enter — prevents glitching while typing
  const commitBalanceInput = useCallback(() => {
    const parsed = parseInt(balanceInput)
    if (!parsed || parsed < 100 || isNaN(parsed)) {
      // Invalid input: reset to current balance
      setBalanceInput(startingBalance.toString())
      return
    }
    if (parsed !== startingBalance) {
      applyBalance(parsed)
    }
  }, [balanceInput, startingBalance, applyBalance])

  const removeFile = useCallback(
    (fileIndex: number) => {
      // Can't easily remove specific file trades, so just show which files are loaded
      // User can reset all and re-upload
      setUploadedFiles((prev) => prev.filter((_, i) => i !== fileIndex))
    },
    []
  )

  const monteCarloData = useMemo(() => {
    if (trades.length === 0) return null
    return runMonteCarlo(trades, 1000, startingBalance)
  }, [trades, startingBalance])

  const optimizationData = useMemo(() => {
    if (trades.length === 0) return null
    return optimizeRiskReward(trades, startingBalance)
  }, [trades, startingBalance])

  // Drag and drop handler
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const files = e.dataTransfer.files
      if (files.length > 0) {
        processFiles(files, trades.length > 0)
      }
    },
    [processFiles, trades]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

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
            Upload je FXReplay CSV exports en krijg direct inzicht in je performance, equity curve,
            Monte Carlo simulaties en optimalisatie suggesties.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="p-8 rounded-xl glass glass-hover border-2 border-dashed border-border hover:border-accent/50 cursor-pointer transition-all text-center group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            {isLoading ? (
              <>
                <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-heading font-medium mb-1">Bestanden verwerken...</p>
              </>
            ) : (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim mx-auto mb-4 group-hover:text-accent-light transition-colors">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="text-heading font-medium mb-1">Upload CSV bestanden</p>
                <p className="text-sm text-text-dim">
                  Sleep je FXReplay exports hierheen of klik om te selecteren
                </p>
                <p className="text-xs text-text-dim mt-2">
                  Je kunt meerdere bestanden tegelijk selecteren
                </p>
              </>
            )}
          </div>

          <div className="mt-6">
            <label className="block text-xs text-text-dim mb-2">Startbalans</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={balanceInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '')
                  setBalanceInput(val)
                  const parsed = parseInt(val)
                  if (parsed && parsed >= 100) setStartingBalance(parsed)
                }}
                className="flex-1 px-3 py-2 rounded-lg glass text-sm text-heading bg-transparent border border-border focus:border-accent/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="mt-8 p-4 rounded-lg glass">
            <h3 className="text-xs font-semibold text-heading mb-2">Ondersteunde formaten</h3>
            <ul className="text-xs text-text-dim space-y-1">
              <li className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light"><polyline points="20 6 9 17 4 12" /></svg>
                FXReplay CSV export (analytics)
              </li>
              <li className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light"><polyline points="20 6 9 17 4 12" /></svg>
                Meerdere bestanden tegelijk of achter elkaar uploaden
              </li>
              <li className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light"><polyline points="20 6 9 17 4 12" /></svg>
                Duplicaten worden automatisch gefilterd
              </li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6 py-8"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Header with file info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-semibold text-heading">TradeScope</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-text-dim">
              {uploadedFiles.length} {uploadedFiles.length === 1 ? 'bestand' : 'bestanden'}
            </span>
            <span className="text-xs text-text-dim">·</span>
            <span className="text-xs text-text-dim">{trades.length} trades</span>
            <span className="text-xs text-text-dim">·</span>
            <span className="text-xs text-text-dim">
              Startbalans: ${startingBalance.toLocaleString()}
            </span>
          </div>
          {/* File chips */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {uploadedFiles.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-xs text-accent-light"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {f.name.length > 25 ? f.name.slice(0, 23) + '…' : f.name}
                  <span className="text-text-dim">({f.tradeCount})</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-dim">Balans:</label>
            <input
              type="text"
              inputMode="numeric"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={commitBalanceInput}
              onKeyDown={(e) => { if (e.key === 'Enter') commitBalanceInput() }}
              className="w-28 px-2 py-1.5 rounded-lg text-xs text-heading bg-transparent border border-border focus:border-accent/50 focus:outline-none transition-colors"
            />
            {backtestBalance && backtestBalance !== startingBalance && (
              <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded" title={`CSV was gebacktest op $${backtestBalance.toLocaleString()}. P&L wordt geschaald naar jouw balans.`}>
                geschaald
              </span>
            )}
            {backtestBalance && backtestBalance === startingBalance && (
              <span className="text-[10px] text-green-400/70 bg-green-500/10 px-1.5 py-0.5 rounded" title={`Backtest balance automatisch gedetecteerd uit CSV.`}>
                auto
              </span>
            )}
          </div>
          <button
            onClick={() => addFileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg border border-accent/30 text-xs text-accent-light hover:bg-accent/10 transition-colors flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            CSV toevoegen
          </button>
          <input
            ref={addFileInputRef}
            type="file"
            accept=".csv"
            multiple
            onChange={handleAddFiles}
            className="hidden"
          />
          <button
            onClick={() => {
              setTrades([])
              setMetrics(null)
              setUploadedFiles([])
              setBacktestBalance(null)
              setStartingBalance(10000)
              setBalanceInput('10000')
              rawTradesRef.current = []
              if (fileInputRef.current) fileInputRef.current.value = ''
              if (addFileInputRef.current) addFileInputRef.current.value = ''
            }}
            className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-heading hover:border-border-light transition-colors"
          >
            Reset
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            multiple
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
