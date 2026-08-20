import type { ReactNode } from 'react'
import type { IdentityProfile } from '../api/auth'
import { Icon, type IconName } from './Icon'

export type PageKey = 'overview' | 'get-started' | 'company' | 'general-ledger' | 'cash-bank' | 'sales' | 'purchases' | 'inventory' | 'assets' | 'accounts' | 'journal' | 'ledger' | 'operations' | 'products' | 'documents' | 'controls' | 'advanced' | 'compliance' | 'payroll' | 'manufacturing' | 'currency' | 'reports'

const groups: Array<{ label: string; items: Array<{ key: PageKey; label: string; icon: IconName }> }> = [
  { label: 'Utama', items: [
    { key: 'overview', label: 'Ringkasan', icon: 'home' }, { key: 'get-started', label: 'Mulai setup', icon: 'check' }, { key: 'company', label: 'Perusahaan', icon: 'settings' },
  ]},
  { label: 'Modul', items: [
    { key: 'general-ledger', label: 'Buku besar', icon: 'ledger' }, { key: 'cash-bank', label: 'Kas & bank', icon: 'currency' }, { key: 'sales', label: 'Penjualan', icon: 'operations' },
    { key: 'purchases', label: 'Pembelian', icon: 'operations' }, { key: 'inventory', label: 'Persediaan', icon: 'accounts' }, { key: 'assets', label: 'Aset tetap', icon: 'manufacturing' },
    { key: 'compliance', label: 'Pajak', icon: 'compliance' }, { key: 'reports', label: 'Laporan', icon: 'reports' },
  ]},
  { label: 'Kontrol', items: [
    { key: 'controls', label: 'Pengguna & integrasi', icon: 'settings' }, { key: 'advanced', label: 'Pengaturan lanjut', icon: 'settings' },
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
