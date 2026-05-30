// src/store/useMenuStore.ts
import { create } from 'zustand'
import { supabase, supabasePublic } from '@/lib/supabase'

export type MenuStatus = 'available' | 'low_stock' | 'sold_out'
export type NutriGrade = 'A' | 'B' | 'C' | 'D' | 'E'

export interface Variant {
    name: string
    stock: number
    status: MenuStatus
    price?: number | null
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
    station?: 'bar' | 'kitchen'
}

export interface CartItem {
    menu: Menu
    selectedVariant?: string
    qty: number
    notes: string
}

export interface TicketItem {
    id: string
    ticket_id: string | null
    menu_id: string | null
    qty: number
    notes: string | null
    category_snapshot: string
    menus?: {
        id: string
        name: string
        price: number
        station?: 'bar' | 'kitchen'
        variants?: Variant[]
    } | null
}

export interface OrderTicket {
    id: string
    waiter_id: string | null
    table_identifier: string
    status: 'draft' | 'relayed'
    created_at: string
    ticket_items?: TicketItem[]
    waiter_email?: string
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

    // Order tickets / relay POS state & actions
    activeTickets: OrderTicket[]
    completedTickets: OrderTicket[]
    isTicketsLoading: boolean
    fetchTickets: () => Promise<void>
    markTicketAsRelayed: (ticketId: string) => Promise<void>
    subscribeToTicketsRealtime: () => () => void
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

export function getCartItemPrice(item: { menu: Menu; selectedVariant?: string }): number {
    if (item.selectedVariant && item.menu.variants && item.menu.variants.length > 0) {
        const variant = item.menu.variants.find(v => v.name === item.selectedVariant)
        if (variant && variant.price !== undefined && variant.price !== null) {
            return variant.price
        }
    }
    return item.menu.price
}

export function getTicketItemPrice(item: TicketItem): number {
    const basePrice = item.menus?.price || 0
    if (!item.notes || !item.menus?.variants) {
        return basePrice
    }
    
    // Extract variant name from notes like "[Varian: Iced] no sugar"
    const match = item.notes.match(/^\[Varian:\s*([^\]]+)\]/)
    if (match) {
        const variantName = match[1].trim()
        const variant = item.menus.variants.find(v => v.name.toLowerCase() === variantName.toLowerCase())
        if (variant && variant.price !== undefined && variant.price !== null) {
            return variant.price
        }
    }
    return basePrice
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
    activeTickets: [],
    completedTickets: [],
    isTicketsLoading: false,

    setTableIdentifier: (table) => set({ tableIdentifier: table }),

