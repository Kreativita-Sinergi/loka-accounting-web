import { useEffect, useState } from 'react'
import {
  adjustInventory, listDocuments, listDocumentsPaged, listInventoryBalances, listItems, listReservations, listUnits,
  listWarehouses, releaseReservation, reserveInventory, stockOpname, transferInventory, transitionDocument,
} from '../api/operations'
import { listContacts } from '../api/accounting'
import { listProjects } from '../api/projects'
import { openDocumentPrint } from '../api/print'
import type { Project } from '../types/reports'
import { Badge, Button, DataEntryGuide, PageHeader } from '../components/ui'
import { AddButton, DataTable, TablePanel, type Column } from '../components/DataTable'
import { ListView, type ListColumn } from '../components/ListView'
import { JournalPeek } from '../components/JournalPeek'
import { DocumentForm } from './DocumentForm'
import { usePersisted } from '../lib/persist'
import { useServerList } from '../lib/serverList'
import { downloadCsv, fetchAllPages } from '../lib/csv'
import { formatDate, formatMinor, fromMinor } from '../lib/money'
import { ConfirmDialog, FormModal, messageOf, useConfirm } from '../components/Modal'
import type { Contact } from '../types/accounting'
import type { BusinessDocument, InventoryBalance, InventoryReservation, Item, Unit, Warehouse } from '../types/operations'

const documentTypes = ['SALES_QUOTE', 'SALES_ORDER', 'DELIVERY', 'SALES_INVOICE', 'SALES_RETURN', 'PURCHASE_REQUISITION', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'PURCHASE_INVOICE', 'PURCHASE_RETURN']
const advanceable = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'OPEN', 'PARTIAL']
/** Dokumen hilir utama untuk aksi cepat "Proses" dari daftar. */
const downstreamPrimary: Record<string, string> = {
  SALES_QUOTE: 'SALES_ORDER', SALES_ORDER: 'DELIVERY', DELIVERY: 'SALES_INVOICE', SALES_INVOICE: 'SALES_RETURN',
  PURCHASE_REQUISITION: 'PURCHASE_ORDER', PURCHASE_ORDER: 'GOODS_RECEIPT', GOODS_RECEIPT: 'PURCHASE_INVOICE', PURCHASE_INVOICE: 'PURCHASE_RETURN',
}
const downstreamOf = (type: string) => downstreamPrimary[type] ?? ''
const documentStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'OPEN', 'PARTIAL', 'COMPLETED', 'CANCELLED']

/** nextStatus mirrors the backend transition ladder for a document. */
function nextStatus(status: string) {
  if (status === 'DRAFT') return 'OPEN'
  if (status === 'PENDING_APPROVAL') return 'APPROVED'
  if (status === 'APPROVED') return 'OPEN'
  if (status === 'OPEN' || status === 'PARTIAL') return 'COMPLETED'
  return ''
}

function advanceLabel(status: string) {
  if (status === 'DRAFT') return 'Ajukan dokumen'
  if (status === 'PENDING_APPROVAL') return 'Cek approval'
  if (status === 'APPROVED') return 'Buka dokumen'
  return 'Selesaikan dokumen'
}

type InventoryAction = 'adjust' | 'transfer' | 'opname' | 'reserve'

