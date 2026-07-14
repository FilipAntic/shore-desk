import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Beach, UserRole } from '@/types'

export interface SessionProfile {
  id: string
  role: UserRole
  full_name: string
  beach_id: string | null   // null only for role = 'owner'
  beach_slug: string | null // null only for role = 'owner'
}

// Where each role lands post-login / when bounced off a beach they don't belong to.
export const ROLE_HOME: Record<UserRole, string> = {
  owner: 'manager',
  manager: 'manager',
  seller: 'seller',
  waiter: 'waiter',
  kitchen: 'kitchen',
  bar: 'bar',
}

// Auth check + profile fetch, shared by every dashboard page/layout.
export async function getSessionProfile(): Promise<SessionProfile> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, beach_id, beach:beaches(slug)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  return {
    id: profile.id,
    role: profile.role,
    full_name: profile.full_name,
    beach_id: profile.beach_id,
    beach_slug: (profile.beach as unknown as { slug: string } | null)?.slug ?? null,
  }
}

// Resolves a beach by slug (active only). 404s if it doesn't exist.
export async function resolveBeach(slug: string): Promise<Beach> {
  const supabase = await createClient()
  const { data: beach } = await supabase
    .from('beaches')
    .select('id, slug, name, is_active, created_at')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!beach) notFound()
  return beach as Beach
}

// A profile belongs to `beach` if they're the owner (beach_id null, sees every
// beach) or their beach_id matches. Non-members are redirected to their own
// beach's equivalent page rather than shown a blank/403 page.
export function requireBeachMembership(profile: SessionProfile, beach: Beach, routeSegment: string) {
  if (profile.role === 'owner' || profile.beach_id === beach.id) return
  redirect(`/${profile.beach_slug}/${routeSegment}`)
}

// Route-level role gate — every dashboard page calls this once instead of
// duplicating the same `if (!allowed.includes(role)) redirect(...)` check.
export function requireRole(profile: SessionProfile, allowed: UserRole[], beachSlug: string) {
  if (!allowed.includes(profile.role)) {
    redirect(`/${beachSlug}/${ROLE_HOME[profile.role]}`)
  }
}

// Legacy pre-multi-beach URLs (/admin, /manager, ...) redirect here instead
// of 404ing — bounces to the caller's own beach, or the first active beach
// for an owner (who has no single home beach; they can switch from there).
export async function redirectToOwnBeach(routeSegment: string): Promise<never> {
  const profile = await getSessionProfile()
  if (profile.beach_slug) redirect(`/${profile.beach_slug}/${routeSegment}`)

  const supabase = await createClient()
  const { data: firstBeach } = await supabase
    .from('beaches')
    .select('slug')
    .eq('is_active', true)
    .order('name')
    .limit(1)
    .single()

  if (!firstBeach) redirect('/login')
  redirect(`/${firstBeach.slug}/${routeSegment}`)
}
