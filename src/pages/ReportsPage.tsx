import { useCallback, useEffect, useMemo, useState } from 'react'
import { getReport } from '../api/accounting'
import {
  exportReport,
  getAssetDepreciation,
  getCashFlowIndirect,
  getFixedAssetRegister,
  getGeneralLedger,
  getInventoryValuation,
  getPurchasesByItem,
  getPurchasesBySupplier,
  getSalesByCustomer,
  getSalesByItem,
  getStockCard,
  type ReportFilters,
} from '../api/analytics'
import { listItems, listWarehouses } from '../api/operations'
import type { Item, Warehouse } from '../types/operations'
import type { BalanceSheet, ProfitLoss, TrialBalance } from '../types/accounting'
import type {
  AssetDepreciationReport,
  CashFlowIndirectReport,
  FixedAssetRegisterReport,
  GeneralLedgerReport,
  InventoryValuationReport,
  ItemTurnoverReport,
  PartnerTurnoverReport,
  StockCardReport,
} from '../types/reports'
import { Badge, Button, EmptyState, PageHeader } from '../components/ui'

type ReportKey =
  | 'profit-loss' | 'balance-sheet' | 'trial-balance' | 'cash-flow-indirect' | 'general-ledger'
  | 'sales-by-customer' | 'sales-by-item' | 'purchases-by-supplier' | 'purchases-by-item'
  | 'inventory-valuation' | 'stock-card' | 'fixed-assets' | 'asset-depreciation'

type ReportGroup = { label: string; items: Array<{ key: ReportKey; label: string }> }

const groups: ReportGroup[] = [
  { label: 'Keuangan', items: [
    { key: 'profit-loss', label: 'Laba rugi' },
    { key: 'balance-sheet', label: 'Neraca' },
    { key: 'trial-balance', label: 'Neraca saldo' },
    { key: 'cash-flow-indirect', label: 'Arus kas' },
    { key: 'general-ledger', label: 'Buku besar' },
  ]},
  { label: 'Penjualan', items: [
    { key: 'sales-by-customer', label: 'Per pelanggan' },
    { key: 'sales-by-item', label: 'Per barang' },
  ]},
  { label: 'Pembelian', items: [
    { key: 'purchases-by-supplier', label: 'Per pemasok' },
    { key: 'purchases-by-item', label: 'Per barang' },
  ]},
  { label: 'Persediaan', items: [
    { key: 'inventory-valuation', label: 'Nilai persediaan' },
    { key: 'stock-card', label: 'Kartu stok' },
  ]},
  { label: 'Aset tetap', items: [
    { key: 'fixed-assets', label: 'Daftar aset' },
    { key: 'asset-depreciation', label: 'Riwayat penyusutan' },
  ]},
]

/** Reports that read a date window rather than a single closing date. */
const windowedReports = new Set<ReportKey>([
  'profit-loss', 'trial-balance', 'cash-flow-indirect', 'general-ledger',
  'sales-by-customer', 'sales-by-item', 'purchases-by-supplier', 'purchases-by-item',
  'stock-card', 'asset-depreciation',
])

