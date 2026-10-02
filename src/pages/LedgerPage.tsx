import { useCallback, useEffect, useMemo, useState } from 'react'
import { downloadExport, getLedger } from '../api/accounting'
import type { LedgerRow } from '../types/accounting'
import { useLedgerRefresh } from '../lib/refresh'
import { Button, PageHeader } from '../components/ui'
import { DataTable, SearchInput, TablePanel, type Column } from '../components/DataTable'
import { CancelledJournalFilter, useShowCancelledJournals } from '../components/CancelledJournalFilter'

const today = new Date().toISOString().slice(0, 10)
const firstDay = `${today.slice(0, 8)}01`

export function LedgerPage() {
  const [showCancelled, setShowCancelled] = useShowCancelledJournals()
  const [start, setStart] = useState(firstDay)
  const [end, setEnd] = useState(today)
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await getLedger(start, end, !showCancelled)) } finally { setLoading(false) }
  }, [start, end, showCancelled])

  useEffect(() => { void load() }, [load])
  // Tab tetap ter-mount saat pengguna pindah ke Kas Masuk/Keluar, jadi buku
  // besar memuat ulang begitu ada jurnal baru diposting di halaman lain.
  useLedgerRefresh(() => void load())

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) => `${row.journal_number} ${row.account_code} ${row.account_name} ${row.description}`.toLowerCase().includes(needle))
  }, [rows, search])

  const columns: Array<Column<LedgerRow>> = [
    { header: 'Tanggal', width: '110px', cell: (row) => row.transaction_date.slice(0, 10) },
    { header: 'Jurnal', className: 'mono', cell: (row) => row.journal_number },
    { header: 'Akun', cell: (row) => <><strong>{row.account_code}</strong><small className="block">{row.account_name}</small></> },
    { header: 'Deskripsi', cell: (row) => row.description },
    { header: 'Debit', align: 'right', className: 'mono', cell: (row) => row.debit },
    { header: 'Kredit', align: 'right', className: 'mono', cell: (row) => row.credit },
    { header: 'Saldo', align: 'right', className: 'mono', cell: (row) => row.balance },
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
        toolbar={<div className="flex flex-wrap items-center gap-3"><SearchInput value={search} onChange={setSearch} placeholder="Cari nomor jurnal, akun, atau deskripsi…" /><CancelledJournalFilter checked={showCancelled} onChange={setShowCancelled} /></div>}
      >
        <DataTable
          search={false}
          columns={columns}
          rows={visible}
          keyOf={(row) => `${row.journal_id}-${row.account_code}-${row.debit}-${row.credit}-${row.balance}`}
          loading={loading}
          emptyIcon="ledger"
          empty={rows.length === 0 ? 'Belum ada pergerakan ledger pada periode ini.' : 'Tidak ada baris yang cocok dengan pencarian.'}
        />
      </TablePanel>
    </section>
  )
}
