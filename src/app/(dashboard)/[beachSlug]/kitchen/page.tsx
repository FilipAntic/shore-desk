import { getSessionProfile, resolveBeach, requireBeachMembership, requireRole } from '@/lib/beach'
import { KdsDisplay } from '@/components/orders/kds-display'

export default async function KitchenPage({ params }: { params: Promise<{ beachSlug: string }> }) {
  const { beachSlug } = await params
  const profile = await getSessionProfile()
  const beach = await resolveBeach(beachSlug)
  requireBeachMembership(profile, beach, 'kitchen')
  requireRole(profile, ['owner', 'manager', 'kitchen'], beachSlug)

  return (
    <div className="h-full min-h-screen md:min-h-0">
      <KdsDisplay filter="food" title="Kitchen" icon="🍳" beachId={beach.id} />
    </div>
  )
}
