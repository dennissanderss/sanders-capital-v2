'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { TsTrade, TsAccount } from '../types'
import TradeFilterChips from './TradeFilterChips'
import type { useCustomFilters } from '../hooks/useCustomFilters'

const FX_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD', 'USD/CAD', 'USD/CHF',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'EUR/AUD', 'EUR/CAD', 'EUR/NZD',
  'GBP/AUD', 'GBP/CAD', 'GBP/NZD', 'AUD/CAD', 'AUD/NZD', 'CAD/JPY',
  'CHF/JPY', 'NZD/JPY', 'XAU/USD', 'XAG/USD',
]

type CustomFiltersHook = ReturnType<typeof useCustomFilters>

interface Props {
  accounts: TsAccount[]
  defaultAccountId: string | null
  saving: boolean
  onSave: (data: Partial<TsTrade>, pendingImages?: File[], filterIds?: string[]) => void
  onClose: () => void
  customFilters?: CustomFiltersHook
}

export default function QuickTradeForm({ accounts, defaultAccountId, saving, onSave, onClose, customFilters }: Props) {
  const [pair, setPair] = useState('')
  const [customPair, setCustomPair] = useState('')
  const [direction, setDirection] = useState<'buy' | 'sell' | null>(null)
  const [entry, setEntry] = useState('')
  const [sl, setSl] = useState('')
  const [tp, setTp] = useState('')
  const [risk, setRisk] = useState('')
  const [fee, setFee] = useState('')
  const [accountId, setAccountId] = useState(defaultAccountId || accounts[0]?.id || '')
  const [notes, setNotes] = useState('')
  const [fundamentalBias, setFundamentalBias] = useState<'bullish' | 'bearish' | null>(null)
  const [technicalBias, setTechnicalBias] = useState<'bullish' | 'bearish' | null>(null)
  const [selectedFilterIds, setSelectedFilterIds] = useState<string[]>([])
  const [pendingImages, setPendingImages] = useState<{ file: File; preview: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activePair = pair === '__custom__' ? customPair.toUpperCase() : pair

  // Ctrl+V paste handler for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            const preview = URL.createObjectURL(file)
            setPendingImages(prev => [...prev, { file, preview }])
          }
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file)
        setPendingImages(prev => [...prev, { file, preview }])
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const removeImage = useCallback((idx: number) => {
    setPendingImages(prev => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }, [])

  // Determine pip size based on pair
  const isJPY = activePair.includes('JPY') || activePair.includes('XAU')
  const pipSize = isJPY ? 0.01 : 0.0001

  // Auto-calculated values
  const calc = useMemo(() => {
    const entryNum = parseFloat(entry)
    const slNum = parseFloat(sl)
    const tpNum = parseFloat(tp)
    const riskNum = parseFloat(risk)
    const isBuy = direction === 'buy'

    const result: {
      rr: number | null
      pipsSL: number | null
      pipsTP: number | null
      positionSize: number | null
    } = { rr: null, pipsSL: null, pipsTP: null, positionSize: null }

    if (isNaN(entryNum) || isNaN(slNum) || !direction) return result

    // Pips to SL
    const slDistance = isBuy ? entryNum - slNum : slNum - entryNum
    result.pipsSL = Math.round((slDistance / pipSize) * 10) / 10

    // Pips to TP
    if (!isNaN(tpNum) && tpNum > 0) {
      const tpDistance = isBuy ? tpNum - entryNum : entryNum - tpNum
      result.pipsTP = Math.round((tpDistance / pipSize) * 10) / 10
    }

    // R:R ratio
    if (result.pipsSL && result.pipsSL > 0 && result.pipsTP && result.pipsTP > 0) {
      result.rr = Math.round((result.pipsTP / result.pipsSL) * 100) / 100
    }

    // Position size suggestion (standard lots: 1 lot = 100,000 units)
    // Pip value per standard lot: ~$10 for most pairs, ~$1000/pip for JPY crosses at certain rates
    // Simplified: pip value per lot = 10 for non-JPY, varies for JPY
    if (!isNaN(riskNum) && riskNum > 0 && result.pipsSL && result.pipsSL > 0) {
      const pipValuePerLot = isJPY ? 1000 : 10
      const lots = riskNum / (result.pipsSL * pipValuePerLot)
      result.positionSize = Math.round(lots * 100) / 100
    }

    return result
  }, [entry, sl, tp, risk, direction, pipSize, isJPY])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activePair || !direction || !entry) return

    const now = new Date()
    const entryNum = parseFloat(entry)
    const slNum = parseFloat(sl)
    const tpNum = parseFloat(tp)
    const riskNum = parseFloat(risk)
    const feeNum = parseFloat(fee) || 0

    // Auto-detect session from current time
    const hour = now.getUTCHours()
    let session: string
    if (hour >= 13 && hour < 17) session = 'Overlap'
    else if (hour >= 8 && hour < 17) session = 'London'
    else if (hour >= 13 && hour < 22) session = 'New York'
    else session = 'Asia'

    const data: Partial<TsTrade> = {
      symbol: activePair,
      action: direction,
      open_price: entryNum,
      close_price: null,
      sl: !isNaN(slNum) ? slNum : null,
      tp: !isNaN(tpNum) ? tpNum : null,
      exit_price: null,
      lot_size: calc.positionSize || 0,
      pips: null,
      profit_loss: null,
      risk_reward: calc.rr,
      result_r: null,
      risk_amount: !isNaN(riskNum) ? riskNum : null,
      position_size: calc.positionSize,
      commission: feeNum,
      swap: 0,
      open_date: now.toISOString(),
      close_date: null,
      session,
      day_of_week: now.toLocaleDateString('nl-NL', { weekday: 'long' }),
      environment: 'live',
      account_id: accountId || null,
      strategy_id: null,
      setup_id: null,
      notes: notes.trim() || null,
      mistakes: null,
      lessons: null,
      entry_reason: null,
      exit_reason: null,
      emotion_before: null,
      emotion_during: null,
      emotion_after: null,
      confidence_score: null,
      trade_quality: null,
      execution_quality: null,
      rules_followed: null,
      was_impulsive: false,
      was_revenge: false,
      was_overtrading: false,
      fundamental_bias: fundamentalBias,
      technical_bias: technicalBias,
      tool_bias_correct: null,
      ta_correct: null,
      htf_bias_respected: null,
      news_checked: null,
      tags: [],
      status: 'open',
    }

    onSave(data, pendingImages.map(img => img.file), selectedFilterIds.length > 0 ? selectedFilterIds : undefined)
  }

  const isValid = activePair && direction && entry

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {/* Pair */}
      <div>
        <label className="block text-[10px] text-text-dim mb-1.5">Paar</label>
        <select
          value={pair}
          onChange={(e) => setPair(e.target.value)}
          className="form-input w-full"
        >
          <option value="">Selecteer paar...</option>
          {FX_PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
          <option value="__custom__">Anders (handmatig)</option>
        </select>
        {pair === '__custom__' && (
          <input
            value={customPair}
            onChange={(e) => setCustomPair(e.target.value)}
            placeholder="bijv. US30, NAS100..."
            className="form-input w-full mt-2"
            autoFocus
          />
        )}
      </div>

      {/* Direction - Big buttons */}
      <div>
        <label className="block text-[10px] text-text-dim mb-1.5">Richting</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setDirection('buy')}
            className={`py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${
              direction === 'buy'
                ? 'bg-green-500/20 text-green-400 border-2 border-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
                : 'text-text-muted border-2 border-border hover:border-green-500/20 hover:text-green-400/60'
            }`}
          >
            Long
          </button>
          <button
            type="button"
            onClick={() => setDirection('sell')}
            className={`py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${
              direction === 'sell'
                ? 'bg-red-500/20 text-red-400 border-2 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                : 'text-text-muted border-2 border-border hover:border-red-500/20 hover:text-red-400/60'
            }`}
          >
            Short
          </button>
        </div>
      </div>

      {/* Bias tracking */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-text-dim mb-1.5">Fundamental bias</label>
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button type="button" onClick={() => setFundamentalBias(fundamentalBias === 'bullish' ? null : 'bullish')} className={`flex-1 py-2 text-xs font-medium transition-colors ${fundamentalBias === 'bullish' ? 'bg-green-500/20 text-green-400' : 'text-text-muted hover:text-heading'}`}>Bullish</button>
            <button type="button" onClick={() => setFundamentalBias(fundamentalBias === 'bearish' ? null : 'bearish')} className={`flex-1 py-2 text-xs font-medium transition-colors ${fundamentalBias === 'bearish' ? 'bg-red-500/20 text-red-400' : 'text-text-muted hover:text-heading'}`}>Bearish</button>
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-text-dim mb-1.5">Technische bias</label>
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button type="button" onClick={() => setTechnicalBias(technicalBias === 'bullish' ? null : 'bullish')} className={`flex-1 py-2 text-xs font-medium transition-colors ${technicalBias === 'bullish' ? 'bg-green-500/20 text-green-400' : 'text-text-muted hover:text-heading'}`}>Bullish</button>
            <button type="button" onClick={() => setTechnicalBias(technicalBias === 'bearish' ? null : 'bearish')} className={`flex-1 py-2 text-xs font-medium transition-colors ${technicalBias === 'bearish' ? 'bg-red-500/20 text-red-400' : 'text-text-muted hover:text-heading'}`}>Bearish</button>
          </div>
        </div>
      </div>

      {/* Entry, SL, TP in a row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] text-text-dim mb-1.5">Entry prijs *</label>
          <input
            type="number"
            step="any"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            className="form-input w-full"
            placeholder="1.0850"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] text-text-dim mb-1.5">Stop Loss</label>
          <input
            type="number"
            step="any"
            value={sl}
            onChange={(e) => setSl(e.target.value)}
            className="form-input w-full"
            placeholder="1.0820"
          />
        </div>
        <div>
          <label className="block text-[10px] text-text-dim mb-1.5">Take Profit</label>
          <input
            type="number"
            step="any"
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            className="form-input w-full"
            placeholder="1.0910"
          />
        </div>
      </div>

      {/* Risk and Fee in a row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-text-dim mb-1.5">Risico ($)</label>
          <input
            type="number"
            step="any"
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            className="form-input w-full"
            placeholder="50.00"
          />
        </div>
        <div>
          <label className="block text-[10px] text-text-dim mb-1.5">Fee ($)</label>
          <input
            type="number"
            step="any"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="form-input w-full"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Account (compact) */}
      {accounts.length > 1 && (
        <div>
          <label className="block text-[10px] text-text-dim mb-1.5">Account</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="form-input w-full"
          >
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}

      {/* Custom Filters */}
      {customFilters && customFilters.categories.length > 0 && (
        <div>
          <label className="block text-[10px] text-text-dim mb-1.5">Filters</label>
          <TradeFilterChips
            filtersByCategory={customFilters.filtersByCategory}
            selectedIds={selectedFilterIds}
            onToggle={(id) => setSelectedFilterIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
            compact
          />
        </div>
      )}

      {/* Screenshots - Ctrl+V or upload */}
      <div>
        <label className="block text-[10px] text-text-dim mb-1.5">Screenshots <span className="text-text-dim/50">(Ctrl+V om te plakken)</span></label>
        <div
          className="rounded-xl border-2 border-dashed border-white/[0.08] hover:border-accent/30 transition-colors p-3 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          {pendingImages.length === 0 ? (
            <div className="text-center py-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-1 text-text-dim">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
              </svg>
              <p className="text-[10px] text-text-dim">Klik om te uploaden of plak met Ctrl+V</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pendingImages.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img src={img.preview} alt={`Screenshot ${idx + 1}`} className="h-16 w-auto rounded-lg border border-white/[0.08] object-cover" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeImage(idx) }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500/80 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >×</button>
                </div>
              ))}
              <div className="h-16 w-16 rounded-lg border border-dashed border-white/[0.1] flex items-center justify-center text-text-dim text-lg hover:border-accent/30 transition-colors">+</div>
            </div>
          )}
        </div>
      </div>

      {/* Notitie */}
      <div>
        <label className="block text-[10px] text-text-dim mb-1.5">Notitie <span className="text-text-dim/50">(optioneel)</span></label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="form-input w-full h-16 resize-none"
          placeholder="Waarom neem je deze trade? Korte notitie..."
        />
      </div>

      {/* Auto-calculated info */}
      {(calc.rr !== null || calc.pipsSL !== null || calc.pipsTP !== null || calc.positionSize !== null) && (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
          <p className="text-[10px] text-text-dim uppercase tracking-wider mb-2">Berekend</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {calc.rr !== null && (
              <div>
                <p className="text-[10px] text-text-dim">R:R</p>
                <p className={`text-sm font-semibold ${calc.rr >= 2 ? 'text-green-400' : calc.rr >= 1 ? 'text-amber-400' : 'text-red-400'}`}>
                  1:{calc.rr.toFixed(2)}
                </p>
              </div>
            )}
            {calc.pipsSL !== null && (
              <div>
                <p className="text-[10px] text-text-dim">Pips naar SL</p>
                <p className="text-sm font-medium text-red-400">{calc.pipsSL.toFixed(1)}</p>
              </div>
            )}
            {calc.pipsTP !== null && (
              <div>
                <p className="text-[10px] text-text-dim">Pips naar TP</p>
                <p className="text-sm font-medium text-green-400">{calc.pipsTP.toFixed(1)}</p>
              </div>
            )}
            {calc.positionSize !== null && (
              <div>
                <p className="text-[10px] text-text-dim">Lot size</p>
                <p className="text-sm font-medium text-heading">{calc.positionSize.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.06]">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-muted hover:text-heading transition-colors">
          Annuleren
        </button>
        <button
          type="submit"
          disabled={saving || !isValid}
          className="px-6 py-2.5 rounded-lg bg-accent/20 border border-accent/30 text-sm font-medium text-accent-light hover:bg-accent/30 transition-colors disabled:opacity-50"
        >
          {saving ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>
    </form>
  )
}
