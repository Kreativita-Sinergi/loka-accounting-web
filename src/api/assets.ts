import { api } from './client'
import type { ApiEnvelope } from '../types/accounting'
import type { AssetDisposal, AssetRevaluation, FixedAsset } from '../types/reports'

const data = async <T>(request: Promise<{ data: ApiEnvelope<T> }>) => (await request).data.data

export type FixedAssetInput = {
  code: string
  name: string
  acquisition_date: string
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
export const createFixedAsset = (input: FixedAssetInput) => data<FixedAsset>(api.post('/fixed-assets', input))
export const depreciateAsset = (id: string, periodDate: string) => data(api.post(`/fixed-assets/${id}/depreciations`, { period_date: periodDate }))
export const revalueAsset = (id: string, input: Record<string, unknown>) => data<AssetRevaluation>(api.post(`/fixed-assets/${id}/revaluations`, input))
export const listRevaluations = (id: string) => data<AssetRevaluation[]>(api.get(`/fixed-assets/${id}/revaluations`))
export const disposeAsset = (id: string, input: Record<string, unknown>) => data<AssetDisposal>(api.post(`/fixed-assets/${id}/disposal`, input))
export const listDisposals = () => data<AssetDisposal[]>(api.get('/asset-disposals'))
