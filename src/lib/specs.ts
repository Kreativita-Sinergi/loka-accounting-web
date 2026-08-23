import type { IconName } from '../components/Icon'

/**
 * Spesifikasi layar hasil observasi Accurate Online. Layar yang backend-nya
 * belum ada dirender dari spesifikasi ini oleh ScaffoldPage sehingga tata
 * letaknya sudah sama persis, tanpa memalsukan data.
 */
export type FieldType = 'text' | 'date' | 'select' | 'lookup' | 'number' | 'textarea' | 'checkbox' | 'toggle'

export type Field = {
  label: string
  type: FieldType
  required?: boolean
  options?: string[]
  value?: string
  placeholder?: string
  suffix?: string
  full?: boolean
}

export type Column = { label: string; align?: 'right'; width?: string }
export type Panel = { key: string; label: string; icon: IconName; fields?: Field[] }
export type Section = { title?: string; fields: Field[] }

export type Spec =
  | { kind: 'list'; filters?: Field[]; actions?: string[]; columns: Column[]; empty?: string; footer?: string[] }
  | { kind: 'transaction'; numberLabel: string; numberTemplate: string; header: Field[]; panels: Panel[]; columns: Column[]; totals?: string[]; pull?: string }
  | { kind: 'master'; tabs: Array<{ label: string; sections: Section[] }> }
  | { kind: 'info'; title: string; body: string; action?: string }

const date = (label: string, required = true): Field => ({ label, type: 'date', required, value: new Date().toISOString().slice(0, 10) })
const lookup = (label: string, required = false): Field => ({ label, type: 'lookup', required, placeholder: 'Cari/Pilih…' })
const text = (label: string, required = false): Field => ({ label, type: 'text', required })

