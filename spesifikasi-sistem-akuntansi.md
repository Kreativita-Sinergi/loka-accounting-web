p# SPESIFIKASI SISTEM AKUNTANSI & BISNIS TERINTEGRASI

**Nama kode proyek:** `ledger` (ganti sesuai keinginan)
**Frontend:** Next.js (App Router) + TypeScript
**Backend:** Go
**Database:** PostgreSQL
**Model:** Multi-tenant, multi-cabang, multi-gudang
**Referensi UX:** Accurate Online

---

# 00. CARA MEMBACA DOKUMEN INI

Dokumen ini ditujukan untuk **AI coding agent** dan developer manusia.

**Konvensi penandaan:**

| Tanda | Arti |
|-------|------|
| `[PASTI]` | Terverifikasi dari observasi langsung Accurate Online. Bangun persis seperti ini. |
| `[ASUMSI]` | Disusun dari prinsip akuntansi standar, belum diverifikasi ke Accurate. Boleh dibangun, tapi konfirmasi ke pemilik produk jika ada keraguan. |
| `[KEPUTUSAN]` | Keputusan arsitektur yang sudah diambil. Jangan diubah tanpa persetujuan. |
| `[TANYA]` | Belum diputuskan. Tanyakan ke pemilik produk sebelum implementasi. |

**Urutan baca untuk AI agent:**
1. Bagian 01–02 (aturan main & stack) — wajib
2. Bagian 03–05 (UI) — sebelum menyentuh frontend
3. Bagian 06–07 (data & akuntansi) — sebelum menyentuh backend
4. Bagian 08–09 (API & permission) — sebelum membuat endpoint
5. Bagian 10 (modul) — saat mengerjakan modul tertentu
6. Bagian 11 (roadmap) — untuk menentukan urutan kerja

**Aturan mutlak untuk agent:**
- Jangan pernah pakai tipe `float`/`float64` untuk uang atau kuantitas. Selalu decimal presisi tetap.
- Jangan membuat jurnal langsung dari controller/handler. Selalu lewat domain service.
- Setiap transaksi yang menghasilkan jurnal harus dalam satu database transaction.
- Jangan hardcode nomor akun. Semua akun diambil dari mapping (Bagian 07.2).

---

# 01. ATURAN MAIN PRODUK

## 1.1 Kalimat inti
Satu transaksi bisnis yang diinput pengguna secara otomatis menghasilkan: jurnal akuntansi, mutasi stok, mutasi piutang/utang, dan catatan pajak — tanpa input ulang.

## 1.2 Yang dibangun
10 modul: Pengaturan, Perusahaan, Buku Besar, Kas & Bank, Penjualan, Pembelian, Persediaan, Aset Tetap, Pajak, Laporan.

## 1.3 Yang TIDAK dibangun di v1
- Payroll lengkap (PPh 21 progresif, BPJS) — hanya pencatatan gaji sederhana
- POS/kasir
- Aplikasi mobile native
- Manufaktur multi-level dengan routing & work center
- Integrasi marketplace (siapkan interface-nya saja)

## 1.4 Bahasa
UI berbahasa Indonesia. Kode, nama tabel, nama variabel, dan komentar berbahasa Inggris.

Contoh: tabel `sales_invoice`, label UI "Faktur Penjualan".

---

# 02. STACK & STRUKTUR REPOSITORI

## 2.1 Teknologi `[KEPUTUSAN]`

| Lapisan | Pilihan | Alasan |
|---------|---------|--------|
| Frontend | Next.js 15 (App Router), TypeScript | SSR untuk halaman berat, routing file-based |
| State | TanStack Query (server state) + Zustand (UI state) | Cache & invalidasi otomatis |
| Data grid | TanStack Table + virtualizer | Grid editable & virtual scroll wajib |
| Form | React Hook Form + Zod | Validasi tipe-aman, sinkron dengan skema backend |
| Styling | Tailwind CSS + CSS variables | Token terpusat |
| Komponen | shadcn/ui sebagai basis, dikustomisasi berat | Bukan look default |
| Backend | Go 1.23+ | Performa untuk costing & laporan |
| HTTP | `chi` atau `echo` | Ringan, middleware jelas |
| Database | PostgreSQL 16+ | ACID, NUMERIC, CTE rekursif, partisi |
| Akses DB | `sqlc` (query → Go type-safe) + `pgx` | Hindari ORM ajaib untuk domain kompleks |
| Migrasi | `goose` atau `atlas` | Versioned migration |
| Decimal | `shopspring/decimal` | **Wajib** untuk semua uang & qty |
| Auth | JWT access token + refresh token | Stateless, mudah di-scale |
| Object storage | S3-compatible (MinIO untuk dev) | Lampiran & gambar |
| Job queue | `asynq` (Redis) | Proses akhir bulan, laporan besar, email |
| Cache | Redis | Sesi, rate limit, cache laporan |

## 2.2 Struktur repositori

```
ledger/
├── apps/
│   ├── web/                    # Next.js
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   └── (app)/
│   │   │       ├── layout.tsx          # AppShell: rail + tabbar
│   │   │       ├── dashboard/
│   │   │       ├── settings/
│   │   │       ├── general-ledger/
│   │   │       ├── cash-bank/
│   │   │       ├── sales/
│   │   │       ├── purchase/
│   │   │       ├── inventory/
│   │   │       ├── fixed-asset/
│   │   │       ├── tax/
│   │   │       └── reports/
│   │   ├── components/
│   │   │   ├── shell/          # IconRail, MenuFlyout, TabBar, TopBar
│   │   │   ├── data/           # DataGrid, ListToolbar, FilterChips
│   │   │   ├── form/           # FormShell, HeaderFields, DetailGrid, TotalsBar, ActionRail
│   │   │   └── ui/             # primitif (shadcn dikustom)
│   │   ├── lib/
│   │   │   ├── api/            # client + tipe hasil generate dari OpenAPI
│   │   │   ├── permission/     # hook cek hak akses
│   │   │   └── format/         # angka, tanggal, mata uang (locale ID)
│   │   └── stores/             # tabStore, prefStore
│   │
│   └── api/                    # Go
│       ├── cmd/
│       │   ├── server/main.go
│       │   ├── worker/main.go
│       │   └── migrate/main.go
│       ├── internal/
│       │   ├── domain/         # LOGIKA BISNIS MURNI, tanpa dependensi framework
│       │   │   ├── accounting/ # journal, posting, period
│       │   │   ├── inventory/  # costing (FIFO & average), movement
│       │   │   ├── sales/
│       │   │   ├── purchase/
│       │   │   ├── fixedasset/
│       │   │   ├── tax/
│       │   │   └── shared/     # Money, Quantity, value objects
│       │   ├── app/            # use case / orchestration
│       │   ├── adapter/
│       │   │   ├── http/       # handler, router, middleware
│       │   │   ├── repo/       # implementasi repository (sqlc)
│       │   │   ├── storage/    # S3
│       │   │   └── external/   # bank, DJP, e-commerce
│       │   ├── platform/       # db, cache, queue, logger, config
│       │   └── migrations/
│       └── openapi.yaml        # sumber kebenaran kontrak API
│
└── packages/
    └── shared-types/           # tipe TS hasil generate dari openapi.yaml
```

## 2.3 Aturan arsitektur backend `[KEPUTUSAN]`

1. **`internal/domain` tidak boleh mengimpor apa pun dari `adapter` atau `platform`.** Domain adalah Go murni + decimal.
2. **Setiap operasi yang menghasilkan jurnal berjalan dalam satu `pgx.Tx`.** Jika jurnal gagal, dokumen ikut rollback.
3. **Posting bersifat idempoten.** Posting ulang dokumen yang sama tidak menggandakan jurnal — hapus jurnal lama berdasarkan `(source_type, source_id)` lalu buat ulang.
4. **Costing persediaan dijalankan dengan advisory lock per `(item_id, warehouse_id)`** untuk mencegah race condition.

---

# 03. UI SHELL — SPESIFIKASI DETAIL

Ini adalah bagian paling khas dari produk. Bangun persis. `[PASTI]`

## 3.1 Anatomi layar

```
┌──────────────────────────────────────────────────────────────────────┐
│ ▓▓▓ TOP BAR (tinggi 56px, background gradient gelap) ▓▓▓             │
│ [Logo]        [ikon aksi] [cari] [bantuan] [notif]  Nama PT   [avatar]│
├──────────────────────────────────────────────────────────────────────┤
│ [Dashboard] [Faktur Penjualan ✕] [Barang & Jasa ✕] [Preferensi ✕][7▾]│ ← TAB BAR (40px)
├────┬─────────────────────────────────────────────────────────────────┤
│ ⚙  │                                                                  │
│ 🏢 │                                                                  │
│ 📖 │                                                                  │
│ 🏦 │              AREA KONTEN TAB AKTIF                               │
│ 🏷 │                                                                  │
│ 🛒 │                                                                  │
│ 📦 │                                                                  │
│ 🏗 │                                                                  │
│ 🧾 │                                                                  │
│ 📊 │                                                                  │
└────┴─────────────────────────────────────────────────────────────────┘
 ↑ ICON RAIL (lebar 64px, background biru tua solid)
```

## 3.2 Icon Rail (navigasi utama)

**Spesifikasi:**
- Lebar tetap **64px**, tinggi penuh viewport dikurangi top bar
- Background: biru tua solid (`--rail-bg`)
- Berisi **10 ikon** vertikal, satu per modul, urutan tetap:

| # | Ikon | Modul | Route dasar |
|---|------|-------|-------------|
| 1 | gear | Pengaturan | `/settings` |
| 2 | building | Perusahaan | `/company` |
| 3 | book | Buku Besar | `/general-ledger` |
| 4 | bank | Kas & Bank | `/cash-bank` |
| 5 | tag-rupiah | Penjualan | `/sales` |
| 6 | cart | Pembelian | `/purchase` |
| 7 | boxes | Persediaan | `/inventory` |
| 8 | factory | Aset Tetap | `/fixed-asset` |
| 9 | receipt-tax | Pajak | `/tax` |
| 10 | chart | Laporan | `/reports` |

**Perilaku:**
- Hover → tooltip nama modul di kanan ikon
- Klik → buka **Menu Flyout** (§3.3). Klik lagi pada ikon yang sama → tutup
- Ikon modul aktif diberi highlight (background lebih terang + indikator kiri 3px)
- Tidak ada label teks di rail — hanya ikon

## 3.3 Menu Flyout (panel submenu)

Muncul saat ikon rail diklik. **Bukan dropdown, bukan sidebar geser** — panel melayang di atas konten.

**Spesifikasi:**
- Posisi: menempel di kanan icon rail, vertikal disejajarkan dengan ikon yang diklik (dengan penyesuaian agar tidak keluar viewport)
- Background putih, `border-radius: 8px`, `box-shadow` kuat
- Padding 24px
- Header: nama modul (font besar, 24px, weight 400) + garis bawah tipis berwarna aksen (merah/pink)
- Isi: **grid ubin (tiles)**

**Spesifikasi ubin:**
- Ukuran ±100×100px
- Isi: ikon ilustratif (48px) di atas, label teks (12–13px, tengah, boleh 2 baris) di bawah
- `border-radius: 8px`, border tipis
- **Diberi warna berdasarkan kelompok fungsi:**

| Warna latar | Arti | Contoh |
|-------------|------|--------|
| Hijau muda | Transaksi (menghasilkan jurnal) | Faktur Penjualan, Pembayaran |
| Biru muda | Master data | Pelanggan, Gudang, Akun Perkiraan |
| Oranye muda | Pengaturan/konfigurasi | Penomoran, Harga Pemasok, Komisi |
| Ungu muda | Laporan & riwayat | Log Aktivitas, Histori Bank, Barang per Gudang |

- Jumlah kolom grid menyesuaikan jumlah item (3–6 kolom)
- Klik ubin → buka tab baru (§3.4), flyout tertutup
- Tekan `Esc` atau klik di luar → flyout tertutup

**Data menu** disimpan sebagai konstanta di `apps/web/lib/menu.ts`, difilter berdasarkan hak akses pengguna dan fitur yang aktif di Preferensi.

```ts
type MenuTile = {
  key: string;              // "sales.invoice"
  label: string;            // "Faktur Penjualan"
  icon: string;             // nama ikon
  route: string;            // "/sales/invoice"
  group: 'transaction' | 'master' | 'setting' | 'report';
  requiresFeature?: string; // "multiBranch" | "tax" | ...
  permission: string;       // "sales.invoice.view"
};
```

## 3.4 Tab Bar (dokumen terbuka)

Ciri khas paling penting. Pengguna dapat membuka banyak halaman sekaligus dan berpindah tanpa kehilangan state.

