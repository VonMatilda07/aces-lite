# Layout Documentation

`layout.tsx` pada folder `src/app/` mendefinisikan Root Layout utama untuk seluruh halaman pada aplikasi ACES Lite. File ini berfungsi sebagai kerangka dasar dokumen HTML, memuat font global, styling dasar, konfigurasi metadata, serta menyisipkan inisialisasi state autentikasi.

---

## 1. Tujuan Utama

- **Root Document Structure**: Menyediakan tag dasar `<html>` dan `<body>` yang digunakan oleh Next.js untuk menyusun halaman web.
- **Font & Styling Injection**: Menerapkan font modern Google Fonts (Geist, Geist Mono, dan Figtree) serta kelas Tailwind CSS secara global.
- **SEO & App Metadata**: Mengatur tag `<title>` dan `<meta name="description">` global untuk kebutuhan branding dan optimasi mesin pencari (SEO).
- **Client Auth Injection**: Memuat komponen client-side [AuthInitializer](file:///c:/Work/cc/aplikasi/ACES/ACES-LITE-MAIN/aces-lite/src/components/auth/AuthInitializer.tsx) agar listener auth Supabase diaktifkan sejak awal aplikasi dibuka.

---

## 2. Alur Logika & Setup Font

- Mengimpor fonts Geist, Geist_Mono, dan Figtree dari package `next/font/google`.
- Setiap font dikonfigurasi dengan variabel CSS kustom agar dapat dipanggil di Tailwind:
  - Figtree: Menggunakan `--font-sans` (font utama aplikasi).
  - Geist Sans: Menggunakan `--font-geist-sans`.
  - Geist Mono: Menggunakan `--font-geist-mono`.
- Menggunakan helper `cn` untuk menggabungkan class konfigurasi font dan kelas pembantu (`h-full`, `antialiased`) pada elemen `<html>`.

```typescript
export const metadata: Metadata = {
  title: "Aces Lite",
  description: "Aces Lite CoffeeCommunitas",
};
```

---

## 3. Komponen internal yang Tersemat

- **[AuthInitializer](file:///c:/Work/cc/aplikasi/ACES/ACES-LITE-MAIN/aces-lite/src/components/auth/AuthInitializer.tsx)**: Komponen client mini yang dipasang di awal body untuk mendengarkan perubahan status autentikasi pramusaji.

---

## 4. Penanganan Edge-Cases

- **Server-Side Rendered Metadata**:
  Root Layout dideklarasikan sebagai Server Component secara penuh (tidak memakai `'use client'`). Hal ini memastikan objek `metadata` dapat dibaca oleh parser internal Next.js untuk merender tag `<title>` statis di server. Jika layout utama menggunakan client rendering, Next.js akan memunculkan error kompilasi karena metadata tidak didukung di sisi client.
