'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shell } from './Shell'
import { Vandaag } from './briefing/Vandaag'
import { Calls } from './briefing/Calls'
import { useBriefingData, useTrackRecord } from './lib/hooks'

export default function BriefingDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<'vandaag' | 'calls'>('vandaag')
  const { data, loading, error } = useBriefingData()
  const trackrecord = useTrackRecord()

  const goExecution = (_pair?: string) => {
    router.push('/tools/execution')
  }

  return (
    <Shell
      tool="briefing"
      activeTab={tab}
      onTabChange={(t) => setTab(t as 'vandaag' | 'calls')}
      date={data?.date}
      hideMethodology={tab === 'vandaag'}
    >
      {error && !data && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--loss)', fontSize: 13 }}>
          Fout bij laden van briefing: {error}
        </div>
      )}
      {loading && !data && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
          Briefing wordt geladen…
        </div>
      )}
      {data && tab === 'vandaag' && <Vandaag data={data} onGoExecution={goExecution} />}
      {data && tab === 'calls' && (
        <Calls records={trackrecord.records} loading={trackrecord.loading} />
      )}
    </Shell>
  )
}
