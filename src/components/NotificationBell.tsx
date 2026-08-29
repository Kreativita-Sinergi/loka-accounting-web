import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { relativeTime, useNotifications, type NotificationItem } from '../lib/notifications'
import type { PageKey } from '../lib/menu'
import { Icon } from './Icon'
import { cx } from './ui'

/**
 * Lonceng notifikasi di top bar: lencana jumlah yang belum dibaca dan panel
 * ringkas berisi hal paling mendesak. Daftar lengkapnya ada di tab Notifikasi.
 */
export function NotificationBell({ onOpen }: { onOpen: (key: PageKey) => void }) {
  const { items, unread, loading, isRead, markRead, markAllRead, refresh } = useNotifications()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const dismiss = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      setOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
    window.addEventListener('mousedown', dismiss)
    window.addEventListener('keydown', escape)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', dismiss)
      window.removeEventListener('keydown', escape)
      window.removeEventListener('resize', close)
    }
  }, [open])

  function choose(item: NotificationItem) {
    markRead(item.id)
    if (item.target) onOpen(item.target)
    setOpen(false)
  }

  const preview = items.slice(0, 8)

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={cx('topbar-bell', open && 'is-open')}
        title={unread ? `${unread} notifikasi belum dibaca` : 'Notifikasi'}
        aria-label="Notifikasi"
        aria-expanded={open}
        onClick={() => { setOpen((value) => !value); if (!open) refresh() }}
      >
        <Icon name="bell" />
        {unread > 0 && <span className="topbar-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && createPortal(
        <div className="notif-panel" ref={panelRef} role="dialog" aria-label="Notifikasi">
          <header>
            <strong>Notifikasi</strong>
            <span className="notif-count">{loading ? 'memuat…' : `${unread} belum dibaca`}</span>
            <button type="button" title="Muat ulang" aria-label="Muat ulang notifikasi" onClick={refresh}><Icon name="refresh" /></button>
            <button type="button" title="Tandai semua dibaca" aria-label="Tandai semua dibaca" onClick={markAllRead} disabled={!unread}><Icon name="check" /></button>
          </header>
          <div className="notif-list">
            {!loading && preview.length === 0 && <p className="notif-empty">Tidak ada yang perlu ditindaklanjuti.</p>}
            {preview.map((item) => (
              <NotificationRow key={item.id} item={item} read={isRead(item.id)} onSelect={() => choose(item)} />
            ))}
          </div>
          <footer>
            <button type="button" onClick={() => { onOpen('system.notification'); setOpen(false) }}>Lihat semua notifikasi</button>
          </footer>
        </div>,
        document.body,
      )}
    </>
  )
}

/** Satu baris notifikasi; dipakai panel top bar maupun tab Notifikasi. */
export function NotificationRow({ item, read, onSelect }: { item: NotificationItem; read: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={cx('notif-row', `is-${item.tone}`, read && 'is-read')} onClick={onSelect}>
      <span className="notif-dot" aria-hidden="true" />
      <span className="notif-text">
        <strong>{item.title}</strong>
        <small>{item.body}</small>
      </span>
      {item.at && <time className="notif-time">{relativeTime(item.at)}</time>}
    </button>
  )
}
