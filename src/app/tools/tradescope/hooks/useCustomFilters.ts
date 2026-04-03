'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { TsCustomFilter, TsTradeFilter } from '../types'

export function useCustomFilters() {
  const [filters, setFilters] = useState<TsCustomFilter[]>([])
  const [tradeFilters, setTradeFilters] = useState<TsTradeFilter[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch all custom filter definitions for user
  const fetchFilters = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb
      .from('ts_custom_filters')
      .select('*')
      .order('category')
      .order('sort_order')
    setFilters((data || []) as TsCustomFilter[])
    setLoading(false)
  }, [])

  // Fetch all trade-filter assignments (for all trades)
  const fetchTradeFilters = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb
      .from('ts_trade_filters')
      .select('*')
    setTradeFilters((data || []) as TsTradeFilter[])
  }, [])

  useEffect(() => {
    fetchFilters()
    fetchTradeFilters()
  }, [fetchFilters, fetchTradeFilters])

  // Get unique categories
  const categories = [...new Set(filters.map(f => f.category))].sort()

  // Get filters grouped by category
  const filtersByCategory = categories.reduce<Record<string, TsCustomFilter[]>>((acc, cat) => {
    acc[cat] = filters.filter(f => f.category === cat).sort((a, b) => a.sort_order - b.sort_order)
    return acc
  }, {})

  // Get filter IDs for a specific trade
  const getTradeFilterIds = useCallback((tradeId: string): string[] => {
    return tradeFilters.filter(tf => tf.trade_id === tradeId).map(tf => tf.filter_id)
  }, [tradeFilters])

  // Get filter objects for a specific trade
  const getTradeFilters = useCallback((tradeId: string): TsCustomFilter[] => {
    const ids = getTradeFilterIds(tradeId)
    return filters.filter(f => ids.includes(f.id))
  }, [getTradeFilterIds, filters])

  // ── CRUD for filter definitions ──

  const createFilter = async (category: string, label: string, color?: string) => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const maxOrder = filters.filter(f => f.category === category).reduce((max, f) => Math.max(max, f.sort_order), -1)
    const { error } = await sb.from('ts_custom_filters').insert({
      user_id: user.id,
      category,
      label,
      color: color || null,
      sort_order: maxOrder + 1,
    })
    if (error) throw error
    await fetchFilters()
  }

  const updateFilter = async (id: string, data: Partial<Pick<TsCustomFilter, 'category' | 'label' | 'color' | 'sort_order'>>) => {
    const sb = createClient()
    const { error } = await sb.from('ts_custom_filters').update(data).eq('id', id)
    if (error) throw error
    await fetchFilters()
  }

  const deleteFilter = async (id: string) => {
    const sb = createClient()
    // This cascades to ts_trade_filters via FK
    const { error } = await sb.from('ts_custom_filters').delete().eq('id', id)
    if (error) throw error
    await fetchFilters()
    await fetchTradeFilters()
  }

  const deleteCategory = async (category: string) => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const { error } = await sb.from('ts_custom_filters').delete().eq('user_id', user.id).eq('category', category)
    if (error) throw error
    await fetchFilters()
    await fetchTradeFilters()
  }

  const renameCategory = async (oldName: string, newName: string) => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const { error } = await sb.from('ts_custom_filters').update({ category: newName }).eq('user_id', user.id).eq('category', oldName)
    if (error) throw error
    await fetchFilters()
  }

  // ── Trade-filter assignments ──

  const assignFilter = async (tradeId: string, filterId: string) => {
    const sb = createClient()
    const { error } = await sb.from('ts_trade_filters').insert({ trade_id: tradeId, filter_id: filterId })
    if (error && !error.message.includes('duplicate')) throw error
    await fetchTradeFilters()
  }

  const removeFilter = async (tradeId: string, filterId: string) => {
    const sb = createClient()
    const { error } = await sb.from('ts_trade_filters').delete().eq('trade_id', tradeId).eq('filter_id', filterId)
    if (error) throw error
    await fetchTradeFilters()
  }

  const toggleFilter = async (tradeId: string, filterId: string) => {
    const current = getTradeFilterIds(tradeId)
    if (current.includes(filterId)) {
      await removeFilter(tradeId, filterId)
    } else {
      await assignFilter(tradeId, filterId)
    }
  }

  // Set all filters for a trade at once (used in forms)
  const setTradeFilterIds = async (tradeId: string, filterIds: string[]) => {
    const sb = createClient()
    const current = getTradeFilterIds(tradeId)
    // Remove deselected
    const toRemove = current.filter(id => !filterIds.includes(id))
    for (const id of toRemove) {
      await sb.from('ts_trade_filters').delete().eq('trade_id', tradeId).eq('filter_id', id)
    }
    // Add new
    const toAdd = filterIds.filter(id => !current.includes(id))
    if (toAdd.length > 0) {
      await sb.from('ts_trade_filters').insert(toAdd.map(filter_id => ({ trade_id: tradeId, filter_id })))
    }
    await fetchTradeFilters()
  }

  return {
    filters,
    tradeFilters,
    categories,
    filtersByCategory,
    loading,
    getTradeFilterIds,
    getTradeFilters,
    createFilter,
    updateFilter,
    deleteFilter,
    deleteCategory,
    renameCategory,
    assignFilter,
    removeFilter,
    toggleFilter,
    setTradeFilterIds,
    refetch: async () => { await fetchFilters(); await fetchTradeFilters() },
  }
}
