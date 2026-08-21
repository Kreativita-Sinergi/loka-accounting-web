import { type ReactNode, useEffect, useState } from 'react'
import {
  completeManufacturing, createTaxPeriod, getLocalization, listFXRates, listManufacturingOrders,
  listPayrollRuns, listTaxPeriods, postPayroll, remeasureFX, saveForeignBalance, saveFXRate, saveLocalization,
} from '../api/accounting'
import type { Account, FXRate, LocalizationProfile, ManufacturingOrder, PayrollRun, StatutoryTaxPeriod } from '../types/accounting'
import { Badge, Button, DataEntryGuide, PageHeader } from '../components/ui'
import { AddButton, DataTable, TablePanel, type Column } from '../components/DataTable'
import { FormModal, messageOf } from '../components/Modal'

type Kind = 'compliance' | 'payroll' | 'manufacturing' | 'currency'

const today = new Date().toISOString().slice(0, 10)
const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const value = (form: FormData, key: string) => String(form.get(key) ?? '')

export function ModulePage({ kind, accounts, onNotice }: { kind: Kind; accounts: Account[]; onNotice: (value: string) => void }) {
  if (kind === 'compliance') return <Compliance onNotice={onNotice} />
  if (kind === 'payroll') return <Payroll accounts={accounts} onNotice={onNotice} />
  if (kind === 'manufacturing') return <Manufacturing accounts={accounts} onNotice={onNotice} />
  return <Currency accounts={accounts} onNotice={onNotice} />
}

const moduleGuides: Record<string, string[]> = {
  'INDONESIA LOCALIZATION': [
    'Klik “Identitas wajib pajak” untuk melengkapi nama legal, NPWP, dan status PKP.',
    'Klik “Workpaper baru”, pilih jenis serta rentang periode pajak.',
    'Isi pajak keluaran, pajak masukan, dan jumlah yang dipotong, lalu simpan.',
    'Periksa hasilnya di daftar periode statutory sebelum review dan filing.',
  ],
  'PAYROLL ACCOUNTING': [
    'Klik “Run payroll” lalu isi periode payroll dan tanggal pembayaran.',
    'Masukkan identitas karyawan, gross, potongan, dan kontribusi perusahaan.',
    'Pilih akun beban, utang payroll, dan akun pembayaran.',
    'Periksa seluruh nilai lalu klik “Post payroll”; jurnal langsung terbentuk.',
  ],
  'MANUFACTURING ACCOUNTING': [
    'Klik “Selesaikan order” lalu isi nomor order, produk, tanggal selesai, dan jumlah produksi.',
    'Masukkan biaya material, tenaga kerja langsung, dan overhead.',
    'Pilih akun barang jadi, bahan baku, serta akun absorpsi.',
    'Periksa total biaya lalu simpan; biaya diserap ke persediaan barang jadi.',
  ],
  'MULTI-CURRENCY': [
    'Klik “Kurs baru” untuk menyimpan kurs penutupan beserta tanggal dan sumbernya.',
    'Klik “Saldo valuta” untuk mencatat saldo valuta dan carrying amount dalam rupiah.',
    'Klik “Remeasure”, pilih kurs dan akun gain/loss.',
    'Post remeasurement untuk mencatat selisih kurs pada penutupan periode.',
  ],
}

function PageHead({ eyebrow, title, description, badge, action }: { eyebrow: string; title: string; description: string; badge: string; action?: ReactNode }) {
  return <>
    <PageHeader eyebrow={eyebrow} title={title} description={description} action={<div className="page-actions"><Badge tone="info">{badge}</Badge>{action}</div>} />
    <DataEntryGuide steps={moduleGuides[eyebrow]} />
  </>
}