export const specs: Record<string, Spec> = {
  // ---- Pembelian ----
  'purchase.payorder': {
    kind: 'transaction',
    numberLabel: 'No Bukti #',
    numberTemplate: 'Perintah Pembayaran',
    header: [date('Tgl Batas Transfer'), { label: 'Metode Bayar', type: 'select', options: ['Transfer Bank', 'Tunai', 'Giro'] }],
    panels: [
      { key: 'lines', label: 'Faktur', icon: 'journal' },
      { key: 'info', label: 'Info', icon: 'empty', fields: [lookup('Pemasok'), text('Keterangan')] },
    ],
    columns: [
      { label: 'No. Faktur' }, { label: 'Tgl Faktur' }, { label: 'Total Faktur', align: 'right' },
      { label: 'Terutang', align: 'right' }, { label: 'Bayar', align: 'right' }, { label: 'Diskon', align: 'right' },
      { label: 'Pembayaran', align: 'right' }, { label: 'Nama Pemasok' },
    ],
    pull: 'Ambil',
    totals: ['Total Pembayaran'],
  },
  'purchase.transfer': {
    kind: 'list',
    filters: [
      { label: 'Status', type: 'select', options: ['Belum Dibayar', 'Sudah Dibayar', 'Semua'] },
      { label: 'Periode', type: 'select', options: ['7 hari terakhir', '30 hari terakhir', 'Bulan ini'] },
    ],
    columns: [
      { label: 'Tgl Batas Transfer' }, { label: 'Pemasok' }, { label: 'Metode Bayar' }, { label: 'Bank' },
      { label: 'No Rekening Pemasok' }, { label: 'A/n Rekening' }, { label: 'Nilai Pembayaran', align: 'right' }, { label: 'Proses' },
    ],
    footer: ['Total', 'Export/Bayar'],
  },
  'purchase.vendorcategory': {
    kind: 'master',
    tabs: [{ label: 'Kategori Pemasok', sections: [{ fields: [text('Nama', true), { label: 'Kategori Default', type: 'checkbox' }] }] }],
  },
  'purchase.vendorprice': {
    kind: 'list',
    filters: [{ label: 'Pemasok', type: 'lookup' }],
    columns: [{ label: 'Pemasok' }, { label: 'Nama Barang' }, { label: 'Kode #' }, { label: 'Satuan' }, { label: 'Harga', align: 'right' }, { label: 'Berlaku Sejak' }],
  },
  'purchase.downpayment': {
    kind: 'transaction',
    numberLabel: 'Nomor #',
    numberTemplate: 'Uang Muka Pembelian',
    header: [lookup('Pemasok', true), date('Tanggal')],
    panels: [{ key: 'lines', label: 'Rincian', icon: 'journal' }, { key: 'info', label: 'Info', icon: 'empty', fields: [lookup('Akun Kas/Bank', true), text('Keterangan')] }],
    columns: [{ label: 'Keterangan' }, { label: 'Pesanan Pembelian' }, { label: 'Jumlah', align: 'right' }],
    totals: ['Total Uang Muka'],
  },

  // ---- Persediaan ----
  'inventory.request': {
    kind: 'transaction',
    numberLabel: 'Nomor #',
    numberTemplate: 'Permintaan Barang',
    header: [date('Tanggal'), { label: 'Tipe Permintaan', type: 'select', options: ['Beli Barang', 'Ambil dari Gudang'] }],
    panels: [{ key: 'lines', label: 'Rincian Barang', icon: 'journal' }, { key: 'info', label: 'Info', icon: 'empty', fields: [lookup('Cabang'), lookup('Departemen'), text('Keterangan')] }],
    columns: [{ label: 'Nama Barang' }, { label: 'Kode #' }, { label: 'Kuantitas', align: 'right' }, { label: 'Satuan' }, { label: 'Tgl Diminta' }],
    pull: 'Ambil',
  },
  'inventory.opnameorder': {
    kind: 'master',
    tabs: [{
      label: 'Perintah Stok Opname',
      sections: [
        { fields: [lookup('Cabang', true), date('Tanggal Mulai'), text('Penanggung Jawab', true), lookup('Dikerjakan oleh', true), { label: 'Keterangan', type: 'textarea', full: true }] },
        { title: 'Filter Barang', fields: [lookup('Gudang', true), lookup('Kategori Barang'), lookup('Pemasok Barang'), lookup('Merek Barang')] },
      ],
    }],
  },
  'inventory.opnameresult': {
    kind: 'transaction',
    numberLabel: 'No. Opname #',
    numberTemplate: 'Hasil Stok Opname',
    header: [date('Tanggal Opname'), lookup('Perintah Opname', true)],
    panels: [{ key: 'lines', label: 'Rincian Barang', icon: 'journal' }, { key: 'info', label: 'Info', icon: 'empty', fields: [lookup('Gudang', true), text('Keterangan')] }],
    columns: [{ label: 'Kode #' }, { label: 'Nama Barang' }, { label: 'Kuantitas', align: 'right' }, { label: 'Satuan' }],
    pull: 'Ambil',
  },
  'inventory.minimumstock': {
    kind: 'list',
    filters: [{ label: 'Pemasok', type: 'lookup' }, { label: 'Gudang', type: 'lookup' }],
    actions: ['Pesan', 'Minta'],
    columns: [
      { label: 'Pemasok' }, { label: 'Nama Barang' }, { label: 'Kode Barang' }, { label: 'Satuan' },
      { label: 'Stok tersedia', align: 'right' }, { label: 'Dipesan', align: 'right' }, { label: 'Diminta', align: 'right' }, { label: 'Batas Minimum Stok', align: 'right' },
    ],
  },
  'sales.fulfillment': {
    kind: 'list',
    filters: [{ label: 'Cabang', type: 'select', options: ['[Semua Cabang]'] }, { label: 'Gudang', type: 'select', options: ['[Semua Gudang]'] }],
    actions: ['Perlu Pesan'],
    columns: [{ label: 'Pelanggan' }, { label: 'No Pesanan #' }, { label: 'Tanggal' }, { label: 'Tgl Pengiriman' }, { label: 'Terkirim', align: 'right' }, { label: 'Dapat Dikirim', align: 'right' }],
  },

  // ---- Aset Tetap ----
  'fa.category': { kind: 'master', tabs: [{ label: 'Informasi Umum', sections: [{ fields: [text('Nama', true)] }] }] },
  'fa.fiscal': {
    kind: 'master',
    tabs: [{
      label: 'Informasi umum',
      sections: [{ fields: [
        text('Nama', true),
        { label: 'Metode Penyusutan', type: 'select', options: ['Metode Garis Lurus', 'Saldo Menurun', 'Tidak Terdepresiasi'] },
        { label: 'Perkiraan Umur', type: 'number', suffix: 'Tahun' },
        { label: 'Tarif Penyusutan', type: 'number', suffix: '%' },
      ] }],
    }],
  },
  'fa.change': {
    kind: 'transaction',
    numberLabel: 'Nomor #',
    numberTemplate: 'Perubahan Aset Tetap',
    header: [{ label: 'Jenis Perubahan', type: 'select', options: ['Data', 'Nilai', 'Umur'] }, lookup('Aset', true), date('Tanggal')],
    panels: [{
      key: 'general', label: 'Informasi umum', icon: 'journal', fields: [
        { label: 'Metode Penyusutan', type: 'select', options: ['Tidak Terdepresiasi', 'Metode Garis Lurus', 'Saldo Menurun'] },
        { label: 'Nilai Sisa', type: 'number' },
        { label: 'Keterangan Perubahan', type: 'textarea', full: true },
      ],
    }],
    columns: [],
  },
  'fa.disposal': {
    kind: 'transaction',
    numberLabel: 'Nomor #',
    numberTemplate: 'Disposisi Aset Tetap',
    header: [lookup('Aset', true), date('Tanggal')],
    panels: [{
      key: 'general', label: 'Informasi umum', icon: 'journal', fields: [
        { label: 'Kuantitas', type: 'number', required: true },
        lookup('Akun Laba Rugi', true),
        lookup('Lokasi Aset'),
        { label: 'Aset Dijual', type: 'checkbox' },
        { label: 'Catatan', type: 'textarea', full: true },
      ],
    }],
    columns: [],
  },
  'fa.move': {
    kind: 'transaction',
    numberLabel: 'No. Pemindahan #',
    numberTemplate: 'Pindah Aset',
    header: [date('Tanggal'), lookup('Alamat Asal', true), lookup('Alamat Tujuan', true)],
    panels: [{ key: 'lines', label: 'Detail Aset', icon: 'journal' }],
    columns: [{ label: 'Kode Aset' }, { label: 'Deskripsi Aset' }, { label: 'Kuantitas', align: 'right' }, { label: 'Keterangan' }],
  },
  'fa.bylocation': {
    kind: 'list',
    filters: [{ label: 'Tampilan', type: 'select', options: ['Aset', 'Lokasi'] }, { label: 'Aset', type: 'lookup' }, { label: 'Per Tanggal', type: 'date' }],
    columns: [{ label: 'Nama' }, { label: 'Alamat' }, { label: 'Kuantitas', align: 'right' }],
  },

  // ---- Pajak ----
  'tax.efaktur': {
    kind: 'info',
    title: 'e-Faktur Pajak',
    body: 'Sebelum dapat melaporkan e-Faktur secara elektronik, database perlu dihubungkan dengan Penyedia Jasa Aplikasi Perpajakan (PJAP).',
    action: 'Hubungkan',
  },
  'tax.emailfaktur': {
    kind: 'list',
    filters: [{ label: 'Pelanggan', type: 'lookup' }, { label: 'Faktur', type: 'lookup' }],
    actions: ['Email Faktur Pajak'],
    columns: [{ label: 'Pelanggan' }, { label: 'No. Faktur Pajak' }, { label: 'Tanggal' }, { label: 'No Faktur #' }, { label: 'Email' }],
  },
  'tax.sptppn': {
    kind: 'transaction',
    numberLabel: 'Nomor #',
    numberTemplate: 'SPT PPN/PPNBM',
    header: [date('Tgl Pajak'), date('s/d'), { label: 'Tipe', type: 'select', options: ['Pajak Masukan dan Keluaran', 'Pajak Keluaran', 'Pajak Masukan'] }],
    panels: [{ key: 'out', label: 'Pajak Keluaran', icon: 'receipt' }, { key: 'in', label: 'Pajak Masukan', icon: 'compliance' }],
    columns: [
      { label: 'No. Faktur Pajak' }, { label: 'No Faktur #' }, { label: 'Tgl Pajak' }, { label: 'Tipe Transaksi' },
      { label: 'Detail Transaksi' }, { label: 'DPP', align: 'right' }, { label: 'PPN', align: 'right' }, { label: 'Pelanggan' },
    ],
  },
  'tax.code': {
    kind: 'master',
    tabs: [{ label: 'Kode Pajak', sections: [{ fields: [text('Kode', true), text('Nama', true), { label: 'Tarif', type: 'number', suffix: '%' }, lookup('Akun Pajak', true)] }] }],
  },

  // ---- Kas & Bank ----
  'cash.in': {
    kind: 'transaction',
    numberLabel: 'Nomor #',
    numberTemplate: 'Kas Masuk',
    header: [lookup('Akun Kas/Bank', true), date('Tanggal'), lookup('Diterima Dari')],
    panels: [{ key: 'lines', label: 'Rincian', icon: 'journal' }, { key: 'info', label: 'Info', icon: 'empty', fields: [lookup('Cabang'), lookup('Departemen'), text('Keterangan')] }],
    columns: [{ label: 'Akun' }, { label: 'Keterangan' }, { label: 'Departemen' }, { label: 'Jumlah', align: 'right' }],
    totals: ['Total Penerimaan'],
  },
  'cash.out': {
    kind: 'transaction',
    numberLabel: 'Nomor #',
    numberTemplate: 'Kas Keluar',
    header: [lookup('Akun Kas/Bank', true), date('Tanggal'), lookup('Dibayar Kepada')],
    panels: [{ key: 'lines', label: 'Rincian', icon: 'journal' }, { key: 'info', label: 'Info', icon: 'empty', fields: [lookup('Cabang'), lookup('Departemen'), text('Keterangan')] }],
    columns: [{ label: 'Akun' }, { label: 'Keterangan' }, { label: 'Departemen' }, { label: 'Jumlah', align: 'right' }],
    totals: ['Total Pengeluaran'],
  },
  'cash.transfer': {
    kind: 'transaction',
    numberLabel: 'Nomor #',
    numberTemplate: 'Transfer Kas & Bank',
    header: [lookup('Dari Akun', true), lookup('Ke Akun', true), date('Tanggal')],
    panels: [{ key: 'general', label: 'Informasi umum', icon: 'journal', fields: [{ label: 'Jumlah', type: 'number', required: true }, { label: 'Biaya Transfer', type: 'number' }, { label: 'Keterangan', type: 'textarea', full: true }] }],
    columns: [],
  },
  'cash.reconcile': {
    kind: 'list',
    filters: [{ label: 'Akun Bank', type: 'lookup' }, { label: 'Periode', type: 'date' }],
    actions: ['Rekonsiliasi'],
    columns: [{ label: 'Tanggal' }, { label: 'Nomor' }, { label: 'Keterangan' }, { label: 'Debit', align: 'right' }, { label: 'Kredit', align: 'right' }, { label: 'Status' }],
  },
  'cash.history': {
    kind: 'list',
    filters: [{ label: 'Akun Bank', type: 'lookup' }, { label: 'Periode', type: 'date' }],
    columns: [{ label: 'Tanggal' }, { label: 'Nomor' }, { label: 'Keterangan' }, { label: 'Masuk', align: 'right' }, { label: 'Keluar', align: 'right' }, { label: 'Saldo', align: 'right' }],
  },

  // ---- Penjualan & master lain ----
  'sales.downpayment': {
    kind: 'transaction',
    numberLabel: 'Nomor #',
    numberTemplate: 'Uang Muka Penjualan',
    header: [lookup('Pelanggan', true), date('Tanggal')],
    panels: [{ key: 'lines', label: 'Rincian', icon: 'journal' }, { key: 'info', label: 'Info', icon: 'empty', fields: [lookup('Akun Kas/Bank', true), text('Keterangan')] }],
    columns: [{ label: 'Keterangan' }, { label: 'Pesanan Penjualan' }, { label: 'Jumlah', align: 'right' }],
    totals: ['Total Uang Muka'],
  },
  'sales.price': {
    kind: 'list',
    filters: [{ label: 'Kategori', type: 'lookup' }, { label: 'Merek', type: 'lookup' }],
    columns: [{ label: 'Nama Barang' }, { label: 'Kode #' }, { label: 'Satuan' }, { label: 'Harga Jual', align: 'right' }, { label: 'Diskon' }],
  },
  'sales.salesperson': {
    kind: 'master',
    tabs: [{ label: 'Tenaga Penjual', sections: [{ fields: [text('Nama', true), text('Kode'), lookup('Cabang'), { label: 'Komisi', type: 'number', suffix: '%' }] }] }],
  },
  'settings.numbering': {
    kind: 'list',
    columns: [{ label: 'Jenis Dokumen' }, { label: 'Prefiks' }, { label: 'Nomor Berikutnya', align: 'right' }, { label: 'Padding', align: 'right' }, { label: 'Reset' }],
  },
  'settings.role': {
    kind: 'list',
    columns: [{ label: 'Peran' }, { label: 'Deskripsi' }, { label: 'Jumlah Pengguna', align: 'right' }],
  },
  'settings.activity': {
    kind: 'list',
    filters: [{ label: 'Pengguna', type: 'lookup' }, { label: 'Periode', type: 'date' }],
    columns: [{ label: 'Waktu' }, { label: 'Pengguna' }, { label: 'Aksi' }, { label: 'Entitas' }, { label: 'Keterangan' }],
  },
  'company.branch': {
    kind: 'master',
    tabs: [{ label: 'Cabang', sections: [{ fields: [text('Nama', true), text('Kode', true), { label: 'Alamat', type: 'textarea', full: true }, text('Penanggung Jawab')] }] }],
  },
  'company.department': {
    kind: 'master',
    tabs: [{ label: 'Departemen', sections: [{ fields: [text('Nama', true), text('Kode', true), lookup('Cabang')] }] }],
  },
  'gl.recurring': {
    kind: 'list',
    columns: [{ label: 'Nama Template' }, { label: 'Frekuensi' }, { label: 'Jalan Berikutnya' }, { label: 'Nilai', align: 'right' }, { label: 'Status' }],
  },
  'gl.budget': {
    kind: 'list',
    filters: [{ label: 'Tahun', type: 'select', options: ['2026', '2025'] }],
    columns: [{ label: 'Akun' }, { label: 'Nama Akun' }, { label: 'Anggaran', align: 'right' }, { label: 'Realisasi', align: 'right' }, { label: 'Selisih', align: 'right' }],
  },
  'gl.period': {
    kind: 'list',
    columns: [{ label: 'Periode' }, { label: 'Mulai' }, { label: 'Selesai' }, { label: 'Status' }, { label: 'Dikunci Oleh' }],
  },
}

/** Spesifikasi cadangan bila sebuah ubin belum punya rancangan sendiri. */
export function fallbackSpec(label: string, group: string): Spec {
  if (group === 'transaction') {
    return {
      kind: 'transaction',
      numberLabel: 'Nomor #',
      numberTemplate: label,
      header: [date('Tanggal'), lookup('Mitra')],
      panels: [{ key: 'lines', label: 'Rincian', icon: 'journal' }, { key: 'info', label: 'Info', icon: 'empty', fields: [lookup('Cabang'), text('Keterangan')] }],
      columns: [{ label: 'Keterangan' }, { label: 'Kuantitas', align: 'right' }, { label: 'Jumlah', align: 'right' }],
      totals: ['Total'],
    }
  }
  if (group === 'master') {
    return { kind: 'master', tabs: [{ label, sections: [{ fields: [text('Nama', true), text('Kode'), { label: 'Keterangan', type: 'textarea', full: true }] }] }] }
  }
  return { kind: 'list', columns: [{ label: 'Nama' }, { label: 'Keterangan' }, { label: 'Nilai', align: 'right' }] }
}
