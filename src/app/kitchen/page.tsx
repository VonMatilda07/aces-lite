'use client'

import { useEffect, useState, useRef } from 'react'
import { useMenuStore, OrderTicket, getTicketItemPrice } from '@/store/useMenuStore'
import { useAuthStore } from '@/store/useAuthStore'
import { 
    Flame, 
    Clock, 
    Check, 
    Play, 
    LogOut, 
    Volume2, 
    VolumeX, 
    History, 
    Inbox, 
    TrendingUp,
    AlertCircle 
} from 'lucide-react'

// Web Audio API sound chime
function playNotificationChime() {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const now = audioCtx.currentTime
        
        // Note 1 (D5)
        const osc1 = audioCtx.createOscillator()
        const gain1 = audioCtx.createGain()
        osc1.type = 'triangle'
        osc1.frequency.setValueAtTime(587.33, now)
        gain1.gain.setValueAtTime(0.12, now)
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
        osc1.connect(gain1)
        gain1.connect(audioCtx.destination)
        osc1.start(now)
        osc1.stop(now + 0.4)
        
        // Note 2 (F#5)
        const osc2 = audioCtx.createOscillator()
        const gain2 = audioCtx.createGain()
        osc2.type = 'triangle'
        osc2.frequency.setValueAtTime(739.99, now + 0.12)
        gain2.gain.setValueAtTime(0.12, now + 0.12)
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.52)
        osc2.connect(gain2)
        gain2.connect(audioCtx.destination)
        osc2.start(now + 0.12)
        osc2.stop(now + 0.52)
    } catch (e) {
        console.warn('Web Audio chime failed:', e)
    }
}

