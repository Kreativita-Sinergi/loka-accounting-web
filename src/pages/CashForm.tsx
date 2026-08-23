import { useState } from 'react'
import { ActionRail, DocumentShell, IconTabs, LookupField, type IconTab } from '../components/FormShell'
import { messageOf } from '../components/Modal'
import { Icon } from '../components/Icon'
import { decimal, formatMoney } from '../lib/money'
import { useTabHandle } from '../store/tabs'
import type { Account, Contact } from '../types/accounting'
import type { CashTransaction } from '../types/operations'
import type { CashTransactionInput } from '../api/operations'

type Line = { id: string; account_id: string; description: string; amount: string }

const emptyLine = (): Line => ({ id: Math.random().toString(36).slice(2, 10), account_id: '', description: '', amount: '0' })
const today = () => new Date().toISOString().slice(0, 10)

const titles = { RECEIPT: 'Kas Masuk', PAYMENT: 'Kas Keluar', TRANSFER: 'Transfer Kas & Bank' } as const

/**
 * Form Kas Masuk / Kas Keluar / Transfer Kas & Bank mengikuti pola FORM
 * TRANSAKSI (§4.3): header, ikon tab vertikal, grid rincian, dan rail aksi.
 */
export function CashForm({ kind, scale, cashAccounts, accounts, contacts, onCancel, onSave, onSaved, onNotice }: {
  kind: 'RECEIPT' | 'PAYMENT' | 'TRANSFER'
  scale: number
  cashAccounts: Account[]
  accounts: Account[]
  contacts: Contact[]
  onCancel: () => void
  onSave: (input: CashTransactionInput) => Promise<CashTransaction>
  onSaved: (saved: CashTransaction, again: boolean) => void
  onNotice: (message: string) => void
}) {
  const [panel, setPanel] = useState('lines')
  const [accountId, setAccountId] = useState(cashAccounts[0]?.id ?? '')
  const [destinationId, setDestinationId] = useState('')
  const [contactId, setContactId] = useState('')
  const [transactionDate, setTransactionDate] = useState(today())
  const [memo, setMemo] = useState('')
  const [amount, setAmount] = useState('0')
  const [fee, setFee] = useState('0')
  const [feeAccountId, setFeeAccountId] = useState('')
  const [lines, setLines] = useState<Line[]>([emptyLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState<CashTransaction | null>(null)

  useTabHandle(dirty, saved ? saved.number : 'Data Baru')

  const isTransfer = kind === 'TRANSFER'
  const total = isTransfer ? decimal(amount) : lines.reduce((sum, line) => sum + decimal(line.amount), 0)
  const counterAccounts = accounts.filter((account) => account.id !== accountId)
  const expenseAccounts = accounts.filter((account) => ['EXPENSE', 'OTHER_EXPENSE', 'COGS'].includes(account.type))

  function touch<T>(setter: (value: T) => void) {
    return (value: T) => { setDirty(true); setter(value) }
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setDirty(true)
    setLines((current) => current.map((line, position) => position === index ? { ...line, ...patch } : line))
  }

  async function save(again: boolean) {
    if (!accountId) { setError('Akun kas/bank wajib dipilih.'); return }
    if (isTransfer && !destinationId) { setError('Rekening tujuan wajib dipilih.'); return }
    const filled = lines.filter((line) => line.account_id && decimal(line.amount) > 0)
    if (!isTransfer && filled.length === 0) { setError('Rincian wajib diisi minimal satu baris dengan akun dan jumlah.'); setPanel('lines'); return }
    if (isTransfer && decimal(fee) > 0 && !feeAccountId) { setError('Akun biaya wajib dipilih ketika ada biaya transfer.'); setPanel('info'); return }

    setSaving(true)
    setError(null)
    try {
      const created = await onSave({
        kind,
        transaction_date: transactionDate,
        account_id: accountId,
        destination_account_id: isTransfer ? destinationId : null,
        contact_id: contactId || null,
        fee_account_id: isTransfer && decimal(fee) > 0 ? feeAccountId : null,
        fee: isTransfer ? fee : '0',
        amount: isTransfer ? amount : undefined,
        memo,
        lines: isTransfer ? undefined : filled.map((line) => ({ account_id: line.account_id, description: line.description, amount: line.amount })),
      })
      setDirty(false)
      setSaved(created)
      onSaved(created, again)
      if (again) {
        setSaved(null)
        setLines([emptyLine()])
        setMemo('')
        setAmount('0')
      }
    } catch (cause) {
      setError(messageOf(cause, 'Transaksi kas gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const panels: IconTab[] = [
    { key: 'lines', label: isTransfer ? 'Nilai Transfer' : 'Rincian', icon: 'journal' },
    { key: 'info', label: 'Info', icon: 'empty' },
  ]

  return (
    <DocumentShell
      label={saved?.number ?? 'Data Baru'}
      dirty={dirty}
      onBack={onCancel}
      rail={<ActionRail actions={[
        {
          icon: 'check', label: 'Simpan', primary: true, items: [
            { label: 'Simpan', onSelect: () => void save(false), disabled: (saving && 'Sedang menyimpan…') || (Boolean(saved) && 'Transaksi ini sudah tersimpan') },
            { label: 'Simpan & Baru', onSelect: () => void save(true), disabled: (saving && 'Sedang menyimpan…') || (Boolean(saved) && 'Transaksi ini sudah tersimpan') },
          ],
        },
        {
          icon: 'more', label: 'Lainnya', items: [
            { label: 'Kosongkan rincian', onSelect: () => { setLines([emptyLine()]); setDirty(true) }, disabled: isTransfer && 'Transfer tidak memakai rincian baris' },
            { label: 'Lihat Jurnal', onSelect: () => onNotice(saved ? `Jurnal ${saved.number} sudah diposting; buka Buku Besar untuk rinciannya.` : ''), disabled: !saved && 'Tersedia setelah transaksi tersimpan' },
          ],
        },
      ]} />}
    >
      {error && <p className="modal-error">{error}</p>}

      <div className="doc-header">
        <div className="doc-header-row">
          <label className="doc-field">{isTransfer ? 'Dari rekening' : 'Akun Kas/Bank'} <b>*</b>
            <select value={accountId} onChange={(event) => touch(setAccountId)(event.target.value)}>
              <option value="">Pilih akun kas/bank</option>
              {cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
            </select>
          </label>
          <label className="doc-field">Tanggal <b>*</b><input type="date" value={transactionDate} onChange={(event) => touch(setTransactionDate)(event.target.value)} /></label>
        </div>
        <div className="doc-header-row">
          {isTransfer ? (
            <label className="doc-field">Ke rekening <b>*</b>
              <select value={destinationId} onChange={(event) => touch(setDestinationId)(event.target.value)}>
                <option value="">Pilih rekening tujuan</option>
                {cashAccounts.filter((account) => account.id !== accountId).map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
              </select>
            </label>
          ) : (
            <LookupField
              label={kind === 'RECEIPT' ? 'Diterima dari' : 'Dibayar kepada'}
              value={contactId}
              options={contacts.map((contact) => ({ value: contact.id, label: contact.name }))}
              onChange={touch(setContactId)}
              placeholder="Cari/Pilih kontak…"
            />
          )}
          <label className="doc-field">Nomor <b>*</b>
            <span className="flex items-center gap-1.5">
              <button type="button" className="tool-icon" title="Nomor otomatis" disabled>A</button>
              <input value={saved?.number ?? `Otomatis (${kind === 'RECEIPT' ? 'KM' : kind === 'PAYMENT' ? 'KK' : 'TKB'})`} disabled />
            </span>
          </label>
        </div>
      </div>

      <div className="doc-panels">
        <IconTabs tabs={panels} active={panel} onChange={setPanel} />
        <div className="doc-panel">
          {panel === 'lines' && (isTransfer ? (
            <div className="doc-grid">
              <label className="doc-field">Nilai transfer <b>*</b><input value={amount} inputMode="decimal" onChange={(event) => touch(setAmount)(event.target.value)} /></label>
              <label className="doc-field">Biaya transfer<input value={fee} inputMode="decimal" onChange={(event) => touch(setFee)(event.target.value)} /></label>
              {decimal(fee) > 0 && (
                <label className="doc-field">Akun biaya <b>*</b>
                  <select value={feeAccountId} onChange={(event) => touch(setFeeAccountId)(event.target.value)}>
                    <option value="">Pilih akun beban</option>
                    {expenseAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
                  </select>
                </label>
              )}
              <p className="modal-note sm:col-span-2">
                Rekening asal dikredit sebesar nilai transfer ditambah biaya, rekening tujuan didebit sebesar nilai transfer,
                dan biaya masuk ke akun beban yang dipilih.
              </p>
            </div>
          ) : (
            <div className="line-grid">
              <div className="line-picker">
                <Icon name="search" />
                <select value="" onChange={(event) => { if (event.target.value) { setDirty(true); setLines((current) => [...current, { ...emptyLine(), account_id: event.target.value }]) } }}>
                  <option value="">Cari/Pilih akun lawan…</option>
                  {counterAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
                </select>
                <button type="button" onClick={() => { setDirty(true); setLines((current) => [...current, emptyLine()]) }}><Icon name="plus" /> Baris</button>
                <strong>Rincian <b>*</b></strong>
              </div>
              <div className="table-wrap">
                <table className="line-table">
                  <thead>
                    <tr>
                      <th>Akun</th>
                      <th>Keterangan</th>
                      <th className="number" style={{ width: '160px' }}>Jumlah</th>
                      <th style={{ width: '34px' }}><span className="sr-only">Hapus</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={line.id}>
                        <td>
                          <select value={line.account_id} onChange={(event) => updateLine(index, { account_id: event.target.value })}>
                            <option value="">Pilih akun</option>
                            {counterAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
                          </select>
                        </td>
                        <td><input value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} placeholder="Keterangan baris" /></td>
                        <td><input className="number" value={line.amount} inputMode="decimal" onChange={(event) => updateLine(index, { amount: event.target.value })} /></td>
                        <td>
                          <button type="button" className="line-remove" onClick={() => { setDirty(true); setLines((current) => current.filter((_, position) => position !== index)) }} disabled={lines.length === 1} aria-label="Hapus baris">
                            <Icon name="close" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="line-hint">Akun kas/bank di atas menjadi lawan otomatis dari seluruh baris ini.</p>
            </div>
          ))}
          {panel === 'info' && (
            <div className="doc-grid">
              <label className="doc-field sm:col-span-2">Keterangan<input value={memo} onChange={(event) => touch(setMemo)(event.target.value)} placeholder="Catatan transaksi" /></label>
              {isTransfer && (
                <LookupField label="Kontak terkait" value={contactId} options={contacts.map((contact) => ({ value: contact.id, label: contact.name }))} onChange={touch(setContactId)} placeholder="Cari/Pilih kontak…" />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="totals-footer">
        {isTransfer && decimal(fee) > 0 && <div className="totals-row"><span>Biaya transfer</span><span>{formatMoney(decimal(fee), scale)}</span></div>}
        <div className="totals-row is-total">
          <span>{titles[kind]}</span>
          <span>Rp {formatMoney(total, scale)}</span>
        </div>
      </div>
    </DocumentShell>
  )
}
