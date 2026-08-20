import { type FormEvent, useEffect, useState } from 'react'
import { allocateOpenItem, createContact, createExpense, createOpenItem, getAging, listContacts, listPayables, listReceivables } from '../api/accounting'
import type { Account, AgingReport, Contact, OpenItem } from '../types/accounting'
import { Badge, Button, EmptyState, PageHeader } from '../components/ui'

export function OperationsPage({ accounts, onNotice }: { accounts: Account[]; onNotice: (value: string) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [receivables, setReceivables] = useState<OpenItem[]>([])
  const [payables, setPayables] = useState<OpenItem[]>([])
  const [aging, setAging] = useState<AgingReport | null>(null)
  async function refresh() { const [c, ar, ap, age] = await Promise.all([listContacts(), listReceivables(), listPayables(), getAging(new Date().toISOString().slice(0, 10))]); setContacts(c); setReceivables(ar); setPayables(ap); setAging(age) }
  useEffect(() => { void refresh() }, [])
  async function addContact(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await createContact({ type: String(form.get('type')), name: String(form.get('name')) }); event.currentTarget.reset(); await refresh(); onNotice('Kontak berhasil dibuat.') }
  async function addExpense(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await createExpense({ transaction_date: String(form.get('date')), description: String(form.get('description')), amount: String(form.get('amount')), payment_method: 'CASH', expense_account_id: String(form.get('account')) }); event.currentTarget.reset(); onNotice('Beban dan jurnal berhasil diposting.') }
  async function addOpenItem(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const kind = String(form.get('kind')) as 'receivables' | 'payables'; await createOpenItem(kind, { contact_id: String(form.get('contact_id')), issue_date: String(form.get('issue_date')), due_date: String(form.get('due_date')), description: String(form.get('description')), amount: String(form.get('amount')), counter_account_id: String(form.get('counter_account_id')) }); event.currentTarget.reset(); await refresh(); onNotice(`${kind === 'receivables' ? 'Piutang' : 'Utang'} dan jurnal berhasil dibuat.`) }
  const [settling, setSettling] = useState<{ kind: 'receivables' | 'payables'; item: OpenItem } | null>(null)
  async function settle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settling) return
    const form = new FormData(event.currentTarget)
    const foreign = Boolean(settling.item.currency_code)
    try {
      await allocateOpenItem(settling.kind, settling.item.id, {
        transaction_date: String(form.get('transaction_date')),
        amount: String(form.get('amount')),
        payment_method: String(form.get('payment_method')),
        description: String(form.get('description') || `Pembayaran ${settling.item.number}`),
        ...(foreign ? {
          exchange_rate_numerator: Number(form.get('exchange_rate_numerator')),
          exchange_rate_denominator: Number(form.get('exchange_rate_denominator')),
          fx_gain_loss_account_id: String(form.get('fx_gain_loss_account_id')),
        } : {}),
      })
      setSettling(null)
      await refresh()
      onNotice('Pembayaran berhasil dialokasikan dan diposting.')
    } catch (error) {
      const response = (error as { response?: { data?: { error?: { details?: string } } } }).response
      onNotice(response?.data?.error?.details ?? 'Pembayaran gagal diposting.')
    }
  }
  const fxAccounts = accounts.filter((a) => ['OTHER_INCOME', 'OTHER_EXPENSE', 'REVENUE', 'EXPENSE'].includes(a.type))
  return <section><PageHeader eyebrow="OPERATIONAL ACCOUNTING" title="Piutang, utang, dan beban" description="Workflow bisnis membentuk jurnal double-entry dalam satu transaksi database." />
    <div className="summary-grid"><article className="panel summary-card"><span>Kontak aktif</span><strong>{contacts.filter((item) => item.is_active).length}</strong></article><article className="panel summary-card"><span>Piutang terbuka</span><strong>{receivables.filter((item) => item.status !== 'PAID').length}</strong></article><article className="panel summary-card"><span>Utang terbuka</span><strong>{payables.filter((item) => item.status !== 'PAID').length}</strong></article></div>
    <div className="split-grid"><form className="panel form-panel" onSubmit={(e) => void addContact(e)}><h2>Kontak baru</h2><label>Nama<input name="name" required /></label><label>Tipe<select name="type"><option>CUSTOMER</option><option>SUPPLIER</option><option>BOTH</option></select></label><Button>Simpan kontak</Button></form>
      <form className="panel form-panel" onSubmit={(e) => void addExpense(e)}><h2>Catat beban tunai</h2><label>Tanggal<input name="date" type="date" required /></label><label>Deskripsi<input name="description" required /></label><label>Nominal<input name="amount" inputMode="numeric" required /></label><label>Akun beban<select name="account" required>{accounts.filter((a) => a.type === 'EXPENSE' || a.type === 'OTHER_EXPENSE').map((a) => <option value={a.id} key={a.id}>{a.code} · {a.name}</option>)}</select></label><Button>Posting beban</Button></form></div>
    <form className="panel form-panel wide-form" onSubmit={(e) => void addOpenItem(e)}><div className="section-title"><div><span className="section-icon">AR</span><h2>Piutang atau utang baru</h2></div><Badge tone="info">Jurnal otomatis</Badge></div><div className="form-row"><label>Jenis<select name="kind"><option value="receivables">Piutang pelanggan</option><option value="payables">Utang supplier</option></select></label><label>Kontak<select name="contact_id" required><option value="">Pilih kontak</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.type}</option>)}</select></label><label>Tanggal<input type="date" name="issue_date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><label>Jatuh tempo<input type="date" name="due_date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label></div><div className="form-row"><label>Deskripsi<input name="description" required /></label><label>Nominal<input name="amount" required /></label><label>Akun lawan<select name="counter_account_id" required><option value="">Pilih akun</option>{accounts.filter((a) => ['REVENUE','ASSET','EXPENSE','COGS'].includes(a.type)).map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label></div><Button>Buat open item</Button></form>
    {aging && <div className="panel aging-grid"><div><span>Belum jatuh tempo</span><strong>{(aging.receivables.current_minor + aging.payables.current_minor).toLocaleString('id-ID')}</strong></div><div><span>1–30 hari</span><strong>{(aging.receivables.days_1_30_minor + aging.payables.days_1_30_minor).toLocaleString('id-ID')}</strong></div><div><span>31–60 hari</span><strong>{(aging.receivables.days_31_60_minor + aging.payables.days_31_60_minor).toLocaleString('id-ID')}</strong></div><div><span>61–90 hari</span><strong>{(aging.receivables.days_61_90_minor + aging.payables.days_61_90_minor).toLocaleString('id-ID')}</strong></div><div><span>&gt; 90 hari</span><strong>{(aging.receivables.over_90_minor + aging.payables.over_90_minor).toLocaleString('id-ID')}</strong></div></div>}
    <div className="split-grid records-grid"><div className="panel"><div className="panel-heading"><div><h2>Kontak terbaru</h2><p>Customer dan supplier dalam satu master data.</p></div><Badge>{contacts.length} kontak</Badge></div>{contacts.length === 0 ? <EmptyState>Belum ada kontak.</EmptyState> : <div className="table-wrap"><table><thead><tr><th>Nama</th><th>Tipe</th><th>Status</th></tr></thead><tbody>{contacts.slice(0, 8).map((contact) => <tr key={contact.id}><td><strong>{contact.name}</strong></td><td><span className="type-tag">{contact.type}</span></td><td><span className={contact.is_active ? 'status active' : 'status'}>{contact.is_active ? 'Aktif' : 'Nonaktif'}</span></td></tr>)}</tbody></table></div>}</div>
      <div className="panel"><div className="panel-heading"><div><h2>Open items</h2><p>Dokumen piutang dan utang yang belum lunas.</p></div><Badge tone="warning">{receivables.length + payables.length} item</Badge></div>{receivables.length + payables.length === 0 ? <EmptyState>Belum ada piutang atau utang.</EmptyState> : <div className="table-wrap"><table><thead><tr><th>Nomor</th><th>Jenis</th><th>Status</th><th /></tr></thead><tbody>{receivables.slice(0, 4).map((item) => <tr key={item.id}><td className="mono">{item.number}{item.currency_code && <small className="block text-slate-400">{item.currency_code} {item.foreign_outstanding_minor?.toLocaleString('id-ID')}</small>}</td><td>Piutang</td><td><span className="status">{item.status}</span></td><td>{item.status !== 'PAID' && <Button variant="ghost" onClick={() => setSettling({ kind: 'receivables', item })}>Bayar</Button>}</td></tr>)}{payables.slice(0, 4).map((item) => <tr key={item.id}><td className="mono">{item.number}{item.currency_code && <small className="block text-slate-400">{item.currency_code} {item.foreign_outstanding_minor?.toLocaleString('id-ID')}</small>}</td><td>Utang</td><td><span className="status">{item.status}</span></td><td>{item.status !== 'PAID' && <Button variant="ghost" onClick={() => setSettling({ kind: 'payables', item })}>Bayar</Button>}</td></tr>)}</tbody></table></div>}</div></div>
    {settling && (
      <div className="panel form-panel mt-4.5">
        <h2>Pembayaran {settling.item.number}</h2>
        <form onSubmit={(e) => void settle(e)}>
          <div className="form-row">
            <label>Tanggal<input type="date" name="transaction_date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
            <label>Nominal{settling.item.currency_code ? ` (${settling.item.currency_code})` : ''}
              <input name="amount" inputMode="numeric" required
                defaultValue={settling.item.currency_code ? String(settling.item.foreign_outstanding_minor ?? '') : String(settling.item.outstanding_minor)} />
            </label>
            <label>Diterima di<select name="payment_method"><option value="CASH">Kas</option><option value="BANK">Bank</option><option value="QRIS">QRIS</option><option value="TRANSFER">Transfer</option></select></label>
          </div>
          {settling.item.currency_code && (
            <>
              <div className="callout"><strong>Kurs faktur</strong><span>{settling.item.exchange_rate_numerator} / {settling.item.exchange_rate_denominator}. Selisih terhadap kurs pembayaran diakui sebagai laba atau rugi selisih kurs.</span></div>
              <div className="form-row">
                <label>Kurs pembayaran<input name="exchange_rate_numerator" type="number" min={1} defaultValue={settling.item.exchange_rate_numerator ?? 1} required /></label>
                <label>Per<input name="exchange_rate_denominator" type="number" min={1} defaultValue={settling.item.exchange_rate_denominator ?? 1} required /></label>
                <label>Akun selisih kurs<select name="fx_gain_loss_account_id" required>{fxAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
              </div>
            </>
          )}
          <label>Keterangan<input name="description" placeholder={`Pembayaran ${settling.item.number}`} /></label>
          <div className="flex gap-2"><Button>Posting pembayaran</Button><Button type="button" variant="ghost" onClick={() => setSettling(null)}>Batal</Button></div>
        </form>
      </div>
    )}
  </section>
}
