'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Bed } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface BedLayoutManagerProps {
  beds: Bed[]
}

function SortableBed({ bed, onToggle }: { bed: Bed; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bed.id })

  return (
    <button
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={onToggle}
      title={bed.is_active ? 'Drag to reorder · Click to disable' : 'Drag to reorder · Click to enable'}
      className={`w-12 h-12 rounded-lg border-2 text-xs font-bold select-none touch-none cursor-grab active:cursor-grabbing transition-colors ${
        bed.is_active
          ? 'bg-green-50 border-green-300 text-green-800 hover:border-red-300 hover:bg-red-50 hover:text-red-700'
          : 'bg-slate-100 border-slate-200 text-slate-400 hover:border-green-300 hover:bg-green-50 hover:text-green-700'
      }`}
    >
      {bed.label}
    </button>
  )
}

function BedDragOverlay({ bed }: { bed: Bed | null }) {
  if (!bed) return null
  return (
    <div className={`w-12 h-12 rounded-lg border-2 text-xs font-bold flex items-center justify-center shadow-lg rotate-3 cursor-grabbing ${
      bed.is_active
        ? 'bg-green-50 border-sky-400 text-green-800'
        : 'bg-slate-100 border-sky-400 text-slate-400'
    }`}>
      {bed.label}
    </div>
  )
}

