import { useEffect, useState } from 'react'
import { cashAccountHistory, createCashTransaction, getCashTransaction, listCashTransactionsPaged, voidCashTransaction } from '../api/operations'
import { listBankAccounts, listContacts } from '../api/accounting'
import { Badge, PageHeader } from '../components/ui'
import { ListView, type ListColumn } from '../components/ListView'
import { ConfirmDialog, Modal, messageOf, useConfirm } from '../components/Modal'
import { CashForm } from './CashForm'
import { useServerList } from '../lib/serverList'
import { usePersisted } from '../lib/persist'
import { formatDate, formatMinor } from '../lib/money'
import type { Account } from '../types/accounting'
import type { BankAccount, Contact } from '../types/accounting'
import type { CashHistoryRow, CashTransaction } from '../types/operations'

export type CashKind = 'RECEIPT' | 'PAYMENT' | 'TRANSFER'

const kindLabels: Record<CashKind, string> = {
  RECEIPT: 'Kas Masuk',
  PAYMENT: 'Kas Keluar',
  TRANSFER: 'Transfer Kas & Bank',
}

const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01`

/**
 * Modul Kas & Bank (Accurate): daftar transaksi kas per jenis, form pencatatan
 * yang langsung berjurnal, pembatalan lewat jurnal pembalik, dan Histori Bank.
 */
export function CashBankPage({ kind, scale, accounts, onNotice }: {
  kind: CashKind | 'HISTORY'
  scale: number
  accounts: Account[]
  onNotice: (value: string) => void
}) {
  const [view, setView] = useState<'list' | 'form'>('list')
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [detail, setDetail] = useState<CashTransaction | null>(null)
  const [statusFilter, setStatusFilter] = usePersisted(`filter.cash.${kind}.status`, 'ALL')
  const cancellation = useConfirm<CashTransaction>()

  const transactionKind = kind === 'HISTORY' ? undefined : kind
  const label = kind === 'HISTORY' ? 'Histori Bank' : kindLabels[kind]

  const list = useServerList('cash', listCashTransactionsPaged, {
    defaultSort: 'date',
    defaultOrder: 'desc',
    filters: { kind: transactionKind ?? 'ALL', status: statusFilter },
  })

  useEffect(() => {
    void Promise.allSettled([listBankAccounts(), listContacts()]).then(([bank, contact]) => {
      if (bank.status === 'fulfilled') setBankAccounts(bank.value ?? [])
      if (contact.status === 'fulfilled') setContacts(contact.value ?? [])
    })
  }, [])

  // Akun kas/bank adalah akun aset yang terdaftar pada register bank, ditambah
  // akun bertanda sistem CASH/BANK agar perusahaan baru langsung bisa mencatat.
  const cashAccounts = accounts.filter((account) => account.type === 'ASSET' && account.is_active
    && (bankAccounts.some((bank) => bank.account_id === account.id) || account.system_key === 'CASH' || account.system_key === 'BANK'))

  const accountLabel = (id: string | null) => {
    const account = accounts.find((item) => item.id === id)
    return account ? `${account.code} · ${account.name}` : '—'
  }

  if (kind === 'HISTORY') {
    return <BankHistory accounts={cashAccounts.length > 0 ? cashAccounts : accounts.filter((account) => account.type === 'ASSET')} scale={scale} accountLabel={accountLabel} />
  }

  if (view === 'form') {
    return (
      <section>
        <CashForm
          kind={kind}
          scale={scale}
          cashAccounts={cashAccounts}
          accounts={accounts.filter((account) => account.is_active)}
          contacts={contacts.filter((contact) => contact.is_active)}
          onCancel={() => setView('list')}
          onNotice={onNotice}
          onSave={createCashTransaction}
          onSaved={(saved, again) => {
            void list.reload()
            onNotice(`${label} ${saved.number} tersimpan dan jurnalnya sudah diposting.`)
            if (!again) setView('list')
          }}
        />
      </section>
    )
  }

  const columns: Array<ListColumn<CashTransaction>> = [
    { sortable: true, key: 'number', header: 'Nomor', className: 'mono', width: '150px', cell: (row) => row.number },
    { sortable: true, key: 'date', header: 'Tanggal', width: '130px', cell: (row) => formatDate(row.transaction_date) },
    { key: 'account', header: kind === 'TRANSFER' ? 'Dari Rekening' : 'Akun Kas/Bank', cell: (row) => accountLabel(row.account_id) },
    ...(kind === 'TRANSFER' ? [{ key: 'destination', header: 'Ke Rekening', cell: (row: CashTransaction) => accountLabel(row.destination_account_id) }] : []),
    { key: 'memo', header: 'Keterangan', cell: (row) => row.memo || '—' },
    { sortable: true, key: 'total', header: 'Nilai', align: 'right', className: 'mono', width: '150px', cell: (row) => formatMinor(row.total_minor, scale) },
    ...(kind === 'TRANSFER' ? [{ key: 'fee', header: 'Biaya', align: 'right' as const, className: 'mono', width: '110px', cell: (row: CashTransaction) => formatMinor(row.fee_minor, scale) }] : []),
    { sortable: true, key: 'status', header: 'Status', width: '110px', cell: (row) => <Badge tone={row.status === 'POSTED' ? 'success' : 'neutral'}>{row.status === 'POSTED' ? 'Diposting' : 'Batal'}</Badge> },
  ]

  return (
    <section>
      <PageHeader
        eyebrow="KAS & BANK"
        title={label}
        description={kind === 'TRANSFER'
          ? 'Pindah dana antar rekening kas dan bank; biaya transfer langsung dibebankan ke akun biaya.'
          : `Setiap ${label.toLowerCase()} langsung membentuk jurnal, jadi saldo kas dan buku besar selalu sinkron.`}
      />
      <ListView
        storageKey={`cash-${kind}`}
        columns={columns}
        rows={list.rows}
        keyOf={(row) => row.id}
        loading={list.loading}
        server={list.server}
        search={list.search}
        onSearch={list.setSearch}
        searchPlaceholder="Cari nomor atau keterangan"
        onCreate={() => setView('form')}
        createLabel="Data Baru"
        createDisabled={cashAccounts.length === 0}
        createTitle={cashAccounts.length === 0 ? 'Buat akun kas/bank lebih dulu' : 'Data Baru'}
        onRefresh={() => void list.reload()}
        onPrint={() => window.print()}
        empty={list.error ?? `Belum ada ${label.toLowerCase()}.`}
        filters={[{
          key: 'status',
          label: 'Status',
          value: statusFilter,
          onChange: setStatusFilter,
          options: [{ value: 'ALL', label: 'Semua' }, { value: 'POSTED', label: 'Diposting' }, { value: 'VOID', label: 'Batal' }],
        }]}
        rowActions={[
          { label: 'Lihat rincian & jurnal', icon: 'journal', readOnly: true, onSelect: setDetail },
          {
            label: 'Batalkan transaksi',
            icon: 'trash',
            danger: true,
            onSelect: cancellation.open,
            disabled: (row) => row.status === 'VOID' && 'Transaksi ini sudah dibatalkan',
          },
        ]}
        onRowOpen={setDetail}
      />

      <CashDetail transaction={detail} scale={scale} accountLabel={accountLabel} onClose={() => setDetail(null)} />

      <ConfirmDialog
        open={cancellation.target !== null}
        tone="danger"
        title="Batalkan transaksi kas?"
        confirmLabel="Batalkan transaksi"
        busy={cancellation.busy}
        error={cancellation.error}
        onClose={cancellation.close}
        onConfirm={() => cancellation.run(async (row) => {
          await voidCashTransaction(row.id, `Pembatalan ${row.number}`)
          await list.reload()
          onNotice(`${row.number} dibatalkan lewat jurnal pembalik.`)
        })}
        description={<>
          <strong>{cancellation.target?.number}</strong> akan ditandai batal dan sistem membuat jurnal pembalik.
          Jurnal aslinya tetap tersimpan karena buku besar bersifat append-only.
        </>}
      />
    </section>
  )
}

function CashDetail({ transaction, scale, accountLabel, onClose }: {
  transaction: CashTransaction | null
  scale: number
  accountLabel: (id: string | null) => string
  onClose: () => void
}) {
  const [full, setFull] = useState<CashTransaction | null>(null)

  // Baris daftar tidak membawa rincian, jadi detail diambil ulang saat dibuka.
  useEffect(() => {
    if (!transaction) { setFull(null); return }
    let cancelled = false
    setFull(transaction)
    void getCashTransaction(transaction.id)
      .then((value) => { if (!cancelled) setFull(value) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [transaction])

  if (!transaction) return null
  const lines = full?.lines ?? []

  return (
    <Modal
      open
      size="lg"
      eyebrow={kindLabels[transaction.kind]}
      title={transaction.number}
      description={`${formatDate(transaction.transaction_date)} · ${transaction.status === 'POSTED' ? 'sudah diposting ke buku besar' : 'dibatalkan lewat jurnal pembalik'}`}
      onClose={onClose}
    >
      <div className="doc-grid mb-4">
        <div><span className="lookup-label">{transaction.kind === 'TRANSFER' ? 'Dari rekening' : 'Akun kas/bank'}</span><strong className="block text-[13px]">{accountLabel(transaction.account_id)}</strong></div>
        {transaction.destination_account_id && <div><span className="lookup-label">Ke rekening</span><strong className="block text-[13px]">{accountLabel(transaction.destination_account_id)}</strong></div>}
        <div><span className="lookup-label">Nilai</span><strong className="block text-[13px] mono">{formatMinor(transaction.total_minor, scale)}</strong></div>
        {transaction.fee_minor > 0 && <div><span className="lookup-label">Biaya</span><strong className="block text-[13px] mono">{formatMinor(transaction.fee_minor, scale)}</strong></div>}
      </div>
      {transaction.memo && <p className="modal-note mb-4">{transaction.memo}</p>}
      {lines.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Akun</th><th>Keterangan</th><th className="number">Jumlah</th></tr></thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.sequence}</td>
                  <td>{accountLabel(line.account_id)}</td>
                  <td>{line.description}</td>
                  <td className="number mono">{formatMinor(line.amount_minor, scale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

function BankHistory({ accounts, scale, accountLabel }: {
  accounts: Account[]
  scale: number
  accountLabel: (id: string | null) => string
}) {
  const [accountId, setAccountId] = useState('')
  const [startDate, setStartDate] = useState(monthStart())
  const [endDate, setEndDate] = useState(today())
  const [rows, setRows] = useState<CashHistoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => { if (!accountId && accounts.length > 0) setAccountId(accounts[0].id) }, [accounts, accountId])

  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    setLoading(true)
    cashAccountHistory(accountId, startDate, endDate)
      .then((value) => { if (!cancelled) { setRows(value ?? []); setError(null) } })
      .catch((cause) => { if (!cancelled) setError(messageOf(cause, 'Histori rekening gagal dimuat.')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [accountId, startDate, endDate])

  const visible = rows.filter((row) => `${row.journal_number} ${row.description}`.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <section>
      <PageHeader eyebrow="KAS & BANK" title="Histori Bank" description="Mutasi rekening kas dan bank beserta saldo berjalannya, langsung dari buku besar." />
      <ListView
        storageKey="cash-history"
        columns={[
          { key: 'date', header: 'Tanggal', width: '130px', cell: (row: CashHistoryRow) => formatDate(row.transaction_date) },
          { key: 'journal', header: 'Jurnal', className: 'mono', width: '190px', cell: (row: CashHistoryRow) => row.journal_number },
          { key: 'description', header: 'Keterangan', cell: (row: CashHistoryRow) => row.description },
          { key: 'debit', header: 'Masuk', align: 'right', className: 'mono', width: '130px', cell: (row: CashHistoryRow) => formatMinor(row.debit_minor, scale) },
          { key: 'credit', header: 'Keluar', align: 'right', className: 'mono', width: '130px', cell: (row: CashHistoryRow) => formatMinor(row.credit_minor, scale) },
          { key: 'balance', header: 'Saldo', align: 'right', className: 'mono', width: '150px', cell: (row: CashHistoryRow) => formatMinor(row.balance_minor, scale) },
        ]}
        rows={visible}
        keyOf={(row) => `${row.journal_id}-${row.journal_number}-${row.balance_minor}`}
        loading={loading}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Cari nomor jurnal atau keterangan"
        empty={error ?? (accountId ? 'Tidak ada mutasi pada rentang tanggal ini.' : 'Pilih rekening kas atau bank lebih dulu.')}
        filters={[{
          key: 'account',
          label: 'Rekening',
          value: accountId,
          onChange: setAccountId,
          options: accounts.map((account) => ({ value: account.id, label: accountLabel(account.id) })),
        }]}
        extraToolbar={
          <span className="flex items-center gap-1.5">
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="!min-h-8 !w-36" aria-label="Tanggal awal" />
            <span className="text-[11px] text-[color:var(--fg-muted)]">s/d</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="!min-h-8 !w-36" aria-label="Tanggal akhir" />
          </span>
        }
      />
    </section>
  )
}
