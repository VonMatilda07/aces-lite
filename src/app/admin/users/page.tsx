'use client'

import { useEffect, useState } from 'react'
import { supabase, supabasePublic } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { ArrowLeft, User, Shield, Trash2, Search, Users, Check, AlertTriangle, Plus, X, Eye, Key, Mail, RefreshCw, Clock } from 'lucide-react'
import { writeAuditLog } from '@/lib/audit'

interface Profile {
    id: string
    email: string
    role: string
    created_at: string
}

interface AuditLog {
    id: string
    created_at: string
    changed_by: string
    description: string
}

export default function UserManagement() {
    const { user, role, status } = useAuthStore()
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [activeTab, setActiveTab] = useState<'staff' | 'logs'>('staff')

    // Profiles states
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [isLoadingProfiles, setIsLoadingProfiles] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterRole, setFilterRole] = useState('All')

    // Logs states
    const [logs, setLogs] = useState<AuditLog[]>([])
    const [isLoadingLogs, setIsLoadingLogs] = useState(false)
    const [searchQueryLogs, setSearchQueryLogs] = useState('')

    // Common feedback message
    const [feedbackMsg, setFeedbackMsg] = useState({ text: '', type: 'success' })
    const [isUpdating, setIsUpdating] = useState<string | null>(null)

    // Add Staff Modal states
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [newRole, setNewRole] = useState('waiter')
    const [isSubmittingAdd, setIsSubmittingAdd] = useState(false)
    const [addError, setAddError] = useState('')

    // Client-side route guard
    useEffect(() => {
        if (status === 'loading' || status === 'idle') return

        if (status === 'authenticated' && role === 'marketing') {
            window.location.href = '/admin/feedback'
        } else if (status === 'authenticated' && (role === 'admin' || role === 'supervisor')) {
            setIsAuthorized(true)
        } else if (status === 'authenticated') {
            // Redirect captain or waiter to appropriate page
            window.location.href = role === 'captain' ? '/admin' : '/waiter'
        } else {
            window.location.href = '/login'
        }
    }, [status, role])

    // Fetch all profiles
    const fetchProfiles = async () => {
        setIsLoadingProfiles(true)
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('email', { ascending: true })

        if (error) {
            console.error('Error fetching profiles:', error)
            showFeedback('Gagal memuat daftar staf: ' + error.message, 'error')
        } else if (data) {
            const mappedProfiles = (data as Profile[]).map(p => ({
                ...p,
                role: p.role === 'admin' ? 'supervisor' : (p.role === 'barista' ? 'captain' : p.role)
            }))
            setProfiles(mappedProfiles)
        }
        setIsLoadingProfiles(false)
    }

    // Fetch all logs
    const fetchLogs = async () => {
        setIsLoadingLogs(true)
        try {
            const response = await fetch('/api/audit-logs')
            if (response.ok) {
                const data = await response.json()
                setLogs(data)
            } else {
                console.error('Failed to fetch logs:', await response.text())
                showFeedback('Gagal memuat log aktivitas', 'error')
            }
        } catch (error) {
            console.error('Error fetching logs:', error)
            showFeedback('Gagal memuat log aktivitas', 'error')
        } finally {
            setIsLoadingLogs(false)
        }
    }

    useEffect(() => {
        if (isAuthorized) {
            fetchProfiles()
        }
    }, [isAuthorized])

    const showFeedback = (text: string, type: 'success' | 'error') => {
        setFeedbackMsg({ text, type })
        setTimeout(() => setFeedbackMsg({ text: '', type: 'success' }), 4000)
    }

    // Handle Role Update
    const handleUpdateRole = async (userId: string, newRoleName: string, userEmail: string, oldRoleName: string) => {
        setIsUpdating(userId)
        const dbRole = newRoleName === 'supervisor' ? 'admin' : (newRoleName === 'captain' ? 'barista' : newRoleName)
        const { error } = await supabase
            .from('profiles')
            .update({ role: dbRole })
            .eq('id', userId)

        if (error) {
            console.error('Error updating role:', error)
            showFeedback('Gagal memperbarui hak akses: ' + error.message, 'error')
        } else {
            showFeedback('Hak akses staf berhasil diperbarui!', 'success')
            // Tulis audit log
            await writeAuditLog(`Mengubah peran staf "${userEmail}" dari "${oldRoleName.toUpperCase()}" menjadi "${newRoleName.toUpperCase()}"`)
            // Update local state
            setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRoleName } : p))
        }
        setIsUpdating(null)
    }

    // Handle Delete Profile
    const handleDeleteProfile = async (userId: string, userEmail: string) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus staf "${userEmail}" dari sistem?`)) return

        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId)

        if (error) {
            console.error('Error deleting profile:', error)
            showFeedback('Gagal menghapus staf: ' + error.message, 'error')
        } else {
            showFeedback('Staf berhasil dihapus!', 'success')
            // Tulis audit log
            await writeAuditLog(`Menghapus staf "${userEmail}" dari database`)
            setProfiles(prev => prev.filter(p => p.id !== userId))
        }
    }

    // Handle Create Staff (Stateless SignUp + Upsert profile)
    const handleCreateStaff = async (e: React.FormEvent) => {
        e.preventDefault()
        setAddError('')
        setIsSubmittingAdd(true)

        try {
            // 1. Sign up the user via supabasePublic to prevent current admin logout
            const { data, error: signUpError } = await supabasePublic.auth.signUp({
                email: newEmail,
                password: newPassword,
                options: {
                    emailRedirectTo: `${window.location.origin}/login`
                }
            })

            if (signUpError) {
                setAddError(signUpError.message)
                setIsSubmittingAdd(false)
                return
            }

            if (!data.user) {
                setAddError('Gagal membuat staf baru: data user kosong.')
                setIsSubmittingAdd(false)
                return
            }

            // 2. Insert/Update into profiles table to assign their role
            const dbRole = newRole === 'supervisor' ? 'admin' : (newRole === 'captain' ? 'barista' : newRole)
            
            // Tunggu sebentar (500ms) agar trigger di server Supabase selesai dieksekusi
            await new Promise(resolve => setTimeout(resolve, 500))
            
            let profileError = null
            
            // Cek apakah profil sudah dibuat oleh database trigger
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', data.user.id)
                .maybeSingle()
                
            if (existingProfile) {
                // Jika baris sudah ada, lakukan UPDATE (hanya membutuhkan izin UPDATE RLS)
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ role: dbRole })
                    .eq('id', data.user.id)
                profileError = updateError
            } else {
                // Jika belum ada, lakukan INSERT
                const { error: insertError } = await supabase
                    .from('profiles')
                    .insert({
                        id: data.user.id,
                        email: newEmail,
                        role: dbRole,
                        created_at: new Date().toISOString()
                    })
                profileError = insertError
            }

            if (profileError) {
                console.error('Profile DB error:', profileError)
                setAddError('Akun Auth berhasil dibuat, namun gagal memperbarui tabel profiles: ' + (profileError.message || JSON.stringify(profileError)))
            } else {
                showFeedback(`Staf baru "${newEmail}" berhasil ditambahkan!`, 'success')
                // 3. Write Audit Log
                await writeAuditLog(`Menambahkan staf baru "${newEmail}" dengan peran "${newRole.toUpperCase()}"`)
                
                // Reset form & close modal
                setNewEmail('')
                setNewPassword('')
                setNewRole('waiter')
                setIsAddModalOpen(false)
                
                // Fetch profiles to update table
                fetchProfiles()
            }
        } catch (err: any) {
            console.error('Unexpected signup error:', err)
            setAddError('Terjadi kesalahan tidak terduga: ' + err.message)
        } finally {
            setIsSubmittingAdd(false)
        }
    }

    // Filtered Profiles
    const filteredProfiles = profiles.filter(p => {
        const matchesSearch = p.email?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesRole = filterRole === 'All' || p.role === filterRole
        return matchesSearch && matchesRole
    })

    // Filtered Logs
    const filteredLogs = logs.filter(l => {
        const query = searchQueryLogs.toLowerCase()
        const localDate = l.created_at ? new Date(l.created_at) : null
        const dateStr = localDate ? localDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
        return (
            l.changed_by?.toLowerCase().includes(query) ||
            l.description?.toLowerCase().includes(query) ||
            dateStr.toLowerCase().includes(query)
        )
    })

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

    return (
        <main className="min-h-screen bg-slate-50 flex flex-col max-w-4xl mx-auto border-x border-slate-200">
            {/* Header Admin */}
            <header className="sticky top-0 bg-slate-900 text-white z-10 p-5 border-b border-slate-800 shadow-md">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="bg-red-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded">SUPERADMIN</span>
                        <h1 className="text-lg font-black tracking-tight">coffeecomunitas</h1>
                    </div>
                    <a href="/admin" className="bg-slate-800 text-slate-200 hover:bg-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors">
                        <ArrowLeft size={12} /> Dashboard Menu
                    </a>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="flex bg-white border-b border-slate-200 sticky top-[69px] z-10">
                <button
                    onClick={() => setActiveTab('staff')}
                    className={`flex-1 py-4 text-center text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 border-b-2 ${
                        activeTab === 'staff'
                            ? 'border-slate-900 text-slate-900 bg-slate-50/50'
                            : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/20'
                    }`}
                >
                    <Users size={14} /> Daftar Staf ({profiles.length})
                </button>
                <button
                    onClick={() => {
                        setActiveTab('logs')
                        fetchLogs()
                    }}
                    className={`flex-1 py-4 text-center text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 border-b-2 ${
                        activeTab === 'logs'
                            ? 'border-slate-900 text-slate-900 bg-slate-50/50'
                            : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/20'
                    }`}
                >
                    <Clock size={14} /> Log Aktivitas Perubahan
                </button>
            </div>

            {/* Main Content Section */}
            <section className="p-6 flex-1 flex flex-col gap-6">
                {/* Feedback Notification */}
                {feedbackMsg.text && (
                    <div className={`p-4 rounded-2xl flex gap-3 text-xs font-bold border ${
                        feedbackMsg.type === 'success' 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                            : 'bg-rose-50 border-rose-200 text-rose-900'
                    } animate-in slide-in-from-top duration-200`}>
                        {feedbackMsg.type === 'success' ? (
                            <Check className="text-emerald-600 shrink-0" size={16} />
                        ) : (
                            <AlertTriangle className="text-rose-600 shrink-0" size={16} />
                        )}
                        <span>{feedbackMsg.text}</span>
                    </div>
                )}

                {activeTab === 'staff' ? (
                    <>
                        {/* Tab 1 Head Info */}
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-slate-800">Manajemen Staf & Hak Akses</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Kelola data login staf kafe, tambah staf baru, atau perbarui peran otorisasi.</p>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-4 py-3 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all shadow-md"
                            >
                                <Plus size={14} /> Tambah Staf
                            </button>
                        </div>

                        {/* Search & Filter Bar Staf */}
                        <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-sm flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <Search size={14} />
                                </span>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Cari email staf..."
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none focus:border-slate-800 focus:bg-white transition-all font-medium text-slate-800"
                                />
                            </div>
                            <select
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-slate-800"
                            >
                                <option value="All">Semua Peran</option>
                                <option value="supervisor">Supervisor</option>
                                <option value="captain">Captain</option>
                                <option value="waiter">Waiter</option>
                                <option value="kitchen">Kitchen</option>
                                <option value="barista">Barista</option>
                                <option value="marketing">Marketing</option>
                            </select>
                        </div>

                        {/* Profiles Table */}
                        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                            {isLoadingProfiles ? (
                                <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                                    <div className="w-8 h-8 rounded-full border-2 border-slate-250 border-t-slate-800 animate-spin"></div>
                                    <span className="text-xs font-bold">Memuat daftar staf...</span>
                                </div>
                            ) : filteredProfiles.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <Users size={32} className="mx-auto text-slate-300 mb-2" />
                                    <p className="text-xs font-bold">Tidak ada staf yang cocok dengan kriteria pencarian.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                                                <th className="p-4">Email Staf</th>
                                                <th className="p-4">Tanggal Bergabung</th>
                                                <th className="p-4">Peran Saat Ini</th>
                                                <th className="p-4 text-center w-48">Ubah Peran</th>
                                                <th className="p-4 text-center w-20">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredProfiles.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-4 font-bold text-slate-800">{item.email || 'tanpa-email@staf.com'}</td>
                                                    <td className="p-4 text-slate-400 font-medium">
                                                        {new Date(item.created_at).toLocaleDateString('id-ID', {
                                                            day: 'numeric',
                                                            month: 'long',
                                                            year: 'numeric'
                                                        })}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                            item.role === 'supervisor'
                                                                ? 'bg-red-50 border-red-200 text-red-650' 
                                                                : item.role === 'captain'
                                                                ? 'bg-amber-50 border-amber-250 text-amber-600'
                                                                : item.role === 'waiter'
                                                                ? 'bg-emerald-50 border-emerald-250 text-emerald-600'
                                                                : 'bg-sky-50 border-sky-200 text-sky-655'
                                                        }`}>
                                                            {item.role.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <select
                                                            value={item.role}
                                                            disabled={isUpdating === item.id || item.email === user?.email}
                                                            onChange={(e) => handleUpdateRole(item.id, e.target.value, item.email, item.role)}
                                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-slate-800 disabled:opacity-50"
                                                        >
                                                            <option value="supervisor">Supervisor</option>
                                                            <option value="captain">Captain</option>
                                                            <option value="waiter">Waiter</option>
                                                            <option value="kitchen">Kitchen</option>
                                                            <option value="barista">Barista</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <button
                                                            onClick={() => handleDeleteProfile(item.id, item.email)}
                                                            disabled={item.email === user?.email}
                                                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                                            title={item.email === user?.email ? "Anda tidak dapat menghapus akun Anda sendiri" : "Hapus Staf"}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Tab 2 Head Info */}
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-slate-800">Pencatatan Perubahan Data (Audit Log)</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Semua perubahan menu, stok, rekomendasi, dan staf dicatat secara kronologis.</p>
                            </div>
                            <button
                                onClick={fetchLogs}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-black text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all"
                                title="Segarkan Log"
                            >
                                <RefreshCw size={12} className={isLoadingLogs ? 'animate-spin' : ''} /> Segarkan
                            </button>
                        </div>

                        {/* Search Bar Log */}
                        <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-sm">
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <Search size={14} />
                                </span>
                                <input
                                    type="text"
                                    value={searchQueryLogs}
                                    onChange={(e) => setSearchQueryLogs(e.target.value)}
                                    placeholder="Cari berdasarkan email pengubah atau deskripsi aktivitas..."
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none focus:border-slate-800 focus:bg-white transition-all font-medium text-slate-800"
                                />
                            </div>
                        </div>

                        {/* Audit Logs Table */}
                        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                            {isLoadingLogs ? (
                                <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                                    <div className="w-8 h-8 rounded-full border-2 border-slate-250 border-t-slate-800 animate-spin"></div>
                                    <span className="text-xs font-bold">Memuat catatan log...</span>
                                </div>
                            ) : filteredLogs.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <RefreshCw size={32} className="mx-auto text-slate-300 mb-2" />
                                    <p className="text-xs font-bold">Tidak ada catatan log aktivitas ditemukan.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                                                <th className="p-4 w-48">Diubah Oleh</th>
                                                <th className="p-4">Apa Yang Berubah</th>
                                                <th className="p-4 w-28">Waktu</th>
                                                <th className="p-4 w-40">Tanggal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium">
                                            {filteredLogs.map((log) => {
                                                const localDate = log.created_at ? new Date(log.created_at) : new Date()
                                                const timeStr = localDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                                const dateStr = localDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                                                return (
                                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-4 font-bold text-slate-700 break-all">{log.changed_by || 'Pelanggan (Customer)'}</td>
                                                        <td className="p-4 text-slate-800 font-semibold">{log.description}</td>
                                                        <td className="p-4 text-slate-500 font-mono">{timeStr}</td>
                                                        <td className="p-4 text-slate-400">{dateStr}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </section>

            {/* Modal Tambah Staf */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-md">Tambah Staf Baru</h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">Daftarkan kredensial login staf baru secara instan.</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="bg-slate-800 p-2 rounded-full text-slate-300 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleCreateStaff} className="p-5 overflow-y-auto flex flex-col gap-4 text-xs">
                            {addError && (
                                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl font-bold leading-tight flex items-start gap-2">
                                    <AlertTriangle size={16} className="shrink-0 text-rose-500 mt-0.5" />
                                    <span>{addError}</span>
                                </div>
                            )}

                            <div className="flex flex-col gap-1">
                                <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Mail size={12} /> Email Login Staf</label>
                                <input 
                                    type="email" 
                                    required 
                                    value={newEmail} 
                                    onChange={(e) => setNewEmail(e.target.value)} 
                                    className="border border-slate-200 rounded-xl p-3 outline-none focus:border-slate-800 font-bold text-slate-800" 
                                    placeholder="nama.staf@coffeecomunitas.com" 
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Key size={12} /> Password Staf</label>
                                <input 
                                    type="password" 
                                    required 
                                    minLength={6}
                                    value={newPassword} 
                                    onChange={(e) => setNewPassword(e.target.value)} 
                                    className="border border-slate-200 rounded-xl p-3 outline-none focus:border-slate-800 font-bold text-slate-800" 
                                    placeholder="Minimal 6 karakter..." 
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Shield size={12} /> Peran Akses (Role)</label>
                                <select 
                                    value={newRole} 
                                    onChange={(e) => setNewRole(e.target.value)} 
                                    className="border border-slate-200 rounded-xl p-3 outline-none focus:border-slate-800 font-bold bg-white text-slate-800"
                                >
                                    <option value="waiter">Waiter</option>
                                    <option value="captain">Captain</option>
                                    <option value="supervisor">Supervisor</option>
                                    <option value="kitchen">Kitchen</option>
                                    <option value="barista">Barista</option>
                                    <option value="marketing">Marketing</option>
                                </select>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex gap-2 text-amber-900 leading-tight">
                                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={14} />
                                <div className="text-[10px] font-medium">
                                    <span className="font-bold">Info Sesi:</span> Penambahan staf ini berjalan secara stateless di latar belakang, sehingga tidak mengganggu sesi login Admin yang saat ini aktif.
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSubmittingAdd} 
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl uppercase tracking-wider mt-3 disabled:bg-slate-400 active:scale-95 transition-transform flex items-center justify-center gap-1.5 shadow-md"
                            >
                                <Plus size={16} /> {isSubmittingAdd ? 'Menambahkan...' : 'Daftarkan Staf'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </main>
    )
}
