import { type FormEvent, useState } from 'react'
import type { Account, AccountType } from '../types/accounting'
import { Badge, Button, DataEntryGuide, EmptyState, PageHeader } from '../components/ui'

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

export function AccountsPage({ accounts, onCreate, onUpdate, onStatusChange, onDelete }: { accounts: Account[]; onCreate: (input: AccountInput) => Promise<void>; onUpdate: (id: string, input: AccountInput) => Promise<void>; onStatusChange: (id: string, active: boolean) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [type, setType] = useState<AccountType>('ASSET')
  const [editing, setEditing] = useState<Account | null>(null)
  const [saving, setSaving] = useState(false)
  const [changingStatus, setChangingStatus] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const input: AccountInput = { code: String(values.get('code')), name: String(values.get('name')), type, parent_id: editing?.is_system ? editing.parent_id : String(values.get('parent_id') || '') || null }
    if (editing && editing.type === type) input.normal_balance = editing.normal_balance
    setSaving(true)
    try {
      if (editing) await onUpdate(editing.id, input)
      else await onCreate(input)
      form.reset()
      setEditing(null)
      setType('ASSET')
    } catch {
      return
    } finally {
      setSaving(false)
    }
  }

  function startEditing(account: Account) {
    setEditing(account)
    setType(account.type)
    requestAnimationFrame(() => document.querySelector('#account-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function changeStatus(account: Account) {
    const active = !account.is_active
    if (!active && !window.confirm(`Nonaktifkan akun ${account.code} · ${account.name}? Akun tetap tersimpan dalam histori.`)) return
    setChangingStatus(account.id)
    try { await onStatusChange(account.id, active) }
    catch { return }
    finally { setChangingStatus(null) }
  }

  async function permanentlyDelete() {
    if (!deleting || deleteConfirmation !== deleting.code) return
    setDeleteBusy(true)
    try {
      await onDelete(deleting.id)
      setDeleting(null)
      setDeleteConfirmation('')
    } catch {
      return
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <section>
      <PageHeader eyebrow="CHART OF ACCOUNTS" title="Daftar akun" description="Struktur akun organisasi untuk pencatatan dan laporan keuangan." action={<Badge>{accounts.length} akun</Badge>} />
      <DataEntryGuide steps={['Isi form Akun baru untuk menambah akun.', 'Klik “Ubah” pada tabel untuk memperbarui akun; akun sistem hanya dapat diubah namanya.', 'Klik “Nonaktifkan” sebagai pengganti hapus. Akun tetap ada dalam histori tetapi tidak tersedia untuk transaksi baru.', 'Klik “Aktifkan” jika akun ingin digunakan kembali.']} note="Akun tidak dihapus permanen demi menjaga jurnal dan laporan historis tetap utuh." />
      <form id="account-form" key={editing?.id ?? 'new'} className="panel form-panel wide-form scroll-mt-5" onSubmit={(event) => void submit(event)}>
        <div className="section-title"><div><span className="section-icon">COA</span><h2>{editing ? `Ubah akun ${editing.code}` : 'Akun baru'}</h2></div><Badge tone={editing ? 'warning' : 'info'}>{editing ? 'Mode ubah' : 'Saldo normal otomatis'}</Badge></div>
        <div className="form-row">
          <label>Kode akun<input name="code" inputMode="numeric" placeholder="Contoh: 1020" defaultValue={editing?.code} readOnly={editing?.is_system} required /></label>
          <label>Nama akun<input name="name" placeholder="Contoh: Bank BCA" defaultValue={editing?.name} required /></label>
          <label>Tipe akun<select value={type} disabled={editing?.is_system} onChange={(event) => setType(event.target.value as AccountType)}>{accountTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Akun induk (opsional)<select name="parent_id" defaultValue={editing?.parent_id ?? ''} disabled={editing?.is_system}><option value="">Tanpa akun induk</option>{accounts.filter((account) => account.id !== editing?.id && account.type === type && account.is_active).map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label>
        </div>
        <div className="flex gap-2"><Button disabled={saving}>{saving ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Tambah akun'}</Button>{editing && <Button type="button" variant="ghost" onClick={() => { setEditing(null); setType('ASSET') }}>Batal</Button>}</div>
      </form>
      {deleting && <div className="mb-4.5 rounded-xl border border-red-300 bg-red-50 p-5 shadow-xs">
        <h2 className="mt-0 mb-2 font-display text-base font-extrabold text-red-950">Hapus permanen {deleting.code} · {deleting.name}?</h2>
        <p className="mt-0 mb-3 text-[11px] leading-relaxed text-red-800">Tindakan ini tidak dapat dibatalkan. Akun akan hilang dari Chart of Accounts. Penghapusan akan ditolak jika akun masih menjadi induk atau pernah dipakai jurnal, mapping, bank, produk, aset, anggaran, maupun data operasional lainnya.</p>
        <label className="max-w-md text-red-900">Ketik kode akun <strong>{deleting.code}</strong> untuk konfirmasi<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={deleting.code} /></label>
        <div className="mt-3 flex gap-2"><Button className="border-red-700 bg-red-700 hover:border-red-800 hover:bg-red-800" disabled={deleteBusy || deleteConfirmation !== deleting.code} onClick={() => void permanentlyDelete()}>{deleteBusy ? 'Menghapus…' : 'Hapus permanen'}</Button><Button variant="ghost" onClick={() => { setDeleting(null); setDeleteConfirmation('') }}>Batal</Button></div>
      </div>}
      <div className="table-wrap panel">
        {accounts.length === 0 ? <EmptyState>Belum ada akun dalam chart of accounts.</EmptyState> :
        <table>
          <thead><tr><th>Kode</th><th>Nama akun</th><th>Tipe</th><th>Saldo normal</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td className="mono">{account.code}</td>
                <td><strong>{account.name}</strong>{account.system_key && <small className="block">{account.system_key}</small>}</td>
                <td><span className="type-tag">{account.type.replaceAll('_', ' ')}</span></td>
                <td>{account.normal_balance}</td>
                <td><span className={account.is_active ? 'status active' : 'status'}>{account.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                <td><div className="flex gap-1"><Button variant="ghost" onClick={() => startEditing(account)}>Ubah</Button>{account.is_system ? <Badge>Sistem</Badge> : <><Button variant="ghost" disabled={changingStatus === account.id} onClick={() => void changeStatus(account)}>{changingStatus === account.id ? 'Memproses…' : account.is_active ? 'Nonaktifkan' : 'Aktifkan'}</Button>{!account.is_active && <Button className="text-red-700 hover:bg-red-50 hover:text-red-800" variant="ghost" onClick={() => { setDeleting(account); setDeleteConfirmation('') }}>Hapus</Button>}</>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
    </section>
  )
}
