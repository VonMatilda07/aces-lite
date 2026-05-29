# ACES Lite - Smart Menu & Order Relay System

ACES Lite adalah sistem manajemen ketersediaan menu real-time dan kompilasi pesanan cerdas, dirancang khusus untuk mempercepat alur kerja operasional pramusaji (waiter), bar, dan dapur pada kafe modern.

Sistem ini memfasilitasi pencatatan pesanan di meja pelanggan oleh waiter (*taking order*), antrean pemrosesan ke mesin kasir fisik (*POS Relay Queue*), sinkronisasi stok otomatis/manual secara real-time, serta riwayat handout.

---

## 🚀 Fitur Utama

### 1. Customer QR View (`/`)
* **Live Sync Menu**: Menampilkan menu terkini yang sinkron secara instan dengan perubahan stok dari pramusaji.
* **Dynamic Sorting**: Menu yang berstatus Habis (*Sold Out*) otomatis digeser ke urutan terbawah agar tidak mengganggu navigasi pelanggan.
* **Search & Filter**: Fitur pencarian instan dan klasifikasi sub-kategori menu untuk navigasi yang cepat.
* **Smart Alternative Suggestion**: Jika menu berstatus habis, sistem otomatis menyarankan 3 alternatif menu serupa (secara cerdas berbasis sub-kategori, atau alternatif khusus yang diatur oleh Admin).
* **Bundle Menu Viewer**: Menampilkan informasi komponen penyusun menu paket/bundling beserta nutri-grade masing-masing komponen.

### 2. Waiter Command Center (`/waiter`)
* **Clock & Date Widget**: Widget jam dinamis real-time (detik, menit, jam, hari, dan tanggal) untuk mempermudah koordinasi operasional.
* **1-Tap Stock Control**: Memungkinkan pramusaji mengubah status ketersediaan menu (*Tersedia, Menipis, Habis*) dan jumlah stok hanya dalam sekali ketuk.
* **Order Tab System**:
  * **Catat Order**: Halaman pencatatan pesanan pelanggan berbasis stasiun saji (Bar vs Kitchen) lengkap dengan catatan khusus per item.
  * **Antrean POS**: Menampilkan daftar taking order aktif berstatus `draft` yang siap dimasukkan oleh waiter ke sistem kasir fisik. Dilengkapi badge jumlah antrean interaktif yang bergerak memantul (*bounce animation*).
  * **Riwayat**: Menampilkan log pesanan yang telah di-relay ke POS fisik (status `relayed`).

### 3. Admin Command Center (`/admin`)
* **Menu Management**: CRUD menu, penentuan sub-kategori, pengisian alternatif menu, pembagian varian rasa/suhu dengan stok mandiri, dan tipe menu (single vs bundle).
* **Weekly Menu Scheduler**: Penjadwalan menu dinamis berdasarkan hari dan rentang jam tertentu (misal: menu sarapan hanya muncul Senin-Jumat pukul 07:00 - 10:00).
* **Staff Profile Management**: Mengatur akun staf beserta otorisasi peran (*Admin, Supervisor, Captain, Waiter, Kitchen, Barista*).
* **Audit Logs**: Melacak setiap tindakan krusial staf (seperti perubahan status menu, otorisasi staf, penyelesaian transaksi) untuk transparansi operasional.

---

## 🛠️ Tech Stack

* **Framework:** Next.js 14/15 (App Router & Turbopack)
* **Database & Realtime Engine:** Supabase (PostgreSQL + Realtime PostgreSQL Changes via WebSocket)
* **State Management:** Zustand
* **Styling & UI:** Tailwind CSS, Lucide Icons, ShadCN UI
* **Deployment:** Vercel

---

## 📂 Struktur Direktori Utama

```text
├── docs/                 # Dokumentasi arsitektur dan komponen
├── public/               # Aset statis & logo
├── scratch/              # Skrip utilitas pengembang & simulasi tes lokal
└── src/
    ├── app/
    │   ├── page.tsx      # Tampilan Menu Pelanggan (QR View)
    │   ├── login/        # Halaman Masuk Staff
    │   ├── waiter/       # Dasbor Pramusaji (Command Center)
    │   └── admin/        # Dasbor Admin & Supervisor (Manajemen & Audit)
    ├── components/
    │   ├── waiter/       # Komponen khusus Waiter (Cart, Tiket Antrean POS)
    │   └── ui/           # Komponen UI dasar yang dapat digunakan kembali
    ├── lib/
    │   ├── supabase.ts   # Inisialisasi client Supabase (SSR & Stateless)
    │   └── audit.ts      # Engine pencatat Log Audit staf ke database
    └── store/
        ├── useMenuStore.ts # Core Engine: State menu, keranjang, order tickets, & realtime listener
        └── useAuthStore.ts # Auth Engine: Sesi masuk & otorisasi peran staf
```

---

## 🗄️ Skema Database Supabase (DDL SQL)

Jalankan query SQL berikut di dalam **SQL Editor** pada Console Supabase Anda untuk mempersiapkan tabel-tabel sistem:

```sql
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
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabel Tiket Pemesanan (Order Relay Headers)
CREATE TYPE ticket_status AS ENUM ('draft', 'relayed');

CREATE TABLE public.order_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    waiter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    table_identifier text NOT NULL,
    status ticket_status DEFAULT 'draft'::ticket_status NOT NULL,
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
```

---

## ⚙️ Panduan Setup Lokal (Development)

### 1. Prasyarat
Pastikan komputer Anda sudah terinstal **Node.js (LTS)**.

### 2. Kloning dan Instalasi
Kloning repositori dan instal paket dependensi:
```bash
git clone <repository-url>
cd aces-lite
npm install
```

### 3. Konfigurasi Variabel Lingkungan (`.env.local`)
Buat file bernama `.env.local` di direktori utama proyek, lalu isi dengan URL dan API Key dari proyek Supabase Anda:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<id-proyek-anda>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-anda>
```

### 4. Menjalankan Server Lokal
Jalankan server pengembangan lokal:
```bash
npm run dev
```
Buka browser Anda di alamat [http://localhost:3000](http://localhost:3000) untuk mengakses halaman pelanggan, atau [http://localhost:3000/waiter](http://localhost:3000/waiter) untuk dasbor pramusaji.

---

## 🧪 Skrip Pengujian & Utilitas

Di dalam folder `/scratch`, terdapat beberapa skrip utilitas pengujian database lokal berbasis Node.js. Anda dapat menjalankannya untuk memvalidasi performa database dan autentikasi:

* **Menguji Alur Order & POS Relay**:
  ```bash
  node scratch/test-tickets-flow.mjs
  ```
* **Memeriksa Daftar Profil Staf**:
  ```bash
  node scratch/check-profiles.mjs
  ```
