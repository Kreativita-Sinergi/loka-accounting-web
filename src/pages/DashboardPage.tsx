import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAging, getReport } from '../api/accounting'
import { getCashFlowIndirect, getSalesByCustomer, getSalesByItem } from '../api/analytics'
import type { AgingBucket, AgingReport, BalanceSheet, ProfitLoss } from '../types/accounting'
import type { ItemTurnoverReport, PartnerTurnoverReport } from '../types/reports'
import { decimal, formatMinor, formatMoney } from '../lib/money'
import { useLedgerRefresh } from '../lib/refresh'
import { Card, EmptyState, PageHeader } from '../components/ui'
import { DataTable, TablePanel, type Column } from '../components/DataTable'
import { messageOf } from '../components/Modal'

/**
 * Dashboard pemantauan usaha: satu halaman yang menjawab "bagaimana usaha
 * berjalan" — pendapatan dan beban, laba, posisi kas, piutang dan utang, serta
 * penyumbang omzet terbesar. Seluruh angkanya berasal dari laporan yang sama
 * dengan modul Laporan, jadi tidak ada perhitungan tandingan di sisi web.
 */

/** Dua warna seri yang dipakai grafik; lolos uji keterbacaan buta warna. */
const REVENUE_COLOR = '#155eef'
const EXPENSE_COLOR = '#E8175D'

type Period = { key: string; label: string; months: number }

const periods: Period[] = [
  { key: 'month', label: 'Bulan ini', months: 1 },
  { key: 'quarter', label: '3 bulan terakhir', months: 3 },
  { key: 'half', label: '6 bulan terakhir', months: 6 },
  { key: 'year', label: '12 bulan terakhir', months: 12 },
]

const iso = (date: Date) => date.toISOString().slice(0, 10)
/** Neraca bersifat kumulatif, jadi dibaca sejak sebelum transaksi pertama. */
const beginning = '1900-01-01'
const monthLabel = (date: Date) => date.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })

/** Awal bulan ke-`back` sebelum bulan berjalan, dalam UTC agar bebas zona waktu. */
function monthStart(back: number) {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))
}

function monthEnd(back: number) {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back + 1, 0))
}

/** Total beban usaha: harga pokok, beban operasional, dan beban lain-lain. */
const totalExpense = (report: ProfitLoss) =>
  decimal(report.cost_of_goods_sold) + decimal(report.operating_expense) + decimal(report.other_expense)

type MonthlyPoint = { label: string; revenue: number; expense: number; profit: number }

type Snapshot = {
  profitLoss: ProfitLoss
  balanceSheet: BalanceSheet
  aging: AgingReport
  closingCash: number
  monthly: MonthlyPoint[]
  customers: PartnerTurnoverReport
  items: ItemTurnoverReport
}