**Spesifikasi:**
- Tinggi 40px, tepat di bawah top bar, membentang penuh
- Setiap tab: label + tombol ✕
- Tab aktif: background aksen (merah/pink) + teks putih
- Tab tidak aktif: background abu terang + teks gelap
- **Tab "Dashboard" selalu ada dan tidak dapat ditutup**
- Di kanan: indikator jumlah tab + dropdown (`7 ▾`) untuk melompat ke tab yang tertutup karena overflow
- Batas maksimum tab: **15** `[ASUMSI]`. Melebihi itu, tab terlama yang tidak dimodifikasi ditutup otomatis

**Perilaku state:**
- Setiap tab menyimpan state-nya sendiri: posisi scroll, isi form, filter yang dipilih
- Berpindah tab **tidak** me-remount komponen — gunakan pola "keep-alive": render semua tab, sembunyikan yang tidak aktif dengan `display: none`
- Menutup tab yang formnya belum disimpan → dialog konfirmasi
- URL mengikuti tab aktif (`router.push` tanpa reload) agar bisa di-refresh dan di-share

**Implementasi state (Zustand):**

```ts
type Tab = {
  id: string;               // uuid
  key: string;              // "sales.invoice"
  label: string;            // "Faktur Penjualan"
  route: string;
  params?: Record<string, string>;  // { id: "123" } untuk mode edit
  dirty: boolean;           // ada perubahan belum disimpan
  closable: boolean;
};

type TabStore = {
  tabs: Tab[];
  activeId: string;
  open(tile: MenuTile, params?): void;   // jika tab dengan key+params sama sudah ada, aktifkan saja
  close(id: string): void;
  setActive(id: string): void;
  setDirty(id: string, dirty: boolean): void;
  rename(id: string, label: string): void;  // "Data Baru" → "FJ-2026-0012"
};
```

## 3.5 Sub-tab di dalam tab

Konten sebuah tab dapat memiliki lapisan tab kedua. Ada **dua pola**:

### Pola A — Sub-tab horizontal
Dipakai pada: form master (Barang & Jasa, Akun Perkiraan), halaman Preferensi.

```
┌─────────────────────────────────────────────┐
│ [☰] [Data Baru ✕]                           │ ← tab dokumen (level 3)
├─────────────────────────────────────────────┤
│ Umum | Penjualan/Pembelian | Stok | Akun |… │ ← sub-tab horizontal
├─────────────────────────────────────────────┤
│  isi tab                                    │
└─────────────────────────────────────────────┘
```

Catatan: tombol `☰` hijau di kiri kembali ke tampilan daftar. Tab "Data Baru" adalah dokumen yang sedang dibuka.

Untuk Preferensi, ada **navigasi dua sumbu**: daftar seksi vertikal di kiri (Perusahaan, Fitur, Pajak, …) + sub-tab horizontal di kanan.

### Pola B — Ikon tab vertikal
Dipakai pada: form transaksi (Faktur Penjualan, Pesanan Pembelian).

```
┌──┬──────────────────────────────────────────┐
│📄│  Rincian Barang (grid)                   │
│ℹ │                                          │
│💰│                                          │
│🧾│                                          │
└──┴──────────────────────────────────────────┘
```

Deretan ikon kecil di sisi kiri area konten. Setiap ikon = satu panel.

## 3.6 Aturan buka tab

| Aksi | Hasil |
|------|-------|
| Klik ubin menu | Buka tab baru (daftar/list) |
| Klik baris di daftar | Buka tab baru berlabel nomor dokumen |
| Klik `+` di daftar | Buka tab baru berlabel "Data Baru" |
| Klik dokumen terkait (mis. dari Faktur → SO asal) | Buka tab baru |
| Tab dengan `key` + `params` identik sudah ada | Aktifkan tab itu, jangan duplikat |

---

# 04. POLA HALAMAN

Hanya ada **tiga pola halaman**. Semua modul memakai ulang ketiganya.

## 4.1 Pola LIST (halaman daftar)

```
┌──────────────────────────────────────────────────────────────┐
│ [☰]                                                     [💡] │
├──────────────────────────────────────────────────────────────┤
│ Merek: Semua▾  Jenis: Semua▾  Kategori: Semua▾  Aktif: ▾ [⛛]│ ← FilterChips
├──────────────────────────────────────────────────────────────┤
│ [+] [⟳]              [⬇][⬆][🖨][⚙]  [cari...........] [57]  │ ← Toolbar
├──────────────────────────────────────────────────────────────┤
│ Nama Barang       │ Kode  │ Jenis     │ Satuan │ Kts │ Stok  │ ← Header (sortable)
│ Ban Bridgestone…  │100048 │Persediaan │ PCS    │ 630 │  630  │
│ Ban Michelin…     │100049 │Persediaan │ PCS    │ 600 │  600  │
├──────────────────────────────────────────────────────────────┤
│ ◀ 1 2 3 … ▶                                    50 / halaman  │
└──────────────────────────────────────────────────────────────┘
```

**Komponen toolbar:**

| Ikon | Fungsi |
|------|--------|
| `+` (biru) | Buat data baru → tab baru |
| `⟳` | Muat ulang |
| `⬇` | Impor dari Excel |
| `⬆` | Ekspor (Excel / CSV / PDF) |
| `🖨` | Cetak daftar |
| `⚙` | Pengaturan kolom (pilih & urutkan kolom, simpan preset) |
| kotak cari | Cari, aktif dengan Enter |
| angka | Jumlah total baris hasil filter |

**Wajib:**
- Paginasi **server-side** (jangan pernah kirim semua baris)
- Sorting server-side
- Filter chip disimpan per pengguna per halaman
- Baris diklik → buka tab detail
- Klik kanan baris → menu konteks (Ubah, Duplikat, Hapus, Lihat Jurnal)

## 4.2 Pola FORM MASTER

```
┌──────────────────────────────────────────────────────────────┐
│ [☰] [Data Baru ✕]                                       [💡] │
├──────────────────────────────────────────────────────────────┤
│ Umum │ Penjualan/Pembelian │ Stok │ Akun │ Gambar │ Lain-lain│
├──────────────────────────────────────────────────────┬───────┤
│ Informasi Barang & Jasa      Informasi Lainnya       │  [💾] │
│                                                       │       │
│ Nama Barang *  [_______________]   Merek [________]  │       │
│ Kategori    *  [Umum ✕      🔍]   ○ No. Seri        │       │
│ Jenis Barang   [Persediaan   ▾]                      │       │
│ Kode Barang *  [◉][Barang & Jasa ▾]                  │       │
│ UPC/Barcode    [_______________]                      │       │
│ Satuan      *  [Cari/Pilih…  🔍]                     │       │
└──────────────────────────────────────────────────────┴───────┘
```

**Aturan:**
- Dua kolom di desktop, satu kolom di bawah 1024px
- Field wajib ditandai `*` merah
- Tombol Simpan di rail kanan, selalu terlihat (sticky)
- Lookup field: input dengan ikon 🔍, membuka pencarian; nilai terpilih tampil sebagai chip dengan tombol ✕
- Toggle: untuk pilihan biner yang mengubah perilaku field lain (mis. Kode Barang otomatis vs manual)

## 4.3 Pola FORM TRANSAKSI

Pola paling kompleks. Semua dokumen transaksi memakai kerangka ini.

```
┌───────────────────────────────────────────────────────────────┬──────┐
│ [☰] [Data Baru ✕]                                    [⚙] [💡] │      │
├───────────────────────────────────────────────────────────────┤      │
│ Pelanggan * [Cari/Pilih Pelanggan…  🔍]  No Faktur * [◉][FJ ▾]│ [💾▾]│
│ Tanggal   * [22/08/2026 📅]              [Ambil ▾][Proses ▾]  │      │
├──┬────────────────────────────────────────────────────────────┤ [📄▾]│
│📄│ [Cari/Pilih Barang & Jasa…    🔍]      🔍  Rincian Barang *│      │
│ℹ │┌──────────────────────────────────────────────────────────┐│ [📎▾]│
│💰││ Nama Barang │Kode│Kuantitas│Satuan│@Harga│Diskon│  Total ││      │
│🧾││ ...                                                       ││ [⋯▾] │
│  │└──────────────────────────────────────────────────────────┘│      │
│  │                                                             │      │
├──┴──────────────────────────────┬──────────┬─────────────────┤      │
│                     Sub Total  0│Diskon [%]│ Total         0 │      │
└─────────────────────────────────┴──────────┴─────────────────┴──────┘
```

**Bagian header** (selalu terlihat):
- Field mitra (Pelanggan/Pemasok) — wajib
- Tanggal — wajib, default hari ini
- Nomor dokumen — wajib, toggle otomatis/manual + pilih template penomoran
- **Tombol `Ambil ▾`** — tarik data dari dokumen hulu (contoh: Faktur mengambil dari Pesanan Penjualan atau Pengiriman)
- **Tombol `Proses ▾`** — lanjutkan ke dokumen hilir (contoh: dari SO buat Pengiriman)

**Panel kiri (ikon tab vertikal):** `[ASUMSI]` untuk isi persisnya

| Ikon | Panel | Isi |
|------|-------|-----|
| 📄 | Rincian Barang | Grid baris item |
| ℹ | Info | Syarat Pembayaran, Jatuh Tempo, Sales, Cabang, Departemen, Proyek, No. PO Pelanggan, FOB, Jasa Pengiriman, Alamat Kirim, Catatan |
| 💰 | Uang Muka / Pembayaran | Alokasi DP, uang muka terpakai |
| 🧾 | Pajak | Data faktur pajak, nomor seri, DPP, PPN, PPh |

**Grid rincian:**

Kolom dasar: `Nama Barang | Kode # | Kuantitas | Satuan | @Harga | Diskon | Total Harga`

Kolom opsional (dapat diaktifkan lewat ⚙): `Gudang | Departemen | Proyek | Kode Pajak | No. Seri/Batch | Keterangan` + hingga 27 kolom atribut tambahan.

Perilaku grid:
- Input barang di kotak pencarian atas → baris baru ditambahkan
- Navigasi keyboard: `Tab` pindah sel, `Enter` baris baru, `Ctrl+D` duplikat baris
- Baris dapat diurutkan ulang (drag handle ☰ di kiri)
- Kalkulasi langsung: `Total Harga = Kuantitas × @Harga × (1 − Diskon%)`
- Virtual scroll jika baris > 100

**Footer total:**
`Sub Total` → `Diskon (%/nominal)` → `Biaya Kirim` → `DPP` → `PPN` → `Pembulatan` → **`Total`**

**Rail aksi kanan:**

| Tombol | Fungsi |
|--------|--------|
| 💾 ▾ | Simpan / Simpan & Baru / Simpan & Cetak |
| 📄 ▾ | Cetak / Pratinjau / Kirim Email |
| 📎 ▾ | Lampiran (unggah, daftar, hapus) |
| ⋯ ▾ | Duplikat, Batalkan, **Lihat Jurnal**, Riwayat Perubahan, Dokumen Terkait |

**"Lihat Jurnal" wajib ada.** Menampilkan jurnal yang dihasilkan dokumen ini. Ini fitur kepercayaan — akuntan akan mengeceknya.

---

# 05. DESIGN TOKEN

```css
:root {
  /* Warna struktural */
  --rail-bg:          #1B3A5C;   /* biru tua icon rail */
  --rail-fg:          #C5D4E3;
  --rail-active:      #2D5580;
  --topbar-bg:        linear-gradient(90deg, #14304D 0%, #1B3A5C 100%);

  /* Aksen — dipakai untuk tab aktif, garis bawah judul, field wajib */
  --accent:           #E8175D;
  --accent-fg:        #FFFFFF;
  --accent-soft:      #FDE7EE;

  /* Permukaan */
  --bg:               #F0F2F5;
  --surface:          #FFFFFF;
  --surface-alt:      #F7F8FA;   /* baris grid selang-seling */
  --border:           #D8DEE6;
  --border-strong:    #A9B4C2;

  /* Teks */
  --fg:               #1A1F26;
  --fg-muted:         #5B6673;
  --fg-subtle:        #8A939F;

  /* Warna kelompok ubin menu */
  --tile-transaction: #E3F5E8;   /* hijau — transaksi */
  --tile-master:      #E1EFFB;   /* biru  — master data */
  --tile-setting:     #FDEDE0;   /* oranye — pengaturan */
  --tile-report:      #F0E9FA;   /* ungu  — laporan/riwayat */

  /* Status */
  --success:          #1B8A4B;
  --warning:          #C77700;
  --danger:           #C62828;
  --info:             #1565C0;

  /* Status dokumen */
  --status-draft:     #8A939F;
  --status-pending:   #C77700;
  --status-approved:  #1B8A4B;
  --status-rejected:  #C62828;
  --status-void:      #5B6673;

  /* Bentuk & jarak */
  --radius-sm:        4px;
  --radius:           6px;
  --radius-lg:        8px;
  --rail-w:           64px;
  --topbar-h:         56px;
  --tabbar-h:         40px;
  --row-h:            36px;      /* tinggi baris grid — padat, bukan lapang */
}
```

**Tipografi:**

