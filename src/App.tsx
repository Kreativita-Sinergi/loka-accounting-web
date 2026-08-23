import { useCallback, useEffect, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import { createAccount, createJournal, deleteAccount, getSettings, initializeAccounting, listAccounts, setAccountActive, updateAccount } from './api/accounting'
import { Shell } from './components/Shell'
import { TabContext, useTabs } from './store/tabs'
import type { PageKey } from './lib/menu'
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
  const { tabs, active, open, close, setActive, setDirty, rename } = useTabs()
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
  useEffect(() => { if (onboarding && !onboardingRouted.current && !onboarding.completed_at && !onboarding.dismissed_at) { onboardingRouted.current = true; open('get-started') } }, [onboarding, open])
  useEffect(() => {
    const openTab = (event: Event) => open((event as CustomEvent<PageKey>).detail)
    window.addEventListener('loka:open-tab', openTab)
    return () => window.removeEventListener('loka:open-tab', openTab)
  }, [open])
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

  // The account handlers let failures propagate so the calling modal can show
  // the reason inline; only successes raise a toast.
  async function accountCreate(input: { code: string; name: string; type: Account['type']; parent_id: string | null }) {
    const account = await createAccount(input)
    setAccounts((current) => [...current, account].sort((left, right) => left.code.localeCompare(right.code, 'id-ID', { numeric: true })))
    setNotice('Akun berhasil dibuat.')
  }

  async function accountUpdate(id: string, input: { code: string; name: string; type: Account['type']; normal_balance?: Account['normal_balance']; parent_id: string | null }) {
    replaceAccount(await updateAccount(id, input))
    setNotice('Akun berhasil diperbarui.')
  }

  async function accountStatus(id: string, active: boolean) {
    replaceAccount(await setAccountActive(id, active))
    setNotice(active ? 'Akun diaktifkan kembali.' : 'Akun dinonaktifkan dan tetap tersimpan dalam histori.')
  }

  async function accountDelete(id: string) {
    await deleteAccount(id)
    setAccounts((current) => current.filter((account) => account.id !== id))
    setNotice('Akun berhasil dihapus permanen.')
  }

  function authenticated(session: AuthSession) { onboardingRouted.current = false; setLoading(true); setProfile(session.profile) }
  function logout() { clearSession(); setSettings(null); setAccounts([]); setOnboarding(null); onboardingRouted.current = false; setProfile(null) }
  if (!profile) return <AuthPage onAuthenticated={authenticated} />
  const activeAccounts = accounts.filter((account) => account.is_active)

  // Keep-alive (§3.4): setiap tab yang pernah dibuka tetap ter-mount; yang tidak
  // aktif hanya disembunyikan agar scroll, isi form, dan filter tidak hilang.
  function render(key: PageKey) {
    switch (key) {
      case 'overview': return <OverviewPage settings={settings} onboarding={onboarding} loading={loading} onInitialize={initialize} onGetStarted={() => open('get-started')} />
      case 'get-started': return settings && onboarding ? <GetStartedPage settings={settings} onboarding={onboarding} accounts={activeAccounts} onChanged={(value) => { setOnboarding(value); void getSettings().then(setSettings) }} onNavigate={open} onNotice={setNotice} /> : null
      case 'accounts': return <AccountsPage accounts={accounts} onCreate={accountCreate} onUpdate={accountUpdate} onStatusChange={accountStatus} onDelete={accountDelete} />
      case 'journal': return <JournalPage accounts={activeAccounts} onSubmit={async (input) => { try { await createJournal(input); setNotice('Jurnal berhasil diposting.') } catch (error) { showError(error, setNotice); throw error } }} />
      case 'ledger': return <LedgerPage />
      case 'operations': return <OperationsPage accounts={activeAccounts} onNotice={setNotice} />
      case 'products': return <ProductsPage accounts={activeAccounts} onNotice={setNotice} />
      case 'documents': return <DocumentsPage scale={settings?.currency_scale ?? 0} onNotice={setNotice} />
      case 'controls': return <ControlsPage profile={profile!} onNotice={setNotice} />
      case 'advanced': return <AdvancedPage accounts={activeAccounts} onNotice={setNotice} />
      case 'compliance': return <ModulePage kind="compliance" accounts={activeAccounts} onNotice={setNotice} />
      case 'payroll': return <ModulePage kind="payroll" accounts={activeAccounts} onNotice={setNotice} />
      case 'manufacturing': return <ModulePage kind="manufacturing" accounts={activeAccounts} onNotice={setNotice} />
      case 'currency': return <ModulePage kind="currency" accounts={activeAccounts} onNotice={setNotice} />
      case 'projects': return <ProjectsPage onNotice={setNotice} />
      case 'assets': return <AssetsPage accounts={activeAccounts} onNotice={setNotice} />
      case 'imports': return <ImportPage onNotice={setNotice} />
      case 'reports': return <ReportsPage />
    }
  }

  return (
    <Shell tabs={tabs} active={active} onOpen={open} onClose={close} onActivate={setActive} profile={profile} onLogout={logout}>
      {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Tutup notifikasi">×</button></div>}
      {tabs.map((tab) => (
        <TabContext.Provider key={tab.key} value={{ setDirty: (dirty) => setDirty(tab.key, dirty), rename: (label) => rename(tab.key, label) }}>
          <div className="tab-panel" hidden={tab.key !== active}>{render(tab.key)}</div>
        </TabContext.Provider>
      ))}
    </Shell>
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
