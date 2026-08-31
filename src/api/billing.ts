import { api } from './client'
import type { ApiEnvelope } from '../types/accounting'

export interface AccountingSubscription {
  organization_id: string
  plan: 'MONTHLY'
  status: 'TRIAL' | 'INACTIVE' | 'ACTIVE' | 'EXPIRED'
  price_amount: number
  currency: 'IDR'
  current_period_start: string | null
  current_period_end: string | null
}

export interface BillingCheckout {
  order_id: string
  amount: number
  currency: 'IDR'
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED'
  payment_url: string
  expired_at: string
}

export async function getSubscription() {
  const { data } = await api.get<ApiEnvelope<AccountingSubscription>>('/billing/subscription')
  return data.data
}

export async function createBillingCheckout() {
  const { data } = await api.post<ApiEnvelope<BillingCheckout>>('/billing/checkout')
  return data.data
}

export async function getBillingOrder(id: string) {
  const { data } = await api.get<ApiEnvelope<BillingCheckout>>(`/billing/orders/${id}`)
  return data.data
}
