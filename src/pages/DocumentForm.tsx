import { useEffect, useState } from 'react'
import { createDocument, getDocument, listDocumentsPaged } from '../api/operations'
import { openDocumentPrint } from '../api/print'
import { AttachmentsModal } from '../components/Attachments'
import { JournalPeek } from '../components/JournalPeek'
import { ActionRail, DocumentShell, IconTabs, LookupField, type IconTab } from '../components/FormShell'
import { LineGrid, emptyLine, type DocumentLine } from '../components/LineGrid'
import { decimal, formatMoney, fromMinor, lineTotal } from '../lib/money'
import { messageOf } from '../components/Modal'
import { useTabHandle } from '../store/tabs'
import type { Contact } from '../types/accounting'
import type { BusinessDocument, Item, Unit, Warehouse } from '../types/operations'
import type { Project } from '../types/reports'

const salesTypes = ['SALES_QUOTE', 'SALES_ORDER', 'DELIVERY', 'SALES_INVOICE', 'SALES_RETURN']
const purchaseTypes = ['PURCHASE_REQUISITION', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'PURCHASE_INVOICE', 'PURCHASE_RETURN']

/** Dokumen hulu yang lazim menjadi sumber "Ambil" untuk tiap jenis dokumen. */
const upstream: Record<string, string[]> = {
  SALES_ORDER: ['SALES_QUOTE'],
  DELIVERY: ['SALES_ORDER'],
  SALES_INVOICE: ['SALES_ORDER', 'DELIVERY'],
  SALES_RETURN: ['SALES_INVOICE'],
  PURCHASE_ORDER: ['PURCHASE_REQUISITION'],
  GOODS_RECEIPT: ['PURCHASE_ORDER'],
  PURCHASE_INVOICE: ['PURCHASE_ORDER', 'GOODS_RECEIPT'],
  PURCHASE_RETURN: ['PURCHASE_INVOICE'],
}

/** Dokumen hilir yang dapat diproses dari sebuah dokumen (tombol "Proses"). */
const downstream: Record<string, string[]> = {
  SALES_QUOTE: ['SALES_ORDER'],
  SALES_ORDER: ['DELIVERY', 'SALES_INVOICE'],
  DELIVERY: ['SALES_INVOICE'],
  SALES_INVOICE: ['SALES_RETURN'],
  PURCHASE_REQUISITION: ['PURCHASE_ORDER'],
  PURCHASE_ORDER: ['GOODS_RECEIPT', 'PURCHASE_INVOICE'],
  GOODS_RECEIPT: ['PURCHASE_INVOICE'],
  PURCHASE_INVOICE: ['PURCHASE_RETURN'],
}

const documentLabels: Record<string, string> = {
  SALES_QUOTE: 'Penawaran Penjualan', SALES_ORDER: 'Pesanan Penjualan', DELIVERY: 'Pengiriman Barang',
  SALES_INVOICE: 'Faktur Penjualan', SALES_RETURN: 'Retur Penjualan',
  PURCHASE_REQUISITION: 'Permintaan Pembelian', PURCHASE_ORDER: 'Pesanan Pembelian', GOODS_RECEIPT: 'Penerimaan Barang',
  PURCHASE_INVOICE: 'Faktur Pembelian', PURCHASE_RETURN: 'Retur Pembelian',
}

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Pola FORM TRANSAKSI (§4.3): header dokumen, ikon tab vertikal, grid rincian,
 * footer total berjenjang, dan rail aksi kanan yang selalu terlihat.
 */
