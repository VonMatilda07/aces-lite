import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'timeout' | 'corrupted'

interface AuthState {
    user: any | null
    role: string | null
    status: AuthStatus
    isLoading: boolean
    initializeAuth: () => void
    logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => {
    const fetchAndSetProfile = (session: any) => {
        const currentUser = get().user
        const currentRole = get().role
        // Jika user id dan role sudah terisi dan cocok, tidak perlu query ulang
        if (currentUser?.id === session.user.id && currentRole !== null) {
            console.log('=== [DEBUG] Sesi sudah aktif dengan profil terverifikasi, skip DB query ===')
            set({ user: session.user, status: 'authenticated', isLoading: false })
            return
        }

        // Jalankan di luar callstack saat ini (setTimeout 0) untuk menghindari deadlock Web Lock API
        setTimeout(async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single()
                console.log('=== [DEBUG] useAuthStore: profile role query ===', { data, error })
                if (error || !data) {
                    set({ user: session.user, role: null, status: 'corrupted', isLoading: false })
                } else {
                    // Map database role to UI role
                    const dbRole = data.role
                    const mappedRole = dbRole === 'admin' ? 'supervisor' : (dbRole === 'barista' ? 'captain' : dbRole)
                    set({ user: session.user, role: mappedRole, status: 'authenticated', isLoading: false })
                }
            } catch (e) {
                console.error('=== [DEBUG] Profile query crash ===', e)
                set({ user: session.user, role: null, status: 'corrupted', isLoading: false })
            }
        }, 0)
    }

    return {
        user: null,
        role: null,
        status: 'idle',
        isLoading: true,
        initializeAuth: () => {
            console.log('=== [DEBUG] useAuthStore: initializeAuth dipanggil ===')
            if (typeof document !== 'undefined') {
                console.log('=== [DEBUG] useAuthStore: document.cookie ===', document.cookie)
            }
            if (typeof window !== 'undefined') {
                const keys = Object.keys(localStorage).filter(k => k.includes('auth-token'))
                console.log('=== [DEBUG] useAuthStore: localStorage auth keys ===', keys)
                keys.forEach(k => console.log(`=== [DEBUG] localStorage key [${k}] ===`, localStorage.getItem(k)))
            }

            set({ status: 'loading', isLoading: true })

            // Timer pengaman 6 detik untuk mencegah getSession menggantung selamanya
            const timeoutPromise = new Promise<any>((_, reject) =>
                setTimeout(() => reject(new Error('Supabase Auth getSession Timeout')), 6000)
            )

            Promise.race([
                supabase.auth.getSession(),
                timeoutPromise
            ])
            .then(({ data: { session } }) => {
                console.log('=== [DEBUG] useAuthStore: getSession hasil ===', session ? { email: session.user.email, id: session.user.id } : 'Tidak ada sesi')
                if (session) {
                    fetchAndSetProfile(session)
                } else {
                    set({ user: null, role: null, status: 'unauthenticated', isLoading: false })
                }
            })
            .catch(async (err) => {
                console.warn('=== [DEBUG] getSession Timeout/Error. Melakukan pembersihan lokal... ===', err)
                const isTimeout = err.message === 'Supabase Auth getSession Timeout'
                set({ user: null, role: null, status: isTimeout ? 'timeout' : 'corrupted', isLoading: false })
                
                if (typeof window !== 'undefined') {
                    // Bersihkan localStorage & sessionStorage
                    localStorage.clear()
                    sessionStorage.clear()
                    
                    // Bersihkan kuki secara paksa dari sisi client
                    document.cookie.split(";").forEach((c) => {
                        document.cookie = c
                            .replace(/^ +/, "")
                            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
                    })
                    
                    console.log('=== [DEBUG] Pembersihan lokal selesai setelah getSession timeout/error. Tidak memicu reload otomatis untuk mencegah loop. ===')
                }
            })

            // Dengarkan perubahan login/logout secara real-time
            supabase.auth.onAuthStateChange((event, session) => {
                console.log('=== [DEBUG] useAuthStore: onAuthStateChange event ===', event, session ? { email: session.user.email, id: session.user.id } : 'Tidak ada sesi')
                if (session) {
                    fetchAndSetProfile(session)
                } else {
                    set({ user: null, role: null, status: 'unauthenticated', isLoading: false })
                }
            })
        },
        logout: async () => {
            console.log('=== [DEBUG] useAuthStore: logout dipanggil ===')
            try {
                // Coba kirim request logout ke server Supabase
                await supabase.auth.signOut()
                console.log('=== [DEBUG] useAuthStore: signOut API sukses ===')
            } catch (error) {
                // Abaikan error jika token ditolak/expired oleh server
                console.warn('=== [DEBUG] useAuthStore: signOut API gagal ===', error)
            } finally {
                // APAPUN yang terjadi (API sukses atau gagal),
                // PASTIKAN sesi lokal di browser dibersihkan secara paksa
                set({ user: null, role: null, status: 'unauthenticated', isLoading: false })
            }
        }
    }
})