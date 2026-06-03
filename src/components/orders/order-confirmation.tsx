'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { OrderStatus } from '@/types'

interface OrderConfirmationProps {
  orderId: string
  bedLabel: string
}

const STEPS: { status: OrderStatus; label: string; icon: string; description: string }[] = [
  { status: 'pending',    icon: '✅', label: 'Order received',   description: 'Your order is in the queue' },
  { status: 'preparing',  icon: '👨‍🍳', label: 'Being prepared',  description: 'Kitchen is working on it' },
  { status: 'ready',      icon: '🔔', label: 'Ready',            description: 'Your order is on the way' },
  { status: 'delivering', icon: '🏃', label: 'On the way',       description: 'Waiter is heading to you' },
  { status: 'delivered',  icon: '🎉', label: 'Delivered!',       description: 'Enjoy your order!' },
]

const STATUS_INDEX: Record<OrderStatus, number> = {
  pending:    0,
  preparing:  1,
  ready:      2,
  delivering: 3,
  delivered:  4,
  cancelled:  -1,
}

export function OrderConfirmation({ orderId, bedLabel }: OrderConfirmationProps) {
  const [status, setStatus] = useState<OrderStatus>('pending')
  const [orderNumber, setOrderNumber] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Initial fetch
    supabase
      .from('orders')
      .select('status, order_number')
      .eq('id', orderId)
      .single()
      .then(({ data }) => {
        if (data) {
          setStatus(data.status as OrderStatus)
          setOrderNumber(data.order_number)
        }
      })

    // Real-time subscription
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        payload => {
          setStatus(payload.new.status as OrderStatus)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orderId])

  const currentStep = STATUS_INDEX[status] ?? 0
  const isCancelled = status === 'cancelled'
  const isDelivered = status === 'delivered'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 max-w-lg mx-auto">
      <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="text-5xl mb-3">
            {isCancelled ? '❌' : isDelivered ? '🎉' : '🏖️'}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isCancelled ? 'Order cancelled' : isDelivered ? 'Enjoy!' : 'Order placed!'}
          </h1>
          {orderNumber && (
            <p className="text-slate-400 text-sm mt-1">
              Order <span className="font-bold text-slate-700">#{orderNumber}</span> · Bed {bedLabel}
            </p>
          )}
        </div>

        {/* Status tracker */}
        {!isCancelled && (
          <div className="space-y-1">
            {STEPS.map((step, i) => {
              const isPast    = i < currentStep
              const isCurrent = i === currentStep
              const isFuture  = i > currentStep

              return (
                <div key={step.status} className="flex items-center gap-3">
                  {/* Line connector */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all ${
                        isPast    ? 'bg-green-100 text-green-600' :
                        isCurrent ? 'bg-slate-900 text-white scale-110 shadow-md' :
                                    'bg-slate-100 text-slate-300'
                      }`}
                    >
                      {step.icon}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-0.5 h-5 mt-0.5 ${isPast ? 'bg-green-300' : 'bg-slate-200'}`} />
                    )}
                  </div>

                  <div className={`transition-opacity ${isFuture ? 'opacity-40' : 'opacity-100'}`}>
                    <p className={`text-sm font-semibold ${isCurrent ? 'text-slate-900' : 'text-slate-600'}`}>
                      {step.label}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-slate-400">{step.description}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {isCancelled && (
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <p className="text-sm text-red-600">
              Your order was cancelled. Please ask a staff member for assistance.
            </p>
          </div>
        )}

        {/* Footer note */}
        {!isDelivered && !isCancelled && (
          <p className="text-center text-xs text-slate-400">
            This page updates automatically. You can keep it open to track your order.
          </p>
        )}

        {isDelivered && (
          <p className="text-center text-sm text-slate-500">
            Want something else? Scan the QR code again to place another order.
          </p>
        )}
      </div>
    </div>
  )
}
