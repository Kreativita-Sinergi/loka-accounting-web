import { useCallback, useEffect, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import { createAccount, createJournal, deleteAccount, getSettings, initializeAccounting, listAccounts, setAccountActive, updateAccount } from './api/accounting'
import { Layout, type PageKey } from './components/Layout'
import { AccountsPage } from './pages/AccountsPage'
import { JournalPage } from './pages/JournalPage'
import { OverviewPage } from './pages/OverviewPage'
import { ReportsPage } from './pages/ReportsPage'
import { LedgerPage } from './pages/LedgerPage'
import { OperationsPage } from './pages/OperationsPage'
import { ModulePage } from './pages/ModulePage'
import { AdvancedPage } from './pages/AdvancedPage'
import { AuthPage } from './pages/AuthPage'
import { ProductsPage } from './pages/ProductsPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { ControlsPage } from './pages/ControlsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { AssetsPage } from './pages/AssetsPage'
import { ImportPage } from './pages/ImportPage'
import { GetStartedPage } from './pages/GetStartedPage'
import { getOnboarding } from './api/operations'
import type { Onboarding } from './types/operations'
import { clearSession, getStoredProfile, type AuthSession, type IdentityProfile } from './api/auth'
import type { Account, AccountingSettings, ApiEnvelope } from './types/accounting'

export default function App() {
  const [profile, setProfile] = useState<IdentityProfile | null>(() => getStoredProfile())
  const [page, setPage] = useState<PageKey>('overview')
  const [settings, setSettings] = useState<AccountingSettings | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const onboardingRouted = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const [current, accountList, onboardingValue] = await Promise.all([getSettings(), listAccounts(), getOnboarding()])
      setSettings(current); setAccounts(accountList); setOnboarding(onboardingValue)
    } catch (error) {
      if (!(error instanceof AxiosError) || error.response?.status !== 404) showError(error, setNotice)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (profile) void refresh() }, [refresh, profile])
  useEffect(() => { if (onboarding && !onboardingRouted.current && !onboarding.completed_at && !onboarding.dismissed_at) { onboardingRouted.current = true; setPage('get-started') } }, [onboarding])
  useEffect(() => {
    const disconnect = () => setProfile(null)
    window.addEventListener('loka:unauthorized', disconnect)
    return () => window.removeEventListener('loka:unauthorized', disconnect)
  }, [])

  async function initialize() {
    setLoading(true)
    try {
      setSettings(await initializeAccounting())
      setAccounts(await listAccounts())
      setNotice('Accounting dan daftar akun berhasil disiapkan.')
    } catch (error) {
      showError(error, setNotice)
    } finally {
      setLoading(false)
    }
  }

  function replaceAccount(account: Account) {
    setAccounts((current) => current.map((item) => item.id === account.id ? account : item).sort((left, right) => left.code.localeCompare(right.code, 'id-ID', { numeric: true })))
  }

  async function accountCreate(input: { code: string; name: string; type: Account['type']; parent_id: string | null }) {
    try {
      const account = await createAccount(input)
      setAccounts((current) => [...current, account].sort((left, right) => left.code.localeCompare(right.code, 'id-ID', { numeric: true })))
      setNotice('Akun berhasil dibuat.')
    } catch (error) { showError(error, setNotice); throw error }
  }

  async function accountUpdate(id: string, input: { code: string; name: string; type: Account['type']; normal_balance?: Account['normal_balance']; parent_id: string | null }) {
    try { replaceAccount(await updateAccount(id, input)); setNotice('Akun berhasil diperbarui.') }
    catch (error) { showError(error, setNotice); throw error }
  }

  async function accountStatus(id: string, active: boolean) {
    try { replaceAccount(await setAccountActive(id, active)); setNotice(active ? 'Akun diaktifkan kembali.' : 'Akun dinonaktifkan dan tetap tersimpan dalam histori.') }
    catch (error) { showError(error, setNotice); throw error }
  }

  async function accountDelete(id: string) {
    try { await deleteAccount(id); setAccounts((current) => current.filter((account) => account.id !== id)); setNotice('Akun berhasil dihapus permanen.') }
    catch (error) { showError(error, setNotice); throw error }
  }

  function authenticated(session: AuthSession) { onboardingRouted.current = false; setLoading(true); setProfile(session.profile) }
  function logout() { clearSession(); setSettings(null); setAccounts([]); setOnboarding(null); onboardingRouted.current = false; setProfile(null) }
  if (!profile) return <AuthPage onAuthenticated={authenticated} />
  const activeAccounts = accounts.filter((account) => account.is_active)
  return (
    <Layout page={page} onNavigate={setPage} profile={profile} onLogout={logout}>
      {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Tutup notifikasi">×</button></div>}
      {page === 'overview' && <OverviewPage settings={settings} onboarding={onboarding} loading={loading} onInitialize={initialize} onGetStarted={() => setPage('get-started')} />}
      {page === 'get-started' && settings && onboarding && <GetStartedPage settings={settings} onboarding={onboarding} accounts={activeAccounts} onChanged={(value) => { setOnboarding(value); void getSettings().then(setSettings) }} onNavigate={setPage} onNotice={setNotice} />}
      {page === 'accounts' && <AccountsPage accounts={accounts} onCreate={accountCreate} onUpdate={accountUpdate} onStatusChange={accountStatus} onDelete={accountDelete} />}
      {page === 'journal' && <JournalPage accounts={activeAccounts} onSubmit={async (input) => { try { await createJournal(input); setNotice('Jurnal berhasil diposting.') } catch (error) { showError(error, setNotice); throw error } }} />}
      {page === 'ledger' && <LedgerPage />}
      {page === 'operations' && <OperationsPage accounts={activeAccounts} onNotice={setNotice} />}
      {page === 'products' && <ProductsPage accounts={activeAccounts} onNotice={setNotice} />}
      {page === 'documents' && <DocumentsPage onNotice={setNotice} />}
      {page === 'controls' && <ControlsPage profile={profile} onNotice={setNotice} />}
      {page === 'advanced' && <AdvancedPage accounts={activeAccounts} onNotice={setNotice} />}
      {page === 'compliance' && <ModulePage kind="compliance" accounts={activeAccounts} onNotice={setNotice} />}
      {page === 'payroll' && <ModulePage kind="payroll" accounts={activeAccounts} onNotice={setNotice} />}
      {page === 'manufacturing' && <ModulePage kind="manufacturing" accounts={activeAccounts} onNotice={setNotice} />}
      {page === 'currency' && <ModulePage kind="currency" accounts={activeAccounts} onNotice={setNotice} />}
      {page === 'projects' && <ProjectsPage onNotice={setNotice} />}
      {page === 'assets' && <AssetsPage accounts={activeAccounts} onNotice={setNotice} />}
      {page === 'imports' && <ImportPage onNotice={setNotice} />}
      {page === 'reports' && <ReportsPage />}
    </Layout>
  )
}

function showError(error: unknown, setNotice: (message: string) => void) {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiEnvelope<unknown> | undefined
    setNotice(body?.error?.details ?? body?.message ?? 'Permintaan gagal.')
    return
  }
  setNotice('Terjadi kesalahan yang tidak dikenal.')
}
