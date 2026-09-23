import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Account, JournalLineInput, LedgerRow } from '../types/accounting'
import { amendJournal, getLedger, reverseJournal } from '../api/accounting'
import { useLedgerRefresh } from '../lib/refresh'
import { decimal, formatDate, formatMoney } from '../lib/money'
import { useTabHandle } from '../store/tabs'
import { Badge, Button, DataEntryGuide, PageHeader, MoneyInput } from '../components/ui'
import { ListView, type ListColumn } from '../components/ListView'
import { ConfirmDialog, Modal, messageOf, useConfirm } from '../components/Modal'
import { useCan } from '../lib/rbac'
import { signedTotals } from '../lib/journal'

const emptyLine = (): JournalLineInput => ({ account_id: '', description: '', debit: '0', credit: '0' })

const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01`

/**
 * Wewenang yang wajib dimiliki peran untuk membatalkan jurnal. Sama persis
 * dengan yang dijaga router backend (`POST /journals/:id/reverse`), jadi peran
 * tanpa wewenang ini tidak melihat tombolnya sekaligus ditolak servernya.
 */
const REVERSE_PERMISSION = 'accounting.journal.reverse'

/**
 * Hanya jurnal manual dan saldo awal (`MJ-…`) yang boleh dibatalkan dari sini.
 * Jurnal `OP-…` dan `IN-…` lahir dari dokumen atau transaksi kas — membatalkan
 * jurnalnya saja akan membuat dokumen asalnya berbeda dengan buku besar, jadi
 * pembatalannya harus lewat modul asalnya. `RV-…` sendiri adalah pembatalan.
 */
function reversalBlock(journal: PostedJournal): string | false {
  if (journal.number.startsWith('RV-')) return 'Jurnal ini sendiri sudah jurnal pembatalan'
  if (journal.number.startsWith('MJ-')) return false
  return 'Batalkan lewat dokumen atau transaksi asalnya'
}

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
  const canReverse = useCan(REVERSE_PERMISSION)
  const reversal = useConfirm<PostedJournal>()
  /** Jurnal yang sedang diubah; null berarti form membuat jurnal baru. */
  const [editing, setEditing] = useState<PostedJournal | null>(null)

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
    return <JournalForm
      accounts={accounts}
      editing={editing}
      onCancel={() => { setView('list'); setEditing(null) }}
      onSubmit={async (input) => {
        if (editing) await amendJournal(editing.id, input)
        else await onSubmit(input)
        await load()
        setView('list')
        setEditing(null)
      }}
    />
  }

  function startEdit(journal: PostedJournal) {
    setDetail(null)
    setEditing(journal)
    setView('form')
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
        description="Semua jurnal yang sudah diposting — baik dari jurnal manual maupun dari modul lain seperti Kas Masuk, Kas Keluar, dan faktur. Jurnal manual dan saldo awal dapat dihapus lewat menu aksi oleh peran yang berwenang."
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
        rowActions={[
          { label: 'Lihat rincian jurnal', icon: 'journal', readOnly: true, onSelect: setDetail },
          ...(canReverse ? [{
            label: 'Ubah jurnal',
            icon: 'edit' as const,
            onSelect: startEdit,
            when: (journal: PostedJournal) => reversalBlock(journal) === false,
          }, {
            label: 'Hapus jurnal (posting pembatalan)',
            icon: 'trash' as const,
            danger: true,
            onSelect: (journal: PostedJournal) => { setDetail(null); reversal.open(journal) },
            when: (journal: PostedJournal) => reversalBlock(journal) === false,
          }] : []),
        ]}
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

      <JournalDetail
        journal={detail}
        scale={scale}
        onClose={() => setDetail(null)}
        onReverse={canReverse ? (journal) => { setDetail(null); reversal.open(journal) } : undefined}
        onEdit={canReverse ? startEdit : undefined}
      />

      <ConfirmDialog
        open={reversal.target !== null}
        tone="danger"
        title="Hapus jurnal ini?"
        confirmLabel="Hapus jurnal"
        confirmationWord={reversal.target?.number}
        confirmationHint={<>Ketik nomor jurnal <strong>{reversal.target?.number}</strong> untuk konfirmasi</>}
        busy={reversal.busy}
        error={reversal.error}
        onClose={reversal.close}
        onConfirm={() => reversal.run(async (journal) => {
          await reverseJournal(journal.id, {
            date: journal.transaction_date,
            description: `Pembatalan ${journal.number}${journal.description ? ` — ${journal.description}` : ''}`,
          })
          await load()
        })}
        description={<>
          Pengaruh <strong>{reversal.target?.number}</strong> terhadap saldo akun akan dihapus dengan memposting
          jurnal pembatalan <strong>RV-…</strong> senilai {formatMoney(reversal.target?.debit ?? 0, scale)} pada
          tanggal {reversal.target ? formatDate(reversal.target.transaction_date) : ''}. Jurnal aslinya tetap
          tersimpan sebagai jejak audit dan tidak dapat dibatalkan dua kali.
        </>}
      />
    </section>
  )
}

function JournalDetail({ journal, scale, onClose, onReverse, onEdit }: {
  journal: PostedJournal | null
  scale: number
  onClose: () => void
  /** Keduanya tidak diisi untuk peran tanpa wewenang mengubah jurnal. */
  onReverse?: (journal: PostedJournal) => void
  onEdit?: (journal: PostedJournal) => void
}) {
  if (!journal) return null
  const blocked = reversalBlock(journal)
  return (
    <Modal
      open
      size="lg"
      eyebrow="JURNAL UMUM"
      title={journal.number}
      description={`${formatDate(journal.transaction_date)} · sudah diposting ke buku besar`}
      onClose={onClose}
      footer={(onEdit || onReverse) && (blocked !== false ? <p className="modal-note">{blocked}.</p> : (
        <>
          {onEdit && (
            <Button
              type="button"
              variant="secondary"
              icon="edit"
              onClick={() => onEdit(journal)}
            >
              Ubah jurnal
            </Button>
          )}
          {onReverse && (
            <Button
              type="button"
              variant="ghost"
              icon="trash"
              className="text-red-700 hover:text-red-800"
              onClick={() => onReverse(journal)}
            >
              Hapus jurnal
            </Button>
          )}
        </>
      ))}
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

/** Baris buku besar sebuah jurnal dikembalikan ke bentuk isian form. */
function linesOf(journal: PostedJournal): JournalLineInput[] {
  return journal.lines.map((line) => ({
    account_id: line.account_id,
    description: line.description,
    debit: String(decimal(line.debit)),
    credit: String(decimal(line.credit)),
  }))
}

function JournalForm({ accounts, editing, onCancel, onSubmit }: {
  accounts: Account[]
  /** Jurnal yang sedang dikoreksi; null berarti jurnal baru. */
  editing: PostedJournal | null
  onCancel: () => void
  onSubmit: (input: { date: string; description: string; lines: JournalLineInput[] }) => Promise<void>
}) {
  const [date, setDate] = useState(editing?.transaction_date ?? today())
  const [description, setDescription] = useState(editing?.description ?? '')
  const [lines, setLines] = useState<JournalLineInput[]>(editing ? linesOf(editing) : [emptyLine(), emptyLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useTabHandle(description !== '' || lines.some((line) => line.account_id !== ''), editing ? `Ubah ${editing.number}` : 'Jurnal baru')

  function updateLine(index: number, patch: Partial<JournalLineInput>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line))
  }

  // Total dihitung dari baris yang sudah dinormalkan, sehingga nominal minus
  // terlihat pindah sisi persis seperti yang nanti diposting.
  const { debit: debitTotal, credit: creditTotal } = signedTotals(lines)
  const balanced = debitTotal > 0 && debitTotal === creditTotal

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ date, description, lines })
      if (!editing) {
        setDescription('')
        setLines([emptyLine(), emptyLine()])
      }
    } catch (caught) {
      setError(messageOf(caught, 'Jurnal gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <PageHeader
        eyebrow="DOUBLE ENTRY"
        title={editing ? `Ubah jurnal ${editing.number}` : 'Jurnal manual'}
        description={editing
          ? 'Jurnal lama akan dibatalkan dan jurnal penggantinya diposting dalam satu langkah, sehingga saldo akun langsung mengikuti isian di bawah ini.'
          : 'Pastikan debit dan kredit seimbang. Jurnal langsung diposting; perubahan setelahnya dilakukan lewat menu Ubah jurnal.'}
      />
      <DataEntryGuide
        steps={[
          'Pilih tanggal transaksi dan isi keterangan yang menjelaskan tujuan jurnal.',
          'Pilih akun pada setiap baris, lalu isi nominal hanya di kolom Debit atau Kredit.',
          'Saldo minus cukup ditulis dengan tanda minus, misalnya -5000 di kolom Debit. Nilainya otomatis dipindahkan ke kolom Kredit karena pembukuan tidak mengenal nominal negatif.',
          'Pastikan total Debit sama dengan Kredit. Tambahkan baris bila diperlukan, lalu klik “Post jurnal”.',
        ]}
        note={editing
          ? 'Mengubah jurnal tidak menghapus riwayatnya: jurnal asli tetap tersimpan bersama jurnal pembatalannya, dan perubahan ini tercatat di Log Aktivitas.'
          : 'Jurnal langsung diposting; periksa akun dan nominal sebelum menyimpan.'}
      />
      {error && <p className="modal-error" role="alert">{error}</p>}
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
              <MoneyInput aria-label={`Debit baris ${index + 1}`} value={line.debit} onChange={(value) => updateLine(index, { debit: value })} />
              <MoneyInput aria-label={`Kredit baris ${index + 1}`} value={line.credit} onChange={(value) => updateLine(index, { credit: value })} />
              <button className="line-remove" type="button" aria-label={`Hapus baris ${index + 1}`} disabled={lines.length <= 2} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>×</button>
            </div>
          ))}
          </div>
        </div>
        <div className="form-actions"><Button variant="secondary" icon="plus" type="button" onClick={() => setLines((current) => [...current, emptyLine()])}>Tambah baris</Button><div className="journal-balance"><span>Debit<strong>{debitTotal.toLocaleString('id-ID')}</strong></span><span>Kredit<strong>{creditTotal.toLocaleString('id-ID')}</strong></span></div><Button variant="secondary" type="button" onClick={onCancel}>Kembali ke daftar</Button><Button disabled={saving || !description || !balanced} onClick={submit}>{saving ? 'Memposting…' : editing ? 'Simpan perubahan' : 'Post jurnal'}</Button></div>
      </div>
    </section>
  )
}
