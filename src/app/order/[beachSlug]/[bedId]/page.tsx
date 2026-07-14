import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrderMenu } from '@/components/orders/order-menu'

interface Props {
  params: Promise<{ beachSlug: string; bedId: string }>
}

export default async function OrderPage({ params }: Props) {
  const { beachSlug, bedId } = await params
  const supabase = await createClient()

  const { data: beach } = await supabase
    .from('beaches')
    .select('id, name')
    .eq('slug', beachSlug)
    .eq('is_active', true)
    .single()

  if (!beach) notFound()

  // Look up bed by label (case-insensitive), scoped to this beach
  const { data: bed } = await supabase
    .from('beds')
    .select('id, label, status, beach_id')
    .eq('beach_id', beach.id)
    .ilike('label', bedId)
    .single()

  if (!bed) notFound()

  // Fetch menu grouped by category (menu is shared across every beach)
  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('*')
    .eq('is_available', true)
    .order('type')
    .order('sort_order')
    .order('name')

  const { data: config } = await supabase
    .from('config')
    .select('key, value')
    .eq('beach_id', beach.id)
    .in('key', ['currency'])

  const currency = config?.find(c => c.key === 'currency')?.value ?? 'EUR'

  return (
    <OrderMenu
      bed={bed}
      menuItems={menuItems ?? []}
      beachName={beach.name}
      currency={currency}
    />
  )
}
