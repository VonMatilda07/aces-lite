# MenuList Component Documentation

`MenuList` adalah komponen Client-side React yang berfungsi untuk menampilkan daftar menu kopi dan makanan ke pelanggan. Komponen ini menampilkan informasi harga, tingkat Nutri-Grade, status ketersediaan secara real-time (termasuk jumlah porsi tersisa saat stok menipis), serta memberikan rekomendasi alternatif jika menu habis.

---

## 1. Tujuan Utama

- **Customer Facing Menu**: Menyajikan antarmuka visual daftar menu yang rapi, responsif, dan mudah dibaca oleh pelanggan melalui pemindaian QR Code di meja.
- **Real-time Status & Stock Visualization**: Menunjukkan status menu apakah masih tersedia, menipis (`low_stock`), atau habis (`sold_out`) secara instan, lengkap dengan sisa kuantitas porsi/gelas yang dinamis berdasarkan update dari tim barista/dapur atau transaksi selesai.
- **Nutri-Grade & Healthy Recommendation**: Membantu pelanggan mengidentifikasi tingkat kesehatan minuman/makanan dengan standar label Nutri-Grade (A-E) dan menyarankan opsi sehat alternatif jika menu utama sedang kosong.
- **Category Filter Tabs**: Menyediakan tombol navigasi horizontal di bagian atas halaman pelanggan untuk menyaring jenis menu (Semua, Coffee, Non-Coffee, Food, Snack) secara dinamis.
- **Hero Section Menu Unggulan**: Menampilkan menu rekomendasi hari ini (`is_featured: true`) dengan tampilan visual premium bertema gelap dan gradasi warna yang menarik di bagian paling atas halaman.

---

## 2. Alur Logika (Why & How)

### A. Algoritma Dynamic Sorting & Filtering (Penyaringan Kategori & Pemisahan Menu Sold Out)
*   **Why**: Pelanggan akan merasa terganggu jika daftar menu diacak antara menu yang tersedia dan yang sudah habis. Menempatkan menu yang habis (`sold_out`) di bagian paling bawah halaman dengan visual yang redup (*grayscale* & *opacity*) menjaga fokus pelanggan pada menu yang masih bisa dipesan. Selain itu, tab kategori yang dinamis mempercepat pelanggan menemukan kategori yang dicari.
*   **How**:
    1. Menggunakan React `useMemo` yang bergantung pada state `menus` dari `useMenuStore` dan state `selectedCategory` lokal.
    2. Menyaring menu berdasarkan kategori terpilih (misal: "Coffee"). Menu unggulan yang sedang ditampilkan di Hero Section juga disaring agar tidak terjadi duplikasi visual di daftar bawah.
    3. Memisahkan hasil saringan ke dalam dua array: `available` (status selain `'sold_out'`) dan `soldOut` (status `'sold_out'`).
    4. Menggabungkan kembali kedua array tersebut dengan urutan: `[...available, ...soldOut]`.

```javascript
const filteredAndSortedMenus = useMemo(() => {
    let list = menus
    if (featuredMenu) {
        list = list.filter((m) => m.id !== featuredMenu.id)
    }
    if (selectedCategory !== 'Semua') {
        list = list.filter((m) => m.category === selectedCategory)
    }
    const available = list.filter((m) => m.status !== 'sold_out')
    const soldOut = list.filter((m) => m.status === 'sold_out')
    return [...available, ...soldOut]
}, [menus, selectedCategory, featuredMenu])
```

### B. Algoritma Rekomendasi Unggulan (Hero Section)
*   **Why**: Jika tidak ada menu bertanda `is_featured === true` yang aktif, sistem harus tetap mempromosikan menu terbaik secara dinamis untuk mendongkrak penjualan produk berkualitas tinggi.
*   **How**:
    1. Komponen mengevaluasi properti `is_featured` pada daftar menu.
    2. Jika menu bertanda `is_featured` ditemukan dan berstatus bukan `sold_out`, item tersebut dijadikan menu unggulan.
    3. Jika tidak ada, sistem akan mencari menu alternatif pertama yang memiliki Nutri-Grade 'A' atau 'B' (menyehatkan) dan berstatus bukan `sold_out` untuk direkomendasikan secara dinamis.

---

## 3. Parameter & Nilai Kembalian (Props & Output)

### Props
Komponen ini merupakan komponen self-contained (tidak menerima *props* eksternal). Seluruh data disuplai langsung melalui React hook `useMenuStore()`.

### Output (Rendered UI)
- **Loading State**: Jika `isLoading` bernilai `true`, komponen merender animasi denyut (*pulse animation*) "Sinkronisasi menu coffeecomunitas...".
- **Hero Section (Menu Unggulan)**: Menampilkan kartu gradasi warna modern dengan teks `"Rekomendasi Hari Ini"`, nama menu, Nutri-Grade, harga, dan sisa porsi. Hanya tampil pada kategori filter `"Semua"`.
- **Category Nav Bar**: Horizontal-scroll button list untuk memilih kategori menu (`Semua`, `Coffee`, `Non-Coffee`, `Food`, `Snack`).
- **Menu Card**:
  - Menu Tersedia: Merender nama, badge Nutri-Grade, harga terformat (Rupiah), serta ikon daun hijau (`Leaf`) untuk kesan segar/organik.
  - Menu Low Stock: Menambahkan teks badge oranye kecil bertuliskan `"Sisa {stock} Porsi"` (jika properti `stock` terdefinisi).
  - Menu Sold Out: Merender card dengan opacity 50%, grayscale, harga dicoret, badge destructive `"HABIS"`, serta tombol interaktif `"Alternatif?"`.

---

## 4. Penanganan Edge-Cases

1.  **Menu Habis Tetapi Terlanjur Diklik**:
    Ketika pelanggan mengeklik tombol `"Alternatif?"` pada menu yang habis, aplikasi akan menampilkan alert interaktif yang menyarankan pelanggan untuk memilih menu alternatif dengan Nutri-Grade serupa.
2.  **Perubahan Status & Sisa Stok yang Tiba-Tiba**:
    Jika pramusaji mengubah status menu dari "Tersedia" menjadi "Habis", atau mengubah kuantitas sisa stok, transisi visual pada Card Pelanggan diatur menggunakan CSS transition (`transition-all duration-500`). Komponen akan memperbarui jumlah sisa porsi secara realtime atau bergeser secara halus ke baris bawah karena urutan dynamic sorting langsung dipicu ulang oleh re-evaluasi `useMemo` saat data state dari WebSocket diterima.
