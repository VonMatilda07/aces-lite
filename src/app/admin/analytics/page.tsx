// src/app/admin/analytics/page.tsx
'use client'

import { useEffect, useState, useMemo, Fragment } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { useMenuStore } from '@/store/useMenuStore'
import {
    Calendar,
    Coins,
    Users,
    Receipt,
    TrendingUp,
    Award,
    Clock,
    Timer,
    Loader2,
    RefreshCw,
    Search,
    ChevronDown,
    ChevronUp,
    User,
    ClipboardList,
    Star,
    AlertTriangle,
    PackageOpen
} from 'lucide-react'
import ChatWidget from '@/components/chat/ChatWidget'

interface TicketItemWithMenu {
    qty: number
    notes: string | null
    menus: {
        name: string
        price: number
        category: string
        subcategory: string | null
        variants: any[] | null
    } | null
}

interface DBOrderTicket {
    id: string
    created_at: string
    customer_count: number
    table_identifier: string
    status: string
    waiter_id: string | null
    bar_status: string | null
    kitchen_status: string | null
    bar_prep_start: string | null
    bar_prep_end: string | null
    kitchen_prep_start: string | null
    kitchen_prep_end: string | null
    profiles: {
        email: string
    } | null
    ticket_items: TicketItemWithMenu[]
}

interface DBCustomerFeedback {
    id: string
    created_at: string
    customer_name: string | null
    feedback_text: string
    rating: number | null
    rating_service: number | null
    rating_beverage: number | null
    rating_food: number | null
    rating_ambiance: number | null
}

const getWibDateParts = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date)
    const map = new Map(parts.map(p => [p.type, p.value]))
    const year = parseInt(map.get('year')!)
    const month = parseInt(map.get('month')!)
    const day = parseInt(map.get('day')!)
    return { year, month, day, dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
}

const isTestTicket = (tableIdentifier: string) => {
    const lower = (tableIdentifier || '').toLowerCase()
    return (
        lower.includes('test') ||
        lower.includes('tes') ||
        lower.includes('uji') ||
        lower.includes('coba') ||
        lower.includes('dummy') ||
        lower.includes('mock')
    )
}

const getTicketItemPriceLocal = (item: TicketItemWithMenu) => {
    if (!item.menus) return 0
    let price = item.menus.price || 0
    if (item.notes && item.menus.variants) {
        const match = item.notes.match(/^\[Varian:\s*([^\]]+)\]/)
        if (match) {
            const variantName = match[1].trim()
            const variant = item.menus.variants.find((v: any) => v.name.toLowerCase() === variantName.toLowerCase())
            if (variant && variant.price !== undefined && variant.price !== null) {
                price = variant.price
            }
        }
    }
    return price
}

const getDateRangeString = (range: string, customStart?: string, customEnd?: string) => {
    const nowWib = getWibDateParts(new Date())
    let startStr = nowWib.dateStr
    let endStr = nowWib.dateStr

    switch (range) {
        case '7d': {
            const start = new Date(nowWib.year, nowWib.month - 1, nowWib.day - 7)
            startStr = getWibDateParts(start).dateStr
            break
        }
        case '14d': {
            const start = new Date(nowWib.year, nowWib.month - 1, nowWib.day - 14)
            startStr = getWibDateParts(start).dateStr
            break
        }
        case '21d': {
            const start = new Date(nowWib.year, nowWib.month - 1, nowWib.day - 21)
            startStr = getWibDateParts(start).dateStr
            break
        }
        case '28d': {
            const start = new Date(nowWib.year, nowWib.month - 1, nowWib.day - 28)
            startStr = getWibDateParts(start).dateStr
            break
        }
        case 'month': {
            const start = new Date(nowWib.year, nowWib.month - 1, 1)
            startStr = getWibDateParts(start).dateStr
            break
        }
        case 'prev_month': {
            const start = new Date(nowWib.year, nowWib.month - 2, 1)
            const end = new Date(nowWib.year, nowWib.month - 1, 0)
            startStr = getWibDateParts(start).dateStr
            endStr = getWibDateParts(end).dateStr
            break
        }
        case 'year': {
            const start = new Date(nowWib.year, 0, 1)
            startStr = getWibDateParts(start).dateStr
            break
        }
        case 'custom':
            if (customStart) {
                startStr = customStart
            } else {
                const start = new Date(nowWib.year, nowWib.month - 1, nowWib.day - 7)
                startStr = getWibDateParts(start).dateStr
            }
            if (customEnd) {
                endStr = customEnd
            }
            break
    }
    return { startStr, endStr }
}

