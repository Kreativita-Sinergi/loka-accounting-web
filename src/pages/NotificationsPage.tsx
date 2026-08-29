import { useMemo, useState } from 'react'
import { NotificationRow } from '../components/NotificationBell'
import { Button, EmptyState, PageHeader, cx } from '../components/ui'
import { RETENTION_DAYS, categoryLabel, useNotifications, type NotificationCategory } from '../lib/notifications'
import type { PageKey } from '../lib/menu'
import { useTabHandle } from '../store/tabs'

type Filter = 'all' | 'unread' | NotificationCategory

/**
 * Daftar penuh notifikasi. Isinya sama dengan panel lonceng, hanya dengan
 * saringan per kategori dan tanpa batas delapan baris.
 */
export function NotificationsPage({ onNavigate }: { onNavigate: (key: PageKey) => void }) {
  const { items, unread, loading, isRead, markRead, markAllRead, refresh } = useNotifications()
  const [filter, setFilter] = useState<Filter>('all')
  useTabHandle(false)

  const counts = useMemo(() => {
    const value = {} as Record<NotificationCategory, number>
    for (const item of items) value[item.category] = (value[item.category] ?? 0) + 1
    return value
  }, [items])

  const shown = useMemo(() => items.filter((item) => {
    if (filter === 'all') return true
    if (filter === 'unread') return !isRead(item.id)
    return item.category === filter
  }), [items, filter, isRead])

  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'all', label: 'Semua', count: items.length },
    { key: 'unread', label: 'Belum dibaca', count: unread },
    ...(Object.keys(categoryLabel) as NotificationCategory[])
      .filter((category) => counts[category])
      .map((category) => ({ key: category as Filter, label: categoryLabel[category], count: counts[category] })),
  ]

  return (
    <section>
      <PageHeader
        eyebrow="Sistem"
        title="Notifikasi"
        description={`Hal yang perlu ditindaklanjuti dari ${RETENTION_DAYS} hari terakhir, dirangkum dari antrean persetujuan, dokumen jatuh tempo, persediaan, undangan tim, dan persiapan data.`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon="refresh" onClick={refresh}>Muat ulang</Button>
            <Button icon="check" onClick={markAllRead} disabled={!unread}>Tandai semua dibaca</Button>
          </div>
        }
      />

      <div className="notif-filters">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            className={cx('filter-chip', filter === item.key && 'is-active')}
            onClick={() => setFilter(item.key)}
          >
            <span>{item.label}</span>
            <em className="not-italic font-bold">{item.count}</em>
          </button>
        ))}
      </div>

      <div className="panel notif-page">
        {loading && items.length === 0 && <p className="notif-empty">Memuat notifikasi…</p>}
        {!loading && shown.length === 0 && (
          <EmptyState icon="check">{filter === 'all' ? 'Tidak ada yang perlu ditindaklanjuti.' : 'Tidak ada notifikasi pada saringan ini.'}</EmptyState>
        )}
        {shown.map((item) => (
          <NotificationRow
            key={item.id}
            item={item}
            read={isRead(item.id)}
            onSelect={() => { markRead(item.id); if (item.target) onNavigate(item.target) }}
          />
        ))}
      </div>

      <p className="mt-3 text-[11px] text-[color:var(--fg-subtle)]">
        Notifikasi dihitung ulang dari data terkini setiap halaman dimuat dan setiap ada jurnal baru. Kejadian yang lebih tua dari {RETENTION_DAYS} hari — approval, draf, undangan — tidak lagi
        ditampilkan. Dokumen lewat jatuh tempo, stok bermasalah, dan langkah persiapan tetap ditampilkan selama belum diberesi, setua apa pun. Tanda “sudah dibaca” tersimpan di peramban ini saja.
      </p>
    </section>
  )
}
