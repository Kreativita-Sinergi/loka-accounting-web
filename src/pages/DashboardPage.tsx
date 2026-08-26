import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAging, getReport } from '../api/accounting'
import { getCashFlowIndirect, getSalesByCustomer, getSalesByItem } from '../api/analytics'
import type { AgingBucket, AgingReport, BalanceSheet, ProfitLoss } from '../types/accounting'
import type { ItemTurnoverReport, PartnerTurnoverReport } from '../types/reports'
import { decimal, formatDate, formatMinor, formatMoney } from '../lib/money'
import { useLedgerRefresh } from '../lib/refresh'
import { Card, EmptyState, PageHeader } from '../components/ui'
import { DataTable, TablePanel, type Column } from '../components/DataTable'
import { Icon } from '../components/Icon'
import { messageOf } from '../components/Modal'

/**
 * Dashboard pemantauan usaha: satu halaman yang menjawab "bagaimana usaha
 * berjalan" — kinerja periode ini beserta arahnya, posisi kas dan kewajiban,
 * lalu penyumbang omzet terbesar. Seluruh angkanya berasal dari laporan yang
 * sama dengan modul Laporan, jadi tidak ada perhitungan tandingan di web.
 */

/** Dua warna seri grafik; pasangan ini lolos uji keterbacaan buta warna. */
const REVENUE_COLOR = '#155eef'
const EXPENSE_COLOR = '#E8175D'
const PROFIT_COLOR = '#1E9E5A'
const LOSS_COLOR = '#D92D20'

/** Ramp satu warna untuk umur piutang/utang: makin tua makin pekat. */
const AGING_RAMP = ['#dbeafe', '#93c5fd', '#4b93f7', '#1d63d8', '#12377e']

type Period = { key: string; label: string; compare: string; months: number }

const periods: Period[] = [
  { key: 'month', label: 'Bulan ini', compare: 'bulan sebelumnya', months: 1 },
  { key: 'quarter', label: '3 bulan terakhir', compare: '3 bulan sebelumnya', months: 3 },
  { key: 'half', label: '6 bulan terakhir', compare: '6 bulan sebelumnya', months: 6 },
  { key: 'year', label: '12 bulan terakhir', compare: '12 bulan sebelumnya', months: 12 },
]

