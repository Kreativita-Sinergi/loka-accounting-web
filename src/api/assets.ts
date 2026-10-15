import { api } from './client'
import { notifyLedgerChanged } from '../lib/refresh'
import type { ApiEnvelope } from '../types/accounting'
import type { AssetDisposal, AssetRevaluation, FixedAsset, FixedAssetInvoiceSource, FixedAssetJournalSource } from '../types/reports'

const data = async <T>(request: Promise<{ data: ApiEnvelope<T> }>) => (await request).data.data

const posted = async <T>(request: Promise<{ data: ApiEnvelope<T> }>) => { const result = await data<T>(request); notifyLedgerChanged(); return result }

export type FixedAssetInput = {
  code: string
  name: string
  acquisition_date: string
  in_service_date: string
  acquisition_amount: string
  residual_amount: string
  useful_life_months: number
  depreciation_method: string
  payment_method: string
  asset_account_id: string
  accumulated_depreciation_account_id: string
  depreciation_expense_account_id: string
}

export const listFixedAssets = (status = '') => data<FixedAsset[]>(api.get('/fixed-assets', { params: status ? { status } : undefined }))
export const createFixedAsset = (input: FixedAssetInput) => posted<FixedAsset>(api.post('/fixed-assets', input))
export const depreciateAsset = (id: string, periodDate: string) => posted(api.post(`/fixed-assets/${id}/depreciations`, { period_date: periodDate }))
export const revalueAsset = (id: string, input: Record<string, unknown>) => posted<AssetRevaluation>(api.post(`/fixed-assets/${id}/revaluations`, input))
export const listRevaluations = (id: string) => data<AssetRevaluation[]>(api.get(`/fixed-assets/${id}/revaluations`))
export const disposeAsset = (id: string, input: Record<string, unknown>) => posted<AssetDisposal>(api.post(`/fixed-assets/${id}/disposal`, input))
export const listDisposals = () => data<AssetDisposal[]>(api.get('/asset-disposals'))

/** Rincian kartu aset di atas jurnal yang sudah mengakui harga perolehannya. */
export type AssetCardInput = {
  code: string
  name: string
  in_service_date: string
  residual_amount: string
  useful_life_months: number
  depreciation_method: string
  accumulated_depreciation_account_id: string
  depreciation_expense_account_id: string
}

export const listAssetInvoiceSources = () => data<FixedAssetInvoiceSource[]>(api.get('/fixed-asset-sources/invoices'))
export const listAssetJournalSources = () => data<FixedAssetJournalSource[]>(api.get('/fixed-asset-sources/journals'))
// Keduanya tidak memposting jurnal; data() cukup tanpa notifyLedgerChanged.
export const registerAssetFromInvoice = (input: AssetCardInput & { document_line_id: string }) => data<FixedAsset>(api.post('/fixed-asset-sources/invoices', input))
export const registerAssetFromJournal = (input: AssetCardInput & { journal_entry_id: string; asset_account_id: string; amount: string; acquisition_date: string }) => data<FixedAsset>(api.post('/fixed-asset-sources/journals', input))
