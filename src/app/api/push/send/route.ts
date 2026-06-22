import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

// Konfigurasi VAPID untuk Web Push
webpush.setVapidDetails(
    'mailto:putrahendra699@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Gunakan client supabasePublic stateless agar cepat dan tidak tergantung cookie session
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
})

export async function POST(request: Request) {
    try {
        const { station, ticketId, tableIdentifier, itemSummary } = await request.json()
        if (!station || !ticketId) {
            return NextResponse.json({ error: 'Missing station or ticketId' }, { status: 400 })
        }

        console.log(`=== [DEBUG] Menembak push notification stasiun: ${station}, Meja: ${tableIdentifier} ===`)

        // 1. Tentukan role staf penerima berdasarkan stasiun saji
        let targetRoles: string[] = []
        if (station === 'bar') {
            targetRoles = ['barista', 'head_barista']
        } else if (station === 'kitchen') {
            targetRoles = ['cook', 'head_kitchen', 'kitchen']
        } else {
            return NextResponse.json({ error: 'Invalid station' }, { status: 400 })
        }

        // 2. Cari semua user_id staf yang memiliki peran target tersebut di profiles
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .in('role', targetRoles)

        if (profileError || !profiles || profiles.length === 0) {
            console.log(`=== [DEBUG] Tidak ada staf dengan peran ${targetRoles.join(', ')} untuk dikirimkan push ===`)
            return NextResponse.json({ success: true, message: 'No target staff found' })
        }

        const userIds = profiles.map(p => p.id)

        // 3. Ambil seluruh subscription token HP staf tersebut dari push_subscriptions
        const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('subscription')
            .in('user_id', userIds)

        if (subError || !subscriptions || subscriptions.length === 0) {
            console.log(`=== [DEBUG] Tidak ada token push yang aktif untuk peran target ===`)
            return NextResponse.json({ success: true, message: 'No active push subscriptions' })
        }

        // 4. Siapkan Payload Notifikasi
        const payload = JSON.stringify({
            title: `Order Baru di ${station === 'bar' ? 'Barista' : 'Kitchen'}!`,
            body: `Meja: ${tableIdentifier || 'Tanpa Meja'}\nDetail: ${itemSummary || 'Ada pesanan masuk.'}`,
            icon: '/icon.png',
            badge: '/icon.png',
            vibrate: [300, 100, 300],
            data: {
                url: station === 'bar' ? '/barista' : '/kitchen'
            },
            tag: `new-order-${station}-${ticketId}`
        })

        // 5. Kirim notifikasi ke setiap perangkat secara paralel
        const pushPromises = subscriptions.map(sub => {
            const pushSubscription = sub.subscription as any
            return webpush.sendNotification(pushSubscription, payload)
                .catch(err => {
                    // Jika token kadaluarsa atau tidak valid (staf meng-uninstall atau membersihkan browser),
                    // hapus token tersebut dari database agar tidak membebani server
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        console.log(`=== [DEBUG] Push token expired (410/404), menghapus token dari database... ===`)
                        return supabase
                            .from('push_subscriptions')
                            .delete()
                            .eq('subscription->>endpoint', pushSubscription.endpoint)
                    }
                    console.error('Error sending push notification to endpoint:', err.endpoint || '', err)
                    return null
                })
        })

        await Promise.all(pushPromises)

        return NextResponse.json({ success: true, sentCount: subscriptions.length })
    } catch (err: any) {
        console.error('Push send crash:', err)
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
    }
}