export function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [report, setReport] = useState<ReportKey>('profit-loss')
  const [startDate, setStartDate] = useState(`${today.slice(0, 8)}01`)
  const [endDate, setEndDate] = useState(today)
  const [itemId, setItemId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [payload, setPayload] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.allSettled([listItems(), listWarehouses()]).then(([itemResult, warehouseResult]) => {
      if (itemResult.status === 'fulfilled') setItems(itemResult.value ?? [])
      if (warehouseResult.status === 'fulfilled') setWarehouses(warehouseResult.value ?? [])
    })
  }, [])

  const filters = useMemo<ReportFilters>(() => ({
    start_date: windowedReports.has(report) ? startDate : undefined,
    end_date: endDate,
    item_id: itemId || undefined,
    warehouse_id: warehouseId || undefined,
  }), [report, startDate, endDate, itemId, warehouseId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPayload(await fetchReport(report, filters))
    } catch (caught) {
      setPayload(null)
      setError(messageOf(caught))
    } finally {
      setLoading(false)
    }
  }, [report, filters])

  useEffect(() => { void load() }, [load])

  const needsItem = report === 'stock-card'
  const blockedOnItem = needsItem && !itemId

  return (
    <section>
      <PageHeader
        eyebrow="LAPORAN"
        title="Katalog laporan"
        description="Laporan keuangan, penjualan, pembelian, persediaan, dan aset tetap. Semua angka berasal dari jurnal dan dokumen yang telah diposting."
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            {(['csv', 'xlsx', 'pdf'] as const).map((format) => (
              <Button key={format} variant="secondary" icon="download" disabled={blockedOnItem}
                onClick={() => void exportReport(report, format, filters)}>{format.toUpperCase()}</Button>
            ))}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 text-[10px] font-bold tracking-[.14em] text-slate-400 uppercase">{group.label}</p>
            <div className="tabs !mb-0">
              {group.items.map((item) => (
                <button key={item.key} className={report === item.key ? 'active' : ''} onClick={() => setReport(item.key)}>{item.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="panel form-panel mb-4.5">
        <div className="form-row">
          {windowedReports.has(report) && (
            <label>Tanggal awal<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          )}
          <label>{windowedReports.has(report) ? 'Tanggal akhir' : 'Per tanggal'}
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          {(report === 'stock-card') && (
            <label>Produk<select value={itemId} onChange={(event) => setItemId(event.target.value)}>
              <option value="">Pilih produk</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}
            </select></label>
          )}
          {(report === 'stock-card' || report === 'inventory-valuation') && (
            <label>Gudang<select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
              <option value="">Semua gudang</option>
              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.name}</option>)}
            </select></label>
          )}
        </div>
      </div>

      <div className="panel report-panel">
        {blockedOnItem ? <EmptyState>Pilih produk untuk menampilkan kartu stok.</EmptyState>
          : loading ? <div className="loading" role="status">Menyusun laporan…</div>
          : error ? <EmptyState>{error}</EmptyState>
          : <ReportBody report={report} payload={payload} />}
      </div>
    </section>
  )
}

async function fetchReport(report: ReportKey, filters: ReportFilters): Promise<unknown> {
  switch (report) {
    case 'profit-loss': case 'balance-sheet': case 'trial-balance':
      return getReport(report, filters.start_date ?? '', filters.end_date ?? '')
    case 'cash-flow-indirect': return getCashFlowIndirect(filters)
    case 'general-ledger': return getGeneralLedger(filters)
    case 'sales-by-customer': return getSalesByCustomer(filters)
    case 'sales-by-item': return getSalesByItem(filters)
    case 'purchases-by-supplier': return getPurchasesBySupplier(filters)
    case 'purchases-by-item': return getPurchasesByItem(filters)
    case 'inventory-valuation': return getInventoryValuation(filters)
    case 'stock-card': return getStockCard(filters)
    case 'fixed-assets': return getFixedAssetRegister(filters)
    case 'asset-depreciation': return getAssetDepreciation(filters)
  }
}

function ReportBody({ report, payload }: { report: ReportKey; payload: unknown }) {
  if (!payload) return <EmptyState>Belum ada data pada filter ini.</EmptyState>
  switch (report) {
    case 'profit-loss': return <ProfitLossView report={payload as ProfitLoss} />
    case 'balance-sheet': return <BalanceSheetView report={payload as BalanceSheet} />
    case 'trial-balance': return <TrialBalanceView report={payload as TrialBalance} />
    case 'cash-flow-indirect': return <CashFlowView report={payload as CashFlowIndirectReport} />
    case 'general-ledger': return <GeneralLedgerView report={payload as GeneralLedgerReport} />
    case 'sales-by-customer': case 'purchases-by-supplier':
      return <PartnerView report={payload as PartnerTurnoverReport} label={report === 'sales-by-customer' ? 'Pelanggan' : 'Pemasok'} />
    case 'sales-by-item': case 'purchases-by-item':
      return <ItemView report={payload as ItemTurnoverReport} />
    case 'inventory-valuation': return <ValuationView report={payload as InventoryValuationReport} />
    case 'stock-card': return <StockCardView report={payload as StockCardReport} />
    case 'fixed-assets': return <AssetRegisterView report={payload as FixedAssetRegisterReport} />
    case 'asset-depreciation': return <DepreciationView report={payload as AssetDepreciationReport} />
  }
}

function Row({ label, value, strong, total }: { label: string; value: string; strong?: boolean; total?: boolean }) {
  return <div className={`report-row ${strong ? 'strong' : ''} ${total ? 'total' : ''}`}><span>{label}</span><span className="mono">{amount(value)}</span></div>
}

