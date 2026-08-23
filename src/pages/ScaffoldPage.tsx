import { useState } from 'react'
import { ActionRail, DocumentShell, IconTabs } from '../components/FormShell'
import { Icon } from '../components/Icon'
import { Button, cx } from '../components/ui'
import { fallbackSpec, specs, type Field, type Spec } from '../lib/specs'
import { tileOf, type PageKey } from '../lib/menu'
import { useTabHandle } from '../store/tabs'

/**
 * Merender layar dari spesifikasi Accurate untuk modul yang backend-nya belum
 * tersedia. Tata letak sudah final; datanya sengaja kosong dan diberi penanda
 * agar tidak ada yang mengira modul ini sudah berjalan.
 */
export function ScaffoldPage({ pageKey }: { pageKey: PageKey }) {
  const tile = tileOf(pageKey)
  const spec = specs[pageKey] ?? fallbackSpec(tile.label, tile.group)
  useTabHandle(false, tile.label)

  return (
    <section>
      <div className="scaffold-notice">
        <Icon name="warning" />
        <div>
          <strong>{tile.label} — tata letak siap, data belum terhubung.</strong>
          <span>Layar ini mengikuti rancangan Accurate. Endpoint backend untuk modul ini sedang dibangun bertahap, jadi tombol simpan dan daftar isinya belum aktif.</span>
        </div>
      </div>
      {spec.kind === 'list' && <ListScaffold spec={spec} />}
      {spec.kind === 'transaction' && <TransactionScaffold label={tile.label} spec={spec} />}
      {spec.kind === 'master' && <MasterScaffold label={tile.label} spec={spec} />}
      {spec.kind === 'info' && <InfoScaffold spec={spec} />}
    </section>
  )
}

function FieldControl({ field }: { field: Field }) {
  const label = <span className="lookup-label">{field.label}{field.required && <b> *</b>}</span>
  if (field.type === 'checkbox') {
    return <label className="check-row text-[12px]"><input type="checkbox" disabled />{field.label}</label>
  }
  if (field.type === 'textarea') {
    return <label className={cx('doc-field', field.full && 'sm:col-span-2')}>{label}<textarea rows={3} disabled /></label>
  }
  if (field.type === 'select') {
    return (
      <label className="doc-field">{label}
        <select disabled defaultValue={field.options?.[0]}>{(field.options ?? []).map((option) => <option key={option}>{option}</option>)}</select>
      </label>
    )
  }
  if (field.type === 'lookup') {
    return (
      <label className="doc-field">{label}
        <span className="lookup-trigger"><span>{field.placeholder ?? 'Cari/Pilih…'}</span><Icon name="search" /></span>
      </label>
    )
  }
  return (
    <label className="doc-field">{label}
      <span className="flex items-center gap-2">
        <input type={field.type === 'date' ? 'date' : 'text'} defaultValue={field.value} placeholder={field.placeholder} disabled />
        {field.suffix && <small className="text-[12px] text-[color:var(--fg-muted)]">{field.suffix}</small>}
      </span>
    </label>
  )
}

function ListScaffold({ spec }: { spec: Extract<Spec, { kind: 'list' }> }) {
  return (
    <div className="list-view">
      {spec.filters && spec.filters.length > 0 && (
        <div className="filter-chips">
          {spec.filters.map((filter) => (
            <label className="filter-chip" key={filter.label}>
              <span>{filter.label}:</span>
              {filter.type === 'select'
                ? <select disabled defaultValue={filter.options?.[0]}>{(filter.options ?? []).map((option) => <option key={option}>{option}</option>)}</select>
                : <em className="not-italic text-[color:var(--fg-subtle)]">{filter.type === 'date' ? 'Semua tanggal' : 'Semua'}</em>}
            </label>
          ))}
        </div>
      )}
      <div className="list-toolbar">
        <button type="button" className="tool-primary" disabled><Icon name="plus" /> Baru</button>
        <button type="button" className="tool-icon" disabled title="Muat ulang"><Icon name="refresh" /></button>
        {(spec.actions ?? []).map((action) => <Button key={action} variant="secondary" disabled>{action}</Button>)}
        <div className="list-toolbar-right">
          <button type="button" className="tool-icon" disabled title="Ekspor"><Icon name="upload" /></button>
          <button type="button" className="tool-icon" disabled title="Cetak"><Icon name="printer" /></button>
          <button type="button" className="tool-icon" disabled title="Pengaturan kolom"><Icon name="settings" /></button>
          <span className="list-search"><Icon name="search" /><input placeholder="Cari… (Enter)" disabled /></span>
          <span className="list-count">0</span>
        </div>
      </div>
      <div className="table-wrap">
        <table className="list-table">
          <thead><tr>{spec.columns.map((column) => <th key={column.label} className={cx(column.align === 'right' && 'number')}>{column.label}</th>)}</tr></thead>
          <tbody><tr><td colSpan={spec.columns.length} className="py-8 text-center text-[color:var(--fg-subtle)]">{spec.empty ?? 'Belum ada data'}</td></tr></tbody>
        </table>
      </div>
      {spec.footer && (
        <div className="list-pager">
          <span className="text-[12px] font-bold text-[color:var(--fg-muted)]">{spec.footer[0]} <span className="mono ml-3">Rp 0</span></span>
          {spec.footer[1] && <Button variant="secondary" disabled>{spec.footer[1]}</Button>}
        </div>
      )}
    </div>
  )
}

