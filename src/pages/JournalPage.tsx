import { useState } from 'react'
import type { Account, JournalLineInput } from '../types/accounting'
import { Button, PageHeader } from '../components/ui'

const emptyLine = (): JournalLineInput => ({ account_id: '', description: '', debit: '0', credit: '0' })

export function JournalPage({ accounts, onSubmit }: { accounts: Account[]; onSubmit: (input: { date: string; description: string; lines: JournalLineInput[] }) => Promise<void> }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<JournalLineInput[]>([emptyLine(), emptyLine()])
  const [saving, setSaving] = useState(false)

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
        <div className="form-actions"><Button variant="secondary" icon="plus" type="button" onClick={() => setLines((current) => [...current, emptyLine()])}>Tambah baris</Button><div className="journal-balance"><span>Debit<strong>{debitTotal.toLocaleString('id-ID')}</strong></span><span>Kredit<strong>{creditTotal.toLocaleString('id-ID')}</strong></span></div><Button disabled={saving || !description || !balanced} onClick={submit}>{saving ? 'Memposting…' : 'Post jurnal'}</Button></div>
      </div>
    </section>
  )
}
