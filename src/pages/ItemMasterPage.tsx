import { useEffect, useState } from 'react'
import {
  createItemBrand, createItemCategory, deleteItemBrand, deleteItemCategory, listItemBrands, listItemCategories,
  setItemBrandActive, setItemCategoryActive, updateItemBrand, updateItemCategory,
} from '../api/operations'
import { PageHeader } from '../components/ui'
import { StatusPill } from '../components/DataTable'
import { ListView, type ListColumn } from '../components/ListView'
import { ConfirmDialog, FormModal, messageOf, useConfirm } from '../components/Modal'
import type { Account } from '../types/accounting'
import type { ItemBrand, ItemCategory } from '../types/operations'

type Kind = 'category' | 'brand'
type Row = ItemCategory | ItemBrand

const isCategory = (row: Row): row is ItemCategory => 'is_default' in row

/**
 * Master Kategori Barang dan Merek Barang (§ Persediaan pada Accurate). Kedua
 * master memakai pola LIST yang sama, hanya berbeda kolom dan form.
 */
export function ItemMasterPage({ kind, accounts, onNotice }: { kind: Kind; accounts: Account[]; onNotice: (value: string) => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<{ row: Row | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const status = useConfirm<Row>()
  const removal = useConfirm<Row>()

  const label = kind === 'category' ? 'Kategori Barang' : 'Merek Barang'

  async function refresh() {
    setRows(kind === 'category' ? await listItemCategories() : await listItemBrands())
    setLoading(false)
  }
  useEffect(() => { void refresh().catch(() => setLoading(false)) }, [kind])

  const visible = rows.filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  const editing = editor?.row ?? null
  const categoryName = (id: string | null) => rows.find((row) => row.id === id)?.name ?? '—'
  const accountName = (id: string | null) => { const account = accounts.find((item) => item.id === id); return account ? `${account.code} · ${account.name}` : '—' }

  async function submit(values: FormData) {
    setSaving(true)
    setFormError(null)
    try {
      if (kind === 'brand') {
        const input = { name: String(values.get('name')) }
        await (editing ? updateItemBrand(editing.id, input) : createItemBrand(input))
      } else {
        const input = {
          name: String(values.get('name')),
          parent_id: String(values.get('parent_id') || '') || null,
          is_default: values.get('is_default') === 'on',
          inventory_account_id: String(values.get('inventory_account_id') || '') || null,
          sales_account_id: String(values.get('sales_account_id') || '') || null,
          cogs_account_id: String(values.get('cogs_account_id') || '') || null,
        }
        await (editing ? updateItemCategory(editing.id, input) : createItemCategory(input))
      }
      await refresh()
      setEditor(null)
      onNotice(editing ? `${label} berhasil diperbarui.` : `${label} berhasil dibuat.`)
    } catch (error) {
      setFormError(messageOf(error, `${label} gagal disimpan.`))
    } finally {
      setSaving(false)
    }
  }

  const columns: Array<ListColumn<Row>> = kind === 'category'
    ? [
      { key: 'name', header: 'Nama', sortValue: (row) => row.name, cell: (row) => <strong>{row.name}</strong> },
      { key: 'parent', header: 'Sub Kategori dari', cell: (row) => isCategory(row) ? categoryName(row.parent_id) : '—' },
      { key: 'default', header: 'Kategori Default', cell: (row) => isCategory(row) && row.is_default ? 'Ya' : '—' },
      { key: 'inventory', header: 'Akun Persediaan', optional: true, cell: (row) => isCategory(row) ? accountName(row.inventory_account_id) : '—' },
      { key: 'sales', header: 'Akun Penjualan', optional: true, cell: (row) => isCategory(row) ? accountName(row.sales_account_id) : '—' },
      { key: 'status', header: 'Status', width: '110px', cell: (row) => <StatusPill active={row.is_active} /> },
    ]
    : [
      { key: 'name', header: 'Nama', sortValue: (row) => row.name, cell: (row) => <strong>{row.name}</strong> },
      { key: 'status', header: 'Status', width: '110px', cell: (row) => <StatusPill active={row.is_active} /> },
    ]

  return (
    <section>
      <PageHeader
        eyebrow="PERSEDIAAN"
        title={label}
        description={kind === 'category'
          ? 'Pengelompokan barang beserta akun default yang diwarisi barang di dalamnya.'
          : 'Merek barang untuk pengelompokan dan filter daftar barang.'}
      />
      <ListView
        storageKey={`item-${kind}`}
        columns={columns}
        rows={visible}
        keyOf={(row) => row.id}
        loading={loading}
        search={search}
        onSearch={setSearch}
        searchPlaceholder={`Cari ${label.toLowerCase()}`}
        onCreate={() => { setEditor({ row: null }); setFormError(null) }}
        createLabel="Data Baru"
        onRefresh={() => void refresh()}
        onPrint={() => window.print()}
        empty={`Belum ada ${label.toLowerCase()}.`}
        rowActions={[
          { label: 'Ubah', icon: 'edit', onSelect: (row) => { setEditor({ row }); setFormError(null) } },
          { label: (row) => row.is_active ? 'Nonaktifkan' : 'Aktifkan', icon: 'power', onSelect: status.open },
          { label: 'Hapus permanen', icon: 'trash', danger: true, onSelect: removal.open, disabled: (row) => row.is_active && 'Nonaktifkan lebih dulu' },
        ]}
        onRowOpen={(row) => { setEditor({ row }); setFormError(null) }}
      />

      <FormModal
        open={editor !== null}
        formKey={editing?.id ?? 'new'}
        eyebrow={label.toUpperCase()}
        title={editing ? `Ubah ${label.toLowerCase()} ${editing.name}` : `${label} baru`}
        description={kind === 'category'
          ? 'Akun pada kategori dipakai sebagai default barang baru di kategori ini.'
          : 'Merek hanya menyimpan nama, sama seperti Accurate.'}
        submitLabel={editing ? 'Simpan perubahan' : 'Simpan'}
        busy={saving}
        error={formError}
        onClose={() => setEditor(null)}
        onSubmit={submit}
      >
        <label>Nama<input name="name" defaultValue={editing?.name} required autoFocus /></label>
        {kind === 'category' && <>
          <label className="check-row text-[11px]">
            <input type="checkbox" name="is_default" defaultChecked={editing && isCategory(editing) ? editing.is_default : false} />
            Jadikan kategori default
          </label>
          <label>Sub kategori dari
            <select name="parent_id" defaultValue={editing && isCategory(editing) ? editing.parent_id ?? '' : ''}>
              <option value="">Tanpa induk</option>
              {rows.filter((row) => row.id !== editing?.id).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
          <fieldset>
            <legend>Akun default</legend>
            <label>Akun persediaan
              <select name="inventory_account_id" defaultValue={editing && isCategory(editing) ? editing.inventory_account_id ?? '' : ''}>
                <option value="">Tidak diatur</option>
                {accounts.filter((account) => account.type === 'ASSET').map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
              </select>
            </label>
            <label>Akun penjualan
              <select name="sales_account_id" defaultValue={editing && isCategory(editing) ? editing.sales_account_id ?? '' : ''}>
                <option value="">Tidak diatur</option>
                {accounts.filter((account) => account.type === 'REVENUE').map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
              </select>
            </label>
            <label>Akun HPP
              <select name="cogs_account_id" defaultValue={editing && isCategory(editing) ? editing.cogs_account_id ?? '' : ''}>
                <option value="">Tidak diatur</option>
                {accounts.filter((account) => ['COGS', 'EXPENSE', 'OTHER_EXPENSE'].includes(account.type)).map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
              </select>
            </label>
          </fieldset>
        </>}
      </FormModal>

      <ConfirmDialog
        open={status.target !== null}
        title={status.target?.is_active ? `Nonaktifkan ${label.toLowerCase()}?` : `Aktifkan ${label.toLowerCase()}?`}
        confirmLabel={status.target?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        busy={status.busy}
        error={status.error}
        onClose={status.close}
        onConfirm={() => status.run(async (row) => {
          await (kind === 'category' ? setItemCategoryActive(row.id, !row.is_active) : setItemBrandActive(row.id, !row.is_active))
          await refresh()
        })}
        description={<><strong>{status.target?.name}</strong> {status.target?.is_active ? 'tidak akan muncul pada pilihan barang baru, tetapi data lama tetap utuh.' : 'akan kembali dapat dipilih.'}</>}
      />

      <ConfirmDialog
        open={removal.target !== null}
        tone="danger"
        title={`Hapus ${label.toLowerCase()} permanen?`}
        confirmLabel="Hapus permanen"
        busy={removal.busy}
        error={removal.error}
        onClose={removal.close}
        onConfirm={() => removal.run(async (row) => {
          await (kind === 'category' ? deleteItemCategory(row.id) : deleteItemBrand(row.id))
          await refresh()
        })}
        description={<><strong>{removal.target?.name}</strong> akan dihapus. Penghapusan ditolak jika masih dipakai barang atau menjadi induk kategori lain.</>}
      />
    </section>
  )
}
