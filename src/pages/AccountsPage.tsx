import { useCallback, useEffect, useState } from 'react'
import type { Account, AccountType, TrialBalance } from '../types/accounting'
import type { GeneralLedgerAccount } from '../types/reports'
import { downloadExport, getReport, listAccountsPaged } from '../api/accounting'
import { getGeneralLedger } from '../api/analytics'
import { useServerList } from '../lib/serverList'
import { requestTab } from '../lib/menu'
import { useLedgerRefresh } from '../lib/refresh'
import { decimal, formatDate, formatMoney } from '../lib/money'
import { Badge, Button, DataEntryGuide, EmptyState, PageHeader } from '../components/ui'
import { amount } from './ReportsPage'
import { StatusPill } from '../components/DataTable'
import { ListView, type ListColumn } from '../components/ListView'
import { usePersisted } from '../lib/persist'
import { ConfirmDialog, FormModal, Modal, messageOf, useConfirm } from '../components/Modal'

const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01`
/** Saldo akhir dihitung sejak transaksi pertama, bukan sejak awal bulan. */
const beginning = '1900-01-01'

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

export function AccountsPage({ accounts, scale, onCreate, onUpdate, onStatusChange, onDelete }: {
  accounts: Account[]
  scale: number
  onCreate: (input: AccountInput) => Promise<void>
  onUpdate: (id: string, input: AccountInput) => Promise<void>
  onStatusChange: (id: string, active: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editor, setEditor] = useState<{ account: Account | null } | null>(null)
  const [type, setType] = useState<AccountType>('ASSET')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = usePersisted('filter.accounts.type', 'ALL')
  const [statusFilter, setStatusFilter] = usePersisted('filter.accounts.status', 'ALL')
  const status = useConfirm<Account>()
  const removal = useConfirm<Account>()
  const [detail, setDetail] = useState<Account | null>(null)
  const [balances, setBalances] = useState<Record<string, number>>({})

  const editing = editor?.account ?? null

  // Saldo akhir tiap akun diambil dari neraca saldo kumulatif, lalu diberi
  // tanda sesuai saldo normal akun agar akun kredit tampil positif.
  const loadBalances = useCallback(async () => {
    try {
      const report = await getReport<TrialBalance>('trial-balance', beginning, today())
      const next: Record<string, number> = {}
      for (const row of report.rows ?? []) next[row.account_id] = decimal(row.debit) - decimal(row.credit)
      setBalances(next)
    } catch {
      setBalances({})
    }
  }, [])

  useEffect(() => { void loadBalances() }, [loadBalances])
  useLedgerRefresh(() => void loadBalances())

  function balanceOf(account: Account) {
    const net = balances[account.id] ?? 0
    const signed = account.normal_balance === 'CREDIT' ? -net : net
    return signed === 0 ? 0 : signed // menghindari tampilan "-0"
  }

  // Daftar akun dipaginasi, diurutkan, dan dicari di database (§4.1).
  const list = useServerList('accounts', listAccountsPaged, {
    defaultSort: 'code',
    filters: { type: typeFilter, status: statusFilter },
  })

  /** Mutasi memperbarui daftar global di App sekaligus halaman aktif. */
  async function mutate(action: () => Promise<void>) {
    await action()
    await list.reload()
  }

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
      await mutate(() => editing ? onUpdate(editing.id, input) : onCreate(input))
      setEditor(null)
    } catch (error) {
      setFormError(messageOf(error, 'Akun gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const columns: Array<ListColumn<Account>> = [
    { sortable: true, key: 'code', header: 'Kode', className: 'mono', width: '110px', sortValue: (account) => account.code, cell: (account) => account.code },
    {
      key: 'name',
      header: 'Nama akun',
      sortValue: (account) => account.name,
      cell: (account) => <>
        <div className="flex items-center gap-2"><strong>{account.name}</strong>{account.is_system && <Badge tone="info">Sistem</Badge>}</div>
        {account.system_key && <small className="block">{account.system_key}</small>}
      </>,
    },
    { sortable: true, key: 'type', header: 'Tipe', sortValue: (account) => account.type, cell: (account) => <span className="type-tag">{account.type.replaceAll('_', ' ')}</span> },
    { sortable: true, key: 'normal_balance', header: 'Saldo normal', sortValue: (account) => account.normal_balance, cell: (account) => account.normal_balance },
    { key: 'parent', header: 'Akun induk', optional: true, cell: (account) => accounts.find((candidate) => candidate.id === account.parent_id)?.code ?? '—' },
    {
      key: 'balance',
      header: 'Saldo akhir',
      align: 'right',
      className: 'mono',
      width: '150px',
      // Tanpa sortValue: daftar akun diurutkan di database, sedangkan saldo
      // berasal dari neraca saldo sehingga tidak bisa diurutkan server-side.
      cell: (account) => formatMoney(balanceOf(account), scale),
    },
    { sortable: true, key: 'status', header: 'Status', sortValue: (account) => account.is_active ? 1 : 0, cell: (account) => <StatusPill active={account.is_active} /> },
  ]

  const rowActions = [
    { label: 'Lihat detail & saldo', icon: 'ledger' as const, readOnly: true, onSelect: (account: Account) => setDetail(account) },
    { label: 'Ubah', icon: 'edit' as const, onSelect: openEdit },
    {
      label: (account: Account) => account.is_active ? 'Nonaktifkan' : 'Aktifkan',
      icon: 'power' as const,
      onSelect: status.open,
      disabled: (account: Account) => account.is_system && 'Akun sistem tidak dapat dinonaktifkan',
    },
    {
      label: 'Hapus permanen',
      icon: 'trash' as const,
      danger: true,
      onSelect: removal.open,
      when: (account: Account) => !account.is_system,
      disabled: (account: Account) => account.is_active && 'Nonaktifkan akun lebih dulu',
    },
  ]

  return (
    <section>
      <PageHeader
        eyebrow="CHART OF ACCOUNTS"
        title="Daftar akun"
        description="Struktur akun organisasi untuk pencatatan dan laporan keuangan."
        action={<div className="page-actions"><Badge>{accounts.length} akun</Badge></div>}
      />
      <DataEntryGuide
        steps={[
          'Klik “Akun baru” untuk membuka form penambahan akun.',
          'Gunakan menu aksi (titik tiga) pada baris tabel untuk Ubah, Nonaktifkan, Aktifkan, atau Hapus permanen.',
          'Klik satu baris untuk membuka detail akun: saldo awal, mutasi, dan saldo akhir beserta jurnal pembentuknya.',
          'Nonaktifkan adalah pengganti hapus: akun tetap ada dalam histori tetapi tidak tersedia untuk transaksi baru.',
          'Hapus permanen hanya tersedia untuk akun nonaktif dan akan ditolak jika akun masih dipakai data lain.',
        ]}
        note="Akun bertanda “Sistem” dipakai otomatis oleh modul lain — penjualan, pembelian, kas, pajak, dan persediaan merujuknya saat memposting jurnal. Karena itu akun sistem hanya dapat diubah namanya, dan tidak dapat dinonaktifkan maupun dihapus. Akun yang Anda buat sendiri bebas dinonaktifkan."
      />

      <ListView
        storageKey="accounts"
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        server={list.server}
        keyOf={(account) => account.id}
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Cari kode, nama, atau tipe akun"
        onCreate={openCreate}
        createLabel="Akun baru"
        onRefresh={() => void list.reload()}
        onImport={() => requestTab('settings.import')}
        onExport={() => void downloadExport('accounts')}
        onPrint={() => window.print()}
        rowActions={rowActions}
        onRowOpen={setDetail}
        empty={list.error ?? (accounts.length === 0 ? 'Belum ada akun dalam chart of accounts.' : 'Tidak ada akun yang cocok dengan filter.')}
        filters={[
          {
            key: 'type',
            label: 'Tipe',
            value: typeFilter,
            onChange: setTypeFilter,
            options: [{ value: 'ALL', label: 'Semua' }, ...accountTypes.map((option) => ({ value: option.value, label: option.label }))],
          },
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [{ value: 'ALL', label: 'Semua' }, { value: 'ACTIVE', label: 'Aktif' }, { value: 'INACTIVE', label: 'Nonaktif' }],
          },
        ]}
      />

      <AccountDetail account={detail} scale={scale} onClose={() => setDetail(null)} onEdit={(account) => { setDetail(null); openEdit(account) }} />

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
        onConfirm={() => status.run((account) => mutate(() => onStatusChange(account.id, !account.is_active)))}
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
        onConfirm={() => removal.run((account) => mutate(() => onDelete(account.id)))}
        description={<>
          <strong>{removal.target?.code} · {removal.target?.name}</strong> akan hilang dari chart of accounts dan tindakan ini tidak dapat dibatalkan.
          Penghapusan ditolak jika akun masih menjadi induk atau pernah dipakai jurnal, mapping, bank, produk, aset, anggaran, maupun data operasional lain.
        </>}
      />
    </section>
  )
}

/**
 * Detail satu akun: saldo awal periode, mutasi debit/kredit, saldo akhir, dan
 * jurnal pembentuknya. Sumbernya laporan buku besar per akun, jadi angka di
 * sini selalu sama dengan Buku Besar dan Neraca Saldo.
 */
function AccountDetail({ account, scale, onClose, onEdit }: {
  account: Account | null
  scale: number
  onClose: () => void
  onEdit: (account: Account) => void
}) {
  const [start, setStart] = useState(monthStart())
  const [end, setEnd] = useState(today())
  const [report, setReport] = useState<GeneralLedgerAccount | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accountId = account?.id
  const load = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    try {
      const value = await getGeneralLedger({ account_id: accountId, start_date: start, end_date: end })
      setReport(value.accounts.find((row) => row.account_id === accountId) ?? null)
      setError(null)
    } catch (caught) {
      setReport(null)
      setError(messageOf(caught, 'Mutasi akun gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [accountId, start, end])

  useEffect(() => { void load() }, [load])
  useLedgerRefresh(() => void load())

  if (!account) return null

  // Akun tanpa mutasi pada periode ini tetap punya saldo — nol.
  const zero = formatMoney(0, scale)
  const summary = report ?? { opening_balance: zero, total_debit: zero, total_credit: zero, closing_balance: zero, entries: [] }

  return (
    <Modal
      open
      size="xl"
      eyebrow="DETAIL AKUN"
      title={`${account.code} · ${account.name}`}
      description={`${account.type.replaceAll('_', ' ')} · saldo normal ${account.normal_balance}${account.is_system ? ' · akun sistem' : ''}`}
      onClose={onClose}
      footer={<Button variant="secondary" icon="edit" onClick={() => onEdit(account)}>Ubah akun</Button>}
    >
      <div className="flex items-center gap-1.5 mb-4">
        <input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="!min-h-8 !w-36" aria-label="Tanggal awal" />
        <span className="text-[11px] text-[color:var(--fg-muted)]">s/d</span>
        <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="!min-h-8 !w-36" aria-label="Tanggal akhir" />
      </div>

      <div className="doc-grid mb-4">
        <div><span className="lookup-label">Saldo awal</span><strong className="summary-value mono">{amount(summary.opening_balance)}</strong></div>
        <div><span className="lookup-label">Mutasi debit</span><strong className="summary-value mono">{amount(summary.total_debit)}</strong></div>
        <div><span className="lookup-label">Mutasi kredit</span><strong className="summary-value mono">{amount(summary.total_credit)}</strong></div>
        <div><span className="lookup-label">Saldo akhir</span><strong className="summary-value mono">{amount(summary.closing_balance)}</strong></div>
      </div>

      {error && <p className="modal-note mb-4">{error}</p>}
      {loading && summary.entries.length === 0 && <p className="modal-note">Memuat mutasi akun…</p>}

      {summary.entries.length === 0 && !loading
        ? <EmptyState icon="ledger">Belum ada mutasi pada rentang tanggal ini. Saldo akhir mengikuti saldo awal.</EmptyState>
        : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tanggal</th><th>No. jurnal</th><th>Keterangan</th><th className="number">Debit</th><th className="number">Kredit</th><th className="number">Saldo</th></tr></thead>
              <tbody>
                {summary.entries.map((entry, index) => (
                  <tr key={`${entry.journal_id}-${index}`}>
                    <td>{formatDate(entry.transaction_date)}</td>
                    <td className="mono">{entry.journal_number}</td>
                    <td>{entry.description}</td>
                    <td className="number mono">{amount(entry.debit)}</td>
                    <td className="number mono">{amount(entry.credit)}</td>
                    <td className="number mono">{amount(entry.running_balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr>
                <th colSpan={3}>Saldo akhir</th>
                <th className="number">{amount(summary.total_debit)}</th>
                <th className="number">{amount(summary.total_credit)}</th>
                <th className="number">{amount(summary.closing_balance)}</th>
              </tr></tfoot>
            </table>
          </div>
        )}
    </Modal>
  )
}
