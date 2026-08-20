import { type FormEvent, useEffect, useState } from 'react'
import { createItem, createUnit, createWarehouse, listItems, listUnitConversions, listUnits, listWarehouses, saveUnitConversion } from '../api/operations'
import { Badge, Button, EmptyState, PageHeader } from '../components/ui'
import type { Account } from '../types/accounting'
import type { Item, Unit, UnitConversion, Warehouse } from '../types/operations'

export function ProductsPage({ accounts, onNotice }: { accounts: Account[]; onNotice: (value: string) => void }) {
  const [units, setUnits] = useState<Unit[]>([]); const [items, setItems] = useState<Item[]>([]); const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [conversionItem, setConversionItem] = useState(''); const [conversions, setConversions] = useState<UnitConversion[]>([])
  async function refresh() { const [u, i, w] = await Promise.all([listUnits(), listItems(), listWarehouses()]); setUnits(u); setItems(i); setWarehouses(w) }
  useEffect(() => { void refresh() }, [])
  async function unit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); await createUnit({ code: String(f.get('code')), name: String(f.get('name')), precision: Number(f.get('precision')) }); e.currentTarget.reset(); await refresh(); onNotice('Satuan berhasil dibuat.') }
  async function warehouse(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); await createWarehouse({ code: String(f.get('code')), name: String(f.get('name')), address: String(f.get('address')) }); e.currentTarget.reset(); await refresh(); onNotice('Gudang berhasil dibuat.') }
  async function item(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); const kind = String(f.get('item_type')); const inventory = kind === 'INVENTORY'; await createItem({ sku: String(f.get('sku')), name: String(f.get('name')), item_type: kind, base_unit_id: String(f.get('base_unit_id')), costing_method: String(f.get('costing_method')), inventory_account_id: inventory ? String(f.get('inventory_account_id')) : null, cogs_account_id: inventory ? String(f.get('cogs_account_id')) : null, track_lots: f.get('track_lots') === 'on', track_serials: false }); e.currentTarget.reset(); await refresh(); onNotice('Barang atau jasa berhasil dibuat.') }
  async function loadConversions(itemId: string) { setConversionItem(itemId); setConversions(itemId ? await listUnitConversions(itemId) : []) }
  async function conversion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    try {
      await saveUnitConversion(conversionItem, { unit_id: String(f.get('unit_id')), numerator: Number(f.get('numerator')), denominator: Number(f.get('denominator')) })
      await loadConversions(conversionItem); onNotice('Konversi satuan disimpan.')
    } catch (error) {
      const response = (error as { response?: { data?: { error?: { details?: string } } } }).response
      onNotice(response?.data?.error?.details ?? 'Konversi satuan gagal disimpan.')
    }
  }
  const inventoryAccounts = accounts.filter((a) => a.type === 'ASSET'); const cogsAccounts = accounts.filter((a) => a.type === 'EXPENSE' || a.type === 'OTHER_EXPENSE')
  return <section><PageHeader eyebrow="MASTER DATA" title="Produk dan gudang" description="Satuan, barang, jasa, serta lokasi stok terkelola sebagai master data mandiri." />
    <div className="three-grid">
      <form className="panel form-panel" onSubmit={(e) => void unit(e)}><h2>Satuan baru</h2><label>Kode<input name="code" placeholder="PCS" required /></label><label>Nama<input name="name" placeholder="Pieces" required /></label><label>Presisi<select name="precision" defaultValue="0"><option value="0">0 desimal</option><option value="2">2 desimal</option><option value="6">6 desimal</option></select></label><Button>Simpan satuan</Button></form>
      <form className="panel form-panel" onSubmit={(e) => void warehouse(e)}><h2>Gudang baru</h2><label>Kode<input name="code" placeholder="UTAMA" required /></label><label>Nama<input name="name" placeholder="Gudang Utama" required /></label><label>Alamat<input name="address" placeholder="Opsional" /></label><Button>Simpan gudang</Button></form>
      <form className="panel form-panel" onSubmit={(e) => void item(e)}><h2>Barang atau jasa</h2><div className="form-row"><label>SKU<input name="sku" required /></label><label>Tipe<select name="item_type"><option value="INVENTORY">Barang persediaan</option><option value="NON_INVENTORY">Non-persediaan</option><option value="SERVICE">Jasa</option></select></label></div><label>Nama<input name="name" required /></label><div className="form-row"><label>Satuan dasar<select name="base_unit_id" required><option value="">Pilih satuan</option>{units.map((u) => <option key={u.id} value={u.id}>{u.code} · {u.name}</option>)}</select></label><label>Metode biaya<select name="costing_method"><option value="MOVING_AVERAGE">Rata-rata bergerak</option><option value="FIFO">FIFO</option></select></label></div><label className="flex items-center gap-2 text-[11px]"><input type="checkbox" name="track_lots" className="size-4" />Lacak nomor batch</label><div className="form-row"><label>Akun persediaan<select name="inventory_account_id"><option value="">Pilih akun</option>{inventoryAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label><label>Akun HPP<select name="cogs_account_id"><option value="">Pilih akun</option>{cogsAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label></div><Button disabled={units.length === 0}>Simpan produk</Button></form>
    </div>
    <div className="split-grid records-grid mt-4.5"><div className="panel"><div className="panel-heading"><div><h2>Katalog</h2><p>Barang dan jasa aktif.</p></div><Badge tone="info">{items.length} produk</Badge></div>{items.length === 0 ? <EmptyState>Belum ada produk.</EmptyState> : <div className="table-wrap"><table><thead><tr><th>SKU</th><th>Nama</th><th>Tipe</th><th>Biaya</th></tr></thead><tbody>{items.map((i) => <tr key={i.id}><td className="mono">{i.sku}</td><td><strong>{i.name}</strong></td><td><span className="type-tag">{i.item_type}</span></td><td><span className="type-tag">{i.costing_method === 'FIFO' ? 'FIFO' : 'AVG'}</span></td></tr>)}</tbody></table></div>}</div>
      <div className="panel"><div className="panel-heading"><div><h2>Lokasi stok</h2><p>Gudang operasional perusahaan.</p></div><Badge>{warehouses.length} gudang</Badge></div>{warehouses.length === 0 ? <EmptyState>Belum ada gudang.</EmptyState> : <div className="table-wrap"><table><thead><tr><th>Kode</th><th>Gudang</th><th>Status</th></tr></thead><tbody>{warehouses.map((w) => <tr key={w.id}><td className="mono">{w.code}</td><td><strong>{w.name}</strong><small className="block">{w.address ?? 'Alamat belum diisi'}</small></td><td><span className="status active">Aktif</span></td></tr>)}</tbody></table></div>}</div></div>
    <div className="panel data-panel">
      <div className="panel-heading"><div><h2>Konversi satuan</h2><p>Satu satuan alternatif dinyatakan sebagai pecahan satuan dasar, misalnya 1 lusin = 12/1 pcs.</p></div><Badge>{conversions.length} konversi</Badge></div>
      <div className="form-panel">
        <label>Produk<select value={conversionItem} onChange={(e) => void loadConversions(e.target.value)}><option value="">Pilih produk</option>{items.map((i) => <option key={i.id} value={i.id}>{i.sku} · {i.name}</option>)}</select></label>
        {conversionItem && <form className="form-row" onSubmit={(e) => void conversion(e)}>
          <label>Satuan<select name="unit_id" required>{units.filter((u) => u.id !== items.find((i) => i.id === conversionItem)?.base_unit_id).map((u) => <option key={u.id} value={u.id}>{u.code} · {u.name}</option>)}</select></label>
          <label>Pembilang<input name="numerator" type="number" min={1} defaultValue={12} required /></label>
          <label>Penyebut<input name="denominator" type="number" min={1} defaultValue={1} required /></label>
          <Button className="self-end">Simpan konversi</Button>
        </form>}
        {conversions.length > 0 && <div className="table-wrap mt-3"><table><thead><tr><th>Satuan</th><th className="number">Isi dalam satuan dasar</th></tr></thead><tbody>{conversions.map((c) => {
          const unitLabel = units.find((u) => u.id === c.unit_id)
          return <tr key={c.unit_id}><td>{unitLabel ? `${unitLabel.code} · ${unitLabel.name}` : c.unit_id.slice(0, 8)}</td><td className="number mono">{c.numerator} / {c.denominator}</td></tr>
        })}</tbody></table></div>}
      </div>
    </div>
  </section>
}
