// src/components/waiter/WaiterMenuList.tsx
'use client'

import { useMenuStore, MenuStatus } from '@/store/useMenuStore'
import { Badge } from '@/components/ui/badge'

export default function WaiterMenuList() {
    const { menus, updateMenuStatus, addToCart } = useMenuStore()

    // Styling dinamis tombol berdasarkan status menu saat ini
    const getBtnStyle = (currentStatus: MenuStatus, targetStatus: MenuStatus) => {
        const isActive = currentStatus === targetStatus
        const baseStyle = "flex-1 py-3 text-xs font-black rounded-xl border uppercase tracking-wider transition-all duration-200 active:scale-95"

        if (!isActive) return `${baseStyle} bg-slate-50 text-slate-400 border-slate-200`

        switch (targetStatus) {
            case 'available': return `${baseStyle} bg-emerald-500 text-white border-emerald-600 shadow-md`
            case 'low_stock': return `${baseStyle} bg-amber-400 text-slate-900 border-amber-500 shadow-md`
            case 'sold_out': return `${baseStyle} bg-rose-500 text-white border-rose-600 shadow-md`
        }
    }

    return (
        <div className="flex flex-col gap-4 p-4 pb-32">
            {menus.map((item) => (
                <div key={item.id} className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm flex flex-col gap-4">

                    {/* Detail Menu & Aksi */}
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-800 tracking-tight">{item.name}</h3>
                                <Badge variant="outline" className="text-[9px] uppercase font-bold text-slate-400">
                                    {item.category}
                                </Badge>
                            </div>
                            <p className="text-sm font-bold text-slate-500 mt-0.5">
                                Rp {item.price.toLocaleString('id-ID')}
                            </p>
                        </div>

                        {/* Tambah ke keranjang belanja pramusaji */}
                        <button
                            onClick={() => addToCart(item)}
                            className="bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform"
                        >
                            + Catat
                        </button>
                    </div>

                    {/* Kontrol 1-Tap Stock Engine untuk Supabase */}
                    <div className="flex gap-2 border-t border-slate-100 pt-3">
                        <button
                            onClick={() => updateMenuStatus(item.id, 'available')}
                            className={getBtnStyle(item.status, 'available')}
                        >
                            Tersedia
                        </button>
                        <button
                            onClick={() => updateMenuStatus(item.id, 'low_stock')}
                            className={getBtnStyle(item.status, 'low_stock')}
                        >
                            Menipis
                        </button>
                        <button
                            onClick={() => updateMenuStatus(item.id, 'sold_out')}
                            className={getBtnStyle(item.status, 'sold_out')}
                        >
                            HABIS
                        </button>
                    </div>

                    {/* Kontrol Kuantitas Stok Menipis */}
                    {item.status === 'low_stock' && (
                        <div className="flex items-center justify-between mt-1 bg-amber-50 p-2.5 rounded-xl border border-amber-100 text-slate-800 animate-in fade-in duration-200">
                            <span className="text-xs font-bold text-amber-800">Sisa Porsi (Stok):</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => updateMenuStatus(item.id, 'low_stock', Math.max(0, (item.stock ?? 3) - 1))}
                                    className="w-7 h-7 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg flex items-center justify-center font-black text-sm transition-colors active:scale-90"
                                >
                                    -
                                </button>
                                <span className="font-bold text-sm w-6 text-center text-amber-950">{item.stock ?? 3}</span>
                                <button
                                    onClick={() => updateMenuStatus(item.id, 'low_stock', (item.stock ?? 3) + 1)}
                                    className="w-7 h-7 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg flex items-center justify-center font-black text-sm transition-colors active:scale-90"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            ))}
        </div>
    )
}