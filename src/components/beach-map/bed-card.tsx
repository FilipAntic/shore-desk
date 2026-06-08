'use client'

import type { BedWithState } from '@/types'
import { cn } from '@/lib/utils'

interface BedCardProps {
  bed: BedWithState
  isSelected: boolean
  onClick: () => void
}

function getBedStyle(bed: BedWithState) {
  if (!bed.is_active) return 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
  if (bed.status === 'disabled') return 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
  if (bed.status === 'occupied') {
    if (bed.pending_orders.length > 0) {
      return 'bg-amber-50 text-amber-800 border-amber-400 hover:border-amber-500 cursor-pointer shadow-sm'
    }
    return 'bg-red-50 text-red-800 border-red-400 hover:border-red-500 cursor-pointer shadow-sm'
  }
  if (bed.status === 'reserved') {
    return 'bg-blue-50 text-blue-800 border-blue-400 hover:border-blue-500 cursor-pointer'
  }
  return 'bg-green-50 text-green-800 border-green-300 hover:border-green-500 cursor-pointer'
}

function getBedIcon(bed: BedWithState) {
  if (!bed.is_active || bed.status === 'disabled') return '🚫'
  if (bed.status === 'occupied') {
    if (bed.pending_orders.length > 0) return '🍹'
    return '🏖️'
  }
  if (bed.status === 'reserved') return '🔒'
  return '☀️'
}

export function BedCard({ bed, isSelected, onClick }: BedCardProps) {
  const isDisabled = !bed.is_active || bed.status === 'disabled'

  return (
    <button
      onClick={isDisabled ? undefined : onClick}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border-2 transition-all',
        'w-16 h-16 text-xs font-semibold select-none',
        getBedStyle(bed),
        isSelected && 'ring-2 ring-offset-1 ring-sky-500 z-10'
      )}
      title={`Bed ${bed.label} — ${bed.status}`}
    >
      <span className="text-lg leading-none">{getBedIcon(bed)}</span>
      <span className="mt-0.5 leading-none">{bed.label}</span>
      {bed.pending_orders.length > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {bed.pending_orders.length}
        </span>
      )}
    </button>
  )
}