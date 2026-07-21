'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface MonthRow {
  key: string        // "2026-07"
  label: string       // "Jul 2026"
  cash: number
  card: number
  rentalTotal: number
  ordersRevenue: number
}

const RANGE_OPTIONS = [
  { label: '6 months', months: 6 },
  { label: '12 months', months: 12 },
  { label: '24 months', months: 24 },
]

function monthKey(iso: string) {
  return iso.slice(0, 7)
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

function startOfRange(months: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - (months - 1), 1)
  d.setHours(0, 0, 0, 0)
  return d
}

export function RevenueReport({ beachId }: { beachId: string }) {
  const [months, setMonths]   = useState(12)
  const [rows, setRows]       = useState<MonthRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchRevenue() {
      setLoading(true)
      const supabase = createClient()
      const rangeStart = startOfRange(months).toISOString()

      const monthMap = new Map<string, MonthRow>()
      function getRow(key: string): MonthRow {
        if (!monthMap.has(key)) {
          monthMap.set(key, { key, label: monthLabel(key), cash: 0, card: 0, rentalTotal: 0, ordersRevenue: 0 })
        }
        return monthMap.get(key)!
      }

      const { data: rentals } = await supabase
        .from('rentals')
        .select('amount_paid, payment_method, created_at, voided')
        .eq('beach_id', beachId)
        .eq('voided', false)
        .gte('created_at', rangeStart)

      for (const r of rentals ?? []) {
        const row = getRow(monthKey(r.created_at))
        const amount = Number(r.amount_paid)
        if (r.payment_method === 'card') row.card += amount
        else row.cash += amount
        row.rentalTotal += amount
      }

      const { data: ordersData } = await supabase
        .from('orders')
        .select('created_at, status, items:order_items(unit_price, quantity)')
        .eq('beach_id', beachId)
        .neq('status', 'cancelled')
        .gte('created_at', rangeStart)

      for (const order of ordersData ?? []) {
        const row = getRow(monthKey(order.created_at))
        for (const item of ((order.items ?? []) as unknown as { unit_price: number; quantity: number }[])) {
          row.ordersRevenue += Number(item.unit_price) * item.quantity
        }
      }

      const sorted = Array.from(monthMap.values()).sort((a, b) => a.key.localeCompare(b.key))
      setRows(sorted)
      setLoading(false)
    }
    fetchRevenue()
  }, [months, beachId])

  const totalCash    = rows.reduce((s, r) => s + r.cash, 0)
  const totalCard     = rows.reduce((s, r) => s + r.card, 0)
  const totalRentals  = totalCash + totalCard
  const totalOrders   = rows.reduce((s, r) => s + r.ordersRevenue, 0)
  const totalCombined = totalRentals + totalOrders
  const cashPct = totalRentals > 0 ? (totalCash / totalRentals) * 100 : 0
  const cardPct = totalRentals > 0 ? (totalCard / totalRentals) * 100 : 0

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Range picker */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.months}
              onClick={() => setMonths(opt.months)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                months === opt.months
                  ? 'bg-sky-50 text-sky-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {loading && <span className="text-sm text-slate-400">Loading…</span>}
      </div>

      {/* Cash vs card stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Combined revenue</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">€{totalCombined.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1">Rentals + orders</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">💵 Cash (rentals)</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">€{totalCash.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1">{cashPct.toFixed(0)}% of rental revenue</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">💳 Card (rentals)</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">€{totalCard.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1">{cardPct.toFixed(0)}% of rental revenue</p>
        </div>
      </div>

      {/* Revenue by month */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Revenue by Month</h2>
        </div>

        {rows.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No revenue in this range</p>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-slate-100">
              {rows.map(row => (
                <div key={row.key} className="p-4 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{row.label}</span>
                    <span className="font-semibold text-green-700">
                      €{(row.rentalTotal + row.ordersRevenue).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>💵 €{row.cash.toFixed(2)} · 💳 €{row.card.toFixed(2)}</span>
                    <span>Orders €{row.ordersRevenue.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <div className="p-4 flex items-center justify-between bg-slate-50">
                <span className="text-xs font-bold text-slate-500 uppercase">Total</span>
                <span className="font-bold text-green-700">€{totalCombined.toFixed(2)}</span>
              </div>
            </div>

            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Month</th>
                  <th className="text-right px-4 py-2">Cash</th>
                  <th className="text-right px-4 py-2">Card</th>
                  <th className="text-right px-4 py-2">Rentals total</th>
                  <th className="text-right px-4 py-2">Orders</th>
                  <th className="text-right px-4 py-2">Combined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(row => (
                  <tr key={row.key} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{row.label}</td>
                    <td className="px-4 py-3 text-right text-slate-700">€{row.cash.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">€{row.card.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">€{row.rentalTotal.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">€{row.ordersRevenue.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">
                      €{(row.rentalTotal + row.ordersRevenue).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">€{totalCash.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">€{totalCard.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">€{totalRentals.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">€{totalOrders.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">€{totalCombined.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
