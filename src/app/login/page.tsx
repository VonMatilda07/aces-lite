'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setErrorMsg('')

        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            setErrorMsg(error.message)
            setIsLoading(false)
        } else {
            // Gunakan hard reload agar cookie sesi terkirim penuh ke middleware/proxy server
            window.location.href = '/waiter'
        }
    }

    return (
        <main className="min-h-screen bg-slate-900 flex flex-col justify-center px-6 py-12 max-w-md mx-auto text-white">
            <div className="w-full flex flex-col gap-6">
                <div className="text-center">
                    <p className="text-xs font-black text-slate-400 tracking-[0.2em] uppercase">ACES Lite Staff</p>
                    <h2 className="text-2xl font-black mt-1">Masuk Command Center</h2>
                </div>

                <form onSubmit={handleLogin} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col gap-4">
                    {errorMsg && (
                        <div className="bg-rose-500/20 border border-rose-500 text-rose-300 p-3 rounded-xl text-xs font-bold">
                            {errorMsg}
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Email Staf</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm outline-none focus:border-emerald-400 text-white placeholder:text-slate-600"
                            placeholder="nama.staf@coffeecomunitas.com"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm outline-none focus:border-emerald-400 text-white placeholder:text-slate-600"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-emerald-500 text-white py-3.5 rounded-xl font-black uppercase tracking-wider text-xs mt-2 disabled:bg-slate-600 active:scale-95 transition-transform"
                    >
                        {isLoading ? 'Menghubungkan...' : 'Masuk'}
                    </button>
                </form>
            </div>
        </main>
    )
}