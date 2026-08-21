export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'COGS'
  | 'EXPENSE'
  | 'OTHER_INCOME'
  | 'OTHER_EXPENSE'

export interface AccountingSettings {
  business_id: string
  currency_code: string
  currency_scale: number
  timezone: string
  fiscal_year_start_month: number
  enabled_modules: string[]
}

export interface Account {
  id: string
  code: string
  name: string
  type: AccountType
  normal_balance: 'DEBIT' | 'CREDIT'
  parent_id: string | null
  system_key: string | null
  is_system: boolean
  is_active: boolean
}

export interface JournalLineInput {
  account_id: string
  description: string
  debit: string
  credit: string
}

export interface ApiEnvelope<T> {
  status: boolean
  message: string
  data: T
  error?: { code: string; details: string }
}

export interface TrialBalance {
  rows: Array<{
    account_id: string
    account_code: string
    account_name: string
    account_type: string
    debit: string
    credit: string
  }>
  total_debit: string
  total_credit: string
  balanced: boolean
}

export interface ProfitLoss {
  revenue: string
  cost_of_goods_sold: string
  gross_profit: string
  operating_expense: string
  other_income: string
  other_expense: string
  net_profit: string
}

export interface BalanceSheet {
  total_assets: string
  total_liabilities: string
  total_equity: string
  current_earnings: string
  liabilities_and_equity: string
  balanced: boolean
}

export interface LedgerRow {
  journal_id: string
  journal_number: string
  transaction_date: string
  description: string
  account_code: string
  account_name: string
  outlet_id: string | null
  debit: string
  credit: string
  balance: string
}

export interface Contact {
  id: string
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH'
  name: string
  email: string | null
  phone: string | null
  tax_identifier: string | null
  external_reference: string | null
  is_active: boolean
}

export interface OpenItem {
  id: string
  number: string
  contact_id: string
  issue_date: string
  due_date: string | null
  description: string
  original_minor: number
  outstanding_minor: number
  status: string
  /** Set only for foreign-currency items; the *_minor fields stay in base currency. */
  currency_code: string | null
  foreign_original_minor: number | null
  foreign_outstanding_minor: number | null
  exchange_rate_numerator: number | null
  exchange_rate_denominator: number | null
}

export interface AgingBucket { current_minor: number; days_1_30_minor: number; days_31_60_minor: number; days_61_90_minor: number; over_90_minor: number; total_minor: number }
export interface AgingReport { as_of: string; receivables: AgingBucket; payables: AgingBucket }

export interface BankAccount {
  id: string
  account_id: string
  name: string
  bank_name: string | null
  account_number: string | null
  currency_code: string
  is_active: boolean
}

export interface AccountMapping {
  id: string
  source_system: string
  mapping_key: string
  account_id: string
}

export interface LocalizationProfile { business_id: string; country_code: string; legal_name: string; tax_identifier: string | null; is_vat_registered: boolean; vat_registration_number: string | null; statutory_timezone: string }
export interface StatutoryTaxPeriod { id: string; tax_type: string; period_start: string; period_end: string; output_tax_minor: number; input_tax_minor: number; withheld_minor: number; payable_minor: number; status: string }
export interface PayrollRun { id: string; period_start: string; period_end: string; payment_date: string; gross_minor: number; employee_deductions_minor: number; employer_contributions_minor: number; net_minor: number; status: string }
export interface ManufacturingOrder { id: string; order_number: string; product_reference: string; completion_date: string; quantity_minor: number; finished_goods_minor: number; status: string }
export interface FXRate { id: string; currency_code: string; rate_date: string; rate_numerator: number; rate_denominator: number; source: string }
