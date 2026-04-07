// ─── Admin: List all users with trade counts ─────────────
// GET /api/admin/users — returns all users with profile data
// GET /api/admin/users?userId=xxx — returns trades for a specific user
// Requires admin role (checked via session cookie)
// Uses service role to bypass RLS
// ──────────────────────────────────────────────────────────

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getSessionAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function GET(request: Request) {
  const admin = await getSessionAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')
  const sb = getAdminSupabase()

  // If userId provided, return that user's trades
  if (userId) {
    const { data: trades } = await sb
      .from('ts_trades')
      .select('*, account:ts_accounts(id,name,type,broker), strategy:ts_strategies(id,name,color), setup:ts_setups(id,name), screenshots:ts_trade_screenshots(id,trade_id,user_id,storage_path,label,sort_order,created_at)')
      .eq('user_id', userId)
      .order('open_date', { ascending: false })
      .limit(500)

    const { data: accounts } = await sb
      .from('ts_accounts')
      .select('*')
      .eq('user_id', userId)

    const { data: strategies } = await sb
      .from('ts_strategies')
      .select('*')
      .eq('user_id', userId)

    return NextResponse.json({ trades: trades || [], accounts: accounts || [], strategies: strategies || [] })
  }

  // List all users with trade counts
  const { data: users } = await sb.auth.admin.listUsers()
  if (!users?.users) return NextResponse.json({ users: [] })

  // Get trade counts per user
  const { data: tradeCounts } = await sb
    .from('ts_trades')
    .select('user_id')

  const countMap: Record<string, number> = {}
  for (const t of tradeCounts || []) {
    countMap[t.user_id] = (countMap[t.user_id] || 0) + 1
  }

  // Get profiles for display names
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, display_name, role')

  const profileMap: Record<string, { display_name: string; role: string }> = {}
  for (const p of profiles || []) {
    profileMap[p.id] = { display_name: p.display_name || '', role: p.role || 'user' }
  }

  const userList = users.users.map(u => ({
    id: u.id,
    email: u.email,
    displayName: profileMap[u.id]?.display_name || u.email?.split('@')[0] || 'Onbekend',
    role: profileMap[u.id]?.role || 'user',
    tradeCount: countMap[u.id] || 0,
    createdAt: u.created_at,
    lastSignIn: u.last_sign_in_at,
  }))

  // Sort: users with trades first, then by trade count desc
  userList.sort((a, b) => b.tradeCount - a.tradeCount)

  return NextResponse.json({ users: userList })
}
