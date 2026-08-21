import { useMemo, useState } from 'react'
import type { Account, AccountType } from '../types/accounting'
import { Badge, DataEntryGuide, PageHeader } from '../components/ui'
import { AddButton, DataTable, SearchInput, StatusPill, TablePanel, type Column } from '../components/DataTable'
import { ConfirmDialog, FormModal, messageOf, useConfirm } from '../components/Modal'

const accountTypes: Array<{ value: AccountType; label: string }> = [
  { value: 'ASSET', label: 'Aset' },
  { value: 'LIABILITY', label: 'Liabilitas / Utang' },
  { value: 'EQUITY', label: 'Ekuitas / Modal' },
  { value: 'REVENUE', label: 'Pendapatan' },
  { value: 'COGS', label: 'Harga Pokok Penjualan' },
  { value: 'EXPENSE', label: 'Beban' },
  { value: 'OTHER_INCOME', label: 'Pendapatan lain-lain' },
  { value: 'OTHER_EXPENSE', label: 'Beban lain-lain' },
]

type AccountInput = { code: string; name: string; type: AccountType; normal_balance?: Account['normal_balance']; parent_id: string | null }

export function AccountsPage({ accounts, onCreate, onUpdate, onStatusChange, onDelete }: {
  accounts: Account[]
  onCreate: (input: AccountInput) => Promise<void>
  onUpdate: (id: string, input: AccountInput) => Promise<void>
  onStatusChange: (id: string, active: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editor, setEditor] = useState<{ account: Account | null } | null>(null)
  const [type, setType] = useState<AccountType>('ASSET')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(true)
  const status = useConfirm<Account>()
  const removal = useConfirm<Account>()

  const editing = editor?.account ?? null

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return accounts.filter((account) => {
      if (!showInactive && !account.is_active) return false
      if (!needle) return true
      return `${account.code} ${account.name} ${account.type}`.toLowerCase().includes(needle)
    })
  }, [accounts, search, showInactive])

  function openCreate() {
    setEditor({ account: null })
    setType('ASSET')
    setFormError(null)
  }

  function openEdit(account: Account) {
    setEditor({ account })
    setType(account.type)
    setFormError(null)
  }

  async function submit(values: FormData) {
    const input: AccountInput = {
      code: String(values.get('code')),
      name: String(values.get('name')),
      type,
      parent_id: editing?.is_system ? editing.parent_id : String(values.get('parent_id') || '') || null,
    }
    if (editing && editing.type === type) input.normal_balance = editing.normal_balance
    setSaving(true)
    setFormError(null)
    try {
      if (editing) await onUpdate(editing.id, input)
      else await onCreate(input)
      setEditor(null)
    } catch (error) {
      setFormError(messageOf(error, 'Akun gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const columns: Array<Column<Account>> = [
    { header: 'Kode', className: 'mono', width: '110px', cell: (account) => account.code },
    {
      header: 'Nama akun',
      cell: (account) => <><strong>{account.name}</strong>{account.system_key && <small className="block">{account.system_key}</small>}</>,
    },
    { header: 'Tipe', cell: (account) => <span className="type-tag">{account.type.replaceAll('_', ' ')}</span> },
    { header: 'Saldo normal', cell: (account) => account.normal_balance },
    { header: 'Status', cell: (account) => <StatusPill active={account.is_active} /> },
  ]

  return (
    <section>
      <PageHeader
        eyebrow="CHART OF ACCOUNTS"
        title="Daftar akun"
        description="Struktur akun organisasi untuk pencatatan dan laporan keuangan."
        action={<div className="page-actions"><Badge>{accounts.length} akun</Badge><AddButton onClick={openCreate}>Akun baru</AddButton></div>}
      />
      <DataEntryGuide
        steps={[
          'Klik “Akun baru” untuk membuka form penambahan akun.',
          'Gunakan menu aksi (titik tiga) pada baris tabel untuk Ubah, Nonaktifkan, Aktifkan, atau Hapus permanen.',
          'Nonaktifkan adalah pengganti hapus: akun tetap ada dalam histori tetapi tidak tersedia untuk transaksi baru.',
          'Hapus permanen hanya tersedia untuk akun nonaktif dan akan ditolak jika akun masih dipakai data lain.',
        ]}
        note="Akun sistem hanya dapat diubah namanya dan tidak dapat dinonaktifkan maupun dihapus."
      />

      <TablePanel
        title="Chart of accounts"
        description="Semua akun beserta saldo normal dan statusnya."
        badge={`${visible.length} dari ${accounts.length}`}
        badgeTone="info"
        className="!mt-0"
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Cari kode, nama, atau tipe akun…" />
            <label className="check-row shrink-0 text-[10px]">
              <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
              Tampilkan akun nonaktif
            </label>
          </>
        }
      >
        <DataTable
          columns={columns}
          rows={visible}
          keyOf={(account) => account.id}
          empty={accounts.length === 0 ? 'Belum ada akun dalam chart of accounts.' : 'Tidak ada akun yang cocok dengan pencarian.'}
          rowActions={[
            { label: 'Ubah', icon: 'edit', onSelect: openEdit },
            {
              label: (account) => account.is_active ? 'Nonaktifkan' : 'Aktifkan',
              icon: 'power',
              onSelect: status.open,
              disabled: (account) => account.is_system && 'Akun sistem tidak dapat dinonaktifkan',
            },
            {
              label: 'Hapus permanen',
              icon: 'trash',
              danger: true,
              onSelect: removal.open,
              when: (account) => !account.is_system,
              disabled: (account) => account.is_active && 'Nonaktifkan akun lebih dulu',
            },
          ]}
        />
      </TablePanel>

      <FormModal
        open={editor !== null}
        formKey={editing?.id ?? 'new'}
        eyebrow={editing ? 'UBAH AKUN' : 'AKUN BARU'}
        title={editing ? `Ubah akun ${editing.code}` : 'Tambah akun baru'}
        description={editing?.is_system
          ? 'Akun sistem dipakai otomatis oleh modul lain, jadi hanya namanya yang dapat diubah.'
          : 'Saldo normal ditentukan otomatis dari tipe akun yang dipilih.'}
        submitLabel={editing ? 'Simpan perubahan' : 'Tambah akun'}
        busy={saving}
        error={formError}
        onClose={() => setEditor(null)}
        onSubmit={submit}
      >
        <div className="form-row">
          <label>Kode akun<input name="code" inputMode="numeric" placeholder="Contoh: 1020" defaultValue={editing?.code} readOnly={editing?.is_system} required /></label>
          <label>Nama akun<input name="name" placeholder="Contoh: Bank BCA" defaultValue={editing?.name} required /></label>
        </div>
        <div className="form-row">
          <label>Tipe akun
            <select value={type} disabled={editing?.is_system} onChange={(event) => setType(event.target.value as AccountType)}>
              {accountTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>Akun induk (opsional)
            <select name="parent_id" defaultValue={editing?.parent_id ?? ''} disabled={editing?.is_system}>
              <option value="">Tanpa akun induk</option>
              {accounts.filter((account) => account.id !== editing?.id && account.type === type && account.is_active).map((account) => (
                <option key={account.id} value={account.id}>{account.code} · {account.name}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="modal-note">Akun induk harus bertipe sama dengan akun yang dibuat. Ubah tipe akun untuk melihat pilihan induk yang sesuai.</p>
      </FormModal>

      <ConfirmDialog
        open={status.target !== null}
        title={status.target?.is_active ? 'Nonaktifkan akun?' : 'Aktifkan kembali akun?'}
        confirmLabel={status.target?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        busy={status.busy}
        error={status.error}
        onClose={status.close}
        onConfirm={() => status.run((account) => onStatusChange(account.id, !account.is_active))}
        description={status.target?.is_active
          ? <>Akun <strong>{status.target.code} · {status.target.name}</strong> tidak akan tersedia untuk transaksi baru, tetapi tetap tersimpan dalam jurnal dan laporan historis.</>
          : <>Akun <strong>{status.target?.code} · {status.target?.name}</strong> akan kembali dapat dipilih pada transaksi baru.</>}
      />

      <ConfirmDialog
        open={removal.target !== null}
        tone="danger"
        title="Hapus akun permanen?"
        confirmLabel="Hapus permanen"
        confirmationWord={removal.target?.code}
        confirmationHint={<>Ketik kode akun <strong>{removal.target?.code}</strong> untuk konfirmasi</>}
        busy={removal.busy}
        error={removal.error}
        onClose={removal.close}
        onConfirm={() => removal.run((account) => onDelete(account.id))}
        description={<>
          <strong>{removal.target?.code} · {removal.target?.name}</strong> akan hilang dari chart of accounts dan tindakan ini tidak dapat dibatalkan.
          Penghapusan ditolak jika akun masih menjadi induk atau pernah dipakai jurnal, mapping, bank, produk, aset, anggaran, maupun data operasional lain.
        </>}
      />
    </section>
  )
}
