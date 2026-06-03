'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Bed } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

interface BedLayoutManagerProps {
  beds: Bed[]
}

export function BedLayoutManager({ beds }: BedLayoutManagerProps) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [row, setRow] = useState('')
  const [col, setCol] = useState('')
  const [section, setSection] = useState('')
  const [loading, setLoading] = useState(false)

  // Bulk add state
  const [rows, setRows] = useState('4')
  const [cols, setCols] = useState('5')
  const [prefix, setPrefix] = useState('A')

  // Group by row for display
  const grouped = beds.reduce<Record<number, Bed[]>>((acc, bed) => {
    if (!acc[bed.row]) acc[bed.row] = []
    acc[bed.row].push(bed)
    return acc
  }, {})

  async function handleAddSingle(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.from('beds').insert({
      label, row: parseInt(row), col: parseInt(col), section: section || null
    })
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

  async function toggleBed(id: string, current: boolean) {
    const supabase = createClient()
    await supabase.from('beds').update({ is_active: !current }).eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{beds.length} beds total</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>Bulk add</Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>+ Add bed</Button>
        </div>
      </div>

      {/* Visual grid */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="w-full h-6 bg-sky-100 rounded flex items-center justify-center">
          <span className="text-xs text-sky-600 font-semibold tracking-widest uppercase">Sea</span>
        </div>

        {Object.entries(grouped)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([rowNum, rowBeds]) => (
            <div key={rowNum} className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-slate-400 w-4 text-right">
                {rowBeds[0]?.label?.[0]}
              </span>
              {rowBeds
                .sort((a, b) => a.col - b.col)
                .map(bed => (
                  <button
                    key={bed.id}
                    onClick={() => toggleBed(bed.id, bed.is_active)}
                    title={bed.is_active ? 'Click to disable' : 'Click to enable'}
                    className={`w-12 h-12 rounded-lg border-2 text-xs font-bold transition-all ${
                      bed.is_active
                        ? 'bg-green-50 border-green-300 text-green-800 hover:border-red-300 hover:bg-red-50 hover:text-red-700'
                        : 'bg-slate-100 border-slate-200 text-slate-400 hover:border-green-300 hover:bg-green-50 hover:text-green-700'
                    }`}
                  >
                    {bed.label}
                  </button>
                ))}
            </div>
          ))}

        <div className="w-full h-6 bg-amber-50 rounded flex items-center justify-center">
          <span className="text-xs text-amber-600 font-semibold tracking-widest uppercase">Bar</span>
        </div>
      </div>

      <p className="text-xs text-slate-400">Click a bed to enable/disable it.</p>

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
