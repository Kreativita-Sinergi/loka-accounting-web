import type { IconName } from '../components/Icon'

/**
 * Struktur menu mengikuti Accurate Online (Bagian 03 spesifikasi): icon rail
 * sepuluh modul, dan setiap modul membuka flyout berisi ubin. Satu ubin = satu
 * halaman = satu tab dokumen.
 */
export type PageKey = string

export type TileGroup = 'transaction' | 'master' | 'setting' | 'report'

/**
 * Wewenang semu untuk halaman yang selalu boleh dibuka siapa pun — notifikasi
 * dan bantuan tidak memuat data yang perlu dibatasi peran.
 */
export const PUBLIC_PERMISSION = 'public'

export type MenuTile = {
  key: PageKey
  label: string
  icon: IconName
  group: TileGroup
  hint: string
  /** Permission yang harus dimiliki peran untuk membuka halaman ini. */
  view: string
  /** Permission untuk membuat atau mengubah data pada halaman ini. */
  write: string
}

export type MenuModule = {
  id: string
  label: string
  icon: IconName
  tiles: MenuTile[]
}

/**
 * Wewenang bawaan per modul, memakai nama permission yang sama persis dengan
 * yang dipakai router backend. Halaman yang menyimpang dari bawaan modulnya
 * dicatat di `tileOverrides`.
 */
const modulePermissions: Record<string, { view: string; write: string }> = {
  settings: { view: 'accounting.settings.manage', write: 'accounting.settings.manage' },
  company: { view: 'accounting.settings.manage', write: 'accounting.settings.manage' },
  'general-ledger': { view: 'accounting.reports.view', write: 'accounting.journal.create' },
  'cash-bank': { view: 'accounting.bank.view', write: 'accounting.bank.manage' },
  sales: { view: 'accounting.documents.view', write: 'accounting.documents.manage' },
  purchase: { view: 'accounting.documents.view', write: 'accounting.documents.manage' },
  inventory: { view: 'accounting.inventory.view', write: 'accounting.inventory.manage' },
  'fixed-asset': { view: 'accounting.assets.manage', write: 'accounting.assets.manage' },
  tax: { view: 'accounting.localization.view', write: 'accounting.localization.manage' },
  reports: { view: 'accounting.reports.view', write: 'accounting.reports.view' },
}

const tileOverrides: Record<PageKey, Partial<{ view: string; write: string }>> = {
  'settings.activity': { view: 'accounting.audit.view' },
  'company.dashboard': { view: 'accounting.reports.view' },
  'company.monitor': { view: 'accounting.reports.view' },
  'company.project': { view: 'accounting.reports.view', write: 'accounting.dimensions.manage' },
  'company.currency': { view: 'accounting.fx.view', write: 'accounting.fx.manage' },
  'gl.account': { view: 'accounting.coa.manage', write: 'accounting.coa.manage' },
  'gl.budget': { write: 'accounting.budgets.manage' },
  'gl.period': { write: 'accounting.period.close' },
  'cash.reconcile': { write: 'accounting.bank.reconcile' },
  'sales.customer': { view: 'accounting.contacts.view', write: 'accounting.contacts.manage' },
  'purchase.vendor': { view: 'accounting.contacts.view', write: 'accounting.contacts.manage' },
  'sales.receipt': { view: 'accounting.receivables.view', write: 'accounting.receivables.manage' },
  'purchase.payment': { view: 'accounting.payables.view', write: 'accounting.payables.manage' },
  'inventory.joborder': { view: 'accounting.manufacturing.view', write: 'accounting.manufacturing.manage' },
  'inventory.material': { view: 'accounting.manufacturing.view', write: 'accounting.manufacturing.manage' },
  'inventory.rollover': { view: 'accounting.manufacturing.view', write: 'accounting.manufacturing.manage' },
  'tax.payroll': { view: 'accounting.payroll.view', write: 'accounting.payroll.manage' },
}

const tile = (key: string, label: string, icon: IconName, group: TileGroup, hint: string): MenuTile =>
  ({ key, label, icon, group, hint, view: 'accounting.reports.view', write: 'accounting.reports.view' })

