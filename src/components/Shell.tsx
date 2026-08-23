import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  // Flyout dirender lewat portal: icon rail dapat menggulir, dan panel yang
  // melayang di luar kotaknya tidak boleh ikut terpotong.
  const [flyout, setFlyout] = useState<{ module: MenuModule; top: number; left: number } | null>(null)
  const [closing, setClosing] = useState<Tab | null>(null)
  const [overflow, setOverflow] = useState(false)
  const railRef = useRef<HTMLDivElement>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const activeModule = moduleOf(active)

  useEffect(() => {
    if (!flyout) return
    const dismiss = (event: MouseEvent) => {
      const target = event.target as Node
      if (railRef.current?.contains(target) || flyoutRef.current?.contains(target)) return
      setFlyout(null)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFlyout(null) }
    const reposition = () => setFlyout(null)
    window.addEventListener('mousedown', dismiss)
    window.addEventListener('keydown', escape)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('mousedown', dismiss)
      window.removeEventListener('keydown', escape)
      window.removeEventListener('resize', reposition)
    }
  }, [flyout])

  function openTile(tile: MenuTile) {
    onOpen(tile.key)
    setFlyout(null)
  }

  /** Membuka flyout sejajar ikon yang diklik. */
  function toggleFlyout(module: MenuModule, button: HTMLButtonElement) {
    setFlyout((current) => {
      if (current?.module.id === module.id) return null
      const rect = button.getBoundingClientRect()
      return { module, left: rect.right + 8, top: rect.top }
    })
  }

  // Setelah terukur, panel digeser ke atas bila melewati tepi bawah viewport.
  useLayoutEffect(() => {
    const panel = flyoutRef.current
    if (!flyout || !panel) return
    const height = panel.getBoundingClientRect().height
    const top = Math.max(8, Math.min(flyout.top, window.innerHeight - height - 8))
    if (Math.abs(top - flyout.top) > 1) setFlyout({ ...flyout, top })
  }, [flyout])

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
                className={cx('rail-icon', activeModule === module.id && 'is-active', flyout?.module.id === module.id && 'is-open')}
                onClick={(event) => toggleFlyout(module, event.currentTarget)}
                aria-expanded={flyout?.module.id === module.id}
                aria-label={module.label}
                title={module.label}
              >
                <Icon name={module.icon} />
              </button>
              <span className="rail-tooltip">{module.label}</span>
            </div>
          ))}
        </div>

        {flyout && createPortal(
          <div className="flyout" role="menu" ref={flyoutRef} style={{ left: flyout.left, top: flyout.top }}>
            <h2>{flyout.module.label}</h2>
            <div className="flyout-tiles" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(flyout.module.tiles.length, 2), 4)}, 100px)` }}>
              {flyout.module.tiles.map((tile) => (
                <button key={`${flyout.module.id}-${tile.key}-${tile.label}`} type="button" role="menuitem" className={cx('tile', `tile-${tile.group}`)} onClick={() => openTile(tile)} title={tile.hint}>
                  <Icon name={tile.icon} />
                  <span>{tile.label}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}

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
