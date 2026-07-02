// src/components/chat/ChatWidget.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { MessageCircle, X, Send, AlertTriangle } from 'lucide-react'

interface ChatMessage {
    id: string
    created_at: string
    sender_email: string
    sender_role: string
    message: string
}

const QUICK_TEMPLATES = [
    '📢 Es Batu Habis!',
    '📢 Piring/Gelas Kotor Menumpuk!',
    '📢 Tolong Bantu Angkat Meja',
    '📢 Orderan Siap Disajikan!',
    '📢 Stok Kopi/Susu Menipis!',
    '📢 Mesin Espresso Trouble',
    '📢 Mesin Kasir Error',
    '📢 Rijal Terlalu Hitam',
    '📢 Adam Terlalu Hitam',
    '📢 Dapur Terlalu Panas',
    '📢 Tolong Backup Dulu, Saya Mau Ke Toilet',
    'Kecap Anjing',
    'Deki Gelap',
    'Wak Wak Wak Doyokkkkkkkkkk'

]

export default function ChatWidget() {
    const { user, role } = useAuthStore()
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [isSending, setIsSending] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)

    const chatEndRef = useRef<HTMLDivElement>(null)

    // Fetch initial messages and subscribe to real-time updates
    useEffect(() => {
        if (!user) return

        // 1. Fetch last 50 messages
        const fetchInitialMessages = async () => {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .order('created_at', { ascending: true })
                .limit(50)

            if (!error && data) {
                setMessages(data)
            } else {
                console.error('Error fetching chat messages:', error)
            }
        }

        fetchInitialMessages()

        // 2. Subscribe to real-time insert changes
        const channel = supabase
            .channel('chat_room_channel')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages' },
                (payload) => {
                    const newMsg = payload.new as ChatMessage
                    setMessages((prev) => [...prev, newMsg])

                    // Increment unread count if chat drawer is closed
                    if (!isOpen) {
                        setUnreadCount((c) => c + 1)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user, isOpen])

    // Auto-scroll to bottom
    useEffect(() => {
        if (isOpen) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, isOpen])

    // Open chat and reset unread count
    const handleOpenChat = () => {
        setIsOpen(true)
        setUnreadCount(0)
    }

    const handleSendMessage = async (text: string) => {
        if (!text.trim() || !user || isSending) return

        setIsSending(true)
        const currentRole = role || 'waiter'

        const { error } = await supabase
            .from('chat_messages')
            .insert({
                sender_email: user.email,
                sender_role: currentRole,
                message: text.trim()
            })

        if (error) {
            console.error('Failed to send message:', error)
            alert('Gagal mengirim pesan chat, pastikan tabel database chat_messages sudah Anda buat.')
        } else {
            setNewMessage('')
        }
        setIsSending(false)
    }

    if (!user) return null

    return (
        <>
            {/* FLOATING ACTION BUTTON */}
            <button
                onClick={handleOpenChat}
                className="fixed bottom-28 right-4 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all z-40 flex items-center justify-center border border-indigo-500 animate-in zoom-in duration-200"
                title="Buka Chat Koordinasi"
            >
                <MessageCircle size={24} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* CHAT DRAWER PANEL */}
            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-200">
                    <div
                        className="bg-white w-full max-w-sm h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200"
                    >
                        {/* Header */}
                        <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-wide">Koordinasi Staf</h3>
                                    <p className="text-[10px] text-slate-400 font-bold">Saluran Real-Time Kafe</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="bg-slate-800 p-2 rounded-full text-slate-300 hover:text-white active:scale-90 transition-transform"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Message List */}
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-slate-50">
                            {messages.length === 0 ? (
                                <div className="m-auto text-center p-6 text-slate-400 max-w-[240px] flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-350 font-bold text-xl mb-1">💬</div>
                                    <p className="text-xs font-bold">Belum ada obrolan koordinasi.</p>
                                    <p className="text-[10px] text-slate-400">Gunakan kolom input di bawah atau tombol template untuk menyapa rekan staf kafe.</p>
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isMe = msg.sender_email === user.email
                                    const senderAlias = msg.sender_email.split('@')[0]

                                    // Format Time (WITA/Local browser)
                                    const localTime = new Date(msg.created_at).toLocaleTimeString('id-ID', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex flex-col gap-1 max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                                        >
                                            {/* Sender Name & Role Badge */}
                                            <div className="flex items-center gap-1.5 px-1">
                                                <span className="text-[9px] font-black text-slate-500 lowercase">{senderAlias}</span>
                                                <span className={`text-[7px] font-black uppercase px-1 rounded border ${msg.sender_role === 'admin' || msg.sender_role === 'supervisor'
                                                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                                                    : msg.sender_role === 'captain'
                                                        ? 'bg-amber-50 border-amber-200 text-amber-600'
                                                        : msg.sender_role === 'waiter'
                                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                                            : 'bg-slate-100 border-slate-200 text-slate-500'
                                                    }`}>
                                                    {msg.sender_role}
                                                </span>
                                            </div>

                                            {/* Bubble */}
                                            <div className={`p-3 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm break-words ${isMe
                                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                                                }`}>
                                                {msg.message}
                                            </div>

                                            {/* Timestamp */}
                                            <span className="text-[8px] text-slate-400 font-mono px-1">{localTime}</span>
                                        </div>
                                    )
                                })
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Templates Section */}
                        <div className="p-3 bg-white border-t border-slate-150 shrink-0 flex flex-col gap-2">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Balasan Cepat (Quick Template)</span>
                            <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-1">
                                {QUICK_TEMPLATES.map((tmpl) => (
                                    <button
                                        key={tmpl}
                                        onClick={() => handleSendMessage(tmpl)}
                                        className="shrink-0 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-full active:scale-95 transition-all shadow-sm"
                                    >
                                        {tmpl.substring(2)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Input Area */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                handleSendMessage(newMessage)
                            }}
                            className="p-3 bg-white border-t border-slate-200 shrink-0 flex gap-2"
                        >
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Ketik pesan koordinasi..."
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-indigo-650 focus:bg-white text-slate-800"
                            />
                            <button
                                type="submit"
                                disabled={!newMessage.trim() || isSending}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white p-2.5 rounded-xl active:scale-95 transition-all flex items-center justify-center shrink-0 shadow-sm"
                            >
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
