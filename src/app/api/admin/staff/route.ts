import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, beach_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['owner', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { email, password, fullName, role, beachId } = await request.json()

    if (!email || !password || !fullName || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // A manager can only ever create staff at their own beach — ignore
    // whatever beachId the client sent and force it server-side. Owner
    // accounts get no beach at all (null = sees every beach).
    const targetBeachId: string | null =
      role === 'owner' ? null : (profile.role === 'manager' ? profile.beach_id : (beachId ?? null))

    if (role !== 'owner' && !targetBeachId) {
      return NextResponse.json({ error: 'A beach is required for this role' }, { status: 400 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server misconfiguration: service role key not set' }, { status: 500 })
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    await admin
      .from('profiles')
      .update({ role, full_name: fullName, beach_id: targetBeachId })
      .eq('id', newUser.user.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
