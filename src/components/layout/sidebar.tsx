'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface NavItem {
  label: string
  href: string
  icon: string
  roles: UserRole[]
  badgeKey?: 'food' | 'drink' | 'ready'
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Beach Map', href: 'seller',  icon: '🗺️', roles: ['owner', 'manager', 'seller', 'waiter'] },
  { label: 'Orders',    href: 'waiter',  icon: '🛎️', roles: ['owner', 'manager', 'waiter'],   badgeKey: 'ready' },
  { label: 'Kitchen',   href: 'kitchen', icon: '🍳', roles: ['owner', 'manager', 'kitchen'],  badgeKey: 'food' },
  { label: 'Bar',       href: 'bar',     icon: '🍹', roles: ['owner', 'manager', 'bar'],      badgeKey: 'drink' },
  { label: 'Dashboard', href: 'manager', icon: '📊', roles: ['owner', 'manager'] },
  { label: 'Reports',   href: 'reports', icon: '📋', roles: ['owner', 'manager'] },
  { label: 'Admin',     href: 'admin',   icon: '⚙️', roles: ['owner', 'manager'] },
]

interface OrderBadges {
  food: number
  drink: number
  ready: number
}

function useOrderBadges(role: UserRole, beachId: string): OrderBadges {
  const [badges, setBadges] = useState<OrderBadges>({ food: 0, drink: 0, ready: 0 })

  const fetchBadges = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select('id, status, items:order_items(menu_item:menu_items(type))')
      .eq('beach_id', beachId)
      .in('status', ['pending', 'preparing', 'ready', 'delivering'])

    if (!data) return

    let food = 0, drink = 0, ready = 0
    for (const order of data) {
      const items = (order.items as unknown as { menu_item: { type: string } }[]) ?? []
      const hasFood  = items.some(i => i.menu_item?.type === 'food')
      const hasDrink = items.some(i => i.menu_item?.type === 'drink')
      if (order.status === 'pending' || order.status === 'preparing') {
        if (hasFood)  food++
        if (hasDrink) drink++
      }
      if (order.status === 'ready' || order.status === 'delivering') {
        ready++
      }
    }
    setBadges({ food, drink, ready })
  }, [beachId])

  useEffect(() => {
    fetchBadges()
    const supabase = createClient()
    const channel = supabase
      .channel(`sidebar-badges-${beachId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `beach_id=eq.${beachId}` }, fetchBadges)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchBadges, beachId])

  return badges
}

interface SidebarProps {
  role: UserRole
  fullName: string
  beachSlug: string
  beachId: string
  beaches?: { slug: string; name: string }[]
}

export function Sidebar({ role, fullName, beachSlug, beachId, beaches = [] }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const badges = useOrderBadges(role, beachId)
  const [moreOpen, setMoreOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function switchBeach(newSlug: string | null) {
    if (!newSlug) return
    const currentSegment = pathname.split('/')[2] ?? 'manager'
    router.push(`/${newSlug}/${currentSegment}`)
  }

  const visibleItems = NAV_ITEMS
    .filter(item => item.roles.includes(role))
    .map(item => ({ ...item, href: `/${beachSlug}/${item.href}` }))
  const MOBILE_MAX = 4
  const primaryItems = visibleItems.slice(0, MOBILE_MAX)
  const moreItems = visibleItems.slice(MOBILE_MAX)
  const hasMore = moreItems.length > 0
  const showBeachSwitcher = role === 'owner' && beaches.length > 1

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen bg-white border-r border-slate-200 py-4 px-3 gap-1">
        <div className="flex items-center gap-2 px-2 pb-4 border-b border-slate-100 mb-2">
          <span className="text-2xl">🏖️</span>
          <span className="font-bold text-slate-800 text-lg">Shore Desk</span>
        </div>

        {showBeachSwitcher && (
          <div className="px-2 pb-3">
            <Select value={beachSlug} onValueChange={switchBeach}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {beaches.map(b => (
                  <SelectItem key={b.slug} value={b.slug} className="text-xs">
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <nav className="flex-1 space-y-0.5">
          {visibleItems.map(item => {
            const count = item.badgeKey ? badges[item.badgeKey] : 0
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  pathname.startsWith(item.href)
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <span>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {count > 0 && (
                  <span className="ml-auto min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-slate-100 pt-3 mt-2">
          <div className="flex items-center gap-2 px-2 mb-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs bg-sky-100 text-sky-700">
                {fullName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-800 truncate">{fullName}</p>
              <p className="text-xs text-slate-400 capitalize">{role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-500 hover:text-red-600 text-xs"
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </div>
      </aside>

      {/* ── Mobile bottom navigation bar ───────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 h-16 bg-white border-t border-slate-200 flex items-stretch">
        {primaryItems.map(item => {
          const count = item.badgeKey ? badges[item.badgeKey] : 0
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors',
                isActive ? 'text-sky-700' : 'text-slate-500'
              )}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
              {count > 0 && (
                <span className="absolute top-1.5 left-1/2 translate-x-2 min-w-[1rem] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          )
        })}

        {hasMore ? (
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-slate-500"
          >
            <span className="text-xl leading-none">☰</span>
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        ) : (
          <button
            onClick={handleSignOut}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-slate-500"
          >
            <span className="text-xl leading-none">👤</span>
            <span className="text-[10px] font-medium leading-none">Sign out</span>
          </button>
        )}
      </nav>

      {/* ── Mobile "More" overlay ───────────────────────────────── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col-reverse">
          <div className="bg-white rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-sky-100 text-sky-700">
                    {fullName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-slate-800">{fullName}</p>
                  <p className="text-xs text-slate-400 capitalize">{role}</p>
                </div>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {showBeachSwitcher && (
              <div className="px-4 pt-3">
                <Select value={beachSlug} onValueChange={v => { switchBeach(v); setMoreOpen(false) }}>
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {beaches.map(b => (
                      <SelectItem key={b.slug} value={b.slug}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <nav className="p-3 space-y-0.5">
              {moreItems.map(item => {
                const count = item.badgeKey ? badges[item.badgeKey] : 0
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors',
                      pathname.startsWith(item.href)
                        ? 'bg-sky-50 text-sky-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {count > 0 && (
                      <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </Link>
                )
              })}

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <span className="text-lg">🚪</span>
                <span>Sign out</span>
              </button>
            </nav>

            <div className="h-16" />
          </div>

          <div
            className="flex-1 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
        </div>
      )}
    </>
  )
}