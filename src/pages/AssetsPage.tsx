import { useCallback, useEffect, useRef, useState } from 'react'
import { createFixedAsset, depreciateAsset, disposeAsset, listAssetInvoiceSources, listAssetJournalSources, listDisposals, listFixedAssets, registerAssetFromInvoice, registerAssetFromJournal, revalueAsset, type AssetCardInput } from '../api/assets'
import { getFixedAssetRegister } from '../api/analytics'
import type { Account } from '../types/accounting'
import type { AssetDisposal, FixedAsset, FixedAssetInvoiceSource, FixedAssetJournalSource, FixedAssetRegisterReport, FixedAssetSourceKind } from '../types/reports'
import { Badge, PageHeader, MoneyInput } from '../components/ui'
import { AddButton, DataTable, TablePanel, type Column } from '../components/DataTable'
import { ConfirmDialog, FormModal, messageOf, useConfirm } from '../components/Modal'
import { amount } from './ReportsPage'

const paymentMethods = ['CASH', 'BANK', 'QRIS', 'DEBIT_CARD', 'CREDIT_CARD', 'E_WALLET']

type RegisterRow = FixedAssetRegisterReport['rows'][number]

/** Kartu yang dibuat dari jurnal yang sudah ada: faktur pemasok atau reklasifikasi lama. */
type LinkTarget = { kind: 'invoice'; source: FixedAssetInvoiceSource } | { kind: 'journal'; source: FixedAssetJournalSource }

const sourceLabels: Record<FixedAssetSourceKind, string> = { DIRECT: 'Beli tunai', PURCHASE_INVOICE: 'Faktur pemasok', JOURNAL: 'Jurnal lama' }
const paymentLabels: Record<string, string> = { OPEN: 'Belum dibayar', PARTIALLY_PAID: 'Dibayar sebagian', PAID: 'Lunas', VOID: 'Batal' }

/** cardInput membaca rincian kartu yang sama untuk semua jalur perolehan. */
function cardInput(values: FormData): AssetCardInput {
  return {
    code: String(values.get('code')),
    name: String(values.get('name') ?? ''),
    in_service_date: String(values.get('in_service_date') ?? ''),
    residual_amount: String(values.get('residual_amount') || '0'),
    useful_life_months: Number(values.get('useful_life_months')),
    depreciation_method: String(values.get('depreciation_method')),
    accumulated_depreciation_account_id: String(values.get('accumulated_depreciation_account_id')),
    depreciation_expense_account_id: String(values.get('depreciation_expense_account_id')),
  }
}

