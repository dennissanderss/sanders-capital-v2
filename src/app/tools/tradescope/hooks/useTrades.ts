'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { TsTrade, TradeFilters } from '../types'

export function useTrades(filters?: TradeFilters) {
  const [trades, setTrades] = useState<TsTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const fetch = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    let query = sb
      .from('ts_trades')
      .select('*, account:ts_accounts(id,name,type,broker), strategy:ts_strategies(id,name,color), setup:ts_setups(id,name)', { count: 'exact' })
      .order('open_date', { ascending: false })

    if (filters?.accountId) query = query.eq('account_id', filters.accountId)
    if (filters?.strategyId) query = query.eq('strategy_id', filters.strategyId)
    if (filters?.setupId) query = query.eq('setup_id', filters.setupId)
    if (filters?.symbol) query = query.eq('symbol', filters.symbol)
    if (filters?.action) query = query.eq('action', filters.action)
    if (filters?.environment) query = query.eq('environment', filters.environment)
    if (filters?.session) query = query.eq('session', filters.session)
    if (filters?.isWin !== undefined) query = query.eq('is_win', filters.isWin)
    if (filters?.dateFrom) query = query.gte('open_date', filters.dateFrom)
    if (filters?.dateTo) query = query.lte('open_date', filters.dateTo)

    const { data, count } = await query.limit(500)
    setTrades((data || []) as TsTrade[])
    setTotal(count || 0)
    setLoading(false)
  }, [filters?.accountId, filters?.strategyId, filters?.setupId, filters?.symbol, filters?.action, filters?.environment, filters?.session, filters?.isWin, filters?.dateFrom, filters?.dateTo])

  useEffect(() => { fetch() }, [fetch])

  const create = async (trade: Partial<TsTrade>) => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return null
    const { data, error } = await sb
      .from('ts_trades')
      .insert({ ...trade, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    await fetch()
    return data
  }

  const update = async (id: string, trade: Partial<TsTrade>) => {
    const sb = createClient()
    const { error } = await sb
      .from('ts_trades')
      .update({ ...trade, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    await fetch()
  }

  const remove = async (id: string) => {
    const sb = createClient()
    const { error } = await sb.from('ts_trades').delete().eq('id', id)
    if (error) throw error
    await fetch()
  }

  const bulkInsert = async (trades: Partial<TsTrade>[]) => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const rows = trades.map(t => ({ ...t, user_id: user.id }))
    // Insert in batches of 500
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500)
      const { error } = await sb.from('ts_trades').insert(batch)
      if (error) throw error
    }
    await fetch()
  }

  return { trades, total, loading, create, update, remove, bulkInsert, refetch: fetch }
}