function ProfitLossView({ report }: { report: ProfitLoss }) {
  return <div className="statement">
    <Row label="Pendapatan" value={report.revenue} />
    <Row label="Harga pokok penjualan" value={`(${report.cost_of_goods_sold})`} />
    <Row label="Laba kotor" value={report.gross_profit} strong />
    <Row label="Beban operasional" value={`(${report.operating_expense})`} />
    <Row label="Pendapatan lain" value={report.other_income} />
    <Row label="Beban lain" value={`(${report.other_expense})`} />
    <Row label="Laba bersih" value={report.net_profit} total />
  </div>
}

function BalanceSheetView({ report }: { report: BalanceSheet }) {
  return <div className="statement">
    <Row label="Total aset" value={report.total_assets} strong />
    <Row label="Total liabilitas" value={report.total_liabilities} />
    <Row label="Ekuitas" value={report.total_equity} />
    <Row label="Laba berjalan" value={report.current_earnings} />
    <Row label="Liabilitas + ekuitas" value={report.liabilities_and_equity} total />
    <p className={report.balanced ? 'balance-ok' : 'balance-error'}>{report.balanced ? '✓ Neraca seimbang' : '⚠ Neraca tidak seimbang'}</p>
  </div>
}

function TrialBalanceView({ report }: { report: TrialBalance }) {
  if (report.rows.length === 0) return <EmptyState>Belum ada saldo akun pada periode ini.</EmptyState>
  return <>
    <div className="table-wrap"><table>
      <thead><tr><th>Kode</th><th>Akun</th><th className="number">Debit</th><th className="number">Kredit</th></tr></thead>
      <tbody>{report.rows.map((row) => (
        <tr key={row.account_id}><td className="mono">{row.account_code}</td><td>{row.account_name}</td>
          <td className="number mono">{amount(row.debit)}</td><td className="number mono">{amount(row.credit)}</td></tr>
      ))}</tbody>
      <tfoot><tr><th colSpan={2}>Total</th><th className="number">{amount(report.total_debit)}</th><th className="number">{amount(report.total_credit)}</th></tr></tfoot>
    </table></div>
    <p className={report.balanced ? 'balance-ok' : 'balance-error'}>{report.balanced ? '✓ Neraca saldo seimbang' : '⚠ Neraca saldo tidak seimbang'}</p>
  </>
}

function CashFlowView({ report }: { report: CashFlowIndirectReport }) {
  return <div className="statement">
    <p className="mb-3 text-[11px] text-slate-500">Metode tidak langsung · {report.start_date} sampai {report.end_date}</p>
    <Row label="Laba bersih" value={report.net_profit} strong />
    {report.non_cash_adjustments.map((line) => <Row key={line.account_id} label={`Penyesuaian non-kas — ${line.account_name}`} value={line.amount} />)}
    {report.working_capital_changes.map((line) => <Row key={line.account_id} label={`Modal kerja — ${line.account_name}`} value={line.amount} />)}
    <Row label="Arus kas dari operasi" value={report.operating_total} total />
    {report.investing.map((line) => <Row key={line.account_id} label={line.account_name} value={line.amount} />)}
    <Row label="Arus kas dari investasi" value={report.investing_total} strong />
    {report.financing.map((line) => <Row key={line.account_id} label={line.account_name} value={line.amount} />)}
    <Row label="Arus kas dari pendanaan" value={report.financing_total} strong />
    <Row label="Kenaikan/penurunan kas" value={report.net_change} total />
    <Row label="Kas awal" value={report.opening_cash} />
    <Row label="Kas akhir" value={report.closing_cash} strong />
    <p className={report.reconciled ? 'balance-ok' : 'balance-error'}>
      {report.reconciled ? '✓ Arus kas cocok dengan mutasi kas dan bank' : '⚠ Arus kas tidak cocok dengan mutasi kas dan bank'}
    </p>
  </div>
}

