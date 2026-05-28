'use client'

import { useEffect, useState, useMemo } from 'react'
import { useMenuStore, Menu, MenuStatus, NutriGrade, Variant, BundleItem, ScheduleItem } from '@/store/useMenuStore'
import { useAuthStore } from '@/store/useAuthStore'
import { Plus, Edit2, Trash2, X, Save, ArrowLeft, LogOut, Image, AlertTriangle, Search, ArrowUpDown, Users } from 'lucide-react'

export default function AdminDashboard() {
    const { menus, fetchMenus, toggleMenuFeatured, subscribeToRealtime } = useMenuStore()
    const { user, role, status, logout } = useAuthStore()

    // Sesi Authorization Guard Sisi Client
    const [isAuthorized, setIsAuthorized] = useState(false)

    // State CRUD & Modals
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingMenu, setEditingMenu] = useState<Menu | null>(null)
    const [errorMsg, setErrorMsg] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Form states
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [category, setCategory] = useState('Coffee')
    const [customCategory, setCustomCategory] = useState('')
    const [subcategory, setSubcategory] = useState('')
    const [price, setPrice] = useState(0)
    const [statusMenu, setStatusMenu] = useState<MenuStatus>('available')
    const [nutriGrade, setNutriGrade] = useState<NutriGrade>('C')
    const [stock, setStock] = useState<number | null>(null)
    const [imageUrl, setImageUrl] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string>('')
    const [isUploadingImage, setIsUploadingImage] = useState(false)

    // New Features states
    const [menuType, setMenuType] = useState<'single' | 'bundle'>('single')
    const [variants, setVariants] = useState<Variant[]>([])
    const [bundleItems, setBundleItems] = useState<BundleItem[]>([])
    const [schedule, setSchedule] = useState<ScheduleItem[]>([])
    const [alternatives, setAlternatives] = useState<string[]>([])

    // State Pencarian, Filter & Pengurutan
    const [searchQuery, setSearchQuery] = useState('')
    const [filterCategory, setFilterCategory] = useState('All')
    const [sortBy, setSortBy] = useState<'name' | 'price' | 'category' | 'stock' | 'status'>('name')

    // Dynamic categories computed from menus table
    const categories = useMemo(() => {
        const dbCategories = Array.from(new Set(menus.map(m => m.category))).filter(Boolean)
        const defaultOrder = ['Coffee', 'Non-Coffee', 'Food', 'Snack']
        const ordered = defaultOrder.filter(c => dbCategories.includes(c))
        const others = dbCategories.filter(c => !defaultOrder.includes(c))
        return [...ordered, ...others]
    }, [menus])
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

    // Client-side route guard
    useEffect(() => {
        console.log('=== [DEBUG] AdminDashboard: Route guard checking, status =', status, 'role =', role)
        if (status === 'loading' || status === 'idle') {
            return
        }

        if (status === 'authenticated' && (role === 'admin' || role === 'supervisor' || role === 'captain')) {
            setIsAuthorized(true)
        } else if (status === 'authenticated') {
            console.warn('=== [DEBUG] Unauthorized role for admin page, redirecting to /waiter ===')
            window.location.href = '/waiter'
        } else {
            console.warn('=== [DEBUG] Unauthenticated session for admin page, redirecting to /login ===')
            window.location.href = '/login'
        }
    }, [status, role])

    useEffect(() => {
        if (!isAuthorized) return

        console.log('=== [DEBUG] AdminDashboard mounted, calling fetchMenus ===')
        fetchMenus()
        const unsubscribe = subscribeToRealtime()
        return () => {
            console.log('=== [DEBUG] AdminDashboard unmounting, unsubscribing ===')
            unsubscribe()
        }
    }, [fetchMenus, subscribeToRealtime, isAuthorized])

    // Buka modal tambah menu baru
    const openAddModal = () => {
        setEditingMenu(null)
        setName('')
        setDescription('Nikmati kelezatan racikan khas CoffeeCommunitas.')
        setCategory('Coffee')
        setSubcategory('')
        setCustomCategory('')
        setPrice(15000)
        setStatusMenu('available')
        setNutriGrade('B')
        setStock(null)
        setImageUrl('')
        setSelectedFile(null)
        setImagePreview('')
        setErrorMsg('')

        setMenuType('single')
        setVariants([])
        setBundleItems([])
        setSchedule([])
        setAlternatives([])

        setIsModalOpen(true)
    }

    // Buka modal edit menu
    const openEditModal = (menu: Menu) => {
        setEditingMenu(menu)
        setName(menu.name)
        setDescription(menu.description || '')
        setCategory(menu.category)
        setSubcategory(menu.subcategory || '')
        setCustomCategory('')
        setPrice(menu.price)
        setStatusMenu(menu.status)
        setNutriGrade(menu.nutri_grade)
        setStock(menu.stock !== undefined ? menu.stock : null)
        setImageUrl(menu.image_url || '')
        setSelectedFile(null)
        setImagePreview(menu.image_url || '')
        setErrorMsg('')

        setMenuType(menu.menu_type || 'single')
        setVariants(menu.variants || [])
        setBundleItems(menu.bundle_items || [])
        setSchedule(menu.schedule || [])
        setAlternatives(menu.alternatives || [])

        setIsModalOpen(true)
    }

    // Toggle Featured Switch di Kolom Aksi Tabel Utama (Anti-Deadlock)
    const handleToggleFeatured = async (id: string, currentFeatured: boolean) => {
        await toggleMenuFeatured(id, currentFeatured)
    }

    // Menyimpan data (Insert / Update)
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setErrorMsg('')

        const { supabase } = await import('@/lib/supabase')

        let finalImageUrl = imageUrl

        // Unggah file jika ada file baru yang dipilih dari lokal
        if (selectedFile) {
            setIsUploadingImage(true)
            try {
                const fileExt = selectedFile.name.split('.').pop()
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
                const filePath = `products/${fileName}`

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('menu-images')
                    .upload(filePath, selectedFile, {
                        cacheControl: '3600',
                        upsert: false
                    })

                if (uploadError) {
                    throw new Error('Gagal menyimpan file ke Supabase Storage: ' + uploadError.message)
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('menu-images')
                    .getPublicUrl(filePath)

                finalImageUrl = publicUrl
            } catch (err: any) {
                console.error('File upload failed:', err)
                setErrorMsg(err.message || 'Gagal mengunggah foto produk.')
                setIsUploadingImage(false)
                setIsSubmitting(false)
                return
            } finally {
                setIsUploadingImage(false)
            }
        }

        const resolvedCategory = category === 'CUSTOM' ? customCategory.trim() : category
        if (!resolvedCategory) {
            setErrorMsg('Kategori wajib diisi!')
            setIsSubmitting(false)
            return
        }

        const menuData = {
            name,
            description,
            category: resolvedCategory,
            subcategory: subcategory || null,
            price: Number(price),
            status: statusMenu,
            nutri_grade: nutriGrade,
            stock: menuType === 'bundle'
                ? null
                : (variants.length > 0
                    ? variants.reduce((sum, v) => sum + v.stock, 0)
                    : (statusMenu === 'low_stock' ? (stock !== null ? Number(stock) : 3) : (statusMenu === 'sold_out' ? 0 : null))),
            image_url: finalImageUrl || null,
            menu_type: menuType,
            variants: variants.length > 0 ? variants : [],
            bundle_items: menuType === 'bundle' ? bundleItems : [],
            schedule: schedule.length > 0 ? schedule : [],
            alternatives: alternatives.length > 0 ? alternatives : []
        }

        let resError;
        if (editingMenu) {
            const { error } = await supabase
                .from('menus')
                .update(menuData)
                .eq('id', editingMenu.id)
            resError = error
        } else {
            const { error } = await supabase
                .from('menus')
                .insert([menuData])
            resError = error
        }

        if (resError) {
            setErrorMsg(resError.message)
            setIsSubmitting(false)
        } else {
            try {
                const { writeAuditLog } = await import('@/lib/audit')
                if (editingMenu) {
                    await writeAuditLog(`Mengubah detail menu "${editingMenu.name}" (Kategori: ${resolvedCategory}, Harga: Rp ${price.toLocaleString('id-ID')})`)
                } else {
                    await writeAuditLog(`Menambahkan menu baru "${name}" (Kategori: ${resolvedCategory}, Harga: Rp ${price.toLocaleString('id-ID')})`)
                }
            } catch (err) {
                console.error('Error logging handleSave:', err)
            }
            setIsSubmitting(false)
            setIsModalOpen(false)
            fetchMenus()
        }
    }

    // Menghapus data menu
    const handleDelete = async (id: string) => {
        const menuToDelete = menus.find(m => m.id === id)
        if (menuToDelete?.is_featured) {
            const totalFeatured = menus.filter(m => m.is_featured).length
            if (totalFeatured <= 2) {
                alert('Gagal menghapus! Menu unggulan wajib minimal 2 item. Silakan nonaktifkan status unggulannya (ubah toggle) setelah menetapkan menu lain.')
                return
            }
        }

        if (!confirm(`Apakah Anda yakin ingin menghapus "${menuToDelete?.name}"?`)) return

        const { supabase } = await import('@/lib/supabase')
        const { error } = await supabase
            .from('menus')
            .delete()
            .eq('id', id)

        if (error) {
            alert(`Gagal menghapus: ${error.message}`)
        } else {
            try {
                const { writeAuditLog } = await import('@/lib/audit')
                await writeAuditLog(`Menghapus menu "${menuToDelete?.name}" dari database`)
            } catch (err) {
                console.error('Error logging handleDelete:', err)
            }
            fetchMenus()
        }
    }

    // Menghapus SEMUA data menu (Reset Data)
    const handleResetAll = async () => {
        if (!confirm('PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA menu dari database? Tindakan ini akan mengosongkan seluruh daftar menu dan tidak dapat dibatalkan!')) return
        if (!confirm('KONFIRMASI KEDUA: Apakah Anda benar-benar yakin? Semua pesanan aktif dan rekomendasi menu juga akan terpengaruh!')) return
        
        const confirmText = prompt('Untuk mengonfirmasi penghapusan massal, ketik kata "RESET" di bawah ini:')
        if (confirmText !== 'RESET') {
            alert('Konfirmasi dibatalkan. Kata kunci yang Anda masukkan salah.')
            return
        }

        const { supabase } = await import('@/lib/supabase')
        const { error } = await supabase
            .from('menus')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000')

        if (error) {
            alert(`Gagal mereset data: ${error.message}`)
        } else {
            try {
                const { writeAuditLog } = await import('@/lib/audit')
                await writeAuditLog('Melakukan RESET MASSAL: Menghapus semua menu dari database')
            } catch (err) {
                console.error('Error logging handleResetAll:', err)
            }
            alert('Seluruh data menu berhasil dihapus!')
            fetchMenus()
        }
    }

    const handleLogout = async () => {
        await logout()
        window.location.href = '/login'
    }

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
                        <h2 className="text-md font-bold mt-3 text-slate-200">Memverifikasi Otoritas Admin...</h2>
                        <p className="text-[11px] text-slate-500 mt-1">Harap tunggu sebentar selagi sistem melakukan autentikasi sesi Anda.</p>
                    </div>
                </div>
            </main>
        )
    }

    const filteredAndSortedMenus = menus
        .filter((item) => {
            // Filter berdasarkan pencarian
            const matchesSearch =
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))

            // Filter berdasarkan kategori
            const matchesCategory =
                filterCategory === 'All' || item.category === filterCategory

            return matchesSearch && matchesCategory
        })
        .sort((a, b) => {
            let valA: any = a[sortBy]
            let valB: any = b[sortBy]

            if (sortBy === 'stock') {
                valA = a.stock ?? -1
                valB = b.stock ?? -1
            } else if (sortBy === 'status') {
                const statusPriority = { available: 1, low_stock: 2, sold_out: 3 }
                const priorityA = statusPriority[a.status] || 99
                const priorityB = statusPriority[b.status] || 99
                return sortDirection === 'asc'
                    ? priorityA - priorityB
                    : priorityB - priorityA
            }

            if (typeof valA === 'string') {
                const strB = (valB as string) || ''
                return sortDirection === 'asc'
                    ? valA.localeCompare(strB)
                    : strB.localeCompare(valA)
            } else {
                // Numbers
                const numA = (valA as number) || 0
                const numB = (valB as number) || 0
                return sortDirection === 'asc'
                    ? numA - numB
                    : numB - numA
            }
        })

    return (
        <main className="min-h-screen bg-slate-50 flex flex-col max-w-4xl mx-auto border-x border-slate-200">
            {/* Header Admin */}
            <header className="sticky top-0 bg-slate-900 text-white z-10 p-5 border-b border-slate-800 shadow-md">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="bg-red-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded">ADMIN PANEL</span>
                            <h1 className="text-lg font-black tracking-tight">coffeecomunitas</h1>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">{user?.email}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        {(role === 'admin' || role === 'supervisor') && (
                            <a href="/admin/users" className="bg-slate-800 text-slate-200 hover:bg-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors">
                                <Users size={12} /> Staf
                            </a>
                        )}
                        <a href="/waiter" className="bg-slate-800 text-slate-200 hover:bg-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors">
                            <ArrowLeft size={12} /> Waiter
                        </a>
                        <button onClick={handleLogout} className="bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white p-2.5 rounded-xl border border-rose-500/30 transition-colors active:scale-95">
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Konten Utama */}
            <section className="p-6 flex-1 flex flex-col gap-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-slate-800">Manajemen Menu Kafe</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Tambah, edit, hapus, dan atur menu unggulan Anda.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleResetAll} className="bg-rose-50/80 hover:bg-rose-100/95 text-rose-600 hover:text-rose-700 font-bold border border-rose-200 text-xs px-3.5 py-3 rounded-xl active:scale-95 transition-transform flex items-center gap-1.5 shadow-sm" title="Hapus Semua Menu">
                            🗑️ Reset Data
                        </button>
                        <button onClick={openAddModal} className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-4 py-3 rounded-xl flex items-center gap-1.5 active:scale-95 transition-transform shadow-md">
                            <Plus size={16} /> Tambah Menu
                        </button>
                    </div>
                </div>

                {/* Info Card Unggulan */}
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3 text-amber-900">
                    <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                    <div className="text-xs font-medium">
                        <span className="font-bold">Info Menu Unggulan:</span> Saat ini terdapat <span className="font-bold text-amber-955 underline">{menus.filter(m => m.is_featured).length} menu unggulan</span> aktif. Aktifkan minimal **2 menu** menggunakan sakelar (*toggle*) di samping tombol pen (edit) agar carousel 3D di halaman utama pelanggan tampil sempurna.
                    </div>
                </div>

                {/* Search & Sort Panel */}
                <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-sm flex flex-col sm:flex-row gap-3">
                    {/* Search query input */}
                    <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Search size={14} />
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Cari nama menu atau deskripsi..."
                            className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none focus:border-slate-800 focus:bg-white transition-all font-medium text-slate-800"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Filter Category & Sort Controls */}
                    <div className="flex gap-2">
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-slate-800"
                        >
                            <option value="All">Semua Kategori</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>

                        {/* Sort By Field */}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-slate-800"
                        >
                            <option value="name">Urutkan: Nama</option>
                            <option value="price">Urutkan: Harga</option>
                            <option value="category">Urutkan: Kategori</option>
                            <option value="stock">Urutkan: Stok</option>
                            <option value="status">Urutkan: Status</option>
                        </select>

                        {/* Sort Direction Toggle */}
                        <button
                            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                            className="bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-2xl p-2.5 text-slate-700 transition-all active:scale-95 flex items-center justify-center"
                            title={sortDirection === 'asc' ? 'Urutan Naik (A-Z / Terkecil)' : 'Urutan Turun (Z-A / Terbesar)'}
                        >
                            <ArrowUpDown size={14} className={sortDirection === 'desc' ? 'rotate-180 transition-transform duration-200' : 'transition-transform duration-200'} />
                        </button>
                    </div>
                </div>

                {/* Tabel Menu */}
                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                                    <th className="p-4 w-16">Foto</th>
                                    <th className="p-4">Nama & Deskripsi</th>
                                    <th className="p-4">Kategori & Sub</th>
                                    <th className="p-4">Harga</th>
                                    <th className="p-4">Status & Stok</th>
                                    <th className="p-4 text-center w-36">Aksi (Unggulan & Edit)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredAndSortedMenus.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt={item.name} className="w-10 h-10 object-cover rounded-xl border border-slate-200" />
                                            ) : (
                                                <div className="w-10 h-10 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400">
                                                    <Image size={16} />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1.5">
                                                <p className="font-black text-slate-800 text-sm leading-tight">{item.name}</p>
                                                {item.menu_type === 'bundle' && (
                                                    <span className="bg-indigo-600 text-white text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">PAKET</span>
                                                )}
                                            </div>
                                            <p className="text-slate-400 text-[10px] mt-0.5 line-clamp-1 max-w-xs">{item.description || 'Tidak ada deskripsi.'}</p>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase text-slate-500 w-max">
                                                    {item.category}
                                                </span>
                                                {item.subcategory && (
                                                    <span className="bg-emerald-55 border border-emerald-200 px-2 py-0.5 rounded text-[9px] font-black uppercase text-emerald-600 w-max">
                                                        {item.subcategory}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 font-bold text-slate-800">
                                            Rp {item.price.toLocaleString('id-ID')}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-0.5">
                                                <span className={`font-black text-[9px] uppercase tracking-wider w-max ${item.status === 'available' ? 'text-emerald-600' :
                                                        item.status === 'low_stock' ? 'text-amber-600' : 'text-red-500'
                                                    }`}>
                                                    {item.status === 'available' ? 'Tersedia' :
                                                        item.status === 'low_stock' ? 'Menipis' : 'Habis'}
                                                </span>
                                                {item.menu_type !== 'bundle' && (
                                                    <span className="text-[9px] text-slate-400 font-bold">
                                                        Stok: {item.variants && item.variants.length > 0
                                                            ? `${item.variants.reduce((sum, v) => sum + v.stock, 0)} (Varian)`
                                                            : (item.stock ?? 0)
                                                        }
                                                    </span>
                                                )}
                                                {item.menu_type === 'bundle' && (
                                                    <span className="text-[9px] text-indigo-500 font-bold">
                                                        Stok Paket: {item.stock ?? 0}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {/* Toggle switch di samping edit (pen) */}
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                {/* Label Switch */}
                                                <label className="relative inline-flex items-center cursor-pointer" title={item.is_featured ? "Menu Unggulan Aktif" : "Aktifkan Rekomendasi 3D"}>
                                                    <input
                                                        type="checkbox"
                                                        checked={!!item.is_featured}
                                                        onChange={() => handleToggleFeatured(item.id, !!item.is_featured)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-400"></div>
                                                </label>

                                                <button onClick={() => openEditModal(item)} className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors" title="Edit Menu">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(item.id)} className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors" title="Hapus Menu">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Modal Dialog Form Tambah / Edit */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-md">{editingMenu ? 'Edit Menu' : 'Tambah Menu Baru'}</h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">Isi form di bawah untuk memodifikasi database menu.</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="bg-slate-800 p-2 rounded-full text-slate-300 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSave} className="p-5 overflow-y-auto flex flex-col gap-4 text-xs">
                            {errorMsg && (
                                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl font-bold leading-tight flex items-start gap-2">
                                    <AlertTriangle size={16} className="shrink-0 text-rose-500 mt-0.5" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            <div className="flex flex-col gap-1">
                                <label className="font-bold text-slate-500 uppercase tracking-wider">Nama Menu</label>
                                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="border border-slate-200 rounded-xl p-3 outline-none focus:border-slate-800 font-bold text-slate-800" placeholder="Kopi Susu Gula Aren..." />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-bold text-slate-500 uppercase tracking-wider">Deskripsi Menu</label>
                                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="border border-slate-200 rounded-xl p-3 outline-none focus:border-slate-800 font-medium text-slate-800 h-16 resize-none" placeholder="Masukkan deskripsi singkat produk..." />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="font-bold text-slate-500 uppercase tracking-wider">Kategori</label>
                                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="border border-slate-200 rounded-xl p-2.5 outline-none focus:border-slate-800 font-bold bg-white text-slate-800">
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                        <option value="CUSTOM">+ Kategori Baru...</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="font-bold text-slate-500 uppercase tracking-wider">Sub-Kategori</label>
                                    <input type="text" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className="border border-slate-200 rounded-xl p-2.5 outline-none focus:border-slate-800 font-bold text-slate-800" placeholder="misal: Latte" />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="font-bold text-slate-500 uppercase tracking-wider">Harga (Rp)</label>
                                    <input type="number" required value={price} onChange={(e) => setPrice(Number(e.target.value))} className="border border-slate-200 rounded-xl p-2.5 outline-none focus:border-slate-800 font-bold text-slate-800" />
                                </div>
                            </div>

                            {category === 'CUSTOM' && (
                                <div className="flex flex-col gap-1 mt-1.5 animate-in fade-in duration-200">
                                    <label className="font-bold text-slate-500 uppercase tracking-wider">Nama Kategori Baru</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={customCategory} 
                                        onChange={(e) => setCustomCategory(e.target.value)} 
                                        className="border border-slate-200 rounded-xl p-2.5 outline-none focus:border-slate-800 font-bold text-slate-800" 
                                        placeholder="misal: Dessert" 
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="font-bold text-slate-500 uppercase tracking-wider">Nutri-Grade</label>
                                    <select value={nutriGrade} onChange={(e) => setNutriGrade(e.target.value as NutriGrade)} className="border border-slate-200 rounded-xl p-3 outline-none focus:border-slate-800 font-bold bg-white text-slate-800">
                                        <option value="A">Nutri-Grade A</option>
                                        <option value="B">Nutri-Grade B</option>
                                        <option value="C">Nutri-Grade C</option>
                                        <option value="D">Nutri-Grade D</option>
                                        <option value="E">Nutri-Grade E</option>
                                    </select>
                                </div>

                                 <div className="flex flex-col gap-1">
                                    <label className="font-bold text-slate-500 uppercase tracking-wider">Status Menu</label>
                                    <select value={statusMenu} onChange={(e) => setStatusMenu(e.target.value as MenuStatus)} className="border border-slate-200 rounded-xl p-3 outline-none focus:border-slate-800 font-bold bg-white text-slate-800">
                                        <option value="available">Tersedia</option>
                                        <option value="low_stock">Menipis (Low Stock)</option>
                                        <option value="sold_out">Habis (Sold Out)</option>
                                    </select>
                                </div>
                            </div>

                            {/* TIPE MENU: SINGLE ATAU BUNDLE */}
                            <div className="flex flex-col gap-1">
                                <label className="font-bold text-slate-500 uppercase tracking-wider">Tipe Menu</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setMenuType('single')}
                                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                                            menuType === 'single'
                                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                                : 'bg-white text-slate-500 border-slate-200'
                                        }`}
                                    >
                                        Single (Biasa)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMenuType('bundle')}
                                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                                            menuType === 'bundle'
                                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                                : 'bg-white text-slate-500 border-slate-200'
                                        }`}
                                    >
                                        Bundle (Paket/Combo)
                                    </button>
                                </div>
                            </div>

                            {/* KOMPONEN BUNDLE ITEMS */}
                            {menuType === 'bundle' && (
                                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col gap-2">
                                    <span className="font-bold text-slate-600 uppercase tracking-wider text-[9px]">Isi Komponen Paket</span>
                                    
                                    <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                                        {bundleItems.map((bi, idx) => {
                                            const target = menus.find(m => m.id === bi.id)
                                            return (
                                                <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-150 text-[10px] font-medium text-slate-800">
                                                    <span className="truncate max-w-[200px]">
                                                        {target ? target.name : 'Unknown Item'}{bi.variant_name ? ` (${bi.variant_name})` : ''} <span className="text-emerald-600 font-bold">x{bi.qty}</span>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setBundleItems(bundleItems.filter((_, i) => i !== idx))}
                                                        className="text-rose-500 hover:text-rose-700 font-bold"
                                                    >
                                                        Hapus
                                                    </button>
                                                </div>
                                            )
                                        })}
                                        {bundleItems.length === 0 && (
                                            <span className="text-[10px] text-slate-400 italic">Belum ada komponen ditambahkan.</span>
                                        )}
                                    </div>

                                    <div className="flex gap-1.5 items-end mt-2 pt-2 border-t border-slate-200">
                                        <div className="flex-1 flex flex-col gap-1">
                                            <span className="text-[8px] font-bold text-slate-400">Pilih Menu</span>
                                            <select
                                                id="bundle-item-select"
                                                className="border border-slate-200 rounded p-1.5 text-[10px] bg-white font-medium text-slate-800"
                                            >
                                                <option value="">-- Pilih --</option>
                                                {menus
                                                    .filter(m => m.menu_type !== 'bundle' && m.id !== editingMenu?.id)
                                                    .map(m => (
                                                        <option key={m.id} value={m.id}>{m.name}</option>
                                                    ))
                                                }
                                            </select>
                                        </div>

                                        <div className="w-12 flex flex-col gap-1">
                                            <span className="text-[8px] font-bold text-slate-400">Qty</span>
                                            <input
                                                id="bundle-item-qty"
                                                type="number"
                                                defaultValue={1}
                                                min={1}
                                                className="border border-slate-200 rounded p-1 text-[10px] font-medium text-slate-800"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                const selectEl = document.getElementById('bundle-item-select') as HTMLSelectElement
                                                const qtyEl = document.getElementById('bundle-item-qty') as HTMLInputElement
                                                const menuId = selectEl.value
                                                const qty = Number(qtyEl.value || 1)
                                                if (!menuId) return

                                                const target = menus.find(m => m.id === menuId)
                                                let variantName: string | undefined = undefined
                                                
                                                if (target?.variants && target.variants.length > 0) {
                                                    const vName = prompt(`Menu ini memiliki varian. Masukkan nama varian yang tepat (${target.variants.map(v => v.name).join(', ')}):`)
                                                    if (!vName) return
                                                    const valid = target.variants.some(v => v.name.toLowerCase() === vName.toLowerCase())
                                                    if (!valid) {
                                                        alert('Nama varian tidak valid!')
                                                        return
                                                    }
                                                    variantName = target.variants.find(v => v.name.toLowerCase() === vName.toLowerCase())?.name
                                                }

                                                const exists = bundleItems.some(bi => bi.id === menuId && bi.variant_name === variantName)
                                                if (exists) {
                                                    alert('Komponen ini sudah ada di paket!')
                                                    return
                                                }

                                                setBundleItems([...bundleItems, { id: menuId, qty, variant_name: variantName }])
                                                selectEl.value = ''
                                                qtyEl.value = '1'
                                            }}
                                            className="bg-slate-900 text-white px-3 py-1.5 rounded text-[10px] font-black uppercase hover:bg-slate-800"
                                        >
                                            Tambah
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* PENGATURAN VARIAN PRODUK */}
                            {menuType === 'single' && (
                                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col gap-2">
                                    <span className="font-bold text-slate-600 uppercase tracking-wider text-[9px]">Atur Varian Produk (Opsional)</span>
                                    <p className="text-[9px] text-slate-400 leading-tight">Jika varian ditambahkan, stok global akan otomatis dihitung dari jumlah stok seluruh varian.</p>

                                    <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                                        {variants.map((v, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-150 text-[10px] font-medium">
                                                <span className="text-slate-700">
                                                    {v.name} &mdash; <span className="text-amber-600 font-bold">Stok: {v.stock}</span>
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setVariants(variants.filter((_, i) => i !== idx))}
                                                    className="text-rose-500 hover:text-rose-700 font-bold"
                                                >
                                                    Hapus
                                                </button>
                                            </div>
                                        ))}
                                        {variants.length === 0 && (
                                            <span className="text-[10px] text-slate-400 italic">Belum ada varian (stok mengikuti stok global di bawah).</span>
                                        )}
                                    </div>

                                    <div className="flex gap-1.5 items-end mt-2 pt-2 border-t border-slate-200">
                                        <div className="flex-1 flex flex-col gap-1">
                                            <span className="text-[8px] font-bold text-slate-400">Nama Varian</span>
                                            <input id="variant-name-input" type="text" placeholder="misal: Hot / Ice" className="border border-slate-200 rounded p-1 text-[10px] text-slate-800" />
                                        </div>

                                        <div className="w-16 flex flex-col gap-1">
                                            <span className="text-[8px] font-bold text-slate-400">Stok</span>
                                            <input id="variant-stock-input" type="number" defaultValue={10} min={0} className="border border-slate-200 rounded p-1 text-[10px] text-slate-800" />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                const nameEl = document.getElementById('variant-name-input') as HTMLInputElement
                                                const stockEl = document.getElementById('variant-stock-input') as HTMLInputElement
                                                const vName = nameEl.value.trim()
                                                const vStock = Number(stockEl.value || 0)
                                                if (!vName) return

                                                if (variants.some(v => v.name.toLowerCase() === vName.toLowerCase())) {
                                                    alert('Nama varian sudah ada!')
                                                    return
                                                }

                                                const vStatus: MenuStatus = vStock === 0 
                                                    ? 'sold_out' 
                                                    : (vStock <= 3 ? 'low_stock' : 'available')

                                                setVariants([...variants, { name: vName, stock: vStock, status: vStatus }])
                                                nameEl.value = ''
                                                stockEl.value = '10'
                                            }}
                                            className="bg-slate-900 text-white px-3 py-1.5 rounded text-[10px] font-black uppercase hover:bg-slate-800"
                                        >
                                            Tambah
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* INPUT STOK GLOBAL */}
                            {statusMenu === 'low_stock' && menuType === 'single' && variants.length === 0 && (
                                <div className="flex flex-col gap-1 animate-in slide-in-from-top duration-200">
                                    <label className="font-bold text-slate-500 uppercase tracking-wider">Sisa Porsi (Stok)</label>
                                    <input type="number" value={stock || 3} onChange={(e) => setStock(Number(e.target.value))} className="border border-slate-200 rounded-xl p-3 outline-none focus:border-slate-800 font-bold text-slate-800" min={1} />
                                </div>
                            )}

                            {/* JADWAL TAMPILAN MINGGUAN */}
                            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col gap-2">
                                <span className="font-bold text-slate-600 uppercase tracking-wider text-[9px]">Jadwal Tampil Mingguan (Opsional)</span>
                                <p className="text-[9px] text-slate-400 leading-tight">Kosongkan jadwal agar menu selalu aktif dan ditampilkan setiap saat.</p>

                                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                                    {schedule.map((s, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-150 text-[10px] font-medium">
                                            <span className="text-slate-700">
                                                {s.day} &mdash; <span className="text-emerald-600 font-bold">{s.start_time} - {s.end_time}</span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setSchedule(schedule.filter((_, i) => i !== idx))}
                                                className="text-rose-500 hover:text-rose-700 font-bold"
                                            >
                                                Hapus
                                            </button>
                                        </div>
                                    ))}
                                    {schedule.length === 0 && (
                                        <span className="text-[10px] text-slate-400 italic">Selalu tampil (aktif 24/7).</span>
                                    )}
                                </div>

                                <div className="flex gap-1.5 items-end mt-2 pt-2 border-t border-slate-200">
                                    <div className="flex-1 flex flex-col gap-1">
                                        <span className="text-[8px] font-bold text-slate-400">Hari</span>
                                        <select id="schedule-day-select" className="border border-slate-200 rounded p-1 text-[10px] bg-white font-medium text-slate-800">
                                            <option value="Senin">Senin</option>
                                            <option value="Selasa">Selasa</option>
                                            <option value="Rabu">Rabu</option>
                                            <option value="Kamis">Kamis</option>
                                            <option value="Jumat">Jumat</option>
                                            <option value="Sabtu">Sabtu</option>
                                            <option value="Minggu">Minggu</option>
                                        </select>
                                    </div>

                                    <div className="w-16 flex flex-col gap-1">
                                        <span className="text-[8px] font-bold text-slate-400">Mulai</span>
                                        <input id="schedule-start-input" type="time" defaultValue="08:00" className="border border-slate-200 rounded p-1 text-[10px] text-slate-800" />
                                    </div>

                                    <div className="w-16 flex flex-col gap-1">
                                        <span className="text-[8px] font-bold text-slate-400">Selesai</span>
                                        <input id="schedule-end-input" type="time" defaultValue="17:00" className="border border-slate-200 rounded p-1 text-[10px] text-slate-800" />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const dayEl = document.getElementById('schedule-day-select') as HTMLSelectElement
                                            const startEl = document.getElementById('schedule-start-input') as HTMLInputElement
                                            const endEl = document.getElementById('schedule-end-input') as HTMLInputElement
                                            const day = dayEl.value
                                            const start = startEl.value
                                            const end = endEl.value
                                            if (!day || !start || !end) return

                                            if (start >= end) {
                                                alert('Waktu selesai harus lebih lambat dari waktu mulai!')
                                                return
                                            }

                                            setSchedule([...schedule, { day, start_time: start, end_time: end }])
                                        }}
                                        className="bg-slate-900 text-white px-3 py-1.5 rounded text-[10px] font-black uppercase hover:bg-slate-800"
                                    >
                                        Tambah
                                    </button>
                                </div>
                            </div>

                            {/* REKOMENDASI ALTERNATIF KUSTOM */}
                            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col gap-2">
                                <span className="font-bold text-slate-600 uppercase tracking-wider text-[9px]">Rekomendasi Alternatif Kustom (Jika Habis)</span>
                                <p className="text-[9px] text-slate-400 leading-tight">Jika dikosongkan, sistem otomatis menyarankan menu lain dari kategori sejenis.</p>

                                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                                    {alternatives.map((altId, idx) => {
                                        const target = menus.find(m => m.id === altId)
                                        return (
                                            <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-150 text-[10px] font-medium">
                                                <span className="text-slate-700 truncate max-w-[200px]">
                                                    {target ? target.name : 'Unknown Item'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setAlternatives(alternatives.filter((_, i) => i !== idx))}
                                                    className="text-rose-500 hover:text-rose-700 font-bold"
                                                >
                                                    Hapus
                                                </button>
                                            </div>
                                        )
                                    })}
                                    {alternatives.length === 0 && (
                                        <span className="text-[10px] text-slate-400 italic">Saran otomatis sistem aktif.</span>
                                    )}
                                </div>

                                <div className="flex gap-1.5 items-end mt-2 pt-2 border-t border-slate-200">
                                    <div className="flex-1 flex flex-col gap-1">
                                        <span className="text-[8px] font-bold text-slate-400">Pilih Menu Alternatif</span>
                                        <select id="alternative-select" className="border border-slate-200 rounded p-1.5 text-[10px] bg-white font-medium text-slate-800">
                                            <option value="">-- Pilih --</option>
                                            {menus
                                                .filter(m => m.id !== editingMenu?.id && m.menu_type !== 'bundle')
                                                .map(m => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const selectEl = document.getElementById('alternative-select') as HTMLSelectElement
                                            const altId = selectEl.value
                                            if (!altId) return

                                            if (alternatives.includes(altId)) {
                                                alert('Menu ini sudah ada di daftar alternatif!')
                                                return
                                            }

                                            setAlternatives([...alternatives, altId])
                                            selectEl.value = ''
                                        }}
                                        className="bg-slate-900 text-white px-3 py-1.5 rounded text-[10px] font-black uppercase hover:bg-slate-800"
                                    >
                                        Tambah
                                    </button>
                                </div>
                            </div>

                            {/* UPLOAD FOTO PRODUK */}
                            <div className="flex flex-col gap-1">
                                <label className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Foto Produk</label>
                                
                                {imagePreview ? (
                                    <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-slate-200 group bg-slate-50">
                                        <img src={imagePreview} alt="Pratampilan produk" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <label className="bg-white text-slate-900 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md cursor-pointer hover:bg-slate-100 transition-colors">
                                                Ganti Foto
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="hidden" 
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0]
                                                        if (file) {
                                                            setSelectedFile(file)
                                                            setImagePreview(URL.createObjectURL(file))
                                                        }
                                                    }}
                                                />
                                            </label>
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    setSelectedFile(null)
                                                    setImagePreview('')
                                                    setImageUrl('')
                                                }}
                                                className="bg-rose-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md hover:bg-rose-600 transition-colors"
                                            >
                                                Hapus
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-slate-800 hover:bg-slate-50/50 transition-all text-slate-400 hover:text-slate-650">
                                        <svg className="w-8 h-8 text-slate-350" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375 0 11-.75 0 .375 0 01.75 0z" />
                                        </svg>
                                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pilih Foto Lokal</div>
                                        <div className="text-[9px] text-slate-400 font-medium">JPEG, PNG, WebP (maks. 2MB)</div>
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={(e) => {
                                                const file = e.target.files?.[0]
                                                if (file) {
                                                    setSelectedFile(file)
                                                    setImagePreview(URL.createObjectURL(file))
                                                }
                                            }}
                                        />
                                    </label>
                                )}
                            </div>

                             <button type="submit" disabled={isSubmitting || isUploadingImage} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl uppercase tracking-wider mt-3 disabled:bg-slate-400 active:scale-95 transition-transform flex items-center justify-center gap-1.5 shadow-md">
                                 <Save size={16} /> {isUploadingImage ? 'Mengunggah Gambar...' : (isSubmitting ? 'Menyimpan...' : 'Simpan Menu')}
                             </button>
                        </form>
                    </div>
                </div>
            )}
        </main>
    )
}