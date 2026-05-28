// src/components/customer/MenuList.tsx
'use client'

import { useMenuStore, Menu, isMenuScheduledActive, getAlternativeMenus } from '@/store/useMenuStore'
import { useMemo, useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Leaf, Info, Star, Plus, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'

export default function MenuList() {
    const { menus, isLoading } = useMenuStore()
    const [selectedCategory, setSelectedCategory] = useState('Semua')
    const [selectedSubcategory, setSelectedSubcategory] = useState('Semua')
    const [searchQuery, setSearchQuery] = useState('')

    // State carousel 3D
    const [activeIndex, setActiveIndex] = useState(0)
    const [touchStart, setTouchStart] = useState<number | null>(null)

    // State list item yang diekspansi detailnya
    const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null)

    // Reset subkategori saat kategori utama berubah
    useEffect(() => {
        setSelectedSubcategory('Semua')
    }, [selectedCategory])

    // 1. Ambil semua menu unggulan yang tersedia dan aktif secara jadwal (hanya tipe regular/single)
    const featuredMenus = useMemo(() => {
        return menus.filter((m) => m.menu_type !== 'bundle' && m.is_featured && m.status !== 'sold_out' && isMenuScheduledActive(m, menus))
    }, [menus])

    // 2. Ambil semua paket bundling unggulan yang tersedia dan aktif secara jadwal
    const featuredBundles = useMemo(() => {
        return menus.filter((m) => m.menu_type === 'bundle' && m.is_featured && m.status !== 'sold_out' && isMenuScheduledActive(m, menus))
    }, [menus])

    // Autoplay untuk 3D Carousel (setiap 5 detik berpindah)
    useEffect(() => {
        if (featuredMenus.length <= 1) return
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % featuredMenus.length)
        }, 5000)
        return () => clearInterval(interval)
    }, [featuredMenus.length])

    // Handler Touch Swipe untuk mobile
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStart(e.targetTouches[0].clientX)
    }

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStart === null || featuredMenus.length <= 1) return
        const touchEnd = e.changedTouches[0].clientX
        const diff = touchStart - touchEnd

        if (diff > 50) {
            // Geser ke kiri (Next)
            setActiveIndex((prev) => (prev + 1) % featuredMenus.length)
        } else if (diff < -50) {
            // Geser ke kanan (Prev)
            setActiveIndex((prev) => (prev - 1 + featuredMenus.length) % featuredMenus.length)
        }
        setTouchStart(null)
    }

    const categories = useMemo(() => {
        const dbCategories = Array.from(new Set(menus.map(m => m.category))).filter(Boolean)
        const defaultOrder = ['Coffee', 'Non-Coffee', 'Food', 'Snack']
        const ordered = defaultOrder.filter(c => dbCategories.includes(c))
        const others = dbCategories.filter(c => !defaultOrder.includes(c))
        return ['Semua', ...ordered, ...others]
    }, [menus])

    // Tentukan sub-kategori aktif berdasarkan menu yang masuk kategori & terjadwal aktif
    const activeSubcategories = useMemo(() => {
        if (selectedCategory === 'Semua') return []
        const subcats = menus
            .filter(m => m.category === selectedCategory && m.subcategory && isMenuScheduledActive(m, menus))
            .map(m => m.subcategory as string)
        return ['Semua', ...Array.from(new Set(subcats))]
    }, [menus, selectedCategory])

    // 2. Filter menu list di bawah
    const filteredAndSortedMenus = useMemo(() => {
        let list = menus.filter(m => isMenuScheduledActive(m, menus))
        if (selectedCategory !== 'Semua') {
            list = list.filter((m) => m.category === selectedCategory)
            if (selectedSubcategory !== 'Semua') {
                list = list.filter((m) => m.subcategory === selectedSubcategory)
            }
        }

        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase().trim()
            list = list.filter((m) => 
                m.name.toLowerCase().includes(query) || 
                (m.description && m.description.toLowerCase().includes(query)) ||
                (m.subcategory && m.subcategory.toLowerCase().includes(query))
            )
        }

        const available = list.filter((m) => m.status !== 'sold_out')
        const soldOut = list.filter((m) => m.status === 'sold_out')
        return [...available, ...soldOut]
    }, [menus, selectedCategory, selectedSubcategory, searchQuery])

    const getGradeColor = (grade: string) => {
        const map: Record<string, string> = {
            A: 'bg-emerald-600', B: 'bg-green-500', C: 'bg-yellow-500 text-black',
            D: 'bg-orange-500', E: 'bg-red-600'
        }
        return map[grade] || 'bg-slate-400'
    }

    const toggleExpand = (menuId: string) => {
        setExpandedMenuId((prev) => (prev === menuId ? null : menuId))
    }

    const handleFeaturedCardClick = (menu: Menu) => {
        // Expand the menu details automatically
        setExpandedMenuId(menu.id)
        
        // Scroll to the list item container smoothly
        setTimeout(() => {
            const element = document.getElementById(`menu-item-${menu.id}`)
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }, 150)
    }

    if (isLoading) return (
        <div className="p-8 text-center animate-pulse text-slate-400 font-medium">
            Sinkronisasi menu coffeecomunitas...
        </div>
    )

    // Subclass produk helper
    const getProductType = (category: string) => {
        return ['Coffee', 'Non-Coffee'].includes(category) ? 'Beverage' : 'Food'
    }

    return (
        <div className="flex flex-col gap-4">

            {/* PENCARIAN MENU */}
            <div className="px-4 pt-2">
                <div className="relative flex items-center bg-white border border-slate-200 rounded-2xl shadow-sm focus-within:border-slate-800 transition-colors">
                    <span className="absolute left-4 text-slate-400">
                        <Search size={16} />
                    </span>
                    <input
                        type="text"
                        placeholder="Cari kopi, makanan, atau snack..."
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
            </div>

            {/* HERO 3D CAROUSEL (COVERFLOW EFFECT) */}
            {featuredMenus.length >= 2 && selectedCategory === 'Semua' && searchQuery === '' && (
                <div className="w-full flex flex-col items-center py-4 bg-slate-900 text-white rounded-b-[2.5rem] shadow-xl overflow-hidden relative">
                    {/* Background Glows */}
                    <div className="absolute -right-20 -bottom-20 w-52 h-52 bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none"></div>
                    <div className="absolute -left-20 -top-20 w-52 h-52 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none"></div>

                    <div className="w-full px-5 flex justify-between items-center mb-2 z-10">
                        <span className="bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1">
                            <Star size={10} className="fill-slate-950" /> Unggulan Hari Ini
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setActiveIndex((prev) => (prev - 1 + featuredMenus.length) % featuredMenus.length)}
                                className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <button
                                onClick={() => setActiveIndex((prev) => (prev + 1) % featuredMenus.length)}
                                className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Viewport 3D perspective */}
                    <div
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                        className="relative w-full h-[14rem] flex items-center justify-center select-none"
                        style={{ perspective: '1000px' }}
                    >
                        {featuredMenus.map((menu, idx) => {
                            let offset = idx - activeIndex
                            const count = featuredMenus.length

                            // Handle circular looping logic
                            if (offset < -count / 2) offset += count
                            if (offset > count / 2) offset -= count

                            const isActive = offset === 0
                            const isLeft = offset < 0
                            const isRight = offset > 0
                            const absOffset = Math.abs(offset)

                            // Tampilkan hanya kartu aktif, kiri, dan kanan saja
                            if (absOffset > 1) return null

                            // 3D Transform Styles
                            let transformStyle = ''
                            if (isActive) {
                                transformStyle = 'translateZ(0px) rotateY(0deg) scale(1)'
                            } else if (isLeft) {
                                transformStyle = 'translateX(-52%) translateZ(-150px) rotateY(35deg) scale(0.85)'
                            } else if (isRight) {
                                transformStyle = 'translateX(52%) translateZ(-150px) rotateY(-35deg) scale(0.85)'
                            }

                            return (
                                <div
                                    key={menu.id}
                                    onClick={() => {
                                        if (isActive) {
                                            handleFeaturedCardClick(menu)
                                        } else {
                                            setActiveIndex(idx)
                                        }
                                    }}
                                    style={{
                                        transform: transformStyle,
                                        zIndex: isActive ? 10 : 5,
                                        opacity: isActive ? 1 : 0.55,
                                        transition: 'all 500ms cubic-bezier(0.25, 0.8, 0.25, 1)',
                                    }}
                                    className="absolute w-72 h-[11rem] rounded-[2rem] bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-5 text-white shadow-2xl border border-slate-700/50 cursor-pointer flex flex-col justify-between overflow-hidden"
                                >
                                    {/* Glass reflection overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none"></div>

                                    {/* Card Header */}
                                    <div className="flex justify-between items-center z-10">
                                        <Badge className="bg-slate-800 border-none text-[8px] tracking-wide text-slate-300">
                                            {menu.category.toUpperCase()}
                                        </Badge>
                                        <Badge className={`${getGradeColor(menu.nutri_grade)} border-none text-[9px] px-2 py-0.5`}>
                                            Grade {menu.nutri_grade}
                                        </Badge>
                                    </div>

                                    {/* Card Image Thumbnail if available */}
                                    {menu.image_url && isActive && (
                                        <div className="absolute right-4 bottom-10 w-20 h-20 rounded-full overflow-hidden border border-slate-700/30 shadow-md transform rotate-6 opacity-30 pointer-events-none">
                                            <img src={menu.image_url} alt={menu.name} className="w-full h-full object-cover" />
                                        </div>
                                    )}

                                    {/* Card Content */}
                                    <div className="z-10 mt-2">
                                        <h3 className="text-md font-black tracking-tight leading-tight line-clamp-2">{menu.name}</h3>
                                        <p className="text-[9px] text-slate-400 line-clamp-1 mt-0.5">{menu.description || 'Pilihan terbaik barista hari ini.'}</p>
                                    </div>

                                    {/* Card Price / Stock */}
                                    <div className="flex justify-between items-end border-t border-slate-800 pt-2.5 z-10">
                                        <span className="text-sm font-black text-emerald-400">
                                            Rp {menu.price.toLocaleString('id-ID')}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Bullet Indicators */}
                    <div className="flex gap-1 mt-2 z-10">
                        {featuredMenus.map((_, i) => (
                            <span
                                key={i}
                                onClick={() => setActiveIndex(i)}
                                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${i === activeIndex ? 'w-4 bg-amber-400' : 'w-1.5 bg-slate-700'}`}
                            ></span>
                        ))}
                    </div>
                </div>
            )}

            {/* PAKET BUNDLING UNGGULAN (SPESIAL HARI INI) */}
            {featuredBundles.length > 0 && selectedCategory === 'Semua' && searchQuery === '' && (
                <div className="px-4 py-3 flex flex-col gap-3">
                    <div className="flex justify-between items-center px-1">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                            ✨ PAKET SPESIAL HARI INI
                        </span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {featuredBundles.map((item) => {
                            const isSoldOut = item.status === 'sold_out'
                            const isExpanded = expandedMenuId === item.id

                            return (
                                <div
                                    key={item.id}
                                    id={`menu-item-${item.id}`}
                                    className={`relative flex flex-col p-4 rounded-3xl border transition-all duration-300 bg-white ${
                                        isSoldOut ? 'opacity-60 grayscale border-slate-100' : 'border-amber-300 bg-gradient-to-br from-amber-50/20 via-white to-white shadow-md'
                                    }`}
                                >
                                    {/* Gold badge for promo */}
                                    <div className="absolute -top-2.5 right-4 bg-amber-400 text-slate-950 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm z-10">
                                        PROMO SPESIAL
                                    </div>

                                    {/* Baris Utama Item */}
                                    <div className="flex justify-between items-center w-full mt-1">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <h3 className="font-black text-slate-800 tracking-tight">{item.name}</h3>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <p className={`text-xs font-bold ${isSoldOut ? 'line-through text-slate-400' : 'text-slate-600'}`}>
                                                    Rp {item.price.toLocaleString('id-ID')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            {isSoldOut ? (
                                                <Badge variant="destructive" className="font-black text-[9px] px-2 py-0">HABIS</Badge>
                                            ) : (
                                                <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center border border-amber-200">
                                                    <span className="text-xs">🎁</span>
                                                </div>
                                            )}

                                            <button
                                                onClick={() => toggleExpand(item.id)}
                                                className="p-1.5 rounded-full hover:bg-slate-100 active:scale-90 transition-transform"
                                                title={isExpanded ? 'Tutup Detail' : 'Lihat Detail'}
                                            >
                                                <Plus
                                                    size={16}
                                                    className={`text-slate-600 transition-transform duration-300 ${isExpanded ? 'rotate-45 text-rose-500 scale-110' : ''}`}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Panel Detail Ekspansif */}
                                    <div
                                        className={`overflow-hidden transition-all duration-305 ease-in-out ${
                                            isExpanded
                                                ? 'max-h-[30rem] opacity-100 mt-4 border-t border-slate-100 pt-4'
                                                : 'max-h-0 opacity-0 pointer-events-none'
                                        }`}
                                    >
                                        <div className="flex flex-col md:flex-row gap-4">
                                            {/* Foto Produk */}
                                            <div className="w-full md:w-32 h-32 shrink-0 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 relative flex items-center justify-center text-slate-400">
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <svg className="w-12 h-12 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l9-5-9-5-9 5 9 5zm0 0v6.5m0 0L7.5 18M12 20.5l4.5-2.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                )}
                                            </div>

                                            {/* Informasi & Deskripsi */}
                                            <div className="flex flex-col gap-2 flex-1 text-xs">
                                                <div className="flex flex-wrap gap-1.5 items-center">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Detail Info:</span>
                                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[8px] uppercase">
                                                        Type: {item.category}
                                                    </Badge>
                                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[8px] uppercase">
                                                        Class: {getProductType(item.category)}
                                                    </Badge>
                                                </div>

                                                <div className="flex flex-col gap-1 mt-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Deskripsi Paket</span>
                                                    <p className="text-slate-600 leading-relaxed font-medium">
                                                        {item.description || 'Nikmati perpaduan menu paket spesial CoffeeCommunitas dengan harga lebih hemat.'}
                                                    </p>
                                                </div>

                                                {/* Tampilkan Komponen Bundling */}
                                                {item.bundle_items && item.bundle_items.length > 0 && (
                                                    <div className="flex flex-col gap-1.5 mt-2 p-3 rounded-2xl border border-slate-100 bg-slate-50">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Isi Paket (Komponen)</span>
                                                        <div className="flex flex-col gap-1.5">
                                                            {item.bundle_items.map((bItem) => {
                                                                const compMenu = menus.find(m => m.id === bItem.id)
                                                                if (!compMenu) return null
                                                                return (
                                                                    <div key={bItem.id + (bItem.variant_name || '')} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-100/80 shadow-sm text-slate-700">
                                                                        <span className="font-bold text-xs text-slate-800">
                                                                            {compMenu.name} {bItem.variant_name ? `(${bItem.variant_name})` : ''} <span className="text-slate-400 font-bold text-[10px] ml-1 bg-slate-100 px-1.5 py-0.5 rounded">x{bItem.qty}</span>
                                                                        </span>
                                                                        <Badge className={`${getGradeColor(compMenu.nutri_grade)} border-none text-[8px] font-black text-white px-2 py-0.5`}>
                                                                            Grade {compMenu.nutri_grade}
                                                                        </Badge>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* TAB NAVIGASI KATEGORI (HORIZONTAL SCROLL) */}
            <div className="w-full overflow-x-auto scrollbar-none px-4 py-2 flex gap-2">
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

            {/* TAB SUB-KATEGORI (HORIZONTAL SCROLL) */}
            {activeSubcategories.length > 1 && (
                <div className="w-full overflow-x-auto scrollbar-none px-4 py-1.5 flex gap-1.5 bg-slate-50 border-y border-slate-100 animate-in fade-in duration-200">
                    {activeSubcategories.map((subcat) => {
                        const isSubActive = selectedSubcategory === subcat
                        return (
                            <button
                                key={subcat}
                                onClick={() => setSelectedSubcategory(subcat)}
                                className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all duration-200 active:scale-95 ${isSubActive
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-white text-slate-500 border border-slate-200/80'
                                    }`}
                            >
                                {subcat}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* DAFTAR MENU DENGAN FITUR EKSPANSI AKORDEON */}
            <div className="flex flex-col gap-3 p-4 pt-0">
                {filteredAndSortedMenus.map((item) => {
                    const isSoldOut = item.status === 'sold_out'
                    const isLowStock = item.status === 'low_stock'
                    const isExpanded = expandedMenuId === item.id

                    return (
                        <div
                            key={item.id}
                            id={`menu-item-${item.id}`}
                            className={`relative flex flex-col p-4 rounded-3xl border transition-all duration-300 bg-white ${isSoldOut ? 'opacity-60 grayscale border-slate-100' : 'border-slate-200/80 shadow-sm'
                                }`}
                        >
                            {/* Baris Utama Item */}
                            <div className="flex justify-between items-center w-full">
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="font-black text-slate-800 tracking-tight">{item.name}</h3>
                                        {item.menu_type !== 'bundle' && (
                                            <Badge className={`${getGradeColor(item.nutri_grade)} border-none text-[8px] h-4.5 px-1.5 flex items-center justify-center font-bold`}>
                                                {item.nutri_grade}
                                            </Badge>
                                        )}
                                    </div>

                                    {item.is_featured && (
                                        <div className="text-[8px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-0.5 my-0.5">
                                            ⭐ UNGGULAN HARI INI
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2">
                                        <p className={`text-xs font-bold ${isSoldOut ? 'line-through text-slate-400' : 'text-slate-600'}`}>
                                            Rp {item.price.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    {isSoldOut ? (
                                        <div className="flex flex-col items-end gap-1">
                                            <Badge variant="destructive" className="font-black text-[9px] px-2 py-0">HABIS</Badge>
                                        </div>
                                    ) : (
                                        <div className="h-7 w-7 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                            <Leaf size={12} className="text-emerald-500" />
                                        </div>
                                    )}

                                    {/* Tombol Ekspansi + */}
                                    <button
                                        onClick={() => toggleExpand(item.id)}
                                        className="p-1.5 rounded-full hover:bg-slate-100 active:scale-90 transition-transform"
                                        title={isExpanded ? 'Tutup Detail' : 'Lihat Detail'}
                                    >
                                        <Plus
                                            size={16}
                                            className={`text-slate-600 transition-transform duration-300 ${isExpanded ? 'rotate-45 text-rose-500 scale-110' : ''
                                                }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Panel Detail Ekspansif (Accordion Collapse/Expand) */}
                            <div
                                className={`overflow-hidden transition-all duration-305 ease-in-out ${isExpanded
                                        ? 'max-h-[30rem] opacity-100 mt-4 border-t border-slate-100 pt-4'
                                        : 'max-h-0 opacity-0 pointer-events-none'
                                    }`}
                            >
                                <div className="flex flex-col md:flex-row gap-4">
                                    {/* Foto Produk */}
                                    <div className="w-full md:w-32 h-32 shrink-0 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 relative flex items-center justify-center text-slate-400">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                        ) : (
                                            /* Render SVG kopi placeholder cantik */
                                            <svg className="w-12 h-12 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l9-5-9-5-9 5 9 5zm0 0v6.5m0 0L7.5 18M12 20.5l4.5-2.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        )}
                                    </div>

                                    {/* Informasi & Deskripsi */}
                                    <div className="flex flex-col gap-2 flex-1 text-xs">
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Detail Info:</span>
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[8px] uppercase">
                                                Type: {item.category}
                                            </Badge>
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[8px] uppercase">
                                                Class: {getProductType(item.category)}
                                            </Badge>
                                            {item.menu_type !== 'bundle' && (
                                                <Badge className={`${getGradeColor(item.nutri_grade)} border-none text-[8px] font-bold`}>
                                                    Nutri-Grade: {item.nutri_grade}
                                                </Badge>
                                            )}
                                            {isLowStock && !item.variants?.length && (
                                                <Badge className="bg-orange-500 border-none text-[8px] font-bold text-white uppercase animate-pulse">
                                                    Sisa {item.stock} Porsi!
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-1 mt-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Deskripsi Produk</span>
                                            <p className="text-slate-600 leading-relaxed font-medium">
                                                {item.description || 'Nikmati kesegaran bahan-bahan organik pilihan terbaik persembahan CoffeeCommunitas untuk menemani hari Anda.'}
                                            </p>
                                        </div>

                                        {/* Tampilkan Varian jika Ada */}
                                        {item.variants && item.variants.length > 0 && (
                                            <div className="flex flex-col gap-1.5 mt-2 bg-slate-55 p-3 rounded-2xl border border-slate-100 bg-slate-50">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Pilihan Varian Tersedia</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {item.variants.map((v) => (
                                                        <Badge key={v.name} variant="secondary" className={`border-none font-bold text-[9px] px-2.5 py-1 ${
                                                            v.status === 'sold_out' || v.stock === 0
                                                                ? 'bg-slate-200 text-slate-400 line-through'
                                                                : 'bg-white text-slate-700 shadow-sm border border-slate-100'
                                                        }`}>
                                                            {v.name} ({v.status === 'sold_out' || v.stock === 0 ? 'Habis' : (v.stock <= 3 ? `${v.stock} Porsi` : 'Ready')})
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Tampilkan Komponen Bundling jika Menu adalah Paket */}
                                        {item.menu_type === 'bundle' && item.bundle_items && item.bundle_items.length > 0 && (
                                            <div className="flex flex-col gap-1.5 mt-2 p-3 rounded-2xl border border-slate-100 bg-slate-50">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Isi Paket (Komponen)</span>
                                                <div className="flex flex-col gap-1.5">
                                                    {item.bundle_items.map((bItem) => {
                                                        const compMenu = menus.find(m => m.id === bItem.id)
                                                        if (!compMenu) return null
                                                        return (
                                                            <div key={bItem.id + (bItem.variant_name || '')} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-100/80 shadow-sm text-slate-700">
                                                                <span className="font-bold text-xs text-slate-800">
                                                                    {compMenu.name} {bItem.variant_name ? `(${bItem.variant_name})` : ''} <span className="text-slate-400 font-bold text-[10px] ml-1 bg-slate-100 px-1.5 py-0.5 rounded">x{bItem.qty}</span>
                                                                </span>
                                                                <Badge className={`${getGradeColor(compMenu.nutri_grade)} border-none text-[8px] font-black text-white px-2 py-0.5`}>
                                                                    Grade {compMenu.nutri_grade}
                                                                </Badge>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* JIKA SOLD OUT: Tampilkan Rekomendasi Menu Alternatif */}
                                {isSoldOut && (
                                    <div className="mt-4 pt-3 border-t border-slate-100 animate-in slide-in-from-bottom duration-250">
                                        <span className="text-[10px] font-black text-indigo-650 uppercase tracking-wider flex items-center gap-1 mb-2 text-indigo-600">
                                            💡 Coba Alternatif Yang Tersedia:
                                        </span>
                                        <div className="grid grid-cols-2 gap-2">
                                            {getAlternativeMenus(item, menus).map((alt) => (
                                                <div
                                                    key={alt.id}
                                                    onClick={() => handleFeaturedCardClick(alt)}
                                                    className="flex items-center gap-2.5 p-2 rounded-xl border border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50 active:scale-95 cursor-pointer transition-all"
                                                >
                                                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                                                        {alt.image_url ? (
                                                            <img src={alt.image_url} alt={alt.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-slate-800 text-[10px] truncate leading-tight">{alt.name}</p>
                                                        <p className="text-[9px] text-emerald-600 font-bold mt-0.5">Rp {alt.price.toLocaleString('id-ID')}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}