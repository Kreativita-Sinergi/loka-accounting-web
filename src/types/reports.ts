export type GeneralLedgerEntry = {
  journal_id: string
  journal_number: string
  transaction_date: string
  description: string
  debit: string
  credit: string
  running_balance: string
}

export type GeneralLedgerAccount = {
  account_id: string
  account_code: string
  account_name: string
  normal_balance: 'DEBIT' | 'CREDIT'
  opening_balance: string
  total_debit: string
  total_credit: string
  closing_balance: string
  entries: GeneralLedgerEntry[]
}

export type GeneralLedgerReport = { accounts: GeneralLedgerAccount[]; total_debit: string; total_credit: string }

export type PartnerTurnoverRow = {
  contact_id: string | null
  contact_name: string
  document_count: number
  subtotal: string
  discount: string
  tax: string
  total: string
}
export type PartnerTurnoverReport = { rows: PartnerTurnoverRow[]; total: string }

export type ItemTurnoverRow = {
  item_id: string | null
  sku: string
  item_name: string
  quantity: string
  subtotal: string
  discount: string
  tax: string
  total: string
}
export type ItemTurnoverReport = { rows: ItemTurnoverRow[]; total: string }

export type StockCardEntry = {
  occurred_at: string
  movement_type: string
  document_number: string | null
  quantity_delta: string
  value_delta: string
  running_quantity: string
  running_value: string
}
export type StockCardReport = {
  item_id: string
  opening_quantity: string
  opening_value: string
  closing_quantity: string
  closing_value: string
  entries: StockCardEntry[]
}

export type InventoryValuationRow = {
  item_id: string
  sku: string
  item_name: string
  warehouse_code: string
  warehouse_name: string
  quantity: string
  value: string
  average_cost: string
}
export type InventoryValuationReport = { rows: InventoryValuationRow[]; total: string }

export type FixedAssetRegisterRow = {
  asset_id: string
  code: string
  name: string
  acquisition_date: string
  acquisition: string
  residual: string
  carrying_adjustment: string
  useful_life_months: number
  depreciation_method: string
  status: string
  accumulated_depreciation: string
  book_value: string
  last_depreciation_period: string | null
}
export type FixedAssetRegisterReport = {
  rows: FixedAssetRegisterRow[]
  total_acquisition: string
  total_accumulated_depreciation: string
  total_book_value: string
}

export type AssetDepreciationRow = {
  asset_id: string
  code: string
  name: string
  period_date: string
  amount: string
  journal_entry_id: string
}
export type AssetDepreciationReport = { rows: AssetDepreciationRow[]; total: string }

export type CashFlowLine = { account_id: string; account_code: string; account_name: string; amount: string }
export type CashFlowIndirectReport = {
  start_date: string
  end_date: string
  net_profit: string
  non_cash_adjustments: CashFlowLine[]
  working_capital_changes: CashFlowLine[]
  operating_total: string
  investing: CashFlowLine[]
  investing_total: string
  financing: CashFlowLine[]
  financing_total: string
  net_change: string
  opening_cash: string
  closing_cash: string
  reconciled: boolean
  method: string
}

export type Project = {
  id: string
  code: string
  name: string
  contact_id: string | null
  start_date: string | null
  end_date: string | null
  contract_value_minor: number
  budget_cost_minor: number
  status: 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
  notes: string | null
}

export type ProjectProfitabilityRow = {
  project_id: string
  code: string
  name: string
  status: string
  contract_value: string
  budget_cost: string
  revenue: string
  cost: string
  margin: string
  margin_percent: string
  cost_variance: string
  billed_percent: string
}
export type ProjectProfitabilityReport = {
  rows: ProjectProfitabilityRow[]
  total_revenue: string
  total_cost: string
  total_margin: string
  total_margin_percent: string
}

export type FixedAsset = {
  id: string
  code: string
  name: string
  acquisition_date: string
  acquisition_minor: number
  residual_minor: number
  useful_life_months: number
  depreciation_method: 'STRAIGHT_LINE' | 'DOUBLE_DECLINING'
  status: string
  carrying_adjustment_minor: number
  asset_account_id: string
  accumulated_depreciation_account_id: string
  depreciation_expense_account_id: string
}

export type AssetRevaluation = {
  id: string
  fixed_asset_id: string
  revaluation_type: 'REVALUATION' | 'IMPAIRMENT'
  effective_date: string
  adjustment_minor: number
  note: string | null
}

export type AssetDisposal = {
  id: string
  fixed_asset_id: string
  disposal_date: string
  proceeds_minor: number
  carrying_minor: number
  result_minor: number
  note: string | null
}

export type ImportResult = { kind: string; imported: number; warnings: string[] }
