import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrderMenu } from '@/components/orders/order-menu'

interface Props {
  params: Promise<{ bedId: string }>
}

export default async function OrderPage({ params }: Props) {
  const { bedId } = await params
  const supabase = await createClient()

  // Look up bed by label (case-insensitive)
  const { data: bed } = await supabase
    .from('beds')
    .select('id, label, status')
    .ilike('label', bedId)
    .single()

  if (!bed) notFound()

  // Fetch menu grouped by category
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
    .in('key', ['beach_name', 'currency'])

  const beachName = config?.find(c => c.key === 'beach_name')?.value ?? 'Shore Bar'
  const currency = config?.find(c => c.key === 'currency')?.value ?? 'EUR'

  return (
    <OrderMenu
      bed={bed}
      menuItems={menuItems ?? []}
      beachName={beachName}
      currency={currency}
    />
  )
}
