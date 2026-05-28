// src/app/waiter/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useMenuStore } from '@/store/useMenuStore'
import { useAuthStore } from '@/store/useAuthStore'
import WaiterMenuList from '@/components/waiter/WaiterMenuList'
import WaiterCart from '@/components/waiter/WaiterCart'
import WaiterTicketsList from '@/components/waiter/WaiterTicketsList'
import { LogOut, Settings, Utensils, Inbox, History } from 'lucide-react'

export default function WaiterDashboard() {
    const { fetchMenus, subscribeToRealtime, activeTickets, fetchTickets, subscribeToTicketsRealtime } = useMenuStore()
    const { user, role, status, logout } = useAuthStore()

    // Sesi Authorization Guard Sisi Client
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [activeTab, setActiveTab] = useState<'menu' | 'queue' | 'history'>('menu')

    // Clock widget state
    const [currentTime, setCurrentTime] = useState<Date | null>(null)

    useEffect(() => {
        setCurrentTime(new Date())
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    const formatTime = (date: Date) => {
        const hh = date.getHours().toString().padStart(2, '0')
        const mm = date.getMinutes().toString().padStart(2, '0')
        const ss = date.getSeconds().toString().padStart(2, '0')
        return `${hh}:${mm}:${ss}`
    }

    const formatDayDate = (date: Date) => {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
        const dayName = days[date.getDay()]
        const day = date.getDate()
        const monthName = months[date.getMonth()]
        const year = date.getFullYear()
        return `${dayName}, ${day} ${monthName} ${year}`
    }

    // Client-side route guard
    useEffect(() => {
        console.log('=== [DEBUG] WaiterDashboard: Route guard checking, status =', status, 'role =', role)
        if (status === 'loading' || status === 'idle') {
            return
        }

        const staffRoles = ['admin', 'supervisor', 'captain', 'waiter', 'kitchen', 'barista']
        if (status === 'authenticated' && role && staffRoles.includes(role)) {
            setIsAuthorized(true)
        } else if (status === 'authenticated') {
            console.warn('=== [DEBUG] Unauthorized role for waiter page, redirecting to / ===')
            window.location.href = '/'
        } else {
            console.warn('=== [DEBUG] Unauthenticated session for waiter page, redirecting to /login ===')
            window.location.href = '/login'
        }
    }, [status, role])

    useEffect(() => {
        if (!isAuthorized) return

        console.log('=== [DEBUG] WaiterDashboard mounted, calling fetchMenus and fetchTickets ===')
        fetchMenus()
        fetchTickets()
        const unsubscribeMenus = subscribeToRealtime()
        const unsubscribeTickets = subscribeToTicketsRealtime()
        
        return () => {
            console.log('=== [DEBUG] WaiterDashboard unmounting, unsubscribing ===')
            unsubscribeMenus()
            unsubscribeTickets()
        }
    }, [fetchMenus, subscribeToRealtime, fetchTickets, subscribeToTicketsRealtime, isAuthorized])

    const handleLogout = async () => {
        console.log('=== [DEBUG] WaiterDashboard: handleLogout dipanggil ===')
        await logout()
        window.location.href = '/login'
    }

    if (!isAuthorized) {
        return (
            <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="flex flex-col items-center gap-4 max-w-sm">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-t-emerald-400 animate-spin"></div>
                    </div>
                    <div className="mt-2">
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-emerald-500/20">
                            Security Verification
                        </span>
                        <h2 className="text-md font-bold mt-3 text-slate-200">Memverifikasi Otoritas Staff...</h2>
                        <p className="text-[11px] text-slate-500 mt-1">Harap tunggu sebentar selagi sistem melakukan autentikasi sesi Anda.</p>
                    </div>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-slate-50 max-w-md mx-auto border-x border-slate-200">
            <header className="sticky top-0 bg-slate-900 text-white z-10 p-5 border-b border-slate-800 shadow-md">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase">Command Center</p>
                        <h1 className="text-lg font-black mt-0.5">coffeecomunitas</h1>
                        {user && (
                            <p className="text-[9px] text-slate-400 font-bold lowercase mt-0.5">{user.email}</p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Tombol Panel Admin: muncul jika pengguna yang login adalah Admin, Supervisor, atau Captain */}
                        {(role === 'admin' || role === 'supervisor' || role === 'captain') && (
                            <a
                                href="/admin"
                                className="bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-slate-950 px-3 py-1.5 rounded-full text-[10px] font-black border border-amber-500/30 transition-all duration-200 flex items-center gap-1 active:scale-95 shadow-sm"
                            >
                                <Settings size={12} /> Admin
                            </a>
                        )}

                        <div className="bg-slate-800 text-emerald-400 px-3 py-1.5 rounded-full text-[10px] font-black border border-slate-700 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                            {role ? role.toUpperCase() : 'PRAMUSAJI'}
                        </div>
                        <button
                            onClick={handleLogout}
                            className="bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white p-2.5 rounded-xl border border-rose-500/30 transition-colors active:scale-95"
                            title="Sign Out"
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>
            </header>

            {/* CLOCK WIDGET FOR WAITER */}
            {currentTime && (
                <div className="bg-slate-950 text-slate-300 px-5 py-2.5 flex justify-between items-center border-b border-slate-800 text-[10px] font-bold tracking-wide shadow-inner animate-in fade-in duration-300">
                    <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                        {formatDayDate(currentTime)}
                    </span>
                    <span className="font-mono text-[11px] bg-slate-900 px-2 py-0.5 rounded text-amber-400 border border-slate-800 tracking-wider">
                        {formatTime(currentTime)}
                    </span>
                </div>
            )}

            {/* TAB SWITCHER */}
            <div className="bg-white border-b border-slate-200 sticky top-[73px] z-10 flex text-xs font-black uppercase tracking-wider text-slate-500 shadow-sm">
                <button
                    onClick={() => setActiveTab('menu')}
                    className={`flex-1 py-3.5 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                        activeTab === 'menu'
                            ? 'border-slate-900 text-slate-900 bg-slate-50/50'
                            : 'border-transparent hover:text-slate-800'
                    }`}
                >
                    <Utensils size={14} />
                    Catat Order
                </button>
                <button
                    onClick={() => setActiveTab('queue')}
                    className={`flex-1 py-3.5 flex items-center justify-center gap-1.5 border-b-2 transition-all relative ${
                        activeTab === 'queue'
                            ? 'border-slate-900 text-slate-900 bg-slate-50/50'
                            : 'border-transparent hover:text-slate-800'
                    }`}
                >
                    <Inbox size={14} />
                    Antrean POS
                    {activeTickets.length > 0 && (
                        <span className="absolute top-2 right-4 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                            {activeTickets.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-3.5 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                        activeTab === 'history'
                            ? 'border-slate-900 text-slate-900 bg-slate-50/50'
                            : 'border-transparent hover:text-slate-800'
                    }`}
                >
                    <History size={14} />
                    Riwayat
                </button>
            </div>

            <section className="py-2">
                {activeTab === 'menu' && <WaiterMenuList />}
                {activeTab === 'queue' && <WaiterTicketsList statusFilter="draft" />}
                {activeTab === 'history' && <WaiterTicketsList statusFilter="relayed" />}
            </section>
            
            {activeTab === 'menu' && <WaiterCart />}
        </main>
    )
}