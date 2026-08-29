import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { Button, PageHeader, cx } from '../components/ui'
import { modules, requestTab, type MenuTile, type PageKey } from '../lib/menu'
import { RETENTION_DAYS } from '../lib/notifications'
import { useAccess } from '../lib/rbac'
import { useTabHandle } from '../store/tabs'

/**
 * Pusat bantuan dalam aplikasi. Panduan per modul dirakit dari katalog menu
 * supaya isinya tidak pernah menyimpang dari menu yang benar-benar ada, lalu
 * dilengkapi alur kerja pokok, pintasan papan ketik, dan jalur dukungan.
 */

const workflows: Array<{ title: string; steps: Array<{ label: string; key: PageKey }> }> = [
  {
    title: 'Menyiapkan pembukuan pertama kali',
    steps: [
      { label: 'Isi profil perusahaan', key: 'company.info' },
      { label: 'Periksa daftar akun', key: 'gl.account' },
      { label: 'Masukkan saldo awal lewat panduan persiapan', key: 'settings.setup' },
      { label: 'Atur penomoran dokumen', key: 'settings.numbering' },
      { label: 'Undang tim dan tetapkan peran', key: 'settings.user' },
    ],
  },
  {
    title: 'Siklus penjualan sampai uang masuk',
    steps: [
      { label: 'Buat penawaran atau pesanan penjualan', key: 'sales.order' },
      { label: 'Kirim barang', key: 'sales.delivery' },
      { label: 'Terbitkan faktur penjualan', key: 'sales.invoice' },
      { label: 'Catat penerimaan pembayaran', key: 'sales.receipt' },
      { label: 'Pantau umur piutang', key: 'reports.aging' },
    ],
  },
  {
    title: 'Siklus pembelian sampai uang keluar',
    steps: [
      { label: 'Terbitkan pesanan pembelian', key: 'purchase.order' },
      { label: 'Catat penerimaan barang', key: 'purchase.receipt' },
      { label: 'Catat faktur pembelian', key: 'purchase.invoice' },
      { label: 'Bayar utang pemasok', key: 'purchase.payment' },
    ],
  },
  {
    title: 'Menutup periode',
    steps: [
      { label: 'Cocokkan mutasi bank', key: 'cash.reconcile' },
      { label: 'Periksa buku besar per akun', key: 'gl.ledger' },
      { label: 'Sesuaikan persediaan bila perlu', key: 'inventory.adjustment' },
      { label: 'Cetak laporan keuangan', key: 'reports.list' },
    ],
  },
]

const shortcuts: Array<[string, string]> = [
  ['Ctrl + K', 'Buka pencarian menu dari mana saja'],
  ['↑ ↓ lalu Enter', 'Pilih dan buka menu dari hasil pencarian'],
  ['Esc', 'Menutup pencarian, panel, atau dialog yang terbuka'],
  ['Klik tengah pada tab', 'Menutup tab dokumen tersebut'],
  ['Seret tab', 'Mengubah urutan tab; area kosong strip bisa ditarik seperti peta'],
  ['Roda mouse di strip tab', 'Menggeser tab mendatar'],
]

const faq: Array<[string, string]> = [
  ['Kenapa sebagian menu tidak muncul?', 'Menu disaring menurut peran Anda. Menu yang tidak berwenang dibuka tidak ditampilkan, dan backend tetap menolaknya walau alamatnya dibuka langsung. Minta pemilik akun mengubah peran di Pengaturan → Peran & Hak Akses.'],
  ['Kenapa halaman tertentu bertanda “data belum terhubung”?', 'Tata letaknya sudah selesai, tetapi endpoint backend modul itu masih dibangun bertahap. Tombol simpannya sengaja dimatikan agar tidak ada data yang terlihat tersimpan padahal tidak.'],
  ['Bagaimana notifikasi dihitung?', `Notifikasi dirangkum dari data yang ada: antrean persetujuan, dokumen lewat atau mendekati jatuh tempo, draf yang mengendap, stok minus atau di bawah minimum, undangan tim yang belum diterima, dan langkah persiapan yang belum tuntas. Kejadian yang lebih tua dari ${RETENTION_DAYS} hari — approval, draf, dan undangan — tidak lagi ditampilkan. Dokumen yang lewat jatuh tempo, stok bermasalah, dan langkah persiapan tetap muncul selama belum diberesi.`],
  ['Tab saya hilang setelah membuka banyak halaman.', 'Strip tab menahan paling banyak 15 tab. Saat penuh, tab terlama yang tidak berisi perubahan akan ditutup sendiri. Tab dengan perubahan belum disimpan tidak pernah ditutup otomatis.'],
  ['Data apa yang tersimpan di peramban?', 'Hanya preferensi tampilan — menu yang baru dibuka, saringan dan kolom daftar, serta tanda notifikasi yang sudah dibaca. Seluruh data akuntansi tersimpan di server.'],
]

