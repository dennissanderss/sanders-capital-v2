// ─── External Cron Trigger ─────────────────────────────────
// Triggert alle cron jobs via één URL call
// Gebruik: GET /api/cron/trigger-all?key=CRON_SECRET
//
// Vercel Hobby = max 1x/dag cron. Deze route laat externe
// cron services (cron-job.org) de overige 3 sessies triggeren.
// ────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: Request) {
  // Beveilig met secret key
  const url = new URL(request.url)
  const key = url.searchParams.get('key')

  if (!CRON_SECRET || key !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sanderscapital.nl'

  const jobs = [
    '/api/cron/news',
    '/api/cron/trackrecord',
    '/api/cron/execution',
  ]

  const results = await Promise.allSettled(
    jobs.map(async (path) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CRON_SECRET}`,
        },
      })
      return { path, status: res.status, ok: res.ok }
    })
  )

  const summary = results.map((r, i) => ({
    job: jobs[i],
    ...(r.status === 'fulfilled' ? r.value : { error: String((r as PromiseRejectedResult).reason) }),
  }))

  return NextResponse.json({
    triggered: jobs.length,
    timestamp: new Date().toISOString(),
    results: summary,
  })
}
