// src/components/waiter/WaiterTicketsList.tsx
'use client'

import { useState, useEffect } from 'react'
import { useMenuStore, OrderTicket } from '@/store/useMenuStore'
import { Check, ClipboardList, Clock, ArrowRight, User } from 'lucide-react'

interface WaiterTicketsListProps {
    statusFilter: 'draft' | 'relayed'
}

export default function WaiterTicketsList({ statusFilter }: WaiterTicketsListProps) {
    const { 
        activeTickets, 
        completedTickets, 
        isTicketsLoading, 
        fetchTickets, 
        markTicketAsRelayed,
        subscribeToTicketsRealtime
    } = useMenuStore()

    const [submittingId, setSubmittingId] = useState<string | null>(null)

    // Load and subscribe to tickets realtime
    useEffect(() => {
        fetchTickets()
        const unsubscribe = subscribeToTicketsRealtime()
        return () => unsubscribe()
    }, [fetchTickets, subscribeToTicketsRealtime])

    const tickets = statusFilter === 'draft' ? activeTickets : completedTickets

    // Helper to format time relative or clock
    const formatTicketTime = (dateStr: string) => {
        const ticketDate = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - ticketDate.getTime()
        const diffMins = Math.floor(diffMs / 60000)

        if (diffMins < 1) return 'Baru saja'
        if (diffMins < 60) return `${diffMins} menit lalu`
        
        const hrs = Math.floor(diffMins / 60)
        if (hrs < 24) return `${hrs} jam lalu`

        return ticketDate.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    // Parse variant and note from compound notes string
    const parseNotesAndVariant = (notesStr: string | null) => {
        if (!notesStr) return { variant: null, notes: null }
        const match = notesStr.match(/^\[Varian:\s*([^\]]+)\](.*)$/)
        if (match) {
            return {
                variant: match[1].trim(),
                notes: match[2].trim() || null
            }
        }
        return { variant: null, notes: notesStr }
    }

    // Handle POS Relay action
    const handleRelay = async (ticketId: string) => {
        setSubmittingId(ticketId)
        try {
            await markTicketAsRelayed(ticketId)
        } catch (e) {
            console.error('Error marking ticket as relayed:', e)
        } finally {
            setSubmittingId(null)
        }
    }

    if (isTicketsLoading && tickets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-emerald-500 animate-spin" />
                <p className="text-xs font-bold">Memuat tiket pesanan...</p>
            </div>
        )
    }

    if (tickets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-slate-400 gap-4 animate-in fade-in duration-300">
                <div className="p-4 bg-slate-100 rounded-full text-slate-400">
                    <ClipboardList size={36} />
                </div>
                <div>
                    <h3 className="font-black text-slate-700 text-sm">Tidak Ada Tiket Pesanan</h3>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
                        {statusFilter === 'draft' 
                            ? 'Antrean kosong! Belum ada pesanan aktif yang perlu di-input ke POS.' 
                            : 'Belum ada riwayat pesanan yang di-relay ke POS.'}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4 p-4 pb-28 animate-in fade-in duration-300">
            {tickets.map((ticket) => {
                // Compute total price of the ticket
                const ticketTotal = ticket.ticket_items?.reduce((sum, item) => {
                    const price = item.menus?.price || 0
                    return sum + (price * item.qty)
                }, 0) || 0

                return (
                    <div 
                        key={ticket.id} 
                        className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${
                            ticket.status === 'draft' 
                                ? 'border-slate-200' 
                                : 'border-slate-100 opacity-90'
                        }`}
                    >
                        {/* Ticket Header */}
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase">IDENTITAS</span>
                                <h3 className="font-black text-slate-800 text-base leading-tight uppercase mt-0.5">
                                    {ticket.table_identifier}
                                </h3>
                            </div>
                            
                            <div className="text-right flex flex-col items-end">
                                <span className="flex items-center gap-1 text-[10px] text-slate-500 font-bold">
                                    <Clock size={11} className="text-amber-500" />
                                    {formatTicketTime(ticket.created_at)}
                                </span>
                                {ticket.waiter_email && (
                                    <span className="flex items-center gap-0.5 text-[9px] text-slate-400 lowercase mt-0.5">
                                        <User size={10} />
                                        {ticket.waiter_email.split('@')[0]}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Ticket Items List */}
                        <div className="p-4 flex flex-col gap-3.5">
                            {ticket.ticket_items?.map((item) => {
                                const { variant, notes } = parseNotesAndVariant(item.notes)
                                const isDrink = ['Coffee', 'Non-Coffee'].includes(item.category_snapshot)

                                return (
                                    <div key={item.id} className="flex justify-between items-start gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-start gap-2">
                                                <span className={`text-xs font-black px-2 py-0.5 rounded-md min-w-[24px] text-center mt-0.5 ${
                                                    isDrink 
                                                        ? 'bg-blue-50 text-blue-600' 
                                                        : 'bg-orange-50 text-orange-600'
                                                }`}>
                                                    {item.qty}x
                                                </span>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-sm leading-tight">
                                                        {item.menus?.name || 'Menu Tidak Dikenal'}
                                                    </span>
                                                    
                                                    {/* Variant Badge */}
                                                    {variant && (
                                                        <span className="inline-block bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded w-max mt-1">
                                                            {variant}
                                                        </span>
                                                    )}
                                                    
                                                    {/* Note */}
                                                    {notes && (
                                                        <p className="text-[11px] text-rose-500 font-bold mt-1 uppercase">
                                                            * {notes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-[11px] font-bold text-slate-400">
                                                @ Rp {((item.menus?.price || 0)).toLocaleString('id-ID')}
                                            </span>
                                            <p className="text-xs font-black text-slate-700 mt-0.5">
                                                Rp {((item.menus?.price || 0) * item.qty).toLocaleString('id-ID')}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Divider */}
                        <div className="border-t border-dashed border-slate-200 mx-4" />

                        {/* Ticket Footer */}
                        <div className="p-4 bg-white flex justify-between items-center gap-4">
                            <div>
                                <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase block">TOTAL BILL</span>
                                <span className="text-base font-black text-slate-900">
                                    Rp {ticketTotal.toLocaleString('id-ID')}
                                </span>
                            </div>

                            {/* Action Button */}
                            {ticket.status === 'draft' ? (
                                <button
                                    onClick={() => handleRelay(ticket.id)}
                                    disabled={submittingId !== null}
                                    className="bg-slate-900 hover:bg-slate-800 text-white active:scale-95 transition-all text-xs font-black uppercase tracking-wider py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                                >
                                    {submittingId === ticket.id ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Input ke POS
                                            <ArrowRight size={13} />
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-1">
                                    <Check size={12} className="stroke-[3]" />
                                    Telah di-input
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
