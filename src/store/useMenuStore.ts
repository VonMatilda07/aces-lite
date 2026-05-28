// src/store/useMenuStore.ts
import { create } from 'zustand'
import { supabase, supabasePublic } from '@/lib/supabase'

export type MenuStatus = 'available' | 'low_stock' | 'sold_out'
export type NutriGrade = 'A' | 'B' | 'C' | 'D' | 'E'

export interface Variant {
    name: string
    stock: number
    status: MenuStatus
}

export interface BundleItem {
    id: string
    variant_name?: string
    qty: number
}

export interface ScheduleItem {
    day: string
    start_time: string
    end_time: string
}

export interface Menu {
    id: string
    name: string
    category: string
    subcategory?: string | null
    price: number
    status: MenuStatus
    nutri_grade: NutriGrade
    stock?: number | null
    is_featured?: boolean
    description?: string
    image_url?: string
    variants?: Variant[]
    menu_type?: 'single' | 'bundle'
    bundle_items?: BundleItem[]
    schedule?: ScheduleItem[]
    alternatives?: string[]
}

export interface CartItem {
    menu: Menu
    selectedVariant?: string
    qty: number
    notes: string
}

interface MenuStore {
    menus: Menu[]
    isLoading: boolean
    fetchMenus: () => Promise<void>
    updateMenuStatus: (id: string, newStatus: MenuStatus, stock?: number | null, variantName?: string) => Promise<void>
    toggleMenuFeatured: (id: string, currentFeatured: boolean) => Promise<void>
    subscribeToRealtime: () => () => void

    cart: CartItem[]
    tableIdentifier: string
    setTableIdentifier: (table: string) => void
    addToCart: (menu: Menu, selectedVariant?: string) => void
    removeFromCart: (menuId: string, selectedVariant?: string) => void
    updateCartItemNotes: (menuId: string, selectedVariant: string | undefined, notes: string) => void
    clearCart: () => void
    finalizeOrder: () => Promise<void>
}

export function computeMenuStocksAndStatuses(menusList: Menu[]): Menu[] {
    // 1. First, compute correct stock and status for single menus with variants
    const processedMenus = menusList.map(menu => {
        if (menu.menu_type !== 'bundle' && menu.variants && menu.variants.length > 0) {
            const totalVarStock = menu.variants.reduce((sum, v) => sum + v.stock, 0)
            const allSoldOut = menu.variants.every(v => v.stock === 0)
            const anyLowStock = menu.variants.some(v => v.stock > 0 && v.stock <= 3)
            const computedStatus: MenuStatus = allSoldOut 
                ? 'sold_out' 
                : (anyLowStock ? 'low_stock' : 'available')
            return {
                ...menu,
                stock: totalVarStock,
                status: computedStatus
            }
        }
        return menu
    })

    // 2. Now compute stock and status for bundle menus
    return processedMenus.map(menu => {
        if (menu.menu_type === 'bundle') {
            const bundleItems = menu.bundle_items || []
            if (bundleItems.length === 0) {
                return { ...menu, stock: 0, status: 'sold_out' as const }
            }

            let minCapacity = Infinity
            for (const item of bundleItems) {
                const comp = processedMenus.find(m => m.id === item.id)
                if (!comp) {
                    minCapacity = 0
                    break
                }

                let compStock = 0
                let isUntracked = false

                if (item.variant_name && comp.variants && comp.variants.length > 0) {
                    const variant = comp.variants.find(v => v.name === item.variant_name)
                    compStock = variant ? variant.stock : 0
                } else {
                    if (comp.stock === null || comp.stock === undefined) {
                        isUntracked = true
                    } else {
                        compStock = comp.stock
                    }
                }

                if (!isUntracked) {
                    const capacity = Math.floor(compStock / item.qty)
                    if (capacity < minCapacity) {
                        minCapacity = capacity
                    }
                }
            }

            const computedStock = minCapacity === Infinity ? null : minCapacity
            const computedStatus: MenuStatus = computedStock === null 
                ? 'available' 
                : (computedStock === 0 ? 'sold_out' : (computedStock <= 3 ? 'low_stock' : 'available'))

            return {
                ...menu,
                stock: computedStock,
                status: computedStatus
            }
        }
        return menu
    })
}

