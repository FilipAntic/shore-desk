import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BeachMap } from '@/components/beach-map/beach-map'
import type { UserRole } from '@/types'

export default async function SellerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex flex-col h-full min-h-screen md:min-h-0">
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold text-slate-900">Beach Map</h1>
        <p className="text-sm text-slate-500">Click a bed to rent or manage it</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <BeachMap role={profile?.role as UserRole ?? 'seller'} />
      </div>
    </div>
  )
}