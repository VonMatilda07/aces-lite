// src/components/customer/FeedbackBox.tsx
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Star, Send, CheckCircle2, MessageSquare } from 'lucide-react'

export default function FeedbackBox() {
    const [rating, setRating] = useState<number>(0)
    const [name, setName] = useState('')
    const [text, setText] = useState('')
    const [hoverRating, setHoverRating] = useState<number>(0)
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!text.trim()) {
            setErrorMsg('Kritik & saran tidak boleh kosong.')
            return
        }

        setIsLoading(true)
        setErrorMsg('')

        try {
            const { error } = await supabase
                .from('customer_feedback')
                .insert({
                    customer_name: name.trim() || 'Anonim',
                    feedback_text: text.trim(),
                    rating: rating > 0 ? rating : null
                })

            if (error) {
                throw error
            }

            setIsSubmitted(true)
            // Reset form
            setName('')
            setText('')
            setRating(0)
        } catch (err: any) {
            console.error('Failed to submit feedback:', err)
            setErrorMsg(err.message || 'Gagal mengirim masukan. Pastikan tabel customer_feedback sudah dibuat.')
        } finally {
            setIsLoading(false)
        }
    }

    if (isSubmitted) {
        return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 mx-5 text-center animate-in zoom-in-95 duration-350 shadow-sm">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-3.5 shadow-sm animate-bounce">
                    <CheckCircle2 size={24} />
                </div>
                <h4 className="font-black text-slate-800 text-sm uppercase tracking-wide">Terkirim!</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed mt-2 max-w-[220px] mx-auto">
                    Terima kasih banyak atas masukan Anda. Kami akan terus berbenah demi pelayanan yang lebih baik.
                </p>
                <button
                    onClick={() => setIsSubmitted(false)}
                    className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
                >
                    Kirim Masukan Lagi
                </button>
            </div>
        )
    }

    return (
        <div className="bg-white border border-slate-200 rounded-3xl p-5.5 mx-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="p-2 bg-slate-900 text-white rounded-xl">
                    <MessageSquare size={16} />
                </div>
                <div>
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Kritik & Saran</h3>
                    <p className="text-[10px] text-slate-400 font-bold leading-none mt-0.5">Bantu kami meningkatkan pelayanan</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
                {errorMsg && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl font-semibold leading-snug">
                        ⚠️ {errorMsg}
                    </div>
                )}

                {/* Rating Bintang */}
                <div className="flex flex-col gap-1.5 items-center justify-center bg-slate-50 rounded-2xl py-3 border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Beri Kami Nilai (Opsional)</span>
                    <div className="flex items-center gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map((starValue) => {
                            const isStarred = (hoverRating || rating) >= starValue
                            return (
                                <button
                                    key={starValue}
                                    type="button"
                                    onClick={() => setRating(starValue)}
                                    onMouseEnter={() => setHoverRating(starValue)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    className="p-1 transition-transform hover:scale-125 active:scale-90"
                                >
                                    <Star
                                        size={22}
                                        className={`transition-colors duration-150 ${
                                            isStarred 
                                                ? 'fill-amber-400 text-amber-400' 
                                                : 'text-slate-300 fill-transparent'
                                        }`}
                                    />
                                </button>
                            )
                        })}
                    </div>
                    {rating > 0 && (
                        <span className="text-[9px] font-black text-amber-500 uppercase mt-0.5">
                            {rating === 1 && 'Sangat Kurang ⭐️'}
                            {rating === 2 && 'Kurang ⭐️⭐️'}
                            {rating === 3 && 'Cukup Baik ⭐️⭐️⭐️'}
                            {rating === 4 && 'Puas ⭐️⭐️⭐️⭐️'}
                            {rating === 5 && 'Sangat Puas! ⭐️⭐️⭐️⭐️⭐️'}
                        </span>
                    )}
                </div>

                {/* Nama Input */}
                <div className="flex flex-col gap-1">
                    <label className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Nama Anda (Opsional)</label>
                    <input
                        type="text"
                        placeholder="Contoh: Budi (Akan ditulis Anonim jika kosong)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 outline-none focus:border-slate-800 font-bold bg-slate-50 focus:bg-white text-slate-800 transition-all"
                    />
                </div>

                {/* Kritik & Saran Textarea */}
                <div className="flex flex-col gap-1">
                    <label className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Kritik, Saran, & Pesan Anda</label>
                    <textarea
                        required
                        rows={3}
                        placeholder="Tuliskan masukan Anda di sini... (Misal: AC bar kurang dingin, pelayanan pramusaji sangat ramah!)"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="border border-slate-200 rounded-xl p-3 outline-none focus:border-slate-800 font-medium bg-slate-50 focus:bg-white text-slate-800 transition-all resize-none h-20"
                    />
                </div>

                {/* Kirim Button */}
                <button
                    type="submit"
                    disabled={isLoading || !text.trim()}
                    className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black py-3.5 rounded-xl uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm mt-1"
                >
                    <Send size={12} />
                    {isLoading ? 'Mengirim...' : 'Kirim Masukan'}
                </button>
            </form>
        </div>
    )
}
