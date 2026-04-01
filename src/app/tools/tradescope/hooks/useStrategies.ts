'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { TsStrategy, StrategyFormData } from '../types'

export function useStrategies() {
  const [strategies, setStrategies] = useState<TsStrategy[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb
      .from('ts_strategies')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setStrategies((data || []) as TsStrategy[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (data: StrategyFormData) => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const { error } = await sb.from('ts_strategies').insert({ ...data, user_id: user.id })
    if (error) throw error
    await fetch()
  }

  const update = async (id: string, data: Partial<StrategyFormData>) => {
    const sb = createClient()
    const { error } = await sb.from('ts_strategies').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
    await fetch()
  }

  const remove = async (id: string) => {
    const sb = createClient()
    const { error } = await sb.from('ts_strategies').update({ is_active: false }).eq('id', id)
    if (error) throw error
    await fetch()
  }

  return { strategies, loading, create, update, remove, refetch: fetch }
}
