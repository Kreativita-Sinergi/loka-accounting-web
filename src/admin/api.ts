import axios from 'axios'
import type { BillingHistoryOrder } from '../api/billing'

export interface AdminSession { token: string; expires_at: string }
export interface SubscriptionRow {
  organization_id: string; organization_name: string; owner_name: string; owner_email: string
  status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'INACTIVE'; price_amount: number
  current_period_start: string | null; current_period_end: string | null; created_at: string
}
export interface SubscriptionList {
  items: SubscriptionRow[]; total: number; page: number; limit: number
  stats: { total: number; active: number; trial: number; expired: number; inactive: number }
}
const key = 'loka-accounting-admin-session'
export function readAdminSession(): AdminSession | null {
  try {
    const session = JSON.parse(sessionStorage.getItem(key) || 'null') as AdminSession | null
    return session?.token && Date.parse(session.expires_at) > Date.now() ? session : null
  } catch { return null }
}
export function saveAdminSession(session: AdminSession | null) {
  if (session) sessionStorage.setItem(key, JSON.stringify(session))
  else sessionStorage.removeItem(key)
}
const client = axios.create({ baseURL: `${(import.meta.env.VITE_ACCOUNTING_API_BASE_URL || 'http://localhost:8085/api/v1/accounting').replace(/\/$/, '')}/admin`, timeout: 15000 })
client.interceptors.request.use(config => {
  const session = readAdminSession()
  if (session) config.headers.Authorization = `Bearer ${session.token}`
  return config
})
client.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && error.config?.url !== '/login') {
    saveAdminSession(null)
    window.dispatchEvent(new Event('loka:admin-unauthorized'))
  }
  return Promise.reject(error)
})
export async function adminLogin(username: string, password: string) {
  const { data } = await client.post<{ data: AdminSession }>('/login', { username, password })
  return data.data
}
export async function subscriptions(page: number, search: string, status: string, signal?: AbortSignal) {
  const { data } = await client.get<{ data: SubscriptionList }>('/subscriptions', { params: { page, search, status }, signal })
  return data.data
}
export async function changeSubscription(id: string, action: 'extend' | 'deactivate', days: number, reason: string) {
  await client.patch(`/subscriptions/${encodeURIComponent(id)}`, { action, days, reason })
}
export async function adminOrders(id: string, signal?: AbortSignal) {
  const { data } = await client.get<{ data: BillingHistoryOrder[] }>(`/organizations/${encodeURIComponent(id)}/orders`, { signal })
  return data.data
}
