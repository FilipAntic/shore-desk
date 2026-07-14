'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const ROLE_DEFAULT_ROUTE: Record<UserRole, string> = {
  owner:   'manager',
  manager: 'manager',
  seller:  'seller',
  waiter:  'waiter',
  kitchen: 'kitchen',
  bar:     'bar',
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, beach_id, beach:beaches(slug)')
      .single()

    const role = (profile?.role ?? 'waiter') as UserRole
    let beachSlug = (profile?.beach as unknown as { slug: string } | null)?.slug ?? null

    // Owner has no fixed beach — land on the first active one; they can
    // switch beaches from the sidebar and manage beaches from Admin > Beaches.
    if (!beachSlug) {
      const { data: firstBeach } = await supabase
        .from('beaches')
        .select('slug')
        .eq('is_active', true)
        .order('name')
        .limit(1)
        .single()
      beachSlug = firstBeach?.slug ?? null
    }

    if (!beachSlug) {
      setError('No beaches are set up yet. Contact your administrator.')
      setLoading(false)
      return
    }

    router.push(`/${beachSlug}/${ROLE_DEFAULT_ROUTE[role]}`)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sky-50 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🏖️</div>
          <CardTitle className="text-2xl">Shore Desk</CardTitle>
          <CardDescription>Sign in to your staff account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@shorebar.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}