| Peran | Font | Ukuran | Catatan |
|-------|------|--------|---------|
| Antarmuka | Inter / system-ui | 13px | Padat. Ini aplikasi kerja, bukan halaman pemasaran |
| Judul flyout & panel | Inter, weight 400 | 24px | Ringan, bukan bold |
| Angka & mata uang | **font tabular** (`font-variant-numeric: tabular-nums`) | 13px | **Wajib** agar kolom angka rata |
| Kode & nomor dokumen | JetBrains Mono / ui-monospace | 12px | |

**Format angka Indonesia `[PASTI]`:**
- Desimal: `9.999,99` (titik ribuan, koma desimal)
- Tanggal: `22/08/2026` untuk input, `22 Agu 2026` untuk tampilan
- Mata uang: `Rp 1.250.000` (tanpa desimal jika bulat)
- Opsi format ini dapat diubah di Preferensi → Lain-lain

**Kepadatan:** Aplikasi ini dipakai 8 jam sehari untuk input data. **Utamakan kepadatan, bukan keluasan.** Tinggi baris 36px, padding sel 8px. Jangan pakai spasi longgar gaya halaman pemasaran.

---

# 06. MODEL DATA

Semua tabel memiliki kolom standar berikut kecuali dinyatakan lain:

```sql
id            BIGSERIAL PRIMARY KEY,
company_id    BIGINT NOT NULL REFERENCES company(id),   -- tenant
created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
created_by    BIGINT REFERENCES app_user(id),
updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_by    BIGINT REFERENCES app_user(id),
deleted_at    TIMESTAMPTZ                                -- soft delete
```

Tipe uang: `NUMERIC(20,4)`. Tipe kuantitas: `NUMERIC(20,6)`. Tipe persen: `NUMERIC(9,6)`.

## 6.1 Fondasi

```sql
company (
  code, name, business_category, business_field,
  phone, fax, email,
  data_start_date DATE NOT NULL,          -- Tgl Mulai Data
  fiscal_year_start_month SMALLINT,       -- 1 = Januari
  base_currency_id BIGINT,
  -- pajak
  tax_name, npwp, nitku, klu, business_type,
  pkp_date DATE, pkp_number,
  -- fitur (dari Preferensi → Fitur)
  feature_multi_branch      BOOL DEFAULT false,
  feature_multi_currency    BOOL DEFAULT false,
  feature_tax               BOOL DEFAULT true,
  feature_approval          BOOL DEFAULT false,
  feature_fixed_asset       BOOL DEFAULT true,
  feature_budget            BOOL DEFAULT false,
  feature_department        BOOL DEFAULT false,
  feature_project           BOOL DEFAULT false,
  feature_financial_category BOOL DEFAULT false,
  feature_employee_loan     BOOL DEFAULT false,
  -- TERKUNCI setelah transaksi pertama
  inventory_costing_method  TEXT CHECK (IN ('AVERAGE','FIFO')),
  costing_method_locked_at  TIMESTAMPTZ
)

branch (code, name, address, is_head_office BOOL, interbranch_account_id)
warehouse (code, name, branch_id, address, is_default BOOL)
department (code, name, parent_id)
project (code, name, start_date, end_date, budget_amount)
financial_category (code, name)

currency (code, name, symbol, is_base BOOL)
exchange_rate (currency_id, rate_date, rate NUMERIC(20,8))
  UNIQUE (company_id, currency_id, rate_date)

fiscal_period (
  year SMALLINT, month SMALLINT,
  start_date DATE, end_date DATE,
  status TEXT CHECK (IN ('OPEN','SOFT_CLOSED','CLOSED')),
  closed_at, closed_by, reopen_reason
)
  UNIQUE (company_id, year, month)

app_user (
  email UNIQUE, password_hash, name,
  access_group_id, default_branch_id,
  is_active, two_factor_secret, last_login_at
)

access_group (name, note)

access_right (
  access_group_id, permission_key TEXT,   -- "sales.invoice"
  can_access BOOL, can_create BOOL, can_edit BOOL,
  can_delete BOOL, can_view BOOL
)
  UNIQUE (access_group_id, permission_key)

access_group_branch (access_group_id, branch_id)     -- batasan cabang
access_group_warehouse (access_group_id, warehouse_id)

document_numbering (
  doc_type TEXT,          -- "SALES_INVOICE"
  name TEXT,              -- "Faktur Penjualan"
  prefix TEXT,            -- "FJ-"
  date_format TEXT,       -- "YYYYMM" | "YY" | ""
  separator TEXT,
  counter_length SMALLINT,
  next_number BIGINT,
  reset_period TEXT CHECK (IN ('NEVER','MONTHLY','YEARLY')),
  allow_manual BOOL,
  is_default BOOL,
  branch_id BIGINT         -- NULL = berlaku semua cabang
)

audit_log (
  user_id, ip INET, occurred_at,
  entity_type TEXT, entity_id BIGINT,
  action TEXT,            -- CREATE|UPDATE|DELETE|POST|UNPOST|APPROVE|REJECT|VOID
  before JSONB, after JSONB, note
)
  -- TIDAK BOLEH ADA operasi DELETE pada tabel ini
  -- Partisi per bulan berdasarkan occurred_at

attachment (
  entity_type, entity_id,
  file_name, file_size, mime_type, storage_key,
  uploaded_by, uploaded_at
)

app_preference (
  -- satu baris per company; simpan sebagai kolom eksplisit, bukan JSONB,
  -- agar validasi & migrasi jelas
  -- Penjualan
  sales_auto_close_so BOOL,
  sales_return_value_basis TEXT CHECK (IN ('LAST_PURCHASE_COST','INVOICE_COGS')),
  sales_return_not_returned_to TEXT CHECK (IN ('COGS_ACCOUNT','OTHER_ACCOUNT')),
  sales_return_not_returned_account_id BIGINT,
  sales_return_recalc_cost_on_resave BOOL,
  sales_new_customer_taxable BOOL,
  -- Pembelian
  purchase_auto_close_po BOOL,
  purchase_receipt_cost_update TEXT
    CHECK (IN ('BY_BILL','NOT_BY_BILL','SAME_PERIOD_ONLY')),
  purchase_unbilled_variance_account_id BIGINT,
  purchase_asset_account_id BIGINT,
  purchase_other_supplier_variance_account_id BIGINT,
  purchase_bill_journal_date TEXT CHECK (IN ('BILL_DATE','RECEIPT_DATE')),
  purchase_payment_order_clearing_account_id BIGINT,
  -- Format
  decimal_format TEXT, decimal_option TEXT, date_display TEXT,
  ar_aging_days INT, ar_aging_basis TEXT CHECK (IN ('INVOICE_DATE','DUE_DATE')),
  inventory_aging_days INT,
  commission_basis TEXT,
  -- Pembatasan
  operator_access_restriction TEXT,
  ...
)

default_account (
  key TEXT,               -- "ITEM_INVENTORY", "AR", "VAT_OUT", ...
  account_id BIGINT
)
  UNIQUE (company_id, key)

approval_setting (doc_type TEXT, is_required BOOL, min_amount NUMERIC)
approval_approver (doc_type, level SMALLINT, access_group_id, max_amount)
attachment_setting (doc_type TEXT, is_required BOOL)

custom_field_def (
  scope TEXT,             -- LINE_DETAIL | ITEM | CUSTOMER | SUPPLIER
  data_type TEXT CHECK (IN ('CHAR','NUMBER','DATE')),
  slot SMALLINT,          -- CHAR 1..15, NUMBER 1..10, DATE 1..2
  label TEXT,
  options JSONB,          -- untuk CHAR: daftar pilihan dropdown
  is_active BOOL
)
```

## 6.2 Akun & Jurnal

```sql
account (
  account_type TEXT NOT NULL,   -- lihat tabel tipe akun di bawah
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id BIGINT REFERENCES account(id),
  currency_id BIGINT,           -- untuk kas/bank valas
  opening_balance NUMERIC(20,4) DEFAULT 0,
  opening_date DATE,
  note TEXT,
  is_system BOOL DEFAULT false, -- tidak dapat dihapus
  is_active BOOL DEFAULT true,
  restrict_users BOOL DEFAULT false
)
  UNIQUE (company_id, code)

account_user_access (account_id, user_id)

journal_entry (
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL,
  source_type TEXT NOT NULL,    -- SALES_INVOICE | PAYMENT | MANUAL | DEPRECIATION | ...
  source_id BIGINT,             -- NULL untuk jurnal manual
  branch_id BIGINT,
  description TEXT,
  is_reversal BOOL DEFAULT false,
  reversed_entry_id BIGINT,
  posted_at TIMESTAMPTZ, posted_by BIGINT
)
  UNIQUE (company_id, source_type, source_id)  -- kunci idempotensi
  -- Partisi per tahun berdasarkan entry_date

journal_line (
  journal_entry_id BIGINT NOT NULL,
  line_no SMALLINT NOT NULL,
  account_id BIGINT NOT NULL,
  debit  NUMERIC(20,4) NOT NULL DEFAULT 0,
  credit NUMERIC(20,4) NOT NULL DEFAULT 0,
  currency_id BIGINT,
  fx_rate NUMERIC(20,8) DEFAULT 1,
  debit_fc  NUMERIC(20,4) DEFAULT 0,
  credit_fc NUMERIC(20,4) DEFAULT 0,
  branch_id BIGINT,
  department_id BIGINT,
  project_id BIGINT,
  financial_category_id BIGINT,
  partner_type TEXT,            -- CUSTOMER | SUPPLIER | EMPLOYEE
  partner_id BIGINT,
  memo TEXT,
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))
)
  INDEX (account_id, journal_entry_id)
  INDEX (partner_type, partner_id)

-- Tabel agregat untuk performa laporan.
-- Diperbarui via trigger atau job; jangan hitung ulang dari journal_line setiap kali.
account_balance (
  account_id, branch_id, year, month,
  opening_debit, opening_credit,
  period_debit, period_credit,
  closing_debit, closing_credit
)
  UNIQUE (company_id, account_id, branch_id, year, month)
```

**Tipe akun (enum `account_type`):**

| Nilai | Golongan | Saldo normal | Laporan |
|-------|----------|--------------|---------|
| `CASH_BANK` | Aset | D | Neraca |
| `ACCOUNT_RECEIVABLE` | Aset | D | Neraca |
| `INVENTORY` | Aset | D | Neraca |
| `OTHER_CURRENT_ASSET` | Aset | D | Neraca |
| `FIXED_ASSET` | Aset | D | Neraca |
| `ACCUMULATED_DEPRECIATION` | Aset | K | Neraca (kontra) |
| `OTHER_ASSET` | Aset | D | Neraca |
| `ACCOUNT_PAYABLE` | Kewajiban | K | Neraca |
| `CREDIT_CARD` | Kewajiban | K | Neraca |
| `OTHER_CURRENT_LIABILITY` | Kewajiban | K | Neraca |
| `LONG_TERM_LIABILITY` | Kewajiban | K | Neraca |
| `EQUITY` | Ekuitas | K | Neraca |
| `RETAINED_EARNING` | Ekuitas | K | Neraca (sistem) |
| `REVENUE` | Pendapatan | K | Laba Rugi |
| `OTHER_REVENUE` | Pendapatan | K | Laba Rugi |
| `COGS` | Beban | D | Laba Rugi |
| `EXPENSE` | Beban | D | Laba Rugi |
| `OTHER_EXPENSE` | Beban | D | Laba Rugi |

**Akun sistem yang dibuat otomatis saat setup:**
Laba Ditahan, Laba Tahun Berjalan, Selisih Kurs, Penyesuaian Persediaan, Pembulatan, Kas Penampungan.

## 6.3 Barang & Jasa