function AccountSelect({ name, accounts, types }: { name: string; accounts: Account[]; types?: string[] }) {
  const rows = types ? accounts.filter((account) => types.includes(account.type)) : accounts
  return (
    <select name={name} required defaultValue="">
      <option value="" disabled>Pilih akun</option>
      {rows.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
    </select>
  )
}

/**
 * useModuleForm carries the busy and error state shared by every module modal,
 * which all post append-only records rather than editing existing ones.
 */
function useModuleForm(refresh: () => Promise<void>, onNotice: (value: string) => void) {
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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

  return { saving, formError, setFormError, save }
}

function Compliance({ onNotice }: { onNotice: (value: string) => void }) {
  const [profile, setProfile] = useState<LocalizationProfile | null>(null)
  const [periods, setPeriods] = useState<StatutoryTaxPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [periodOpen, setPeriodOpen] = useState(false)

  async function refresh() {
    const [current, rows] = await Promise.all([getLocalization().catch(() => null), listTaxPeriods().catch(() => [])])
    setProfile(current); setPeriods(rows); setLoading(false)
  }
  useEffect(() => { void refresh() }, [])
  const form = useModuleForm(refresh, onNotice)

  const columns: Array<Column<StatutoryTaxPeriod>> = [
    { header: 'Jenis', cell: (period) => <span className="type-tag">{period.tax_type}</span> },
    { header: 'Periode', cell: (period) => `${period.period_start.slice(0, 10)} – ${period.period_end.slice(0, 10)}` },
    { header: 'Keluaran', align: 'right', className: 'mono', cell: (period) => money.format(period.output_tax_minor) },
    { header: 'Masukan', align: 'right', className: 'mono', cell: (period) => money.format(period.input_tax_minor) },
    { header: 'Status', cell: (period) => <Badge tone="warning">{period.status}</Badge> },
    { header: 'Terutang', align: 'right', className: 'mono', cell: (period) => money.format(period.payable_minor) },
  ]

  return (
    <section>
      <PageHead
        eyebrow="INDONESIA LOCALIZATION"
        title="Pajak yang siap direview, bukan ditebak"
        description="Profil legal dan kertas kerja periode PPN/PPh dengan status audit. Pelaporan final tetap melalui Coretax DJP."
        badge="Indonesia · Configurable"
        action={<div className="page-actions">
          <Button variant="secondary" icon="settings" onClick={() => { setProfileOpen(true); form.setFormError(null) }}>Identitas wajib pajak</Button>
          <AddButton onClick={() => { setPeriodOpen(true); form.setFormError(null) }}>Workpaper baru</AddButton>
        </div>}
      />
      <div className="callout">
        <strong>Compliance guardrail</strong>
        <span>Tarif dan perlakuan pajak berubah menurut objek serta tanggal efektif. Loka menyimpan workpaper dan jejak review; konsultasikan filing final dengan konsultan pajak.</span>
      </div>

      <div className="panel form-panel">
        <div className="security-heading">
          <div><h2>Identitas wajib pajak</h2><p>Dipakai pada seluruh kertas kerja dan dokumen statutory.</p></div>
          <Badge tone={profile ? 'success' : 'warning'}>{profile ? 'Tersimpan' : 'Belum lengkap'}</Badge>
        </div>
        <div className="stat-strip !mb-0">
          <div><span>Nama legal</span><strong className="!text-sm">{profile?.legal_name ?? 'Belum diisi'}</strong></div>
          <div><span>NPWP</span><strong className="mono !text-sm">{profile?.tax_identifier ?? 'Belum diisi'}</strong></div>
          <div><span>Status PKP</span><strong className="!text-sm">{profile?.is_vat_registered ? 'Terdaftar PKP' : 'Non-PKP'}</strong></div>
        </div>
        <div className="security-actions"><Button variant="secondary" icon="edit" onClick={() => { setProfileOpen(true); form.setFormError(null) }}>Ubah identitas</Button></div>
      </div>

      <TablePanel
        title="Periode statutory"
        description="Draft, review, filing, dan pembayaran tetap dapat ditelusuri."
        badge={`${periods.length} periode`}
        action={<AddButton onClick={() => { setPeriodOpen(true); form.setFormError(null) }}>Workpaper baru</AddButton>}
      >
        <DataTable columns={columns} rows={periods} keyOf={(period) => period.id} loading={loading} emptyIcon="compliance" empty="Belum ada periode pajak." />
      </TablePanel>

      <FormModal
        open={profileOpen}
        formKey={profile?.business_id ?? 'profile'}
        size="sm"
        eyebrow="PROFIL PAJAK"
        title="Identitas wajib pajak"
        description="Nama legal dan NPWP muncul pada kertas kerja serta dokumen yang dicetak."
        submitLabel="Simpan profil"
        busy={form.saving}
        error={form.formError}
        onClose={() => setProfileOpen(false)}
        onSubmit={(values) => form.save(
          () => saveLocalization({
            country_code: 'ID',
            legal_name: value(values, 'legal_name'),
            tax_identifier: value(values, 'tax_identifier') || null,
            is_vat_registered: values.get('is_vat_registered') === 'on',
            vat_registration_number: value(values, 'vat_registration_number') || null,
            statutory_timezone: 'Asia/Jakarta',
          }),
          'Profil pajak Indonesia tersimpan.',
          () => setProfileOpen(false),
        )}
      >
        <label>Nama legal<input name="legal_name" required defaultValue={profile?.legal_name} /></label>
        <label>NPWP / Tax ID<input name="tax_identifier" defaultValue={profile?.tax_identifier ?? ''} /></label>
        <label className="check-row"><input type="checkbox" name="is_vat_registered" defaultChecked={profile?.is_vat_registered} /><span>Terdaftar sebagai PKP</span></label>
        <label>Nomor registrasi PKP<input name="vat_registration_number" defaultValue={profile?.vat_registration_number ?? ''} /></label>
      </FormModal>

      <FormModal
        open={periodOpen}
        formKey="tax-period"
        eyebrow="WORKPAPER"
        title="Workpaper periode pajak"
        description="Angka pada workpaper menjadi dasar review internal sebelum filing."
        submitLabel="Buat workpaper"
        busy={form.saving}
        error={form.formError}
        onClose={() => setPeriodOpen(false)}
        onSubmit={(values) => form.save(
          () => createTaxPeriod({
            tax_type: value(values, 'tax_type'),
            period_start: value(values, 'start'),
            period_end: value(values, 'end'),
            output_tax: value(values, 'output'),
            input_tax: value(values, 'input'),
            withheld: value(values, 'withheld'),
          }),
          'Kertas kerja pajak dibuat untuk direview.',
          () => setPeriodOpen(false),
        )}
      >
        <div className="form-row">
          <label>Jenis<select name="tax_type"><option>PPN</option><option>PPH21</option><option>PPH23</option><option>PPH_FINAL</option></select></label>
          <label>Mulai<input name="start" type="date" required /></label>
          <label>Selesai<input name="end" type="date" required /></label>
        </div>
        <div className="form-row">
          <label>Pajak keluaran<input name="output" inputMode="numeric" defaultValue="0" /></label>
          <label>Pajak masukan<input name="input" inputMode="numeric" defaultValue="0" /></label>
          <label>Dipotong<input name="withheld" inputMode="numeric" defaultValue="0" /></label>
        </div>
      </FormModal>
    </section>
  )
}

function Payroll({ accounts, onNotice }: { accounts: Account[]; onNotice: (value: string) => void }) {
  const [rows, setRows] = useState<PayrollRun[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  async function refresh() { setRows(await listPayrollRuns().catch(() => [])); setLoading(false) }
  useEffect(() => { void refresh() }, [])
  const form = useModuleForm(refresh, onNotice)

  const columns: Array<Column<PayrollRun>> = [
    { header: 'Periode', cell: (run) => `${run.period_start.slice(0, 10)} – ${run.period_end.slice(0, 10)}` },
    { header: 'Tanggal bayar', cell: (run) => run.payment_date.slice(0, 10) },
    { header: 'Gross', align: 'right', className: 'mono', cell: (run) => money.format(run.gross_minor) },
    { header: 'Potongan', align: 'right', className: 'mono', cell: (run) => money.format(run.employee_deductions_minor) },
    { header: 'Status', cell: (run) => <Badge tone={run.status === 'POSTED' ? 'success' : 'neutral'}>{run.status}</Badge> },
    { header: 'Net', align: 'right', className: 'mono', cell: (run) => money.format(run.net_minor) },
  ]

  return (
    <section>
      <PageHead
        eyebrow="PAYROLL ACCOUNTING"
        title="Posting payroll tanpa jurnal bayangan"
        description="Gross pay, potongan karyawan, kontribusi perusahaan, liability, dan pembayaran bersih tersimpan atomik."
        badge="Journal-backed"
        action={<AddButton onClick={() => { setOpen(true); form.setFormError(null) }}>Run payroll</AddButton>}
      />
      <div className="stat-strip">
        <div><span>Total run</span><strong>{rows.length}</strong></div>
        <div><span>Gross terakhir</span><strong>{money.format(rows[0]?.gross_minor ?? 0)}</strong></div>
        <div><span>Net terakhir</span><strong>{money.format(rows[0]?.net_minor ?? 0)}</strong></div>
      </div>

      <TablePanel
        title="Riwayat payroll"
        description="Setiap run tercatat sebagai jurnal berimbang."
        badge={`${rows.length} run`}
        className="!mt-0"
        action={<AddButton onClick={() => { setOpen(true); form.setFormError(null) }}>Run payroll</AddButton>}
      >
        <DataTable columns={columns} rows={rows} keyOf={(run) => run.id} loading={loading} emptyIcon="payroll" empty="Belum ada payroll run." />
      </TablePanel>

      <FormModal
        open={open}
        formKey="payroll"
        size="lg"
        eyebrow="PAYROLL"
        title="Run payroll baru"
        description="Payroll langsung diposting sebagai jurnal berimbang dan tidak dapat dibatalkan."
        submitLabel="Post payroll"
        busy={form.saving}
        error={form.formError}
        onClose={() => setOpen(false)}
        onSubmit={(values) => form.save(
          () => postPayroll({
            period_start: value(values, 'start'),
            period_end: value(values, 'end'),
            payment_date: value(values, 'payment'),
            salary_expense_account_id: value(values, 'salary'),
            contribution_expense_account_id: value(values, 'contribution'),
            payroll_liability_account_id: value(values, 'liability'),
            payment_account_id: value(values, 'cash'),
            items: [{
              employee_reference: value(values, 'employee_ref'),
              employee_name: value(values, 'employee_name'),
              gross: value(values, 'gross'),
              deductions: value(values, 'deductions'),
              employer_contributions: value(values, 'employer'),
            }],
          }),
          'Payroll diposting sebagai jurnal berimbang.',
          () => setOpen(false),
        )}
      >
        <div className="form-row">
          <label>Awal periode<input name="start" type="date" required /></label>
          <label>Akhir periode<input name="end" type="date" required /></label>
          <label>Tanggal bayar<input name="payment" type="date" defaultValue={today} required /></label>
        </div>
        <fieldset>
          <legend>Karyawan</legend>
          <div className="form-row">
            <label>ID karyawan<input name="employee_ref" required placeholder="EMP-001" /></label>
            <label>Nama karyawan<input name="employee_name" required /></label>
          </div>
          <div className="form-row">
            <label>Gross<input name="gross" required inputMode="numeric" /></label>
            <label>Potongan<input name="deductions" defaultValue="0" inputMode="numeric" /></label>
            <label>Kontribusi perusahaan<input name="employer" defaultValue="0" inputMode="numeric" /></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Akun jurnal</legend>
          <div className="form-row">
            <label>Beban gaji<AccountSelect name="salary" accounts={accounts} types={['EXPENSE']} /></label>
            <label>Beban kontribusi<AccountSelect name="contribution" accounts={accounts} types={['EXPENSE']} /></label>
            <label>Utang payroll<AccountSelect name="liability" accounts={accounts} types={['LIABILITY']} /></label>
            <label>Akun pembayaran<AccountSelect name="cash" accounts={accounts} types={['ASSET']} /></label>
          </div>
        </fieldset>
      </FormModal>
    </section>
  )
}

function Manufacturing({ accounts, onNotice }: { accounts: Account[]; onNotice: (value: string) => void }) {
  const [rows, setRows] = useState<ManufacturingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  async function refresh() { setRows(await listManufacturingOrders().catch(() => [])); setLoading(false) }
  useEffect(() => { void refresh() }, [])
  const form = useModuleForm(refresh, onNotice)

  const columns: Array<Column<ManufacturingOrder>> = [
    { header: 'Order', className: 'mono', cell: (order) => order.order_number },
    { header: 'Produk', cell: (order) => <strong>{order.product_reference}</strong> },
    { header: 'Tanggal', cell: (order) => order.completion_date.slice(0, 10) },
    { header: 'Status', cell: (order) => <Badge tone={order.status === 'COMPLETED' ? 'success' : 'neutral'}>{order.status}</Badge> },
    { header: 'Nilai barang jadi', align: 'right', className: 'mono', cell: (order) => money.format(order.finished_goods_minor) },
  ]

  return (
    <section>
      <PageHead
        eyebrow="MANUFACTURING ACCOUNTING"
        title="Biaya produksi yang bisa ditelusuri"
        description="Material, tenaga kerja langsung, dan overhead diserap ke persediaan barang jadi dalam satu transaksi."
        badge="Atomic costing"
        action={<AddButton onClick={() => { setOpen(true); form.setFormError(null) }}>Selesaikan order</AddButton>}
      />

      <TablePanel
        title="Production orders"
        description="Order yang biayanya sudah diserap ke barang jadi."
        badge={`${rows.length} order`}
        className="!mt-0"
        action={<AddButton onClick={() => { setOpen(true); form.setFormError(null) }}>Selesaikan order</AddButton>}
      >
        <DataTable columns={columns} rows={rows} keyOf={(order) => order.id} loading={loading} emptyIcon="manufacturing" empty="Belum ada order produksi selesai." />
      </TablePanel>

      <FormModal
        open={open}
        formKey="manufacturing"
        size="lg"
        eyebrow="PRODUCTION ORDER"
        title="Selesaikan production order"
        description="Penyelesaian order memindahkan seluruh biaya ke persediaan barang jadi dan tidak dapat dibatalkan."
        submitLabel="Selesaikan & post"
        busy={form.saving}
        error={form.formError}
        onClose={() => setOpen(false)}
        onSubmit={(values) => form.save(
          () => completeManufacturing({
            order_number: value(values, 'order'),
            product_reference: value(values, 'product'),
            completion_date: value(values, 'date'),
            quantity: Number(value(values, 'qty')),
            raw_material: value(values, 'raw'),
            direct_labor: value(values, 'labor'),
            overhead: value(values, 'overhead'),
            finished_goods_account_id: value(values, 'fg_account'),
            raw_material_account_id: value(values, 'raw_account'),
            labor_account_id: value(values, 'labor_account'),
            overhead_account_id: value(values, 'overhead_account'),
          }),
          'Order produksi selesai dan biaya dipindahkan ke barang jadi.',
          () => setOpen(false),
        )}
      >
        <div className="form-row">
          <label>Nomor order<input name="order" required placeholder="MO-2026-001" /></label>
          <label>Produk<input name="product" required placeholder="SKU-FG-001" /></label>
          <label>Tanggal selesai<input name="date" type="date" defaultValue={today} required /></label>
          <label>Qty<input name="qty" type="number" min="1" required /></label>
        </div>
        <fieldset>
          <legend>Komponen biaya</legend>
          <div className="form-row">
            <label>Material<input name="raw" defaultValue="0" inputMode="numeric" /></label>
            <label>Tenaga kerja<input name="labor" defaultValue="0" inputMode="numeric" /></label>
            <label>Overhead<input name="overhead" defaultValue="0" inputMode="numeric" /></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Akun jurnal</legend>
          <div className="form-row">
            <label>Barang jadi<AccountSelect name="fg_account" accounts={accounts} types={['ASSET']} /></label>
            <label>Bahan baku<AccountSelect name="raw_account" accounts={accounts} types={['ASSET']} /></label>
            <label>Absorpsi tenaga kerja<AccountSelect name="labor_account" accounts={accounts} /></label>
            <label>Absorpsi overhead<AccountSelect name="overhead_account" accounts={accounts} /></label>
          </div>
        </fieldset>
      </FormModal>
    </section>
  )
}

function Currency({ accounts, onNotice }: { accounts: Account[]; onNotice: (value: string) => void }) {
  const [rates, setRates] = useState<FXRate[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'rate' | 'balance' | 'remeasure' | null>(null)

  async function refresh() { setRates(await listFXRates().catch(() => [])); setLoading(false) }
  useEffect(() => { void refresh() }, [])
  const form = useModuleForm(refresh, onNotice)

  const columns: Array<Column<FXRate>> = [
    { header: 'Mata uang', cell: (rate) => <strong>{rate.currency_code}</strong> },
    { header: 'Tanggal', cell: (rate) => rate.rate_date.slice(0, 10) },
    { header: 'Exact rate', className: 'mono', cell: (rate) => `${rate.rate_numerator} / ${rate.rate_denominator}` },
    { header: 'Sumber', cell: (rate) => rate.source },
  ]

  return (
    <section>
      <PageHead
        eyebrow="MULTI-CURRENCY"
        title="Kurs presisi, selisih transparan"
        description="Simpan kurs sebagai pecahan exact, catat carrying amount, lalu post unrealized gain/loss pada penutupan periode."
        badge="Functional currency · IDR"
        action={<div className="page-actions">
          <Button variant="secondary" icon="plus" onClick={() => { setModal('balance'); form.setFormError(null) }}>Saldo valuta</Button>
          <Button variant="secondary" icon="refresh" onClick={() => { setModal('remeasure'); form.setFormError(null) }} disabled={rates.length === 0}>Remeasure</Button>
          <AddButton onClick={() => { setModal('rate'); form.setFormError(null) }}>Kurs baru</AddButton>
        </div>}
      />

      <TablePanel
        title="Kurs tersimpan"
        description="Kurs disimpan sebagai pecahan exact agar tidak ada pembulatan tersembunyi."
        badge={`${rates.length} kurs`}
        className="!mt-0"
        action={<AddButton onClick={() => { setModal('rate'); form.setFormError(null) }}>Kurs baru</AddButton>}
      >
        <DataTable columns={columns} rows={rates} keyOf={(rate) => rate.id} loading={loading} emptyIcon="currency" empty="Belum ada kurs valuta." />
      </TablePanel>

      <FormModal
        open={modal === 'rate'}
        formKey="fx-rate"
        size="sm"
        eyebrow="KURS"
        title="Kurs penutupan"
        description="Menyimpan kurs untuk mata uang dan tanggal yang sama akan menimpa kurs sebelumnya."
        submitLabel="Simpan kurs"
        busy={form.saving}
        error={form.formError}
        onClose={() => setModal(null)}
        onSubmit={(values) => form.save(
          () => saveFXRate({
            currency_code: value(values, 'currency'),
            rate_date: value(values, 'date'),
            rate_numerator: Number(value(values, 'numerator')),
            rate_denominator: Number(value(values, 'denominator')),
            source: value(values, 'source'),
          }),
          'Kurs exact tersimpan.',
          () => setModal(null),
        )}
      >
        <div className="form-row">
          <label>Mata uang<input name="currency" maxLength={3} placeholder="USD" required /></label>
          <label>Tanggal<input name="date" type="date" defaultValue={today} required /></label>
        </div>
        <div className="form-row">
          <label>Numerator<input name="numerator" type="number" min="1" required placeholder="1650000" /></label>
          <label>Denominator<input name="denominator" type="number" min="1" required placeholder="100" /></label>
        </div>
        <label>Sumber<input name="source" required placeholder="Bank Indonesia / contract rate" /></label>
        <p className="modal-note">Contoh: 1 USD = Rp 16.500 ditulis sebagai numerator 1650000 dan denominator 100.</p>
      </FormModal>

      <FormModal
        open={modal === 'balance'}
        formKey="fx-balance"
        size="sm"
        eyebrow="SALDO VALUTA"
        title="Saldo valuta asing"
        description="Carrying amount adalah nilai rupiah yang sudah tercatat di buku untuk saldo valuta tersebut."
        submitLabel="Simpan saldo"
        busy={form.saving}
        error={form.formError}
        onClose={() => setModal(null)}
        onSubmit={(values) => form.save(
          () => saveForeignBalance({
            account_id: value(values, 'account'),
            currency_code: value(values, 'currency'),
            foreign_amount: value(values, 'foreign'),
            carrying_base_amount: value(values, 'base'),
          }),
          'Saldo valuta tersimpan.',
          () => setModal(null),
        )}
      >
        <label>Akun<AccountSelect name="account" accounts={accounts} types={['ASSET', 'LIABILITY']} /></label>
        <div className="form-row">
          <label>Mata uang<input name="currency" maxLength={3} placeholder="USD" required /></label>
          <label>Saldo valuta<input name="foreign" inputMode="numeric" required /></label>
          <label>Carrying amount IDR<input name="base" inputMode="numeric" required /></label>
        </div>
      </FormModal>

      <FormModal
        open={modal === 'remeasure'}
        formKey="fx-remeasure"
        size="sm"
        eyebrow="REMEASUREMENT"
        title="Post remeasurement"
        description="Selisih antara carrying amount dan nilai kurs terpilih diposting sebagai gain atau loss."
        submitLabel="Post remeasurement"
        busy={form.saving}
        error={form.formError}
        onClose={() => setModal(null)}
        onSubmit={(values) => form.save(
          () => remeasureFX({
            rate_id: value(values, 'rate'),
            remeasurement_date: value(values, 'date'),
            gain_loss_account_id: value(values, 'gain_loss'),
          }),
          'Remeasurement diposting.',
          () => setModal(null),
        )}
      >
        <label>Kurs
          <select name="rate" required defaultValue="">
            <option value="" disabled>Pilih kurs</option>
            {rates.map((rate) => <option value={rate.id} key={rate.id}>{rate.currency_code} · {rate.rate_date.slice(0, 10)} · {rate.rate_numerator}/{rate.rate_denominator}</option>)}
          </select>
        </label>
        <label>Tanggal<input name="date" type="date" defaultValue={today} required /></label>
        <label>Akun gain/loss<AccountSelect name="gain_loss" accounts={accounts} types={['OTHER_INCOME', 'OTHER_EXPENSE']} /></label>
      </FormModal>
    </section>
  )
}