export default function AdminAnalyticsPage() {
    const { role, status } = useAuthStore()
    const { menus: allShopMenus, fetchMenus } = useMenuStore()

    const [isAuthorized, setIsAuthorized] = useState(false)
    const [tickets, setTickets] = useState<DBOrderTicket[]>([])
    const [feedbacks, setFeedbacks] = useState<DBCustomerFeedback[]>([])
    const [waiterProfiles, setWaiterProfiles] = useState<{ id: string; email: string }[]>([])
    const [baristaProfiles, setBaristaProfiles] = useState<{ id: string; email: string }[]>([])

    const [isLoading, setIsLoading] = useState(true)

    // Global filter states
    const [timeRange, setTimeRange] = useState<string>('7d')
    const [customStartDate, setCustomStartDate] = useState<string>('')
    const [customEndDate, setCustomEndDate] = useState<string>('')
    const [filterShift, setFilterShift] = useState<string>('All')
    const [filterWaiter, setFilterWaiter] = useState<string>('All')
    const [filterBarista, setFilterBarista] = useState<string>('All')
    const [filterCategoryMenu, setFilterCategoryMenu] = useState<string>('All')

    // Active submodule tab state
    const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'employees' | 'operations' | 'customers' | 'inventory' | 'reports' | 'kpi'>('overview')

    // Table settings
    const [densityMode, setDensityMode] = useState<'comfortable' | 'compact'>('comfortable')
    const [menuSearch, setMenuSearch] = useState('')
    const [menuSort, setMenuSort] = useState('qty_desc')
    const [menuFilterCategory, setMenuFilterCategory] = useState('Semua')
    const [menuFilterSubcategory, setMenuFilterSubcategory] = useState('Semua')
    const [menuFilterShowOnlyTop5, setMenuFilterShowOnlyTop5] = useState(false)
    const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})
    const [showAllProducts, setShowAllProducts] = useState(false)
    const [menuCurrentPage, setMenuCurrentPage] = useState(1)
    const itemsPerPage = 8

    // States untuk Riwayat Tiket
    const [historySearch, setHistorySearch] = useState('')
    const [historySort, setHistorySort] = useState('date_desc')
    const [expandedTickets, setExpandedTickets] = useState<Record<string, boolean>>({})
    const [visibleTicketsCount, setVisibleTicketsCount] = useState(5)

    const toggleMenuExpand = (name: string) => {
        setExpandedMenus(prev => ({ ...prev, [name]: !prev[name] }))
    }

    const toggleTicketExpand = (id: string) => {
        setExpandedTickets(prev => ({ ...prev, [id]: !prev[id] }))
    }

    // Load data menus dari store
    useEffect(() => {
        fetchMenus()
    }, [fetchMenus])

    // Inisialisasi tanggal custom default
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0]
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

        setCustomStartDate(sevenDaysAgoStr)
        setCustomEndDate(today)
    }, [])

    // Client-side route guard (Hanya Admin, Supervisor, dan Marketing)
    useEffect(() => {
        if (status === 'loading' || status === 'idle') return

        const allowedRoles = ['admin', 'supervisor', 'marketing']
        if (status === 'authenticated' && role && allowedRoles.includes(role)) {
            setIsAuthorized(true)
        } else if (status === 'authenticated') {
            window.location.href = role === 'captain' ? '/admin' : '/waiter'
        } else {
            window.location.href = '/login'
        }
    }, [status, role])

    // Reset pagination on search filter change
    useEffect(() => {
        setMenuCurrentPage(1)
    }, [menuSearch, menuFilterCategory, menuFilterSubcategory])

    // Fetch data order tickets, profiles, dan customer feedback dari database
    const fetchData = async () => {
        setIsLoading(true)
        try {
            // 1. Ambil data profiles
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, email, role')

            if (profilesError) throw profilesError

            const emailMap = new Map<string, string>()
            const waiters: any[] = []
            const baristas: any[] = []

            profilesData?.forEach(p => {
                if (p.id && p.email) {
                    emailMap.set(p.id, p.email)
                    if (p.role === 'waiter') waiters.push(p)
                    if (p.role === 'barista' || p.role === 'head_barista') baristas.push(p)
                }
            })
            setWaiterProfiles(waiters)
            setBaristaProfiles(baristas)

            // 2. Ambil data tiket pesanan
            const { data: ticketsData, error: ticketsError } = await supabase
                .from('order_tickets')
                .select(`
                    id,
                    created_at,
                    customer_count,
                    table_identifier,
                    status,
                    waiter_id,
                    bar_status,
                    kitchen_status,
                    bar_prep_start,
                    bar_prep_end,
                    kitchen_prep_start,
                    kitchen_prep_end,
                    ticket_items (
                        qty,
                        notes,
                        menus (
                            name,
                            price,
                            category,
                            subcategory,
                            variants
                        )
                    )
                `)
                .order('created_at', { ascending: false })

            if (ticketsError) throw ticketsError

            if (ticketsData) {
                const mappedData = (ticketsData as any[]).map(t => ({
                    ...t,
                    profiles: t.waiter_id && emailMap.has(t.waiter_id) ? { email: emailMap.get(t.waiter_id)! } : null
                }))
                setTickets(mappedData as unknown as DBOrderTicket[])
            }

            // 3. Ambil data customer feedback
            const { data: feedbacksData, error: feedbacksError } = await supabase
                .from('customer_feedback')
                .select('*')
                .order('created_at', { ascending: false })

            if (feedbacksError) throw feedbacksError
            if (feedbacksData) {
                setFeedbacks(feedbacksData as DBCustomerFeedback[])
            }
        } catch (err: any) {
            console.error('Error fetching analytics data:', err)
            alert('Gagal mengambil data analitik: ' + err.message)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthorized) {
            fetchData()
        }
    }, [isAuthorized])

    // Filter tickets berdasarkan filter global
    const filteredTickets = useMemo(() => {
        const { startStr, endStr } = getDateRangeString(timeRange, customStartDate, customEndDate)
        return tickets.filter(t => {
            // Kecualikan transaksi uji coba/testing sepenuhnya dari dasbor analitik
            if (isTestTicket(t.table_identifier)) return false

            const ticketDateStr = getWibDateParts(new Date(t.created_at)).dateStr
            const isWithinDate = ticketDateStr >= startStr && ticketDateStr <= endStr
            if (!isWithinDate) return false

            // Filter Shift
            if (filterShift !== 'All') {
                const ticketHour = new Date(t.created_at).getHours()
                if (filterShift === 'Shift1' && ticketHour >= 15) return false
                if (filterShift === 'Shift2' && ticketHour < 15) return false
            }

            // Filter Waiter
            if (filterWaiter !== 'All' && t.waiter_id !== filterWaiter) return false

            // Filter Barista
            if (filterBarista !== 'All') {
                // Saring tiket yang diproses di Bar jika filter barista aktif
                if (t.bar_status === 'none') return false
            }

            // Filter Kategori Menu
            if (filterCategoryMenu !== 'All') {
                const hasCategoryItem = t.ticket_items?.some(item => item.menus?.category === filterCategoryMenu)
                if (!hasCategoryItem) return false
            }

            return true
        })
    }, [tickets, timeRange, customStartDate, customEndDate, filterShift, filterWaiter, filterBarista, filterCategoryMenu])

    // Filter feedback kepuasan pelanggan berdasarkan rentang waktu global
    const filteredFeedbacks = useMemo(() => {
        const { startStr, endStr } = getDateRangeString(timeRange, customStartDate, customEndDate)
        return feedbacks.filter(f => {
            const dateStr = getWibDateParts(new Date(f.created_at)).dateStr
            return dateStr >= startStr && dateStr <= endStr
        })
    }, [feedbacks, timeRange, customStartDate, customEndDate])

    // Agregasi & kalkulasi metrik utama
    const analytics = useMemo(() => {
        const customerTickets = filteredTickets.filter(t => t.status === 'relayed' && !t.table_identifier.toLowerCase().startsWith('karyawan:'))
        const staffTickets = filteredTickets.filter(t => t.table_identifier.toLowerCase().startsWith('karyawan:'))

        let totalRevenue = 0
        let totalPax = 0
        let totalTransactions = customerTickets.length

        const dailyTrends: Record<string, { revenue: number; pax: number; count: number }> = {}
        const dayCounts = Array(7).fill(0)
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
        const hourCounts = Array(24).fill(0)

        // Agregasi performa waiter
        const waiterMap: Record<string, { email: string; orders: number; pax: number; revenue: number }> = {}

        // Agregasi menu terlaris
        const itemSalesMap: Record<string, {
            name: string;
            qty: number;
            category: string;
            subcategory: string;
            price: number;
            revenue: number;
            variantsSold: Record<string, { qty: number; revenue: number }>
        }> = {}

        allShopMenus.forEach(m => {
            if (m.menu_type !== 'bundle') {
                itemSalesMap[m.name] = {
                    name: m.name,
                    qty: 0,
                    category: m.category,
                    subcategory: m.subcategory || 'Lainnya',
                    price: m.price,
                    revenue: 0,
                    variantsSold: {}
                }
            }
        })

        // SLA Persiapan Stasiun
        let totalBarPrepTime = 0
        let barPrepCount = 0
        let totalKitchenPrepTime = 0
        let kitchenPrepCount = 0

        // Proses Transaksi Pelanggan Umum
        customerTickets.forEach(ticket => {
            const ticketDate = new Date(ticket.created_at)
            const ticketWib = getWibDateParts(ticketDate)
            const dateStr = ticketWib.day + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'][ticketWib.month - 1]

            if (!dailyTrends[dateStr]) {
                dailyTrends[dateStr] = { revenue: 0, pax: 0, count: 0 }
            }

            const pax = ticket.customer_count || 1
            totalPax += pax
            dailyTrends[dateStr].pax += pax
            dailyTrends[dateStr].count += 1

            dayCounts[ticketDate.getDay()] += 1
            hourCounts[ticketDate.getHours()] += 1

            const waiterEmail = ticket.profiles?.email || 'Walk-In / Guest'
            const waiterId = ticket.waiter_id || 'anonymous'
            if (!waiterMap[waiterId]) {
                waiterMap[waiterId] = { email: waiterEmail.split('@')[0], orders: 0, pax: 0, revenue: 0 }
            }
            waiterMap[waiterId].orders += 1
            waiterMap[waiterId].pax += pax

            if (ticket.bar_prep_start && ticket.bar_prep_end) {
                const diffMs = new Date(ticket.bar_prep_end).getTime() - new Date(ticket.bar_prep_start).getTime()
                totalBarPrepTime += diffMs / (1000 * 60)
                barPrepCount += 1
            }

            if (ticket.kitchen_prep_start && ticket.kitchen_prep_end) {
                const diffMs = new Date(ticket.kitchen_prep_end).getTime() - new Date(ticket.kitchen_prep_start).getTime()
                totalKitchenPrepTime += diffMs / (1000 * 60)
                kitchenPrepCount += 1
            }

            let ticketRevenue = 0
            if (ticket.ticket_items) {
                ticket.ticket_items.forEach(item => {
                    if (item.menus) {
                        const qty = item.qty || 1
                        const price = getTicketItemPriceLocal(item)
                        const itemCost = price * qty
                        ticketRevenue += itemCost

                        const menuId = item.menus.name
                        if (!itemSalesMap[menuId]) {
                            itemSalesMap[menuId] = {
                                name: item.menus.name,
                                qty: 0,
                                category: item.menus.category,
                                subcategory: item.menus.subcategory || 'Lainnya',
                                price: item.menus.price || 0,
                                revenue: 0,
                                variantsSold: {}
                            }
                        }
                        itemSalesMap[menuId].qty += qty
                        itemSalesMap[menuId].revenue += itemCost

                        let variantName = ''
                        if (item.notes && item.menus.variants) {
                            const match = item.notes.match(/^\[Varian:\s*([^\]]+)\]/)
                            if (match) variantName = match[1].trim()
                        }
                        if (variantName) {
                            if (!itemSalesMap[menuId].variantsSold[variantName]) {
                                itemSalesMap[menuId].variantsSold[variantName] = { qty: 0, revenue: 0 }
                            }
                            itemSalesMap[menuId].variantsSold[variantName].qty += qty
                            itemSalesMap[menuId].variantsSold[variantName].revenue += itemCost
                        }
                    }
                })
            }
            totalRevenue += ticketRevenue
            dailyTrends[dateStr].revenue += ticketRevenue
            waiterMap[waiterId].revenue += ticketRevenue
        })

        // Rekapitulasi Invoice Karyawan
        let staffTotalCost = 0
        const staffConsumptionMap: Record<string, { name: string; count: number; cost: number }> = {}
        const staffItemsMap: Record<string, { name: string; qty: number; cost: number }> = {}

        staffTickets.forEach(ticket => {
            const rawName = ticket.table_identifier.replace(/^karyawan:\s*/i, '').trim()
            const staffName = rawName || 'Staf Anonim'

            if (!staffConsumptionMap[staffName]) {
                staffConsumptionMap[staffName] = { name: staffName, count: 0, cost: 0 }
            }
            staffConsumptionMap[staffName].count += 1

            let ticketCost = 0
            if (ticket.ticket_items) {
                ticket.ticket_items.forEach(item => {
                    if (item.menus) {
                        const qty = item.qty || 1
                        const price = getTicketItemPriceLocal(item)
                        const itemCost = price * qty
                        ticketCost += itemCost

                        const menuName = item.menus.name
                        if (!staffItemsMap[menuName]) {
                            staffItemsMap[menuName] = { name: menuName, qty: 0, cost: 0 }
                        }
                        staffItemsMap[menuName].qty += qty
                        staffItemsMap[menuName].cost += itemCost
                    }
                })
            }
            staffTotalCost += ticketCost
            staffConsumptionMap[staffName].cost += ticketCost
        })

        const staffLeaderboard = Object.values(staffConsumptionMap).sort((a, b) => b.cost - a.cost)
        const staffTopItems = Object.values(staffItemsMap).sort((a, b) => b.qty - a.qty)

        const trendData = Object.keys(dailyTrends).map(date => ({
            date,
            ...dailyTrends[date]
        })).reverse()

        // Waiter Leaderboard ranked by Average Bill Price Contribution
        const waiterLeaderboard = Object.values(waiterMap)
            .map(w => ({
                ...w,
                avgBill: w.orders > 0 ? Math.round(w.revenue / w.orders) : 0
            }))
            .sort((a, b) => b.avgBill - a.avgBill)

        const topMenus = Object.values(itemSalesMap)
            .filter(m => m.qty > 0)
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5)

        const allMenuSales = Object.values(itemSalesMap)

        let maxDayIndex = 0
        let maxDayCount = 0
        dayCounts.forEach((count, idx) => {
            if (count > maxDayCount) {
                maxDayCount = count
                maxDayIndex = idx
            }
        })
        const busiestDay = maxDayCount > 0 ? dayNames[maxDayIndex] : 'Tidak ada data'

        let maxHourIndex = 0
        let maxHourCount = 0
        hourCounts.forEach((count, idx) => {
            if (count > maxHourCount) {
                maxHourCount = count
                maxHourIndex = idx
            }
        })
        const peakHour = maxHourIndex

        const avgBarSLA = barPrepCount > 0 ? (totalBarPrepTime / barPrepCount).toFixed(1) : '0.0'
        const avgKitchenSLA = kitchenPrepCount > 0 ? (totalKitchenPrepTime / kitchenPrepCount).toFixed(1) : '0.0'

        const avgTicket = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0
        const avgPax = totalTransactions > 0 ? (totalPax / totalTransactions).toFixed(1) : '0.0'

        const sortedSalesList = [...allMenuSales].sort((a, b) => b.qty - a.qty)
        const topSellingMenuName = sortedSalesList.length > 0 && sortedSalesList[0].qty > 0 ? sortedSalesList[0].name : 'Tidak ada data'

        return {
            totalRevenue,
            totalPax,
            totalTransactions,
            avgTicket,
            avgPax,
            trendData,
            dayCounts,
            dayNames,
            busiestDay,
            maxDayCount,
            hourCounts,
            waiterLeaderboard,
            topMenus,
            allMenuSales,
            avgBarSLA,
            avgKitchenSLA,
            barPrepCount,
            kitchenPrepCount,
            staffTickets,
            staffTotalCost,
            staffLeaderboard,
            staffTopItems,
            peakHour,
            maxHourCount,
            topSellingMenuName
        }
    }, [filteredTickets, allShopMenus])

    // KPI customer feedback calculated dynamically
    const feedbackMetrics = useMemo(() => {
        const ratedFeedbacks = filteredFeedbacks.filter(f => f.rating !== null && f.rating !== undefined)
        const totalRated = ratedFeedbacks.length
        const sumRating = ratedFeedbacks.reduce((sum, f) => sum + (f.rating || 0), 0)
        const average = totalRated > 0 ? (sumRating / totalRated).toFixed(1) : '0.0'

        const serviceFeedbacks = filteredFeedbacks.filter(f => f.rating_service !== null && f.rating_service !== undefined)
        const avgService = serviceFeedbacks.length > 0
            ? (serviceFeedbacks.reduce((sum, f) => sum + (f.rating_service || 0), 0) / serviceFeedbacks.length).toFixed(1)
            : '0.0'

        const beverageFeedbacks = filteredFeedbacks.filter(f => f.rating_beverage !== null && f.rating_beverage !== undefined)
        const avgBeverage = beverageFeedbacks.length > 0
            ? (beverageFeedbacks.reduce((sum, f) => sum + (f.rating_beverage || 0), 0) / beverageFeedbacks.length).toFixed(1)
            : '0.0'

        const foodFeedbacks = filteredFeedbacks.filter(f => f.rating_food !== null && f.rating_food !== undefined)
        const avgFood = foodFeedbacks.length > 0
            ? (foodFeedbacks.reduce((sum, f) => sum + (f.rating_food || 0), 0) / foodFeedbacks.length).toFixed(1)
            : '0.0'

        const ambianceFeedbacks = filteredFeedbacks.filter(f => f.rating_ambiance !== null && f.rating_ambiance !== undefined)
        const avgAmbiance = ambianceFeedbacks.length > 0
            ? (ambianceFeedbacks.reduce((sum, f) => sum + (f.rating_ambiance || 0), 0) / ambianceFeedbacks.length).toFixed(1)
            : '0.0'

        const lowRatingCount = ratedFeedbacks.filter(f => (f.rating || 0) <= 3).length
        const complaintRate = ratedFeedbacks.length > 0
            ? ((lowRatingCount / ratedFeedbacks.length) * 100).toFixed(0) + '%'
            : '0%'

        return {
            totalRated,
            average,
            avgService,
            avgBeverage,
            avgFood,
            avgAmbiance,
            complaintRate,
            ratedFeedbacks
        }
    }, [filteredFeedbacks])

    // Inventory status metrics calculated dynamically
    const inventoryStats = useMemo(() => {
        const available = allShopMenus.filter(m => m.status === 'available').length
        const lowStock = allShopMenus.filter(m => m.status === 'low_stock').length
        const soldOut = allShopMenus.filter(m => m.status === 'sold_out').length
        const lowStockItems = allShopMenus.filter(m => m.status === 'low_stock' || m.status === 'sold_out')
        return { available, lowStock, soldOut, lowStockItems }
    }, [allShopMenus])

    // Mengambil daftar kategori unik dari data menu
    const categories = useMemo(() => {
        const cats = analytics.allMenuSales.map(m => m.category)
        return ['Semua', ...Array.from(new Set(cats))]
    }, [analytics.allMenuSales])

    // Mengambil daftar subkategori unik berdasarkan kategori terpilih
    const subcategories = useMemo(() => {
        let list = analytics.allMenuSales
        if (menuFilterCategory !== 'Semua') {
            list = list.filter(m => m.category === menuFilterCategory)
        }
        const subcats = list.map(m => m.subcategory).filter(Boolean)
        return ['Semua', ...Array.from(new Set(subcats))]
    }, [analytics.allMenuSales, menuFilterCategory])

    // Memproses penyaringan dan pengurutan data menu di tabel
    const sortedAndFilteredMenuSales = useMemo(() => {
        let list = [...analytics.allMenuSales]

        if (menuSearch.trim() !== '') {
            const query = menuSearch.toLowerCase().trim()
            list = list.filter(m => m.name.toLowerCase().includes(query))
        }

        if (menuFilterCategory !== 'Semua') {
            list = list.filter(m => m.category === menuFilterCategory)
        }

        if (menuFilterSubcategory !== 'Semua') {
            list = list.filter(m => m.subcategory === menuFilterSubcategory)
        }

        list.sort((a, b) => {
            if (menuSort === 'qty_desc') {
                return b.qty - a.qty
            } else if (menuSort === 'qty_asc') {
                return a.qty - b.qty
            } else if (menuSort === 'name_asc') {
                return a.name.localeCompare(b.name)
            } else if (menuSort === 'revenue_desc') {
                return b.revenue - a.revenue
            }
            return 0
        })

        if (menuFilterShowOnlyTop5) {
            return list.slice(0, 5)
        }

        return list
    }, [analytics.allMenuSales, menuSearch, menuFilterCategory, menuFilterSubcategory, menuSort, menuFilterShowOnlyTop5])

    // Paginate sales table data
    const paginatedMenuSales = useMemo(() => {
        const start = (menuCurrentPage - 1) * itemsPerPage
        return sortedAndFilteredMenuSales.slice(start, start + itemsPerPage)
    }, [sortedAndFilteredMenuSales, menuCurrentPage])

    const totalMenuSalesPages = Math.ceil(sortedAndFilteredMenuSales.length / itemsPerPage)

    // Filter & Sort Riwayat Tiket
    const sortedAndFilteredHistoryTickets = useMemo(() => {
        let list = [...filteredTickets]

        if (historySearch.trim()) {
            const query = historySearch.toLowerCase().trim()
            list = list.filter(t => {
                const matchTable = t.table_identifier.toLowerCase().includes(query)
                const matchWaiter = t.profiles?.email?.toLowerCase().includes(query) || false
                const matchId = t.id.toLowerCase().includes(query)
                const matchItems = t.ticket_items?.some(item =>
                    item.menus?.name?.toLowerCase().includes(query) || false
                ) || false
                return matchTable || matchWaiter || matchId || matchItems
            })
        }

        list.sort((a, b) => {
            const totalA = a.ticket_items?.reduce((sum, item) => sum + (getTicketItemPriceLocal(item) * item.qty), 0) || 0
            const totalB = b.ticket_items?.reduce((sum, item) => sum + (getTicketItemPriceLocal(item) * item.qty), 0) || 0

            if (historySort === 'date_desc') {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            } else if (historySort === 'date_asc') {
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            } else if (historySort === 'price_desc') {
                return totalB - totalA
            } else if (historySort === 'price_asc') {
                return totalA - totalB
            }
            return 0
        })

        return list
    }, [filteredTickets, historySearch, historySort])

    // Load More incremental tickets list
    const displayedHistoryTickets = useMemo(() => {
        return sortedAndFilteredHistoryTickets.slice(0, visibleTicketsCount)
    }, [sortedAndFilteredHistoryTickets, visibleTicketsCount])

    useEffect(() => {
        setVisibleTicketsCount(5)
    }, [historySearch, historySort, timeRange, filterShift, filterWaiter, filterCategoryMenu])

    // Kalkulasi koordinat untuk SVG Line Chart
    const svgChartPath = useMemo(() => {
        const trends = analytics.trendData
        if (trends.length < 2) return { line: '', fill: '', points: [] }

        const width = 1000
        const height = 200
        const padding = 20

        const maxVal = Math.max(...trends.map(t => t.revenue), 1000)

        const points = trends.map((t, idx) => {
            const x = padding + (idx * (width - padding * 2)) / (trends.length - 1)
            const y = (height - padding) - (t.revenue * (height - padding * 2)) / maxVal
            return { x, y }
        })

        const line = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
        const fill = `${line} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`

        return { line, fill, points }
    }, [analytics.trendData])

    if (!isAuthorized) {
        return (
            <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="w-8 h-8 rounded-full border-2 border-slate-800 border-t-purple-400 animate-spin mb-4" />
                <p className="text-xs font-bold text-slate-400">Memeriksa Keamanan Analitik...</p>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-[#121414] text-[#e2e2e2] pb-24 antialiased selection:bg-purple-500/30 selection:text-white flex flex-col">

            {/* Sticky Header Wrapper: Global Filter + Custom Date Pickers + Submodule Tabs */}
            <div className="sticky top-0 z-20 bg-[#121414]/95 backdrop-blur-md border-b border-[#333535] shadow-md flex flex-col">
                {/* Global Filter Bar */}
                <div className="py-4 px-6 md:px-10 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="bg-purple-500/10 text-purple-400 text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-md border border-purple-500/20">
                            Global Filter
                        </span>
                        <button
                            onClick={fetchData}
                            disabled={isLoading}
                            className="p-1.5 rounded-lg bg-[#1e2020] border border-[#333535] hover:bg-[#333535] active:scale-95 transition-all text-[#c4c7c8] hover:text-white"
                            title="Segarkan Data"
                        >
                            <RefreshCw size={12} className={isLoading ? 'animate-spin text-purple-400' : ''} />
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Date Range Selector */}
                        <div className="relative">
                            <select
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value)}
                                className="bg-[#1e2020] border border-[#333535] rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500 cursor-pointer appearance-none pr-8 hover:bg-[#282a2b] transition-all"
                            >
                                <option value="7d">7 Hari Terakhir</option>
                                <option value="14d">2 Minggu Terakhir</option>
                                <option value="21d">3 Minggu Terakhir</option>
                                <option value="28d">4 Minggu Terakhir</option>
                                <option value="month">Bulan Ini</option>
                                <option value="prev_month">Bulan Kemarin</option>
                                <option value="year">Tahun Ini</option>
                                <option value="custom">Pilih Tanggal Mandiri (Custom)</option>
                            </select>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[8px]">▼</span>
                        </div>

                        {/* Shift Filter */}
                        <div className="relative">
                            <select
                                value={filterShift}
                                onChange={(e) => setFilterShift(e.target.value)}
                                className="bg-[#1e2020] border border-[#333535] rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500 cursor-pointer appearance-none pr-8 hover:bg-[#282a2b] transition-all"
                            >
                                <option value="All">Semua Shift</option>
                                <option value="Shift1">Shift 1 (Pagi)</option>
                                <option value="Shift2">Shift 2 (Sore/Malam)</option>
                            </select>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[8px]">▼</span>
                        </div>

                        {/* Waiter Filter */}
                        <div className="relative">
                            <select
                                value={filterWaiter}
                                onChange={(e) => setFilterWaiter(e.target.value)}
                                className="bg-[#1e2020] border border-[#333535] rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500 cursor-pointer appearance-none pr-8 max-w-[150px] truncate hover:bg-[#282a2b] transition-all"
                            >
                                <option value="All">Semua Waiter</option>
                                {waiterProfiles.map(p => (
                                    <option key={p.id} value={p.id}>{p.email.split('@')[0]}</option>
                                ))}
                            </select>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[8px]">▼</span>
                        </div>

                        {/* Barista Filter */}
                        <div className="relative">
                            <select
                                value={filterBarista}
                                onChange={(e) => setFilterBarista(e.target.value)}
                                className="bg-[#1e2020] border border-[#333535] rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500 cursor-pointer appearance-none pr-8 max-w-[150px] truncate hover:bg-[#282a2b] transition-all"
                            >
                                <option value="All">Semua Barista</option>
                                {baristaProfiles.map(p => (
                                    <option key={p.id} value={p.id}>{p.email.split('@')[0]}</option>
                                ))}
                            </select>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[8px]">▼</span>
                        </div>

                        {/* Kategori Menu Filter */}
                        <div className="relative">
                            <select
                                value={filterCategoryMenu}
                                onChange={(e) => setFilterCategoryMenu(e.target.value)}
                                className="bg-[#1e2020] border border-[#333535] rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500 cursor-pointer appearance-none pr-8 hover:bg-[#282a2b] transition-all"
                            >
                                <option value="All">Semua Kategori</option>
                                <option value="Coffee">Coffee</option>
                                <option value="Non-Coffee">Non-Coffee</option>
                                <option value="Food">Food</option>
                                <option value="Snack">Snack</option>
                            </select>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[8px]">▼</span>
                        </div>
                    </div>
                </div>

                {/* Custom Date Pickers */}
                {timeRange === 'custom' && (
                    <div className="bg-[#1a1c1c] border-t border-[#333535] py-3 px-6 md:px-10 flex flex-wrap gap-4 items-center justify-start text-xs font-bold animate-in slide-in-from-top duration-250">
                        <span className="text-[#c4c7c8] uppercase tracking-wider">Pilih Tanggal:</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="bg-[#282a2b] text-white border border-[#333535] rounded-xl px-3 py-1.5 focus:outline-none focus:border-purple-400 text-xs"
                            />
                            <span className="text-[#c4c7c8]">s.d.</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="bg-[#282a2b] text-white border border-[#333535] rounded-xl px-3 py-1.5 focus:outline-none focus:border-purple-400 text-xs"
                            />
                        </div>
                    </div>
                )}

                {/* Submodule Tab Bar */}
                <div className="bg-[#1a1c1c] border-t border-[#333535] flex items-center justify-start px-6 md:px-10 overflow-x-auto gap-1 py-0.5">
                    {[
                        { id: 'overview', label: 'Overview' },
                        { id: 'sales', label: 'Sales' },
                        { id: 'employees', label: 'Employees' },
                        { id: 'operations', label: 'Operations' },
                        { id: 'customers', label: 'Customers' },
                        { id: 'inventory', label: 'Inventory' },
                        { id: 'reports', label: 'Reports (Future)', disabled: true },
                        { id: 'kpi', label: 'KPI (Future)', disabled: true }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            disabled={tab.disabled}
                            onClick={() => !tab.disabled && setActiveTab(tab.id as any)}
                            className={`px-4 py-3.5 text-[10px] font-black uppercase tracking-wider transition-all duration-200 border-b-2 whitespace-nowrap ${tab.disabled
                                    ? 'opacity-30 cursor-not-allowed border-transparent text-slate-500'
                                    : activeTab === tab.id
                                        ? 'border-purple-500 text-purple-400 font-extrabold bg-purple-500/5'
                                        : 'border-transparent text-[#c4c7c8] hover:text-white hover:bg-slate-800/30'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="w-full max-w-7xl mx-auto p-4 md:p-10 flex flex-col gap-6 animate-in fade-in duration-300">

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 text-[#c4c7c8] gap-3">
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                        <p className="text-xs font-bold uppercase tracking-wider">Menganalisis Transaksi Kafe...</p>
                    </div>
                ) : (
                    <>
                        {/* 1. OVERVIEW TAB */}
                        {activeTab === 'overview' && (
                            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                                {/* Metrik Ringkasan KPI Utama */}
                                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-5 relative overflow-hidden group hover:border-[#333535] transition-all hover:-translate-y-0.5 shadow-md">
                                        <div className="absolute -right-4 -top-4 text-white/5 pointer-events-none"><Coins size={96} /></div>
                                        <p className="text-[9px] font-mono font-bold text-[#c4c7c8] mb-1.5 uppercase tracking-wider">Total Omzet</p>
                                        <h3 className="text-base font-extrabold text-white leading-none">
                                            Rp {analytics.totalRevenue.toLocaleString('id-ID')}
                                        </h3>
                                        <p className="text-[9px] text-[#c4c7c8] mt-3">Transaksi terdistribusi</p>
                                    </div>

                                    <div className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-5 relative overflow-hidden group hover:border-[#333535] transition-all hover:-translate-y-0.5 shadow-md">
                                        <div className="absolute -right-4 -top-4 text-[#ffb692]/5 pointer-events-none"><Users size={96} /></div>
                                        <p className="text-[9px] font-mono font-bold text-[#ffb692] mb-1.5 uppercase tracking-wider">Total Pengunjung</p>
                                        <h3 className="text-base font-extrabold text-white leading-none">
                                            {analytics.totalPax} <span className="text-xs text-[#c4c7c8] font-bold">Pax</span>
                                        </h3>
                                        <p className="text-[9px] text-[#c4c7c8] mt-3">Rerata: {analytics.avgPax} Pax/Meja</p>
                                    </div>

                                    <div className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-5 relative overflow-hidden group hover:border-[#333535] transition-all hover:-translate-y-0.5 shadow-md">
                                        <div className="absolute -right-4 -top-4 text-purple-400/5 pointer-events-none"><Receipt size={96} /></div>
                                        <p className="text-[9px] font-mono font-bold text-purple-400 mb-1.5 uppercase tracking-wider">Total Order</p>
                                        <h3 className="text-base font-extrabold text-white leading-none">
                                            {analytics.totalTransactions} <span className="text-xs text-[#c4c7c8] font-bold">Tiket</span>
                                        </h3>
                                        <p className="text-[9px] text-[#c4c7c8] mt-3">Tiket Relay aktif</p>
                                    </div>

                                    <div className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-5 relative overflow-hidden group hover:border-[#333535] transition-all hover:-translate-y-0.5 shadow-md">
                                        <div className="absolute -right-4 -top-4 text-white/5 pointer-events-none"><TrendingUp size={96} /></div>
                                        <p className="text-[9px] font-mono font-bold text-[#c4c7c8] mb-1.5 uppercase tracking-wider">Rerata Tiket</p>
                                        <h3 className="text-base font-extrabold text-white leading-none">
                                            Rp {analytics.avgTicket.toLocaleString('id-ID')}
                                        </h3>
                                        <p className="text-[9px] text-[#c4c7c8] mt-3">Belanja rata-rata</p>
                                    </div>

                                    {/* TAMBAHAN ROADMAP METRIC CARDS */}
                                    <div className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-5 relative overflow-hidden group hover:border-[#333535] transition-all hover:-translate-y-0.5 shadow-md">
                                        <div className="absolute -right-4 -top-4 text-purple-400/5 pointer-events-none"><Timer size={96} /></div>
                                        <p className="text-[9px] font-mono font-bold text-[#c4c7c8] mb-1.5 uppercase tracking-wider">Rerata Waktu Racik</p>
                                        <h3 className="text-base font-extrabold text-white leading-none">
                                            {(parseFloat(analytics.avgBarSLA) + parseFloat(analytics.avgKitchenSLA) === 0 ? '0.0' : ((parseFloat(analytics.avgBarSLA) + parseFloat(analytics.avgKitchenSLA)) / 2).toFixed(1))} <span className="text-xs text-[#c4c7c8] font-bold">Min</span>
                                        </h3>
                                        <p className="text-[9px] text-[#c4c7c8] mt-3">Bar: {analytics.avgBarSLA}m | Kitchen: {analytics.avgKitchenSLA}m</p>
                                    </div>

                                    <div className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-5 relative overflow-hidden group hover:border-[#333535] transition-all hover:-translate-y-0.5 shadow-md">
                                        <div className="absolute -right-4 -top-4 text-amber-400/5 pointer-events-none"><Star size={96} /></div>
                                        <p className="text-[9px] font-mono font-bold text-amber-400 mb-1.5 uppercase tracking-wider">Customer Rating</p>
                                        <h3 className="text-base font-extrabold text-white leading-none">
                                            ⭐ {feedbackMetrics.average} <span className="text-xs text-[#c4c7c8] font-bold">/ 5.0</span>
                                        </h3>
                                        <p className="text-[9px] text-[#c4c7c8] mt-3">Dari {feedbackMetrics.totalRated} Umpan balik</p>
                                    </div>

                                    <div className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-5 relative overflow-hidden group hover:border-[#333535] transition-all hover:-translate-y-0.5 shadow-md">
                                        <div className="absolute -right-4 -top-4 text-rose-500/5 pointer-events-none"><AlertTriangle size={96} /></div>
                                        <p className="text-[9px] font-mono font-bold text-rose-400 mb-1.5 uppercase tracking-wider">Complaint Rate</p>
                                        <h3 className="text-base font-extrabold text-white leading-none">
                                            {feedbackMetrics.complaintRate}
                                        </h3>
                                        <p className="text-[9px] text-[#c4c7c8] mt-3">Rating &le; 3 Bintang</p>
                                    </div>

                                    <div className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-5 relative overflow-hidden group hover:border-[#333535] transition-all hover:-translate-y-0.5 shadow-md">
                                        <p className="text-[9px] font-mono font-bold text-[#ffb692] mb-1.5 uppercase tracking-wider">Peak Hour & Top Menu</p>
                                        <h4 className="text-xs font-black text-white truncate">
                                            🔥 {analytics.topSellingMenuName}
                                        </h4>
                                        <p className="text-[9px] text-[#c4c7c8] mt-3">Jam Sibuk: {analytics.peakHour}:00 ({analytics.maxHourCount} order)</p>
                                    </div>
                                </section>

                                {/* Tren Penjualan Grafik */}
                                <section className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg flex flex-col gap-4">
                                    <div className="flex justify-between items-center border-b border-[#333535] pb-4">
                                        <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5">
                                            <TrendingUp size={16} className="text-purple-400" />
                                            TREN PENJUALAN HARIAN
                                        </h3>
                                        {analytics.trendData.length > 0 && (
                                            <span className="text-[9px] font-mono text-[#c4c7c8] uppercase tracking-wider">
                                                {analytics.trendData[0].date} - {analytics.trendData[analytics.trendData.length - 1].date}
                                            </span>
                                        )}
                                    </div>

                                    {analytics.trendData.length < 2 ? (
                                        <div className="h-44 flex items-center justify-center text-[#c4c7c8] text-xs font-semibold">
                                            Data belum cukup untuk menampilkan tren grafik.
                                        </div>
                                    ) : (
                                        <div className="w-full flex flex-col gap-4 relative pt-2">
                                            <div className="w-full overflow-hidden select-none relative h-64">
                                                <div className="absolute inset-0 bg-[linear-gradient(to_right,#333535_1px,transparent_1px),linear-gradient(to_bottom,#333535_1px,transparent_1px)] bg-[size:40px_40px] opacity-10 rounded-lg pointer-events-none"></div>

                                                <svg viewBox="0 0 1000 200" className="w-full h-full overflow-visible">
                                                    <defs>
                                                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#d0bcff" stopOpacity="0.2" />
                                                            <stop offset="100%" stopColor="#d0bcff" stopOpacity="0.0" />
                                                        </linearGradient>
                                                    </defs>
                                                    <path d={svgChartPath.fill} fill="url(#chartGradient)" />
                                                    <path d={svgChartPath.line} fill="none" stroke="#d0bcff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                                    {svgChartPath.points.map((p, idx) => {
                                                        const trendVal = analytics.trendData[idx]
                                                        return (
                                                            <g key={idx} className="group cursor-pointer">
                                                                <circle
                                                                    cx={p.x}
                                                                    cy={p.y}
                                                                    r="5"
                                                                    className="fill-[#121414] stroke-[#d0bcff] stroke-[2] group-hover:r-7 group-hover:fill-purple-400 transition-all"
                                                                />
                                                                <foreignObject x={p.x - 50} y={p.y - 35} width="100" height="30" className="overflow-visible pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                                    <div className="bg-slate-900 border border-[#333535] text-white text-[8px] font-bold py-1 px-1.5 rounded-lg shadow-md text-center">
                                                                        Rp {trendVal.revenue.toLocaleString('id-ID')}
                                                                    </div>
                                                                </foreignObject>
                                                            </g>
                                                        )
                                                    })}
                                                </svg>
                                            </div>
                                            <div className="flex justify-between px-2 text-[9px] font-bold text-[#c4c7c8]">
                                                <span>{analytics.trendData[0].date}</span>
                                                <span>{analytics.trendData[Math.floor(analytics.trendData.length / 2)].date}</span>
                                                <span>{analytics.trendData[analytics.trendData.length - 1].date}</span>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}

                        {/* 2. SALES TAB */}
                        {activeTab === 'sales' && (
                            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                                {/* Top 5 terlaris scrollable */}
                                <section className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg flex flex-col gap-4">
                                    <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5 border-b border-[#333535] pb-4">
                                        <Award size={16} className="text-[#ffb692]" />
                                        DAFTAR MENU TERLARIS (TOP 5)
                                    </h3>
                                    {analytics.topMenus.length === 0 ? (
                                        <div className="py-8 text-center text-[#c4c7c8] text-xs font-medium">
                                            Belum ada transaksi makanan/minuman terjual.
                                        </div>
                                    ) : (
                                        <div className="flex space-x-4 overflow-x-auto pb-3 snap-x scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-[#121414]/30 [&::-webkit-scrollbar-thumb]:bg-purple-500/30 [&::-webkit-scrollbar-thumb]:rounded-full">
                                            {analytics.topMenus.map((menu, index) => {
                                                const topVariant = Object.entries(menu.variantsSold || {})
                                                    .sort((a, b) => b[1].qty - a[1].qty)[0];

                                                return (
                                                    <div key={menu.name} className="min-w-[220px] flex-shrink-0 bg-[#121414]/50 backdrop-blur-md rounded-xl p-5 border border-[#333535] relative overflow-hidden group snap-start">
                                                        <div className="absolute -right-4 -bottom-4 text-6xl font-black text-[#282a2b]/30 group-hover:text-white/5 transition-colors pointer-events-none">
                                                            #{index + 1}
                                                        </div>
                                                        <span className="inline-block bg-[#ffb692]/10 text-[#ffb692] text-[8px] font-black px-2 py-0.5 rounded tracking-wider uppercase border border-[#ffb692]/20">
                                                            {menu.category}
                                                        </span>
                                                        <h4 className="font-extrabold text-white text-xs leading-snug mt-3 mb-1 min-h-[2rem] line-clamp-2">
                                                            {menu.name}
                                                        </h4>
                                                        <div className="text-[9px] text-slate-400 mb-6 min-h-[1rem]">
                                                            {topVariant ? (
                                                                <span>Varian Terpopuler: <strong className="text-[#ffb692]">{topVariant[0]} ({topVariant[1].qty}x)</strong></span>
                                                            ) : (
                                                                <span className="italic">Tanpa varian</span>
                                                            )}
                                                        </div>
                                                        <div className="border-t border-dashed border-[#333535] pt-3 flex justify-between items-end relative z-10">
                                                            <span className="text-[9px] text-[#c4c7c8] tracking-wider uppercase font-bold">VOLUME</span>
                                                            <span className="text-lg font-extrabold text-white font-mono leading-none">{menu.qty}x</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>

                                {/* Laporan Penjualan Semua Produk */}
                                <section className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg flex flex-col gap-5 w-full">
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-[#333535] pb-4">
                                        <div>
                                            <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5">
                                                <Receipt size={16} className="text-[#ffb692]" />
                                                Laporan Penjualan Semua Produk
                                            </h3>
                                            <p className="text-[10px] text-[#c4c7c8] font-medium leading-none mt-1">Daftar penjualan lengkap seluruh item menu yang ada di kafe</p>
                                        </div>
                                        {/* Density mode button */}
                                        <button
                                            onClick={() => setDensityMode(densityMode === 'comfortable' ? 'compact' : 'comfortable')}
                                            className="bg-[#282a2b] hover:bg-[#333535] border border-[#333535] text-white text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95"
                                        >
                                            {densityMode === 'comfortable' ? 'Compact Mode' : 'Comfortable Mode'}
                                        </button>
                                    </div>

                                    {/* Controls */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-[#121414]/40 p-3.5 rounded-2xl border border-[#282a2b]">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[9px] font-mono text-[#c4c7c8] uppercase tracking-wider pl-1">Cari Produk</label>
                                            <input
                                                type="text"
                                                placeholder="Cari nama menu..."
                                                value={menuSearch}
                                                onChange={(e) => setMenuSearch(e.target.value)}
                                                className="bg-[#282a2b] text-white text-xs font-bold px-3 py-2 rounded-xl border border-[#333535] outline-none focus:border-purple-400 transition-all placeholder:text-slate-650"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[9px] font-mono text-[#c4c7c8] uppercase tracking-wider pl-1">Kategori</label>
                                            <select
                                                value={menuFilterCategory}
                                                onChange={(e) => {
                                                    setMenuFilterCategory(e.target.value)
                                                    setMenuFilterSubcategory('Semua')
                                                }}
                                                className="bg-[#282a2b] text-white text-xs font-bold px-3 py-2 rounded-xl border border-[#333535] outline-none focus:border-purple-400 transition-all cursor-pointer"
                                            >
                                                {categories.map(cat => (
                                                    <option key={cat} value={cat}>{cat === 'Semua' ? 'Semua Kategori' : cat}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[9px] font-mono text-[#c4c7c8] uppercase tracking-wider pl-1">Subkategori</label>
                                            <select
                                                value={menuFilterSubcategory}
                                                onChange={(e) => setMenuFilterSubcategory(e.target.value)}
                                                className="bg-[#282a2b] text-white text-xs font-bold px-3 py-2 rounded-xl border border-[#333535] outline-none focus:border-purple-400 transition-all cursor-pointer disabled:opacity-50"
                                                disabled={menuFilterCategory === 'Semua'}
                                            >
                                                {subcategories.map(sub => (
                                                    <option key={sub} value={sub}>{sub === 'Semua' ? 'Semua Subkategori' : sub}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[9px] font-mono text-[#c4c7c8] uppercase tracking-wider pl-1">Urutkan</label>
                                            <select
                                                value={menuSort}
                                                onChange={(e) => setMenuSort(e.target.value)}
                                                className="bg-[#282a2b] text-white text-xs font-bold px-3 py-2 rounded-xl border border-[#333535] outline-none focus:border-purple-400 transition-all cursor-pointer"
                                            >
                                                <option value="qty_desc">Terlaris (Volume Tinggi)</option>
                                                <option value="qty_asc">Kurang Laris (Volume Rendah)</option>
                                                <option value="revenue_desc">Omzet Terbesar</option>
                                                <option value="name_asc">Nama Produk (A-Z)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Checkbox for Top 5 inside Category filter */}
                                    <div className="flex items-center gap-2 pl-1 select-none">
                                        <input
                                            type="checkbox"
                                            id="showOnlyTop5Checkbox"
                                            checked={menuFilterShowOnlyTop5}
                                            onChange={(e) => setMenuFilterShowOnlyTop5(e.target.checked)}
                                            className="w-4 h-4 rounded border-[#333535] text-[#ffb692] focus:ring-[#ffb692] bg-[#282a2b] cursor-pointer"
                                        />
                                        <label htmlFor="showOnlyTop5Checkbox" className="text-xs font-bold text-[#c4c7c8] cursor-pointer select-none">
                                            Hanya tampilkan Top 5 Terlaris berdasarkan filter saat ini
                                        </label>
                                    </div>

                                    {/* Table with Density padding classes */}
                                    <div className="overflow-x-auto rounded-2xl border border-[#333535]">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-[#121414] text-[#c4c7c8] font-bold text-[10px] uppercase tracking-wider border-b border-[#333535]">
                                                    <th className={`${densityMode === 'comfortable' ? 'py-3 px-4' : 'py-2 px-4'} w-14 text-center`}>Rank</th>
                                                    <th className={densityMode === 'comfortable' ? 'py-3 px-4' : 'py-2 px-4'}>Nama Produk</th>
                                                    <th className={densityMode === 'comfortable' ? 'py-3 px-4' : 'py-2 px-4'}>Kategori / Sub</th>
                                                    <th className={`${densityMode === 'comfortable' ? 'py-3 px-4' : 'py-2 px-4'} text-center`}>Terjual</th>
                                                    <th className={`${densityMode === 'comfortable' ? 'py-3 px-4' : 'py-2 px-4'} text-right`}>Omzet</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedMenuSales.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="py-8 text-center text-[#c4c7c8] text-xs font-medium bg-[#1e2020]/20">
                                                            Tidak ada produk yang cocok dengan pencarian / filter aktif.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    paginatedMenuSales.map((menu, idx) => {
                                                        const overallRank = [...analytics.allMenuSales]
                                                            .sort((a, b) => b.qty - a.qty)
                                                            .findIndex(m => m.name === menu.name) + 1;

                                                        const hasVariants = Object.keys(menu.variantsSold || {}).length > 0;
                                                        const isExpanded = !!expandedMenus[menu.name];
                                                        const paddingClass = densityMode === 'comfortable' ? 'py-3.5 px-4' : 'py-2 px-4';

                                                        return (
                                                            <Fragment key={menu.name}>
                                                                <tr className="border-b border-[#333535]/40 hover:bg-[#282a2b]/20 transition-colors text-xs font-medium">
                                                                    <td className={`${paddingClass} text-center`}>
                                                                        <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[9px] font-black ${overallRank === 1 ? 'bg-[#ffb692] text-[#341100]' :
                                                                                overallRank <= 5 ? 'bg-purple-955/60 text-purple-300 border border-purple-500/30' :
                                                                                    'bg-[#282a2b] text-[#c4c7c8]'
                                                                            }`}>
                                                                            {overallRank}
                                                                        </span>
                                                                    </td>
                                                                    <td
                                                                        className={`${paddingClass} text-white font-bold cursor-pointer select-none`}
                                                                        onClick={() => hasVariants && toggleMenuExpand(menu.name)}
                                                                    >
                                                                        <div className="flex items-center gap-1.5 hover:text-[#ffb692] transition-colors">
                                                                            <span>{menu.name}</span>
                                                                            {hasVariants && (
                                                                                <span className="text-[8px] font-mono text-[#ffb692] bg-[#ffb692]/10 px-1.5 py-0.5 rounded border border-[#ffb692]/20 whitespace-nowrap">
                                                                                    {isExpanded ? '▲ Tutup' : '▼ Varian'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className={paddingClass}>
                                                                        <span className="text-[9px] font-mono text-[#c4c7c8] bg-[#282a2b] px-2 py-0.5 rounded border border-[#333535]/65">
                                                                            {menu.category} {menu.subcategory && `/ ${menu.subcategory}`}
                                                                        </span>
                                                                    </td>
                                                                    <td className={`${paddingClass} text-center font-bold text-white font-mono`}>{menu.qty}x</td>
                                                                    <td className={`${paddingClass} text-right font-mono text-white`}>
                                                                        Rp {menu.revenue.toLocaleString('id-ID')}
                                                                    </td>
                                                                </tr>
                                                                {isExpanded && hasVariants && (
                                                                    <tr className="bg-[#121414]/30 border-b border-[#333535]/40 text-[10px] font-semibold text-slate-400">
                                                                        <td colSpan={2}></td>
                                                                        <td colSpan={3} className="p-4">
                                                                            <div className="space-y-2 border-l-2 border-purple-500/35 pl-4 py-1">
                                                                                <div className="text-[9.5px] font-black uppercase text-purple-400 tracking-wider mb-2">Penjualan per Varian:</div>
                                                                                {Object.entries(menu.variantsSold || {}).map(([vName, vData]) => (
                                                                                    <div key={vName} className="flex justify-between items-center text-slate-350">
                                                                                        <span>Varian: <strong className="text-white">{vName}</strong></span>
                                                                                        <div className="flex items-center gap-6 font-mono text-xs">
                                                                                            <span>{vData.qty}x</span>
                                                                                            <span className="text-white font-bold w-24 text-right">Rp {vData.revenue.toLocaleString('id-ID')}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </Fragment>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>

                                        {/* Catalog table pagination */}
                                        {totalMenuSalesPages > 1 && (
                                            <div className="flex justify-between items-center px-6 py-4 bg-[#121414] border-t border-[#333535] text-xs">
                                                <span className="text-slate-400 font-bold">
                                                    Menampilkan {Math.min(sortedAndFilteredMenuSales.length, (menuCurrentPage - 1) * itemsPerPage + 1)}-{Math.min(sortedAndFilteredMenuSales.length, menuCurrentPage * itemsPerPage)} dari {sortedAndFilteredMenuSales.length} menu
                                                </span>
                                                <div className="flex gap-1">
                                                    <button
                                                        disabled={menuCurrentPage === 1}
                                                        onClick={() => setMenuCurrentPage(prev => Math.max(1, prev - 1))}
                                                        className="px-3 py-1.5 bg-[#282a2b] border border-[#333535] rounded-lg font-bold hover:bg-[#333535] disabled:opacity-50 active:scale-95 transition-all text-white"
                                                    >
                                                        Prev
                                                    </button>
                                                    {Array.from({ length: totalMenuSalesPages }, (_, i) => i + 1).map(page => (
                                                        <button
                                                            key={page}
                                                            onClick={() => setMenuCurrentPage(page)}
                                                            className={`px-3 py-1.5 rounded-lg font-bold border transition-all active:scale-95 ${menuCurrentPage === page
                                                                    ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                                                                    : 'bg-[#282a2b] border-[#333535] hover:bg-[#333535] text-slate-300'
                                                                }`}
                                                        >
                                                            {page}
                                                        </button>
                                                    ))}
                                                    <button
                                                        disabled={menuCurrentPage === totalMenuSalesPages}
                                                        onClick={() => setMenuCurrentPage(prev => Math.min(totalMenuSalesPages, prev + 1))}
                                                        className="px-3 py-1.5 bg-[#282a2b] border border-[#333535] rounded-lg font-bold hover:bg-[#333535] disabled:opacity-50 active:scale-95 transition-all text-white"
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* 3. EMPLOYEES TAB */}
                        {activeTab === 'employees' && (
                            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                                {/* Waiter Leaderboard - Sorted by Average Bill Price Contribution */}
                                <section className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg flex flex-col gap-4">
                                    <div className="flex justify-between items-center border-b border-[#333535] pb-4">
                                        <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5">
                                            <Award size={16} className="text-white" />
                                            KONTRIBUSI PRAMUSAJI (AVERAGE BILL PRICE)
                                        </h3>
                                        <span className="text-[8.5px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20 font-bold uppercase tracking-wider">
                                            Sort: Rata-Rata Terbesar
                                        </span>
                                    </div>

                                    {analytics.waiterLeaderboard.length === 0 ? (
                                        <div className="py-8 text-center text-[#c4c7c8] text-xs font-medium">
                                            Belum ada aktivitas pelayanan tercatat.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                            {analytics.waiterLeaderboard.map((waiter, index) => (
                                                <div key={waiter.email} className="flex justify-between items-center bg-[#282a2b]/35 hover:bg-[#282a2b]/60 p-4 rounded-2xl border border-transparent hover:border-[#333535] transition-all hover:-translate-y-0.5 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black leading-none ${index === 0 ? 'bg-[#ffb692] text-[#341100] shadow-[0_0_12px_rgba(255,182,146,0.3)]' :
                                                                index === 1 ? 'bg-[#c4c7c8] text-[#121414]' :
                                                                    index === 2 ? 'bg-[#ffb692]/40 text-[#ffb692]' : 'bg-[#121414] text-[#c4c7c8]'
                                                            }`}>
                                                            {index + 1}
                                                        </span>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-[#e2e2e2] text-xs lowercase leading-none">{waiter.email}</span>
                                                            <span className="text-[9px] text-[#c4c7c8] mt-1.5">{waiter.orders} Tiket / {waiter.pax} Pax</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right leading-none">
                                                        <span className="text-xs font-black text-purple-400">Rp {waiter.avgBill.toLocaleString('id-ID')}</span>
                                                        <span className="block text-[8px] text-[#c4c7c8] mt-1.5 uppercase tracking-wider">Avg Bill</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* Staf consumption report */}
                                <section className="bg-purple-950/20 border border-purple-500/20 rounded-3xl p-5 shadow-lg flex flex-col gap-6">
                                    <div className="flex justify-between items-start border-b border-purple-500/30 pb-4">
                                        <div>
                                            <div className="text-[9px] font-mono font-bold text-purple-400 tracking-[0.2em] uppercase mb-0.5">INTERNAL SYSTEM OVERHEAD</div>
                                            <h3 className="text-base font-extrabold text-white tracking-tight">Ringkasan Konsumsi Karyawan</h3>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-mono font-bold text-[#c4c7c8] uppercase tracking-wider">Total Biaya Overhead</p>
                                            <h4 className="text-base font-extrabold text-purple-400 mt-1 font-mono">Rp {analytics.staffTotalCost.toLocaleString('id-ID')}</h4>
                                        </div>
                                    </div>

                                    {analytics.staffLeaderboard.length === 0 ? (
                                        <div className="py-8 text-center text-purple-300/60 text-xs font-semibold">
                                            Belum ada catatan konsumsi makan/minum staf dalam periode ini.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Column 1: Leaderboard Staf */}
                                            <div className="space-y-3.5">
                                                <h4 className="text-[10px] font-black text-purple-300 uppercase tracking-widest pl-1 leading-none">Rincian Per-Karyawan</h4>
                                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                                    {analytics.staffLeaderboard.map((staff, idx) => (
                                                        <div key={staff.name} className="flex justify-between items-center bg-purple-900/10 hover:bg-purple-900/20 px-3.5 py-2.5 rounded-xl border border-purple-500/10 transition-colors">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-purple-400">#{idx + 1}</span>
                                                                <span className="text-xs font-extrabold text-slate-100">{staff.name}</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-xs font-black text-purple-400 font-mono">Rp {staff.cost.toLocaleString('id-ID')}</span>
                                                                <span className="block text-[8px] text-slate-400 mt-0.5">{staff.count} Transaksi</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Column 2: Top Consumed Items */}
                                            <div className="space-y-3.5">
                                                <h4 className="text-[10px] font-black text-purple-300 uppercase tracking-widest pl-1 leading-none">Produk Konsumsi Terpopuler</h4>
                                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                                    {analytics.staffTopItems.slice(0, 5).map((item, idx) => (
                                                        <div key={item.name} className="flex justify-between items-center bg-purple-900/10 px-3.5 py-2.5 rounded-xl border border-purple-500/10">
                                                            <div className="flex items-center gap-2 max-w-[180px]">
                                                                <span className="text-[10px] font-mono text-purple-450">#{idx + 1}</span>
                                                                <span className="text-xs font-bold text-slate-200 truncate">{item.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-right">
                                                                <span className="text-xs font-black text-white font-mono">{item.qty} Porsi</span>
                                                                <span className="text-[10px] text-purple-400 font-bold w-20">Rp {item.cost.toLocaleString('id-ID')}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}

                        {/* 4. OPERATIONS TAB */}
                        {activeTab === 'operations' && (
                            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                                {/* SLA Persiapan Stasiun */}
                                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg flex flex-col gap-3.5 relative overflow-hidden group hover:border-[#333535] transition-all">
                                        <div className="absolute -right-4 -top-4 text-purple-400/5 pointer-events-none"><Timer size={120} /></div>
                                        <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5 border-b border-[#333535] pb-3">
                                            <Timer size={16} className="text-purple-400" />
                                            SLA WAKTU SAJI BARISTA (MINUMAN)
                                        </h3>
                                        <div className="flex items-baseline gap-1.5 mt-2">
                                            <span className="text-3xl font-black text-white font-mono">{analytics.avgBarSLA}</span>
                                            <span className="text-xs font-bold text-[#c4c7c8]">Menit / Tiket</span>
                                        </div>
                                        <p className="text-[10px] text-[#c4c7c8] leading-relaxed mt-2.5">
                                            Dihitung berdasarkan {analytics.barPrepCount} pesanan minuman yang berhasil diselesaikan barista.
                                        </p>
                                    </div>

                                    <div className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg flex flex-col gap-3.5 relative overflow-hidden group hover:border-[#333535] transition-all">
                                        <div className="absolute -right-4 -top-4 text-purple-400/5 pointer-events-none"><Timer size={120} /></div>
                                        <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5 border-b border-[#333535] pb-3">
                                            <Timer size={16} className="text-purple-400" />
                                            SLA WAKTU SAJI DAPUR (MAKANAN)
                                        </h3>
                                        <div className="flex items-baseline gap-1.5 mt-2">
                                            <span className="text-3xl font-black text-white font-mono">{analytics.avgKitchenSLA}</span>
                                            <span className="text-xs font-bold text-[#c4c7c8]">Menit / Tiket</span>
                                        </div>
                                        <p className="text-[10px] text-[#c4c7c8] leading-relaxed mt-2.5">
                                            Dihitung berdasarkan {analytics.kitchenPrepCount} pesanan makanan yang diproses stasiun dapur.
                                        </p>
                                    </div>
                                </section>

                                {/* Jam dan Hari Tersibuk */}
                                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg flex flex-col gap-4">
                                        <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5 border-b border-[#333535] pb-3">
                                            Hari Tersibuk Kafe
                                        </h3>
                                        <div className="flex justify-between items-center mt-2.5 bg-[#121414]/35 p-4 rounded-2xl border border-[#333535]/50">
                                            <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">HARI TERSIBUK</span>
                                            <span className="text-sm font-black text-[#ffb692]">{analytics.busiestDay}</span>
                                        </div>
                                        <div className="space-y-2 mt-2">
                                            {analytics.dayNames.map((name, idx) => {
                                                const count = analytics.dayCounts[idx]
                                                const pct = analytics.maxDayCount > 0 ? (count / analytics.maxDayCount) * 100 : 0

                                                return (
                                                    <div key={name} className="flex items-center text-[10px] font-bold text-slate-400">
                                                        <span className="w-14 shrink-0 text-slate-300">{name}</span>
                                                        <div className="flex-1 bg-[#121414] h-2.5 rounded-full overflow-hidden mx-3">
                                                            <div className="bg-[#ffb692] h-full rounded-full" style={{ width: `${pct}%` }}></div>
                                                        </div>
                                                        <span className="w-8 text-right text-white font-mono">{count}x</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg flex flex-col gap-4">
                                        <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5 border-b border-[#333535] pb-3">
                                            Jam Tersibuk Kafe
                                        </h3>
                                        <div className="flex justify-between items-center mt-2.5 bg-[#121414]/35 p-4 rounded-2xl border border-[#333535]/50">
                                            <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">JAM SIBUK PUNCAK</span>
                                            <span className="text-sm font-black text-purple-400">Jam {analytics.peakHour}:00</span>
                                        </div>
                                        <div className="space-y-2 mt-2 max-h-56 overflow-y-auto pr-1">
                                            {analytics.hourCounts.map((count, hour) => {
                                                const maxHour = Math.max(...analytics.hourCounts, 1)
                                                const pct = (count / maxHour) * 100

                                                return (
                                                    <div key={hour} className="flex items-center text-[10px] font-bold text-slate-400">
                                                        <span className="w-14 shrink-0 text-slate-300">{String(hour).padStart(2, '0')}:00</span>
                                                        <div className="flex-1 bg-[#121414] h-2.5 rounded-full overflow-hidden mx-3">
                                                            <div className="bg-purple-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                                                        </div>
                                                        <span className="w-8 text-right text-white font-mono">{count}x</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* 5. CUSTOMERS TAB */}
                        {activeTab === 'customers' && (
                            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                                {/* CSAT Divisional Rating cards */}
                                <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Pelayanan Staf', score: feedbackMetrics.avgService },
                                        { label: 'Minuman Barista', score: feedbackMetrics.avgBeverage },
                                        { label: 'Makanan Dapur', score: feedbackMetrics.avgFood },
                                        { label: 'Suasana Kafe', score: feedbackMetrics.avgAmbiance }
                                    ].map((item) => (
                                        <div key={item.label} className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-4.5 flex flex-col gap-1.5 items-center text-center hover:border-[#333535] transition-all">
                                            <span className="text-[9px] font-bold text-[#c4c7c8] uppercase tracking-wider leading-none">{item.label}</span>
                                            <span className="text-xl font-black text-white mt-1 leading-none">{item.score}</span>
                                            <div className="flex text-amber-400 mt-1">
                                                {[1, 2, 3, 4, 5].map((s) => (
                                                    <Star
                                                        key={s}
                                                        size={10}
                                                        className={s <= Math.round(parseFloat(item.score)) ? 'fill-amber-400 text-amber-400' : 'text-[#333535] fill-transparent'}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </section>

                                {/* Umpan balik pelanggan */}
                                <section className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg flex flex-col gap-4">
                                    <h3 className="text-xs font-extrabold text-white uppercase tracking-wider border-b border-[#333535] pb-4">
                                        Ulasan & Feedback Pelanggan
                                    </h3>
                                    {feedbackMetrics.ratedFeedbacks.length === 0 ? (
                                        <div className="py-8 text-center text-[#c4c7c8] text-xs font-medium">
                                            Belum ada kritik & saran yang diinput pelanggan pada periode ini.
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                                            {feedbackMetrics.ratedFeedbacks.map(f => (
                                                <div key={f.id} className="bg-[#121414]/30 hover:bg-[#121414]/65 p-4 rounded-xl border border-[#333535]/50 flex flex-col gap-2.5 transition-colors">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold">
                                                                {f.customer_name ? f.customer_name[0].toUpperCase() : 'C'}
                                                            </div>
                                                            <span className="text-xs font-bold text-white">{f.customer_name || 'Pelanggan Anonim'}</span>
                                                        </div>
                                                        <span className="text-[10px] text-amber-400 font-extrabold flex items-center gap-1">
                                                            ⭐ {f.rating ? f.rating.toFixed(1) : 'Unrated'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-300 leading-normal font-medium bg-[#1e2020]/25 p-2.5 rounded-lg border border-[#333535]/30">
                                                        "{f.feedback_text}"
                                                    </p>
                                                    <div className="text-[9px] text-slate-500 font-bold self-end">
                                                        {new Date(f.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}

                        {/* 6. INVENTORY TAB */}
                        {activeTab === 'inventory' && (
                            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                                {/* Stock KPI Cards */}
                                <section className="grid grid-cols-3 gap-4">
                                    <div className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-5 text-center">
                                        <p className="text-[9px] font-mono font-bold text-[#c4c7c8] mb-1.5 uppercase tracking-wider">Tersedia</p>
                                        <h3 className="text-2xl font-black text-emerald-550 leading-none">{inventoryStats.available}</h3>
                                    </div>
                                    <div className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-5 text-center">
                                        <p className="text-[9px] font-mono font-bold text-[#c4c7c8] mb-1.5 uppercase tracking-wider">Stok Menipis</p>
                                        <h3 className="text-2xl font-black text-amber-550 leading-none">{inventoryStats.lowStock}</h3>
                                    </div>
                                    <div className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-5 text-center">
                                        <p className="text-[9px] font-mono font-bold text-[#c4c7c8] mb-1.5 uppercase tracking-wider">Habis / Sold Out</p>
                                        <h3 className="text-2xl font-black text-red-500 leading-none">{inventoryStats.soldOut}</h3>
                                    </div>
                                </section>

                                {/* Low / Out of Stock List */}
                                <section className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg flex flex-col gap-4">
                                    <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5 border-b border-[#333535] pb-4">
                                        <PackageOpen size={16} className="text-amber-500" />
                                        PERINGATAN STOK MENIPIS & HABIS (RESTOCK ALERT)
                                    </h3>

                                    {inventoryStats.lowStockItems.length === 0 ? (
                                        <div className="py-8 text-center text-emerald-500 text-xs font-bold">
                                            ✅ Semua produk aman. Tidak ada stok menipis/habis saat ini.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-2xl border border-[#333535]">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="bg-[#121414] text-[#c4c7c8] font-bold border-b border-[#333535]">
                                                        <th className="p-3">Nama Menu</th>
                                                        <th className="p-3">Kategori</th>
                                                        <th className="p-3">Sisa Stok</th>
                                                        <th className="p-3">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {inventoryStats.lowStockItems.map(item => (
                                                        <tr key={item.id} className="border-b border-[#333535]/40 hover:bg-[#282a2b]/10">
                                                            <td className="p-3 text-white font-bold">{item.name}</td>
                                                            <td className="p-3 text-[#c4c7c8]">{item.category}</td>
                                                            <td className="p-3 font-mono font-bold text-white">
                                                                {item.variants && item.variants.length > 0
                                                                    ? `${item.variants.reduce((sum, v) => sum + v.stock, 0)}`
                                                                    : (item.stock ?? 0)
                                                                } Porsi
                                                            </td>
                                                            <td className="p-3">
                                                                <span className={`font-black text-[9px] uppercase tracking-wider ${item.status === 'low_stock' ? 'text-amber-500' : 'text-red-500'
                                                                    }`}>
                                                                    {item.status === 'low_stock' ? 'Menipis' : 'Habis'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}

                        {/* 7. RIWAYAT TIKET SECTION (Always Rendered at Bottom of Tabs) */}
                        <section className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg flex flex-col gap-5 w-full">
                            <div className="flex justify-between items-center border-b border-[#333535] pb-4">
                                <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5">
                                    <ClipboardList size={16} className="text-purple-400" />
                                    Riwayat Slip Tiket Pesanan ({sortedAndFilteredHistoryTickets.length})
                                </h3>
                                <span className="text-[9px] font-mono text-[#c4c7c8] uppercase tracking-wider">
                                    Memuat tiket yang disaring
                                </span>
                            </div>

                            {/* Search & Sort */}
                            <div className="flex flex-col sm:flex-row gap-3 bg-[#121414]/40 p-4 rounded-2xl border border-[#282a2b]">
                                <div className="relative flex-1">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#c4c7c8]">
                                        <Search size={12} />
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Cari ID tiket, pramusaji, meja, atau nama menu..."
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        className="w-full bg-[#282a2b] text-white text-xs font-bold pl-8 pr-4 py-2.5 rounded-xl border border-[#333535] outline-none focus:border-purple-400 transition-all placeholder:text-slate-600"
                                    />
                                </div>
                                <div className="relative min-w-[150px]">
                                    <select
                                        value={historySort}
                                        onChange={(e) => setHistorySort(e.target.value)}
                                        className="w-full bg-[#282a2b] text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-[#333535] outline-none focus:border-purple-400 transition-all cursor-pointer"
                                    >
                                        <option value="date_desc">Waktu: Terbaru</option>
                                        <option value="date_asc">Waktu: Terlama</option>
                                        <option value="price_desc">Nilai: Terbesar</option>
                                        <option value="price_asc">Nilai: Terkecil</option>
                                    </select>
                                </div>
                            </div>

                            {/* Tickets Render list */}
                            {displayedHistoryTickets.length === 0 ? (
                                <div className="py-8 text-center text-[#c4c7c8] text-xs font-medium bg-[#121414]/20 border border-[#333535]/30 rounded-xl">
                                    Tidak ada tiket riwayat yang cocok dengan penyaringan aktif.
                                </div>
                            ) : (
                                <div className="space-y-3.5">
                                    {displayedHistoryTickets.map(ticket => {
                                        const ticketTotal = ticket.ticket_items?.reduce((sum, item) => sum + (getTicketItemPriceLocal(item) * item.qty), 0) || 0;
                                        const isExpanded = !!expandedTickets[ticket.id];
                                        const isStaff = ticket.table_identifier.toLowerCase().startsWith('karyawan:');

                                        return (
                                            <div
                                                key={ticket.id}
                                                className={`rounded-2xl border transition-all overflow-hidden ${isStaff
                                                        ? 'bg-purple-950/5 border-purple-500/25 hover:border-purple-500/40'
                                                        : 'bg-[#121414]/30 border-[#333535] hover:border-[#444]'
                                                    }`}
                                            >
                                                {/* Header Bar */}
                                                <div
                                                    onClick={() => toggleTicketExpand(ticket.id)}
                                                    className="flex flex-wrap sm:flex-nowrap justify-between items-center p-4 cursor-pointer select-none gap-2 text-xs font-medium hover:bg-[#282a2b]/20 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${isStaff
                                                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                                                : 'bg-[#282a2b] text-[#c4c7c8] border-[#333535]'
                                                            }`}>
                                                            {isStaff ? '🧑‍💼' : '🛒'}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-white font-bold leading-none">{ticket.table_identifier}</span>
                                                                <span className={`text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none ${ticket.status === 'relayed'
                                                                        ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/20'
                                                                        : 'bg-amber-600/15 text-amber-400 border border-amber-500/20'
                                                                    }`}>
                                                                    {ticket.status === 'relayed' ? 'Relayed (POS)' : 'Draft'}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 mt-1 lowercase leading-none">waiter: {ticket.profiles?.email?.split('@')[0] || 'walk-in'}</p>
                                                        </div>
                                                    </div>

                                                    <div className="text-right flex items-center gap-4">
                                                        <div>
                                                            <span className="block text-white font-mono font-bold">Rp {ticketTotal.toLocaleString('id-ID')}</span>
                                                            <span className="block text-[8.5px] text-[#c4c7c8] mt-1 uppercase tracking-wider">{ticket.customer_count || 1} Pax</span>
                                                        </div>
                                                        {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                                    </div>
                                                </div>

                                                {/* Expanded Items */}
                                                {isExpanded && (
                                                    <div className="border-t border-[#333535]/35 p-4 bg-[#121414]/50 text-[11px] space-y-3 animate-in slide-in-from-top-1.5 duration-200">
                                                        <div className="text-[9px] font-black uppercase text-[#c4c7c8] tracking-widest leading-none mb-1">Rincian Item Pesanan:</div>
                                                        <div className="space-y-1.5 border-l-2 border-slate-750 pl-3">
                                                            {ticket.ticket_items?.map((item, idx) => (
                                                                <div key={idx} className="flex justify-between items-center text-[#c4c7c8]">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-white font-bold">{item.menus?.name || 'Item Terhapus'}</span>
                                                                        {item.notes && <span className="text-[9.5px] text-slate-500 mt-0.5">{item.notes}</span>}
                                                                    </div>
                                                                    <div className="flex gap-8 font-mono text-xs">
                                                                        <span>{item.qty}x</span>
                                                                        <span className="text-white font-bold w-20 text-right">Rp {(getTicketItemPriceLocal(item) * item.qty).toLocaleString('id-ID')}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* SLA Stasiun Detail */}
                                                        <div className="border-t border-dashed border-[#333535] pt-3 grid grid-cols-2 gap-4 text-[9.5px] font-bold text-slate-500">
                                                            <div>
                                                                <span className="block uppercase text-[8px] tracking-wider text-slate-400">STATUS PREPARASI BAR</span>
                                                                <span className={`block mt-1 font-black uppercase ${ticket.bar_status === 'ready' ? 'text-emerald-500' :
                                                                        ticket.bar_status === 'preparing' ? 'text-amber-500' : 'text-slate-400'
                                                                    }`}>
                                                                    {ticket.bar_status || 'none'}
                                                                </span>
                                                                {ticket.bar_prep_start && ticket.bar_prep_end && (
                                                                    <span className="block text-slate-400 mt-0.5 font-mono">
                                                                        Durasi: {((new Date(ticket.bar_prep_end).getTime() - new Date(ticket.bar_prep_start).getTime()) / (1000 * 60)).toFixed(1)} menit
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <span className="block uppercase text-[8px] tracking-wider text-slate-400">STATUS PREPARASI DAPUR</span>
                                                                <span className={`block mt-1 font-black uppercase ${ticket.kitchen_status === 'ready' ? 'text-emerald-500' :
                                                                        ticket.kitchen_status === 'preparing' ? 'text-amber-500' : 'text-slate-400'
                                                                    }`}>
                                                                    {ticket.kitchen_status || 'none'}
                                                                </span>
                                                                {ticket.kitchen_prep_start && ticket.kitchen_prep_end && (
                                                                    <span className="block text-slate-400 mt-0.5 font-mono">
                                                                        Durasi: {((new Date(ticket.kitchen_prep_end).getTime() - new Date(ticket.kitchen_prep_start).getTime()) / (1000 * 60)).toFixed(1)} menit
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Load More Button for Ticket History */}
                            {visibleTicketsCount < sortedAndFilteredHistoryTickets.length && (
                                <div className="flex justify-center pt-2.5 border-t border-[#333535]/35">
                                    <button
                                        onClick={() => setVisibleTicketsCount(prev => prev + 5)}
                                        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-purple-400 hover:text-purple-300 transition-colors py-2 px-4 bg-purple-500/5 hover:bg-purple-500/10 rounded-xl border border-purple-500/15 shadow-sm active:scale-95 transition-all"
                                    >
                                        Muat Lebih Banyak ({sortedAndFilteredHistoryTickets.length - visibleTicketsCount} Tiket Tersisa) <ChevronDown size={14} />
                                    </button>
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>

            {/* Widget Obrolan Bantuan Staf */}
            <ChatWidget />
        </main>
    )
}
