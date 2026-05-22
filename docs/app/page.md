# Customer page.tsx Documentation

`page.tsx` pada root `src/app/` mendefinisikan halaman utama untuk sisi pelanggan (`Customer QR View`). Halaman ini berfungsi sebagai kontainer utama yang menginisialisasi sinkronisasi menu cafe dan menampilkan komponen daftar menu.

---

## 1. Tujuan Utama

- **Customer QR Entry Point**: Halaman yang pertama kali diakses oleh pelanggan setelah memindai QR Code di meja mereka.
- **Data Lifecycle Management**: Bertanggung jawab melakukan penarikan data awal menu dan membuka subscription WebSocket saat halaman dimuat.
- **Branding Header**: Menyajikan header estetik yang menegaskan branding "coffeecomunitas".

---

## 2. Alur Logika (Why & How)

*   **Why**: Layar pelanggan harus langsung menampilkan data menu terbaru saat dibuka, dan terus mendengarkan perubahan stok (misal jika ada menu habis) agar data tidak usang.
*   **How**:
    1. Menggunakan React `useEffect` untuk memicu efek inisiasi halaman ketika komponen dimuat (*mount*).
    2. Memanggil `fetchMenus()` untuk mengambil snapshot menu terbaru dari Supabase.
    3. Memanggil `subscribeToRealtime()` untuk mengaktifkan sinkronisasi real-time via WebSocket.
    4. Mengembalikan fungsi pembersih (`return () => unsubscribe()`) untuk menutup koneksi WebSocket saat tab ditutup/berpindah guna menghindari kebocoran memori.

---

## 3. Komponen yang Digunakan

- **[MenuList](file:///c:/Work/cc/aplikasi/ACES/ACES-LITE-MAIN/aces-lite/src/components/customer/MenuList.tsx)**: Komponen internal yang merender visualisasi masing-masing kartu menu beserta status stok dan grade nutrisinya.
- **[useMenuStore](file:///c:/Work/cc/aplikasi/ACES/ACES-LITE-MAIN/aces-lite/src/store/useMenuStore.ts)**: Zustand store yang menyuplai fungsi penarikan data dan subscription.

---

## 4. Penanganan Edge-Cases

- **Cleanup on Unmount**:
  Jika pelanggan langsung menutup tab browser atau memindai kode QR lain, React lifecycle (`useEffect` cleanup) menjamin koneksi channel Supabase Realtime akan segera dibatalkan secara bersih.
