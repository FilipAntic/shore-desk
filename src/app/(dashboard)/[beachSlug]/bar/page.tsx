import { getSessionProfile, resolveBeach, requireBeachMembership, requireRole } from '@/lib/beach'
import { KdsDisplay } from '@/components/orders/kds-display'

export default async function BarPage({ params }: { params: Promise<{ beachSlug: string }> }) {
  const { beachSlug } = await params
  const profile = await getSessionProfile()
  const beach = await resolveBeach(beachSlug)
  requireBeachMembership(profile, beach, 'bar')
  requireRole(profile, ['owner', 'manager', 'bar'], beachSlug)

  return (
    <div className="h-full min-h-screen md:min-h-0">
      <KdsDisplay filter="drink" title="Bar" icon="🍹" beachId={beach.id} />
    </div>
  )
}