export function AssetsPage({ accounts, onNotice }: { accounts: Account[]; onNotice: (message: string) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [register, setRegister] = useState<FixedAssetRegisterReport | null>(null)
  const [disposals, setDisposals] = useState<AssetDisposal[]>([])
  const [invoiceSources, setInvoiceSources] = useState<FixedAssetInvoiceSource[]>([])
  const [journalSources, setJournalSources] = useState<FixedAssetJournalSource[]>([])
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState<LinkTarget | null>(null)
  const [periodDate, setPeriodDate] = useState(today)

  const [acquireOpen, setAcquireOpen] = useState(false)
  const [revaluing, setRevaluing] = useState<RegisterRow | null>(null)
  const [disposing, setDisposing] = useState<RegisterRow | null>(null)
  const [revaluationType, setRevaluationType] = useState('REVALUATION')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  // Penjaga sinkron: klik ganda sebelum state "saving" ter-render tidak boleh
  // mengirim perintah kedua.
  const inFlight = useRef(false)

  const depreciation = useConfirm<RegisterRow>()

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([listFixedAssets(), getFixedAssetRegister({}), listDisposals(), listAssetInvoiceSources(), listAssetJournalSources()])
    const [assetResult, registerResult, disposalResult, invoiceResult, journalResult] = results
    if (assetResult.status === 'fulfilled') setAssets(assetResult.value ?? [])
    if (registerResult.status === 'fulfilled') setRegister(registerResult.value)
    if (disposalResult.status === 'fulfilled') setDisposals(disposalResult.value ?? [])
    if (invoiceResult.status === 'fulfilled') setInvoiceSources(invoiceResult.value ?? [])
    if (journalResult.status === 'fulfilled') setJournalSources(journalResult.value ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  // Sama dengan aturan server: akun aset buatan pengguna, bukan kas/bank/piutang/persediaan.
  const assetAccounts = accounts.filter((account) => account.type === 'ASSET' && account.normal_balance === 'DEBIT' && !account.system_key && account.cash_flow_category !== 'CASH')
  const accumulatedAccounts = accounts.filter((account) => account.type === 'ASSET' && account.normal_balance === 'CREDIT')
  const expenseAccounts = accounts.filter((account) => account.type === 'EXPENSE' || account.type === 'OTHER_EXPENSE')
  const equityAccounts = accounts.filter((account) => account.type === 'EQUITY')
  const resultAccounts = accounts.filter((account) => ['OTHER_INCOME', 'OTHER_EXPENSE', 'EXPENSE', 'REVENUE'].includes(account.type))
  const counterpartAccounts = revaluationType === 'REVALUATION' ? equityAccounts : expenseAccounts

  /** save funnels every modal submit through one busy, error, and refresh path. */
  async function save(action: () => Promise<unknown>, success: string, done: () => void) {
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setFormError(null)
    try {
      await action()
      await refresh()
      done()
      onNotice(success)
    } catch (error) {
      setFormError(messageOf(error, 'Perintah aset gagal dijalankan.'))
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const columns: Array<Column<RegisterRow>> = [
    { header: 'Kode', className: 'mono', width: '120px', cell: (row) => row.code },
    {
      header: 'Aset',
      cell: (row) => <>
        <strong>{row.name}</strong>
        <small className="block">
          Diperoleh {row.acquisition_date}{row.in_service_date !== row.acquisition_date && ` · siap digunakan ${row.in_service_date}`}
          {row.last_depreciation_period && ` · penyusutan terakhir ${row.last_depreciation_period}`}
        </small>
        {row.acquisition_source && <small className="block">{sourceLabels[row.acquisition_source]}</small>}
      </>,
    },
    { header: 'Metode', cell: (row) => <span className="type-tag">{row.depreciation_method}</span> },
    { header: 'Status', cell: (row) => <><Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>{row.status}</Badge>{row.status === 'DISPOSED' && <small className="block">Nilai historis sebelum pelepasan</small>}</> },
    { header: 'Perolehan', align: 'right', className: 'mono', cell: (row) => amount(row.acquisition) },
    { header: 'Akumulasi', align: 'right', className: 'mono', cell: (row) => amount(row.accumulated_depreciation) },
    { header: 'Nilai buku', align: 'right', className: 'mono', cell: (row) => amount(row.book_value) },
  ]

  const disposalColumns: Array<Column<AssetDisposal>> = [
    { header: 'Tanggal', cell: (disposal) => disposal.disposal_date.slice(0, 10) },
    {
      header: 'Aset',
      cell: (disposal) => {
        const asset = assets.find((candidate) => candidate.id === disposal.fixed_asset_id)
        return asset ? `${asset.code} · ${asset.name}` : disposal.fixed_asset_id.slice(0, 8)
      },
    },
    { header: 'Hasil', align: 'right', className: 'mono', cell: (disposal) => disposal.proceeds_minor.toLocaleString('id-ID') },
    { header: 'Nilai buku', align: 'right', className: 'mono', cell: (disposal) => disposal.carrying_minor.toLocaleString('id-ID') },
    {
      header: 'Laba/rugi',
      align: 'right',
      className: 'mono',
      cell: (disposal) => <span className={disposal.result_minor < 0 ? 'text-orange-700' : 'text-emerald-700'}>{disposal.result_minor.toLocaleString('id-ID')}</span>,
    },
  ]

  const invoiceColumns: Array<Column<FixedAssetInvoiceSource>> = [
    { header: 'Faktur', cell: (source) => <><strong className="mono">{source.document_number}</strong><small className="block">{source.document_date.slice(0, 10)}{source.contact_name && ` · ${source.contact_name}`}</small></> },
    { header: 'Baris aset', cell: (source) => <>{source.description}<small className="block">{source.asset_account_code} · {source.asset_account_name}</small></> },
    { header: 'Nilai', align: 'right', className: 'mono', cell: (source) => amount(source.amount) },
    {
      header: 'Pelunasan',
      cell: (source) => <>
        <Badge tone={source.payment_status === 'PAID' ? 'success' : 'warning'}>{paymentLabels[source.payment_status ?? ''] ?? source.payment_status ?? '—'}</Badge>
        {source.payment_status !== 'PAID' && source.outstanding && <small className="block">Sisa {amount(source.outstanding)}</small>}
      </>,
    },
    { header: 'Kartu aset', cell: (source) => source.fixed_asset_code ? <Badge tone="success">{source.fixed_asset_code}</Badge> : <Badge tone="warning">Belum dibuat</Badge> },
  ]

  const journalColumns: Array<Column<FixedAssetJournalSource>> = [
    { header: 'Jurnal', cell: (source) => <><strong className="mono">{source.journal_number}</strong><small className="block">{source.transaction_date.slice(0, 10)} · {source.source_type}</small></> },
    { header: 'Keterangan', cell: (source) => source.description },
    { header: 'Akun aset', cell: (source) => `${source.asset_account_code} · ${source.asset_account_name}` },
    { header: 'Belum terdaftar', align: 'right', className: 'mono', cell: (source) => amount(source.available) },
  ]

  const pendingInvoices = invoiceSources.filter((source) => !source.fixed_asset_id).length
  const reconciliation = register?.reconciliation ?? []
  const unreconciled = reconciliation.filter((row) => Number(row.difference) !== 0)

  // Sebutkan akun yang benar-benar belum ada; akumulasi penyusutan adalah akun
  // Aset bersaldo normal Kredit, bukan Debit.
  const missing = [
    assetAccounts.length === 0 && 'akun aset tetap (tipe Aset, saldo normal Debit)',
    accumulatedAccounts.length === 0 && 'akun akumulasi penyusutan (tipe Aset, saldo normal Kredit)',
    expenseAccounts.length === 0 && 'akun beban penyusutan (tipe Beban)',
  ].filter(Boolean) as string[]
  const cardMissing = missing.filter((label) => !label.startsWith('akun aset tetap'))
  const missingAccounts = missing.length > 0
  const missingHint = missingAccounts ? `Buat lebih dulu di Daftar Akun: ${missing.join('; ')}.` : undefined

  const linkAmount = linking?.kind === 'invoice' ? linking.source.amount : linking?.source.available
  const linkDate = linking?.kind === 'invoice' ? linking.source.document_date.slice(0, 10) : linking?.source.transaction_date.slice(0, 10)

  /** Rincian kartu: dipakai form beli tunai dan form kartu dari faktur/jurnal. */
  function cardFields(defaultName: string, inServiceDefault: string) {
    return <>
      <div className="form-row">
        <label>Kode<input name="code" required /></label>
        <label>Nama<input name="name" defaultValue={defaultName} required /></label>
        <label>Tanggal siap digunakan<input type="date" name="in_service_date" defaultValue={inServiceDefault} required /></label>
      </div>
      <div className="form-row">
        <label>Nilai residu<MoneyInput name="residual_amount" defaultValue="0" /></label>
        <label>Umur manfaat (bulan)<input name="useful_life_months" type="number" min={1} defaultValue={60} required /></label>
        <label>Metode<select name="depreciation_method"><option value="STRAIGHT_LINE">Garis lurus</option><option value="DOUBLE_DECLINING">Saldo menurun berganda</option></select></label>
      </div>
    </>
  }

  function depreciationAccountFields() {
    return <>
      <label>Akumulasi penyusutan<select name="accumulated_depreciation_account_id" defaultValue="" required><option value="">Pilih akun akumulasi penyusutan</option>{accumulatedAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label>
      <label>Beban penyusutan<select name="depreciation_expense_account_id" defaultValue="" required><option value="">Pilih akun beban penyusutan</option>{expenseAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label>
    </>
  }

  function openLink(target: LinkTarget) {
    setFormError(null)
    setLinking(target)
  }

  return (
    <section>
      <PageHeader
        eyebrow="ASET TETAP"
        title="Aset tetap"
        description="Beli lewat Faktur Pembelian dengan baris Aset Tetap, lalu lengkapi kartunya di sini. Penyusutan dimulai sejak aset siap digunakan, bukan sejak dilunasi."
        action={<AddButton onClick={() => { setAcquireOpen(true); setFormError(null) }} disabled={missingAccounts} title={missingHint}>Catat aset beli tunai</AddButton>}
      />

      {missingAccounts && !loading && <p className="modal-note" role="status">{missingHint}</p>}

      {invoiceSources.length > 0 && (
        <TablePanel
          title="Aset dari faktur pembelian"
          description="Faktur sudah memposting Debit Aset / Kredit Utang dan pembayarannya melunasi utang. Membuat kartu hanya melengkapi rincian aset tanpa jurnal baru."
          badge={pendingInvoices > 0 ? `${pendingInvoices} menunggu kartu` : 'Semua terdaftar'}
          badgeTone={pendingInvoices > 0 ? 'warning' : 'success'}
        >
          <DataTable
            columns={invoiceColumns}
            rows={invoiceSources}
            keyOf={(source) => source.line_id}
            empty="Belum ada baris aset tetap pada faktur pembelian."
            rowActions={[{ label: 'Buat kartu aset', icon: 'plus', onSelect: (source) => openLink({ kind: 'invoice', source }), when: (source) => !source.fixed_asset_id && cardMissing.length === 0 }]}
          />
        </TablePanel>
      )}

      {journalSources.length > 0 && (
        <TablePanel
          title="Jurnal aset yang belum punya kartu"
          description="Untuk transaksi lama yang sudah direklasifikasi manual ke akun aset (mis. Debit Peralatan / Kredit Beban). Menghubungkan tidak membuat jurnal perolehan atau pembayaran baru."
          badge={`${journalSources.length} jurnal`}
          badgeTone="warning"
        >
          <DataTable
            columns={journalColumns}
            rows={journalSources}
            keyOf={(source) => `${source.journal_entry_id}:${source.asset_account_id}`}
            empty="Semua debit akun aset sudah terdaftar."
            rowActions={[{ label: 'Hubungkan ke kartu aset', icon: 'plus', onSelect: (source) => openLink({ kind: 'journal', source }), when: () => cardMissing.length === 0 }]}
          />
        </TablePanel>
      )}

      <TablePanel
        title="Daftar aset"
        description="Nilai buku sudah memperhitungkan revaluasi dan penurunan nilai."
        badge={`${assets.length} aset`}
        badgeTone="info"
        className="!mt-0"
        action={<AddButton onClick={() => { setAcquireOpen(true); setFormError(null) }} disabled={missingAccounts} title={missingHint}>Catat aset beli tunai</AddButton>}
      >
        <DataTable
          columns={columns}
          rows={register?.rows ?? []}
          keyOf={(row) => row.asset_id}
          loading={loading}
          emptyIcon="asset"
          empty="Belum ada aset tetap."
          rowActions={[
            { label: 'Jalankan penyusutan', icon: 'refresh', onSelect: depreciation.open, when: (row) => row.status === 'ACTIVE' },
            { label: 'Penilaian ulang', icon: 'edit', onSelect: (row) => { setRevaluing(row); setRevaluationType('REVALUATION'); setFormError(null) }, when: (row) => row.status === 'ACTIVE' },
            { label: 'Lepas aset', icon: 'trash', danger: true, onSelect: (row) => { setDisposing(row); setFormError(null) }, when: (row) => row.status === 'ACTIVE' },
          ]}
          footer={register && (
            <tfoot><tr>
              <th colSpan={4}>Total aset yang masih diakui</th>
              <th className="number">{amount(register.total_acquisition)}</th>
              <th className="number">{amount(register.total_accumulated_depreciation)}</th>
              <th className="number">{amount(register.total_book_value)}</th>
              <th />
            </tr></tfoot>
          )}
        />
      </TablePanel>

      {reconciliation.length > 0 && (
        <TablePanel
          title="Cocokkan dengan buku besar"
          description="Saldo akun aset di buku besar dibanding harga perolehan di register. Selisih berarti ada biaya aset yang belum punya kartu atau kartu tanpa jurnal."
          badge={unreconciled.length === 0 ? 'Cocok' : `${unreconciled.length} akun selisih`}
          badgeTone={unreconciled.length === 0 ? 'success' : 'warning'}
        >
          <DataTable
            columns={[
              { header: 'Akun', cell: (row) => `${row.account_code} · ${row.account_name}` },
              { header: 'Buku besar', align: 'right', className: 'mono', cell: (row) => amount(row.ledger) },
              { header: 'Register', align: 'right', className: 'mono', cell: (row) => amount(row.register) },
              { header: 'Selisih', align: 'right', className: 'mono', cell: (row) => <span className={Number(row.difference) !== 0 ? 'text-orange-700' : undefined}>{amount(row.difference)}</span> },
            ]}
            rows={reconciliation}
            keyOf={(row) => row.account_id}
            search={false}
          />
        </TablePanel>
      )}

      {disposals.length > 0 && (
        <TablePanel title="Riwayat pelepasan" description="Selisih hasil penjualan terhadap nilai buku menjadi laba atau rugi." badge={`${disposals.length} pelepasan`}>
          <DataTable columns={disposalColumns} rows={disposals} keyOf={(disposal) => disposal.id} empty="Belum ada pelepasan aset." />
        </TablePanel>
      )}

      {/* ---- Acquisition modal ---- */}
      <FormModal
        open={acquireOpen}
        formKey="acquire"
        size="lg"
        eyebrow="PEROLEHAN"
        title="Catat aset beli tunai"
        description="Untuk aset yang dibayar langsung tanpa faktur pemasok: membentuk jurnal Debit Aset / Kredit Kas atau Bank. Pembelian lewat faktur jangan dicatat di sini — tambahkan baris Aset Tetap pada Faktur Pembelian, lalu buat kartunya dari daftar di halaman ini."
        submitLabel="Catat aset"
        busy={saving}
        error={formError}
        onClose={() => setAcquireOpen(false)}
        onSubmit={(values) => save(
          () => createFixedAsset({
            ...cardInput(values),
            acquisition_date: String(values.get('acquisition_date')),
            acquisition_amount: String(values.get('acquisition_amount')),
            payment_method: String(values.get('payment_method')),
            asset_account_id: String(values.get('asset_account_id')),
          }),
          'Aset tetap dicatat beserta jurnal perolehannya.',
          () => setAcquireOpen(false),
        )}
      >
        <div className="form-row">
          <label>Tanggal perolehan<input type="date" name="acquisition_date" defaultValue={today} required /></label>
          <label>Harga perolehan<MoneyInput name="acquisition_amount" required /></label>
          <label>Dibayar dari<select name="payment_method">{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
        </div>
        {cardFields('', today)}
        <fieldset>
          <legend>Akun jurnal</legend>
          <div className="form-row">
            <label>Akun aset<select name="asset_account_id" defaultValue="" required><option value="">Pilih akun aset tetap</option>{assetAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label>
            {depreciationAccountFields()}
          </div>
        </fieldset>
      </FormModal>

      {/* ---- Card from an invoice line or a legacy journal: no journal posted ---- */}
      <FormModal
        open={linking !== null}
        formKey={linking ? `${linking.kind}:${linking.kind === 'invoice' ? linking.source.line_id : `${linking.source.journal_entry_id}:${linking.source.asset_account_id}`}` : 'link'}
        size="lg"
        eyebrow={linking?.kind === 'invoice' ? 'KARTU DARI FAKTUR' : 'HUBUNGKAN JURNAL LAMA'}
        title={linking?.kind === 'invoice' ? `Kartu aset untuk ${linking.source.document_number}` : `Kartu aset untuk jurnal ${linking?.source.journal_number ?? ''}`}
        description={linking && <>
          {linking.kind === 'invoice'
            ? <>Harga perolehan {amount(linking.source.amount)} dan akun {linking.source.asset_account_code} · {linking.source.asset_account_name} diambil dari faktur.</>
            : <>Jurnal ini sudah mendebit {linking.source.asset_account_code} · {linking.source.asset_account_name} sebesar {amount(linking.source.available)} yang belum terdaftar.</>}
          {' '}Kartu hanya melengkapi rincian aset; tidak ada jurnal perolehan atau pembayaran baru.
        </>}
        submitLabel={linking?.kind === 'invoice' ? 'Buat kartu aset' : 'Hubungkan ke kartu aset'}
        busy={saving}
        error={formError}
        onClose={() => setLinking(null)}
        onSubmit={(values) => {
          if (!linking) return
          const card = cardInput(values)
          return save(
            () => linking.kind === 'invoice'
              ? registerAssetFromInvoice({ ...card, document_line_id: linking.source.line_id })
              : registerAssetFromJournal({
                ...card,
                journal_entry_id: linking.source.journal_entry_id,
                asset_account_id: linking.source.asset_account_id,
                amount: String(values.get('amount') ?? ''),
                acquisition_date: String(values.get('acquisition_date') ?? ''),
              }),
            'Kartu aset dibuat tanpa jurnal baru.',
            () => setLinking(null),
          )
        }}
      >
        {linking?.kind === 'journal' && (
          <div className="form-row">
            <label>Tanggal perolehan<input type="date" name="acquisition_date" defaultValue={linkDate} required /></label>
            <label>Harga perolehan<MoneyInput name="amount" defaultValue={String(linkAmount)} required /></label>
          </div>
        )}
        {linking && cardFields(linking.source.description, linkDate ?? today)}
        <fieldset>
          <legend>Akun penyusutan</legend>
          <div className="form-row">{depreciationAccountFields()}</div>
        </fieldset>
        <p className="modal-note">Penyusutan baru dapat dijalankan mulai tanggal siap digunakan (IAS 16), terlepas dari kapan utangnya dilunasi.</p>
      </FormModal>

      {/* ---- Revaluation modal ---- */}
      <FormModal
        open={revaluing !== null}
        formKey={revaluing?.asset_id ?? 'revalue'}
        eyebrow="PENILAIAN ULANG"
        title={`Penilaian ulang ${revaluing?.code ?? ''}`}
        description={revaluing ? `Nilai buku saat ini ${amount(revaluing.book_value)}.` : undefined}
        submitLabel="Catat penilaian ulang"
        busy={saving}
        error={formError}
        onClose={() => setRevaluing(null)}
        onSubmit={(values) => {
          if (!revaluing) return
          return save(
            () => revalueAsset(revaluing.asset_id, {
              type: revaluationType,
              effective_date: String(values.get('effective_date')),
              amount: String(values.get('amount')),
              counterpart_account_id: String(values.get('counterpart_account_id')),
              note: String(values.get('note') || ''),
            }),
            'Penilaian ulang aset dicatat.',
            () => setRevaluing(null),
          )
        }}
      >
        <div className="form-row">
          <label>Jenis
            <select value={revaluationType} onChange={(event) => setRevaluationType(event.target.value)}>
              <option value="REVALUATION">Revaluasi (naik)</option><option value="IMPAIRMENT">Penurunan nilai</option>
            </select>
          </label>
          <label>Tanggal<input type="date" name="effective_date" defaultValue={today} required /></label>
          <label>Jumlah<MoneyInput name="amount" required /></label>
        </div>
        <label>{revaluationType === 'REVALUATION' ? 'Akun surplus revaluasi (ekuitas)' : 'Akun beban penurunan nilai'}
          <select name="counterpart_account_id" required>{counterpartAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select>
        </label>
        <label>Catatan<input name="note" /></label>
      </FormModal>

      {/* ---- Disposal modal ---- */}
      <FormModal
        open={disposing !== null}
        formKey={disposing?.asset_id ?? 'dispose'}
        eyebrow="PELEPASAN"
        title={`Lepas aset ${disposing?.code ?? ''}`}
        description={disposing ? `Selisih hasil penjualan terhadap nilai buku ${amount(disposing.book_value)} diakui sebagai laba atau rugi.` : undefined}
        submitLabel="Lepas aset"
        busy={saving}
        error={formError}
        onClose={() => setDisposing(null)}
        onSubmit={(values) => {
          if (!disposing) return
          return save(
            () => disposeAsset(disposing.asset_id, {
              disposal_date: String(values.get('disposal_date')),
              proceeds_amount: String(values.get('proceeds_amount') || '0'),
              payment_method: String(values.get('payment_method')),
              gain_loss_account_id: String(values.get('gain_loss_account_id')),
              note: String(values.get('note') || ''),
            }),
            'Pelepasan aset dicatat.',
            () => setDisposing(null),
          )
        }}
      >
        <div className="form-row">
          <label>Tanggal<input type="date" name="disposal_date" defaultValue={today} required /></label>
          <label>Hasil penjualan<MoneyInput name="proceeds_amount" defaultValue="0" /></label>
          <label>Diterima di<select name="payment_method">{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
        </div>
        <label>Akun laba/rugi pelepasan
          <select name="gain_loss_account_id" required>{resultAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select>
        </label>
        <label>Catatan<input name="note" /></label>
        <p className="modal-note">Aset yang sudah dilepas tidak dapat dikembalikan menjadi aktif. Jurnal pelepasan langsung terbentuk saat disimpan.</p>
      </FormModal>

      <ConfirmDialog
        open={depreciation.target !== null}
        title="Jalankan penyusutan?"
        confirmLabel="Jalankan penyusutan"
        busy={depreciation.busy}
        error={depreciation.error}
        onClose={depreciation.close}
        onConfirm={() => depreciation.run((row) => depreciateAsset(row.asset_id, periodDate).then(refresh))}
        description={<>
          Penyusutan <strong>{depreciation.target?.code} · {depreciation.target?.name}</strong> akan diposting sebagai jurnal satu bulan penuh dan tidak dapat dibatalkan.
          {depreciation.target && <> Aset siap digunakan sejak {depreciation.target.in_service_date}.</>}
          <label className="mt-3 block">Tanggal periode<input type="date" value={periodDate} min={depreciation.target?.in_service_date} onChange={(event) => setPeriodDate(event.target.value)} /></label>
        </>}
      />
    </section>
  )
}
