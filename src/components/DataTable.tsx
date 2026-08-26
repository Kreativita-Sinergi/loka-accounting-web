import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useCanWrite } from '../lib/rbac'
import { compareValues, matchesQuery, nodeText } from '../lib/tableSort'
import { Icon, type IconName } from './Icon'
import { Badge, Button, EmptyState, cx } from './ui'

export type Column<T> = {
  header: ReactNode
  /** Cell renderer. Keep it presentational; actions belong in rowActions. */
  cell: (row: T) => ReactNode
  align?: 'left' | 'right'
  className?: string
  width?: string
  /** Nilai pengurutan; bila kosong diambil dari teks sel yang dirender. */
  sortValue?: (row: T) => string | number
  /** Setel false untuk kolom yang memang tidak masuk akal diurutkan. */
  sortable?: boolean
}

export type RowAction<T> = {
  label: string | ((row: T) => string)
  icon?: IconName
  onSelect: (row: T) => void
  /** Hide the entry entirely for rows it does not apply to. */
  when?: (row: T) => boolean
  /** Show it but block it; the returned text is shown under the label. */
  disabled?: (row: T) => string | false
  danger?: boolean
  /**
   * Aksi yang hanya membaca data (lihat rincian, cetak). Aksi tanpa tanda ini
   * dianggap mengubah data dan disembunyikan dari peran tanpa wewenang tulis.
   */
  readOnly?: boolean
}

/** Menyaring aksi baris sesuai wewenang tulis peran yang sedang masuk. */
export function allowedActions<T>(actions: Array<RowAction<T>>, canWrite: boolean) {
  return canWrite ? actions : actions.filter((action) => action.readOnly)
}

/**
 * TablePanel is the standard card around every list: heading, count, and the
 * primary action that opens the create modal.
 */
export function TablePanel({
  title,
  description,
  badge,
  badgeTone,
  action,
  toolbar,
  className,
  children,
}: {
  title: string
  description?: ReactNode
  badge?: ReactNode
  badgeTone?: 'neutral' | 'success' | 'warning' | 'info'
  action?: ReactNode
  toolbar?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cx('panel data-panel', className)}>
      <div className="panel-heading">
        <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
        <div className="panel-heading-actions">
          {badge !== undefined && <Badge tone={badgeTone}>{badge}</Badge>}
          {action}
        </div>
      </div>
      {toolbar && <div className="panel-toolbar">{toolbar}</div>}
      {children}
    </section>
  )
}

/** SearchInput is the shared filter control used above the bigger tables. */
export function SearchInput({ value, onChange, placeholder = 'Cari…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="search-field">
      <Icon name="search" className="size-4" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && <button type="button" onClick={() => onChange('')} aria-label="Bersihkan pencarian"><Icon name="close" className="size-3.5" /></button>}
    </div>
  )
}

/** Jumlah baris minimum sebelum kotak pencarian tabel ditampilkan. */
const searchThreshold = 6

/**
 * Tabel standar. Setiap kolom dapat diurutkan dengan mengklik judulnya
 * (naik → turun → urutan asli), dan tabel yang cukup panjang mendapat kotak
 * pencarian yang menyaring semua kolom sekaligus.
 */
