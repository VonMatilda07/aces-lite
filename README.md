# ACES Lite - Smart Menu & Order Relay System ☕🚀

[![Next.js](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare_R2-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://www.cloudflare.com/products/r2/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Web Push](https://img.shields.io/badge/Web_Push-Active-red?style=for-the-badge&logo=webpush&logoColor=white)]()
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-blueviolet?style=for-the-badge&logo=progressive-web-apps&logoColor=white)]()
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

**ACES Lite** adalah asisten operasional kafe modern super cepat dan cerdas! Sistem ini dirancang khusus untuk menyelaraskan alur kerja pramusaji (waiter), bar (barista), dapur (kitchen), dan pelanggan secara real-time tanpa jeda. 

Lupakan sistem manual atau egress limit Supabase yang mahal. Dengan migrasi **Cloudflare R2 (kustom domain)**, sistem notifikasi **Web Push PWA**, serta pengaman transaksi **Double-Order Prevention**, kafe Anda siap berjalan di level yang jauh lebih tinggi! 

---

## ✨ Fitur Gokil & Modern

### 1. Tampilan Pelanggan / Customer QR View (`/`)
* **Live Sync Menu**: Daftar menu pelanggan ter-update secara senyap di latar belakang (*silent fetch*) tanpa merusak posisi scroll/kedipan layar.
* **Auto-Sort Sold Out**: Menu yang habis otomatis bergeser ke posisi paling bawah biar pelanggan tidak kecewa saat scroll.
* **Rekomendasi Pintar (Smart Alternatives)**: Jika menu habis, sistem secara otomatis merekomendasikan 3 menu pengganti yang relevan berdasarkan subkategori.
* **Kotak Masukan & Voucher Diskon 10%**: Pelanggan bisa mengirim kritik & saran (pelayanan, makanan, minuman, suasana) untuk mendapatkan kode voucher diskon unik (`CC-XXXX`). Dilengkapi proteksi isi ulang 24 jam berbasis `localStorage` dan pengecekan server-side (Supabase RPC) otomatis.
* **Desain Premium Tanpa Potong**: Gambar produk menggunakan gaya *full-bleed card background* bergradasi lembut. Pada mode mobile detail accordion, aspek rasio foto produk menyesuaikan secara dinamis agar terlihat utuh (*zero cropping*).

### 2. Dasbor Waiter Command Center (`/waiter`)
* **Catat Order & Varian Inline**: Tombol pencatatan varian rasa/suhu (Hot/Iced) disajikan secara inline langsung di bawah nama produk untuk mempercepat input pramusaji (sekali ketuk).
* **Proteksi Transaksional (Aman Sinyal)**: Keranjang pesanan hanya akan dihapus jika database Supabase sukses menyimpan data order. Jika koneksi seluler mati/glitch, keranjang tidak akan terhapus dan waiter bisa menekan tombol kirim ulang.
* **Double-Order & Over-selling Guard**: Validasi stok real-time otomatis mendeteksi dan menyesuaikan kuantitas keranjang jika ada stok produk yang habis disapu pramusaji lain pada detik yang sama.
* **Widget Jam & Pax Counter**: Dilengkapi penghitung jumlah pelanggan (Pax) meja terintegrasi dan widget jam digital operasional yang detail.
* **Klaim Voucher Kasir**: Waiter/Kasir bisa memverifikasi dan menandai voucher diskon 10% pelanggan secara real-time di database.

### 3. Dasbor Barista (`/barista`) & Kitchen (`/kitchen`)
* **Stasiun Kerja Terpisah**: Pesanan otomatis terbagi ke halaman Barista (hanya menampilkan minuman/bar) dan Kitchen (hanya menampilkan makanan/dapur).
* **Wake Lock Screen API**: Menjaga agar layar HP/Tablet stasiun barista dan dapur tetap menyala terus selama aplikasi dibuka (tidak terkunci otomatis).
* **Audio Chime Alerts**: Membunyikan suara lonceng secara otomatis menggunakan Web Audio API lokal saat ada pesanan baru masuk stasiun.
* **Web Push Notifications (PWA)**: Staf tetap menerima notifikasi banner sistem di HP mereka (lengkap dengan getaran) meskipun layar HP sedang mati atau browser ditutup.
* **Analytics COMING SOON!**: Halaman analisis performa stasiun saji khusus untuk level pimpinan (Head Barista / Head Kitchen).

