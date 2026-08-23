import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { IdentityProfile } from '../api/auth'
import { modules, moduleOf, type MenuModule, type MenuTile, type PageKey } from '../lib/menu'
import type { Tab } from '../store/tabs'
import { Icon } from './Icon'
import { cx } from './ui'
import { ConfirmDialog } from './Modal'

/**
 * Shell aplikasi mengikuti Bagian 03 spesifikasi: top bar 56px, tab bar 40px,
 * icon rail 64px dengan menu flyout berisi ubin berwarna per kelompok fungsi.
 */
export function Shell({
  tabs,
  active,
  onOpen,
  onClose,
  onActivate,
  profile,
  onLogout,
  children,
}: {
  tabs: Tab[]
  active: PageKey
  onOpen: (key: PageKey) => void
  onClose: (key: PageKey) => void
  onActivate: (key: PageKey) => void
  profile: IdentityProfile
  onLogout: () => void
  children: ReactNode
}) {
  const [flyout, setFlyout] = useState<MenuModule | null>(null)
  const [closing, setClosing] = useState<Tab | null>(null)
  const [overflow, setOverflow] = useState(false)
  const railRef = useRef<HTMLDivElement>(null)
  const activeModule = moduleOf(active)

  useEffect(() => {
    if (!flyout) return
    const dismiss = (event: MouseEvent) => { if (!railRef.current?.contains(event.target as Node)) setFlyout(null) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFlyout(null) }
    window.addEventListener('mousedown', dismiss)
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('mousedown', dismiss); window.removeEventListener('keydown', escape) }
  }, [flyout])

  function openTile(tile: MenuTile) {
    onOpen(tile.key)
    setFlyout(null)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <img src="/loka-icon.svg" alt="Loka" />
          <strong>Loka<span>Accounting</span></strong>
        </div>
        <div className="topbar-tools">
          <button type="button" title="Cari (Ctrl+K)" aria-label="Cari"><Icon name="search" /></button>
          <button type="button" title="Bantuan" aria-label="Bantuan"><Icon name="help" /></button>
          <button type="button" title="Notifikasi" aria-label="Notifikasi"><Icon name="bell" /></button>
        </div>
        <div className="topbar-org">
          <span>{profile.organization_name}</span>
          <small>IDR · Indonesia</small>
        </div>
        <button type="button" className="topbar-avatar" onClick={onLogout} title={`${profile.full_name} — klik untuk keluar`}>
          {profile.full_name.slice(0, 1).toUpperCase()}
        </button>
      </header>

      <nav className="tabbar" aria-label="Dokumen terbuka">
        <div className="tabbar-strip">
          {tabs.map((tab) => (
            <span key={tab.key} className={cx('doc-tab', tab.key === active && 'is-active')}>
              <button type="button" onClick={() => onActivate(tab.key)} aria-current={tab.key === active ? 'page' : undefined}>{tab.label}</button>
              {tab.dirty && <i className="doc-tab-dirty" title="Ada perubahan yang belum disimpan" />}
              {tab.closable && <button type="button" className="doc-tab-close" onClick={() => tab.dirty ? setClosing(tab) : onClose(tab.key)} aria-label={`Tutup ${tab.label}`}><Icon name="close" /></button>}
            </span>
          ))}
        </div>
        <div className="tabbar-count">
          <button type="button" onClick={() => setOverflow((value) => !value)} aria-expanded={overflow}>
            {tabs.length} <Icon name="chevron" />
          </button>
          {overflow && (
            <div className="tabbar-menu" role="menu">
              {tabs.map((tab) => (
                <button key={tab.key} type="button" role="menuitem" className={cx(tab.key === active && 'is-active')} onClick={() => { onActivate(tab.key); setOverflow(false) }}>{tab.label}</button>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="shell-body">
        <div className="icon-rail" ref={railRef}>
          {modules.map((module) => (
            <div className="rail-slot" key={module.id}>
              <button
                type="button"
                className={cx('rail-icon', activeModule === module.id && 'is-active', flyout?.id === module.id && 'is-open')}
                onClick={() => setFlyout((current) => current?.id === module.id ? null : module)}
                aria-expanded={flyout?.id === module.id}
                aria-label={module.label}
              >
                <Icon name={module.icon} />
              </button>
              <span className="rail-tooltip">{module.label}</span>
              {flyout?.id === module.id && (
                <div className="flyout" role="menu">
                  <h2>{module.label}</h2>
                  <div className="flyout-tiles" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(module.tiles.length, 2), 4)}, 100px)` }}>
                    {module.tiles.map((tile) => (
                      <button key={`${module.id}-${tile.key}-${tile.label}`} type="button" role="menuitem" className={cx('tile', `tile-${tile.group}`)} onClick={() => openTile(tile)} title={tile.hint}>
                        <Icon name={tile.icon} />
                        <span>{tile.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <main className="tab-stage">{children}</main>
      </div>

      <ConfirmDialog
        open={closing !== null}
        tone="danger"
        title="Tutup tab tanpa menyimpan?"
        confirmLabel="Tutup tab"
        onClose={() => setClosing(null)}
        onConfirm={async () => { if (closing) onClose(closing.key); setClosing(null) }}
        description={<>Tab <strong>{closing?.label}</strong> memiliki perubahan yang belum disimpan. Menutupnya akan membuang perubahan tersebut.</>}
      />
    </div>
  )
}
