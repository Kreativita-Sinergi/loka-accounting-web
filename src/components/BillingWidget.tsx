import { useCallback, useEffect, useState } from 'react'
import { AxiosError } from 'axios'
import { createBillingCheckout, getBillingOrder, getSubscription, type AccountingSubscription, type BillingCheckout } from '../api/billing'
import type { IdentityProfile } from '../api/auth'
import type { ApiEnvelope } from '../types/accounting'

export function BillingWidget({ profile }: { profile: IdentityProfile }) {
  const [open, setOpen] = useState(() => sessionStorage.getItem('open_accounting_billing') === '1' || new URLSearchParams(window.location.search).has('payment'))
  const [subscription, setSubscription] = useState<AccountingSubscription | null>(null)
  const [order, setOrder] = useState<BillingCheckout | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isOwner = profile.role_code.toUpperCase() === 'OWNER'

  const refresh = useCallback(async () => {
    if (!isOwner) return
    try { setSubscription(await getSubscription()) }
    catch (cause) { setError(messageOf(cause)) }
  }, [isOwner])

  useEffect(() => {
    if (!open || !isOwner) return
    sessionStorage.removeItem('open_accounting_billing')
    void refresh()
  }, [isOwner, open, refresh])

  useEffect(() => {
    if (!open || order?.status !== 'PENDING') return
    const timer = window.setInterval(() => {
      void getBillingOrder(order.order_id).then((next) => {
        setOrder(next)
        if (next.status === 'PAID') void refresh()
      }).catch(() => undefined)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [open, order, refresh])

  if (!isOwner) return null

  async function checkout() {
    setLoading(true); setError(null)
    const paymentWindow = window.open('', '_blank')
    try {
      const next = await createBillingCheckout()
      setOrder(next)
      if (paymentWindow) {
        paymentWindow.opener = null
        paymentWindow.location.href = next.payment_url
      } else window.location.href = next.payment_url
    } catch (cause) {
      paymentWindow?.close()
      setError(messageOf(cause))
    } finally { setLoading(false) }
  }

  const active = subscription?.status === 'ACTIVE'
  return <>
    <button className={`billing-launcher ${active ? 'is-active' : ''}`} type="button" onClick={() => setOpen(true)}>
      <span>{active ? '✓' : '◇'}</span><div><small>LANGGANAN</small><strong>{active ? 'Accounting aktif' : 'Rp300.000 / bulan'}</strong></div>
    </button>
    {open && <div className="billing-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section className="billing-modal" role="dialog" aria-modal="true" aria-labelledby="billing-title">
        <button className="billing-close" type="button" aria-label="Tutup" onClick={() => setOpen(false)}>×</button>
        <p className="eyebrow">LOKA ACCOUNTING</p>
        <h2 id="billing-title">Satu paket untuk pembukuan yang lengkap.</h2>
        <div className="billing-price"><strong>Rp300.000</strong><span>/ bulan</span></div>
        <p className="billing-description">Pembayaran berlaku untuk satu organisasi selama satu bulan dan tidak diperpanjang otomatis.</p>
        <ul><li>Seluruh modul Accounting</li><li>Kolaborasi dan kontrol akses tim</li><li>Laporan, ekspor, dan audit trail</li><li>Integrasi Loka Kasir opsional</li></ul>
        {active && <div className="billing-status success"><span>✓</span><div><strong>Langganan aktif</strong><small>Berlaku sampai {formatDate(subscription.current_period_end)}</small></div></div>}
        {order?.status === 'PENDING' && <div className="billing-status pending"><span>↗</span><div><strong>Menunggu pembayaran</strong><small>Selesaikan checkout pada halaman pembayaran yang terbuka.</small></div><a href={order.payment_url} target="_blank" rel="noreferrer">Buka lagi</a></div>}
        {order?.status === 'PAID' && <div className="billing-status success"><span>✓</span><div><strong>Pembayaran berhasil</strong><small>Masa aktif organisasi sudah diperbarui.</small></div></div>}
        {error && <div className="auth-error">{error}</div>}
        <button className="landing-button billing-pay" type="button" disabled={loading || order?.status === 'PENDING'} onClick={() => void checkout()}>{loading ? 'Menyiapkan pembayaran…' : active ? 'Perpanjang 1 bulan' : 'Bayar Rp300.000'} <span>→</span></button>
        <small className="billing-footnote">Checkout diproses melalui payment gateway. Status akan diperbarui otomatis setelah pembayaran dikonfirmasi.</small>
      </section>
    </div>}
  </>
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(value))
}

function messageOf(cause: unknown) {
  if (cause instanceof AxiosError) {
    const body = cause.response?.data as ApiEnvelope<unknown> | undefined
    return body?.error?.details ?? 'Pembayaran belum dapat diproses. Coba lagi.'
  }
  return 'Pembayaran belum dapat diproses. Coba lagi.'
}
