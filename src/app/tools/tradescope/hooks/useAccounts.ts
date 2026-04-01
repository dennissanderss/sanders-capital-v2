'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { TsAccount, AccountFormData } from '../types'

export function useAccounts() {
  const [accounts, setAccounts] = useState<TsAccount[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb
      .from('ts_accounts')
      .select('*')
      .order('created_at', { ascending: false })
    setAccounts((data || []) as TsAccount[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (data: AccountFormData) => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const { error } = await sb.from('ts_accounts').insert({ ...data, user_id: user.id })
    if (error) throw error
    await fetch()
  }

  const update = async (id: string, data: Partial<AccountFormData>) => {
    const sb = createClient()
    const { error } = await sb.from('ts_accounts').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
    await fetch()
  }

  const remove = async (id: string) => {
    const sb = createClient()
    const { error } = await sb.from('ts_accounts').delete().eq('id', id)
    if (error) throw error
    await fetch()
  }

  return { accounts, loading, create, update, remove, refetch: fetch }
}
