'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { MenuItem, OrderItemType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

interface MenuManagerProps {
  menuItems: MenuItem[]
}

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  category: '',
  type: 'food' as OrderItemType,
  is_available: true,
  image_url: '' as string | null,
}

export function MenuManager({ menuItems }: MenuManagerProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'all' | OrderItemType>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const visibleItems = menuItems
    .filter(i => filterType === 'all' || i.type === filterType)
    .sort((a, b) => a.type.localeCompare(b.type) || a.category.localeCompare(b.category) || a.sort_order - b.sort_order)

  // Group by type then category
  const grouped = visibleItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const key = `${item.type}__${item.category}`
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  function openAdd() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setImagePreview(null)
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(item: MenuItem) {
    setEditItem(item)
    setForm({
      name:         item.name,
      description:  item.description ?? '',
      price:        item.price.toFixed(2),
      category:     item.category,
      type:         item.type,
      is_available: item.is_available,
      image_url:    item.image_url ?? null,
    })
    setImageFile(null)
    setImagePreview(item.image_url ?? null)
    setError(null)
    setDialogOpen(true)
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function uploadImage(file: File): Promise<string> {
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Resize/compress in-browser before upload
    const compressed = await compressImage(file, 800, 0.8)

    const { error } = await supabase.storage
      .from('menu-images')
      .upload(path, compressed, { contentType: compressed.type, upsert: false })

    if (error) throw new Error(error.message)

    const { data: { publicUrl } } = supabase.storage
      .from('menu-images')
      .getPublicUrl(path)

    return publicUrl
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    let image_url = form.image_url ?? null

    if (imageFile) {
      try {
        setUploadProgress(true)
        image_url = await uploadImage(imageFile)
        setUploadProgress(false)
      } catch (err) {
        setError('Image upload failed. Please try again.')
        setLoading(false)
        setUploadProgress(false)
        return
      }
    }

    const supabase = createClient()
    const payload = {
      name:         form.name.trim(),
      description:  form.description.trim() || null,
      price:        parseFloat(form.price),
      category:     form.category.trim(),
      type:         form.type,
      is_available: form.is_available,
      image_url,
    }

    if (editItem) {
      const { error: err } = await supabase.from('menu_items').update(payload).eq('id', editItem.id)
      if (err) { setError(err.message); setLoading(false); return }
    } else {
      const { error: err } = await supabase.from('menu_items').insert(payload)
      if (err) { setError(err.message); setLoading(false); return }
    }

    setLoading(false)
    setDialogOpen(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('menu_items').delete().eq('id', id)
    setDeleteId(null)
    router.refresh()
  }

  async function toggleAvailable(item: MenuItem) {
    const supabase = createClient()
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
    router.refresh()
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'food', 'drink'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-colors ${
                filterType === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {f === 'all' ? 'All' : f === 'food' ? '🍔 Food' : '🍹 Drinks'}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={openAdd}>+ Add item</Button>
      </div>

      {/* Grouped list */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([key, items]) => {
          const [type, category] = key.split('__')
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{category}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                  type === 'food' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {type}
                </span>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-100" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 flex-shrink-0 text-lg">
                        {item.type === 'food' ? '🍽️' : '🥤'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${!item.is_available ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                          {item.name}
                        </p>
                        {!item.is_available && (
                          <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                            unavailable
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-slate-400 truncate">{item.description}</p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-slate-700 w-14 text-right">
                      €{item.price.toFixed(2)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleAvailable(item)}
                        className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${
                          item.is_available
                            ? 'border-slate-200 text-slate-500 hover:border-amber-200 hover:text-amber-600'
                            : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {item.is_available ? 'Hide' : 'Show'}
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-500 hover:border-sky-200 hover:text-sky-600 font-medium transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteId(item.id)}
                        className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-500 font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {Object.keys(grouped).length === 0 && (
          <p className="text-slate-400 text-sm text-center py-8">No menu items yet. Click "+ Add item" to start.</p>
        )}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit item' : 'Add menu item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Cheeseburger"
                  required
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label>Description <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short description shown to customers"
                />
              </div>

              <div className="space-y-1">
                <Label>Price (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as OrderItemType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="food">🍔 Food</SelectItem>
                    <SelectItem value="drink">🍹 Drink</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1">
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Burgers, Cocktails, Salads"
                  required
                />
              </div>

              {/* Image upload */}
              <div className="col-span-2 space-y-2">
                <Label>Image <span className="text-slate-400 font-normal">(optional)</span></Label>
                <div
                  className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center gap-3 cursor-pointer hover:border-slate-400 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <div className="relative w-full">
                      <img src={imagePreview} alt="preview"
                        className="w-full h-36 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(null); setForm(f => ({ ...f, image_url: null })) }}
                        className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-black/70"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-3xl">🖼️</span>
                      <p className="text-sm text-slate-500 text-center">
                        Click to upload image<br />
                        <span className="text-xs text-slate-400">JPG, PNG, WEBP — auto-compressed before upload</span>
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImagePick}
                />
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <input
                  id="available"
                  type="checkbox"
                  checked={form.is_available}
                  onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="available" className="font-normal cursor-pointer">
                  Available for ordering
                </Label>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {uploadProgress ? 'Uploading image...' : loading ? 'Saving...' : editItem ? 'Save changes' : 'Add item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete menu item?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">
            This will permanently remove the item from the menu. Past orders won't be affected.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Compress image in-browser before upload ───────────────────
async function compressImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/webp',
        quality
      )
    }
    img.onerror = reject
    img.src = url
  })
}
