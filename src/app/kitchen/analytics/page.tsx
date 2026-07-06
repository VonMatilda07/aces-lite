'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { ArrowLeft, TrendingUp, BarChart2, Lock } from 'lucide-react'

export default function KitchenAnalyticsPage() {
    const { role, status } = useAuthStore()
    const [isAuthorized, setIsAuthorized] = useState(false)

    // Auth Guard (Head roles only)
    useEffect(() => {
        if (status === 'loading' || status === 'idle') return

        const allowedRoles = ['admin', 'supervisor', 'head_kitchen', 'superadmin']
        if (status === 'authenticated' && role && allowedRoles.includes(role)) {
            setIsAuthorized(true)
        } else if (status === 'authenticated') {
            window.location.href = '/kitchen'
        } else {
            window.location.href = '/login'
        }
    }, [status, role])

    if (!isAuthorized) {
        return (
            <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="w-8 h-8 rounded-full border-2 border-slate-800 border-t-orange-400 animate-spin mb-4" />
                <p className="text-xs font-bold text-slate-400">Memeriksa Hak Akses...</p>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-3">
                    <a 
                        href="/kitchen"
                        className="p-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 rounded-xl text-slate-300 transition-all active:scale-95 flex items-center justify-center"
                    >
                        <ArrowLeft size={16} />
                    </a>
                    <div>
                        <h1 className="text-md font-black tracking-tight">KITCHEN ANALYTICS</h1>
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">Performance & Product Stats</p>
                    </div>
                </div>

                <div className="bg-slate-800 px-3 py-1.5 rounded-xl text-[10px] font-black text-orange-400 border border-slate-700 uppercase tracking-wider">
                    {role} View
                </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto text-center gap-6 animate-in fade-in duration-300">
                <div className="relative">
                    {/* Ring animation */}
                    <div className="absolute inset-0 rounded-full border-2 border-orange-500/20 animate-ping duration-1000"></div>
                    <div className="p-6 bg-orange-600/10 text-orange-400 border border-orange-500/25 rounded-full relative z-10">
                        <TrendingUp size={48} className="animate-pulse" />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="bg-orange-500/10 text-orange-400 text-[10px] font-black uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full border border-orange-500/25 w-max mx-auto shadow-sm">
                        STASIUN DAPUR
                    </span>
                    <h2 className="text-2xl font-black tracking-tight mt-2 text-white">COMING SOON!</h2>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto mt-1">
                        Halaman analisis performa masakan, rata-rata waktu saji makanan, dan statistik produk terlaris sedang dipersiapkan untuk Head Kitchen.
                    </p>
                </div>

                <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl flex items-start gap-3 text-left w-full">
                    <div className="p-2 bg-slate-850 text-amber-400 rounded-lg shrink-0 border border-slate-750">
                        <Lock size={14} />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-slate-200 uppercase tracking-wide">Privasi Terjaga</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                            Data metrik hanya dapat diakses oleh peran Head Kitchen, Supervisor, dan Admin Toko.
                        </p>
                    </div>
                </div>

                <a 
                    href="/kitchen"
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-wider text-xs py-3.5 rounded-2xl transition-all active:scale-95 shadow-lg shadow-orange-500/10 flex items-center justify-center gap-1.5 mt-2"
                >
                    <ArrowLeft size={14} />
                    Kembali Ke Antrean
                </a>
            </div>
        </main>
    )
}
