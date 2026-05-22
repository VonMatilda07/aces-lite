# useMenuStore Documentation

`useMenuStore` adalah Zustand store utama yang mengelola seluruh state menu makanan/minuman dan sistem pencatatan pesanan (keranjang belanja) pada aplikasi ACES Lite. Store ini mengintegrasikan pembaruan UI secara optimistic untuk performa instan dan sinkronisasi real-time via Supabase WebSocket.

---

## 1. Tujuan Utama

- **Real-time Menu State**: Menyediakan single source of truth untuk daftar menu yang sinkron di semua layar (layar pelanggan dan dashboard pramusaji).
- **1-Tap Stock Engine**: Mengizinkan pramusaji memperbarui status ketersediaan menu secara instan tanpa hambatan loading network.
- **Smart Order Note (Cart)**: Mengelola state belanja pramusaji saat mencatat pesanan pelanggan dari meja ke meja.
- **Auto-stock Deduction**: Mengurangi jumlah porsi tersisa secara otomatis ketika pesanan difinalisasi oleh pramusaji.

---

## 2. Struktur State & Properti

| Nama State / Method | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `menus` | `Menu[]` | Array berisi daftar menu makanan/minuman yang aktif. |
| `isLoading` | `boolean` | Indikator loading saat memuat data pertama kali. |
| `cart` | `CartItem[]` | Item pesanan yang sedang dicatat oleh pramusaji. |
| `tableIdentifier` | `string` | Identitas meja atau nama pemesan saat ini. |
| `setTableIdentifier` | `(table: string) => void` | Mengubah identitas meja pemesan. |
| `fetchMenus` | `() => Promise<void>` | Memuat daftar menu awal dari database Supabase. |
| `updateMenuStatus` | `(id, newStatus, stock) => Promise<void>` | Mengubah status menu (Tersedia, Menipis, Habis) & kuantitas stok secara optimistic. |
| `subscribeToRealtime`| `() => () => void` | Mendaftarkan WebSocket listener untuk pembaruan realtime status & stok. |
| `addToCart` | `(menu: Menu) => void` | Menambahkan item menu ke dalam keranjang. |
| `removeFromCart` | `(menuId: string) => void` | Menghapus item menu tertentu dari keranjang. |
| `updateCartItemNotes`| `(menuId, notes) => void` | Menyimpan catatan kustom pada item tertentu. |
| `clearCart` | `() => void` | Mengosongkan keranjang belanja & reset identitas meja. |
| `finalizeOrder` | `() => Promise<void>` | Memproses pengurangan stok menu di keranjang belanja, memperbarui database Supabase, dan mengosongkan keranjang. |

### Detail Interface `Menu`
```typescript
export interface Menu {
    id: string
    name: string
    category: string
    price: number
    status: MenuStatus
    nutri_grade: NutriGrade
    stock?: number | null // Jumlah porsi tersisa jika status 'low_stock'
}
```

---

## 3. Alur Logika Utama (Why & How)

### A. 1-Tap Stock Engine (Optimistic UI Update)
*   **Why**: Di area kafe yang sibuk, pramusaji membutuhkan waktu respon instan saat menandai menu habis atau memperbarui jumlah sisa stok agar pelanggan tidak memesan item tersebut. Menunggu request database selesai (200ms - 2s) sebelum mengubah UI akan memperlambat alur kerja.
*   **How**: 
    1. Fungsi `updateMenuStatus` menyimpan salinan state menu saat ini (`previousMenus`).
    2. Menghitung penyesuaian status dan jumlah stok. Jika status diatur ke `'low_stock'`, default nilai stok adalah `3` jika tidak dispesifikasikan. Jika stok bernilai `<= 0`, status menu otomatis berubah menjadi `'sold_out'` dan kuantitasnya diset ke `0`. Jika status diatur ke `'available'`, stok diset ke `null`.
    3. Segera memperbarui state lokal `menus` di memori (<10ms) agar tombol status di layar langsung berubah warna dan memperlihatkan jumlah stok baru.
    4. Mengirimkan perintah `UPDATE` ke database Supabase secara asinkron di background.
    5. Jika request Supabase sukses, data tetap bertahan. Jika gagal (misal koneksi terputus), state dikembalikan (*rollback*) ke data semula menggunakan `previousMenus`.

