import { useCallback, useEffect, useMemo, useState } from 'react'
import { getLocalization, getReport } from '../api/accounting'
import type { IdentityProfile } from '../api/auth'
import { getCompanyProfile } from '../api/operations'
import { Icon } from '../components/Icon'
import { Badge, Button, Card, PageHeader } from '../components/ui'
import { decimal, formatDate, formatMoney } from '../lib/money'
import type { PageKey } from '../lib/menu'
import type { AccountingSettings, BalanceSheet, LocalizationProfile, ProfitLoss } from '../types/accounting'
import type { Onboarding, OrganizationProfile } from '../types/operations'

const beginning = '1900-01-01'

type OwnerSnapshot = {
  company: OrganizationProfile | null
  localization: LocalizationProfile | null
  profitLoss: ProfitLoss | null
  balanceSheet: BalanceSheet | null
}

const iso = (date: Date) => date.toISOString().slice(0, 10)
const monthStart = () => {
  const now = new Date()
  return iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
}

const businessCategory = (value: string | null | undefined) => {
  if (!value) return 'Bidang usaha belum dilengkapi'
  const labels: Record<string, string> = {
    SERVICE: 'Jasa', RETAIL: 'Ritel', DISTRIBUTION: 'Distribusi', MANUFACTURING: 'Manufaktur', OTHER: 'Lainnya',
  }
  return labels[value.toUpperCase()] ?? value
}

const addressOf = (company: OrganizationProfile | null) => {
  if (!company) return 'Alamat perusahaan belum dilengkapi'
  const region = [company.city, company.province, company.postal_code].filter(Boolean).join(', ')
  return [company.address_line, region].filter(Boolean).join(' · ') || 'Alamat perusahaan belum dilengkapi'
}

