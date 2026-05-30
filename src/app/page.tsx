// src/app/page.tsx
'use client'

import { useEffect } from 'react'
import { useMenuStore } from '@/store/useMenuStore'
import MenuList from '@/components/customer/MenuList'

export default function CustomerQRView() {
  const { fetchMenus, subscribeToRealtime } = useMenuStore()

  useEffect(() => {
    // Inisialisasi data menu dan aktifkan koneksi realtime
    fetchMenus()
    const unsubscribe = subscribeToRealtime()
    return () => unsubscribe()
  }, [fetchMenus, subscribeToRealtime])

  return (
    <main className="min-h-screen bg-slate-50 max-w-md mx-auto border-x border-slate-200">
      {/* Header Utama */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md z-10 p-5 border-b border-slate-100">
        <div className="flex flex-col items-center text-center">
          <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">ACES Lite</p>
          <h1 className="text-lg font-black text-slate-900 mt-0.5">coffeecomunitas menu</h1>
        </div>
      </header>

      {/* Section List Menu */}
      <section className="py-2">
        <MenuList />
      </section>

      {/* Footer Minimalis */}
      <footer className="p-8 text-center flex flex-col items-center gap-3">
        <p className="text-[10px] text-slate-400 font-medium italic">
          Data tersinkronisasi secara real-time dengan bar & kitchen.
        </p>
        <div className="border-t border-slate-200 w-16 my-1" />
        <div className="flex flex-col items-center gap-1.5 animate-in fade-in duration-500">
          <p className="text-[9px] font-black text-slate-400 tracking-[0.15em] uppercase">
            Developed & Managed by
          </p>
          <div className="bg-slate-900 text-white rounded-full px-4.5 py-1 text-[10px] font-bold border border-slate-800 shadow-sm transition-transform hover:scale-105">
            Jex
          </div>
          <p className="text-[11px] font-black text-slate-700 leading-tight">
            Muhammad Athfal Aulia Putra, S.Kom.
          </p>
          <p className="text-[9px] text-slate-400 font-medium max-w-[220px] leading-normal mt-0.5">
            For Collaboration : putrahendra699@gmail.com / +6282157458222
          </p>
        </div>
      </footer>
    </main>
  )
}