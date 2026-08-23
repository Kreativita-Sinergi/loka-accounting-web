import { api } from './client'
import { getPaged, type PageRequest } from './paging'
import type { ApiEnvelope } from '../types/accounting'
import type { Attachment, DocumentJournalRow } from '../types/operations'
import type { APIKey, Approval, ApprovalPolicy, BusinessDocument, DocumentSequence, InventoryBalance, InventoryReservation, Invitation, Item, Onboarding, OrganizationMember, SecuritySettings, Unit, UnitConversion, Warehouse, Webhook } from '../types/operations'

const data = async <T>(request: Promise<{ data: ApiEnvelope<T> }>) => (await request).data.data

export type UnitInput = { code: string; name: string; precision: number }
export type WarehouseInput = { code: string; name: string; address: string }

export const listUnits = () => data<Unit[]>(api.get('/units'))
export const createUnit = (input: UnitInput) => data<Unit>(api.post('/units', input))
export const updateUnit = (id: string, input: UnitInput) => data<Unit>(api.put(`/units/${id}`, input))
export const setUnitActive = (id: string, isActive: boolean) => data<Unit>(api.patch(`/units/${id}/status`, { is_active: isActive }))
export const deleteUnit = (id: string) => data<Unit>(api.delete(`/units/${id}`))
export const listItems = () => data<Item[]>(api.get('/items'))
export const createItem = (input: Record<string, unknown>) => data<Item>(api.post('/items', input))
export const updateItem = (id: string, input: Record<string, unknown>) => data<Item>(api.put(`/items/${id}`, input))
export const setItemActive = (id: string, isActive: boolean) => data<Item>(api.patch(`/items/${id}/status`, { is_active: isActive }))
export const deleteItem = (id: string) => data<Item>(api.delete(`/items/${id}`))
export const listUnitConversions = (itemId: string) => data<UnitConversion[]>(api.get(`/items/${itemId}/unit-conversions`))
export const saveUnitConversion = (itemId: string, input: { unit_id: string; numerator: number; denominator: number }) => data<UnitConversion>(api.put(`/items/${itemId}/unit-conversions`, input))
export const listWarehouses = () => data<Warehouse[]>(api.get('/warehouses'))
export const createWarehouse = (input: WarehouseInput) => data<Warehouse>(api.post('/warehouses', input))
export const updateWarehouse = (id: string, input: WarehouseInput) => data<Warehouse>(api.put(`/warehouses/${id}`, input))
export const setWarehouseActive = (id: string, isActive: boolean) => data<Warehouse>(api.patch(`/warehouses/${id}/status`, { is_active: isActive }))
export const deleteWarehouse = (id: string) => data<Warehouse>(api.delete(`/warehouses/${id}`))
export const listDocuments = (type = '') => data<BusinessDocument[]>(api.get('/documents', { params: type ? { type } : undefined }))
export const createDocument = (input: Record<string, unknown>) => data<BusinessDocument>(api.post('/documents', input))
export const transitionDocument = (id: string, status: string) => data<BusinessDocument>(api.post(`/documents/${id}/transition`, { status }))
export const listInventoryBalances = () => data<InventoryBalance[]>(api.get('/inventory/balances'))
export const adjustInventory = (input: Record<string, unknown>) => data(api.post('/inventory/adjustments', input))
export const transferInventory = (input: Record<string, unknown>) => data(api.post('/inventory/transfers', input))
export const stockOpname = (input: Record<string, unknown>) => data(api.post('/inventory/stock-opname', input))
export const listReservations = () => data<InventoryReservation[]>(api.get('/inventory/reservations'))
export const reserveInventory = (input: Record<string, unknown>) => data<InventoryReservation>(api.post('/inventory/reservations', input))
export const releaseReservation = (id: string) => data(api.post(`/inventory/reservations/${id}/release`))

