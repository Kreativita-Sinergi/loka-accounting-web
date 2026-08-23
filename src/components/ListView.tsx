import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePersisted } from '../lib/persist'
import { EmptyState, cx } from './ui'
import { Icon, type IconName } from './Icon'
import type { RowAction } from './DataTable'

export type ListColumn<T> = {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: 'left' | 'right'
  className?: string
  width?: string
  /** Nilai untuk pengurutan; kolom tanpa ini tidak dapat diurutkan. */
  sortValue?: (row: T) => string | number
  /** Kolom opsional: tersembunyi sampai dipilih lewat pengaturan kolom. */
  optional?: boolean
  /** Dapat diurutkan server-side; nama kunci dikirim sebagai parameter `sort`. */
  sortable?: boolean
}

export type FilterChip = {
  key: string
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}

const pageSizes = [25, 50, 100]

/**
 * Mode server: halaman menyediakan total baris dan menerima perubahan
 * halaman/ukuran/pengurutan agar query dieksekusi di database.
 */
export type ServerPaging = {
  total: number
  page: number
  size: number
  sort: string | null
  order: 'asc' | 'desc'
  onChange: (next: { page: number; size: number; sort: string | null; order: 'asc' | 'desc' }) => void
}

/**
 * Pola LIST (§4.1): baris filter chip, toolbar aksi, tabel padat yang dapat
 * diurutkan, dan paginasi. Semua halaman daftar memakai komponen ini.
 */
