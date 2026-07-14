'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Beach } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface BeachManagerProps {
  beaches: Beach[]
}

export function BeachManager({ beaches }: BeachManagerProps) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [renaming, setRenaming] = useState<Beach | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/beaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug: slugify(name) }),
      })

      const json = await res.json()
      if (!res.ok) { setError(json.error); return }

      setAddOpen(false)
      setName('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create beach')
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const supabase = createClient()
    await supabase.from('beaches').update({ is_active: !current }).eq('id', id)
    router.refresh()
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!renaming) return
    setRenameLoading(true)
    setRenameError(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('beaches')
      .update({ name: renameValue })
      .eq('id', renaming.id)

    if (error) {
      setRenameError(error.message)
      setRenameLoading(false)
      return
    }

    setRenaming(null)
    setRenameLoading(false)
    router.refresh()
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{beaches.length} beaches</p>
        <Button size="sm" onClick={() => setAddOpen(true)}>+ Add beach</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {beaches.map(beach => (
          <div key={beach.id} className="flex items-center gap-4 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{beach.name}</p>
              <p className="text-xs text-slate-400 truncate">/{beach.slug}</p>
            </div>
            <button
              onClick={() => { setRenaming(beach); setRenameValue(beach.name); setRenameError(null) }}
              className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
            >
              Rename
            </button>
            <Link
              href={`/${beach.slug}/manager`}
              className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
            >
              Open
            </Link>
            <button
              onClick={() => toggleActive(beach.id, beach.is_active)}
              className={`text-xs px-2 py-1 rounded-full border font-medium transition-colors ${
                beach.is_active
                  ? 'border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-500'
                  : 'border-green-200 text-green-600 hover:bg-green-50'
              }`}
            >
              {beach.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}

        {beaches.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-8">No beaches yet</p>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a beach</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required />
              <p className="text-xs text-slate-400">
                URL: shorebar.app/{slugify(name) || '...'}/manager
              </p>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create beach'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={renaming !== null} onOpenChange={v => !v && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename beach</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} required />
              <p className="text-xs text-slate-400">
                URL stays /{renaming?.slug} — renaming only changes the display name.
              </p>
            </div>
            {renameError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{renameError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
              <Button type="submit" disabled={renameLoading}>{renameLoading ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
