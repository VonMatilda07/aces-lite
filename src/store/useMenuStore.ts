// src/store/useMenuStore.ts
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

// Tipe data untuk Menu, CartItem, dan State Store
export type MenuStatus = 'available' | 'low_stock' | 'sold_out'
export type NutriGrade = 'A' | 'B' | 'C' | 'D' | 'E'

export interface Menu {
    id: string
    name: string
    category: string
    price: number
    status: MenuStatus
    nutri_grade: NutriGrade
    stock?: number | null
}

export interface CartItem {
    menu: Menu
    qty: number
    notes: string
}

interface MenuStore {
    menus: Menu[]
    isLoading: boolean
    fetchMenus: () => Promise<void>
    updateMenuStatus: (id: string, newStatus: MenuStatus, stock?: number | null) => Promise<void>
    subscribeToRealtime: () => () => void

    cart: CartItem[]
    tableIdentifier: string
    setTableIdentifier: (table: string) => void
    addToCart: (menu: Menu) => void
    removeFromCart: (menuId: string) => void
    updateCartItemNotes: (menuId: string, notes: string) => void
    clearCart: () => void
    finalizeOrder: () => Promise<void>
}

// Implementasi Zustand Store untuk ACES Lite
export const useMenuStore = create<MenuStore>((set, get) => ({
    menus: [],
    isLoading: true,
    cart: [],
    tableIdentifier: '',

    setTableIdentifier: (table) => set({ tableIdentifier: table }),

    // Fetch semua menu dari database Supabase
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

    // 1-Tap Stock Engine: Update status menu secara optimistic (instan) dengan rollback jika gagal
    updateMenuStatus: async (id, newStatus, stock = null) => {
        const previousMenus = get().menus

        let targetStatus = newStatus
        let targetStock = stock

        if (targetStatus === 'low_stock') {
            if (targetStock === undefined || targetStock === null) {
                targetStock = 3
            } else if (targetStock <= 0) {
                targetStatus = 'sold_out'
                targetStock = 0
            }
        } else if (targetStatus === 'sold_out') {
            targetStock = 0
        } else {
            targetStock = null
        }

        set((state) => ({
            menus: state.menus.map((m) => m.id === id ? { ...m, status: targetStatus, stock: targetStock } : m)
        }))

        const { error } = await supabase
            .from('menus')
            .update({ status: targetStatus, stock: targetStock })
            .eq('id', id)

        if (error) {
            console.error('Rollback triggered:', error)
            set({ menus: previousMenus })
        }
    },

    // Mendengarkan perubahan data menu secara realtime dari Supabase
    subscribeToRealtime: () => {
        const channel = supabase
            .channel('public:menus')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'menus' },
                (payload) => {
                    const updatedMenu = payload.new as Menu
                    set((state) => ({
                        menus: state.menus.map((m) => m.id === updatedMenu.id ? { ...m, status: updatedMenu.status, stock: updatedMenu.stock } : m)
                    }))
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    },

    // Manajemen item keranjang belanja (cart)
    addToCart: (menu) => {
        const currentCart = get().cart
        const existingIndex = currentCart.findIndex((item) => item.menu.id === menu.id)

        if (existingIndex > -1) {
            const updatedCart = [...currentCart]
            updatedCart[existingIndex].qty += 1
            set({ cart: updatedCart })
        } else {
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

    clearCart: () => set({ cart: [], tableIdentifier: '' }),

    // Finalisasi pesanan: Kurangi stok menu secara optimistic di lokal dan sync ke Supabase
    finalizeOrder: async () => {
        const { cart, menus } = get()
        const previousMenus = menus

        // 1. Hitung stok baru di lokal secara optimistic
        const updatedMenus = menus.map((menu) => {
            const cartItem = cart.find((item) => item.menu.id === menu.id)
            if (cartItem && menu.stock !== null && menu.stock !== undefined) {
                const newStock = Math.max(0, menu.stock - cartItem.qty)
                return {
                    ...menu,
                    stock: newStock,
                    status: newStock === 0 ? 'sold_out' as const : menu.status
                }
            }
            return menu
        })

        set({ menus: updatedMenus, cart: [], tableIdentifier: '' })

        // 2. Kirim update stok ke Supabase untuk setiap item yang berkurang
        for (const item of cart) {
            const currentMenu = menus.find((m) => m.id === item.menu.id)
            if (currentMenu && currentMenu.stock !== null && currentMenu.stock !== undefined) {
                const newStock = Math.max(0, currentMenu.stock - item.qty)
                const newStatus = newStock === 0 ? 'sold_out' : currentMenu.status

                const { error } = await supabase
                    .from('menus')
                    .update({ stock: newStock, status: newStatus })
                    .eq('id', item.menu.id)

                if (error) {
                    console.error(`Gagal mengurangi stok untuk ${item.menu.name}:`, error)
                    set({ menus: previousMenus })
                    break
                }
            }
        }
    }
}))