// src/components/waiter/WaiterCart.tsx
'use client'

import { useState, useMemo } from 'react'
import { useMenuStore } from '@/store/useMenuStore'
import { Trash2, Send, CheckCircle2, X } from 'lucide-react'

export default function WaiterCart() {
    const { cart, removeFromCart, updateCartItemNotes, clearCart, tableIdentifier, setTableIdentifier, finalizeOrder } = useMenuStore()
    const [isOpen, setIsOpen] = useState(false)
    const [isRelayMode, setIsRelayMode] = useState(false)

    // Hitung total item dan total harga belanja
    const totalItems = cart.reduce((acc, item) => acc + item.qty, 0)
    const totalPrice = cart.reduce((acc, item) => acc + (item.menu.price * item.qty), 0)

    // Kelompokkan item berdasarkan stasiun saji (Bar vs Kitchen)
    const barItems = useMemo(() => cart.filter(item => ['Coffee', 'Non-Coffee'].includes(item.menu.category)), [cart])
    const kitchenItems = useMemo(() => cart.filter(item => ['Food', 'Snack'].includes(item.menu.category)), [cart])

    // Sembunyikan keranjang jika kosong dan tidak sedang dalam mode relay
    if (cart.length === 0 && !isRelayMode) return null

    // Mode Relay: Tampilan pembacaan pesanan ke kasir/bar/dapur
    if (isRelayMode) {
        return (
            <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col max-w-md mx-auto animate-in slide-in-from-bottom">
                <div className="p-6 text-white flex-1 overflow-y-auto">
                    <h2 className="text-2xl font-black mb-2 uppercase text-emerald-400">Order Relay</h2>
                    <p className="text-slate-400 font-medium mb-6">Identitas: <span className="font-bold text-white text-xl">{tableIdentifier}</span></p>

                    {/* STATION: BAR */}
                    {barItems.length > 0 && (
                        <div className="mb-6">
                            <div className="bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-t-lg w-max">
                                Station: BAR
                            </div>
                            <div className="bg-white text-slate-900 rounded-b-lg rounded-tr-lg p-4 shadow-sm flex flex-col gap-3">
                                {barItems.map((item) => (
                                    <div key={`${item.menu.id}-${item.selectedVariant || ''}`} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                        <div className="font-bold text-lg leading-tight">
                                            <span className="text-blue-600 font-black mr-2">{item.qty}x</span>{item.menu.name}{item.selectedVariant ? ` (${item.selectedVariant})` : ''}
                                        </div>
                                        {item.notes && <p className="text-sm text-rose-500 font-bold mt-1 uppercase">* {item.notes}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STATION: KITCHEN */}
                    {kitchenItems.length > 0 && (
                        <div className="mb-6">
                            <div className="bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-t-lg w-max">
                                Station: KITCHEN
                            </div>
                            <div className="bg-white text-slate-900 rounded-b-lg rounded-tr-lg p-4 shadow-sm flex flex-col gap-3">
                                {kitchenItems.map((item) => (
                                    <div key={`${item.menu.id}-${item.selectedVariant || ''}`} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                        <div className="font-bold text-lg leading-tight">
                                            <span className="text-orange-600 font-black mr-2">{item.qty}x</span>{item.menu.name}{item.selectedVariant ? ` (${item.selectedVariant})` : ''}
                                        </div>
                                        {item.notes && <p className="text-sm text-rose-500 font-bold mt-1 uppercase">* {item.notes}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons: Selesai & Kembali/Edit */}
                <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col gap-2">
                    <button
                        onClick={() => { finalizeOrder(); setIsRelayMode(false); setIsOpen(false) }}
                        className="w-full bg-emerald-500 text-white font-black uppercase tracking-wider py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                        <CheckCircle2 size={24} /> Selesai & Kurangkan Stok
                    </button>
                    <button
                        onClick={() => setIsRelayMode(false)}
                        className="w-full bg-slate-800 text-slate-300 font-bold uppercase tracking-wider py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                        Kembali & Edit Pesanan
                    </button>
                </div>
            </div>
        )
    }

    // Mode Cart: Tampilan melayang (floating panel) pencatatan pesanan
    return (
        <div className={`fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 shadow-[0_-20px_40px_rgba(0,0,0,0.1)] transition-all duration-300 z-40 flex flex-col ${isOpen ? 'h-[85vh]' : 'h-24'}`}>

            {/* Header keranjang belanja (bisa di-toggle) */}
            <div className="flex justify-between items-center p-5 cursor-pointer bg-slate-900 text-white rounded-t-2xl" onClick={() => setIsOpen(!isOpen)}>
                <div>
                    <p className="font-bold text-slate-300 text-sm">{totalItems} Item Tercatat</p>
                    <p className="text-emerald-400 font-black text-xl">Rp {totalPrice.toLocaleString('id-ID')}</p>
                </div>
                <div className="bg-slate-800 p-3 rounded-full">
                    {isOpen ? <X size={24} /> : <Send size={24} />}
                </div>
            </div>

            {/* Panel detail keranjang (jika dibuka) */}
            {isOpen && (
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                    <input
                        type="text"
                        placeholder="Nama Pemesan / Meja..."
                        value={tableIdentifier}
                        onChange={(e) => setTableIdentifier(e.target.value)}
                        className="w-full border-2 border-slate-200 rounded-xl p-4 font-black text-lg focus:border-slate-900 outline-none uppercase placeholder:normal-case placeholder:font-medium placeholder:text-slate-400"
                    />

                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <span className="text-sm font-bold text-slate-500">Daftar Item</span>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 active:scale-95 transition-transform"
                        >
                            ← Kembali ke Menu
                        </button>
                    </div>

                    <div className="flex flex-col gap-3">
                        {cart.map((item) => (
                            <div key={`${item.menu.id}-${item.selectedVariant || ''}`} className="border border-slate-200 p-4 rounded-xl flex flex-col gap-3 shadow-sm">
                                <div className="flex justify-between items-start">
                                    <p className="font-bold text-slate-900 text-lg leading-tight">
                                        <span className="text-emerald-600 font-black mr-1">{item.qty}x</span> {item.menu.name}{item.selectedVariant ? ` (${item.selectedVariant})` : ''}
                                    </p>
                                    <button onClick={() => removeFromCart(item.menu.id, item.selectedVariant)} className="text-rose-500 p-2 bg-rose-50 rounded-lg active:scale-95">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Catatan: (Misal: Less Sugar)"
                                    value={item.notes}
                                    onChange={(e) => updateCartItemNotes(item.menu.id, item.selectedVariant, e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-medium outline-none focus:border-slate-400"
                                />
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => setIsRelayMode(true)}
                        disabled={!tableIdentifier}
                        className="mt-auto w-full bg-slate-900 text-white font-black uppercase tracking-wider py-4 rounded-xl disabled:bg-slate-300 disabled:text-slate-500 active:scale-95 transition-all"
                    >
                        {tableIdentifier ? 'Kompilasi Pesanan' : 'Isi Identitas Dulu'}
                    </button>
                </div>
            )}
        </div>
    )
}