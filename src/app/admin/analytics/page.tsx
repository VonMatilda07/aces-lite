// src/app/admin/analytics/page.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { getTicketItemPrice } from '@/store/useMenuStore'
import ChatWidget from '@/components/chat/ChatWidget'
import { ArrowLeft, Calendar, DollarSign, Users, ShoppingBag, Clock, TrendingUp, Award, Activity, Loader2, RefreshCw } from 'lucide-react'

interface TicketItemWithMenu {
    qty: number
    menus: {
        name: string
        price: number
        category: string
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

export default function AdminAnalyticsPage() {
    const { role, status } = useAuthStore()
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [tickets, setTickets] = useState<DBOrderTicket[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'month'>('7d')

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
                            category
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
        const now = new Date()
        return tickets.filter(t => {
            const ticketDate = new Date(t.created_at)
            const diffTime = Math.abs(now.getTime() - ticketDate.getTime())
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            if (timeRange === '7d') {
                return diffDays <= 7
            } else if (timeRange === '30d') {
                return diffDays <= 30
            } else if (timeRange === 'month') {
                // Filter bulan berjalan
                return ticketDate.getMonth() === now.getMonth() && ticketDate.getFullYear() === now.getFullYear()
            }
            return true
        })
    }, [tickets, timeRange])

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

        // Agregasi menu terlaris
        const itemSalesMap: Record<string, { name: string; qty: number; category: string }> = {}

        // SLA Persiapan Stasiun
        let totalBarPrepTime = 0
        let barPrepCount = 0
        let totalKitchenPrepTime = 0
        let kitchenPrepCount = 0

        filteredTickets.forEach(ticket => {
            const ticketDate = new Date(ticket.created_at)
            
            // Format tanggal lokal (YYYY-MM-DD)
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
                            itemSalesMap[menuId] = { name: item.menus.name, qty: 0, category: item.menus.category }
                        }
                        itemSalesMap[menuId].qty += qty
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

        // Ambil top 5 menu terlaris
        const topMenus = Object.values(itemSalesMap)
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5)

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
            avgBarSLA,
            avgKitchenSLA,
            barPrepCount,
            kitchenPrepCount
        }
    }, [filteredTickets])

    // Kalkulasi koordinat untuk SVG Line Chart
    const svgChartPath = useMemo(() => {
        const trends = analytics.trendData
        if (trends.length < 2) return { line: '', fill: '', points: [] }

        const width = 500
        const height = 150
        const padding = 15

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
            <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
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
        <main className="min-h-screen bg-slate-50 text-slate-800 pb-20">
            {/* HEADER */}
            <header className="bg-slate-900 text-white p-5 sticky top-0 z-20 shadow-md border-b border-slate-800">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <a
                            href="/admin"
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors active:scale-95"
                            title="Kembali ke Dashboard"
                        >
                            <ArrowLeft size={16} />
                        </a>
                        <div>
                            <p className="text-[9px] font-black text-emerald-400 tracking-[0.2em] uppercase">ACES LITE REPORT</p>
                            <h1 className="text-base font-black">Analisis Performa Kafe</h1>
                        </div>
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={isLoading}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl transition-all active:scale-95 border border-slate-700 shadow-sm flex items-center justify-center"
                        title="Segarkan Data"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin text-emerald-400' : ''} />
                    </button>
                </div>
            </header>

            <div className="max-w-4xl mx-auto p-4 flex flex-col gap-5 mt-2 animate-in fade-in duration-300">
                {/* DATE FILTER BUTTONS */}
                <div className="flex justify-between items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                    <span className="flex items-center gap-2 text-xs font-bold text-slate-400 pl-2">
                        <Calendar size={14} className="text-indigo-500" />
                        Rentang Waktu:
                    </span>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        {(['7d', '30d', 'month'] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                    timeRange === range
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {range === '7d' ? '7 Hari' : range === '30d' ? '30 Hari' : 'Bulan Ini'}
                            </button>
                        ))}
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-28 text-slate-400 gap-3">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        <p className="text-xs font-bold uppercase tracking-wider">Menganalisis Transaksi Kafe...</p>
                    </div>
                ) : (
                    <>
                        {/* KPI GRID CARDS */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Card 1: Omzet */}
                            <div className="bg-gradient-to-br from-indigo-500 to-indigo-650 text-white p-4 rounded-3xl shadow-sm border border-indigo-400/20 flex flex-col gap-2 relative overflow-hidden">
                                <div className="absolute right-3 top-3 opacity-15"><DollarSign size={36} /></div>
                                <span className="text-[9px] font-black text-indigo-200 tracking-wider uppercase">Total Omzet</span>
                                <h3 className="text-lg font-black leading-none">
                                    Rp {analytics.totalRevenue.toLocaleString('id-ID')}
                                </h3>
                                <p className="text-[9px] font-semibold text-indigo-200 leading-none mt-1">Akumulasi Transaksi Relayed</p>
                            </div>

                            {/* Card 2: Pengunjung */}
                            <div className="bg-gradient-to-br from-emerald-500 to-emerald-650 text-white p-4 rounded-3xl shadow-sm border border-emerald-400/20 flex flex-col gap-2 relative overflow-hidden">
                                <div className="absolute right-3 top-3 opacity-15"><Users size={36} /></div>
                                <span className="text-[9px] font-black text-emerald-200 tracking-wider uppercase">Total Pengunjung</span>
                                <h3 className="text-lg font-black leading-none">
                                    {analytics.totalPax} <span className="text-xs font-bold text-emerald-100">Pax</span>
                                </h3>
                                <p className="text-[9px] font-semibold text-emerald-200 leading-none mt-1">Rerata: {analytics.avgPax} Pax/Meja</p>
                            </div>

                            {/* Card 3: Transaksi */}
                            <div className="bg-gradient-to-br from-amber-500 to-amber-650 text-white p-4 rounded-3xl shadow-sm border border-amber-400/20 flex flex-col gap-2 relative overflow-hidden">
                                <div className="absolute right-3 top-3 opacity-15"><ShoppingBag size={36} /></div>
                                <span className="text-[9px] font-black text-amber-200 tracking-wider uppercase">Total Transaksi</span>
                                <h3 className="text-lg font-black leading-none">
                                    {analytics.totalTransactions} <span className="text-xs font-bold text-amber-100">Order</span>
                                </h3>
                                <p className="text-[9px] font-semibold text-amber-200 leading-none mt-1">Tiket Terdistribusi ke POS</p>
                            </div>

                            {/* Card 4: Rata-Rata Keranjang */}
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-4 rounded-3xl shadow-sm border border-slate-700/50 flex flex-col gap-2 relative overflow-hidden">
                                <div className="absolute right-3 top-3 opacity-15"><Activity size={36} /></div>
                                <span className="text-[9px] font-black text-slate-400 tracking-wider uppercase">Rerata Tiket</span>
                                <h3 className="text-lg font-black leading-none">
                                    Rp {analytics.avgTicket.toLocaleString('id-ID')}
                                </h3>
                                <p className="text-[9px] font-semibold text-slate-400 leading-none mt-1">Belanja Rata-Rata per Meja</p>
                            </div>
                        </div>

                        {/* LINE CHART TREND OMZET */}
                        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <TrendingUp size={16} className="text-indigo-500" />
                                    Tren Penjualan Harian
                                </span>
                                {analytics.trendData.length > 0 && (
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {analytics.trendData[0].date} - {analytics.trendData[analytics.trendData.length - 1].date}
                                    </span>
                                )}
                            </div>

                            {analytics.trendData.length < 2 ? (
                                <div className="h-32 flex items-center justify-center text-slate-400 text-xs font-medium">
                                    Data belum cukup untuk menampilkan tren grafik.
                                </div>
                            ) : (
                                <div className="w-full flex flex-col gap-2 items-center">
                                    {/* Line Graph SVG Container */}
                                    <div className="w-full overflow-x-auto select-none">
                                        <svg viewBox="0 0 500 150" className="w-full h-auto overflow-visible">
                                            <defs>
                                                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
                                                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                                                </linearGradient>
                                            </defs>
                                            
                                            {/* Filled Area */}
                                            <path d={svgChartPath.fill} fill="url(#chartGradient)" />

                                            {/* Line Path */}
                                            <path d={svgChartPath.line} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                                            {/* Dots & Labels */}
                                            {svgChartPath.points.map((p, idx) => {
                                                const trendVal = analytics.trendData[idx]
                                                return (
                                                    <g key={idx} className="group cursor-pointer">
                                                        <circle cx={p.x} cy={p.y} r="3.5" fill="#ffffff" stroke="#4f46e5" strokeWidth="2" className="transition-all hover:r-5" />
                                                        <text x={p.x} y={p.y - 8} textAnchor="middle" className="text-[7px] font-black fill-slate-700 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-1">
                                                            Rp {(trendVal.revenue / 1000).toFixed(0)}k
                                                        </text>
                                                    </g>
                                                )
                                            })}
                                        </svg>
                                    </div>

                                    {/* Axis Labels */}
                                    <div className="w-full flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-2 px-3">
                                        <span>{analytics.trendData[0].date}</span>
                                        <span>Tengah Periode</span>
                                        <span>{analytics.trendData[analytics.trendData.length - 1].date}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ROW 3: PEAK TRAFFIC (DAYS & HOURS) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Hari Tersibuk */}
                            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <Calendar size={16} className="text-amber-500" />
                                        Hari Tersibuk Mingguan
                                    </span>
                                    <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded-full">
                                        Puncak: {analytics.busiestDay}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-3">
                                    {analytics.dayNames.map((name, idx) => {
                                        const count = analytics.dayCounts[idx]
                                        const maxCount = analytics.maxDayCount || 1
                                        const percentage = Math.round((count / maxCount) * 100)

                                        return (
                                            <div key={name} className="flex items-center gap-3 text-xs leading-none">
                                                <span className="w-14 font-bold text-slate-500 text-left">{name}</span>
                                                <div className="flex-1 bg-slate-100 h-6 rounded-lg overflow-hidden relative border border-slate-100/50">
                                                    <div
                                                        className="bg-amber-400 h-full rounded-r-md transition-all duration-500"
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                    <span className="absolute inset-y-0 right-2 flex items-center text-[9px] font-black text-slate-700">
                                                        {count} Order
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Jam Tersibuk */}
                            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock size={16} className="text-indigo-500" />
                                        Jam Sibuk Operasional
                                    </span>
                                </div>

                                <div className="flex flex-col gap-3">
                                    {/* Custom vertical bar graph for hours (selected hours: 09, 12, 15, 18, 20, 22) */}
                                    <div className="flex items-end justify-between h-40 pt-4 px-2 border-b border-slate-100">
                                        {[9, 12, 15, 17, 19, 21, 23].map((hour) => {
                                            const count = analytics.hourCounts[hour]
                                            const maxHourCount = Math.max(...analytics.hourCounts, 1)
                                            const heightPercent = Math.max(5, Math.round((count / maxHourCount) * 100))

                                            return (
                                                <div key={hour} className="flex flex-col items-center gap-2 group w-8">
                                                    <div className="relative w-full flex justify-center">
                                                        <span className="absolute -top-6 text-[9px] font-black text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 px-1 rounded shadow-sm">
                                                            {count}
                                                        </span>
                                                        <div
                                                            className="w-4 bg-indigo-500 hover:bg-indigo-650 rounded-t-md transition-all duration-500 shadow-sm"
                                                            style={{ height: `${heightPercent}px` }}
                                                        />
                                                    </div>
                                                    <span className="text-[9px] font-mono font-black text-slate-400">
                                                        {hour.toString().padStart(2, '0')}:00
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <p className="text-[9px] font-semibold text-slate-400 text-center uppercase tracking-wider">Arahkan kursor ke grafik batang untuk detail kuantitas</p>
                                </div>
                            </div>
                        </div>

                        {/* ROW 4: SLA STASIUN & WAITER LEADERBOARD */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* SLA Penyiapan Stasiun */}
                            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock size={16} className="text-emerald-500" />
                                        Kecepatan Penyajian (SLA)
                                    </span>
                                </div>

                                <div className="flex flex-col gap-4 justify-center py-2.5">
                                    {/* Barista Speed */}
                                    <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/50 rounded-2xl">
                                        <div>
                                            <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider">Barista (Minuman)</h4>
                                            <p className="text-[9px] font-bold text-slate-400 mt-0.5">Berdasarkan {analytics.barPrepCount} pesanan selesai</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xl font-black text-indigo-600 font-mono">{analytics.avgBarSLA}</span>
                                            <span className="text-[10px] font-bold text-indigo-400 ml-0.5">menit</span>
                                            <span className="block text-[8px] font-black uppercase text-emerald-500 tracking-widest mt-0.5">
                                                {parseFloat(analytics.avgBarSLA) <= 5 ? 'Sangat Cepat' : parseFloat(analytics.avgBarSLA) <= 12 ? 'Normal' : 'Lambat'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Kitchen Speed */}
                                    <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/50 rounded-2xl">
                                        <div>
                                            <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider">Kitchen (Makanan)</h4>
                                            <p className="text-[9px] font-bold text-slate-400 mt-0.5">Berdasarkan {analytics.kitchenPrepCount} pesanan selesai</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xl font-black text-amber-600 font-mono">{analytics.avgKitchenSLA}</span>
                                            <span className="text-[10px] font-bold text-amber-400 ml-0.5">menit</span>
                                            <span className="block text-[8px] font-black uppercase text-emerald-500 tracking-widest mt-0.5">
                                                {parseFloat(analytics.avgKitchenSLA) <= 12 ? 'Sangat Cepat' : parseFloat(analytics.avgKitchenSLA) <= 20 ? 'Normal' : 'Lambat'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Leaderboard Staf Waiter */}
                            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <Award size={16} className="text-indigo-500" />
                                        Leaderboard Pramusaji
                                    </span>
                                </div>

                                {analytics.waiterLeaderboard.length === 0 ? (
                                    <div className="py-8 text-center text-slate-400 text-xs font-medium">
                                        Belum ada aktivitas pelayanan tercatat.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {analytics.waiterLeaderboard.map((waiter, index) => (
                                            <div key={waiter.email} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                <div className="flex items-center gap-2.5">
                                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black leading-none ${
                                                        index === 0 ? 'bg-amber-400 text-slate-900' :
                                                        index === 1 ? 'bg-slate-300 text-slate-800' :
                                                        index === 2 ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-600'
                                                    }`}>
                                                        {index + 1}
                                                    </span>
                                                    <span className="font-bold text-slate-700 text-xs lowercase leading-none">{waiter.email}</span>
                                                </div>
                                                <div className="text-right leading-none">
                                                    <span className="text-[10px] font-black text-slate-800">{waiter.pax} Pax</span>
                                                    <span className="block text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{waiter.orders} Tiket</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ROW 5: MENU TERLARIS */}
                        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <Award size={16} className="text-amber-500" />
                                    Daftar Menu Terlaris (Top 5)
                                </span>
                            </div>

                            {analytics.topMenus.length === 0 ? (
                                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                                    Belum ada transaksi makanan/minuman terjual.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                    {analytics.topMenus.map((menu, index) => (
                                        <div key={menu.name} className="flex flex-col justify-between p-3.5 bg-slate-50 border border-slate-200/50 rounded-2xl relative shadow-sm overflow-hidden hover:scale-102 transition-transform duration-200">
                                            <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-indigo-500/5 rounded-full flex items-center justify-center">
                                                <span className="font-black text-slate-200 text-2xl">#{index + 1}</span>
                                            </div>
                                            <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full w-max uppercase tracking-wider">
                                                {menu.category}
                                            </span>
                                            <h4 className="font-black text-slate-800 text-xs leading-tight mt-2 min-h-[2rem]">
                                                {menu.name}
                                            </h4>
                                            <div className="mt-2 border-t border-dashed border-slate-200 pt-2 flex justify-between items-baseline">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Volume</span>
                                                <span className="text-sm font-black text-slate-700 font-mono">{menu.qty}x</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
            <ChatWidget />
        </main>
    )
}