function GeneralLedgerView({ report }: { report: GeneralLedgerReport }) {
  if (report.accounts.length === 0) return <EmptyState>Belum ada mutasi pada periode ini.</EmptyState>
  return <div className="grid gap-4">
    {report.accounts.map((account) => (
      <div key={account.account_id}>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <strong className="text-sm text-slate-900"><span className="mono">{account.account_code}</span> · {account.account_name}</strong>
          <span className="text-[11px] text-slate-500">Saldo awal <span className="mono">{amount(account.opening_balance)}</span></span>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Tanggal</th><th>No. jurnal</th><th>Keterangan</th><th className="number">Debit</th><th className="number">Kredit</th><th className="number">Saldo</th></tr></thead>
          <tbody>{account.entries.map((entry, index) => (
            <tr key={`${entry.journal_id}-${index}`}>
              <td>{entry.transaction_date}</td><td className="mono">{entry.journal_number}</td><td>{entry.description}</td>
              <td className="number mono">{amount(entry.debit)}</td><td className="number mono">{amount(entry.credit)}</td>
              <td className="number mono">{amount(entry.running_balance)}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr><th colSpan={3}>Saldo akhir</th><th className="number">{amount(account.total_debit)}</th><th className="number">{amount(account.total_credit)}</th><th className="number">{amount(account.closing_balance)}</th></tr></tfoot>
        </table></div>
      </div>
    ))}
  </div>
}

function PartnerView({ report, label }: { report: PartnerTurnoverReport; label: string }) {
  if (report.rows.length === 0) return <EmptyState>Belum ada transaksi selesai pada periode ini.</EmptyState>
  return <div className="table-wrap"><table>
    <thead><tr><th>{label}</th><th className="number">Dokumen</th><th className="number">Subtotal</th><th className="number">Diskon</th><th className="number">Pajak</th><th className="number">Total</th></tr></thead>
    <tbody>{report.rows.map((row, index) => (
      <tr key={row.contact_id ?? `row-${index}`}><td>{row.contact_name}</td><td className="number mono">{row.document_count}</td>
        <td className="number mono">{amount(row.subtotal)}</td><td className="number mono">{amount(row.discount)}</td>
        <td className="number mono">{amount(row.tax)}</td><td className="number mono">{amount(row.total)}</td></tr>
    ))}</tbody>
    <tfoot><tr><th colSpan={5}>Total</th><th className="number">{amount(report.total)}</th></tr></tfoot>
  </table></div>
}

function ItemView({ report }: { report: ItemTurnoverReport }) {
  if (report.rows.length === 0) return <EmptyState>Belum ada transaksi selesai pada periode ini.</EmptyState>
  return <div className="table-wrap"><table>
    <thead><tr><th>SKU</th><th>Produk</th><th className="number">Kuantitas</th><th className="number">Subtotal</th><th className="number">Pajak</th><th className="number">Total</th></tr></thead>
    <tbody>{report.rows.map((row, index) => (
      <tr key={row.item_id ?? `row-${index}`}><td className="mono">{row.sku || '—'}</td><td>{row.item_name}</td>
        <td className="number mono">{quantity(row.quantity)}</td><td className="number mono">{amount(row.subtotal)}</td>
        <td className="number mono">{amount(row.tax)}</td><td className="number mono">{amount(row.total)}</td></tr>
    ))}</tbody>
    <tfoot><tr><th colSpan={5}>Total</th><th className="number">{amount(report.total)}</th></tr></tfoot>
  </table></div>
}

function ValuationView({ report }: { report: InventoryValuationReport }) {
  if (report.rows.length === 0) return <EmptyState>Belum ada saldo persediaan.</EmptyState>
  return <div className="table-wrap"><table>
    <thead><tr><th>SKU</th><th>Produk</th><th>Gudang</th><th className="number">Kuantitas</th><th className="number">Biaya rata-rata</th><th className="number">Nilai</th></tr></thead>
    <tbody>{report.rows.map((row) => (
      <tr key={`${row.item_id}-${row.warehouse_code}`}><td className="mono">{row.sku}</td><td>{row.item_name}</td><td>{row.warehouse_name}</td>
        <td className="number mono">{quantity(row.quantity)}</td><td className="number mono">{amount(row.average_cost)}</td>
        <td className="number mono">{amount(row.value)}</td></tr>
    ))}</tbody>
    <tfoot><tr><th colSpan={5}>Total</th><th className="number">{amount(report.total)}</th></tr></tfoot>
  </table></div>
}

function StockCardView({ report }: { report: StockCardReport }) {
  return <>
    <div className="mb-3 flex flex-wrap gap-2">
      <Badge>Saldo awal {quantity(report.opening_quantity)} · {amount(report.opening_value)}</Badge>
      <Badge tone="info">Saldo akhir {quantity(report.closing_quantity)} · {amount(report.closing_value)}</Badge>
    </div>
    {report.entries.length === 0 ? <EmptyState>Tidak ada pergerakan pada periode ini.</EmptyState> : (
      <div className="table-wrap"><table>
        <thead><tr><th>Waktu</th><th>Jenis</th><th>Dokumen</th><th className="number">Kuantitas</th><th className="number">Nilai</th><th className="number">Saldo qty</th><th className="number">Saldo nilai</th></tr></thead>
        <tbody>{report.entries.map((entry, index) => (
          <tr key={`${entry.occurred_at}-${index}`}>
            <td>{entry.occurred_at.slice(0, 10)}</td><td><span className="type-tag">{entry.movement_type}</span></td>
            <td className="mono">{entry.document_number ?? '—'}</td>
            <td className="number mono">{quantity(entry.quantity_delta)}</td><td className="number mono">{amount(entry.value_delta)}</td>
            <td className="number mono">{quantity(entry.running_quantity)}</td><td className="number mono">{amount(entry.running_value)}</td>
          </tr>
        ))}</tbody>
      </table></div>
    )}
  </>
}

function AssetRegisterView({ report }: { report: FixedAssetRegisterReport }) {
  if (report.rows.length === 0) return <EmptyState>Belum ada aset tetap.</EmptyState>
  return <div className="table-wrap"><table>
    <thead><tr><th>Kode</th><th>Aset</th><th>Perolehan</th><th>Metode</th><th>Status</th><th className="number">Harga perolehan</th><th className="number">Akumulasi</th><th className="number">Nilai buku</th></tr></thead>
    <tbody>{report.rows.map((row) => (
      <tr key={row.asset_id}><td className="mono">{row.code}</td><td>{row.name}</td><td>{row.acquisition_date}</td>
        <td><span className="type-tag">{row.depreciation_method}</span></td>
        <td><Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>{row.status}</Badge></td>
        <td className="number mono">{amount(row.acquisition)}</td><td className="number mono">{amount(row.accumulated_depreciation)}</td>
        <td className="number mono">{amount(row.book_value)}</td></tr>
    ))}</tbody>
    <tfoot><tr><th colSpan={5}>Total</th><th className="number">{amount(report.total_acquisition)}</th>
      <th className="number">{amount(report.total_accumulated_depreciation)}</th><th className="number">{amount(report.total_book_value)}</th></tr></tfoot>
  </table></div>
}

function DepreciationView({ report }: { report: AssetDepreciationReport }) {
  if (report.rows.length === 0) return <EmptyState>Belum ada penyusutan yang diposting.</EmptyState>
  return <div className="table-wrap"><table>
    <thead><tr><th>Periode</th><th>Kode</th><th>Aset</th><th className="number">Jumlah</th></tr></thead>
    <tbody>{report.rows.map((row, index) => (
      <tr key={`${row.asset_id}-${index}`}><td>{row.period_date}</td><td className="mono">{row.code}</td><td>{row.name}</td>
        <td className="number mono">{amount(row.amount)}</td></tr>
    ))}</tbody>
    <tfoot><tr><th colSpan={3}>Total</th><th className="number">{amount(report.total)}</th></tr></tfoot>
  </table></div>
}

/** Formats a plain decimal string with Indonesian digit grouping. */
export function amount(value: string): string {
  const wrapped = value.startsWith('(') && value.endsWith(')')
  const inner = wrapped ? value.slice(1, -1) : value
  const sign = inner.startsWith('-') ? '-' : ''
  const bare = sign ? inner.slice(1) : inner
  const [whole, fraction] = bare.split('.')
  if (!whole || !/^\d+$/.test(whole)) return value
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const formatted = sign + grouped + (fraction ? `,${fraction}` : '')
  return wrapped ? `(${formatted})` : formatted
}

/** Trims the six-decimal storage form down to what a human reads. */
export function quantity(value: string): string {
  if (!value.includes('.')) return value
  return value.replace(/\.?0+$/, '') || '0'
}

function messageOf(caught: unknown): string {
  const response = (caught as { response?: { data?: { error?: { details?: string }; message?: string } } }).response
  return response?.data?.error?.details ?? response?.data?.message ?? 'Laporan gagal disusun.'
}
