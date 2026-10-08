# Loka Accounting Admin

Portal tersedia di `/admin` pada aplikasi ini. Untuk domain admin tersendiri, buat proyek Vercel baru dari repository yang sama, lalu set `VITE_APP_MODE=admin`. Seluruh URL proyek tersebut akan membuka portal admin.

## Vercel

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment `VITE_APP_MODE`: `admin` (hanya proyek admin terpisah)
- Environment `VITE_ACCOUNTING_API_BASE_URL`: URL HTTPS accounting service, berakhir dengan `/api/v1/accounting`

Konfigurasi rewrite SPA sudah tersedia di `vercel.json`. Jalankan deploy ulang setelah mengganti environment. Rujukan: https://vercel.com/docs/frameworks/frontend/vite dan https://vercel.com/docs/environment-variables/managing-environment-variables.

## Backend (loka-accounting-service)

API admin ditambahkan di `internal/platform/admin`, terdaftar dari `cmd/api/main.go`. Backend tetap dijalankan pada server Go/PostgreSQL, sedangkan frontend di Vercel.

1. Jalankan migrasi backend dengan `go run ./cmd/migrate`, termasuk `000026_admin_subscription_audit.sql`.
2. Set environment pada accounting service:
   - `ACCOUNTING_ADMIN_USERNAME`: username admin.
   - `ACCOUNTING_ADMIN_PASSWORD_HASH`: hash bcrypt password admin (bukan password polos).
   - `ACCOUNTING_ADMIN_JWT_SECRET`: secret acak minimal 32 karakter, terpisah dari JWT pelanggan.
   - `ACCOUNTING_ALLOWED_ORIGINS`: daftar origin frontend dipisahkan koma; sertakan domain Vercel admin dan domain accounting pelanggan.
3. Build dan restart accounting service.

API admin akan mengembalikan 503 sampai konfigurasi admin lengkap. Credential admin hanya ditempatkan pada backend; jangan gunakan prefix `VITE_` untuk credential. Sesi admin berlaku 8 jam dan disimpan di sessionStorage browser. Token pelanggan ditolak oleh API admin.

## Perilaku

- Daftar organisasi dengan pencarian nama organisasi, pemilik, email, atau ID; filter status dan pagination server (15 per halaman).
- Ringkasan global total, aktif, trial, dan kedaluwarsa.
- Trial mengikuti accounting service: 30 hari sejak organisasi dibuat jika belum memiliki subscription.
- Aktivasi/perpanjangan: 1–3650 hari. Langganan aktif diperpanjang dari tanggal akhir; lainnya dimulai hari ini.
- Nonaktifkan langganan dengan konfirmasi dalam modal dan alasan wajib.
- Semua perubahan disimpan bersama audit dalam satu transaksi. Aktivasi manual tidak mengubah order pembayaran menjadi PAID.
- Riwayat menampilkan maksimal 100 order terbaru per organisasi.

## Validasi

Frontend: `npm run build`, `npm run lint`, `npm test`.
Backend: `go test ./...`, termasuk login admin, token pelanggan, token salah audience, sesi kedaluwarsa, akses anonim, serta admin tanpa konfigurasi.
