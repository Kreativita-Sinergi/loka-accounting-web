import { api } from './client'
import type { ApiEnvelope } from '../types/accounting'
import type {
  AssetDepreciationReport,
  CashFlowIndirectReport,
  FixedAssetRegisterReport,
  GeneralLedgerReport,
  InventoryValuationReport,
  ItemTurnoverReport,
  PartnerTurnoverReport,
  StockCardReport,
} from '../types/reports'

/** Filters every operational report understands. Empty values are dropped. */
export type ReportFilters = {
  start_date?: string
  end_date?: string
  contact_id?: string
  item_id?: string
  warehouse_id?: string
  account_id?: string
  project_id?: string
}

function params(filters: ReportFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value))
}

const fetchReport = async <T>(path: string, filters: ReportFilters) =>
  (await api.get<ApiEnvelope<T>>(path, { params: params(filters) })).data.data

export const getGeneralLedger = (filters: ReportFilters) => fetchReport<GeneralLedgerReport>('/reports/general-ledger', filters)
export const getSalesByCustomer = (filters: ReportFilters) => fetchReport<PartnerTurnoverReport>('/reports/sales/by-customer', filters)
export const getSalesByItem = (filters: ReportFilters) => fetchReport<ItemTurnoverReport>('/reports/sales/by-item', filters)
export const getPurchasesBySupplier = (filters: ReportFilters) => fetchReport<PartnerTurnoverReport>('/reports/purchases/by-supplier', filters)
export const getPurchasesByItem = (filters: ReportFilters) => fetchReport<ItemTurnoverReport>('/reports/purchases/by-item', filters)
export const getStockCard = (filters: ReportFilters) => fetchReport<StockCardReport>('/reports/inventory/stock-card', filters)
export const getInventoryValuation = (filters: ReportFilters) => fetchReport<InventoryValuationReport>('/reports/inventory/valuation', filters)
export const getFixedAssetRegister = (filters: ReportFilters) => fetchReport<FixedAssetRegisterReport>('/reports/fixed-assets/register', filters)
export const getAssetDepreciation = (filters: ReportFilters) => fetchReport<AssetDepreciationReport>('/reports/fixed-assets/depreciation', filters)
export const getCashFlowIndirect = (filters: ReportFilters) => fetchReport<CashFlowIndirectReport>('/reports/cash-flow-indirect', filters)

/** Downloads any report in the shared export catalogue. */
export async function exportReport(type: string, format: 'csv' | 'xlsx' | 'pdf', filters: ReportFilters) {
  const response = await api.get(`/reports/${type}/export/${format}`, { params: params(filters), responseType: 'blob' })
  const url = URL.createObjectURL(response.data as Blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${type}.${format}`
  link.click()
  URL.revokeObjectURL(url)
}
