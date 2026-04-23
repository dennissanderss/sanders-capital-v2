import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function requireAdmin() {
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
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

const ALLOWED_HOSTS = new Set([
  'media.discordapp.net',
  'cdn.discordapp.com',
])

function extFromContentType(ct: string | null, fallback = 'png') {
  if (!ct) return fallback
  const t = ct.split(';')[0].trim().toLowerCase()
  if (t === 'image/png') return 'png'
  if (t === 'image/jpeg' || t === 'image/jpg') return 'jpg'
  if (t === 'image/webp') return 'webp'
  if (t === 'image/gif') return 'gif'
  if (t === 'image/avif') return 'avif'
  if (t === 'image/svg+xml') return 'svg'
  return fallback
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const src = body.url
  if (!src || typeof src !== 'string') {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(src)
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 400 })
  }

  let res: Response
  try {
    res = await fetch(src, { redirect: 'follow' })
  } catch (e) {
    return NextResponse.json({ error: 'Fetch failed: ' + String(e) }, { status: 502 })
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: `Source returned ${res.status} — afbeelding is waarschijnlijk verlopen of verwijderd.` },
      { status: 410 }
    )
  }

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0) {
    return NextResponse.json({ error: 'Lege afbeelding' }, { status: 410 })
  }
  if (buf.length > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Afbeelding groter dan 10MB' }, { status: 413 })
  }

  const ext = extFromContentType(res.headers.get('content-type'))
  const fileName = `rehosted/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const admin = getAdminSupabase()
  const { error: upErr } = await admin.storage
    .from('images')
    .upload(fileName, buf, { contentType: res.headers.get('content-type') || `image/${ext}`, upsert: false })
  if (upErr) {
    return NextResponse.json({ error: 'Upload mislukt: ' + upErr.message }, { status: 500 })
  }
  const { data: pub } = admin.storage.from('images').getPublicUrl(fileName)
  return NextResponse.json({ publicUrl: pub.publicUrl })
}
