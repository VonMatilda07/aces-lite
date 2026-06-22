import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
    try {
        const { subscription } = await request.json()
        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ error: 'Missing subscription details' }, { status: 400 })
        }

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
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Hapus subscription lama yang memiliki endpoint yang sama (jika ada) untuk menghindari duplikasi
        await supabase
            .from('push_subscriptions')
            .delete()
            .eq('subscription->>endpoint', subscription.endpoint)

        // Simpan subscription baru ke database
        const { data: newSub, error: insertError } = await supabase
            .from('push_subscriptions')
            .insert({
                user_id: user.id,
                subscription: subscription
            })
            .select()
            .single()

        if (insertError) {
            console.error('Error inserting push subscription:', insertError)
            return NextResponse.json({ error: 'Failed to save push subscription' }, { status: 500 })
        }

        return NextResponse.json({ success: true, data: newSub })
    } catch (err: any) {
        console.error('Push registration crash:', err)
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
    }
}
