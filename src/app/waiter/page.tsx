// src/app/waiter/page.tsx
'use client'

import { useEffect } from 'react'
import { useMenuStore } from '@/store/useMenuStore'
import WaiterMenuList from '@/components/waiter/WaiterMenuList'
import WaiterCart from '@/components/waiter/WaiterCart'

export default function WaiterDashboard() {
    const { fetchMenus, subscribeToRealtime } = useMenuStore()

    useEffect(() => {
        fetchMenus()
        const unsubscribe = subscribeToRealtime()
        return () => unsubscribe()
    }, [fetchMenus, subscribeToRealtime])

    return (
        <main className="min-h-screen bg-slate-50 max-w-md mx-auto border-x border-slate-200">
            {/* Header Dashboard Internal Pramusaji */}
            <header className="sticky top-0 bg-slate-900 text-white z-10 p-5 border-b border-slate-800 shadow-md">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase">Command Center</p>
                        <h1 className="text-lg font-black mt-0.5">coffeecomunitas</h1>
                    </div>
                    <div className="bg-slate-800 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-black border border-slate-700 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                        PRAMUSAJI
                    </div>
                </div>
            </header>

            {/* Kontrol Stok Menu */}
            <section className="py-2">
                <WaiterMenuList />
            </section>
            <WaiterCart />
        </main>
    )
}