'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MenuItem, Order, OrderStatus } from '@/types'

interface CartItem {
  menuItem: MenuItem
  quantity: number
  notes: string
}

interface OrderMenuProps {
  bed: { id: string; label: string; status: string; beach_id: string }
  menuItems: MenuItem[]
  beachName: string
  currency: string
}

const CURRENCY_SYMBOL: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' }

const STATUS_LABEL: Record<OrderStatus, { label: string; icon: string; color: string }> = {
  pending:    { label: 'Received',    icon: '✅', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  preparing:  { label: 'Preparing',  icon: '👨‍🍳', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  ready:      { label: 'Ready',      icon: '🔔', color: 'text-green-600 bg-green-50 border-green-200' },
  delivering: { label: 'On the way', icon: '🏃', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  delivered:  { label: 'Delivered',  icon: '🎉', color: 'text-slate-600 bg-slate-50 border-slate-200' },
  cancelled:  { label: 'Cancelled',  icon: '❌', color: 'text-red-600 bg-red-50 border-red-200' },
}

export function OrderMenu({ bed, menuItems, beachName, currency }: OrderMenuProps) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeTab, setActiveTab] = useState<'orders' | 'food' | 'drink'>('food')
  const [customerName, setCustomerName] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingOrders, setExistingOrders] = useState<Order[]>([])

  const symbol = CURRENCY_SYMBOL[currency] ?? currency

  const fetchOrders = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(
          id, quantity, unit_price, notes,
          menu_item:menu_items(name)
        )
      `)
      .eq('bed_id', bed.id)
      .not('status', 'in', '("cancelled")')
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) {
      setExistingOrders(data)
      // Switch to orders tab if there are active orders on first load
      const hasActive = data.some(o => !['delivered', 'cancelled'].includes(o.status))
      if (hasActive && activeTab === 'food') {
        setActiveTab('orders')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bed.id])

  useEffect(() => {
    fetchOrders()

    const supabase = createClient()
    const channel = supabase
      .channel(`bed-orders-${bed.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
        filter: `bed_id=eq.${bed.id}`,
      }, fetchOrders)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders, bed.id])

  const activeOrders = existingOrders.filter(o => !['delivered', 'cancelled'].includes(o.status))
  const pastOrders   = existingOrders.filter(o =>  ['delivered', 'cancelled'].includes(o.status))

  const foodItems = menuItems.filter(i => i.type === 'food')
  const drinkItems = menuItems.filter(i => i.type === 'drink')
  const currentItems = activeTab === 'food' ? foodItems : drinkItems

  const grouped = currentItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  const cartTotal = cart.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0)
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0)

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id)
      if (existing) return prev.map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { menuItem: item, quantity: 1, notes: '' }]
    })
  }

  function removeFromCart(itemId: string) {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === itemId)
      if (!existing) return prev
      if (existing.quantity === 1) return prev.filter(c => c.menuItem.id !== itemId)
      return prev.map(c => c.menuItem.id === itemId ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  function getQuantity(itemId: string) {
    return cart.find(c => c.menuItem.id === itemId)?.quantity ?? 0
  }

  async function placeOrder() {
    if (cart.length === 0) return
    setSubmitting(true)
    setError(null)

    const supabase = createClient()

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        bed_id:        bed.id,
        beach_id:      bed.beach_id,
        customer_name: customerName.trim() || null,
        notes:         orderNotes.trim() || null,
        status:        'pending',
      })
      .select('id, order_number')
      .single()

    if (orderError || !order) {
      setError('Failed to place order. Please try again.')
      setSubmitting(false)
      return
    }

    const { error: itemsError } = await supabase.from('order_items').insert(
      cart.map(c => ({
        order_id:     order.id,
        menu_item_id: c.menuItem.id,
        quantity:     c.quantity,
        unit_price:   c.menuItem.price,
        notes:        c.notes || null,
      }))
    )

    if (itemsError) {
      setError('Failed to save order items. Please try again.')
      setSubmitting(false)
      return
    }

    setCart([])
    setCartOpen(false)
    setCustomerName('')
    setOrderNotes('')
    setSubmitting(false)
    setActiveTab('orders')
    fetchOrders()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 pt-6 pb-0 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">{beachName}</p>
            <h1 className="text-xl font-bold text-slate-900">Bed {bed.label}</h1>
          </div>
          <span className="text-3xl">🏖️</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 -mx-4 px-4">
          <TabBtn active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} badge={activeOrders.length}>
            My Orders
          </TabBtn>
          <TabBtn active={activeTab === 'food'} onClick={() => setActiveTab('food')}>
            🍔 Food
          </TabBtn>
          <TabBtn active={activeTab === 'drink'} onClick={() => setActiveTab('drink')}>
            🍹 Drinks
          </TabBtn>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4 pb-32">

        {/* ── My Orders tab ─────────────────────── */}
        {activeTab === 'orders' && (
          <>
            {existingOrders.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <p className="text-4xl mb-3">🧾</p>
                <p className="font-medium">No orders yet</p>
                <p className="text-sm mt-1">Tap Food or Drinks to order</p>
              </div>
            )}

            {activeOrders.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active</p>
                {activeOrders.map(order => <OrderCard key={order.id} order={order} symbol={symbol} />)}
              </div>
            )}

            {pastOrders.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4">Past</p>
                {pastOrders.map(order => <OrderCard key={order.id} order={order} symbol={symbol} />)}
              </div>
            )}
          </>
        )}

        {/* ── Menu tabs ─────────────────────────── */}
        {(activeTab === 'food' || activeTab === 'drink') && (
          <>
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                  {category}
                </h2>
                <div className="space-y-2">
                  {items.map(item => {
                    const qty = getQuantity(item.id)
                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3"
                      >
                        {item.image_url && (
                          <img src={item.image_url} alt={item.name}
                            className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>
                          )}
                          <p className="text-sm font-bold text-slate-800 mt-1">
                            {symbol}{item.price.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {qty > 0 && (
                            <>
                              <button onClick={() => removeFromCart(item.id)}
                                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-lg leading-none">
                                −
                              </button>
                              <span className="w-5 text-center font-bold text-slate-800 text-sm">{qty}</span>
                            </>
                          )}
                          <button onClick={() => addToCart(item)}
                            className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-lg leading-none">
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {Object.keys(grouped).length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <p className="text-4xl mb-3">{activeTab === 'food' ? '🍽️' : '🥤'}</p>
                <p>Nothing here yet</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Cart button */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
          <button onClick={() => setCartOpen(true)}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-semibold flex items-center justify-between px-5 shadow-xl">
            <span className="bg-white/20 rounded-full px-2 py-0.5 text-sm">{cartCount}</span>
            <span>View order</span>
            <span className="font-bold">{symbol}{cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 flex items-end">
          <div className="bg-white w-full max-w-lg mx-auto rounded-t-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Your order</h2>
              <button onClick={() => setCartOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>

            <div className="overflow-auto flex-1 px-5 py-3 space-y-3">
              {cart.map(c => (
                <div key={c.menuItem.id} className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeFromCart(c.menuItem.id)}
                      className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">−</button>
                    <span className="w-5 text-center font-bold text-sm">{c.quantity}</span>
                    <button onClick={() => addToCart(c.menuItem)}
                      className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">+</button>
                  </div>
                  <span className="flex-1 text-sm font-medium text-slate-800">{c.menuItem.name}</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {symbol}{(c.menuItem.price * c.quantity).toFixed(2)}
                  </span>
                </div>
              ))}

              <div className="border-t border-slate-100 pt-3 flex justify-between font-bold text-slate-900">
                <span>Total</span>
                <span>{symbol}{cartTotal.toFixed(2)}</span>
              </div>

              <div className="pt-1">
                <label className="text-xs font-semibold text-slate-500 block mb-1">Your name (optional)</label>
                <input type="text" placeholder="So we know who to ask for"
                  value={customerName} onChange={e => setCustomerName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Notes (optional)</label>
                <input type="text" placeholder="e.g. no ice, extra sauce"
                  value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            </div>

            <div className="px-5 py-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 text-center mb-3">Pay on delivery · Bed {bed.label}</p>
              <button onClick={placeOrder} disabled={submitting}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-50">
                {submitting ? 'Placing order...' : `Place order · ${symbol}${cartTotal.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function TabBtn({ active, onClick, children, badge }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-slate-900 text-slate-900'
          : 'border-transparent text-slate-400 hover:text-slate-600'
      }`}
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  )
}

function OrderCard({ order, symbol }: { order: Order; symbol: string }) {
  const s = STATUS_LABEL[order.status as OrderStatus]
  const total = order.items?.reduce((sum, i) => sum + i.unit_price * i.quantity, 0) ?? 0

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${s.color}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{s.icon}</span>
          <span className="font-bold text-sm">Order #{order.order_number}</span>
        </div>
        <span className="text-xs font-semibold">{s.label}</span>
      </div>

      <div className="space-y-1">
        {order.items?.map(item => (
          <div key={item.id} className="flex justify-between text-xs">
            <span>{item.quantity}× {item.menu_item?.name}</span>
            <span className="font-medium">{symbol}{(item.unit_price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-xs font-bold border-t border-current/20 pt-2">
        <span>Total</span>
        <span>{symbol}{total.toFixed(2)}</span>
      </div>

      {order.notes && (
        <p className="text-xs italic opacity-70">"{order.notes}"</p>
      )}
    </div>
  )
}
