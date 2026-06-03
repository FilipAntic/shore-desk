import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShiftReport } from '@/components/reports/shift-report'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['owner', 'manager'].includes(profile.role)) {
    redirect('/seller')
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Daily shift summary — rentals and orders by staff</p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <ShiftReport />
      </div>
    </div>
  )
}
