// src/store/useMenuStore.ts
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

// --- 1. DEFINISI TIPE DATA ---
export type MenuStatus = 'available' | 'low_stock' | 'sold_out'
export type NutriGrade = 'A' | 'B' | 'C' | 'D' | 'E'

export interface Menu {
    id: string
    name: string
    category: string
    price: number
    status: MenuStatus
    nutri_grade: NutriGrade
}

export interface CartItem {
    menu: Menu
    qty: number
    notes: string
}

interface MenuStore {
    // Menu States
    menus: Menu[]
    isLoading: boolean
    fetchMenus: () => Promise<void>
    updateMenuStatus: (id: string, newStatus: MenuStatus) => Promise<void>
    subscribeToRealtime: () => () => void

    // Smart Order Note (Cart) States
    cart: CartItem[]
    tableIdentifier: string
    setTableIdentifier: (table: string) => void
    addToCart: (menu: Menu) => void
    removeFromCart: (menuId: string) => void
    updateCartItemNotes: (menuId: string, notes: string) => void
    clearCart: () => void
}

// --- 2. ZUSTAND STORE IMPLEMENTATION ---
export const useMenuStore = create<MenuStore>((set, get) => ({
    menus: [],
    isLoading: true,
    cart: [],
    tableIdentifier: '',

    setTableIdentifier: (table) => set({ tableIdentifier: table }),

    // A. Fetch Semua Menu Saat Aplikasi Pertama Dimuat
    fetchMenus: async () => {
        set({ isLoading: true })
        const { data, error } = await supabase
            .from('menus')
            .select('*')
            .order('category', { ascending: true })

        if (!error && data) {
            set({ menus: data as Menu[], isLoading: false })
        } else {
            console.error('Fetch Menus Error:', error)
            set({ isLoading: false })
        }
    },

    // B. 1-Tap Stock Engine (Optimistic UI Update)
    updateMenuStatus: async (id, newStatus) => {
        const previousMenus = get().menus

        // Update local state instan tanpa menunggu database (<10ms)
        set((state) => ({
            menus: state.menus.map((m) => m.id === id ? { ...m, status: newStatus } : m)
        }))

        // Kirim mutasi data ke Supabase di background
        const { error } = await supabase
            .from('menus')
            .update({ status: newStatus })
            .eq('id', id)

        // Rollback jika jaringan bermasalah
        if (error) {
            console.error('Rollback triggered:', error)
            set({ menus: previousMenus })
        }
    },

    // C. WebSocket Realtime Listener (Untuk Sinkronisasi Layar Pelanggan)
    subscribeToRealtime: () => {
        const channel = supabase
            .channel('public:menus')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'menus' },
                (payload) => {
                    const updatedMenu = payload.new as Menu
                    set((state) => ({
                        menus: state.menus.map((m) => m.id === updatedMenu.id ? { ...m, status: updatedMenu.status } : m)
                    }))
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    },

    // D. Smart Order Note Logic (Cart Management)
    addToCart: (menu) => {
        const currentCart = get().cart
        const existingIndex = currentCart.findIndex((item) => item.menu.id === menu.id)

        if (existingIndex > -1) {
            // Jika item sudah ada di keranjang, tambahkan quantity
            const updatedCart = [...currentCart]
            updatedCart[existingIndex].qty += 1
            set({ cart: updatedCart })
        } else {
            // Jika item baru, masukkan ke keranjang
            set({ cart: [...currentCart, { menu, qty: 1, notes: '' }] })
        }
    },

    removeFromCart: (menuId) => {
        set((state) => ({
            cart: state.cart.filter((item) => item.menu.id !== menuId)
        }))
    },

    updateCartItemNotes: (menuId, notes) => {
        set((state) => ({
            cart: state.cart.map((item) => item.menu.id === menuId ? { ...item, notes } : item)
        }))
    },

    clearCart: () => set({ cart: [], tableIdentifier: '' })
}))