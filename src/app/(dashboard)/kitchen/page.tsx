import { KdsDisplay } from '@/components/orders/kds-display'

export default function KitchenPage() {
  return (
    <div className="h-full min-h-screen md:min-h-0">
      <KdsDisplay filter="food" title="Kitchen" icon="🍳" />
    </div>
  )
}