export function BedLayoutManager({ beds: initialBeds }: BedLayoutManagerProps) {
  const router = useRouter()
  const [localBeds, setLocalBeds] = useState<Bed[]>(initialBeds)
  const [activeBed, setActiveBed] = useState<Bed | null>(null)
  const [saving, setSaving] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [row, setRow] = useState('')
  const [col, setCol] = useState('')
  const [section, setSection] = useState('')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState('4')
  const [cols, setCols] = useState('5')
  const [prefix, setPrefix] = useState('A')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const grouped = localBeds.reduce<Record<number, Bed[]>>((acc, bed) => {
    if (!acc[bed.row]) acc[bed.row] = []
    acc[bed.row].push(bed)
    return acc
  }, {})

  function handleDragStart(event: DragStartEvent) {
    setActiveBed(localBeds.find(b => b.id === event.active.id) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveBed(null)
    if (!over || active.id === over.id) return

    const activeId = active.id as string
    const overId = over.id as string

    const prev = localBeds
    const activeBed = prev.find(b => b.id === activeId)
    const overBed = prev.find(b => b.id === overId)
    if (!activeBed || !overBed) return

    let next: Bed[]

    if (activeBed.row === overBed.row) {
      // Same row — reorder via arrayMove
      const rowBeds = prev.filter(b => b.row === activeBed.row).sort((a, b) => a.col - b.col)
      const fromIdx = rowBeds.findIndex(b => b.id === activeId)
      const toIdx = rowBeds.findIndex(b => b.id === overId)
      const reordered = arrayMove(rowBeds, fromIdx, toIdx)
      next = prev.map(b => {
        const newPos = reordered.findIndex(r => r.id === b.id)
        return newPos !== -1 ? { ...b, col: newPos + 1 } : b
      })
    } else {
      // Cross-row — move active into over's row, insert at over's col position
      const sourceRow = activeBed.row
      const targetRow = overBed.row

      const newSourceRow = prev
        .filter(b => b.row === sourceRow && b.id !== activeId)
        .sort((a, b) => a.col - b.col)
        .map((b, i) => ({ ...b, col: i + 1 }))

      const targetRowBeds = prev.filter(b => b.row === targetRow).sort((a, b) => a.col - b.col)
      const insertAt = targetRowBeds.findIndex(b => b.id === overId)
      const newTargetRow = [...targetRowBeds]
      newTargetRow.splice(insertAt, 0, { ...activeBed, row: targetRow })
      const resequencedTarget = newTargetRow.map((b, i) => ({ ...b, col: i + 1 }))

      next = [
        ...prev.filter(b => b.row !== sourceRow && b.row !== targetRow),
        ...newSourceRow,
        ...resequencedTarget,
      ]
    }

    setLocalBeds(next)
    persist(next, [activeBed.row, overBed.row], prev)
  }

  async function persist(beds: Bed[], affectedRows: number[], previousBeds: Bed[]) {
    setSaving(true)
    const supabase = createClient()
    const toUpdate = beds.filter(b => affectedRows.includes(b.row))

    // (row, col) has a unique constraint, and a reorder is a permutation where
    // one bed's new position is another bed's current position. Writing final
    // values directly in parallel races the constraint. Stage every affected
    // bed to a distinct, out-of-range row first, then move to final values.
    const TEMP_ROW_OFFSET = -1000
    const staged = await Promise.all(toUpdate.map((b, i) =>
      supabase.from('beds').update({ row: TEMP_ROW_OFFSET - i, col: 1 }).eq('id', b.id)
    ))
    const finalized = await Promise.all(toUpdate.map(b =>
      supabase.from('beds').update({ row: b.row, col: b.col }).eq('id', b.id)
    ))

    const failed = [...staged, ...finalized].some(r => r.error)
    if (failed) {
      setLocalBeds(previousBeds)
      toast.error('Could not save the new layout — reverted.')
    }

    setSaving(false)
  }

  async function toggleBed(id: string, current: boolean) {
    const supabase = createClient()
    await supabase.from('beds').update({ is_active: !current }).eq('id', id)
    setLocalBeds(prev => prev.map(b => b.id === id ? { ...b, is_active: !current } : b))
  }

  async function handleAddSingle(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('beds').insert({
      label, row: parseInt(row), col: parseInt(col), section: section || null
    }).select().single()
    if (data) setLocalBeds(prev => [...prev, data as Bed])
    setAddOpen(false)
    setLabel(''); setRow(''); setCol(''); setSection('')
    setLoading(false)
    router.refresh()
  }

  async function handleBulkAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const rowCount = parseInt(rows)
    const colCount = parseInt(cols)
    const inserts = []
    for (let r = 1; r <= rowCount; r++) {
      const rowLetter = String.fromCharCode(prefix.charCodeAt(0) + r - 1)
      for (let c = 1; c <= colCount; c++) {
        inserts.push({ label: `${rowLetter}${c}`, row: r, col: c })
      }
    }
    await supabase.from('beds').insert(inserts)
    setBulkOpen(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {localBeds.length} beds total
          {saving && <span className="ml-2 text-sky-500">Saving…</span>}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>Bulk add</Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>+ Add bed</Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="w-full h-6 bg-sky-100 rounded flex items-center justify-center">
            <span className="text-xs text-sky-600 font-semibold tracking-widest uppercase">Sea</span>
          </div>

          {Object.entries(grouped)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([rowNum, rowBeds]) => {
              const sorted = [...rowBeds].sort((a, b) => a.col - b.col)
              return (
                <div key={rowNum} className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-slate-400 w-4 text-right">
                    {sorted[0]?.label?.[0]}
                  </span>
                  <SortableContext
                    items={sorted.map(b => b.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {sorted.map(bed => (
                      <SortableBed
                        key={bed.id}
                        bed={bed}
                        onToggle={() => toggleBed(bed.id, bed.is_active)}
                      />
                    ))}
                  </SortableContext>
                </div>
              )
            })}

          <div className="w-full h-6 bg-amber-50 rounded flex items-center justify-center">
            <span className="text-xs text-amber-600 font-semibold tracking-widest uppercase">Bar</span>
          </div>
        </div>

        <DragOverlay>
          <BedDragOverlay bed={activeBed} />
        </DragOverlay>
      </DndContext>

      <p className="text-xs text-slate-400">Drag beds to reorder · Click to enable/disable.</p>

      {/* Add single bed */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a bed</DialogTitle></DialogHeader>
          <form onSubmit={handleAddSingle} className="space-y-3">
            <div className="space-y-1">
              <Label>Label (e.g. A3)</Label>
              <Input value={label} onChange={e => setLabel(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Row</Label>
                <Input type="number" min="1" value={row} onChange={e => setRow(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Column</Label>
                <Input type="number" min="1" value={col} onChange={e => setCol(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Section (optional)</Label>
              <Input placeholder="e.g. VIP, Front row" value={section} onChange={e => setSection(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Adding...' : 'Add bed'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk add */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk add beds</DialogTitle></DialogHeader>
          <form onSubmit={handleBulkAdd} className="space-y-3">
            <p className="text-sm text-slate-500">
              Generates a grid of beds automatically (e.g. 4 rows × 5 cols = A1–D5).
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Rows</Label>
                <Input type="number" min="1" max="26" value={rows} onChange={e => setRows(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Columns</Label>
                <Input type="number" min="1" value={cols} onChange={e => setCols(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Row prefix</Label>
                <Input maxLength={1} value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())} />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Will create {parseInt(rows) * parseInt(cols)} beds: {prefix}1 → {String.fromCharCode(prefix.charCodeAt(0) + parseInt(rows) - 1)}{cols}
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create beds'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}