export function DocumentForm({
  prefill, scale, items, units, warehouses, contacts, projects, onCancel, onSaved, onNotice, onProcess,
}: {
  /** Isian awal ketika form dibuka lewat tombol "Proses" dokumen hulu. */
  prefill?: { documentType: string; sourceId: string } | null
  /** Skala mata uang perusahaan; nilai minor unit dibagi 10^scale. */
  scale: number
  items: Item[]
  units: Unit[]
  warehouses: Warehouse[]
  contacts: Contact[]
  projects: Project[]
  onCancel: () => void
  onSaved: (document: BusinessDocument, again: boolean) => void
  onNotice: (message: string) => void
  onProcess: (source: BusinessDocument, downstreamType: string) => void
}) {
  const [panel, setPanel] = useState('lines')
  const [documentType, setDocumentType] = useState(prefill?.documentType ?? 'SALES_INVOICE')
  const [contactId, setContactId] = useState('')
  const [documentDate, setDocumentDate] = useState(today())
  const [dueDate, setDueDate] = useState('')
  const [autoNumber, setAutoNumber] = useState(true)
  const [number, setNumber] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [currency, setCurrency] = useState('IDR')
  const [rateNumerator, setRateNumerator] = useState('16000')
  const [rateDenominator, setRateDenominator] = useState('1')
  const [taxPercent, setTaxPercent] = useState('0')
  const [documentDiscount, setDocumentDiscount] = useState('0')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DocumentLine[]>([emptyLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState<BusinessDocument | null>(null)
  const [sources, setSources] = useState<BusinessDocument[]>([])
  const [attachmentsOpen, setAttachmentsOpen] = useState(false)
  const [journalOpen, setJournalOpen] = useState(false)

  // Tab dokumen menampilkan nomor setelah tersimpan dan menandai perubahan.
  useTabHandle(dirty, saved ? `Dokumen ${saved.number}` : 'Data Baru')

  const isSales = salesTypes.includes(documentType)
  const partnerLabel = isSales ? 'Pelanggan' : 'Pemasok'
  const unitLabel = (id: string) => units.find((unit) => unit.id === id)?.code ?? '—'

  const itemOptions = items.filter((item) => item.is_active).map((item) => ({
    value: item.id, label: item.name, code: item.sku, unit: unitLabel(item.base_unit_id),
  }))
  const warehouseOptions = warehouses.filter((warehouse) => warehouse.is_active).map((warehouse) => ({ value: warehouse.id, label: `${warehouse.code} · ${warehouse.name}` }))
  const contactOptions = contacts.filter((contact) => contact.is_active)
    .filter((contact) => contact.type === 'BOTH' || contact.type === (isSales ? 'CUSTOMER' : 'SUPPLIER'))
    .map((contact) => ({ value: contact.id, label: contact.name }))

  // Dokumen hulu diambil dari server per jenis, bukan dari daftar penuh di klien.
  useEffect(() => {
    const types = upstream[documentType] ?? []
    if (types.length === 0) { setSources([]); return }
    let cancelled = false
    void Promise.all(types.map((type) => listDocumentsPaged({ page: 1, size: 50, sort: 'date', order: 'desc', filters: { type } })))
      .then((pages) => { if (!cancelled) setSources(pages.flatMap((page) => page.rows ?? []).filter((document) => document.status !== 'CANCELLED')) })
      .catch(() => { if (!cancelled) setSources([]) })
    return () => { cancelled = true }
  }, [documentType])

  // Dokumen sumber dari tombol "Proses" langsung disalin saat form dibuka.
  useEffect(() => {
    if (!prefill?.sourceId) return
    let cancelled = false
    void getDocument(prefill.sourceId)
      .then((source) => { if (!cancelled) applySource(source) })
      .catch(() => onNotice('Dokumen sumber gagal dimuat; isi rincian secara manual.'))
    return () => { cancelled = true }
    // Hanya dijalankan sekali untuk dokumen sumber yang diminta.
     
  }, [prefill?.sourceId])

  const subTotal = lines.reduce((total, line) => total + lineTotal(line), 0)
  const discountValue = subTotal * (decimal(documentDiscount) / 100)
  const base = subTotal - discountValue
  const taxValue = base * (decimal(taxPercent) / 100)
  const total = base + taxValue

  function touch<T>(setter: (value: T) => void) {
    return (value: T) => { setDirty(true); setter(value) }
  }

  /** Menyalin isi dokumen hulu ke form ini. */
  function applySource(source: BusinessDocument) {
    if (source.contact_id) setContactId(source.contact_id)
    if (source.currency_code) setCurrency(source.currency_code)
    const sourceLines = source.lines ?? []
    if (sourceLines.length === 0) {
      onNotice(`Dokumen ${source.number} tidak memiliki rincian baris untuk disalin.`)
      return
    }
    setLines(sourceLines.map((line) => ({
      ...emptyLine(),
      item_id: line.item_id ?? '',
      description: line.description,
      quantity: line.quantity,
      unit_price: String(fromMinor(line.unit_price_minor, scale)),
    })))
    setDirty(true)
    onNotice(`Rincian dari ${source.number} berhasil diambil.`)
  }

  /** "Ambil": tarik dokumen hulu lengkap dengan barisnya dari server. */
  async function pull(id: string) {
    try {
      applySource(await getDocument(id))
    } catch {
      onNotice('Dokumen hulu gagal diambil.')
    }
  }

  async function save(again: boolean) {
    const filled = lines.filter((line) => line.description.trim() !== '')
    if (filled.length === 0) { setError('Rincian barang wajib diisi minimal satu baris.'); setPanel('lines'); return }
    setSaving(true)
    setError(null)
    try {
      const created = await createDocument({
        document_type: documentType,
        contact_id: contactId || null,
        project_id: projectId || null,
        currency_code: currency,
        exchange_rate_numerator: currency === 'IDR' ? 0 : Number(rateNumerator),
        exchange_rate_denominator: currency === 'IDR' ? 0 : Number(rateDenominator),
        warehouse_id: warehouseId || null,
        document_date: documentDate,
        due_date: dueDate || null,
        number: autoNumber ? '' : number,
        notes,
        lines: filled.map((line) => {
          const item = items.find((candidate) => candidate.id === line.item_id)
          const gross = decimal(line.quantity) * decimal(line.unit_price)
          const net = lineTotal(line)
          return {
            item_id: item?.id ?? null,
            unit_id: item?.base_unit_id ?? null,
            warehouse_id: line.warehouse_id || warehouseId || null,
            description: line.description || line.note,
            quantity: line.quantity,
            unit_price: line.unit_price,
            discount: String(gross - net),
            tax: String(net * (decimal(taxPercent) / 100)),
          }
        }),
      })
      setDirty(false)
      setSaved(created)
      onSaved(created, again)
      if (again) {
        setSaved(null)
        setLines([emptyLine()])
        setContactId('')
        setNumber('')
        setNotes('')
      }
    } catch (saveError) {
      setError(messageOf(saveError, 'Dokumen gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const panels: IconTab[] = [
    { key: 'lines', label: 'Rincian Barang', icon: 'journal' },
    { key: 'info', label: 'Info', icon: 'empty' },
    { key: 'tax', label: 'Pajak & Valas', icon: 'receipt' },
  ]

  return (
    <DocumentShell
      label={saved?.number ?? (autoNumber ? 'Data Baru' : number || 'Data Baru')}
      dirty={dirty}
      onBack={onCancel}
      rail={<ActionRail actions={[
        {
          icon: 'check', label: 'Simpan', primary: true, items: [
            { label: saved ? 'Tersimpan' : 'Simpan', onSelect: () => void save(false), disabled: (saving && 'Sedang menyimpan…') || (Boolean(saved) && 'Dokumen ini sudah tersimpan') },
            { label: 'Simpan & Baru', onSelect: () => void save(true), disabled: (saving && 'Sedang menyimpan…') || (Boolean(saved) && 'Dokumen ini sudah tersimpan') },
          ],
        },
        {
          icon: 'printer', label: 'Cetak', items: [
            { label: 'Cetak PDF', onSelect: () => { if (saved) void openDocumentPrint(saved.id, 'pdf') }, disabled: !saved && 'Tersedia setelah dokumen tersimpan' },
            { label: 'Pratinjau', onSelect: () => { if (saved) void openDocumentPrint(saved.id, 'html') }, disabled: !saved && 'Tersedia setelah dokumen tersimpan' },
          ],
        },
        {
          icon: 'upload', label: 'Lampiran', items: [
            { label: 'Kelola lampiran', onSelect: () => setAttachmentsOpen(true), disabled: !saved && 'Tersedia setelah dokumen tersimpan' },
          ],
        },
        {
          icon: 'journal', label: 'Proses', items: (downstream[documentType] ?? []).length === 0
            ? [{ label: 'Tidak ada dokumen hilir', onSelect: () => undefined, disabled: 'Jenis dokumen ini tidak memiliki lanjutan' }]
            : (downstream[documentType] ?? []).map((type) => ({
              label: `Proses ke ${documentLabels[type] ?? type}`,
              onSelect: () => { if (saved) onProcess(saved, type) },
              disabled: !saved && 'Simpan dokumen ini lebih dulu',
            })),
        },
        {
          icon: 'more', label: 'Lainnya', items: [
            { label: 'Kosongkan rincian', onSelect: () => { setLines([emptyLine()]); setDirty(true) } },
            { label: 'Lihat Jurnal', onSelect: () => setJournalOpen(true), disabled: !saved && 'Tersedia setelah dokumen tersimpan' },
          ],
        },
      ]} />}
    >
      {error && <p className="modal-error">{error}</p>}

      <div className="doc-header">
        <div className="doc-header-row">
          <label className="doc-field">Jenis dokumen <b>*</b>
            <select value={documentType} onChange={(event) => touch(setDocumentType)(event.target.value)}>
              <optgroup label="Penjualan">{salesTypes.map((type) => <option key={type} value={type}>{documentLabels[type]}</option>)}</optgroup>
              <optgroup label="Pembelian">{purchaseTypes.map((type) => <option key={type} value={type}>{documentLabels[type]}</option>)}</optgroup>
            </select>
          </label>
          <LookupField label={partnerLabel} value={contactId} options={contactOptions} onChange={touch(setContactId)} placeholder={`Cari/Pilih ${partnerLabel}…`} />
        </div>
        <div className="doc-header-row">
          <label className="doc-field">Tanggal <b>*</b><input type="date" value={documentDate} onChange={(event) => touch(setDocumentDate)(event.target.value)} /></label>
          <label className="doc-field">Nomor dokumen <b>*</b>
            <span className="flex items-center gap-1.5">
              <button type="button" className="tool-icon" title={autoNumber ? 'Nomor otomatis' : 'Nomor manual'} onClick={() => touch(setAutoNumber)(!autoNumber)}>{autoNumber ? 'A' : 'M'}</button>
              <input value={autoNumber ? 'Otomatis dari penomoran' : number} onChange={(event) => touch(setNumber)(event.target.value)} disabled={autoNumber} placeholder="Ketik nomor" />
            </span>
          </label>
        </div>
        <div className="doc-header-row">
          <label className="doc-field">Ambil dari dokumen hulu
            <select value="" onChange={(event) => { if (event.target.value) void pull(event.target.value) }} disabled={sources.length === 0}>
              <option value="">{sources.length === 0 ? 'Tidak ada dokumen hulu' : 'Ambil ▾'}</option>
              {sources.map((source) => <option key={source.id} value={source.id}>{source.number} · {documentLabels[source.document_type] ?? source.document_type}</option>)}
            </select>
          </label>
          <label className="doc-field">Gudang
            <select value={warehouseId} onChange={(event) => touch(setWarehouseId)(event.target.value)}>
              <option value="">Tanpa gudang</option>
              {warehouseOptions.map((warehouse) => <option key={warehouse.value} value={warehouse.value}>{warehouse.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="doc-panels">
        <IconTabs tabs={panels} active={panel} onChange={setPanel} />
        <div className="doc-panel">
          {panel === 'lines' && (
            <LineGrid
              lines={lines}
              onChange={(value) => { setDirty(true); setLines(value) }}
              items={itemOptions}
              warehouses={warehouseOptions}
              showWarehouse={warehouseOptions.length > 0}
              showNote
            />
          )}
          {panel === 'info' && (
            <div className="doc-grid">
              <label className="doc-field">Jatuh tempo<input type="date" value={dueDate} onChange={(event) => touch(setDueDate)(event.target.value)} /></label>
              <label className="doc-field">Proyek
                <select value={projectId} onChange={(event) => touch(setProjectId)(event.target.value)}>
                  <option value="">Tanpa proyek</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}
                </select>
              </label>
              <label className="doc-field sm:col-span-2">Catatan<input value={notes} onChange={(event) => touch(setNotes)(event.target.value)} placeholder="Catatan internal atau syarat penyerahan" /></label>
            </div>
          )}
          {panel === 'tax' && (
            <div className="doc-grid">
              <label className="doc-field">Tarif pajak dokumen (%)<input value={taxPercent} inputMode="decimal" onChange={(event) => touch(setTaxPercent)(event.target.value)} /></label>
              <label className="doc-field">Mata uang<input value={currency} maxLength={3} onChange={(event) => touch(setCurrency)(event.target.value.toUpperCase())} /></label>
              {currency !== 'IDR' && <>
                <label className="doc-field">Kurs (Rp per {currency})<input value={rateNumerator} inputMode="numeric" onChange={(event) => touch(setRateNumerator)(event.target.value)} /></label>
                <label className="doc-field">Per<input value={rateDenominator} inputMode="numeric" onChange={(event) => touch(setRateDenominator)(event.target.value)} /></label>
                <p className="modal-note sm:col-span-2">Nilai dokumen tetap dalam {currency}; jurnal diposting dalam rupiah memakai kurs ini.</p>
              </>}
            </div>
          )}
        </div>
      </div>

      <div className="totals-footer">
        <div className="totals-row"><span>Sub Total</span><span>{formatMoney(subTotal)}</span></div>
        <div className="totals-row">
          <span>Diskon dokumen (%)</span>
          <span className="flex items-center gap-2">
            <input value={documentDiscount} inputMode="decimal" onChange={(event) => touch(setDocumentDiscount)(event.target.value)} />
            {formatMoney(discountValue)}
          </span>
        </div>
        <div className="totals-row"><span>DPP</span><span>{formatMoney(base)}</span></div>
        <div className="totals-row"><span>PPN ({taxPercent || 0}%)</span><span>{formatMoney(taxValue)}</span></div>
        <div className="totals-row is-total"><span>Total</span><span>{currency === 'IDR' ? `Rp ${formatMoney(total)}` : `${currency} ${formatMoney(total, 2)}`}</span></div>
      </div>

      {saved && <>
        <AttachmentsModal
          open={attachmentsOpen}
          entityType="BUSINESS_DOCUMENT"
          entityId={saved.id}
          title={saved.number}
          onClose={() => setAttachmentsOpen(false)}
          onNotice={onNotice}
        />
        <JournalPeek open={journalOpen} documentId={saved.id} number={saved.number} scale={scale} onClose={() => setJournalOpen(false)} />
      </>}
    </DocumentShell>
  )
}
