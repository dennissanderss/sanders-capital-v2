'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { TsNoteItem, TsNote } from '../types'

export function useNoteItems() {
  const [items, setItems] = useState<TsNoteItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb
      .from('ts_note_items')
      .select('*')
      .order('sort_order', { ascending: true })
    setItems((data || []) as TsNoteItem[])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = async (text: string, sortOrder: number) => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return null
    const { data, error } = await sb
      .from('ts_note_items')
      .insert({ user_id: user.id, text, sort_order: sortOrder })
      .select()
      .single()
    if (error) throw error
    await fetch()
    return data as TsNoteItem
  }

  const update = async (id: string, fields: Partial<TsNoteItem>) => {
    const sb = createClient()
    const { error } = await sb
      .from('ts_note_items')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    await fetch()
  }

  const remove = async (id: string) => {
    const sb = createClient()
    const { error } = await sb.from('ts_note_items').delete().eq('id', id)
    if (error) throw error
    await fetch()
  }

  const reorder = async (reordered: { id: string; sort_order: number }[]) => {
    const sb = createClient()
    // Update each item's sort_order
    for (const item of reordered) {
      await sb
        .from('ts_note_items')
        .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
        .eq('id', item.id)
    }
    await fetch()
  }

  return { items, loading, create, update, remove, reorder, refetch: fetch }
}

export function useNotepad() {
  const [note, setNote] = useState<TsNote | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb
      .from('ts_notes')
      .select('*')
      .limit(1)
      .single()
    setNote(data as TsNote | null)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const save = async (content: string) => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return

    if (note) {
      await sb
        .from('ts_notes')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', note.id)
    } else {
      await sb
        .from('ts_notes')
        .insert({ user_id: user.id, content })
    }
    await fetch()
  }

  return { note, loading, save }
}
