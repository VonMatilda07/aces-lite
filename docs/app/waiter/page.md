# Waiter page.tsx Documentation

`page.tsx` pada folder `src/app/waiter/` mendefinisikan halaman utama Dashboard Pramusaji (`Waiter Command Center`). Halaman ini berfungsi sebagai kontainer utama yang merakit antarmuka kontrol stok 1-Tap dan panel keranjang belanja pesanan.

---

## 1. Tujuan Utama

- **Internal Command Center**: Pusat kendali operasional kafe bagi pramusaji untuk memperbarui status menu dan mencatat pesanan pelanggan.
- **State Initialization**: Menarik data awal menu saat pramusaji pertama kali membuka dashboard.
- **Multi-Waiter Synchronization**: Mengaktifkan listener realtime agar perubahan stok yang dilakukan oleh pramusaji lain langsung tersinkronisasi di layarnya sendiri secara otomatis.

---

## 2. Alur Logika (Why & How)

*   **Why**: Jika pramusaji A mengubah status stok Kopi Susu menjadi "Habis", pramusaji B yang sedang melayani meja lain harus segera melihat perubahan status tersebut di layarnya tanpa perlu me-refresh aplikasi secara manual. Hal ini mencegah pramusaji B menawarkan menu yang sebenarnya sudah habis.
*   **How**:
    1. Menggunakan React `useEffect` untuk memicu pemuatan data saat halaman dirender pertama kali.
    2. Memanggil `fetchMenus()` untuk mengambil data ketersediaan menu saat ini dari Supabase.
    3. Memanggil `subscribeToRealtime()` untuk mendaftarkan channel WebSocket. Setiap pembaruan dari pramusaji lain akan langsung diterima dan memperbarui UI pramusaji ini.
    4. Mengembalikan fungsi `unsubscribe()` di pembersihan `useEffect` untuk memutuskan koneksi WebSocket secara bersih guna menjaga efisiensi memori.

---

## 3. Komponen yang Digunakan

- **[WaiterMenuList](file:///c:/Work/cc/aplikasi/ACES/ACES-LITE-MAIN/aces-lite/src/components/waiter/WaiterMenuList.tsx)**: Merender daftar menu secara internal beserta kontrol tombol status 1-Tap Stock Engine.
- **[WaiterCart](file:///c:/Work/cc/aplikasi/ACES/ACES-LITE-MAIN/aces-lite/src/components/waiter/WaiterCart.tsx)**: Merender panel keranjang belanja melayang dan mengelola transisi ke layar serah terima pesanan (Relay Mode).
- **[useMenuStore](file:///c:/Work/cc/aplikasi/ACES/ACES-LITE-MAIN/aces-lite/src/store/useMenuStore.ts)**: Store Zustand utama penyedia data menu dan state belanja.

---

## 4. Penanganan Edge-Cases

- **Realtime Listener Cleanup**:
  Jika pramusaji meninggalkan dashboard (misal beralih ke halaman pelanggan), event listener WebSocket dibersihkan seketika via callback `unsubscribe()`. Hal ini menjamin tidak ada koneksi bayangan (*ghost connection*) yang terus mengonsumsi kuota bandwidth WebSocket Supabase.
