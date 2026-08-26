import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Account, JournalLineInput, LedgerRow } from '../types/accounting'
import { getLedger } from '../api/accounting'
import { useLedgerRefresh } from '../lib/refresh'
import { decimal, formatDate, formatMoney } from '../lib/money'
import { useTabHandle } from '../store/tabs'
import { Badge, Button, DataEntryGuide, PageHeader } from '../components/ui'
import { ListView, type ListColumn } from '../components/ListView'
import { Modal, messageOf } from '../components/Modal'

const emptyLine = (): JournalLineInput => ({ account_id: '', description: '', debit: '0', credit: '0' })

const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01`

/**
 * Satu jurnal yang sudah diposting, disusun dari baris buku besar. Setiap
 * transaksi Kas & Bank, dokumen penjualan/pembelian, dan jurnal manual
 * menghasilkan satu entri di sini, jadi daftar ini adalah jurnal umum.
 */
type PostedJournal = {
  id: string
  number: string
  transaction_date: string
  description: string
  debit: number
  credit: number
  lines: LedgerRow[]
}

function groupJournals(rows: LedgerRow[]): PostedJournal[] {
  const byJournal = new Map<string, PostedJournal>()
  for (const row of rows) {
    const current = byJournal.get(row.journal_id) ?? {
      id: row.journal_id, number: row.journal_number, transaction_date: row.transaction_date,
      description: row.description, debit: 0, credit: 0, lines: [],
    }
    current.debit += decimal(row.debit)
    current.credit += decimal(row.credit)
    current.lines.push(row)
    byJournal.set(row.journal_id, current)
  }
  return [...byJournal.values()].sort((left, right) =>
    right.transaction_date.localeCompare(left.transaction_date) || right.number.localeCompare(left.number))
}

export function JournalPage({ accounts, scale, onSubmit }: {
  accounts: Account[]
  scale: number
  onSubmit: (input: { date: string; description: string; lines: JournalLineInput[] }) => Promise<void>
}) {
  const [view, setView] = useState<'list' | 'form'>('list')
  const [start, setStart] = useState(monthStart())
  const [end, setEnd] = useState(today())
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<PostedJournal | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getLedger(start, end) ?? [])
      setError(null)
    } catch (caught) {
      setError(messageOf(caught, 'Daftar jurnal gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [start, end])

  useEffect(() => { void load() }, [load])
  // Jurnal dari modul lain (Kas Masuk/Keluar, faktur, persediaan) muncul di
  // sini begitu diposting, tanpa perlu menutup dan membuka tab ini lagi.
  useLedgerRefresh(() => void load())

  const journals = useMemo(() => groupJournals(rows), [rows])
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return journals
    return journals.filter((journal) =>
      `${journal.number} ${journal.description} ${journal.lines.map((line) => `${line.account_code} ${line.account_name} ${line.description}`).join(' ')}`
        .toLowerCase().includes(needle))
  }, [journals, search])

  if (view === 'form') {
    return <JournalForm accounts={accounts} onCancel={() => setView('list')} onSubmit={async (input) => { await onSubmit(input); await load(); setView('list') }} />
  }

  const columns: Array<ListColumn<PostedJournal>> = [
    { key: 'number', header: 'No. jurnal', className: 'mono', width: '190px', sortValue: (journal) => journal.number, cell: (journal) => journal.number },
    { key: 'date', header: 'Tanggal', width: '130px', sortValue: (journal) => journal.transaction_date, cell: (journal) => formatDate(journal.transaction_date) },
    { key: 'description', header: 'Keterangan', cell: (journal) => journal.description || '—' },
    { key: 'lines', header: 'Baris', align: 'right', width: '90px', cell: (journal) => journal.lines.length },
    { key: 'debit', header: 'Debit', align: 'right', className: 'mono', width: '150px', sortValue: (journal) => journal.debit, cell: (journal) => formatMoney(journal.debit, scale) },
    { key: 'credit', header: 'Kredit', align: 'right', className: 'mono', width: '150px', sortValue: (journal) => journal.credit, cell: (journal) => formatMoney(journal.credit, scale) },
  ]

  return (
    <section>
      <PageHeader
        eyebrow="DOUBLE ENTRY"
        title="Jurnal umum"
        description="Semua jurnal yang sudah diposting — baik dari jurnal manual maupun dari modul lain seperti Kas Masuk, Kas Keluar, dan faktur."
        action={<Badge tone="info">{visible.length} jurnal</Badge>}
      />
      <ListView
        storageKey="journals"
        columns={columns}
        rows={visible}
        keyOf={(journal) => journal.id}
        loading={loading}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Cari nomor jurnal, keterangan, atau akun"
        onCreate={() => setView('form')}
        createLabel="Jurnal baru"
        onRefresh={() => void load()}
        onPrint={() => window.print()}
        rowActions={[{ label: 'Lihat rincian jurnal', icon: 'journal', readOnly: true, onSelect: setDetail }]}
        onRowOpen={setDetail}
        empty={error ?? 'Belum ada jurnal yang diposting pada rentang tanggal ini.'}
        extraToolbar={
          <span className="flex items-center gap-1.5">
            <input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="!min-h-8 !w-36" aria-label="Tanggal awal" />
            <span className="text-[11px] text-[color:var(--fg-muted)]">s/d</span>
            <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="!min-h-8 !w-36" aria-label="Tanggal akhir" />
          </span>
        }
      />

      <JournalDetail journal={detail} scale={scale} onClose={() => setDetail(null)} />
    </section>
  )
}

function JournalDetail({ journal, scale, onClose }: { journal: PostedJournal | null; scale: number; onClose: () => void }) {
  if (!journal) return null
  return (
    <Modal
      open
      size="lg"
      eyebrow="JURNAL UMUM"
      title={journal.number}
      description={`${formatDate(journal.transaction_date)} · sudah diposting ke buku besar`}
      onClose={onClose}
    >
      {journal.description && <p className="modal-note mb-4">{journal.description}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Akun</th><th>Keterangan</th><th className="number">Debit</th><th className="number">Kredit</th></tr></thead>
          <tbody>
            {journal.lines.map((line, index) => (
              <tr key={`${line.journal_id}-${line.account_code}-${index}`}>
                <td><strong className="mono">{line.account_code}</strong><small className="block">{line.account_name}</small></td>
                <td>{line.description}</td>
                <td className="number mono">{formatMoney(decimal(line.debit), scale)}</td>
                <td className="number mono">{formatMoney(decimal(line.credit), scale)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr>
            <th colSpan={2}>Total</th>
            <th className="number">{formatMoney(journal.debit, scale)}</th>
            <th className="number">{formatMoney(journal.credit, scale)}</th>
          </tr></tfoot>
        </table>
      </div>
    </Modal>
  )
}

function JournalForm({ accounts, onCancel, onSubmit }: {
  accounts: Account[]
  onCancel: () => void
  onSubmit: (input: { date: string; description: string; lines: JournalLineInput[] }) => Promise<void>
}) {
  const [date, setDate] = useState(today())
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<JournalLineInput[]>([emptyLine(), emptyLine()])
  const [saving, setSaving] = useState(false)

  useTabHandle(description !== '' || lines.some((line) => line.account_id !== ''), 'Jurnal baru')

  function updateLine(index: number, patch: Partial<JournalLineInput>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line))
  }

  const debitTotal = lines.reduce((total, line) => total + (Number(line.debit) || 0), 0)
  const creditTotal = lines.reduce((total, line) => total + (Number(line.credit) || 0), 0)
  const balanced = debitTotal > 0 && debitTotal === creditTotal

  async function submit() {
    setSaving(true)
    try {
      await onSubmit({ date, description, lines })
      setDescription('')
      setLines([emptyLine(), emptyLine()])
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <PageHeader eyebrow="DOUBLE ENTRY" title="Jurnal manual" description="Pastikan debit dan kredit seimbang. Jurnal langsung diposting dan tidak dapat diedit setelahnya." />
      <DataEntryGuide steps={['Pilih tanggal transaksi dan isi keterangan yang menjelaskan tujuan jurnal.', 'Pilih akun pada setiap baris, lalu isi nominal hanya di kolom Debit atau Kredit.', 'Pastikan total Debit sama dengan Kredit. Tambahkan baris bila diperlukan, lalu klik “Post jurnal”.']} note="Jurnal langsung diposting dan tidak dapat diedit; periksa akun dan nominal sebelum menyimpan." />
      <div className="panel form-panel">
        <div className="form-grid"><label>Tanggal<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Keterangan<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contoh: Setoran modal awal" /></label></div>
        <div className="journal-table">
          <div className="journal-head"><span>Baris</span><span>Akun</span><span>Keterangan</span><span>Debit</span><span>Kredit</span><span /></div>
          <div className="journal-lines">
          {lines.map((line, index) => (
            <div className="journal-line" key={index}>
              <span className="line-number">{index + 1}</span>
              <select value={line.account_id} onChange={(event) => updateLine(index, { account_id: event.target.value })}><option value="">Pilih akun</option>{accounts.filter((account) => account.is_active).map((account) => <option value={account.id} key={account.id}>{account.code} — {account.name}</option>)}</select>
              <input value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} placeholder="Keterangan baris" />
              <input aria-label={`Debit baris ${index + 1}`} inputMode="decimal" value={line.debit} onChange={(event) => updateLine(index, { debit: event.target.value })} />
              <input aria-label={`Kredit baris ${index + 1}`} inputMode="decimal" value={line.credit} onChange={(event) => updateLine(index, { credit: event.target.value })} />
              <button className="line-remove" type="button" aria-label={`Hapus baris ${index + 1}`} disabled={lines.length <= 2} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>×</button>
            </div>
          ))}
          </div>
        </div>
        <div className="form-actions"><Button variant="secondary" icon="plus" type="button" onClick={() => setLines((current) => [...current, emptyLine()])}>Tambah baris</Button><div className="journal-balance"><span>Debit<strong>{debitTotal.toLocaleString('id-ID')}</strong></span><span>Kredit<strong>{creditTotal.toLocaleString('id-ID')}</strong></span></div><Button variant="secondary" type="button" onClick={onCancel}>Kembali ke daftar</Button><Button disabled={saving || !description || !balanced} onClick={submit}>{saving ? 'Memposting…' : 'Post jurnal'}</Button></div>
      </div>
    </section>
  )
}