export const modules: MenuModule[] = [
  {
    id: 'settings', label: 'Pengaturan', icon: 'settings', tiles: [
      tile('settings.setup', 'Persiapan Data Perusahaan', 'check', 'setting', 'Panduan penyiapan awal'),
      tile('settings.preference', 'Preferensi', 'settings', 'setting', 'Fitur, mata uang, dan format'),
      tile('settings.numbering', 'Penomoran', 'journal', 'setting', 'Template nomor dokumen'),
      tile('settings.import', 'Impor Data', 'download', 'setting', 'Impor dari Excel/CSV'),
      tile('settings.user', 'Pengguna', 'accounts', 'master', 'Pengguna dan undangan'),
      tile('settings.role', 'Peran & Hak Akses', 'compliance', 'setting', 'Wewenang per peran'),
      tile('settings.activity', 'Log Aktivitas', 'ledger', 'report', 'Riwayat perubahan data'),
    ],
  },
  {
    id: 'company', label: 'Perusahaan', icon: 'building', tiles: [
      tile('company.info', 'Info Perusahaan', 'building', 'master', 'Identitas dan alamat'),
      tile('company.branch', 'Cabang', 'building', 'master', 'Daftar cabang'),
      tile('company.department', 'Departemen', 'accounts', 'master', 'Departemen biaya'),
      tile('company.project', 'Proyek', 'project', 'master', 'Proyek dan pekerjaan'),
      tile('company.currency', 'Mata Uang', 'currency', 'setting', 'Kurs dan valuta asing'),
      tile('company.dashboard', 'Dashboard', 'home', 'report', 'Ringkasan perusahaan'),
      tile('company.monitor', 'Pantau Usaha', 'reports', 'report', 'Dashboard pemantauan usaha'),
    ],
  },
  {
    id: 'general-ledger', label: 'Buku Besar', icon: 'journal', tiles: [
      tile('gl.journal', 'Jurnal Umum', 'journal', 'transaction', 'Input jurnal manual'),
      tile('gl.account', 'Akun Perkiraan', 'accounts', 'master', 'Chart of accounts'),
      tile('gl.recurring', 'Jurnal Berulang', 'refresh', 'transaction', 'Template jurnal otomatis'),
      tile('gl.budget', 'Anggaran', 'reports', 'setting', 'Anggaran per akun'),
      tile('gl.ledger', 'Buku Besar', 'ledger', 'report', 'Mutasi per akun'),
      tile('gl.period', 'Tutup Buku', 'compliance', 'setting', 'Periode akuntansi'),
    ],
  },
  {
    id: 'cash-bank', label: 'Kas & Bank', icon: 'bank', tiles: [
      tile('cash.in', 'Kas Masuk', 'bank', 'transaction', 'Penerimaan kas non-penjualan'),
      tile('cash.out', 'Kas Keluar', 'bank', 'transaction', 'Pengeluaran kas non-pembelian'),
      tile('cash.transfer', 'Transfer Kas & Bank', 'operations', 'transaction', 'Pindah dana antar rekening'),
      tile('cash.reconcile', 'Rekonsiliasi Bank', 'check', 'transaction', 'Cocokkan mutasi bank'),
      tile('cash.account', 'Akun Kas & Bank', 'accounts', 'master', 'Rekening perusahaan'),
      tile('cash.history', 'Histori Bank', 'ledger', 'report', 'Mutasi rekening'),
    ],
  },
  {
    id: 'sales', label: 'Penjualan', icon: 'tag', tiles: [
      tile('sales.quote', 'Penawaran Penjualan', 'receipt', 'transaction', 'Quotation ke pelanggan'),
      tile('sales.order', 'Pesanan Penjualan', 'receipt', 'transaction', 'Sales order'),
      tile('sales.delivery', 'Pengiriman Barang', 'operations', 'transaction', 'Surat jalan'),
      tile('sales.invoice', 'Faktur Penjualan', 'receipt', 'transaction', 'Invoice pelanggan'),
      tile('sales.return', 'Retur Penjualan', 'refresh', 'transaction', 'Barang kembali dari pelanggan'),
      tile('sales.receipt', 'Penerimaan Pembayaran', 'bank', 'transaction', 'Pelunasan piutang'),
      tile('sales.downpayment', 'Uang Muka Penjualan', 'currency', 'transaction', 'DP pelanggan'),
      tile('sales.customer', 'Pelanggan', 'accounts', 'master', 'Master pelanggan'),
      tile('sales.price', 'Harga Jual', 'tag', 'setting', 'Daftar harga dan diskon'),
      tile('sales.salesperson', 'Tenaga Penjual', 'accounts', 'master', 'Sales dan komisi'),
      tile('sales.fulfillment', 'Pemenuhan Pesanan', 'boxes', 'report', 'Pesanan siap dikirim'),
    ],
  },
  {
    id: 'purchase', label: 'Pembelian', icon: 'cart', tiles: [
      tile('purchase.requisition', 'Permintaan Pembelian', 'journal', 'transaction', 'Purchase requisition'),
      tile('purchase.order', 'Pesanan Pembelian', 'cart', 'transaction', 'Purchase order'),
      tile('purchase.receipt', 'Penerimaan Barang', 'boxes', 'transaction', 'Goods receipt'),
      tile('purchase.invoice', 'Faktur Pembelian', 'receipt', 'transaction', 'Tagihan pemasok'),
      tile('purchase.payment', 'Pembayaran Pembelian', 'bank', 'transaction', 'Pelunasan utang'),
      tile('purchase.return', 'Retur Pembelian', 'refresh', 'transaction', 'Barang kembali ke pemasok'),
      tile('purchase.downpayment', 'Uang Muka Pembelian', 'currency', 'transaction', 'DP ke pemasok'),
      tile('purchase.payorder', 'Perintah Pembayaran', 'receipt', 'transaction', 'Instruksi transfer'),
      tile('purchase.transfer', 'Transfer Pemasok', 'bank', 'report', 'Antrean transfer bank'),
      tile('purchase.vendor', 'Pemasok', 'accounts', 'master', 'Master pemasok'),
      tile('purchase.vendorprice', 'Harga Pemasok', 'tag', 'setting', 'Harga beli per pemasok'),
      tile('purchase.vendorcategory', 'Kategori Pemasok', 'grid', 'setting', 'Pengelompokan pemasok'),
    ],
  },
  {
    id: 'inventory', label: 'Persediaan', icon: 'boxes', tiles: [
      tile('inventory.item', 'Barang & Jasa', 'boxes', 'master', 'Master barang dan jasa'),
      tile('inventory.warehouse', 'Gudang', 'building', 'master', 'Lokasi stok'),
      tile('inventory.unit', 'Satuan Barang', 'grid', 'master', 'Unit of measure'),
      tile('inventory.category', 'Kategori Barang', 'grid', 'master', 'Pengelompokan barang'),
      tile('inventory.brand', 'Merek Barang', 'tag', 'master', 'Merek barang'),
      tile('inventory.request', 'Permintaan Barang', 'journal', 'transaction', 'Permintaan dari gudang'),
      tile('inventory.transfer', 'Pemindahan Barang', 'operations', 'transaction', 'Transfer antar gudang'),
      tile('inventory.adjustment', 'Penyesuaian Persediaan', 'edit', 'transaction', 'Koreksi kuantitas dan nilai'),
      tile('inventory.joborder', 'Pekerjaan Pesanan', 'manufacturing', 'transaction', 'Job order produksi'),
      tile('inventory.material', 'Penambahan Bahan Baku', 'boxes', 'transaction', 'Ambil bahan untuk produksi'),
      tile('inventory.rollover', 'Penyelesaian Pesanan', 'check', 'transaction', 'Hasil produksi jadi'),
      tile('inventory.opnameorder', 'Perintah Stok Opname', 'journal', 'transaction', 'SPK penghitungan stok'),
      tile('inventory.opnameresult', 'Hasil Stok Opname', 'check', 'transaction', 'Hasil hitung fisik'),
      tile('inventory.stockbywarehouse', 'Barang per Gudang', 'ledger', 'report', 'Saldo stok per gudang'),
      tile('inventory.minimumstock', 'Barang Stok Minimum', 'warning', 'report', 'Barang di bawah batas minimum'),
    ],
  },
  {
    id: 'fixed-asset', label: 'Aset Tetap', icon: 'manufacturing', tiles: [
      tile('fa.asset', 'Aset Tetap', 'asset', 'master', 'Daftar aset dan penyusutan'),
      tile('fa.category', 'Kategori Aset', 'grid', 'master', 'Pengelompokan aset'),
      tile('fa.fiscal', 'Kategori Aset Tetap Pajak', 'compliance', 'master', 'Kelompok penyusutan fiskal'),
      tile('fa.change', 'Perubahan Aset Tetap', 'edit', 'transaction', 'Ubah nilai atau umur aset'),
      tile('fa.disposal', 'Disposisi Aset Tetap', 'trash', 'transaction', 'Pelepasan atau penjualan aset'),
      tile('fa.move', 'Pindah Aset', 'operations', 'transaction', 'Pindah lokasi aset'),
      tile('fa.bylocation', 'Aset per Lokasi', 'ledger', 'report', 'Sebaran aset'),
    ],
  },
  {
    id: 'tax', label: 'Pajak', icon: 'receipt', tiles: [
      tile('tax.indonesia', 'Pajak Indonesia', 'compliance', 'transaction', 'PPN, PPh, dan e-Bupot'),
      tile('tax.efaktur', 'e-Faktur CTAS', 'receipt', 'transaction', 'Integrasi e-Faktur'),
      tile('tax.emailfaktur', 'Email Faktur Pajak', 'operations', 'transaction', 'Kirim faktur pajak'),
      tile('tax.sptppn', 'SPT PPN / PPNBM', 'compliance', 'transaction', 'Rekap masa PPN'),
      tile('tax.code', 'Kode Pajak', 'grid', 'setting', 'Tarif dan kode pajak'),
      tile('tax.payroll', 'Payroll & PPh 21', 'payroll', 'transaction', 'Gaji dan pajak karyawan'),
    ],
  },
  {
    id: 'reports', label: 'Laporan', icon: 'reports', tiles: [
      tile('reports.list', 'Daftar Laporan', 'reports', 'report', 'Semua laporan keuangan'),
      tile('reports.ledger', 'Buku Besar', 'ledger', 'report', 'Mutasi per akun'),
      tile('reports.aging', 'Piutang & Utang', 'operations', 'report', 'Umur piutang dan utang'),
    ],
  },
]

