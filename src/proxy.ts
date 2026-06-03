import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@/types'

// Routes each role is allowed to access (prefix match)
const ROLE_ROUTES: Record<UserRole, string[]> = {
  owner:   ['/admin', '/reports', '/manager', '/seller', '/waiter', '/kitchen', '/bar'],
  manager: ['/reports', '/manager', '/seller', '/waiter', '/kitchen', '/bar'],
  seller:  ['/seller'],
  waiter:  ['/waiter'],
  kitchen: ['/kitchen'],
  bar:     ['/bar'],
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Public routes and API routes — always allowed (API routes handle their own auth)
  if (pathname.startsWith('/order') || pathname.startsWith('/login') || pathname === '/' || pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  // Not logged in → redirect to login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Fetch role from profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const role = profile.role as UserRole
  const allowed = ROLE_ROUTES[role] ?? []
  const hasAccess = allowed.some(route => pathname.startsWith(route))

  if (!hasAccess) {
    // Redirect to their default route
    const defaultRoute = ROLE_ROUTES[role]?.[0] ?? '/login'
    return NextResponse.redirect(new URL(defaultRoute, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}