export default function KitchenPage() {
    const { activeTickets, completedTickets, isTicketsLoading, fetchTickets, updateKitchenPrepStatus, subscribeToTicketsRealtime } = useMenuStore()
    const { user, role, status, logout } = useAuthStore()

    const [isAuthorized, setIsAuthorized] = useState(false)
    const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue')
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [wakeLockActive, setWakeLockActive] = useState(false)
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    const wakeLockRef = useRef<any>(null)
    const ticketsLengthRef = useRef<number>(0)

    // Auth Guard
    useEffect(() => {
        if (status === 'loading' || status === 'idle') return

        const allowedRoles = ['admin', 'supervisor', 'captain', 'cook', 'head_kitchen', 'kitchen']
        if (status === 'authenticated' && role && allowedRoles.includes(role)) {
            setIsAuthorized(true)
        } else if (status === 'authenticated') {
            window.location.href = '/'
        } else {
            window.location.href = '/login'
        }
    }, [status, role])

    // Load and Subscribe
    useEffect(() => {
        if (!isAuthorized) return

        fetchTickets()
        const unsubscribe = subscribeToTicketsRealtime()
        
        return () => {
            unsubscribe()
        }
    }, [fetchTickets, subscribeToTicketsRealtime, isAuthorized])

    // Sound alert on new ticket detection
    useEffect(() => {
        if (!isAuthorized) return

        // Filter active tickets containing kitchen items
        const kitchenActiveTickets = activeTickets.filter(t => t.kitchen_status === 'pending' || t.kitchen_status === 'preparing')
        
        // Play chime if ticket count increases
        if (kitchenActiveTickets.length > ticketsLengthRef.current) {
            if (soundEnabled && ticketsLengthRef.current > 0) {
                playNotificationChime()
            }
        }
        ticketsLengthRef.current = kitchenActiveTickets.length
    }, [activeTickets, isAuthorized, soundEnabled])

    // Screen Wake Lock
    useEffect(() => {
        if (!isAuthorized) return

        async function requestWakeLock() {
            try {
                if ('wakeLock' in navigator) {
                    wakeLockRef.current = await (navigator.wakeLock as any).request('screen')
                    setWakeLockActive(true)
                    console.log('=== [WAKE LOCK] Screen Wake Lock activated. ===')
                }
            } catch (err: any) {
                console.warn('=== [WAKE LOCK] Failed to acquire Wake Lock:', err.message, '===')
            }
        }

        requestWakeLock()

        const handleVisibilityChange = async () => {
            if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
                requestWakeLock()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            if (wakeLockRef.current) {
                wakeLockRef.current.release()
                wakeLockRef.current = null
                setWakeLockActive(false)
            }
        }
    }, [isAuthorized])

    // Action handlers
    const handleStartPrep = async (ticketId: string) => {
        setUpdatingId(ticketId)
        try {
            await updateKitchenPrepStatus(ticketId, 'preparing')
        } finally {
            setUpdatingId(null)
        }
    }

    const handleDonePrep = async (ticketId: string) => {
        setUpdatingId(ticketId)
        try {
            await updateKitchenPrepStatus(ticketId, 'ready')
            if (soundEnabled) {
                playNotificationChime()
            }
        } finally {
            setUpdatingId(null)
        }
    }

    const handleLogout = async () => {
        await logout()
        window.location.href = '/login'
    }

    // Helper functions
    const getKitchenItems = (ticket: OrderTicket) => {
        return ticket.ticket_items?.filter(item => {
            const snap = item.category_snapshot
            return item.menus?.station === 'kitchen' || !['Coffee', 'Non-Coffee'].includes(snap)
        }) || []
    }

    const parseNotesAndVariant = (notesStr: string | null) => {
        if (!notesStr) return { variant: null, notes: null }
        const match = notesStr.match(/^\[Varian:\s*([^\]]+)\](.*)$/)
        if (match) {
            return {
                variant: match[1].trim(),
                notes: match[2].trim() || null
            }
        }
        return { variant: null, notes: notesStr }
    }

    const formatElapsedTime = (startStr: string | null | undefined) => {
        if (!startStr) return ''
        const start = new Date(startStr).getTime()
        const now = new Date().getTime()
        const diffSecs = Math.floor((now - start) / 1000)
        
        const mm = Math.floor(diffSecs / 60)
        const ss = diffSecs % 60
        return `${mm}:${ss.toString().padStart(2, '0')} m`
    }

    const formatClockTime = (dateStr: string) => {
        const d = new Date(dateStr)
        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    }

    // Filter tickets for this dashboard
    const allTickets = activeTab === 'queue' ? activeTickets : completedTickets
    const kitchenTickets = allTickets.filter(t => {
        const items = getKitchenItems(t)
        if (items.length === 0) return false
        
        if (activeTab === 'queue') {
            return t.kitchen_status === 'pending' || t.kitchen_status === 'preparing'
        } else {
            return t.kitchen_status === 'ready'
        }
    })

    if (!isAuthorized) {
        return (
            <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="flex flex-col items-center gap-4 max-w-sm">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-t-orange-400 animate-spin"></div>
                    </div>
                    <div>
                        <span className="bg-orange-500/10 text-orange-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-orange-500/20">
                            Kitchen Terminal Security
                        </span>
                        <h2 className="text-md font-bold mt-3 text-slate-200">Menghubungkan Terminal Dapur...</h2>
                    </div>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-slate-950 text-white font-sans">
            {/* Header */}
            <header className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap justify-between items-center z-15 gap-4 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-orange-600 rounded-2xl text-white shadow-md shadow-orange-500/20">
                        <Flame size={22} className="animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-black tracking-tight">KITCHEN TERMINAL</h1>
                            {wakeLockActive && (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span className="w-1 h-1 bg-emerald-400 rounded-full animate-ping"></span>
                                    LAYAR AKTIF
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">Food & Kitchen Station Queue</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Analytics Page Link (Head Roles only) */}
                    {(role === 'admin' || role === 'supervisor' || role === 'head_kitchen') && (
                        <a 
                            href="/kitchen/analytics"
                            className="bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-600 hover:text-white transition-all text-xs font-black py-2 px-4 rounded-xl flex items-center gap-1.5 active:scale-95"
                        >
                            <TrendingUp size={14} />
                            Analytics
                        </a>
                    )}

                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`p-2.5 rounded-xl border transition-all ${
                            soundEnabled 
                                ? 'bg-slate-800 text-orange-400 border-slate-700 hover:bg-slate-700' 
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                        }`}
                        title={soundEnabled ? 'Matikan Suara Chime' : 'Nyalakan Suara Chime'}
                    >
                        {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>

                    <div className="bg-slate-800 px-3.5 py-2 rounded-xl text-xs font-black text-slate-300 border border-slate-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                        {role?.toUpperCase()}
                    </div>

                    <button
                        onClick={handleLogout}
                        className="bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-600 hover:text-white p-2.5 rounded-xl transition-all active:scale-95"
                        title="Logout Staf"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            {/* Sub-Header / Info Bar */}
            <div className="bg-slate-900 border-b border-slate-800 px-6 py-2.5 flex justify-between items-center text-xs font-bold text-slate-400">
                <div className="flex gap-4">
                    <span>Sesi: <span className="text-slate-200 lowercase">{user?.email}</span></span>
                    <span>Total Antrean: <span className="text-orange-400">{kitchenTickets.length} Tiket</span></span>
                </div>
                <div className="flex gap-1.5 items-center">
                    <button 
                        onClick={() => {
                            playNotificationChime()
                            alert("Suara notifikasi dapur diuji coba!")
                        }}
                        className="text-[10px] text-orange-400 hover:underline"
                    >
                        Test Sound
                    </button>
                </div>
            </div>

            {/* Main Tabs */}
            <div className="max-w-7xl mx-auto p-6">
                <div className="flex gap-2 border-b border-slate-800 pb-3 mb-6">
                    <button
                        onClick={() => setActiveTab('queue')}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            activeTab === 'queue'
                                ? 'bg-orange-600 text-white shadow-md shadow-orange-500/15'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                        }`}
                    >
                        <Inbox size={14} />
                        Antrean Masak
                        {kitchenTickets.length > 0 && activeTab === 'queue' && (
                            <span className="bg-white text-orange-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                                {kitchenTickets.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            activeTab === 'history'
                                ? 'bg-orange-600 text-white shadow-md shadow-orange-500/15'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                        }`}
                    >
                        <History size={14} />
                        Sudah Selesai
                    </button>
                </div>

                {/* Queue Cards Grid */}
                {isTicketsLoading && kitchenTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
                        <div className="w-8 h-8 rounded-full border-2 border-slate-800 border-t-orange-400 animate-spin" />
                        <p className="text-xs font-bold">Sinkronisasi antrean...</p>
                    </div>
                ) : kitchenTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center gap-4 bg-slate-900/40 border border-slate-850 rounded-3xl">
                        <div className="p-4 bg-slate-900 rounded-2xl text-slate-600 border border-slate-800">
                            <Flame size={36} />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-300 text-sm">Tidak Ada Antrean Makanan</h3>
                            <p className="text-[11px] text-slate-500 mt-1 max-w-[240px] mx-auto leading-relaxed">
                                {activeTab === 'queue' 
                                    ? 'Stasiun Dapur bersih! Menunggu pesanan makanan baru dari waiter.' 
                                    : 'Belum ada makanan yang selesai disajikan hari ini.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {kitchenTickets.map((ticket) => {
                            const kitchenItems = getKitchenItems(ticket)
                            const isPreparing = ticket.kitchen_status === 'preparing'

                            return (
                                <div 
                                    key={ticket.id}
                                    className={`bg-slate-900 border rounded-3xl overflow-hidden shadow-xl transition-all duration-200 flex flex-col justify-between ${
                                        isPreparing 
                                            ? 'border-orange-500 ring-1 ring-orange-500/20' 
                                            : 'border-slate-800 hover:border-slate-750'
                                    }`}
                                >
                                    {/* Card Header */}
                                    <div className="p-5 bg-slate-900 border-b border-slate-850 flex justify-between items-start gap-2">
                                        <div>
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">IDENTITAS MEJA</span>
                                            <h3 className="text-lg font-black text-white uppercase mt-0.5 tracking-tight">{ticket.table_identifier}</h3>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">DITERIMA</span>
                                            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-300 mt-0.5">
                                                <Clock size={11} className="text-orange-400" />
                                                {formatClockTime(ticket.created_at)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Items List */}
                                    <div className="p-5 flex-1 flex flex-col gap-4">
                                        {kitchenItems.map((item) => {
                                            const { variant, notes } = parseNotesAndVariant(item.notes)
                                            return (
                                                <div key={item.id} className="flex justify-between items-start gap-3">
                                                    <div className="flex-1">
                                                        <div className="flex items-start gap-2">
                                                            <span className="bg-orange-600/10 text-orange-400 text-xs font-black px-2 py-0.5 rounded-md min-w-[24px] text-center mt-0.5">
                                                                {item.qty}x
                                                            </span>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-100 text-sm leading-snug">
                                                                    {item.menus?.name || 'Food'}
                                                                </span>
                                                                {variant && (
                                                                    <span className="inline-block bg-slate-800 text-slate-300 text-[9px] font-bold px-1.5 py-0.5 rounded w-max mt-1 border border-slate-750">
                                                                        {variant}
                                                                    </span>
                                                                )}
                                                                {notes && (
                                                                    <p className="text-[10px] text-rose-400 font-bold mt-1 uppercase tracking-wide">
                                                                        * {notes}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Card Footer / Action Button */}
                                    <div className="p-5 bg-slate-900/60 border-t border-slate-850 flex justify-between items-center gap-4 mt-auto">
                                        <div>
                                            {isPreparing ? (
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">DURASI MASAK</span>
                                                    <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1 mt-0.5">
                                                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping"></span>
                                                        {formatElapsedTime(ticket.kitchen_prep_start)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">STATUS TIKET</span>
                                                    <span className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-wide">Pending</span>
                                                </div>
                                            )}
                                        </div>

                                        {activeTab === 'queue' ? (
                                            !isPreparing ? (
                                                <button
                                                    onClick={() => handleStartPrep(ticket.id)}
                                                    disabled={updatingId !== null}
                                                    className="bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-[11px] tracking-wider py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-md shadow-orange-500/10 active:scale-95 transition-all disabled:opacity-50"
                                                >
                                                    <Play size={12} className="fill-current" />
                                                    Mulai Masak
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleDonePrep(ticket.id)}
                                                    disabled={updatingId !== null}
                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[11px] tracking-wider py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95 transition-all disabled:opacity-50"
                                                >
                                                    <Check size={12} className="stroke-[3]" />
                                                    Selesai
                                                </button>
                                            )
                                        ) : (
                                            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm">
                                                <Check size={11} className="stroke-[3]" />
                                                SIAP SAJI
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </main>
    )
}
