import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StaffManager } from '@/components/admin/staff-manager'
import { BedLayoutManager } from '@/components/admin/bed-layout-manager'
import { PricingConfig } from '@/components/admin/pricing-config'
import { QrCodes } from '@/components/admin/qr-codes'
import { MenuManager } from '@/components/admin/menu-manager'

export default async function AdminPage() {
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

  const [{ data: staff }, { data: beds }, { data: config }, { data: menuItems }] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('beds').select('*').order('row').order('col'),
    supabase.from('config').select('*'),
    supabase.from('menu_items').select('*').order('type').order('category').order('sort_order'),
  ])

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold text-slate-900">Admin</h1>
        <p className="text-sm text-slate-500">Manage staff, beds, and settings</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="staff">
          <TabsList className="mb-6">
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="beds">Bed Layout</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="qr">QR Codes</TabsTrigger>
          </TabsList>

          <TabsContent value="staff">
            <StaffManager staff={staff ?? []} currentRole={profile.role} />
          </TabsContent>

          <TabsContent value="menu">
            <MenuManager menuItems={menuItems ?? []} />
          </TabsContent>

          <TabsContent value="beds">
            <BedLayoutManager beds={beds ?? []} />
          </TabsContent>

          <TabsContent value="pricing">
            <PricingConfig config={config ?? []} />
          </TabsContent>

          <TabsContent value="qr">
            <QrCodes beds={beds ?? []} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
