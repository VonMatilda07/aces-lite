// src/components/waiter/WaiterMenuList.tsx
'use client'

import { useMenuStore, MenuStatus, isMenuScheduledActive } from '@/store/useMenuStore'
import { Badge } from '@/components/ui/badge'
import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'

export default function WaiterMenuList() {
    const { menus, updateMenuStatus, addToCart, toggleMenuFeatured } = useMenuStore()
    const [selectedCategory, setSelectedCategory] = useState('Semua')
    const [searchQuery, setSearchQuery] = useState('')

    const categories = useMemo(() => {
        const dbCategories = Array.from(new Set(menus.map(m => m.category))).filter(Boolean)
        const defaultOrder = ['Coffee', 'Non-Coffee', 'Food', 'Snack']
        const ordered = defaultOrder.filter(c => dbCategories.includes(c))
        const others = dbCategories.filter(c => !defaultOrder.includes(c))
        return ['Semua', ...ordered, ...others]
    }, [menus])

    // Filter daftar menu berdasarkan tab kategori aktif, jadwal aktif & pencarian
    const filteredMenus = useMemo(() => {
        let list = menus.filter(m => isMenuScheduledActive(m, menus))
        if (selectedCategory !== 'Semua') {
            list = list.filter(m => m.category === selectedCategory)
        }
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase().trim()
            list = list.filter(m => 
                m.name.toLowerCase().includes(query) || 
                (m.description && m.description.toLowerCase().includes(query)) ||
                (m.subcategory && m.subcategory.toLowerCase().includes(query))
            )
        }
        return list
    }, [menus, selectedCategory, searchQuery])

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
        <div className="flex flex-col gap-4">
            {/* STICKY CONTAINER: PENCARIAN & KATEGORI */}
            <div className="sticky top-[121px] bg-slate-50/95 backdrop-blur-md z-20 pb-3 pt-2 px-4 border-b border-slate-200/60 flex flex-col gap-3 shadow-sm">
                {/* PENCARIAN MENU WAITER */}
                <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl shadow-sm focus-within:border-slate-800 transition-colors">
                    <span className="absolute left-4 text-slate-400">
                        <Search size={16} />
                    </span>
                    <input
                        type="text"
                        placeholder="Cari menu pramusaji..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-10 py-3 text-xs font-bold text-slate-800 rounded-2xl focus:outline-none placeholder-slate-400 bg-transparent"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-4 text-slate-400 hover:text-slate-600 active:scale-90 transition-transform"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* TAB NAVIGASI KATEGORI UNTUK WAITER */}
                <div className="w-full overflow-x-auto scrollbar-none flex gap-2">
                    {categories.map((cat) => {
                        const isActive = selectedCategory === cat
                        return (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all duration-200 active:scale-95 ${isActive
                                        ? 'bg-slate-900 text-white shadow-md'
                                        : 'bg-white text-slate-500 border border-slate-200'
                                    }`}
                            >
                                {cat}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="flex flex-col gap-4 p-4 pb-32 pt-0">
                {filteredMenus.map((item) => (
                    <div key={item.id} className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm flex flex-col gap-4">
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

                            {item.variants && item.variants.length > 0 ? (
                                <div className="flex gap-1.5 flex-wrap max-w-[200px] justify-end">
                                    {item.variants.map((v) => {
                                        const isVarSoldOut = v.status === 'sold_out' || v.stock === 0
                                        const isPriceOverride = v.price !== undefined && v.price !== null
                                        return (
                                            <button
                                                key={v.name}
                                                disabled={isVarSoldOut}
                                                onClick={() => addToCart(item, v.name)}
                                                className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg border transition-all duration-200 active:scale-95 flex flex-col items-center ${
                                                    isVarSoldOut
                                                        ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed opacity-50 active:scale-100'
                                                        : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                                                }`}
                                            >
                                                <span>+{v.name}</span>
                                                {isPriceOverride && (
                                                    <span className="text-[8px] text-emerald-400 font-bold mt-0.5">
                                                        Rp {v.price?.toLocaleString('id-ID')}
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            ) : (
                                <button
                                    disabled={item.status === 'sold_out' || item.stock === 0}
                                    onClick={() => addToCart(item)}
                                    className={`text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform ${
                                        (item.status === 'sold_out' || item.stock === 0)
                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50 active:scale-100'
                                            : 'bg-slate-900 text-white'
                                    }`}
                                >
                                    {item.status === 'sold_out' || item.stock === 0 ? 'Habis' : '+ Catat'}
                                </button>
                            )}
                        </div>

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

                        {/* Toggle Rekomendasi Menu */}
                        <div className="flex items-center justify-between border-t border-slate-100 pt-3 px-1">
                            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                                ⭐ Rekomendasi Menu (3D Carousel)
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer" title={item.is_featured ? "Menu Unggulan Aktif" : "Aktifkan Rekomendasi"}>
                                <input
                                    type="checkbox"
                                    checked={!!item.is_featured}
                                    onChange={() => toggleMenuFeatured(item.id, !!item.is_featured)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-400"></div>
                            </label>
                        </div>                        {((item.stock !== null && item.stock !== undefined) || (item.variants && item.variants.length > 0)) && (
                            <div className="flex flex-col gap-2 mt-1 bg-amber-50 p-2.5 rounded-xl border border-amber-100 text-slate-800 animate-in fade-in duration-200">
                                {item.variants && item.variants.length > 0 ? (
                                    <div className="flex flex-col gap-2 w-full">
                                        <span className="text-[10px] font-black text-amber-800 uppercase tracking-wide">Stok Per Varian:</span>
                                        {item.variants.map((v) => (
                                            <div key={v.name} className="flex items-center justify-between bg-white/50 p-2 rounded-lg border border-amber-200/50 w-full">
                                                <span className="text-xs font-bold text-slate-700">{v.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const newStock = Math.max(0, v.stock - 1)
                                                            const newStatus = newStock === 0 ? 'sold_out' : (newStock <= 3 ? 'low_stock' : 'available')
                                                            updateMenuStatus(item.id, newStatus, newStock, v.name)
                                                        }}
                                                        className="w-6 h-6 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded flex items-center justify-center font-black text-xs transition-colors active:scale-90"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="font-bold text-xs w-6 text-center text-amber-955">{v.stock}</span>
                                                    <button
                                                        onClick={() => {
                                                            const newStock = v.stock + 1
                                                            const newStatus = newStock === 0 ? 'sold_out' : (newStock <= 3 ? 'low_stock' : 'available')
                                                            updateMenuStatus(item.id, newStatus, newStock, v.name)
                                                        }}
                                                        className="w-6 h-6 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded flex items-center justify-center font-black text-xs transition-colors active:scale-90"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-xs font-bold text-amber-800">Sisa Porsi (Stok):</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    const newStock = Math.max(0, (item.stock ?? 3) - 1)
                                                    const newStatus = newStock === 0 ? 'sold_out' : (newStock <= 3 ? 'low_stock' : 'available')
                                                    updateMenuStatus(item.id, newStatus, newStock)
                                                }}
                                                className="w-7 h-7 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg flex items-center justify-center font-black text-sm transition-colors active:scale-90"
                                            >
                                                -
                                            </button>
                                            <span className="font-bold text-sm w-6 text-center text-amber-955">{item.stock ?? 3}</span>
                                            <button
                                                onClick={() => {
                                                    const newStock = (item.stock ?? 3) + 1
                                                    const newStatus = newStock === 0 ? 'sold_out' : (newStock <= 3 ? 'low_stock' : 'available')
                                                    updateMenuStatus(item.id, newStatus, newStock)
                                                }}
                                                className="w-7 h-7 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg flex items-center justify-center font-black text-sm transition-colors active:scale-90"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}