'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/useAuthStore'

export default function AuthInitializer() {
    const initializeAuth = useAuthStore((state) => state.initializeAuth)

    useEffect(() => {
        initializeAuth()

        const handlePopState = () => {
            console.log('=== [DEBUG] Popstate terdeteksi (Back/Forward Browser). Memvalidasi sesi ulang... ===')
            initializeAuth()
        }

        window.addEventListener('popstate', handlePopState)
        return () => {
            window.removeEventListener('popstate', handlePopState)
        }
    }, [initializeAuth])

    return null // Komponen ini tidak merender UI apa pun, hanya inisialisasi state
}