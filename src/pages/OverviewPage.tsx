import type { AccountingSettings } from '../types/accounting'
import { Badge, Button, Card, PageHeader } from '../components/ui'
import type { Onboarding } from '../types/operations'

export function OverviewPage({
  settings,
  loading,
  onInitialize,
  onboarding,
  onGetStarted,
}: {
  settings: AccountingSettings | null
  loading: boolean
  onInitialize: () => void
  onboarding: Onboarding | null
  onGetStarted: () => void
}) {
  return (
    <section>
      <PageHeader compact={false} eyebrow="ACCOUNTING CORE" title="Satu sumber kebenaran untuk keuangan bisnis." description="Kelola ledger, operasional, compliance, dan pelaporan dalam workspace yang dapat diaudit." action={<Badge tone={settings ? 'success' : 'warning'}>{settings ? 'Accounting aktif' : 'Belum diaktifkan'}</Badge>} />

      {!settings ? (
        <div className="empty-state panel">
          <div className="empty-icon">◎</div>
          <h2>Siapkan buku bisnis</h2>
          <p>Aktifkan IDR, periode Januari–Desember, dan daftar akun generik. Pengaturan ini tidak membutuhkan outlet atau inventory.</p>
          <Button disabled={loading} onClick={onInitialize}>
            {loading ? 'Menyiapkan…' : 'Aktifkan Accounting'}
          </Button>
        </div>
      ) : (
        <><div className="metric-grid">
          <Card className="metric"><span>Mata uang fungsional</span><strong>{settings.currency_code}</strong><small>Skala {settings.currency_scale} desimal</small></Card>
          <Card className="metric"><span>Zona waktu buku</span><strong>{settings.timezone}</strong><small>Basis tanggal transaksi</small></Card>
          <Card className="metric"><span>Tahun fiskal</span><strong>Mulai bulan {settings.fiscal_year_start_month}</strong><small>Periode pelaporan organisasi</small></Card>
          <Card className="metric"><span>Kapabilitas aktif</span><strong>{settings.enabled_modules.length} modul</strong><small>Core dan modul operasional</small></Card>
        </div>{onboarding && !onboarding.completed_at && <Card className="get-started-banner"><div className="get-started-ring"><strong>{Math.round((new Set([...onboarding.completed_steps, ...onboarding.skipped_steps]).size / 10) * 100)}%</strong><span>selesai</span></div><div><p className="eyebrow">GET STARTED</p><h2>Lengkapi kesiapan pembukuan</h2><p>Progres tersimpan otomatis. Lanjutkan dari langkah {onboarding.current_step} tanpa harus menyelesaikan fitur yang tidak relevan.</p></div><Button onClick={onGetStarted}>Lanjutkan setup</Button></Card>}<Card className="workspace-card"><div><p className="eyebrow">WORKSPACE STATUS</p><h2>Ledger siap digunakan</h2><p>Chart of accounts dan pengaturan dasar organisasi sudah aktif. Mulai dari jurnal manual atau gunakan modul operasional untuk posting otomatis.</p></div><div className="module-chips">{settings.enabled_modules.slice(0, 8).map((module) => <span key={module}>{module.replaceAll('_', ' ')}</span>)}</div></Card></>
      )}
    </section>
  )
}
