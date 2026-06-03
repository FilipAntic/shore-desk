import { KdsDisplay } from '@/components/orders/kds-display'

export default function BarPage() {
  return (
    <div className="h-full min-h-screen md:min-h-0">
      <KdsDisplay filter="drink" title="Bar" icon="🍹" />
    </div>
  )
}