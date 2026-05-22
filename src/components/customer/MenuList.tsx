// src/components/customer/MenuList.tsx
'use client'

import { useMenuStore } from '@/store/useMenuStore'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge' // Pastikan sudah install badge via shadcn
import { Leaf, Info } from 'lucide-react'

export default function MenuList() {
    const { menus, isLoading } = useMenuStore()

    // --- LOGIKA DYNAMIC SORTING ---
    // Memisahkan item tersedia dan habis, lalu menggabungkannya
    const sortedMenus = useMemo(() => {
        const available = menus.filter((m) => m.status !== 'sold_out')
        const soldOut = menus.filter((m) => m.status === 'sold_out')
        return [...available, ...soldOut]
    }, [menus])

    // Helper Warna Nutri-Grade
    const getGradeColor = (grade: string) => {
        const map: Record<string, string> = {
            A: 'bg-emerald-600', B: 'bg-green-500', C: 'bg-yellow-500 text-black',
            D: 'bg-orange-500', E: 'bg-red-600'
        }
        return map[grade] || 'bg-slate-400'
    }

    if (isLoading) return (
        <div className="p-8 text-center animate-pulse text-slate-400 font-medium">
            Sinkronisasi menu coffeecomunitas...
        </div>
    )

    return (
        <div className="flex flex-col gap-3 p-4">
            {sortedMenus.map((item) => {
                const isSoldOut = item.status === 'sold_out'
                const isLowStock = item.status === 'low_stock'

                return (
                    <div
                        key={item.id}
                        className={`relative flex justify-between items-center p-4 rounded-2xl border transition-all duration-500 bg-white ${isSoldOut ? 'opacity-50 grayscale border-slate-100' : 'border-slate-200 shadow-sm'
                            }`}
                    >
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900 tracking-tight">{item.name}</h3>
                                {/* Nutri-Grade Badge */}
                                <Badge className={`${getGradeColor(item.nutri_grade)} border-none text-[10px] h-5 px-1.5`}>
                                    {item.nutri_grade}
                                </Badge>
                            </div>

                            <div className="flex items-center gap-2">
                                <p className={`text-sm font-semibold ${isSoldOut ? 'line-through text-slate-400' : 'text-slate-600'}`}>
                                    Rp {item.price.toLocaleString('id-ID')}
                                </p>
                                {isLowStock && (
                                    <span className="text-[10px] font-bold text-orange-500 uppercase tracking-tighter">
                                        Stok Menipis
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Aksi/Badge Status */}
                        <div className="flex items-center gap-2">
                            {isSoldOut ? (
                                <div className="flex flex-col items-end gap-1">
                                    <Badge variant="destructive" className="font-black text-[10px] px-2 py-0">HABIS</Badge>
                                    <button
                                        onClick={() => alert(`Rekomendasi: Coba menu alternatif dengan Nutri-Grade serupa!`)}
                                        className="text-[9px] underline text-slate-500 flex items-center gap-1"
                                    >
                                        <Info size={10} /> Alternatif?
                                    </button>
                                </div>
                            ) : (
                                <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                    <Leaf size={14} className="text-emerald-500" />
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}