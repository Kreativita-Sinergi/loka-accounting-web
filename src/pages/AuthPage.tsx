import { useState, type FormEvent } from 'react'
import { AxiosError } from 'axios'
import { acceptInvitation, login, register, saveSession, type AuthSession } from '../api/auth'
import type { ApiEnvelope } from '../types/accounting'
import { Button } from '../components/ui'
import './auth.css'

export function AuthPage({ onAuthenticated, initialMode = 'login', onBack }: { onAuthenticated: (session: AuthSession) => void; initialMode?: 'login' | 'register'; onBack?: () => void }) {
  const invitationToken = new URLSearchParams(window.location.search).get('invite') ?? ''
  const [mode, setMode] = useState<'login' | 'register' | 'invitation'>(invitationToken ? 'invitation' : initialMode)
  const [organizationName, setOrganizationName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaCode, setMfaCode] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (loading) return
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

  function switchMode(next: 'login' | 'register') {
    setMode(next)
    setError(null)
    setMfaRequired(false)
    setMfaCode('')
    setShowPassword(false)
  }

  return <main className="connect-shell">
    <section className="connect-hero" aria-label="Sissi Accounting">
      <div className="auth-brand"><img src="/brand/sissi-logo-light.svg" alt="Sissi" /><span>Accounting</span></div>
      <div className="auth-story">
        <p className="auth-kicker">UNTUK KEUANGAN BISNIS ANDA</p>
        <h1>Pembukuan rapi.<br /><em>Bisnis lebih pasti.</em></h1>
        <p>Catat transaksi, pantau arus kas, dan lihat laporan keuangan dalam satu tempat.</p>
        <ul className="auth-benefits"><li>Jurnal dan laporan yang saling terhubung</li><li>Akses tim sesuai peran masing-masing</li><li>Terintegrasi dengan Sissi Kasir</li></ul>
      </div>
      <footer><span>Satu ekosistem. Bisnis lebih tertata.</span><small>© {new Date().getFullYear()} Sissi</small></footer>
    </section>
    <section className="connect-form"><div>
      <div className="auth-mobile-brand"><img src="/brand/sissi-logo.svg" alt="Sissi" /><span>Accounting</span></div>
      {onBack && <button className="auth-back" type="button" onClick={onBack}>← Kembali ke beranda</button>}
      <p className="eyebrow">SISSI ACCOUNTING</p>
      <h2>{mode === 'login' ? 'Selamat datang kembali.' : mode === 'invitation' ? 'Bergabung dengan tim.' : 'Mulai kelola keuangan.'}</h2>
      <p>{mode === 'login' ? 'Masuk untuk melanjutkan pembukuan bisnis Anda.' : mode === 'invitation' ? 'Lengkapi profil Anda untuk menerima undangan organisasi.' : 'Buat akun dan organisasi untuk memulai pembukuan bisnis Anda.'}</p>
      {mode !== 'invitation' && <div className="auth-tabs" aria-label="Pilihan akses akun"><button type="button" aria-pressed={mode === 'login'} disabled={loading} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Masuk</button><button type="button" aria-pressed={mode === 'register'} disabled={loading} className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Daftar akun</button></div>}
      <form className="auth-form" onSubmit={submit} aria-busy={loading}>
        <fieldset disabled={loading}>
          {mode === 'register' && <label htmlFor="auth-organization">Nama organisasi<input id="auth-organization" name="organization" autoComplete="organization" value={organizationName} onChange={event => setOrganizationName(event.target.value)} placeholder="Nama bisnis atau perusahaan" required /></label>}
          {mode !== 'login' && <label htmlFor="auth-name">Nama lengkap<input id="auth-name" name="name" autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Nama lengkap Anda" required /></label>}
          {mode !== 'invitation' && <label htmlFor="auth-email">Email<input id="auth-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={event => setEmail(event.target.value)} placeholder="nama@perusahaan.com" required /></label>}
          <label htmlFor="auth-password">Kata sandi<span className="auth-password"><input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 8} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === 'login' ? 'Masukkan kata sandi' : 'Buat kata sandi'} aria-describedby={mode !== 'login' ? 'auth-password-help' : undefined} required /><button type="button" aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Sembunyikan' : 'Lihat'}</button></span></label>
          {mode !== 'login' && <p id="auth-password-help" className="auth-field-help">Gunakan minimal 8 karakter, maksimal 72 karakter.</p>}
          {mode === 'login' && mfaRequired && <label htmlFor="auth-code">Kode authenticator<input id="auth-code" name="totp_code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={event => setMfaCode(event.target.value.replace(/\D/g, ''))} placeholder="Kode 6 digit" required /></label>}
        </fieldset>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <Button type="submit" disabled={loading}>{loading ? 'Memproses…' : mode === 'login' ? 'Masuk ke akun' : mode === 'invitation' ? 'Terima undangan' : 'Buat akun'}<span aria-hidden="true">→</span></Button>
      </form>
      <p className="auth-integration-note">Sudah menggunakan <a href="https://kasir.sissi.id/">Sissi Kasir</a>? Gunakan akun Sissi Accounting untuk mengelola pembukuan Anda.</p>
    </div></section>
  </main>
}
