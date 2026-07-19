'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Stat {
  label: string
  value: string
  sub: string
  color: string
}

interface LiveStatsProps {
  currency: string
  beachId: string
}

export function LiveStats({ currency, beachId }: LiveStatsProps) {
  const [stats, setStats] = useState<Stat[]>([])
  const symbol = currency === 'EUR' ? '€' : currency

  const fetchStats = useCallback(async () => {
    const supabase = createClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [{ data: rentalsToday }, { data: ordersToday }, { data: beds }] = await Promise.all([
      supabase
        .from('rentals')
        .select('amount_paid')
        .eq('beach_id', beachId)
        .gte('created_at', today.toISOString())
        .eq('voided', false),
      supabase
        .from('order_items')
        .select('unit_price, quantity, order:orders!inner(created_at, status, beach_id)')
        .eq('order.beach_id', beachId)
        .gte('order.created_at', today.toISOString())
        .neq('order.status', 'cancelled'),
      supabase
        .from('beds')
        .select('status')
        .eq('beach_id', beachId)
        .eq('is_active', true),
    ])

    const orderRevenue = ordersToday?.reduce(
      (sum, i) => sum + i.unit_price * i.quantity, 0
    ) ?? 0

    const rentalRevenue = rentalsToday?.reduce((sum, r) => sum + Number(r.amount_paid), 0) ?? 0
    const totalRevenue = rentalRevenue + orderRevenue
    const occupiedBeds = beds?.filter(b => b.status === 'occupied').length ?? 0
    const totalBeds = beds?.length ?? 0

    setStats([
      { label: 'Total Revenue',      value: `${symbol}${totalRevenue.toFixed(2)}`,      sub: 'today',  color: 'text-green-600' },
      { label: 'Beds Rented',        value: String(rentalsToday?.length ?? 0),          sub: 'today',  color: 'text-sky-600' },
      { label: 'Currently Occupied', value: `${occupiedBeds}/${totalBeds}`,             sub: 'beds',   color: 'text-slate-700' },
      { label: 'Food & Drink',       value: `${symbol}${orderRevenue.toFixed(2)}`,      sub: 'today',  color: 'text-amber-600' },
    ])
  }, [symbol, beachId])

  useEffect(() => {
    fetchStats()

    const supabase = createClient()
    const channel = supabase
      .channel(`live-stats-${beachId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rentals', filter: `beach_id=eq.${beachId}` }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `beach_id=eq.${beachId}` }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beds', filter: `beach_id=eq.${beachId}` }, fetchStats)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchStats, beachId])

  if (stats.length === 0) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-20 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(s => (
        <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">{s.label}</p>
          <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
        </div>
      ))}
    </div>
  )
}
