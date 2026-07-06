// src/app/barista/page.tsx
'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useMenuStore, OrderTicket, getTicketItemPrice } from '@/store/useMenuStore'
import { useAuthStore } from '@/store/useAuthStore'
import { 
    Coffee, 
    Clock, 
    Check, 
    Play, 
    LogOut, 
    Volume2, 
    VolumeX, 
    History, 
    Inbox, 
    TrendingUp,
    RotateCcw 
} from 'lucide-react'

// Web Audio API sound chime
function playNotificationChime() {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const now = audioCtx.currentTime
        
        // Note 1 (C5)
        const osc1 = audioCtx.createOscillator()
        const gain1 = audioCtx.createGain()
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(523.25, now)
        gain1.gain.setValueAtTime(0.12, now)
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
        osc1.connect(gain1)
        gain1.connect(audioCtx.destination)
        osc1.start(now)
        osc1.stop(now + 0.4)
        
        // Note 2 (E5)
        const osc2 = audioCtx.createOscillator()
        const gain2 = audioCtx.createGain()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(659.25, now + 0.12)
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

export default function BaristaPage() {
    const { activeTickets, completedTickets, isTicketsLoading, fetchTickets, updateBarPrepStatus, subscribeToTicketsRealtime } = useMenuStore()
    const { user, role, status, logout } = useAuthStore()

    const [isAuthorized, setIsAuthorized] = useState(false)
    const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue')
    const [sortOrder, setSortOrder] = useState<'FIFO' | 'LIFO'>('FIFO')
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [wakeLockActive, setWakeLockActive] = useState(false)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [secondsTick, setSecondsTick] = useState(0)
    
    // Checklist state
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

    const wakeLockRef = useRef<any>(null)
    const ticketsLengthRef = useRef<number>(0)

    // Ticking interval to force re-render elapsed timers every second
    useEffect(() => {
        if (!isAuthorized) return
        const timer = setInterval(() => {
            setSecondsTick(prev => prev + 1)
        }, 1000)
        return () => clearInterval(timer)
    }, [isAuthorized])

    // Auth Guard
    useEffect(() => {
        if (status === 'loading' || status === 'idle') return

        const allowedRoles = ['admin', 'supervisor', 'captain', 'barista', 'head_barista', 'superadmin']
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

        // Filter active tickets containing bar items
        const barActiveTickets = activeTickets.filter(t => t.bar_status === 'pending' || t.bar_status === 'preparing')
        
        // Play chime if ticket count increases
        if (barActiveTickets.length > ticketsLengthRef.current) {
            if (soundEnabled && ticketsLengthRef.current > 0) {
                playNotificationChime()
            }
        }
        ticketsLengthRef.current = barActiveTickets.length
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
            await updateBarPrepStatus(ticketId, 'preparing')
        } finally {
            setUpdatingId(null)
        }
    }

    const handleDonePrep = async (ticketId: string) => {
        setUpdatingId(ticketId)
        try {
            await updateBarPrepStatus(ticketId, 'ready')
            if (soundEnabled) {
                playNotificationChime()
            }
        } finally {
            setUpdatingId(null)
        }
    }

    const handleUndoPrep = async (ticketId: string) => {
        setUpdatingId(ticketId)
        try {
            await updateBarPrepStatus(ticketId, 'preparing')
        } finally {
            setUpdatingId(null)
        }
    }

    const handleLogout = async () => {
        await logout()
        window.location.href = '/login'
    }

    // Helper functions
    const getBarItems = (ticket: OrderTicket) => {
        return ticket.ticket_items?.filter(item => {
            const snap = item.category_snapshot
            return item.menus?.station === 'bar' || ['Coffee', 'Non-Coffee'].includes(snap)
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

    // SLA Timer color indicators function (Total ticket duration since created_at)
    const getSLAInfo = (createdAtStr: string) => {
        const created = new Date(createdAtStr).getTime()
        const now = new Date().getTime()
        const elapsedMin = (now - created) / (1000 * 60)
        
        if (elapsedMin < 5) {
            return { colorClass: 'bg-emerald-500', text: 'Normal', pulse: false }
        } else if (elapsedMin < 10) {
            return { colorClass: 'bg-amber-500', text: 'Warning', pulse: false }
        } else {
            return { colorClass: 'bg-rose-500', text: 'Overdue', pulse: true }
        }
    }

    // Filter tickets for this dashboard
    const allTickets = activeTab === 'queue' ? activeTickets : completedTickets
    
    // Sort and filter barista tickets
    const baristaTickets = useMemo(() => {
        const list = allTickets.filter(t => {
            const items = getBarItems(t)
            if (items.length === 0) return false
            
            if (activeTab === 'queue') {
                return t.bar_status === 'pending' || t.bar_status === 'preparing'
            } else {
                return t.bar_status === 'ready'
            }
        })

        // Sort by LIFO or FIFO
        list.sort((a, b) => {
            const timeA = new Date(a.created_at).getTime()
            const timeB = new Date(b.created_at).getTime()
            return sortOrder === 'FIFO' ? timeA - timeB : timeB - timeA
        })

        return list
    }, [allTickets, activeTab, sortOrder])

    if (!isAuthorized) {
        return (
            <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="flex flex-col items-center gap-4 max-w-sm">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-t-blue-400 animate-spin"></div>
                    </div>
                    <div>
                        <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-blue-500/20">
                            Barista Terminal Security
                        </span>
                        <h2 className="text-md font-bold mt-3 text-slate-200">Menghubungkan Terminal Barista...</h2>
                    </div>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-slate-950 text-white font-sans flex flex-col">
            {/* Header */}
            <header className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap justify-between items-center z-15 gap-4 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-600 rounded-2xl text-white shadow-md shadow-blue-500/20">
                        <Coffee size={22} className="animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-black tracking-tight">BARISTA TERMINAL</h1>
                            {wakeLockActive && (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                                    LAYAR AKTIF
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">Coffee & Beverages Station Queue</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Analytics Page Link (Head Roles only) */}
                    {(role === 'admin' || role === 'supervisor' || role === 'head_barista') && (
                        <a 
                            href="/admin/analytics"
                            className="bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all text-xs font-black py-2 px-4 rounded-xl flex items-center gap-1.5 active:scale-95 shadow-sm"
                        >
                            <TrendingUp size={14} />
                            Analytics Dashboard
                        </a>
                    )}

                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`p-2.5 rounded-xl border transition-all ${
                            soundEnabled 
                                ? 'bg-slate-800 text-blue-400 border-slate-700 hover:bg-slate-700' 
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                        }`}
                        title={soundEnabled ? 'Matikan Suara Chime' : 'Nyalakan Suara Chime'}
                    >
                        {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>

                    <div className="bg-slate-800 px-3.5 py-2 rounded-xl text-xs font-black text-slate-300 border border-slate-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
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

            {/* Sub-Header / Info Bar with Sort Options */}
            <div className="bg-slate-900 border-b border-slate-800 px-6 py-2.5 flex justify-between items-center text-xs font-bold text-slate-400">
                <div className="flex gap-4">
                    <span>Sesi: <span className="text-slate-200 lowercase">{user?.email}</span></span>
                    <span>Total Antrean: <span className="text-blue-400">{baristaTickets.length} Tiket</span></span>
                </div>
                
                {/* FIFO / LIFO Filter Control */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Antrean:</span>
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as any)}
                            className="bg-slate-800 border border-slate-700 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg text-slate-200 outline-none focus:border-blue-500 cursor-pointer transition-all"
                        >
                            <option value="FIFO">FIFO (Terlama)</option>
                            <option value="LIFO">LIFO (Terbaru)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Main Tabs */}
            <div className="max-w-7xl mx-auto p-6 flex-1 w-full">
                <div className="flex gap-2 border-b border-slate-800 pb-3 mb-6">
                    <button
                        onClick={() => setActiveTab('queue')}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            activeTab === 'queue'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/15'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                        }`}
                    >
                        <Inbox size={14} />
                        Antrean Racik
                        {baristaTickets.length > 0 && activeTab === 'queue' && (
                            <span className="bg-white text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                                {baristaTickets.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            activeTab === 'history'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/15'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                        }`}
                    >
                        <History size={14} />
                        Sudah Selesai
                    </button>
                </div>

                {/* Queue Cards Grid */}
                {isTicketsLoading && baristaTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
                        <div className="w-8 h-8 rounded-full border-2 border-slate-800 border-t-blue-400 animate-spin" />
                        <p className="text-xs font-bold">Sinkronisasi antrean...</p>
                    </div>
                ) : baristaTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center gap-4 bg-slate-900/40 border border-slate-850 rounded-3xl">
                        <div className="p-4 bg-slate-900 rounded-2xl text-slate-600 border border-slate-800">
                            <Coffee size={36} />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-300 text-sm">Tidak Ada Antrean Minuman</h3>
                            <p className="text-[11px] text-slate-500 mt-1 max-w-[240px] mx-auto leading-relaxed">
                                {activeTab === 'queue' 
                                    ? 'Stasiun Barista bersih! Menunggu pesanan minuman baru dari waiter.' 
                                    : 'Belum ada minuman yang selesai disajikan hari ini.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {baristaTickets.map((ticket) => {
                            const barItems = getBarItems(ticket)
                            const isPreparing = ticket.bar_status === 'preparing'
                            const isStaff = ticket.table_identifier.toLowerCase().startsWith('karyawan:')
                            const isTest = isTestTicket(ticket.table_identifier)
                            const sla = getSLAInfo(ticket.created_at)

                            // Visual border accent classes
                            let borderAccent = 'border-slate-800 hover:border-slate-700'
                            if (isPreparing) {
                                borderAccent = 'border-blue-500 ring-1 ring-blue-500/20'
                            } else if (isTest) {
                                borderAccent = 'border-dashed border-rose-500/50 hover:border-rose-500/80'
                            } else if (isStaff) {
                                borderAccent = 'border-purple-500/40 hover:border-purple-500/60'
                            }

                            // Visual background accent classes
                            let bgAccent = 'bg-slate-900'
                            if (isTest) {
                                bgAccent = 'bg-gradient-to-br from-rose-950/15 via-slate-900 to-slate-900'
                            } else if (isStaff) {
                                bgAccent = 'bg-gradient-to-br from-purple-950/10 via-slate-900 to-slate-900'
                            }

                            return (
                                <div 
                                    key={ticket.id}
                                    className={`${bgAccent} border ${borderAccent} rounded-3xl overflow-hidden shadow-xl transition-all duration-200 flex flex-col justify-between`}
                                >
                                    {/* Card Header */}
                                    <div className="p-5 border-b border-slate-850 flex justify-between items-start gap-2 bg-slate-900/40">
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">IDENTITAS MEJA</span>
                                                {isTest && (
                                                    <span className="bg-rose-500/10 text-rose-450 border border-rose-500/25 text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                        DATA TESTING
                                                    </span>
                                                )}
                                                {isStaff && (
                                                    <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                        KARYAWAN
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-lg font-black text-white uppercase mt-0.5 tracking-tight">{ticket.table_identifier}</h3>
                                        </div>

                                        <div className="text-right flex flex-col items-end gap-1.5">
                                            {/* SLA color-coded timer light */}
                                            {activeTab === 'queue' && (
                                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-950/30 rounded border border-slate-850">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${sla.colorClass} ${sla.pulse ? 'animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]' : ''}`} />
                                                    <span className="text-[7.5px] font-black uppercase text-slate-400 tracking-wider">{sla.text}</span>
                                                </div>
                                            )}
                                            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
                                                <Clock size={11} className="text-blue-400" />
                                                {formatClockTime(ticket.created_at)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Items List with custom checklists */}
                                    <div className="p-5 flex-1 flex flex-col gap-4">
                                        {barItems.map((item, idx) => {
                                            const { variant, notes } = parseNotesAndVariant(item.notes)
                                            const checklistKey = `${ticket.id}_${item.id || idx}`
                                            const isChecked = !!checkedItems[checklistKey]

                                            return (
                                                <div key={item.id || idx} className="flex justify-between items-start gap-3 border-b border-slate-850/30 pb-3 last:border-0 last:pb-0">
                                                    <div className="flex-1">
                                                        {/* Custom circular checklist click box */}
                                                        <button
                                                            disabled={activeTab === 'history'}
                                                            onClick={() => {
                                                                setCheckedItems(prev => ({
                                                                    ...prev,
                                                                    [checklistKey]: !prev[checklistKey]
                                                                }))
                                                            }}
                                                            className="flex items-start gap-2.5 focus:outline-none text-left group w-full"
                                                        >
                                                            {activeTab === 'queue' && (
                                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 ${
                                                                    isChecked 
                                                                        ? 'bg-blue-500 border-blue-505 text-white scale-105 shadow-md shadow-blue-500/10' 
                                                                        : 'border-slate-700 bg-slate-800/40 text-transparent group-hover:border-slate-500'
                                                                }`}>
                                                                    <Check size={11} className={`stroke-[3.5] transition-transform duration-200 ${isChecked ? 'scale-100' : 'scale-0'}`} />
                                                                </div>
                                                            )}
                                                            
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="bg-slate-800 text-slate-350 text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-700">
                                                                        {item.qty}x
                                                                    </span>
                                                                    <span className={`font-bold text-sm leading-snug transition-all duration-200 ${
                                                                        isChecked && activeTab === 'queue' ? 'line-through text-slate-500 decoration-slate-600' : 'text-slate-100'
                                                                    }`}>
                                                                        {item.menus?.name || 'Beverage'}
                                                                    </span>
                                                                </div>
                                                                {variant && (
                                                                    <span className="inline-block bg-slate-850 text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded w-max mt-1 border border-slate-800">
                                                                        {variant}
                                                                    </span>
                                                                )}
                                                                {notes && (
                                                                    <p className="text-[10px] text-rose-400 font-bold mt-1 uppercase tracking-wide">
                                                                        * {notes}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Card Footer / Action Button */}
                                    <div className="p-5 bg-slate-900/60 border-t border-slate-850 flex justify-between items-center gap-4 mt-auto">
                                        <div>
                                            {isPreparing && activeTab === 'queue' ? (
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">DURASI RACIK</span>
                                                    <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1 mt-0.5">
                                                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping"></span>
                                                        {formatElapsedTime(ticket.bar_prep_start)}
                                                    </span>
                                                </div>
                                            ) : activeTab === 'queue' ? (
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">STATUS TIKET</span>
                                                    <span className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-wide">Pending</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">STATUS TIKET</span>
                                                    <span className="text-xs font-bold text-emerald-450 mt-0.5 uppercase tracking-wide">Siap Saji</span>
                                                </div>
                                            )}
                                        </div>

                                        {activeTab === 'queue' ? (
                                            !isPreparing ? (
                                                <button
                                                    onClick={() => handleStartPrep(ticket.id)}
                                                    disabled={updatingId !== null}
                                                    className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[11px] tracking-wider py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-500/10 active:scale-95 transition-all disabled:opacity-50"
                                                >
                                                    <Play size={12} className="fill-current" />
                                                    Mulai Racik
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
                                            /* Recall / Undo Completed Ticket Button in History Tab */
                                            <button
                                                onClick={() => handleUndoPrep(ticket.id)}
                                                disabled={updatingId !== null}
                                                className="bg-slate-800 hover:bg-slate-700 text-slate-350 border border-slate-700 font-black uppercase text-[10px] tracking-wider py-2 px-3 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
                                            >
                                                <RotateCcw size={11} />
                                                Batal Selesai
                                            </button>
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
