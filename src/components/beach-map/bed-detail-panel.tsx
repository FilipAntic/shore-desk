'use client'

import { useState } from 'react'
import type { BedWithState, UserRole } from '@/types'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { RentBedDialog } from '@/components/rentals/rent-bed-dialog'
import { createClient } from '@/lib/supabase/client'

interface BedDetailPanelProps {
  bed: BedWithState
  role: UserRole
  onClose: () => void
  onRefresh: () => void
}

const STATUS_BADGE: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  occupied:  'bg-red-100 text-red-800',
  reserved:  'bg-blue-100 text-blue-800',
  disabled:  'bg-slate-100 text-slate-500',
}

const ORDER_STATUS_BADGE: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-800',
  preparing:  'bg-orange-100 text-orange-800',
  ready:      'bg-green-100 text-green-800',
  delivering: 'bg-blue-100 text-blue-800',
  delivered:  'bg-slate-100 text-slate-600',
  cancelled:  'bg-red-100 text-red-700',
}

export function BedDetailPanel({ bed, role, onClose, onRefresh }: BedDetailPanelProps) {
  const [rentOpen, setRentOpen]     = useState(false)
  const [voidOpen, setVoidOpen]     = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding]       = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)

  const canRent  = ['owner', 'manager', 'seller'].includes(role)
  const canVoid  = ['owner', 'manager'].includes(role)
  const rental   = bed.active_rental

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  function formatCurrency(amount: number) {
    return `€${amount.toFixed(2)}`
  }

  async function handleCheckOut() {
    if (!rental) return
    setCheckingOut(true)
    const supabase = createClient()
    await supabase.from('beds').update({ status: 'available' }).eq('id', bed.id)
    setCheckingOut(false)
    onRefresh()
  }

  async function handleVoid() {
    if (!rental) return
    setVoiding(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('rentals')
      .update({
        voided:      true,
        voided_by:   user?.id ?? null,
        voided_at:   new Date().toISOString(),
        void_reason: voidReason.trim() || null,
      })
      .eq('id', rental.id)
    await supabase.from('beds').update({ status: 'available' }).eq('id', bed.id)
    setVoiding(false)
    setVoidOpen(false)
    setVoidReason('')
    onRefresh()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Bed {bed.label}</h2>
          {bed.section && <p className="text-xs text-slate-500">{bed.section}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${STATUS_BADGE[bed.status]}`}>
            {bed.status}
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Rental info */}
        {rental ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rental</p>
            <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Rented at</span>
                <span className="font-medium">{formatTime(rental.started_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Until</span>
                <span className="font-medium">{formatTime(rental.ends_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paid</span>
                <span className="font-semibold text-green-700">{formatCurrency(rental.amount_paid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Staff</span>
                <span className="font-medium">{rental.seller?.full_name ?? '—'}</span>
              </div>
              {rental.notes && (
                <div className="pt-1 border-t border-slate-200">
                  <span className="text-slate-500 text-xs">{rental.notes}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          bed.status === 'available' && (
            <p className="text-sm text-slate-400 text-center py-2">This bed is available</p>
          )
        )}

        {/* Active orders */}
        {bed.pending_orders.length > 0 && (
          <div className="space-y-2">
            <Separator />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Orders</p>
            <div className="space-y-2">
              {bed.pending_orders.map(order => (
                <div key={order.id} className="bg-white border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Order #{order.order_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS_BADGE[order.status]}`}>
                      {order.status}
                    </span>
                  </div>
                  {order.items?.map(item => (
                    <div key={item.id} className="flex justify-between text-xs text-slate-600">
                      <span>{item.quantity}× {item.menu_item?.name}</span>
                      <span>€{(item.unit_price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  {order.notes && (
                    <p className="text-xs text-slate-400 mt-1 italic">&ldquo;{order.notes}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {canRent && (
        <div className="p-4 border-t space-y-2">
          {bed.status === 'available' && (
            <Button className="w-full" onClick={() => setRentOpen(true)}>
              Rent Bed
            </Button>
          )}

          {bed.status === 'occupied' && (
            <>
              <Button
                variant="outline"
                className="w-full"
                disabled={checkingOut}
                onClick={handleCheckOut}
              >
                {checkingOut ? 'Checking out…' : 'Check Out'}
              </Button>

              {canVoid && !voidOpen && (
                <button
                  onClick={() => { setVoidOpen(true); setVoidReason('') }}
                  className="w-full text-xs text-red-500 hover:text-red-700 py-1 transition-colors"
                >
                  Void rental…
                </button>
              )}

              {canVoid && voidOpen && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-semibold text-red-600">Void rental — this cannot be undone</p>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Reason (optional)"
                    value={voidReason}
                    onChange={e => setVoidReason(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setVoidOpen(false)}
                      className="flex-1 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleVoid}
                      disabled={voiding}
                      className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                    >
                      {voiding ? 'Voiding…' : 'Void rental'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <RentBedDialog
        bed={bed}
        open={rentOpen}
        onOpenChange={setRentOpen}
        onSuccess={() => {
          setRentOpen(false)
          onRefresh()
        }}
      />
    </div>
  )
}
