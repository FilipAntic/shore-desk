import { getSessionProfile, resolveBeach, requireBeachMembership, requireRole } from '@/lib/beach'
import { WaiterOrders } from '@/components/orders/waiter-orders'

export default async function WaiterPage({ params }: { params: Promise<{ beachSlug: string }> }) {
  const { beachSlug } = await params
  const profile = await getSessionProfile()
  const beach = await resolveBeach(beachSlug)
  requireBeachMembership(profile, beach, 'waiter')
  requireRole(profile, ['owner', 'manager', 'waiter'], beachSlug)

  return (
    <div className="flex flex-col h-full min-h-screen md:min-h-0">
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold text-slate-900">Orders</h1>
        <p className="text-sm text-slate-500">Ready orders appear at the top</p>
      </div>
      <div className="flex-1 overflow-auto">
        <WaiterOrders beachId={beach.id} />
      </div>
    </div>
  )
}