    fetchMenus: async () => {
        console.log('=== [DEBUG] fetchMenus dipanggil via supabasePublic ===')
        // Tampilkan loading screen hanya jika data menu benar-benar kosong (initial load)
        if (get().menus.length === 0) {
            set({ isLoading: true })
        }

        const { data, error } = await supabasePublic
            .from('menus')
            .select('*')
            .order('category', { ascending: true })
            .order('name', { ascending: true })

        console.log('=== [DEBUG] Hasil fetchMenus ===', { data, error })

        if (!error && data) {
            console.log(`=== [DEBUG] Sukses memuat ${data.length} menu ===`)
            const computed = computeMenuStocksAndStatuses(data as Menu[])
            
            // Validasi keranjang terhadap stok terbaru (Double-order check)
            const currentCart = get().cart
            if (currentCart.length > 0) {
                let cartUpdated = false
                const newCart = currentCart.map(item => {
                    const latest = computed.find(m => m.id === item.menu.id)
                    if (!latest) return item
                    
                    if (item.selectedVariant) {
                        const variant = latest.variants?.find(v => v.name === item.selectedVariant)
                        if (!variant || variant.stock === 0) {
                            alert(`Keranjang diperbarui: Varian "${item.selectedVariant}" dari menu "${item.menu.name}" sudah habis dipesan meja lain dan otomatis dihapus.`)
                            cartUpdated = true
                            return null
                        } else if (item.qty > variant.stock) {
                            alert(`Keranjang diperbarui: Jumlah pesanan varian "${item.selectedVariant}" dari menu "${item.menu.name}" disesuaikan menjadi ${variant.stock} karena keterbatasan stok.`)
                            cartUpdated = true
                            return { ...item, qty: variant.stock }
                        }
                    } else {
                        if (latest.stock !== null && latest.stock !== undefined) {
                            if (latest.stock === 0) {
                                alert(`Keranjang diperbarui: Menu "${item.menu.name}" sudah habis dipesan meja lain dan otomatis dihapus.`)
                                cartUpdated = true
                                return null
                            } else if (item.qty > latest.stock) {
                                alert(`Keranjang diperbarui: Jumlah pesanan menu "${item.menu.name}" disesuaikan menjadi ${latest.stock} karena keterbatasan stok.`)
                                cartUpdated = true
                                return { ...item, qty: latest.stock }
                            }
                        }
                    }
                    return item
                }).filter((item): item is CartItem => item !== null)
                
                if (cartUpdated) {
                    set({ cart: newCart })
                }
            }

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
        const randomId = Math.random().toString(36).substring(7)
        const channel = supabasePublic
            .channel(`menus_realtime_${randomId}`)
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
        const latestMenu = get().menus.find(m => m.id === menu.id)
        if (!latestMenu) return

        // 1. Cegah pencatatan jika menu/varian sudah sold out (habis)
        if (selectedVariant) {
            const variantObj = latestMenu.variants?.find(v => v.name === selectedVariant)
            if (!variantObj || variantObj.status === 'sold_out' || variantObj.stock === 0) {
                alert(`Gagal mencatat: Varian "${selectedVariant}" dari menu "${menu.name}" sudah habis!`)
                return
            }
            
            // Cek batasan stok varian di keranjang
            const currentCart = get().cart
            const existing = currentCart.find(item => item.menu.id === menu.id && item.selectedVariant === selectedVariant)
            const currentQty = existing ? existing.qty : 0
            if (currentQty >= variantObj.stock) {
                alert(`Gagal mencatat: Sisa stok untuk varian "${selectedVariant}" hanya tinggal ${variantObj.stock} porsi!`)
                return
            }
        } else {
            if (latestMenu.status === 'sold_out' || latestMenu.stock === 0) {
                alert(`Gagal mencatat: Menu "${menu.name}" sudah habis!`)
                return
            }
            
            // Cek batasan stok menu tunggal di keranjang
            if (latestMenu.stock !== null && latestMenu.stock !== undefined) {
                const currentCart = get().cart
                const existing = currentCart.find(item => item.menu.id === menu.id && !item.selectedVariant)
                const currentQty = existing ? existing.qty : 0
                if (currentQty >= latestMenu.stock) {
                    alert(`Gagal mencatat: Sisa stok menu "${menu.name}" hanya tinggal ${latestMenu.stock} porsi!`)
                    return
                }
            }
        }

        // 2. Tambahkan ke keranjang
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
        
        // Sanity check stok terakhir sebelum kirim order ke database
        for (const item of cart) {
            const latest = menus.find(m => m.id === item.menu.id)
            if (!latest) {
                alert(`Gagal mengirim order: Menu "${item.menu.name}" sudah tidak tersedia.`)
                return
            }
            if (item.selectedVariant) {
                const variant = latest.variants?.find(v => v.name === item.selectedVariant)
                if (!variant || variant.stock === 0 || item.qty > variant.stock) {
                    alert(`Gagal mengirim order: Stok varian "${item.selectedVariant}" dari menu "${item.menu.name}" tidak mencukupi (Tersisa: ${variant ? variant.stock : 0}). Mohon sesuaikan pesanan Anda.`)
                    return
                }
            } else {
                if (latest.stock !== null && latest.stock !== undefined) {
                    if (latest.stock === 0 || item.qty > latest.stock) {
                        alert(`Gagal mengirim order: Stok menu "${item.menu.name}" tidak mencukupi (Tersisa: ${latest.stock}). Mohon sesuaikan pesanan Anda.`)
                        return
                    }
                }
            }
        }

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
                // Get current waiter ID from useAuthStore
                const { useAuthStore } = await import('./useAuthStore')
                const waiterId = useAuthStore.getState().user?.id || null

                // Insert into order_tickets
                const { data: ticketData, error: ticketError } = await supabase
                    .from('order_tickets')
                    .insert({
                        waiter_id: waiterId,
                        table_identifier: tableIdentifier || 'Tanpa Meja',
                        status: 'draft'
                    })
                    .select()
                    .single()

                if (ticketError) {
                    console.error('Failed to create order ticket in DB:', ticketError)
                } else if (ticketData) {
                    const ticketId = ticketData.id
                    
                    // Prepare ticket items
                    const itemsToInsert = cart.map(item => {
                        let finalNotes = item.notes || null
                        if (item.selectedVariant) {
                            finalNotes = `[Varian: ${item.selectedVariant}]${item.notes ? ` ${item.notes}` : ''}`
                        }
                        return {
                            ticket_id: ticketId,
                            menu_id: item.menu.id,
                            qty: item.qty,
                            notes: finalNotes,
                            category_snapshot: item.menu.category
                        }
                    })

                    // Insert into ticket_items
                    const { error: itemsError } = await supabase
                        .from('ticket_items')
                        .insert(itemsToInsert)

                    if (itemsError) {
                        console.error('Failed to create ticket items in DB:', itemsError)
                    }
                }
            } catch (dbErr) {
                console.error('Database order insertion crashed:', dbErr)
            }

            try {
                const { writeAuditLog } = await import('@/lib/audit')
                const itemsSummary = cart.map(item => `${item.menu.name}${item.selectedVariant ? ` (${item.selectedVariant})` : ''} (x${item.qty})`).join(', ')
                await writeAuditLog(`Menyelesaikan pesanan meja "${tableIdentifier || 'Tanpa Meja'}": ${itemsSummary}`)
            } catch (err) {
                console.error('Error logging finalizeOrder:', err)
            }
        }
    },

    fetchTickets: async () => {
        set({ isTicketsLoading: true })
        
        // Fetch profiles first to map waiter emails
        const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, email')
        const emailMap = new Map<string, string>()
        profilesData?.forEach(p => {
            if (p.id && p.email) emailMap.set(p.id, p.email)
        })

        const { data, error } = await supabase
            .from('order_tickets')
            .select(`
                id,
                table_identifier,
                status,
                created_at,
                waiter_id,
                ticket_items (
                    id,
                    qty,
                    notes,
                    category_snapshot,
                    menu_id,
                    menus (
                        id,
                        name,
                        price,
                        station
                    )
                )
            `)
            .order('created_at', { ascending: false })

        if (!error && data) {
            const rawTickets = data as any[]
            const typedTickets: OrderTicket[] = rawTickets.map(t => ({
                id: t.id,
                waiter_id: t.waiter_id,
                table_identifier: t.table_identifier,
                status: t.status,
                created_at: t.created_at,
                ticket_items: t.ticket_items,
                waiter_email: t.waiter_id ? emailMap.get(t.waiter_id) : undefined
            }))
            
            const active = typedTickets.filter(t => t.status === 'draft')
            const completed = typedTickets.filter(t => t.status === 'relayed')
            set({ 
                activeTickets: active, 
                completedTickets: completed, 
                isTicketsLoading: false 
            })
        } else {
            console.error('Fetch Tickets Error:', error)
            set({ isTicketsLoading: false })
        }
    },

    markTicketAsRelayed: async (ticketId) => {
        const { error } = await supabase
            .from('order_tickets')
            .update({ status: 'relayed' })
            .eq('id', ticketId)

        if (error) {
            console.error('Failed to mark ticket as relayed:', error)
            alert(`Gagal menandai pesanan: ${error.message}`)
        } else {
            const active = get().activeTickets.filter(t => t.id !== ticketId)
            const ticket = get().activeTickets.find(t => t.id === ticketId)
            if (ticket) {
                const updatedTicket = { ...ticket, status: 'relayed' as const }
                set({
                    activeTickets: active,
                    completedTickets: [updatedTicket, ...get().completedTickets]
                })

                try {
                    const { writeAuditLog } = await import('@/lib/audit')
                    await writeAuditLog(`Menyelesaikan relay order meja "${ticket.table_identifier}" ke POS`)
                } catch (err) {
                    console.error('Error logging markTicketAsRelayed:', err)
                }
            }
        }
    },

    subscribeToTicketsRealtime: () => {
        const randomId1 = Math.random().toString(36).substring(7)
        const randomId2 = Math.random().toString(36).substring(7)

        const channel1 = supabase
            .channel(`order_tickets_realtime_${randomId1}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'order_tickets' },
                (payload) => {
                    get().fetchTickets()
                }
            )
            .subscribe()

        const channel2 = supabase
            .channel(`ticket_items_realtime_${randomId2}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'ticket_items' },
                (payload) => {
                    get().fetchTickets()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel1)
            supabase.removeChannel(channel2)
        }
    }
}))