```sql
item (
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  item_type TEXT CHECK (IN ('INVENTORY','SERVICE','NON_INVENTORY','GROUP')),
  category_id BIGINT NOT NULL,
  brand_id BIGINT,
  upc_barcode TEXT,
  base_unit_id BIGINT NOT NULL,
  track_serial_batch BOOL DEFAULT false,
  is_active BOOL DEFAULT true,

  -- Penjualan
  default_discount_pct NUMERIC(9,6),
  min_sell_qty NUMERIC(20,6),
  use_wholesale_pricing BOOL DEFAULT false,
  substitute_item_id BIGINT,

  -- Pembelian
  main_supplier_id BIGINT,
  purchase_unit_id BIGINT,
  last_purchase_price NUMERIC(20,4),
  min_buy_qty NUMERIC(20,6),
  min_stock_level NUMERIC(20,6),

  -- Pajak
  tax_ref_code TEXT,
  vat_code_id BIGINT,
  wht_code_id BIGINT,

  -- Override akun (NULL = pakai default global)
  inventory_account_id BIGINT,
  sales_account_id BIGINT,
  sales_return_account_id BIGINT,
  sales_discount_account_id BIGINT,
  goods_delivered_account_id BIGINT,
  cogs_account_id BIGINT,
  purchase_return_account_id BIGINT,
  unbilled_purchase_account_id BIGINT,

  -- Lain
  note TEXT,
  length_cm NUMERIC, width_cm NUMERIC, height_cm NUMERIC, weight_gr NUMERIC,
  custom_char_1..15 TEXT,
  custom_number_1..10 NUMERIC,
  custom_date_1..2 DATE
)
  UNIQUE (company_id, code)

item_category (code, name, parent_id,
               inventory_account_id, sales_account_id, cogs_account_id)
item_brand (code, name)
unit (code, name)

item_unit (
  item_id, unit_id,
  conversion_to_base NUMERIC(20,6) NOT NULL,   -- PCS=1, LUSIN=12, BOX=144
  is_base BOOL
)

item_price (
  item_id, unit_id,
  price_level SMALLINT,          -- 1..n
  customer_category_id BIGINT,   -- NULL = berlaku umum
  price NUMERIC(20,4),
  effective_from DATE
)

item_wholesale_price (
  item_id, unit_id,
  min_qty NUMERIC(20,6),
  price NUMERIC(20,4),
  discount_pct NUMERIC(9,6)
)

item_stock (
  item_id, warehouse_id,
  qty_on_hand NUMERIC(20,6) DEFAULT 0,
  qty_reserved NUMERIC(20,6) DEFAULT 0,   -- teralokasi SO
  qty_incoming NUMERIC(20,6) DEFAULT 0,   -- dalam PO
  avg_cost NUMERIC(20,4) DEFAULT 0,
  total_value NUMERIC(20,4) DEFAULT 0
)
  UNIQUE (company_id, item_id, warehouse_id)
  -- qty_available (dihitung) = qty_on_hand - qty_reserved

inventory_layer (             -- untuk FIFO & penelusuran biaya
  item_id, warehouse_id,
  layer_date DATE,
  source_type TEXT, source_id BIGINT,
  qty_in NUMERIC(20,6),
  qty_remaining NUMERIC(20,6),
  unit_cost NUMERIC(20,4),
  serial_batch_no TEXT
)
  INDEX (item_id, warehouse_id, layer_date, id) WHERE qty_remaining > 0

inventory_movement (          -- buku besar persediaan, append-only
  item_id, warehouse_id,
  movement_date DATE,
  source_type TEXT, source_id BIGINT, source_line_id BIGINT,
  qty_in NUMERIC(20,6), qty_out NUMERIC(20,6),
  unit_cost NUMERIC(20,4), total_cost NUMERIC(20,4),
  balance_qty NUMERIC(20,6), balance_value NUMERIC(20,4),
  serial_batch_no TEXT
)
  INDEX (item_id, warehouse_id, movement_date, id)

serial_batch (
  item_id, warehouse_id,
  serial_no TEXT, batch_no TEXT,
  qty NUMERIC(20,6),
  production_date DATE, expiry_date DATE,
  status TEXT CHECK (IN ('AVAILABLE','SOLD','RESERVED'))
)
```

## 6.4 Mitra Bisnis

```sql
customer (
  code, name, category_id,
  npwp, nitku, is_taxable BOOL,
  payment_term_id, credit_limit NUMERIC(20,4),
  default_price_level SMALLINT, default_discount_pct NUMERIC(9,6),
  salesperson_id, currency_id,
  ar_account_id,               -- override
  branch_id,
  is_active,
  custom_char_1..15, custom_number_1..10, custom_date_1..2
)

customer_address (customer_id, type CHECK(IN('BILLING','SHIPPING')),
                  is_default, address, city, province, postal_code, country)
customer_contact (customer_id, name, position, phone, email, is_primary)
customer_category (code, name)

supplier (struktur paralel; ap_account_id, payment_term_id)
supplier_category (code, name)
supplier_item_price (supplier_id, item_id, unit_id, price, effective_from)

salesperson (code, name, employee_id, commission_scheme_id)
payment_term (code, name, due_days, discount_pct, discount_days)
shipping_method (code, name)
fob (code, name)   -- SHIPPING_POINT | DESTINATION

employee (code, name, npwp, department_id, branch_id, join_date, is_active)
salary_component (code, name, type CHECK(IN('EARNING','DEDUCTION')),
                  account_id, is_taxable)
employee_salary (employee_id, component_id, amount)
```

## 6.5 Dokumen Transaksi — pola umum

Semua dokumen transaksi mengikuti bentuk berikut. Ganti `<doc>` dengan nama dokumen.

```sql
<doc> (                         -- header
  doc_number TEXT NOT NULL,
  doc_date DATE NOT NULL,
  branch_id BIGINT NOT NULL,
  partner_id BIGINT,            -- customer_id / supplier_id
  currency_id BIGINT, fx_rate NUMERIC(20,8),
  payment_term_id, due_date DATE,
  warehouse_id BIGINT,
  salesperson_id,
  department_id, project_id, financial_category_id,
  reference_no TEXT,            -- No. PO pelanggan
  shipping_method_id, fob_id, shipping_address,

  subtotal        NUMERIC(20,4),
  discount_pct    NUMERIC(9,6),
  discount_amount NUMERIC(20,4),
  shipping_cost   NUMERIC(20,4),
  tax_base        NUMERIC(20,4),   -- DPP
  tax_amount      NUMERIC(20,4),
  wht_amount      NUMERIC(20,4),
  rounding        NUMERIC(20,4),
  total           NUMERIC(20,4),
  paid_amount     NUMERIC(20,4),
  outstanding     NUMERIC(20,4),

  status TEXT CHECK (IN ('DRAFT','PENDING_APPROVAL','APPROVED',
                         'REJECTED','PARTIAL','CLOSED','VOID')),
  approved_at, approved_by,
  posted_at, posted_by,
  note TEXT,
  custom_char_1..15, custom_number_1..10, custom_date_1..2
)
  UNIQUE (company_id, doc_number)

<doc>_line (
  <doc>_id BIGINT NOT NULL,
  line_no SMALLINT NOT NULL,
  item_id BIGINT,
  description TEXT,
  warehouse_id BIGINT,
  qty NUMERIC(20,6),
  unit_id BIGINT,
  qty_base NUMERIC(20,6),        -- qty × konversi satuan
  unit_price NUMERIC(20,4),
  discount_pct NUMERIC(9,6),
  discount_amount NUMERIC(20,4),
  line_total NUMERIC(20,4),
  tax_code_id BIGINT,
  tax_amount NUMERIC(20,4),
  department_id, project_id, financial_category_id,
  serial_batch_no TEXT,
  cogs_amount NUMERIC(20,4),     -- diisi sistem saat posting
  source_line_id BIGINT,         -- referensi ke baris dokumen hulu
  qty_fulfilled NUMERIC(20,6),   -- untuk SO/PO: berapa yang sudah dipenuhi
  custom_char_1..15, custom_number_1..10, custom_date_1..2
)

<doc>_link (                     -- relasi dokumen hulu-hilir
  source_type TEXT, source_id BIGINT,
  target_type TEXT, target_id BIGINT,
  qty_linked NUMERIC(20,6), amount_linked NUMERIC(20,4)
)
```

**Daftar tabel dokumen:**

| Modul | Tabel |
|-------|-------|
| Penjualan | `sales_quotation`, `sales_order`, `delivery_order`, `sales_down_payment`, `sales_invoice`, `sales_receipt`, `sales_return` |
| Pembelian | `purchase_order`, `goods_receipt`, `purchase_down_payment`, `purchase_invoice`, `purchase_payment`, `purchase_return`, `payment_order` |
| Persediaan | `item_request`, `stock_transfer`, `stock_adjustment`, `stock_count_order`, `stock_count_result`, `work_order`, `material_issue`, `work_order_completion` |
| Kas & Bank | `cash_payment`, `cash_receipt`, `bank_transfer`, `bank_statement`, `bank_reconciliation` |
| Buku Besar | `journal_voucher`, `expense_entry`, `salary_entry`, `budget`, `budget_transfer` |
| Aset Tetap | `fixed_asset`, `asset_adjustment`, `asset_disposal`, `asset_transfer`, `depreciation_run` |

## 6.6 Aset Tetap

```sql
fixed_asset (
  code, name,
  category_id, tax_category_id,
  acquisition_date DATE,
  acquisition_cost NUMERIC(20,4),
  salvage_value NUMERIC(20,4),
  -- komersial
  depreciation_method TEXT
    CHECK (IN ('STRAIGHT_LINE','DECLINING_BALANCE','SUM_OF_YEARS','UNITS','NONE')),
  useful_life_months INT,
  accumulated_depreciation NUMERIC(20,4),
  book_value NUMERIC(20,4),
  -- fiskal (terpisah!)
  tax_depreciation_method TEXT,
  tax_useful_life_months INT,
  tax_accumulated_depreciation NUMERIC(20,4),
  tax_book_value NUMERIC(20,4),
  --
  asset_account_id, accum_depr_account_id, depr_expense_account_id,
  location, branch_id, department_id, project_id,
  status TEXT CHECK (IN ('ACTIVE','DISPOSED','FULLY_DEPRECIATED'))
)

asset_depreciation (            -- riwayat per periode
  fixed_asset_id, period_year, period_month,
  commercial_amount NUMERIC(20,4),
  tax_amount NUMERIC(20,4),
  journal_entry_id BIGINT
)

asset_category (code, name, default_method, default_life_months,
                asset_account_id, accum_depr_account_id, depr_expense_account_id)
asset_tax_category (code, name, tax_group, tax_rate, tax_method)
```

## 6.7 Pajak

```sql
tax_code (
  code, name,
  type TEXT CHECK (IN ('VAT_OUT','VAT_IN','WHT')),
  rate NUMERIC(9,6),
  effective_from DATE,          -- tarif berbasis tanggal (10% → 11% → 12%)
  output_account_id, input_account_id
)

tax_invoice (                   -- faktur pajak keluaran
  sales_invoice_id,
  serial_number TEXT,
  invoice_date DATE,
  status TEXT CHECK (IN ('NORMAL','REPLACEMENT','CANCELLED')),
  replaced_serial_number TEXT,
  dpp NUMERIC(20,4), ppn NUMERIC(20,4), ppnbm NUMERIC(20,4),
  exported_at, coretax_status, coretax_ref
)

tax_invoice_serial (            -- jatah nomor seri dari DJP
  range_start TEXT, range_end TEXT, year SMALLINT,
  next_number TEXT, is_active BOOL
)

withholding_slip (              -- bukti potong PPh
  partner_type, partner_id,
  tax_code_id, slip_number, slip_date,
  base_amount, tax_amount,
  source_type, source_id
)
```

---

# 07. ENGINE AKUNTANSI

Ini inti sistem. Salah di sini, seluruh laporan tidak dapat dipercaya.

## 7.1 Kontrak posting

```go
package accounting

type PostingContext struct {
    CompanyID  int64
    BranchID   int64
    UserID     int64
    Tx         pgx.Tx
    Preference *Preference
    Accounts   AccountResolver
}

type JournalDraft struct {
    EntryDate   time.Time
    SourceType  string
    SourceID    int64
    Description string
    Lines       []JournalLineDraft
}

type JournalLineDraft struct {
    AccountID           int64
    Debit               decimal.Decimal
    Credit              decimal.Decimal
    CurrencyID          *int64
    FxRate              decimal.Decimal
    BranchID            *int64
    DepartmentID        *int64
    ProjectID           *int64
    FinancialCategoryID *int64
    PartnerType         *string
    PartnerID           *int64
    Memo                string
}

// Setiap dokumen yang menghasilkan jurnal mengimplementasikan ini.
type Postable interface {
    BuildJournal(ctx PostingContext) (*JournalDraft, error)
}

// Poster memvalidasi lalu menyimpan.
type Poster interface {
    Post(ctx PostingContext, doc Postable) (*JournalEntry, error)
    Unpost(ctx PostingContext, sourceType string, sourceID int64) error
    Repost(ctx PostingContext, doc Postable) (*JournalEntry, error) // Unpost + Post
}
```

**Validasi wajib di `Post`:**
1. `SUM(Debit) == SUM(Credit)` dalam mata uang dasar (toleransi 0)
2. Setiap baris punya `AccountID` valid dan akun tidak berstatus nonaktif
3. `EntryDate` berada di periode berstatus `OPEN`
4. Tidak ada baris dengan debit dan kredit sama-sama > 0
5. Minimal 2 baris

## 7.2 Resolusi akun — berlapis

```go
// Urutan prioritas, berhenti pada yang pertama tidak-nil.
func (r *AccountResolver) ForItem(itemID int64, key AccountKey) (int64, error) {
    // 1. Override eksplisit di baris transaksi (ditangani pemanggil)
    // 2. Akun pada master item
    if id := r.itemAccount(itemID, key); id != nil { return *id, nil }
    // 3. Akun pada kategori barang
    if id := r.categoryAccount(itemID, key); id != nil { return *id, nil }
    // 4. Default global di Preferensi
    if id := r.defaultAccount(key); id != nil { return *id, nil }
    return 0, ErrAccountNotConfigured{Key: key}
}
```