export function HelpPage() {
  const [query, setQuery] = useState('')
  const { can, role, profile } = useAccess()
  useTabHandle(false)

  const terms = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query])
  const match = (...values: string[]) => {
    if (!terms.length) return true
    const haystack = values.join(' ').toLowerCase()
    return terms.every((term) => haystack.includes(term))
  }

  const guides = useMemo(() => modules
    .map((module) => ({ ...module, tiles: module.tiles.filter((tile) => can(tile.view) && match(module.label, tile.label, tile.hint)) }))
    .filter((module) => module.tiles.length > 0), [can, terms])

  const visibleWorkflows = workflows.filter((flow) => match(flow.title, ...flow.steps.map((step) => step.label)))
  const visibleShortcuts = shortcuts.filter(([keys, description]) => match(keys, description))
  const visibleFaq = faq.filter(([question, answer]) => match(question, answer))
  const nothing = !guides.length && !visibleWorkflows.length && !visibleShortcuts.length && !visibleFaq.length

  return (
    <section className="help-page">
      <PageHeader
        eyebrow="Bantuan"
        title="Panduan pemakaian"
        description="Cari menu, ikuti alur kerja pokok, dan lihat pintasan papan ketik. Klik nama menu mana pun untuk langsung membukanya sebagai tab."
        action={<Button variant="secondary" icon="check" onClick={() => requestTab('settings.setup')}>Buka panduan persiapan</Button>}
      />

      <label className="help-search">
        <Icon name="search" />
        <input value={query} placeholder="Cari bantuan — misal: faktur, jatuh tempo, pintasan…" onChange={(event) => setQuery(event.target.value)} />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="Kosongkan pencarian"><Icon name="close" /></button>}
      </label>

      {nothing && <div className="panel help-card"><p className="m-0 text-[12px] text-[color:var(--fg-muted)]">Tidak ada bantuan yang cocok dengan “{query}”. Coba kata kunci lain, atau hubungi dukungan di bawah.</p></div>}

      {visibleWorkflows.length > 0 && (
        <div className="help-section">
          <h2>Alur kerja pokok</h2>
          <div className="help-grid">
            {visibleWorkflows.map((flow) => (
              <div className="panel help-card" key={flow.title}>
                <h3>{flow.title}</h3>
                <ol className="help-steps">
                  {flow.steps.map((step) => (
                    <li key={step.key}><button type="button" onClick={() => requestTab(step.key)}>{step.label}</button></li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}

      {guides.length > 0 && (
        <div className="help-section">
          <h2>Menu per modul</h2>
          <div className="help-grid">
            {guides.map((module) => (
              <div className="panel help-card" key={module.id}>
                <h3><Icon name={module.icon} /> {module.label}</h3>
                <ul className="help-tiles">
                  {module.tiles.map((tile: MenuTile) => (
                    <li key={`${module.id}-${tile.key}`}>
                      <button type="button" onClick={() => requestTab(tile.key)}>{tile.label}</button>
                      <small>{tile.hint}</small>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {visibleShortcuts.length > 0 && (
        <div className="help-section">
          <h2>Pintasan papan ketik</h2>
          <div className="panel help-card">
            <dl className="help-keys">
              {visibleShortcuts.map(([keys, description]) => (
                <div key={keys}>
                  <dt>{keys.split(' + ').map((part) => <kbd key={part}>{part}</kbd>)}</dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {visibleFaq.length > 0 && (
        <div className="help-section">
          <h2>Pertanyaan yang sering muncul</h2>
          <div className="panel help-card">
            {visibleFaq.map(([question, answer]) => (
              <details key={question} className={cx('help-faq')}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      <div className="help-section">
        <h2>Dukungan</h2>
        <div className="panel help-card help-support">
          <p>
            Masih tersangkut? Kirim surel ke <a href="mailto:help@lokakasir.id">help@lokakasir.id</a> dan sertakan nama menu,
            langkah yang Anda lakukan, serta pesan galat yang muncul.
          </p>
          <dl>
            <div><dt>Organisasi</dt><dd>{profile?.organization_name ?? '—'}</dd></div>
            <div><dt>Pengguna</dt><dd>{profile?.full_name ?? '—'}</dd></div>
            <div><dt>Peran</dt><dd>{role?.label ?? profile?.role_code ?? '—'}</dd></div>
          </dl>
        </div>
      </div>
    </section>
  )
}
