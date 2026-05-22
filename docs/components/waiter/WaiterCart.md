# WaiterCart Component Documentation

`WaiterCart` adalah komponen Client-side React yang mengelola visualisasi keranjang pesanan pramusaji saat berkeliling mencatat pesanan pelanggan. Komponen ini memiliki fitur penyaringan stasiun saji otomatis (split station), mode serah terima pesanan (*Relay Mode*) untuk diserahkan ke kasir atau barista/koki, pengurangan stok otomatis, dan kontrol navigasi kembali tanpa menghapus keranjang.

---

## 1. Tujuan Utama

- **Order Collection**: Mengumpulkan menu-menu yang dipesan pelanggan beserta catatan khususnya (seperti "less sugar" atau "tidak pedas").
- **Visual Station Splitting**: Memisahkan secara otomatis item minuman (stasiun Bar) dan makanan (stasiun Kitchen) agar pramusaji mudah membacakannya ke stasiun saji yang bersangkutan.
- **Relay Mode**: Menyediakan tampilan kontras/gelap layar penuh agar pramusaji dapat membacakan pesanan dengan jelas ke kasir/dapur tanpa distorsi tombol UI lain.
- **Stock Finalization**: Menghubungkan tombol penyelesaian order dengan fungsi pengurangan stok porsi otomatis di Supabase.
- **Flexible Navigation**: Memberikan tombol navigasi kembali pada panel keranjang belanja dan dashboard Relay pesanan agar data pemesanan tidak terhapus secara tidak sengaja.

---

## 2. Alur Logika (Why & How)

### A. Auto-Splitting Serve Station
*   **Why**: Di kafe yang sibuk, dapur (makanan) dan bar (minuman) bekerja secara terpisah. Jika pramusaji membacakan pesanan dalam satu daftar acak, kemungkinan salah saji atau keterlambatan pembuatan pesanan sangat tinggi. Pemisahan otomatis sangat memperlancar proses kerja.
*   **How**:
    Komponen menggunakan hook React `useMemo` untuk memfilter array `cart` berdasarkan kategori menu:
    - **Bar Station**: Memfilter menu dengan kategori `'Coffee'` dan `'Non-Coffee'`.
    - **Kitchen Station**: Memfilter menu dengan kategori `'Food'` dan `'Snack'`.
    Proses ini diregenerasi secara otomatis hanya ketika data `cart` berubah.

```typescript
const barItems = useMemo(() => cart.filter(item => ['Coffee', 'Non-Coffee'].includes(item.menu.category)), [cart])
const kitchenItems = useMemo(() => cart.filter(item => ['Food', 'Snack'].includes(item.menu.category)), [cart])
```

### B. Transisi Mode & Kontrol Navigasi (Cart vs Relay Mode)
*   **Why**: Saat mencatat, pramusaji butuh visual melayang di bawah layar agar tetap bisa melihat daftar menu. Namun saat melakukan serah terima pesanan ke kasir/bar, pramusaji memerlukan fokus tinggi pada data pesanan yang sudah difinalisasi. Selain itu, pramusaji memerlukan cara kembali untuk mengoreksi pesanan jika terjadi kesalahan saat pembacaan pesanan tanpa harus membuat ulang seluruh keranjang.
*   **How**:
    Komponen mengandalkan local state `isRelayMode` dan `isOpen` (`boolean`):
    - **Mode Cart (Default)**: Merender panel melayang (`fixed bottom-0`). Dapat di-expand (membuka input identitas meja & catatan kustom) atau ditutup kembali dengan mengubah state `isOpen`.
      - Tombol **"← Kembali ke Menu"** disediakan di dalam panel untuk memudahkan pramusaji menyembunyikan panel keranjang (`setIsOpen(false)`).
    - **Mode Relay (Full-Screen)**: Jika tombol "Kompilasi Pesanan" ditekan, `isRelayMode` menjadi `true`. Komponen langsung merender kontainer layar penuh berwarna gelap (`fixed inset-0 bg-slate-900`) yang menampilkan pembagian stasiun saji Bar dan Kitchen secara rapi dan besar.
      - Tombol **"Kembali & Edit Pesanan"** disediakan di bagian bawah panel Relay untuk kembali ke mode edit keranjang (`setIsRelayMode(false)`) tanpa mengosongkan data belanja yang telah dicatat.
      - Tombol **"Selesai & Kurangkan Stok"** memicu pemanggilan `finalizeOrder()` yang mengurangkan stok menu di Supabase dan me-reset keranjang.

---

## 3. Parameter & Nilai Kembalian (Props & Output)

### Props
Komponen ini bersifat mandiri (*self-contained*), mengambil state pesanan, identitas meja, dan fungsi manipulasi keranjang secara langsung dari `useMenuStore()`.

### Output (Rendered UI)
1.  **Cart Panel (Floating)**:
    - Menampilkan ringkasan total item dan kalkulasi total harga terformat Rupiah.
    - Tombol "← Kembali ke Menu" untuk menyembunyikan panel.
    - Input teks untuk menyimpan "Nama Pemesan / Nomor Meja".
    - Input teks catatan kustom di setiap baris item menu.
    - Tombol "Kompilasi Pesanan" (dinonaktifkan jika identitas meja masih kosong).
2.  **Relay Dashboard (Full-Screen)**:
    - Menampilkan identitas pemesan dengan teks besar.
    - Menampilkan panel khusus stasiun "BAR" (jika ada item minuman).
    - Menampilkan panel khusus stasiun "KITCHEN" (jika ada item makanan).
    - Tombol besar **"Selesai & Kurangkan Stok"** untuk mendepresiasi stok di Supabase, mengosongkan keranjang belanja, dan bersiap untuk pesanan berikutnya.
    - Tombol **"Kembali & Edit Pesanan"** untuk menutup panel Relay dan mengedit keranjang belanja kembali.

---

## 4. Penanganan Edge-Cases

1.  **Validasi Identitas Pemesan**:
    Pramusaji tidak diizinkan menekan tombol `"Kompilasi Pesanan"` sebelum mengisi nama pelanggan atau nomor meja (`tableIdentifier`). Tombol akan dinonaktifkan (`disabled`) dan warnanya berubah abu-abu untuk mencegah pesanan masuk tanpa identitas yang jelas.
2.  **Pengurangan Stok yang Aman (Finalize Order)**:
    Saat pesanan berhasil dibacakan ke kasir/bar dan pramusaji mengetuk `"Selesai & Kurangkan Stok"`, fungsi `finalizeOrder()` dijalankan. Ini melakukan optimistic update pengurangan stok menu lokal dan mengirim transaksi penyesuaian ke Supabase. Jika transaksi gagal, rollback dipicu secara otomatis.
3.  **Kehilangan Input Catatan**:
    Catatan pesanan disimpan langsung ke store via `updateCartItemNotes` pada event `onChange`. Hal ini memastikan input pramusaji tidak hilang meskipun panel keranjang ditutup-buka (*collapsed/expanded*) berulang kali atau pramusaji bolak-balik dari layar Relay Mode.
