import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AxiosError } from 'axios'
import { createAccount, createJournal, deleteAccount, getSettings, initializeAccounting, listAccounts, setAccountActive, updateAccount } from './api/accounting'
import { Shell } from './components/Shell'
import { TabContext, useTabs } from './store/tabs'
import { tileOf, type PageKey } from './lib/menu'
import { AccessProvider, WriteAccessProvider, useAccess } from './lib/rbac'
import { AccessDeniedPage } from './pages/AccessDeniedPage'
import { DashboardPage } from './pages/DashboardPage'
import { AccountsPage } from './pages/AccountsPage'
import { JournalPage } from './pages/JournalPage'
import { OverviewPage } from './pages/OverviewPage'
import { CompanyInfoPage } from './pages/CompanyInfoPage'
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
import { ScaffoldPage } from './pages/ScaffoldPage'
import { ItemMasterPage } from './pages/ItemMasterPage'
import { CashBankPage } from './pages/CashBankPage'
import { getOnboarding } from './api/operations'
import type { Onboarding } from './types/operations'
import { clearSession, getStoredProfile, type AuthSession, type IdentityProfile } from './api/auth'
import type { Account, AccountingSettings, ApiEnvelope } from './types/accounting'

export default function App() {
  const [profile, setProfile] = useState<IdentityProfile | null>(() => getStoredProfile())
  const { tabs, active, open, close, setActive, setDirty, rename, reorder } = useTabs()
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
      // 404: organisasi belum diinisialisasi. 403: peran ini memang tidak
      // berwenang membaca chart of accounts — menu untuknya sudah disaring.
      const status = error instanceof AxiosError ? error.response?.status : undefined
      if (status !== 404 && status !== 403) showError(error, setNotice)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (profile) void refresh() }, [refresh, profile])
  useEffect(() => { if (onboarding && !onboardingRouted.current && !onboarding.completed_at && !onboarding.dismissed_at) { onboardingRouted.current = true; open('settings.setup') } }, [onboarding, open])
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
  const scale = settings?.currency_scale ?? 0

  // Keep-alive (§3.4): setiap tab yang pernah dibuka tetap ter-mount; yang tidak
  // aktif hanya disembunyikan agar scroll, isi form, dan filter tidak hilang.
  function render(key: PageKey) {
    // Ubin yang sudah punya backend dilayani halaman aslinya; sisanya memakai
    // ScaffoldPage sehingga tata letaknya tetap sesuai Accurate.
    switch (key) {
      case 'company.monitor': return <DashboardPage scale={scale} />
      case 'company.dashboard': return <OverviewPage settings={settings} onboarding={onboarding} loading={loading} onInitialize={initialize} onGetStarted={() => open('settings.setup')} profile={profile!} scale={scale} onNavigate={open} />
      case 'settings.setup': return settings && onboarding ? <GetStartedPage settings={settings} onboarding={onboarding} accounts={activeAccounts} onChanged={(value) => { setOnboarding(value); void getSettings().then(setSettings) }} onNavigate={open} onNotice={setNotice} /> : null
      case 'settings.preference': return <AdvancedPage accounts={activeAccounts} onNotice={setNotice} />
      case 'settings.import': return <ImportPage onNotice={setNotice} />
      case 'company.info': return <CompanyInfoPage profile={profile!} onNotice={setNotice} />
      case 'settings.user': case 'settings.role': case 'settings.numbering':
        return <ControlsPage profile={profile!} onNotice={setNotice} />
      case 'company.project': return <ProjectsPage onNotice={setNotice} />
      case 'company.currency': return <ModulePage kind="currency" accounts={activeAccounts} onNotice={setNotice} />
      case 'company.department': case 'cash.account': return <AdvancedPage accounts={activeAccounts} onNotice={setNotice} />
      case 'cash.in': return <CashBankPage kind="RECEIPT" scale={scale} accounts={accounts} onNotice={setNotice} />
      case 'cash.out': return <CashBankPage kind="PAYMENT" scale={scale} accounts={accounts} onNotice={setNotice} />
      case 'cash.transfer': return <CashBankPage kind="TRANSFER" scale={scale} accounts={accounts} onNotice={setNotice} />
      case 'cash.history': return <CashBankPage kind="HISTORY" scale={scale} accounts={accounts} onNotice={setNotice} />
      case 'gl.journal': return <JournalPage accounts={activeAccounts} scale={scale} onSubmit={async (input) => { try { await createJournal(input); setNotice('Jurnal berhasil diposting.') } catch (error) { showError(error, setNotice); throw error } }} />
      case 'gl.account': return <AccountsPage accounts={accounts} scale={scale} onCreate={accountCreate} onUpdate={accountUpdate} onStatusChange={accountStatus} onDelete={accountDelete} />
      case 'gl.ledger': case 'reports.ledger': return <LedgerPage />
      case 'sales.receipt': case 'purchase.payment': case 'sales.customer': case 'purchase.vendor': case 'reports.aging':
        return <OperationsPage accounts={activeAccounts} onNotice={setNotice} />
      case 'sales.quote': return <DocumentsPage documentType="SALES_QUOTE" scale={scale} onNotice={setNotice} />
      case 'sales.order': return <DocumentsPage documentType="SALES_ORDER" scale={scale} onNotice={setNotice} />
      case 'sales.delivery': return <DocumentsPage documentType="DELIVERY" scale={scale} onNotice={setNotice} />
      case 'sales.invoice': return <DocumentsPage documentType="SALES_INVOICE" scale={scale} onNotice={setNotice} />
      case 'sales.return': return <DocumentsPage documentType="SALES_RETURN" scale={scale} onNotice={setNotice} />
      case 'purchase.requisition': return <DocumentsPage documentType="PURCHASE_REQUISITION" scale={scale} onNotice={setNotice} />
      case 'purchase.order': return <DocumentsPage documentType="PURCHASE_ORDER" scale={scale} onNotice={setNotice} />
      case 'purchase.receipt': return <DocumentsPage documentType="GOODS_RECEIPT" scale={scale} onNotice={setNotice} />
      case 'purchase.invoice': return <DocumentsPage documentType="PURCHASE_INVOICE" scale={scale} onNotice={setNotice} />
      case 'purchase.return': return <DocumentsPage documentType="PURCHASE_RETURN" scale={scale} onNotice={setNotice} />
      case 'inventory.transfer': case 'inventory.adjustment': case 'inventory.opnameresult': case 'inventory.stockbywarehouse':
        return <DocumentsPage scale={scale} onNotice={setNotice} />
      case 'inventory.category': return <ItemMasterPage kind="category" accounts={activeAccounts} onNotice={setNotice} />
      case 'inventory.brand': return <ItemMasterPage kind="brand" accounts={activeAccounts} onNotice={setNotice} />
      case 'inventory.item': case 'inventory.warehouse': case 'inventory.unit':
        return <ProductsPage accounts={activeAccounts} onNotice={setNotice} />
      case 'inventory.joborder': case 'inventory.material': case 'inventory.rollover':
        return <ModulePage kind="manufacturing" accounts={activeAccounts} onNotice={setNotice} />
      case 'fa.asset': return <AssetsPage accounts={activeAccounts} onNotice={setNotice} />
      case 'tax.indonesia': return <ModulePage kind="compliance" accounts={activeAccounts} onNotice={setNotice} />
      case 'tax.payroll': return <ModulePage kind="payroll" accounts={activeAccounts} onNotice={setNotice} />
      case 'reports.list': return <ReportsPage />
      default: return <ScaffoldPage pageKey={key} />
    }
  }

  return (
    <AccessProvider profile={profile}>
      <Shell tabs={tabs} active={active} onOpen={open} onClose={close} onActivate={setActive} onReorder={reorder} profile={profile} onLogout={logout}>
        {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Tutup notifikasi">×</button></div>}
        {tabs.map((tab) => (
          <TabContext.Provider key={tab.key} value={{ setDirty: (dirty) => setDirty(tab.key, dirty), rename: (label) => rename(tab.key, label), restore: () => rename(tab.key, tileOf(tab.key).label) }}>
            <TabPanel tabKey={tab.key} hidden={tab.key !== active}>{render(tab.key)}</TabPanel>
          </TabContext.Provider>
        ))}
      </Shell>
    </AccessProvider>
  )
}

/**
 * Satu panel tab: menegakkan RBAC halaman (§3.5) dan menyediakan wewenang
 * tulis bagi komponen daftar bersama di dalamnya.
 */
function TabPanel({ tabKey, hidden, children }: { tabKey: PageKey; hidden: boolean; children: ReactNode }) {
  const { can, role } = useAccess()
  const tile = tileOf(tabKey)
  return (
    <div className="tab-panel" hidden={hidden}>
      <WriteAccessProvider value={can(tile.write)}>
        {can(tile.view) ? children : <AccessDeniedPage tile={tile} role={role} />}
      </WriteAccessProvider>
    </div>
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
