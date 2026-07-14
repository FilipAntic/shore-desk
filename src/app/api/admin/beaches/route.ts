import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_CONFIG: Record<string, string> = {
  price_full_day:        '20.00',
  closing_time:          '18:00',
  currency:              'EUR',
  order_timeout_minutes: '30',
  late_arrival_price:    '10.00',
  late_arrival_time:     '17:00',
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { name, slug } = await request.json()

    if (!name || !slug) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({ error: 'Slug must be lowercase letters, numbers, and hyphens only' }, { status: 400 })
    }

    const { data: beach, error: beachError } = await supabase
      .from('beaches')
      .insert({ name, slug })
      .select('id, slug, name, is_active')
      .single()

    if (beachError || !beach) {
      return NextResponse.json({ error: beachError?.message ?? 'Failed to create beach' }, { status: 400 })
    }

    const { error: configError } = await supabase.from('config').insert(
      Object.entries(DEFAULT_CONFIG).map(([key, value]) => ({ beach_id: beach.id, key, value }))
    )

    if (configError) {
      return NextResponse.json({ error: configError.message }, { status: 400 })
    }

    return NextResponse.json({ beach })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
