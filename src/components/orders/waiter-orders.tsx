'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/types'

function elapsed(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  return `${mins}m ago`
}

const STATUS_STYLE: Record<string, { bar: string; badge: string; label: string }> = {
  ready:      { bar: 'bg-green-500',  badge: 'bg-green-100 text-green-800',   label: 'Ready to deliver' },
  delivering: { bar: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-800',     label: 'Delivering' },
  preparing:  { bar: 'bg-orange-400', badge: 'bg-orange-100 text-orange-800', label: 'Preparing' },
  pending:    { bar: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
}

export function WaiterOrders({ beachId }: { beachId: string }) {
  const [orders, setOrders]             = useState<Order[]>([])
  const [loading, setLoading]           = useState(true)
  const [tick, setTick]                 = useState(0)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling]     = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  const fetchOrders = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        bed:beds(label),
        items:order_items(
          id, quantity, notes,
          menu_item:menu_items(name, type)
        )
      `)
      .eq('beach_id', beachId)
      .in('status', ['pending', 'preparing', 'ready', 'delivering'])
      .order('created_at', { ascending: true })

    if (data) setOrders(data)
    setLoading(false)
  }, [beachId])

  useEffect(() => {
    fetchOrders()
    const supabase = createClient()
    const channel = supabase
      .channel(`waiter-orders-${beachId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `beach_id=eq.${beachId}` }, fetchOrders)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders, beachId])

  async function markDelivered(orderId: string) {
    const supabase = createClient()
    await supabase.from('orders').update({ status: 'delivered' }).eq('id', orderId)
  }

  async function markDelivering(orderId: string) {
    const supabase = createClient()
    await supabase.from('orders').update({ status: 'delivering' }).eq('id', orderId)
  }

  async function confirmCancel() {
    if (!cancellingId) return
    setCancelling(true)
    const supabase = createClient()
    await supabase
      .from('orders')
      .update({ status: 'cancelled', cancel_reason: cancelReason.trim() || null })
      .eq('id', cancellingId)
    setCancelling(false)
    setCancellingId(null)
    setCancelReason('')
  }

  const readyOrders   = orders.filter(o => o.status === 'ready' || o.status === 'delivering')
  const waitingOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing')

  if (loading) return <div className="p-6 text-slate-400">Loading orders...</div>

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Cancel overlay */}
      {cancellingId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-slate-800 text-lg">Cancel order?</h3>
            <input
              autoFocus
              type="text"
              placeholder="Reason (optional)"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setCancellingId(null)}
                className="flex-1 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium"
              >
                Back
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelling}
                className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {cancelling ? 'Cancelling…' : 'Cancel order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ready to deliver */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Ready to deliver ({readyOrders.length})
        </h2>
        {readyOrders.length === 0 ? (
          <p className="text-slate-400 text-sm bg-white rounded-xl border border-slate-200 px-4 py-6 text-center">
            Nothing ready yet
          </p>
        ) : (
          <div className="space-y-3">
            {readyOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onDeliver={() => markDelivered(order.id)}
                onPickUp={() => markDelivering(order.id)}
                onCancel={() => { setCancellingId(order.id); setCancelReason('') }}
                elapsed={elapsed(order.created_at)}
              />
            ))}
          </div>
        )}
      </section>

      {/* In progress */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          In progress ({waitingOrders.length})
        </h2>
        {waitingOrders.length === 0 ? (
          <p className="text-slate-400 text-sm bg-white rounded-xl border border-slate-200 px-4 py-6 text-center">
            No orders in progress
          </p>
        ) : (
          <div className="space-y-3">
            {waitingOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onCancel={() => { setCancellingId(order.id); setCancelReason('') }}
                elapsed={elapsed(order.created_at)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function OrderCard({
  order,
  onDeliver,
  onPickUp,
  onCancel,
  elapsed,
}: {
  order: Order
  onDeliver?: () => void
  onPickUp?: () => void
  onCancel: () => void
  elapsed: string
}) {
  const style = STATUS_STYLE[order.status] ?? STATUS_STYLE.pending
  const bed   = (order as Order & { bed?: { label: string } }).bed

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`h-1 ${style.bar}`} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-slate-800">#{order.order_number}</span>
            <span className="text-base font-semibold text-slate-600">Bed {bed?.label}</span>
            {order.customer_name && (
              <span className="text-sm text-slate-400">— {order.customer_name}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>
              {style.label}
            </span>
            <span className="text-xs text-slate-400">{elapsed}</span>
            <button
              onClick={onCancel}
              className="text-slate-300 hover:text-red-500 text-xl leading-none font-bold transition-colors"
              title="Cancel order"
            >
              ×
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
          {order.items?.map(item => (
            <div key={item.id} className="flex gap-1.5 text-sm text-slate-700">
              <span className="font-semibold">{item.quantity}×</span>
              <span>{item.menu_item?.name}</span>
              {item.notes && <span className="text-slate-400 italic text-xs">({item.notes})</span>}
            </div>
          ))}
        </div>

        {order.notes && (
          <p className="text-xs text-slate-500 italic mb-3">&ldquo;{order.notes}&rdquo;</p>
        )}

        {(onPickUp || onDeliver) && (
          <div className="flex gap-2">
            {onPickUp && order.status === 'ready' && (
              <button
                onClick={onPickUp}
                className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Pick up
              </button>
            )}
            {onDeliver && (
              <button
                onClick={onDeliver}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Mark delivered
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}