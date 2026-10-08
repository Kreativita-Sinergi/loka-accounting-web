import { useState } from 'react'
import { AxiosError } from 'axios'
import { downloadBillingInvoice, type BillingHistoryOrder } from '../api/billing'
import type { ApiEnvelope } from '../types/accounting'

const statuses: Record<BillingHistoryOrder['status'], string> = {
  PAID: 'Lunas', PENDING: 'Menunggu pembayaran', EXPIRED: 'Kedaluwarsa', CANCELLED: 'Dibatalkan', FAILED: 'Gagal',
}
const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
function date(value: string) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

export function BillingHistory({ orders, loading, error, onRefresh }: {
  orders: BillingHistoryOrder[]; loading: boolean; error: string | null; onRefresh: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function run(id: string, action: () => Promise<void>, success: string) {
    setBusy(id); setActionError(null); setNotice(null)
    try { await action(); setNotice(success) }
    catch (cause) {
      let body = cause instanceof AxiosError ? cause.response?.data : undefined
      if (body instanceof Blob) { try { body = JSON.parse(await body.text()) } catch { body = undefined } }
      setActionError((body as ApiEnvelope<unknown> | undefined)?.error?.details ?? 'Invoice belum dapat diproses. Coba lagi.')
    } finally { setBusy(null) }
  }

  return <section className="billing-history" aria-labelledby="billing-history-title">
    <div className="billing-history-heading"><h3 id="billing-history-title">Riwayat langganan</h3><button type="button" onClick={onRefresh} disabled={loading}>Muat ulang</button></div>
    {notice && <p className="billing-history-notice" role="status">{notice}</p>}
    {actionError && <p className="auth-error" role="alert">{actionError}</p>}
    {loading ? <p className="billing-history-empty" role="status">Memuat riwayat…</p> : error ? <p className="auth-error" role="alert">{error}</p> : orders.length === 0 ? <p className="billing-history-empty">Belum ada pembayaran langganan. Invoice tersedia setelah pembayaran lunas.</p> : <ul className="billing-history-list">
      {orders.map((order) => <li key={order.id}>
        <div className="billing-history-row"><div><strong>Langganan 1 bulan</strong><small>{date(order.created_at)} · LA-{order.id}</small></div><div className="billing-history-amount"><strong>{money.format(order.amount)}</strong><span className={`billing-order-status status-${order.status.toLowerCase()}`}>{statuses[order.status] ?? order.status}</span></div></div>
        {order.period_start && order.period_end && <p className="billing-history-period">Periode {date(order.period_start)} – {date(order.period_end)}</p>}
        {order.status === 'PAID' && <div className="billing-history-actions">
          <button type="button" disabled={busy !== null} onClick={() => void run(order.id, () => downloadBillingInvoice(order.id), 'Invoice berhasil diunduh.')}>{busy === order.id ? 'Memproses…' : 'Unduh invoice PDF'}</button>
        </div>}

      </li>)}
    </ul>}
  </section>
}
