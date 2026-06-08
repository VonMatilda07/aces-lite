import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Ignore
                    }
                },
            },
        }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || (profile.role !== 'supervisor' && profile.role !== 'superadmin' && profile.role !== 'admin')) {
        return NextResponse.json({ error: 'Forbidden. Hanya Supervisor/Superadmin yang diizinkan.' }, { status: 403 })
    }

    const { data: logs, error: logsError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })

    if (logsError) {
        console.error('Error fetching logs from Supabase:', logsError)
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
    }

    return NextResponse.json(logs)
}

export async function POST(request: Request) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Ignore
                    }
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    const author = user ? user.email : 'Pelanggan (Customer)'

    const { description } = await request.json()
    if (!description) {
        return NextResponse.json({ error: 'Missing description' }, { status: 400 })
    }

    const { data: newLog, error: insertError } = await supabase
        .from('audit_logs')
        .insert({
            changed_by: author,
            description: description
        })
        .select()
        .single()

    if (insertError) {
        console.error('Error inserting log into Supabase:', insertError)
        return NextResponse.json({ error: 'Failed to save log' }, { status: 500 })
    }

    return NextResponse.json({ success: true, log: newLog })
}
