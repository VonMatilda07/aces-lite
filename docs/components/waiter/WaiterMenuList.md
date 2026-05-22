# WaiterMenuList Component Documentation

`WaiterMenuList` adalah komponen Client-side React yang bertindak sebagai dashboard utama pramusaji (*waiter command center*). Komponen ini menampilkan daftar menu secara internal dan menyediakan kendali 1-Tap Stock Engine untuk mengubah ketersediaan menu secara langsung ke database Supabase.

---

## 1. Tujuan Utama

- **Internal Stock Control**: Memberikan antarmuka intuitif bagi pramusaji untuk mengontrol status persediaan makanan dan minuman secara cepat.
- **1-Tap Action Interface**: Memfasilitasi pergantian status stok (`Tersedia`, `Menipis`, `Habis`) dalam satu ketukan tanpa harus membuka form edit yang rumit.
- **Smart Note Hook**: Menyediakan tombol instan (`+ Catat`) untuk memasukkan item menu ke dalam keranjang pesanan pramusaji.

---

## 2. Alur Logika (Why & How)

### A. Kontrol Status 1-Tap Stock Engine
*   **Why**: Di jam sibuk kafe, pramusaji atau barista harus segera memperbarui status menu yang habis agar pelanggan tidak memesannya. Proses ini harus secepat mungkin (sekali ketuk).
*   **How**:
    1. Komponen melakukan iterasi pada array `menus` yang diperoleh dari `useMenuStore()`.
    2. Setiap item menu memiliki tiga tombol aksi: **Tersedia (available)**, **Menipis (low_stock)**, dan **HABIS (sold_out)**.
    3. Ketika salah satu tombol ditekan, ia memanggil `updateMenuStatus(itemId, targetStatus)` dari Zustand store.
    4. Store memperbarui state secara optimistic di lokal, dan mengirim pembaruan ke Supabase di background.

### B. Styling Tombol Dinamis
*   **Why**: Pramusaji harus mengetahui secara sekilas status aktif dari masing-masing menu tanpa kebingungan visual.
*   **How**:
    Fungsi `getBtnStyle` mengevaluasi apakah tombol tersebut mewakili status menu yang sedang aktif saat ini:
    - Jika **tidak aktif**: Tombol diburamkan (`bg-slate-50 text-slate-400 border-slate-200`).
    - Jika **aktif**: Diberi warna tegas sesuai kategori status:
      - `available` -> Emerald (Hijau)
      - `low_stock` -> Amber (Kuning/Oranye)
      - `sold_out` -> Rose (Merah) dengan efek bayangan (`shadow-md`) untuk penegasan visual.

---

## 3. Parameter & Nilai Kembalian (Props & Output)

### Props
Komponen ini merupakan komponen mandiri (*self-contained*) dan tidak menerima *props* dari luar. Pengambilan data dan mutasi dilakukan langsung lewat hook `useMenuStore()`.

### Output (Rendered UI)
Komponen menghasilkan layout daftar kartu menu vertikal dengan padding bawah (`pb-32`) untuk memberikan ruang agar tidak tertutup oleh keranjang belanja mengambang (`WaiterCart`). Setiap kartu menu menampilkan:
- Nama menu & Kategori (sebagai Badge kecil).
- Harga menu terformat lokal Rupiah.
- Tombol `+ Catat` untuk fungsi keranjang.
- Baris tombol kontrol status: "Tersedia", "Menipis", dan "HABIS".

---

## 4. Penanganan Edge-Cases

1.  **Internet Putus Saat Mengubah Status**:
    Ketika tombol "HABIS" ditekan saat tidak ada koneksi, tombol akan sempat berubah warna menjadi merah (efek Optimistic Update). Namun setelah library Supabase melempar error koneksi di background, store akan memicu rollback ke status sebelumnya. Tombol secara otomatis akan melompat kembali ke warna asalnya (misal hijau "Tersedia"). Ini memberi sinyal visual kepada pramusaji bahwa perubahan tidak tersimpan karena kendala jaringan.
2.  **Perubahan Bersamaan oleh Pramusaji Lain**:
    Jika pramusaji A mengubah status suatu menu, pramusaji B akan langsung melihat perubahan status tersebut di layarnya sendiri secara real-time. Hal ini dikarenakan dashboard pramusaji juga berlangganan channel WebSocket realtime (`subscribeToRealtime`), yang secara dinamis memperbarui state `menus` lokal dan memicu render ulang tombol status yang sesuai.