export function DocumentsPage({ documentType, scale, onNotice }: { documentType?: string; scale: number; onNotice: (value: string) => void }) {
  const [documents, setDocuments] = useState<BusinessDocument[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [balances, setBalances] = useState<InventoryBalance[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [reservations, setReservations] = useState<InventoryReservation[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = usePersisted(`filter.documents.type.${documentType ?? 'all'}`, documentType ?? 'ALL')
  const [statusFilter, setStatusFilter] = usePersisted('filter.documents.status', 'ALL')

  const [view, setView] = useState<'list' | 'form'>('list')
  const [prefill, setPrefill] = useState<{ documentType: string; sourceId: string } | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [journalTarget, setJournalTarget] = useState<BusinessDocument | null>(null)
  const [inventoryAction, setInventoryAction] = useState<{ kind: InventoryAction; balance: InventoryBalance | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const advance = useConfirm<BusinessDocument>()
  const release = useConfirm<InventoryReservation>()

  async function refresh() {
    const results = await Promise.allSettled([
      listDocuments(), listItems(), listWarehouses(), listInventoryBalances(), listContacts(), listReservations(), listProjects(''), listUnits(),
    ])
    const [d, i, w, b, c, r, p, u] = results
    if (d.status === 'fulfilled') setDocuments(d.value ?? [])
    if (i.status === 'fulfilled') setItems(i.value ?? [])
    if (w.status === 'fulfilled') setWarehouses(w.value ?? [])
    if (b.status === 'fulfilled') setBalances(b.value ?? [])
    if (c.status === 'fulfilled') setContacts(c.value ?? [])
    if (r.status === 'fulfilled') setReservations(r.value ?? [])
    if (p.status === 'fulfilled') setProjects(p.value ?? [])
    if (u.status === 'fulfilled') setUnits(u.value ?? [])
    const failed = results.filter((result) => result.status === 'rejected').length
    if (failed > 0) onNotice(`${failed} data Jual Beli belum berhasil dimuat. Halaman tetap dapat digunakan.`)
    setLoading(false)
  }
  useEffect(() => { void refresh() }, [])

  /** save funnels every modal submit through one busy, error, and refresh path. */
  async function save(action: () => Promise<unknown>, success: string, done: () => void) {
    setSaving(true)
    setFormError(null)
    try {
      await action()
      await refresh()
      done()
      onNotice(success)
    } catch (error) {
      setFormError(messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  const activeItems = items.filter((item) => item.is_active)
  const inventoryItems = activeItems.filter((item) => item.item_type === 'INVENTORY')
  const activeWarehouses = warehouses.filter((warehouse) => warehouse.is_active)
  const openSalesOrders = documents.filter((document) => document.document_type === 'SALES_ORDER' && !['COMPLETED', 'CANCELLED'].includes(document.status))
  const itemLabel = (id: string) => { const item = items.find((candidate) => candidate.id === id); return item ? `${item.sku} · ${item.name}` : id.slice(0, 8) }
  const documentNumber = (id: string) => documents.find((document) => document.id === id)?.number ?? id.slice(0, 8)

  // Daftar dokumen dipaginasi server-side; `documents` tetap dipakai untuk
  // menamai reservasi dan menyediakan sales order yang masih terbuka.
  const documentList = useServerList('documents', listDocumentsPaged, {
    defaultSort: 'date',
    defaultOrder: 'desc',
    filters: { type: typeFilter, status: statusFilter },
  })

  /** Ekspor dokumen mengambil seluruh halaman hasil filter dari server. */
  async function exportDocuments() {
    const rows = await fetchAllPages(listDocumentsPaged, { filters: { type: typeFilter, status: statusFilter }, search: documentList.search, sort: 'date', order: 'desc' })
    downloadCsv('dokumen-bisnis.csv', ['Nomor', 'Jenis', 'Tanggal', 'Mata uang', 'Status', 'Nilai'],
      rows.map((document) => [document.number, document.document_type, document.document_date.slice(0, 10), document.currency_code, document.status, fromMinor(document.total_minor, scale)]))
    onNotice(`${rows.length} dokumen diekspor ke CSV.`)
  }

  function openInventory(kind: InventoryAction, balance: InventoryBalance | null = null) {
    setInventoryAction({ kind, balance })
    setFormError(null)
  }

  const documentColumns: Array<ListColumn<BusinessDocument>> = [
    { sortable: true, key: 'number', header: 'Nomor', className: 'mono', width: '150px', sortValue: (document) => document.number, cell: (document) => document.number },
    { sortable: true, key: 'type', header: 'Jenis', sortValue: (document) => document.document_type, cell: (document) => <span className="type-tag">{document.document_type}</span> },
    { sortable: true, key: 'date', header: 'Tanggal', width: '130px', sortValue: (document) => document.document_date, cell: (document) => formatDate(document.document_date) },
    { sortable: true, key: 'currency', header: 'Mata uang', width: '100px', optional: true, cell: (document) => document.currency_code },
    {
      key: 'status',
      header: 'Status',
      width: '150px',
      sortValue: (document) => document.status,
      cell: (document) => <Badge tone={document.status === 'COMPLETED' ? 'success' : document.status === 'PENDING_APPROVAL' ? 'warning' : 'neutral'}>{document.status}</Badge>,
    },
    { sortable: true, key: 'total', header: 'Nilai', align: 'right', className: 'mono', width: '150px', sortValue: (document) => document.total_minor, cell: (document) => formatMinor(document.total_minor, scale) },
  ]

  const balanceColumns: Array<Column<InventoryBalance>> = [
    { header: 'Produk', cell: (balance) => <><strong>{balance.item_name}</strong><small className="block mono">{balance.sku}</small></> },
    { header: 'Gudang', cell: (balance) => <>{balance.warehouse_name}<small className="block mono">{balance.warehouse_code}</small></> },
    { header: 'Kuantitas', align: 'right', className: 'mono', cell: (balance) => balance.quantity },
    { header: 'Nilai', align: 'right', className: 'mono', cell: (balance) => formatMinor(balance.value_minor, scale) },
  ]

  const reservationColumns: Array<Column<InventoryReservation>> = [
    { header: 'Dokumen', className: 'mono', cell: (reservation) => documentNumber(reservation.document_id) },
    { header: 'Produk', cell: (reservation) => itemLabel(reservation.item_id) },
    { header: 'Kuantitas', align: 'right', className: 'mono', cell: (reservation) => reservation.quantity },
    { header: 'Status', cell: (reservation) => <Badge tone={reservation.status === 'ACTIVE' ? 'warning' : 'neutral'}>{reservation.status}</Badge> },
  ]

  const inventoryTitles: Record<InventoryAction, string> = {
    adjust: 'Penyesuaian persediaan',
    transfer: 'Transfer antar gudang',
    opname: 'Stock opname',
    reserve: 'Reservasi stok',
  }

  if (view === 'form') {
    return (
      <section>
        <DocumentForm
          key={formKey}
          prefill={prefill ?? (documentType ? { documentType, sourceId: '' } : null)}
          scale={scale}
          items={items}
          units={units}
          warehouses={warehouses}
          contacts={contacts}
          projects={projects}
          onCancel={() => { setPrefill(null); setView('list') }}
          onNotice={onNotice}
          onSaved={(created, again) => {
            void refresh()
            void documentList.reload()
            onNotice(`Dokumen ${created.number} tersimpan sebagai draft. Jurnal terbentuk saat dokumen diselesaikan.`)
            if (again) { setPrefill(null); setFormKey((value) => value + 1) }
          }}
          onProcess={(source, downstreamType) => {
            // "Proses" membuka form baru berjenis hilir dengan isi dokumen ini.
            setPrefill({ documentType: downstreamType, sourceId: source.id })
            setFormKey((value) => value + 1)
            onNotice(`Dokumen hilir disiapkan dari ${source.number}.`)
          }}
        />
      </section>
    )
  }

  return (
    <section>
      <PageHeader
        eyebrow="COMMERCE"
        title="Penjualan, pembelian, dan persediaan"
        description="Siklus dokumen terpadu dari penawaran dan pesanan sampai pengiriman, penerimaan, invoice, serta retur."
        action={<div className="page-actions">
          <Button variant="secondary" icon="refresh" onClick={() => openInventory('transfer')} disabled={inventoryItems.length === 0 || activeWarehouses.length < 2}>Transfer stok</Button>
          <Button variant="secondary" icon="check" onClick={() => openInventory('opname')} disabled={inventoryItems.length === 0 || activeWarehouses.length === 0}>Stock opname</Button>
          <AddButton onClick={() => { setPrefill(null); setFormKey((value) => value + 1); setView('form'); setFormError(null) }}>Dokumen baru</AddButton>
        </div>}
      />
      <DataEntryGuide
        steps={[
          'Klik “Dokumen baru”, pilih jenis dokumen, tanggal, kontak, produk, dan gudang yang sesuai.',
          'Isi kuantitas, harga, diskon atau pajak; gunakan kurs hanya untuk transaksi valuta asing.',
          'Gunakan menu aksi (titik tiga) pada baris dokumen untuk mengajukan, menyelesaikan, atau mencetaknya.',
          'Gunakan menu aksi (titik tiga) pada saldo gudang untuk penyesuaian, transfer, opname, atau reservasi stok.',
        ]}
        note="Master kontak, produk, dan gudang sebaiknya dibuat terlebih dahulu. Penyelesaian dokumen membentuk jurnal dan pergerakan stok secara atomik."
      />

      <ListView
        storageKey="documents"
        columns={documentColumns}
        rows={documentList.rows}
        keyOf={(document) => document.id}
        loading={documentList.loading}
        server={documentList.server}
        search={documentList.search}
        onSearch={documentList.setSearch}
        searchPlaceholder="Cari nomor, jenis, atau status dokumen"
        onCreate={() => { setPrefill(null); setFormKey((value) => value + 1); setView('form'); setFormError(null) }}
        createLabel="Dokumen baru"
        onRefresh={() => { void refresh(); void documentList.reload() }}
        onExport={() => void exportDocuments()}
        onPrint={() => window.print()}
        empty={documentList.error ?? (documents.length === 0 ? 'Belum ada dokumen bisnis.' : 'Tidak ada dokumen yang cocok dengan filter.')}
        filters={[
          {
            key: 'type',
            label: 'Jenis',
            value: typeFilter,
            onChange: setTypeFilter,
            options: [{ value: 'ALL', label: 'Semua' }, ...documentTypes.map((type) => ({ value: type, label: type }))],
          },
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [{ value: 'ALL', label: 'Semua' }, ...documentStatuses.map((value) => ({ value, label: value }))],
          },
        ]}
        rowActions={[
          { label: (document) => advanceLabel(document.status), icon: 'check', onSelect: advance.open, when: (document) => advanceable.includes(document.status) },
          { label: 'Lihat Jurnal', icon: 'journal', onSelect: setJournalTarget },
          {
            label: 'Proses ke dokumen hilir',
            icon: 'operations',
            onSelect: (document) => { setPrefill({ documentType: downstreamOf(document.document_type), sourceId: document.id }); setFormKey((value) => value + 1); setView('form') },
            when: (document) => downstreamOf(document.document_type) !== '',
          },
          { label: 'Cetak PDF', icon: 'printer', onSelect: (document) => void openDocumentPrint(document.id, 'pdf') },
          { label: 'Pratinjau', icon: 'reports', onSelect: (document) => void openDocumentPrint(document.id, 'html') },
        ]}
        onRowOpen={setJournalTarget}
      />

      <TablePanel
        title="Saldo per gudang"
        description="Kuantitas dan valuasi stok saat ini."
        badge={`${balances.length} posisi`}
        action={<Button variant="secondary" icon="plus" onClick={() => openInventory('adjust')} disabled={inventoryItems.length === 0 || activeWarehouses.length === 0}>Penyesuaian</Button>}
      >
        <DataTable
          columns={balanceColumns}
          rows={balances}
          keyOf={(balance) => `${balance.item_id}-${balance.warehouse_id}`}
          loading={loading}
          empty="Belum ada saldo persediaan."
          rowActions={[
            { label: 'Sesuaikan stok', icon: 'edit', onSelect: (balance) => openInventory('adjust', balance) },
            { label: 'Transfer ke gudang lain', icon: 'refresh', onSelect: (balance) => openInventory('transfer', balance), disabled: () => activeWarehouses.length < 2 && 'Butuh minimal dua gudang aktif' },
            { label: 'Catat opname', icon: 'check', onSelect: (balance) => openInventory('opname', balance) },
            { label: 'Reservasi untuk sales order', icon: 'journal', onSelect: (balance) => openInventory('reserve', balance), disabled: () => openSalesOrders.length === 0 && 'Belum ada sales order terbuka' },
          ]}
        />
      </TablePanel>

      {reservations.length > 0 && (
        <TablePanel
          title="Reservasi stok"
          description="Stok yang ditahan untuk sales order."
          badge={`${reservations.filter((reservation) => reservation.status === 'ACTIVE').length} aktif`}
          badgeTone="warning"
        >
          <DataTable
            columns={reservationColumns}
            rows={reservations}
            keyOf={(reservation) => reservation.id}
            empty="Belum ada reservasi stok."
            rowActions={[{ label: 'Lepas reservasi', icon: 'power', danger: true, onSelect: release.open, when: (reservation) => reservation.status === 'ACTIVE' }]}
          />
        </TablePanel>
      )}

      {/* ---- Inventory action modal ---- */}
      <FormModal
        open={inventoryAction !== null}
        formKey={`${inventoryAction?.kind}-${inventoryAction?.balance?.item_id ?? 'new'}`}
        eyebrow="PERSEDIAAN"
        title={inventoryAction ? inventoryTitles[inventoryAction.kind] : ''}
        description={inventoryAction?.kind === 'adjust' ? 'Setiap perubahan menjadi movement append-only dan stok negatif ditolak.'
          : inventoryAction?.kind === 'transfer' ? 'Transfer mengurangi stok gudang asal dan menambah gudang tujuan dalam satu transaksi.'
          : inventoryAction?.kind === 'opname' ? 'Selisih antara hasil hitung dan saldo sistem dicatat sebagai movement.'
          : 'Reservasi menahan stok untuk sales order tanpa mengurangi saldo.'}
        submitLabel="Simpan"
        busy={saving}
        error={formError}
        onClose={() => setInventoryAction(null)}
        onSubmit={(values) => {
          if (!inventoryAction) return
          const { kind } = inventoryAction
          if (kind === 'adjust') {
            return save(() => adjustInventory({
              item_id: String(values.get('item_id')),
              warehouse_id: String(values.get('warehouse_id')),
              quantity_delta: String(values.get('quantity_delta')),
              value_delta: String(values.get('value_delta')),
            }), 'Penyesuaian stok berhasil dicatat.', () => setInventoryAction(null))
          }
          if (kind === 'transfer') {
            return save(() => transferInventory({
              item_id: String(values.get('item_id')),
              from_warehouse_id: String(values.get('from')),
              to_warehouse_id: String(values.get('to')),
              quantity: String(values.get('quantity')),
            }), 'Transfer antar gudang berhasil dicatat.', () => setInventoryAction(null))
          }
          if (kind === 'opname') {
            return save(() => stockOpname({
              item_id: String(values.get('item_id')),
              warehouse_id: String(values.get('warehouse_id')),
              counted_quantity: String(values.get('counted')),
              surplus_unit_cost: String(values.get('unit_cost') || '0'),
            }), 'Hasil stock opname dicatat sebagai movement append-only.', () => setInventoryAction(null))
          }
          return save(() => reserveInventory({
            document_id: String(values.get('document_id')),
            item_id: String(values.get('item_id')),
            warehouse_id: String(values.get('warehouse_id')),
            quantity: String(values.get('quantity')),
          }), 'Stok berhasil direservasi.', () => setInventoryAction(null))
        }}
      >
        {inventoryAction?.kind === 'reserve' && (
          <label>Sales order
            <select name="document_id" required>{openSalesOrders.map((document) => <option key={document.id} value={document.id}>{document.number}</option>)}</select>
          </label>
        )}
        <label>Produk persediaan
          <select name="item_id" defaultValue={inventoryAction?.balance?.item_id ?? ''} required>
            <option value="">Pilih produk</option>
            {inventoryItems.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}
          </select>
        </label>
        {inventoryAction?.kind === 'transfer' ? (
          <div className="form-row">
            <label>Dari gudang
              <select name="from" defaultValue={inventoryAction.balance?.warehouse_id ?? ''} required>
                <option value="">Pilih gudang</option>
                {activeWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.name}</option>)}
              </select>
            </label>
            <label>Ke gudang
              <select name="to" required>
                <option value="">Pilih gudang</option>
                {activeWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.name}</option>)}
              </select>
            </label>
            <label>Kuantitas<input name="quantity" inputMode="decimal" required /></label>
          </div>
        ) : (
          <div className="form-row">
            <label>Gudang
              <select name="warehouse_id" defaultValue={inventoryAction?.balance?.warehouse_id ?? ''} required>
                <option value="">Pilih gudang</option>
                {activeWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.name}</option>)}
              </select>
            </label>
            {inventoryAction?.kind === 'adjust' && <>
              <label>Perubahan kuantitas<input name="quantity_delta" placeholder="10 atau -2" required /></label>
              <label>Perubahan nilai<input name="value_delta" defaultValue="0" required /></label>
            </>}
            {inventoryAction?.kind === 'opname' && <>
              <label>Hasil hitung<input name="counted" inputMode="decimal" required /></label>
              <label>Biaya surplus per unit<input name="unit_cost" defaultValue="0" inputMode="numeric" /></label>
            </>}
            {inventoryAction?.kind === 'reserve' && <label>Kuantitas<input name="quantity" inputMode="decimal" required /></label>}
          </div>
        )}
        {inventoryAction?.balance && (
          <p className="modal-note">Saldo saat ini: <strong>{inventoryAction.balance.quantity}</strong> di {inventoryAction.balance.warehouse_name}, senilai {formatMinor(inventoryAction.balance.value_minor, scale)}.</p>
        )}
      </FormModal>

      {/* ---- Confirm dialogs ---- */}
      <ConfirmDialog
        open={advance.target !== null}
        title={advance.target ? advanceLabel(advance.target.status) + '?' : ''}
        confirmLabel="Lanjutkan"
        busy={advance.busy}
        error={advance.error}
        onClose={advance.close}
        onConfirm={() => advance.run((document) => transitionDocument(document.id, nextStatus(document.status)).then(async (result) => {
          await refresh()
          onNotice(result.status === 'PENDING_APPROVAL' ? 'Dokumen masuk antrean approval.'
            : result.status === 'COMPLETED' ? 'Dokumen selesai; jurnal dan subledger sudah diposting.'
            : `Status dokumen menjadi ${result.status}.`)
        }))}
        description={advance.target?.status === 'OPEN' || advance.target?.status === 'PARTIAL'
          ? <>Menyelesaikan <strong>{advance.target.number}</strong> akan mem-post jurnal, open item, dan pergerakan stok secara atomik. Tindakan ini tidak dapat dibatalkan.</>
          : <>Status dokumen <strong>{advance.target?.number}</strong> akan berubah dari {advance.target?.status} menjadi {advance.target ? nextStatus(advance.target.status) : ''}.</>}
      />

      <JournalPeek
        open={journalTarget !== null}
        documentId={journalTarget?.id ?? ''}
        number={journalTarget?.number ?? ''}
        scale={scale}
        onClose={() => setJournalTarget(null)}
      />

      <ConfirmDialog
        open={release.target !== null}
        tone="danger"
        title="Lepas reservasi stok?"
        confirmLabel="Lepas reservasi"
        busy={release.busy}
        error={release.error}
        onClose={release.close}
        onConfirm={() => release.run((reservation) => releaseReservation(reservation.id).then(refresh))}
        description={<>Reservasi <strong>{release.target ? itemLabel(release.target.item_id) : ''}</strong> sebanyak {release.target?.quantity} akan dilepas dan stok kembali tersedia untuk dokumen lain.</>}
      />
    </section>
  )
}
