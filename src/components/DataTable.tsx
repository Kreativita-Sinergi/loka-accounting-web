import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { Icon, type IconName } from './Icon'
import { Badge, Button, EmptyState, cx } from './ui'

export type Column<T> = {
  header: ReactNode
  /** Cell renderer. Keep it presentational; actions belong in rowActions. */
  cell: (row: T) => ReactNode
  align?: 'left' | 'right'
  className?: string
  width?: string
}

export type RowAction<T> = {
  label: string | ((row: T) => string)
  icon?: IconName
  onSelect: (row: T) => void
  /** Hide the entry entirely for rows it does not apply to. */
  when?: (row: T) => boolean
  /** Show it but block it, with the reason surfaced as a tooltip. */
  disabled?: (row: T) => string | false
  danger?: boolean
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

export function DataTable<T>({
  columns,
  rows,
  keyOf,
  loading = false,
  empty = 'Belum ada data.',
  emptyIcon,
  rowActions,
  footer,
}: {
  columns: Array<Column<T>>
  rows: T[]
  keyOf: (row: T) => string
  loading?: boolean
  empty?: ReactNode
  emptyIcon?: IconName
  rowActions?: Array<RowAction<T>>
  footer?: ReactNode
}) {
  if (loading) return <div className="loading" role="status">Memuat data…</div>
  if (rows.length === 0) return <EmptyState icon={emptyIcon}>{empty}</EmptyState>

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={index} className={cx(column.align === 'right' && 'number', column.className)} style={column.width ? { width: column.width } : undefined}>{column.header}</th>
            ))}
            {rowActions && <th className="actions-head"><span className="sr-only">Aksi</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={keyOf(row)}>
              {columns.map((column, index) => (
                <td key={index} className={cx(column.align === 'right' && 'number', column.className)}>{column.cell(row)}</td>
              ))}
              {rowActions && <td className="actions-cell"><RowMenu row={row} actions={rowActions} /></td>}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
    </div>
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
  const visible = actions.filter((action) => !action.when || action.when(row))

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
                className={cx('row-menu-item', action.danger && 'row-menu-item-danger')}
                disabled={Boolean(blocked)}
                title={blocked || undefined}
                onClick={() => { setOpen(false); action.onSelect(row) }}
              >
                {action.icon && <Icon name={action.icon} className="size-4" />}{label}
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
  return <Button icon="plus" onClick={onClick} disabled={disabled} title={title}>{children}</Button>
}
