import { getSessionProfile, resolveBeach, requireBeachMembership, requireRole } from '@/lib/beach'
import { ReportsTabs } from '@/components/reports/reports-tabs'

export default async function ReportsPage({ params }: { params: Promise<{ beachSlug: string }> }) {
  const { beachSlug } = await params
  const profile = await getSessionProfile()
  const beach = await resolveBeach(beachSlug)
  requireBeachMembership(profile, beach, 'reports')
  requireRole(profile, ['owner', 'manager'], beachSlug)

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Shift summaries and revenue breakdowns</p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <ReportsTabs beachId={beach.id} />
      </div>
    </div>
  )
}