/**
 * Halaman sistem: dibuka dari top bar, bukan dari icon rail, tetapi tetap
 * menjadi tab dokumen biasa sehingga ikut tersimpan di URL dan strip tab.
 */
export const systemTiles: MenuTile[] = [
  { key: 'system.notification', label: 'Notifikasi', icon: 'bell', group: 'report', hint: 'Hal yang perlu ditindaklanjuti', view: PUBLIC_PERMISSION, write: PUBLIC_PERMISSION },
  { key: 'system.help', label: 'Bantuan', icon: 'help', group: 'report', hint: 'Panduan pemakaian dan pintasan papan ketik', view: PUBLIC_PERMISSION, write: PUBLIC_PERMISSION },
]

// Wewenang tiap ubin diselesaikan sekali di sini: bawaan modul, lalu
// penyimpangan per ubin.
const tileIndex = new Map<PageKey, MenuTile>()
for (const module of modules) {
  const fallback = modulePermissions[module.id] ?? { view: 'accounting.reports.view', write: 'accounting.reports.view' }
  for (const item of module.tiles) {
    const override = tileOverrides[item.key] ?? {}
    item.view = override.view ?? fallback.view
    item.write = override.write ?? fallback.write
    if (!tileIndex.has(item.key)) tileIndex.set(item.key, item)
  }
}

for (const item of systemTiles) tileIndex.set(item.key, item)

export const allTiles = [...tileIndex.values()]

export function tileOf(key: PageKey): MenuTile {
  return tileIndex.get(key) ?? { key, label: key, icon: 'empty', group: 'master', hint: '', view: 'accounting.reports.view', write: 'accounting.reports.view' }
}

/** Modul yang memuat sebuah halaman — dipakai untuk menyorot ikon rail aktif. */
export function moduleOf(key: PageKey): string | undefined {
  return modules.find((module) => module.tiles.some((item) => item.key === key))?.id
}

export function isKnownTile(key: string): boolean {
  return tileIndex.has(key)
}

/** Meminta shell membuka tab lain dari dalam halaman (mis. toolbar impor). */
export function requestTab(key: PageKey) {
  window.dispatchEvent(new CustomEvent('loka:open-tab', { detail: key }))
}
