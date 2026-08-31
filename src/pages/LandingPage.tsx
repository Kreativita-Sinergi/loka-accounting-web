type LandingPageProps = {
  onLogin: () => void
  onRegister: () => void
}

const featureGroups = [
  {
    number: '01',
    title: 'Laporan yang langsung bisa dibaca',
    description: 'Pantau laba rugi, neraca, arus kas, buku besar, dan neraca saldo dari transaksi yang sama—tanpa menyusun ulang spreadsheet.',
    items: ['Laba rugi & neraca', 'Arus kas langsung dan tidak langsung', 'Buku besar & neraca saldo'],
  },
  {
    number: '02',
    title: 'Penjualan dan pembelian terhubung',
    description: 'Kelola alur dari penawaran dan pesanan hingga invoice, retur, penerimaan, pembayaran, serta umur piutang dan utang.',
    items: ['Invoice & pembayaran', 'Piutang/utang jatuh tempo', 'Pelanggan & pemasok'],
  },
  {
    number: '03',
    title: 'Kas dan bank lebih terkendali',
    description: 'Catat penerimaan, pembayaran, dan transfer. Impor mutasi lalu cocokkan transaksi melalui rekonsiliasi bank.',
    items: ['Kas masuk & keluar', 'Impor mutasi bank', 'Rekonsiliasi transaksi'],
  },
  {
    number: '04',
    title: 'Stok sampai aset tetap',
    description: 'Nilai persediaan, kartu stok, gudang, penyesuaian, dan aset tetap berada dalam satu sistem pembukuan.',
    items: ['Kartu & valuasi stok', 'Multi-gudang dan satuan', 'Penyusutan aset tetap'],
  },
  {
    number: '05',
    title: 'Kontrol untuk tim keuangan',
    description: 'Atur peran, kunci periode, jejak audit, persetujuan, dan autentikasi dua faktor agar perubahan tetap dapat ditelusuri.',
    items: ['Hak akses berbasis peran', 'Kunci periode & audit trail', 'MFA dan undangan tim'],
  },
  {
    number: '06',
    title: 'Analisis bisnis lebih dalam',
    description: 'Gunakan proyek, departemen, anggaran, pajak, mata uang, dan dimensi untuk melihat angka sesuai cara bisnis bekerja.',
    items: ['Anggaran & profitabilitas proyek', 'Pajak dan multi-currency', 'Dimensi & departemen'],
  },
]

const faqs = [
  ['Apakah harus memakai Loka Kasir?', 'Tidak. Loka Accounting dapat digunakan sebagai aplikasi pembukuan mandiri. Integrasi Loka Kasir bersifat opsional.'],
  ['Apakah cocok untuk bisnis Indonesia?', 'Ya. Tersedia chart of accounts awal, format Rupiah, profil pajak Indonesia, periode fiskal, serta impor dan ekspor data untuk membantu proses akuntansi.'],
  ['Bisakah digunakan bersama tim?', 'Bisa. Pemilik dapat mengundang anggota, mengatur peran dan wewenang, mengaktifkan MFA, serta meninjau jejak perubahan.'],
  ['Bagaimana memindahkan data yang sudah ada?', 'Gunakan template impor untuk akun dan data operasional yang didukung. Data laporan juga dapat diekspor untuk kebutuhan pemeriksaan lebih lanjut.'],
]

