'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SellerRow {
  id: string
  full_name: string
  role: string
  rentals: number
  voided: number
  revenue: number
}

interface OrderSummary {
  total: number
  food: number
  drink: number
  foodRevenue: number
  drinkRevenue: number
  cancelled: number
}

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function ShiftReport({ beachId }: { beachId: string }) {
  const [date, setDate]               = useState<string>(toDateString(new Date()))
  const [sellers, setSellers]         = useState<SellerRow[]>([])
  const [orders, setOrders]           = useState<OrderSummary | null>(null)
  const [loading, setLoading]         = useState(false)

  const fetchReport = useCallback(async (dateStr: string) => {
    setLoading(true)
    const supabase = createClient()

    const dayStart = `${dateStr}T00:00:00.000Z`
    const dayEnd   = `${dateStr}T23:59:59.999Z`

    // ── Rentals ───────────────────────────────────────────────────
    const { data: rentals } = await supabase
      .from('rentals')
      .select('seller_id, amount_paid, voided, seller:profiles(full_name, role)')
      .eq('beach_id', beachId)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)

    const sellerMap = new Map<string, SellerRow>()
    for (const r of rentals ?? []) {
      const seller = (r.seller as unknown) as { full_name: string; role: string } | null
      if (!seller) continue
      if (!sellerMap.has(r.seller_id)) {
        sellerMap.set(r.seller_id, {
          id: r.seller_id,
          full_name: seller.full_name,
          role: seller.role,
          rentals: 0,
          voided: 0,
          revenue: 0,
        })
      }
      const row = sellerMap.get(r.seller_id)!
      row.rentals++
      if (r.voided) {
        row.voided++
      } else {
        row.revenue += Number(r.amount_paid)
      }
    }
    setSellers(Array.from(sellerMap.values()).sort((a, b) => b.revenue - a.revenue))

    // ── Orders ────────────────────────────────────────────────────
    const { data: ordersData } = await supabase
      .from('orders')
      .select(`
        id, status,
        items:order_items(unit_price, quantity, menu_item:menu_items(type))
      `)
      .eq('beach_id', beachId)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)

    let total = 0, food = 0, drink = 0, foodRevenue = 0, drinkRevenue = 0, cancelled = 0

    for (const order of ordersData ?? []) {
      if (order.status === 'cancelled') { cancelled++; continue }
      total++
      for (const item of ((order.items ?? []) as unknown as { unit_price: number; quantity: number; menu_item: { type: string } }[])) {
        const lineTotal = Number(item.unit_price) * item.quantity
        if (item.menu_item?.type === 'food') {
          food++
          foodRevenue += lineTotal
        } else {
          drink++
          drinkRevenue += lineTotal
        }
      }
    }
    setOrders({ total, food, drink, foodRevenue, drinkRevenue, cancelled })
    setLoading(false)
  }, [beachId])

  useEffect(() => {
    fetchReport(date)
  }, [date, fetchReport])

  const totalRentalRevenue = sellers.reduce((s, r) => s + r.revenue, 0)
  const totalOrderRevenue  = (orders?.foodRevenue ?? 0) + (orders?.drinkRevenue ?? 0)

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Date picker */}
      <div className="flex items-center gap-3">
        <input
          type="date"
          value={date}
          max={toDateString(new Date())}
          onChange={e => setDate(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
        />
        <button
          onClick={() => setDate(toDateString(new Date()))}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          Today
        </button>
        {loading && <span className="text-sm text-slate-400">Loading…</span>}
      </div>

      {/* Rentals by staff */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Rentals by Staff</h2>
          <span className="text-sm font-bold text-green-700">
            Total: €{totalRentalRevenue.toFixed(2)}
          </span>
        </div>

        {sellers.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No rentals on this date</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">Staff member</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-right px-4 py-2">Rentals</th>
                <th className="text-right px-4 py-2">Voided</th>
                <th className="text-right px-4 py-2">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sellers.map(row => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{row.full_name}</td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{row.role}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{row.rentals}</td>
                  <td className="px-4 py-3 text-right">
                    {row.voided > 0
                      ? <span className="text-red-500 font-medium">{row.voided}</span>
                      : <span className="text-slate-400">0</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">
                    €{row.revenue.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Total</td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">
                  {sellers.reduce((s, r) => s + r.rentals, 0)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-red-500">
                  {sellers.reduce((s, r) => s + r.voided, 0)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-green-700">
                  €{totalRentalRevenue.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Order summary */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Order Summary</h2>
          <span className="text-sm font-bold text-green-700">
            Total: €{totalOrderRevenue.toFixed(2)}
          </span>
        </div>

        {orders === null ? null : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">Category</th>
                <th className="text-right px-4 py-2">Orders / Items</th>
                <th className="text-right px-4 py-2">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">All orders</td>
                <td className="px-4 py-3 text-right text-slate-700">{orders.total}</td>
                <td className="px-4 py-3 text-right font-semibold text-green-700">
                  €{totalOrderRevenue.toFixed(2)}
                </td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">🍔 Food items</td>
                <td className="px-4 py-3 text-right text-slate-700">{orders.food}</td>
                <td className="px-4 py-3 text-right text-slate-700">€{orders.foodRevenue.toFixed(2)}</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">🍹 Drink items</td>
                <td className="px-4 py-3 text-right text-slate-700">{orders.drink}</td>
                <td className="px-4 py-3 text-right text-slate-700">€{orders.drinkRevenue.toFixed(2)}</td>
              </tr>
              {orders.cancelled > 0 && (
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-red-500">Cancelled orders</td>
                  <td className="px-4 py-3 text-right text-red-500">{orders.cancelled}</td>
                  <td className="px-4 py-3 text-right text-slate-400">—</td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">
                  Combined revenue
                </td>
                <td className="px-4 py-3 text-right font-bold text-green-700">
                  €{(totalRentalRevenue + totalOrderRevenue).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