**Kunci akun default (`default_account.key`):**

| Kunci | Label UI | Dipakai oleh |
|-------|----------|--------------|
| `ITEM_INVENTORY` | Persediaan | Semua transaksi persediaan |
| `ITEM_SALES` | Penjualan | Faktur Penjualan |
| `ITEM_SALES_RETURN` | Retur Penjualan | Retur Penjualan |
| `ITEM_SALES_DISCOUNT` | Diskon Penjualan | Faktur Penjualan |
| `ITEM_GOODS_DELIVERED` | Barang Terkirim | Pengiriman Pesanan |
| `ITEM_COGS` | Beban Pokok Penjualan | Faktur Penjualan |
| `ITEM_PURCHASE_RETURN` | Retur Pembelian | Retur Pembelian |
| `ITEM_UNBILLED_PURCHASE` | Pembelian Belum Tertagih | Penerimaan Barang |
| `AR` | Piutang Usaha | Penjualan |
| `AP` | Utang Usaha | Pembelian |
| `CUSTOMER_DOWN_PAYMENT` | Uang Muka Pelanggan | DP Penjualan |
| `SUPPLIER_DOWN_PAYMENT` | Uang Muka Pemasok | DP Pembelian |
| `VAT_OUT` | PPN Keluaran | Penjualan |
| `VAT_IN` | PPN Masukan | Pembelian |
| `WHT_PAYABLE` | Utang PPh | Pembayaran |
| `SHIPPING_EXPENSE` | Biaya Kirim | Penjualan/Pembelian |
| `INVENTORY_ADJUSTMENT` | Penyesuaian Persediaan | Penyesuaian & Opname |
| `WIP` | Barang Dalam Proses | Produksi |
| `FX_GAIN_LOSS` | Selisih Kurs | Valas |
| `ROUNDING` | Pembulatan | Semua |
| `RETAINED_EARNING` | Laba Ditahan | Tutup buku |
| `CURRENT_YEAR_EARNING` | Laba Tahun Berjalan | Neraca |
| `SETTLEMENT_CLEARING` | Kas Penampungan | Perintah Pembayaran |
| `SALES_DISCOUNT_SETTLEMENT` | Diskon Pelunasan | Penerimaan |
| `ASSET_DISPOSAL_GAIN_LOSS` | Laba/Rugi Pelepasan Aset | Disposisi |

## 7.3 Aturan jurnal per dokumen

Notasi: `Dr` debit, `Cr` kredit. Semua nilai dalam mata uang dasar.

### PENJUALAN

**Penawaran Penjualan** — tidak menghasilkan jurnal, tidak mengubah stok.

**Pesanan Penjualan** — tidak menghasilkan jurnal. Efek: `item_stock.qty_reserved += qty`.

**Pengiriman Pesanan (surat jalan)** `[ASUMSI: hanya jika alur DO dipakai terpisah]`
```
Dr  ITEM_GOODS_DELIVERED     = biaya pokok
    Cr  ITEM_INVENTORY       = biaya pokok
```
Efek stok: `qty_on_hand -= qty`, `qty_reserved -= qty`, buat `inventory_movement` keluar, konsumsi `inventory_layer`.

**Uang Muka Penjualan**
```
Dr  CASH_BANK (akun terpilih)  = nilai DP
    Cr  CUSTOMER_DOWN_PAYMENT  = DPP DP
    Cr  VAT_OUT                = PPN DP (jika kena pajak)
```

**Faktur Penjualan — langsung (barang belum dikirim lewat DO)**
```
Dr  AR                        = total
Dr  ITEM_SALES_DISCOUNT       = diskon (jika diskon dicatat terpisah)
    Cr  ITEM_SALES            = subtotal per baris
    Cr  VAT_OUT               = PPN
    Cr  SHIPPING_EXPENSE      = biaya kirim ditagihkan (jika ada)

Dr  ITEM_COGS                 = biaya pokok
    Cr  ITEM_INVENTORY        = biaya pokok
```

**Faktur Penjualan — dari Pengiriman**
Sama, kecuali baris HPP:
```
Dr  ITEM_COGS
    Cr  ITEM_GOODS_DELIVERED
```

**Faktur Penjualan — dengan alokasi Uang Muka**
Tambahkan:
```
Dr  CUSTOMER_DOWN_PAYMENT     = nilai DP terpakai
    Cr  AR                    = nilai DP terpakai
```

**Penerimaan Penjualan (pelunasan)**
```
Dr  CASH_BANK                     = kas diterima
Dr  SALES_DISCOUNT_SETTLEMENT     = diskon pelunasan (jika ada)
Dr  WHT_RECEIVABLE                = PPh dipotong pelanggan (jika ada)
    Cr  AR                        = total faktur terlunasi
```

**Retur Penjualan**
```
Dr  ITEM_SALES_RETURN     = nilai retur
Dr  VAT_OUT               = PPN retur
    Cr  AR                = total retur

-- jika barang dikembalikan ke gudang:
Dr  ITEM_INVENTORY        = nilai barang (lihat konfigurasi)
    Cr  ITEM_COGS         = nilai barang

-- jika barang TIDAK dikembalikan:
Dr  ITEM_COGS  ATAU  akun dari sales_return_not_returned_account_id
    Cr  ITEM_COGS
```
**Konfigurasi nilai barang retur** (`app_preference.sales_return_value_basis`):
- `INVOICE_COGS` — pakai biaya pokok dari faktur asal (default)
- `LAST_PURCHASE_COST` — pakai harga beli/biaya masuk terakhir

### PEMBELIAN

**Pesanan Pembelian** — tidak menghasilkan jurnal. Efek: `qty_incoming += qty`.

**Penerimaan Barang**
```
Dr  ITEM_INVENTORY              = qty × harga PO
    Cr  ITEM_UNBILLED_PURCHASE  = qty × harga PO
```
Efek stok: `qty_on_hand += qty`, `qty_incoming -= qty`, buat `inventory_layer` baru.

**Uang Muka Pembelian**
```
Dr  SUPPLIER_DOWN_PAYMENT   = nilai DP
Dr  VAT_IN                  = PPN DP (jika ada)
    Cr  CASH_BANK           = total dibayar
```

**Faktur Pembelian — dari Penerimaan Barang**
```
Dr  ITEM_UNBILLED_PURCHASE  = nilai penerimaan
Dr  VAT_IN                  = PPN
    Cr  AP                  = total

-- jika harga faktur ≠ harga penerimaan, tangani selisih:
```
Perlakuan selisih (`app_preference.purchase_receipt_cost_update`):

| Nilai | Perlakuan |
|-------|-----------|
| `BY_BILL` | Perbarui biaya persediaan. Jurnal: `Dr/Cr ITEM_INVENTORY` sebesar selisih; perbarui `inventory_layer.unit_cost` |
| `NOT_BY_BILL` | Biaya persediaan tetap. Selisih ke `purchase_unbilled_variance_account_id` |
| `SAME_PERIOD_ONLY` | Perbarui hanya jika tanggal faktur berada di periode yang sama dengan penerimaan; jika tidak, ke akun selisih |

**Faktur Pembelian — langsung (tanpa penerimaan)**
```
Dr  ITEM_INVENTORY / EXPENSE / FIXED_ASSET   = per jenis baris
Dr  VAT_IN
    Cr  AP
```
Baris dengan item bertipe `SERVICE`/`NON_INVENTORY` masuk ke akun beban, bukan persediaan.

**Pembayaran Pembelian**
```
Dr  AP                       = total faktur terlunasi
    Cr  CASH_BANK            = kas keluar
    Cr  PURCHASE_DISCOUNT    = diskon pelunasan (jika ada)
    Cr  WHT_PAYABLE          = PPh dipotong (jika ada)
```

**Retur Pembelian**
```
Dr  AP                        = total retur
    Cr  ITEM_PURCHASE_RETURN  = nilai barang
    Cr  VAT_IN                = PPN retur
```
Efek stok: keluar dari gudang.

**Perintah Pembayaran** `[ASUMSI]`
```
-- saat dibuat & disetujui:
Dr  AP
    Cr  SETTLEMENT_CLEARING
-- saat direalisasi (dana keluar dari bank):
Dr  SETTLEMENT_CLEARING
    Cr  CASH_BANK
```

### PERSEDIAAN

**Permintaan Barang** — tidak ada jurnal.

**Pemindahan Barang**
- Jika akun persediaan gudang asal = tujuan → **tidak ada jurnal**, hanya `inventory_movement`
- Jika berbeda akun/cabang:
```
Dr  ITEM_INVENTORY (tujuan)
    Cr  ITEM_INVENTORY (asal)
```

**Penyesuaian Persediaan**
```
-- selisih positif (stok bertambah):
Dr  ITEM_INVENTORY
    Cr  INVENTORY_ADJUSTMENT
-- selisih negatif:
Dr  INVENTORY_ADJUSTMENT
    Cr  ITEM_INVENTORY
```

**Hasil Stok Opname** — sama dengan Penyesuaian Persediaan, dibuat otomatis dari selisih (fisik − sistem).

**Pekerjaan Pesanan (produksi)** `[ASUMSI]`
```
-- pengeluaran bahan baku:
Dr  WIP
    Cr  ITEM_INVENTORY (bahan baku)
-- penyelesaian:
Dr  ITEM_INVENTORY (barang jadi)
    Cr  WIP
-- selisih (jika ada) → akun varian produksi
```

### KAS & BANK

**Pembayaran (non-pemasok)**
```
Dr  akun tujuan (beban/aset/utang)
Dr  VAT_IN (jika ada)
    Cr  CASH_BANK
```

**Penerimaan (non-pelanggan)**
```
Dr  CASH_BANK
    Cr  akun sumber (pendapatan/aset/kewajiban)
```

**Transfer Bank**
```
Dr  CASH_BANK (tujuan)
Dr  BANK_CHARGE (biaya admin, jika ada)
    Cr  CASH_BANK (asal)
-- jika beda mata uang, selisih ke FX_GAIN_LOSS
```

**Rekonsiliasi Bank** — pencocokan tidak menghasilkan jurnal. Item yang hanya ada di rekening koran (biaya admin, bunga) dibuatkan Pembayaran/Penerimaan.

### ASET TETAP

**Penyusutan (Proses Akhir Bulan)**
```
Dr  DEPRECIATION_EXPENSE (per aset/kategori)
    Cr  ACCUMULATED_DEPRECIATION
```
Nilai komersial masuk jurnal. Nilai fiskal **dicatat di `asset_depreciation.tax_amount` tanpa jurnal** — dipakai untuk rekonsiliasi fiskal.

**Disposisi — Dijual**
```
Dr  CASH_BANK / AR                    = harga jual
Dr  ACCUMULATED_DEPRECIATION          = akumulasi penyusutan
Dr  ASSET_DISPOSAL_GAIN_LOSS          = jika rugi
    Cr  FIXED_ASSET                   = harga perolehan
    Cr  ASSET_DISPOSAL_GAIN_LOSS      = jika laba
    Cr  VAT_OUT                       = PPN (jika PKP)
```

**Disposisi — Dihapus**
```
Dr  ACCUMULATED_DEPRECIATION
Dr  ASSET_DISPOSAL_GAIN_LOSS          = nilai buku tersisa
    Cr  FIXED_ASSET
```

### BUKU BESAR & PERIODIK

**Jurnal Umum** — baris bebas, wajib balance.

**Pencatatan Gaji**
```
Dr  SALARY_EXPENSE, ALLOWANCE_EXPENSE
    Cr  SALARY_PAYABLE
    Cr  WHT_21_PAYABLE
    Cr  BPJS_PAYABLE
```

**Revaluasi Selisih Kurs (Proses Akhir Bulan)**
Untuk setiap akun bermata uang asing:
```
selisih = saldo_valas × kurs_akhir_periode − saldo_mata_uang_dasar
Dr/Cr  akun valas
    Cr/Dr  FX_GAIN_LOSS
```

**Tutup Buku Tahunan**
```
Dr  semua akun REVENUE, OTHER_REVENUE      (sebesar saldo)
    Cr  semua akun COGS, EXPENSE, OTHER_EXPENSE
    Cr/Dr  RETAINED_EARNING                (selisih = laba/rugi bersih)
```

## 7.4 Engine costing persediaan

```go
package inventory

type CostingEngine interface {
    // Barang masuk. Mengembalikan biaya satuan yang dicatat.
    Receive(ctx Context, in ReceiveInput) (decimal.Decimal, error)
    // Barang keluar. Mengembalikan total biaya pokok.
    Issue(ctx Context, in IssueInput) (decimal.Decimal, error)
    // Koreksi biaya (mis. faktur pembelian mengubah harga penerimaan).
    AdjustCost(ctx Context, in AdjustInput) error
}

type ReceiveInput struct {
    ItemID, WarehouseID int64
    Date                time.Time
    Qty                 decimal.Decimal
    UnitCost            decimal.Decimal
    SourceType          string
    SourceID            int64
    SerialBatchNo       *string
}
```

