import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BeachMap } from '@/components/beach-map/beach-map'
import { LiveStats } from '@/components/layout/live-stats'
import type { UserRole } from '@/types'

export default async function ManagerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const { data: config } = await supabase
    .from('config')
    .select('key, value')
    .in('key', ['price_full_day', 'currency'])

  const pricePerBed = parseFloat(config?.find(c => c.key === 'price_full_day')?.value ?? '18')
  const currency = config?.find(c => c.key === 'currency')?.value ?? 'EUR'

  return (
    <div className="flex flex-col h-full min-h-screen md:min-h-0">
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Welcome back, {profile?.full_name}</p>
      </div>

      <div className="overflow-auto flex-1">
        <div className="p-6">
          <LiveStats currency={currency} pricePerBed={pricePerBed} />
        </div>

        <div className="px-6 pb-2">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Live Beach Map</h2>
        </div>
        <div className="h-[600px] mx-6 mb-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <BeachMap role={profile?.role as UserRole ?? 'manager'} />
        </div>
      </div>
    </div>
  )
}
