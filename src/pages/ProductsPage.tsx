import { useEffect, useMemo, useState } from 'react'
import {
  createItem, createUnit, createWarehouse, deleteItem, deleteUnit, deleteWarehouse,
  listItems, listUnitConversions, listUnits, listWarehouses, saveUnitConversion,
  setItemActive, setUnitActive, setWarehouseActive, updateItem, updateUnit, updateWarehouse,
} from '../api/operations'
import { Badge, Button, DataEntryGuide, EmptyState, PageHeader } from '../components/ui'
import { AddButton, DataTable, SearchInput, StatusPill, TablePanel, type Column } from '../components/DataTable'
import { ConfirmDialog, FormModal, messageOf, useConfirm } from '../components/Modal'
import type { Account } from '../types/accounting'
import type { Item, Unit, UnitConversion, Warehouse } from '../types/operations'

const itemTypeLabels: Record<Item['item_type'], string> = {
  INVENTORY: 'Barang persediaan',
  NON_INVENTORY: 'Non-persediaan',
  SERVICE: 'Jasa',
}

export function ProductsPage({ accounts, onNotice }: { accounts: Account[]; onNotice: (value: string) => void }) {
  const [units, setUnits] = useState<Unit[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [conversionItem, setConversionItem] = useState('')
  const [conversions, setConversions] = useState<UnitConversion[]>([])
  const [search, setSearch] = useState('')

  const [unitEditor, setUnitEditor] = useState<{ unit: Unit | null } | null>(null)
  const [warehouseEditor, setWarehouseEditor] = useState<{ warehouse: Warehouse | null } | null>(null)
  const [itemEditor, setItemEditor] = useState<{ item: Item | null } | null>(null)
  const [conversionOpen, setConversionOpen] = useState(false)
  const [itemType, setItemType] = useState<Item['item_type']>('INVENTORY')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const unitStatus = useConfirm<Unit>()
  const unitRemoval = useConfirm<Unit>()
  const warehouseStatus = useConfirm<Warehouse>()
  const warehouseRemoval = useConfirm<Warehouse>()
  const itemStatus = useConfirm<Item>()
  const itemRemoval = useConfirm<Item>()

  async function refresh() {
    const [unitRows, itemRows, warehouseRows] = await Promise.all([listUnits(), listItems(), listWarehouses()])
    setUnits(unitRows); setItems(itemRows); setWarehouses(warehouseRows)
    setLoading(false)
  }
  useEffect(() => { void refresh() }, [])

  async function loadConversions(itemId: string) {
    setConversionItem(itemId)
    setConversions(itemId ? await listUnitConversions(itemId) : [])
  }

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

  const activeUnits = units.filter((unit) => unit.is_active)
  const inventoryAccounts = accounts.filter((account) => account.type === 'ASSET')
  const cogsAccounts = accounts.filter((account) => account.type === 'EXPENSE' || account.type === 'OTHER_EXPENSE' || account.type === 'COGS')
  const editingItem = itemEditor?.item ?? null
  const editingUnit = unitEditor?.unit ?? null
  const editingWarehouse = warehouseEditor?.warehouse ?? null
  const unitLabel = (id: string) => { const unit = units.find((candidate) => candidate.id === id); return unit ? `${unit.code} · ${unit.name}` : '—' }

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return items
    return items.filter((item) => `${item.sku} ${item.name} ${item.item_type}`.toLowerCase().includes(needle))
  }, [items, search])

  const unitColumns: Array<Column<Unit>> = [
    { header: 'Kode', className: 'mono', width: '110px', cell: (unit) => unit.code },
    { header: 'Nama', cell: (unit) => <strong>{unit.name}</strong> },
    { header: 'Presisi', align: 'right', cell: (unit) => `${unit.precision} desimal` },
    { header: 'Status', cell: (unit) => <StatusPill active={unit.is_active} /> },
  ]

  const warehouseColumns: Array<Column<Warehouse>> = [
    { header: 'Kode', className: 'mono', width: '110px', cell: (warehouse) => warehouse.code },
    { header: 'Gudang', cell: (warehouse) => <><strong>{warehouse.name}</strong><small className="block">{warehouse.address ?? 'Alamat belum diisi'}</small></> },
    { header: 'Status', cell: (warehouse) => <StatusPill active={warehouse.is_active} /> },
  ]

  const itemColumns: Array<Column<Item>> = [
    { header: 'SKU', className: 'mono', width: '130px', cell: (item) => item.sku },
    { header: 'Nama', cell: (item) => <><strong>{item.name}</strong><small className="block">{unitLabel(item.base_unit_id)}</small></> },
    { header: 'Tipe', cell: (item) => <span className="type-tag">{itemTypeLabels[item.item_type]}</span> },
    { header: 'Biaya', cell: (item) => <span className="type-tag">{item.costing_method === 'FIFO' ? 'FIFO' : 'AVG'}</span> },
    { header: 'Batch', cell: (item) => item.track_lots ? <Badge tone="info">Lot</Badge> : <span className="text-slate-400">—</span> },
    { header: 'Status', cell: (item) => <StatusPill active={item.is_active} /> },
  ]

  return (
    <section>
      <PageHeader
        eyebrow="MASTER DATA"
        title="Produk dan gudang"
        description="Satuan, barang, jasa, serta lokasi stok terkelola sebagai master data mandiri."
        action={<div className="page-actions">
          <Button variant="secondary" icon="plus" onClick={() => { setUnitEditor({ unit: null }); setFormError(null) }}>Satuan</Button>
          <Button variant="secondary" icon="plus" onClick={() => { setWarehouseEditor({ warehouse: null }); setFormError(null) }}>Gudang</Button>
          <AddButton onClick={() => { setItemEditor({ item: null }); setItemType('INVENTORY'); setFormError(null) }} disabled={activeUnits.length === 0} title={activeUnits.length === 0 ? 'Buat satuan lebih dulu' : undefined}>Produk baru</AddButton>
        </div>}
      />
      <DataEntryGuide
        steps={[
          'Buat Satuan terlebih dahulu, misalnya PCS, KG, atau JAM.',
          'Buat Gudang jika barang akan memiliki stok fisik.',
          'Klik “Produk baru”, isi SKU dan nama, pilih satuan dasar serta tipe produk, lalu simpan.',
          'Gunakan menu aksi (titik tiga) pada setiap baris untuk Ubah, Nonaktifkan, Aktifkan, atau Hapus permanen.',
        ]}
        note="Produk persediaan memerlukan akun persediaan dan akun HPP. Hapus permanen hanya tersedia untuk data nonaktif yang belum pernah dipakai transaksi."
      />

      <TablePanel
        title="Katalog produk"
        description="Barang dan jasa beserta satuan dasar dan metode biayanya."
        badge={`${visibleItems.length} dari ${items.length}`}
        badgeTone="info"
        className="!mt-0"
        action={<AddButton onClick={() => { setItemEditor({ item: null }); setItemType('INVENTORY'); setFormError(null) }} disabled={activeUnits.length === 0}>Produk baru</AddButton>}
        toolbar={<SearchInput value={search} onChange={setSearch} placeholder="Cari SKU, nama, atau tipe produk…" />}
      >
        <DataTable
          columns={itemColumns}
          rows={visibleItems}
          keyOf={(item) => item.id}
          loading={loading}
          empty={items.length === 0 ? 'Belum ada produk. Buat satuan lebih dulu, lalu tambahkan produk.' : 'Tidak ada produk yang cocok dengan pencarian.'}
          rowActions={[
            { label: 'Ubah', icon: 'edit', onSelect: (item) => { setItemEditor({ item }); setItemType(item.item_type); setFormError(null) } },
            { label: (item) => item.is_active ? 'Nonaktifkan' : 'Aktifkan', icon: 'power', onSelect: itemStatus.open },
            { label: 'Atur konversi satuan', icon: 'refresh', onSelect: (item) => { void loadConversions(item.id); setConversionOpen(true); setFormError(null) } },
            { label: 'Hapus permanen', icon: 'trash', danger: true, onSelect: itemRemoval.open, disabled: (item) => item.is_active && 'Nonaktifkan produk lebih dulu' },
          ]}
        />
      </TablePanel>

      <div className="split-grid mt-4.5">
        <TablePanel
          title="Satuan"
          description="Unit of measure yang dipakai produk."
          badge={`${units.length} satuan`}
          className="!mt-0"
          action={<Button variant="secondary" icon="plus" onClick={() => { setUnitEditor({ unit: null }); setFormError(null) }}>Tambah</Button>}
        >
          <DataTable
            columns={unitColumns}
            rows={units}
            keyOf={(unit) => unit.id}
            loading={loading}
            empty="Belum ada satuan."
            rowActions={[
              { label: 'Ubah', icon: 'edit', onSelect: (unit) => { setUnitEditor({ unit }); setFormError(null) } },
              { label: (unit) => unit.is_active ? 'Nonaktifkan' : 'Aktifkan', icon: 'power', onSelect: unitStatus.open },
              { label: 'Hapus permanen', icon: 'trash', danger: true, onSelect: unitRemoval.open, disabled: (unit) => unit.is_active && 'Nonaktifkan satuan lebih dulu' },
            ]}
          />
        </TablePanel>

        <TablePanel
          title="Lokasi stok"
          description="Gudang operasional perusahaan."
          badge={`${warehouses.length} gudang`}
          className="!mt-0"
          action={<Button variant="secondary" icon="plus" onClick={() => { setWarehouseEditor({ warehouse: null }); setFormError(null) }}>Tambah</Button>}
        >
          <DataTable
            columns={warehouseColumns}
            rows={warehouses}
            keyOf={(warehouse) => warehouse.id}
            loading={loading}
            empty="Belum ada gudang."
            rowActions={[
              { label: 'Ubah', icon: 'edit', onSelect: (warehouse) => { setWarehouseEditor({ warehouse }); setFormError(null) } },
              { label: (warehouse) => warehouse.is_active ? 'Nonaktifkan' : 'Aktifkan', icon: 'power', onSelect: warehouseStatus.open },
              { label: 'Hapus permanen', icon: 'trash', danger: true, onSelect: warehouseRemoval.open, disabled: (warehouse) => warehouse.is_active && 'Nonaktifkan gudang lebih dulu' },
            ]}
          />
        </TablePanel>
      </div>

      {/* ---- Unit modal ---- */}
      <FormModal
        open={unitEditor !== null}
        formKey={editingUnit?.id ?? 'new-unit'}
        size="sm"
        eyebrow="SATUAN"
        title={editingUnit ? `Ubah satuan ${editingUnit.code}` : 'Satuan baru'}
        description="Satuan dipakai sebagai unit dasar produk dan pada konversi satuan."
        submitLabel={editingUnit ? 'Simpan perubahan' : 'Simpan satuan'}
        busy={saving}
        error={formError}
        onClose={() => setUnitEditor(null)}
        onSubmit={(values) => save(
          () => {
            const input = { code: String(values.get('code')), name: String(values.get('name')), precision: Number(values.get('precision')) }
            return editingUnit ? updateUnit(editingUnit.id, input) : createUnit(input)
          },
          editingUnit ? 'Satuan berhasil diperbarui.' : 'Satuan berhasil dibuat.',
          () => setUnitEditor(null),
        )}
      >
        <div className="form-row">
          <label>Kode<input name="code" placeholder="PCS" defaultValue={editingUnit?.code} required /></label>
          <label>Nama<input name="name" placeholder="Pieces" defaultValue={editingUnit?.name} required /></label>
        </div>
        <label>Presisi
          <select name="precision" defaultValue={String(editingUnit?.precision ?? 0)}>
            <option value="0">0 desimal</option><option value="2">2 desimal</option><option value="6">6 desimal</option>
          </select>
        </label>
      </FormModal>

      {/* ---- Warehouse modal ---- */}
      <FormModal
        open={warehouseEditor !== null}
        formKey={editingWarehouse?.id ?? 'new-warehouse'}
        size="sm"
        eyebrow="GUDANG"
        title={editingWarehouse ? `Ubah gudang ${editingWarehouse.code}` : 'Gudang baru'}
        description="Gudang menjadi lokasi saldo stok, transfer, dan opname."
        submitLabel={editingWarehouse ? 'Simpan perubahan' : 'Simpan gudang'}
        busy={saving}
        error={formError}
        onClose={() => setWarehouseEditor(null)}
        onSubmit={(values) => save(
          () => {
            const input = { code: String(values.get('code')), name: String(values.get('name')), address: String(values.get('address') || '') }
            return editingWarehouse ? updateWarehouse(editingWarehouse.id, input) : createWarehouse(input)
          },
          editingWarehouse ? 'Gudang berhasil diperbarui.' : 'Gudang berhasil dibuat.',
          () => setWarehouseEditor(null),
        )}
      >
        <div className="form-row">
          <label>Kode<input name="code" placeholder="UTAMA" defaultValue={editingWarehouse?.code} required /></label>
          <label>Nama<input name="name" placeholder="Gudang Utama" defaultValue={editingWarehouse?.name} required /></label>
        </div>
        <label>Alamat<input name="address" placeholder="Opsional" defaultValue={editingWarehouse?.address ?? ''} /></label>
      </FormModal>

      {/* ---- Item modal ---- */}
      <FormModal
        open={itemEditor !== null}
        formKey={editingItem?.id ?? 'new-item'}
        eyebrow="PRODUK"
        title={editingItem ? `Ubah produk ${editingItem.sku}` : 'Produk baru'}
        description="Produk persediaan wajib memiliki akun persediaan dan akun HPP; jasa tidak memerlukan gudang."
        submitLabel={editingItem ? 'Simpan perubahan' : 'Simpan produk'}
        busy={saving}
        error={formError}
        onClose={() => setItemEditor(null)}
        onSubmit={(values) => save(
          () => {
            const inventory = itemType === 'INVENTORY'
            const input = {
              sku: String(values.get('sku')),
              name: String(values.get('name')),
              item_type: itemType,
              base_unit_id: String(values.get('base_unit_id')),
              costing_method: String(values.get('costing_method')),
              inventory_account_id: inventory ? String(values.get('inventory_account_id')) || null : null,
              cogs_account_id: inventory ? String(values.get('cogs_account_id')) || null : null,
              track_lots: values.get('track_lots') === 'on',
              track_serials: false,
            }
            return editingItem ? updateItem(editingItem.id, input) : createItem(input)
          },
          editingItem ? 'Produk berhasil diperbarui.' : 'Produk berhasil dibuat.',
          () => setItemEditor(null),
        )}
      >
        <div className="form-row">
          <label>SKU<input name="sku" defaultValue={editingItem?.sku} required /></label>
          <label>Tipe
            <select value={itemType} onChange={(event) => setItemType(event.target.value as Item['item_type'])}>
              {(Object.keys(itemTypeLabels) as Array<Item['item_type']>).map((value) => <option key={value} value={value}>{itemTypeLabels[value]}</option>)}
            </select>
          </label>
        </div>
        <label>Nama<input name="name" defaultValue={editingItem?.name} required /></label>
        <div className="form-row">
          <label>Satuan dasar
            <select name="base_unit_id" defaultValue={editingItem?.base_unit_id ?? ''} required>
              <option value="">Pilih satuan</option>
              {activeUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
            </select>
          </label>
          <label>Metode biaya
            <select name="costing_method" defaultValue={editingItem?.costing_method ?? 'MOVING_AVERAGE'}>
              <option value="MOVING_AVERAGE">Rata-rata bergerak</option><option value="FIFO">FIFO</option>
            </select>
          </label>
        </div>
        {itemType === 'INVENTORY' && (
          <div className="form-row">
            <label>Akun persediaan
              <select name="inventory_account_id" defaultValue={editingItem?.inventory_account_id ?? ''} required>
                <option value="">Pilih akun</option>
                {inventoryAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
              </select>
            </label>
            <label>Akun HPP
              <select name="cogs_account_id" defaultValue={editingItem?.cogs_account_id ?? ''} required>
                <option value="">Pilih akun</option>
                {cogsAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
              </select>
            </label>
          </div>
        )}
        <label className="check-row text-[11px]"><input type="checkbox" name="track_lots" defaultChecked={editingItem?.track_lots} />Lacak nomor batch</label>
      </FormModal>

      {/* ---- Unit conversion modal ---- */}
      <FormModal
        open={conversionOpen}
        formKey={conversionItem}
        size="md"
        eyebrow="KONVERSI SATUAN"
        title={`Konversi satuan ${items.find((item) => item.id === conversionItem)?.sku ?? ''}`}
        description="Satu satuan alternatif dinyatakan sebagai pecahan satuan dasar, misalnya 1 lusin = 12/1 pcs."
        submitLabel="Simpan konversi"
        busy={saving}
        error={formError}
        onClose={() => { setConversionOpen(false); setConversionItem(''); setConversions([]) }}
        onSubmit={(values) => save(
          () => saveUnitConversion(conversionItem, {
            unit_id: String(values.get('unit_id')),
            numerator: Number(values.get('numerator')),
            denominator: Number(values.get('denominator')),
          }).then(() => loadConversions(conversionItem)),
          'Konversi satuan disimpan.',
          () => undefined,
        )}
      >
        <div className="form-row">
          <label>Satuan
            <select name="unit_id" required>
              {activeUnits.filter((unit) => unit.id !== items.find((item) => item.id === conversionItem)?.base_unit_id).map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>
              ))}
            </select>
          </label>
          <label>Pembilang<input name="numerator" type="number" min={1} defaultValue={12} required /></label>
          <label>Penyebut<input name="denominator" type="number" min={1} defaultValue={1} required /></label>
        </div>
        {conversions.length === 0
          ? <EmptyState icon="refresh">Belum ada konversi untuk produk ini.</EmptyState>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Satuan</th><th className="number">Isi dalam satuan dasar</th></tr></thead>
                <tbody>{conversions.map((conversion) => (
                  <tr key={conversion.unit_id}><td>{unitLabel(conversion.unit_id)}</td><td className="number mono">{conversion.numerator} / {conversion.denominator}</td></tr>
                ))}</tbody>
              </table>
            </div>}
      </FormModal>

      {/* ---- Confirm dialogs ---- */}
      <ConfirmDialog
        open={unitStatus.target !== null}
        title={unitStatus.target?.is_active ? 'Nonaktifkan satuan?' : 'Aktifkan satuan?'}
        confirmLabel={unitStatus.target?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        busy={unitStatus.busy}
        error={unitStatus.error}
        onClose={unitStatus.close}
        onConfirm={() => unitStatus.run((unit) => setUnitActive(unit.id, !unit.is_active).then(refresh))}
        description={unitStatus.target?.is_active
          ? <>Satuan <strong>{unitStatus.target.code}</strong> tidak akan muncul lagi saat memilih satuan dasar produk. Penonaktifan ditolak jika masih dipakai produk aktif.</>
          : <>Satuan <strong>{unitStatus.target?.code}</strong> kembali dapat dipilih pada produk baru.</>}
      />
      <ConfirmDialog
        open={unitRemoval.target !== null}
        tone="danger"
        title="Hapus satuan permanen?"
        confirmLabel="Hapus permanen"
        confirmationWord={unitRemoval.target?.code}
        busy={unitRemoval.busy}
        error={unitRemoval.error}
        onClose={unitRemoval.close}
        onConfirm={() => unitRemoval.run((unit) => deleteUnit(unit.id).then(refresh))}
        description={<>Satuan <strong>{unitRemoval.target?.code} · {unitRemoval.target?.name}</strong> akan dihapus permanen. Penghapusan ditolak jika satuan masih dipakai produk, konversi satuan, atau baris dokumen.</>}
      />

      <ConfirmDialog
        open={warehouseStatus.target !== null}
        title={warehouseStatus.target?.is_active ? 'Nonaktifkan gudang?' : 'Aktifkan gudang?'}
        confirmLabel={warehouseStatus.target?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        busy={warehouseStatus.busy}
        error={warehouseStatus.error}
        onClose={warehouseStatus.close}
        onConfirm={() => warehouseStatus.run((warehouse) => setWarehouseActive(warehouse.id, !warehouse.is_active).then(refresh))}
        description={warehouseStatus.target?.is_active
          ? <>Gudang <strong>{warehouseStatus.target.code}</strong> tidak akan tersedia untuk dokumen dan pergerakan stok baru. Saldo stok yang sudah ada tetap tersimpan.</>
          : <>Gudang <strong>{warehouseStatus.target?.code}</strong> kembali dapat dipilih pada dokumen baru.</>}
      />
      <ConfirmDialog
        open={warehouseRemoval.target !== null}
        tone="danger"
        title="Hapus gudang permanen?"
        confirmLabel="Hapus permanen"
        confirmationWord={warehouseRemoval.target?.code}
        busy={warehouseRemoval.busy}
        error={warehouseRemoval.error}
        onClose={warehouseRemoval.close}
        onConfirm={() => warehouseRemoval.run((warehouse) => deleteWarehouse(warehouse.id).then(refresh))}
        description={<>Gudang <strong>{warehouseRemoval.target?.code} · {warehouseRemoval.target?.name}</strong> akan dihapus permanen. Penghapusan ditolak jika gudang masih memiliki saldo, pergerakan stok, atau dokumen.</>}
      />

      <ConfirmDialog
        open={itemStatus.target !== null}
        title={itemStatus.target?.is_active ? 'Nonaktifkan produk?' : 'Aktifkan produk?'}
        confirmLabel={itemStatus.target?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        busy={itemStatus.busy}
        error={itemStatus.error}
        onClose={itemStatus.close}
        onConfirm={() => itemStatus.run((item) => setItemActive(item.id, !item.is_active).then(refresh))}
        description={itemStatus.target?.is_active
          ? <>Produk <strong>{itemStatus.target.sku} · {itemStatus.target.name}</strong> tidak akan muncul pada dokumen baru. Riwayat transaksi dan saldo stok tetap utuh.</>
          : <>Produk <strong>{itemStatus.target?.sku} · {itemStatus.target?.name}</strong> kembali dapat dipilih pada dokumen baru.</>}
      />
      <ConfirmDialog
        open={itemRemoval.target !== null}
        tone="danger"
        title="Hapus produk permanen?"
        confirmLabel="Hapus permanen"
        confirmationWord={itemRemoval.target?.sku}
        confirmationHint={<>Ketik SKU <strong>{itemRemoval.target?.sku}</strong> untuk konfirmasi</>}
        busy={itemRemoval.busy}
        error={itemRemoval.error}
        onClose={itemRemoval.close}
        onConfirm={() => itemRemoval.run((item) => deleteItem(item.id).then(refresh))}
        description={<>Produk <strong>{itemRemoval.target?.sku} · {itemRemoval.target?.name}</strong> akan dihapus permanen. Penghapusan ditolak jika produk pernah dipakai dokumen, saldo stok, pergerakan stok, atau reservasi.</>}
      />
    </section>
  )
}
