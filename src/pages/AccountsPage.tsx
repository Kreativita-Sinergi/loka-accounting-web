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

export function AccountsPage({ accounts, onCreate }: { accounts: Account[]; onCreate: (input: { code: string; name: string; type: AccountType; parent_id: string | null }) => Promise<void> }) {
  const [type, setType] = useState<AccountType>('ASSET')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    setSaving(true)
    try {
      await onCreate({ code: String(values.get('code')), name: String(values.get('name')), type, parent_id: String(values.get('parent_id') || '') || null })
      form.reset()
      setType('ASSET')
    } catch {
      return
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <PageHeader eyebrow="CHART OF ACCOUNTS" title="Daftar akun" description="Struktur akun organisasi untuk pencatatan dan laporan keuangan." action={<Badge>{accounts.length} akun</Badge>} />
      <DataEntryGuide steps={['Isi kode akun yang belum digunakan, misalnya 1020 untuk rekening bank tambahan.', 'Isi nama akun lalu pilih tipe yang sesuai dengan kegunaan akun.', 'Pilih akun induk jika akun ini merupakan rincian dari akun lain dengan tipe yang sama.', 'Klik “Tambah akun”. Akun baru langsung muncul pada daftar di bawah.']} note="Saldo normal ditentukan otomatis dari tipe akun. Akun sistem bawaan sebaiknya tidak diduplikasi." />
      <form className="panel form-panel wide-form" onSubmit={(event) => void submit(event)}>
        <div className="section-title"><div><span className="section-icon">COA</span><h2>Akun baru</h2></div><Badge tone="info">Saldo normal otomatis</Badge></div>
        <div className="form-row">
          <label>Kode akun<input name="code" inputMode="numeric" placeholder="Contoh: 1020" required /></label>
          <label>Nama akun<input name="name" placeholder="Contoh: Bank BCA" required /></label>
          <label>Tipe akun<select value={type} onChange={(event) => setType(event.target.value as AccountType)}>{accountTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Akun induk (opsional)<select name="parent_id" defaultValue=""><option value="">Tanpa akun induk</option>{accounts.filter((account) => account.type === type && account.is_active).map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label>
        </div>
        <Button disabled={saving}>{saving ? 'Menyimpan…' : 'Tambah akun'}</Button>
      </form>
      <div className="table-wrap panel">
        {accounts.length === 0 ? <EmptyState>Belum ada akun dalam chart of accounts.</EmptyState> :
        <table>
          <thead><tr><th>Kode</th><th>Nama akun</th><th>Tipe</th><th>Saldo normal</th><th>Status</th></tr></thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td className="mono">{account.code}</td>
                <td><strong>{account.name}</strong>{account.system_key && <small className="block">{account.system_key}</small>}</td>
                <td><span className="type-tag">{account.type.replaceAll('_', ' ')}</span></td>
                <td>{account.normal_balance}</td>
                <td><span className={account.is_active ? 'status active' : 'status'}>{account.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
    </section>
  )
}