### Metode AVERAGE (rata-rata bergerak)

```
Saat masuk:
  nilai_baru   = (qty_lama × avg_lama) + (qty_masuk × biaya_masuk)
  qty_baru     = qty_lama + qty_masuk
  avg_baru     = nilai_baru / qty_baru        // jika qty_baru = 0, avg tetap
  
Saat keluar:
  biaya_pokok  = qty_keluar × avg_saat_ini    // avg TIDAK berubah
  qty_baru     = qty_lama − qty_keluar
```

### Metode FIFO

```
Saat masuk:
  INSERT inventory_layer (qty_in, qty_remaining = qty_in, unit_cost)

Saat keluar:
  sisa = qty_keluar
  biaya_pokok = 0
  FOR layer IN (SELECT * FROM inventory_layer
                WHERE item_id=? AND warehouse_id=? AND qty_remaining > 0
                ORDER BY layer_date, id
                FOR UPDATE):
      ambil = MIN(sisa, layer.qty_remaining)
      biaya_pokok += ambil × layer.unit_cost
      layer.qty_remaining -= ambil
      sisa -= ambil
      IF sisa == 0: BREAK
  IF sisa > 0:
      // stok tidak cukup — lihat kebijakan stok negatif
```

### Kebijakan stok negatif `[TANYA]`

Tiga opsi. **Pilih satu dan terapkan konsisten:**

| Opsi | Perilaku |
|------|----------|
| `REJECT` | Tolak transaksi. Paling aman untuk integritas |
| `WARN` | Peringatkan, izinkan lanjut. Pakai biaya rata-rata terakhir untuk qty yang tidak tercakup layer |
| `ALLOW` | Izinkan diam-diam. Buat layer negatif, dikoreksi saat barang masuk |

**Rekomendasi: `WARN`** — praktik lapangan di Indonesia sering butuh menjual sebelum penerimaan tercatat.

### Aturan konkurensi `[KEPUTUSAN]`

Sebelum operasi costing apa pun:
```sql
SELECT pg_advisory_xact_lock(hashtextextended('item_wh', item_id * 1000000 + warehouse_id));
```
Ini mencegah dua transaksi bersamaan merusak nilai rata-rata atau layer FIFO.

### Perhitungan ulang berjenjang

Jika transaksi masa lalu diubah, semua pergerakan setelahnya harus dihitung ulang:

```go
func (e *engine) RecalculateFrom(itemID, warehouseID int64, from time.Time) error {
    // 1. Ambil semua movement >= from, urut kronologis
    // 2. Reset layer ke kondisi sebelum `from`
    // 3. Putar ulang setiap movement
    // 4. Perbarui journal_line untuk baris HPP yang berubah
    // 5. Perbarui item_stock
}
```

Operasi ini berat. Jalankan sebagai background job, tampilkan progres ke pengguna.

## 7.5 Perhitungan pajak

```
Untuk setiap baris:
  line_gross    = qty × unit_price
  line_discount = line_gross × discount_pct   (atau nominal langsung)
  line_net      = line_gross − line_discount

subtotal        = Σ line_net
header_discount = subtotal × discount_pct     (atau nominal)

// diskon header diprorata ke tiap baris untuk perhitungan DPP per baris
line_dpp        = line_net − (header_discount × line_net / subtotal)

// PPN dihitung per baris berdasarkan tax_code baris
line_ppn        = line_dpp × tarif(tax_code, doc_date)

tax_base        = Σ line_dpp
tax_amount      = Σ line_ppn                   -- dibulatkan per baris
total           = tax_base + tax_amount + shipping_cost + rounding
```

**Mode harga termasuk pajak** (`price_includes_tax = true`):
```
line_dpp = line_net / (1 + tarif)
line_ppn = line_net − line_dpp
```

**Tarif berbasis tanggal:** selalu ambil tarif yang berlaku pada `doc_date`, bukan tarif saat ini.
```sql
SELECT rate FROM tax_code
WHERE code = ? AND effective_from <= $doc_date
ORDER BY effective_from DESC LIMIT 1
```

**Pembulatan:** bulatkan PPN **per baris** ke satuan rupiah terdekat, lalu jumlahkan. `[ASUMSI]` — konfirmasi apakah Accurate membulatkan per baris atau per faktur.

---

# 08. KONVENSI API

## 8.1 Bentuk URL

```
GET    /api/v1/sales/invoices              # daftar
POST   /api/v1/sales/invoices              # buat
GET    /api/v1/sales/invoices/{id}         # detail
PUT    /api/v1/sales/invoices/{id}         # ubah
DELETE /api/v1/sales/invoices/{id}         # hapus (soft)
POST   /api/v1/sales/invoices/{id}/post    # posting jurnal
POST   /api/v1/sales/invoices/{id}/unpost
POST   /api/v1/sales/invoices/{id}/approve
POST   /api/v1/sales/invoices/{id}/reject
POST   /api/v1/sales/invoices/{id}/void
GET    /api/v1/sales/invoices/{id}/journal # lihat jurnal yang dihasilkan
GET    /api/v1/sales/invoices/{id}/history # audit log dokumen
POST   /api/v1/sales/invoices/from-order   # "Ambil" dari SO
```

## 8.2 Header wajib

```
Authorization: Bearer <access_token>
X-Company-ID: <company_id>
X-Branch-ID: <branch_id>        # cabang aktif
Idempotency-Key: <uuid>          # untuk POST yang menghasilkan jurnal
```

## 8.3 Bentuk respons

**Sukses — daftar:**
```json
{
  "data": [ ... ],
  "meta": { "page": 1, "per_page": 50, "total": 1247, "total_pages": 25 }
}
```

**Sukses — tunggal:**
```json
{ "data": { ... } }
```

**Gagal:**
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Data tidak valid",
    "details": [
      { "field": "lines[0].qty", "message": "Kuantitas harus lebih dari 0" }
    ]
  }
}
```

**Kode error domain (gunakan konsisten):**

| Kode | HTTP | Arti |
|------|------|------|
| `VALIDATION_FAILED` | 422 | Input tidak valid |
| `PERIOD_CLOSED` | 409 | Periode akuntansi sudah ditutup |
| `JOURNAL_NOT_BALANCED` | 500 | Bug internal — jurnal tidak seimbang |
| `ACCOUNT_NOT_CONFIGURED` | 422 | Akun default belum diatur |
| `INSUFFICIENT_STOCK` | 409 | Stok tidak mencukupi |
| `DOCUMENT_LOCKED` | 409 | Dokumen sudah diposting/disetujui |
| `APPROVAL_REQUIRED` | 409 | Butuh persetujuan sebelum aksi ini |
| `PERMISSION_DENIED` | 403 | Tidak punya hak akses |
| `CONCURRENT_MODIFICATION` | 409 | Data diubah pengguna lain (optimistic lock) |
| `DUPLICATE_DOCUMENT_NUMBER` | 409 | Nomor dokumen sudah dipakai |

## 8.4 Parameter daftar

```
?page=1
&per_page=50
&sort=doc_date:desc,doc_number:asc
&search=ban+mobil
&filter[status]=APPROVED
&filter[branch_id]=1
&filter[date_from]=2026-01-01
&filter[date_to]=2026-08-31
&fields=id,doc_number,doc_date,total     # sparse fieldset
```

## 8.5 Optimistic locking

Setiap dokumen mengembalikan `version` (integer). `PUT` harus menyertakan `version` yang sama; jika berbeda → `409 CONCURRENT_MODIFICATION`.

---

# 09. MODEL HAK AKSES

## 9.1 Format kunci permission

```
<modul>.<submenu>[.<aksi khusus>]
```

Contoh:
- `sales.invoice` — hak dasar (access/create/edit/delete/view)
- `sales.invoice.change_date` — hak khusus
- `sales.invoice.reprint` — hak cetak ulang
- `sales.all_customers` — dapat menggunakan semua pelanggan

## 9.2 Tiga jenis hak `[PASTI]`

| Jenis | Bentuk | Contoh |
|-------|--------|--------|
| **Akses Menu** | 5 checkbox: Aktif, Buat, Ubah, Hapus, Lihat | Faktur Penjualan |
| **Akses Lainnya** | boolean tunggal | "Dapat Mengubah Tanggal Faktur Penjualan", "Dapat menggunakan semua pelanggan", "Buat Pembayaran Tanpa Pencatatan Beban" |
| **Akses Cetakan** | boolean tunggal | "Cetak/email ulang Pembayaran" |

Catatan: tidak semua menu punya kelima checkbox. Menu yang hanya untuk dilihat (mis. Log Aktivitas, Histori Bank) hanya punya "Aktif".

## 9.3 Pengecekan berlapis

```go
func (a *Authz) Can(user *User, permission string, action Action) bool
func (a *Authz) CanAccessBranch(user *User, branchID int64) bool
func (a *Authz) CanAccessWarehouse(user *User, warehouseID int64) bool
func (a *Authz) CanAccessAccount(user *User, accountID int64) bool
func (a *Authz) CanTransactOnDate(user *User, date time.Time) bool
```

Middleware HTTP mengecek `Can`. Query repository **wajib** menambahkan filter cabang otomatis:
```sql
WHERE branch_id = ANY($allowed_branch_ids)
```

## 9.4 Frontend

```tsx
const { can } = usePermission();

{can('sales.invoice', 'create') && <Button>Buat Faktur</Button>}
```

Daftar hak dimuat sekali saat login, disimpan di store, di-refresh saat grup akses berubah.

**Penting:** cek di frontend hanya untuk UX. **Backend tetap wajib mengecek ulang.**

---

# 10. RINGKASAN MODUL

Format tiap modul: menu → entitas → endpoint utama → jurnal.

## 10.1 Pengaturan (`/settings`)

| Menu | Route | Entitas |
|------|-------|---------|
| Preferensi | `/settings/preferences` | `app_preference`, `company`, `default_account`, `approval_setting`, `attachment_setting`, `custom_field_def` |
| Akses Grup | `/settings/access-groups` | `access_group`, `access_right` |
| Pengguna | `/settings/users` | `app_user` |
| Penomoran | `/settings/numbering` | `document_numbering` |
| Desain Cetakan | `/settings/print-templates` | `print_template` |

**Preferensi — 11 seksi** (navigasi vertikal kiri, sub-tab horizontal kanan):

| Seksi | Sub-tab | Isi utama |
|-------|---------|-----------|
| Perusahaan | Info Perusahaan, Alamat | Nama, Kategori Usaha, Bidang Usaha, Telepon, Faksimili, Email, Tgl Mulai Data, Periode Akuntansi, Mata Uang |
| Fitur | Perusahaan, Penjualan, Pembelian, Persediaan | Fitur Dasar (Multi Cabang, Multi Mata Uang, Pajak, Persetujuan, Pencatatan Aset, Anggaran & Target); Metode Biaya Persediaan; Pusat Laba & Biaya (Departemen, Proyek, Kategori Keuangan); Pinjaman Karyawan |
| Pajak | Info Perusahaan, Alamat, Lainnya | Nama Perusahaan, Tgl & No Pengukuhan PKP, Tipe Usaha, NPWP, KLU, NITKU |
| Penjualan | Penjualan | SO tutup otomatis; opsi nilai retur; opsi barang tidak dikembalikan; perbarui biaya saat simpan ulang; pelanggan baru termasuk pajak |
| Pembelian | Pembelian | PO tutup otomatis; opsi pembaruan biaya penerimaan + akun selisih; akun pembelian aset; akun selisih tagih pemasok lain; tanggal jurnal; akun kas penampungan |
| Pembatasan | Akses Operator, Tanggal Transaksi, Lainnya | Tidak dibatasi / Dibatasi semua / Terbatas waktu |
| Persetujuan | Penjualan, Pembelian, Persediaan, Lainnya | Checkbox per dokumen |
| Lampiran | Penjualan, Pembelian, Persediaan, Lainnya | Checkbox per dokumen (wajib lampiran) |
| Atribut Tambahan | Rincian Formulir, Barang & Jasa, Pelanggan, Pemasok | 15 Karakter (+daftar pilihan), 10 Angka, 2 Tanggal |
| Akun Perkiraan | Barang & Jasa, Perusahaan, Penjualan/Pembelian, Persediaan | Mapping akun default |
| Lain-lain | Lainnya, Email Transaksi | Format desimal, tampilan tanggal, umur utang/piutang, umur persediaan, dasar komisi |

## 10.2 Perusahaan (`/company`)

Menu: Pajak, Syarat Pembayaran, Pengiriman, FOB, Gaji/Tunjangan, Karyawan, Transaksi Berulang, Proses Akhir Bulan, Kontak, Transaksi Favorit, Kalender, Log Aktivitas, Cabang, Mata Uang.

**Proses Akhir Bulan** adalah job batch:
```
POST /api/v1/company/month-end-close
Body: { year, month, tasks: ["DEPRECIATION","FX_REVALUATION","AMORTIZATION"] }
→ menjalankan sebagai background job, mengembalikan job_id
GET /api/v1/jobs/{job_id}  → progres & hasil
POST /api/v1/company/month-end-close/{id}/reverse  → batalkan
```

## 10.3 Buku Besar (`/general-ledger`)

| Menu | Jurnal? |
|------|---------|
| Akun Perkiraan | Saldo awal → jurnal pembukaan |
| Pencatatan Beban | Ya |
| Pencatatan Gaji | Ya |
| Jurnal Umum | Ya (manual) |
| Anggaran | Tidak |
| Transfer Anggaran | Tidak |
| Monitor Anggaran | Tidak (laporan) |
| Histori Akun | Tidak (laporan) |
| Log Aktivitas Jurnal | Tidak (audit) |

**Form Akun Perkiraan — 3 sub-tab** `[PASTI]`:
- **Informasi Umum:** Tipe Akun (dropdown), checkbox Sub Akun (→ pilih induk), Kode Perkiraan*, Nama*
- **Saldo:** Saldo Awal (nilai + per Tanggal)
- **Lain-lain:** Catatan, Akses Pengguna (checkbox "Semua Pengguna" atau pilih spesifik)

## 10.4 Kas & Bank (`/cash-bank`)

Menu: Pembayaran, Penerimaan, Transfer Bank, Rekonsiliasi Bank, Rekening Koran, Histori Bank, SmartLink e-Banking, Virtual Account, e-Payment.

**Smart-pairing rekonsiliasi** `[ASUMSI]`:
```
Skor kecocokan = 
    (nominal sama persis)          × 50
  + (selisih tanggal ≤ 3 hari)     × 25
  + (referensi/nomor dok cocok)    × 25
