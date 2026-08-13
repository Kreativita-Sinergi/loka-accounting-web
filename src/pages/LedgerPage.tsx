import { useEffect, useState } from 'react'
import { downloadExport, getLedger } from '../api/accounting'
import type { LedgerRow } from '../types/accounting'
import { Button, EmptyState, PageHeader } from '../components/ui'

const today = new Date().toISOString().slice(0, 10)
const firstDay = `${today.slice(0, 8)}01`

export function LedgerPage() {
  const [start, setStart] = useState(firstDay)
  const [end, setEnd] = useState(today)
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try { setRows(await getLedger(start, end)) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  return <section>
    <PageHeader eyebrow="GENERAL LEDGER" title="Buku besar" description="Semua pergerakan akun dari jurnal yang sudah diposting." action={<div className="date-filter"><input aria-label="Tanggal awal" type="date" value={start} onChange={(e) => setStart(e.target.value)} /><input aria-label="Tanggal akhir" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /><Button variant="secondary" onClick={() => void load()}>Terapkan</Button><Button icon="download" onClick={() => void downloadExport('ledger', start, end)}>CSV</Button></div>} />
    <div className="panel table-wrap">{loading ? <div className="loading">Memuat buku besar…</div> : rows.length === 0 ? <EmptyState>Belum ada pergerakan ledger pada periode ini.</EmptyState> : <table><thead><tr><th>Tanggal</th><th>Jurnal</th><th>Akun</th><th>Deskripsi</th><th className="number">Debit</th><th className="number">Kredit</th><th className="number">Saldo</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.journal_id}-${index}`}><td>{row.transaction_date.slice(0, 10)}</td><td className="mono">{row.journal_number}</td><td><strong>{row.account_code}</strong><small className="block">{row.account_name}</small></td><td>{row.description}</td><td className="number mono">{row.debit}</td><td className="number mono">{row.credit}</td><td className="number mono">{row.balance}</td></tr>)}</tbody></table>}</div>
  </section>
}
