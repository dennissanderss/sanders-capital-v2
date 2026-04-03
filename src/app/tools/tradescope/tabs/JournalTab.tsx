'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { TsTrade, TsAccount, TsStrategy, TsSetup, TradeFilters } from '../types'
import TradeScreenshots from '../components/TradeScreenshots'
import QuickTradeForm from '../components/QuickTradeForm'

interface Props {
  accounts: TsAccount[]
  strategies: TsStrategy[]
  setups: TsSetup[]
  filters: TradeFilters
  onFiltersChange: (f: TradeFilters) => void
  onTradeChanged: () => void
}

const SESSIONS = ['London', 'New York', 'Asia', 'Overlap']
const ENVIRONMENTS = [
  { value: 'backtest', label: 'Backtest' },
  { value: 'sim', label: 'Simulatie' },
  { value: 'demo', label: 'Demo' },
  { value: 'live', label: 'Live' },
  { value: 'funded', label: 'Funded' },
]
const EMOTIONS = ['Kalm', 'Gefocust', 'Zelfverzekerd', 'Angstig', 'Gretig', 'Gefrustreerd', 'Verveeld', 'Gestrest', 'Euforisch', 'Neutraal']

export default function JournalTab({ accounts, strategies, setups, filters, onFiltersChange, onTradeChanged }: Props) {
  const [trades, setTrades] = useState<TsTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTrade, setEditingTrade] = useState<TsTrade | null>(null)
  const [saving, setSaving] = useState(false)

  // Fetch trades
  useEffect(() => {
    fetchTrades()
  }, [filters])

  const fetchTrades = async () => {
    setLoading(true)
    const sb = createClient()
    let query = sb
      .from('ts_trades')
      .select('*, account:ts_accounts(id,name,type), strategy:ts_strategies(id,name,color), setup:ts_setups(id,name), screenshots:ts_trade_screenshots(id,trade_id,user_id,storage_path,label,sort_order,created_at)')
      .order('open_date', { ascending: false })
      .limit(200)

    if (filters.accountId) query = query.eq('account_id', filters.accountId)
    if (filters.strategyId) query = query.eq('strategy_id', filters.strategyId)
    if (filters.symbol) query = query.eq('symbol', filters.symbol)
    if (filters.isWin !== undefined) query = query.eq('is_win', filters.isWin)
    if (filters.dateFrom) query = query.gte('open_date', filters.dateFrom)
    if (filters.dateTo) query = query.lte('open_date', filters.dateTo)

    const { data } = await query
    setTrades((data || []) as TsTrade[])
    setLoading(false)
  }

  const handleSave = async (formData: Partial<TsTrade>) => {
    setSaving(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setSaving(false); return }

    try {
      if (editingTrade) {
        await sb.from('ts_trades').update({ ...formData, updated_at: new Date().toISOString() }).eq('id', editingTrade.id)
      } else {
        await sb.from('ts_trades').insert({ ...formData, user_id: user.id })
      }
      setShowForm(false)
      setEditingTrade(null)
      await fetchTrades()
      onTradeChanged()
    } catch (err) {
      console.error('Save error:', err)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze trade wilt verwijderen?')) return
    const sb = createClient()
    await sb.from('ts_trades').delete().eq('id', id)
    await fetchTrades()
    onTradeChanged()
  }

  // Get unique symbols from trades
  const symbols = [...new Set(trades.map(t => t.symbol))].sort()

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Symbol filter */}
          <select
            value={filters.symbol || ''}
            onChange={(e) => onFiltersChange({ ...filters, symbol: e.target.value || undefined })}
            className="px-3 py-1.5 rounded-lg text-xs text-heading border border-border focus:border-accent/50 focus:outline-none cursor-pointer"
          >
            <option value="">Alle paren</option>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Win/loss filter */}
          <select
            value={filters.isWin === undefined ? '' : filters.isWin ? 'win' : 'loss'}
            onChange={(e) => onFiltersChange({ ...filters, isWin: e.target.value === '' ? undefined : e.target.value === 'win' })}
            className="px-3 py-1.5 rounded-lg text-xs text-heading border border-border focus:border-accent/50 focus:outline-none cursor-pointer"
          >
            <option value="">Win + Loss</option>
            <option value="win">Alleen wins</option>
            <option value="loss">Alleen losses</option>
          </select>

          {/* Date range */}
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value || undefined })}
            className="px-3 py-1.5 rounded-lg text-xs text-heading border border-border focus:border-accent/50 focus:outline-none"
          />
          <span className="text-text-dim text-xs">-</span>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value || undefined })}
            className="px-3 py-1.5 rounded-lg text-xs text-heading border border-border focus:border-accent/50 focus:outline-none"
          />
        </div>

        <button
          onClick={() => { setEditingTrade(null); setShowForm(true) }}
          className="px-4 py-2 rounded-lg bg-accent/20 border border-accent/30 text-sm text-accent-light hover:bg-accent/30 transition-colors flex items-center gap-2 self-start"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nieuwe trade
        </button>
      </div>

      {/* Trade list */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
        </div>
      ) : trades.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-muted mb-2">Nog geen trades</p>
          <p className="text-sm text-text-dim">Klik op &quot;Nieuwe trade&quot; om te beginnen.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trades.map((trade) => (
            <TradeRow
              key={trade.id}
              trade={trade}
              onEdit={() => { setEditingTrade(trade); setShowForm(true) }}
              onDelete={() => handleDelete(trade.id)}
              onScreenshotUpdate={fetchTrades}
            />
          ))}
        </div>
      )}

      {/* Trade form modal */}
      {showForm && (
        <TradeFormModal
          trade={editingTrade}
          accounts={accounts}
          strategies={strategies}
          setups={setups}
          saving={saving}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingTrade(null) }}
          onScreenshotUpdate={fetchTrades}
        />
      )}
    </div>
  )
}

