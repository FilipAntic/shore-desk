import { createClient } from '@/lib/supabase/server'
import { getSessionProfile, resolveBeach, requireBeachMembership, requireRole } from '@/lib/beach'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StaffManager } from '@/components/admin/staff-manager'
import { BedLayoutManager } from '@/components/admin/bed-layout-manager'
import { PricingConfig } from '@/components/admin/pricing-config'
import { QrCodes } from '@/components/admin/qr-codes'
import { MenuManager } from '@/components/admin/menu-manager'
import { BeachManager } from '@/components/admin/beach-manager'

export default async function AdminPage({ params }: { params: Promise<{ beachSlug: string }> }) {
  const { beachSlug } = await params
  const profile = await getSessionProfile()
  const beach = await resolveBeach(beachSlug)
  requireBeachMembership(profile, beach, 'admin')
  requireRole(profile, ['owner', 'manager'], beachSlug)

  const supabase = await createClient()
  const [{ data: staff }, { data: beds }, { data: config }, { data: menuItems }] = await Promise.all([
    supabase.from('profiles').select('*').eq('beach_id', beach.id).order('full_name'),
    supabase.from('beds').select('*').eq('beach_id', beach.id).order('row').order('col'),
    supabase.from('config').select('*').eq('beach_id', beach.id),
    supabase.from('menu_items').select('*').order('type').order('category').order('sort_order'),
  ])

  const beaches = profile.role === 'owner'
    ? (await supabase.from('beaches').select('*').order('name')).data
    : null

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold text-slate-900">Admin</h1>
        <p className="text-sm text-slate-500">Manage staff, beds, and settings for {beach.name}</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="staff">
          <TabsList className="mb-6">
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="beds">Bed Layout</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="qr">QR Codes</TabsTrigger>
            {profile.role === 'owner' && <TabsTrigger value="beaches">Beaches</TabsTrigger>}
          </TabsList>

          <TabsContent value="staff">
            <StaffManager staff={staff ?? []} currentRole={profile.role} beachId={beach.id} />
          </TabsContent>

          <TabsContent value="menu">
            <MenuManager menuItems={menuItems ?? []} />
          </TabsContent>

          <TabsContent value="beds">
            <BedLayoutManager beds={beds ?? []} beachId={beach.id} />
          </TabsContent>

          <TabsContent value="pricing">
            <PricingConfig config={config ?? []} beachId={beach.id} />
          </TabsContent>

          <TabsContent value="qr">
            <QrCodes beds={beds ?? []} beachSlug={beach.slug} />
          </TabsContent>

          {profile.role === 'owner' && (
            <TabsContent value="beaches">
              <BeachManager beaches={beaches ?? []} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