const iso = (date: Date) => date.toISOString().slice(0, 10)
const monthLabel = (date: Date) => date.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
/** Neraca bersifat kumulatif, jadi dibaca sejak sebelum transaksi pertama. */
const beginning = '1900-01-01'

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
  previous: ProfitLoss
  balanceSheet: BalanceSheet
  aging: AgingReport
  closingCash: number
  cashChange: number
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
      const [profitLoss, previous, balanceSheet, aging, cashFlow, customers, items, ...trend] = await Promise.all([
        getReport<ProfitLoss>('profit-loss', startDate, endDate),
        // Periode pembanding: rentang sepanjang periode berjalan, tepat sebelumnya.
        getReport<ProfitLoss>('profit-loss', iso(monthStart(period.months * 2 - 1)), iso(monthEnd(period.months))),
        getReport<BalanceSheet>('balance-sheet', beginning, endDate),
        getAging(endDate),
        getCashFlowIndirect({ start_date: startDate, end_date: endDate }),
        getSalesByCustomer({ start_date: startDate, end_date: endDate }),
        getSalesByItem({ start_date: startDate, end_date: endDate }),
        ...trendMonths.map((back) => getReport<ProfitLoss>('profit-loss', iso(monthStart(back)), iso(monthEnd(back)))),
      ])
      setSnapshot({
        profitLoss,
        previous,
        balanceSheet,
        aging,
        closingCash: decimal(cashFlow.closing_cash),
        cashChange: decimal(cashFlow.net_change),
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
  }, [startDate, endDate, period.months])

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
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      previousRevenue: decimal(snapshot.previous.revenue),
      previousExpense: totalExpense(snapshot.previous),
      previousProfit: decimal(snapshot.previous.net_profit),
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
        <p className="dash-period">
          <Icon name="reports" /> Periode <strong>{formatDate(startDate)}</strong> sampai <strong>{formatDate(endDate)}</strong>
          <span>· dibandingkan dengan {period.compare}</span>
        </p>

        <div className="kpi-grid">
          <KpiCard
            label="Pendapatan"
            value={money(summary.revenue)}
            previous={summary.previousRevenue}
            current={summary.revenue}
            hint={`Sebelumnya ${money(summary.previousRevenue)}`}
            series={snapshot.monthly.map((point) => point.revenue)}
            color={REVENUE_COLOR}
          />
          <KpiCard
            label="Beban usaha"
            value={money(summary.expense)}
            previous={summary.previousExpense}
            current={summary.expense}
            invert
            hint={`Sebelumnya ${money(summary.previousExpense)}`}
            series={snapshot.monthly.map((point) => point.expense)}
            color={EXPENSE_COLOR}
          />
          <KpiCard
            label="Laba bersih"
            value={money(summary.profit)}
            previous={summary.previousProfit}
            current={summary.profit}
            hint={`Margin ${summary.margin.toFixed(1)}% dari pendapatan`}
            series={snapshot.monthly.map((point) => point.profit)}
            color={summary.profit < 0 ? LOSS_COLOR : PROFIT_COLOR}
            emphasis
          />
          <KpiCard
            label="Kas & bank"
            value={money(snapshot.closingCash)}
            hint={`Arus kas bersih periode ini ${snapshot.cashChange >= 0 ? '+' : ''}${money(snapshot.cashChange)}`}
            color={REVENUE_COLOR}
            share={{ value: snapshot.closingCash, total: decimal(snapshot.balanceSheet.total_assets), label: 'dari total aset' }}
          />
        </div>

        <div className="split-grid mt-4.5">
          <Card className="dash-panel">
            <header><h2>Piutang dan utang</h2><p>Makin pekat warnanya, makin lama tagihan itu tertunggak. Posisi per {formatDate(snapshot.aging.as_of)}.</p></header>
            <AgingRow label="Piutang usaha" bucket={summary.receivable} format={minor} />
            <AgingRow label="Utang usaha" bucket={summary.payable} format={minor} />
            <div className="aging-legend">
              {['Belum jatuh tempo', '1–30 hari', '31–60 hari', '61–90 hari', '> 90 hari'].map((label, index) => (
                <span key={label}><i style={{ background: AGING_RAMP[index] }} />{label}</span>
              ))}
            </div>
          </Card>

          <Card className="dash-panel">
            <header><h2>Posisi neraca</h2><p>Dari mana harta usaha dibiayai — kewajiban atau modal sendiri.</p></header>
            <div className="balance-total">
              <span>Total aset</span>
              <strong className="mono">{money(decimal(snapshot.balanceSheet.total_assets))}</strong>
            </div>
            <CompositionBar
              total={decimal(snapshot.balanceSheet.total_assets)}
              parts={[
                { label: 'Liabilitas', value: decimal(snapshot.balanceSheet.total_liabilities), color: 'var(--border-strong)' },
                { label: 'Ekuitas disetor', value: decimal(snapshot.balanceSheet.total_equity), color: REVENUE_COLOR },
                { label: 'Laba berjalan', value: decimal(snapshot.balanceSheet.current_earnings), color: '#82b1fb' },
              ]}
              format={money}
            />
            <p className={snapshot.balanceSheet.balanced ? 'balance-ok' : 'balance-error'}>
              {snapshot.balanceSheet.balanced ? '✓ Neraca seimbang' : '⚠ Neraca tidak seimbang'}
            </p>
          </Card>
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
            <RankedList
              rows={snapshot.customers.rows.slice(0, 5).map((row) => ({
                key: row.contact_id ?? row.contact_name,
                title: row.contact_name,
                note: `${row.document_count} dokumen`,
                value: decimal(row.total),
              }))}
              format={money}
              empty="Belum ada penjualan pada periode ini."
            />
          </TablePanel>

          <TablePanel title="Barang paling laku" description="Lima barang dengan nilai penjualan tertinggi." className="!mt-0" badge={`Total ${money(decimal(snapshot.items.total))}`}>
            <RankedList
              rows={snapshot.items.rows.slice(0, 5).map((row) => ({
                key: row.item_id ?? row.sku ?? row.item_name,
                title: row.item_name,
                note: `${row.sku} · ${row.quantity}`,
                value: decimal(row.total),
              }))}
              format={money}
              empty="Belum ada penjualan barang pada periode ini."
            />
          </TablePanel>
        </div>
      </>}
    </section>
  )
}

