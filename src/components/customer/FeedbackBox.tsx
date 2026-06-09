// src/components/customer/FeedbackBox.tsx
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Star, Send, CheckCircle2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'

// Toggle Fitur Promo Voucher Sementara
const ENABLE_FEEDBACK_PROMO = true

const generateVoucherCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = 'CC-'
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

export default function FeedbackBox() {
    const [rating, setRating] = useState<number>(0)
    const [name, setName] = useState('')
    const [text, setText] = useState('')
    const [hoverRating, setHoverRating] = useState<number>(0)
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    // Sub-rating Kategori Opsional
    const [ratingService, setRatingService] = useState<number>(0)
    const [ratingBeverage, setRatingBeverage] = useState<number>(0)
    const [ratingFood, setRatingFood] = useState<number>(0)
    const [ratingAmbiance, setRatingAmbiance] = useState<number>(0)

    const [hoverService, setHoverService] = useState<number>(0)
    const [hoverBeverage, setHoverBeverage] = useState<number>(0)
    const [hoverFood, setHoverFood] = useState<number>(0)
    const [hoverAmbiance, setHoverAmbiance] = useState<number>(0)

    const [showMultiRating, setShowMultiRating] = useState(false)
    const [storedVoucher, setStoredVoucher] = useState<{ code: string; timestamp: number } | null>(null)

    const activeCategories = [ratingService, ratingBeverage, ratingFood, ratingAmbiance].filter(v => v > 0)
    const hasCategoryRatings = activeCategories.length > 0
    const exactAverage = hasCategoryRatings
        ? activeCategories.reduce((sum, v) => sum + v, 0) / activeCategories.length
        : rating

    // Deteksi jika user memiliki voucher aktif di localStorage saat load
    useEffect(() => {
        if (!ENABLE_FEEDBACK_PROMO) return

        const stored = localStorage.getItem('aces_feedback_voucher')
        if (stored) {
            try {
                const parsed = JSON.parse(stored)
                const now = Date.now()
                if (now - parsed.timestamp < 24 * 60 * 60 * 1000) {
                    // Cek status klaim voucher ke database via RPC secara aman
                    supabase
                        .rpc('check_voucher_status', { p_code: parsed.code })
                        .then(({ data: isClaimed, error }) => {
                            if (!error && isClaimed === true) {
                                // Jika voucher sudah diklaim, hapus dari localStorage agar tidak muncul lagi
                                localStorage.removeItem('aces_feedback_voucher')
                                setStoredVoucher(null)
                            } else {
                                setStoredVoucher(parsed)
                            }
                        })
                } else {
                    localStorage.removeItem('aces_feedback_voucher')
                }
            } catch (e) {
                localStorage.removeItem('aces_feedback_voucher')
            }
        }
    }, [])

    // Polling untuk mendeteksi klaim secara real-time saat halaman sukses voucher terbuka
    useEffect(() => {
        if (!ENABLE_FEEDBACK_PROMO || !storedVoucher) return

        const interval = setInterval(async () => {
            try {
                const { data: isClaimed, error } = await supabase
                    .rpc('check_voucher_status', { p_code: storedVoucher.code })
                
                if (!error && isClaimed === true) {
                    localStorage.removeItem('aces_feedback_voucher')
                    setStoredVoucher(null)
                    setIsSubmitted(true) // Tampilkan halaman sukses biasa
                    clearInterval(interval)
                }
            } catch (err) {
                console.error('Error polling voucher status:', err)
            }
        }, 3000) // Cek setiap 3 detik

        return () => clearInterval(interval)
    }, [storedVoucher])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!text.trim()) {
            setErrorMsg('Kritik & saran tidak boleh kosong.')
            return
        }

        setIsLoading(true)
        setErrorMsg('')

        // Cek cooldown voucher 24 jam
        const lastVoucherTime = localStorage.getItem('aces_feedback_last_voucher_time')
        const now = Date.now()
        const isCooldown = lastVoucherTime && (now - Number(lastVoucherTime) < 24 * 60 * 60 * 1000)

        // Hanya buat kode voucher jika promo aktif dan tidak sedang cooldown 24 jam
        const generatedCode = (ENABLE_FEEDBACK_PROMO && !isCooldown) ? generateVoucherCode() : null

        try {
            const { error } = await supabase
                .from('customer_feedback')
                .insert({
                    customer_name: name.trim() || 'Anonim',
                    feedback_text: text.trim(),
                    rating: exactAverage > 0 ? Math.round(exactAverage) : null,
                    rating_service: ratingService > 0 ? ratingService : null,
                    rating_beverage: ratingBeverage > 0 ? ratingBeverage : null,
                    rating_food: ratingFood > 0 ? ratingFood : null,
                    rating_ambiance: ratingAmbiance > 0 ? ratingAmbiance : null,
                    voucher_code: generatedCode,
                    is_claimed: false
                })

            if (error) {
                throw error
            }

            if (ENABLE_FEEDBACK_PROMO && generatedCode) {
                const voucherData = {
                    code: generatedCode,
                    timestamp: now
                }
                localStorage.setItem('aces_feedback_voucher', JSON.stringify(voucherData))
                localStorage.setItem('aces_feedback_last_voucher_time', now.toString())
                setStoredVoucher(voucherData)
            }

            setIsSubmitted(true)
            // Reset form
            setName('')
            setText('')
            setRating(0)
            setRatingService(0)
            setRatingBeverage(0)
            setRatingFood(0)
            setRatingAmbiance(0)
            setShowMultiRating(false)
        } catch (err: any) {
            console.error('Failed to submit feedback:', err)
            setErrorMsg(err.message || 'Gagal mengirim masukan. Pastikan tabel customer_feedback sudah dibuat.')
        } finally {
            setIsLoading(false)
        }
    }

    if (ENABLE_FEEDBACK_PROMO && storedVoucher) {
        return (
            <div className="bg-gradient-to-b from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-6 mx-5 text-center animate-in zoom-in-95 duration-350 shadow-sm relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-24 h-24 bg-amber-250/20 rounded-full blur-2xl" />
                <div className="absolute -left-8 -bottom-8 w-24 h-24 bg-orange-250/20 rounded-full blur-2xl" />
                
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600 mb-3.5 shadow-sm animate-bounce">
                    <CheckCircle2 size={24} />
                </div>
                <h4 className="font-black text-slate-800 text-sm uppercase tracking-wide">Terima Kasih!</h4>
                <p className="text-xs text-slate-600 font-bold leading-relaxed mt-2 max-w-[245px] mx-auto">
                    Terima kasih sudah mengisi feedback. Tunjukkan halaman ini untuk melakukan claim diskon 10% pada transaksi anda.
                </p>

                {/* Voucher Code Card */}
                <div className="mt-5 bg-white border border-amber-200 rounded-2xl p-4 shadow-sm relative">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Kode Voucher Diskon</span>
                    <div className="text-2xl font-black text-slate-800 tracking-wider mt-1 select-all">
                        {storedVoucher.code}
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold leading-normal mt-3 border-t border-slate-100 pt-2.5 flex flex-col gap-1 text-left">
                        <span>• Tunjukkan kepada pramusaji/kasir saat pembayaran.</span>
                        <span>• Diskon tidak berlaku kelipatan. Maksimal 1 voucher per transaksi.</span>
                        <span>• Voucher ini berlaku selama 24 jam sejak waktu pengisian.</span>
                    </div>
                </div>
            </div>
        )
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

            {ENABLE_FEEDBACK_PROMO && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 text-center">
                    <p className="text-[11px] font-black text-amber-800 leading-normal">
                        🎁 Berikan Kritik Dan Saran Untuk Mengklaim Diskon 10% Pada Transaksi Anda
                    </p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
                {errorMsg && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl font-semibold leading-snug">
                        ⚠️ {errorMsg}
                    </div>
                )}

                {/* Rating Bintang Keseluruhan */}
                <div className="flex flex-col gap-1.5 items-center justify-center bg-slate-50 rounded-2xl py-3 border border-slate-100 relative overflow-hidden">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {hasCategoryRatings ? 'Rerata Rating Kategori (Otomatis)' : 'Beri Kami Nilai (Opsional)'}
                    </span>
                    
                    <div className="flex items-center gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map((starValue) => {
                            const displayVal = hasCategoryRatings ? exactAverage : (hoverRating || rating)
                            const isStarred = displayVal >= starValue
                            
                            return (
                                <button
                                    key={starValue}
                                    type="button"
                                    disabled={hasCategoryRatings}
                                    onClick={() => setRating(starValue)}
                                    onMouseEnter={() => !hasCategoryRatings && setHoverRating(starValue)}
                                    onMouseLeave={() => !hasCategoryRatings && setHoverRating(0)}
                                    className={`p-1 transition-transform ${hasCategoryRatings ? 'cursor-default' : 'hover:scale-125 active:scale-90'}`}
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

                    {exactAverage > 0 && (
                        <div className="flex flex-col items-center mt-1">
                            <span className="text-xs font-black text-slate-800 leading-none">
                                {exactAverage.toFixed(1)} / 5.0
                            </span>
                            <span className="text-[9px] font-black text-amber-500 uppercase mt-1.5 leading-none">
                                {exactAverage >= 4.5 && 'Sangat Puas! ⭐️⭐️⭐️⭐️⭐️'}
                                {exactAverage >= 3.5 && exactAverage < 4.5 && 'Puas ⭐️⭐️⭐️⭐️'}
                                {exactAverage >= 2.5 && exactAverage < 3.5 && 'Cukup Baik ⭐️⭐️⭐️'}
                                {exactAverage >= 1.5 && exactAverage < 2.5 && 'Kurang ⭐️⭐️'}
                                {exactAverage < 1.5 && 'Sangat Kurang ⭐️'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Accordion Collapse Rating Kategori */}
                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={() => setShowMultiRating(!showMultiRating)}
                        className="flex items-center justify-between w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3.5 font-black text-slate-650 hover:bg-slate-100 transition-all text-[11px] uppercase tracking-wider"
                    >
                        <span>Beri Rating Kategori (Opsional)</span>
                        {showMultiRating ? <ChevronUp size={14} className="text-slate-450" /> : <ChevronDown size={14} className="text-slate-450" />}
                    </button>

                    {showMultiRating && (
                        <div className="flex flex-col gap-3.5 p-4 bg-slate-50 border border-slate-200 rounded-xl animate-in slide-in-from-top duration-200">
                            {[
                                { label: 'Pelayanan', value: ratingService, setValue: setRatingService, hover: hoverService, setHover: setHoverService },
                                { label: 'Minuman', value: ratingBeverage, setValue: setRatingBeverage, hover: hoverBeverage, setHover: setHoverBeverage },
                                { label: 'Makanan', value: ratingFood, setValue: setRatingFood, hover: hoverFood, setHover: setHoverFood },
                                { label: 'Suasana', value: ratingAmbiance, setValue: setRatingAmbiance, hover: hoverAmbiance, setHover: setHoverAmbiance }
                            ].map((cat) => (
                                <div key={cat.label} className="flex items-center justify-between font-bold text-slate-600">
                                    <span className="uppercase tracking-wider text-[9px] text-slate-500">{cat.label}</span>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-0.5">
                                            {[1, 2, 3, 4, 5].map((starValue) => {
                                                const isStarred = (cat.hover || cat.value) >= starValue
                                                return (
                                                    <button
                                                        key={starValue}
                                                        type="button"
                                                        onClick={() => cat.setValue(starValue)}
                                                        onMouseEnter={() => cat.setHover(starValue)}
                                                        onMouseLeave={() => cat.setHover(0)}
                                                        className="p-0.5 transition-transform hover:scale-120 active:scale-90"
                                                    >
                                                        <Star
                                                            size={16}
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
                                        <span className="text-[10px] font-black text-amber-500 w-4 text-right">
                                            {cat.value > 0 ? cat.value : ''}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
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