export function isMenuScheduledActive(menu: Menu, allMenus?: Menu[]): boolean {
    // 1. Check if any component in the bundle is scheduled inactive
    if (menu.menu_type === 'bundle' && allMenus) {
        const bundleItems = menu.bundle_items || []
        const hasInactiveComponent = bundleItems.some(item => {
            const comp = allMenus.find(m => m.id === item.id)
            return comp && !isMenuScheduledActive(comp, allMenus)
        })
        if (hasInactiveComponent) {
            return false
        }
    }

    const schedule = menu.schedule
    if (!schedule || schedule.length === 0) {
        return true
    }

    const now = new Date()
    const daysMap: Record<number, string> = {
        0: 'Minggu',
        1: 'Senin',
        2: 'Selasa',
        3: 'Rabu',
        4: 'Kamis',
        5: 'Jumat',
        6: 'Sabtu'
    }
    const currentDay = daysMap[now.getDay()]
    const currentHours = now.getHours().toString().padStart(2, '0')
    const currentMinutes = now.getMinutes().toString().padStart(2, '0')
    const currentTimeStr = `${currentHours}:${currentMinutes}`

    return schedule.some(item => {
        if (item.day !== currentDay) return false
        return currentTimeStr >= item.start_time && currentTimeStr <= item.end_time
    })
}

export function getAlternativeMenus(menu: Menu, allMenus: Menu[]): Menu[] {
    const customIds = menu.alternatives || []
    const customAlts = customIds
        .map(id => allMenus.find(m => m.id === id))
        .filter((m): m is Menu => !!m && m.status !== 'sold_out' && isMenuScheduledActive(m, allMenus))

    if (customAlts.length > 0) {
        return customAlts.slice(0, 3)
    }

    const pool = allMenus.filter(m => 
        m.id !== menu.id && 
        m.status !== 'sold_out' && 
        isMenuScheduledActive(m, allMenus)
    )

    if (menu.subcategory) {
        const subcatPool = pool.filter(m => m.category === menu.category && m.subcategory === menu.subcategory)
        if (subcatPool.length > 0) {
            return subcatPool.slice(0, 3)
        }
    }

    const catPool = pool.filter(m => m.category === menu.category)
    if (catPool.length > 0) {
        return catPool.slice(0, 3)
    }

    return pool.slice(0, 3)
}