function TransactionScaffold({ label, spec }: { label: string; spec: Extract<Spec, { kind: 'transaction' }> }) {
  const [panel, setPanel] = useState(spec.panels[0]?.key ?? 'lines')
  const active = spec.panels.find((item) => item.key === panel)

  return (
    <DocumentShell
      label="Data Baru"
      onBack={() => undefined}
      rail={<ActionRail actions={[
        { icon: 'check', label: 'Simpan', primary: true, items: [{ label: 'Simpan', onSelect: () => undefined, disabled: 'Backend modul ini belum tersedia' }] },
        { icon: 'printer', label: 'Cetak', items: [{ label: 'Cetak / Pratinjau', onSelect: () => undefined, disabled: 'Tersedia setelah dokumen tersimpan' }] },
        { icon: 'upload', label: 'Lampiran', items: [{ label: 'Kelola lampiran', onSelect: () => undefined, disabled: 'Tersedia setelah dokumen tersimpan' }] },
        { icon: 'more', label: 'Lainnya', items: [{ label: 'Lihat Jurnal', onSelect: () => undefined, disabled: 'Tersedia setelah dokumen tersimpan' }] },
      ]} />}
    >
      <div className="doc-header">
        <div className="doc-header-row">{spec.header.slice(0, 2).map((field) => <FieldControl key={field.label} field={field} />)}</div>
        <div className="doc-header-row">
          <label className="doc-field"><span className="lookup-label">{spec.numberLabel} <b>*</b></span>
            <span className="flex items-center gap-1.5">
              <button type="button" className="tool-icon" disabled title="Nomor otomatis">A</button>
              <select disabled defaultValue={spec.numberTemplate}><option>{spec.numberTemplate}</option></select>
            </span>
          </label>
          {spec.header.slice(2).map((field) => <FieldControl key={field.label} field={field} />)}
          {spec.pull && <label className="doc-field">Ambil dari dokumen hulu<select disabled><option>{spec.pull} ▾</option></select></label>}
        </div>
      </div>

      <div className="doc-panels">
        <IconTabs tabs={spec.panels.map((item) => ({ key: item.key, label: item.label, icon: item.icon }))} active={panel} onChange={setPanel} />
        <div className="doc-panel">
          {active?.fields
            ? <div className="doc-grid">{active.fields.map((field) => <FieldControl key={field.label} field={field} />)}</div>
            : spec.columns.length > 0 && (
              <div className="line-grid">
                <div className="line-picker">
                  <strong>{active?.label ?? label} <b>*</b></strong>
                  <span className="line-picker-search">
                    <Icon name="search" />
                    <select disabled><option>Cari/Pilih Barang &amp; Jasa…</option></select>
                  </span>
                </div>
                <div className="table-wrap">
                  <table className="line-table">
                    <thead><tr>{spec.columns.map((column) => <th key={column.label} className={cx(column.align === 'right' && 'number')}>{column.label}</th>)}</tr></thead>
                    <tbody><tr><td colSpan={spec.columns.length} className="py-6 text-center text-[color:var(--fg-subtle)]">Belum ada data</td></tr></tbody>
                  </table>
                </div>
              </div>
            )}
        </div>
      </div>

      {spec.totals && (
        <div className="totals-footer">
          {spec.totals.map((total) => <div className="totals-row is-total" key={total}><span>{total}</span><span>Rp 0</span></div>)}
        </div>
      )}
    </DocumentShell>
  )
}

function MasterScaffold({ label, spec }: { label: string; spec: Extract<Spec, { kind: 'master' }> }) {
  const [tab, setTab] = useState(spec.tabs[0]?.label ?? label)
  const active = spec.tabs.find((item) => item.label === tab) ?? spec.tabs[0]

  return (
    <DocumentShell
      label="Data Baru"
      onBack={() => undefined}
      subTabs={spec.tabs.map((item) => ({ key: item.label, label: item.label }))}
      activeSubTab={tab}
      onSubTab={setTab}
      rail={<ActionRail actions={[
        { icon: 'check', label: 'Simpan', primary: true, items: [{ label: 'Simpan', onSelect: () => undefined, disabled: 'Backend modul ini belum tersedia' }] },
      ]} />}
    >
      {active?.sections.map((section, index) => (
        <div key={section.title ?? index} className="mb-5">
          {section.title && <h2 className="mb-3 text-base font-bold text-[color:var(--info)]">{section.title}</h2>}
          <div className="doc-grid">{section.fields.map((field) => <FieldControl key={field.label} field={field} />)}</div>
        </div>
      ))}
    </DocumentShell>
  )
}

function InfoScaffold({ spec }: { spec: Extract<Spec, { kind: 'info' }> }) {
  return (
    <div className="panel grid place-items-center px-6 py-20 text-center">
      <div className="max-w-xl">
        <h2 className="mb-3 text-2xl font-normal text-[color:var(--fg)]">{spec.title}</h2>
        <p className="mb-6 text-[13px] leading-relaxed text-[color:var(--fg-muted)]">{spec.body}</p>
        {spec.action && <Button disabled>{spec.action}</Button>}
      </div>
    </div>
  )
}
