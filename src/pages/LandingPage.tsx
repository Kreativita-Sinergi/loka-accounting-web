import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, MotionConfig, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, useVelocity, type MotionValue } from 'motion/react'
import { SissiScene } from '../components/SissiScene'
import { Icon, type IconName } from '../components/Icon'
import './landing.css'

type LandingPageProps = { onLogin: () => void; onRegister: () => void; onSubscribe: () => void }
const ease = [0.22, 1, 0.36, 1] as const

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion()
  return <motion.div className={className} initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: reduced ? 0 : 0.75, ease, delay: reduced ? 0 : delay }}>{children}</motion.div>
}

function Action({ children, onClick, secondary = false, compact = false }: { children: ReactNode; onClick: () => void; secondary?: boolean; compact?: boolean }) {
  const reduced = useReducedMotion()
  return <motion.button type="button" className={`landing-button${secondary ? ' secondary' : ''}${compact ? ' compact' : ''}`} onClick={onClick} whileHover={reduced ? undefined : { y: -2 }} whileTap={reduced ? undefined : { scale: 0.98 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>{children}<span className="button-arrow" aria-hidden="true">↗</span></motion.button>
}

function VelocityStrip({ velocity }: { velocity: MotionValue<number> }) {
  const host = useRef<HTMLDivElement>(null)
  const visible = useInView(host, { margin: '80px' })
  const reduced = useReducedMotion()
  const x = useMotionValue(0)
  const skew = useTransform(velocity, [-1, 0, 1], [1.4, 0, -1.4])
  useEffect(() => {
    if (reduced || !visible) return
    let frame = 0
    let last = 0
    const group = host.current?.querySelector<HTMLElement>('.velocity-group')
    let width = group?.offsetWidth ?? 1
    const resize = new ResizeObserver(() => { width = group?.offsetWidth ?? 1 })
    if (group) resize.observe(group)
    const render = (time: number) => {
      const step = last ? Math.min(time - last, 40) / 1000 : 0
      last = time
      const next = x.get() - step * (18 + Math.abs(velocity.get()) * 90)
      x.set(((next % width) - width) % width)
      frame = requestAnimationFrame(render)
    }
    const resume = () => { last = 0; if (!frame && !document.hidden) frame = requestAnimationFrame(render) }
    const stop = () => { cancelAnimationFrame(frame); frame = 0 }
    const onVisibility = () => { if (document.hidden) stop(); else resume() }
    resume(); document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); resize.disconnect(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [reduced, visible, velocity, x])
  const labels = ['Penjualan', 'Pembelian', 'Kas & Bank', 'Persediaan', 'Aset Tetap', 'Laporan']
  return <div ref={host} className={`velocity-strip${reduced ? ' is-static' : ''}`} aria-label="Modul akuntansi"><motion.div className="velocity-track" style={reduced ? undefined : { x, skewX: skew }}>{[0, 1, 2].map(copy => <div className="velocity-group" key={copy} aria-hidden={copy > 0 ? true : undefined}>{labels.map(label => <span key={label}>{label}<i aria-hidden="true">✳</i></span>)}</div>)}</motion.div></div>
}

const featureGroups = [
  {
    number: '01',
    icon: 'reports' as IconName,
    eyebrow: 'LAPORAN',
    title: 'Laporan yang langsung bisa dibaca',
    description: 'Pantau laba rugi, neraca, arus kas, buku besar, dan neraca saldo dari transaksi yang sama—tanpa menyusun ulang spreadsheet.',
    items: ['Laba rugi & neraca', 'Arus kas langsung dan tidak langsung', 'Buku besar & neraca saldo'],
  },
  {
    number: '02',
    icon: 'operations' as IconName,
    eyebrow: 'OPERASIONAL',
    title: 'Penjualan dan pembelian terhubung',
    description: 'Kelola alur dari penawaran dan pesanan hingga invoice, retur, penerimaan, pembayaran, serta umur piutang dan utang.',
    items: ['Invoice & pembayaran', 'Piutang/utang jatuh tempo', 'Pelanggan & pemasok'],
  },
  {
    number: '03',
    icon: 'bank' as IconName,
    eyebrow: 'KAS & BANK',
    title: 'Kas dan bank lebih terkendali',
    description: 'Catat penerimaan, pembayaran, dan transfer. Impor mutasi lalu cocokkan transaksi melalui rekonsiliasi bank.',
    items: ['Kas masuk & keluar', 'Impor mutasi bank', 'Rekonsiliasi transaksi'],
  },
  {
    number: '04',
    icon: 'asset' as IconName,
    eyebrow: 'ASET',
    title: 'Stok sampai aset tetap',
    description: 'Nilai persediaan, kartu stok, gudang, penyesuaian, dan aset tetap berada dalam satu sistem pembukuan.',
    items: ['Kartu & valuasi stok', 'Multi-gudang dan satuan', 'Penyusutan aset tetap'],
  },
  {
    number: '05',
    icon: 'compliance' as IconName,
    eyebrow: 'KONTROL',
    title: 'Kontrol untuk tim keuangan',
    description: 'Atur peran, kunci periode, jejak audit, persetujuan, dan autentikasi dua faktor agar perubahan tetap dapat ditelusuri.',
    items: ['Hak akses berbasis peran', 'Kunci periode & audit trail', 'MFA dan undangan tim'],
  },
  {
    number: '06',
    icon: 'project' as IconName,
    eyebrow: 'ANALISIS',
    title: 'Analisis bisnis lebih dalam',
    description: 'Gunakan proyek, departemen, anggaran, pajak, mata uang, dan dimensi untuk melihat angka sesuai cara bisnis bekerja.',
    items: ['Anggaran & profitabilitas proyek', 'Pajak dan multi-currency', 'Dimensi & departemen'],
  },
]

const faqs = [
  ['Berapa biaya Sissi Accounting?', 'Anda mendapat trial 30 hari. Setelah itu biayanya Rp300.000 per organisasi per bulan, dibayar melalui payment gateway dan tidak diperpanjang otomatis.'],
  ['Apakah harus memakai Sissi Kasir?', 'Tidak. Sissi Accounting dapat digunakan sebagai aplikasi pembukuan mandiri. Integrasi Sissi Kasir bersifat opsional.'],
  ['Apakah cocok untuk bisnis Indonesia?', 'Ya. Tersedia chart of accounts awal, format Rupiah, profil pajak Indonesia, periode fiskal, serta impor dan ekspor data untuk membantu proses akuntansi.'],
  ['Bisakah digunakan bersama tim?', 'Bisa. Pemilik dapat mengundang anggota, mengatur peran dan wewenang, mengaktifkan MFA, serta meninjau jejak perubahan.'],
  ['Bagaimana memindahkan data yang sudah ada?', 'Gunakan template impor untuk akun dan data operasional yang didukung. Data laporan juga dapat diekspor untuk kebutuhan pemeriksaan lebih lanjut.'],
]

export function LandingPage({ onLogin, onRegister, onSubscribe }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  const reduced = useReducedMotion()
  const hero = useRef<HTMLElement>(null)
  const { scrollY, scrollYProgress: pageProgress } = useScroll()
  const velocity = useVelocity(scrollY)
  const speed = useSpring(useTransform(velocity, [-2200, 0, 2200], [-1, 0, 1]), { stiffness: 110, damping: 24 })
  const { scrollYProgress } = useScroll({ target: hero, offset: ['start start', 'end start'] })
  const portraitY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 36])
  const portraitRotate = useTransform(speed, [-1, 0, 1], reduced ? [0, 0, 0] : [-0.7, 0, 0.7])
  const intro = { hidden: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 24 }, visible: { opacity: 1, y: 0 } }

  useEffect(() => {
    if (!menuOpen) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [menuOpen])

  return <MotionConfig reducedMotion="user"><main className="accounting-landing sissi-landing">
    <a className="landing-skip" href="#features">Lompat ke fitur</a>
    <header className="landing-nav">
      <div className="landing-nav-inner">
        <a className="landing-brand" href="#top" aria-label="Sissi Accounting — kembali ke atas"><img src="/brand/sissi-logo.svg" alt="Sissi" width="99" height="32" /><span>Accounting</span></a>
        <nav id="landing-navigation" className={menuOpen ? 'is-open' : ''} aria-label="Navigasi utama">
          {[['#features', 'Fitur'], ['#workflow', 'Cara kerja'], ['#pricing', 'Harga'], ['#faq', 'FAQ']].map(([href, label]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
        </nav>
        <div className="landing-nav-actions"><button className="landing-link-button" type="button" onClick={onLogin}>Masuk</button><Action compact onClick={onRegister}>Coba gratis</Action><button type="button" className="landing-menu" aria-controls="landing-navigation" aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'grid'} /></button></div>
      </div>
      <motion.div className="reading-progress" style={{ scaleX: pageProgress }} aria-hidden="true" />
    </header>

    <motion.section ref={hero} initial="hidden" animate="visible" transition={{ staggerChildren: reduced ? 0 : 0.11 }} className="landing-hero" id="top">
      <div className="landing-hero-copy">
        <motion.p variants={intro} transition={{ duration: 0.7, ease }} className="landing-kicker"><span /> SISSI ACCOUNTING / UNTUK USAHA ANDA</motion.p>
        <motion.h1 variants={intro} transition={{ duration: 0.8, ease }}>Pembukuan rapi.<br /><span>Usaha lebih <em>terarah.</em></span></motion.h1>
        <motion.p variants={intro} transition={{ duration: 0.7, ease }} className="landing-lead">Dari transaksi pertama sampai tutup buku. Kelola kas, stok, dan laporan keuangan dalam satu alur yang jelas.</motion.p>
        <motion.div variants={intro} transition={{ duration: 0.7, ease }} className="landing-hero-actions"><Action onClick={onRegister}>Coba gratis 30 hari</Action><Action secondary onClick={() => document.querySelector('#workflow')?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' })}>Lihat cara kerja</Action></motion.div>
        <motion.div variants={intro} className="landing-assurances"><span><Icon name="check" /> Semua fitur selama trial</span><span><Icon name="check" /> Siap untuk tim Anda</span></motion.div>
      </div>
      <motion.figure variants={intro} transition={{ duration: 0.9, ease }} className="landing-people">
        <div className="hero-visual-grid" aria-hidden="true" />
        <div className="visual-corner top-left" aria-hidden="true" /><div className="visual-corner bottom-right" aria-hidden="true" />
        <div className="hero-visual-heading"><span className="status-dot" /> SATU ALUR PEMBUKUAN<span>01 / 03</span></div>
        <SissiScene velocity={speed} />
        <motion.img style={{ y: portraitY, rotate: portraitRotate }} src="/brand/accounting-owner.png" alt="Pemilik usaha membawa tablet" fetchPriority="high" width="1024" height="1536" />
        <figcaption><Icon name="journal" /><span>Transaksi tercatat.<small>Laporan siap dibaca.</small></span><Icon name="check" /></figcaption>
        <div className="hero-visual-footer"><span>TRANSAKSI</span><i>→</i><span>JURNAL</span><i>→</i><span>LAPORAN</span></div>
      </motion.figure>
      <div className="hero-bottom"><span>DIRANCANG UNTUK BISNIS INDONESIA</span><a href="#features">Jelajahi fitur <span aria-hidden="true">↓</span></a></div>
    </motion.section>

    <VelocityStrip velocity={speed} />

    <section className="landing-section" id="features">
      <Reveal className="landing-section-heading"><div><p className="landing-kicker"><span /> 01 / FITUR UTAMA</p><h2>Satu sistem.<br />Pembukuan menyeluruh.</h2></div><p>Catat sekali. Transaksi, persediaan, dan laporan memakai data yang sama, tanpa memindahkan angka berulang kali.</p></Reveal>
      <div className="landing-feature-grid">{featureGroups.map((feature, index) => <Reveal className="feature-reveal" delay={(index % 3) * 0.06} key={feature.number}><motion.article whileHover={reduced ? undefined : { y: -3 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}><div className="feature-card-top"><span className="feature-icon"><Icon name={feature.icon} /></span><span className="feature-number">/{feature.number}</span></div><small>{feature.eyebrow}</small><h3>{feature.title}</h3><p>{feature.description}</p><ul>{feature.items.map(item => <li key={item}><Icon name="check" /><span>{item}</span></li>)}</ul></motion.article></Reveal>)}</div>
    </section>

    <section className="landing-workflow" id="workflow"><div className="landing-section workflow-inner">
      <Reveal className="workflow-intro"><p className="landing-kicker"><span /> 02 / CARA KERJA</p><h2>Dari input<br /><span>ke laporan. <em>Tanpa putus.</em></span></h2><p>Siapkan organisasi, catat aktivitas usaha, lalu tinjau hasilnya. Pembukuan mengikuti alur kerja tim Anda.</p></Reveal>
      <div className="workflow-steps">{[
        ['journal', 'Siapkan organisasi', 'Lengkapi profil perusahaan, periode fiskal, mata uang, dan daftar akun.'],
        ['operations', 'Catat atau impor transaksi', 'Masukkan data awal dan transaksi harian. Jurnal menjadi dasar pembukuan.'],
        ['reports', 'Tinjau dan tutup buku', 'Baca laporan, rekonsiliasi bank, lalu kunci periode yang sudah selesai.'],
      ].map(([icon, title, description], index) => <Reveal delay={index * 0.1} key={title}><article className="workflow-step"><div className="workflow-step-number">0{index + 1}</div><div><span className="workflow-step-label"><Icon name={icon as IconName} /> {['PERSIAPAN', 'PENCATATAN', 'PELAPORAN'][index]}</span><h3>{title}</h3><p>{description}</p></div><span className="workflow-step-arrow" aria-hidden="true">↗</span></article></Reveal>)}</div>
    </div></section>

    <section className="landing-section integration-section">
      <Reveal className="integration-copy"><p className="landing-kicker"><span /> 03 / INTEGRASI</p><h2>Mandiri.<br />Terhubung bila perlu.</h2><p>Sissi Accounting dapat digunakan sendiri. Hubungkan Sissi Kasir saat Anda ingin transaksi penjualan masuk ke pembukuan.</p><ul><li><Icon name="check" /> Pemetaan akun sumber</li><li><Icon name="check" /> Jejak pencatatan integrasi</li><li><Icon name="check" /> Jurnal dan transaksi mandiri</li></ul></Reveal>
      <Reveal className="integration-visual"><div className="integration-caption">ALUR DATA / INTEGRASI OPSIONAL</div><a className="integration-node" href="https://kasir.sissi.id/" target="_blank" rel="noreferrer" aria-label="Buka Sissi Kasir"><img src="/brand/sissi-mark.svg" alt="" /><div><strong>Sissi Kasir</strong><small>Transaksi penjualan</small></div><span>↗</span></a><div className="integration-connector" aria-hidden="true"><motion.span initial={{ y: -10, opacity: 0 }} whileInView={reduced ? { y: 0, opacity: 1 } : { y: [-10, 10, -10], opacity: [0.3, 1, 0.3] }} viewport={{ amount: 0.5 }} transition={{ duration: 2.8, repeat: reduced ? 0 : Infinity, ease: 'easeInOut' }}>↓</motion.span></div><div className="integration-node accounting"><img src="/brand/sissi-mark.svg" alt="" /><div><strong>Sissi Accounting</strong><small>Pembukuan dan laporan</small></div><span>02</span></div><p>Data yang sama. Pencatatan yang konsisten.</p></Reveal>
    </section>

    <section className="landing-security"><div className="landing-section security-inner"><Reveal className="security-intro"><p className="landing-kicker"><span /> 04 / KONTROL</p><h2>Setiap perubahan<br />punya jejak.</h2><p>Atur akses, tinjau aktivitas, dan jaga periode yang sudah ditutup. Kendali tetap berada di tangan tim Anda.</p></Reveal><div className="security-grid">{[
      ['accounts', 'Hak akses per peran', 'Menu dan tindakan sesuai tanggung jawab anggota.'],
      ['journal', 'Jejak audit', 'Aktivitas penting dan asal perubahan dapat ditinjau.'],
      ['compliance', 'Kunci periode', 'Jaga pembukuan pada periode yang sudah selesai.'],
      ['settings', 'Autentikasi dua faktor', 'Perlindungan MFA untuk akun pengguna.'],
    ].map(([icon, title, description], index) => <Reveal delay={index * 0.05} key={title}><article><Icon name={icon as IconName} /><h3>{title}</h3><p>{description}</p></article></Reveal>)}</div></div></section>

    <section className="landing-section landing-pricing" id="pricing"><Reveal className="pricing-copy"><p className="landing-kicker"><span /> 05 / HARGA</p><h2>Lengkap fiturnya.<br />Jelas biayanya.</h2><p>Satu langganan untuk satu organisasi. Coba seluruh fitur selama 30 hari sebelum mulai berlangganan.</p><div className="pricing-trial-note"><Icon name="check" /><span>30 hari gratis<small>Seluruh modul langsung tersedia</small></span></div></Reveal><Reveal className="pricing-card"><div className="pricing-card-head"><div><small>SISSI ACCOUNTING</small><h3>Business</h3></div><span>SEMUA FITUR</span></div><div className="pricing-amount"><strong>Rp300.000</strong><span>/ bulan</span></div><p>Per organisasi · Tanpa tambahan pajak</p><ul>{['Seluruh modul akuntansi dan laporan', 'Pengguna dan kontrol akses tim', 'Persediaan, aset, proyek, dan anggaran', 'Rekonsiliasi bank dan audit trail', 'Integrasi Sissi Kasir opsional'].map(item => <li key={item}><Icon name="check" />{item}</li>)}</ul><Action onClick={onSubscribe}>Mulai trial 30 hari</Action><small>Dibayar bulanan setelah trial. Tidak diperpanjang otomatis.</small></Reveal></section>

    <section className="landing-section landing-faq" id="faq"><Reveal><p className="landing-kicker"><span /> 06 / FAQ</p><h2>Sebelum<br />Anda mulai.</h2><p>Jawaban untuk pertanyaan yang sering ditanyakan.</p></Reveal><Reveal className="faq-list">{faqs.map(([question, answer], index) => <article className={`faq-item${faqOpen === index ? ' is-open' : ''}`} key={question}><h3><button type="button" aria-expanded={faqOpen === index} aria-controls={`faq-answer-${index}`} id={`faq-question-${index}`} onClick={() => setFaqOpen(faqOpen === index ? null : index)}><span>{question}</span><motion.span className="faq-plus" animate={{ rotate: faqOpen === index ? 45 : 0 }} transition={{ duration: reduced ? 0 : 0.25 }} aria-hidden="true">+</motion.span></button></h3><AnimatePresence initial={false}>{faqOpen === index && <motion.div id={`faq-answer-${index}`} role="region" aria-labelledby={`faq-question-${index}`} initial={{ height: reduced ? 'auto' : 0, opacity: reduced ? 1 : 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: reduced ? 'auto' : 0, opacity: 0 }} transition={{ duration: reduced ? 0 : 0.28, ease }}><p>{answer}</p></motion.div>}</AnimatePresence></article>)}</Reveal></section>

    <section className="landing-cta"><Reveal className="landing-section cta-inner"><div><p className="landing-kicker"><span /> LANGKAH BERIKUTNYA</p><h2>Usaha jalan.<br />Pembukuan <em>terkendali.</em></h2><p>Mulai dari organisasi Anda. Kami bantu lewat panduan penyiapan di aplikasi.</p></div><Action onClick={onRegister}>Coba gratis 30 hari</Action></Reveal></section>
    <footer className="landing-section landing-footer"><a className="landing-brand" href="#top"><img src="/brand/sissi-logo.svg" alt="Sissi" width="99" height="32" /><span>Accounting</span></a><p>© {new Date().getFullYear()} PT. Sissi Kreatif Teknologi</p><a href="https://www.sissi.id/" target="_blank" rel="noreferrer">Bagian dari Sissi <span aria-hidden="true">↗</span></a></footer>
  </main></MotionConfig>
}
