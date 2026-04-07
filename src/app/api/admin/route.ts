import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Service role client — bypasses RLS, only used server-side (lazy init for build)
function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getSessionUser() {
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

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, table, data, id } = body

  const allowedTables = ['articles', 'kennisbank_items', 'kennisbank_categories', 'profiles', 'tool_settings', 'central_bank_rates', 'admin_tasks', 'trade_focus_records']
  if (!allowedTables.includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  }

  try {
    if (action === 'insert') {
      const { data: result, error } = await getAdminSupabase().from(table).insert(data).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data: result })
    }

    if (action === 'update') {
      const { data: result, error } = await getAdminSupabase().from(table).update(data).eq('id', id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data: result })
    }

    if (action === 'delete') {
      const { error } = await getAdminSupabase().from(table).delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // Ban user: set banned_at timestamp on profile
    if (action === 'ban_user') {
      const { error: profileError } = await getAdminSupabase()
        .from('profiles')
        .update({ banned_at: new Date().toISOString() })
        .eq('id', id)
      if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // Unban user: clear banned_at
    if (action === 'unban_user') {
      const { error: profileError } = await getAdminSupabase()
        .from('profiles')
        .update({ banned_at: null })
        .eq('id', id)
      if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // Delete user: remove profile + auth user
    if (action === 'delete_user') {
      // Delete profile first
      await getAdminSupabase().from('profiles').delete().eq('id', id)
      // Delete auth user
      const { error: authError } = await getAdminSupabase().auth.admin.deleteUser(id)
      if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
