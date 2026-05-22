# MenuList Component Documentation

`MenuList` adalah komponen Client-side React yang berfungsi untuk menampilkan daftar menu kopi dan makanan ke pelanggan. Komponen ini menampilkan informasi harga, tingkat Nutri-Grade, status ketersediaan secara real-time, serta memberikan rekomendasi alternatif jika menu habis.

---

## 1. Tujuan Utama

- **Customer Facing Menu**: Menyajikan antarmuka visual daftar menu yang rapi, responsif, dan mudah dibaca oleh pelanggan melalui pemindaian QR Code di meja.
- **Real-time Status Visualization**: Menunjukkan status menu apakah masih tersedia, menipis (`low_stock`), atau habis (`sold_out`) secara instan berkat sinkronisasi dengan store global.
- **Nutri-Grade & Healthy Recommendation**: Membantu pelanggan mengidentifikasi tingkat kesehatan minuman/makanan dengan standar label Nutri-Grade (A-E) dan menyarankan opsi sehat alternatif jika menu utama sedang kosong.

---

## 2. Alur Logika (Why & How)

### A. Algoritma Dynamic Sorting (Pemisahan Menu Sold Out)
*   **Why**: Pelanggan akan merasa terganggu jika daftar menu diacak antara menu yang tersedia dan yang sudah habis. Menempatkan menu yang habis (`sold_out`) di bagian paling bawah halaman dengan visual yang redup (*grayscale* & *opacity*) menjaga fokus pelanggan pada menu yang masih bisa dipesan.
*   **How**:
    1. Menggunakan React `useMemo` yang bergantung pada state `menus` dari `useMenuStore`.
    2. Menyaring menu ke dalam dua array terpisah: `available` (status selain `'sold_out'`) dan `soldOut` (status `'sold_out'`).
    3. Menggabungkan kembali kedua array tersebut dengan urutan: `[...available, ...soldOut]`.
    4. Hal ini memastikan sorting berjalan efisien di sisi client tanpa memicu fetch ulang database.

```javascript
const sortedMenus = useMemo(() => {
    const available = menus.filter((m) => m.status !== 'sold_out')
    const soldOut = menus.filter((m) => m.status === 'sold_out')
    return [...available, ...soldOut]
}, [menus])
```

### B. Pemetaan Warna Nutri-Grade
*   **Why**: Visualisasi skor nutrisi membantu konsumen menentukan pilihan minuman yang lebih sehat secara cepat.
*   **How**:
    Fungsi helper `getGradeColor` memetakan tingkat grade ke kelas warna CSS/Tailwind yang serasi:
    - **Grade A & B** (Sangat Sehat/Sehat): `bg-emerald-600` / `bg-green-500`
    - **Grade C** (Sedang): `bg-yellow-500` dengan teks hitam
    - **Grade D & E** (Kandungan Gula Tinggi): `bg-orange-500` / `bg-red-600`
    - **Default**: `bg-slate-400`

---

## 3. Parameter & Nilai Kembalian (Props & Output)

### Props
Komponen ini merupakan komponen self-contained (tidak menerima *props* eksternal). Seluruh data disuplai langsung melalui React hook `useMenuStore()`.

### Output (Rendered UI)
- **Loading State**: Jika `isLoading` bernilai `true`, komponen merender animasi denyut (*pulse animation*) "Sinkronisasi menu coffeecomunitas...".
- **Menu Card**:
  - Menu Tersedia: Merender nama, badge Nutri-Grade, harga terformat (Rupiah), serta ikon daun hijau (`Leaf`) untuk kesan segar/organik.
  - Menu Low Stock: Menambahkan teks badge oranye kecil bertuliskan `"STOK MENIPIS"`.
  - Menu Sold Out: Merender card dengan opacity 50%, grayscale, harga dicoret, badge destructive `"HABIS"`, serta tombol interaktif `"Alternatif?"`.

---

## 4. Penanganan Edge-Cases

1.  **Menu Habis Tetapi Terlanjur Diklik**:
    Untuk menjaga alur pemesanan mandiri tetap terarah, ketika pelanggan mengeklik tombol `"Alternatif?"` pada menu yang habis, aplikasi akan menampilkan alert interaktif yang menyarankan pelanggan untuk memilih menu alternatif dengan Nutri-Grade serupa.
2.  **Perubahan Status Stok yang Tiba-Tiba**:
    Jika pramusaji mengubah status menu dari "Tersedia" menjadi "Habis", transisi visual pada Card Pelanggan diatur menggunakan CSS transition (`transition-all duration-500`). Komponen akan bergeser secara halus ke baris bawah karena urutan dynamic sorting langsung dipicu ulang oleh re-evaluasi `useMemo`.