export function DashboardPage({ scale }: { scale: number }) {
  const [period, setPeriod] = useState<Period>(periods[0])
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'chart' | 'table'>('chart')

  const startDate = iso(monthStart(period.months - 1))
  const endDate = iso(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Tren selalu dilihat enam bulan ke belakang agar musiman usaha terbaca,
      // terlepas dari periode yang dipilih untuk kartu ringkasan.
      const trendMonths = [5, 4, 3, 2, 1, 0]
      const [profitLoss, balanceSheet, aging, cashFlow, customers, items, ...trend] = await Promise.all([
        getReport<ProfitLoss>('profit-loss', startDate, endDate),
        getReport<BalanceSheet>('balance-sheet', beginning, endDate),
        getAging(endDate),
        getCashFlowIndirect({ start_date: startDate, end_date: endDate }),
        getSalesByCustomer({ start_date: startDate, end_date: endDate }),
        getSalesByItem({ start_date: startDate, end_date: endDate }),
        ...trendMonths.map((back) => getReport<ProfitLoss>('profit-loss', iso(monthStart(back)), iso(monthEnd(back)))),
      ])
      setSnapshot({
        profitLoss,
        balanceSheet,
        aging,
        closingCash: decimal(cashFlow.closing_cash),
        customers,
        items,
        monthly: trend.map((report, index) => ({
          label: monthLabel(monthStart(trendMonths[index])),
          revenue: decimal(report.revenue),
          expense: totalExpense(report),
          profit: decimal(report.net_profit),
        })),
      })
      setError(null)
    } catch (caught) {
      setSnapshot(null)
      setError(messageOf(caught, 'Data pemantauan gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { void load() }, [load])
  useLedgerRefresh(() => void load())

  // Laporan mengirim nilai dalam satuan utama, sedangkan aging dalam minor unit.
  const money = useCallback((value: number) => formatMoney(value, scale), [scale])
  const minor = useCallback((value: number) => formatMinor(value, scale), [scale])

  const summary = useMemo(() => {
    if (!snapshot) return null
    const revenue = decimal(snapshot.profitLoss.revenue)
    const expense = totalExpense(snapshot.profitLoss)
    const profit = decimal(snapshot.profitLoss.net_profit)
    return {
      revenue,
      expense,
      profit,
      grossProfit: decimal(snapshot.profitLoss.gross_profit),
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      receivable: snapshot.aging.receivables,
      payable: snapshot.aging.payables,
    }
  }, [snapshot])

  return (
    <section>
      <PageHeader
        eyebrow="PANTAU USAHA"
        title="Dashboard pemantauan usaha"
        description="Ringkasan kinerja, posisi kas, dan kewajiban usaha — dihitung dari jurnal yang sudah diposting."
        action={
          <div className="page-actions">
            <div className="tabs !mb-0">
              {periods.map((option) => (
                <button key={option.key} type="button" className={option.key === period.key ? 'active' : undefined} onClick={() => setPeriod(option)}>{option.label}</button>
              ))}
            </div>
          </div>
        }
      />

      {loading && !snapshot && <div className="loading" role="status">Memuat data usaha…</div>}
      {error && !snapshot && <EmptyState icon="reports">{error}</EmptyState>}

      {snapshot && summary && <>
        <p className="text-[11px] mb-3" style={{ color: 'var(--fg-muted)' }}>
          Periode {startDate} sampai {endDate}. Nilai dalam mata uang fungsional organisasi.
        </p>

        <div className="metric-grid">
          <Card className="metric"><span>Pendapatan</span><strong className="mono">{money(summary.revenue)}</strong><small>Seluruh penjualan pada periode</small></Card>
          <Card className="metric"><span>Beban usaha</span><strong className="mono">{money(summary.expense)}</strong><small>HPP + beban operasional + beban lain</small></Card>
          <Card className="metric">
            <span>Laba bersih</span>
            <strong className="mono" style={{ color: summary.profit < 0 ? 'var(--danger)' : 'var(--success)' }}>{money(summary.profit)}</strong>
            <small>Margin {summary.margin.toFixed(1)}% dari pendapatan</small>
          </Card>
          <Card className="metric"><span>Kas & bank</span><strong className="mono">{money(snapshot.closingCash)}</strong><small>Saldo akhir periode</small></Card>
        </div>

        <div className="metric-grid mt-3">
          <Card className="metric"><span>Piutang beredar</span><strong className="mono">{minor(summary.receivable.total_minor)}</strong><small>Jatuh tempo &gt; 90 hari: {minor(summary.receivable.over_90_minor)}</small></Card>
          <Card className="metric"><span>Utang beredar</span><strong className="mono">{minor(summary.payable.total_minor)}</strong><small>Jatuh tempo &gt; 90 hari: {minor(summary.payable.over_90_minor)}</small></Card>
          <Card className="metric"><span>Total aset</span><strong className="mono">{money(decimal(snapshot.balanceSheet.total_assets))}</strong><small>Posisi per {endDate}</small></Card>
          <Card className="metric"><span>Ekuitas</span><strong className="mono">{money(decimal(snapshot.balanceSheet.total_equity))}</strong><small>{snapshot.balanceSheet.balanced ? 'Neraca seimbang' : 'Neraca belum seimbang'}</small></Card>
        </div>

        <TablePanel
          title="Pendapatan dan beban enam bulan terakhir"
          description="Membaca arah usaha: batang biru pendapatan, merah beban."
          action={
            <div className="tabs !mb-0">
              <button type="button" className={view === 'chart' ? 'active' : undefined} onClick={() => setView('chart')}>Grafik</button>
              <button type="button" className={view === 'table' ? 'active' : undefined} onClick={() => setView('table')}>Tabel</button>
            </div>
          }
        >
          {view === 'chart'
            ? <TrendChart points={snapshot.monthly} money={money} />
            : <DataTable
                search={false}
                columns={trendColumns(money)}
                rows={snapshot.monthly}
                keyOf={(point) => point.label}
                empty="Belum ada mutasi pada enam bulan terakhir."
              />}
        </TablePanel>

        <div className="split-grid mt-4.5">
          <TablePanel title="Pelanggan penyumbang omzet" description="Lima pelanggan dengan nilai penjualan tertinggi." className="!mt-0" badge={`Total ${money(decimal(snapshot.customers.total))}`}>
            <DataTable
              search={false}
              columns={[
                { header: 'Pelanggan', sortValue: (row) => row.contact_name, cell: (row) => row.contact_name },
                { header: 'Dokumen', align: 'right', width: '100px', sortValue: (row) => row.document_count, cell: (row) => row.document_count },
                { header: 'Nilai', align: 'right', className: 'mono', width: '150px', sortValue: (row) => decimal(row.total), cell: (row) => money(decimal(row.total)) },
              ] as Array<Column<PartnerTurnoverReport['rows'][number]>>}
              rows={snapshot.customers.rows.slice(0, 5)}
              keyOf={(row) => row.contact_id ?? row.contact_name}
              empty="Belum ada penjualan pada periode ini."
            />
          </TablePanel>

          <TablePanel title="Barang paling laku" description="Lima barang dengan nilai penjualan tertinggi." className="!mt-0" badge={`Total ${money(decimal(snapshot.items.total))}`}>
            <DataTable
              search={false}
              columns={[
                { header: 'Barang', sortValue: (row) => row.item_name, cell: (row) => <><strong>{row.item_name}</strong><small className="block mono">{row.sku}</small></> },
                { header: 'Kuantitas', align: 'right', width: '110px', sortValue: (row) => decimal(row.quantity), cell: (row) => row.quantity },
                { header: 'Nilai', align: 'right', className: 'mono', width: '150px', sortValue: (row) => decimal(row.total), cell: (row) => money(decimal(row.total)) },
              ] as Array<Column<ItemTurnoverReport['rows'][number]>>}
              rows={snapshot.items.rows.slice(0, 5)}
              keyOf={(row) => row.item_id ?? row.sku ?? row.item_name}
              empty="Belum ada penjualan barang pada periode ini."
            />
          </TablePanel>
        </div>

        <TablePanel title="Umur piutang dan utang" description={`Posisi per ${snapshot.aging.as_of}.`} badge="Aging">
          <DataTable
            search={false}
            columns={agingColumns(minor)}
            rows={[
              { label: 'Piutang usaha', bucket: snapshot.aging.receivables },
              { label: 'Utang usaha', bucket: snapshot.aging.payables },
            ]}
            keyOf={(row) => row.label}
            empty="Belum ada piutang atau utang."
          />
        </TablePanel>
      </>}
    </section>
  )
}

function trendColumns(money: (value: number) => string): Array<Column<MonthlyPoint>> {
  return [
    { header: 'Bulan', sortValue: (point) => point.label, cell: (point) => point.label },
    { header: 'Pendapatan', align: 'right', className: 'mono', sortValue: (point) => point.revenue, cell: (point) => money(point.revenue) },
    { header: 'Beban', align: 'right', className: 'mono', sortValue: (point) => point.expense, cell: (point) => money(point.expense) },
    { header: 'Laba bersih', align: 'right', className: 'mono', sortValue: (point) => point.profit, cell: (point) => money(point.profit) },
  ]
}

type AgingRow = { label: string; bucket: AgingBucket }

function agingColumns(money: (value: number) => string): Array<Column<AgingRow>> {
  const bucket = (header: string, pick: (value: AgingBucket) => number): Column<AgingRow> => ({
    header,
    align: 'right',
    className: 'mono',
    sortValue: (row) => pick(row.bucket),
    cell: (row) => money(pick(row.bucket)),
  })
  return [
    { header: 'Kelompok', sortValue: (row) => row.label, cell: (row) => <strong>{row.label}</strong> },
    bucket('Belum jatuh tempo', (value) => value.current_minor),
    bucket('1–30 hari', (value) => value.days_1_30_minor),
    bucket('31–60 hari', (value) => value.days_31_60_minor),
    bucket('61–90 hari', (value) => value.days_61_90_minor),
    bucket('> 90 hari', (value) => value.over_90_minor),
    bucket('Total', (value) => value.total_minor),
  ]
}

/** Angka ringkas untuk sumbu: 12.500.000 → 12,5 jt. */
function compact(value: number): string {
  const units: Array<[number, string]> = [[1_000_000_000, ' M'], [1_000_000, ' jt'], [1_000, ' rb']]
  for (const [size, suffix] of units) {
    if (Math.abs(value) >= size) return (value / size).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + suffix
  }
  return value.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

/**
 * Batang berkelompok: pendapatan dan beban per bulan pada satu sumbu, karena
 * keduanya bersatuan sama. Nilai per batang muncul lewat tooltip agar grafik
 * tidak penuh angka; tampilan tabel menyediakan angka lengkapnya.
 */
function TrendChart({ points, money }: { points: MonthlyPoint[]; money: (value: number) => string }) {
  const [hover, setHover] = useState<number | null>(null)

  const width = 720
  const height = 260
  const padding = { top: 16, right: 12, bottom: 34, left: 64 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const peak = Math.max(1, ...points.flatMap((point) => [point.revenue, point.expense]))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * peak)
  const slot = plotWidth / Math.max(points.length, 1)
  const barWidth = Math.min(18, (slot - 12) / 2)
  const y = (value: number) => padding.top + plotHeight - (value / peak) * plotHeight

  if (points.every((point) => point.revenue === 0 && point.expense === 0)) {
    return <EmptyState icon="reports">Belum ada pendapatan maupun beban pada enam bulan terakhir.</EmptyState>
  }

  return (
    <div className="chart-block">
      <div className="chart-legend">
        <span><i style={{ background: REVENUE_COLOR }} />Pendapatan</span>
        <span><i style={{ background: EXPENSE_COLOR }} />Beban usaha</span>
      </div>
      <div className="chart-canvas">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafik pendapatan dan beban enam bulan terakhir" preserveAspectRatio="xMidYMid meet">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeWidth={1} />
              <text x={padding.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={10} fill="var(--fg-subtle)">{compact(tick)}</text>
            </g>
          ))}
          {points.map((point, index) => {
            const center = padding.left + slot * index + slot / 2
            const baseline = y(0)
            return (
              <g key={point.label} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover((value) => value === index ? null : value)}>
                {/* Isi transparan tidak menerima pointer, jadi pita hover dipaksa menangkapnya. */}
                <rect x={padding.left + slot * index} y={padding.top} width={slot} height={plotHeight} fill="var(--surface-alt)" fillOpacity={hover === index ? 1 : 0} style={{ pointerEvents: 'all' }} />
                <Bar x={center - barWidth - 1} width={barWidth} top={y(point.revenue)} baseline={baseline} color={REVENUE_COLOR} />
                <Bar x={center + 1} width={barWidth} top={y(point.expense)} baseline={baseline} color={EXPENSE_COLOR} />
                <text x={center} y={height - 12} textAnchor="middle" fontSize={11} fill="var(--fg-muted)">{point.label}</text>
              </g>
            )
          })}
        </svg>
        {hover !== null && points[hover] && (
          <div className="chart-tooltip" style={{ left: `${((hover + 0.5) / points.length) * 100}%` }}>
            <strong>{points[hover].label}</strong>
            <span><i style={{ background: REVENUE_COLOR }} />Pendapatan<b className="mono">{money(points[hover].revenue)}</b></span>
            <span><i style={{ background: EXPENSE_COLOR }} />Beban<b className="mono">{money(points[hover].expense)}</b></span>
            <span><i style={{ background: 'var(--border-strong)' }} />Laba bersih<b className="mono">{money(points[hover].profit)}</b></span>
          </div>
        )}
      </div>
    </div>
  )
}

/** Satu batang dengan ujung membulat 4px yang tetap menempel pada garis nol. */
function Bar({ x, width, top, baseline, color }: { x: number; width: number; top: number; baseline: number; color: string }) {
  const height = Math.max(baseline - top, 0)
  if (height <= 0) return null
  const radius = Math.min(4, height, width / 2)
  return (
    <path
      d={`M ${x} ${baseline} L ${x} ${top + radius} Q ${x} ${top} ${x + radius} ${top} L ${x + width - radius} ${top} Q ${x + width} ${top} ${x + width} ${top + radius} L ${x + width} ${baseline} Z`}
      fill={color}
    />
  )
}
