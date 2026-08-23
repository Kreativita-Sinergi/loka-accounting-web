import type { IconName } from '../components/Icon'

/**
 * Navigasi mengikuti Bagian 03 spesifikasi: icon rail modul di kiri, dan setiap
 * modul membuka flyout berisi ubin. Satu ubin = satu halaman = satu tab dokumen.
 */
export type PageKey =
  | 'overview' | 'get-started' | 'accounts' | 'journal' | 'ledger' | 'operations' | 'products'
  | 'documents' | 'controls' | 'advanced' | 'compliance' | 'payroll' | 'manufacturing'
  | 'currency' | 'reports' | 'projects' | 'assets' | 'imports'

export type TileGroup = 'transaction' | 'master' | 'setting' | 'report'

export type MenuTile = {
  key: PageKey
  label: string
  icon: IconName
  group: TileGroup
  hint: string
}

export type MenuModule = {
  id: string
  label: string
  icon: IconName
  tiles: MenuTile[]
}

export const modules: MenuModule[] = [
  { id: 'settings', label: 'Pengaturan', icon: 'settings', tiles: [
    { key: 'get-started', label: 'Mulai Setup', icon: 'check', group: 'setting', hint: 'Panduan penyiapan awal' },
    { key: 'advanced', label: 'Pengaturan Lanjut', icon: 'settings', group: 'setting', hint: 'Preferensi & fitur' },
    { key: 'imports', label: 'Impor Data', icon: 'upload', group: 'setting', hint: 'Impor dari Excel/CSV' },
  ]},
  { id: 'company', label: 'Perusahaan', icon: 'building', tiles: [
    { key: 'controls', label: 'Organisasi', icon: 'building', group: 'master', hint: 'Cabang, departemen, pengguna' },
    { key: 'overview', label: 'Dashboard', icon: 'home', group: 'report', hint: 'Ringkasan perusahaan' },
  ]},
  { id: 'general-ledger', label: 'Buku Besar', icon: 'journal', tiles: [
    { key: 'journal', label: 'Jurnal Umum', icon: 'journal', group: 'transaction', hint: 'Input jurnal manual' },
    { key: 'accounts', label: 'Akun Perkiraan', icon: 'accounts', group: 'master', hint: 'Daftar akun (COA)' },
    { key: 'ledger', label: 'Buku Besar', icon: 'ledger', group: 'report', hint: 'Mutasi per akun' },
  ]},
  { id: 'cash-bank', label: 'Kas & Bank', icon: 'bank', tiles: [
    { key: 'operations', label: 'Piutang & Utang', icon: 'operations', group: 'transaction', hint: 'Penerimaan & pembayaran' },
    { key: 'currency', label: 'Mata Uang', icon: 'currency', group: 'setting', hint: 'Multi-currency & kurs' },
  ]},
  { id: 'sales', label: 'Penjualan', icon: 'tag', tiles: [
    { key: 'documents', label: 'Dokumen Penjualan', icon: 'receipt', group: 'transaction', hint: 'SO, pengiriman, faktur' },
    { key: 'projects', label: 'Proyek', icon: 'project', group: 'master', hint: 'Proyek & pekerjaan' },
  ]},
  { id: 'purchase', label: 'Pembelian', icon: 'cart', tiles: [
    { key: 'documents', label: 'Dokumen Pembelian', icon: 'cart', group: 'transaction', hint: 'PO, penerimaan, tagihan' },
    { key: 'payroll', label: 'Payroll', icon: 'payroll', group: 'transaction', hint: 'Gaji & tunjangan' },
  ]},
  { id: 'inventory', label: 'Persediaan', icon: 'boxes', tiles: [
    { key: 'products', label: 'Barang & Jasa', icon: 'boxes', group: 'master', hint: 'Item, gudang, stok' },
    { key: 'manufacturing', label: 'Manufaktur', icon: 'manufacturing', group: 'transaction', hint: 'BOM & produksi' },
  ]},
  { id: 'fixed-asset', label: 'Aset Tetap', icon: 'manufacturing', tiles: [
    { key: 'assets', label: 'Aset Tetap', icon: 'asset', group: 'master', hint: 'Aset & penyusutan' },
  ]},
  { id: 'tax', label: 'Pajak', icon: 'receipt', tiles: [
    { key: 'compliance', label: 'Pajak Indonesia', icon: 'compliance', group: 'transaction', hint: 'PPN, PPh, e-Faktur' },
  ]},
  { id: 'reports', label: 'Laporan', icon: 'reports', tiles: [
    { key: 'reports', label: 'Laporan Keuangan', icon: 'reports', group: 'report', hint: 'Neraca, laba rugi, arus kas' },
    { key: 'ledger', label: 'Buku Besar', icon: 'ledger', group: 'report', hint: 'Mutasi per akun' },
  ]},
]

const tileIndex = new Map<PageKey, MenuTile>()
for (const module of modules) for (const tile of module.tiles) if (!tileIndex.has(tile.key)) tileIndex.set(tile.key, tile)

export function tileOf(key: PageKey): MenuTile {
  return tileIndex.get(key) ?? { key, label: key, icon: 'empty', group: 'master', hint: '' }
}

/** Modul yang memuat sebuah halaman — dipakai untuk menyorot ikon rail aktif. */
export function moduleOf(key: PageKey): string | undefined {
  return modules.find((module) => module.tiles.some((tile) => tile.key === key))?.id
}

/** Meminta shell membuka tab lain dari dalam halaman (mis. toolbar impor). */
export function requestTab(key: PageKey) {
  window.dispatchEvent(new CustomEvent('loka:open-tab', { detail: key }))
}
