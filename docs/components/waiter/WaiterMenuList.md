# WaiterMenuList Component Documentation

`WaiterMenuList` adalah komponen Client-side React yang bertindak sebagai dashboard utama pramusaji (*waiter command center*). Komponen ini menampilkan daftar menu secara internal dan menyediakan kendali 1-Tap Stock Engine untuk mengubah ketersediaan menu secara langsung ke database Supabase, serta kontrol kuantitas porsi interaktif untuk kondisi stok menipis.

---

## 1. Tujuan Utama

- **Internal Stock Control**: Memberikan antarmuka intuitif bagi pramusaji untuk mengontrol status persediaan makanan dan minuman secara cepat.
- **1-Tap Action Interface**: Memfasilitasi pergantian status stok (`Tersedia`, `Menipis`, `Habis`) dalam satu ketukan tanpa harus membuka form edit yang rumit.
- **Interactive Low Stock Editor**: Menyediakan kontrol kuantitas bertahap (`+` / `-`) ketika status menu diatur ke "Menipis" (`low_stock`), mempermudah staf dapur/bar mengumumkan jumlah sisa porsi riil secara fleksibel.
- **Smart Note Hook**: Menyediakan tombol instan (`+ Catat`) untuk memasukkan item menu ke dalam keranjang pesanan pramusaji.
- **Category Filter Tabs**: Memudahkan pramusaji melakukan lompatan cepat ke jenis menu tertentu (Coffee, Non-Coffee, Food, Snack) saat kafe sedang sangat padat (*hectic*), meminimalkan waktu melakukan scroll panjang.

---

## 2. Alur Logika (Why & How)

### A. Kontrol Status 1-Tap Stock Engine & Kuantitas Porsi
*   **Why**: Di jam sibuk kafe, pramusaji atau barista harus segera memperbarui status menu yang habis atau tersisa sedikit agar pelanggan tidak memesannya. Proses ini harus secepat mungkin (sekali ketuk) dengan fleksibilitas menambahkan/mengurangi jumlah kuantitas stok.
*   **How**:
    1. Komponen melakukan iterasi pada array `menus` yang diperoleh dari `useMenuStore()`.
    2. Setiap item menu memiliki tiga tombol aksi utama: **Tersedia (available)**, **Menipis (low_stock)**, dan **HABIS (sold_out)**.
    3. Mengetuk tombol "Menipis" memanggil `updateMenuStatus(id, 'low_stock')` yang secara default menginisialisasi stok ke angka `3` jika sebelumnya kosong.
    4. Jika status menu aktif adalah `'low_stock'`, panel kontrol kuantitas stok di bawah baris status akan dirender secara dinamis.
    5. Menekan tombol `[-]` memanggil `updateMenuStatus(id, 'low_stock', currentStock - 1)`. Jika angka stok terkurangi hingga mencapai `0` (atau kurang), store secara otomatis mengubah status menu tersebut menjadi `'sold_out'` (HABIS) dan nilai stok disinkronisasi ke `0`.
    6. Menekan tombol `[+]` memanggil `updateMenuStatus(id, 'low_stock', currentStock + 1)`.
    7. Perubahan stok dikirim secara optimistic ke state lokal dan disinkronkan ke Supabase.

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
- Tombol navigasi horizontal untuk penyaringan kategori (`Semua`, `Coffee`, `Non-Coffee`, `Food`, `Snack`).
- Nama menu & Kategori (sebagai Badge kecil).
- Harga menu terformat lokal Rupiah.
- Tombol `+ Catat` untuk fungsi keranjang.
- Baris tombol kontrol status: "Tersedia", "Menipis", dan "HABIS".
- Panel mini "Sisa Porsi (Stok)" dengan tombol `+` dan `-` (hanya tampil jika menu berstatus `'low_stock'`).

---

## 4. Penanganan Edge-Cases

1.  **Internet Putus Saat Mengubah Status / Mengurangi Stok**:
    Ketika tombol ditekan saat internet mati, UI lokal akan memperlihatkan angka stok/status baru secara optimistic. Namun setelah library Supabase melempar error koneksi di background, store akan memicu rollback ke status/stok sebelumnya. Angka dan warna tombol secara otomatis kembali ke nilai asalnya, memberi tahu pramusaji bahwa data gagal disimpan di server.
2.  **Perubahan Bersamaan oleh Pramusaji Lain**:
    Jika pramusaji A mengubah stok/status suatu menu, pramusaji B akan langsung melihat perubahan tersebut di layarnya sendiri secara real-time. Hal ini dikarenakan dashboard pramusaji juga berlangganan channel WebSocket realtime (`subscribeToRealtime`), yang secara dinamis memperbarui state `menus` lokal dan memicu render ulang status dan stok yang sesuai.
