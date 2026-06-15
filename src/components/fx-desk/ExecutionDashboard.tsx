'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shell } from './Shell'
import { Setups } from './execution/Setups'
import { Prestatie } from './execution/Prestatie'
import { useBriefingData, useTrackRecord } from './lib/hooks'

export default function ExecutionDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<'setups' | 'prestatie'>('setups')
  const { data, loading, error } = useBriefingData()
  const trackrecord = useTrackRecord()

  const goBriefing = (_pair?: string) => {
    router.push('/tools/fx-selector/v2')
  }

  return (
    <Shell
      tool="execution"
      activeTab={tab}
      onTabChange={(t) => setTab(t as 'setups' | 'prestatie')}
      date={data?.date}
    >
      {error && !data && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--loss)', fontSize: 13 }}>
          Fout bij laden van briefing: {error}
        </div>
      )}
      {loading && !data && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
          Engine wordt geladen…
        </div>
      )}
      {data && tab === 'setups' && (
        <Setups data={data} onGoBriefing={goBriefing} onSetTab={(t) => setTab(t as 'setups' | 'prestatie')} />
      )}
      {tab === 'prestatie' && (
        <Prestatie records={trackrecord.records} onSetTab={(t) => setTab(t as 'setups' | 'prestatie')} />
      )}
    </Shell>
  )
}
