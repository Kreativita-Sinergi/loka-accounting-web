import { useRef, useState } from 'react'
import { Icon } from './Icon'
import { cx } from './ui'
import { formatMoney, lineTotal } from '../lib/money'

export type DocumentLine = {
  id: string
  item_id: string
  description: string
  quantity: string
  unit_price: string
  discount: string
  warehouse_id: string
  note: string
}

export type LineOption = { value: string; label: string; code: string; unit: string }

export const emptyLine = (): DocumentLine => ({
  id: Math.random().toString(36).slice(2, 10),
  item_id: '', description: '', quantity: '1', unit_price: '0', discount: '0', warehouse_id: '', note: '',
})

/**
 * Grid rincian barang (§4.3): pencarian barang di atas menambah baris,
 * `Enter` membuat baris baru, `Ctrl+D` menduplikasi, dan baris dapat diseret.
 */
export function LineGrid({
  lines,
  onChange,
  items,
  warehouses,
  showWarehouse,
  showNote,
}: {
  lines: DocumentLine[]
  onChange: (lines: DocumentLine[]) => void
  items: LineOption[]
  warehouses: Array<{ value: string; label: string }>
  showWarehouse: boolean
  showNote: boolean
}) {
  const [picker, setPicker] = useState('')
  const dragged = useRef<number | null>(null)

  function update(index: number, patch: Partial<DocumentLine>) {
    onChange(lines.map((line, position) => position === index ? { ...line, ...patch } : line))
  }

  function addFromItem(itemId: string) {
    const option = items.find((candidate) => candidate.value === itemId)
    if (!option) return
    onChange([...lines, { ...emptyLine(), item_id: option.value, description: option.label }])
    setPicker('')
  }

  function keyboard(event: React.KeyboardEvent, index: number) {
    if (event.key === 'Enter') {
      event.preventDefault()
      onChange([...lines.slice(0, index + 1), emptyLine(), ...lines.slice(index + 1)])
      return
    }
    if (event.key.toLowerCase() === 'd' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      onChange([...lines.slice(0, index + 1), { ...lines[index], id: emptyLine().id }, ...lines.slice(index + 1)])
    }
  }

  function drop(target: number) {
    const source = dragged.current
    dragged.current = null
    if (source === null || source === target) return
    const next = [...lines]
    const [moved] = next.splice(source, 1)
    next.splice(target, 0, moved)
    onChange(next)
  }

  return (
    <div className="line-grid">
      <div className="line-picker">
        <strong>Rincian Barang <b>*</b></strong>
        <span className="line-picker-search">
          <Icon name="search" />
          <select value={picker} onChange={(event) => addFromItem(event.target.value)} aria-label="Cari atau pilih barang dan jasa">
            <option value="">Cari/Pilih Barang &amp; Jasa…</option>
            {items.map((item) => <option key={item.value} value={item.value}>{item.code} · {item.label}</option>)}
          </select>
        </span>
        <button type="button" onClick={() => onChange([...lines, emptyLine()])} title="Tambah baris kosong"><Icon name="plus" /> Baris</button>
      </div>

      <div className="table-wrap">
        <table className="line-table">
          <thead>
            <tr>
              <th className="line-handle-head"><span className="sr-only">Urutan</span></th>
              <th>Nama Barang</th>
              <th style={{ width: '120px' }}>Kode #</th>
              <th className="number" style={{ width: '100px' }}>Kuantitas</th>
              <th style={{ width: '80px' }}>Satuan</th>
              <th className="number" style={{ width: '130px' }}>@Harga</th>
              <th className="number" style={{ width: '90px' }}>Diskon %</th>
              {showWarehouse && <th style={{ width: '150px' }}>Gudang</th>}
              {showNote && <th style={{ width: '170px' }}>Keterangan</th>}
              <th className="number" style={{ width: '140px' }}>Total Harga</th>
              <th style={{ width: '34px' }}><span className="sr-only">Hapus</span></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const option = items.find((candidate) => candidate.value === line.item_id)
              return (
                <tr
                  key={line.id}
                  draggable
                  onDragStart={() => { dragged.current = index }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => drop(index)}
                >
                  <td className="line-handle" title="Seret untuk mengurutkan"><Icon name="more" /></td>
                  <td>
                    <select value={line.item_id} onChange={(event) => {
                      const picked = items.find((candidate) => candidate.value === event.target.value)
                      update(index, { item_id: event.target.value, description: picked?.label ?? line.description })
                    }}>
                      <option value="">— tanpa master barang —</option>
                      {items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <input value={line.description} onChange={(event) => update(index, { description: event.target.value })} onKeyDown={(event) => keyboard(event, index)} placeholder="Deskripsi baris" required />
                  </td>
                  <td className="mono">{option?.code ?? '—'}</td>
                  <td><input className="number" value={line.quantity} inputMode="decimal" onChange={(event) => update(index, { quantity: event.target.value })} onKeyDown={(event) => keyboard(event, index)} /></td>
                  <td className="line-unit">{option?.unit ?? '—'}</td>
                  <td><input className="number" value={line.unit_price} inputMode="decimal" onChange={(event) => update(index, { unit_price: event.target.value })} onKeyDown={(event) => keyboard(event, index)} /></td>
                  <td><input className="number" value={line.discount} inputMode="decimal" onChange={(event) => update(index, { discount: event.target.value })} onKeyDown={(event) => keyboard(event, index)} /></td>
                  {showWarehouse && (
                    <td>
                      <select value={line.warehouse_id} onChange={(event) => update(index, { warehouse_id: event.target.value })}>
                        <option value="">— gudang dokumen —</option>
                        {warehouses.map((warehouse) => <option key={warehouse.value} value={warehouse.value}>{warehouse.label}</option>)}
                      </select>
                    </td>
                  )}
                  {showNote && <td><input value={line.note} onChange={(event) => update(index, { note: event.target.value })} onKeyDown={(event) => keyboard(event, index)} /></td>}
                  <td className={cx('number', 'mono')}>{formatMoney(lineTotal(line))}</td>
                  <td>
                    <button type="button" className="line-remove" onClick={() => onChange(lines.filter((_, position) => position !== index))} aria-label="Hapus baris" disabled={lines.length === 1}>
                      <Icon name="close" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="line-hint">Enter menambah baris baru · Ctrl+D menduplikasi baris · seret ikon di kiri untuk mengurutkan.</p>
    </div>
  )
}