```mermaid
sequenceDiagram
    participant UI as Waiter UI
    participant Store as Zustand Store
    participant DB as Supabase DB

    UI->>Store: Click "Menipis / Mengurangi Stok" (updateMenuStatus)
    Note over Store: Simpan previousMenus (backup)
    Store->>UI: Update state lokal instan (stok / status berubah)
    Store->>DB: Send UPDATE query (background)
    alt Update Sukses
        DB-->>Store: 200 OK
        Note over Store: Transaksi Berhasil
    else Update Gagal / Timeout
        DB-->>Store: Error / Connection Timeout
        Store->>UI: Rollback state ke previousMenus
        Note over UI: Tombol & stok kembali ke warna/nilai semula
    end
```

### B. Sinkronisasi Real-time (Supabase WebSocket Channel)
*   **Why**: Saat pramusaji mengubah status menu atau memperbarui sisa stok di bar/dapur, layar menu di HP pelanggan dan dashboard pramusaji lain harus langsung memperbarui tampilannya tanpa perlu me-refresh halaman web secara manual.
*   **How**:
    1. Menggunakan fitur `supabase.channel` untuk mendengarkan event `UPDATE` pada tabel `menus`.
    2. Ketika ada perubahan data menu dari user mana pun, Supabase mengirimkan payload data terbaru melalui koneksi WebSocket.
    3. Fungsi callback menerima payload ini (`updatedMenu`) dan langsung memperbarui array `menus` lokal (termasuk properti `status` dan `stock`) di store.

### C. Pengurangan Stok Otomatis (Finalize Order)
*   **Why**: Ketika pesanan diselesaikan (serah terima sukses), sistem harus otomatis mendepresiasi stok menu tersisa yang dipesan agar visualisasi sisa porsi tetap akurat tanpa perlu dikurangi manual oleh kru dapur.
*   **How**:
    1. Fungsi `finalizeOrder` dipanggil saat pramusaji menekan tombol "Selesai & Kurangkan Stok".
    2. Menyimpan salinan state saat ini (`previousMenus`).
    3. Mengiterasi menu yang ada di `cart` dan mengurangi properti `stock` lokal jika menu tersebut memiliki batasan stok (tidak `null` / `undefined`). Jika stok hasil pengurangan bernilai `0`, status menu akan diubah secara otomatis ke `'sold_out'`.
    4. Mengosongkan keranjang belanja (`cart` dan `tableIdentifier`).
    5. Mengirimkan perintah `UPDATE` ke database Supabase secara paralel/sekuensial untuk setiap item menu yang mengalami pengurangan stok. Jika terjadi kesalahan jaringan/database pada salah satu pembaruan, status stok lokal akan dikembalikan (*rollback*).

---

## 4. Parameter & Nilai Kembalian (Return Value)

### `updateMenuStatus(id: string, newStatus: MenuStatus, stock?: number | null): Promise<void>`
- **Parameter**:
  - `id`: ID unik menu yang ingin diubah.
  - `newStatus`: Nilai baru berupa `'available' | 'low_stock' | 'sold_out'`.
  - `stock`: (Opsional) Jumlah sisa stok yang akan disematkan ke menu.
- **Return Value**: `Promise<void>`.

### `subscribeToRealtime(): () => void`
- **Parameter**: Tidak ada.
- **Return Value**: Fungsi pembersih (`() => void`) untuk memutuskan koneksi WebSocket channel (`supabase.removeChannel`). Sangat penting dipanggil di bagian pembersihan `useEffect` untuk menghindari memory leak.

### `finalizeOrder(): Promise<void>`
- **Parameter**: Tidak ada.
- **Return Value**: `Promise<void>`.

---

## 5. Penanganan Edge-Cases

1.  **Kegagalan Koneksi Internet**:
    Jika pramusaji mengubah status menu atau menyelesaikan pesanan saat internet putus, state lokal akan langsung terupdate (Optimistic), namun dalam hitungan detik client Supabase akan melempar error. Store akan menangkap error tersebut dan mengembalikan status menu ke kondisi semula (*rollback*), sehingga pramusaji tahu bahwa perubahan tersebut gagal disimpan ke server.
2.  **Duplikasi Event Real-time**:
    WebSocket callback hanya menargetkan update untuk ID yang berubah saja (`m.id === updatedMenu.id`), meminimalkan rendering ulang pada komponen yang tidak terpengaruh.
3.  **Catatan Pesanan Kosong**:
    Jika item ditambahkan ke keranjang, store secara cerdas mendeteksi apakah item tersebut sudah ada. Jika ada, `qty` bertambah secara kumulatif daripada membuat entri baru, mencegah kekacauan data.
