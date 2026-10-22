import { useCallback, useEffect, useMemo, useState } from 'react'
import { downloadExport, getLedger, listAccounts } from '../api/accounting'
import type { Account, LedgerRow } from '../types/accounting'
import { useLedgerRefresh } from '../lib/refresh'
import { Button, PageHeader } from '../components/ui'
import { DataTable, SearchInput, TablePanel, type Column } from '../components/DataTable'
import { CancelledJournalFilter, useShowCancelledJournals } from '../components/CancelledJournalFilter'
import { LookupField } from '../components/FormShell'
import { decimal, formatMoney } from '../lib/money'

const today = new Date().toISOString().slice(0, 10)
const firstDay = `${today.slice(0, 8)}01`

// Nilai dari API berbentuk desimal mentah ("75000.00"); jumlah desimalnya
// mengikuti skala mata uang perusahaan.
const scaleOf = (value: string | undefined) => value?.split('.')[1]?.length ?? 0

export function LedgerPage() {
  const [showCancelled, setShowCancelled] = useShowCancelledJournals()
  const [start, setStart] = useState(firstDay)
  const [end, setEnd] = useState(today)
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')

  useEffect(() => { void listAccounts().then((value) => setAccounts(value ?? [])).catch(() => undefined) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await getLedger(start, end, !showCancelled, accountId)) } finally { setLoading(false) }
  }, [start, end, showCancelled, accountId])

  useEffect(() => { void load() }, [load])
  // Tab tetap ter-mount saat pengguna pindah ke Kas Masuk/Keluar, jadi buku
  // besar memuat ulang begitu ada jurnal baru diposting di halaman lain.
  useLedgerRefresh(() => void load())

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) => `${row.journal_number} ${row.account_code} ${row.account_name} ${row.description}`.toLowerCase().includes(needle))
  }, [rows, search])

  const scale = scaleOf(rows[0]?.debit)
  const money = (value: string) => formatMoney(decimal(value), scale)
  const totalDebit = visible.reduce((sum, row) => sum + decimal(row.debit), 0)
  const totalCredit = visible.reduce((sum, row) => sum + decimal(row.credit), 0)
  // Saldo berjalan dihitung per akun, jadi saldo akhir hanya bermakna saat
  // satu akun dipilih.
  const closing = accountId && rows.length > 0 ? rows[rows.length - 1].balance : null

  const columns: Array<Column<LedgerRow>> = [
    { header: 'Tanggal', width: '110px', cell: (row) => row.transaction_date.slice(0, 10) },
    { header: 'Jurnal', className: 'mono', cell: (row) => row.journal_number },
    { header: 'Akun', cell: (row) => <><strong>{row.account_code}</strong><small className="block">{row.account_name}</small></> },
    { header: 'Deskripsi', cell: (row) => row.description },
    { header: 'Debit', align: 'right', className: 'mono', cell: (row) => money(row.debit) },
    { header: 'Kredit', align: 'right', className: 'mono', cell: (row) => money(row.credit) },
    { header: 'Saldo', align: 'right', className: 'mono', cell: (row) => money(row.balance) },
  ]

  return (
    <section>
      <PageHeader
        eyebrow="GENERAL LEDGER"
        title="Buku besar"
        description="Pergerakan akun dari jurnal yang diposting. Pasangan jurnal yang dibatalkan pada tanggal yang sama disembunyikan secara bawaan; riwayat tetap tersimpan."
        action={<div className="date-filter">
          <input aria-label="Tanggal awal" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          <input aria-label="Tanggal akhir" type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
          <Button variant="secondary" onClick={() => void load()}>Terapkan</Button>
          <Button icon="download" onClick={() => void downloadExport('ledger', start, end, !showCancelled)}>CSV</Button>
        </div>}
      />

      <TablePanel
        title="Pergerakan akun"
        description={`Periode ${start} sampai ${end}.`}
        badge={`${visible.length} baris`}
        badgeTone="info"
        className="!mt-0"
        toolbar={<div className="flex flex-wrap items-center gap-3"><div className="min-w-[260px]"><LookupField label="Akun" value={accountId} onChange={setAccountId} placeholder="Semua akun" options={accounts.map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` }))} /></div><SearchInput value={search} onChange={setSearch} placeholder="Cari nomor jurnal, akun, atau deskripsi…" /><CancelledJournalFilter checked={showCancelled} onChange={setShowCancelled} /></div>}
      >
        <DataTable
          search={false}
          columns={columns}
          rows={visible}
          keyOf={(row) => `${row.journal_id}-${row.account_code}-${row.debit}-${row.credit}-${row.balance}`}
          loading={loading}
          emptyIcon="ledger"
          footer={visible.length > 0 && <tfoot><tr>
            <th colSpan={4}>{closing !== null ? 'Total & saldo akhir' : 'Total'}</th>
            <th className="number mono">{formatMoney(totalDebit, scale)}</th>
            <th className="number mono">{formatMoney(totalCredit, scale)}</th>
            <th className="number mono">{closing !== null ? money(closing) : '—'}</th>
          </tr></tfoot>}
          empty={rows.length === 0 ? 'Belum ada pergerakan ledger pada periode ini.' : 'Tidak ada baris yang cocok dengan pencarian.'}
        />
      </TablePanel>
    </section>
  )
}
