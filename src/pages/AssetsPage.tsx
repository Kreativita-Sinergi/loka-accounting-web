import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { createFixedAsset, depreciateAsset, disposeAsset, listDisposals, listFixedAssets, revalueAsset } from '../api/assets'
import { getFixedAssetRegister } from '../api/analytics'
import type { Account } from '../types/accounting'
import type { AssetDisposal, FixedAsset, FixedAssetRegisterReport } from '../types/reports'
import { Badge, Button, EmptyState, PageHeader } from '../components/ui'
import { amount } from './ReportsPage'

const paymentMethods = ['CASH', 'QRIS', 'DEBIT_CARD', 'CREDIT_CARD', 'E_WALLET']

export function AssetsPage({ accounts, onNotice }: { accounts: Account[]; onNotice: (message: string) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [register, setRegister] = useState<FixedAssetRegisterReport | null>(null)
  const [disposals, setDisposals] = useState<AssetDisposal[]>([])
  const [selected, setSelected] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const results = await Promise.allSettled([listFixedAssets(), getFixedAssetRegister({}), listDisposals()])
    const [assetResult, registerResult, disposalResult] = results
    if (assetResult.status === 'fulfilled') setAssets(assetResult.value ?? [])
    if (registerResult.status === 'fulfilled') setRegister(registerResult.value)
    if (disposalResult.status === 'fulfilled') setDisposals(disposalResult.value ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const active = assets.filter((asset) => asset.status !== 'DISPOSED')
  const assetAccounts = accounts.filter((account) => account.type === 'ASSET')
  const expenseAccounts = accounts.filter((account) => account.type === 'EXPENSE' || account.type === 'OTHER_EXPENSE')
  const equityAccounts = accounts.filter((account) => account.type === 'EQUITY')
  const resultAccounts = accounts.filter((account) => ['OTHER_INCOME', 'OTHER_EXPENSE', 'EXPENSE', 'REVENUE'].includes(account.type))

  async function run(action: () => Promise<unknown>, success: string, form?: HTMLFormElement) {
    try {
      await action()
      form?.reset()
      await refresh()
      onNotice(success)
    } catch (error) {
      onNotice(detailOf(error, 'Perintah aset gagal dijalankan.'))
    }
  }

  function acquire(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    void run(() => createFixedAsset({
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
    }), 'Aset tetap dicatat beserta jurnal perolehannya.', form)
  }

  function revalue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    void run(() => revalueAsset(String(values.get('asset_id')), {
      type: String(values.get('type')),
      effective_date: String(values.get('effective_date')),
      amount: String(values.get('amount')),
      counterpart_account_id: String(values.get('counterpart_account_id')),
      note: String(values.get('note') || ''),
    }), 'Penilaian ulang aset dicatat.', form)
  }

  function dispose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    void run(() => disposeAsset(String(values.get('asset_id')), {
      disposal_date: String(values.get('disposal_date')),
      proceeds_amount: String(values.get('proceeds_amount') || '0'),
      payment_method: String(values.get('payment_method')),
      gain_loss_account_id: String(values.get('gain_loss_account_id')),
      note: String(values.get('note') || ''),
    }), 'Pelepasan aset dicatat.', form)
  }

  const [revaluationType, setRevaluationType] = useState('REVALUATION')
  const counterpartAccounts = revaluationType === 'REVALUATION' ? equityAccounts : expenseAccounts

  return (
    <section>
      <PageHeader eyebrow="ASET TETAP" title="Aset tetap" description="Perolehan, penyusutan bulanan, penilaian ulang atau penurunan nilai, dan pelepasan aset — semuanya langsung membentuk jurnal." />

      <div className="split-grid">
        <form className="panel form-panel" onSubmit={acquire}>
          <h2>Catat aset baru</h2>
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
          <div className="form-row">
            <label>Akun aset<select name="asset_account_id" required>{assetAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label>
            <label>Akumulasi penyusutan<select name="accumulated_depreciation_account_id" required>{assetAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label>
            <label>Beban penyusutan<select name="depreciation_expense_account_id" required>{expenseAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label>
          </div>
          <Button disabled={assetAccounts.length === 0 || expenseAccounts.length === 0}>Catat aset</Button>
        </form>

        <div className="grid gap-4.5">
          <form className="panel form-panel" onSubmit={revalue}>
            <h2>Penilaian ulang / penurunan nilai</h2>
            <div className="form-row">
              <label>Aset<select name="asset_id" required>{active.map((asset) => <option key={asset.id} value={asset.id}>{asset.code} · {asset.name}</option>)}</select></label>
              <label>Jenis<select name="type" value={revaluationType} onChange={(event) => setRevaluationType(event.target.value)}>
                <option value="REVALUATION">Revaluasi (naik)</option><option value="IMPAIRMENT">Penurunan nilai</option>
              </select></label>
            </div>
            <div className="form-row">
              <label>Tanggal<input type="date" name="effective_date" defaultValue={today} required /></label>
              <label>Jumlah<input name="amount" inputMode="numeric" required /></label>
            </div>
            <label>{revaluationType === 'REVALUATION' ? 'Akun surplus revaluasi (ekuitas)' : 'Akun beban penurunan nilai'}
              <select name="counterpart_account_id" required>{counterpartAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select>
            </label>
            <label>Catatan<input name="note" /></label>
            <Button disabled={active.length === 0 || counterpartAccounts.length === 0}>Catat penilaian ulang</Button>
          </form>

          <form className="panel form-panel" onSubmit={dispose}>
            <h2>Pelepasan aset</h2>
            <div className="form-row">
              <label>Aset<select name="asset_id" required>{active.map((asset) => <option key={asset.id} value={asset.id}>{asset.code} · {asset.name}</option>)}</select></label>
              <label>Tanggal<input type="date" name="disposal_date" defaultValue={today} required /></label>
            </div>
            <div className="form-row">
              <label>Hasil penjualan<input name="proceeds_amount" inputMode="numeric" defaultValue="0" /></label>
              <label>Diterima di<select name="payment_method">{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
            </div>
            <label>Akun laba/rugi pelepasan<select name="gain_loss_account_id" required>{resultAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></label>
            <label>Catatan<input name="note" /></label>
            <Button disabled={active.length === 0 || resultAccounts.length === 0}>Lepas aset</Button>
          </form>
        </div>
      </div>

      <div className="panel data-panel">
        <div className="panel-heading">
          <div><h2>Daftar aset</h2><p>Nilai buku sudah memperhitungkan revaluasi dan penurunan nilai.</p></div>
          <Badge tone="info">{assets.length} aset</Badge>
        </div>
        {loading ? <div className="loading" role="status">Memuat aset…</div>
          : !register || register.rows.length === 0 ? <EmptyState>Belum ada aset tetap.</EmptyState>
          : <div className="table-wrap"><table>
              <thead><tr><th>Kode</th><th>Aset</th><th>Metode</th><th>Status</th><th className="number">Perolehan</th><th className="number">Akumulasi</th><th className="number">Nilai buku</th><th /></tr></thead>
              <tbody>{register.rows.map((row) => (
                <tr key={row.asset_id}>
                  <td className="mono">{row.code}</td>
                  <td>{row.name}<small className="block text-slate-400">{row.acquisition_date}{row.last_depreciation_period && ` · penyusutan terakhir ${row.last_depreciation_period}`}</small></td>
                  <td><span className="type-tag">{row.depreciation_method}</span></td>
                  <td><Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>{row.status}</Badge></td>
                  <td className="number mono">{amount(row.acquisition)}</td>
                  <td className="number mono">{amount(row.accumulated_depreciation)}</td>
                  <td className="number mono">{amount(row.book_value)}</td>
                  <td>{row.status === 'ACTIVE' && (
                    <Button variant="secondary" onClick={() => { setSelected(row.asset_id); void run(() => depreciateAsset(row.asset_id, today), `Penyusutan ${row.code} diposting.`) }}
                      disabled={selected === row.asset_id && loading}>Susutkan</Button>
                  )}</td>
                </tr>
              ))}</tbody>
              <tfoot><tr><th colSpan={4}>Total</th><th className="number">{amount(register.total_acquisition)}</th>
                <th className="number">{amount(register.total_accumulated_depreciation)}</th>
                <th className="number">{amount(register.total_book_value)}</th><th /></tr></tfoot>
            </table></div>}
      </div>

      {disposals.length > 0 && (
        <div className="panel data-panel">
          <div className="panel-heading"><div><h2>Riwayat pelepasan</h2><p>Selisih hasil penjualan terhadap nilai buku menjadi laba atau rugi.</p></div></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Tanggal</th><th>Aset</th><th className="number">Hasil</th><th className="number">Nilai buku</th><th className="number">Laba/rugi</th></tr></thead>
            <tbody>{disposals.map((disposal) => {
              const asset = assets.find((candidate) => candidate.id === disposal.fixed_asset_id)
              return (
                <tr key={disposal.id}>
                  <td>{disposal.disposal_date.slice(0, 10)}</td>
                  <td>{asset ? `${asset.code} · ${asset.name}` : disposal.fixed_asset_id.slice(0, 8)}</td>
                  <td className="number mono">{disposal.proceeds_minor.toLocaleString('id-ID')}</td>
                  <td className="number mono">{disposal.carrying_minor.toLocaleString('id-ID')}</td>
                  <td className={`number mono ${disposal.result_minor < 0 ? 'text-orange-700' : 'text-emerald-700'}`}>{disposal.result_minor.toLocaleString('id-ID')}</td>
                </tr>
              )
            })}</tbody>
          </table></div>
        </div>
      )}
    </section>
  )
}

function detailOf(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { error?: { details?: string }; message?: string } } }).response
  return response?.data?.error?.details ?? response?.data?.message ?? fallback
}
