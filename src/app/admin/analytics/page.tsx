// src/app/admin/analytics/page.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { useMenuStore } from '@/store/useMenuStore'
import ChatWidget from '@/components/chat/ChatWidget'
import { ArrowLeft, Calendar, Coins, Users, Receipt, TrendingUp, Award, Clock, Timer, Loader2, RefreshCw } from 'lucide-react'

interface TicketItemWithMenu {
    qty: number
    menus: {
        name: string
        price: number
        category: string
        subcategory: string | null
    } | null
}

interface DBOrderTicket {
    id: string
    created_at: string
    customer_count: number
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

const getDateRange = (range: string, customStart?: string, customEnd?: string) => {
    const now = new Date()
    let startDate = new Date()
    let endDate = new Date()

    // Standarisasi jam ke batas akhir hari untuk cakupan penuh
    endDate.setHours(23, 59, 59, 999)

    switch (range) {
        case '7d':
            startDate.setDate(now.getDate() - 7)
            startDate.setHours(0, 0, 0, 0)
            break
        case '14d':
            startDate.setDate(now.getDate() - 14)
            startDate.setHours(0, 0, 0, 0)
            break
        case '21d':
            startDate.setDate(now.getDate() - 21)
            startDate.setHours(0, 0, 0, 0)
            break
        case '28d':
            startDate.setDate(now.getDate() - 28)
            startDate.setHours(0, 0, 0, 0)
            break
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            startDate.setHours(0, 0, 0, 0)
            break
        case 'prev_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            startDate.setHours(0, 0, 0, 0)
            endDate = new Date(now.getFullYear(), now.getMonth(), 0)
            endDate.setHours(23, 59, 59, 999)
            break
        case '2_months_prev':
            startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1)
            startDate.setHours(0, 0, 0, 0)
            endDate = new Date(now.getFullYear(), now.getMonth() - 1, 0)
            endDate.setHours(23, 59, 59, 999)
            break
        case '3_months_prev':
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
            startDate.setHours(0, 0, 0, 0)
            endDate = new Date(now.getFullYear(), now.getMonth() - 2, 0)
            endDate.setHours(23, 59, 59, 999)
            break
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1)
            startDate.setHours(0, 0, 0, 0)
            break
        case 'prev_year':
            startDate = new Date(now.getFullYear() - 1, 0, 1)
            startDate.setHours(0, 0, 0, 0)
            endDate = new Date(now.getFullYear() - 1, 11, 31)
            endDate.setHours(23, 59, 59, 999)
            break
        case 'custom':
            if (customStart) {
                startDate = new Date(customStart)
                startDate.setHours(0, 0, 0, 0)
            } else {
                startDate.setDate(now.getDate() - 7)
                startDate.setHours(0, 0, 0, 0)
            }
            if (customEnd) {
                endDate = new Date(customEnd)
                endDate.setHours(23, 59, 59, 999)
            }
            break
    }
    return { startDate, endDate }
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

            // Kedua, ambil data tiket pesanan
            const { data, error } = await supabase
                .from('order_tickets')
                .select(`
                    id,
                    created_at,
                    customer_count,
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
                        menus (
                            name,
                            price,
                            category,
                            subcategory
                        )
                    )
                `)
                .eq('status', 'relayed') // Hanya hitung pesanan yang di-relay
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

    // Filter tickets berdasarkan time range terpilih
    const filteredTickets = useMemo(() => {
        const { startDate, endDate } = getDateRange(timeRange, customStartDate, customEndDate)
        return tickets.filter(t => {
            const ticketDate = new Date(t.created_at)
            return ticketDate >= startDate && ticketDate <= endDate
        })
    }, [tickets, timeRange, customStartDate, customEndDate])

    // Agregasi & kalkulasi metrik utama
    const analytics = useMemo(() => {
        let totalRevenue = 0
        let totalPax = 0
        let totalTransactions = filteredTickets.length

        // Agregasi per-hari untuk grafik trend
        const dailyTrends: Record<string, { revenue: number; pax: number; count: number }> = {}
        
        // Agregasi hari tersibuk (0 = Minggu, 6 = Sabtu)
        const dayCounts = Array(7).fill(0)
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

        // Agregasi jam tersibuk (24 jam)
        const hourCounts = Array(24).fill(0)

        // Agregasi performa waiter
        const waiterMap: Record<string, { email: string; orders: number; pax: number }> = {}

        // Agregasi menu terlaris (inisialisasi dari daftar menu aktif kafe untuk menampilkan item 0 penjualan)
        const itemSalesMap: Record<string, { name: string; qty: number; category: string; subcategory: string; price: number; revenue: number }> = {}
        
        allShopMenus.forEach(m => {
            if (m.menu_type !== 'bundle') {
                itemSalesMap[m.name] = {
                    name: m.name,
                    qty: 0,
                    category: m.category,
                    subcategory: m.subcategory || 'Lainnya',
                    price: m.price,
                    revenue: 0
                }
            }
        })

        // SLA Persiapan Stasiun
        let totalBarPrepTime = 0
        let barPrepCount = 0
        let totalKitchenPrepTime = 0
        let kitchenPrepCount = 0

        filteredTickets.forEach(ticket => {
            const ticketDate = new Date(ticket.created_at)
            
            // Format tanggal lokal (DD MMM)
            const dateStr = ticketDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
            
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
                totalBarPrepTime += diffMs / (1000 * 60) // convert to minutes
                barPrepCount += 1
            }

            // Hitung SLA Kitchen
            if (ticket.kitchen_prep_start && ticket.kitchen_prep_end) {
                const diffMs = new Date(ticket.kitchen_prep_end).getTime() - new Date(ticket.kitchen_prep_start).getTime()
                totalKitchenPrepTime += diffMs / (1000 * 60) // convert to minutes
                kitchenPrepCount += 1
            }

            // Hitung Item Menu & Pendapatan
            let ticketRevenue = 0
            if (ticket.ticket_items) {
                ticket.ticket_items.forEach(item => {
                    if (item.menus) {
                        const qty = item.qty || 1
                        const price = item.menus.price || 0
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
                                price: price,
                                revenue: 0
                            }
                        }
                        itemSalesMap[menuId].qty += qty
                        itemSalesMap[menuId].revenue += itemCost
                    }
                })
            }
            totalRevenue += ticketRevenue
            dailyTrends[dateStr].revenue += ticketRevenue
        })

        // Ubah trend harian menjadi array dan balik agar kronologis (karena fetch descending)
        const trendData = Object.keys(dailyTrends).map(date => ({
            date,
            ...dailyTrends[date]
        })).reverse()

        // Ambil top 5 waiter
        const waiterLeaderboard = Object.values(waiterMap)
            .sort((a, b) => b.pax - a.pax)
            .slice(0, 5)

        // Ambil top 5 menu terlaris yang memiliki volume penjualan > 0
        const topMenus = Object.values(itemSalesMap)
            .filter(m => m.qty > 0)
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5)

        const allMenuSales = Object.values(itemSalesMap)

        // Cari hari tersibuk
        let maxDayIndex = 0
        let maxDayCount = 0
        dayCounts.forEach((count, idx) => {
            if (count > maxDayCount) {
                maxDayCount = count
                maxDayIndex = idx
            }
        })
        const busiestDay = maxDayCount > 0 ? dayNames[maxDayIndex] : 'Tidak ada data'

        // Hitung rata-rata SLA
        const avgBarSLA = barPrepCount > 0 ? (totalBarPrepTime / barPrepCount).toFixed(1) : '0.0'
        const avgKitchenSLA = kitchenPrepCount > 0 ? (totalKitchenPrepTime / kitchenPrepCount).toFixed(1) : '0.0'

        // Rata-rata transaksi & pax
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
            kitchenPrepCount
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
                                    {analytics.topMenus.map((menu, index) => (
                                        <div key={menu.name} className="min-w-[220px] flex-shrink-0 bg-[#121414]/50 backdrop-blur-md rounded-xl p-5 border border-[#333535] relative overflow-hidden group snap-start">
                                            <div className="absolute -right-4 -bottom-4 text-6xl font-black text-[#282a2b]/30 group-hover:text-white/5 transition-colors pointer-events-none">
                                                #{index + 1}
                                            </div>
                                            <span className="inline-block bg-[#ffb692]/10 text-[#ffb692] text-[8px] font-black px-2 py-0.5 rounded tracking-wider uppercase border border-[#ffb692]/20">
                                                {menu.category}
                                            </span>
                                            <h4 className="font-extrabold text-white text-xs leading-snug mt-3 mb-6 min-h-[2rem]">
                                                {menu.name}
                                            </h4>
                                            <div className="border-t border-dashed border-[#333535] pt-3 flex justify-between items-end relative z-10">
                                                <span className="text-[9px] text-[#c4c7c8] tracking-wider uppercase font-bold">VOLUME</span>
                                                <span className="text-lg font-extrabold text-white font-mono leading-none">{menu.qty}x</span>
                                            </div>
                                        </div>
                                    ))}
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
                                            sortedAndFilteredMenuSales.map((menu, idx) => {
                                                // Cari rank absolut keseluruhan (disortir berdasarkan penjualan Qty desc)
                                                const overallRank = [...analytics.allMenuSales]
                                                    .sort((a, b) => b.qty - a.qty)
                                                    .findIndex(m => m.name === menu.name) + 1;

                                                return (
                                                    <tr key={menu.name} className="border-b border-[#333535]/40 hover:bg-[#282a2b]/20 transition-colors text-xs font-medium">
                                                        <td className="py-3 px-4 text-center">
                                                            <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[9px] font-black ${
                                                                overallRank === 1 ? 'bg-[#ffb692] text-[#341100]' :
                                                                overallRank <= 5 ? 'bg-purple-950/60 text-purple-300 border border-purple-500/30' :
                                                                'bg-[#282a2b] text-[#c4c7c8]'
                                                            }`}>
                                                                {overallRank}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-white font-bold">{menu.name}</td>
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
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </>
                )}
            </div>
            <ChatWidget />
        </main>
    )
}
