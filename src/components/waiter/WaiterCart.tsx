// src/components/waiter/WaiterCart.tsx
'use client'

import { useState, useMemo, useRef } from 'react'
import { useMenuStore, getCartItemPrice } from '@/store/useMenuStore'
import { Trash2, Send, CheckCircle2, X, Users } from 'lucide-react'

export default function WaiterCart() {
    const { cart, addToCart, removeFromCart, decrementCartQty, updateCartItemNotes, clearCart, tableIdentifier, setTableIdentifier, customerCount, setCustomerCount, finalizeOrder } = useMenuStore()
    const [isOpen, setIsOpen] = useState(false)
    const [isRelayMode, setIsRelayMode] = useState(false)
    const [isStaffInvoice, setIsStaffInvoice] = useState(false)
    const [staffName, setStaffName] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const isSubmittingRef = useRef(false)

    // Hitung total item dan total harga belanja
    const totalItems = cart.reduce((acc, item) => acc + item.qty, 0)
    const totalPrice = cart.reduce((acc, item) => acc + (getCartItemPrice(item) * item.qty), 0)

    // Kelompokkan item berdasarkan stasiun saji (Bar vs Kitchen)
    const barItems = useMemo(() => cart.filter(item => item.menu.station === 'bar'), [cart])
    const kitchenItems = useMemo(() => cart.filter(item => item.menu.station !== 'bar'), [cart])

    const handleToggleStaffInvoice = (checked: boolean) => {
        setIsStaffInvoice(checked)
        if (checked) {
            setCustomerCount(1)
            const newId = staffName ? `Karyawan: ${staffName}` : 'Karyawan: '
            setTableIdentifier(newId)
        } else {
            setTableIdentifier('')
        }
    }

    const handleIdentityChange = (val: string) => {
        if (isStaffInvoice) {
            const name = val.replace(/^Karyawan:\s*/i, '')
            setStaffName(name)
            setTableIdentifier(name ? `Karyawan: ${name}` : 'Karyawan: ')
        } else {
            setTableIdentifier(val)
        }
    }

    // Sembunyikan keranjang jika kosong dan tidak sedang dalam mode relay
    if (cart.length === 0 && !isRelayMode) return null

    // Mode Relay: Tampilan pembacaan pesanan ke kasir/bar/dapur
    if (isRelayMode) {
        // Tampilkan identitas dengan awalan Karyawan jika diaktifkan
        const displayIdentity = isStaffInvoice ? `Karyawan: ${staffName}` : tableIdentifier;

        return (
            <div className={`fixed inset-0 z-50 flex flex-col max-w-md mx-auto animate-in slide-in-from-bottom transition-colors duration-300 ${isStaffInvoice ? 'bg-purple-950' : 'bg-slate-900'}`}>
                <div className="p-6 text-white flex-1 overflow-y-auto">
                    <h2 className={`text-2xl font-black mb-2 uppercase ${isStaffInvoice ? 'text-purple-300' : 'text-emerald-400'}`}>Order Relay</h2>
                    <p className="text-slate-400 font-medium mb-6 flex items-center gap-2 flex-wrap">
                        Identitas: <span className="font-bold text-white text-xl">{displayIdentity}</span>
                        <span className="bg-slate-800 text-emerald-400 text-xs px-2.5 py-1 rounded-full border border-slate-700 flex items-center gap-1 font-bold">
                            <Users size={12} /> {customerCount} Orang
                        </span>
                    </p>

                    {/* STATION: BAR */}
                    {barItems.length > 0 && (
                        <div className="mb-6">
                            <div className="bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-t-lg w-max">
                                Station: BAR
                            </div>
                            <div className="bg-white text-slate-900 rounded-b-lg rounded-tr-lg p-4 shadow-sm flex flex-col gap-3">
                                {barItems.map((item) => (
                                    <div key={`${item.menu.id}-${item.selectedVariant || ''}`} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                        <div className="flex justify-between items-start">
                                            <span className="font-black text-slate-800 text-sm">
                                                {item.qty}x {item.menu.name}
                                                {item.selectedVariant && <span className="text-xs font-bold text-slate-500 block">Varian: {item.selectedVariant}</span>}
                                            </span>
                                            <span className="font-mono text-xs text-slate-500 font-bold">
                                                Rp {(getCartItemPrice(item) * item.qty).toLocaleString('id-ID')}
                                            </span>
                                        </div>
                                        {item.notes && <p className="text-rose-500 text-xs font-bold mt-1 uppercase">* {item.notes}</p>}
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
                                        <div className="flex justify-between items-start">
                                            <span className="font-black text-slate-800 text-sm">
                                                {item.qty}x {item.menu.name}
                                                {item.selectedVariant && <span className="text-xs font-bold text-slate-500 block">Varian: {item.selectedVariant}</span>}
                                            </span>
                                            <span className="font-mono text-xs text-slate-500 font-bold">
                                                Rp {(getCartItemPrice(item) * item.qty).toLocaleString('id-ID')}
                                            </span>
                                        </div>
                                        {item.notes && <p className="text-rose-500 text-xs font-bold mt-1 uppercase">* {item.notes}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className={`p-6 border-t ${isStaffInvoice ? 'border-purple-900 bg-purple-900/10' : 'border-slate-800 bg-slate-950'} flex gap-3`}>
                    <button
                        onClick={() => setIsRelayMode(false)}
                        disabled={isSubmitting}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-4 rounded-xl active:scale-95 transition-all text-sm uppercase tracking-wider disabled:opacity-50"
                    >
                        Kembali
                    </button>
                    <button
                        onClick={async () => {
                            if (isSubmittingRef.current) return
                            isSubmittingRef.current = true
                            setIsSubmitting(true)
                            try {
                                await finalizeOrder()
                                setIsRelayMode(false)
                                setIsOpen(false)
                                setIsStaffInvoice(false)
                                setStaffName('')
                            } catch (err) {
                                console.error('Checkout error:', err)
                            } finally {
                                isSubmittingRef.current = false
                                setIsSubmitting(false)
                            }
                        }}
                        disabled={isSubmitting}
                        className={`flex-1 font-black py-4 rounded-xl active:scale-95 transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 ${
                            isStaffInvoice
                                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                        }`}
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            'Selesai & Potong Stok'
                        )}
                    </button>
                </div>
            </div>
        )
    }

    // Mode Cart: Tampilan melayang (floating panel) pencatatan pesanan
    return (
        <div className={`fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 shadow-[0_-20px_40px_rgba(0,0,0,0.1)] transition-all duration-300 z-40 flex flex-col ${isOpen ? 'h-[85vh]' : 'h-24'}`}>

            {/* Header keranjang belanja (bisa di-toggle) */}
            <div 
                className={`flex justify-between items-center p-5 cursor-pointer rounded-t-2xl text-white transition-colors duration-300 ${
                    isStaffInvoice ? 'bg-purple-950 border-b border-purple-900/30' : 'bg-slate-900'
                }`} 
                onClick={() => setIsOpen(!isOpen)}
            >
                <div>
                    <p className="font-bold text-slate-300 text-sm">
                        {totalItems} Item Tercatat {isStaffInvoice && '(Karyawan)'}
                    </p>
                    <p className={`${isStaffInvoice ? 'text-purple-300' : 'text-emerald-400'} font-black text-xl`}>
                        Rp {totalPrice.toLocaleString('id-ID')}
                    </p>
                </div>
                <div className={`${isStaffInvoice ? 'bg-purple-900' : 'bg-slate-800'} p-3 rounded-full`}>
                    {isOpen ? <X size={24} /> : <Send size={24} />}
                </div>
            </div>

            {/* Panel detail keranjang (jika dibuka) */}
            {isOpen && (
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                    {/* Toggle Invoice Karyawan */}
                    <div className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-2xl p-4 shadow-sm select-none">
                        <span className="text-xs font-black text-purple-700 flex items-center gap-2 uppercase tracking-wider">
                            <Users size={14} className="text-purple-500" />
                            Invoice Staf / Karyawan
                        </span>
                        <button
                            type="button"
                            onClick={() => handleToggleStaffInvoice(!isStaffInvoice)}
                            className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${isStaffInvoice ? 'bg-purple-600' : 'bg-slate-300'}`}
                        >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${isStaffInvoice ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <input
                        type="text"
                        placeholder={isStaffInvoice ? "Pilih / Tulis Nama Karyawan..." : "Nama Pemesan / Meja..."}
                        value={isStaffInvoice ? staffName : tableIdentifier}
                        onChange={(e) => handleIdentityChange(e.target.value)}
                        className={`w-full border-2 rounded-xl p-4 font-black text-lg outline-none uppercase placeholder:normal-case placeholder:font-medium placeholder:text-slate-400 transition-all ${
                            isStaffInvoice 
                                ? 'border-purple-200 focus:border-purple-600 bg-purple-50/10 text-purple-900' 
                                : 'border-slate-200 focus:border-slate-900'
                        }`}
                    />

                    {/* Input Jumlah Pelanggan (Pax) */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Users size={14} className="text-slate-400" />
                                Jumlah Orang / Pax
                            </span>
                            <span className="text-xs font-black text-slate-800 bg-slate-200/60 px-2 py-0.5 rounded">
                                {customerCount} Orang
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCustomerCount(Math.max(1, customerCount - 1))}
                                disabled={customerCount <= 1 || isStaffInvoice}
                                className="flex-1 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white text-slate-800 border border-slate-200 rounded-xl py-2.5 font-black text-base shadow-sm transition-all active:scale-95 flex items-center justify-center"
                            >
                                -
                            </button>
                            <button
                                type="button"
                                onClick={() => setCustomerCount(customerCount + 1)}
                                disabled={isStaffInvoice}
                                className="flex-1 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white text-slate-800 border border-slate-200 rounded-xl py-2.5 font-black text-base shadow-sm transition-all active:scale-95 flex items-center justify-center"
                            >
                                +
                            </button>
                        </div>
                    </div>

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
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col gap-1.5 flex-1 pr-2">
                                        <p className="font-bold text-slate-900 text-base leading-tight">
                                            {item.menu.name}{item.selectedVariant ? ` (${item.selectedVariant})` : ''}
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                                                <button
                                                    onClick={() => decrementCartQty(item.menu.id, item.selectedVariant)}
                                                    className="w-7 h-7 bg-white hover:bg-slate-200 text-slate-800 rounded-md flex items-center justify-center font-black text-sm shadow-sm transition-colors active:scale-90"
                                                >
                                                    -
                                                </button>
                                                <span className="font-bold text-sm min-w-[20px] text-center text-slate-800">
                                                    {item.qty}
                                                </span>
                                                <button
                                                    onClick={() => addToCart(item.menu, item.selectedVariant)}
                                                    className="w-7 h-7 bg-white hover:bg-slate-200 text-slate-800 rounded-md flex items-center justify-center font-black text-sm shadow-sm transition-colors active:scale-90"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <span className="text-xs font-bold text-slate-500">
                                                Rp {(getCartItemPrice(item) * item.qty).toLocaleString('id-ID')}
                                            </span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => removeFromCart(item.menu.id, item.selectedVariant)} 
                                        className="text-rose-500 p-2.5 bg-rose-50 hover:bg-rose-100 rounded-xl active:scale-95 transition-all"
                                    >
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
                        className={`mt-auto w-full font-black uppercase tracking-wider py-4 rounded-xl disabled:bg-slate-300 disabled:text-slate-500 active:scale-95 transition-all ${
                            isStaffInvoice 
                                ? 'bg-purple-900 text-white hover:bg-purple-800' 
                                : 'bg-slate-900 text-white'
                        }`}
                    >
                        {tableIdentifier ? 'Kompilasi Pesanan' : 'Isi Identitas Dulu'}
                    </button>
                </div>
            )}
        </div>
    )
}