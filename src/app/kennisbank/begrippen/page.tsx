import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Breadcrumb from '@/components/Breadcrumb'
import BegrippenContent from './BegrippenContent'

export const metadata: Metadata = {
  title: 'Economische Begrippen - Sanders Capital',
  description: 'Uitleg van alle belangrijke economische indicatoren: CPI, NFP, PMI, GDP en meer. Wat gebeurt er als actual beter of slechter is dan forecast?',
}

export default async function BegrippenPage() {
  const supabase = await createServerSupabaseClient()

  // Check user access
  const { data: { user } } = await supabase.auth.getUser()

  let hasAccess = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    hasAccess = profile?.role === 'premium' || profile?.role === 'admin'
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
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