/**
 * Kartu KPI: nilai periode ini, arah perubahannya terhadap periode sebelumnya,
 * dan garis enam bulan sebagai konteks. Beban memakai `invert` karena naiknya
 * beban bukan kabar baik.
 */
function KpiCard({ label, value, hint, current, previous, series, color, invert, emphasis, share }: {
  label: string
  value: string
  hint: string
  current?: number
  previous?: number
  series?: number[]
  color: string
  invert?: boolean
  emphasis?: boolean
  /** Pengganti garis tren bagi nilai posisi, yang tidak punya deret bulanan. */
  share?: { value: number; total: number; label: string }
}) {
  const change = current !== undefined && previous !== undefined && previous !== 0
    ? ((current - previous) / Math.abs(previous)) * 100
    : null
  const rising = change !== null && change > 0.05
  const falling = change !== null && change < -0.05
  const good = invert ? falling : rising

  return (
    <Card className={`kpi${emphasis ? ' is-emphasis' : ''}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value mono" style={emphasis ? { color } : undefined}>{value}</strong>
      <div className="kpi-foot">
        {change !== null && (rising || falling) && (
          <span className={`kpi-delta ${good ? 'is-good' : 'is-bad'}`}>
            <Icon name="chevron" className={rising ? 'is-up' : undefined} />
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        {change !== null && !rising && !falling && <span className="kpi-delta is-flat">stabil</span>}
        <small>{hint}</small>
      </div>
      {series && series.some((point) => point !== 0) && <Sparkline series={series} color={color} />}
      {share && share.total > 0 && (
        <div className="kpi-share">
          <div className="kpi-share-track"><i style={{ width: `${Math.min((share.value / share.total) * 100, 100)}%`, background: color }} /></div>
          <small>{((share.value / share.total) * 100).toFixed(0)}% {share.label}</small>
        </div>
      )}
    </Card>
  )
}

/** Garis enam bulan tanpa sumbu: hanya untuk membaca arah, bukan nilai. */
function Sparkline({ series, color }: { series: number[]; color: string }) {
  const width = 160
  const height = 36
  const peak = Math.max(...series)
  const floor = Math.min(0, ...series)
  const span = peak - floor || 1
  const step = series.length > 1 ? width / (series.length - 1) : width
  const y = (value: number) => height - 2 - ((value - floor) / span) * (height - 6)
  const line = series.map((value, index) => `${index === 0 ? 'M' : 'L'} ${index * step} ${y(value)}`).join(' ')
  const area = `${line} L ${width} ${height} L 0 ${height} Z`
  return (
    <svg className="kpi-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill={color} fillOpacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={width} cy={y(series[series.length - 1])} r={3} fill={color} />
    </svg>
  )
}

/** Satu baris umur tagihan: batang bertumpuk per kelompok umur. */
function AgingRow({ label, bucket, format }: { label: string; bucket: AgingBucket; format: (value: number) => string }) {
  const buckets = [
    { label: 'Belum jatuh tempo', value: bucket.current_minor },
    { label: '1–30 hari', value: bucket.days_1_30_minor },
    { label: '31–60 hari', value: bucket.days_31_60_minor },
    { label: '61–90 hari', value: bucket.days_61_90_minor },
    { label: '> 90 hari', value: bucket.over_90_minor },
  ]
  const total = bucket.total_minor
  return (
    <div className="aging-row">
      <div className="aging-head"><span>{label}</span><strong className="mono">{format(total)}</strong></div>
      {total > 0
        ? <div className="aging-bar">
            {buckets.map((item, index) => item.value > 0 && (
              <i
                key={item.label}
                style={{ width: `${(item.value / total) * 100}%`, background: AGING_RAMP[index] }}
                title={`${item.label}: ${format(item.value)}`}
              />
            ))}
          </div>
        : <div className="aging-bar is-empty"><i /></div>}
      {bucket.over_90_minor > 0
        ? <small>Jatuh tempo lebih dari 90 hari: <strong>{format(bucket.over_90_minor)}</strong></small>
        : <small>{total > 0 ? 'Tidak ada tunggakan di atas 90 hari.' : 'Belum ada tagihan beredar.'}</small>}
    </div>
  )
}

/** Batang komposisi: satu keseluruhan yang terbagi menjadi beberapa bagian. */
function CompositionBar({ total, parts, format }: {
  total: number
  parts: Array<{ label: string; value: number; color: string }>
  format: (value: number) => string
}) {
  const base = total || parts.reduce((sum, part) => sum + Math.abs(part.value), 0) || 1
  return (
    <div className="composition">
      <div className="composition-bar">
        {parts.map((part) => (
          <i key={part.label} style={{ width: `${Math.max((Math.abs(part.value) / base) * 100, 0)}%`, background: part.color }} title={`${part.label}: ${format(part.value)}`} />
        ))}
      </div>
      <div className="composition-legend">
        {parts.map((part) => (
          <span key={part.label}>
            <i style={{ background: part.color }} />
            {part.label}
            <b className="mono">{format(part.value)}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Peringkat lima besar: batang proporsional agar jarak antarposisi terbaca. */
function RankedList({ rows, format, empty }: {
  rows: Array<{ key: string; title: string; note: string; value: number }>
  format: (value: number) => string
  empty: string
}) {
  if (rows.length === 0) return <div className="ranked-empty">{empty}</div>
  const peak = Math.max(...rows.map((row) => row.value)) || 1
  return (
    <ol className="ranked">
      {rows.map((row, index) => (
        <li key={row.key}>
          <span className="ranked-index">{index + 1}</span>
          <div className="ranked-body">
            <div className="ranked-head"><strong>{row.title}</strong><b className="mono">{format(row.value)}</b></div>
            <div className="ranked-track"><i style={{ width: `${(row.value / peak) * 100}%` }} /></div>
            <small>{row.note}</small>
          </div>
        </li>
      ))}
    </ol>
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
  const height = 250
  const padding = { top: 14, right: 12, bottom: 32, left: 64 }
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
                <text x={center} y={height - 11} textAnchor="middle" fontSize={11} fontWeight={hover === index ? 700 : 400} fill={hover === index ? 'var(--fg)' : 'var(--fg-muted)'}>{point.label}</text>
              </g>
            )
          })}
        </svg>
        {hover !== null && points[hover] && (
          <div className="chart-tooltip" style={{ left: `${((hover + 0.5) / points.length) * 100}%` }}>
            <strong>{points[hover].label}</strong>
            <span><i style={{ background: REVENUE_COLOR }} />Pendapatan<b className="mono">{money(points[hover].revenue)}</b></span>
            <span><i style={{ background: EXPENSE_COLOR }} />Beban<b className="mono">{money(points[hover].expense)}</b></span>
            <span><i style={{ background: points[hover].profit < 0 ? LOSS_COLOR : PROFIT_COLOR }} />Laba bersih<b className="mono">{money(points[hover].profit)}</b></span>
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