export function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  return (
    <main className="accounting-landing">
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="Loka Accounting — kembali ke atas">
          <img src="/loka-icon.svg" alt="" />
          <span><strong>Loka</strong> Accounting</span>
        </a>
        <nav aria-label="Navigasi utama">
          <a href="#features">Fitur</a>
          <a href="#workflow">Cara kerja</a>
          <a href="#security">Keamanan</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="landing-nav-actions">
          <button className="landing-link-button" type="button" onClick={onLogin}>Masuk</button>
          <button className="landing-button compact" type="button" onClick={onRegister}>Mulai sekarang</button>
        </div>
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <p className="landing-kicker"><span /> AKUNTANSI UNTUK BISNIS INDONESIA</p>
          <h1>Angka bisnis yang rapi.<br /><em>Keputusan jadi lebih pasti.</em></h1>
          <p className="landing-lead">Dari transaksi harian sampai laporan keuangan, Loka Accounting membantu pemilik dan tim keuangan bekerja dalam satu alur yang dapat ditelusuri.</p>
          <div className="landing-hero-actions">
            <button className="landing-button" type="button" onClick={onRegister}>Buat organisasi <span aria-hidden="true">→</span></button>
            <button className="landing-button secondary" type="button" onClick={() => document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' })}>Lihat semua fitur</button>
          </div>
          <div className="landing-assurances" aria-label="Keunggulan utama">
            <span>✓ Bisa digunakan mandiri</span>
            <span>✓ Siap untuk kolaborasi tim</span>
            <span>✓ Integrasi Loka Kasir opsional</span>
          </div>
        </div>

        <div className="landing-product-preview" aria-label="Pratinjau dashboard Loka Accounting">
          <div className="preview-window">
            <div className="preview-topbar"><img src="/loka-icon.svg" alt="" /><span>Loka Accounting</span><i /><i /><i /></div>
            <div className="preview-body">
              <aside><b>◈</b><b>⌁</b><b>↗</b><b>▦</b><b>⚙</b></aside>
              <div className="preview-content">
                <div className="preview-heading"><div><small>RINGKASAN BISNIS</small><strong>Pemantauan usaha</strong></div><span>Agustus 2026⌄</span></div>
                <div className="preview-metrics">
                  <article><small>PENDAPATAN</small><strong>Rp248,4 jt</strong><span className="up">↑ 18,2%</span></article>
                  <article><small>LABA BERSIH</small><strong>Rp64,8 jt</strong><span className="up">↑ 9,4%</span></article>
                  <article><small>KAS & BANK</small><strong>Rp183,2 jt</strong><span>4 rekening</span></article>
                </div>
                <div className="preview-lower">
                  <article className="preview-chart"><div><small>ARUS KAS</small><strong>Pergerakan 6 bulan</strong></div><svg viewBox="0 0 440 150" role="img" aria-label="Grafik arus kas meningkat"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2563eb" stopOpacity=".24"/><stop offset="1" stopColor="#2563eb" stopOpacity="0"/></linearGradient></defs><path d="M0 124 C45 118 54 88 96 94 S150 110 188 70 S252 86 286 48 S354 66 440 20 L440 150 L0 150Z" fill="url(#chartFill)"/><path d="M0 124 C45 118 54 88 96 94 S150 110 188 70 S252 86 286 48 S354 66 440 20" fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round"/></svg></article>
                  <article className="preview-check"><small>KONTROL HARI INI</small><p><span>✓</span> Rekonsiliasi bank</p><p><span>✓</span> Jurnal sudah seimbang</p><p><b>3</b> Invoice segera jatuh tempo</p></article>
                </div>
              </div>
            </div>
          </div>
          <div className="preview-float"><span>✓</span><div><small>PEMBUKUAN TERKENDALI</small><strong>Semua jurnal seimbang</strong></div></div>
        </div>
      </section>

      <section className="landing-proof" aria-label="Cakupan sistem">
        <p>SATU SUMBER ANGKA UNTUK OPERASIONAL DAN KEUANGAN</p>
        <div><span>Penjualan</span><span>Pembelian</span><span>Kas & Bank</span><span>Persediaan</span><span>Aset Tetap</span><span>Laporan</span></div>
      </section>

      <section className="landing-section" id="features">
        <div className="landing-section-heading">
          <div><p className="landing-kicker"><span /> FITUR UTAMA</p><h2>Semua yang penting,<br />tersusun dalam satu sistem.</h2></div>
          <p>Setiap transaksi mengalir ke pencatatan dan laporan yang sama. Tim tidak perlu memindahkan angka berulang kali hanya untuk memahami kondisi bisnis.</p>
        </div>
        <div className="landing-feature-grid">
          {featureGroups.map((feature) => <article key={feature.number}>
            <span className="feature-number">{feature.number}</span>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
            <ul>{feature.items.map(item => <li key={item}>✓ <span>{item}</span></li>)}</ul>
          </article>)}
        </div>
      </section>

      <section className="landing-workflow" id="workflow">
        <div className="workflow-intro"><p className="landing-kicker light"><span /> CARA KERJA</p><h2>Mulai tanpa membuat proses terasa berat.</h2><p>Wizard awal membantu menyiapkan organisasi. Setelah itu, transaksi harian otomatis menjadi dasar laporan dan kontrol keuangan.</p></div>
        <ol>
          <li><span>1</span><div><strong>Siapkan organisasi</strong><p>Lengkapi profil perusahaan, periode fiskal, mata uang, dan daftar akun.</p></div></li>
          <li><span>2</span><div><strong>Masukkan atau impor data</strong><p>Catat transaksi, impor data awal, atau hubungkan sumber yang dibutuhkan.</p></div></li>
          <li><span>3</span><div><strong>Pantau dan tutup buku</strong><p>Tinjau laporan, rekonsiliasi bank, lalu kunci periode ketika pembukuan selesai.</p></div></li>
        </ol>
      </section>

      <section className="landing-section integration-section">
        <div className="integration-visual" aria-hidden="true">
          <div className="integration-node pos"><img src="/loka-icon.svg" alt="" /><span>Loka Kasir<small>Transaksi penjualan</small></span></div>
          <div className="integration-line"><i>→</i></div>
          <div className="integration-node accounting"><img src="/loka-icon.svg" alt="" /><span>Loka Accounting<small>Pembukuan & laporan</small></span></div>
        </div>
        <div className="integration-copy"><p className="landing-kicker"><span /> TERHUBUNG BILA DIBUTUHKAN</p><h2>Pakai mandiri, atau hubungkan dengan Loka Kasir.</h2><p>Loka Accounting tidak bergantung pada POS. Saat integrasi diaktifkan, pemetaan akun membantu transaksi kasir masuk ke pembukuan dengan struktur yang konsisten.</p><ul><li>Kontrol pemetaan akun sumber</li><li>Pencatatan event integrasi dapat ditelusuri</li><li>Tetap bisa membuat jurnal dan transaksi mandiri</li></ul></div>
      </section>

      <section className="landing-security" id="security">
        <div><p className="landing-kicker light"><span /> KONTROL & KEAMANAN</p><h2>Angka penting perlu jejak yang jelas.</h2><p>Akses tim, perubahan data, dan penutupan periode dibangun agar pembukuan tetap tertib saat bisnis bertumbuh.</p></div>
        <div className="security-grid">
          <article><span>◎</span><strong>Hak akses per peran</strong><p>Batasi menu dan tindakan sesuai tanggung jawab anggota.</p></article>
          <article><span>⌁</span><strong>Jejak audit</strong><p>Tinjau aktivitas penting dan asal perubahan pada data.</p></article>
          <article><span>⊘</span><strong>Kunci periode</strong><p>Cegah perubahan tidak disengaja pada periode yang selesai.</p></article>
          <article><span>◇</span><strong>Autentikasi dua faktor</strong><p>Tambahkan perlindungan MFA pada akun pengguna.</p></article>
        </div>
      </section>

      <section className="landing-section landing-faq" id="faq">
        <div><p className="landing-kicker"><span /> PERTANYAAN UMUM</p><h2>Yang perlu diketahui sebelum mulai.</h2><p>Informasi ringkas untuk memastikan Loka Accounting sesuai dengan cara tim Anda bekerja.</p></div>
        <div>{faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div>
      </section>

      <section className="landing-cta">
        <p className="landing-kicker light"><span /> MULAI SEKARANG</p>
        <h2>Rapikan pembukuan.<br />Pahami bisnis lebih cepat.</h2>
        <p>Buat organisasi Loka Accounting dan ikuti panduan penyiapan langsung dari aplikasi.</p>
        <div><button className="landing-button inverse" type="button" onClick={onRegister}>Buat organisasi <span>→</span></button><button className="landing-link-button inverse" type="button" onClick={onLogin}>Sudah punya akun? Masuk</button></div>
      </section>

      <footer className="landing-footer">
        <a className="landing-brand" href="#top"><img src="/loka-icon.svg" alt="" /><span><strong>Loka</strong> Accounting</span></a>
        <p>Pembukuan bisnis yang rapi, terhubung, dan mudah ditelusuri.</p>
        <span>© {new Date().getFullYear()} Kreativita Sinergi</span>
      </footer>
    </main>
  )
}