### 4. Dasbor Admin & Marketing (`/admin`)
* **Image Editor Crop 1:1 & Rotate**: Form tambah menu dilengkapi modal crop lingkaran/persegi 1:1, garis bantu *rule of thirds*, putar foto 90°, serta auto-compress ke JPEG ~100KB sebelum diunggah ke Cloudflare R2 secara server-side.
* **Weekly Scheduler**: Penjadwalan menu dinamis otomatis berdasarkan hari dan rentang jam.
* **Audit Logs Terpusat**: Seluruh aktivitas krusial staf (ubah peran, hapus feedback, reset stok) tercatat aman di database.
* **Peran Khusus Marketing**: Staf dengan peran `marketing` otomatis masuk ke halaman khusus monitoring statistik kepuasan pelanggan kafe (sub-rating kategori).

---

## 🛠️ Tech Stack

* **Framework:** Next.js (App Router, Turbopack)
* **Database & WebSocket Real-time:** Supabase
* **Object Storage:** Cloudflare R2 (S3 Client SDK) dengan kustom domain `storage.coffeecomunitas.shop` (Bypass Telkomsel DNS block)
* **State Management:** Zustand
* **Desain UI:** Tailwind CSS, Lucide Icons, ShadCN UI
* **Deployment:** Vercel

---

## 📂 Struktur Direktori Proyek

```text
├── docs/                      # Dokumentasi arsitektur dan komponen
├── public/                    # Aset statis, manifest PWA & sw.js (Service Worker)
├── scratch/                   # Skrip utilitas migrasi & uji lokal (.mjs)
└── src/
    ├── app/
    │   ├── page.tsx           # Tampilan Menu Pelanggan (QR View)
    │   ├── login/             # Halaman Masuk Staff
    │   ├── waiter/            # Dasbor Pramusaji (Command Center)
    │   ├── barista/           # Dasbor Barista (Antrean Minuman & Audio Chime)
    │   ├── kitchen/           # Dasbor Kitchen (Antrean Makanan & Audio Chime)
    │   └── admin/             # Dasbor Admin & Supervisor (Manajemen, Audit & Feedback)
    ├── components/
    │   ├── customer/          # Komponen QR View (MenuList, FeedbackBox)
    │   ├── waiter/            # Komponen Waiter (Cart, Tiket Antrean)
    │   ├── push/              # Pendaftar Token Notifikasi HP Staf (PushRegister)
    │   └── ui/                # Komponen dasar UI Tailwind
    ├── lib/
    │   ├── supabase.ts        # Inisialisasi client Supabase (Stateless & SSR)
    │   └── audit.ts           # Engine pencatat Log Audit staf ke database
    └── store/
        ├── useMenuStore.ts    # Core Engine: State menu, keranjang, tiket, & realtime listener
        └── useAuthStore.ts    # Auth Engine: Sesi masuk & otorisasi peran staf
```

---

## 🗄️ Skema Database Supabase (DDL SQL Terbaru)

Salin dan jalankan query berikut di **SQL Editor** Supabase Anda untuk membangun tabel-tabel sistem:

