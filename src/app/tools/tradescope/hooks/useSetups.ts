'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { TsSetup, SetupFormData } from '../types'

export function useSetups() {
  const [setups, setSetups] = useState<TsSetup[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb
      .from('ts_setups')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setSetups((data || []) as TsSetup[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (data: SetupFormData) => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const { error } = await sb.from('ts_setups').insert({ ...data, user_id: user.id })
    if (error) throw error
    await fetch()
  }

  const remove = async (id: string) => {
    const sb = createClient()
    const { error } = await sb.from('ts_setups').update({ is_active: false }).eq('id', id)
    if (error) throw error
    await fetch()
  }

  return { setups, loading, create, remove, refetch: fetch }
}
