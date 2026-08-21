import { api } from './client'
import type {
  Account,
  AccountingSettings,
  ApiEnvelope,
  BalanceSheet,
  JournalLineInput,
  LedgerRow,
  Contact,
  OpenItem,
  BankAccount,
  AccountMapping,
  ProfitLoss,
  TrialBalance,
  LocalizationProfile, StatutoryTaxPeriod, PayrollRun, ManufacturingOrder, FXRate,
  AgingReport,
} from '../types/accounting'

export async function getSettings() {
  const { data } = await api.get<ApiEnvelope<AccountingSettings>>('/settings')
  return data.data
}
export async function updateSettings(input: { timezone: string; fiscal_year_start_month: number; enabled_modules: string[] }) { const { data } = await api.put<ApiEnvelope<AccountingSettings>>('/settings', input); return data.data }
export async function postOpeningBalance(input: { transaction_date: string; description: string; lines: JournalLineInput[] }) { const { data } = await api.post<ApiEnvelope<unknown>>('/opening-balances', input); return data.data }

export async function getLocalization() { const { data } = await api.get<ApiEnvelope<LocalizationProfile>>('/localization/profile'); return data.data }
export async function saveLocalization(input: Partial<LocalizationProfile>) { const { data } = await api.put<ApiEnvelope<LocalizationProfile>>('/localization/profile', input); return data.data }
export async function listTaxPeriods() { const { data } = await api.get<ApiEnvelope<StatutoryTaxPeriod[]>>('/statutory/tax-periods'); return data.data }
export async function createTaxPeriod(input: Record<string, unknown>) { const { data } = await api.post<ApiEnvelope<StatutoryTaxPeriod>>('/statutory/tax-periods', input); return data.data }
export async function listPayrollRuns() { const { data } = await api.get<ApiEnvelope<PayrollRun[]>>('/payroll/runs'); return data.data }
export async function postPayroll(input: Record<string, unknown>) { const { data } = await api.post<ApiEnvelope<PayrollRun>>('/payroll/runs', input); return data.data }
export async function listManufacturingOrders() { const { data } = await api.get<ApiEnvelope<ManufacturingOrder[]>>('/manufacturing/orders'); return data.data }
export async function completeManufacturing(input: Record<string, unknown>) { const { data } = await api.post<ApiEnvelope<ManufacturingOrder>>('/manufacturing/orders/complete', input); return data.data }
export async function listFXRates() { const { data } = await api.get<ApiEnvelope<FXRate[]>>('/fx/rates'); return data.data }
export async function saveFXRate(input: Record<string, unknown>) { const { data } = await api.post<ApiEnvelope<FXRate>>('/fx/rates', input); return data.data }
export async function saveForeignBalance(input: Record<string, unknown>) { const { data } = await api.put<ApiEnvelope<unknown>>('/fx/balances', input); return data.data }
export async function remeasureFX(input: Record<string, unknown>) { const { data } = await api.post<ApiEnvelope<unknown>>('/fx/remeasurements', input); return data.data }

export async function getLedger(startDate: string, endDate: string) {
  const { data } = await api.get<ApiEnvelope<LedgerRow[]>>('/ledger', { params: { start_date: startDate, end_date: endDate } })
  return data.data
}

export async function listContacts() {
  const { data } = await api.get<ApiEnvelope<Contact[]>>('/contacts')
  return data.data
}

export async function createContact(input: { type: string; name: string }) {
  const { data } = await api.post<ApiEnvelope<Contact>>('/contacts', input)
  return data.data
}

export async function listReceivables() {
  const { data } = await api.get<ApiEnvelope<OpenItem[]>>('/receivables')
  return data.data
}

export async function listPayables() {
  const { data } = await api.get<ApiEnvelope<OpenItem[]>>('/payables')
  return data.data
}

export async function createOpenItem(kind: 'receivables' | 'payables', input: Record<string, unknown>) { const { data } = await api.post<ApiEnvelope<OpenItem>>(`/${kind}`, input); return data.data }
export async function allocateOpenItem(kind: 'receivables' | 'payables', id: string, input: Record<string, unknown>) { const { data } = await api.post<ApiEnvelope<OpenItem>>(`/${kind}/${id}/payments`, input); return data.data }
export async function getAging(asOf: string) { const { data } = await api.get<ApiEnvelope<AgingReport>>('/reports/aging', { params: { as_of: asOf } }); return data.data }

export async function createExpense(input: { transaction_date: string; description: string; amount: string; payment_method: string; expense_account_id: string }) {
  const { data } = await api.post<ApiEnvelope<unknown>>('/expenses', input)
  return data.data
}

export async function listBankAccounts() {
  const { data } = await api.get<ApiEnvelope<BankAccount[]>>('/bank-accounts')
  return data.data
}

export async function createBankAccount(input: { account_id: string; name: string }) {
  const { data } = await api.post<ApiEnvelope<BankAccount>>('/bank-accounts', input)
  return data.data
}

export async function listMappings() {
  const { data } = await api.get<ApiEnvelope<AccountMapping[]>>('/integration/mappings')
  return data.data
}

export async function createDimension(input: { code: string; name: string }) {
  const { data } = await api.post<ApiEnvelope<unknown>>('/dimensions', input)
  return data.data
}

export async function downloadExport(path: 'accounts' | 'ledger', startDate?: string, endDate?: string) {
  const { data } = await api.get<Blob>(`/exports/${path}.csv`, {
    params: path === 'ledger' ? { start_date: startDate, end_date: endDate } : undefined,
    responseType: 'blob',
  })
  const url = URL.createObjectURL(data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = path === 'accounts' ? 'chart-of-accounts.csv' : 'general-ledger.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function initializeAccounting() {
  const { data } = await api.post<ApiEnvelope<{ settings: AccountingSettings }>>(
    '/settings/initialize',
    {
      currency_code: 'IDR',
      currency_scale: 0,
      timezone: 'Asia/Jakarta',
      fiscal_year_start_month: 1,
      enabled_modules: [],
    },
  )
  return data.data.settings
}

export async function listAccounts() {
  const { data } = await api.get<ApiEnvelope<Account[]>>('/accounts')
  return data.data
}

export async function createAccount(input: { code: string; name: string; type: Account['type']; parent_id: string | null }) {
  const { data } = await api.post<ApiEnvelope<Account>>('/accounts', input)
  return data.data
}

export async function createJournal(input: {
  date: string
  description: string
  lines: JournalLineInput[]
}) {
  const { data } = await api.post<ApiEnvelope<unknown>>('/journals', {
    transaction_date: input.date,
    description: input.description,
    post: true,
    lines: input.lines,
  })
  return data.data
}

type ReportName = 'trial-balance' | 'profit-loss' | 'balance-sheet'

export async function getReport<T extends TrialBalance | ProfitLoss | BalanceSheet>(
  name: ReportName,
  startDate: string,
  endDate: string,
) {
  const { data } = await api.get<ApiEnvelope<T>>(`/reports/${name}`, {
    params: { start_date: startDate, end_date: endDate },
  })
  return data.data
}