```sql
-- ========================================================
-- DATABASE ACES LITE DDL
-- ========================================================

-- 1. Tabel Profil Staf
CREATE TABLE public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    email text NOT NULL,
    role text DEFAULT 'waiter'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabel Menu Utama
CREATE TABLE public.menus (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name text NOT NULL,
    category text NOT NULL,
    subcategory text,
    price numeric NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    nutri_grade text DEFAULT 'C'::text NOT NULL,
    stock integer,
    is_featured boolean DEFAULT false,
    description text,
    image_url text,
    variants jsonb DEFAULT '[]'::jsonb,
    menu_type text DEFAULT 'single'::text,
    bundle_items jsonb DEFAULT '[]'::jsonb,
    schedule jsonb DEFAULT '[]'::jsonb,
    alternatives jsonb DEFAULT '[]'::jsonb,
    station text DEFAULT 'bar'::text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabel Tiket Pemesanan (Order Relay Headers)
CREATE TYPE ticket_status AS ENUM ('draft', 'relayed');

CREATE TABLE public.order_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    waiter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    table_identifier text NOT NULL,
    customer_count integer DEFAULT 1 NOT NULL,
    status ticket_status DEFAULT 'draft'::ticket_status NOT NULL,
    bar_status text DEFAULT 'pending'::text,
    kitchen_status text DEFAULT 'pending'::text,
    bar_prep_start timestamp with time zone,
    bar_prep_end timestamp with time zone,
    kitchen_prep_start timestamp with time zone,
    kitchen_prep_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabel Item Pemesanan (Order Relay Details)
CREATE TABLE public.ticket_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    ticket_id uuid REFERENCES public.order_tickets(id) ON DELETE CASCADE,
    menu_id uuid REFERENCES public.menus(id) ON DELETE SET NULL,
    qty integer DEFAULT 1 NOT NULL,
    notes text,
    category_snapshot text NOT NULL
);

-- 5. Tabel Log Audit Staf
CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_email text NOT NULL,
    action text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tabel Kritik & Saran Pelanggan
CREATE TABLE public.customer_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    customer_name text,
    feedback_text text NOT NULL,
    rating integer,
    rating_service integer,
    rating_beverage integer,
    rating_food integer,
    rating_ambiance integer,
    voucher_code text,
    is_claimed boolean DEFAULT false,
    claimed_at timestamp with time zone,
    claimed_by text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Tabel Token Notifikasi HP Staf (Push Notifications)
CREATE TABLE public.push_subscriptions (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

---

## ⚙️ Panduan Setup & Jalankan Lokal

### 1. Kloning Repositori
```bash
git clone <repository-url>
cd aces-lite
npm install
```

### 2. Konfigurasi Lingkungan (`.env.local`)
Buat file `.env.local` di direktori utama, lalu isi dengan konfigurasi Supabase & Cloudflare R2 Anda:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://<proyek-anda>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-anda>

# Web Push VAPID Keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<vapid-public-key-anda>
VAPID_PRIVATE_KEY=<vapid-private-key-anda>

# Cloudflare R2 Configuration
R2_ACCESS_KEY_ID=<access-key-id-anda>
R2_SECRET_ACCESS_KEY=<secret-access-key-anda>
R2_ENDPOINT=https://<cloudflare-account-id>.r2.cloudflarestorage.com
R2_BUCKET_NAME=aces-lite-storage
NEXT_PUBLIC_R2_PUBLIC_URL=https://storage.coffeecomunitas.shop
```

### 3. Jalankan Server Dev
```bash
npm run dev
```
Buka browser di alamat [http://localhost:3000](http://localhost:3000) untuk tampilan pelanggan QR, atau [http://localhost:3000/waiter](http://localhost:3000/waiter) untuk dasbor waiter.

---

## 🧪 Skrip Pengujian & Pemeliharaan (Folder `/scratch`)

Tersedia skrip Node.js mandiri yang bisa dijalankan di terminal lokal untuk keperluan tes database & aset:

* **Update Massal Domain Gambar ke Kustom Domain R2**:
  ```bash
  node scratch/update-db-to-custom-domain.mjs
  ```
* **Simulasi Alur Order Tiket & POS Relay**:
  ```bash
  node scratch/test-tickets-flow.mjs
  ```
* **Uji Coba Ambil Gambar R2 dari Kustom Domain**:
  ```bash
  node scratch/test-fetch-r2.mjs
  ```
* **Cek Sesi Profil Staf**:
  ```bash
  node scratch/check-profiles.mjs
  ```
