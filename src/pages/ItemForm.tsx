import { useEffect, useState } from 'react'
import { createItem, listItemBrands, listItemCategories, updateItem } from '../api/operations'
import { ActionRail, DocumentShell, LookupField } from '../components/FormShell'
import { messageOf } from '../components/Modal'
import { useTabHandle } from '../store/tabs'
import type { Account } from '../types/accounting'
import type { Item, ItemBrand, ItemCategory, Unit } from '../types/operations'

const itemTypes: Array<{ value: Item['item_type']; label: string }> = [
  { value: 'INVENTORY', label: 'Barang persediaan' },
  { value: 'NON_INVENTORY', label: 'Non-persediaan' },
  { value: 'SERVICE', label: 'Jasa' },
]

const subTabs = [
  { key: 'general', label: 'Umum' },
  { key: 'trade', label: 'Penjualan / Pembelian' },
  { key: 'stock', label: 'Stok' },
  { key: 'accounts', label: 'Akun' },
]

/**
 * Pola FORM MASTER (§4.2): sub-tab horizontal, dua kolom di desktop, field
 * wajib bertanda *, dan tombol simpan pada rail kanan yang selalu terlihat.
 */
export function ItemForm({
  item, units, accounts, onCancel, onSaved,
}: {
  item: Item | null
  units: Unit[]
  accounts: Account[]
  onCancel: () => void
  onSaved: (message: string, again: boolean) => void
}) {
  const [tab, setTab] = useState('general')
  const [sku, setSku] = useState(item?.sku ?? '')
  const [name, setName] = useState(item?.name ?? '')
  const [itemType, setItemType] = useState<Item['item_type']>(item?.item_type ?? 'INVENTORY')
  const [baseUnitId, setBaseUnitId] = useState(item?.base_unit_id ?? '')
  const [costing, setCosting] = useState<Item['costing_method']>(item?.costing_method ?? 'MOVING_AVERAGE')
  const [inventoryAccountId, setInventoryAccountId] = useState(item?.inventory_account_id ?? '')
  const [cogsAccountId, setCogsAccountId] = useState(item?.cogs_account_id ?? '')
  const [trackLots, setTrackLots] = useState(item?.track_lots ?? false)
  const [trackSerials, setTrackSerials] = useState(item?.track_serials ?? false)
  const [categoryId, setCategoryId] = useState(item?.category_id ?? '')
  const [brandId, setBrandId] = useState(item?.brand_id ?? '')
  const [barcode, setBarcode] = useState(item?.barcode ?? '')
  const [minimumStock, setMinimumStock] = useState(item?.minimum_stock ?? '0')
  const [categories, setCategories] = useState<ItemCategory[]>([])
  const [brands, setBrands] = useState<ItemBrand[]>([])
  const [autoSku, setAutoSku] = useState(!item)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useTabHandle(dirty, item ? item.sku : 'Data Baru')

  // Kategori dan merek adalah master tersendiri, sama seperti Accurate.
  useEffect(() => {
    let cancelled = false
    void Promise.all([listItemCategories(), listItemBrands()])
      .then(([categoryRows, brandRows]) => {
        if (cancelled) return
        setCategories(categoryRows.filter((row) => row.is_active))
        setBrands(brandRows.filter((row) => row.is_active))
        // Kategori default terpasang otomatis pada barang baru.
        if (!item) setCategoryId((current) => current || (categoryRows.find((row) => row.is_default)?.id ?? ''))
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [item])

  const inventory = itemType === 'INVENTORY'
  const unitOptions = units.filter((unit) => unit.is_active).map((unit) => ({ value: unit.id, label: `${unit.code} · ${unit.name}` }))
  const assetAccounts = accounts.filter((account) => account.type === 'ASSET').map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` }))
  const costAccounts = accounts.filter((account) => ['COGS', 'EXPENSE', 'OTHER_EXPENSE'].includes(account.type)).map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` }))

  function touch<T>(setter: (value: T) => void) {
    return (value: T) => { setDirty(true); setter(value) }
  }

  async function save(again: boolean) {
    if (!name.trim()) { setError('Nama barang wajib diisi.'); setTab('general'); return }
    if (!baseUnitId) { setError('Satuan dasar wajib dipilih.'); setTab('general'); return }
    if (inventory && (!inventoryAccountId || !cogsAccountId)) { setError('Barang persediaan wajib memiliki akun persediaan dan akun HPP.'); setTab('accounts'); return }
    setSaving(true)
    setError(null)
    try {
      const input = {
        sku: autoSku && !item ? `ITM-${Date.now().toString().slice(-8)}` : sku,
        name,
        item_type: itemType,
        base_unit_id: baseUnitId,
        costing_method: costing,
        inventory_account_id: inventory ? inventoryAccountId || null : null,
        cogs_account_id: inventory ? cogsAccountId || null : null,
        category_id: categoryId || null,
        brand_id: brandId || null,
        barcode,
        minimum_stock: minimumStock || '0',
        track_lots: trackLots,
        track_serials: trackSerials,
      }
      await (item ? updateItem(item.id, input) : createItem(input))
      setDirty(false)
      onSaved(item ? 'Produk berhasil diperbarui.' : 'Produk berhasil dibuat.', again)
      if (again) { setSku(''); setName(''); setAutoSku(true) }
    } catch (cause) {
      setError(messageOf(cause, 'Produk gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DocumentShell
      label={item ? `${item.sku} · ${item.name}` : 'Data Baru'}
      dirty={dirty}
      onBack={onCancel}
      subTabs={subTabs}
      activeSubTab={tab}
      onSubTab={setTab}
      rail={<ActionRail actions={[
        {
          icon: 'check', label: 'Simpan', primary: true, items: [
            { label: 'Simpan', onSelect: () => void save(false), disabled: saving && 'Sedang menyimpan…' },
            { label: 'Simpan & Baru', onSelect: () => void save(true), disabled: (saving && 'Sedang menyimpan…') || (Boolean(item) && 'Hanya untuk produk baru') },
          ],
        },
        { icon: 'close', label: 'Batal', items: [{ label: 'Tutup tanpa menyimpan', onSelect: onCancel }] },
      ]} />}
    >
      {error && <p className="modal-error">{error}</p>}

      {tab === 'general' && (
        <div className="doc-grid">
          <label className="doc-field">Nama Barang <b>*</b><input value={name} onChange={(event) => touch(setName)(event.target.value)} placeholder="Contoh: Ban Bridgestone R16" required /></label>
          <label className="doc-field">Jenis Barang
            <select value={itemType} onChange={(event) => touch(setItemType)(event.target.value as Item['item_type'])}>
              {itemTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="doc-field">Kode Barang <b>*</b>
            <span className="flex items-center gap-1.5">
              <button type="button" className="tool-icon" title={autoSku ? 'Kode otomatis' : 'Kode manual'} onClick={() => touch(setAutoSku)(!autoSku)} disabled={Boolean(item)}>{autoSku ? 'A' : 'M'}</button>
              <input value={autoSku && !item ? 'Dibuat otomatis' : sku} onChange={(event) => touch(setSku)(event.target.value)} disabled={autoSku && !item} placeholder="SKU" />
            </span>
          </label>
          <LookupField label="Satuan" required value={baseUnitId} options={unitOptions} onChange={touch(setBaseUnitId)} placeholder="Cari/Pilih satuan…" />
          <LookupField label="Kategori Barang" value={categoryId} options={categories.map((row) => ({ value: row.id, label: row.name }))} onChange={touch(setCategoryId)} placeholder="Cari/Pilih kategori…" />
          <LookupField label="Merek Barang" value={brandId} options={brands.map((row) => ({ value: row.id, label: row.name }))} onChange={touch(setBrandId)} placeholder="Cari/Pilih merek…" />
          <label className="doc-field">UPC/Barcode<input value={barcode} onChange={(event) => touch(setBarcode)(event.target.value)} placeholder="Opsional" /></label>
        </div>
      )}

      {tab === 'trade' && (
        <div className="doc-grid">
          <p className="modal-note sm:col-span-2">
            Harga jual dan harga pemasok dikelola pada master <strong>Harga Jual</strong> dan <strong>Harga Pemasok</strong>.
            Kedua modul itu belum terhubung ke backend, jadi tab ini masih kosong.
          </p>
        </div>
      )}

      {tab === 'stock' && (
        <div className="doc-grid">
          <label className="doc-field">Batas Minimum Stok<input value={minimumStock} inputMode="decimal" disabled={!inventory} onChange={(event) => touch(setMinimumStock)(event.target.value)} /></label>
          <label className="doc-field">Metode biaya
            <select value={costing} onChange={(event) => touch(setCosting)(event.target.value as Item['costing_method'])} disabled={!inventory}>
              <option value="MOVING_AVERAGE">Rata-rata bergerak</option>
              <option value="FIFO">FIFO</option>
            </select>
          </label>
          <div className="grid gap-2">
            <label className="check-row text-[12px]"><input type="checkbox" checked={trackLots} disabled={!inventory} onChange={(event) => touch(setTrackLots)(event.target.checked)} />Lacak nomor batch / lot</label>
            <label className="check-row text-[12px]"><input type="checkbox" checked={trackSerials} disabled={!inventory} onChange={(event) => touch(setTrackSerials)(event.target.checked)} />Lacak nomor seri</label>
          </div>
          {!inventory && <p className="modal-note sm:col-span-2">Jenis <strong>{itemTypes.find((option) => option.value === itemType)?.label}</strong> tidak menyimpan stok, jadi metode biaya dan pelacakan batch tidak berlaku.</p>}
        </div>
      )}

      {tab === 'accounts' && (
        <div className="doc-grid">
          {inventory ? <>
            <LookupField label="Akun persediaan" required value={inventoryAccountId} options={assetAccounts} onChange={touch(setInventoryAccountId)} placeholder="Cari/Pilih akun aset…" />
            <LookupField label="Akun HPP" required value={cogsAccountId} options={costAccounts} onChange={touch(setCogsAccountId)} placeholder="Cari/Pilih akun beban…" />
          </> : (
            <p className="modal-note sm:col-span-2">Barang non-persediaan dan jasa memakai akun pendapatan serta beban dari mapping akun sistem, jadi tidak perlu akun persediaan sendiri.</p>
          )}
        </div>
      )}
    </DocumentShell>
  )
}