Auto-match jika skor ≥ 75, selain itu tampilkan sebagai saran
```

## 10.5 Penjualan (`/sales`)

**Alur dokumen:**
```
Penawaran ──▶ Pesanan ──▶ Pengiriman ──▶ Faktur ──▶ Penerimaan
                 │                          │
                 └──▶ Uang Muka ────────────┘
                                            │
                                            └──▶ Retur
```

Setiap panah = tombol **Proses** di dokumen hulu, atau tombol **Ambil** di dokumen hilir. Setiap tahap boleh dilewati.

**Menu lengkap:** Penawaran Penjualan, Pesanan Penjualan, Pengiriman Pesanan, Uang Muka Penjualan, Faktur Penjualan, Penerimaan Penjualan, Retur Penjualan, Tukar Faktur `[ASUMSI]`, Klaim Pelanggan `[ASUMSI]`, Pengepakan Barang `[ASUMSI]`, Pelanggan, Kategori Pelanggan, Kategori Penjualan, Penyesuaian Harga/Diskon, Komisi Penjual, Target Penjualan, Trade Portal, SmartLink e-Commerce, Check In `[ASUMSI]`.

## 10.6 Pembelian (`/purchase`)

```
Pesanan ──▶ Penerimaan Barang ──▶ Faktur ──▶ Pembayaran
    │                                │
    └──▶ Uang Muka ──────────────────┘
                                     │
                                     └──▶ Retur
```

**Menu:** Pesanan Pembelian, Penerimaan Barang, Uang Muka Pembelian, Faktur Pembelian, Pembayaran Pembelian, Retur Pembelian, Klaim Pemasok, Perintah Pembayaran, Transfer Pemasok, Pemasok, Kategori Pemasok, Harga Pemasok.

## 10.7 Persediaan (`/inventory`)

**Menu:** Permintaan Barang, Pemindahan Barang, Penyesuaian Persediaan, Pekerjaan Pesanan, Penambahan Bahan Baku, Penyelesaian Pesanan, Perintah Stok Opname, Hasil Stok Opname, Barang & Jasa, Gudang, Satuan Barang, Kategori Barang, Merek Barang, Pemenuhan Pesanan, Barang per Gudang, Barang Stok Minimum.

**Form Barang & Jasa — 6 sub-tab** `[PASTI]`:

| Sub-tab | Field |
|---------|-------|
| **Umum** | *Informasi Barang & Jasa:* Nama Barang*, Kategori Barang*, Jenis Barang (dropdown), Kode Barang* (toggle otomatis/manual + pilih template), UPC/Barcode, Satuan*<br>*Informasi Lainnya:* Merek Barang, toggle Aktifkan No. Seri/Produksi |
| **Penjualan / Pembelian** | *Informasi Penjualan:* Default Diskon (%) /Semua Satuan, Def. Hrg. Jual Satuan #1, Minimum Jual, toggle Menerapkan Harga/Diskon Grosir, toggle Substitusi dengan<br>*Informasi Pembelian:* Pemasok Utama, Satuan Beli, Harga Beli, Minimum Beli, Batas Minimum Stok<br>*Pajak:* Ref Kode Pajak, PPN, PPh |
| **Stok** | *Stok Awal* (tabel: Tanggal, Kuantitas, Satuan, Biaya Satuan, Gudang — tombol + tambah baris)<br>*Stok (Semua Gudang):* Kuantitas, Nilai Satuan, Beban Pokok (read-only) |
| **Akun** | 8 field override: Persediaan, Penjualan, Retur Penjualan, Diskon Penjualan, Barang Terkirim, Beban Pokok Penjualan, Retur Pembelian, Pembelian Belum Tertagih.<br>*Catatan UI:* "Akun-akun yang dapat dipilih sesuai dengan akun-akun yang dimasukkan pada formulir Preferensi bagian akun default barang" |
| **Gambar** | Unggah banyak gambar |
| **Lain-lain** | Catatan; Dimensi & Berat: Panjang (cm), Lebar (cm), Tinggi (cm), Berat (gr) |

## 10.8 Aset Tetap (`/fixed-asset`)

**Menu:** Aset Tetap, Kategori Aset, Kategori Aset Tetap Pajak, Perubahan Aset Tetap, Disposisi Aset Tetap, Pindah Aset, Aset per Lokasi.

**Rumus penyusutan:**

```
Garis Lurus:
  per_bulan = (harga_perolehan − nilai_residu) / masa_manfaat_bulan

Saldo Menurun Ganda:
  tarif = 2 / masa_manfaat_tahun
  per_tahun = nilai_buku_awal_tahun × tarif
  per_bulan = per_tahun / 12
  // berhenti saat nilai_buku ≤ nilai_residu

Jumlah Angka Tahun:
  jumlah_angka = n(n+1)/2  dengan n = masa_manfaat_tahun
  per_tahun_ke_k = (harga − residu) × (n − k + 1) / jumlah_angka

Unit Produksi:
  per_unit = (harga − residu) / total_estimasi_unit
  periode = per_unit × unit_terpakai_periode
```

**Fiskal Indonesia (untuk `asset_tax_category`):**

| Kelompok | Masa manfaat | Garis Lurus | Saldo Menurun |
|----------|--------------|-------------|---------------|
| I | 4 tahun | 25% | 50% |
| II | 8 tahun | 12,5% | 25% |
| III | 16 tahun | 6,25% | 12,5% |
| IV | 20 tahun | 5% | 10% |
| Bangunan Permanen | 20 tahun | 5% | — |
| Bangunan Non-Permanen | 10 tahun | 10% | — |

## 10.9 Pajak (`/tax`)

**Menu:** e-Faktur/CoreTax, Email Faktur Pajak, SPT PPN/PPnBM, SPT PPh 21/23/4(2)/15, e-Billing, e-Filing.

**Arsitektur:** bungkus semua integrasi DJP di balik interface, karena format & API berubah sering.

```go
type TaxAuthorityAdapter interface {
    ExportInvoices(ctx context.Context, period Period) ([]byte, error)
    ImportSerialNumbers(ctx context.Context, r io.Reader) error
    SubmitReturn(ctx context.Context, ret TaxReturn) (*SubmissionResult, error)
    CheckStatus(ctx context.Context, ref string) (*Status, error)
}
```

## 10.10 Laporan (`/reports`)

**Engine generik:**

```sql
report_definition (
  code, name, category,
  query_template TEXT,      -- SQL dengan placeholder
  available_filters JSONB,
  default_columns JSONB,
  is_system BOOL
)

report_preset (
  report_code, user_id, name,
  filters JSONB, columns JSONB, sort JSONB
)

