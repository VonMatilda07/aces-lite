// src/app/admin/feedback/page.tsx
'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import ChatWidget from '@/components/chat/ChatWidget'
import { ArrowLeft, Trash2, Search, MessageSquare, Star, Clock, AlertTriangle, User } from 'lucide-react'

interface CustomerFeedback {
    id: string
    created_at: string
    customer_name: string | null
    feedback_text: string
    rating: number | null
}

export default function AdminFeedbackPage() {
    const { user, role, status } = useAuthStore()
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterRating, setFilterRating] = useState('All')

    // Client-side route guard (Hanya Admin & Supervisor)
    useEffect(() => {
        if (status === 'loading' || status === 'idle') return

        if (status === 'authenticated' && (role === 'admin' || role === 'supervisor')) {
            setIsAuthorized(true)
        } else if (status === 'authenticated') {
            window.location.href = role === 'captain' ? '/admin' : '/waiter'
        } else {
            window.location.href = '/login'
        }
    }, [status, role])

    // Fetch feedbacks
    const fetchFeedbacks = async () => {
        setIsLoading(true)
        const { data, error } = await supabase
            .from('customer_feedback')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching customer feedback:', error)
            alert('Gagal memuat kritik & saran: ' + error.message)
        } else if (data) {
            setFeedbacks(data as CustomerFeedback[])
        }
        setIsLoading(false)
    }

    useEffect(() => {
        if (isAuthorized) {
            fetchFeedbacks()
        }
    }, [isAuthorized])

    // Hapus feedback
    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus kritik/saran dari "${name}"?`)) return

        const { error } = await supabase
            .from('customer_feedback')
            .delete()
            .eq('id', id)

        if (error) {
            alert('Gagal menghapus masukan: ' + error.message)
        } else {
            // Tulis audit log
            try {
                const { writeAuditLog } = await import('@/lib/audit')
                await writeAuditLog(`Menghapus kritik/saran dari pelanggan "${name}"`)
            } catch (err) {
                console.error('Error writing audit log for deleting feedback:', err)
            }
            fetchFeedbacks()
        }
    }

    // Hitung rata-rata rating dan statistik
    const stats = useMemo(() => {
        const ratedFeedbacks = feedbacks.filter(f => f.rating !== null && f.rating !== undefined)
        const totalRated = ratedFeedbacks.length
        const sumRating = ratedFeedbacks.reduce((sum, f) => sum + (f.rating || 0), 0)
        const average = totalRated > 0 ? (sumRating / totalRated).toFixed(1) : '0.0'

        return {
            totalCount: feedbacks.length,
            ratedCount: totalRated,
            average
        }
    }, [feedbacks])

    // Filter dan pengurutan
    const filteredFeedbacks = useMemo(() => {
        return feedbacks.filter(f => {
            const matchesSearch = 
                (f.customer_name && f.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                f.feedback_text.toLowerCase().includes(searchQuery.toLowerCase())

            const matchesRating = 
                filterRating === 'All' || 
                (filterRating === 'Unrated' && f.rating === null) ||
                (f.rating !== null && f.rating.toString() === filterRating)

            return matchesSearch && matchesRating
        })
    }, [feedbacks, searchQuery, filterRating])

    if (!isAuthorized) {
        return (
            <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="flex flex-col items-center gap-4 max-w-sm">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-t-amber-400 animate-spin"></div>
                    </div>
                    <div className="mt-2">
                        <span className="bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-amber-500/20">
                            Security Verification
                        </span>
                        <h2 className="text-md font-bold mt-3 text-slate-200">Memverifikasi Otoritas...</h2>
                        <p className="text-[11px] text-slate-500 mt-1">Harap tunggu sebentar selagi sistem memproses hak akses halaman ini.</p>
                    </div>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-slate-50 flex flex-col max-w-4xl mx-auto border-x border-slate-200">
            {/* Header */}
            <header className="sticky top-0 bg-slate-900 text-white z-10 p-5 border-b border-slate-800 shadow-md">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded">FEEDBACK MONITOR</span>
                            <h1 className="text-lg font-black tracking-tight">Kritik & Saran</h1>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5 leading-none">{user?.email}</p>
                    </div>

                    <a
                        href="/admin"
                        className="bg-slate-800 text-slate-200 hover:bg-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors active:scale-95 shadow-sm"
                    >
                        <ArrowLeft size={12} /> Dashboard
                    </a>
                </div>
            </header>

            {/* Dashboard Content */}
            <section className="p-4 sm:p-6 flex-1 flex flex-col gap-6">
                <div>
                    <h2 className="text-xl font-black text-slate-800">Daftar Masukan Pelanggan</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Pantau kepuasan pelanggan kafe Anda secara real-time.</p>
                </div>

                {/* Info Cards / Statistics */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Masukan</span>
                        <div className="flex items-baseline gap-1.5 mt-2">
                            <span className="text-3xl font-black text-slate-900">{stats.totalCount}</span>
                            <span className="text-[10px] text-slate-400 font-bold">Feedback</span>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Rata-rata Rating</span>
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className="text-3xl font-black text-amber-500">{stats.average}</span>
                            <div className="flex flex-col">
                                <div className="flex text-amber-400">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <Star 
                                            key={s} 
                                            size={10} 
                                            className={s <= Math.round(parseFloat(stats.average)) ? 'fill-amber-400' : 'text-slate-200 fill-transparent'} 
                                        />
                                    ))}
                                </div>
                                <span className="text-[9px] text-slate-400 font-bold mt-0.5">dari {stats.ratedCount} rating</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-sm flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Search size={14} />
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Cari nama pelanggan atau isi pesan..."
                            className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none focus:border-slate-800 focus:bg-white transition-all font-medium text-slate-800"
                        />
                    </div>

                    <select
                        value={filterRating}
                        onChange={(e) => setFilterRating(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-slate-800 cursor-pointer"
                    >
                        <option value="All">Semua Rating</option>
                        <option value="5">⭐️⭐️⭐️⭐️⭐️ (5 Bintang)</option>
                        <option value="4">⭐️⭐️⭐️⭐️ (4 Bintang)</option>
                        <option value="3">⭐️⭐️⭐️ (3 Bintang)</option>
                        <option value="2">⭐️⭐️ (2 Bintang)</option>
                        <option value="1">⭐️ (1 Bintang)</option>
                        <option value="Unrated">Tanpa Rating Bintang</option>
                    </select>
                </div>

                {/* Feedbacks Grid List */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                        <div className="w-8 h-8 rounded-full border-2 border-slate-350 border-t-amber-500 animate-spin" />
                        <p className="text-xs font-bold">Memuat kritik & saran...</p>
                    </div>
                ) : filteredFeedbacks.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                        <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                            <MessageSquare size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-700 text-sm">Masukan Kosong</h3>
                            <p className="text-[10px] text-slate-400 mt-1 max-w-[220px] mx-auto leading-relaxed">
                                Tidak ada kritik & saran yang sesuai dengan pencarian atau filter Anda saat ini.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {filteredFeedbacks.map((f) => {
                            const formattedTime = new Date(f.created_at).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                            const formattedDate = new Date(f.created_at).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                            })

                            return (
                                <div 
                                    key={f.id} 
                                    className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col gap-3 relative hover:shadow-md transition-shadow"
                                >
                                    {/* Delete Button */}
                                    <button
                                        onClick={() => handleDelete(f.id, f.customer_name || 'Anonim')}
                                        className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition-all active:scale-90"
                                        title="Hapus Feedback"
                                    >
                                        <Trash2 size={14} />
                                    </button>

                                    {/* Header info */}
                                    <div className="flex items-center gap-3 flex-wrap pr-8">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                <User size={12} />
                                            </div>
                                            <span className="font-black text-slate-800 text-xs uppercase tracking-wide">
                                                {f.customer_name || 'Anonim'}
                                            </span>
                                        </div>
                                        
                                        {/* Date and Time */}
                                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                                            <Clock size={11} className="text-slate-350" />
                                            {formattedDate} {formattedTime} WITA
                                        </div>
                                    </div>

                                    {/* Star rating display */}
                                    {f.rating !== null && f.rating !== undefined && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            {[1, 2, 3, 4, 5].map((s) => (
                                                <Star 
                                                    key={s} 
                                                    size={12} 
                                                    className={s <= (f.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-transparent'} 
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Feedback message text */}
                                    <p className="text-xs font-semibold leading-relaxed text-slate-700 bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 whitespace-pre-wrap">
                                        "{f.feedback_text}"
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            <ChatWidget />
        </main>
    )
}
