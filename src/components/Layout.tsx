import type { ReactNode } from 'react'
import type { IdentityProfile } from '../api/auth'
import { Icon, type IconName } from './Icon'

export type PageKey = 'overview' | 'get-started' | 'accounts' | 'journal' | 'ledger' | 'operations' | 'products' | 'documents' | 'controls' | 'advanced' | 'compliance' | 'payroll' | 'manufacturing' | 'currency' | 'reports' | 'projects' | 'assets' | 'imports'

const groups: Array<{ label: string; items: Array<{ key: PageKey; label: string; icon: IconName }> }> = [
  { label: 'Workspace', items: [
    { key: 'overview', label: 'Ringkasan', icon: 'home' }, { key: 'get-started', label: 'Mulai setup', icon: 'check' }, { key: 'journal', label: 'Jurnal', icon: 'journal' },
    { key: 'ledger', label: 'Buku besar', icon: 'ledger' }, { key: 'accounts', label: 'Daftar akun', icon: 'accounts' },
  ]},
  { label: 'Operasional', items: [
    { key: 'products', label: 'Produk & gudang', icon: 'accounts' }, { key: 'documents', label: 'Penjualan & beli', icon: 'operations' },
    { key: 'operations', label: 'Piutang & utang', icon: 'operations' }, { key: 'payroll', label: 'Payroll', icon: 'payroll' },
    { key: 'manufacturing', label: 'Manufaktur', icon: 'manufacturing' }, { key: 'currency', label: 'Multi-currency', icon: 'currency' },
    { key: 'projects', label: 'Proyek', icon: 'project' }, { key: 'assets', label: 'Aset tetap', icon: 'asset' },
  ]},
  { label: 'Kontrol', items: [
    { key: 'reports', label: 'Laporan', icon: 'reports' }, { key: 'compliance', label: 'Pajak Indonesia', icon: 'compliance' },
    { key: 'imports', label: 'Impor data', icon: 'upload' },
    { key: 'controls', label: 'Organisasi', icon: 'settings' }, { key: 'advanced', label: 'Pengaturan lanjut', icon: 'settings' },
  ]},
]

export function Layout({
  page,
  onNavigate,
  children,
  profile,
  onLogout,
}: {
  page: PageKey
  onNavigate: (page: PageKey) => void
  children: ReactNode
  profile: IdentityProfile
  onLogout: () => void
}) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src="/loka-icon.svg" alt="Loka" />
          <div>
            <strong>Loka</strong>
            <small>Accounting</small>
          </div>
        </div>
        <nav className="main-nav">
          {groups.map((group) => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map((item) => (
            <button className={page === item.key ? 'nav-item active' : 'nav-item'} key={item.key} onClick={() => onNavigate(item.key)} aria-current={page === item.key ? 'page' : undefined} title={item.label}>
              <Icon className="nav-icon" name={item.icon} /><span>{item.label}</span>
            </button>
          ))}</div>)}
        </nav>
        <div className="sidebar-profile"><span>{profile.full_name.slice(0, 1).toUpperCase()}</span><div><strong>{profile.full_name}</strong><small>{profile.organization_name}</small></div><button onClick={onLogout} title="Keluar" aria-label="Keluar"><Icon name="logout" /></button></div>
      </aside>
      <main className="content"><div className="topbar"><div className="topbar-inner"><div className="topbar-path"><span className="breadcrumb">{profile.organization_name}</span><span>/</span><strong>Accounting</strong></div><span className="environment-badge"><i />IDR · Indonesia</span></div></div><div className="page-stage">{children}</div></main>
    </div>
  )
}