report_schedule (
  report_code, preset_id,
  cron TEXT, recipients TEXT[], format TEXT
)
```

**Filter standar yang tersedia di semua laporan:** periode (dari–sampai), cabang, departemen, proyek, kategori keuangan, mata uang.

**Kelompok laporan minimum:**

| Kelompok | Laporan |
|----------|---------|
| Keuangan | Neraca, Neraca Komparatif, Laba Rugi, Laba Rugi Komparatif, Laba Rugi per Departemen/Proyek, Arus Kas (langsung & tidak langsung), Perubahan Ekuitas, Laba Ditahan, Rasio Keuangan |
| Buku Besar | Neraca Percobaan, Buku Besar per Akun, Jurnal Umum, Jurnal per Sumber, Histori Akun, Rekap Jurnal |
| Penjualan | Penjualan per Pelanggan/Barang/Sales/Periode/Kategori/Cabang, Ringkasan & Detail Faktur, Komisi Penjual, Target vs Realisasi, Profitabilitas per Barang/Pelanggan, Pesanan Terbuka |
| Piutang | Umur Piutang (ringkas & detail), Kartu Piutang, Piutang Jatuh Tempo, Rekap Pembayaran Pelanggan |
| Pembelian | Pembelian per Pemasok/Barang/Periode, Ringkasan & Detail Faktur, Analisa Harga Pemasok, Pesanan Terbuka |
| Utang | Umur Utang, Kartu Utang, Utang Jatuh Tempo |
| Persediaan | Kartu Stok, Nilai Persediaan, Mutasi Persediaan, Umur Persediaan, Barang Terlaris, Barang Tidak Bergerak, Stok per Gudang, Rekap Serial/Batch, Hasil Stok Opname, Stok Minimum |
| Aset Tetap | Daftar Aset, Penyusutan Komersial, Penyusutan Fiskal, Aset per Lokasi/Kategori, Disposisi |
| Pajak | Rekap PPN Keluaran, Rekap PPN Masukan, Daftar Faktur Pajak, Bukti Potong PPh |
| Kas & Bank | Mutasi Kas/Bank, Proyeksi Arus Kas, Laporan Rekonsiliasi |
| Anggaran | Anggaran vs Realisasi per Akun/Departemen/Proyek |

**Performa:** untuk laporan yang menyentuh > 50rb baris jurnal, gunakan `account_balance` (tabel agregat), bukan `journal_line`.

---

# 11. URUTAN PENGERJAAN

Tiap fase harus menghasilkan sesuatu yang berfungsi dan diuji.

## Fase 0 — Fondasi
**Keluaran:** aplikasi berjalan, bisa login, shell UI lengkap, tapi belum ada fitur bisnis.

- [ ] Setup repo, Docker Compose (Postgres, Redis, MinIO)
- [ ] Migrasi tabel fondasi (§6.1)
- [ ] Auth: login, refresh token, middleware
- [ ] Multi-tenant: resolusi `company_id` dari token
- [ ] **UI Shell lengkap: Icon Rail + Menu Flyout + Tab Bar** (§03)
- [ ] Design token & komponen dasar (§05)
- [ ] Komponen DataGrid dengan virtual scroll & paginasi server
- [ ] Komponen FormShell (header + panel + footer + action rail)
- [ ] Engine hak akses (backend + hook frontend)
- [ ] Audit log otomatis
- [ ] Penomoran dokumen
- [ ] `internal/domain/accounting`: Poster, validasi, resolusi akun

**Gerbang mutu:** UI shell bisa dinavigasi, tab berfungsi dengan state terpisah, seed data perusahaan berhasil.

## Fase 1 — Akuntansi Inti
**Keluaran:** bisa dipakai sebagai pembukuan sederhana.

- [ ] Akun Perkiraan (CRUD + hierarki + saldo awal)
- [ ] Bagan akun standar Indonesia sebagai template seed
- [ ] Jurnal Umum
- [ ] Kas & Bank: Pembayaran, Penerimaan, Transfer
- [ ] Periode akuntansi (buka/tutup)
- [ ] Tabel `account_balance` + job pembaruan
- [ ] Laporan: Neraca, Laba Rugi, Neraca Percobaan, Buku Besar per Akun
- [ ] Ekspor Excel & PDF

**Gerbang mutu:** input 100 jurnal manual → Neraca balance, Laba Rugi tepat.

## Fase 2 — Penjualan & Piutang
- [ ] Master: Pelanggan, Kategori Pelanggan, Syarat Pembayaran, Sales
- [ ] Master: Barang & Jasa (tanpa fitur stok dulu — hanya tipe SERVICE)
- [ ] Faktur Penjualan (form transaksi lengkap)
- [ ] Penerimaan Penjualan (pelunasan, alokasi ke banyak faktur)
- [ ] Retur Penjualan
- [ ] Master Pajak + perhitungan PPN
- [ ] Laporan: Penjualan, Umur Piutang, Kartu Piutang

**Gerbang mutu:** siklus jual → tagih → terima → retur menghasilkan jurnal benar.

## Fase 3 — Pembelian & Utang
- [ ] Master: Pemasok, Kategori Pemasok, Harga Pemasok
- [ ] Pesanan Pembelian
- [ ] Faktur Pembelian
- [ ] Pembayaran Pembelian
- [ ] Retur Pembelian
- [ ] PPN Masukan
- [ ] Laporan: Pembelian, Umur Utang, Kartu Utang

## Fase 4 — Persediaan ⚠️ FASE PALING BERISIKO
- [ ] Master: Gudang, Satuan (bertingkat), Kategori, Merek
- [ ] Barang & Jasa tipe INVENTORY (6 sub-tab lengkap)
- [ ] **Engine costing: AVERAGE + FIFO** dengan advisory lock
- [ ] `inventory_layer` + `inventory_movement`
- [ ] Penerimaan Barang → integrasi ke Faktur Pembelian
- [ ] HPP otomatis di Faktur Penjualan
- [ ] Pemindahan Barang
- [ ] Penyesuaian Persediaan
- [ ] Stok Opname (perintah + hasil)
- [ ] Perhitungan ulang berjenjang (background job)
- [ ] Laporan: Kartu Stok, Nilai Persediaan, Mutasi

**Gerbang mutu:** jalankan seluruh Lampiran B (§12). Semua harus lolos.

## Fase 5 — Alur Dokumen Lengkap
- [ ] Penawaran Penjualan, Pesanan Penjualan
- [ ] Pengiriman Pesanan (+ akun Barang Terkirim)
- [ ] Uang Muka (jual & beli)
- [ ] Tombol **Ambil** & **Proses** antar dokumen
- [ ] `qty_reserved` & `qty_incoming`
- [ ] Approval workflow
- [ ] Lampiran wajib per dokumen

## Fase 6 — Aset Tetap & Periodik
- [ ] Master Aset + Kategori + Kategori Pajak
- [ ] Penyusutan komersial & fiskal
- [ ] Perubahan, Disposisi, Pindah Aset
- [ ] Proses Akhir Bulan (job)
- [ ] Revaluasi selisih kurs
- [ ] Tutup Buku Tahunan

## Fase 7 — Pajak & Laporan Lanjut
- [ ] Faktur Pajak + nomor seri
- [ ] Ekspor CoreTax
- [ ] SPT PPN, bukti potong PPh
- [ ] Engine laporan generik + preset + penjadwalan
- [ ] Semua laporan sisa

## Fase 8 — Lanjutan
- [ ] Multi cabang penuh + konsolidasi
- [ ] Multi mata uang penuh
- [ ] Departemen, Proyek, Kategori Keuangan
- [ ] Anggaran & Monitor Anggaran
- [ ] Produksi (Pekerjaan Pesanan)
- [ ] Transaksi Berulang
- [ ] Rekonsiliasi Bank + smart-pairing
- [ ] Impor data massal
- [ ] Desain Cetakan (template editor)
- [ ] Trade Portal, e-Commerce, e-Payment

---

# 12. UJI KEBENARAN AKUNTANSI

Setiap skenario harus lolos sebelum fase terkait dianggap selesai. Tulis sebagai integration test.

| # | Skenario | Yang diperiksa |
|---|----------|----------------|
| 1 | Jual 10 unit @Rp100.000, HPP @Rp60.000 | Piutang +1.110.000 (dgn PPN 11%), Penjualan +1.000.000, PPN Keluaran +110.000, HPP +600.000, Persediaan −600.000, Neraca balance |
| 2 | Beli 100 unit @Rp50.000 → terima → faktur @Rp52.000 | Sesuai konfigurasi: biaya persediaan jadi 52.000 ATAU tetap 50.000 dengan selisih ke akun varian |
| 3 | FIFO: beli 10@100, beli 10@120, jual 15 | HPP = (10×100)+(5×120) = 1.600. Layer 1 habis, layer 2 sisa 5 |
| 4 | AVERAGE: beli 10@100, beli 10@120, jual 15 | avg = 110. HPP = 15×110 = 1.650. Sisa 5 unit @110 |
| 5 | Retur penjualan 3 dari 10 unit | Nilai HPP kembali sesuai `sales_return_value_basis` |
| 6 | Pindah 50 unit gudang A → B | Total nilai persediaan **tidak berubah**. Kartu stok kedua gudang konsisten |
| 7 | Stok opname: sistem 100, fisik 97 | Jurnal penyesuaian −3 unit senilai biaya saat itu |
| 8 | Jual USD 1.000 @kurs 15.000, terima @kurs 15.200 | Selisih kurs terealisasi 200.000 tercatat di FX_GAIN_LOSS |
| 9 | Proses akhir bulan: aset Rp120jt, 10 tahun garis lurus | Beban penyusutan 1.000.000/bulan. Batalkan → jurnal hilang |
| 10 | Tutup buku tahunan | Semua akun L/R saldo nol. Laba Ditahan bertambah tepat sebesar laba bersih |
| 11 | Ubah faktur bulan lalu yang sudah diposting | Jurnal terbentuk ulang, laporan berubah konsisten, audit log lengkap (before & after) |
| 12 | Dua pengguna posting faktur item sama bersamaan | Tidak ada stok/biaya korup. Salah satu menunggu lock |
| 13 | Posting dokumen 2× (retry jaringan) | Jurnal tidak ganda (idempotensi) |
| 14 | Input transaksi di periode tertutup | Ditolak dengan `PERIOD_CLOSED` |
| 15 | Faktur multi-satuan: jual 2 BOX (1 BOX=144 PCS) | Stok berkurang 288 PCS. HPP dihitung per PCS |
| 16 | Diskon header 10% pada faktur 3 baris | DPP per baris diprorata benar. Total PPN = Σ PPN baris |
| 17 | Faktur tanggal 2025 dengan tarif PPN 11%, tanggal 2026 tarif 12% | Masing-masing pakai tarif sesuai `doc_date` |
| 18 | Pengguna grup B tidak punya hak Faktur Penjualan | Menu tidak muncul; akses langsung via URL/API ditolak 403 |
| 19 | Pengguna hanya boleh cabang Jakarta | Daftar & laporan hanya menampilkan data Jakarta |
| 20 | Jual stok yang tidak cukup | Sesuai kebijakan: ditolak / diperingatkan / diizinkan |

---

# LAMPIRAN A — POHON MENU LENGKAP

```
⚙ Pengaturan
   Preferensi · Akses Grup · Pengguna · Penomoran · Desain Cetakan · Store

🏢 Perusahaan
   Pajak · Syarat Pembayaran · Pengiriman · FOB · Gaji/Tunjangan · Karyawan
   Transaksi Berulang · Proses Akhir Bulan · Kontak · Transaksi Favorit
   Kalender · Log Aktivitas · Cabang · Mata Uang

📖 Buku Besar
   Akun Perkiraan · Pencatatan Beban · Pencatatan Gaji · Jurnal Umum
   Anggaran · Transfer Anggaran · Monitor Anggaran · Histori Akun
   Log Aktivitas Jurnal

🏦 Kas & Bank
   Pembayaran · Penerimaan · Transfer Bank · Rekonsiliasi Bank
   Rekening Koran · Histori Bank · SmartLink e-Banking
   SmartLink Virtual Account · SmartLink e-Payment

🏷 Penjualan
   Penawaran Penjualan · Pesanan Penjualan · Pengiriman Pesanan
   Uang Muka Penjualan · Faktur Penjualan · Penerimaan Penjualan
   Retur Penjualan · Tukar Faktur · Klaim Pelanggan · Pengepakan Barang
   Pelanggan · Kategori Pelanggan · Kategori Penjualan
   Penyesuaian Harga/Diskon · Komisi Penjual · Target Penjualan
   Trade Portal · SmartLink e-Commerce · Check In

🛒 Pembelian
   Pesanan Pembelian · Penerimaan Barang · Uang Muka Pembelian
   Faktur Pembelian · Pembayaran Pembelian · Retur Pembelian
   Klaim Pemasok · Perintah Pembayaran · Transfer Pemasok
   Pemasok · Kategori Pemasok · Harga Pemasok

📦 Persediaan
   Permintaan Barang · Pemindahan Barang · Penyesuaian Persediaan
   Pekerjaan Pesanan · Penambahan Bahan Baku · Penyelesaian Pesanan
   Perintah Stok Opname · Hasil Stok Opname
   Barang & Jasa · Gudang · Satuan Barang · Kategori Barang · Merek Barang
   Pemenuhan Pesanan · Barang per Gudang · Barang Stok Minimum

🏗 Aset Tetap
   Aset Tetap · Kategori Aset · Kategori Aset Tetap Pajak
   Perubahan Aset Tetap · Disposisi Aset Tetap · Pindah Aset
   Aset per Lokasi

🧾 Pajak (SmartLink Tax)
   e-Faktur CTAS · Email Faktur Pajak · SPT PPN/PPnBM
   SPT PPh 21 · SPT PPh 23 · SPT PPh 4(2) · SPT PPh 15
   e-Billing Pajak · e-Filing Pajak

📊 Laporan
   Daftar Laporan · SPT PPN/PPnBM · Analisa AI
```

---

# LAMPIRAN B — GLOSARIUM ISTILAH

| Indonesia | Inggris (kode) | Arti |
|-----------|----------------|------|
| Akun Perkiraan | Account / Chart of Accounts | Daftar akun buku besar |
| Barang & Jasa | Item | Master produk & jasa |
| Beban Pokok Penjualan (BPP) | COGS | Harga pokok barang yang terjual |
| Buku Besar | General Ledger | Kumpulan seluruh jurnal per akun |
| Faktur Penjualan | Sales Invoice | Tagihan ke pelanggan |
| Faktur Pembelian | Purchase Invoice / Bill | Tagihan dari pemasok |
| Jurnal Umum | Journal Voucher | Jurnal manual |
| Kas & Bank | Cash & Bank | Akun likuid |
| Neraca | Balance Sheet | Posisi keuangan |
| Laba Rugi | Income Statement / P&L | Kinerja periode |
| Neraca Percobaan | Trial Balance | Ringkasan saldo semua akun |
| Pemasok | Supplier / Vendor | |
| Penawaran Penjualan | Sales Quotation | |
| Pengiriman Pesanan | Delivery Order (DO) | Surat jalan |
| Penerimaan Barang | Goods Receipt | |
| Penerimaan Penjualan | Sales Receipt | Pelunasan piutang |
| Perkiraan | Account | Sinonim akun |
| Persediaan | Inventory | |
| Pesanan Penjualan | Sales Order (SO) | |
| Pesanan Pembelian | Purchase Order (PO) | |
| Piutang Usaha | Accounts Receivable (AR) | |
| Retur | Return | |
| Stok Opname | Stock Count / Stock Take | Hitung fisik |
| Uang Muka | Down Payment (DP) | |
| Utang Usaha | Accounts Payable (AP) | |
| Syarat Pembayaran | Payment Term | |
| Penyusutan | Depreciation | |
| Aset Tetap | Fixed Asset | |
| Disposisi | Disposal | Pelepasan aset |

---

# LAMPIRAN C — DAFTAR YANG PERLU DIKONFIRMASI

Item bertanda `[TANYA]` atau `[ASUMSI]` yang sebaiknya diverifikasi ke Accurate atau ke pengguna akuntan sebelum implementasi:

| # | Item | Bagian | Dampak jika salah |
|---|------|--------|-------------------|
| 1 | Isi persis 4 panel ikon di form transaksi | §04.3 | Field hilang, harus tambah belakangan |
| 2 | Pembulatan PPN: per baris atau per faktur | §07.5 | Selisih rupiah di faktur |
| 3 | Kebijakan stok negatif | §07.4 | Perilaku berbeda dari ekspektasi pengguna |
| 4 | Fungsi "Tukar Faktur", "Klaim Pelanggan", "Pengepakan Barang" | §10.5 | Salah bangun fitur |
| 5 | Fungsi "Check In" di modul Penjualan | §10.5 | — |
| 6 | Apakah Pengiriman Pesanan selalu pakai akun Barang Terkirim | §07.3 | Jurnal salah |
| 7 | Daftar lengkap 200+ laporan | §10.10 | Laporan kurang |
| 8 | Detail modul Anggaran & Transfer Anggaran | §10.3 | — |
| 9 | Detail Trade Portal (portal reseller) | §10.5 | — |
| 10 | Batas maksimum tab yang dapat dibuka | §03.4 | Performa |
| 11 | Apakah costing method benar-benar terkunci permanen | §06.1 | Keputusan arsitektur |
| 12 | Format ekspor CoreTax terbaru | §10.9 | Ditolak DJP |

**Cara tercepat memverifikasi:** buka akun demo Accurate Online, buka form yang dimaksud, screenshot, lalu perbarui bagian terkait di dokumen ini.
