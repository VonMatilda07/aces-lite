# Utils.ts Documentation

`utils.ts` menyediakan helper utilitas umum untuk aplikasi ACES Lite. Saat ini, berkas ini mengekspor satu utilitas penting yaitu `cn` (Class Name merger).

---

## 1. Tujuan Utama

- **Conditional Class Merging**: Menyediakan cara yang aman, bersih, dan efisien untuk menggabungkan class Tailwind CSS secara kondisional di dalam komponen React.
- **Tailwind Conflict Resolution**: Mencegah duplikasi atau bentrokan class CSS (conflict style) yang sering terjadi di Tailwind ketika kelas yang bersaing diterapkan bersamaan pada satu elemen.

---

## 2. Alur Logika (Why & How)

- **Why**: 
  Secara bawaan, jika Anda menulis `<div className="px-2 px-4">`, class yang diterapkan bisa tidak terduga tergantung urutan kompilasi CSS Tailwind, bukan urutan penulisan class. Helper `cn` memecahkan masalah ini dengan menggabungkan input kondisional dan menimpa konflik class dengan benar.
- **How**:
  Fungsi `cn` menerima argumen berupa list class, lalu:
  1. Memanggil `clsx` untuk mengevaluasi objek/array/kondisi logika string class menjadi satu string gabungan yang bersih.
  2. Hasilnya dikirim ke `twMerge` (dari `tailwind-merge`) untuk mendeteksi dan menyelesaikan konflik penulisan kelas (misal, `px-2` vs `px-4` akan disatukan menjadi `px-4` karena ditulis belakangan).

```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 3. Parameter & Nilai Kembalian (Props & Output)

### `cn(...inputs: ClassValue[]): string`
- **Parameter**:
  - `inputs`: Argumen tak terbatas (rest parameter) bertipe `ClassValue` (dapat berupa string, array, objek boolean key-value).
- **Return Value**: `string` - Daftar class CSS yang sudah bersih dan bebas konflik.

---

## 4. Contoh Penggunaan

Mengatur style kondisional pada badge menu yang habis:

```typescript
import { cn } from '@/lib/utils'

const isSoldOut = true

return (
  <div className={cn(
    "p-4 border rounded-xl bg-white",
    isSoldOut && "opacity-50 grayscale border-slate-100"
  )}>
    ...
  </div>
)
```
