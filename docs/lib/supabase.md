# Supabase.ts Documentation

`supabase.ts` menyediakan konfigurasi inisialisasi untuk client SDK Supabase. Ini adalah instance tunggal (singleton) yang digunakan untuk seluruh komunikasi database dan penanganan real-time WebSocket di aplikasi ACES Lite.

---

## 1. Tujuan Utama

- **Centralized Client API**: Menyediakan satu titik akses API Supabase untuk menghemat resource koneksi HTTP.
- **WebSocket Gateway**: Bertindak sebagai engine penghubung utama untuk real-time channel updates.
- **Cookie Synchronization**: Memastikan sesi auth di browser disinkronkan secara otomatis dalam bentuk cookie yang dikirim ke Next.js server, sehingga dapat terbaca oleh proxy/middleware.

---

## 2. Detail Logika & Konfigurasi

- Mengimpor fungsi `createBrowserClient` dari package `@supabase/ssr`.
- Membaca environment variables di client-side:
  - `process.env.NEXT_PUBLIC_SUPABASE_URL`: Endpoint API database Supabase.
  - `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`: Kunci publik aman untuk otorisasi akses tanpa login (anonim).
- Tanda seru (`!`) di akhir assignment menunjukkan asersi TypeScript bahwa nilai environment tersebut pasti ada (non-null/non-undefined).

---

## 3. Cara Penggunaan di Codebase

Untuk melakukan query atau real-time subscription, cukup impor instance `supabase` langsung:

```typescript
import { supabase } from '@/lib/supabase'

// Contoh query
const { data } = await supabase.from('menus').select('*')
```

---

## 4. Penanganan Edge-Cases

- **Missing Environment Variables**:
  Jika environment variables `NEXT_PUBLIC_SUPABASE_URL` atau `NEXT_PUBLIC_SUPABASE_ANON_KEY` belum diset di berkas `.env.local` saat inisiasi build, proses kompilasi Next.js akan langsung gagal karena error asersi non-null. Hal ini menjamin error konfigurasi terdeteksi di awal sebelum dideploy.
