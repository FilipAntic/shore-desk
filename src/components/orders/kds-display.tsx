'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderItemType } from '@/types'

interface KdsDisplayProps {
  filter: OrderItemType
  title: string
  icon: string
}

const STATUS_ACTIONS: Record<string, { next: string; label: string; color: string }> = {
  pending:   { next: 'preparing', label: 'Start preparing', color: 'bg-amber-500 hover:bg-amber-600' },
  preparing: { next: 'ready',     label: 'Mark ready',      color: 'bg-green-500 hover:bg-green-600' },
  ready:     { next: 'delivering', label: 'Out for delivery', color: 'bg-blue-500 hover:bg-blue-600' },
}

const STATUS_STYLE: Record<string, string> = {
  pending:   'border-yellow-400 bg-yellow-50',
  preparing: 'border-orange-400 bg-orange-50',
  ready:     'border-green-400 bg-green-50',
}

function elapsed(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  return `${mins}m ago`
}

function playNewOrderAlert() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const times = [0, 0.18, 0.36]
    times.forEach(t => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.4, ctx.currentTime + t)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.15)
    })
  } catch {
    // Audio not supported or blocked
  }
}

export function KdsDisplay({ filter, title, icon }: KdsDisplayProps) {
  const [orders, setOrders]           = useState<Order[]>([])
  const [loading, setLoading]         = useState(true)
  const [tick, setTick]               = useState(0)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling]   = useState(false)
  const knownIds = useRef<Set<string>>(new Set())

  // Re-render every minute to update elapsed times
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
          id, quantity, unit_price, notes,
          menu_item:menu_items(name, type)
        )
      `)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: true })

    if (!data) return

    const filtered = data
      .filter(order => order.items?.some((item: { menu_item: { type: string } }) => item.menu_item?.type === filter))
      .map(order => ({
        ...order,
        items: order.items?.filter((item: { menu_item: { type: string } }) => item.menu_item?.type === filter),
      }))

    // Sound alert for new pending orders
    const newPending = filtered.filter(o => o.status === 'pending' && !knownIds.current.has(o.id))
    if (newPending.length > 0 && knownIds.current.size > 0) {
      playNewOrderAlert()
    }
    filtered.forEach(o => knownIds.current.add(o.id))

    setOrders(filtered)
    setLoading(false)
  }, [filter])

  useEffect(() => {
    fetchOrders()
    const supabase = createClient()
    const channel = supabase
      .channel(`kds-${filter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchOrders)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders, filter])

  async function advanceStatus(orderId: string, nextStatus: string) {
    const supabase = createClient()
    await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Loading orders...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{icon}</span>
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-slate-400 text-sm">
              {orders.length} active order{orders.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <p className="text-slate-400 text-sm">
          {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Orders grid */}
      {orders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
          <span className="text-6xl">{icon}</span>
          <p className="text-xl font-medium">No active orders</p>
          <p className="text-sm">New orders will appear here automatically</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
          {orders.map(order => {
            const action = STATUS_ACTIONS[order.status]
            const isCancelling = cancellingId === order.id
            return (
              <div
                key={order.id}
                className={`rounded-xl border-2 p-4 shadow-sm flex flex-col gap-3 ${STATUS_STYLE[order.status]}`}
              >
                {/* Card header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-black text-slate-800">#{order.order_number}</span>
                    <span className="ml-2 text-sm font-semibold text-slate-600">
                      Bed {(order as Order & { bed?: { label: string } }).bed?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{elapsed(order.created_at)}</span>
                    <button
                      onClick={() => { setCancellingId(order.id); setCancelReason('') }}
                      className="text-slate-400 hover:text-red-500 text-lg leading-none font-bold transition-colors"
                      title="Cancel order"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-1.5 flex-1">
                  {order.items?.map(item => (
                    <div key={item.id} className="flex gap-2 items-start">
                      <span className="font-bold text-slate-800 text-sm min-w-[1.5rem]">
                        {item.quantity}×
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-800 leading-tight">
                          {item.menu_item?.name}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-slate-500 italic">{item.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order notes */}
                {order.notes && (
                  <p className="text-xs text-slate-600 bg-white/60 rounded px-2 py-1 italic">
                    &ldquo;{order.notes}&rdquo;
                  </p>
                )}

                {/* Cancel inline form */}
                {isCancelling ? (
                  <div className="space-y-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Reason (optional)"
                      value={cancelReason}
                      onChange={e => setCancelReason(e.target.value)}
                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCancellingId(null)}
                        className="flex-1 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium"
                      >
                        Back
                      </button>
                      <button
                        onClick={confirmCancel}
                        disabled={cancelling}
                        className="flex-1 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                      >
                        {cancelling ? 'Cancelling…' : 'Cancel order'}
                      </button>
                    </div>
                  </div>
                ) : (
                  action && (
                    <button
                      onClick={() => advanceStatus(order.id, action.next)}
                      className={`w-full py-2 rounded-lg text-white text-sm font-semibold transition-colors ${action.color}`}
                    >
                      {action.label}
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}