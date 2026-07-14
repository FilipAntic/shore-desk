'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, UserRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'owner',   label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'seller',  label: 'Sun Bed Seller' },
  { value: 'waiter',  label: 'Waiter' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'bar',     label: 'Bar' },
]

const ROLE_BADGE: Record<UserRole, string> = {
  owner:   'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  seller:  'bg-amber-100 text-amber-700',
  waiter:  'bg-green-100 text-green-700',
  kitchen: 'bg-orange-100 text-orange-700',
  bar:     'bg-pink-100 text-pink-700',
}

interface StaffManagerProps {
  staff: Profile[]
  currentRole: string
  beachId: string
}

export function StaffManager({ staff, currentRole, beachId }: StaffManagerProps) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('waiter')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, role, beachId }),
      })

      const json = await res.json()
      if (!res.ok) { setError(json.error); return }

      setAddOpen(false)
      setEmail(''); setFullName(''); setPassword(''); setRole('waiter')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const supabase = createClient()
    await supabase.from('profiles').update({ is_active: !current }).eq('id', id)
    router.refresh()
  }

  async function changeRole(id: string, newRole: UserRole) {
    const supabase = createClient()
    await supabase.from('profiles').update({ role: newRole }).eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{staff.length} staff members</p>
        <Button size="sm" onClick={() => setAddOpen(true)}>+ Add staff</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {staff.map(member => (
          <div key={member.id} className="flex items-center gap-4 px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
              {member.full_name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{member.full_name}</p>
              <p className="text-xs text-slate-400 truncate">{member.email}</p>
            </div>
            <Select
              value={member.role}
              onValueChange={v => changeRole(member.id, v as UserRole)}
              disabled={currentRole !== 'owner' && member.role === 'owner'}
            >
              <SelectTrigger className="w-36 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(r => (
                  <SelectItem key={r.value} value={r.value} className="text-xs">
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[member.role as UserRole]}`}>
              {member.role}
            </span>
            <button
              onClick={() => toggleActive(member.id, member.is_active)}
              className={`text-xs px-2 py-1 rounded-full border font-medium transition-colors ${
                member.is_active
                  ? 'border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-500'
                  : 'border-green-200 text-green-600 hover:bg-green-50'
              }`}
            >
              {member.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={role} onValueChange={v => setRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create account'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
