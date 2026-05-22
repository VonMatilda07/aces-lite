# ACES Lite - Smart Menu & Order Relay System

Sistem manajemen ketersediaan menu real-time dan kompilasi pesanan cerdas, dirancang khusus untuk mempercepat operasional bar dan dapur.

## 🚀 Tech Stack
* **Framework:** Next.js 14 (App Router)
* **Database & Realtime Engine:** Supabase (PostgreSQL + WebSocket)
* **State Management:** Zustand
* **Styling & UI:** Tailwind CSS, ShadCN UI (Maia Preset), Lucide Icons
* **Deployment:** Vercel

## 📂 Arsitektur Direktori
Aplikasi ini memisahkan secara tegas antara antarmuka pelanggan dan kontrol internal staf:

* `/src/app/page.tsx` -> **Customer QR View:** Layar *read-only* untuk pelanggan yang memindai QR Code. Dilengkapi *Dynamic Sorting* (menu habis turun ke bawah).
* `/src/app/waiter/page.tsx` -> **Waiter Command Center:** Dasbor rahasia staf. Dilengkapi *1-Tap Stock Engine* dan sistem *Smart Order Note*.
* `/src/store/useMenuStore.ts` -> **The Core Engine:** Berisi logika mutasi *Optimistic UI*, sistem keranjang memori (*Cart*), dan *listener* WebSocket.

## ⚙️ Cara Setup Lokal (Development)

1. Clone repositori ini.
2. Install dependensi:
   ```bash
   npm install