// ─── Trade row component ───────────────────────────────────
function TradeRow({ trade, onEdit, onDelete, onScreenshotUpdate }: { trade: TsTrade; onEdit: () => void; onDelete: () => void; onScreenshotUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const pnl = trade.profit_loss || 0
  const isWin = pnl > 0

  return (
    <div className="rounded-xl glass overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Win/loss indicator */}
        <div className={`w-1 h-10 rounded-full ${isWin ? 'bg-green-500' : pnl < 0 ? 'bg-red-500' : 'bg-text-dim'}`} />

        {/* Date */}
        <div className="w-24 flex-shrink-0">
          <p className="text-xs text-heading">{new Date(trade.open_date).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })}</p>
          <p className="text-[10px] text-text-dim">{new Date(trade.open_date).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>

        {/* Symbol + direction */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-heading">{trade.symbol}</span>
            <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
              trade.action === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {trade.action === 'buy' ? 'LONG' : 'SHORT'}
            </span>
            {trade.strategy && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent-light">
                {(trade.strategy as TsStrategy).name}
              </span>
            )}
            {trade.environment !== 'live' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                {trade.environment}
              </span>
            )}
          </div>
          {trade.account && (
            <p className="text-[10px] text-text-dim">{(trade.account as TsAccount).name}</p>
          )}
        </div>

        {/* Pips */}
        <div className="w-16 text-right">
          <p className={`text-xs font-medium ${isWin ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-text-dim'}`}>
            {trade.pips ? `${trade.pips > 0 ? '+' : ''}${trade.pips.toFixed(1)} pips` : '—'}
          </p>
        </div>

        {/* P&L */}
        <div className="w-24 text-right">
          <p className={`text-sm font-semibold ${isWin ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-text-dim'}`}>
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
          </p>
          {trade.result_r && (
            <p className="text-[10px] text-text-dim">{trade.result_r > 0 ? '+' : ''}{trade.result_r.toFixed(1)}R</p>
          )}
        </div>

        {/* Quality indicators */}
        <div className="w-20 flex items-center gap-1 justify-end">
          {trade.trade_quality && (
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < trade.trade_quality! ? 'bg-accent-light' : 'bg-white/10'}`} />
              ))}
            </div>
          )}
        </div>

        {/* Expand arrow */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-text-dim transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <p className="text-[10px] text-text-dim mb-0.5">Entry</p>
              <p className="text-xs text-heading">{trade.open_price}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-dim mb-0.5">Exit</p>
              <p className="text-xs text-heading">{trade.close_price || trade.exit_price || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-dim mb-0.5">SL</p>
              <p className="text-xs text-heading">{trade.sl || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-dim mb-0.5">TP</p>
              <p className="text-xs text-heading">{trade.tp || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-dim mb-0.5">Sessie</p>
              <p className="text-xs text-heading">{trade.session || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-dim mb-0.5">Lot size</p>
              <p className="text-xs text-heading">{trade.lot_size || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-dim mb-0.5">R:R</p>
              <p className="text-xs text-heading">{trade.risk_reward ? `1:${trade.risk_reward.toFixed(1)}` : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-dim mb-0.5">Duur</p>
              <p className="text-xs text-heading">{trade.holding_time_minutes ? formatDuration(trade.holding_time_minutes) : '—'}</p>
            </div>
          </div>

          {/* Emotions & discipline */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {trade.emotion_before && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300">Voor: {trade.emotion_before}</span>}
            {trade.emotion_during && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300">Tijdens: {trade.emotion_during}</span>}
            {trade.emotion_after && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300">Na: {trade.emotion_after}</span>}
            {trade.rules_followed === true && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">Regels gevolgd</span>}
            {trade.rules_followed === false && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Regels gebroken</span>}
            {trade.was_impulsive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Impulsief</span>}
            {trade.was_revenge && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Revenge trade</span>}
          </div>

          {/* Notes */}
          {trade.notes && (
            <div className="mb-3">
              <p className="text-[10px] text-text-dim mb-1">Notities</p>
              <p className="text-xs text-text-muted leading-relaxed">{trade.notes}</p>
            </div>
          )}
          {trade.mistakes && (
            <div className="mb-3">
              <p className="text-[10px] text-text-dim mb-1">Fouten</p>
              <p className="text-xs text-red-400/80 leading-relaxed">{trade.mistakes}</p>
            </div>
          )}
          {trade.lessons && (
            <div className="mb-3">
              <p className="text-[10px] text-text-dim mb-1">Lessen</p>
              <p className="text-xs text-green-400/80 leading-relaxed">{trade.lessons}</p>
            </div>
          )}

          {/* Tags */}
          {trade.tags && trade.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {trade.tags.map((tag, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-text-dim">#{tag}</span>
              ))}
            </div>
          )}

          {/* Screenshots */}
          <div className="mb-3">
            <TradeScreenshots tradeId={trade.id} screenshots={trade.screenshots || []} onUpdate={onScreenshotUpdate} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
            <button onClick={onEdit} className="text-xs text-accent-light hover:text-heading transition-colors">Bewerken</button>
            <button onClick={onDelete} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">Verwijderen</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Trade form modal ──────────────────────────────────────
function TradeFormModal({ trade, accounts, strategies, setups, saving, onSave, onClose, onScreenshotUpdate }: {
  trade: TsTrade | null
  accounts: TsAccount[]
  strategies: TsStrategy[]
  setups: TsSetup[]
  saving: boolean
  onSave: (data: Partial<TsTrade>) => void
  onClose: () => void
  onScreenshotUpdate: () => void
}) {
  const [formMode, setFormMode] = useState<'quick' | 'full'>(trade ? 'full' : 'quick')

  const [form, setForm] = useState<Record<string, unknown>>(() => {
    if (trade) return { ...trade }
    return {
      symbol: '',
      action: 'buy',
      open_price: '',
      close_price: '',
      sl: '',
      tp: '',
      lot_size: '',
      pips: '',
      profit_loss: '',
      risk_reward: '',
      result_r: '',
      commission: '',
      swap: '',
      open_date: new Date().toISOString().slice(0, 16),
      close_date: '',
      session: '',
      environment: 'live',
      account_id: accounts[0]?.id || null,
      strategy_id: null,
      setup_id: null,
      notes: '',
      mistakes: '',
      lessons: '',
      entry_reason: '',
      exit_reason: '',
      emotion_before: '',
      emotion_during: '',
      emotion_after: '',
      confidence_score: null,
      trade_quality: null,
      execution_quality: null,
      rules_followed: null,
      was_impulsive: null,
      was_revenge: null,
      was_overtrading: null,
      htf_bias_respected: null,
      news_checked: null,
      tags: [],
      status: 'closed',
    }
  })

  // Track which fields the user has manually edited
  const [manualFields, setManualFields] = useState<Set<string>>(new Set(trade ? ['pips', 'profit_loss', 'risk_reward', 'result_r'] : []))

  const set = (key: string, value: unknown) => {
    // Mark derived fields as manual when user types in them
    if (['pips', 'profit_loss', 'risk_reward', 'result_r'].includes(key)) {
      if (value === '' || value === null) {
        // User cleared the field → allow auto-calc again
        setManualFields(prev => { const n = new Set(prev); n.delete(key); return n })
      } else {
        setManualFields(prev => new Set(prev).add(key))
      }
    }
    setForm(f => ({ ...f, [key]: value }))
  }

  // ── Auto-calculate derived fields ──
  // Stringify dependencies to prevent infinite loops with number/string mismatches
  const calcKey = `${form.open_price}|${form.close_price}|${form.sl}|${form.lot_size}|${form.action}|${form.symbol}|${form.commission}|${form.swap}`
  useEffect(() => {
    // Skip auto-calc for existing trades (all derived fields are manual)
    if (manualFields.size >= 4) return

    const entry = parseFloat(String(form.open_price ?? ''))
    const exit = parseFloat(String(form.close_price ?? ''))
    const sl = parseFloat(String(form.sl ?? ''))
    const lot = parseFloat(String(form.lot_size ?? ''))
    const commission = parseFloat(String(form.commission ?? '')) || 0
    const swap = parseFloat(String(form.swap ?? '')) || 0
    const isBuy = form.action === 'buy'
    const symbol = String(form.symbol ?? '').toUpperCase()

    // Determine pip size from symbol
    const isJPY = symbol.includes('JPY') || symbol.includes('XAU')
    const pipSize = isJPY ? 0.01 : 0.0001
    const pipValue = isJPY ? (1000 * lot) : (10 * lot)

    const updates: Record<string, string> = {}

    // Auto-calc pips from entry + exit
    if (!isNaN(entry) && !isNaN(exit) && entry > 0 && exit > 0 && !manualFields.has('pips')) {
      const rawPips = isBuy ? (exit - entry) / pipSize : (entry - exit) / pipSize
      updates.pips = (Math.round(rawPips * 10) / 10).toString()
    }

    // Auto-calc P&L from pips + lot (includes commission + swap)
    const calcPips = parseFloat(updates.pips ?? String(form.pips ?? ''))
    if (!isNaN(calcPips) && !isNaN(lot) && lot > 0 && !isNaN(pipValue) && !manualFields.has('profit_loss')) {
      const grossPnl = calcPips * pipValue
      const netPnl = Math.round((grossPnl - commission + swap) * 100) / 100
      updates.profit_loss = netPnl.toString()
    }

    // Auto-calc R:R from entry + exit + SL
    if (!isNaN(entry) && !isNaN(exit) && !isNaN(sl) && entry > 0 && sl > 0 && exit > 0 && !manualFields.has('risk_reward')) {
      const risk = Math.abs(entry - sl)
      const reward = isBuy ? (exit - entry) : (entry - exit)
      if (risk > 0) {
        updates.risk_reward = (Math.round((reward / risk) * 100) / 100).toString()
      }
    }

    // Auto-calc Result (R) from actual P&L and risk amount
    const calcPnl = parseFloat(updates.profit_loss ?? String(form.profit_loss ?? ''))
    if (!isNaN(entry) && !isNaN(sl) && !isNaN(lot) && entry > 0 && sl > 0 && lot > 0 && !isNaN(calcPnl) && !isNaN(pipValue) && !manualFields.has('result_r')) {
      const riskPips = Math.abs(entry - sl) / pipSize
      const riskAmount = riskPips * pipValue
      if (riskAmount > 0) {
        updates.result_r = (Math.round((calcPnl / riskAmount) * 100) / 100).toString()
      }
    }

    if (Object.keys(updates).length > 0) {
      setForm(f => ({ ...f, ...updates }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcKey])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data: Partial<TsTrade> = {
      symbol: form.symbol as string,
      action: form.action as 'buy' | 'sell',
      open_price: parseFloat(form.open_price as string) || 0,
      close_price: form.close_price ? parseFloat(form.close_price as string) : null,
      sl: form.sl ? parseFloat(form.sl as string) : null,
      tp: form.tp ? parseFloat(form.tp as string) : null,
      lot_size: form.lot_size ? parseFloat(form.lot_size as string) : 0,
      pips: form.pips ? parseFloat(form.pips as string) : null,
      profit_loss: form.profit_loss ? parseFloat(form.profit_loss as string) : null,
      risk_reward: form.risk_reward ? parseFloat(form.risk_reward as string) : null,
      result_r: form.result_r ? parseFloat(form.result_r as string) : null,
      commission: form.commission ? parseFloat(form.commission as string) : 0,
      swap: form.swap ? parseFloat(form.swap as string) : 0,
      open_date: form.open_date as string,
      close_date: form.close_date ? (form.close_date as string) : null,
      session: (form.session as string) || null,
      environment: (form.environment as TsTrade['environment']) || 'live',
      account_id: (form.account_id as string) || null,
      strategy_id: (form.strategy_id as string) || null,
      setup_id: (form.setup_id as string) || null,
      notes: (form.notes as string) || null,
      mistakes: (form.mistakes as string) || null,
      lessons: (form.lessons as string) || null,
      entry_reason: (form.entry_reason as string) || null,
      exit_reason: (form.exit_reason as string) || null,
      emotion_before: (form.emotion_before as string) || null,
      emotion_during: (form.emotion_during as string) || null,
      emotion_after: (form.emotion_after as string) || null,
      confidence_score: form.confidence_score as number | null,
      trade_quality: form.trade_quality as number | null,
      execution_quality: form.execution_quality as number | null,
      rules_followed: form.rules_followed as boolean | null,
      was_impulsive: form.was_impulsive as boolean,
      was_revenge: form.was_revenge as boolean,
      was_overtrading: form.was_overtrading as boolean,
      htf_bias_respected: form.htf_bias_respected as boolean | null,
      news_checked: form.news_checked as boolean | null,
      tags: form.tags as string[],
      status: (form.status as TsTrade['status']) || 'closed',
    }

    // Auto-calculate holding time
    if (data.open_date && data.close_date) {
      data.holding_time_minutes = Math.round((new Date(data.close_date).getTime() - new Date(data.open_date).getTime()) / 60000)
    }

    // Auto-detect session from open time
    if (!data.session && data.open_date) {
      const hour = new Date(data.open_date).getUTCHours()
      if (hour >= 13 && hour < 17) data.session = 'Overlap'
      else if (hour >= 8 && hour < 17) data.session = 'London'
      else if (hour >= 13 && hour < 22) data.session = 'New York'
      else data.session = 'Asia'
    }

    // Auto-detect day of week
    if (data.open_date) {
      data.day_of_week = new Date(data.open_date).toLocaleDateString('nl-NL', { weekday: 'long' })
    }

    onSave(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/[0.08] shadow-2xl" style={{ background: 'rgba(13, 16, 22, 0.98)', backdropFilter: 'blur(32px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-display font-semibold text-heading">
              {trade ? 'Trade bewerken' : 'Nieuwe trade'}
            </h2>
            {/* Mode toggle - only for new trades */}
            {!trade && (
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button
                  type="button"
                  onClick={() => setFormMode('quick')}
                  className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                    formMode === 'quick'
                      ? 'bg-accent/20 text-accent-light'
                      : 'text-text-dim hover:text-heading'
                  }`}
                >
                  Quick Trade
                </button>
                <button
                  type="button"
                  onClick={() => setFormMode('full')}
                  className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                    formMode === 'full'
                      ? 'bg-accent/20 text-accent-light'
                      : 'text-text-dim hover:text-heading'
                  }`}
                >
                  Volledig formulier
                </button>
              </div>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Quick Trade form */}
        {formMode === 'quick' && !trade ? (
          <QuickTradeForm
            accounts={accounts}
            defaultAccountId={(form.account_id as string) || null}
            saving={saving}
            onSave={onSave}
            onClose={onClose}
          />
        ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Trade data section */}
          <div>
            <h3 className="text-xs font-semibold text-heading uppercase tracking-wider mb-3">Trade Data</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <FormField label="Paar / Instrument *">
                <input value={form.symbol as string} onChange={(e) => set('symbol', e.target.value.toUpperCase())} required className="form-input" placeholder="EUR/USD" />
              </FormField>
              <FormField label="Richting *">
                <div className="flex rounded-lg overflow-hidden border border-border">
                  <button type="button" onClick={() => set('action', 'buy')} className={`flex-1 py-2 text-xs font-medium transition-colors ${form.action === 'buy' ? 'bg-green-500/20 text-green-400' : 'text-text-muted hover:text-heading'}`}>LONG</button>
                  <button type="button" onClick={() => set('action', 'sell')} className={`flex-1 py-2 text-xs font-medium transition-colors ${form.action === 'sell' ? 'bg-red-500/20 text-red-400' : 'text-text-muted hover:text-heading'}`}>SHORT</button>
                </div>
              </FormField>
              <FormField label="Account">
                <select value={(form.account_id as string) || ''} onChange={(e) => set('account_id', e.target.value || null)} className="form-input">
                  <option value="">Geen</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </FormField>
              <FormField label="Entry prijs *">
                <input type="number" step="any" value={form.open_price as string} onChange={(e) => set('open_price', e.target.value)} required className="form-input" />
              </FormField>
              <FormField label="SL">
                <input type="number" step="any" value={form.sl as string} onChange={(e) => set('sl', e.target.value)} className="form-input" />
              </FormField>
              <FormField label="TP">
                <input type="number" step="any" value={form.tp as string} onChange={(e) => set('tp', e.target.value)} className="form-input" />
              </FormField>
              <FormField label="Exit prijs">
                <input type="number" step="any" value={form.close_price as string} onChange={(e) => set('close_price', e.target.value)} className="form-input" />
              </FormField>
              <FormField label="Lot size">
                <input type="number" step="any" value={form.lot_size as string} onChange={(e) => set('lot_size', e.target.value)} className="form-input" />
              </FormField>
              <FormField label="Commission ($)">
                <input type="number" step="any" value={form.commission as string} onChange={(e) => set('commission', e.target.value)} className="form-input" placeholder="0.00" />
              </FormField>
              <FormField label="Swap ($)">
                <input type="number" step="any" value={form.swap as string} onChange={(e) => set('swap', e.target.value)} className="form-input" placeholder="0.00" />
              </FormField>
              <FormField label="Pips ✦">
                <input type="number" step="any" value={form.pips as string} onChange={(e) => set('pips', e.target.value)} className="form-input" placeholder="auto" />
              </FormField>
              <FormField label="P&L ($) ✦">
                <input type="number" step="any" value={form.profit_loss as string} onChange={(e) => set('profit_loss', e.target.value)} className="form-input" placeholder="auto" />
              </FormField>
              <FormField label="R:R ✦">
                <input type="number" step="any" value={form.risk_reward as string} onChange={(e) => set('risk_reward', e.target.value)} className="form-input" placeholder="auto" />
              </FormField>
              <FormField label="Resultaat (R) ✦">
                <input type="number" step="any" value={form.result_r as string} onChange={(e) => set('result_r', e.target.value)} className="form-input" placeholder="auto" />
              </FormField>
            </div>
          </div>

          {/* Date & context */}
          <div>
            <h3 className="text-xs font-semibold text-heading uppercase tracking-wider mb-3">Datum & Context</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <FormField label="Open datum *">
                <input type="datetime-local" value={form.open_date as string} onChange={(e) => set('open_date', e.target.value)} required className="form-input" />
              </FormField>
              <FormField label="Close datum">
                <input type="datetime-local" value={form.close_date as string} onChange={(e) => set('close_date', e.target.value)} className="form-input" />
              </FormField>
              <FormField label="Sessie">
                <select value={(form.session as string) || ''} onChange={(e) => set('session', e.target.value)} className="form-input">
                  <option value="">Auto-detect</option>
                  {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="Omgeving">
                <select value={form.environment as string} onChange={(e) => set('environment', e.target.value)} className="form-input">
                  {ENVIRONMENTS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </FormField>
              <FormField label="Strategie">
                <select value={(form.strategy_id as string) || ''} onChange={(e) => set('strategy_id', e.target.value || null)} className="form-input">
                  <option value="">Geen</option>
                  {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </FormField>
              <FormField label="Setup">
                <select value={(form.setup_id as string) || ''} onChange={(e) => set('setup_id', e.target.value || null)} className="form-input">
                  <option value="">Geen</option>
                  {setups.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </FormField>
            </div>
          </div>

          {/* Scoring */}
          <div>
            <h3 className="text-xs font-semibold text-heading uppercase tracking-wider mb-3">Beoordeling</h3>
            <div className="grid grid-cols-3 gap-3">
              <ScoreField label="Confidence" value={form.confidence_score as number | null} onChange={(v) => set('confidence_score', v)} />
              <ScoreField label="Trade kwaliteit" value={form.trade_quality as number | null} onChange={(v) => set('trade_quality', v)} />
              <ScoreField label="Executie" value={form.execution_quality as number | null} onChange={(v) => set('execution_quality', v)} />
            </div>
          </div>

          {/* Emotions */}
          <div>
            <h3 className="text-xs font-semibold text-heading uppercase tracking-wider mb-3">Emoties</h3>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Voor de trade">
                <select value={(form.emotion_before as string) || ''} onChange={(e) => set('emotion_before', e.target.value)} className="form-input">
                  <option value="">—</option>
                  {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </FormField>
              <FormField label="Tijdens de trade">
                <select value={(form.emotion_during as string) || ''} onChange={(e) => set('emotion_during', e.target.value)} className="form-input">
                  <option value="">—</option>
                  {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </FormField>
              <FormField label="Na de trade">
                <select value={(form.emotion_after as string) || ''} onChange={(e) => set('emotion_after', e.target.value)} className="form-input">
                  <option value="">—</option>
                  {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </FormField>
            </div>
          </div>

          {/* Discipline */}
          <div>
            <h3 className="text-xs font-semibold text-heading uppercase tracking-wider mb-3">Discipline</h3>
            <div className="flex flex-wrap gap-2">
              <ToggleChip label="Regels gevolgd" value={form.rules_followed as boolean | null} onChange={(v) => set('rules_followed', v)} colorYes="green" colorNo="red" />
              <ToggleChip label="HTF bias gevolgd" value={form.htf_bias_respected as boolean | null} onChange={(v) => set('htf_bias_respected', v)} colorYes="green" colorNo="red" />
              <ToggleChip label="Nieuws gecheckt" value={form.news_checked as boolean | null} onChange={(v) => set('news_checked', v)} colorYes="green" colorNo="amber" />
              <ToggleChip label="Impulsief" value={form.was_impulsive as boolean | null} onChange={(v) => set('was_impulsive', v)} colorYes="red" colorNo="green" invert />
              <ToggleChip label="Revenge trade" value={form.was_revenge as boolean | null} onChange={(v) => set('was_revenge', v)} colorYes="red" colorNo="green" invert />
              <ToggleChip label="Overtrading" value={form.was_overtrading as boolean | null} onChange={(v) => set('was_overtrading', v)} colorYes="red" colorNo="green" invert />
            </div>
          </div>

          {/* Journal */}
          <div>
            <h3 className="text-xs font-semibold text-heading uppercase tracking-wider mb-3">Journal</h3>
            <div className="space-y-3">
              <FormField label="Reden voor entry">
                <textarea value={(form.entry_reason as string) || ''} onChange={(e) => set('entry_reason', e.target.value)} rows={2} className="form-input resize-none" placeholder="Waarom ben je deze trade ingegaan?" />
              </FormField>
              <FormField label="Reden voor exit">
                <textarea value={(form.exit_reason as string) || ''} onChange={(e) => set('exit_reason', e.target.value)} rows={2} className="form-input resize-none" placeholder="Waarom ben je eruit gegaan?" />
              </FormField>
              <FormField label="Notities">
                <textarea value={(form.notes as string) || ''} onChange={(e) => set('notes', e.target.value)} rows={2} className="form-input resize-none" placeholder="Vrije notities over deze trade..." />
              </FormField>
              <FormField label="Fouten">
                <textarea value={(form.mistakes as string) || ''} onChange={(e) => set('mistakes', e.target.value)} rows={2} className="form-input resize-none" placeholder="Wat ging er fout?" />
              </FormField>
              <FormField label="Lessen">
                <textarea value={(form.lessons as string) || ''} onChange={(e) => set('lessons', e.target.value)} rows={2} className="form-input resize-none" placeholder="Wat heb je geleerd?" />
              </FormField>
            </div>
          </div>

          {/* Screenshots */}
          <div>
            <h3 className="text-xs font-semibold text-heading uppercase tracking-wider mb-3">Screenshots</h3>
            {trade ? (
              <TradeScreenshots tradeId={trade.id} screenshots={trade.screenshots || []} onUpdate={onScreenshotUpdate} />
            ) : (
              <div className="border border-dashed border-border rounded-lg p-6 text-center">
                <p className="text-xs text-text-dim">Sla de trade eerst op om screenshots toe te voegen</p>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-muted hover:text-heading transition-colors">
              Annuleren
            </button>
            <button type="submit" disabled={saving} className="px-6 py-2 rounded-lg bg-accent/20 border border-accent/30 text-sm text-accent-light hover:bg-accent/30 transition-colors disabled:opacity-50">
              {saving ? 'Opslaan...' : trade ? 'Bijwerken' : 'Trade opslaan'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}

// ─── Helper components ─────────────────────────────────────
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] text-text-dim mb-1">{label}</label>
      {children}
    </div>
  )
}

function ScoreField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <FormField label={label}>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
              value !== null && n <= value ? 'bg-accent/20 text-accent-light border border-accent/30' : 'text-text-dim hover:text-heading border border-border hover:border-border-light'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </FormField>
  )
}

function ToggleChip({ label, value, onChange, colorYes, colorNo, invert }: {
  label: string
  value: boolean | null
  onChange: (v: boolean | null) => void
  colorYes: string
  colorNo: string
  invert?: boolean
}) {
  const colors: Record<string, string> = {
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }
  const isActive = invert ? value === true : value === true
  const activeColor = invert ? colors[colorYes] : colors[colorYes]
  const inactiveColor = value === false ? colors[colorNo] : ''

  return (
    <button
      type="button"
      onClick={() => {
        if (value === null) onChange(true)
        else if (value === true) onChange(false)
        else onChange(null)
      }}
      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
        isActive ? activeColor : value === false ? inactiveColor : 'border-border text-text-dim hover:text-heading'
      }`}
    >
      {label}
      {value !== null && (
        <span className="ml-1.5">{value ? (invert ? '!' : '✓') : (invert ? '✓' : '✗')}</span>
      )}
    </button>
  )
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}u ${m}m` : `${h}u`
}
