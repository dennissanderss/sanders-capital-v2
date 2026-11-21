// ─────────────────────────────────────────────────────────────
// Server-side toegangscontrole voor API-routes van (premium) tools.
//
// De tools-layout controleert login en premium alleen in de browser. Een
// API-route die kosten maakt (externe databronnen, AI-calls) moet dat zelf
// ook doen, anders kan iedereen hem buiten de pagina om aanroepen.
// Zelfde regels als src/app/tools/layout.tsx: de instelling in
// `tool_settings` wint, anders geldt de standaard van de tool.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const geenCache = { 'Cache-Control': 'private, no-store' }

// Geeft null als de aanvrager toegang heeft, anders een kant-en-klare foutrespons.
export async function vereisToolToegang(slug: string, standaardPremium: boolean): Promise<NextResponse | null> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Log in om deze tool te gebruiken.' }, { status: 401, headers: geenCache })
    }
    const [{ data: profiel }, { data: instelling }] = await Promise.all([
      supabase.from('profiles').select('role, banned_at').eq('id', user.id).maybeSingle(),
      supabase.from('tool_settings').select('is_premium').eq('slug', slug).maybeSingle(),
    ])
    if (profiel?.banned_at) {
      return NextResponse.json({ error: 'Geen toegang.' }, { status: 403, headers: geenCache })
    }
    const premium = instelling?.is_premium ?? standaardPremium
    const rol = profiel?.role || 'free'
    if (premium && rol !== 'premium' && rol !== 'admin') {
      return NextResponse.json({ error: 'Deze tool is beschikbaar voor premium leden.' }, { status: 403, headers: geenCache })
    }
    return null
  } catch {
    return NextResponse.json({ error: 'Toegang kon niet worden gecontroleerd. Probeer het opnieuw.' }, { status: 503, headers: geenCache })
  }
}
