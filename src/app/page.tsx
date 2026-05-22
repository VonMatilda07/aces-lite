// src/app/page.tsx
'use client'

import { useEffect } from 'react'
import { useMenuStore } from '@/store/useMenuStore'
import MenuList from '@/components/customer/MenuList'

export default function CustomerQRView() {
  const { fetchMenus, subscribeToRealtime } = useMenuStore()

  useEffect(() => {
    // 1. Ambil data awal dari database
    fetchMenus()

    // 2. Aktifkan koneksi Realtime (WebSocket)
    const unsubscribe = subscribeToRealtime()

    // 3. Cleanup saat tab browser ditutup
    return () => unsubscribe()
  }, [fetchMenus, subscribeToRealtime])

  return (
    <main className="min-h-screen bg-slate-50 max-w-md mx-auto border-x border-slate-200">
      {/* Header Sticky sesuai Branding */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md z-10 p-5 border-b border-slate-100">
        <div className="flex flex-col items-center text-center">
          <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">ACES Lite</p>
          <h1 className="text-lg font-black text-slate-900 mt-0.5">coffeecomunitas menu</h1>
        </div>
      </header>

      {/* List Menu Section */}
      <section className="py-2">
        <MenuList />
      </section>

      {/* Footer Minimalist */}
      <footer className="p-8 text-center">
        <p className="text-[10px] text-slate-400 font-medium italic">
          Data tersinkronisasi secara real-time dengan bar.
        </p>
      </footer>
    </main>
  )
}