import { useEffect, useState, type FormEvent } from 'react'
import { adminLogin, adminOrders, changeSubscription, readAdminSession, saveAdminSession, subscriptions, type SubscriptionList, type SubscriptionRow } from './api'
import type { BillingHistoryOrder } from '../api/billing'
import { FormModal, Modal, messageOf } from '../components/Modal'
import './admin.css'

const labels = { ACTIVE: 'Aktif', TRIAL: 'Trial', EXPIRED: 'Kedaluwarsa', INACTIVE: 'Nonaktif' }
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
export default function AdminApp() {
  const [session, setSession] = useState(readAdminSession)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [data, setData] = useState<SubscriptionList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [notice, setNotice] = useState('')
  const [target, setTarget] = useState<{ row: SubscriptionRow; action: 'extend' | 'deactivate' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [history, setHistory] = useState<SubscriptionRow | null>(null)
  const [orders, setOrders] = useState<BillingHistoryOrder[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

  function logout() { saveAdminSession(null); setSession(null); setData(null); setPassword(''); setTarget(null); setHistory(null); setNotice('') }
  useEffect(() => {
    const expired = () => { saveAdminSession(null); setSession(null); setData(null); setTarget(null); setHistory(null) }
    window.addEventListener('loka:admin-unauthorized', expired)
    const timer = session ? window.setTimeout(expired, Math.max(0, Date.parse(session.expires_at) - Date.now())) : undefined
    return () => { window.removeEventListener('loka:admin-unauthorized', expired); window.clearTimeout(timer) }
  }, [session])
  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    setLoading(true); setError('')
    subscriptions(page, search, status, controller.signal).then(setData).catch(e => { if (!controller.signal.aborted) setError(messageOf(e, 'Daftar langganan gagal dimuat.')) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [session, page, search, status, refresh])
  useEffect(() => {
    if (!history) return
    const controller = new AbortController()
    setHistoryLoading(true); setHistoryError(''); setOrders([])
    adminOrders(history.organization_id, controller.signal).then(setOrders).catch(e => { if (!controller.signal.aborted) setHistoryError(messageOf(e)) }).finally(() => { if (!controller.signal.aborted) setHistoryLoading(false) })
    return () => controller.abort()
  }, [history])

  async function login(event: FormEvent) {
    event.preventDefault(); setLoginBusy(true); setLoginError('')
    try { const value = await adminLogin(username.trim(), password); saveAdminSession(value); setSession(value); setPassword('') }
    catch (e) { setLoginError(messageOf(e, 'Tidak dapat terhubung ke server. Coba lagi.')) }
    finally { setLoginBusy(false) }
  }
  async function save(values: FormData) {
    if (!target) return
    setBusy(true); setActionError('')
    try {
      await changeSubscription(target.row.organization_id, target.action, target.action === 'extend' ? Number(values.get('days')) : 0, String(values.get('reason')).trim())
      setTarget(null); setNotice('Perubahan langganan berhasil disimpan.'); setRefresh(value => value + 1)
    } catch (e) { setActionError(messageOf(e)) }
    finally { setBusy(false) }
  }
  function edit(row: SubscriptionRow, action: 'extend' | 'deactivate') { setActionError(''); setTarget({ row, action }) }

  if (!session) return <main className="admin-login"><div className="admin-login-card"><div className="admin-brand"><img src="/loka-icon.svg" alt="" /><strong>Loka Admin <small>ACCOUNTING</small></strong></div><h1>Masuk ke portal admin</h1><p>Kelola langganan dan pembayaran organisasi.</p><form onSubmit={login}><label>Username<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required autoFocus /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>{loginError && <div className="admin-error" role="alert">{loginError}</div>}<button className="admin-primary" disabled={loginBusy}>{loginBusy ? 'Memverifikasi…' : 'Masuk'}</button></form><span className="admin-login-foot">Loka Accounting · Super Admin Portal</span></div></main>

  return <div className="accounting-admin"><aside className="admin-sidebar"><div className="admin-brand"><img src="/loka-icon.svg" alt="" /><strong>Loka Admin<small>ACCOUNTING</small></strong></div><p className="admin-nav-label">PENGELOLAAN</p><a href="/admin" aria-current="page">▦ <span>Langganan</span></a><div className="admin-sidebar-foot"><span>Super Admin Portal</span><small>Loka Accounting</small></div></aside><div className="admin-workspace"><header className="admin-topbar"><span>Portal admin <b>/</b> Langganan</span><button onClick={logout}>Keluar ↗</button></header><main className="admin-content"><div className="admin-page-heading"><div><p className="admin-eyebrow">LOKA ACCOUNTING</p><h1>Langganan organisasi</h1><p>Pantau masa aktif dan kelola akses langganan pelanggan.</p></div><button disabled={loading} onClick={() => setRefresh(value => value + 1)}>↻ Muat ulang</button></div>
    {notice && <div role="status" className="admin-success">{notice}<button aria-label="Tutup notifikasi" onClick={() => setNotice('')}>×</button></div>}
    <div className="admin-stats">{([['Total organisasi', 'total'], ['Langganan aktif', 'active'], ['Dalam trial', 'trial'], ['Kedaluwarsa', 'expired']] as const).map(([label, key]) => <section key={key}><span>{label}</span><strong>{loading || error ? '—' : (data?.stats[key] ?? 0).toLocaleString('id-ID')}</strong><small>{key === 'active' ? 'Paket bulanan' : key === 'trial' ? 'Trial 30 hari' : key === 'expired' ? 'Perlu perpanjangan' : 'Seluruh organisasi'}</small></section>)}</div>
    <section className="admin-list"><div className="admin-list-heading"><h2>Daftar langganan</h2><span>{loading ? 'Memuat…' : error ? 'Data belum tersedia' : `${data?.total ?? 0} organisasi sesuai filter`}</span></div><div className="admin-filters"><form onSubmit={e => { e.preventDefault(); setSearch(input.trim()); setPage(1) }}><input aria-label="Cari organisasi" placeholder="Cari organisasi, pemilik, email, atau ID…" value={input} onChange={e => setInput(e.target.value)} /><button className="admin-primary">Cari</button></form><select aria-label="Filter status langganan" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="">Semua status</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    {error && <div className="admin-error" role="alert">{error} <button onClick={() => setRefresh(value => value + 1)}>Coba lagi</button></div>}
    <div className="admin-table-scroll"><table><thead><tr><th>Organisasi</th><th>Pemilik</th><th>Status</th><th>Masa aktif berakhir</th><th>Harga / bulan</th><th>Aksi</th></tr></thead><tbody>{loading || error || !data?.items.length ? <tr><td colSpan={6} className="admin-empty">{loading ? 'Memuat langganan…' : error ? 'Daftar langganan gagal dimuat.' : 'Tidak ada organisasi sesuai filter.'}</td></tr> : data.items.map(row => <tr key={row.organization_id}><td><div className="admin-org"><span>{row.organization_name.slice(0, 1).toUpperCase()}</span><div><strong>{row.organization_name}</strong><small title={row.organization_id}>{row.organization_id.slice(0, 8)}</small></div></div></td><td><strong>{row.owner_name || '—'}</strong><small>{row.owner_email || '—'}</small></td><td><span className={`admin-status ${row.status.toLowerCase()}`}>{labels[row.status]}</span></td><td>{date(row.current_period_end)}</td><td>{money(row.price_amount)}</td><td><div className="admin-row-actions"><button onClick={() => setHistory(row)}>Pembayaran</button><button className="admin-extend" onClick={() => edit(row, 'extend')}>{row.status === 'ACTIVE' ? 'Perpanjang' : 'Aktifkan'}</button>{(row.status === 'ACTIVE' || row.status === 'TRIAL') && <button className="admin-danger" onClick={() => edit(row, 'deactivate')}>Nonaktifkan</button>}</div></td></tr>)}</tbody></table></div>
    <footer className="admin-pagination"><span>Halaman {page} dari {Math.max(1, Math.ceil((data?.total ?? 0) / 15))}</span><div><button disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>← Sebelumnya</button><button disabled={loading || !!error || !data || page * 15 >= data.total} onClick={() => setPage(value => value + 1)}>Berikutnya →</button></div></footer></section><p className="admin-footnote">Aktivasi manual tercatat sebagai perubahan admin. Status pembayaran tetap mengikuti konfirmasi payment gateway.</p></main></div>
    <FormModal open={!!target} title={target?.action === 'extend' ? 'Aktifkan / perpanjang langganan' : 'Nonaktifkan langganan'} description={target?.row.organization_name} busy={busy} error={actionError} onClose={() => setTarget(null)} onSubmit={save} submitLabel={target?.action === 'extend' ? 'Simpan masa aktif' : 'Nonaktifkan'} formKey={target ? `${target.row.organization_id}-${target.action}` : ''}>
      {target?.action === 'extend' ? <><label>Durasi (hari)<input name="days" type="number" min="1" max="3650" defaultValue="30" required /></label><p>Masa aktif ditambahkan dari tanggal berakhir untuk langganan aktif, atau mulai hari ini untuk langganan lainnya.</p></> : <p>Akses langganan {target?.row.organization_name} akan dinonaktifkan. Riwayat pembayaran tetap tersimpan.</p>}<label>Alasan perubahan<textarea name="reason" minLength={3} maxLength={1000} required placeholder="Contoh: perpanjangan atas permintaan pelanggan" /></label>
    </FormModal>
    <Modal open={!!history} title="Riwayat pembayaran" description={history?.organization_name} size="lg" onClose={() => setHistory(null)}><div className="admin-history">{historyLoading ? <p role="status">Memuat pembayaran…</p> : historyError ? <p role="alert">{historyError} <button onClick={() => setHistory(history ? { ...history } : null)}>Coba lagi</button></p> : !orders.length ? <p>Belum ada pembayaran untuk organisasi ini.</p> : <><p>Menampilkan maksimal 100 pembayaran terbaru.</p><div className="admin-table-scroll"><table><thead><tr><th>Order</th><th>Dibuat</th><th>Jumlah</th><th>Status</th><th>Dibayar</th></tr></thead><tbody>{orders.map(order => <tr key={order.id}><td title={order.id}>{order.id.slice(0, 8)}</td><td>{date(order.created_at)}</td><td>{money(order.amount)}</td><td>{order.status}</td><td>{date(order.paid_at)}</td></tr>)}</tbody></table></div></>}</div></Modal>
  </div>
}
