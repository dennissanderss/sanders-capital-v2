'use client'

import { useEffect, useState, useCallback } from 'react'
import type { ApiBriefingData, ApiTrackRecord } from './types'

// ─── useBriefingData — GET /api/briefing-v2 ───────────────────
export function useBriefingData() {
  const [data, setData] = useState<ApiBriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/briefing-v2')
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fout bij ophalen')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const id = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

// ─── useTrackRecord — GET /api/trackrecord-v2 ─────────────────
export function useTrackRecord() {
  const [records, setRecords] = useState<ApiTrackRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/trackrecord-v2')
      const json = await res.json()
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const recs: ApiTrackRecord[] = json.records || []
      if (recs.length === 0) {
        // Fallback to v1 if v2 empty
        try {
          const r2 = await fetch('/api/trackrecord')
          const j2 = await r2.json()
          setRecords(j2.records || [])
        } catch {
          setRecords([])
        }
      } else {
        setRecords(recs)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fout bij ophalen')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { records, loading, error, refetch: fetchData }
}
