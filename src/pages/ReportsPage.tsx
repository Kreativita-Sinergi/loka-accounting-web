import { useEffect, useState } from 'react'
import { getReport } from '../api/accounting'
import { downloadReport } from '../api/operations'
import type { BalanceSheet, ProfitLoss, TrialBalance } from '../types/accounting'
import { Button, PageHeader } from '../components/ui'

type ReportTab = 'trial-balance' | 'profit-loss' | 'balance-sheet'

export function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(`${today.slice(0, 8)}01`)
  const [endDate, setEndDate] = useState(today)
  const [tab, setTab] = useState<ReportTab>('profit-loss')
  const [report, setReport] = useState<TrialBalance | ProfitLoss | BalanceSheet | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getReport(tab, startDate, endDate).then(setReport).finally(() => setLoading(false))
  }, [tab, startDate, endDate])

  return (
    <section>
      <PageHeader eyebrow="FINANCIAL REPORTS" title="Laporan keuangan" description="Semua angka berasal dari jurnal yang telah diposting." action={<div className="flex gap-1 items-center"><div className="date-filter"><input aria-label="Tanggal awal laporan" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /><span>—</span><input aria-label="Tanggal akhir laporan" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div>{(['csv','xlsx','pdf'] as const).map(format => <Button key={format} variant="secondary" onClick={() => void downloadReport(tab, format, startDate, endDate)}>{format.toUpperCase()}</Button>)}</div>} />
      <div className="tabs">{(['profit-loss', 'balance-sheet', 'trial-balance'] as ReportTab[]).map((item) => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item === 'profit-loss' ? 'Laba Rugi' : item === 'balance-sheet' ? 'Neraca' : 'Neraca Saldo'}</button>)}</div>
      <div className="panel report-panel">{loading ? <div className="loading">Menyusun laporan…</div> : <ReportContent report={report} />}</div>
    </section>
  )
}

function ReportContent({ report }: { report: TrialBalance | ProfitLoss | BalanceSheet | null }) {
  if (!report) return <div className="loading">Belum ada laporan.</div>
  if ('net_profit' in report) return <div className="statement"><ReportRow label="Pendapatan" value={report.revenue} /><ReportRow label="Harga pokok penjualan" value={`(${report.cost_of_goods_sold})`} /><ReportRow label="Laba kotor" value={report.gross_profit} strong /><ReportRow label="Beban operasional" value={`(${report.operating_expense})`} /><ReportRow label="Pendapatan lain" value={report.other_income} /><ReportRow label="Beban lain" value={`(${report.other_expense})`} /><ReportRow label="Laba bersih" value={report.net_profit} total /></div>
  if ('total_assets' in report) return <div className="statement"><ReportRow label="Total aset" value={report.total_assets} strong /><ReportRow label="Total liabilitas" value={report.total_liabilities} /><ReportRow label="Ekuitas" value={report.total_equity} /><ReportRow label="Laba berjalan" value={report.current_earnings} /><ReportRow label="Liabilitas + ekuitas" value={report.liabilities_and_equity} total /><p className={report.balanced ? 'balance-ok' : 'balance-error'}>{report.balanced ? '✓ Neraca seimbang' : '⚠ Neraca tidak seimbang'}</p></div>
  return <>{report.rows.length === 0 ? <div className="table-empty">Belum ada saldo akun pada periode ini.</div> : <table><thead><tr><th>Kode</th><th>Akun</th><th className="number">Debit</th><th className="number">Kredit</th></tr></thead><tbody>{report.rows.map((row) => <tr key={row.account_id}><td className="mono">{row.account_code}</td><td>{row.account_name}</td><td className="number">{row.debit}</td><td className="number">{row.credit}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Total</th><th className="number">{report.total_debit}</th><th className="number">{report.total_credit}</th></tr></tfoot></table>}<p className={report.balanced ? 'balance-ok' : 'balance-error'}>{report.balanced ? '✓ Neraca saldo seimbang' : '⚠ Neraca saldo tidak seimbang'}</p></>
}

function ReportRow({ label, value, strong, total }: { label: string; value: string; strong?: boolean; total?: boolean }) {
  return <div className={`report-row ${strong ? 'strong' : ''} ${total ? 'total' : ''}`}><span>{label}</span><span className="mono">{value}</span></div>
}
