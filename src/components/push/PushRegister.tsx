'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/useAuthStore'

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export default function PushRegister() {
    const user = useAuthStore((state) => state.user)

    useEffect(() => {
        if (!user) return

        async function registerPush() {
            if (typeof window === 'undefined') return
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                console.log('=== [PUSH] Push notifications are not supported in this browser. ===')
                return
            }

            try {
                // Register service worker
                const registration = await navigator.serviceWorker.register('/sw.js')
                console.log('=== [PUSH] Service Worker registered scope:', registration.scope, '===')

                // Wait for the service worker to become active
                if (registration.installing) {
                    await new Promise<void>((resolve) => {
                        registration.installing?.addEventListener('statechange', (e: any) => {
                            if (e.target.state === 'activated') resolve()
                        })
                    })
                }

                // Check permission state
                let permission = Notification.permission
                if (permission === 'default') {
                    permission = await Notification.requestPermission()
                }

                if (permission !== 'granted') {
                    console.log('=== [PUSH] Notification permission denied or dismissed. ===')
                    return
                }

                // Retrieve active subscription
                let subscription = await registration.pushManager.getSubscription()
                
                // If subscription does not exist, subscribe
                if (!subscription) {
                    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
                    if (!vapidPublicKey) {
                        console.error('=== [PUSH] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not defined in env.local ===')
                        return
                    }
                    console.log('=== [PUSH] Creating new push subscription... ===')
                    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)
                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: convertedVapidKey
                    })
                }

                console.log('=== [PUSH] Active push subscription:', subscription.endpoint, '===')

                // Send to backend
                const response = await fetch('/api/push/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ subscription }),
                })
                
                if (response.ok) {
                    console.log('=== [PUSH] Successfully registered subscription on server. ===')
                } else {
                    const errText = await response.text()
                    console.error('=== [PUSH] Failed to register subscription on server:', errText, '===')
                }
            } catch (error) {
                console.error('=== [PUSH] Error registering push subscription:', error)
            }
        }

        // Run after page load/stabilization
        const timer = setTimeout(() => {
            registerPush()
        }, 1500)

        return () => clearTimeout(timer)
    }, [user])

    return null
}
