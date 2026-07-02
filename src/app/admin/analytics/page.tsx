// src/app/admin/analytics/page.tsx
'use client'

import { useEffect, useState, useMemo, Fragment } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { useMenuStore } from '@/store/useMenuStore'
import ChatWidget from '@/components/chat/ChatWidget'
import { ArrowLeft, Calendar, Coins, Users, Receipt, TrendingUp, Award, Clock, Timer, Loader2, RefreshCw, Search, ChevronDown, ChevronUp, User, ClipboardList, Check } from 'lucide-react'

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
        case '2_months_prev': {
            const start = new Date(nowWib.year, nowWib.month - 3, 1)
            const end = new Date(nowWib.year, nowWib.month - 2, 0)
            startStr = getWibDateParts(start).dateStr
            endStr = getWibDateParts(end).dateStr
            break
        }
        case '3_months_prev': {
            const start = new Date(nowWib.year, nowWib.month - 4, 1)
            const end = new Date(nowWib.year, nowWib.month - 3, 0)
            startStr = getWibDateParts(start).dateStr
            endStr = getWibDateParts(end).dateStr
            break
        }
        case 'year': {
            const start = new Date(nowWib.year, 0, 1)
            startStr = getWibDateParts(start).dateStr
            break
        }
        case 'prev_year': {
            const start = new Date(nowWib.year - 1, 0, 1)
            const end = new Date(nowWib.year - 1, 11, 31)
            startStr = getWibDateParts(start).dateStr
            endStr = getWibDateParts(end).dateStr
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
    const [isLoading, setIsLoading] = useState(true)
    const [timeRange, setTimeRange] = useState<string>('7d')
    const [customStartDate, setCustomStartDate] = useState<string>('')
    const [customEndDate, setCustomEndDate] = useState<string>('')

    // States untuk filter dan sort tabel penjualan menu semua item
    const [menuSearch, setMenuSearch] = useState('')
    const [menuSort, setMenuSort] = useState('qty_desc')
    const [menuFilterCategory, setMenuFilterCategory] = useState('Semua')
    const [menuFilterSubcategory, setMenuFilterSubcategory] = useState('Semua')
    const [menuFilterShowOnlyTop5, setMenuFilterShowOnlyTop5] = useState(false)
    const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})
    const [showAllProducts, setShowAllProducts] = useState(false)

    const toggleMenuExpand = (name: string) => {
        setExpandedMenus(prev => ({
            ...prev,
            [name]: !prev[name]
        }))
    }

    // States untuk Riwayat Tiket
    const [historySearch, setHistorySearch] = useState('')
    const [historySort, setHistorySort] = useState('date_desc')
    const [expandedTickets, setExpandedTickets] = useState<Record<string, boolean>>({})

    const toggleTicketExpand = (id: string) => {
        setExpandedTickets(prev => ({
            ...prev,
            [id]: !prev[id]
        }))
    }

    // Load data menus dari store
    useEffect(() => {
        fetchMenus()
    }, [fetchMenus])

    // Inisialisasi tanggal custom default (7 hari lalu s.d. hari ini)
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

    // Fetch data order tickets dari database
    const fetchData = async () => {
        setIsLoading(true)
        try {
            // Pertama, ambil data profiles untuk pemetaan email pramusaji secara lokal
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, email')

            if (profilesError) throw profilesError
            
            const emailMap = new Map<string, string>()
            profilesData?.forEach(p => {
                if (p.id && p.email) emailMap.set(p.id, p.email)
            })

            // Kedua, ambil data tiket pesanan (memuat draft & relayed untuk riwayat & audit)
            const { data, error } = await supabase
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

            if (error) throw error
            if (data) {
                // Petakan profil secara manual untuk menghindari error cache PostgREST relasi profiles
                const mappedData = (data as any[]).map(t => ({
                    ...t,
                    profiles: t.waiter_id && emailMap.has(t.waiter_id) ? { email: emailMap.get(t.waiter_id)! } : null
                }))
                setTickets(mappedData as unknown as DBOrderTicket[])
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

    // Filter tickets berdasarkan time range terpilih (WIB Align & Exclude Test Transactions)
    const filteredTickets = useMemo(() => {
        const { startStr, endStr } = getDateRangeString(timeRange, customStartDate, customEndDate)
        return tickets.filter(t => {
            // Kecualikan transaksi uji coba/testing sepenuhnya dari dasbor analitik
            if (isTestTicket(t.table_identifier)) return false

            const ticketDateStr = getWibDateParts(new Date(t.created_at)).dateStr
            return ticketDateStr >= startStr && ticketDateStr <= endStr
        })
    }, [tickets, timeRange, customStartDate, customEndDate])

    // Agregasi & kalkulasi metrik utama
    const analytics = useMemo(() => {
        // Hanya hitung tiket 'relayed' dan BUKAN pesanan karyawan untuk KPI utama pelanggan
        const customerTickets = filteredTickets.filter(t => t.status === 'relayed' && !t.table_identifier.toLowerCase().startsWith('karyawan:'))
        
        // Filter pesanan karyawan (baik draft maupun relayed)
        const staffTickets = filteredTickets.filter(t => t.table_identifier.toLowerCase().startsWith('karyawan:'))

        let totalRevenue = 0
        let totalPax = 0
        let totalTransactions = customerTickets.length

        // Agregasi per-hari untuk grafik trend
        const dailyTrends: Record<string, { revenue: number; pax: number; count: number }> = {}
        
        // Agregasi hari tersibuk (0 = Minggu, 6 = Sabtu)
        const dayCounts = Array(7).fill(0)
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

        // Agregasi jam tersibuk (24 jam)
        const hourCounts = Array(24).fill(0)

        // Agregasi performa waiter
        const waiterMap: Record<string, { email: string; orders: number; pax: number }> = {}

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
            
            // Format tanggal lokal (DD MMM) menggunakan zona WIB
            const ticketWib = getWibDateParts(ticketDate)
            const dateStr = ticketWib.day + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'][ticketWib.month - 1]
            
            // Inisialisasi trend harian
            if (!dailyTrends[dateStr]) {
                dailyTrends[dateStr] = { revenue: 0, pax: 0, count: 0 }
            }

            // Hitung Pax
            const pax = ticket.customer_count || 1
            totalPax += pax
            dailyTrends[dateStr].pax += pax
            dailyTrends[dateStr].count += 1

            // Hitung Hari & Jam Tersibuk
            dayCounts[ticketDate.getDay()] += 1
            hourCounts[ticketDate.getHours()] += 1

            // Hitung Waiter
            const waiterEmail = ticket.profiles?.email || 'Walk-In / Guest'
            const waiterId = ticket.waiter_id || 'anonymous'
            if (!waiterMap[waiterId]) {
                waiterMap[waiterId] = { email: waiterEmail.split('@')[0], orders: 0, pax: 0 }
            }
            waiterMap[waiterId].orders += 1
            waiterMap[waiterId].pax += pax

            // Hitung SLA Bar
            if (ticket.bar_prep_start && ticket.bar_prep_end) {
                const diffMs = new Date(ticket.bar_prep_end).getTime() - new Date(ticket.bar_prep_start).getTime()
                totalBarPrepTime += diffMs / (1000 * 60)
                barPrepCount += 1
            }

            // Hitung SLA Kitchen
            if (ticket.kitchen_prep_start && ticket.kitchen_prep_end) {
                const diffMs = new Date(ticket.kitchen_prep_end).getTime() - new Date(ticket.kitchen_prep_start).getTime()
                totalKitchenPrepTime += diffMs / (1000 * 60)
                kitchenPrepCount += 1
            }

            // Hitung Item Menu & Pendapatan
            let ticketRevenue = 0
            if (ticket.ticket_items) {
                ticket.ticket_items.forEach(item => {
                    if (item.menus) {
                        const qty = item.qty || 1
                        const price = getTicketItemPriceLocal(item)
                        const itemCost = price * qty
                        ticketRevenue += itemCost

                        // Agregasi menu terlaris
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

                        // Catat detail varian
                        let variantName = ''
                        if (item.notes && item.menus.variants) {
                            const match = item.notes.match(/^\[Varian:\s*([^\]]+)\]/)
                            if (match) {
                                variantName = match[1].trim()
                            }
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
        })

        // KONSUMSI KARYAWAN (INTERNAL INVOICE) AGREGASI
        let staffTotalCost = 0
        const staffConsumptionMap: Record<string, { name: string; cost: number; ordersCount: number }> = {}
        const staffItemsMap: Record<string, { name: string; qty: number; cost: number }> = {}

        staffTickets.forEach(ticket => {
            const staffName = ticket.table_identifier.replace(/^Karyawan:\s*/i, '').trim() || 'Staf Tanpa Nama'
            
            if (!staffConsumptionMap[staffName]) {
                staffConsumptionMap[staffName] = { name: staffName, cost: 0, ordersCount: 0 }
            }
            staffConsumptionMap[staffName].ordersCount += 1

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

        const waiterLeaderboard = Object.values(waiterMap)
            .sort((a, b) => b.pax - a.pax)
            .slice(0, 5)

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

        const avgBarSLA = barPrepCount > 0 ? (totalBarPrepTime / barPrepCount).toFixed(1) : '0.0'
        const avgKitchenSLA = kitchenPrepCount > 0 ? (totalKitchenPrepTime / kitchenPrepCount).toFixed(1) : '0.0'

        const avgTicket = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0
        const avgPax = totalTransactions > 0 ? (totalPax / totalTransactions).toFixed(1) : '0.0'

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
            staffTopItems
        }
    }, [filteredTickets, allShopMenus])

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

        // 1. Filter Kata Kunci Pencarian
        if (menuSearch.trim() !== '') {
            const query = menuSearch.toLowerCase().trim()
            list = list.filter(m => m.name.toLowerCase().includes(query))
        }

        // 2. Filter Kategori Utama
        if (menuFilterCategory !== 'Semua') {
            list = list.filter(m => m.category === menuFilterCategory)
        }

        // 3. Filter Subkategori
        if (menuFilterSubcategory !== 'Semua') {
            list = list.filter(m => m.subcategory === menuFilterSubcategory)
        }

        // 4. Pengurutan (Sorting)
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

        // 5. Filter Hanya Top 5 Teratas
        if (menuFilterShowOnlyTop5) {
            return list.slice(0, 5)
        }

        return list
    }, [analytics.allMenuSales, menuSearch, menuFilterCategory, menuFilterSubcategory, menuSort, menuFilterShowOnlyTop5])

    // Filter & Sort Riwayat Tiket (Mengikuti filter tanggal global)
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

    // Kalkulasi koordinat untuk SVG Line Chart (Skala 1000x200)
    const svgChartPath = useMemo(() => {
        const trends = analytics.trendData
        if (trends.length < 2) return { line: '', fill: '', points: [] }

        const width = 1000
        const height = 200
        const padding = 20

        const maxRevenue = Math.max(...trends.map(t => t.revenue), 100000)

        const points = trends.map((t, idx) => {
            const x = padding + (idx / (trends.length - 1)) * (width - padding * 2)
            const y = height - padding - (t.revenue / maxRevenue) * (height - padding * 2)
            return { x, y }
        })

        const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
        const fillPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${points[0].x.toFixed(1)} ${height - padding} Z`

        return { line: linePath, fill: fillPath, points }
    }, [analytics.trendData])

    if (!isAuthorized) {
        return (
            <main className="min-h-screen bg-[#121414] flex flex-col items-center justify-center p-6 text-center text-[#e2e2e2]">
                <div className="flex flex-col items-center gap-4 max-w-sm">
                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                    <div>
                        <h2 className="text-md font-bold text-slate-200">Memverifikasi Sesi Analitik...</h2>
                        <p className="text-[11px] text-slate-500 mt-1">Harap tunggu sebentar selagi sistem memuat dasbor kinerja kafe.</p>
                    </div>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-[#121414] text-[#e2e2e2] pb-24 antialiased selection:bg-purple-500/30 selection:text-white">
            {/* Header / TopAppBar */}
            <header className="bg-[#121414] border-b border-[#333535] flex justify-between items-center w-full px-4 md:px-10 py-4 sticky top-0 z-30 backdrop-blur-md bg-opacity-80">
                <div className="flex items-center space-x-4">
                    <a
                        href="/admin"
                        className="p-2.5 rounded-full bg-[#1e2020] hover:bg-[#333535] text-[#c4c7c8] hover:text-white active:scale-95 transition-all flex items-center justify-center border border-[#333535]"
                        title="Kembali ke Dashboard"
                    >
                        <ArrowLeft size={16} />
                    </a>
                    <div>
                        <div className="text-[9px] font-mono font-bold text-[#ffb692] tracking-[0.2em] uppercase mb-0.5">ACES LITE REPORT</div>
                        <h2 className="text-base font-extrabold text-white tracking-tight">Analisis Performa Kafe</h2>
                    </div>
                </div>
                <button
                    onClick={fetchData}
                    disabled={isLoading}
                    className="p-2.5 rounded-full bg-[#1e2020] hover:bg-[#333535] text-[#c4c7c8] hover:text-white active:scale-95 transition-all flex items-center justify-center border border-[#333535] disabled:opacity-50"
                    title="Segarkan Data"
                >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin text-purple-400' : ''} />
                </button>
            </header>

            {/* Canvas / Container */}
            <div className="max-w-4xl mx-auto p-4 md:p-10 flex flex-col gap-6 animate-in fade-in duration-300">
                
                {/* Date Picker & Controls */}
                <section className="flex flex-col gap-3 bg-[#1a1c1c] p-4 rounded-2xl border border-[#333535] shadow-lg">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <span className="flex items-center gap-2 text-xs font-bold text-[#c4c7c8] uppercase tracking-wider pl-1">
                            <Calendar size={14} className="text-purple-400" />
                            Rentang Waktu Laporan:
                        </span>
                        
                        <div className="relative flex-1 sm:max-w-[240px]">
                            <select
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value)}
                                className="w-full bg-[#282a2b] hover:bg-[#333535] text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-[#333535] focus:outline-none focus:border-purple-400 transition-all cursor-pointer appearance-none"
                            >
                                <option value="7d">7 Hari Terakhir</option>
                                <option value="14d">2 Minggu Terakhir</option>
                                <option value="21d">3 Minggu Terakhir</option>
                                <option value="28d">4 Minggu Terakhir</option>
                                <option value="month">Bulan Ini</option>
                                <option value="prev_month">Bulan Kemarin</option>
                                <option value="2_months_prev">2 Bulan Kemarin</option>
                                <option value="3_months_prev">3 Bulan Kemarin</option>
                                <option value="year">Tahun Ini</option>
                                <option value="prev_year">Tahun Lalu</option>
                                <option value="custom">Pilih Tanggal Mandiri (Custom)</option>
                            </select>
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[8px]">▼</span>
                        </div>
                    </div>

                    {/* Conditional Date Pickers for Custom Range */}
                    {timeRange === 'custom' && (
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#333535] animate-in slide-in-from-top-2 duration-200">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-mono text-[#c4c7c8] uppercase tracking-wider">Tanggal Mulai</label>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="w-full bg-[#1e2020] text-white text-xs font-bold px-3 py-2.5 rounded-xl border border-[#333535] outline-none focus:border-purple-400 transition-all"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-mono text-[#c4c7c8] uppercase tracking-wider">Tanggal Selesai</label>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="w-full bg-[#1e2020] text-white text-xs font-bold px-3 py-2.5 rounded-xl border border-[#333535] outline-none focus:border-purple-400 transition-all"
                                />
                            </div>
                        </div>
                    )}
                </section>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 text-[#c4c7c8] gap-3">
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                        <p className="text-xs font-bold uppercase tracking-wider">Menganalisis Transaksi Kafe...</p>
                    </div>
                ) : (
                    <>
                        {/* KPI Cards Grid */}
                        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Card 1: Total Omzet */}
                            <div className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-5 relative overflow-hidden group hover:border-[#333535] transition-all">
                                <div className="absolute -right-4 -top-4 text-white/5 group-hover:text-white/10 transition-colors duration-300 pointer-events-none">
                                    <Coins size={96} />
                                </div>
                                <div className="relative z-10 flex flex-col justify-between h-full">
                                    <div>
                                        <p className="text-[9px] font-mono font-bold text-[#e2e2e2] mb-1.5 uppercase tracking-wider">Total Omzet</p>
                                        <h3 className="text-base font-extrabold text-white leading-none">
                                            Rp {analytics.totalRevenue.toLocaleString('id-ID')}
                                        </h3>
                                    </div>
                                    <p className="text-[9px] text-[#c4c7c8] mt-3 flex items-center gap-1">
                                        <TrendingUp size={10} className="text-[#ffb692]" />
                                        Transaksi terdistribusi
                                    </p>
                                </div>
                            </div>

                            {/* Card 2: Total Pengunjung */}
                            <div className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-5 relative overflow-hidden group hover:border-[#333535] transition-all">
                                <div className="absolute -right-4 -top-4 text-[#ffb692]/5 group-hover:text-[#ffb692]/10 transition-colors duration-300 pointer-events-none">
                                    <Users size={96} />
                                </div>
                                <div className="relative z-10 flex flex-col justify-between h-full">
                                    <div>
                                        <p className="text-[9px] font-mono font-bold text-[#ffb692] mb-1.5 uppercase tracking-wider">Total Pengunjung</p>
                                        <h3 className="text-base font-extrabold text-white leading-none">
                                            {analytics.totalPax} <span className="text-xs text-[#c4c7c8] font-bold">Pax</span>
                                        </h3>
                                    </div>
                                    <p className="text-[9px] text-[#c4c7c8] mt-3">
                                        Rerata: {analytics.avgPax} Pax/Meja
                                    </p>
                                </div>
                            </div>

                            {/* Card 3: Total Transaksi */}
                            <div className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-5 relative overflow-hidden group hover:border-[#333535] transition-all">
                                <div className="absolute -right-4 -top-4 text-purple-400/5 group-hover:text-purple-400/10 transition-colors duration-300 pointer-events-none">
                                    <Receipt size={96} />
                                </div>
                                <div className="relative z-10 flex flex-col justify-between h-full">
                                    <div>
                                        <p className="text-[9px] font-mono font-bold text-purple-400 mb-1.5 uppercase tracking-wider">Total Transaksi</p>
                                        <h3 className="text-base font-extrabold text-white leading-none">
                                            {analytics.totalTransactions} <span className="text-xs text-[#c4c7c8] font-bold">Order</span>
                                        </h3>
                                    </div>
                                    <p className="text-[9px] text-[#c4c7c8] mt-3">
                                        Tiket Relay aktif
                                    </p>
                                </div>
                            </div>

                            {/* Card 4: Rerata Tiket */}
                            <div className="bg-[#1e2020] border border-[#282a2b] rounded-2xl p-5 relative overflow-hidden group hover:border-[#333535] transition-all">
                                <div className="absolute -right-4 -top-4 text-white/5 group-hover:text-white/10 transition-colors duration-300 pointer-events-none">
                                    <TrendingUp size={96} />
                                </div>
                                <div className="relative z-10 flex flex-col justify-between h-full">
                                    <div>
                                        <p className="text-[9px] font-mono font-bold text-[#c4c7c8] mb-1.5 uppercase tracking-wider">Rerata Tiket</p>
                                        <h3 className="text-base font-extrabold text-white leading-none">
                                            Rp {analytics.avgTicket.toLocaleString('id-ID')}
                                        </h3>
                                    </div>
                                    <p className="text-[9px] text-[#c4c7c8] mt-3">
                                        Belanja rata-rata
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Main Chart: Tren Penjualan Harian */}
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
                                    {/* Line Graph SVG Container */}
                                    <div className="w-full overflow-hidden select-none relative h-64">
                                        {/* Decorative Grid */}
                                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#333535_1px,transparent_1px),linear-gradient(to_bottom,#333535_1px,transparent_1px)] bg-[size:40px_40px] opacity-10 rounded-lg pointer-events-none"></div>
                                        
                                        <svg viewBox="0 0 1000 200" className="w-full h-full overflow-visible">
                                            <defs>
                                                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#d0bcff" stopOpacity="0.2" />
                                                    <stop offset="100%" stopColor="#d0bcff" stopOpacity="0.0" />
                                                </linearGradient>
                                            </defs>
                                            
                                            {/* Filled Area */}
                                            <path d={svgChartPath.fill} fill="url(#chartGradient)" />

                                            {/* Line Path */}
                                            <path d={svgChartPath.line} fill="none" stroke="#d0bcff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                                            {/* Dots */}
                                            {svgChartPath.points.map((p, idx) => {
                                                const trendVal = analytics.trendData[idx]
                                                return (
                                                    <g key={idx} className="group cursor-pointer">
                                                        <circle cx={p.x} cy={p.y} r="4.5" fill="#121414" stroke="#d0bcff" strokeWidth="2.5" className="transition-all hover:r-6" />
                                                        <text x={p.x} y={p.y - 10} textAnchor="middle" className="text-[8px] font-black fill-[#e2e2e2] opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 px-1.5 py-0.5 rounded shadow-lg">
                                                            Rp {(trendVal.revenue / 1000).toFixed(0)}k
                                                        </text>
                                                    </g>
                                                )
                                            })}
                                        </svg>
                                    </div>

                                    {/* Axis Labels */}
                                    <div className="w-full flex justify-between text-[8px] font-mono font-bold text-[#c4c7c8] uppercase tracking-widest border-t border-[#333535] pt-3 px-2">
                                        <span>{analytics.trendData[0].date}</span>
                                        <span>TENGAH PERIODE</span>
                                        <span>{analytics.trendData[analytics.trendData.length - 1].date}</span>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Secondary Charts Grid: Days & Hours */}
                        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Hari Tersibuk */}
                            <div className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg flex flex-col gap-4">
                                <div className="flex justify-between items-center border-b border-[#333535] pb-4">
                                    <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5">
                                        <Calendar size={16} className="text-purple-400" />
                                        HARI TERSIBUK MINGGUAN
                                    </h3>
                                    <span className="bg-[#ffb692]/10 text-[#ffb692] text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border border-[#ffb692]/20">
                                        Puncak: {analytics.busiestDay}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-3.5">
                                    {analytics.dayNames.map((name, idx) => {
                                        const count = analytics.dayCounts[idx]
                                        const maxCount = analytics.maxDayCount || 1
                                        const percentage = Math.round((count / maxCount) * 100)
                                        const isPeak = name === analytics.busiestDay

                                        return (
                                            <div key={name} className="flex items-center gap-3 text-xs leading-none">
                                                <span className={`w-14 font-bold text-left ${isPeak ? 'text-[#ffb692]' : 'text-[#c4c7c8]'}`}>{name}</span>
                                                <div className="flex-1 bg-[#282a2b] h-6 rounded-lg overflow-hidden relative border border-[#333535]/30">
                                                    <div
                                                        className={`h-full rounded-r-md transition-all duration-500 ${isPeak ? 'bg-[#ffb692]' : 'bg-[#e2e2e2]'}`}
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                    <span className="absolute inset-y-0 right-3 flex items-center text-[9px] font-mono font-bold text-[#e2e2e2]">
                                                        {count} Order
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Jam Tersibuk */}
                            <div className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg flex flex-col justify-between">
                                <div className="flex justify-between items-center border-b border-[#333535] pb-4">
                                    <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5">
                                        <Clock size={16} className="text-purple-400" />
                                        JAM SIBUK OPERASIONAL
                                    </h3>
                                </div>

                                <div className="flex-1 flex flex-col justify-end mt-4">
                                    {/* Custom vertical bar graph */}
                                    <div className="flex items-end justify-between h-44 pt-4 px-2 border-b border-[#333535] relative">
                                        {/* Grid lines */}
                                        <div className="absolute inset-0 flex flex-col justify-between opacity-5 pointer-events-none">
                                            <div className="w-full border-t border-white"></div>
                                            <div className="w-full border-t border-white"></div>
                                            <div className="w-full border-t border-white"></div>
                                            <div className="w-full border-t border-white"></div>
                                        </div>

                                        {[9, 12, 15, 17, 19, 21, 23].map((hour) => {
                                            const count = analytics.hourCounts[hour]
                                            const maxHourCount = Math.max(...analytics.hourCounts, 1)
                                            const heightPercent = Math.max(5, Math.round((count / maxHourCount) * 100))
                                            const isPeakHour = count === maxHourCount && count > 0

                                            return (
                                                <div key={hour} className="flex flex-col items-center gap-2 group w-8 relative z-10">
                                                    <div className="relative w-full flex justify-center">
                                                        <span className="absolute -top-7 text-[9px] font-mono font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity bg-[#282a2b] border border-[#333535] px-1.5 py-0.5 rounded shadow-md">
                                                            {count}
                                                        </span>
                                                        <div
                                                            className={`w-5 rounded-t-lg transition-all duration-300 group-hover:glow-active ${
                                                                isPeakHour 
                                                                    ? 'bg-[#ffb692] shadow-[0_0_15px_rgba(255,182,146,0.3)]' 
                                                                    : 'bg-white hover:bg-purple-300'
                                                            }`}
                                                            style={{ height: `${heightPercent}px` }}
                                                        />
                                                    </div>
                                                    <span className={`text-[9px] font-mono ${isPeakHour ? 'text-[#ffb692] font-bold' : 'text-[#c4c7c8]'}`}>
                                                        {hour.toString().padStart(2, '0')}:00
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <p className="text-center text-[9px] text-[#c4c7c8] uppercase tracking-wider mt-4">Arahkan kursor ke grafik batang untuk detail kuantitas</p>
                                </div>
                            </div>
                        </section>

                        {/* Bottom Grid: SLA & Leaderboard */}
                        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* SLA Performance */}
                            <div className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg flex flex-col gap-4">
                                <div className="flex items-center gap-1.5 border-b border-[#333535] pb-4">
                                    <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5">
                                        <Timer size={16} className="text-[#ffb692]" />
                                        KECEPATAN PENYAJIAN (SLA)
                                    </h3>
                                </div>

                                <div className="space-y-4">
                                    {/* Barista Speed */}
                                    <div className="bg-[#121414]/60 backdrop-blur-md rounded-xl p-4 flex justify-between items-center border border-[#282a2b] hover:border-[#ffb692]/30 transition-colors group">
                                        <div>
                                            <h4 className="font-bold text-white text-xs uppercase tracking-wider">BARISTA (MINUMAN)</h4>
                                            <p className="text-[10px] text-[#c4c7c8]">Berdasarkan {analytics.barPrepCount} pesanan selesai</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-base font-extrabold text-white font-mono flex items-baseline justify-end leading-none">
                                                {analytics.avgBarSLA} <span className="text-[10px] text-[#c4c7c8] font-bold ml-1">menit</span>
                                            </div>
                                            <span className="text-[9px] font-bold text-[#ffb692] uppercase tracking-wider block mt-1.5">
                                                {parseFloat(analytics.avgBarSLA) <= 5 ? 'Sangat Cepat' : parseFloat(analytics.avgBarSLA) <= 12 ? 'Normal' : 'Lambat'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Kitchen Speed */}
                                    <div className="bg-[#121414]/60 backdrop-blur-md rounded-xl p-4 flex justify-between items-center border border-[#282a2b] hover:border-purple-500/30 transition-colors group">
                                        <div>
                                            <h4 className="font-bold text-white text-xs uppercase tracking-wider">KITCHEN (MAKANAN)</h4>
                                            <p className="text-[10px] text-[#c4c7c8]">Berdasarkan {analytics.kitchenPrepCount} pesanan selesai</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-base font-extrabold text-white font-mono flex items-baseline justify-end leading-none">
                                                {analytics.avgKitchenSLA} <span className="text-[10px] text-[#c4c7c8] font-bold ml-1">menit</span>
                                            </div>
                                            <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider block mt-1.5">
                                                {parseFloat(analytics.avgKitchenSLA) <= 12 ? 'Sangat Cepat' : parseFloat(analytics.avgKitchenSLA) <= 20 ? 'Normal' : 'Lambat'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Leaderboard Pramusaji */}
                            <div className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg flex flex-col gap-4">
                                <div className="flex items-center gap-1.5 border-b border-[#333535] pb-4">
                                    <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5">
                                        <Award size={16} className="text-white" />
                                        LEADERBOARD PRAMUSAJI
                                    </h3>
                                </div>

                                {analytics.waiterLeaderboard.length === 0 ? (
                                    <div className="py-8 text-center text-[#c4c7c8] text-xs font-medium">
                                        Belum ada aktivitas pelayanan tercatat.
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {analytics.waiterLeaderboard.map((waiter, index) => (
                                            <div key={waiter.email} className="flex justify-between items-center bg-[#282a2b]/35 hover:bg-[#282a2b]/60 p-3 rounded-xl border border-transparent hover:border-[#333535] transition-all">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black leading-none ${
                                                        index === 0 ? 'bg-[#ffb692] text-[#341100] shadow-[0_0_12px_rgba(255,182,146,0.3)]' :
                                                        index === 1 ? 'bg-[#c4c7c8] text-[#121414]' :
                                                        index === 2 ? 'bg-[#ffb692]/40 text-[#ffb692]' : 'bg-[#121414] text-[#c4c7c8]'
                                                    }`}>
                                                        {index + 1}
                                                    </span>
                                                    <span className="font-bold text-[#e2e2e2] text-xs lowercase leading-none">{waiter.email}</span>
                                                </div>
                                                <div className="text-right leading-none">
                                                    <span className="text-xs font-extrabold text-white">{waiter.pax} Pax</span>
                                                    <span className="block text-[8px] text-[#c4c7c8] mt-1.5 uppercase tracking-wider">{waiter.orders} Tiket</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Top Menu Scrollable List */}
                        <section className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-5 shadow-lg w-full overflow-hidden flex flex-col gap-4">
                            <div className="flex justify-between items-center border-b border-[#333535] pb-4">
                                <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5">
                                    <Award size={16} className="text-[#ffb692]" />
                                    DAFTAR MENU TERLARIS (TOP 5)
                                </h3>
                            </div>

                            {analytics.topMenus.length === 0 ? (
                                <div className="py-8 text-center text-[#c4c7c8] text-xs font-medium">
                                    Belum ada transaksi makanan/minuman terjual.
                                </div>
                            ) : (
                                <div className="flex space-x-4 overflow-x-auto pb-3 snap-x">
                                    {analytics.topMenus.map((menu, index) => {
                                        // Cari varian terlaris untuk item ini
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
                            <div className="flex flex-col gap-1 border-b border-[#333535] pb-4">
                                <h3 className="flex items-center text-xs font-extrabold text-white uppercase tracking-wider gap-1.5">
                                    <Receipt size={16} className="text-[#ffb692]" />
                                    Laporan Penjualan Semua Produk
                                </h3>
                                <p className="text-[10px] text-[#c4c7c8] font-medium leading-none mt-1">Daftar penjualan lengkap seluruh item menu yang ada di kafe</p>
                            </div>

                            {/* Controls */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-[#121414]/40 p-3.5 rounded-2xl border border-[#282a2b]">
                                {/* Search */}
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

                                {/* Category */}
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

                                {/* Subcategory */}
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

                                {/* Sort */}
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

                            {/* Table */}
                            <div className="overflow-x-auto rounded-2xl border border-[#333535]">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#121414] text-[#c4c7c8] font-bold text-[10px] uppercase tracking-wider border-b border-[#333535]">
                                            <th className="py-3 px-4 w-14 text-center">Rank</th>
                                            <th className="py-3 px-4">Nama Produk</th>
                                            <th className="py-3 px-4">Kategori / Sub</th>
                                            <th className="py-3 px-4 text-center">Terjual</th>
                                            <th className="py-3 px-4 text-right">Omzet</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedAndFilteredMenuSales.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-[#c4c7c8] text-xs font-medium bg-[#1e2020]/20">
                                                    Tidak ada produk yang cocok dengan pencarian / filter aktif.
                                                </td>
                                            </tr>
                                        ) : (
                                            (showAllProducts ? sortedAndFilteredMenuSales : sortedAndFilteredMenuSales.slice(0, 10)).map((menu, idx) => {
                                                // Cari rank absolut keseluruhan (disortir berdasarkan penjualan Qty desc)
                                                const overallRank = [...analytics.allMenuSales]
                                                    .sort((a, b) => b.qty - a.qty)
                                                    .findIndex(m => m.name === menu.name) + 1;

                                                const hasVariants = Object.keys(menu.variantsSold || {}).length > 0;
                                                const isExpanded = !!expandedMenus[menu.name];

                                                return (
                                                    <Fragment key={menu.name}>
                                                        <tr className="border-b border-[#333535]/40 hover:bg-[#282a2b]/20 transition-colors text-xs font-medium">
                                                            <td className="py-3 px-4 text-center">
                                                                <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[9px] font-black ${
                                                                    overallRank === 1 ? 'bg-[#ffb692] text-[#341100]' :
                                                                    overallRank <= 5 ? 'bg-purple-955/60 text-purple-300 border border-purple-500/30' :
                                                                    'bg-[#282a2b] text-[#c4c7c8]'
                                                                }`}>
                                                                    {overallRank}
                                                                </span>
                                                            </td>
                                                            <td 
                                                                className="py-3 px-4 text-white font-bold cursor-pointer select-none"
                                                                onClick={() => hasVariants && toggleMenuExpand(menu.name)}
                                                            >
                                                                <div className="flex items-center gap-1.5 hover:text-[#ffb692] transition-colors">
                                                                    <span>{menu.name}</span>
                                                                    {hasVariants && (
                                                                        <span className="text-[8px] font-mono text-[#ffb692] bg-[#ffb692]/10 px-1.5 py-0.5 rounded border border-[#ffb692]/20 whitespace-nowrap">
                                                                            {isExpanded ? '▲ Tutup Varian' : '▼ Detail Varian'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <span className="text-[9px] font-mono text-[#c4c7c8] bg-[#282a2b] px-2 py-0.5 rounded border border-[#333535]/65">
                                                                    {menu.category} {menu.subcategory && `/ ${menu.subcategory}`}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4 text-center font-bold text-white font-mono">{menu.qty}x</td>
                                                            <td className="py-3 px-4 text-right font-mono text-white">
                                                                Rp {menu.revenue.toLocaleString('id-ID')}
                                                            </td>
                                                        </tr>
                                                        {isExpanded && hasVariants && (
                                                            <tr className="bg-[#121414]/30 border-b border-[#333535]/40 text-[10px] font-semibold text-slate-400">
                                                                <td colSpan={2}></td>
                                                                <td colSpan={3} className="py-2.5 px-4">
                                                                    <div className="flex flex-col gap-1.5 pl-4 border-l border-slate-700 py-1">
                                                                        <div className="text-[9px] font-mono text-[#c4c7c8] uppercase tracking-wider mb-0.5">Rincian Penjualan Varian:</div>
                                                                        {Object.entries(menu.variantsSold)
                                                                            .sort((a, b) => b[1].qty - a[1].qty) // sort by qty desc
                                                                            .map(([varName, varData]) => (
                                                                                <div key={varName} className="flex justify-between items-center max-w-sm">
                                                                                    <span>└ Varian: <strong className="text-[#ffb692]">{varName}</strong></span>
                                                                                    <span className="font-mono text-[#e2e2e2]">{varData.qty}x terjual <span className="text-slate-500">({(varData.qty / menu.qty * 100).toFixed(0)}%)</span> — Rp {varData.revenue.toLocaleString('id-ID')}</span>
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
                            </div>

                            {sortedAndFilteredMenuSales.length > 10 && (
                                <div className="flex justify-center border-t border-[#333535]/30 pt-4 mt-2">
                                    <button
                                        onClick={() => setShowAllProducts(!showAllProducts)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-[#ffb692] hover:text-[#ffd8c2] transition-colors py-2 px-4 bg-[#ffb692]/5 hover:bg-[#ffb692]/10 rounded-xl border border-[#ffb692]/15 shadow-sm active:scale-95 transition-all duration-200"
                                    >
                                        {showAllProducts ? (
                                            <>Tampilkan Lebih Sedikit (10 Produk) <ChevronUp size={14} /></>
                                        ) : (
                                            <>Lihat secara lengkap ({sortedAndFilteredMenuSales.length} Produk) <ChevronDown size={14} /></>
                                        )}
                                    </button>
                                </div>
                            )}
                        </section>

                        {/* SUB-PANEL KONSUMSI KARYAWAN */}
                        {analytics.staffTickets.length > 0 && (
                            <section className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-6 flex flex-col gap-6 mt-6">
                                <div className="flex items-center gap-3 border-b border-[#333535] pb-4">
                                    <div className="p-2 bg-purple-950/40 text-purple-300 rounded-xl border border-purple-500/20">
                                        <Users size={20} />
                                    </div>
                                    <div>
                                        <h2 className="font-extrabold text-white text-base leading-none">Konsumsi Internal & Tagihan Karyawan</h2>
                                        <p className="text-[10px] text-[#c4c7c8] mt-1.5 font-medium">Rekapitulasi bill gantung konsumsi staf (dikecualikan dari laporan utama kafe)</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-[#121414]/50 border border-[#333535]/30 rounded-2xl p-5 flex items-center justify-between">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-mono font-bold text-purple-400 uppercase tracking-wider">Total Tagihan Karyawan</span>
                                            <h3 className="text-xl font-black text-white">Rp {analytics.staffTotalCost.toLocaleString('id-ID')}</h3>
                                        </div>
                                        <div className="text-purple-400/20">
                                            <Coins size={40} />
                                        </div>
                                    </div>
                                    <div className="bg-[#121414]/50 border border-[#333535]/30 rounded-2xl p-5 flex items-center justify-between">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-mono font-bold text-purple-400 uppercase tracking-wider">Total Sesi Makan Staf</span>
                                            <h3 className="text-xl font-black text-white">{analytics.staffTickets.length} Transaksi</h3>
                                        </div>
                                        <div className="text-purple-400/20">
                                            <Users size={40} />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-3">
                                        <h4 className="text-[11px] font-mono font-bold text-[#c4c7c8] uppercase tracking-wider pl-1">Akumulasi Per Karyawan</h4>
                                        <div className="overflow-x-auto rounded-2xl border border-[#333535]/60 bg-[#121414]/20">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="bg-[#121414] text-[#c4c7c8] font-bold text-[9px] uppercase tracking-wider border-b border-[#333535]">
                                                        <th className="py-2.5 px-4">Nama Staf</th>
                                                        <th className="py-2.5 px-4 text-center">Jumlah Sesi</th>
                                                        <th className="py-2.5 px-4 text-right">Total Tagihan</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {analytics.staffLeaderboard.map(staff => (
                                                        <tr key={staff.name} className="border-b border-[#333535]/20 hover:bg-[#282a2b]/10 text-white font-medium">
                                                            <td className="py-2.5 px-4 font-bold">{staff.name}</td>
                                                            <td className="py-2.5 px-4 text-center font-mono text-[#c4c7c8]">{staff.ordersCount}x</td>
                                                            <td className="py-2.5 px-4 text-right font-mono text-[#ffb692]">Rp {staff.cost.toLocaleString('id-ID')}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <h4 className="text-[11px] font-mono font-bold text-[#c4c7c8] uppercase tracking-wider pl-1">Item Populer Staf</h4>
                                        <div className="overflow-x-auto rounded-2xl border border-[#333535]/60 bg-[#121414]/20">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="bg-[#121414] text-[#c4c7c8] font-bold text-[9px] uppercase tracking-wider border-b border-[#333535]">
                                                        <th className="py-2.5 px-4">Nama Menu</th>
                                                        <th className="py-2.5 px-4 text-center">Terjual</th>
                                                        <th className="py-2.5 px-4 text-right">Nilai Barang</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {analytics.staffTopItems.slice(0, 5).map(item => (
                                                        <tr key={item.name} className="border-b border-[#333535]/20 hover:bg-[#282a2b]/10 text-[#e2e2e2]">
                                                            <td className="py-2.5 px-4 font-bold text-white">{item.name}</td>
                                                            <td className="py-2.5 px-4 text-center font-mono text-[#c4c7c8]">{item.qty}x</td>
                                                            <td className="py-2.5 px-4 text-right font-mono">Rp {item.cost.toLocaleString('id-ID')}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* PANEL RIWAYAT TIKET */}
                        <section className="bg-[#1e2020] border border-[#282a2b] rounded-3xl p-6 flex flex-col gap-6 mt-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#333535] pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-950/40 text-purple-300 rounded-xl border border-purple-500/20">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <h2 className="font-extrabold text-white text-base leading-none">Riwayat Tiket Transaksi</h2>
                                        <p className="text-[10px] text-[#c4c7c8] mt-1.5 font-medium">Melacak seluruh lembar tiket transaksi yang terdaftar di sistem (mengikuti filter tanggal aktif)</p>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Cari meja, waiter, menu..."
                                            value={historySearch}
                                            onChange={(e) => setHistorySearch(e.target.value)}
                                            className="w-full sm:w-64 bg-[#282a2b] text-white text-xs font-bold pl-9 pr-4 py-2.5 rounded-xl border border-[#333535] outline-none focus:border-purple-400 transition-all placeholder:font-medium placeholder:text-[#c4c7c8]/50"
                                        />
                                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c4c7c8]/50" />
                                    </div>

                                    <div className="relative">
                                        <select
                                            value={historySort}
                                            onChange={(e) => setHistorySort(e.target.value)}
                                            className="bg-[#282a2b] text-white text-xs font-bold pl-3 pr-8 py-2.5 rounded-xl border border-[#333535] outline-none focus:border-purple-400 transition-all cursor-pointer appearance-none min-w-[160px]"
                                        >
                                            <option value="date_desc">Waktu: Terbaru</option>
                                            <option value="date_asc">Waktu: Terlama</option>
                                            <option value="price_desc">Tagihan: Terbesar</option>
                                            <option value="price_asc">Tagihan: Terkecil</option>
                                        </select>
                                        <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#c4c7c8]" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                {sortedAndFilteredHistoryTickets.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-[#c4c7c8]/50 gap-2 border border-dashed border-[#333535] rounded-2xl">
                                        <ClipboardList size={32} />
                                        <p className="text-xs font-medium">Tidak ada tiket transaksi yang ditemukan.</p>
                                    </div>
                                ) : (
                                    sortedAndFilteredHistoryTickets.map(ticket => {
                                        const totalTicketAmount = ticket.ticket_items?.reduce((sum, item) => sum + (getTicketItemPriceLocal(item) * item.qty), 0) || 0;
                                        const isStaff = ticket.table_identifier.toLowerCase().startsWith('karyawan:');
                                        const displayTable = isStaff ? ticket.table_identifier.replace(/^Karyawan:\s*/i, '') : ticket.table_identifier;
                                        const isExpanded = !!expandedTickets[ticket.id];

                                        const tParts = getWibDateParts(new Date(ticket.created_at));
                                        const formattedTime = `${String(tParts.day).padStart(2, '0')}/${String(tParts.month).padStart(2, '0')}/${tParts.year} ${new Date(ticket.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB`;

                                        return (
                                            <div 
                                                key={ticket.id} 
                                                className={`border border-[#333535]/40 rounded-2xl overflow-hidden transition-all bg-[#1e2020]/30 hover:border-[#333535]`}
                                            >
                                                <div className="bg-[#121414]/30 px-5 py-3.5 flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[#333535]/30">
                                                     <div className="flex items-center gap-2.5">
                                                         {isStaff ? (
                                                             <span className="bg-purple-950/60 text-purple-300 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-purple-500/25">
                                                                 Staf
                                                             </span>
                                                         ) : (
                                                             <span className="bg-blue-950/60 text-blue-300 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-blue-500/25">
                                                                 Meja
                                                             </span>
                                                         )}
                                                         <h3 className="font-extrabold text-white text-base uppercase leading-none">
                                                             {displayTable}
                                                         </h3>
                                                         <span className="text-[10px] text-[#c4c7c8] font-bold">
                                                             ({ticket.customer_count || 1} Pax)
                                                         </span>
                                                     </div>

                                                     <div className="flex flex-wrap items-center gap-3 sm:text-right">
                                                         <span className="text-[10px] font-mono text-[#c4c7c8] font-semibold">
                                                             {formattedTime}
                                                         </span>
                                                         
                                                         {ticket.status === 'relayed' ? (
                                                             <span className="bg-emerald-950/40 text-emerald-400 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                                                 <Check size={10} className="stroke-[3]" />
                                                                 Telah di-input
                                                             </span>
                                                         ) : (
                                                             <span className="bg-amber-950/40 text-amber-400 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                                                                 <Clock size={10} />
                                                                 Draft / Antrean
                                                             </span>
                                                         )}

                                                         <button
                                                             onClick={() => toggleTicketExpand(ticket.id)}
                                                             className="text-[10px] font-bold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-0.5 ml-2"
                                                         >
                                                             {isExpanded ? (
                                                                 <>Tutup <ChevronUp size={12} /></>
                                                             ) : (
                                                                 <>Rincian <ChevronDown size={12} /></>
                                                             )}
                                                         </button>
                                                     </div>
                                                 </div>

                                                 {isExpanded && (
                                                     <div className="p-4 border-b border-[#333535]/30 bg-[#121414]/20 flex flex-col gap-2.5 animate-in fade-in duration-200">
                                                         <div className="text-[9px] font-mono text-[#c4c7c8] uppercase tracking-wider">Item dalam Tiket:</div>
                                                         <div className="flex flex-col gap-2">
                                                             {ticket.ticket_items?.map((item, i) => {
                                                                 const itemPrice = getTicketItemPriceLocal(item);
                                                                 return (
                                                                     <div key={i} className="flex justify-between items-center text-xs text-[#e2e2e2]">
                                                                         <div className="flex items-center gap-2">
                                                                             <span className="font-mono text-purple-400 bg-purple-500/5 border border-purple-500/10 px-1.5 py-0.5 rounded text-[10px]">{item.qty}x</span>
                                                                             <span className="font-bold text-white">{item.menus?.name || 'Menu Unknown'}</span>
                                                                             {item.notes && (
                                                                                 <span className="text-[10px] text-rose-400 italic font-bold">({item.notes})</span>
                                                                             )}
                                                                         </div>
                                                                         <div className="font-mono">
                                                                             Rp {(itemPrice * item.qty).toLocaleString('id-ID')}
                                                                         </div>
                                                                     </div>
                                                                 )
                                                             })}
                                                         </div>
                                                     </div>
                                                 )}

                                                 <div className="px-5 py-2.5 bg-[#121414]/10 flex justify-between items-center text-[10px]">
                                                     <div className="text-[#c4c7c8]/60">
                                                         Waiter: <span className="font-bold text-white">{ticket.profiles?.email?.split('@')[0] || 'System / Guest'}</span>
                                                     </div>
                                                     <div className="font-mono text-[#e2e2e2]">
                                                         Nilai Tiket: <strong className="text-white text-xs">Rp {totalTicketAmount.toLocaleString('id-ID')}</strong>
                                                     </div>
                                                 </div>
                                             </div>
                                         )
                                     })
                                 )}
                             </div>
                         </section>
                     </>
                )}
            </div>
            <ChatWidget />
        </main>
    )
}
