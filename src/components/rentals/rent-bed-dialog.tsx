'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BedWithState } from '@/types'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RentBedDialogProps {
  bed: BedWithState
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}

function isPastTimeOfDay(hhmm: string): boolean {
  const [h, m] = hhmm.split(':').map(Number)
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m
}

export function RentBedDialog({ bed, open, onOpenChange, onSuccess }: RentBedDialogProps) {
  const [price, setPrice] = useState<number | null>(null)
  const [isLateArrival, setIsLateArrival] = useState(false)
  const [closingTime, setClosingTime] = useState('18:00')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadConfig() {
      const supabase = createClient()
      const { data } = await supabase
        .from('config')
        .select('key, value')
        .eq('beach_id', bed.beach_id)
        .in('key', ['price_full_day', 'closing_time', 'late_arrival_price', 'late_arrival_time'])

      const priceRow = data?.find(r => r.key === 'price_full_day')
      const timeRow  = data?.find(r => r.key === 'closing_time')
      const latePriceRow = data?.find(r => r.key === 'late_arrival_price')
      const lateTimeRow  = data?.find(r => r.key === 'late_arrival_time')

      if (timeRow) setClosingTime(timeRow.value)

      const isLate = lateTimeRow ? isPastTimeOfDay(lateTimeRow.value) : false
      setIsLateArrival(isLate)
      if (isLate && latePriceRow) {
        setPrice(parseFloat(latePriceRow.value))
      } else if (priceRow) {
        setPrice(parseFloat(priceRow.value))
      }
    }
    if (open) loadConfig()
  }, [open])

  function calcEndsAt(): Date {
    const [h, m] = closingTime.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (price === null) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }

    const { error: rentalError } = await supabase.from('rentals').insert({
      bed_id:        bed.id,
      beach_id:      bed.beach_id,
      seller_id:     user.id,
      ends_at:       calcEndsAt().toISOString(),
      amount_paid:   price,
      duration_type: 'full_day',
      notes:         notes || null,
    })

    if (rentalError) { setError(rentalError.message); setLoading(false); return }

    await supabase.from('beds').update({ status: 'occupied' }).eq('id', bed.id)

    setLoading(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rent Bed {bed.label}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                {isLateArrival ? 'Late arrival rental' : 'Full day rental'}
              </p>
              <p className="text-xs text-slate-400">Until {closingTime}</p>
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {price !== null ? `€${price.toFixed(2)}` : '...'}
            </p>
          </div>

          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Input
              placeholder="e.g. extra umbrella, VIP guest"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || price === null}>
              {loading ? 'Saving...' : `Confirm — €${price?.toFixed(2) ?? '...'}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}