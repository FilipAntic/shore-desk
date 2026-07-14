'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BedWithState, UserRole } from '@/types'
import { BedCard } from './bed-card'
import { BedDetailPanel } from './bed-detail-panel'
import { Skeleton } from '@/components/ui/skeleton'

interface BeachMapProps {
  role: UserRole
  beachId: string
}

type FilterType = 'all' | 'available' | 'occupied' | 'orders'

const LEGEND = [
  { color: 'bg-green-100 border-green-300',  label: 'Available' },
  { color: 'bg-red-100 border-red-400',      label: 'Occupied' },
  { color: 'bg-amber-100 border-amber-400',  label: 'Has order' },
  { color: 'bg-blue-100 border-blue-400',    label: 'Reserved' },
  { color: 'bg-slate-100 border-slate-200',  label: 'Disabled' },
]

export function BeachMap({ role, beachId }: BeachMapProps) {
  const [beds, setBeds] = useState<BedWithState[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')

  // Derive selected bed from beds array so fetchBeds never needs selectedBed as a dep
  const selectedBed = beds.find(b => b.id === selectedBedId) ?? null

  const fetchBeds = useCallback(async () => {
    const supabase = createClient()

    const { data: bedsData } = await supabase
      .from('beds')
      .select('*')
      .eq('beach_id', beachId)
      .order('row')
      .order('col')

    if (!bedsData) return

    const { data: rentals } = await supabase
      .from('rentals')
      .select('*, seller:profiles!seller_id(full_name)')
      .eq('beach_id', beachId)
      .eq('voided', false)
      .gte('ends_at', new Date().toISOString())

    const { data: orders } = await supabase
      .from('orders')
      .select('*, items:order_items(*, menu_item:menu_items(name, type))')
      .eq('beach_id', beachId)
      .in('status', ['pending', 'preparing', 'ready', 'delivering'])

    // Auto-reset beds that are marked occupied but have no active rental (e.g. from previous day)
    const staleIds = bedsData
      .filter(b => b.status === 'occupied' && !rentals?.find(r => r.bed_id === b.id))
      .map(b => b.id)

    if (staleIds.length > 0) {
      await supabase.from('beds').update({ status: 'available' }).in('id', staleIds)
      staleIds.forEach(id => {
        const bed = bedsData.find(b => b.id === id)
        if (bed) bed.status = 'available'
      })
    }

    const enriched: BedWithState[] = bedsData.map(bed => ({
      ...bed,
      active_rental: rentals?.find(r => r.bed_id === bed.id) ?? null,
      pending_orders: orders?.filter(o => o.bed_id === bed.id) ?? [],
    }))

    setBeds(enriched)
    setLoading(false)
  }, [beachId])

  useEffect(() => {
    fetchBeds()

    // Real-time subscriptions
    const supabase = createClient()
    const channel = supabase
      .channel(`beach-map-${beachId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beds', filter: `beach_id=eq.${beachId}` }, fetchBeds)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rentals', filter: `beach_id=eq.${beachId}` }, fetchBeds)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `beach_id=eq.${beachId}` }, fetchBeds)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchBeds, beachId])

  const filteredBeds = beds.filter(bed => {
    if (filter === 'available') return bed.status === 'available'
    if (filter === 'occupied') return bed.status === 'occupied'
    if (filter === 'orders') return bed.pending_orders.length > 0
    return true
  })

  // Group by row
  const rows = filteredBeds.reduce<Record<number, BedWithState[]>>((acc, bed) => {
    if (!acc[bed.row]) acc[bed.row] = []
    acc[bed.row].push(bed)
    return acc
  }, {})

  const stats = {
    total:     beds.filter(b => b.is_active).length,
    occupied:  beds.filter(b => b.status === 'occupied').length,
    available: beds.filter(b => b.status === 'available').length,
    orders:    beds.filter(b => b.pending_orders.length > 0).length,
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-24 rounded-lg" />)}
        </div>
        <div className="flex flex-wrap gap-3">
          {[...Array(20)].map((_, i) => <Skeleton key={i} className="h-16 w-16 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Map area */}
      <div className="flex-1 p-4 md:p-6 overflow-auto space-y-4 md:space-y-6">
        {/* Stats — horizontally scrollable on mobile */}
        <div className="flex gap-2 md:gap-3 overflow-x-auto pb-1 md:pb-0 md:flex-wrap scrollbar-none">
          {[
            { label: 'Total', value: stats.total, color: 'text-slate-700' },
            { label: 'Occupied', value: stats.occupied, color: 'text-red-600' },
            { label: 'Available', value: stats.available, color: 'text-green-600' },
            { label: 'With orders', value: stats.orders, color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="flex-shrink-0 bg-white rounded-xl border border-slate-200 px-4 py-2 shadow-sm">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'available', 'occupied', 'orders'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
                filter === f
                  ? 'bg-sky-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f === 'orders' ? 'Has orders' : f}
            </button>
          ))}
        </div>

        {/* Sea indicator */}
        <div className="w-full h-8 bg-gradient-to-b from-sky-300 to-sky-100 rounded-xl flex items-center justify-center">
          <span className="text-xs font-semibold text-sky-700 tracking-widest uppercase">Sea</span>
        </div>

        {/* Bed grid */}
        <div className="space-y-3">
          {Object.entries(rows)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([row, rowBeds]) => (
              <div key={row} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-4 flex-shrink-0 text-right">{rowBeds[0]?.label?.[0]}</span>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {rowBeds
                    .sort((a, b) => a.col - b.col)
                    .map(bed => (
                      <BedCard
                        key={bed.id}
                        bed={bed}
                        isSelected={selectedBedId === bed.id}
                        onClick={() => setSelectedBedId(selectedBedId === bed.id ? null : bed.id)}
                      />
                    ))}
                </div>
              </div>
            ))}
        </div>

        {/* Bar indicator */}
        <div className="w-full h-8 bg-gradient-to-b from-amber-100 to-amber-50 rounded-xl flex items-center justify-center">
          <span className="text-xs font-semibold text-amber-700 tracking-widest uppercase">Bar</span>
        </div>

        {/* Legend */}
        <div className="flex gap-3 md:gap-4 flex-wrap">
          {LEGEND.map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className={`w-4 h-4 rounded border-2 ${l.color}`} />
              <span className="text-xs text-slate-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop side panel */}
      {selectedBed && (
        <aside className="hidden md:flex w-72 border-l border-slate-200 bg-white flex-col overflow-hidden">
          <BedDetailPanel
            bed={selectedBed}
            role={role}
            onClose={() => setSelectedBedId(null)}
            onRefresh={fetchBeds}
          />
        </aside>
      )}

      {/* Mobile bottom sheet */}
      {selectedBed && (
        <>
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/40"
            onClick={() => setSelectedBedId(null)}
          />
          <div className="md:hidden fixed inset-x-0 bottom-16 z-40 bg-white rounded-t-2xl shadow-2xl max-h-[75vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-1 sticky top-0 bg-white rounded-t-2xl">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>
            <BedDetailPanel
              bed={selectedBed}
              role={role}
              onClose={() => setSelectedBedId(null)}
              onRefresh={fetchBeds}
            />
          </div>
        </>
      )}
    </div>
  )
}