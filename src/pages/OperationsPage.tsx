import { useEffect, useMemo, useState } from 'react'
import {
  allocateOpenItem, createContact, createExpense, createOpenItem, deleteContact,
  getAging, listContacts, listPayables, listReceivables, setContactActive, updateContact,
} from '../api/accounting'
import type { Account, AgingReport, Contact, OpenItem } from '../types/accounting'
import { Badge, Button, DataEntryGuide, PageHeader } from '../components/ui'
import { AddButton, DataTable, SearchInput, StatusPill, TablePanel, type Column } from '../components/DataTable'
import { ConfirmDialog, FormModal, messageOf, useConfirm } from '../components/Modal'

type OpenItemRow = OpenItem & { kind: 'receivables' | 'payables' }

const today = () => new Date().toISOString().slice(0, 10)
const rupiah = (value: number) => value.toLocaleString('id-ID')

export function OperationsPage({ accounts, onNotice }: { accounts: Account[]; onNotice: (value: string) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [receivables, setReceivables] = useState<OpenItem[]>([])
  const [payables, setPayables] = useState<OpenItem[]>([])
  const [aging, setAging] = useState<AgingReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openItemFilter, setOpenItemFilter] = useState<'all' | 'receivables' | 'payables' | 'open'>('open')

  const [contactEditor, setContactEditor] = useState<{ contact: Contact | null } | null>(null)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [openItemOpen, setOpenItemOpen] = useState(false)
  const [settling, setSettling] = useState<OpenItemRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const contactStatus = useConfirm<Contact>()
  const contactRemoval = useConfirm<Contact>()

  async function refresh() {
    const [contactRows, receivableRows, payableRows, agingReport] = await Promise.all([
      listContacts(), listReceivables(), listPayables(), getAging(today()),
    ])
    setContacts(contactRows); setReceivables(receivableRows); setPayables(payableRows); setAging(agingReport)
    setLoading(false)
  }
  useEffect(() => { void refresh() }, [])

  /** save funnels every modal submit through one busy, error, and refresh path. */
  async function save(action: () => Promise<unknown>, success: string, done: () => void) {
    setSaving(true)
    setFormError(null)
    try {
      await action()
      await refresh()
      done()
      onNotice(success)
    } catch (error) {
      setFormError(messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  const editingContact = contactEditor?.contact ?? null
  const expenseAccounts = accounts.filter((account) => account.type === 'EXPENSE' || account.type === 'OTHER_EXPENSE')
  const counterAccounts = accounts.filter((account) => ['REVENUE', 'ASSET', 'EXPENSE', 'COGS'].includes(account.type))
  const fxAccounts = accounts.filter((account) => ['OTHER_INCOME', 'OTHER_EXPENSE', 'REVENUE', 'EXPENSE'].includes(account.type))
  const activeContacts = contacts.filter((contact) => contact.is_active)
  const contactName = (id: string) => contacts.find((contact) => contact.id === id)?.name ?? '—'

  const openItems = useMemo<OpenItemRow[]>(() => {
    const rows: OpenItemRow[] = [
      ...receivables.map((item) => ({ ...item, kind: 'receivables' as const })),
      ...payables.map((item) => ({ ...item, kind: 'payables' as const })),
    ]
    const filtered = openItemFilter === 'all' ? rows
      : openItemFilter === 'open' ? rows.filter((row) => row.status !== 'PAID')
      : rows.filter((row) => row.kind === openItemFilter)
    return filtered.sort((left, right) => right.issue_date.localeCompare(left.issue_date))
  }, [receivables, payables, openItemFilter])

  const visibleContacts = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return contacts
    return contacts.filter((contact) => `${contact.name} ${contact.type} ${contact.email ?? ''} ${contact.phone ?? ''}`.toLowerCase().includes(needle))
  }, [contacts, search])

  const contactColumns: Array<Column<Contact>> = [
    { header: 'Nama', cell: (contact) => <><strong>{contact.name}</strong>{contact.tax_identifier && <small className="block mono">NPWP {contact.tax_identifier}</small>}</> },
    { header: 'Tipe', cell: (contact) => <span className="type-tag">{contact.type}</span> },
    { header: 'Kontak', cell: (contact) => <>{contact.email ?? '—'}<small className="block">{contact.phone ?? 'Telepon belum diisi'}</small></> },
    { header: 'Status', cell: (contact) => <StatusPill active={contact.is_active} /> },
  ]

  const openItemColumns: Array<Column<OpenItemRow>> = [
    { header: 'Nomor', className: 'mono', cell: (row) => <>{row.number}{row.currency_code && <small className="block">{row.currency_code} {rupiah(row.foreign_outstanding_minor ?? 0)}</small>}</> },
    { header: 'Jenis', cell: (row) => <Badge tone={row.kind === 'receivables' ? 'info' : 'warning'}>{row.kind === 'receivables' ? 'Piutang' : 'Utang'}</Badge> },
    { header: 'Kontak', cell: (row) => contactName(row.contact_id) },
    { header: 'Deskripsi', cell: (row) => <>{row.description}<small className="block">Terbit {row.issue_date.slice(0, 10)}{row.due_date && ` · jatuh tempo ${row.due_date.slice(0, 10)}`}</small></> },
    { header: 'Nilai', align: 'right', className: 'mono', cell: (row) => rupiah(row.original_minor) },
    { header: 'Sisa', align: 'right', className: 'mono', cell: (row) => rupiah(row.outstanding_minor) },
    { header: 'Status', cell: (row) => <Badge tone={row.status === 'PAID' ? 'success' : row.status === 'PARTIAL' ? 'warning' : 'neutral'}>{row.status}</Badge> },
  ]

  return (
    <section>
      <PageHeader
        eyebrow="OPERATIONAL ACCOUNTING"
        title="Piutang, utang, dan beban"
        description="Workflow bisnis membentuk jurnal double-entry dalam satu transaksi database."
        action={<div className="page-actions">
          <Button variant="secondary" icon="plus" onClick={() => { setContactEditor({ contact: null }); setFormError(null) }}>Kontak</Button>
          <Button variant="secondary" icon="plus" onClick={() => { setExpenseOpen(true); setFormError(null) }} disabled={expenseAccounts.length === 0}>Beban tunai</Button>
          <AddButton onClick={() => { setOpenItemOpen(true); setFormError(null) }} disabled={activeContacts.length === 0 || counterAccounts.length === 0} title={activeContacts.length === 0 ? 'Buat kontak lebih dulu' : undefined}>Piutang / utang</AddButton>
        </div>}
      />
      <DataEntryGuide
        steps={[
          'Buat kontak pelanggan atau supplier terlebih dahulu agar dapat dipilih pada transaksi.',
          'Untuk pengeluaran langsung, klik “Beban tunai” lalu isi tanggal, deskripsi, nominal, dan akun beban.',
          'Untuk transaksi belum lunas, klik “Piutang / utang” dan lengkapi kontak, tanggal, nominal, serta akun lawan.',
          'Saat pembayaran terjadi, buka menu aksi (titik tiga) pada baris open item lalu pilih “Catat pembayaran”.',
        ]}
        note="Pembuatan beban, piutang, utang, dan pembayaran akan membentuk jurnal secara otomatis."
      />

      <div className="summary-grid">
        <article className="panel summary-card"><span>Kontak aktif</span><strong>{activeContacts.length}</strong></article>
        <article className="panel summary-card"><span>Piutang terbuka</span><strong>{receivables.filter((item) => item.status !== 'PAID').length}</strong></article>
        <article className="panel summary-card"><span>Utang terbuka</span><strong>{payables.filter((item) => item.status !== 'PAID').length}</strong></article>
      </div>

      {aging && (
        <div className="panel aging-grid">
          <div><span>Belum jatuh tempo</span><strong>{rupiah(aging.receivables.current_minor + aging.payables.current_minor)}</strong></div>
          <div><span>1–30 hari</span><strong>{rupiah(aging.receivables.days_1_30_minor + aging.payables.days_1_30_minor)}</strong></div>
          <div><span>31–60 hari</span><strong>{rupiah(aging.receivables.days_31_60_minor + aging.payables.days_31_60_minor)}</strong></div>
          <div><span>61–90 hari</span><strong>{rupiah(aging.receivables.days_61_90_minor + aging.payables.days_61_90_minor)}</strong></div>
          <div><span>&gt; 90 hari</span><strong>{rupiah(aging.receivables.over_90_minor + aging.payables.over_90_minor)}</strong></div>
        </div>
      )}

      <TablePanel
        title="Piutang dan utang"
        description="Open item beserta sisa tagihan yang belum dialokasikan."
        badge={`${openItems.length} item`}
        badgeTone="info"
        className="!mt-0"
        action={<AddButton onClick={() => { setOpenItemOpen(true); setFormError(null) }} disabled={activeContacts.length === 0 || counterAccounts.length === 0}>Open item baru</AddButton>}
        toolbar={
          <div className="tabs !mb-0">
            {([['open', 'Belum lunas'], ['receivables', 'Piutang'], ['payables', 'Utang'], ['all', 'Semua']] as const).map(([value, label]) => (
              <button key={value} type="button" className={openItemFilter === value ? 'active' : undefined} onClick={() => setOpenItemFilter(value)}>{label}</button>
            ))}
          </div>
        }
      >
        <DataTable
          columns={openItemColumns}
          rows={openItems}
          keyOf={(row) => `${row.kind}-${row.id}`}
          loading={loading}
          empty="Belum ada piutang atau utang pada filter ini."
          rowActions={[
            {
              label: 'Catat pembayaran',
              icon: 'check',
              onSelect: (row) => { setSettling(row); setFormError(null) },
              disabled: (row) => row.status === 'PAID' && 'Open item sudah lunas',
            },
          ]}
        />
      </TablePanel>

      <TablePanel
        title="Kontak"
        description="Pelanggan dan supplier dalam satu master data."
        badge={`${visibleContacts.length} dari ${contacts.length}`}
        action={<Button variant="secondary" icon="plus" onClick={() => { setContactEditor({ contact: null }); setFormError(null) }}>Kontak baru</Button>}
        toolbar={<SearchInput value={search} onChange={setSearch} placeholder="Cari nama, email, atau telepon kontak…" />}
      >
        <DataTable
          columns={contactColumns}
          rows={visibleContacts}
          keyOf={(contact) => contact.id}
          loading={loading}
          empty={contacts.length === 0 ? 'Belum ada kontak.' : 'Tidak ada kontak yang cocok dengan pencarian.'}
          rowActions={[
            { label: 'Ubah', icon: 'edit', onSelect: (contact) => { setContactEditor({ contact }); setFormError(null) } },
            { label: (contact) => contact.is_active ? 'Nonaktifkan' : 'Aktifkan', icon: 'power', onSelect: contactStatus.open },
            { label: 'Hapus permanen', icon: 'trash', danger: true, onSelect: contactRemoval.open, disabled: (contact) => contact.is_active && 'Nonaktifkan kontak lebih dulu' },
          ]}
        />
      </TablePanel>

      {/* ---- Contact modal ---- */}
      <FormModal
        open={contactEditor !== null}
        formKey={editingContact?.id ?? 'new-contact'}
        eyebrow="KONTAK"
        title={editingContact ? `Ubah kontak ${editingContact.name}` : 'Kontak baru'}
        description="Kontak dipakai pada piutang, utang, serta dokumen penjualan dan pembelian."
        submitLabel={editingContact ? 'Simpan perubahan' : 'Simpan kontak'}
        busy={saving}
        error={formError}
        onClose={() => setContactEditor(null)}
        onSubmit={(values) => save(
          () => {
            const input = {
              type: String(values.get('type')),
              name: String(values.get('name')),
              email: String(values.get('email') || '') || null,
              phone: String(values.get('phone') || '') || null,
              tax_identifier: String(values.get('tax_identifier') || '') || null,
            }
            return editingContact ? updateContact(editingContact.id, input) : createContact(input)
          },
          editingContact ? 'Kontak berhasil diperbarui.' : 'Kontak berhasil dibuat.',
          () => setContactEditor(null),
        )}
      >
        <div className="form-row">
          <label>Nama<input name="name" defaultValue={editingContact?.name} required /></label>
          <label>Tipe
            <select name="type" defaultValue={editingContact?.type ?? 'CUSTOMER'}>
              <option value="CUSTOMER">Pelanggan</option><option value="SUPPLIER">Supplier</option><option value="BOTH">Keduanya</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>Email<input type="email" name="email" defaultValue={editingContact?.email ?? ''} /></label>
          <label>Telepon<input name="phone" defaultValue={editingContact?.phone ?? ''} /></label>
          <label>NPWP<input name="tax_identifier" defaultValue={editingContact?.tax_identifier ?? ''} /></label>
        </div>
      </FormModal>

      {/* ---- Expense modal ---- */}
      <FormModal
        open={expenseOpen}
        formKey="expense"
        size="sm"
        eyebrow="BEBAN TUNAI"
        title="Catat beban tunai"
        description="Beban langsung diposting sebagai jurnal kas keluar."
        submitLabel="Posting beban"
        busy={saving}
        error={formError}
        onClose={() => setExpenseOpen(false)}
        onSubmit={(values) => save(
          () => createExpense({
            transaction_date: String(values.get('date')),
            description: String(values.get('description')),
            amount: String(values.get('amount')),
            payment_method: 'CASH',
            expense_account_id: String(values.get('account')),
          }),
          'Beban dan jurnal berhasil diposting.',
          () => setExpenseOpen(false),
        )}
      >
        <div className="form-row">
          <label>Tanggal<input name="date" type="date" defaultValue={today()} required /></label>
          <label>Nominal<input name="amount" inputMode="numeric" required /></label>
        </div>
        <label>Deskripsi<input name="description" required /></label>
        <label>Akun beban
          <select name="account" required>{expenseAccounts.map((account) => <option value={account.id} key={account.id}>{account.code} · {account.name}</option>)}</select>
        </label>
      </FormModal>

      {/* ---- Open item modal ---- */}
      <FormModal
        open={openItemOpen}
        formKey="open-item"
        eyebrow="OPEN ITEM"
        title="Piutang atau utang baru"
        description="Jurnal terbentuk otomatis dari akun lawan yang dipilih."
        submitLabel="Buat open item"
        busy={saving}
        error={formError}
        onClose={() => setOpenItemOpen(false)}
        onSubmit={(values) => {
          const kind = String(values.get('kind')) as 'receivables' | 'payables'
          return save(
            () => createOpenItem(kind, {
              contact_id: String(values.get('contact_id')),
              issue_date: String(values.get('issue_date')),
              due_date: String(values.get('due_date')),
              description: String(values.get('description')),
              amount: String(values.get('amount')),
              counter_account_id: String(values.get('counter_account_id')),
            }),
            `${kind === 'receivables' ? 'Piutang' : 'Utang'} dan jurnal berhasil dibuat.`,
            () => setOpenItemOpen(false),
          )
        }}
      >
        <div className="form-row">
          <label>Jenis<select name="kind"><option value="receivables">Piutang pelanggan</option><option value="payables">Utang supplier</option></select></label>
          <label>Kontak
            <select name="contact_id" required>
              <option value="">Pilih kontak</option>
              {activeContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} · {contact.type}</option>)}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>Tanggal terbit<input type="date" name="issue_date" defaultValue={today()} required /></label>
          <label>Jatuh tempo<input type="date" name="due_date" defaultValue={today()} required /></label>
          <label>Nominal<input name="amount" inputMode="numeric" required /></label>
        </div>
        <label>Deskripsi<input name="description" required /></label>
        <label>Akun lawan
          <select name="counter_account_id" required>
            <option value="">Pilih akun</option>
            {counterAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
          </select>
        </label>
      </FormModal>

      {/* ---- Settlement modal ---- */}
      <FormModal
        open={settling !== null}
        formKey={settling?.id ?? 'settle'}
        eyebrow={settling?.kind === 'payables' ? 'PEMBAYARAN UTANG' : 'PENERIMAAN PIUTANG'}
        title={`Pembayaran ${settling?.number ?? ''}`}
        description={settling ? `Sisa tagihan ${rupiah(settling.outstanding_minor)}${settling.currency_code ? ` · ${settling.currency_code} ${rupiah(settling.foreign_outstanding_minor ?? 0)}` : ''}` : undefined}
        submitLabel="Posting pembayaran"
        busy={saving}
        error={formError}
        onClose={() => setSettling(null)}
        onSubmit={(values) => {
          if (!settling) return
          const foreign = Boolean(settling.currency_code)
          return save(
            () => allocateOpenItem(settling.kind, settling.id, {
              transaction_date: String(values.get('transaction_date')),
              amount: String(values.get('amount')),
              payment_method: String(values.get('payment_method')),
              description: String(values.get('description') || `Pembayaran ${settling.number}`),
              ...(foreign ? {
                exchange_rate_numerator: Number(values.get('exchange_rate_numerator')),
                exchange_rate_denominator: Number(values.get('exchange_rate_denominator')),
                fx_gain_loss_account_id: String(values.get('fx_gain_loss_account_id')),
              } : {}),
            }),
            'Pembayaran berhasil dialokasikan dan diposting.',
            () => setSettling(null),
          )
        }}
      >
        <div className="form-row">
          <label>Tanggal<input type="date" name="transaction_date" defaultValue={today()} required /></label>
          <label>Nominal{settling?.currency_code ? ` (${settling.currency_code})` : ''}
            <input name="amount" inputMode="numeric" required
              defaultValue={settling?.currency_code ? String(settling.foreign_outstanding_minor ?? '') : String(settling?.outstanding_minor ?? '')} />
          </label>
          <label>{settling?.kind === 'payables' ? 'Dibayar dari' : 'Diterima di'}
            <select name="payment_method"><option value="CASH">Kas</option><option value="BANK">Bank</option><option value="QRIS">QRIS</option><option value="TRANSFER">Transfer</option></select>
          </label>
        </div>
        {settling?.currency_code && (
          <>
            <div className="callout">
              <strong>Kurs faktur</strong>
              <span>{settling.exchange_rate_numerator} / {settling.exchange_rate_denominator}. Selisih terhadap kurs pembayaran diakui sebagai laba atau rugi selisih kurs.</span>
            </div>
            <div className="form-row">
              <label>Kurs pembayaran<input name="exchange_rate_numerator" type="number" min={1} defaultValue={settling.exchange_rate_numerator ?? 1} required /></label>
              <label>Per<input name="exchange_rate_denominator" type="number" min={1} defaultValue={settling.exchange_rate_denominator ?? 1} required /></label>
              <label>Akun selisih kurs
                <select name="fx_gain_loss_account_id" required>{fxAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select>
              </label>
            </div>
          </>
        )}
        <label>Keterangan<input name="description" placeholder={`Pembayaran ${settling?.number ?? ''}`} /></label>
      </FormModal>

      {/* ---- Confirm dialogs ---- */}
      <ConfirmDialog
        open={contactStatus.target !== null}
        title={contactStatus.target?.is_active ? 'Nonaktifkan kontak?' : 'Aktifkan kontak?'}
        confirmLabel={contactStatus.target?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        busy={contactStatus.busy}
        error={contactStatus.error}
        onClose={contactStatus.close}
        onConfirm={() => contactStatus.run((contact) => setContactActive(contact.id, !contact.is_active).then(refresh))}
        description={contactStatus.target?.is_active
          ? <>Kontak <strong>{contactStatus.target.name}</strong> tidak akan muncul saat membuat piutang, utang, atau dokumen baru. Riwayat transaksi tetap utuh.</>
          : <>Kontak <strong>{contactStatus.target?.name}</strong> kembali dapat dipilih pada transaksi baru.</>}
      />
      <ConfirmDialog
        open={contactRemoval.target !== null}
        tone="danger"
        title="Hapus kontak permanen?"
        confirmLabel="Hapus permanen"
        confirmationWord={contactRemoval.target?.name}
        confirmationHint={<>Ketik nama kontak <strong>{contactRemoval.target?.name}</strong> untuk konfirmasi</>}
        busy={contactRemoval.busy}
        error={contactRemoval.error}
        onClose={contactRemoval.close}
        onConfirm={() => contactRemoval.run((contact) => deleteContact(contact.id).then(refresh))}
        description={<>Kontak <strong>{contactRemoval.target?.name}</strong> akan dihapus permanen. Penghapusan ditolak jika kontak pernah dipakai piutang, utang, beban, pembelian, atau dokumen bisnis.</>}
      />
    </section>
  )
}
