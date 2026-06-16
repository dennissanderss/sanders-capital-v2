// Eenmalige update van central_bank_rates op basis van de juni 2026 besluiten.
// Bron: officiële persberichten RBA / BoC / ECB / BoJ.

import { config } from 'dotenv'
config({ path: '.env.local' })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY  // bypass RLS

const updates = [
  {
    currency: 'AUD',
    rate: 4.35,
    bias: 'afwachtend',
    last_move: '15-16 juni 2026: unanieme hold op 4,35% na hikes in feb/mrt/mei',
    next_meeting: '10-11 augustus 2026',
  },
  {
    currency: 'CAD',
    rate: 2.25,
    bias: 'afwachtend',
    last_move: '10 juni 2026: hold op 2,25%, geen duidelijke richting door geopolitieke onzekerheid',
    next_meeting: '30 juli 2026',
  },
  {
    currency: 'EUR',
    rate: 2.25,
    bias: 'verkrappend',
    last_move: '11 juni 2026: hike 25 bp naar 2,25% (eerste verhoging sinds 2023, ingegeven door inflatie-opleving Iran/olie)',
    next_meeting: '23 juli 2026',
  },
  {
    currency: 'JPY',
    rate: 0.75,
    bias: 'voorzichtig verkrappend',
    last_move: '28 april 2026: hold op 0,75% in split 6-3 vote (3 dissenters wilden naar 1,0%), signaal voor juni-hike',
    next_meeting: '18 juni 2026',
  },
]

for (const u of updates) {
  const r = await fetch(`${URL}/rest/v1/central_bank_rates?currency=eq.${u.currency}`, {
    method: 'PATCH',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      rate: u.rate,
      bias: u.bias,
      last_move: u.last_move,
      next_meeting: u.next_meeting,
    }),
  })
  const body = await r.text()
  if (!r.ok) {
    console.log(`✗ ${u.currency}: HTTP ${r.status}`, body.slice(0, 200))
    continue
  }
  const data = JSON.parse(body)
  if (data.length === 0) {
    console.log(`✗ ${u.currency}: 0 rows matched`)
    continue
  }
  console.log(`✓ ${u.currency} → rate ${data[0].rate}, bias "${data[0].bias}"`)
}

console.log('\nKlaar.')
