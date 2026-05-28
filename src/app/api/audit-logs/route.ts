import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import fs from 'fs'
import path from 'path'

const logsFilePath = path.join(process.cwd(), 'src/data/audit_logs.json')

function readLogs() {
    try {
        if (!fs.existsSync(logsFilePath)) {
            return []
        }
        const fileContent = fs.readFileSync(logsFilePath, 'utf-8')
        return JSON.parse(fileContent || '[]')
    } catch (error) {
        console.error('Error reading logs:', error)
        return []
    }
}

function writeLogs(logs: any[]) {
    try {
        fs.writeFileSync(logsFilePath, JSON.stringify(logs, null, 2), 'utf-8')
        return true
    } catch (error) {
        console.error('Error writing logs:', error)
        return false
    }
}

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

    const logs = readLogs()
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

    const logs = readLogs()
    
    // Ambil waktu dan tanggal format lokal WIB/GMT+7 atau lokal ID
    const now = new Date()
    const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const date = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    const newLog = {
        id: crypto.randomUUID(),
        diubah_oleh: author,
        apa_yang_berubah: description,
        waktu: time,
        tanggal: date,
        timestamp: now.getTime()
    }

    logs.unshift(newLog) // Tambah log baru di baris teratas
    writeLogs(logs)

    return NextResponse.json({ success: true, log: newLog })
}
