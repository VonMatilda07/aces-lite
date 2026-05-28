# Page (Login) Documentation

`page.tsx` pada folder `src/app/login/` menyediakan halaman antarmuka masuk (Login Screen) bagi staf kafe (pramusaji, barista, koki) sebelum diizinkan mengakses dashboard Command Center `/waiter`.

---

## 1. Tujuan Utama

- **Staff Authentication Entry**: Tempat memasukkan kredensial email dan sandi staf secara aman.
- **Session Handshake**: Menghubungkan client browser dengan Supabase Authentication Engine.
- **Role Verification Gateway**: Mencegah akun non-staf masuk ke area internal dan langsung mengarahkan pengguna ke halaman yang tepat berdasarkan keberhasilan login.

---

## 2. Alur Logika (Why & How)

*   **Why**: Halaman Command Center `/waiter` berisi kontrol ketersediaan stok yang sensitif. Untuk itu, sistem mewajibkan login staf terlebih dahulu.
*   **How**:
    1. Menggunakan state lokal (`email`, `password`) untuk menangkap input pengguna pada form.
    2. Event `onSubmit` memicu fungsi asinkron `handleLogin`.
    3. Memanggil API Supabase Auth `supabase.auth.signInWithPassword({ email, password })`.
    4. Jika Supabase mengembalikan objek `error`, pesan error disimpan ke state `errorMsg` dan ditampilkan sebagai badge peringatan merah di UI.
    5. Jika proses masuk berhasil, browser Next.js diarahkan (`router.push('/waiter')`) ke rute Command Center pramusaji. Proxy otorisasi server-side akan otomatis meloloskan akses tersebut karena session cookie telah terekam di request header browser.

---

## 3. Komponen & Store yang Digunakan

- **[useAuthStore](file:///c:/Work/cc/aplikasi/ACES/ACES-LITE-MAIN/aces-lite/src/store/useAuthStore.ts)**: Digunakan secara tidak langsung melalui update session cookie di background oleh SDK Supabase.
- **Tailwind & Hero Style**: Menggunakan latar belakang gelap premium (`bg-slate-900`), tombol animasi transisi scale, dan input bergaya neon modern.

---

## 4. Penanganan Edge-Cases

1.  **Kredensial Salah (Invalid Credentials)**:
    Jika sandi/email salah, form tidak akan melakukan redirect. State `isLoading` di-reset kembali ke `false` agar staf bisa mencoba memasukkan data kembali, dan pesan error dari Supabase (misal: "Invalid login credentials") dipaparkan secara detail.
2.  **Double Submission Prevention**:
    Saat request ke database sedang berlangsung, tombol masuk dinonaktifkan (`disabled={isLoading}`) dan tulisan tombol berubah menjadi `"Menghubungkan..."` untuk mencegah staf menekan tombol berkali-kali yang dapat mengirim request ganda ke server.