export const getSecurity = () => data<SecuritySettings>(api.get('/organization/security'))
export const saveSecurity = (input: Record<string, unknown>) => data<SecuritySettings>(api.put('/organization/security', input))
export const listInvitations = () => data<Invitation[]>(api.get('/organization/invitations'))
export const createInvitation = (input: { email: string; role_code: string }) => data<{ invitation: Invitation; invitation_token: string }>(api.post('/organization/invitations', input))
export const listMembers = () => data<OrganizationMember[]>(api.get('/organization/members'))
export const setMemberActive = (id: string, active: boolean) => data(api.patch(`/organization/members/${id}/status`, { active }))
export const setupMFA = (email: string) => data<{ secret: string; otpauth_url: string }>(api.post('/auth/mfa/setup', { email }))
export const confirmMFA = (code: string) => data<{ recovery_codes: string[] }>(api.post('/auth/mfa/confirm', { code }))
export const disableMFA = (code: string) => data(api.delete('/auth/mfa', { data: { code } }))
export const listApprovals = () => data<Approval[]>(api.get('/approvals'))
export const decideApproval = (id: string, decision: string) => data(api.post(`/approvals/${id}/decision`, { decision }))
export const listSequences = () => data<DocumentSequence[]>(api.get('/document-sequences'))
export const saveSequence = (input: Record<string, unknown>) => data<DocumentSequence>(api.put('/document-sequences', input))
export const deleteSequence = (id: string) => data<DocumentSequence>(api.delete(`/document-sequences/${id}`))
export const listAPIKeys = () => data<APIKey[]>(api.get('/api-keys'))
export const createAPIKey = (input: Record<string, unknown>) => data<{ api_key: APIKey; secret: string }>(api.post('/api-keys', input))
export const revokeAPIKey = (id: string) => data(api.post(`/api-keys/${id}/revoke`))
export const listWebhooks = () => data<Webhook[]>(api.get('/webhooks'))
export const createWebhook = (input: Record<string, unknown>) => data<{ endpoint: Webhook; signing_secret: string }>(api.post('/webhooks', input))
export const updateWebhook = (id: string, input: Record<string, unknown>) => data<Webhook>(api.put(`/webhooks/${id}`, input))
export const setWebhookActive = (id: string, isActive: boolean) => data<Webhook>(api.patch(`/webhooks/${id}/status`, { is_active: isActive }))
export const deleteWebhook = (id: string) => data<Webhook>(api.delete(`/webhooks/${id}`))
export const getOnboarding = () => data<Onboarding>(api.get('/onboarding'))
export const saveOnboarding = (input: Record<string, unknown>) => data<Onboarding>(api.put('/onboarding', input))
export const listApprovalPolicies = () => data<ApprovalPolicy[]>(api.get('/approval-policies'))
export const saveApprovalPolicy = (input: Record<string, unknown>) => data<ApprovalPolicy>(api.put('/approval-policies', input))
export const deleteApprovalPolicy = (id: string) => data<ApprovalPolicy>(api.delete(`/approval-policies/${id}`))
export async function downloadReport(type: string, format: 'csv' | 'xlsx' | 'pdf', startDate: string, endDate: string) { const response = await api.get(`/reports/${type}/export/${format}`, { params: { start_date: startDate, end_date: endDate }, responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = `${type}.${format}`; link.click(); URL.revokeObjectURL(url) }

// ---- Daftar dengan paginasi server-side (§4.1) ----
export const listItemsPaged = (request: PageRequest) => getPaged<Item>('/items', request)
export const listDocumentsPaged = (request: PageRequest) => getPaged<BusinessDocument>('/documents', request)
export const getDocument = (id: string) => data<BusinessDocument>(api.get(`/documents/${id}`))
export const getDocumentJournal = (id: string) => data<DocumentJournalRow[]>(api.get(`/documents/${id}/journal`))

// ---- Lampiran dokumen ----
export const listAttachments = (entityType: string, entityId: string) =>
  data<Attachment[]>(api.get('/attachments', { params: { entity_type: entityType, entity_id: entityId } }))

export async function uploadAttachment(entityType: string, entityId: string, file: File) {
  const form = new FormData()
  form.append('entity_type', entityType)
  form.append('entity_id', entityId)
  form.append('file', file)
  return data<Attachment>(api.post('/attachments/upload', form))
}

export const deleteAttachment = (id: string) => data(api.delete(`/attachments/${id}`))

/** Mengunduh lampiran lewat axios agar header Authorization tetap terpasang. */
export async function downloadAttachment(attachment: Attachment) {
  const response = await api.get<Blob>(`/attachments/${attachment.id}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = attachment.file_name
  link.click()
  URL.revokeObjectURL(url)
}
