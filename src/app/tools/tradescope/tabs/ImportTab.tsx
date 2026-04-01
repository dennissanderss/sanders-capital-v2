'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { parseCSV, type ParseResult, type ParsedTrade } from '../utils/csvParser'
import type { TsAccount, TsTrade } from '../types'

interface Props {
  accounts: TsAccount[]
  onImportComplete: () => void
}

type Step = 'upload' | 'preview' | 'importing' | 'done'

const SESSIONS = ['London', 'New York', 'Asia', 'Overlap']

function detectSession(date: Date): string {
  const hour = date.getUTCHours()
  if (hour >= 13 && hour < 17) return 'Overlap'
  if (hour >= 8 && hour < 17) return 'London'
  if (hour >= 13 && hour < 22) return 'New York'
  return 'Asia'
}

export default function ImportTab({ accounts, onImportComplete }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [parsedTrades, setParsedTrades] = useState<ParsedTrade[]>([])
  const [fileName, setFileName] = useState('')
  const [format, setFormat] = useState('fxreplay')
  const [accountId, setAccountId] = useState(accounts[0]?.id || '')
  const [environment, setEnvironment] = useState<TsTrade['environment']>('backtest')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ count: number; errors: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((files: FileList) => {
    const file = files[0]
    if (!file) return
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const result: ParseResult = parseCSV(e.target?.result as string)
        setParsedTrades(result.trades)
        setFormat(result.detectedBalance ? 'fxreplay' : 'generic')
        setStep('preview')
      } catch (err) {
        console.error('Parse error:', err)
        alert('Kan bestand niet verwerken. Controleer of het een geldig CSV bestand is.')
      }
    }
    reader.readAsText(file)
  }, [])

  const handleImport = async () => {
    setImporting(true)
    setStep('importing')

    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setImporting(false); return }

    // Create import record
    const { data: importRecord } = await sb.from('ts_imports').insert({
      user_id: user.id,
      account_id: accountId || null,
      filename: fileName,
      format,
      trade_count: parsedTrades.length,
      status: 'pending',
    }).select().single()

    let successCount = 0
    let errorCount = 0

    // Convert ParsedTrade → ts_trades rows
    const rows: Partial<TsTrade>[] = parsedTrades.map(t => ({
      user_id: user.id,
      account_id: accountId || null,
      import_id: importRecord?.id || null,
      symbol: t.symbol,
      action: t.action,
      lot_size: t.lotSize,
      open_price: t.openPrice,
      close_price: t.closePrice,
      sl: t.sl || null,
      tp: t.tp || null,
      commission: t.commission,
      swap: t.swap,
      pips: t.pips,
      profit_loss: t.profitLoss,
      risk_reward: t.riskReward,
      open_date: t.openDate.toISOString(),
      close_date: t.closeDate.toISOString(),
      holding_time_minutes: t.holdingTimeMinutes,
      session: t.session || detectSession(t.openDate),
      day_of_week: t.dayOfWeek || t.openDate.toLocaleDateString('nl-NL', { weekday: 'long' }),
      environment,
      tags: t.tags ? t.tags.split(',').map(s => s.trim()).filter(Boolean) : null,
      status: 'closed' as const,
    }))

    // Batch insert (500 per batch)
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500)
      const { error } = await sb.from('ts_trades').insert(batch)
      if (error) {
        console.error('Batch insert error:', error)
        errorCount += batch.length
      } else {
        successCount += batch.length
      }
    }

    // Update import status
    if (importRecord) {
      await sb.from('ts_imports').update({
        status: errorCount > 0 ? 'failed' : 'completed',
        trade_count: successCount,
        error_message: errorCount > 0 ? `${errorCount} trades mislukt` : null,
      }).eq('id', importRecord.id)
    }

    setImportResult({ count: successCount, errors: errorCount })
    setImporting(false)
    setStep('done')
    onImportComplete()
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Upload step */}
      {step === 'upload' && (
        <div>
          <div className="text-center mb-8">
            <h2 className="text-xl font-display font-semibold text-heading mb-2">CSV Importeren</h2>
            <p className="text-sm text-text-muted">Upload je trading data en sla het op in je journal.</p>
          </div>

          {/* Account & environment selection */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs text-text-dim mb-1.5">Doelaccount</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="form-input w-full">
                <option value="">Geen account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1.5">Omgeving</label>
              <select value={environment} onChange={(e) => setEnvironment(e.target.value as TsTrade['environment'])} className="form-input w-full">
                <option value="backtest">Backtest</option>
                <option value="sim">Simulatie</option>
                <option value="demo">Demo</option>
                <option value="live">Live</option>
                <option value="funded">Funded</option>
              </select>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files) }}
            onDragOver={(e) => e.preventDefault()}
            className="p-12 rounded-xl glass glass-hover border-2 border-dashed border-border hover:border-accent/50 cursor-pointer transition-all text-center group"
          >
            <input ref={fileRef} type="file" accept=".csv" onChange={(e) => e.target.files && handleFile(e.target.files)} className="hidden" />
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim mx-auto mb-4 group-hover:text-accent-light transition-colors">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-heading font-medium mb-1">Sleep je CSV bestand hierheen</p>
            <p className="text-sm text-text-dim">of klik om te selecteren</p>
          </div>

          <div className="mt-6 p-4 rounded-lg glass">
            <h3 className="text-xs font-semibold text-heading mb-2">Ondersteunde formaten</h3>
            <div className="grid sm:grid-cols-2 gap-2 text-xs text-text-dim">
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><polyline points="20 6 9 17 4 12" /></svg>
                FXReplay CSV export
              </div>
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><polyline points="20 6 9 17 4 12" /></svg>
                MetaTrader 4/5 export
              </div>
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><polyline points="20 6 9 17 4 12" /></svg>
                Generiek CSV formaat
              </div>
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><polyline points="20 6 9 17 4 12" /></svg>
                Automatische duplicaat-detectie
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview step */}
      {step === 'preview' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-display font-semibold text-heading mb-1">Import Preview</h2>
              <p className="text-sm text-text-muted">
                {parsedTrades.length} trades gevonden in <span className="text-accent-light">{fileName}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setStep('upload'); setParsedTrades([]) }} className="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-heading transition-colors">
                Terug
              </button>
              <button onClick={handleImport} className="px-6 py-2 rounded-lg bg-accent/20 border border-accent/30 text-sm text-accent-light hover:bg-accent/30 transition-colors">
                {parsedTrades.length} trades importeren
              </button>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-3 rounded-lg glass text-center">
              <p className="text-lg font-semibold text-heading">{parsedTrades.length}</p>
              <p className="text-[10px] text-text-dim">Trades</p>
            </div>
            <div className="p-3 rounded-lg glass text-center">
              <p className="text-lg font-semibold text-green-400">{parsedTrades.filter(t => t.isWin).length}</p>
              <p className="text-[10px] text-text-dim">Wins</p>
            </div>
            <div className="p-3 rounded-lg glass text-center">
              <p className="text-lg font-semibold text-red-400">{parsedTrades.filter(t => !t.isWin).length}</p>
              <p className="text-[10px] text-text-dim">Losses</p>
            </div>
            <div className="p-3 rounded-lg glass text-center">
              <p className={`text-lg font-semibold ${parsedTrades.reduce((s, t) => s + t.profitLoss, 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${parsedTrades.reduce((s, t) => s + t.profitLoss, 0).toFixed(2)}
              </p>
              <p className="text-[10px] text-text-dim">Totaal P&L</p>
            </div>
          </div>

          {/* Preview table */}
          <div className="rounded-xl glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-3 py-2 text-left text-text-dim font-medium">#</th>
                    <th className="px-3 py-2 text-left text-text-dim font-medium">Datum</th>
                    <th className="px-3 py-2 text-left text-text-dim font-medium">Paar</th>
                    <th className="px-3 py-2 text-left text-text-dim font-medium">Richting</th>
                    <th className="px-3 py-2 text-right text-text-dim font-medium">Pips</th>
                    <th className="px-3 py-2 text-right text-text-dim font-medium">P&L</th>
                    <th className="px-3 py-2 text-left text-text-dim font-medium">Sessie</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedTrades.slice(0, 20).map((t, i) => (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-text-dim">{i + 1}</td>
                      <td className="px-3 py-2 text-heading">{t.openDate.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                      <td className="px-3 py-2 text-heading font-medium">{t.symbol}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${t.action === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {t.action === 'buy' ? 'LONG' : 'SHORT'}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-right ${t.pips >= 0 ? 'text-green-400' : 'text-red-400'}`}>{t.pips.toFixed(1)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${t.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>${t.profitLoss.toFixed(2)}</td>
                      <td className="px-3 py-2 text-text-dim">{t.session}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedTrades.length > 20 && (
                <p className="px-3 py-2 text-xs text-text-dim text-center border-t border-white/[0.06]">
                  + {parsedTrades.length - 20} meer trades...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Importing step */}
      {step === 'importing' && (
        <div className="text-center py-24">
          <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-heading font-medium mb-1">Trades importeren...</p>
          <p className="text-sm text-text-dim">{parsedTrades.length} trades worden opgeslagen</p>
        </div>
      )}

      {/* Done step */}
      {step === 'done' && importResult && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-semibold text-heading mb-2">Import voltooid!</h2>
          <p className="text-text-muted mb-1">{importResult.count} trades succesvol geimporteerd.</p>
          {importResult.errors > 0 && (
            <p className="text-sm text-red-400">{importResult.errors} trades mislukt.</p>
          )}
          <div className="flex gap-3 justify-center mt-6">
            <button onClick={() => { setStep('upload'); setParsedTrades([]); setImportResult(null) }} className="px-4 py-2 rounded-lg border border-border text-sm text-text-muted hover:text-heading transition-colors">
              Nog een import
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
