import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Breadcrumb from '@/components/Breadcrumb'
import BegrippenContent from './BegrippenContent'

export const metadata: Metadata = {
  title: 'Economische Begrippen - Sanders Capital',
  description: 'Uitleg van alle belangrijke economische indicatoren: CPI, NFP, PMI, GDP en meer. Wat gebeurt er als actual beter of slechter is dan forecast?',
}

export default async function BegrippenPage() {
  const supabase = await createServerSupabaseClient()

  // Check if the "fundamentals" category is actually marked as premium
  const publicSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: category } = await publicSupabase
    .from('kennisbank_categories')
    .select('is_premium')
    .eq('slug', 'fundamentals')
    .single()

  // Also check the item itself
  const { data: item } = await publicSupabase
    .from('kennisbank_items')
    .select('is_premium')
    .eq('slug', 'economische-begrippen')
    .maybeSingle()

  const isPremium = (item?.is_premium ?? false) || (category?.is_premium ?? false)

  // Check user access
  const { data: { user } } = await supabase.auth.getUser()

  // If not premium, any logged-in user has access
  let hasAccess = !isPremium
  if (isPremium && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    hasAccess = profile?.role === 'premium' || profile?.role === 'admin'
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
      <Breadcrumb items={[
        { label: 'Kennisbank', href: '/kennisbank' },
        { label: 'Fundamentals', href: '/kennisbank#fundamentals' },
        { label: 'Economische Begrippen' },
      ]} />
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-display font-semibold text-heading mb-4">
          Economische Indicatoren
        </h1>
        <p className="text-text-muted max-w-lg mx-auto">
          Alle belangrijke economische begrippen uitgelegd. Wat ze betekenen, waarom ze belangrijk zijn,
          en wat er gebeurt als actual beter of slechter is dan forecast.
        </p>
      </div>

      <BegrippenContent hasAccess={hasAccess} />
    </div>
  )
}
