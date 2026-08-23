import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { cx } from './ui'

export type SubTab = { key: string; label: string }
export type IconTab = { key: string; label: string; icon: IconName }

/** Pola A (§3.5): sub-tab horizontal untuk form master dan preferensi. */
export function SubTabs({ tabs, active, onChange }: { tabs: SubTab[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="sub-tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.key} type="button" role="tab" aria-selected={tab.key === active} className={cx(tab.key === active && 'is-active')} onClick={() => onChange(tab.key)}>
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/** Pola B (§3.5): deret ikon vertikal di sisi kiri area konten form transaksi. */
export function IconTabs({ tabs, active, onChange }: { tabs: IconTab[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="icon-tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.key} type="button" role="tab" aria-selected={tab.key === active} className={cx(tab.key === active && 'is-active')} onClick={() => onChange(tab.key)} title={tab.label}>
          <Icon name={tab.icon} />
          <span className="icon-tab-tip">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}

export type RailAction = {
  icon: IconName
  label: string
  primary?: boolean
  items: Array<{ label: string; onSelect: () => void; disabled?: string | false }>
}

/** Rail aksi kanan pada form transaksi (§4.3): Simpan, Cetak, Lampiran, lainnya. */
export function ActionRail({ actions }: { actions: RailAction[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const dismiss = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(null) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null) }
    window.addEventListener('mousedown', dismiss)
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('mousedown', dismiss); window.removeEventListener('keydown', escape) }
  }, [open])

  return (
    <div className="action-rail" ref={box}>
      {actions.map((action) => (
        <div className="rail-action" key={action.label}>
          <button
            type="button"
            className={cx('rail-action-button', action.primary && 'is-primary')}
            onClick={() => action.items.length === 1 ? action.items[0].onSelect() : setOpen((value) => value === action.label ? null : action.label)}
            title={action.label}
            aria-expanded={open === action.label}
          >
            <Icon name={action.icon} />
            {action.items.length > 1 && <Icon name="chevron" className="rail-caret" />}
          </button>
          {open === action.label && (
            <div className="rail-menu" role="menu">
              {action.items.map((item) => (
                <button key={item.label} type="button" role="menuitem" disabled={Boolean(item.disabled)} title={item.disabled || undefined} onClick={() => { setOpen(null); item.onSelect() }}>
                  {item.label}
                  {item.disabled && <small>{item.disabled}</small>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Kerangka dokumen (§4.2 & §4.3): tombol ☰ kembali ke daftar, label dokumen
 * yang sedang dibuka, sub-tab opsional, dan rail aksi kanan yang selalu terlihat.
 */
export function DocumentShell({
  label,
  onBack,
  dirty = false,
  subTabs,
  activeSubTab,
  onSubTab,
  rail,
  children,
}: {
  label: string
  onBack: () => void
  dirty?: boolean
  subTabs?: SubTab[]
  activeSubTab?: string
  onSubTab?: (key: string) => void
  rail?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="document-shell">
      <div className="document-main">
        <div className="document-head">
          <button type="button" className="back-to-list" onClick={onBack} title="Kembali ke daftar"><Icon name="grid" /></button>
          <span className="document-chip">{label}{dirty && <i title="Ada perubahan belum disimpan" />}</span>
        </div>
        {subTabs && activeSubTab && onSubTab && <SubTabs tabs={subTabs} active={activeSubTab} onChange={onSubTab} />}
        <div className="document-body">{children}</div>
      </div>
      {rail}
    </div>
  )
}

/**
 * Field lookup (§4.2): input dengan ikon cari; nilai terpilih tampil sebagai
 * chip dengan tombol ✕.
 */
export function LookupField({
  label,
  required,
  placeholder = 'Cari/Pilih…',
  value,
  options,
  onChange,
}: {
  label: string
  required?: boolean
  placeholder?: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const dismiss = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', dismiss)
    return () => window.removeEventListener('mousedown', dismiss)
  }, [open])

  const matches = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 50)

  return (
    <div className="lookup" ref={box}>
      <span className="lookup-label">{label}{required && <b> *</b>}</span>
      {selected ? (
        <span className="lookup-chip">
          {selected.label}
          <button type="button" onClick={() => onChange('')} aria-label={`Kosongkan ${label}`}><Icon name="close" /></button>
        </span>
      ) : (
        <button type="button" className="lookup-trigger" onClick={() => { setOpen(true); setQuery('') }}>
          <span>{placeholder}</span><Icon name="search" />
        </button>
      )}
      {open && !selected && (
        <div className="lookup-panel">
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ketik untuk mencari…" aria-label={`Cari ${label}`} />
          <div className="lookup-options">
            {matches.length === 0 && <p>Tidak ada data yang cocok.</p>}
            {matches.map((option) => (
              <button key={option.value} type="button" onClick={() => { onChange(option.value); setOpen(false) }}>{option.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
