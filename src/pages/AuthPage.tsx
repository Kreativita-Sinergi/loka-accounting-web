import { useState, type FormEvent } from 'react'
import { AxiosError } from 'axios'
import { acceptInvitation, login, register, saveSession, type AuthSession } from '../api/auth'
import type { ApiEnvelope } from '../types/accounting'
import { Button } from '../components/ui'

export function AuthPage({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const invitationToken = new URLSearchParams(window.location.search).get('invite') ?? ''
  const [mode, setMode] = useState<'login' | 'register' | 'invitation'>(invitationToken ? 'invitation' : 'login')
  const [organizationName, setOrganizationName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaCode, setMfaCode] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const session = mode === 'login'
        ? await login({ email, password, totp_code: mfaCode })
        : mode === 'invitation' ? await acceptInvitation({ token: invitationToken, full_name: fullName, password })
          : await register({ organization_name: organizationName, full_name: fullName, email, password })
      saveSession(session)
      onAuthenticated(session)
    } catch (cause) {
      if (cause instanceof AxiosError) {
        const body = cause.response?.data as ApiEnvelope<unknown> | undefined
        if (body?.error?.code === 'MFA_REQUIRED') { setMfaRequired(true); setError('Masukkan kode 6 digit dari aplikasi authenticator.'); return }
        setError(body?.error?.details ?? 'Permintaan belum berhasil. Coba lagi.')
      } else setError('Terjadi kesalahan yang tidak dikenal.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="connect-shell">
    <section className="connect-hero">
      <img src="/loka-icon.svg" alt="Loka" />
      <div><span>LOKA BUSINESS SUITE</span><h1>Keuangan bisnis, berdiri sebagai sistemnya sendiri.</h1><p>Kelola ledger, pajak, payroll, produksi, dan multi-currency untuk organisasi Anda. Hubungkan POS hanya bila dibutuhkan.</p></div>
      <small>© {new Date().getFullYear()} Loka Accounting</small>
    </section>
    <section className="connect-form"><div>
      <p className="eyebrow">INDEPENDENT ACCOUNTING</p>
      <h2>{mode === 'login' ? 'Masuk ke Accounting' : mode === 'invitation' ? 'Terima undangan tim' : 'Buat organisasi baru'}</h2>
      <p>{mode === 'login' ? 'Gunakan akun Loka Accounting Anda.' : mode === 'invitation' ? 'Lengkapi profil untuk bergabung ke organisasi.' : 'Siapkan workspace dan chart of accounts Indonesia dalam satu langkah.'}</p>
      {mode !== 'invitation' && <div className="auth-tabs"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(null) }}>Masuk</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(null) }}>Daftar</button></div>}
      <form className="auth-form" onSubmit={submit}>
        {mode === 'register' && <label>Nama organisasi<input value={organizationName} onChange={event => setOrganizationName(event.target.value)} placeholder="PT Contoh Indonesia" required /></label>}{mode !== 'login' && <label>Nama lengkap<input value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Nama Anda" required /></label>}
        {mode !== 'invitation' && <label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="nama@perusahaan.com" required /></label>}
        <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} placeholder="Minimal 8 karakter" required /></label>
        {mode === 'login' && mfaRequired && <label>Kode authenticator<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={event => setMfaCode(event.target.value)} placeholder="000000" required /></label>}
        {error && <div className="auth-error">{error}</div>}
        <Button disabled={loading}>{loading ? 'Memproses…' : mode === 'login' ? 'Masuk ke Accounting' : mode === 'invitation' ? 'Gabung organisasi' : 'Buat organisasi'}</Button>
      </form>
      <div className="security-note"><span>✓</span><p><strong>Aplikasi independen</strong>Akun dan organisasi dikelola Loka Accounting. Koneksi ke Loka Kasir adalah integrasi opsional.</p></div>
    </div></section>
  </main>
}
