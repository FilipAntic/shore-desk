import { getSessionProfile, resolveBeach, requireBeachMembership, requireRole } from '@/lib/beach'
import { BeachMap } from '@/components/beach-map/beach-map'

export default async function SellerPage({ params }: { params: Promise<{ beachSlug: string }> }) {
  const { beachSlug } = await params
  const profile = await getSessionProfile()
  const beach = await resolveBeach(beachSlug)
  requireBeachMembership(profile, beach, 'seller')
  requireRole(profile, ['owner', 'manager', 'seller', 'waiter'], beachSlug)

  return (
    <div className="flex flex-col h-full min-h-screen md:min-h-0">
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold text-slate-900">Beach Map</h1>
        <p className="text-sm text-slate-500">Click a bed to rent or manage it</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <BeachMap role={profile.role} beachId={beach.id} />
      </div>
    </div>
  )
}