export function DataTable<T>({
  columns,
  rows,
  keyOf,
  loading = false,
  empty = 'Belum ada data.',
  emptyIcon,
  rowActions,
  footer,
  search = true,
  searchPlaceholder = 'Cari di tabel…',
}: {
  columns: Array<Column<T>>
  rows: T[]
  keyOf: (row: T) => string
  loading?: boolean
  empty?: ReactNode
  emptyIcon?: IconName
  rowActions?: Array<RowAction<T>>
  footer?: ReactNode
  /** Setel false bila halaman sudah menyediakan pencariannya sendiri. */
  search?: boolean
  searchPlaceholder?: string
}) {
  const [sort, setSort] = useState<{ index: number; desc: boolean } | null>(null)
  const [query, setQuery] = useState('')

  // Teks tiap sel dihitung sekali, lalu dipakai ulang untuk cari dan urut.
  const texts = useMemo(() => rows.map((row) => columns.map((column) => nodeText(column.cell(row)))), [rows, columns])

  const filtered = useMemo(() => {
    const indexes = rows.map((_, index) => index).filter((index) => matchesQuery(texts[index], query))
    if (!sort) return indexes
    const column = columns[sort.index]
    const direction = sort.desc ? -1 : 1
    return [...indexes].sort((left, right) => {
      const a = column?.sortValue ? column.sortValue(rows[left]) : texts[left][sort.index] ?? ''
      const b = column?.sortValue ? column.sortValue(rows[right]) : texts[right][sort.index] ?? ''
      return compareValues(a, b) * direction
    })
  }, [rows, columns, texts, query, sort])

  function toggleSort(index: number) {
    if (columns[index]?.sortable === false) return
    setSort((current) => {
      if (current?.index !== index) return { index, desc: false }
      return current.desc ? null : { index, desc: true }
    })
  }

  if (loading) return <div className="loading" role="status">Memuat data…</div>
  if (rows.length === 0) return <EmptyState icon={emptyIcon}>{empty}</EmptyState>

  const searchable = search && rows.length >= searchThreshold

  return (
    <>
      {searchable && (
        <div className="table-toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} />
          <span className="table-toolbar-count">{filtered.length} dari {rows.length} baris</span>
        </div>
      )}
      {filtered.length === 0
        ? <EmptyState icon={emptyIcon}>Tidak ada baris yang cocok dengan pencarian “{query}”.</EmptyState>
        : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {columns.map((column, index) => (
                    <th
                      key={index}
                      className={cx(column.align === 'right' && 'number', column.className, column.sortable !== false && 'is-sortable')}
                      style={column.width ? { width: column.width } : undefined}
                      onClick={() => toggleSort(index)}
                      aria-sort={sort?.index === index ? (sort.desc ? 'descending' : 'ascending') : undefined}
                    >
                      {column.header}
                      {sort?.index === index && <Icon name="chevron" className={cx('sort-arrow', sort.desc && 'is-desc')} />}
                    </th>
                  ))}
                  {rowActions && <th className="actions-head"><span className="sr-only">Aksi</span></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((index) => {
                  const row = rows[index]
                  return (
                    <tr key={keyOf(row)}>
                      {columns.map((column, columnIndex) => (
                        <td key={columnIndex} className={cx(column.align === 'right' && 'number', column.className)}>{column.cell(row)}</td>
                      ))}
                      {rowActions && <td className="actions-cell"><RowMenu row={row} actions={rowActions} /></td>}
                    </tr>
                  )
                })}
              </tbody>
              {footer}
            </table>
          </div>
        )}
    </>
  )
}

/**
 * RowMenu keeps per-row edit, deactivate, and delete behind one control so a
 * wide table does not turn into a wall of buttons.
 */
export function RowMenu<T>({ row, actions }: { row: T; actions: Array<RowAction<T>> }) {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const canWrite = useCanWrite()
  const visible = allowedActions(actions, canWrite).filter((action) => !action.when || action.when(row))

  useEffect(() => {
    if (!open) return
    const dismiss = (event: MouseEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', dismiss)
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('mousedown', dismiss); window.removeEventListener('keydown', escape) }
  }, [open])

  if (visible.length === 0) return null

  return (
    <div className="row-menu" ref={wrapper}>
      <button type="button" className="row-menu-trigger" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen((value) => !value)} title="Aksi lainnya">
        <Icon name="more" className="size-4" />
      </button>
      {open && (
        <div className="row-menu-list" id={menuId} role="menu">
          {visible.map((action, index) => {
            const blocked = action.disabled?.(row) || false
            const label = typeof action.label === 'function' ? action.label(row) : action.label
            return (
              <button
                key={index}
                type="button"
                role="menuitem"
                className={cx('row-menu-item', action.danger && 'row-menu-item-danger', blocked && 'row-menu-item-blocked')}
                disabled={Boolean(blocked)}
                title={blocked || undefined}
                onClick={() => { setOpen(false); action.onSelect(row) }}
              >
                {action.icon && <Icon name={action.icon} className="size-4" />}
                <span>{label}{blocked && <small className="row-menu-reason">{blocked}</small>}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** StatusPill is the single visual for the active / inactive lifecycle. */
export function StatusPill({ active, activeLabel = 'Aktif', inactiveLabel = 'Nonaktif' }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return <span className={cx('status-pill', active ? 'status-pill-active' : 'status-pill-inactive')}><i />{active ? activeLabel : inactiveLabel}</span>
}

/** AddButton is the primary "create" affordance repeated on every list panel. */
export function AddButton({ onClick, children, disabled, title }: { onClick: () => void; children: ReactNode; disabled?: boolean; title?: string }) {
  // Peran tanpa wewenang tulis tidak melihat jalan masuk pembuatan data.
  if (!useCanWrite()) return null
  return <Button icon="plus" onClick={onClick} disabled={disabled} title={title}>{children}</Button>
}