export const useMenuStore = create<MenuStore>((set, get) => ({
    menus: [],
    isLoading: true,
    cart: [],
    tableIdentifier: '',

    setTableIdentifier: (table) => set({ tableIdentifier: table }),

    fetchMenus: async () => {
        console.log('=== [DEBUG] fetchMenus dipanggil via supabasePublic ===')
        set({ isLoading: true })

        const { data, error } = await supabasePublic
            .from('menus')
            .select('*')
            .order('category', { ascending: true })
            .order('name', { ascending: true })

        console.log('=== [DEBUG] Hasil fetchMenus ===', { data, error })

        if (!error && data) {
            console.log(`=== [DEBUG] Sukses memuat ${data.length} menu ===`)
            const computed = computeMenuStocksAndStatuses(data as Menu[])
            set({ menus: computed, isLoading: false })
        } else {
            console.error('Fetch Menus Error:', error)
            set({ isLoading: false })
        }
    },
    updateMenuStatus: async (id, newStatus, stock = null, variantName?: string) => {
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
            if (targetStock === undefined || targetStock === null) {
                targetStock = null
            }
        }

        const updatedRaw = previousMenus.map((m) => {
            if (m.id === id) {
                let updatedVariants = m.variants ? [...m.variants] : []
                if (updatedVariants.length > 0) {
                    if (variantName) {
                        updatedVariants = updatedVariants.map(v => {
                            if (v.name === variantName) {
                                const newVStock = targetStock !== null ? targetStock : 10
                                return {
                                    ...v,
                                    stock: newVStock,
                                    status: newVStock === 0 ? 'sold_out' as const : (newVStock <= 3 ? 'low_stock' as const : 'available' as const)
                                }
                            }
                            return v
                        })
                        const totalVarStock = updatedVariants.reduce((sum, v) => sum + v.stock, 0)
                        targetStock = totalVarStock
                        const allSoldOut = updatedVariants.every(v => v.stock === 0)
                        const anyLowStock = updatedVariants.some(v => v.stock > 0 && v.stock <= 3)
                        targetStatus = allSoldOut ? 'sold_out' : (anyLowStock ? 'low_stock' : 'available')
                    } else {
                        if (targetStatus === 'sold_out') {
                            updatedVariants = updatedVariants.map(v => ({ ...v, stock: 0, status: 'sold_out' }))
                        } else if (targetStatus === 'available') {
                            updatedVariants = updatedVariants.map(v => {
                                const newVStock = v.stock <= 3 ? 10 : v.stock
                                return { ...v, stock: newVStock, status: 'available' }
                            })
                        } else if (targetStatus === 'low_stock') {
                            updatedVariants = updatedVariants.map(v => {
                                const newVStock = v.stock > 3 || v.stock === 0 ? 3 : v.stock
                                return { ...v, stock: newVStock, status: 'low_stock' }
                            })
                        }
                        const allSoldOut = updatedVariants.every(v => v.stock === 0)
                        const anyLowStock = updatedVariants.some(v => v.stock > 0 && v.stock <= 3)
                        targetStatus = allSoldOut ? 'sold_out' : (anyLowStock ? 'low_stock' : 'available')
                        targetStock = updatedVariants.reduce((sum, v) => sum + v.stock, 0)
                    }
                }
                return { 
                    ...m, 
                    status: targetStatus, 
                    stock: targetStock, 
                    variants: updatedVariants.length > 0 ? updatedVariants : undefined 
                }
            }
            return m
        })

        const computed = computeMenuStocksAndStatuses(updatedRaw)
        set({ menus: computed })

        const targetMenu = computed.find(m => m.id === id)
        const { error } = await supabase
            .from('menus')
            .update({ 
                status: targetStatus, 
                stock: targetStock, 
                variants: targetMenu?.variants || null 
            })
            .eq('id', id)

        if (error) {
            console.error('Rollback triggered:', error)
            set({ menus: previousMenus })
        } else {
            try {
                const menuName = previousMenus.find((m) => m.id === id)?.name || id
                const statusMap: Record<string, string> = { available: 'Tersedia', low_stock: 'Menipis', sold_out: 'Habis' }
                const statusLabel = statusMap[targetStatus] || targetStatus
                const { writeAuditLog } = await import('@/lib/audit')
                await writeAuditLog(`Mengubah status menu "${menuName}"${variantName ? ` (Varian: ${variantName})` : ''} menjadi "${statusLabel}"${targetStock !== null ? ` (Stok: ${targetStock})` : ''}`)
            } catch (err) {
                console.error('Error logging updateMenuStatus:', err)
            }
        }
    },

    toggleMenuFeatured: async (id, currentFeatured) => {
        const previousMenus = get().menus
        const totalFeatured = previousMenus.filter(m => m.is_featured).length

        if (currentFeatured && totalFeatured <= 2) {
            alert('Gagal menonaktifkan! Menu unggulan wajib minimal 2 item untuk menjaga kestabilan tampilan 3D Carousel. Silakan aktifkan menu lain terlebih dahulu.')
            return
        }

        set((state) => ({
            menus: state.menus.map((m) => m.id === id ? { ...m, is_featured: !currentFeatured } : m)
        }))

        const { error } = await supabase
            .from('menus')
            .update({ is_featured: !currentFeatured })
            .eq('id', id)

        if (error) {
            console.error('Failed to toggle featured status, rolling back:', error)
            set({ menus: previousMenus })
            alert(`Gagal memperbarui status unggulan: ${error.message}`)
        } else {
            try {
                const menuName = previousMenus.find((m) => m.id === id)?.name || id
                const { writeAuditLog } = await import('@/lib/audit')
                await writeAuditLog(`Mengubah status rekomendasi menu "${menuName}" menjadi ${!currentFeatured ? 'AKTIF' : 'NON-AKTIF'}`)
            } catch (err) {
                console.error('Error logging toggleMenuFeatured:', err)
            }
        }
    },

    subscribeToRealtime: () => {
        const channel = supabasePublic
            .channel('public:menus')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'menus' },
                (payload) => {
                    get().fetchMenus()
                }
            )
            .subscribe()

        return () => {
            supabasePublic.removeChannel(channel)
        }
    },

    addToCart: (menu, selectedVariant) => {
        const currentCart = get().cart
        const existingIndex = currentCart.findIndex((item) => 
            item.menu.id === menu.id && item.selectedVariant === selectedVariant
        )

        if (existingIndex > -1) {
            const updatedCart = [...currentCart]
            updatedCart[existingIndex].qty += 1
            set({ cart: updatedCart })
        } else {
            set({ cart: [...currentCart, { menu, selectedVariant, qty: 1, notes: '' }] })
        }
    },

    removeFromCart: (menuId, selectedVariant) => {
        set((state) => ({
            cart: state.cart.filter((item) => !(item.menu.id === menuId && item.selectedVariant === selectedVariant))
        }))
    },

    updateCartItemNotes: (menuId, selectedVariant, notes) => {
        set((state) => ({
            cart: state.cart.map((item) => 
                (item.menu.id === menuId && item.selectedVariant === selectedVariant) ? { ...item, notes } : item
            )
        }))
    },

    clearCart: () => set({ cart: [], tableIdentifier: '' }),

    finalizeOrder: async () => {
        const { cart, menus, tableIdentifier } = get()
        const previousMenus = menus

        const updatedMenusMap = new Map(menus.map(m => [m.id, JSON.parse(JSON.stringify(m)) as Menu]))

        for (const item of cart) {
            const qty = item.qty
            if (item.menu.menu_type === 'bundle') {
                const bundleItems = item.menu.bundle_items || []
                for (const comp of bundleItems) {
                    const compMenu = updatedMenusMap.get(comp.id)
                    if (!compMenu) continue

                    const totalNeeded = qty * comp.qty
                    if (comp.variant_name && compMenu.variants && compMenu.variants.length > 0) {
                        const variant = compMenu.variants.find(v => v.name === comp.variant_name)
                        if (variant) {
                            variant.stock = Math.max(0, variant.stock - totalNeeded)
                            variant.status = variant.stock === 0 ? 'sold_out' : (variant.stock <= 3 ? 'low_stock' : 'available')
                        }
                        const totalVarStock = compMenu.variants.reduce((sum, v) => sum + v.stock, 0)
                        compMenu.stock = totalVarStock
                        compMenu.status = totalVarStock === 0 ? 'sold_out' : (totalVarStock <= 3 ? 'low_stock' : 'available')
                    } else {
                        if (compMenu.stock !== null && compMenu.stock !== undefined) {
                            const newStock = Math.max(0, compMenu.stock - totalNeeded)
                            compMenu.stock = newStock
                            compMenu.status = newStock === 0 ? 'sold_out' : (newStock <= 3 ? 'low_stock' : 'available')
                        }
                    }
                }
            } else {
                const m = updatedMenusMap.get(item.menu.id)
                if (!m) continue

                if (item.selectedVariant && m.variants && m.variants.length > 0) {
                    const variant = m.variants.find(v => v.name === item.selectedVariant)
                    if (variant) {
                        variant.stock = Math.max(0, variant.stock - qty)
                        variant.status = variant.stock === 0 ? 'sold_out' : (variant.stock <= 3 ? 'low_stock' : 'available')
                    }
                    const totalVarStock = m.variants.reduce((sum, v) => sum + v.stock, 0)
                    m.stock = totalVarStock
                    m.status = totalVarStock === 0 ? 'sold_out' : (totalVarStock <= 3 ? 'low_stock' : 'available')
                } else {
                    if (m.stock !== null && m.stock !== undefined) {
                        const newStock = Math.max(0, m.stock - qty)
                        m.stock = newStock
                        m.status = newStock === 0 ? 'sold_out' : (newStock <= 3 ? 'low_stock' : 'available')
                    }
                }
            }
        }

        const computedMenus = computeMenuStocksAndStatuses(Array.from(updatedMenusMap.values()))
        set({ menus: computedMenus, cart: [], tableIdentifier: '' })

        const changedMenus: Menu[] = []
        for (const updatedMenu of computedMenus) {
            const prev = previousMenus.find(m => m.id === updatedMenu.id)
            if (!prev) continue
            const stockChanged = prev.stock !== updatedMenu.stock
            const statusChanged = prev.status !== updatedMenu.status
            const variantsChanged = JSON.stringify(prev.variants) !== JSON.stringify(updatedMenu.variants)
            if (stockChanged || statusChanged || variantsChanged) {
                changedMenus.push(updatedMenu)
            }
        }

        let hasError = false
        for (const changedMenu of changedMenus) {
            const { error } = await supabase
                .from('menus')
                .update({ 
                    stock: changedMenu.stock, 
                    status: changedMenu.status, 
                    variants: changedMenu.variants || null
                })
                .eq('id', changedMenu.id)

            if (error) {
                console.error(`Gagal mengurangi stok untuk ${changedMenu.name}:`, error)
                set({ menus: previousMenus })
                hasError = true
                break
            }
        }

        if (!hasError && cart.length > 0) {
            try {
                const { writeAuditLog } = await import('@/lib/audit')
                const itemsSummary = cart.map(item => `${item.menu.name}${item.selectedVariant ? ` (${item.selectedVariant})` : ''} (x${item.qty})`).join(', ')
                await writeAuditLog(`Menyelesaikan pesanan meja "${tableIdentifier || 'Tanpa Meja'}": ${itemsSummary}`)
            } catch (err) {
                console.error('Error logging finalizeOrder:', err)
            }
        }
    }
}))