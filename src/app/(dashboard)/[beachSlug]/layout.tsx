import { Sidebar } from '@/components/layout/sidebar'
import { PullToRefresh } from '@/components/layout/pull-to-refresh'
import { getSessionProfile, resolveBeach, requireBeachMembership, ROLE_HOME } from '@/lib/beach'
import { createClient } from '@/lib/supabase/server'

export default async function BeachDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ beachSlug: string }>
}) {
  const { beachSlug } = await params
  const profile = await getSessionProfile()
  const beach = await resolveBeach(beachSlug)

  requireBeachMembership(profile, beach, ROLE_HOME[profile.role])

  let otherBeaches: { slug: string; name: string }[] = []
  if (profile.role === 'owner') {
    const supabase = await createClient()
    const { data } = await supabase
      .from('beaches')
      .select('slug, name')
      .eq('is_active', true)
      .order('name')
    otherBeaches = data ?? []
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        role={profile.role}
        fullName={profile.full_name}
        beachSlug={beach.slug}
        beachId={beach.id}
        beaches={otherBeaches}
      />
      <PullToRefresh>
        {children}
      </PullToRefresh>
    </div>
  )
}
