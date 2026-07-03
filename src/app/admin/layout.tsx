// src/app/admin/layout.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { usePathname, useRouter } from 'next/navigation'
import { 
    Coffee, 
    BarChart3, 
    Users, 
    MessageSquare, 
    LogOut, 
    Menu, 
    X, 
    ChevronLeft, 
    ChevronRight, 
    ArrowLeft,
    User
} from 'lucide-react'

const SIDEBAR_MENU = [
    { label: 'Manajemen Menu', path: '/admin', icon: Coffee },
    { label: 'Analitik Dasbor', path: '/admin/analytics', icon: BarChart3 },
    { label: 'Kelola Staf', path: '/admin/users', icon: Users },
    { label: 'Kritik & Saran', path: '/admin/feedback', icon: MessageSquare },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, role, status, logout } = useAuthStore()
    const pathname = usePathname()
    const router = useRouter()
    
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [isMobileOpen, setIsMobileOpen] = useState(false)

    // Auth Role Guard
    useEffect(() => {
        if (status === 'loading' || status === 'idle') return

        const allowedRoles = ['admin', 'supervisor', 'captain', 'marketing']
        if (status === 'authenticated' && role && allowedRoles.includes(role)) {
            setIsAuthorized(true)
        } else if (status === 'authenticated') {
            router.push('/waiter')
        } else {
            router.push('/login')
        }
    }, [status, role, router])

    const handleLogout = async () => {
        await logout()
        router.push('/login')
    }

    if (!isAuthorized) {
        return (
            <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="flex flex-col items-center gap-4 max-w-sm">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 animate-spin"></div>
                    </div>
                    <div>
                        <span className="bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-purple-500/20">
                            Admin Security Shield
                        </span>
                        <h2 className="text-md font-bold mt-3 text-slate-200">Memverifikasi Hak Akses...</h2>
                    </div>
                </div>
            </main>
        )
    }

    const renderSidebarContent = () => (
        <div className="flex flex-col h-full justify-between text-slate-300">
            {/* Top Identity */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div 
                    onClick={() => isCollapsed && setIsCollapsed(false)}
                    className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'cursor-pointer hover:opacity-85 transition-opacity' : ''}`}
                    title={isCollapsed ? "Buka Sidebar" : undefined}
                >
                    <div className="p-2 bg-purple-600 rounded-xl text-white shadow-md shadow-purple-500/20 shrink-0">
                        <Coffee size={20} className="animate-pulse" />
                    </div>
                    {!isCollapsed && (
                        <div className="flex flex-col min-w-0 transition-opacity duration-205">
                            <span className="font-black text-white text-sm tracking-tight leading-none">ACES Lite</span>
                            <span className="text-[9px] font-mono font-bold text-purple-400 mt-1">v1.2.0</span>
                        </div>
                    )}
                </div>
                {/* Collapse button on Desktop: hidden when collapsed */}
                {!isCollapsed && (
                    <button 
                        onClick={() => setIsCollapsed(true)}
                        className="hidden md:flex p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                        title="Tutup Sidebar"
                    >
                        <ChevronLeft size={16} />
                    </button>
                )}
            </div>

            {/* Menu List */}
            <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
                {SIDEBAR_MENU.filter(item => {
                    if (role === 'marketing') {
                        return item.path === '/admin/feedback'
                    }
                    return true
                }).map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.path
                    
                    return (
                        <a
                            key={item.path}
                            href={item.path}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group relative ${
                                isActive 
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/15' 
                                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                            title={isCollapsed ? item.label : undefined}
                        >
                            <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200 transition-colors'} />
                            {!isCollapsed && <span className="transition-opacity duration-205">{item.label}</span>}
                            
                            {/* Hover Tooltip when Collapsed */}
                            {isCollapsed && (
                                <div className="absolute left-16 bg-slate-900 border border-slate-800 text-white text-[10px] font-bold px-2 py-1.5 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-205 whitespace-nowrap shadow-md z-50">
                                    {item.label}
                                </div>
                            )}
                        </a>
                    )
                })}
            </nav>

            {/* Bottom Profile and Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40">
                {!isCollapsed ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 p-1.5 bg-slate-900/50 rounded-xl border border-slate-800/40">
                            <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 shrink-0">
                                <User size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold text-slate-400 leading-none truncate">{user?.email?.split('@')[0]}</p>
                                <span className="inline-block bg-purple-500/15 text-purple-400 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded mt-1 border border-purple-500/10 leading-none">
                                    {role}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <a 
                                href="/waiter" 
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-[10px] font-bold border border-slate-700/60 flex items-center justify-center gap-1 transition-all"
                            >
                                <ArrowLeft size={10} /> Waiter
                            </a>
                            <button
                                onClick={handleLogout}
                                className="bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 hover:border-rose-500 text-rose-400 hover:text-white px-3 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                            >
                                <LogOut size={10} /> Logout
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 relative group">
                            <User size={16} />
                            <div className="absolute left-12 bg-slate-900 border border-slate-800 text-white text-[10px] font-bold p-2 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-205 whitespace-nowrap shadow-md z-50">
                                <p className="font-bold leading-none">{user?.email}</p>
                                <span className="inline-block bg-purple-500/15 text-purple-400 text-[8px] font-black uppercase px-1 py-0.5 rounded mt-1">{role}</span>
                            </div>
                        </div>
                        <a 
                            href="/waiter" 
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/60 transition-all"
                            title="Ke Terminal Waiter"
                        >
                            <ArrowLeft size={14} />
                        </a>
                        <button
                            onClick={handleLogout}
                            className="p-2 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl border border-rose-500/20 hover:border-rose-500 transition-all"
                            title="Logout Staf"
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row font-sans">
            {/* Desktop Collapsible Sidebar */}
            <aside 
                className={`hidden md:flex flex-col bg-slate-900 border-r border-slate-800 shrink-0 sticky top-0 h-screen transition-all duration-300 ${
                    isCollapsed ? 'w-[72px]' : 'w-[250px]'
                }`}
            >
                {renderSidebarContent()}
            </aside>

            {/* Mobile Header Bar */}
            <header className="md:hidden bg-slate-900 text-white px-5 py-4 flex justify-between items-center border-b border-slate-800 shadow-md z-30 sticky top-0">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-purple-600 rounded-lg text-white">
                        <Coffee size={16} />
                    </div>
                    <span className="font-black text-sm tracking-tight">ACES Lite</span>
                </div>
                <button 
                    onClick={() => setIsMobileOpen(true)}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300"
                >
                    <Menu size={20} />
                </button>
            </header>

            {/* Mobile Drawer (Hamburger Menu) Overlay */}
            {isMobileOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-black/60 transition-opacity animate-in fade-in duration-200" 
                        onClick={() => setIsMobileOpen(false)}
                    />
                    
                    {/* Drawer Content */}
                    <div className="relative flex flex-col w-[250px] max-w-sm h-full bg-slate-900 border-r border-slate-800 shadow-2xl animate-in slide-in-from-left duration-300">
                        <div className="absolute top-4 right-4 z-10">
                            <button 
                                onClick={() => setIsMobileOpen(false)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        {renderSidebarContent()}
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-x-hidden overflow-y-auto">
                {children}
            </div>
        </div>
    )
}
