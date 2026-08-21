import { useCallback, useEffect, useState } from 'react'
import { createFixedAsset, depreciateAsset, disposeAsset, listDisposals, listFixedAssets, revalueAsset } from '../api/assets'
import { getFixedAssetRegister } from '../api/analytics'
import type { Account } from '../types/accounting'
import type { AssetDisposal, FixedAsset, FixedAssetRegisterReport } from '../types/reports'
import { Badge, DataEntryGuide, PageHeader } from '../components/ui'
import { AddButton, DataTable, TablePanel, type Column } from '../components/DataTable'
import { ConfirmDialog, FormModal, messageOf, useConfirm } from '../components/Modal'
import { amount } from './ReportsPage'

const paymentMethods = ['CASH', 'QRIS', 'DEBIT_CARD', 'CREDIT_CARD', 'E_WALLET']

type RegisterRow = FixedAssetRegisterReport['rows'][number]

export function AssetsPage({ accounts, onNotice }: { accounts: Account[]; onNotice: (message: string) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [register, setRegister] = useState<FixedAssetRegisterReport | null>(null)
  const [disposals, setDisposals] = useState<AssetDisposal[]>([])
  const [loading, setLoading] = useState(true)

  const [acquireOpen, setAcquireOpen] = useState(false)
  const [revaluing, setRevaluing] = useState<RegisterRow | null>(null)
  const [disposing, setDisposing] = useState<RegisterRow | null>(null)
  const [revaluationType, setRevaluationType] = useState('REVALUATION')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const depreciation = useConfirm<RegisterRow>()

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([listFixedAssets(), getFixedAssetRegister({}), listDisposals()])
    const [assetResult, registerResult, disposalResult] = results
    if (assetResult.status === 'fulfilled') setAssets(assetResult.value ?? [])
    if (registerResult.status === 'fulfilled') setRegister(registerResult.value)
    if (disposalResult.status === 'fulfilled') setDisposals(disposalResult.value ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const assetAccounts = accounts.filter((account) => account.type === 'ASSET')
  const expenseAccounts = accounts.filter((account) => account.type === 'EXPENSE' || account.type === 'OTHER_EXPENSE')
  const equityAccounts = accounts.filter((account) => account.type === 'EQUITY')
  const resultAccounts = accounts.filter((account) => ['OTHER_INCOME', 'OTHER_EXPENSE', 'EXPENSE', 'REVENUE'].includes(account.type))
  const counterpartAccounts = revaluationType === 'REVALUATION' ? equityAccounts : expenseAccounts

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
      setFormError(messageOf(error, 'Perintah aset gagal dijalankan.'))
    } finally {
      setSaving(false)
    }
  }

  const columns: Array<Column<RegisterRow>> = [
    { header: 'Kode', className: 'mono', width: '120px', cell: (row) => row.code },
    { header: 'Aset', cell: (row) => <><strong>{row.name}</strong><small className="block">{row.acquisition_date}{row.last_depreciation_period && ` · penyusutan terakhir ${row.last_depreciation_period}`}</small></> },
    { header: 'Metode', cell: (row) => <span className="type-tag">{row.depreciation_method}</span> },
    { header: 'Status', cell: (row) => <Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>{row.status}</Badge> },
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

  const missingAccounts = assetAccounts.length === 0 || expenseAccounts.length === 0

  return (
    <section>
      <PageHeader
        eyebrow="ASET TETAP"
        title="Aset tetap"
        description="Perolehan, penyusutan bulanan, penilaian ulang atau penurunan nilai, dan pelepasan aset — semuanya langsung membentuk jurnal."
        action={<AddButton onClick={() => { setAcquireOpen(true); setFormError(null) }} disabled={missingAccounts} title={missingAccounts ? 'Buat akun aset dan akun beban lebih dulu' : undefined}>Catat aset</AddButton>}
      />
      <DataEntryGuide
        steps={[
          'Klik “Catat aset”, isi identitas aset, tanggal dan harga perolehan, nilai residu, serta umur manfaat.',
          'Pilih metode penyusutan dan tiga akun: aset, akumulasi penyusutan, dan beban penyusutan.',
          'Gunakan menu aksi (titik tiga) pada baris aset untuk menjalankan penyusutan bulanan.',
          'Gunakan “Penilaian ulang” atau “Lepas aset” pada menu yang sama hanya ketika kejadian tersebut benar-benar terjadi.',
        ]}
        note="Semua tindakan aset membentuk jurnal dan tidak dapat dibatalkan. Periksa tanggal, nominal, dan akun sebelum menyimpan."
      />

      <TablePanel
        title="Daftar aset"
        description="Nilai buku sudah memperhitungkan revaluasi dan penurunan nilai."
        badge={`${assets.length} aset`}
        badgeTone="info"
        className="!mt-0"
        action={<AddButton onClick={() => { setAcquireOpen(true); setFormError(null) }} disabled={missingAccounts}>Catat aset</AddButton>}
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
              <th colSpan={4}>Total</th>
              <th className="number">{amount(register.total_acquisition)}</th>
              <th className="number">{amount(register.total_accumulated_depreciation)}</th>
              <th className="number">{amount(register.total_book_value)}</th>
              <th />
            </tr></tfoot>
          )}
        />
      </TablePanel>

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
        title="Catat aset baru"
        description="Perolehan langsung membentuk jurnal dengan metode pembayaran yang dipilih."
        submitLabel="Catat aset"
        busy={saving}
        error={formError}
        onClose={() => setAcquireOpen(false)}
        onSubmit={(values) => save(
          () => createFixedAsset({
            code: String(values.get('code')),
            name: String(values.get('name')),
            acquisition_date: String(values.get('acquisition_date')),
            acquisition_amount: String(values.get('acquisition_amount')),
            residual_amount: String(values.get('residual_amount') || '0'),
            useful_life_months: Number(values.get('useful_life_months')),
            depreciation_method: String(values.get('depreciation_method')),
            payment_method: String(values.get('payment_method')),
            asset_account_id: String(values.get('asset_account_id')),
            accumulated_depreciation_account_id: String(values.get('accumulated_depreciation_account_id')),
            depreciation_expense_account_id: String(values.get('depreciation_expense_account_id')),
          }),
          'Aset tetap dicatat beserta jurnal perolehannya.',
          () => setAcquireOpen(false),
        )}
      >
        <div className="form-row">
          <label>Kode<input name="code" required /></label>
          <label>Nama<input name="name" required /></label>
        </div>
        <div className="form-row">
          <label>Tanggal perolehan<input type="date" name="acquisition_date" defaultValue={today} required /></label>
          <label>Harga perolehan<input name="acquisition_amount" inputMode="numeric" required /></label>
          <label>Nilai residu<input name="residual_amount" inputMode="numeric" defaultValue="0" /></label>
        </div>
        <div className="form-row">
          <label>Umur manfaat (bulan)<input name="useful_life_months" type="number" min={1} defaultValue={60} required /></label>
          <label>Metode<select name="depreciation_method"><option value="STRAIGHT_LINE">Garis lurus</option><option value="DOUBLE_DECLINING">Saldo menurun berganda</option></select></label>
          <label>Dibayar dari<select name="payment_method">{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
        </div>
        <fieldset>
          <legend>Akun jurnal</legend>
          <div className="form-row">
            <label>Akun aset<select name="asset_account_id" required>{assetAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label>
            <label>Akumulasi penyusutan<select name="accumulated_depreciation_account_id" required>{assetAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label>
            <label>Beban penyusutan<select name="depreciation_expense_account_id" required>{expenseAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label>
          </div>
        </fieldset>
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
          <label>Jumlah<input name="amount" inputMode="numeric" required /></label>
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
          <label>Hasil penjualan<input name="proceeds_amount" inputMode="numeric" defaultValue="0" /></label>
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
        title="Jalankan penyusutan bulan ini?"
        confirmLabel="Jalankan penyusutan"
        busy={depreciation.busy}
        error={depreciation.error}
        onClose={depreciation.close}
        onConfirm={() => depreciation.run((row) => depreciateAsset(row.asset_id, today).then(refresh))}
        description={<>Penyusutan <strong>{depreciation.target?.code} · {depreciation.target?.name}</strong> untuk periode {today} akan diposting sebagai jurnal dan tidak dapat dibatalkan.</>}
      />
    </section>
  )
}
