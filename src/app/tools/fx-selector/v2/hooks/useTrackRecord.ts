'use client'

import { useState, useEffect, useCallback } from 'react'
import type { BriefingV2Data, TrackRecord, TrackStats } from '../types'

const DEFAULT_STATS: TrackStats = {
  total: 0,
  correct: 0,
  incorrect: 0,
  pending: 0,
  winRate: 0,
  startDate: null,
}

export function useTrackRecord(data: BriefingV2Data | null, loading: boolean) {
  const [trackRecords, setTrackRecords] = useState<TrackRecord[]>([])
  const [trackStats, setTrackStats] = useState<TrackStats>(DEFAULT_STATS)
  const [showTrackRecord, setShowTrackRecord] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null)

  const fetchTrackRecord = useCallback(async () => {
    try {
      // Try v2 endpoint first
      const resV2 = await fetch('/api/trackrecord-v2')
      const jsonV2 = await resV2.json()
      const records = jsonV2.records || []
      if (records.length > 0) {
        setTrackRecords(records)
        setTrackStats(jsonV2.stats || DEFAULT_STATS)
        return
      }
      // Fallback to v1 if v2 returns empty
      const res = await fetch('/api/trackrecord')
      const json = await res.json()
      setTrackRecords(json.records || [])
      setTrackStats(json.stats || DEFAULT_STATS)
    } catch {
      /* table might not exist */
    }
  }, [])

  const handleBackfill = useCallback(async () => {
    setBackfilling(true)
    setBackfillMsg(null)
    try {
      const res = await fetch('/api/trackrecord-v2/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 45 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Backfill mislukt')
      setBackfillMsg(`Backfill voltooid: ${json.added || 0} records toegevoegd, ${json.updated || 0} bijgewerkt.`)
      await fetchTrackRecord()
    } catch (e) {
      setBackfillMsg(e instanceof Error ? e.message : 'Backfill mislukt')
    } finally {
      setBackfilling(false)
    }
  }, [fetchTrackRecord])

  // Initial fetch
  useEffect(() => {
    fetchTrackRecord()
  }, [fetchTrackRecord])

  // Auto-save track record daily
  useEffect(() => {
    if (data && !loading) {
      const lastSave = localStorage.getItem('track_last_save_v2')
      const today = new Date().toISOString().split('T')[0]
      if (lastSave !== today) {
        fetch('/api/trackrecord', { method: 'POST' }).then(() => fetchTrackRecord())
        localStorage.setItem('track_last_save_v2', today)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading])

  return {
    trackRecords,
    trackStats,
    showTrackRecord,
    setShowTrackRecord,
    fetchTrackRecord,
    handleBackfill,
    backfilling,
    backfillMsg,
  }
}