export function ListView<T>({
  storageKey,
  columns,
  rows,
  keyOf,
  loading = false,
  empty = 'Belum ada data.',
  emptyIcon,
  filters = [],
  search,
  onSearch,
  searchPlaceholder = 'Cari…',
  onCreate,
  createLabel = 'Baru',
  createDisabled,
  createTitle,
  onRefresh,
  onImport,
  onExport,
  onPrint,
  rowActions = [],
  onRowOpen,
  extraToolbar,
  server,
}: {
  storageKey: string
  columns: Array<ListColumn<T>>
  rows: T[]
  keyOf: (row: T) => string
  loading?: boolean
  empty?: ReactNode
  emptyIcon?: IconName
  filters?: FilterChip[]
  search: string
  onSearch: (value: string) => void
  searchPlaceholder?: string
  onCreate?: () => void
  createLabel?: string
  createDisabled?: boolean
  createTitle?: string
  onRefresh?: () => void
  onImport?: () => void
  onExport?: () => void
  onPrint?: () => void
  rowActions?: Array<RowAction<T>>
  onRowOpen?: (row: T) => void
  extraToolbar?: ReactNode
  /** Bila diisi, paginasi dan pengurutan dijalankan server-side. */
  server?: ServerPaging
}) {
  const [hidden, setHidden] = usePersisted<string[]>(`cols.${storageKey}`, columns.filter((column) => column.optional).map((column) => column.key))
  const [localPageSize, setLocalPageSize] = usePersisted<number>(`size.${storageKey}`, 50)
  const [localSort, setLocalSort] = useState<{ key: string; desc: boolean } | null>(null)
  const [localPage, setLocalPage] = useState(1)

  const sort = server ? (server.sort ? { key: server.sort, desc: server.order === 'desc' } : null) : localSort
  const pageSize = server ? server.size : localPageSize
  const page = server ? server.page : localPage

  const setPage = (value: number) => server ? server.onChange({ page: value, size: server.size, sort: server.sort, order: server.order }) : setLocalPage(value)
  const setPageSize = (value: number) => server ? server.onChange({ page: 1, size: value, sort: server.sort, order: server.order }) : setLocalPageSize(value)
  const [columnPanel, setColumnPanel] = useState(false)
  const [draft, setDraft] = useState(search)
  const [context, setContext] = useState<{ row: T; x: number; y: number } | null>(null)
  const columnBox = useRef<HTMLDivElement>(null)

  useEffect(() => setDraft(search), [search])
  useEffect(() => { if (!server) setLocalPage(1) }, [search, rows.length, localPageSize, server])
  useEffect(() => {
    if (!columnPanel && !context) return
    const dismiss = (event: MouseEvent) => {
      if (context) setContext(null)
      if (columnPanel && !columnBox.current?.contains(event.target as Node)) setColumnPanel(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setColumnPanel(false); setContext(null) } }
    window.addEventListener('mousedown', dismiss)
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('mousedown', dismiss); window.removeEventListener('keydown', escape) }
  }, [columnPanel, context])

  const visibleColumns = columns.filter((column) => !hidden.includes(column.key))

  const sorted = useMemo(() => {
    if (server || !sort) return rows
    const column = columns.find((candidate) => candidate.key === sort.key)
    if (!column?.sortValue) return rows
    const direction = sort.desc ? -1 : 1
    return [...rows].sort((left, right) => {
      const a = column.sortValue!(left)
      const b = column.sortValue!(right)
      if (typeof a === 'number' && typeof b === 'number') return (a - b) * direction
      return String(a).localeCompare(String(b), 'id-ID', { numeric: true }) * direction
    })
  }, [rows, sort, columns, server])

  const total = server ? server.total : sorted.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pageCount)
  const visibleRows = server ? sorted : sorted.slice((current - 1) * pageSize, current * pageSize)
  const contextActions = context ? rowActions.filter((action) => !action.when || action.when(context.row)) : []

  function toggleSort(column: ListColumn<T>) {
    if (!column.sortable && !column.sortValue) return
    const next = sort?.key === column.key && !sort.desc ? { key: column.key, desc: true } : { key: column.key, desc: false }
    if (server) {
      server.onChange({ page: 1, size: server.size, sort: next.key, order: next.desc ? 'desc' : 'asc' })
      return
    }
    setLocalSort((value) => value?.key === column.key ? (value.desc ? null : { key: column.key, desc: true }) : { key: column.key, desc: false })
  }

  return (
    <div className="list-view">
      {filters.length > 0 && (
        <div className="filter-chips">
          {filters.map((filter) => (
            <label className="filter-chip" key={filter.key}>
              <span>{filter.label}:</span>
              <select value={filter.value} onChange={(event) => filter.onChange(event.target.value)} aria-label={filter.label}>
                {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ))}
          <button type="button" className="filter-reset" onClick={() => filters.forEach((filter) => filter.onChange(filter.options[0].value))} title="Bersihkan semua filter">
            <Icon name="close" /> Reset
          </button>
        </div>
      )}

      <div className="list-toolbar">
        {onCreate && <button type="button" className="tool-primary" onClick={onCreate} disabled={createDisabled} title={createTitle ?? createLabel}><Icon name="plus" /> {createLabel}</button>}
        {onRefresh && <button type="button" className="tool-icon" onClick={onRefresh} title="Muat ulang"><Icon name="refresh" /></button>}
        {extraToolbar}
        <div className="list-toolbar-right">
          {onImport && <button type="button" className="tool-icon" onClick={onImport} title="Impor dari Excel/CSV"><Icon name="download" /></button>}
          {onExport && <button type="button" className="tool-icon" onClick={onExport} title="Ekspor"><Icon name="upload" /></button>}
          {onPrint && <button type="button" className="tool-icon" onClick={onPrint} title="Cetak daftar"><Icon name="printer" /></button>}
          <div className="column-picker" ref={columnBox}>
            <button type="button" className="tool-icon" onClick={() => setColumnPanel((value) => !value)} aria-expanded={columnPanel} title="Pengaturan kolom"><Icon name="settings" /></button>
            {columnPanel && (
              <div className="column-panel">
                <strong>Kolom tampil</strong>
                {columns.map((column) => (
                  <label key={column.key} className="column-option">
                    <input
                      type="checkbox"
                      checked={!hidden.includes(column.key)}
                      onChange={(event) => setHidden((value) => event.target.checked ? value.filter((key) => key !== column.key) : [...value, column.key])}
                    />
                    <span>{typeof column.header === 'string' ? column.header : column.key}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <form className="list-search" onSubmit={(event) => { event.preventDefault(); onSearch(draft) }}>
            <Icon name="search" />
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`${searchPlaceholder} (Enter)`} aria-label={searchPlaceholder} />
            {draft && <button type="button" onClick={() => { setDraft(''); onSearch('') }} aria-label="Bersihkan pencarian"><Icon name="close" /></button>}
          </form>
          <span className="list-count" title="Jumlah baris hasil filter">{total}</span>
        </div>
      </div>

      {loading ? <div className="loading" role="status">Memuat data…</div> : total === 0 ? <EmptyState icon={emptyIcon}>{empty}</EmptyState> : (
        <>
          <div className="table-wrap">
            <table className="list-table">
              <thead>
                <tr>
                  {visibleColumns.map((column) => (
                    <th
                      key={column.key}
                      className={cx(column.align === 'right' && 'number', (column.sortable || column.sortValue) && 'sortable', column.className)}
                      style={column.width ? { width: column.width } : undefined}
                      onClick={() => toggleSort(column)}
                      aria-sort={sort?.key === column.key ? (sort.desc ? 'descending' : 'ascending') : undefined}
                    >
                      {column.header}
                      {sort?.key === column.key && <Icon name="chevron" className={cx('sort-arrow', sort.desc && 'is-desc')} />}
                    </th>
                  ))}
                  {rowActions.length > 0 && <th className="actions-head"><span className="sr-only">Aksi</span></th>}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr
                    key={keyOf(row)}
                    className={cx(onRowOpen && 'is-openable')}
                    onClick={() => onRowOpen?.(row)}
                    onContextMenu={(event) => { if (rowActions.length === 0) return; event.preventDefault(); setContext({ row, x: event.clientX, y: event.clientY }) }}
                  >
                    {visibleColumns.map((column) => (
                      <td key={column.key} className={cx(column.align === 'right' && 'number', column.className)}>{column.cell(row)}</td>
                    ))}
                    {rowActions.length > 0 && (
                      <td className="actions-cell" onClick={(event) => event.stopPropagation()}>
                        <button type="button" className="row-menu-trigger" title="Aksi lainnya" onClick={(event) => setContext({ row, x: event.clientX, y: event.clientY })}><Icon name="more" className="size-4" /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="list-pager">
            <div className="pager-buttons">
              <button type="button" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Halaman sebelumnya">◀</button>
              {pageNumbers(current, pageCount).map((value, index) => value === 0
                ? <span key={`gap-${index}`} className="pager-gap">…</span>
                : <button key={value} type="button" className={cx(value === current && 'is-active')} onClick={() => setPage(value)}>{value}</button>)}
              <button type="button" onClick={() => setPage(current + 1)} disabled={current === pageCount} aria-label="Halaman berikutnya">▶</button>
            </div>
            <label className="pager-size">
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="Baris per halaman">
                {pageSizes.map((size) => <option key={size} value={size}>{size} / halaman</option>)}
              </select>
            </label>
          </div>
        </>
      )}

      {context && contextActions.length > 0 && (
        <div className="context-menu" style={{ left: context.x, top: context.y }} role="menu">
          {contextActions.map((action, index) => {
            const blocked = action.disabled?.(context.row) || false
            const label = typeof action.label === 'function' ? action.label(context.row) : action.label
            return (
              <button
                key={index}
                type="button"
                role="menuitem"
                className={cx('row-menu-item', action.danger && 'row-menu-item-danger', blocked && 'row-menu-item-blocked')}
                disabled={Boolean(blocked)}
                title={blocked || undefined}
                onClick={() => { const row = context.row; setContext(null); action.onSelect(row) }}
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

/** Deret nomor halaman ringkas; 0 dipakai sebagai penanda elipsis. */
function pageNumbers(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const pages = new Set([1, total, current, current - 1, current + 1])
  return [...pages].filter((page) => page >= 1 && page <= total).sort((left, right) => left - right)
    .flatMap((page, index, list) => index > 0 && page - list[index - 1] > 1 ? [0, page] : [page])
}
