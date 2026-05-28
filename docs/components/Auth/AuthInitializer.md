# AuthInitializer Component Documentation

`AuthInitializer` adalah komponen Client-side React tingkat tinggi yang bertugas menginisialisasi listener sesi autentikasi Supabase saat aplikasi ACES Lite pertama kali dimuat di browser.

---

## 1. Tujuan Utama

- **Authentication Lifecycle Entry**: Memicu pemanggilan fungsi inisialisasi status login secara global.
- **Server Rendering Compatibility**: Menjalankan efek samping client-side (seperti mendengarkan event login/logout Supabase) tanpa harus memaksakan Root Layout utama menjadi Client Component. Hal ini penting untuk mempertahankan optimasi performa dan rendering metadata HTML di tingkat server.

---

## 2. Alur Logika (Why & How)

*   **Why**: 
    Root layout Next.js (`layout.tsx`) idealnya adalah Server Component agar metadata statis/dinamis seperti `<title>` dapat dirender secara efisien di server. Namun, inisialisasi sesi Supabase (`supabase.auth.onAuthStateChange`) membutuhkan akses ke API browser (`useEffect`) dan merupakan operasi client-side.
    Jika kita memaksakan menambahkan `'use client'` di atas layout utama, Next.js akan memunculkan error build karena metadata tidak boleh diekspor dari Client Component. 
*   **How**:
    1. Membuat komponen client kecil `AuthInitializer` yang mengimpor `useAuthStore` dari Zustand.
    2. Di dalam komponen, React `useEffect` dipanggil untuk memicu metode `initializeAuth()`.
    3. Komponen ini sengaja mengembalikan nilai `null` (`return null`) agar tidak merender elemen visual apa pun di DOM.
    4. Komponen diimpor dan disematkan langsung di dalam tag `<body>` pada file layout server [layout.tsx](file:///c:/Work/cc/aplikasi/ACES/ACES-LITE-MAIN/aces-lite/src/app/layout.tsx).

```typescript
// Di dalam AuthInitializer.tsx
export default function AuthInitializer() {
    const initializeAuth = useAuthStore((state) => state.initializeAuth)

    useEffect(() => {
        initializeAuth()
    }, [initializeAuth])

    return null
}
```

---

## 3. Parameter & Nilai Kembalian

### Props
Komponen ini tidak menerima *props* eksternal.

### Output
Mengembalikan `null` (tidak ada visualisasi).

---

## 4. Penanganan Edge-Cases

1.  **Multiple Mount Prevention**:
    Karena diletakkan di dalam Root Layout, komponen ini dijamin hanya di-mount sekali sepanjang siklus hidup aplikasi (selama tab browser tidak direfresh penuh). Hal ini mencegah pembuatan listener ganda (`onAuthStateChange`) yang dapat memicu duplikasi query ke database.
