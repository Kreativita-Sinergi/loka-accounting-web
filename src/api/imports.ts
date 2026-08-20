import { api } from './client'
import type { ApiEnvelope } from '../types/accounting'
import type { ImportResult } from '../types/reports'

export const IMPORT_KINDS = ['units', 'warehouses', 'contacts', 'items', 'opening-balances'] as const
export type ImportKind = (typeof IMPORT_KINDS)[number]

export async function downloadImportTemplate(kind: ImportKind) {
  const response = await api.get(`/imports/templates/${kind}`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data as Blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `template-${kind}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export async function uploadImport(kind: ImportKind, file: File, effectiveDate?: string) {
  const body = new FormData()
  body.append('file', file)
  const { data } = await api.post<ApiEnvelope<ImportResult>>(`/imports/files/${kind}`, body, {
    params: effectiveDate ? { effective_date: effectiveDate } : undefined,
  })
  return data.data
}