export function OverviewPage({
  settings,
  loading,
  onInitialize,
  onboarding,
  onGetStarted,
  profile,
  scale,
  onNavigate,
}: {
  settings: AccountingSettings | null
  loading: boolean
  onInitialize: () => void
  onboarding: Onboarding | null
  onGetStarted: () => void
  profile: IdentityProfile
  scale: number
  onNavigate: (key: PageKey) => void
}) {
  const [snapshot, setSnapshot] = useState<OwnerSnapshot | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  const loadSnapshot = useCallback(async () => {
    if (!settings) return
    setSnapshotLoading(true)
    const today = iso(new Date())
    const results = await Promise.allSettled([
      getCompanyProfile(),
      getLocalization(),
      getReport<ProfitLoss>('profit-loss', monthStart(), today),
      getReport<BalanceSheet>('balance-sheet', beginning, today),
    ])
    const value = <T,>(index: number): T | null => results[index].status === 'fulfilled'
      ? results[index].value as T
      : null
    setSnapshot({
      company: value<OrganizationProfile>(0),
      localization: value<LocalizationProfile>(1),
      profitLoss: value<ProfitLoss>(2),
      balanceSheet: value<BalanceSheet>(3),
    })
    setSnapshotLoading(false)
  }, [settings])

  useEffect(() => { void loadSnapshot() }, [loadSnapshot])
  useEffect(() => {
    window.addEventListener('loka:company-changed', loadSnapshot)
    return () => window.removeEventListener('loka:company-changed', loadSnapshot)
  }, [loadSnapshot])

  const company = snapshot?.company ?? null
  const localization = snapshot?.localization ?? null
  const legalName = company?.legal_name || localization?.legal_name || company?.name || profile.organization_name
  const taxIdentifier = localization?.tax_identifier || null
  const money = (value: string | undefined) => value === undefined ? '—' : formatMoney(decimal(value), scale)
  const profit = snapshot?.profitLoss ? decimal(snapshot.profitLoss.net_profit) : null

  const completeness = useMemo(() => {
    const checks = [
      { label: 'Nama legal PT', done: Boolean(company?.legal_name || localization?.legal_name) },
      { label: 'NPWP perusahaan', done: Boolean(taxIdentifier) },
      { label: 'Alamat kantor', done: Boolean(company?.address_line && company?.city && company?.province) },
      { label: 'Kontak perusahaan', done: Boolean(company?.email || company?.phone) },
      { label: 'Tanggal mulai data', done: Boolean(company?.data_start_date) },
    ]
    return { checks, percent: Math.round((checks.filter((item) => item.done).length / checks.length) * 100) }
  }, [company, localization, taxIdentifier])

  return (
    <section>
      <PageHeader
        compact={false}
        eyebrow="DASHBOARD PEMILIK"
        title={settings ? `Ringkasan ${legalName}` : 'Siapkan pusat kendali perusahaan Anda'}
        description={settings
          ? `Selamat datang, ${profile.full_name}. Pantau identitas PT dan kesehatan usaha dalam satu halaman.`
          : 'Aktifkan pembukuan untuk melihat profil legal dan kondisi keuangan perusahaan.'}
        action={<Badge tone={settings ? 'success' : 'warning'}>{settings ? 'Perusahaan aktif' : 'Belum diaktifkan'}</Badge>}
      />

      {!settings ? (
        <div className="empty-state panel">
          <div className="empty-icon"><Icon name="building" /></div>
          <h2>Siapkan buku perusahaan</h2>
          <p>Aktifkan IDR, periode Januari–Desember, dan daftar akun awal untuk mulai memantau PT Anda.</p>
          <Button disabled={loading} onClick={onInitialize}>{loading ? 'Menyiapkan…' : 'Aktifkan Accounting'}</Button>
        </div>
      ) : (
        <>
          <Card className="owner-company-card">
            <div className="owner-company-identity">
              <div className="owner-company-mark">{legalName.replace(/^PT\.?\s*/i, '').slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="owner-company-heading"><h2>{legalName}</h2><Badge tone="success">PT aktif</Badge></div>
                <p>{businessCategory(company?.business_category ?? onboarding?.business_type)}{company?.business_field ? ` · ${company.business_field}` : ''}</p>
                <span><Icon name="building" />{addressOf(company)}</span>
              </div>
            </div>
            <div className="owner-company-contact">
              <InfoLine label="NPWP" value={taxIdentifier ?? 'Belum dilengkapi'} muted={!taxIdentifier} />
              <InfoLine label="Status pajak" value={localization?.is_vat_registered ? `PKP${localization.vat_registration_number ? ` · ${localization.vat_registration_number}` : ''}` : 'Non-PKP'} />
              <InfoLine label="Kontak" value={company?.email || company?.phone || 'Belum dilengkapi'} muted={!company?.email && !company?.phone} />
            </div>
            <Button variant="secondary" onClick={() => onNavigate('company.info')}>Lengkapi profil</Button>
          </Card>

          <div className="owner-kpi-grid" aria-busy={snapshotLoading}>
            <OwnerMetric label="Pendapatan bulan ini" value={money(snapshot?.profitLoss?.revenue)} note={`Per ${formatDate(iso(new Date()))}`} icon="reports" />
            <OwnerMetric label="Laba bersih" value={money(snapshot?.profitLoss?.net_profit)} note={profit === null ? 'Data laporan belum tersedia' : profit >= 0 ? 'Usaha mencatat laba' : 'Perlu perhatian pemilik'} icon="reports" tone={profit !== null && profit < 0 ? 'danger' : 'success'} />
            <OwnerMetric label="Total aset" value={money(snapshot?.balanceSheet?.total_assets)} note="Posisi neraca berjalan" icon="bank" />
            <OwnerMetric label="Total kewajiban" value={money(snapshot?.balanceSheet?.total_liabilities)} note={snapshot?.balanceSheet?.balanced ? 'Neraca dalam kondisi seimbang' : 'Posisi buku perlu ditinjau'} icon="compliance" />
          </div>

          {onboarding && !onboarding.completed_at && (
            <Card className="get-started-banner">
              <div className="get-started-ring"><strong>{Math.round((new Set([...onboarding.completed_steps, ...onboarding.skipped_steps]).size / 10) * 100)}%</strong><span>selesai</span></div>
              <div><p className="eyebrow">PERSIAPAN PERUSAHAAN</p><h2>Lengkapi kesiapan pembukuan</h2><p>Lanjutkan dari langkah {onboarding.current_step} agar laporan PT tersusun lengkap sejak awal.</p></div>
              <Button onClick={onGetStarted}>Lanjutkan setup</Button>
            </Card>
          )}

          <div className="owner-detail-grid">
            <Card className="owner-readiness-card">
              <header><div><p className="eyebrow">KELENGKAPAN PT</p><h2>Profil perusahaan</h2></div><strong>{completeness.percent}%</strong></header>
              <div className="owner-progress"><i style={{ width: `${completeness.percent}%` }} /></div>
              <div className="owner-checklist">
                {completeness.checks.map((item) => <div key={item.label} className={item.done ? 'done' : undefined}><span>{item.done ? '✓' : '!'}</span>{item.label}<small>{item.done ? 'Lengkap' : 'Perlu diisi'}</small></div>)}
              </div>
            </Card>

            <Card className="owner-books-card">
              <header><div><p className="eyebrow">INFORMASI PEMBUKUAN</p><h2>Konfigurasi perusahaan</h2></div></header>
              <div className="owner-book-grid">
                <InfoLine label="Mata uang" value={`${settings.currency_code} · ${settings.currency_scale} desimal`} />
                <InfoLine label="Zona waktu" value={settings.timezone} />
                <InfoLine label="Tahun fiskal" value={`Mulai bulan ${settings.fiscal_year_start_month}`} />
                <InfoLine label="Mulai data" value={company?.data_start_date ? formatDate(company.data_start_date) : 'Belum ditentukan'} muted={!company?.data_start_date} />
              </div>
              <div className="owner-module-row"><span>{settings.enabled_modules.length} modul aktif</span><div>{settings.enabled_modules.slice(0, 5).map((module) => <i key={module}>{module.replaceAll('_', ' ')}</i>)}</div></div>
            </Card>
          </div>

          <Card className="owner-quick-card">
            <div><p className="eyebrow">AKSES CEPAT PEMILIK</p><h2>Apa yang ingin Anda tinjau?</h2><p>Buka area penting perusahaan tanpa mencari melalui menu.</p></div>
            <div className="owner-quick-actions">
              <Button variant="secondary" onClick={() => onNavigate('company.monitor')}><Icon name="reports" /> Pantau usaha</Button>
              <Button variant="secondary" onClick={() => onNavigate('reports.list')}><Icon name="reports" /> Laporan keuangan</Button>
              <Button variant="secondary" onClick={() => onNavigate('company.info')}><Icon name="building" /> Info perusahaan</Button>
            </div>
          </Card>
        </>
      )}
    </section>
  )
}

function InfoLine({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return <div className="owner-info-line"><span>{label}</span><strong className={muted ? 'muted' : undefined}>{value}</strong></div>
}

function OwnerMetric({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: 'reports' | 'bank' | 'compliance'; tone?: 'success' | 'danger' }) {
  return <Card className={`owner-metric${tone ? ` ${tone}` : ''}`}><div className="owner-metric-icon"><Icon name={icon} /></div><span>{label}</span><strong className="mono">{value}</strong><small>{note}</small></Card>
}
